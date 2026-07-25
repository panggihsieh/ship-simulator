/* audio.js
 * 程序化音效引擎（Web Audio API，無外部音檔）
 * 提供：主機引擎聲、風浪聲、暴雨聲、電報鐘聲、舵機聲、穩度警報聲
 */
const ShipAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = false;

  // Engine
  let engineOsc, engineOsc2, engineGain, engineFilter;
  // Wind/sea noise
  let windNoiseSrc, windGain, windFilter;
  // Rain noise
  let rainNoiseSrc, rainGain, rainFilter;
  // Alarm
  let alarmOsc, alarmGain, alarmActive = false, alarmTimer = null;
  // Rudder servo
  let rudderOsc, rudderGain;
  let rudderMoveTimeout = null;

  function makeNoiseBuffer(actx, seconds = 2) {
    const bufferSize = actx.sampleRate * seconds;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);

    // --- Engine sound: two detuned oscillators through lowpass filter ---
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 220;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;

    engineOsc = ctx.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 40;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = "square";
    engineOsc2.frequency.value = 41;

    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);
    engineOsc.start();
    engineOsc2.start();

    // --- Wind / sea noise: filtered white noise loop ---
    windNoiseSrc = ctx.createBufferSource();
    windNoiseSrc.buffer = makeNoiseBuffer(ctx, 3);
    windNoiseSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    windNoiseSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windNoiseSrc.start();

    // --- Rain noise: highpass white noise ---
    rainNoiseSrc = ctx.createBufferSource();
    rainNoiseSrc.buffer = makeNoiseBuffer(ctx, 3);
    rainNoiseSrc.loop = true;
    rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 3000;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainNoiseSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    rainNoiseSrc.start();

    // --- Alarm tone ---
    alarmOsc = ctx.createOscillator();
    alarmOsc.type = "square";
    alarmOsc.frequency.value = 880;
    alarmGain = ctx.createGain();
    alarmGain.gain.value = 0.0;
    alarmOsc.connect(alarmGain);
    alarmGain.connect(masterGain);
    alarmOsc.start();

    // --- Rudder servo whine ---
    rudderOsc = ctx.createOscillator();
    rudderOsc.type = "triangle";
    rudderOsc.frequency.value = 300;
    rudderGain = ctx.createGain();
    rudderGain.gain.value = 0.0;
    rudderOsc.connect(rudderGain);
    rudderGain.connect(masterGain);
    rudderOsc.start();

    enabled = true;
  }

  function resume() {
    if (!ctx) init();
    if (ctx.state === "suspended") ctx.resume();
  }

  function setVolume(v01) {
    if (!masterGain) return;
    masterGain.gain.setTargetAtTime(v01, ctx.currentTime, 0.05);
  }

  /**
   * Update engine sound based on RPM percentage (-100..100) and load condition
   */
  function updateEngine(rpmPercent) {
    if (!ctx) return;
    const mag = Math.min(1, Math.abs(rpmPercent) / 100);
    const baseFreq = 30 + mag * 55; // 30Hz idle .. 85Hz full
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(baseFreq, t, 0.3);
    engineOsc2.frequency.setTargetAtTime(baseFreq * 1.01, t, 0.3);
    engineFilter.frequency.setTargetAtTime(150 + mag * 500, t, 0.3);
    const targetGain = mag > 0.01 ? 0.08 + mag * 0.22 : 0.05;
    engineGain.gain.setTargetAtTime(targetGain, t, 0.4);
  }

  /**
   * Update wind/sea and rain sound based on Beaufort-equivalent intensity (0..12+)
   * and whether typhoon mode is active
   */
  function updateWeather(intensity, isTyphoon) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const norm = Math.min(1.4, intensity / 12); // allow >1 for typhoon overshoot
    windGain.gain.setTargetAtTime(0.03 + norm * 0.35, t, 0.5);
    windFilter.frequency.setTargetAtTime(300 + norm * 900, t, 0.5);
    windFilter.Q.value = 0.5 + norm * 1.5;

    const rainTarget = isTyphoon ? Math.min(0.3, 0.05 + norm * 0.25) : 0;
    rainGain.gain.setTargetAtTime(rainTarget, t, 0.6);
  }

  /**
   * Trigger a short bell "ding" sound for telegraph command change
   */
  function telegraphBell() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = "sine";
    bellOsc.frequency.value = 1200;
    bellGain.gain.setValueAtTime(0.25, t);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    bellOsc.connect(bellGain);
    bellGain.connect(masterGain);
    bellOsc.start(t);
    bellOsc.stop(t + 0.6);
  }

  /**
   * Trigger rudder servo whine briefly when helm order changes
   */
  function rudderMove() {
    if (!ctx) return;
    const t = ctx.currentTime;
    rudderGain.gain.cancelScheduledValues(t);
    rudderGain.gain.setTargetAtTime(0.12, t, 0.05);
    rudderOsc.frequency.setTargetAtTime(260 + Math.random() * 60, t, 0.05);
    clearTimeout(rudderMoveTimeout);
    rudderMoveTimeout = setTimeout(() => {
      if (rudderGain) rudderGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.2);
    }, 350);
  }

  /**
   * Toggle stability/typhoon alarm (steady beeping klaxon)
   */
  function setAlarm(active) {
    alarmActive = active;
    if (!ctx) return;
    if (active && !alarmTimer) {
      let on = false;
      alarmTimer = setInterval(() => {
        const t = ctx.currentTime;
        on = !on;
        alarmGain.gain.setTargetAtTime(on ? 0.15 : 0.0, t, 0.02);
        alarmOsc.frequency.setValueAtTime(on ? 880 : 660, t);
      }, 400);
    } else if (!active && alarmTimer) {
      clearInterval(alarmTimer);
      alarmTimer = null;
      if (alarmGain) alarmGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.1);
    }
  }

  function isEnabled() {
    return enabled;
  }

  return {
    init, resume, setVolume, updateEngine, updateWeather,
    telegraphBell, rudderMove, setAlarm, isEnabled
  };
})();

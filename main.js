/* main.js
 * 事件綁定、模擬主迴圈、UI 同步、音效觸發
 */
(() => {
  const state = ShipPhysics.createState();
  const trail = [];
  let lastTime = performance.now();
  let trailAccum = 0;

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const rudderSlider = $("rudderSlider");
  const rudderVal = $("rudderVal");
  const engineVal = $("engineVal");
  const telegraph = $("telegraph");
  const seaSlider = $("seaSlider");
  const seaVal = $("seaVal");
  const seaDesc = $("seaDesc");
  const typhoonMode = $("typhoonMode");
  const typhoonDesc = $("typhoonDesc");
  const windDirSlider = $("windDirSlider");
  const windDirVal = $("windDirVal");
  const sceneBtnRow = $("sceneBtnRow");
  const sceneDesc = $("sceneDesc");
  const timeOfDaySlider = $("timeOfDaySlider");
  const timeOfDayVal = $("timeOfDayVal");
  const dayNightCycleChk = $("dayNightCycleChk");
  const loadCondition = $("loadCondition");
  const heelInitSlider = $("heelInitSlider");
  const heelInitVal = $("heelInitVal");
  const resetBtn = $("resetBtn");
  const anchorBtn = $("anchorBtn");
  const pauseBtn = $("pauseBtn");
  const timeScaleSlider = $("timeScaleSlider");
  const timeScaleVal = $("timeScaleVal");
  const gmBarFill = $("gmBarFill");
  const gmValText = $("gmValText");
  const rollPeriodText = $("rollPeriodText");
  const stabilityWarning = $("stabilityWarning");
  const simClock = $("simClock");
  const statusBar = $("statusBar");
  const topbar = document.querySelector(".topbar");

  const chartCanvas = $("chartCanvas");
  const rollCanvas = $("rollCanvas");
  const pitchCanvas = $("pitchCanvas");
  const bridgeCanvas = $("bridgeCanvas");

  const posReadout = $("posReadout");
  const cogReadout = $("cogReadout");
  const trimReadout = $("trimReadout");
  const rollAmpReadout = $("rollAmpReadout");

  const hudHeading = $("hudHeading");
  const hudSpeed = $("hudSpeed");
  const hudRot = $("hudRot");
  const hudHeel = $("hudHeel");
  const hudWind = $("hudWind");
  const hudTime = $("hudTime");

  const soundToggleBtn = $("soundToggleBtn");
  const volumeSlider = $("volumeSlider");

  const gaugeCompass = $("gaugeCompass");
  const gaugeSpeed = $("gaugeSpeed");
  const gaugeRudder = $("gaugeRudder");
  const gaugeROT = $("gaugeROT");
  const gaugeHeel = $("gaugeHeel");
  const gaugeAttitude = $("gaugeAttitude");
  const gaugeRPM = $("gaugeRPM");
  const gaugeWind = $("gaugeWind");
  const gaugeDepth = $("gaugeDepth");

  // ---------- Control bindings ----------
  rudderSlider.addEventListener("input", () => {
    state.rudderCmd = Number(rudderSlider.value);
    rudderVal.textContent = state.rudderCmd + "°";
    if (ShipAudio.isEnabled()) ShipAudio.rudderMove();
  });

  document.querySelectorAll("#rudderSlider ~ .btnrow button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.rudder);
      rudderSlider.value = v;
      state.rudderCmd = v;
      rudderVal.textContent = v + "°";
      if (ShipAudio.isEnabled()) ShipAudio.rudderMove();
    });
  });

  telegraph.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.eng);
      state.enginePercent = v;
      engineVal.textContent = engineLabel(v);
      telegraph.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (ShipAudio.isEnabled()) ShipAudio.telegraphBell();
    });
  });

  function engineLabel(v) {
    if (v === 0) return "STOP";
    const dir = v > 0 ? "AHEAD" : "ASTERN";
    const mag = Math.abs(v);
    let tag = "FULL";
    if (mag <= 15) tag = "DEAD SLOW";
    else if (mag <= 40) tag = "SLOW";
    else if (mag <= 70) tag = "HALF";
    return `${tag} ${dir}`;
  }

  seaSlider.addEventListener("input", () => {
    state.beaufort = Number(seaSlider.value);
    seaVal.textContent = state.beaufort;
    const lvl = ShipPhysics.BEAUFORT_TABLE[state.beaufort];
    seaDesc.textContent = lvl.name + ` (風 ${lvl.wind}kn / 浪 ${lvl.wave}m)`;
  });

  typhoonMode.addEventListener("change", () => {
    state.typhoonMode = typhoonMode.value;
    const typ = ShipPhysics.TYPHOON_TABLE[state.typhoonMode];
    if (typ) {
      typhoonDesc.textContent = `⚠️ ${typ.name}（風 ${typ.wind}kn / 浪 ${typ.wave}m / 陣風強度 ${(typ.gust * 100).toFixed(0)}%）`;
      topbar.classList.add("typhoon-alert");
      statusBar.classList.add("typhoon-alert");
      statusBar.textContent = `⚠️ 颱風警報：${typ.name} 生效中，請小心操船！`;
    } else {
      typhoonDesc.textContent = "未啟動颱風模式";
      topbar.classList.remove("typhoon-alert");
      statusBar.classList.remove("typhoon-alert");
      statusBar.textContent = "系統就緒 System Ready";
    }
  });

  windDirSlider.addEventListener("input", () => {
    state.windDir = Number(windDirSlider.value);
    windDirVal.textContent = state.windDir + "°";
  });

  const SCENE_DESC = {
    open: "外海放洋航行，海況依海象設定",
    approach: "接近港口航道，海面較平緩，注意浮標與航道界線",
    berth: "船已靠泊碼頭，水面平靜，適合觀察纜繩與碰墊",
  };
  function setScene(v) {
    state.scene = v;
    sceneDesc.textContent = SCENE_DESC[state.scene] || "";
    sceneBtnRow.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.scene === v));
  }
  sceneBtnRow.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setScene(btn.dataset.scene));
  });

  function formatTimeOfDay(t) {
    const h = Math.floor(t);
    const m = Math.floor((t - h) * 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  timeOfDaySlider.addEventListener("input", () => {
    state.timeOfDay = Number(timeOfDaySlider.value);
    timeOfDayVal.textContent = formatTimeOfDay(state.timeOfDay);
  });

  dayNightCycleChk.addEventListener("change", () => {
    state.dayNightCycle = dayNightCycleChk.checked;
    timeOfDaySlider.disabled = state.dayNightCycle;
  });

  loadCondition.addEventListener("change", () => {
    state.loadCondition = loadCondition.value;
  });

  heelInitSlider.addEventListener("input", () => {
    heelInitVal.textContent = heelInitSlider.value + "°";
  });

  resetBtn.addEventListener("click", () => {
    Object.assign(state, ShipPhysics.createState());
    state.beaufort = Number(seaSlider.value);
    state.typhoonMode = typhoonMode.value;
    state.windDir = Number(windDirSlider.value);
    state.scene = sceneBtnRow.querySelector("button.active")?.dataset.scene || "open";
    state.timeOfDay = Number(timeOfDaySlider.value);
    state.dayNightCycle = dayNightCycleChk.checked;
    state.loadCondition = loadCondition.value;
    state.heel = Number(heelInitSlider.value);
    state.rudderCmd = 0; state.rudderActual = 0;
    state.enginePercent = 0; state.engineActual = 0;
    rudderSlider.value = 0; rudderVal.textContent = "0°";
    engineVal.textContent = "STOP";
    telegraph.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    telegraph.querySelector('[data-eng="0"]').classList.add("active");
    trail.length = 0;
    statusBar.textContent = "已重置 Simulation Reset";
  });

  anchorBtn.addEventListener("click", () => {
    state.anchored = !state.anchored;
    anchorBtn.classList.toggle("active", state.anchored);
    statusBar.textContent = state.anchored ? "⚓ 已下錨 Anchored" : "已起錨 Anchor Up";
  });

  pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "▶ 繼續 Resume" : "⏸ 暫停 Pause";
    pauseBtn.classList.toggle("active", state.paused);
  });

  timeScaleSlider.addEventListener("input", () => {
    state.timeScale = Number(timeScaleSlider.value);
    timeScaleVal.textContent = state.timeScale + "x";
  });

  soundToggleBtn.addEventListener("click", () => {
    ShipAudio.resume();
    ShipAudio.setVolume(Number(volumeSlider.value) / 100);
    soundToggleBtn.textContent = "🔊 音效已啟用 Sound On";
    soundToggleBtn.classList.add("sound-on");
  });
  volumeSlider.addEventListener("input", () => {
    ShipAudio.setVolume(Number(volumeSlider.value) / 100);
  });

  // ---------- Init state from default UI values ----------
  state.beaufort = Number(seaSlider.value);
  state.windDir = Number(windDirSlider.value);
  state.scene = sceneBtnRow.querySelector("button.active")?.dataset.scene || "open";
  state.timeOfDay = Number(timeOfDaySlider.value);
  state.loadCondition = loadCondition.value;
  telegraph.querySelector('[data-eng="0"]').classList.add("active");

  // ---------- Main loop ----------
  function formatClock(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor(totalSeconds / 60) % 60;
    const s = Math.floor(totalSeconds) % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function updateStabilityUI() {
    const gmMax = 3.0;
    const frac = ShipPhysics.clamp(state.gm / gmMax, 0, 1);
    gmBarFill.style.width = (frac * 100).toFixed(0) + "%";
    gmValText.textContent = state.gm.toFixed(2);
    rollPeriodText.textContent = state.rollPeriod.toFixed(1);
    const status = ShipPhysics.getStabilityStatus(state);
    stabilityWarning.textContent = status.text;
    stabilityWarning.style.color = status.level === "danger" ? "#ff5c5c" : status.level === "warning" ? "#ffb454" : "#4ade80";
    if (ShipAudio.isEnabled()) ShipAudio.setAlarm(status.level === "danger");
  }

  function updateReadouts(sea) {
    posReadout.textContent = `${state.x.toFixed(2)}, ${state.y.toFixed(2)} nm`;
    cogReadout.textContent = String(Math.round(state.cog)).padStart(3, "0") + "°";
    trimReadout.textContent = state.trim.toFixed(2) + "°";
    rollAmpReadout.textContent = state.rollAmplitude.toFixed(1) + "°";

    hudHeading.textContent = String(Math.round(state.heading)).padStart(3, "0");
    hudSpeed.textContent = state.speed.toFixed(1);
    hudRot.textContent = state.rot.toFixed(0);
    hudHeel.textContent = state.heel.toFixed(1);
    hudWind.textContent = sea.windSpeed.toFixed(0);
    hudTime.textContent = formatTimeOfDay(state.timeOfDay);
  }

  function updateGauges(sea) {
    ShipGauges.drawCompass(gaugeCompass, state.heading);
    ShipGauges.drawSpeed(gaugeSpeed, state.speed);
    ShipGauges.drawRudder(gaugeRudder, state.rudderActual);
    ShipGauges.drawROT(gaugeROT, state.rot);
    ShipGauges.drawHeel(gaugeHeel, state.heel);
    ShipGauges.drawAttitude(gaugeAttitude, state.heel, state.trim);
    ShipGauges.drawRPM(gaugeRPM, state.rpm);
    ShipGauges.drawWind(gaugeWind, sea.windSpeed, state.windDir, state.heading);
    ShipGauges.drawDepth(gaugeDepth, state.depth);
  }

  function loop(now) {
    const rawDt = Math.min(0.2, (now - lastTime) / 1000);
    lastTime = now;
    const dt = rawDt * state.timeScale;

    const sea = ShipPhysics.step(state, dt) || ShipPhysics.getSeaState(state);

    if (!state.paused) {
      trailAccum += dt;
      if (trailAccum > 2) {
        trail.push({ x: state.x, y: state.y });
        if (trail.length > 300) trail.shift();
        trailAccum = 0;
      }
    }

    simClock.textContent = formatClock(state.simTime);
    if (state.dayNightCycle) {
      timeOfDaySlider.value = state.timeOfDay.toFixed(1);
      timeOfDayVal.textContent = formatTimeOfDay(state.timeOfDay);
    }

    ShipRender.renderChart(chartCanvas, state, trail, sea);
    ShipRender.renderRollFront(rollCanvas, state);
    ShipRender.renderPitchSide(pitchCanvas, state);
    ShipRender.renderBridge(bridgeCanvas, state, sea, dt || 0.016);

    updateGauges(sea);
    updateReadouts(sea);
    updateStabilityUI();

    if (ShipAudio.isEnabled()) {
      ShipAudio.updateEngine(state.engineActual);
      ShipAudio.updateWeather(sea.intensity, sea.isTyphoon);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();

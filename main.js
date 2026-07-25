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
  const helmWheel = $("helmWheel");
  const helmCommand = $("helmCommand");
  const helmAngleReadout = $("helmAngleReadout");
  const helmMidshipBtn = $("helmMidshipBtn");
  const centralTelegraph = $("centralTelegraph");
  const telegraphLever = $("telegraphLever");
  const telegraphCommand = $("telegraphCommand");
  const telegraphNotch = $("telegraphNotch");
  const telegraphMinus = $("telegraphMinus");
  const telegraphPlus = $("telegraphPlus");

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
  const RUDDER_LIMIT = 35;
  const WHEEL_DEGREES_PER_RUDDER_DEGREE = 9;
  const ENGINE_NOTCHES = [-100, -70, -40, -15, 0, 15, 40, 70, 100];

  function rudderCommandLabel(v) {
    const angle = Math.abs(Math.round(v));
    if (angle === 0) return "MIDSHIPS";
    return `${v < 0 ? "PORT" : "STBD"} ${angle}°`;
  }

  function renderRudderCommand(v) {
    const angle = Math.round(ShipPhysics.clamp(v, -RUDDER_LIMIT, RUDDER_LIMIT));
    const label = rudderCommandLabel(angle);
    rudderSlider.value = angle;
    rudderVal.textContent = angle + "°";
    helmCommand.textContent = label;
    helmAngleReadout.textContent = angle + "°";
    helmWheel.style.transform = `rotate(${angle * WHEEL_DEGREES_PER_RUDDER_DEGREE}deg)`;
    helmWheel.setAttribute("aria-valuenow", String(angle));
    helmWheel.setAttribute("aria-valuetext", label);
    document.querySelectorAll("#rudderSlider ~ .btnrow button").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.rudder) === angle);
    });
  }

  function setRudderCommand(v, options = {}) {
    const angle = Math.round(ShipPhysics.clamp(v, -RUDDER_LIMIT, RUDDER_LIMIT));
    state.rudderCmd = angle;
    renderRudderCommand(angle);
    if (options.sound !== false && ShipAudio.isEnabled()) ShipAudio.rudderMove();
    if (options.status !== false) statusBar.textContent = `舵令 ${rudderCommandLabel(angle)} · Helm order`;
  }

  rudderSlider.addEventListener("input", () => {
    setRudderCommand(Number(rudderSlider.value));
  });

  document.querySelectorAll("#rudderSlider ~ .btnrow button").forEach((btn) => {
    btn.addEventListener("click", () => {
      setRudderCommand(Number(btn.dataset.rudder));
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

  function engineNotchIndex(v) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    ENGINE_NOTCHES.forEach((notch, index) => {
      const distance = Math.abs(v - notch);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  function renderEngineCommand(v) {
    const index = engineNotchIndex(v);
    const notch = ENGINE_NOTCHES[index];
    const label = engineLabel(notch);
    const leverAngle = (index - 4) * 17.5;
    engineVal.textContent = label;
    telegraphCommand.textContent = label;
    telegraphNotch.textContent = `${index + 1} / ${ENGINE_NOTCHES.length}`;
    telegraphLever.style.transform = `rotate(${leverAngle}deg)`;
    centralTelegraph.setAttribute("aria-valuenow", String(index));
    centralTelegraph.setAttribute("aria-valuetext", label);
    centralTelegraph.dataset.direction = notch < 0 ? "astern" : notch > 0 ? "ahead" : "stop";
    telegraphMinus.disabled = index === 0;
    telegraphPlus.disabled = index === ENGINE_NOTCHES.length - 1;
    telegraph.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.eng) === notch);
    });
  }

  function setEngineCommand(v, options = {}) {
    const index = engineNotchIndex(v);
    const notch = ENGINE_NOTCHES[index];
    state.enginePercent = notch;
    renderEngineCommand(notch);
    if (options.sound !== false && ShipAudio.isEnabled()) ShipAudio.telegraphBell();
    if (options.status !== false) statusBar.textContent = `主機車鐘 ${engineLabel(notch)} · Engine order`;
  }

  function shiftEngineNotch(delta) {
    const currentIndex = engineNotchIndex(state.enginePercent);
    const nextIndex = ShipPhysics.clamp(currentIndex + delta, 0, ENGINE_NOTCHES.length - 1);
    if (nextIndex !== currentIndex) setEngineCommand(ENGINE_NOTCHES[nextIndex]);
  }

  telegraph.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setEngineCommand(Number(btn.dataset.eng)));
  });

  telegraphMinus.addEventListener("click", () => shiftEngineNotch(-1));
  telegraphPlus.addEventListener("click", () => shiftEngineNotch(1));
  centralTelegraph.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "-") {
      event.preventDefault();
      shiftEngineNotch(-1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "+") {
      event.preventDefault();
      shiftEngineNotch(1);
    } else if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      setEngineCommand(0);
    }
  });

  let helmPointerId = null;
  let helmPointerAngle = 0;
  let helmDragRotation = 0;

  function pointerAngleOnWheel(event) {
    const rect = helmWheel.getBoundingClientRect();
    return Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2)
    ) * 180 / Math.PI;
  }

  helmWheel.addEventListener("pointerdown", (event) => {
    helmPointerId = event.pointerId;
    helmPointerAngle = pointerAngleOnWheel(event);
    helmDragRotation = state.rudderCmd * WHEEL_DEGREES_PER_RUDDER_DEGREE;
    helmWheel.setPointerCapture(event.pointerId);
    helmWheel.classList.add("dragging");
    if (ShipAudio.isEnabled()) ShipAudio.rudderMove();
    event.preventDefault();
  });

  helmWheel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== helmPointerId) return;
    const nextPointerAngle = pointerAngleOnWheel(event);
    let delta = nextPointerAngle - helmPointerAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    helmDragRotation = ShipPhysics.clamp(
      helmDragRotation + delta,
      -RUDDER_LIMIT * WHEEL_DEGREES_PER_RUDDER_DEGREE,
      RUDDER_LIMIT * WHEEL_DEGREES_PER_RUDDER_DEGREE
    );
    helmPointerAngle = nextPointerAngle;
    setRudderCommand(helmDragRotation / WHEEL_DEGREES_PER_RUDDER_DEGREE, { sound: false });
  });

  function finishHelmDrag(event) {
    if (event.pointerId !== helmPointerId) return;
    helmWheel.classList.remove("dragging");
    if (helmWheel.hasPointerCapture(event.pointerId)) helmWheel.releasePointerCapture(event.pointerId);
    helmPointerId = null;
  }
  helmWheel.addEventListener("pointerup", finishHelmDrag);
  helmWheel.addEventListener("pointercancel", finishHelmDrag);
  helmWheel.addEventListener("dblclick", () => setRudderCommand(0));
  helmWheel.addEventListener("keydown", (event) => {
    let next = state.rudderCmd;
    if (event.key === "ArrowLeft") next -= event.shiftKey ? 5 : 1;
    else if (event.key === "ArrowRight") next += event.shiftKey ? 5 : 1;
    else if (event.key === "Home" || event.key === "0") next = 0;
    else return;
    event.preventDefault();
    setRudderCommand(next);
  });
  helmMidshipBtn.addEventListener("click", () => setRudderCommand(0));

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
    state.rudderActual = 0;
    state.engineActual = 0;
    setRudderCommand(0, { sound: false, status: false });
    setEngineCommand(0, { sound: false, status: false });
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
  renderRudderCommand(state.rudderCmd);
  renderEngineCommand(state.enginePercent);

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

/* physics.js
 * 船舶操縱運動、速度、橫搖/縱搖、穩度（GM）與海象/颱風模擬核心
 * 全部為簡化教學用模型，非精確船舶工程計算
 */
const ShipPhysics = (() => {

  // ---------- 海況 / 颱風對照表 ----------
  // 蒲福風級 -> { name, windSpeedKn, waveHeightM }
  const BEAUFORT_TABLE = [
    { level: 0, name: "無風 Calm", wind: 0, wave: 0 },
    { level: 1, name: "軟風 Light Air", wind: 2, wave: 0.1 },
    { level: 2, name: "輕風 Light Breeze", wind: 5, wave: 0.3 },
    { level: 3, name: "微風 Gentle Breeze", wind: 9, wave: 0.6 },
    { level: 4, name: "和風 Moderate Breeze", wind: 13, wave: 1.0 },
    { level: 5, name: "清風 Fresh Breeze", wind: 19, wave: 2.0 },
    { level: 6, name: "強風 Strong Breeze", wind: 24, wave: 3.0 },
    { level: 7, name: "疾風 Near Gale", wind: 30, wave: 4.0 },
    { level: 8, name: "大風 Gale", wind: 37, wave: 5.5 },
    { level: 9, name: "烈風 Strong Gale", wind: 44, wave: 7.0 },
    { level: 10, name: "暴風 Storm", wind: 52, wave: 9.0 },
    { level: 11, name: "狂暴風 Violent Storm", wind: 60, wave: 11.5 },
    { level: 12, name: "颶風 Hurricane", wind: 72, wave: 14.0 },
  ];

  // 颱風模式 -> 覆蓋風速/浪高並加入陣風強度
  const TYPHOON_TABLE = {
    none: null,
    tropical_storm: { name: "熱帶風暴 Tropical Storm", wind: 45, wave: 6.0, gust: 0.25 },
    typhoon_mild: { name: "輕度颱風 Mild Typhoon", wind: 65, wave: 9.5, gust: 0.35 },
    typhoon_medium: { name: "中度颱風 Severe Typhoon", wind: 90, wave: 13.0, gust: 0.45 },
    typhoon_severe: { name: "強烈颱風 Super Typhoon", wind: 120, wave: 18.0, gust: 0.6 },
  };

  // ---------- 裝載狀態 / GM 對照 ----------
  const LOAD_CONDITIONS = {
    light: { name: "壓艙 Light Ballast", gm: 2.8, draftM: 4.0 },
    normal: { name: "一般裝載 Normal Loaded", gm: 1.4, draftM: 7.0 },
    full: { name: "滿載 Full Load", gm: 0.7, draftM: 9.5 },
    critical: { name: "重貨高置 Top-Heavy", gm: 0.15, draftM: 8.5 },
  };

  const DEG = Math.PI / 180;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function angDiffDeg(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function createState() {
    return {
      // Position (nm) & kinematics
      x: 0, y: 0,
      heading: 0,       // deg true
      cog: 0,           // course over ground deg
      speed: 0,         // knots (through water, forward component)
      rot: 0,           // rate of turn deg/min
      // Controls
      rudderCmd: 0, rudderActual: 0, // deg
      enginePercent: 0, engineActual: 0, // -100..100
      rpm: 0,
      // Sea state
      beaufort: 3,
      typhoonMode: "none",
      windDir: 45, // deg, direction FROM which wind blows
      // Stability
      loadCondition: "normal",
      gm: 1.4,
      heel: 0, heelRate: 0,     // deg, deg/s
      trim: 0,
      rollPeriod: 0,
      rollAmplitude: 0,
      // Depth
      depth: 50,
      anchored: false,
      paused: false,
      timeScale: 1,
      simTime: 0,
      // internal oscillator phases
      _wavePhase: 0,
      _pitchPhase: 0,
      _gustPhase: Math.random() * 1000,
    };
  }

  function getSeaState(state) {
    const typ = TYPHOON_TABLE[state.typhoonMode];
    if (typ) {
      return {
        name: typ.name,
        windSpeed: typ.wind,
        waveHeight: typ.wave,
        gust: typ.gust,
        intensity: 12 + (typ.wind / 30), // pushes beyond Beaufort 12 for scaling
        isTyphoon: true,
      };
    }
    const lvl = BEAUFORT_TABLE[clamp(Math.round(state.beaufort), 0, 12)];
    return {
      name: lvl.name,
      windSpeed: lvl.wind,
      waveHeight: lvl.wave,
      gust: 0.08,
      intensity: lvl.level,
      isTyphoon: false,
    };
  }

  /**
   * Advance simulation by dt seconds (already includes timeScale multiplier by caller)
   */
  function step(state, dt) {
    if (state.paused) return;
    state.simTime += dt;

    const sea = getSeaState(state);

    // --- Gust factor (randomized wind variability) ---
    state._gustPhase += dt * (0.3 + sea.intensity * 0.05);
    const gustNoise = Math.sin(state._gustPhase) * 0.5 + Math.sin(state._gustPhase * 2.7) * 0.5;
    const gustFactor = 1 + gustNoise * sea.gust;
    const effWind = sea.windSpeed * gustFactor;

    // --- Rudder actuator lag (rudder engine moves at limited rate ~7 deg/s) ---
    const rudderRate = 7; // deg/s
    const rudderDelta = clamp(state.rudderCmd - state.rudderActual, -rudderRate * dt, rudderRate * dt);
    state.rudderActual += rudderDelta;

    // --- Engine telegraph lag (throttle response ~ first order) ---
    const engineTau = 8; // seconds to approach commanded value
    state.engineActual += (state.enginePercent - state.engineActual) * clamp(dt / engineTau, 0, 1);
    state.rpm = state.engineActual * 2.2; // scale to rpm-like display (±220 rpm)

    // --- Speed model: target speed from engine, minus wind/wave resistance ---
    const calmMaxSpeed = 18; // knots at 100% ahead
    let targetSpeed = (state.engineActual / 100) * calmMaxSpeed;
    // resistance increases with sea intensity (encounter angle considered lightly)
    const relWave = Math.abs(angDiffDeg(state.heading, state.windDir));
    const headSeaFactor = 1 - 0.3 * Math.cos(relWave * DEG); // head seas cost more
    const resistance = 1 - clamp(sea.intensity / 40, 0, 0.35) * headSeaFactor;
    targetSpeed *= Math.max(0.35, resistance);
    // rudder induces speed loss during hard turns
    targetSpeed *= 1 - Math.abs(state.rudderActual) / 35 * 0.15;

    const speedTau = 25;
    state.speed += (targetSpeed - state.speed) * clamp(dt / speedTau, 0, 1);
    if (state.anchored) {
      state.speed *= 0.9;
      state.rpm *= 0.9;
    }

    // --- Nomoto first-order maneuvering model: T*rdot + r = K*delta ---
    const T = 6.0; // maneuvering time constant (s)
    const gainScale = 3.2;
    const desiredRot = state.rudderActual * gainScale * clamp(Math.abs(state.speed) / 12, 0.1, 1.3) * (state.speed < 0 ? -1 : 1);
    const rotDot = (desiredRot - state.rot) / T; // deg/min per second
    state.rot += rotDot * dt;

    state.heading = (state.heading + (state.rot / 60) * dt + 360) % 360;
    state.cog = state.heading; // simplified: ignoring drift/current for COG offset (could add leeway)

    // leeway drift due to wind (simplified lateral push)
    const leeway = clamp(effWind / 200, 0, 0.15) * Math.sin(angDiffDeg(state.windDir, state.heading) * DEG);
    const headingRad = state.heading * DEG;
    const vx = Math.sin(headingRad) * state.speed + Math.sin(headingRad + Math.PI / 2) * leeway * state.speed;
    const vy = Math.cos(headingRad) * state.speed + Math.cos(headingRad + Math.PI / 2) * leeway * state.speed;
    const nmPerSec = 1 / 3600;
    state.x += vx * nmPerSec * dt;
    state.y += vy * nmPerSec * dt;

    // --- Stability: GM from load condition ---
    const cond = LOAD_CONDITIONS[state.loadCondition];
    state.gm = cond.gm;

    // Natural roll period: T_roll ≈ 2*pi*k / sqrt(g*GM), simplified with beam-radius k~7.5m
    const k = 7.6; // roll radius of gyration approx (m)
    const g = 9.81;
    const gmSafe = Math.max(state.gm, 0.05);
    state.rollPeriod = 2 * Math.PI * k / Math.sqrt(g * gmSafe);

    // --- Roll (heel) dynamics: damped forced oscillator ---
    // natural frequency
    const omegaN = 2 * Math.PI / state.rollPeriod;
    const zeta = 0.12; // damping ratio (bilge keel etc.)
    // wave excitation depends on wave height & relative beam-on angle (max at 90 deg to heading)
    const relAngle = angDiffDeg(state.windDir, state.heading);
    const beamFactor = Math.abs(Math.sin(relAngle * DEG)); // beam seas excite roll most
    const waveExcitationAmp = sea.waveHeight * (0.9 + beamFactor * 2.2) * 0.55;
    state._wavePhase += dt * omegaN * (0.85 + gustNoise * 0.1);
    const excitation = waveExcitationAmp * Math.sin(state._wavePhase) * omegaN * omegaN;

    // rudder-induced heel (turning heel, heels toward outside of turn)
    const turnHeel = -clamp(state.rot / 30, -1, 1) * clamp(state.speed / 10, 0, 1) * 4;

    const heelAccel = excitation - 2 * zeta * omegaN * state.heelRate - omegaN * omegaN * state.heel;
    state.heelRate += heelAccel * dt;
    state.heel += state.heelRate * dt;
    // blend toward turn-induced steady heel component softly
    state.heel += (turnHeel - state.heel) * 0.002 * dt * 60 * 0.05;

    state.rollAmplitude = Math.abs(state.heel);

    // --- Trim / pitch (simplified sinusoidal tied to head sea encounter) ---
    state._pitchPhase += dt * omegaN * 1.3;
    const headFactor = Math.abs(Math.cos(relAngle * DEG));
    state.trim = Math.sin(state._pitchPhase) * sea.waveHeight * 0.15 * (0.5 + headFactor);

    // --- Depth (simulated seabed profile via noise, purely cosmetic) ---
    state.depth = 45 + 25 * Math.sin(state.x * 0.7 + state.y * 0.4) + 10 * Math.sin(state.x * 2.1);
    state.depth = Math.max(3, state.depth);

    return sea;
  }

  function getStabilityStatus(state) {
    const gm = state.gm;
    if (gm <= 0.2) return { level: "danger", text: "⚠️ 危險！GM 過小，穩度嚴重不足，恐有翻覆風險！" };
    if (gm < 0.6) return { level: "warning", text: "注意：GM 偏低，大浪或急轉舵時應減速謹慎操作。" };
    return { level: "ok", text: "" };
  }

  return {
    BEAUFORT_TABLE, TYPHOON_TABLE, LOAD_CONDITIONS,
    createState, getSeaState, step, getStabilityStatus, clamp, angDiffDeg,
  };
})();

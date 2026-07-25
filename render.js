/* render.js
 * 場景渲染：俯視航跡圖、船艏橫傾正視圖、駕駛台(Bridge)前視視野
 */
const ShipRender = (() => {

  const DEG = Math.PI / 180;

  // ---------------- 日夜 / 晨昏 計算 ----------------
  // timeOfDay: 0-24 小時。回傳天空與海面配色、晝夜混合比例、天體位置資訊。
  function getDayPhase(timeOfDay) {
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const elevation = Math.sin(angle); // >0 白天(6-18)，<=0 夜間
    const dayFactor = clampNum01(elevation);
    const nightFactor = clampNum01(-elevation);
    const twilight = clampNum01(1 - Math.abs(elevation) / 0.25); // 晨昏漸層強度

    const dayTop = "#168bd2", dayBottom = "#8ad8ff";
    const duskTop = "#39285f", duskBottom = "#ff914d";
    const nightTop = "#020713", nightBottom = "#101c38";

    let skyTop, skyBottom;
    if (elevation >= 0) {
      skyTop = lerpColor(duskTop, dayTop, dayFactor);
      skyBottom = lerpColor(duskBottom, dayBottom, dayFactor);
    } else {
      skyTop = lerpColor(duskTop, nightTop, nightFactor);
      skyBottom = lerpColor(duskBottom, nightBottom, nightFactor);
    }
    const seaDayTop = "#087fc2", seaNightTop = "#04182b";
    const seaTop = lerpColor(seaNightTop, seaDayTop, dayFactor);

    // celestial body position: sun during day span (6-18), moon during night span (18-6)
    const isDay = elevation >= 0;
    let bodyFrac;
    if (isDay) {
      bodyFrac = clampNum01((timeOfDay - 6) / 12);
    } else if (timeOfDay < 6) {
      bodyFrac = clampNum01((timeOfDay + 6) / 12);
    } else {
      bodyFrac = clampNum01((timeOfDay - 18) / 12);
    }

    return { elevation, dayFactor, nightFactor, twilight, skyTop, skyBottom, seaTop, isDay, bodyFrac };
  }
  function clampNum01(v) { return Math.max(0, Math.min(1, v)); }

  // ---------------- 俯視航跡圖 ----------------
  function renderChart(canvas, state, trail, sea) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const phase = getDayPhase(state.timeOfDay);

    const isBerth = state.scene === "berth";

    // Berthing uses a brighter instructional-chart blue like the supplied reference.
    ctx.fillStyle = isBerth
      ? lerpColor("#82c4ec", "#061827", phase.nightFactor)
      : lerpColor("#0a2a38", "#04101a", phase.nightFactor);
    ctx.fillRect(0, 0, w, h);

    const scale = 18; // px per nm
    const cx = w / 2, cy = h / 2;

    // wave texture lines oriented with wind/wave direction
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.windDir * DEG);
    ctx.strokeStyle = "rgba(47,208,224,0.08)";
    ctx.lineWidth = 1;
    const density = Math.max(4, 14 - Math.round(sea.intensity));
    for (let i = -h; i < h; i += density) {
      ctx.beginPath();
      ctx.moveTo(-w, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
    ctx.restore();

    // scene overlay: port approach coastline & channel buoys (world-fixed, north of start point)
    if (state.scene === "approach") {
      const anchor = { x: 0, y: 6 };
      const apx = cx + (anchor.x - state.x) * scale;
      const apy = cy - (anchor.y - state.y) * scale;
      ctx.save();
      ctx.translate(apx, apy);
      ctx.beginPath();
      ctx.moveTo(-160, -10);
      ctx.lineTo(-100, -40);
      ctx.lineTo(-30, -25);
      ctx.lineTo(40, -55);
      ctx.lineTo(120, -30);
      ctx.lineTo(160, -50);
      ctx.lineTo(160, -140);
      ctx.lineTo(-160, -140);
      ctx.closePath();
      ctx.fillStyle = phase.nightFactor > 0.5 ? "#0d1710" : "#2f4d34";
      ctx.fill();
      ctx.strokeStyle = "#1c3a24";
      ctx.stroke();
      // channel buoys either side of the entrance (port=red, starboard=green)
      ctx.beginPath(); ctx.arc(-18, 4, 4, 0, Math.PI * 2); ctx.fillStyle = "#ff5c5c"; ctx.fill();
      ctx.beginPath(); ctx.arc(18, 4, 4, 0, Math.PI * 2); ctx.fillStyle = "#4ade80"; ctx.fill();
      ctx.restore();
    }

    let berthQuayEdge = null;
    if (isBerth) {
      berthQuayEdge = cx - 34;

      // Dashed approach track and two ghost positions show the manoeuvre into the berth.
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(255,255,255,0.52)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w - 10, h - 12);
      ctx.bezierCurveTo(w - 65, h - 30, cx + 48, cy + 42, cx + 8, cy + 12);
      ctx.stroke();
      ctx.setLineDash([]);

      function drawApproachShip(x, y, angleDeg, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angleDeg * DEG);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(-10, -8, -9, 12);
        ctx.lineTo(0, 17);
        ctx.lineTo(9, 12);
        ctx.quadraticCurveTo(10, -8, 0, -18);
        ctx.closePath();
        ctx.fillStyle = "#d8d3ad";
        ctx.fill();
        ctx.strokeStyle = "#4c5d66";
        ctx.stroke();
        ctx.fillStyle = "#eef2df";
        ctx.fillRect(-5, -7, 10, 13);
        ctx.fillStyle = "#66727a";
        ctx.fillRect(-5, 8, 10, 5);
        ctx.restore();
      }
      drawApproachShip(cx + 78, cy + 73, -26, 0.32);
      drawApproachShip(cx + 40, cy + 39, -14, 0.5);
      ctx.restore();

      // Fixed quay on the port side with bollards and white cylindrical fenders.
      ctx.fillStyle = phase.nightFactor > 0.5 ? "#2a2c31" : "#57575b";
      ctx.fillRect(0, 0, berthQuayEdge, h);
      ctx.fillStyle = phase.nightFactor > 0.5 ? "#767b82" : "#999b9e";
      ctx.fillRect(berthQuayEdge - 7, 0, 7, h);
      ctx.strokeStyle = "#d7e6ef";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(berthQuayEdge, 0);
      ctx.lineTo(berthQuayEdge, h);
      ctx.stroke();

      for (let y = 23; y < h; y += 42) {
        ctx.fillStyle = "#111820";
        ctx.fillRect(berthQuayEdge - 13, y - 5, 8, 10);
        ctx.beginPath();
        ctx.arc(berthQuayEdge + 4, y + 10, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#f2f5f6";
        ctx.fill();
        ctx.strokeStyle = "#667a86";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = phase.nightFactor > 0.5 ? "#d7e6ef" : "#263d4b";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("APPROACH", w - 8, h - 8);
    }

    // trail
    if (trail && trail.length > 1) {
      ctx.beginPath();
      trail.forEach((p, i) => {
        const px = cx + (p.x - state.x) * scale;
        const py = cy - (p.y - state.y) * scale;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "rgba(255,180,84,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Wind direction arrow; move it clear of the quay in the berthing diagram.
    const windX = isBerth ? w - 30 : 30;
    ctx.save();
    ctx.translate(windX, 30);
    ctx.rotate(state.windDir * DEG);
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(-6, 0); ctx.lineTo(6, 0); ctx.closePath();
    ctx.fillStyle = "#4ade80";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 14);
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#7fa0b5";
    ctx.font = "10px monospace";
    ctx.textAlign = isBerth ? "right" : "left";
    ctx.fillText("WIND", isBerth ? w - 44 : 44, 34);

    // ship (center, fixed heading-up not used here — north-up display)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.heading * DEG);
    if (isBerth) ctx.scale(1.7, 1.7);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-7, 10);
    ctx.lineTo(0, 6);
    ctx.lineTo(7, 10);
    ctx.closePath();
    ctx.fillStyle = isBerth ? "#d8d3ad" : "#ffb454";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    if (isBerth) {
      // Bow/stern breast and spring lines connect the ship to fixed quay bollards.
      const shipScale = 1.7;
      const sinH = Math.sin(state.heading * DEG);
      const cosH = Math.cos(state.heading * DEG);
      const shipPoint = (lx, ly) => ({
        x: cx + (lx * cosH - ly * sinH) * shipScale,
        y: cy + (lx * sinH + ly * cosH) * shipScale,
      });
      const portBow = shipPoint(-5, -9);
      const portStern = shipPoint(-5, 8);
      const bollardX = berthQuayEdge - 9;
      const lines = [
        [portBow, { x: bollardX, y: cy - 34 }],
        [portBow, { x: bollardX, y: cy + 34 }],
        [portStern, { x: bollardX, y: cy - 34 }],
        [portStern, { x: bollardX, y: cy + 34 }],
      ];
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.3;
      lines.forEach(([from, to]) => {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      });
      ctx.fillStyle = "#eef4f6";
      ctx.font = "8px monospace";
      ctx.textAlign = "left";
      ctx.fillText("BOW / STERN SPRINGS", berthQuayEdge + 8, 16);
    } else {
      // Range rings are useful offshore but would clutter the berthing plan.
      ctx.strokeStyle = "rgba(127,160,181,0.25)";
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring * scale * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }


  // ---------------- 3D 側視圖：船身縱搖 Pitch ----------------
  function renderPitchSide(canvas, state) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const phase = getDayPhase(state.timeOfDay ?? 12);
    const cx = w / 2;
    const cy = h * 0.58;
    const waterY = h * 0.68;
    // Positive trim is by stern, so the bow (right side) rises counter-clockwise.
    // The compact 270px view exaggerates the angle visually while preserving the true readout.
    const pitchVisualGain = 8;
    const displayPitchDeg = clampNum(state.trim * pitchVisualGain, -12, 12);
    const pitchRad = -displayPitchDeg * DEG;
    const danger = Math.abs(state.trim) > 3;

    // Fixed sky and sea provide an inertial reference for the pitching ship.
    const sky = ctx.createLinearGradient(0, 0, 0, waterY);
    sky.addColorStop(0, phase.skyTop);
    sky.addColorStop(1, phase.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, waterY);

    const sea = ctx.createLinearGradient(0, waterY, 0, h);
    sea.addColorStop(0, phase.seaTop);
    sea.addColorStop(1, "#03131f");
    ctx.fillStyle = sea;
    ctx.fillRect(0, waterY, w, h - waterY);

    // Fixed still-water datum and centre of pitch.
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    ctx.lineTo(w, waterY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb454";
    ctx.fill();

    // Curved CW / CCW direction cue around the pitch centre.
    const hasPitch = Math.abs(state.trim) >= 0.02;
    const clockwise = state.trim < 0;
    if (hasPitch) {
      const arcRadius = 74;
      const startAngle = (clockwise ? -138 : -42) * DEG;
      const endAngle = (clockwise ? -42 : -138) * DEG;
      ctx.strokeStyle = danger ? "#ff5c5c" : "#ffb454";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, arcRadius, startAngle, endAngle, !clockwise);
      ctx.stroke();

      const tipX = cx + Math.cos(endAngle) * arcRadius;
      const tipY = cy + Math.sin(endAngle) * arcRadius;
      const tangent = endAngle + (clockwise ? Math.PI / 2 : -Math.PI / 2);
      const backX = tipX - Math.cos(tangent) * 9;
      const backY = tipY - Math.sin(tangent) * 9;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(backX + Math.cos(tangent + Math.PI / 2) * 4, backY + Math.sin(tangent + Math.PI / 2) * 4);
      ctx.lineTo(backX + Math.cos(tangent - Math.PI / 2) * 4, backY + Math.sin(tangent - Math.PI / 2) * 4);
      ctx.closePath();
      ctx.fillStyle = danger ? "#ff5c5c" : "#ffb454";
      ctx.fill();
    }

    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = state.trim > 0.02 ? "#ffb454" : "rgba(127,160,181,0.52)";
    ctx.fillText("↺ CCW / BOW UP", 8, 34);
    ctx.textAlign = "right";
    ctx.fillStyle = state.trim < -0.02 ? "#ffb454" : "rgba(127,160,181,0.52)";
    ctx.fillText("BOW DOWN / CW ↻", w - 8, 34);

    // Water shadow follows the hull but does not pitch.
    ctx.save();
    ctx.translate(cx, waterY + 17);
    ctx.scale(1, 0.18);
    const shadow = ctx.createRadialGradient(0, 0, 8, 0, 0, 105);
    shadow.addColorStop(0, "rgba(0,0,0,0.48)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Complete 3D side-view ship rotates around midships.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pitchRad);

    const depthX = 8;
    const depthY = -7;

    // Far hull face supplies perspective depth behind the visible side.
    ctx.beginPath();
    ctx.moveTo(-98 + depthX, -13 + depthY);
    ctx.lineTo(57 + depthX, -13 + depthY);
    ctx.lineTo(98 + depthX, 2 + depthY);
    ctx.lineTo(79 + depthX, 25 + depthY);
    ctx.lineTo(-88 + depthX, 25 + depthY);
    ctx.lineTo(-98 + depthX, 8 + depthY);
    ctx.closePath();
    ctx.fillStyle = "#314d5b";
    ctx.fill();
    ctx.strokeStyle = "#6f8996";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Main visible hull side with vertical light-to-dark shaping.
    const hullSide = ctx.createLinearGradient(0, -14, 0, 27);
    hullSide.addColorStop(0, "#d8e5ea");
    hullSide.addColorStop(0.5, "#718b98");
    hullSide.addColorStop(1, "#2f4b59");
    ctx.beginPath();
    ctx.moveTo(-98, -13);
    ctx.lineTo(57, -13);
    ctx.quadraticCurveTo(82, -9, 98, 2);
    ctx.lineTo(79, 25);
    ctx.lineTo(-88, 25);
    ctx.quadraticCurveTo(-98, 18, -98, 8);
    ctx.closePath();
    ctx.fillStyle = hullSide;
    ctx.fill();
    ctx.strokeStyle = danger ? "#ff8a8a" : "#e1edf2";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Red anti-fouling lower hull and boot-top stripe.
    ctx.beginPath();
    ctx.moveTo(-95, 14);
    ctx.lineTo(88, 14);
    ctx.lineTo(79, 25);
    ctx.lineTo(-88, 25);
    ctx.quadraticCurveTo(-94, 21, -95, 14);
    ctx.closePath();
    ctx.fillStyle = "#8f3038";
    ctx.fill();
    ctx.strokeStyle = "#c85a61";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#152a35";
    ctx.fillRect(-96, 10, 180, 4);

    // Deck top plane joins near and far hull edges.
    const deckTop = ctx.createLinearGradient(0, -22, 0, -8);
    deckTop.addColorStop(0, "#d7e1e4");
    deckTop.addColorStop(1, "#778e98");
    ctx.beginPath();
    ctx.moveTo(-98, -13);
    ctx.lineTo(57, -13);
    ctx.lineTo(98, 2);
    ctx.lineTo(98 + depthX, 2 + depthY);
    ctx.lineTo(57 + depthX, -13 + depthY);
    ctx.lineTo(-98 + depthX, -13 + depthY);
    ctx.closePath();
    ctx.fillStyle = deckTop;
    ctx.fill();
    ctx.strokeStyle = "#d7e6ef";
    ctx.stroke();

    // 3D superstructure: side wall, top face and forward face.
    const houseSide = ctx.createLinearGradient(-48, 0, 20, 0);
    houseSide.addColorStop(0, "#8da4af");
    houseSide.addColorStop(1, "#e7eef1");
    ctx.beginPath();
    ctx.moveTo(-49, -51);
    ctx.lineTo(19, -51);
    ctx.lineTo(26, -13);
    ctx.lineTo(-55, -13);
    ctx.closePath();
    ctx.fillStyle = houseSide;
    ctx.fill();
    ctx.strokeStyle = "#d7e6ef";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-49, -51);
    ctx.lineTo(-41, -58);
    ctx.lineTo(27, -58);
    ctx.lineTo(19, -51);
    ctx.closePath();
    ctx.fillStyle = "#dce7ea";
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(19, -51);
    ctx.lineTo(27, -58);
    ctx.lineTo(34, -20);
    ctx.lineTo(26, -13);
    ctx.closePath();
    ctx.fillStyle = "#647e8b";
    ctx.fill();
    ctx.stroke();

    // Side windows, doors and portholes.
    ctx.fillStyle = "#0a2c40";
    for (let x = -41; x <= 8; x += 10) {
      ctx.fillRect(x, -44, 7, 8);
    }
    ctx.fillStyle = "#263f4c";
    ctx.fillRect(-43, -29, 12, 16);
    ctx.fillStyle = "#dceaf0";
    for (let x = -77; x <= 53; x += 18) {
      ctx.beginPath();
      ctx.arc(x, -2, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Funnel, mast, rails and bow navigation light.
    const funnel = ctx.createLinearGradient(-29, 0, -10, 0);
    funnel.addColorStop(0, "#263a44");
    funnel.addColorStop(1, "#d37a3f");
    ctx.fillStyle = funnel;
    ctx.fillRect(-29, -72, 18, 18);
    ctx.fillStyle = "#141d22";
    ctx.fillRect(-31, -75, 22, 5);

    ctx.strokeStyle = "#d7e6ef";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(52, -14);
    ctx.lineTo(52, -68);
    ctx.moveTo(38, -56);
    ctx.lineTo(66, -56);
    ctx.moveTo(-91, -17);
    ctx.lineTo(84, -17);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(66, -56, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80";
    ctx.fill();

    // Bow face highlight reinforces the right-facing perspective.
    ctx.beginPath();
    ctx.moveTo(98, 2);
    ctx.lineTo(98 + depthX, 2 + depthY);
    ctx.lineTo(79 + depthX, 25 + depthY);
    ctx.lineTo(79, 25);
    ctx.closePath();
    ctx.fillStyle = "rgba(225,237,242,0.34)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();
    ctx.restore();

    // Foreground water clips/tints only the immersed part of the pitched hull.
    ctx.fillStyle = "rgba(5,78,118,0.25)";
    ctx.fillRect(0, waterY, w, h - waterY);
    ctx.strokeStyle = "rgba(126,225,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = waterY + Math.sin(x * 0.08 + state.simTime * 1.6) * 2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fixed orientation labels and pitch readout.
    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "#7fa0b5";
    ctx.textAlign = "left";
    ctx.fillText("STERN", 8, waterY - 7);
    ctx.textAlign = "right";
    ctx.fillText("BOW", w - 8, waterY - 7);

    ctx.textAlign = "center";
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = danger ? "#ff5c5c" : "#fff";
    const trimLabel = Math.abs(state.trim) < 0.05 ? "EVEN KEEL" : state.trim >= 0 ? "BY STERN" : "BY BOW";
    const directionLabel = Math.abs(state.trim) < 0.02 ? "" : state.trim > 0 ? " ↺ CCW" : " CW ↻";
    const trimPrecision = Math.abs(state.trim) < 1 ? 2 : 1;
    ctx.fillText(`${trimLabel} ${Math.abs(state.trim).toFixed(trimPrecision)}°${directionLabel}`, cx, 18);
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(215,230,239,0.62)";
    ctx.textAlign = "right";
    ctx.fillText(`VIS ×${pitchVisualGain}`, w - 8, h - 7);
  }

  // ---------------- 船艏正視圖：3D 船身橫搖 ----------------
  function renderRollFront(canvas, state) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const phase = getDayPhase(state.timeOfDay ?? 12);
    const cx = w / 2;
    const cy = h * 0.58;
    const waterY = h * 0.69;
    const heelRad = state.heel * DEG;
    const heelDeg = state.heel;
    const danger = Math.abs(heelDeg) > 15;

    // Fixed sky and sea make the ship's roll immediately readable.
    const sky = ctx.createLinearGradient(0, 0, 0, waterY);
    sky.addColorStop(0, phase.skyTop);
    sky.addColorStop(1, phase.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, waterY);

    const sea = ctx.createLinearGradient(0, waterY, 0, h);
    sea.addColorStop(0, phase.seaTop);
    sea.addColorStop(1, "#03131f");
    ctx.fillStyle = sea;
    ctx.fillRect(0, waterY, w, h - waterY);

    // Roll scale remains fixed while the ship rotates beneath it.
    ctx.strokeStyle = "rgba(215,230,239,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 88, (-125) * DEG, (-55) * DEG);
    ctx.stroke();
    for (let a = -30; a <= 30; a += 10) {
      const ang = (-90 + a) * DEG;
      const inner = a % 30 === 0 ? 78 : 81;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
      ctx.lineTo(cx + Math.cos(ang) * 88, cy + Math.sin(ang) * 88);
      ctx.stroke();
    }
    const pointerAngle = (-90 + clampNum(heelDeg, -35, 35)) * DEG;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(pointerAngle) * 88, cy + Math.sin(pointerAngle) * 88, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = danger ? "#ff5c5c" : "#ffb454";
    ctx.fill();

    // Soft reflection/shadow on the water plane.
    ctx.save();
    ctx.translate(cx, waterY + 18);
    ctx.scale(1, 0.24);
    const shadow = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
    shadow.addColorStop(0, "rgba(0,0,0,0.48)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Everything below rotates as one bow-on ship around its roll centre.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heelRad);

    // Mast and navigation lights sit behind the bridge.
    ctx.strokeStyle = "#d7e6ef";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -54);
    ctx.lineTo(0, -88);
    ctx.moveTo(-18, -76);
    ctx.lineTo(18, -76);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-18, -76, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5c5c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, -76, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80";
    ctx.fill();

    // Bridge block with a trapezoidal roof and dark forward windows.
    const bridgeGrad = ctx.createLinearGradient(-40, 0, 40, 0);
    bridgeGrad.addColorStop(0, "#8aa2af");
    bridgeGrad.addColorStop(0.5, "#f1f5f7");
    bridgeGrad.addColorStop(1, "#637986");
    ctx.beginPath();
    ctx.moveTo(-34, -52);
    ctx.lineTo(34, -52);
    ctx.lineTo(43, -22);
    ctx.lineTo(-43, -22);
    ctx.closePath();
    ctx.fillStyle = bridgeGrad;
    ctx.fill();
    ctx.strokeStyle = "#d7e6ef";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#0a2738";
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * 9 - 3.5, -45, 7, 9);
    }
    ctx.fillStyle = "#274357";
    ctx.fillRect(-39, -30, 78, 5);

    // Foredeck trapezoid gives depth toward the bow.
    const deckGrad = ctx.createLinearGradient(0, -25, 0, 8);
    deckGrad.addColorStop(0, "#b8c7ce");
    deckGrad.addColorStop(1, "#5e7785");
    ctx.beginPath();
    ctx.moveTo(-43, -22);
    ctx.lineTo(43, -22);
    ctx.lineTo(59, 4);
    ctx.lineTo(-59, 4);
    ctx.closePath();
    ctx.fillStyle = deckGrad;
    ctx.fill();
    ctx.strokeStyle = "#e4eef2";
    ctx.stroke();

    // Flared hull: split shading and centre crease create a 3D bow.
    const hullGrad = ctx.createLinearGradient(-66, 0, 66, 0);
    hullGrad.addColorStop(0, "#526d7c");
    hullGrad.addColorStop(0.44, "#dce8ed");
    hullGrad.addColorStop(0.54, "#b8cbd4");
    hullGrad.addColorStop(1, "#38515f");
    ctx.beginPath();
    ctx.moveTo(-59, 4);
    ctx.quadraticCurveTo(-55, 30, -30, 47);
    ctx.lineTo(0, 66);
    ctx.lineTo(30, 47);
    ctx.quadraticCurveTo(55, 30, 59, 4);
    ctx.closePath();
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.strokeStyle = danger ? "#ff8a8a" : "#d7e6ef";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Red anti-fouling lower hull.
    ctx.beginPath();
    ctx.moveTo(-39, 40);
    ctx.quadraticCurveTo(-24, 55, 0, 66);
    ctx.quadraticCurveTo(24, 55, 39, 40);
    ctx.lineTo(30, 47);
    ctx.lineTo(0, 66);
    ctx.lineTo(-30, 47);
    ctx.closePath();
    ctx.fillStyle = "#8f3038";
    ctx.fill();
    ctx.strokeStyle = "#c85a61";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bow centre ridge and deck-edge rails.
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 66);
    ctx.moveTo(-58, 2);
    ctx.lineTo(-45, -20);
    ctx.moveTo(58, 2);
    ctx.lineTo(45, -20);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Port and starboard hull faces react subtly to the immersed side.
    const dipStrength = clampNum01(Math.abs(heelDeg) / 25);
    ctx.globalAlpha = dipStrength * 0.28;
    ctx.fillStyle = "#082b42";
    ctx.beginPath();
    if (heelDeg > 0) {
      ctx.moveTo(0, 5); ctx.lineTo(59, 4); ctx.quadraticCurveTo(55, 30, 30, 47); ctx.lineTo(0, 66);
    } else {
      ctx.moveTo(0, 5); ctx.lineTo(-59, 4); ctx.quadraticCurveTo(-55, 30, -30, 47); ctx.lineTo(0, 66);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Translucent foreground water naturally clips the rotated lower hull.
    ctx.fillStyle = "rgba(5,78,118,0.28)";
    ctx.fillRect(0, waterY, w, h - waterY);
    ctx.strokeStyle = "rgba(126,225,255,0.78)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = waterY + Math.sin(x * 0.09 + state.simTime * 1.8) * 2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fixed direction and angle readout.
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ff8a8a";
    ctx.textAlign = "left";
    ctx.fillText("P", 12, waterY - 5);
    ctx.fillStyle = "#72f2a1";
    ctx.textAlign = "right";
    ctx.fillText("S", w - 12, waterY - 5);

    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = danger ? "#ff5c5c" : "#fff";
    const side = Math.abs(heelDeg) < 0.05 ? "UPRIGHT" : heelDeg > 0 ? "STBD" : "PORT";
    ctx.fillText(`${side} ${Math.abs(heelDeg).toFixed(1)}°`, cx, 18);
  }

  // ---------------- 駕駛台前視視野 (Bridge View) ----------------
  let rainDrops = [];
  function ensureRain(canvas, count) {
    if (rainDrops.length !== count) {
      rainDrops = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 10 + Math.random() * 20,
        speed: 8 + Math.random() * 10,
      }));
    }
  }

  let starField = [];
  function ensureStars(count) {
    if (starField.length !== count) {
      starField = Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 1 + Math.random() * 1.5,
      }));
    }
  }

  let lightningTimer = 0, lightningFlash = 0;

  function renderBridge(canvas, state, sea, dt) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const heelRad = state.heel * DEG;
    const pitchPx = clampNum(state.trim * 8, -40, 40); // pitch offset shifts horizon vertically

    ctx.save();
    ctx.translate(w / 2, h / 2 + pitchPx);
    ctx.rotate(heelRad);
    ctx.translate(-w / 2, -h / 2);

    const overscan = 220;
    const phase = getDayPhase(state.timeOfDay);
    const bodyX = w * (0.12 + phase.bodyFrac * 0.76);
    const bodyY = h * 0.42 - Math.sin(phase.bodyFrac * Math.PI) * h * 0.34;
    // Sky gradient — blended day/night/twilight, then darker & greener/gray for storm intensity
    const stormT = Math.min(1, sea.intensity / 14);
    const skyTop = sea.isTyphoon ? "#1a1f26" : lerpColor(phase.skyTop, "#0d1a24", stormT * 0.7);
    const skyBottom = sea.isTyphoon ? "#3a3f47" : lerpColor(phase.skyBottom, "#1c2c38", stormT * 0.5);
    const skyGrad = ctx.createLinearGradient(0, -overscan, 0, h / 2);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(1, skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-overscan, -overscan, w + overscan * 2, h / 2 + overscan);

    // Warm sunrise/sunset glow concentrated along the horizon.
    if (phase.twilight > 0.03 && !sea.isTyphoon) {
      const twilightGlow = ctx.createRadialGradient(
        bodyX, h * 0.47, 0,
        bodyX, h * 0.47, w * 0.68
      );
      twilightGlow.addColorStop(0, `rgba(255,174,84,${(0.72 * phase.twilight).toFixed(3)})`);
      twilightGlow.addColorStop(0.42, `rgba(255,103,68,${(0.28 * phase.twilight).toFixed(3)})`);
      twilightGlow.addColorStop(1, "rgba(255,90,50,0)");
      ctx.fillStyle = twilightGlow;
      ctx.fillRect(-overscan, h * 0.12, w + overscan * 2, h * 0.5);
    }

    // stars at night (fixed field, twinkle slightly, fade out with daylight)
    if (phase.nightFactor > 0.35 && !sea.isTyphoon) {
      ensureStars(110);
      ctx.globalAlpha = clampNum01((phase.nightFactor - 0.35) / 0.65);
      starField.forEach((s) => {
        const twinkle = 0.55 + 0.45 * Math.sin(state.simTime * 1.8 + s.x * 31 + s.y * 17);
        ctx.globalAlpha = clampNum01((phase.nightFactor - 0.35) / 0.65) * twinkle;
        ctx.fillStyle = s.r > 2 ? "#fff5c7" : "#e8f4ff";
        ctx.fillRect(
          s.x * (w + overscan * 2) - overscan,
          s.y * (h / 2 + overscan) - overscan,
          s.r,
          s.r
        );
      });
      ctx.globalAlpha = 1;
    }

    // sun / moon disc arcing across the sky based on time of day
    if (!sea.isTyphoon) {
      const isSun = phase.isDay;
      ctx.beginPath();
      const glowRadius = isSun ? 62 : 26;
      const glow = ctx.createRadialGradient(bodyX, bodyY, 2, bodyX, bodyY, glowRadius);
      glow.addColorStop(0, isSun ? "rgba(255,246,191,1)" : "rgba(220,230,245,0.9)");
      glow.addColorStop(0.28, isSun ? "rgba(255,218,108,0.72)" : "rgba(190,210,245,0.3)");
      glow.addColorStop(1, isSun ? "rgba(255,204,80,0)" : "rgba(190,210,245,0)");
      ctx.fillStyle = glow;
      ctx.arc(bodyX, bodyY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = isSun ? "#fff4b8" : "#e8eef5";
      ctx.arc(bodyX, bodyY, isSun ? 16 : 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // lightning flash overlay (only severe typhoon)
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${lightningFlash * 0.5})`;
      ctx.fillRect(-overscan, -overscan, w + overscan * 2, h + overscan * 2);
    }

    // sea gradient
    const seaGrad = ctx.createLinearGradient(0, h / 2, 0, h + overscan);
    seaGrad.addColorStop(0, sea.isTyphoon ? "#1b2a30" : phase.seaTop);
    seaGrad.addColorStop(0.55, sea.isTyphoon ? "#101f28" : lerpColor("#075b92", "#03192d", phase.nightFactor));
    seaGrad.addColorStop(1, "#020d18");
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-overscan, h / 2, w + overscan * 2, h / 2 + overscan);

    // Sunlight path shimmering from the horizon toward the bow at daytime.
    if (phase.isDay && phase.dayFactor > 0.08 && !sea.isTyphoon) {
      const reflectionAlpha = 0.16 + phase.dayFactor * 0.30;
      const reflection = ctx.createLinearGradient(0, h / 2, 0, h);
      reflection.addColorStop(0, `rgba(255,242,176,${reflectionAlpha.toFixed(3)})`);
      reflection.addColorStop(1, "rgba(255,224,128,0)");
      ctx.strokeStyle = reflection;
      ctx.lineWidth = 2;
      for (let i = 0; i < 15; i++) {
        const depth = i / 14;
        const y = h / 2 + 8 + depth * depth * h * 0.38;
        const halfWidth = 7 + depth * w * 0.10;
        const wobble = Math.sin(state.simTime * 1.4 + i * 1.7) * (3 + depth * 8);
        ctx.beginPath();
        ctx.moveTo(bodyX - halfWidth + wobble, y);
        ctx.lineTo(bodyX + halfWidth + wobble, y);
        ctx.stroke();
      }
    }

    // scene overlay: port approach — coastline & lighthouse on the horizon
    if (state.scene === "approach") {
      ctx.fillStyle = phase.nightFactor > 0.5 ? "#0d1710" : "#233a29";
      ctx.beginPath();
      ctx.moveTo(-overscan, h / 2);
      ctx.lineTo(-overscan, h * 0.30);
      ctx.lineTo(w * 0.15, h * 0.36);
      ctx.lineTo(w * 0.35, h * 0.24);
      ctx.lineTo(w * 0.55, h * 0.34);
      ctx.lineTo(w * 0.62, h / 2);
      ctx.closePath();
      ctx.fill();
      // lighthouse tower with blinking light
      const lhX = w * 0.35, lhY = h * 0.24;
      ctx.fillStyle = "#d7e6ef";
      ctx.fillRect(lhX - 4, lhY - 26, 8, 26);
      const blink = 0.5 + 0.5 * Math.sin(state.simTime * 3);
      ctx.beginPath();
      const lhGlow = ctx.createRadialGradient(lhX, lhY - 26, 1, lhX, lhY - 26, 14);
      lhGlow.addColorStop(0, `rgba(255,92,92,${0.9 * blink})`);
      lhGlow.addColorStop(1, "rgba(255,92,92,0)");
      ctx.fillStyle = lhGlow;
      ctx.arc(lhX, lhY - 26, 14, 0, Math.PI * 2);
      ctx.fill();
      // channel buoys ahead
      ctx.fillStyle = "#ff5c5c";
      ctx.beginPath(); ctx.arc(w * 0.42, h * 0.48, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath(); ctx.arc(w * 0.58, h * 0.48, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Scene overlay: berth — port-side quay receding toward the horizon.
    // This matches the top-down berthing plan: ship and quay are parallel, not bow-on.
    if (state.scene === "berth") {
      const vpX = w * 0.28;
      const vpY = h * 0.49;
      const nearEdgeX = -overscan;
      const nearEdgeY = h * 1.12;

      // Concrete quay top occupies only the port (left) side of the view.
      const quayTop = ctx.createLinearGradient(-overscan, h * 0.25, vpX, vpY);
      quayTop.addColorStop(0, phase.nightFactor > 0.5 ? "#252b31" : "#62686c");
      quayTop.addColorStop(1, phase.nightFactor > 0.5 ? "#3b444c" : "#899196");
      ctx.fillStyle = quayTop;
      ctx.beginPath();
      ctx.moveTo(-overscan, h * 0.18);
      ctx.lineTo(vpX, vpY);
      ctx.lineTo(nearEdgeX, nearEdgeY);
      ctx.closePath();
      ctx.fill();

      // Dark vertical quay face below the deck edge.
      const quayFace = ctx.createLinearGradient(0, vpY, 0, h + overscan);
      quayFace.addColorStop(0, phase.nightFactor > 0.5 ? "#1b2229" : "#414b52");
      quayFace.addColorStop(1, "#151c22");
      ctx.fillStyle = quayFace;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(nearEdgeX, nearEdgeY);
      ctx.lineTo(nearEdgeX, h * 1.34);
      ctx.lineTo(vpX + 8, vpY + 12);
      ctx.closePath();
      ctx.fill();

      // Bright edge line makes the parallel berth alignment unmistakable.
      ctx.strokeStyle = phase.nightFactor > 0.5 ? "#9eb2bd" : "#d7e0e4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(nearEdgeX, nearEdgeY);
      ctx.stroke();

      // Warehouses and a small crane remain on the far-left dock, clear of the bow.
      ctx.fillStyle = phase.nightFactor > 0.5 ? "#151b20" : "#4c565c";
      ctx.fillRect(-overscan, h * 0.27, w * 0.18 + overscan, h * 0.16);
      ctx.fillStyle = phase.nightFactor > 0.5 ? "#0f151a" : "#39464d";
      ctx.beginPath();
      ctx.moveTo(w * 0.04, h * 0.27);
      ctx.lineTo(w * 0.11, h * 0.19);
      ctx.lineTo(w * 0.18, h * 0.27);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#273640";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.20, h * 0.31);
      ctx.lineTo(w * 0.20, h * 0.13);
      ctx.lineTo(w * 0.27, h * 0.18);
      ctx.stroke();

      // Perspective bollards, fenders and dock lamps along the port-side edge.
      const edgePoint = (t) => ({
        x: vpX + (nearEdgeX - vpX) * t,
        y: vpY + (nearEdgeY - vpY) * t,
      });
      for (let i = 1; i <= 6; i++) {
        const t = i / 7;
        const edge = edgePoint(t);
        const size = 2 + t * 5;

        // Bollard stands just inside the quay top.
        const bx = edge.x - 8 - t * 15;
        const by = edge.y - 5 - t * 7;
        ctx.fillStyle = "#0f1a22";
        ctx.beginPath();
        ctx.ellipse(bx, by, size, size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rubber fender hangs on the vertical quay face.
        ctx.fillStyle = "#11171b";
        ctx.fillRect(edge.x - size * 0.65, edge.y + 4, size * 1.3, size * 2.4);

        // Lamp pole and glow grow toward the foreground.
        const poleHeight = 8 + t * 28;
        ctx.strokeStyle = "#27343c";
        ctx.lineWidth = 1 + t * 1.5;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by);
        ctx.lineTo(bx - 10, by - poleHeight);
        ctx.stroke();
        if (phase.nightFactor > 0.3) {
          ctx.beginPath();
          const lampGlow = ctx.createRadialGradient(
            bx - 10, by - poleHeight, 1,
            bx - 10, by - poleHeight, 8 + t * 16
          );
          lampGlow.addColorStop(0, `rgba(255,214,140,${0.6 * phase.nightFactor})`);
          lampGlow.addColorStop(1, "rgba(255,214,140,0)");
          ctx.fillStyle = lampGlow;
          ctx.arc(bx - 10, by - poleHeight, 8 + t * 16, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Breast and spring lines run from the port bow to quay bollards.
      const lineA = edgePoint(0.42);
      const lineB = edgePoint(0.63);
      const lineC = edgePoint(0.78);
      ctx.strokeStyle = "rgba(244,248,250,0.88)";
      ctx.lineWidth = 1.5;
      [
        [{ x: w * 0.39, y: h * 0.88 }, lineA],
        [{ x: w * 0.34, y: h * 0.98 }, lineB],
        [{ x: w * 0.29, y: h * 1.05 }, lineC],
      ].forEach(([shipEnd, shoreEnd]) => {
        ctx.beginPath();
        ctx.moveTo(shipEnd.x, shipEnd.y);
        ctx.lineTo(shoreEnd.x - 8, shoreEnd.y - 8);
        ctx.stroke();
      });

      ctx.fillStyle = phase.nightFactor > 0.5 ? "#d7e6ef" : "#243640";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("PORT QUAY", 12, h * 0.47);
    }

    // wave crest lines scrolling toward viewer based on speed & wave height
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    const waveCount = 6 + Math.round(sea.intensity);
    const t = state.simTime;
    for (let i = 0; i < waveCount; i++) {
      const depthFrac = (i / waveCount + (t * (0.15 + sea.waveHeight * 0.05)) % 1) % 1;
      const y = h / 2 + depthFrac * depthFrac * (h / 2 + 100);
      const amp = 2 + depthFrac * 10 * (0.5 + sea.waveHeight / 8);
      ctx.globalAlpha = 1 - depthFrac * 0.7;
      ctx.beginPath();
      for (let x = -overscan; x <= w + overscan; x += 14) {
        const yy = y + Math.sin(x * 0.05 + t * 1.3 + i) * amp * 0.3;
        if (x === -overscan) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Foreground bow: keep the ship readable against both bright and night seas.
    const bowGrad = ctx.createLinearGradient(0, h * 0.76, 0, h + 40);
    bowGrad.addColorStop(0, phase.nightFactor > 0.55 ? "#42586a" : "#7890a0");
    bowGrad.addColorStop(0.28, phase.nightFactor > 0.55 ? "#263c4c" : "#435f70");
    bowGrad.addColorStop(1, "#101f2a");
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.78);
    ctx.lineTo(w * 0.08, h + 40);
    ctx.lineTo(w * 0.92, h + 40);
    ctx.closePath();
    ctx.fillStyle = bowGrad;
    ctx.fill();
    ctx.strokeStyle = phase.nightFactor > 0.55 ? "#8fb7c9" : "#d7e6ef";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Foredeck centerline, hatch and port/starboard edge lights.
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.80);
    ctx.lineTo(w * 0.5, h + 20);
    ctx.strokeStyle = "rgba(215,230,239,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(10,28,40,0.72)";
    ctx.fillRect(w * 0.43, h * 0.91, w * 0.14, 22);
    ctx.strokeStyle = "rgba(215,230,239,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(w * 0.43, h * 0.91, w * 0.14, 22);
    ctx.beginPath();
    ctx.arc(w * 0.22, h * 0.95, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5c5c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.95, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80";
    ctx.fill();

    // mast / bridge wing frame details
    ctx.strokeStyle = "#1c3a4e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -overscan); ctx.lineTo(0, h + overscan);
    ctx.moveTo(w, -overscan); ctx.lineTo(w, h + overscan);
    ctx.stroke();

    ctx.restore(); // end heel/pitch rotation

    // Rain overlay (screen-space, not rotated — like rain on the window)
    if (sea.isTyphoon) {
      const rainCount = Math.round(80 + sea.intensity * 25);
      ensureRain(canvas, rainCount);
      ctx.strokeStyle = "rgba(200,230,255,0.35)";
      ctx.lineWidth = 1;
      rainDrops.forEach((d) => {
        d.y += d.speed * (dt * 60);
        d.x -= d.speed * 0.3 * (dt * 60);
        if (d.y > h) { d.y = -10; d.x = Math.random() * w; }
        if (d.x < 0) d.x = w;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 4, d.y + d.len);
        ctx.stroke();
      });

      // lightning trigger for strong typhoon
      if (sea.intensity > 15) {
        lightningTimer -= dt;
        if (lightningTimer <= 0) {
          lightningTimer = 3 + Math.random() * 6;
          lightningFlash = 1;
        }
      }
    }
    if (lightningFlash > 0) {
      lightningFlash = Math.max(0, lightningFlash - dt * 3);
    }

    // Heading tape (HUD compass strip at top)
    ctx.save();
    ctx.fillStyle = "rgba(5,20,31,0.7)";
    ctx.fillRect(0, 0, w, 26);
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    for (let d = -60; d <= 60; d += 10) {
      const hdg = ((state.heading + d) % 360 + 360) % 360;
      const x = w / 2 + d * (w / 130);
      ctx.fillStyle = Math.round(hdg) % 30 === 0 ? "#ffb454" : "#7fa0b5";
      ctx.fillText(String(Math.round(hdg)).padStart(3, "0"), x, 17);
    }
    // center marker
    ctx.strokeStyle = "#ff5c5c";
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, 26);
    ctx.stroke();
    ctx.restore();
  }

  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function lerpColor(c1, c2, t) {
    const p1 = colorToRgb(c1), p2 = colorToRgb(c2);
    const r = Math.round(p1.r + (p2.r - p1.r) * t);
    const g = Math.round(p1.g + (p2.g - p1.g) * t);
    const b = Math.round(p1.b + (p2.b - p1.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  function colorToRgb(color) {
    const rgb = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (rgb) {
      return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
    }
    const v = color.replace("#", "");
    return {
      r: parseInt(v.substring(0, 2), 16),
      g: parseInt(v.substring(2, 4), 16),
      b: parseInt(v.substring(4, 6), 16),
    };
  }

  return { renderChart, renderPitchSide, renderRollFront, renderBridge };
})();

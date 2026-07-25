/* gauges.js
 * 通用指針式儀表繪製工具 + 8 種航海儀表實作
 */
const ShipGauges = (() => {

  const TAU = Math.PI * 2;

  /**
   * Draw a generic circular gauge face.
   * opts: { min, max, startAngle, endAngle, ticks, label, unit, redZones:[[a,b]], value, formatValue }
   * angles are in degrees, 0 = up (12 o'clock), clockwise positive.
   */
  function drawFace(ctx, cx, cy, r, opts) {
    ctx.save();
    ctx.translate(cx, cy);

    // outer bezel
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = "#0b1c28";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2fd0e0";
    ctx.stroke();

    const startA = (opts.startAngle - 90) * Math.PI / 180;
    const endA = (opts.endAngle - 90) * Math.PI / 180;
    const range = opts.endAngle - opts.startAngle;

    // red/warning zones
    if (opts.redZones) {
      opts.redZones.forEach(([a, b, color]) => {
        const a0 = (opts.startAngle + (a - opts.min) / (opts.max - opts.min) * range - 90) * Math.PI / 180;
        const a1 = (opts.startAngle + (b - opts.min) / (opts.max - opts.min) * range - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.arc(0, 0, r - 6, a0, a1);
        ctx.lineWidth = 8;
        ctx.strokeStyle = color || "rgba(255,92,92,0.7)";
        ctx.stroke();
      });
    }

    // ticks
    const majorCount = opts.majorTicks || 8;
    for (let i = 0; i <= majorCount; i++) {
      const frac = i / majorCount;
      const ang = startA + (endA - startA) * frac;
      const x1 = Math.cos(ang) * (r - 10);
      const y1 = Math.sin(ang) * (r - 10);
      const x2 = Math.cos(ang) * (r - 18);
      const y2 = Math.sin(ang) * (r - 18);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "#d7e6ef";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (opts.showNumbers) {
        const val = opts.min + (opts.max - opts.min) * frac;
        const tx = Math.cos(ang) * (r - 30);
        const ty = Math.sin(ang) * (r - 30);
        ctx.fillStyle = "#7fa0b5";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(opts.formatTick ? opts.formatTick(val) : Math.round(val), tx, ty);
      }
    }

    // label & unit
    if (opts.unit) {
      ctx.fillStyle = "#7fa0b5";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(opts.unit, 0, r * 0.28);
    }

    ctx.restore();
  }

  function drawNeedle(ctx, cx, cy, r, angleDeg, opts = {}) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((angleDeg - 90) * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, 0);
    ctx.lineTo(0, -r * 0.06);
    ctx.lineTo(r * 0.78, 0);
    ctx.lineTo(0, r * 0.06);
    ctx.closePath();
    ctx.fillStyle = opts.color || "#ffb454";
    ctx.fill();
    ctx.restore();

    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.08, 0, TAU);
    ctx.fillStyle = "#d7e6ef";
    ctx.fill();
    ctx.strokeStyle = "#274357";
    ctx.stroke();
  }

  function valueToAngle(value, min, max, startAngle, endAngle) {
    const frac = (value - min) / (max - min);
    return startAngle + (endAngle - startAngle) * clamp01(frac);
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  function center(canvas) {
    return { cx: canvas.width / 2, cy: canvas.height / 2, r: Math.min(canvas.width, canvas.height) / 2 - 8 };
  }

  // ---------------- Individual gauges ----------------

  function drawCompass(canvas, headingDeg) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = "#0b1c28";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2fd0e0";
    ctx.stroke();

    // rotating card: N always relative to heading
    ctx.rotate(-headingDeg * Math.PI / 180);
    const dirs = ["N", "3", "6", "E", "12", "15", "S", "21", "24", "W", "30", "33"];
    for (let i = 0; i < 12; i++) {
      const ang = i * 30 * Math.PI / 180;
      const x1 = Math.sin(ang) * (r - 10), y1 = -Math.cos(ang) * (r - 10);
      const x2 = Math.sin(ang) * (r - 20), y2 = -Math.cos(ang) * (r - 20);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = i % 3 === 0 ? "#ffb454" : "#7fa0b5";
      ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.5;
      ctx.stroke();
      ctx.save();
      ctx.translate(Math.sin(ang) * (r - 32), -Math.cos(ang) * (r - 32));
      ctx.rotate(ang);
      ctx.fillStyle = i % 3 === 0 ? "#ffb454" : "#7fa0b5";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dirs[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // fixed lubber line (ship heading pointer, points up)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 4);
    ctx.lineTo(cx - 6, cy - r + 18);
    ctx.lineTo(cx + 6, cy - r + 18);
    ctx.closePath();
    ctx.fillStyle = "#ff5c5c";
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.round(headingDeg)).padStart(3, "0") + "°", cx, cy + r * 0.5);
  }

  function drawSpeed(canvas, speedKn) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    const opts = { min: 0, max: 20, startAngle: -120, endAngle: 120, majorTicks: 10, showNumbers: true, unit: "knots" };
    drawFace(ctx, cx, cy, r, opts);
    const ang = valueToAngle(speedKn, opts.min, opts.max, opts.startAngle, opts.endAngle);
    drawNeedle(ctx, cx, cy, r, ang, { color: "#2fd0e0" });
    drawValueText(ctx, cx, cy, r, speedKn.toFixed(1));
  }

  function drawRudder(canvas, rudderDeg) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    const opts = {
      min: -35, max: 35, startAngle: -60, endAngle: 60, majorTicks: 7, showNumbers: true, unit: "PORT / STBD",
      redZones: [[-35, -30, "rgba(255,92,92,0.5)"], [30, 35, "rgba(255,92,92,0.5)"]],
      formatTick: (v) => Math.abs(Math.round(v)),
    };
    drawFace(ctx, cx, cy, r, opts);
    const ang = valueToAngle(rudderDeg, opts.min, opts.max, opts.startAngle, opts.endAngle);
    drawNeedle(ctx, cx, cy, r, ang, { color: "#ffb454" });
    drawValueText(ctx, cx, cy, r, Math.abs(rudderDeg).toFixed(0) + (rudderDeg < -0.5 ? "P" : rudderDeg > 0.5 ? "S" : ""));
  }

  function drawROT(canvas, rotDegPerMin) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    const opts = { min: -60, max: 60, startAngle: -110, endAngle: 110, majorTicks: 6, showNumbers: true, unit: "°/min" };
    drawFace(ctx, cx, cy, r, opts);
    const ang = valueToAngle(rotDegPerMin, opts.min, opts.max, opts.startAngle, opts.endAngle);
    drawNeedle(ctx, cx, cy, r, ang, { color: "#4ade80" });
    drawValueText(ctx, cx, cy, r, rotDegPerMin.toFixed(0));
  }

  function drawHeel(canvas, heelDeg) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    const danger = Math.abs(heelDeg) > 15;
    const opts = {
      min: -40, max: 40, startAngle: -90, endAngle: 90, majorTicks: 8, showNumbers: true, unit: "HEEL °",
      redZones: [[-40, -20, "rgba(255,92,92,0.5)"], [20, 40, "rgba(255,92,92,0.5)"]],
    };
    drawFace(ctx, cx, cy, r, opts);
    const ang = valueToAngle(heelDeg, opts.min, opts.max, opts.startAngle, opts.endAngle);
    drawNeedle(ctx, cx, cy, r, ang, { color: danger ? "#ff5c5c" : "#2fd0e0" });
    drawValueText(ctx, cx, cy, r, heelDeg.toFixed(1) + "°", danger ? "#ff5c5c" : "#fff");
  }

  function drawRPM(canvas, rpmPercent) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    const opts = {
      min: -100, max: 100, startAngle: -110, endAngle: 110, majorTicks: 10, showNumbers: true, unit: "RPM %",
      redZones: [[90, 100, "rgba(255,92,92,0.5)"], [-100, -90, "rgba(255,92,92,0.5)"]],
    };
    drawFace(ctx, cx, cy, r, opts);
    const ang = valueToAngle(rpmPercent, opts.min, opts.max, opts.startAngle, opts.endAngle);
    drawNeedle(ctx, cx, cy, r, ang, { color: "#ffb454" });
    drawValueText(ctx, cx, cy, r, rpmPercent.toFixed(0));
  }

  function drawWind(canvas, windSpeedKn, windDirDeg, headingDeg) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = "#0b1c28";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2fd0e0";
    ctx.stroke();
    // relative wind direction arrow (relative to ship heading)
    const relAngle = ((windDirDeg - headingDeg) % 360 + 360) % 360;
    ctx.rotate(relAngle * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(0, -r + 14);
    ctx.lineTo(-8, -r + 30);
    ctx.lineTo(8, -r + 30);
    ctx.closePath();
    ctx.fillStyle = "#4ade80";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r + 14);
    ctx.lineTo(0, r * 0.3);
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(windSpeedKn.toFixed(0) + " kn", cx, cy + r * 0.55);
  }

  // 姿態儀 Attitude Indicator (artificial horizon): shows roll (heel) as bank angle
  // and pitch (trim) as vertical horizon offset, aircraft-instrument style.
  function drawAttitude(canvas, heelDeg, trimDeg) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    ctx.save();
    ctx.translate(cx, cy);

    // clip to circular bezel
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.save();
    ctx.clip();

    // pitch shifts horizon vertically (px per degree), roll rotates it
    const pxPerDeg = 4;
    ctx.rotate(heelDeg * Math.PI / 180);
    const horizonY = clampVal(trimDeg * pxPerDeg, -r, r);

    // sky
    ctx.fillStyle = "#3a6a8a";
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 2 + horizonY);
    // sea
    ctx.fillStyle = "#144a5c";
    ctx.fillRect(-r * 2, horizonY, r * 4, r * 2);
    // horizon line
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 2, horizonY); ctx.lineTo(r * 2, horizonY);
    ctx.stroke();

    // pitch ladder marks every 5 deg
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "center";
    for (let d = -20; d <= 20; d += 5) {
      if (d === 0) continue;
      const y = horizonY - d * pxPerDeg;
      if (y < -r || y > r) continue;
      const halfW = d % 10 === 0 ? 22 : 12;
      ctx.beginPath();
      ctx.moveTo(-halfW, y); ctx.lineTo(halfW, y);
      ctx.stroke();
      if (d % 10 === 0) ctx.fillText(String(Math.abs(d)), halfW + 10, y + 3);
    }
    ctx.restore(); // end clip

    // bezel ring + roll scale ticks (fixed, not rotated with roll)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2fd0e0";
    ctx.stroke();
    [-60, -30, -20, -10, 0, 10, 20, 30, 60].forEach((a) => {
      const ang = (a - 90) * Math.PI / 180;
      const x1 = Math.cos(ang) * (r - 4), y1 = Math.sin(ang) * (r - 4);
      const x2 = Math.cos(ang) * (r - 12), y2 = Math.sin(ang) * (r - 12);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = "#7fa0b5";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // fixed ship reference (gull-wing symbol) + roll pointer triangle
    ctx.strokeStyle = "#ffb454";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 0.12, 0);
    ctx.moveTo(r * 0.12, 0); ctx.lineTo(r * 0.4, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fillStyle = "#ffb454";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r + 6); ctx.lineTo(-6, -r + 16); ctx.lineTo(6, -r + 16);
    ctx.closePath();
    ctx.fillStyle = "#ffb454";
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = Math.abs(heelDeg) > 15 || Math.abs(trimDeg) > 3 ? "#ff5c5c" : "#fff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`R${heelDeg.toFixed(1)}° P${trimDeg.toFixed(1)}°`, cx, cy + r * 0.7);
  }
  function clampVal(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function drawDepth(canvas, depthM) {
    const ctx = clearCanvas(canvas);
    const { cx, cy, r } = center(canvas);
    const opts = {
      min: 0, max: 100, startAngle: -110, endAngle: 110, majorTicks: 10, showNumbers: true, unit: "meters",
      redZones: [[0, 10, "rgba(255,92,92,0.5)"]],
    };
    drawFace(ctx, cx, cy, r, opts);
    const clamped = Math.min(depthM, 100);
    const ang = valueToAngle(clamped, opts.min, opts.max, opts.startAngle, opts.endAngle);
    drawNeedle(ctx, cx, cy, r, ang, { color: depthM < 10 ? "#ff5c5c" : "#2fd0e0" });
    drawValueText(ctx, cx, cy, r, depthM.toFixed(1));
  }

  function drawValueText(ctx, cx, cy, r, text, color) {
    ctx.fillStyle = color || "#fff";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, cx, cy + r * 0.68);
  }

  return {
    drawCompass, drawSpeed, drawRudder, drawROT, drawHeel, drawAttitude, drawRPM, drawWind, drawDepth,
  };
})();

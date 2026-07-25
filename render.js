/* render.js
 * 場景渲染：俯視航跡圖、船艏橫傾正視圖、駕駛台(Bridge)前視視野
 */
const ShipRender = (() => {

  const DEG = Math.PI / 180;

  // ---------------- 俯視航跡圖 ----------------
  function renderChart(canvas, state, trail, sea) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background water with wave texture density from sea intensity
    ctx.fillStyle = "#04101a";
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

    // wind direction arrow (top-left corner)
    ctx.save();
    ctx.translate(30, 30);
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
    ctx.fillText("WIND", 44, 34);

    // ship (center, fixed heading-up not used here — north-up display)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.heading * DEG);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-7, 10);
    ctx.lineTo(0, 6);
    ctx.lineTo(7, 10);
    ctx.closePath();
    ctx.fillStyle = "#ffb454";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // range rings
    ctx.strokeStyle = "rgba(127,160,181,0.25)";
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ring * scale * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------------- 船艏橫傾正視圖 ----------------
  function renderHeelView(canvas, state) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#04101a";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h * 0.55;
    const heelRad = state.heel * DEG;

    // waterline
    ctx.strokeStyle = "rgba(47,208,224,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();
    ctx.fillStyle = "rgba(10,60,80,0.4)";
    ctx.fillRect(0, cy, w, h - cy);

    // hull cross-section (simplified V shape) rotated by heel
    ctx.save();
    ctx.translate(cx, cy - 10);
    ctx.rotate(heelRad);
    ctx.beginPath();
    ctx.moveTo(-90, -10);
    ctx.lineTo(-70, 30);
    ctx.lineTo(0, 42);
    ctx.lineTo(70, 30);
    ctx.lineTo(90, -10);
    ctx.lineTo(60, -14);
    ctx.lineTo(0, -6);
    ctx.lineTo(-60, -14);
    ctx.closePath();
    ctx.fillStyle = "#274357";
    ctx.fill();
    ctx.strokeStyle = "#d7e6ef";
    ctx.lineWidth = 2;
    ctx.stroke();

    // mast for visual heel reference
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, -80);
    ctx.strokeStyle = "#7fa0b5";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // gravity vertical reference line
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 90);
    ctx.lineTo(cx, cy + 40);
    ctx.stroke();
    ctx.setLineDash([]);

    // heel angle text
    ctx.fillStyle = Math.abs(state.heel) > 15 ? "#ff5c5c" : "#fff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText((state.heel >= 0 ? "S " : "P ") + Math.abs(state.heel).toFixed(1) + "°", cx, 24);
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
    // Sky gradient — darker & greener/gray for storm intensity
    const stormT = Math.min(1, sea.intensity / 14);
    const skyTop = sea.isTyphoon ? "#1a1f26" : lerpColor("#3a6a8a", "#0d1a24", stormT);
    const skyBottom = sea.isTyphoon ? "#3a3f47" : lerpColor("#6fa0b8", "#1c2c38", stormT * 0.6);
    const skyGrad = ctx.createLinearGradient(0, -overscan, 0, h / 2);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(1, skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-overscan, -overscan, w + overscan * 2, h / 2 + overscan);

    // lightning flash overlay (only severe typhoon)
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${lightningFlash * 0.5})`;
      ctx.fillRect(-overscan, -overscan, w + overscan * 2, h + overscan * 2);
    }

    // sea gradient
    const seaGrad = ctx.createLinearGradient(0, h / 2, 0, h + overscan);
    seaGrad.addColorStop(0, sea.isTyphoon ? "#1b2a30" : "#144a5c");
    seaGrad.addColorStop(1, "#03121a");
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-overscan, h / 2, w + overscan * 2, h / 2 + overscan);

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

    // bow silhouette (foreground, ship's own bow visible at bottom)
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.78);
    ctx.lineTo(w * 0.08, h + 40);
    ctx.lineTo(w * 0.92, h + 40);
    ctx.closePath();
    ctx.fillStyle = "#0a1420";
    ctx.fill();
    ctx.strokeStyle = "#274357";
    ctx.lineWidth = 2;
    ctx.stroke();

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
    const p1 = hexToRgb(c1), p2 = hexToRgb(c2);
    const r = Math.round(p1.r + (p2.r - p1.r) * t);
    const g = Math.round(p1.g + (p2.g - p1.g) * t);
    const b = Math.round(p1.b + (p2.b - p1.b) * t);
    return `rgb(${r},${g},${b})`;
  }
  function hexToRgb(hex) {
    const v = hex.replace("#", "");
    return {
      r: parseInt(v.substring(0, 2), 16),
      g: parseInt(v.substring(2, 4), 16),
      b: parseInt(v.substring(4, 6), 16),
    };
  }

  return { renderChart, renderHeelView, renderBridge };
})();

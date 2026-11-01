/*
 * Round the Bases! — field renderer. One instance per <canvas>.
 * Field coords are feet with home (0,0), 1st (90,0), 2nd (90,90), 3rd (0,90); drawn rotated 45° into a diamond.
 * `setRange(lo, hi)` picks how much of the field fits in the square canvas (infield only, or out to the fence).
 */
(function () {
"use strict";
const { BASES, MOUND, add, sub, mul, norm, at } = window.RTB;
const FENCE = 210;

window.RTBField = function createField(canvas, opt) {
  const ctx = canvas.getContext("2d");
  let W = 0, k = 1, ox = 0, oy = 0, lo = opt.lo, hi = opt.hi, cam = false;

  const S = (p) => { const u = (p[0] - p[1]) / Math.SQRT2, v = (p[0] + p[1]) / Math.SQRT2; return [ox + u * k, oy - v * k]; };
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function fit() { k = W / (Math.SQRT2 * (hi - lo)); ox = W / 2; oy = hi * Math.SQRT2 * k; }
  function size() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    W = r.width; canvas.width = Math.round(W * dpr); canvas.height = Math.round(W * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fit();
  }
  function setRange(l, h) { lo = l; hi = h; fit(); }
  function poly(list) { ctx.beginPath(); list.forEach((p, i) => { const s = S(p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); }
  function circle(c, r) { const s = S(c); ctx.beginPath(); ctx.arc(s[0], s[1], r * k, 0, Math.PI * 2); }
  const fair = () => poly([[0, 0], [600, 0], [600, 600], [0, 600]]);

  function drawField() {
    ctx.fillStyle = "#2f7a35"; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = "#378a3c";
    for (let x = -400; x < 600; x += 20) { poly([[x, -400], [x + 10, -400], [x + 10, 600], [x, 600]]); ctx.fill(); }
    if (hi > 150) { // outfield: warning track, fence, stands
      const h = S([0, 0]);
      ctx.save(); fair(); ctx.clip();
      ctx.beginPath(); ctx.rect(0, 0, W, W); ctx.arc(h[0], h[1], (FENCE + 1) * k, 0, Math.PI * 2); ctx.fillStyle = "#1f5128"; ctx.fill("evenodd");
      ctx.beginPath(); ctx.arc(h[0], h[1], (FENCE - 5) * k, 0, Math.PI * 2); ctx.strokeStyle = "#b98250"; ctx.lineWidth = 10 * k; ctx.stroke();
      ctx.beginPath(); ctx.arc(h[0], h[1], (FENCE + 0.5) * k, 0, Math.PI * 2); ctx.strokeStyle = "#f1e7c4"; ctx.lineWidth = Math.max(2, 1.2 * k); ctx.stroke();
      ctx.restore();
    }
    const dirt = "#c98b56";
    ctx.save(); poly([[-8, -8], [200, -8], [200, 200], [-8, 200]]); ctx.clip();
    ctx.fillStyle = dirt; circle(MOUND, 95); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#3a8f3f"; poly([[3, 3], [87, 3], [87, 87], [3, 87]]); ctx.fill();
    ctx.fillStyle = dirt;
    for (let i = 0; i < 4; i++) {
      const A = BASES[i], B = BASES[(i + 1) % 4], d = norm(sub(B, A)), n = [d[1], -d[0]];
      poly([add(A, mul(n, 3)), add(B, mul(n, 3)), add(B, mul(n, -3)), add(A, mul(n, -3))]); ctx.fill();
    }
    BASES.forEach((b, i) => { circle(b, i ? 10 : 13); ctx.fill(); });
    circle(MOUND, 9); ctx.fill();
    ctx.fillStyle = "#e6d2b5"; const m = S(MOUND); ctx.fillRect(m[0] - 1.2 * k, m[1] - 0.4 * k, 2.4 * k, 0.8 * k);
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(1.5, 0.45 * k);
    [[[0, 0], [FENCE, 0]], [[0, 0], [0, FENCE]]].forEach(([a, b]) => { const s = S(a), e = S(b); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); });
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
    const h = Math.max(1.8, 4 / k);
    for (let i = 1; i < 4; i++) { const b = BASES[i]; poly([[b[0] - h, b[1] - h], [b[0] + h, b[1] - h], [b[0] + h, b[1] + h], [b[0] - h, b[1] + h]]); ctx.fill(); ctx.stroke(); }
    poly([[h, -h * 0.2], [h, h], [-h * 0.2, h], [-h * 1.1, 0], [0, -h * 1.1]]); ctx.fill(); ctx.stroke();
    if (cam) return;
    ctx.font = `700 ${Math.max(12, 4.2 * k)}px ${css("--body")}`; ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const off = Math.max(9, 22 / k);
    [["1st", [96 + off * 0.8, -off * 0.6]], ["2nd", [90 + off, 90 + off]], ["3rd", [-off * 0.6, 96 + off * 0.8]], ["Home", [-off, -off]]].forEach(([t, p]) => { const s = S(p); ctx.fillText(t, s[0], s[1]); });
  }

  function drawPlan(R, color, alpha) {
    ctx.save(); ctx.setLineDash([Math.max(3, 2 * k), Math.max(3, 2 * k)]); ctx.strokeStyle = color; ctx.globalAlpha = alpha == null ? 0.55 : alpha; ctx.lineWidth = Math.max(2, 0.7 * k);
    ctx.beginPath(); R.pts.forEach((p, i) => { if (i % 4) return; const s = S(p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); });
    const e = S(R.pts[R.pts.length - 1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); ctx.restore();
  }
  function drawFeet(R, time, color, edge) {
    ctx.fillStyle = color; ctx.strokeStyle = edge; ctx.lineWidth = 1;
    const r = Math.max(2.2, 0.85 * k);
    for (const f of R.feet) { if (f.t > time) break; const s = S(f.p); ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  // Slide: a skid mark in the dirt from where the slide starts, plus dust kicked up behind.
  function drawSlideMarks(R, time) {
    if (time < R.slideT) return;
    const st = at(R, time);
    ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(110,68,34,.55)"; ctx.lineWidth = Math.max(5, 2.8 * k);
    ctx.beginPath();
    for (let i = R.slideIdx; i <= st.i; i += 2) { const s = S(R.pts[i]); i === R.slideIdx ? ctx.moveTo(s[0], s[1]) : ctx.lineTo(s[0], s[1]); }
    const e = S(st.p); ctx.lineTo(e[0], e[1]); ctx.stroke();
    const age = st.done ? time - R.T : 0, fade = Math.max(0, 1 - age / 1.2);
    for (let j = 0; j < 7 && fade > 0; j++) {
      const idx = Math.max(R.slideIdx, st.i - j * 5), b = S(R.pts[idx]);
      const wob = Math.sin(time * 9 + j * 2.3) * 1.4 * k, grow = Math.max(1.5, (1 + j * 0.35 + age * 2) * k);
      ctx.fillStyle = `rgba(232,208,172,${(0.6 - j * 0.07) * fade})`;
      ctx.beginPath(); ctx.arc(b[0] + wob, b[1] - j * 0.6 * k - age * 3 * k, grow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // A runner: a dot, or stretched out feet-first while sliding.
  function drawRunner(R, st, time, color, edge) {
    const s = S(st.p), r = cam ? 1.3 * k : Math.max(7, 2.4 * k);
    ctx.fillStyle = color; ctx.strokeStyle = edge; ctx.lineWidth = 3;
    ctx.beginPath();
    if (time >= R.slideT) {
      const a = S(R.pts[Math.max(0, st.i - 4)]), b = S(R.pts[Math.min(R.pts.length - 1, st.i + 4)]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.ellipse(s[0] - Math.cos(ang) * r * 0.6, s[1] - Math.sin(ang) * r * 0.6, r * 1.6, r * 0.7, ang, 0, Math.PI * 2);
    } else ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    return { s, r };
  }
  // Speech bubbles, nudged apart so they never sit on top of each other.
  function drawBubbles(items) {
    ctx.font = `700 ${Math.max(12, 4 * k)}px ${css("--body")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const placed = [], h = Math.max(22, 7 * k);
    for (const it of items) {
      const w = ctx.measureText(it.text).width + 14, side = it.side;
      let y = side < 0 ? it.s[1] - it.r - 4 - h : it.s[1] + it.r + 4;
      const x = Math.min(Math.max(it.s[0] - w / 2, 4), W - w - 4);
      for (let n = 0; n < 4 && placed.some((p) => x < p.x + p.w && p.x < x + w && y < p.y + p.h && p.y < y + h); n++) y += side * (h + 3);
      y = Math.min(Math.max(y, 4), W - h - 4);
      placed.push({ x, y, w, h });
      ctx.fillStyle = it.fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
      ctx.fillStyle = it.ink; ctx.fillText(it.text, x + w / 2, y + h / 2 + 1);
    }
  }
  // Draw `fn` again inside a zoomed circle (the "slide cam").
  function inset(cx, cy, radius, zoom, aim, fn) {
    const save = [k, ox, oy];
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    k = save[0] * zoom;
    ox = cx - (aim[0] - aim[1]) / Math.SQRT2 * k; oy = cy + (aim[0] + aim[1]) / Math.SQRT2 * k;
    cam = true; fn(); cam = false;
    ctx.restore(); [k, ox, oy] = save;
    ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  }
  function tag(text, x, y, fill, ink) {
    ctx.font = `700 ${Math.max(11, 3.6 * k)}px ${css("--body")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 14, h = Math.max(20, 6 * k);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = ink; ctx.fillText(text, x, y + 1);
  }

  return { canvas, ctx, S, css, size, setRange, poly, circle, drawField, drawPlan, drawFeet, drawSlideMarks, drawRunner, drawBubbles, inset, tag,
    get W() { return W; }, get k() { return k; } };
};
window.RTBField.FENCE = FENCE;
})();

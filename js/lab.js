/* Round the Bases! — Banana Lab: how wide should the banana be? Home to 2nd, sliding in. */
(function () {
"use strict";
const { VMAX, SLIDE_LEN, sidPath, profile, at } = window.RTB;
const $ = (id) => document.getElementById(id);
const view = window.RTBField($("labcv"), { lo: -18, hi: 108 });
const ui = { width: $("width"), out: $("wOut"), msg: $("labMsg"), t: $("labT"), best: $("labBest"), chart: $("chart"), run: $("labRun") };

const MAX_W = 20, STEP = 0.5;
const sweep = [];
for (let w = 0; w <= MAX_W + 1e-9; w += STEP) sweep.push({ w, R: profile(sidPath(w), true, SLIDE_LEN) });
const best = sweep.reduce((a, b) => (b.R.T < a.R.T ? b : a));
const pick = (w) => sweep[Math.round(w / STEP)];

// Speed color: white = full speed, yellow = slowing, red = slow.
function speedColor(f) {
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const red = [255, 77, 77], yel = [255, 210, 63], wht = [255, 255, 255];
  const c = f < 0.6 ? mix(red, yel, Math.max(0, (f - 0.3) / 0.3)) : mix(yel, wht, Math.min(1, (f - 0.6) / 0.35));
  return `rgb(${c.join(",")})`;
}
function drawSpeedPath(R) {
  const ctx = view.ctx, k = view.k;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(6, 2.2 * k); ctx.strokeStyle = "rgba(10,30,20,.55)";
  ctx.beginPath(); R.pts.forEach((p, i) => { const s = view.S(p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.stroke();
  ctx.lineWidth = Math.max(3.5, 1.3 * k);
  for (let i = 0; i < R.pts.length - 2; i += 2) {
    const a = view.S(R.pts[i]), b = view.S(R.pts[i + 2]);
    ctx.strokeStyle = speedColor(R.v[i] / VMAX); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
}

let cur = null, sim = 0, running = false, last = 0;
function render() {
  view.drawField();
  view.drawPlan(best.R, "#ffffff", 0.75);
  drawSpeedPath(cur.R);
  if (sim > 0) {
    const g = at(best.R, sim); view.drawRunner(best.R, g, sim, "rgba(255,255,255,.75)", "#1b2b4a");
    const y = at(cur.R, sim); view.drawRunner(cur.R, y, sim, view.css("--bea"), "#3a2c00");
  }
}
function chart() {
  const Wd = 320, Ht = 170, m = { l: 40, r: 12, t: 14, b: 34 };
  const ts = sweep.map((s) => s.R.T), lo = Math.min(...ts), hi = Math.max(...ts);
  const x = (w) => m.l + (w / MAX_W) * (Wd - m.l - m.r), y = (t) => m.t + (1 - (t - lo) / (hi - lo)) * (Ht - m.t - m.b);
  const line = sweep.map((s, i) => `${i ? "L" : "M"}${x(s.w).toFixed(1)},${y(s.R.T).toFixed(1)}`).join("");
  const yt = [Math.ceil(lo * 10) / 10, Math.floor(hi * 10) / 10];
  ui.chart.innerHTML = `
    <line class="ax" x1="${m.l}" y1="${Ht - m.b}" x2="${Wd - m.r}" y2="${Ht - m.b}"/>
    ${[0, 5, 10, 15, 20].map((w) => `<text class="tk" x="${x(w)}" y="${Ht - m.b + 16}" text-anchor="middle">${w}</text>`).join("")}
    <text class="tk" x="${(Wd + m.l) / 2}" y="${Ht - 2}" text-anchor="middle">How far out you swing (ft)</text>
    ${yt.map((t) => `<line class="grid" x1="${m.l}" x2="${Wd - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tk" x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(1)}s</text>`).join("")}
    <path class="curve" d="${line}"/>
    <circle class="bestpt" cx="${x(best.w)}" cy="${y(best.R.T)}" r="5"/>
    <text class="besttx" x="${x(best.w)}" y="${y(best.R.T) - 12}" text-anchor="middle">Best</text>
    <circle class="curpt" cx="${x(cur.w)}" cy="${y(cur.R.T)}" r="7"/>`;
}
function update() {
  cur = pick(+ui.width.value);
  ui.out.textContent = cur.w === 0 ? "0 ft (no curve)" : `${cur.w} ft`;
  ui.t.textContent = cur.R.T.toFixed(2) + " s";
  ui.best.textContent = `${best.R.T.toFixed(2)} s at ${best.w} ft`;
  const lost = cur.R.T - best.R.T;
  ui.msg.className = "labmsg " + (lost < 0.03 ? "good" : "meh");
  ui.msg.textContent = lost < 0.03 ? "Just right! Wide enough to keep your speed at first, tight enough not to waste steps."
    : cur.w < best.w ? `Too tight! You have to turn hard at first base, so you slow down there (watch the line turn yellow). ${lost.toFixed(2)} s slower than the best banana.`
    : `Too wide! You keep your speed, but you run extra steps out in foul ground. ${lost.toFixed(2)} s slower than the best banana.`;
  chart(); render();
}
function tick(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; sim += dt * 2.5;
  const end = Math.max(cur.R.T, best.R.T) + 0.6;
  if (sim >= end) { sim = end; running = false; ui.run.textContent = "Race the best banana"; }
  render(); if (running) requestAnimationFrame(tick);
}
ui.width.addEventListener("input", update);
ui.run.addEventListener("click", () => { sim = 0; running = true; last = performance.now(); ui.run.textContent = "Racing…"; requestAnimationFrame(tick); });
new ResizeObserver(() => { view.size(); render(); }).observe($("labcv"));
view.size(); update();
})();

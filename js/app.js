/* Round the Bases! — field drawing, animation loop and scoreboard. Needs js/physics.js first. */
(function () {
"use strict";
const { VMAX, BASES, MOUND, SLIDE_LEN, add, sub, mul, dist, norm,
  squarePath, bananaPath, rayPath, sidPath, profile, at } = window.RTB;
const $ = (id) => document.getElementById(id);

// Runners. `stopAt` is when the runner's clock stops; `bubble` is [fill, ink, side].
const sam = profile(squarePath());
const bea = profile(bananaPath());
const ray = profile(rayPath(), true);
const sid = profile(sidPath(), true, SLIDE_LEN);
const sidStandUp = profile(sidPath(), true, 0); // same path, stopping on his feet instead
const RUNNERS = [
  { key: "Ray", R: ray, color: "--ray", edge: "#fff",    bubble: ["#8a1f17", "#fff", 1],  stopAt: ray.first },
  { key: "Sid", R: sid, color: "--sid", edge: "#fff",    bubble: ["#4a1f8a", "#fff", -1], stopAt: sid.T },
  { key: "Sam", R: sam, color: "--sam", edge: "#fff",    bubble: ["#163a8a", "#fff", -1], stopAt: sam.T },
  { key: "Bea", R: bea, color: "--bea", edge: "#3a2c00", bubble: ["#fff3b0", "#3a2c00", 1], stopAt: bea.T },
];
const END = Math.max(...RUNNERS.map((r) => r.R.T)) + 0.4;

// ---------- canvas setup ----------
const cv = $("cv"), ctx = cv.getContext("2d");
let W = 0, k = 1, ox = 0, oy = 0, cam = false;
const S = (p) => { const u = (p[0] - p[1]) / Math.SQRT2, v = (p[0] + p[1]) / Math.SQRT2; return [ox + u * k, oy - v * k]; };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function size() {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  W = r.width; cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  k = W / 178.2; ox = W / 2; oy = 152.7 * k;
}
function poly(list) { ctx.beginPath(); list.forEach((p, i) => { const s = S(p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); }
function circle(c, r) { const s = S(c); ctx.beginPath(); ctx.arc(s[0], s[1], r * k, 0, Math.PI * 2); }

// ---------- field ----------
function drawField() {
  ctx.fillStyle = "#2f7a35"; ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = "#378a3c";
  for (let x = -200; x < 300; x += 20) { poly([[x, -200], [x + 10, -200], [x + 10, 300], [x, 300]]); ctx.fill(); }
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
  [[[0, 0], [200, 0]], [[0, 0], [0, 200]]].forEach(([a, b]) => { const s = S(a), e = S(b); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); });
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const b = BASES[i], h = 1.8; poly([[b[0] - h, b[1] - h], [b[0] + h, b[1] - h], [b[0] + h, b[1] + h], [b[0] - h, b[1] + h]]); ctx.fill(); ctx.stroke(); }
  poly([[1.8, -0.4], [1.8, 1.8], [-0.4, 1.8], [-2, 0], [0, -2]]); ctx.fill(); ctx.stroke();
  ctx.font = `700 ${Math.max(12, 4.2 * k)}px ${css("--body")}`; ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  [["1st", [104, -6]], ["2nd", [100, 100]], ["3rd", [-6, 104]], ["Home", [-9, -9]]].forEach(([t, p]) => { const s = S(p); ctx.fillText(t, s[0], s[1]); });
}

function drawPlan(R, color) {
  ctx.save(); ctx.setLineDash([2 * k, 2 * k]); ctx.strokeStyle = color; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(2, 0.7 * k);
  ctx.beginPath(); R.pts.forEach((p, i) => { if (i % 4) return; const s = S(p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); });
  const e = S(R.pts[R.pts.length - 1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); ctx.restore();
}
function drawFeet(R, time, color, edge) {
  ctx.fillStyle = color; ctx.strokeStyle = edge; ctx.lineWidth = 1;
  for (const f of R.feet) { if (f.t > time) break; const s = S(f.p); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(2.5, 0.85 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
}

// Slide: a skid mark in the dirt from where the slide starts, plus dust kicked up behind.
function drawSlideMarks(R, time) {
  if (time < R.slideT) return;
  const st = at(R, time);
  ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(110,68,34,.55)"; ctx.lineWidth = Math.max(6, 2.8 * k);
  ctx.beginPath();
  for (let i = R.slideIdx; i <= st.i; i += 2) { const s = S(R.pts[i]); i === R.slideIdx ? ctx.moveTo(s[0], s[1]) : ctx.lineTo(s[0], s[1]); }
  const e = S(st.p); ctx.lineTo(e[0], e[1]); ctx.stroke();
  const age = st.done ? time - R.T : 0, fade = Math.max(0, 1 - age / 1.2);
  for (let j = 0; j < 7 && fade > 0; j++) {
    const idx = Math.max(R.slideIdx, st.i - j * 5), b = S(R.pts[idx]);
    const wob = Math.sin(time * 9 + j * 2.3) * 1.4 * k, grow = 1 + j * 0.35 + age * 2;
    ctx.fillStyle = `rgba(232,208,172,${(0.6 - j * 0.07) * fade})`;
    ctx.beginPath(); ctx.arc(b[0] + wob, b[1] - j * 0.6 * k - age * 3 * k, grow * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBody(run, st, time) {
  const s = S(st.p), r = cam ? 1.3 * k : Math.max(7, 2.4 * k), R = run.R;
  ctx.fillStyle = css(run.color); ctx.strokeStyle = run.edge; ctx.lineWidth = 3;
  if (time >= R.slideT) {
    // Sliding: stretched out low along the base path, feet first.
    const a = S(R.pts[Math.max(0, st.i - 4)]), b = S(R.pts[Math.min(R.pts.length - 1, st.i + 4)]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.beginPath(); ctx.ellipse(s[0] - Math.cos(ang) * r * 0.6, s[1] - Math.sin(ang) * r * 0.6, r * 1.6, r * 0.7, ang, 0, Math.PI * 2);
  } else {
    ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
  }
  ctx.fill(); ctx.stroke();
  return { s, r };
}

function nearBase(p) { for (let i = 1; i < 4; i++) if (dist(p, BASES[i]) < 6) return true; return false; }
function label(run, st, time) {
  const R = run.R, n = run.key;
  if (time <= 0) return n;
  if (n === "Ray") return time > R.first + 1.2 ? "Safe at 1st!" : Math.abs(time - R.first) < 1.2 ? "Run THROUGH!" : n;
  if (n === "Sid") return st.done ? "Safe at 2nd!" : time >= R.slideT ? "SLIDE!" : nearBase(st.p) ? "Lean & tap!" : n;
  if (st.done) return n + " is home!";
  if (n === "Sam" && st.v < VMAX * 0.45 && time > 1.6) return "STOP… turn…";
  if (n === "Bea" && nearBase(st.p)) return "Lean & tap!";
  return n;
}

// Speech bubbles, nudged apart so they never sit on top of each other.
function drawBubbles(items) {
  ctx.font = `700 ${Math.max(12, 4 * k)}px ${css("--body")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const placed = [], h = Math.max(22, 7 * k);
  for (const it of items) {
    const w = ctx.measureText(it.text).width + 14, side = it.side;
    let y = side < 0 ? it.s[1] - it.r - 4 - h : it.s[1] + it.r + 4;
    const x = Math.min(Math.max(it.s[0] - w / 2, 4), W - w - 4);
    for (let tries = 0; tries < 4 && placed.some((p) => x < p.x + p.w && p.x < x + w && y < p.y + p.h && p.y < y + h); tries++) y += side * (h + 3);
    placed.push({ x, y, w, h });
    ctx.fillStyle = it.fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = it.ink; ctx.fillText(it.text, x + w / 2, y + h / 2 + 1);
  }
}

// ---------- scoreboard ----------
const ui = { result: $("result"), play: $("play"), slow: $("slow") };
RUNNERS.forEach((r) => { r.ui = { t: $("t" + r.key), f: $("f" + r.key), s: $("s" + r.key), p: $("p" + r.key) }; });

function statusText(run, st, time) {
  const R = run.R, n = run.key;
  if (time <= 0) return "Ready…";
  if (n === "Ray" && time >= R.first) return "Safe at 1st!";
  if (n === "Sid") { if (st.done) return "Safe at 2nd!"; if (time >= R.slideT) return "Sliding! Dirt is the brakes."; }
  if (st.done) return "Safe at home!";
  if (time < 1.4) return "Taking off!";
  if (n === "Ray") return "Full speed! Straight line!";
  const f = st.v / VMAX; return f > 0.85 ? "Full speed!" : f > 0.5 ? "Turning…" : "Slowing way down!";
}
function splitText(run, time) {
  const R = run.R;
  if (run.key === "Sid") return time >= R.T ? `To 2nd: <b>${R.T.toFixed(1)} s</b> · started sliding at ${Math.round(R.slideV / VMAX * 100)}% speed` : "To 2nd: <b>–</b>";
  return time >= R.first ? `To 1st: <b>${R.first.toFixed(1)} s</b> · hit the bag at ${Math.round(R.firstV / VMAX * 100)}% speed` : "To 1st: <b>–</b>";
}

let sim = 0, running = false, last = 0, told = {};
function say(key, text) { if (running && !told[key]) { told[key] = true; ui.result.textContent = text; } }

// Draw order: Sid last so his slide is never hidden under the others.
const DRAW = ["Sam", "Bea", "Ray", "Sid"].map((n) => RUNNERS.find((r) => r.key === n));
function drawScene() {
  drawField();
  DRAW.forEach((r) => drawPlan(r.R, css(r.color)));
  DRAW.forEach((r) => drawFeet(r.R, sim, css(r.color), r.edge));
  drawSlideMarks(sid, sim);
  return DRAW.map((run) => { const st = at(run.R, sim); return { run, st, ...drawBody(run, st, sim) }; });
}

// Slide cam: a zoomed circle over 2nd base while Sid slides in.
function drawSlideCam() {
  if (sim < sid.slideT - 0.8 || sim > sid.T + 2.2) return;
  const save = [k, ox, oy], R0 = W * 0.17, cx = R0 + 12, cy = R0 + 12;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.clip();
  // Aim a little before the bag so the approach and the skid mark are in view.
  k = save[0] * 3.2; const aim = [90, 86.5];
  ox = cx - (aim[0] - aim[1]) / Math.SQRT2 * k; oy = cy + (aim[0] + aim[1]) / Math.SQRT2 * k;
  cam = true; drawScene(); cam = false;
  ctx.restore();
  [k, ox, oy] = save;
  ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `700 ${Math.max(11, 3.6 * k)}px ${css("--body")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const t = "SLIDE CAM", w = ctx.measureText(t).width + 14, h = Math.max(20, 6 * k);
  ctx.fillStyle = "#4a1f8a"; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy + R0 - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(t, cx, cy + R0 + 1);
}

function render() {
  const drawn = drawScene();
  const bubbles = [];
  // Sid's bubble is placed first so it gets the best spot.
  [...drawn].sort((a, b) => (b.run.key === "Sid") - (a.run.key === "Sid")).forEach(({ run, st, s, r }) => {
    bubbles.push({ s, r, text: label(run, st, sim), fill: run.bubble[0], ink: run.bubble[1], side: run.bubble[2] });
  });
  drawBubbles(bubbles);
  drawSlideCam();
  RUNNERS.forEach((run) => {
    const st = at(run.R, sim);
    run.ui.t.textContent = Math.min(sim, run.stopAt).toFixed(1);
    run.ui.f.style.width = (sim >= run.stopAt ? 0 : st.v / VMAX * 100) + "%";
    run.ui.s.textContent = statusText(run, st, sim);
    run.ui.p.innerHTML = splitText(run, sim);
  });
  if (sim >= ray.first) say("ray", `Ray is safe at first in ${ray.first.toFixed(1)} s! Running straight through is fastest when you only need one base.`);
  if (sim >= sid.slideT) say("slide", "Sid is sliding! You can't run through 2nd base, so he slides to stop right on the bag.");
  if (sim >= sid.T) say("sid", `Sid is safe at 2nd in ${sid.T.toFixed(1)} s. Sliding beat stopping on his feet by ${(sidStandUp.T - sid.T).toFixed(2)} s.`);
}
function finish() {
  const gap = (sam.T - bea.T).toFixed(1), extra = Math.round(bea.len - sam.len);
  ui.result.textContent = `To 1st: Ray ${ray.first.toFixed(1)} s. Sid slid into 2nd at ${sid.T.toFixed(1)} s. All the way home: Bea beats Sam by ${gap} s, even with ${extra} extra feet.`;
  ui.play.textContent = "Race again";
}
function tick(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  sim += dt * (ui.slow.getAttribute("aria-pressed") === "true" ? 1 : 2.5);
  if (sim >= END) { sim = END; render(); running = false; finish(); return; }
  render(); requestAnimationFrame(tick);
}
function start() {
  sim = 0; told = {}; running = true; last = performance.now(); ui.play.textContent = "Running…";
  ui.result.textContent = "And they're off! Watch the corners."; requestAnimationFrame(tick);
}
ui.play.addEventListener("click", start);
ui.slow.addEventListener("click", () => ui.slow.setAttribute("aria-pressed", ui.slow.getAttribute("aria-pressed") === "true" ? "false" : "true"));
new ResizeObserver(() => { size(); render(); }).observe(cv);
size(); render();
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  if (!running) render();
  if (!reduce) setTimeout(() => { if (!running && sim === 0) start(); }, 900);
});
})();

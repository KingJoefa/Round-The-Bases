/* Round the Bases! — "Run it yourself": arrow keys (or the touch pad) steer the batter-runner. */
(function () {
"use strict";
const { BASES, dist } = window.RTB;
const H = window.RTBHits, P = window.RTBPlay;
const stage = window.RTBStage, view = stage.view;
const $ = (id) => document.getElementById(id);

const ui = {
  tabCall: $("tabCall"), tabRun: $("tabRun"), panelCall: $("panelCall"), panelRun: $("panelRun"),
  batter: $("batter"), coachHelp: $("coachHelp"), rookie: $("rookie"), inning: $("inning"),
  board: $("playBoard"), coach: $("pCoach"), hit: $("pHit"), spd: $("pSpd"), spdT: $("pSpdT"), bases: $("pBases"),
  call: $("pCall"), why: $("pWhy"), outs: $("pOuts"), runs: $("pRuns"), tot: $("pTot"), back: $("toRace2"), cv: $("cv"),
};
const keys = { up: false, down: false, left: false, right: false, slide: false };
let S = null, phase = "idle", pitch = 0, running = false, last = 0, after = 0, lastHit = null;
const inning = { outs: 0, runs: 0, bases: 0 };
const COACH_BOX = { 1: [104, -14], 3: [-14, 104] };
const toggled = (el) => el.getAttribute("aria-checked") === "true";

// ---------- tabs ----------
function showTab(run) {
  ui.tabCall.setAttribute("aria-selected", String(!run)); ui.tabRun.setAttribute("aria-selected", String(run));
  ui.panelCall.hidden = run; ui.panelRun.hidden = !run;
  if (run) stage.setMode("play"); else if (stage.mode === "play") stage.setMode("race");
}
ui.tabCall.addEventListener("click", () => showTab(false));
ui.tabRun.addEventListener("click", () => showTab(true));
[ui.coachHelp, ui.rookie].forEach((b) => b.addEventListener("click", () => {
  const on = !toggled(b); b.setAttribute("aria-checked", String(on));
  b.textContent = b.textContent.replace(/On|Off/, on ? "On" : "Off");
  render();
}));
ui.back.addEventListener("click", () => showTab(false));

// ---------- input ----------
const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "slide" };
function onKey(e, down) {
  if (stage.mode !== "play") return;
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (down && k === "slide" && phase !== "pitch" && phase !== "live") { batterUp(); return; }
  keys[k] = down;
}
document.addEventListener("keydown", (e) => onKey(e, true));
document.addEventListener("keyup", (e) => onKey(e, false));
window.addEventListener("blur", () => Object.keys(keys).forEach((k) => (keys[k] = false)));
document.querySelectorAll(".dpad button").forEach((b) => {
  const k = b.dataset.k;
  const set = (v) => (e) => { e.preventDefault(); keys[k] = v; b.classList.toggle("down", v); if (v && b.setPointerCapture) b.setPointerCapture(e.pointerId); };
  b.addEventListener("pointerdown", set(true));
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, set(false)));
});
const input = () => ({ x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), y: (keys.up ? 1 : 0) - (keys.down ? 1 : 0), slide: keys.slide });

// ---------- at-bats ----------
function batterUp() {
  if (stage.mode !== "play") showTab(true);
  if (inning.outs >= 3) { inning.outs = 0; inning.runs = 0; inning.bases = 0; }
  let hit; do { hit = H.PLAY_HITS[Math.floor(Math.random() * H.PLAY_HITS.length)]; } while (hit === lastHit && H.PLAY_HITS.length > 1);
  lastHit = hit; S = P.createPlay(hit); phase = "pitch"; pitch = 0; after = 0;
  ui.call.textContent = ""; ui.call.className = "bigcall";
  ui.hit.textContent = "Here's the pitch…"; ui.why.textContent = "Get ready to run!";
  ui.batter.disabled = true; ui.batter.textContent = "Batter up!";
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  ui.cv.focus({ preventScroll: true });
  tally(); start();
}
ui.batter.addEventListener("click", batterUp);

function finish() {
  const r = S.result;
  if (r.type === "out") inning.outs++;
  if (r.type === "run") inning.runs++;
  inning.bases += r.bases;
  ui.call.textContent = r.type === "run" ? "RUN SCORES!" : r.type === "out" ? "OUT!" : ["", "SINGLE!", "DOUBLE!", "TRIPLE!"][r.base] || "SAFE!";
  ui.call.className = "bigcall " + (r.type === "out" ? "out" : "safe");
  ui.why.textContent = P.explain(S) + (inning.outs >= 3 ? ` That's 3 outs! You scored ${inning.runs} ${inning.runs === 1 ? "run" : "runs"} and ran ${inning.bases} bases.` : "");
  tally();
}
function tally() {
  const o = "●".repeat(inning.outs) + "○".repeat(Math.max(0, 3 - inning.outs));
  ui.outs.textContent = o; ui.runs.textContent = inning.runs; ui.tot.textContent = inning.bases;
  ui.inning.textContent = `Outs ${o} · Runs ${inning.runs}`;
}

// ---------- loop ----------
function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(tick); }
function tick(now) {
  if (!running) return;
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  const dt = real * (toggled(ui.rookie) ? 0.65 : 1);
  if (phase === "pitch") {
    pitch += dt;
    if (pitch >= 0.9) { phase = "live"; ui.hit.textContent = S.hit.say; ui.why.textContent = "Run! Touch each base in order."; }
  } else if (phase === "live") {
    for (let i = 0; i < 2; i++) S.step(dt / 2, input());
    if (S.result) { phase = "done"; finish(); }
  } else if (phase === "done") {
    S.step(dt, {}); after += dt;
    if (after > 1.8) {
      running = false; phase = "idle";
      ui.batter.disabled = false; ui.batter.textContent = inning.outs >= 3 ? "New inning!" : "Next batter!";
      ui.coach.textContent = inning.outs >= 3 ? "Great inning! Press New inning to play again." : "Press Next batter! (or Space) for another hit.";
    }
  }
  render();
  if (running) requestAnimationFrame(tick);
}

// ---------- drawing ----------
function dot(p, r, fill, edge, lw) { const s = view.S(p), ctx = view.ctx; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (edge) { ctx.lineWidth = lw || 2.5; ctx.strokeStyle = edge; ctx.stroke(); } return s; }
function render() {
  if (stage.mode !== "play") return;
  const ctx = view.ctx, k = view.k;
  view.drawField();
  const R = S ? S.runner : { p: [0, 0], touched: [true, false, false, false], feet: [], slide: false, heading: [1, 0] };
  // bases you've touched light up
  for (let i = 1; i <= 3; i++) if (R.touched[i]) { const s = view.S(BASES[i]); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(9, 4 * k), 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = "#ffd52e"; ctx.stroke(); }
  // coaches
  const activeBox = R.touched[2] ? 3 : 1;
  [1, 3].forEach((b) => dot(COACH_BOX[b], Math.max(5, 1.8 * k), "#12324a", b === activeBox ? "#ffd52e" : "#fff"));
  // fielders
  const F = S ? S.F : Object.fromEntries(Object.entries(H.FIELDERS));
  ctx.font = `700 ${Math.max(10, 3.2 * k)}px ${view.css("--body")}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  Object.keys(F).forEach((who) => { const s = dot(F[who], Math.max(5, 1.8 * k), "#f4f6f8", "#1b2b4a"); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(who, s[0], s[1] - Math.max(5, 1.8 * k) - 2); });
  // footprints + runner
  const yel = view.css("--bea");
  ctx.fillStyle = yel; ctx.strokeStyle = "#3a2c00"; ctx.lineWidth = 1;
  R.feet.forEach((f) => { const s = view.S(f); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(2.2, 0.85 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  const rs = view.S(R.p), rr = Math.max(7, 2.4 * k);
  ctx.beginPath();
  if (R.slide) { const ang = Math.atan2(-R.heading[1], R.heading[0]); ctx.ellipse(rs[0], rs[1], rr * 1.6, rr * 0.7, ang, 0, Math.PI * 2); }
  else ctx.arc(rs[0], rs[1], rr, 0, Math.PI * 2);
  ctx.fillStyle = yel; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#3a2c00"; ctx.stroke();
  // ball
  let bp = [42.8, 42.8], bh = 1.5;
  if (S && phase === "pitch") { const f = Math.min(1, pitch / 0.9); bp = [42.8 * (1 - f), 42.8 * (1 - f)]; bh = 3; }
  else if (S && phase !== "idle") { bp = S.ball.p; bh = S.ball.h; }
  else if (S) { bp = S.ball.p; bh = S.ball.h; }
  const g = view.S(bp), br = Math.max(4, 1.2 * k);
  ctx.beginPath(); ctx.ellipse(g[0], g[1], br * 1.1, br * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
  ctx.beginPath(); ctx.arc(g[0], g[1] - bh * k * 0.9, br, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#c0392b"; ctx.stroke();

  const bubbles = [{ s: rs, r: rr, text: "You", fill: "#12324a", ink: "#fff", side: 1 }];
  // coach shouts
  const c = S && phase === "live" ? S.coach() : null;
  if (c && toggled(ui.coachHelp)) {
    const fill = c.tone === "go" ? "#1f8a4c" : c.tone === "stay" ? "#1d5fbf" : "#c2410c";
    bubbles.unshift({ s: view.S(COACH_BOX[activeBox]), r: Math.max(5, 1.8 * k), text: c.text, fill, ink: "#fff", side: activeBox === 1 ? 1 : -1 });
  }
  // things happening: overthrows, slips, bases touched
  if (S) S.events.filter((e) => S.t - e.t < 1.6 && e.p && e.type !== "out" && e.type !== "safe" && e.type !== "run")
    .forEach((e) => bubbles.push({ s: view.S(e.p), r: 6, text: e.type === "touch" ? `${e.text} ✓` : e.text, fill: e.type === "touch" ? "#ffd52e" : "#fff", ink: e.type === "touch" ? "#2a2000" : "#c62828", side: -1 }));
  if (phase === "pitch") bubbles.push({ s: view.S([42.8, 42.8]), r: 6, text: "Here's the pitch…", fill: "#fff", ink: "#12324a", side: -1 });
  if (phase === "live" && S.t < 2.5 && S.speed() < 1) bubbles.push({ s: view.S([30, 0]), r: 6, text: "Press → to run!", fill: "#ffd52e", ink: "#2a2000", side: -1 });
  if (phase === "idle" && !S) bubbles.push({ s: view.S([45, 20]), r: 6, text: "Press Batter up! or Space", fill: "#ffd52e", ink: "#2a2000", side: -1 });
  view.drawBubbles(bubbles);
  if (S && S.result) stamp(rs, S.result);

  // board
  const sp = S ? S.speed() : 0;
  ui.spd.style.width = (sp / window.RTB.VMAX * 100) + "%"; ui.spdT.textContent = sp.toFixed(0);
  if (phase === "live") ui.coach.textContent = toggled(ui.coachHelp) ? (c ? c.text : "") : "Coach is quiet. You make the call!";
  if (phase === "pitch") ui.coach.textContent = "Get ready…";
  ui.bases.querySelectorAll("span").forEach((el) => {
    const b = +el.dataset.b;
    el.classList.toggle("on", b < 4 ? R.touched[b] : !!(S && S.result && S.result.type === "run"));
  });
}
function stamp(at, r) {
  const ctx = view.ctx, k = view.k, text = r.type === "run" ? "RUN SCORES!" : r.type === "out" ? "OUT!" : "SAFE!";
  const size = Math.max(22, 9 * k);
  ctx.save(); ctx.translate(Math.min(Math.max(at[0], 110), view.W - 110), Math.max(at[1] - 60, 50)); ctx.rotate(-0.1);
  ctx.font = `400 ${size}px ${view.css("--display")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + size, h = size * 1.5;
  ctx.fillStyle = r.type === "out" ? "#c62828" : r.type === "run" ? "#b7791f" : "#1f8a4c";
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fillText(text, 0, 2); ctx.restore();
}

stage.register("play", {
  render,
  enter() { view.setRange(-26, 214, "square"); ui.board.hidden = false; ui.cv.setAttribute("tabindex", "0"); render(); },
  leave() {
    running = false; if (phase !== "idle") { phase = "idle"; ui.batter.disabled = false; }
    Object.keys(keys).forEach((k) => (keys[k] = false));
    ui.board.hidden = true; ui.cv.removeAttribute("tabindex");
  },
});
tally();
window.RTBPlayUI = { batterUp, get sim() { return S; }, keys, step(t) { ui.hit.textContent = S.hit.say; while (S && S.t < t && !S.result) S.step(1 / 60, input()); phase = S.result ? "done" : "live"; if (S.result) finish(); render(); } };
})();

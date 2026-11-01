/* Round the Bases! — "You call it": pick a hit, make the call, watch the throw. */
(function () {
"use strict";
const { at } = window.RTB;
const H = window.RTBHits;
const stage = window.RTBStage, view = stage.view;
const $ = (id) => document.getElementById(id);

const ui = {
  hits: $("hits"), through: $("callThrough"), banana: $("callBanana"), score: $("score"), prompt: $("callPrompt"),
  board: $("gameBoard"), hit: $("gHit"), runLab: $("gRunLab"), runBar: $("gRunBar"), runT: $("gRunT"),
  ballLab: $("gBallLab"), ballBar: $("gBallBar"), ballT: $("gBallT"), call: $("gCall"), why: $("gWhy"), slow: $("gSlow"), back: $("toRace"),
};

let hit = null, play = null, call = null, R = null, runnerArr = 0, sim = 0, phase = "idle", running = false, last = 0;
let right = 0, total = 0;

ui.hits.innerHTML = H.HITS.map((h) => `<button type="button" class="hit" data-hit="${h.id}" aria-pressed="false">${h.label}</button>`).join("") +
  `<button type="button" class="hit surprise" data-hit="random" aria-pressed="false">Surprise me!</button>`;
ui.hits.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-hit]"); if (!b) return;
  const id = b.dataset.hit === "random" ? H.HITS[Math.floor(Math.random() * H.HITS.length)].id : b.dataset.hit;
  choose(H.HITS.find((h) => h.id === id), b.dataset.hit === "random");
});

function setCallButtons(on) { ui.through.disabled = !on; ui.banana.disabled = !on; }
function choose(h, surprise) {
  stage.setMode("game");
  hit = h; play = H.build(h, H.pickArrival(h)); call = null; R = null; sim = 0; phase = "ready"; running = false;
  ui.hits.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hit === (surprise ? "random" : h.id))));
  ui.prompt.textContent = `${h.say} What's your call?`;
  ui.hit.textContent = h.say;
  ui.call.textContent = "Make your call!"; ui.call.className = "bigcall";
  ui.why.textContent = "Watch where the ball is going. Then pick Run through or Banana.";
  const base = play.target === 1 ? "1st" : "2nd";
  ui.runLab.textContent = `You → ${base}`; ui.ballLab.textContent = `Throw → ${base}`;
  setCallButtons(true);
  render();
}
function makeCall(c) {
  if (phase !== "ready") return;
  call = c; R = H.runners()[hit.kind][c]; runnerArr = H.arrival(hit, c);
  phase = "play"; sim = 0; setCallButtons(false);
  ui.call.textContent = c === "through" ? "Run through!" : "Banana!"; ui.call.className = "bigcall";
  ui.why.textContent = "Here comes the throw…";
  running = true; last = performance.now(); requestAnimationFrame(tick);
}
ui.through.addEventListener("click", () => makeCall("through"));
ui.banana.addEventListener("click", () => makeCall("banana"));
ui.slow.addEventListener("click", () => ui.slow.setAttribute("aria-pressed", ui.slow.getAttribute("aria-pressed") === "true" ? "false" : "true"));
ui.back.addEventListener("click", () => stage.setMode("race"));

const callTime = () => Math.max(runnerArr, play.Ta) + 0.12;
function umpire() {
  const o = H.outcome(hit, play.Ta, call), good = call === H.rightCall(hit);
  const other = H.outcome(hit, play.Ta, call === "through" ? "banana" : "through");
  const by = (m) => Math.max(0.1, m).toFixed(1), base = play.target === 1 ? "first" : "second";
  total++; if (good) right++;
  ui.score.textContent = `Good calls: ${right} of ${total}`;
  ui.call.textContent = o.safe ? "SAFE!" : "OUT!"; ui.call.className = "bigcall " + (o.safe ? "safe" : "out");
  if (hit.kind === "infield") {
    ui.why.textContent = good
      ? `Great call! Safe at first by ${by(o.margin)} s. On a ground ball in the infield, the throw goes to first, so run straight through the bag at full speed.`
      : `Out at first by ${by(o.margin)} s. The ball stayed in the infield, so the throw was coming to first. Your banana slowed you down at the bag. Running straight through, you'd be safe by ${by(other.margin)} s.`;
  } else {
    const bobble = hit.away ? " The bobble gave you time to take second!" : "";
    ui.why.textContent = good
      ? `Great call! Safe at second by ${by(o.margin)} s. The ball got to the outfield, so you ran a banana, kept your speed around first, and slid in.${bobble}`
      : `Out at second by ${by(o.margin)} s. Running through first made you stop, turn around and start all over. On a ball to the outfield, a banana would have had you safe by ${by(other.margin)} s.`;
  }
}

// ---------- drawing ----------
const POS = Object.keys(H.FIELDERS);
function drawFielders(t) {
  const ctx = view.ctx, k = view.k, r = Math.max(5, 1.8 * k);
  ctx.font = `700 ${Math.max(10, 3.2 * k)}px ${view.css("--body")}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  for (const who of POS) {
    const s = view.S(H.fielderAt(play, who, t));
    ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fillStyle = "#f4f6f8"; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#1b2b4a"; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(who, s[0], s[1] - r - 2);
  }
}
function drawBall(t) {
  const ctx = view.ctx, k = view.k, b = H.ballAt(play, t), g = view.S(b.p), lift = b.h * k * 0.9, r = Math.max(4, 1.2 * k);
  ctx.beginPath(); ctx.ellipse(g[0], g[1], r * 1.1, r * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
  ctx.beginPath(); ctx.arc(g[0], g[1] - lift, r, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#c0392b"; ctx.stroke();
  return { b, s: [g[0], g[1] - lift], r };
}
function drawPreview() {
  // Where the ball is headed: the first part of its path, plus a target ring.
  const ctx = view.ctx, k = view.k, first = play.segs[0], end = view.S(first.b);
  ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 3;
  ctx.beginPath(); const s = view.S([0, 0]); ctx.moveTo(s[0], s[1]);
  for (let f = 0.05; f <= 1.001; f += 0.05) {
    const g = view.S([first.a[0] + (first.b[0] - first.a[0]) * f, first.a[1] + (first.b[1] - first.a[1]) * f]);
    const lift = first.k === "air" ? 4 * first.H * f * (1 - f) * k * 0.9 : 0;
    ctx.lineTo(g[0], g[1] - lift);
  }
  ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.arc(end[0], end[1], Math.max(9, 4 * k), 0, Math.PI * 2); ctx.strokeStyle = "#ffd52e"; ctx.lineWidth = 3; ctx.stroke();
}
function drawStamp() {
  const o = H.outcome(hit, play.Ta, call), ctx = view.ctx, k = view.k;
  const s = view.S(play.target === 1 ? [112, 8] : [96, 112]);
  const text = o.safe ? "SAFE!" : "OUT!", size = Math.max(22, 10 * k);
  ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(-0.12);
  ctx.font = `400 ${size}px ${view.css("--display")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + size, h = size * 1.5;
  ctx.fillStyle = o.safe ? "#1f8a4c" : "#c62828"; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.fillText(text, 0, 2);
  ctx.restore();
}

function render() {
  if (!play) { view.drawField(); return; }
  view.drawField();
  const runColor = view.css(call === "through" ? "--ray" : "--bea"), edge = call === "through" ? "#fff" : "#3a2c00";
  if (phase === "ready") drawPreview();
  let runner = null;
  if (R) {
    view.drawPlan(R, runColor, 0.4); view.drawFeet(R, sim, runColor, edge); view.drawSlideMarks(R, sim);
    const st = at(R, sim); runner = { st, ...view.drawRunner(R, st, sim, runColor, edge) };
  } else {
    runner = { st: { p: [0, 0] }, ...view.drawRunner({ slideT: Infinity }, { p: [0, 0] }, 0, view.css("--fg"), "#fff") };
  }
  drawFielders(Math.max(0, sim));
  const ball = drawBall(phase === "ready" ? 0 : sim);
  const bubbles = [{ s: runner.s, r: runner.r, text: R && sim >= R.slideT && !runner.st.done ? "SLIDE!" : "You", fill: "#12324a", ink: "#fff", side: 1 }];
  if (ball.b.k === "bobble") bubbles.push({ s: ball.s, r: ball.r, text: "Bobble!", fill: "#fff", ink: "#c62828", side: -1 });
  if (phase === "ready") bubbles.push({ s: view.S(play.segs[0].b), r: Math.max(9, 4 * view.k), text: hit.label, fill: "#ffd52e", ink: "#2a2000", side: -1 });
  view.drawBubbles(bubbles);
  if (phase === "done" || (phase === "play" && sim >= callTime())) drawStamp();
  // umpire bars
  const span = Math.max(runnerArr || play.Ta, play.Ta) + 0.3, t = phase === "ready" ? 0 : sim;
  ui.runBar.style.width = (R ? Math.min(t, runnerArr) / span * 100 : 0) + "%";
  ui.ballBar.style.width = (phase === "ready" ? 0 : Math.min(t, play.Ta) / span * 100) + "%";
  ui.runT.textContent = R && t >= runnerArr ? runnerArr.toFixed(1) + " s" : "–";
  ui.ballT.textContent = phase !== "ready" && t >= play.Ta ? play.Ta.toFixed(1) + " s" : "–";
}
function tick(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  sim += dt * (ui.slow.getAttribute("aria-pressed") === "true" ? 0.7 : 1.6);
  if (phase === "play" && sim >= callTime()) { phase = "done"; umpire(); }
  if (phase === "done" && sim >= callTime() + 1.8) { running = false; render(); ui.prompt.textContent = "Pick another hit!"; return; }
  render(); requestAnimationFrame(tick);
}

stage.register("game", {
  render,
  enter() { view.setRange(-14, 216); ui.board.hidden = false; },
  leave() {
    running = false; phase = "idle"; play = null; hit = null; setCallButtons(false); ui.board.hidden = true;
    ui.hits.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    ui.prompt.textContent = "Pick a hit to start.";
  },
});
setCallButtons(false);
// Small hook for tests and demos: jump to a moment without animating.
window.RTBGame = {
  choose: (id) => choose(H.HITS.find((h) => h.id === id), false),
  call: (c) => { makeCall(c); running = false; },
  seek(t) { sim = t; if (phase === "play" && sim >= callTime()) { phase = "done"; umpire(); } render(); },
};
})();

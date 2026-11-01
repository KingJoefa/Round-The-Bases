/* Round the Bases! — the race: five runner styles, each can be switched on or off at any time. */
(function () {
"use strict";
const { VMAX, BASES, SLIDE_LEN, dist, squarePath, bananaPath, rayPath, sidPath, profile, at } = window.RTB;
const stage = window.RTBStage, view = stage.view;
const $ = (id) => document.getElementById(id);

const sam = profile(squarePath());
const bea = profile(bananaPath());
const ray = profile(rayPath(), true);
const sid = profile(sidPath(), true, SLIDE_LEN);
const wally = profile(bananaPath(18));
const sidStandUp = profile(sidPath(), true, 0); // same path, stopping on his feet instead

// bubble: [fill, ink, side (-1 above, 1 below)]; goal: what the split line reports.
const RUNNERS = [
  { key: "Sam", full: "Stop-and-Go Sam", how: "Runs square corners", R: sam, color: "--sam", edge: "#fff", bubble: ["#163a8a", "#fff", -1], stopAt: sam.T, on: true },
  { key: "Bea", full: "Banana Bea", how: "Runs a banana curve", R: bea, color: "--bea", edge: "#3a2c00", bubble: ["#fff3b0", "#3a2c00", 1], stopAt: bea.T, on: true },
  { key: "Ray", full: "Run-Through Ray", how: "Only going to 1st", R: ray, color: "--ray", edge: "#fff", bubble: ["#8a1f17", "#fff", 1], stopAt: ray.first, on: true },
  { key: "Sid", full: "Slide-In Sid", how: "Going to 2nd, slides in", R: sid, color: "--sid", edge: "#fff", bubble: ["#4a1f8a", "#fff", -1], stopAt: sid.T, on: true },
  { key: "Wally", full: "Wide Wally", how: "Banana way too wide", R: wally, color: "--wally", edge: "#fff", bubble: ["#0b5d52", "#fff", 1], stopAt: wally.T, on: false },
];
const byKey = Object.fromEntries(RUNNERS.map((r) => [r.key, r]));

// ---------- scoreboard cards ----------
const list = $("runners");
list.innerHTML = RUNNERS.map((r) => `
  <div class="runner" id="card${r.key}">
    <span class="swatch" style="background:var(${r.color})" aria-hidden="true"></span>
    <span class="rname">${r.full}</span>
    <span class="clock" id="t${r.key}">0.0</span>
    <span class="rhow">${r.how}</span>
    <button type="button" class="toggle" id="on${r.key}" role="switch" aria-checked="${r.on}" aria-label="Show ${r.full}">${r.on ? "On" : "Off"}</button>
    <div class="meter"><div class="bar"><div class="fill" id="f${r.key}" style="background:var(${r.color})"></div></div><span class="status" id="s${r.key}">Ready…</span></div>
    <span class="split" id="p${r.key}">–</span>
  </div>`).join("");
RUNNERS.forEach((r) => {
  r.ui = { t: $("t" + r.key), f: $("f" + r.key), s: $("s" + r.key), p: $("p" + r.key), card: $("card" + r.key), on: $("on" + r.key) };
  r.ui.card.classList.toggle("off", !r.on);
  r.ui.on.addEventListener("click", () => {
    r.on = !r.on;
    r.ui.on.setAttribute("aria-checked", String(r.on)); r.ui.on.textContent = r.on ? "On" : "Off";
    r.ui.card.classList.toggle("off", !r.on);
    if (stage.mode === "race") render();
  });
});
const ui = { result: $("result"), play: $("play"), slow: $("slow") };
const visible = () => RUNNERS.filter((r) => r.on);

// ---------- labels ----------
function nearBase(p) { for (let i = 1; i < 4; i++) if (dist(p, BASES[i]) < 6) return true; return false; }
const outside = (p) => Math.max(-p[1], p[0] - 90, p[1] - 90, -p[0]); // ft outside the diamond
function label(run, st, time) {
  const R = run.R, n = run.key;
  if (time <= 0) return n;
  if (n === "Ray") return time > R.first + 1.2 ? "Safe at 1st!" : Math.abs(time - R.first) < 1.2 ? "Run THROUGH!" : n;
  if (n === "Sid") return st.done ? "Safe at 2nd!" : time >= R.slideT ? "SLIDE!" : nearBase(st.p) ? "Lean & tap!" : n;
  if (st.done) return n + " is home!";
  if (n === "Sam" && st.v < VMAX * 0.45 && time > 1.6) return "STOP… turn…";
  if (n === "Bea" && nearBase(st.p)) return "Lean & tap!";
  if (n === "Wally" && outside(st.p) > 9) return "Way out here!";
  return n;
}
function statusText(run, st, time) {
  const R = run.R, n = run.key;
  if (time <= 0) return "Ready…";
  if (n === "Ray" && time >= R.first) return "Safe at 1st!";
  if (n === "Sid") { if (st.done) return "Safe at 2nd!"; if (time >= R.slideT) return "Sliding! Dirt is the brakes."; }
  if (st.done) return "Safe at home!";
  if (time < 1.4) return "Taking off!";
  if (n === "Ray") return "Full speed! Straight line!";
  if (n === "Wally" && outside(st.p) > 9) return "Running extra steps…";
  const f = st.v / VMAX; return f > 0.85 ? "Full speed!" : f > 0.5 ? "Turning…" : "Slowing way down!";
}
function splitText(run, time) {
  const R = run.R;
  if (run.key === "Sid") return time >= R.T ? `To 2nd: <b>${R.T.toFixed(1)} s</b> · started sliding at ${Math.round(R.slideV / VMAX * 100)}% speed` : "To 2nd: <b>–</b>";
  return time >= R.first ? `To 1st: <b>${R.first.toFixed(1)} s</b> · hit the bag at ${Math.round(R.firstV / VMAX * 100)}% speed` : "To 1st: <b>–</b>";
}

// ---------- drawing ----------
let sim = 0, running = false, last = 0, told = {};
function say(key, text) { if (running && !told[key]) { told[key] = true; ui.result.textContent = text; } }
const ORDER = ["Wally", "Sam", "Bea", "Ray", "Sid"]; // Sid on top so his slide is never hidden

function drawScene() {
  view.drawField();
  const runs = ORDER.map((k) => byKey[k]).filter((r) => r.on);
  runs.forEach((r) => view.drawPlan(r.R, view.css(r.color)));
  runs.forEach((r) => view.drawFeet(r.R, sim, view.css(r.color), r.edge));
  if (byKey.Sid.on) view.drawSlideMarks(sid, sim);
  return runs.map((run) => { const st = at(run.R, sim); return { run, st, ...view.drawRunner(run.R, st, sim, view.css(run.color), run.edge) }; });
}
function drawSlideCam() {
  if (!byKey.Sid.on || sim < sid.slideT - 0.8 || sim > sid.T + 2.2) return;
  const R0 = view.W * 0.17, c = R0 + 12;
  view.inset(c, c, R0, 3.2, [90, 86.5], drawScene);
  view.tag("SLIDE CAM", c, c + R0, "#4a1f8a", "#fff");
}

function render() {
  const drawn = drawScene();
  view.drawBubbles(drawn.sort((a, b) => (b.run.key === "Sid") - (a.run.key === "Sid"))
    .map(({ run, st, s, r }) => ({ s, r, text: label(run, st, sim), fill: run.bubble[0], ink: run.bubble[1], side: run.bubble[2] })));
  drawSlideCam();
  RUNNERS.forEach((run) => {
    const st = at(run.R, sim);
    run.ui.t.textContent = Math.min(sim, run.stopAt).toFixed(1);
    run.ui.f.style.width = (!run.on || sim >= run.stopAt ? 0 : st.v / VMAX * 100) + "%";
    run.ui.s.textContent = run.on ? statusText(run, st, sim) : "Hidden";
    run.ui.p.innerHTML = splitText(run, sim);
  });
  const on = (k) => byKey[k].on;
  if (on("Ray") && sim >= ray.first) say("ray", `Ray is safe at first in ${ray.first.toFixed(1)} s! Running straight through is fastest when you only need one base.`);
  if (on("Sid") && sim >= sid.slideT) say("slide", "Sid is sliding! You can't run through 2nd base, so he slides to stop right on the bag.");
  if (on("Sid") && sim >= sid.T) say("sid", `Sid is safe at 2nd in ${sid.T.toFixed(1)} s. Sliding beat stopping on his feet by ${(sidStandUp.T - sid.T).toFixed(2)} s.`);
}
function finish() {
  const on = (k) => byKey[k].on, parts = [];
  if (on("Ray")) parts.push(`Ray was safe at 1st in ${ray.first.toFixed(1)} s.`);
  if (on("Sid")) parts.push(`Sid slid into 2nd at ${sid.T.toFixed(1)} s.`);
  if (on("Bea") && on("Sam")) parts.push(`Bea beat Sam home by ${(sam.T - bea.T).toFixed(1)} s, even with ${Math.round(bea.len - sam.len)} extra feet.`);
  if (on("Wally")) parts.push(`Wally swung so wide he took ${wally.T.toFixed(1)} s${on("Sam") && wally.T > sam.T ? ", even slower than Sam" : ""}. A banana should be a few steps wide, not a whole field!`);
  ui.result.textContent = parts.join(" ") || "Turn on a runner to race!";
  ui.play.textContent = "Race again";
}
const endTime = () => Math.max(2, ...visible().map((r) => r.stopAt)) + 0.4;
function tick(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  sim += dt * (ui.slow.getAttribute("aria-pressed") === "true" ? 1 : 2.5);
  if (sim >= endTime()) { sim = endTime(); render(); running = false; finish(); return; }
  render(); requestAnimationFrame(tick);
}
function start() {
  if (stage.mode !== "race") stage.setMode("race");
  sim = 0; told = {}; running = true; last = performance.now(); ui.play.textContent = "Running…";
  ui.result.textContent = visible().length ? "And they're off! Watch the corners." : "Turn on a runner to race!";
  requestAnimationFrame(tick);
}
ui.play.addEventListener("click", start);
ui.slow.addEventListener("click", () => ui.slow.setAttribute("aria-pressed", ui.slow.getAttribute("aria-pressed") === "true" ? "false" : "true"));

stage.register("race", {
  render,
  enter() { view.setRange(-18, 108); $("raceBoard").hidden = false; render(); },
  leave() { running = false; ui.play.textContent = "Play ball!"; $("raceBoard").hidden = true; },
});
view.size(); render();
window.RTBRace = { start, seek(t) { running = false; sim = t; render(); }, toggle: (key) => $("on" + key).click() };
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  if (stage.mode === "race" && !running) render();
  if (!reduce) setTimeout(() => { if (stage.mode === "race" && !running && sim === 0) start(); }, 900);
});
})();

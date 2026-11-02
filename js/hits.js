/*
 * Round the Bases! — "You call it" hits. Pure timing logic (no DOM), so it runs in the browser and in Node.
 *
 * Each hit is either:
 *   infield  — fielded on the ground, thrown to 1st. Right call: RUN THROUGH first.
 *   outfield — gets past the infield; the runner tries for 2nd. Right call: BANANA around first.
 * The throw's arrival time is picked inside a window so the right call is always safe and the wrong call is out.
 */
(function (root) {
"use strict";
const RTB = root.RTB || require("./physics.js");
const { dist, SLIDE_LEN, profile, rayPath, roundPath, sidPath, runThroughThen2nd } = RTB;

// Where fielders start (ft). LF line is the y axis, RF line is the x axis.
const FIELDERS = {
  P: [42.8, 42.8], C: [-5, -5], "1B": [98, 10], "2B": [104, 62], SS: [58, 112], "3B": [10, 96],
  LF: [45, 165], CF: [125, 125], RF: [165, 45],
};
const GLOVE1 = [89.3, 2.8];      // 1st baseman's glove on the bag
const GLOVE2 = [91.5, 91.5];     // fielder's glove at 2nd
const COVER1 = [90.8, 3.2], COVER2 = [92.5, 92.5];
const ARM_INFIELD = 45, ARM_OUTFIELD = 35; // ft/s, youth arms

const HITS = [
  { id: "ss", label: "Grounder to short", say: "Crack! A ground ball to the shortstop.", kind: "infield", fielder: "SS", spot: [54, 106] },
  { id: "gap", label: "Ball in the gap", say: "Smash! A line drive into the left-center gap.", kind: "outfield", fielder: "CF",
    land: [62, 148], spot: [82, 190], H: 0.14, cutoff: { who: "SS", at: [80, 142] }, cover: "2B", helper: { who: "LF", to: [70, 175] } },
  { id: "3b", label: "Grounder to third", say: "A hard grounder to the third baseman.", kind: "infield", fielder: "3B", spot: [16, 92] },
  { id: "line", label: "Down the right-field line", say: "A line drive down the right-field line! It rolls into the corner.", kind: "outfield", fielder: "RF",
    land: [150, 5], spot: [205, 7], H: 0.1, cutoff: { who: "2B", at: [150, 48] }, cover: "SS" },
  { id: "bunt", label: "Bunt", say: "A bunt! It dribbles up the third-base line.", kind: "infield", fielder: "C", spot: [10, 17] },
  { id: "deep", label: "Over the center fielder", say: "A long fly ball, way over the center fielder's head!", kind: "outfield", fielder: "CF",
    fstart: [112, 112], land: [128, 128], spot: [146, 146], H: 0.35, cutoff: { who: "SS", at: [116, 116] }, cover: "2B" },
  { id: "2b", label: "Slow roller to second", say: "A slow roller to the second baseman.", kind: "infield", fielder: "2B", spot: [97, 57] },
  { id: "rf", label: "Single to right", say: "A line drive single to right field!", kind: "outfield", fielder: "RF",
    land: [128, 52], spot: [148, 58], away: [165, 85], H: 0.1, cutoff: null, cover: "2B" },
];

// Extra scenarios for "Run it yourself" only. Each has a defensive mistake, so a smart runner can take extra bases, even score.
const ERROR_HITS = [
  { id: "over", label: "Grounder, overthrow", say: "A grounder to short… and the throw sails past first base!", kind: "infield", fielder: "SS",
    spot: [54, 106], error: "overthrow" },
  { id: "park", label: "Rocket to the fence", say: "A rocket to the right-center fence! The fielder slips!", kind: "outfield", fielder: "RF",
    land: [150, 90], spot: [178, 104], H: 0.12, cutoff: { who: "2B", at: [135, 80] }, cover: "SS", error: "slip", playPick: 13.6 },
  { id: "corner", label: "Into the left-field corner", say: "A line drive down the left-field line! It rolls into the corner and the left fielder can't find it!", kind: "outfield", fielder: "LF",
    land: [10, 150], spot: [9, 200], H: 0.12, cutoff: { who: "SS", at: [10, 140] }, cover: "2B", error: "lost", playPick: 15.2 },
];
const PLAY_HITS = HITS.concat(ERROR_HITS);

// The runner's two choices for each kind of hit.
let cache = null;
function runners() {
  if (!cache) cache = {
    infield: { through: profile(rayPath(), true), banana: profile(roundPath(), true) },
    outfield: { through: runThroughThen2nd(), banana: profile(sidPath(), true, SLIDE_LEN) },
  };
  return cache;
}
const arrival = (hit, call) => { const R = runners()[hit.kind][call]; return hit.kind === "infield" ? R.first : R.T; };

// Throw arrival window: the right call beats it, the wrong call doesn't.
function window_(hit) {
  const good = arrival(hit, hit.kind === "infield" ? "through" : "banana");
  const bad = arrival(hit, hit.kind === "infield" ? "banana" : "through");
  return hit.kind === "infield" ? [good + 0.1, Math.min(bad - 0.12, good + 0.34)] : [good + 0.15, Math.min(bad - 0.6, good + 1.0)];
}
function pickArrival(hit, rand) { const [a, b] = window_(hit); return a + (b - a) * (rand == null ? Math.random() : rand); }

// Build the ball's flight and the fielders' moves so the throw lands at time Ta.
function build(hit, Ta) {
  const segs = [], moves = {};
  const start = Object.assign({}, FIELDERS, hit.fstart ? { [hit.fielder]: hit.fstart } : {});
  const mv = (who, t0, t1, to) => {
    const m = moves[who] || (moves[who] = [{ t: 0, p: start[who] }]);
    m.push({ t: t0, p: m[m.length - 1].p }, { t: t1, p: to });
  };
  if (hit.kind === "infield") {
    const d = dist(hit.spot, GLOVE1), rel = Ta - d / ARM_INFIELD, pick = rel - 0.6;
    segs.push({ k: "ground", t0: 0, t1: pick, a: [0, 0], b: hit.spot });
    segs.push({ k: "hold", t0: pick, t1: rel, p: hit.spot, who: hit.fielder });
    segs.push({ k: "air", t0: rel, t1: Ta, a: hit.spot, b: GLOVE1, H: d * 0.06, who: hit.fielder });
    mv(hit.fielder, 0.25, pick - 0.05, hit.spot);
    mv("1B", 0.2, 1.6, COVER1);
    return { hit, Ta, segs, moves, start, target: 1, base: GLOVE1, pick, release: rel };
  }
  const from = hit.away || hit.spot, cut = hit.cutoff;
  let rel1, rel2 = null, catch1 = null;
  if (cut) {
    rel2 = Ta - dist(cut.at, GLOVE2) / ARM_OUTFIELD; catch1 = rel2 - 0.5;
    rel1 = catch1 - dist(from, cut.at) / ARM_OUTFIELD;
  } else rel1 = Ta - dist(from, GLOVE2) / ARM_OUTFIELD;
  const pick = rel1 - 1.0;
  const tLand = dist([0, 0], hit.land) / (hit.H > 0.2 ? 65 : 80);
  segs.push({ k: "air", t0: 0, t1: tLand, a: [0, 0], b: hit.land, H: dist([0, 0], hit.land) * hit.H });
  if (hit.away) { // fielder gets there, bobbles it, chases it down
    const tReach = tLand + 1.3;
    segs.push({ k: "ground", t0: tLand, t1: tReach, a: hit.land, b: hit.spot });
    segs.push({ k: "ground", t0: tReach, t1: pick, a: hit.spot, b: hit.away, bobble: true });
    mv(hit.fielder, 0.3, tReach, hit.spot); mv(hit.fielder, tReach + 0.3, pick, hit.away);
  } else {
    segs.push({ k: "ground", t0: tLand, t1: pick - 0.4, a: hit.land, b: hit.spot });
    segs.push({ k: "hold", t0: pick - 0.4, t1: pick, p: hit.spot });
    mv(hit.fielder, 0.4, pick, hit.spot);
  }
  segs.push({ k: "hold", t0: pick, t1: rel1, p: from, who: hit.fielder });
  if (cut) {
    segs.push({ k: "air", t0: rel1, t1: catch1, a: from, b: cut.at, H: dist(from, cut.at) * 0.08, who: hit.fielder });
    segs.push({ k: "hold", t0: catch1, t1: rel2, p: cut.at, who: cut.who });
    segs.push({ k: "air", t0: rel2, t1: Ta, a: cut.at, b: GLOVE2, H: dist(cut.at, GLOVE2) * 0.08, who: cut.who });
    mv(cut.who, 0.8, Math.min(catch1 - 0.5, 5), cut.at);
  } else segs.push({ k: "air", t0: rel1, t1: Ta, a: from, b: GLOVE2, H: dist(from, GLOVE2) * 0.08, who: hit.fielder });
  mv(hit.cover, 0.6, 4, COVER2);
  if (hit.helper) mv(hit.helper.who, 0.4, 4.5, hit.helper.to);
  return { hit, Ta, segs, moves, start, target: 2, base: GLOVE2, pick, release: rel1, land: hit.land, tLand };
}

const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const easeOut = (f) => 1 - (1 - f) * (1 - f);
// Ball position on the ground (`p`), height above it (`h`, ft), and what it's doing.
function ballAt(play, t) {
  if (t <= 0) return { p: [0, 0], h: 0, k: "start" };
  for (const s of play.segs) {
    if (t > s.t1) continue;
    const f = Math.max(0, Math.min(1, (t - s.t0) / Math.max(1e-6, s.t1 - s.t0)));
    if (s.k === "hold") return { p: s.p, h: 1.5, k: "hold", who: s.who };
    if (s.k === "air") return { p: lerp(s.a, s.b, f), h: 1.5 + 4 * s.H * f * (1 - f), k: "air" };
    const p = lerp(s.a, s.b, easeOut(f));
    if (s.bobble) return { p: [p[0] + Math.sin(t * 13) * 1.2, p[1] + Math.cos(t * 11) * 1.2], h: 0.3, k: "bobble" };
    return { p, h: 0.3, k: "ground" };
  }
  return { p: play.base, h: 1.5, k: "caught" };
}
function fielderAt(play, who, t) {
  const m = play.moves[who];
  if (!m) return play.start[who];
  let prev = m[0];
  for (const kf of m) { if (t < kf.t) { const f = (t - prev.t) / Math.max(1e-6, kf.t - prev.t); return lerp(prev.p, kf.p, Math.max(0, Math.min(1, f))); } prev = kf; }
  return prev.p;
}
function outcome(hit, Ta, call) {
  const r = arrival(hit, call);
  return { runnerT: r, safe: r <= Ta, margin: Math.abs(Ta - r) };
}
const rightCall = (hit) => (hit.kind === "infield" ? "through" : "banana");

const RTBHits = { HITS, ERROR_HITS, PLAY_HITS, FIELDERS, GLOVE1, GLOVE2, runners, arrival, window: window_, pickArrival, build, ballAt, fielderAt, outcome, rightCall };
if (typeof module !== "undefined" && module.exports) module.exports = RTBHits;
root.RTBHits = RTBHits;
})(typeof globalThis !== "undefined" ? globalThis : this);

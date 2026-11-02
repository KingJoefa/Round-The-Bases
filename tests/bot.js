// A simple simulated runner for tests: follows a path with "pure pursuit", stops (slides) at its goal base.
const RTB = require("../js/physics.js");
const P = require("../js/playsim.js");

function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function runBot(hit, { goal = 4, reaction = 0.4, path = "banana", seed = 1, wildChance = 0, steer, maxT = 45 } = {}) {
  const S = P.createPlay(hit, { rand: seeded(seed), wildChance });
  const pts = path === "straight" ? RTB.resample([[0, 0], [108, 0]]) : RTB.bananaPath().pts || RTB.bananaPath();
  let idx = 0, back = false;
  const dt = 1 / 60;
  while (S.t < maxT && !(S.result && S.t > S.result.t + 0.5)) {
    let input = {};
    if (S.t >= reaction && !S.result) {
      const R = S.runner, ob = S.onBase();
      if (steer) input = steer(S) || {};
      else if (path === "straight") {
        if (!R.touched[1]) input = { x: 1, y: 0 };
        else if (S.speed() < 0.5 || back) { back = true; input = RTB.dist(R.p, RTB.BASES[1]) > 1.5 ? { x: -1, y: 0 } : {}; }
      } else if (goal < 4 && R.touched[goal] && ob === goal) input = {};
      else if (goal < 4 && RTB.dist(R.p, RTB.BASES[goal]) < 9.5 && S.nextBase() === goal && S.speed() > 6) input = { slide: true };
      else {
        while (idx < pts.length - 1 && RTB.dist(pts[idx], R.p) > RTB.dist(pts[idx + 1], R.p)) idx++;
        const tgt = pts[Math.min(pts.length - 1, idx + 24)];
        input = { x: tgt[0] - R.p[0], y: tgt[1] - R.p[1] };
      }
    }
    S.step(dt, input);
  }
  return S;
}
module.exports = { runBot, seeded };

// A runner that does exactly what the base coach says.
const NAMES = { "1st": 1, "2nd": 2, "3rd": 3, home: 4 };
const banana = { pts: RTB.bananaPath() };
function coachSteer(S) {
  const c = S.coach(), txt = c ? c.text : "", R = S.runner, nb = S.nextBase();
  const toward = (b) => { const p = b === 4 ? [0, 0] : RTB.BASES[b]; return { x: p[0] - R.p[0], y: p[1] - R.p[1] }; };
  const stopAt = (b) => {
    const p = b === 4 ? [0, 0] : RTB.BASES[b], d = RTB.dist(R.p, p);
    if (d < 1.2) return {};
    if (b >= 2 && S.speed() > 6 && d < 9.5) return { slide: true };
    return toward(b);
  };
  let m;
  if ((m = txt.match(/Go back to (\w+)/))) return toward(NAMES[m[1]]);
  if ((m = txt.match(/Stay on (\w+)|Stop at (\w+)/))) return stopAt(NAMES[m[1] || m[2]]);
  if (/walk back to 1st/.test(txt)) return stopAt(1);
  if (/missed (\w+)/.test(txt)) return toward(NAMES[txt.match(/missed (\w+)/)[1]]);
  if (/Slide/.test(txt) && S.speed() > 6 && RTB.dist(R.p, nb === 4 ? [0, 0] : RTB.BASES[nb]) < 9.5) return { slide: true };
  if (nb === 1 && /through/i.test(txt)) return { x: 1, y: 0 };
  // otherwise advance along a banana path
  let best = 0, bd = 1e9;
  const start = [0, 360, 730, 1100][nb - 1] || 0; // rough index of each leg so we don't jump legs
  for (let i = start; i < banana.pts.length; i++) { const d = RTB.dist(banana.pts[i], R.p); if (d < bd) { bd = d; best = i; } if (i > start + 500) break; }
  const tgt = banana.pts[Math.min(banana.pts.length - 1, best + 24)];
  return { x: tgt[0] - R.p[0], y: tgt[1] - R.p[1] };
}
module.exports.coachSteer = coachSteer;

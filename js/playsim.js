/*
 * Round the Bases! — "Run it yourself" simulation. Pure logic (no DOM), runs in the browser and in Node.
 *
 * The kid steers the batter-runner. Input is a direction in field coords (x toward 1st, y toward 3rd... see below)
 * plus a slide button. Running uses the same limits as the race: top speed, speed-up, braking, and grip in turns.
 * The defense fields the ball from the hit's script, then throws live to the base the runner is heading for.
 *
 * Field coords: home (0,0), 1st (90,0), 2nd (90,90), 3rd (0,90). In the square view, +x is screen-right and
 * +y is screen-up, so → runs to 1st, ↑ to 2nd, ← to 3rd, ↓ home.
 */
(function (root) {
"use strict";
const RTB = root.RTB || require("./physics.js");
const H = root.RTBHits || require("./hits.js");
const { VMAX, ACC, DEC, ALAT, SLIDE_DEC, BASES, add, sub, mul, dist, norm } = RTB;

const HOME = [0, 0];
const baseP = (i) => (i === 4 || i === 0 ? HOME : BASES[i]);
const NAME = { 1: "1st", 2: "2nd", 3: "3rd", 4: "home" };
const COVER = { 1: [90.8, 3.2], 2: [92.5, 92.5], 3: [3.2, 92.5], 4: [-2.5, -2.5] };
const COVERERS = { 1: ["1B", "2B", "P"], 2: ["2B", "SS"], 3: ["3B", "SS"], 4: ["C", "P"] };
const OUTFIELD = new Set(["LF", "CF", "RF"]);
const TOUCH = 2.6, TAG = 3.2, CHASE = 16, COVER_SPEED = 15, FENCE = 205;
const GATHER = (who) => (OUTFIELD.has(who) ? 0.8 : 0.5);

function createPlay(hit, opt) {
  opt = opt || {};
  const rand = opt.rand || Math.random;
  const armK = 0.9 + rand() * 0.2;
  const wildChance = opt.wildChance == null ? 0.07 : opt.wildChance;
  const [wa, wb] = H.window(hit);
  // A little more time than "You call it": the kid has to react and steer.
  const slack = hit.kind === "infield" ? 0.7 : 1.2;
  const plan = H.build(hit, (wa + wb) / 2 + slack + (rand() - 0.5) * 0.4);
  const pick = hit.playPick ? hit.playPick + rand() * 1.2 : plan.pick;
  const armOf = (who) => (OUTFIELD.has(who) ? 35 : 45) * armK;

  const S = {
    hit, t: 0, pick, plan,
    runner: { p: [0, 0], v: [0, 0], heading: [1, 0], slide: false, slid: false, touched: [true, false, false, false], feet: [], lastFoot: 0 },
    F: {}, holder: null, gather: 0, ball: { state: "script", p: [0, 0], h: 0 }, flight: null, chaser: null,
    throws: 0, heldOnBase: 0, result: null, events: [], live: false,
  };
  const R = S.runner;
  Object.keys(H.FIELDERS).forEach((who) => { S.F[who] = H.fielderAt(plan, who, 0).slice(); });
  const event = (type, text, p) => S.events.push({ type, text, p: p ? p.slice() : null, t: S.t });

  // ---------- runner ----------
  function moveRunner(dt, input) {
    const s = Math.hypot(R.v[0], R.v[1]);
    let ns = s;
    if (R.slide) {
      ns = Math.max(0, s - SLIDE_DEC * dt);
      if (ns < 0.3) { R.slide = false; ns = 0; }
    } else if (input.slide && s > 6) {
      R.slide = true; R.slid = true; event("slide", "Slide!", R.p);
    } else if (input.x || input.y) {
      const d = norm([input.x, input.y]);
      if (s < 1) R.heading = d;
      else {
        const h = R.heading, ang = Math.atan2(h[0] * d[1] - h[1] * d[0], h[0] * d[0] + h[1] * d[1]);
        const maxT = (ALAT / s) * dt, turn = Math.max(-maxT, Math.min(maxT, ang));
        const c = Math.cos(turn), sn = Math.sin(turn);
        R.heading = norm([h[0] * c - h[1] * sn, h[0] * sn + h[1] * c]);
      }
      const left = Math.acos(Math.max(-1, Math.min(1, R.heading[0] * d[0] + R.heading[1] * d[1])));
      // A sharp turn means slowing down; a gentle curve keeps your speed.
      const target = left > Math.PI * 0.55 ? 0 : VMAX * Math.max(0.2, Math.cos(Math.min(left, Math.PI / 2)));
      ns = s < target ? Math.min(target, s + ACC * dt) : Math.max(target, s - DEC * dt);
      if (s < 1 && target > 0) ns = Math.max(ns, Math.min(VMAX, s + ACC * dt));
    } else ns = Math.max(0, s - DEC * dt);
    R.v = mul(R.heading, ns);
    R.p = add(R.p, mul(R.v, dt));
    R.p = [Math.max(-20, Math.min(225, R.p[0])), Math.max(-20, Math.min(225, R.p[1]))];
    if (dist(R.p, [0, 0]) > FENCE) R.p = mul(norm(R.p), FENCE);
    if (S.t - R.lastFoot >= 0.33 && ns > 0.5 && !R.slide) { R.feet.push(R.p.slice()); R.lastFoot = S.t; }
  }
  const speed = () => Math.hypot(R.v[0], R.v[1]);
  function nextBase() { for (let i = 1; i <= 3; i++) if (!R.touched[i]) return i; return 4; }
  // Safe standing on a base you've touched (or protected after overrunning 1st along the line).
  function onBase() {
    for (let i = 3; i >= 1; i--) if (R.touched[i] && dist(R.p, BASES[i]) < TOUCH) return i;
    if (R.touched[1] && !R.touched[2] && R.p[0] >= 88 && R.p[1] <= 5 && R.p[1] > -10) return 1;
    return 0;
  }
  const overran1st = () => R.touched[1] && !R.touched[2] && dist(R.p, BASES[1]) >= TOUCH && onBase() === 1;
  // Ran past the next base without touching it?
  function missedBase() {
    const nb = nextBase(); if (nb > 3) return 0;
    const here = baseP(nb), prev = baseP(nb - 1), after = baseP(nb + 1);
    if (dist(R.p, here) <= 8) return 0;
    return dist(R.p, prev) > dist(prev, here) + 6 || dist(R.p, after) < dist(here, after) - 12 ? nb : 0;
  }
  const atCover = (who, b) => who && dist(pos(who), COVER[b]) < 4;
  function checkTouches() {
    for (let i = 1; i <= 3; i++) if (!R.touched[i] && R.touched[i - 1] && dist(R.p, BASES[i]) < TOUCH) { R.touched[i] = true; event("touch", NAME[i], BASES[i]); }
    if (R.touched[3] && dist(R.p, HOME) < TOUCH) end({ type: "run", base: 4 });
  }

  // ---------- defense ----------
  const pos = (who) => S.F[who];
  function coverer(base, taken) {
    for (const who of COVERERS[base]) if (who !== S.holder && who !== S.chaser && !(taken && taken.has(who))) return who;
    return COVERERS[base][COVERERS[base].length - 1];
  }
  function moveToward(who, target, sp, dt) {
    const p = S.F[who], d = dist(p, target); if (d < 1e-6) return;
    S.F[who] = d <= sp * dt ? target.slice() : add(p, mul(sub(target, p), (sp * dt) / d));
  }
  function targetBase() {
    const nb = nextBase(), prev = nb - 1;
    if (prev >= 1 && speed() > 1 && (R.v[0] * (baseP(prev)[0] - R.p[0]) + R.v[1] * (baseP(prev)[1] - R.p[1])) > 0) return prev;
    return nb;
  }
  function throwTo(base) {
    const from = pos(S.holder).slice(), to = COVER[base], rec = coverer(base);
    const d = dist(from, to), dur = d / armOf(S.holder) + (d > 150 ? 0.8 : 0);
    const forced = S.throws === 0 && S.hit.error === "overthrow";
    const wild = forced || rand() < wildChance;
    let land = to;
    if (wild) {
      const dir = norm(sub(to, from)), over = forced && S.hit.error === "overthrow" ? 50 : 30 + rand() * 20;
      land = add(to, add(mul(dir, over), mul([-dir[1], dir[0]], (rand() - 0.5) * 24)));
      if (dist(land, HOME) > FENCE) land = mul(norm(land), FENCE);
      land = [Math.max(-26, land[0]), Math.max(-26, land[1])];
      event("wild", base === 1 ? "Overthrow!" : "Wild throw!", land);
    }
    // `aim`/`aimT`/`aimRec`: where the throw was meant to go. The coach only knows that until the ball gets away.
    S.flight = { rollFoul: forced, from, to: land, t0: S.t, t1: S.t + dur * (wild ? 1.15 : 1), H: Math.max(3, d * 0.07), rec: wild ? null : rec, base, wild, aim: to, aimT: S.t + dur, aimRec: rec };
    S.throws++; S.holder = null; S.ball.state = "flight";
  }
  function defense(dt) {
    if (S.t < S.pick) { // still the scripted part of the hit
      const tt = Math.min(S.t, S.plan.pick - 1e-3), b = H.ballAt(S.plan, tt);
      S.ball.p = b.p; S.ball.h = b.h;
      Object.keys(H.FIELDERS).forEach((who) => { S.F[who] = H.fielderAt(S.plan, who, tt).slice(); });
      if ((S.hit.error === "slip" || S.hit.error === "lost") && !S.slipped && S.t >= S.plan.pick - 0.2) { S.slipped = true; event("slip", S.hit.error === "slip" ? "Slipped!" : "Where is it?", S.ball.p); }
      return;
    }
    if (!S.live) { S.live = true; S.holder = S.hit.fielder; S.F[S.holder] = S.ball.p.slice(); S.gather = GATHER(S.holder); S.ball.state = "held"; }

    // fielders cover the bases (except whoever has the ball or is chasing it)
    const taken = new Set();
    for (let b = 1; b <= 4; b++) {
      const who = coverer(b, taken); taken.add(who);
      if (who !== S.holder && who !== S.chaser && !(S.flight && S.flight.rec === who)) moveToward(who, COVER[b], COVER_SPEED, dt);
    }
    if (S.ball.state === "flight") {
      const f = S.flight, k = Math.min(1, (S.t - f.t0) / (f.t1 - f.t0));
      S.ball.p = add(f.from, mul(sub(f.to, f.from), k)); S.ball.h = 1.5 + 4 * f.H * k * (1 - k);
      if (f.rec) moveToward(f.rec, f.to, COVER_SPEED, dt);
      if (k >= 1) {
        if (f.wild) {
          // An overthrow at 1st keeps rolling down the foul line toward the right-field corner.
          S.ball.state = "loose"; S.ball.h = 0.3; S.roll = f.rollFoul ? [30, 0] : mul(norm(sub(f.to, f.from)), 8);
          let best = null, bd = 1e9;
          for (const who of Object.keys(S.F)) { const d = dist(S.F[who], f.to); if (d < bd) { bd = d; best = who; } }
          S.chaser = best;
        } else { S.holder = f.rec; S.F[f.rec] = f.to.slice(); S.gather = GATHER(f.rec); S.ball.state = "held"; }
        S.flight = null;
      }
    } else if (S.ball.state === "loose") {
      if (S.roll) { const step = mul(S.roll, dt); S.ball.p = add(S.ball.p, step); S.roll = mul(S.roll, Math.max(0, 1 - 1.5 * dt)); if (Math.hypot(S.roll[0], S.roll[1]) < 0.5) S.roll = null; }
      moveToward(S.chaser, S.ball.p, CHASE, dt);
      if (dist(S.F[S.chaser], S.ball.p) < 2) { S.holder = S.chaser; S.chaser = null; S.gather = GATHER(S.holder) + 0.2; S.ball.state = "held"; }
    }
    if (S.ball.state !== "held") { S.heldOnBase = 0; return; }

    S.ball.p = pos(S.holder).slice(); S.ball.h = 1.5;
    S.gather -= dt;
    if (S.gather > 0) return;
    const ob = onBase();
    if (ob) {
      // Runner is safe on a base: bring the ball in; once it's held in the infield, the play is over.
      const inB = Math.min(ob + 1, 4);
      if ((OUTFIELD.has(S.holder) || dist(pos(S.holder), HOME) > 140) && !atCover(S.holder, inB)) { throwTo(inB); return; }
      S.heldOnBase += dt;
      if (S.heldOnBase > 1.6) end({ type: "safe", base: ob });
      return;
    }
    S.heldOnBase = 0;
    const tb = targetBase();
    if (atCover(S.holder, tb)) {
      // Waiting at the base with the ball: step toward a runner who's close, to tag them.
      if (dist(R.p, pos(S.holder)) < 14 && tb !== 1) moveToward(S.holder, R.p, 9, dt); else moveToward(S.holder, COVER[tb], 9, dt);
    } else throwTo(tb);
  }
  function checkOuts() {
    if (!S.holder || S.ball.state !== "held" || S.result) return;
    const hp = pos(S.holder);
    if (!R.touched[1] && dist(hp, BASES[1]) < 4.5) return end({ type: "out", base: 1, how: "force" });
    if (!onBase() && dist(hp, R.p) < TAG) {
      const near1 = !R.touched[2] && dist(R.p, BASES[1]) < 10;
      end({ type: "out", base: near1 ? 1 : nextBase(), how: near1 ? "rounded1" : "tag", back: targetBase() < nextBase() });
    }
  }
  function end(r) {
    if (S.result) return;
    r.t = S.t; r.slid = R.slid; r.bases = r.type === "run" ? 4 : r.type === "safe" ? r.base : 0;
    S.result = r; event(r.type, r.type === "run" ? "RUN SCORES!" : r.type === "safe" ? "Safe!" : "Out!", R.p);
  }

  // ---------- coach ----------
  // Rough "how long until the defense can get the ball to this base?"
  function ballETA(b) {
    const cov = COVER[b], rec = coverer(b), armIn = 45 * armK;
    if (S.t < S.pick) { const from = S.hit.away || S.hit.spot; const d = dist(from, cov); return S.pick - S.t + GATHER(S.hit.fielder) + d / armOf(S.hit.fielder) + (d > 150 ? 0.8 : 0); }
    if (S.ball.state === "held") {
      if (atCover(S.holder, b)) return 0;
      const d = dist(pos(S.holder), cov); return Math.max(0, S.gather) + d / armOf(S.holder) + (d > 150 ? 0.8 : 0);
    }
    if (S.ball.state === "flight") {
      const f = S.flight, left = Math.max(0, f.aimT - S.t);
      return f.base === b ? left : left + 0.5 + dist(f.aim, cov) / armIn;
    }
    const chase = S.chaser ? dist(S.F[S.chaser], S.ball.p) / CHASE : 1;
    return chase + 0.7 + dist(S.ball.p, cov) / (S.chaser ? armOf(S.chaser) : armIn);
  }
  function runnerETA(b) {
    const nb = nextBase(); let d = 0, from = R.p;
    for (let i = Math.min(nb, b); i <= b; i++) { d += dist(from, baseP(i)); from = baseP(i); }
    if (b < nb) d = dist(R.p, baseP(b));
    return d / VMAX + (speed() < 3 ? 1.2 : 0.25);
  }
  function coach() {
    if (S.result) return null;
    const m = missedBase(); if (m) return { text: `You missed ${NAME[m]}! Go back and touch it!`, tone: "warn" };
    if (S.t < 1.2 && speed() < 2) return { text: S.hit.kind === "infield" ? "Go! Straight through first!" : "Go! Banana turn at first!", tone: "go" };
    const ob = onBase(), nb = nextBase(), loose = S.ball.state === "loose" ? "It got away! " : "";
    if (ob) {
      const next = ob + 1, margin = ballETA(next) - runnerETA(next);
      if (margin > 0.8) return { text: loose + (next === 4 ? "Go home! You can score!" : `Go! Run to ${NAME[next]}!`), tone: "go" };
      if (overran1st()) return { text: "Nice! Now walk back to 1st.", tone: "stay" };
      return { text: `Stay on ${NAME[ob]}!`, tone: "stay" };
    }
    const margin = ballETA(nb) - runnerETA(nb), dNext = dist(R.p, baseP(nb));
    // Closer to the base behind you and it's not a sure thing ahead? Go back.
    if (nb > 1 && margin < 0.6 && dist(R.p, baseP(nb - 1)) < dNext && ballETA(nb - 1) - runnerETA(nb - 1) > 0) return { text: `Go back to ${NAME[nb - 1]}!`, tone: "warn" };
    if (margin < -0.3) {
      if (nb > 1 && ballETA(nb - 1) - runnerETA(nb - 1) > 0) return { text: `Go back to ${NAME[nb - 1]}!`, tone: "warn" };
      return { text: nb === 1 ? "Run hard! Through the bag!" : "Slide!", tone: "warn" };
    }
    if (dNext < 28) {
      if (nb < 4 && ballETA(nb + 1) - runnerETA(nb + 1) > 0.6) return { text: nb === 1 ? "Banana! Round 1st, keep going!" : nb === 3 ? "Round 3rd! Go home!" : `Round ${NAME[nb]}! Keep going!`, tone: "go" };
      if (nb === 1) return { text: "Run through first!", tone: "go" };
      if (nb === 4) return { text: margin < 1.5 ? "Slide into home!" : "Score! Touch home!", tone: "go" };
      if (margin < 1.5 && dNext < 14) return { text: "Slide!", tone: "warn" };
      return { text: `Stop at ${NAME[nb]}!`, tone: "stay" };
    }
    if (nb === 1) return ballETA(2) - runnerETA(2) > 0.6 ? { text: "Banana turn! Go for two!", tone: "go" } : { text: "Run hard! Straight through first!", tone: "go" };
    return { text: nb === 4 ? "Go home!" : `Run hard to ${NAME[nb]}!`, tone: "go" };
  }

  S.step = function (dt, input) {
    S.t += dt;
    if (!S.result) moveRunner(dt, input || {}); else moveRunner(dt, {});
    if (!S.result) checkTouches();
    defense(dt);
    checkOuts();
    if (!S.result && S.t > 50) end({ type: "safe", base: onBase() || 0 });
  };
  S.coach = coach; S.onBase = onBase; S.nextBase = nextBase; S.speed = speed; S.ballETA = ballETA; S.runnerETA = runnerETA;
  return S;
}

// Teaching message for the end of a play.
function explain(S) {
  const r = S.result, h = S.hit;
  if (!r) return "";
  if (r.type === "run") return "RUN SCORES! You made it all the way home. Banana turns and listening to your coach got you there.";
  if (r.type === "safe") {
    const kind = ["", "Single", "Double", "Triple"][r.base] || "Safe";
    if (!r.base) return "Play over.";
    if (h.kind === "infield" && r.base === 1) return `${kind}! Safe at 1st. On a ground ball, running straight through the bag is fastest.`;
    return `${kind}! Safe at ${NAME[r.base]}. ${r.base >= 2 ? "Rounding the bases with a banana kept your speed up." : ""}`.trim();
  }
  if (r.how === "rounded1") return h.kind === "infield" ? "Tagged out after rounding 1st. On a ground ball, run straight THROUGH first. Past the bag along the line, you're still safe." : "Tagged out off 1st. When the throw comes in, get back to the bag.";
  if (r.how === "force") return "Out at 1st. On a ground ball, run the moment it's hit, straight through the bag. Don't slow down to step on it.";
  if (r.back) return `Tagged out going back. Listen to your coach early: go or stay, but don't stop halfway.`;
  if (r.base >= 2 && !r.slid) return `Tagged out at ${NAME[r.base]}. You can't run past 2nd, 3rd or home plate's tag. Slide to stop right on the bag.`;
  return `Out at ${NAME[r.base]}. The throw beat you there. Watch the ball and your coach before you take the extra base.`;
}

const RTBPlay = { createPlay, explain, COVER, NAME };
if (typeof module !== "undefined" && module.exports) module.exports = RTBPlay;
root.RTBPlay = RTBPlay;
})(typeof globalThis !== "undefined" ? globalThis : this);

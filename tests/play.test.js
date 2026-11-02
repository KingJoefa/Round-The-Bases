// "Run it yourself": simulated runners check the lessons and that scoring is really possible.
const test = require("node:test");
const assert = require("node:assert/strict");
const RTB = require("../js/physics.js");
const H = require("../js/hits.js");
const P = require("../js/playsim.js");
const { runBot, coachSteer, seeded } = require("./bot.js");
const hit = (id) => H.PLAY_HITS.find((h) => h.id === id);

test("11 random scenarios: 8 hits plus 3 with a defensive mistake", () => {
  assert.equal(H.PLAY_HITS.length, 11);
  assert.deepEqual(H.ERROR_HITS.map((h) => h.error).sort(), ["lost", "overthrow", "slip"]);
});

test("a runner who listens to the base coach is never out", () => {
  for (const h of H.PLAY_HITS) for (let seed = 1; seed <= 5; seed++) {
    const S = runBot(h, { steer: coachSteer, seed, reaction: 0.45, wildChance: 0.07 });
    assert.ok(S.result, `${h.id} seed ${seed} ends`);
    assert.notEqual(S.result.type, "out", `${h.id} seed ${seed}: ${JSON.stringify(S.result)}`);
  }
});

test("you can make it all the way home", () => {
  for (let seed = 1; seed <= 5; seed++) assert.equal(runBot(hit("park"), { steer: coachSteer, seed, reaction: 0.45 }).result.type, "run", "fence ball");
  const corner = [1, 2, 3, 4, 5, 6].map((seed) => runBot(hit("corner"), { steer: coachSteer, seed, reaction: 0.45 }).result.type);
  assert.ok(corner.includes("run"), "left-field corner gives a chance to score");
});

test("ground ball: straight through first is safe; rounding it gets you tagged", () => {
  for (let seed = 1; seed <= 3; seed++) {
    assert.equal(runBot(hit("ss"), { path: "straight", seed }).result.type, "safe");
    const r = runBot(hit("ss"), { goal: 2, seed }).result;
    assert.equal(r.type, "out");
  }
});

test("ball in the gap: greedy runner going for home is thrown out; a double is safe", () => {
  assert.equal(runBot(hit("gap"), { goal: 4, seed: 2 }).result.type, "out");
  assert.deepEqual([runBot(hit("gap"), { goal: 2, seed: 2 }).result.type, runBot(hit("gap"), { goal: 2, seed: 2 }).result.base], ["safe", 2]);
});

test("missing a base doesn't count, and the coach tells you", () => {
  // Round 1st, then cut straight across to 3rd, skipping 2nd.
  let warned = false;
  const S = runBot(hit("park"), { seed: 1, reaction: 0.4, steer: (S) => {
    const c = S.coach(); if (c && /missed 2nd/.test(c.text)) warned = true;
    const R = S.runner, tgt = !R.touched[1] ? [90, 0] : [0, 90];
    return { x: tgt[0] - R.p[0], y: tgt[1] - R.p[1] };
  } });
  assert.ok(!S.runner.touched[2] && !S.runner.touched[3], "2nd and 3rd never count");
  assert.ok(warned, "coach warns about the missed base");
  assert.notEqual(S.result && S.result.type, "run");
});

test("sharp turns slow you down and swing you wide; gentle turns keep speed", () => {
  const run = (dir) => {
    const S = P.createPlay(hit("park"), { rand: seeded(1) });
    for (let i = 0; i < 300; i++) S.step(1 / 60, { x: 1, y: 0 });
    const x0 = S.runner.p[0]; let min = 99;
    for (let i = 0; i < 90; i++) { S.step(1 / 60, dir); min = Math.min(min, S.speed()); }
    return { min, wide: S.runner.p[0] - x0 };
  };
  const sharp = run({ x: 0, y: 1 }), gentle = run({ x: 1, y: 0.25 });
  assert.ok(sharp.min < RTB.VMAX * 0.7, `square corner brakes (min ${sharp.min.toFixed(1)})`);
  assert.ok(sharp.wide > 8, "and carries you wide past the turn");
  assert.ok(gentle.min > RTB.VMAX * 0.95, "a gentle curve keeps your speed");
});

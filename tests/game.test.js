// "You call it" hits and the Banana Lab. Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const RTB = require("../js/physics.js");
const H = require("../js/hits.js");

test("there are 8 hit types, half infield and half outfield", () => {
  assert.equal(H.HITS.length, 8);
  assert.equal(H.HITS.filter((h) => h.kind === "infield").length, 4);
});

test("for every hit, anywhere in its throw window, the right call is safe and the wrong call is out", () => {
  for (const hit of H.HITS) {
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      const Ta = H.pickArrival(hit, r);
      const good = H.rightCall(hit), bad = good === "through" ? "banana" : "through";
      assert.ok(H.outcome(hit, Ta, good).safe, `${hit.id} right call should be safe`);
      assert.ok(!H.outcome(hit, Ta, bad).safe, `${hit.id} wrong call should be out`);
      assert.ok(H.outcome(hit, Ta, good).margin >= 0.09, `${hit.id} margin big enough to show`);
    }
  }
});

test("ball timelines are continuous and make physical sense", () => {
  for (const hit of H.HITS) {
    const play = H.build(hit, H.pickArrival(hit, 0.5));
    play.segs.forEach((s, i) => {
      assert.ok(s.t1 >= s.t0, `${hit.id} segment ${i} runs forward`);
      if (i) assert.ok(Math.abs(s.t0 - play.segs[i - 1].t1) < 1e-6, `${hit.id} segment ${i} joins the last`);
    });
    assert.ok(play.pick > (play.tLand || 0) + 0.3, `${hit.id} is picked up after it lands`);
    assert.deepEqual(H.ballAt(play, play.Ta + 0.01).p, play.base, `${hit.id} ends in the glove at the base`);
    for (const air of play.segs.filter((s) => s.k === "air" && s.t0 > 0)) {
      const speed = RTB.dist(air.a, air.b) / (air.t1 - air.t0);
      assert.ok(speed > 25 && speed < 60, `${hit.id} throw speed ${speed.toFixed(0)} ft/s is youth-believable`);
    }
  }
});

test("Banana Lab: there is a sweet spot; too tight and too wide are both slower", () => {
  const T = (w) => RTB.profile(RTB.sidPath(w), true, RTB.SLIDE_LEN).T;
  const ts = [];
  for (let w = 0; w <= 20; w += 0.5) ts.push([w, T(w)]);
  const best = ts.reduce((a, b) => (b[1] < a[1] ? b : a));
  assert.ok(best[0] >= 4 && best[0] <= 10, `best width ${best[0]} ft should be a few steps out`);
  assert.ok(T(0) > best[1] + 0.2, "no curve is clearly slower");
  assert.ok(T(20) > best[1] + 0.5, "way too wide is clearly slower");
});

test("Wide Wally (18 ft banana) loses to Banana Bea", () => {
  assert.ok(RTB.profile(RTB.bananaPath(18)).T > RTB.profile(RTB.bananaPath()).T + 1);
});

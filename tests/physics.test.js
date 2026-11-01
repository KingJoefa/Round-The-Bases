// Run with: npm test   (Node 18+, no dependencies)
const test = require("node:test");
const assert = require("node:assert/strict");
const RTB = require("../js/physics.js");

const sam = RTB.profile(RTB.squarePath());
const bea = RTB.profile(RTB.bananaPath());
const ray = RTB.profile(RTB.rayPath(), true);

test("paths start at home; Sam and Bea finish at home", () => {
  for (const R of [sam, bea, ray]) assert.ok(RTB.dist(R.pts[0], [0, 0]) < 0.01);
  assert.ok(RTB.dist(sam.pts.at(-1), [0, 0]) < 0.01);
  assert.ok(RTB.dist(bea.pts.at(-1), [0, 0]) < 0.01);
});

test("no runner ever exceeds top speed", () => {
  for (const R of [sam, bea, ray]) assert.ok(Math.max(...R.v) <= RTB.VMAX + 1e-9);
});

test("banana path is longer but faster around all four bases", () => {
  assert.ok(bea.len > sam.len, "banana should cover more ground");
  assert.ok(bea.T < sam.T, "banana should get home first");
});

test("square corners force a big slowdown; the banana keeps speed", () => {
  const minMid = (R) => Math.min(...R.v.slice(50, -50));
  assert.ok(minMid(sam) < RTB.VMAX * 0.35);
  assert.ok(minMid(bea) > RTB.VMAX * 0.5);
});

test("running straight through is fastest to first, at full speed", () => {
  assert.ok(ray.first < bea.first && ray.first < sam.first);
  assert.ok(Math.abs(ray.firstV - RTB.VMAX) < 0.01);
});

test("Ray comes to a stop after the bag", () => {
  assert.equal(ray.v.at(-1), 0);
  assert.ok(ray.pts.at(-1)[0] > 90);
});

test("times stay in a believable youth range", () => {
  assert.ok(ray.first > 4 && ray.first < 8);
  assert.ok(sam.T > 18 && sam.T < 30);
});

const sid = RTB.profile(RTB.sidPath(), true, RTB.SLIDE_LEN);
const sidStandUp = RTB.profile(RTB.sidPath(), true, 0);

test("Sid stops on second base, not past it", () => {
  assert.ok(RTB.dist(sid.pts.at(-1), RTB.BASES[2]) < 2.5);
  assert.equal(sid.v.at(-1), 0);
});

test("Sid starts his slide near top speed, about 9 ft out", () => {
  assert.ok(sid.slideV > RTB.VMAX * 0.9);
  const ftOut = (sid.pts.length - 1 - sid.slideIdx) * RTB.DS;
  assert.ok(Math.abs(ftOut - RTB.SLIDE_LEN) < 0.5);
});

test("sliding beats stopping on your feet", () => {
  assert.ok(sid.T < sidStandUp.T);
});

test("no footprints during the slide (it's a skid mark)", () => {
  assert.ok(sid.feet.every((f) => f.t < sid.slideT));
});

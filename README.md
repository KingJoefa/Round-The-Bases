# Round the Bases!

An animated baseball lesson for young players (written for 2nd graders). Four runners with the **same top speed** race on an overhead diamond:

| Runner | Path | Lesson |
|---|---|---|
| **Stop-and-Go Sam** (blue) | Square corners at every base | Sharp turns force you to brake hard |
| **Banana Bea** (yellow) | Banana curve, taps the inside corner | A longer path, but she keeps her speed and gets home first |
| **Run-Through Ray** (red) | Straight through first base | When you only need first, a straight line at full speed is fastest |
| **Slide-In Sid** (purple) | Banana around first, slides into second | You can't run through 2nd, so slide: the dirt brakes you harder than your feet, so you stay fast longer and stop on the bag |

Footprints drop every ⅓ second, so kids can *see* speed: bunched footprints = slow, spread out = fast. Sid's slide leaves a skid mark instead, and a zoomed **slide cam** pops up over second base while he slides in.

## Run it

No build step. Either:

- Double-click `index.html`, or
- `npm start` to serve it locally (uses `npx serve`).

## Test it

```bash
npm test   # Node 18+, no dependencies
```

The tests check the lessons the page teaches: the banana is longer but faster home, the square path brakes hard at the bags, Ray is first to first base at full speed, and Sid's slide stops him on second faster than stopping on his feet.

## Deploy to GitHub Pages

1. Push this repo to GitHub on the `main` branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) runs the tests, then publishes the site. Your URL will be `https://<user>.github.io/<repo>/`.

## How the physics works

Everything lives in [`js/physics.js`](js/physics.js), which has no DOM code, so it runs in the browser and in Node.

- Field units are feet: home `(0,0)`, 1st `(90,0)`, 2nd `(90,90)`, 3rd `(0,90)`. The drawing rotates this 45° into a diamond.
- Each path is sampled every 0.25 ft. The banana path is a centripetal Catmull–Rom spline that bows into foul territory and touches each bag's inside corner.
- Speed at each point is the smallest of:
  - top speed `VMAX` (19 ft/s),
  - a turning-grip limit `v = √(ALAT × turn radius)`,
  - what acceleration (`ACC`) and braking (`DEC`) allow from the neighboring points (forward and backward passes, the same trick racing games use for a "racing line").
- Sliding: the last `SLIDE_LEN` (9 ft, per Baseball Canada's 9–10 ft guidance) uses `SLIDE_DEC` (19 ft/s², about dirt friction) instead of running braking `DEC` (14 ft/s²). Same path stopped on foot is used for the "slide vs. stand-up" comparison.
- Integrating distance ÷ speed gives the clock.

Tweak the constants at the top of `physics.js` to explore: give Sam more grip, make the banana wider, and see what changes.

## Project layout

```
index.html               page markup
css/styles.css           styles (light + dark themes)
js/physics.js            paths + speed model (pure, testable)
js/app.js                canvas drawing, animation, scoreboard
tests/physics.test.js    node:test suite
.github/workflows/       test + GitHub Pages deploy
```

## Sources for the coaching tips

- [Texas Rangers Youth Academy — Baseball 101](https://img.mlbstatic.com/mlb-images/image/upload/mlb/vcugml0jyyyf6zlb5qvc.pdf)
- [Fatherly — How to Teach Young Players to Run the Bases](https://www.fatherly.com/play/teach-young-baseball-players-run-bases/)
- [MOJO — The Basics of the Base Hit Turn](https://mojo.sport/coachs-corner/the-basics-of-the-base-hit-turn/)
- [Veo — Base Running Drills for Youth Baseball](https://www.veo.com/article/baseball-base-running-drills)
- [Dugout Captain — Base Hit Turns](https://www.dugoutcaptain.com/drill/base-hit-turns/)
- [Baseball Canada — Running the Bases](https://www.baseball.ca/running-the-bases)
- [ACTIVE — Sliding Fundamentals](https://www.active.com/baseball/articles/sliding-fundamentals-for-baseball-players?page=2)

## License

MIT

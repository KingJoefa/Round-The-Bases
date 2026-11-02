# Round the Bases!

An animated baseball lesson for young players (written for 2nd graders). Four parts:

### 1. The race
Five runners with the **same top speed** race on an overhead diamond. Each one can be switched on or off at any time, even mid-race.

| Runner | Path | Lesson |
|---|---|---|
| **Stop-and-Go Sam** (blue) | Square corners at every base | Sharp turns force you to brake hard |
| **Banana Bea** (yellow) | Banana curve, taps the inside corner | A longer path, but she keeps her speed and gets home first |
| **Run-Through Ray** (red) | Straight through first base | When you only need first, a straight line at full speed is fastest |
| **Slide-In Sid** (purple) | Banana around first, slides into second | You can't run through 2nd, so slide: the dirt brakes you harder than your feet, so you stay fast longer and stop on the bag |
| **Wide Wally** (teal, off by default) | A banana way too wide | Too wide wastes so many steps he's even slower than Sam |

Footprints drop every ⅓ second, so kids can *see* speed: bunched footprints = slow, spread out = fast. Sid's slide leaves a skid mark, and a zoomed **slide cam** pops up over second base while he slides in.

### 2. You call it!
Pick one of 8 hits (grounders to short, third and second, a bunt, a ball in the gap, down the right-field line, over the center fielder, a single to right). The field zooms out to show fielders and the ball. The kid makes the call, **Run through first** or **Banana turn**, and the play runs: ball, fielders, cutoff throw, and an umpire's **SAFE!** or **OUT!** with the margin.

- Infield ground ball → the throw goes to 1st → **run through** is right.
- Ball to the outfield → the runner goes for 2nd → **banana** is right.

The throw's timing is randomized inside a window that guarantees the right call is safe and the wrong call is out (tested).

### 3. Run it yourself!
The kid is the batter-runner. Press **Batter up!** (or Space) and a random hit comes off the bat: one of the 8 hits above, or one of 3 with a defensive mistake (an **overthrow** at first, a **rocket to the fence** where the fielder slips, a ball **into the left-field corner** the fielder can't find). Those last two give a real chance to run all the way home.

- **Arrow keys** (or WASD, or the on-screen pad) steer. The field turns square so the keys match the base paths: → to 1st, ↑ to 2nd, ← to 3rd, ↓ home. **Space** slides.
- Same running physics as the race: a sharp turn makes you brake and swing wide; a gentle banana keeps your speed.
- A live defense fields the ball and throws to the base you're heading for. Force outs at 1st, tags everywhere else, protection when you run through 1st along the line, and missed bases don't count.
- The **base coach** shouts advice from the coach's box ("Straight through first!", "Round 2nd! Keep going!", "Stay on 2nd!", "Slide!", "You missed 3rd!"). It only knows what a real coach could see. Turn **Coach help** off for a challenge, or turn on **Rookie speed** for younger kids.
- Three outs make an inning; the board tracks outs, runs and total bases.

Tests run a simulated runner that just follows the coach through every scenario: it is never out, scores every time on the fence ball, and often on the corner ball.

### 4. Banana Lab
A slider sets how far the runner swings out before first (0–20 ft). The path is colored by speed, a chart shows time to second for every width, and the runner can race the best banana. Too tight and you brake at the bag; too wide and you waste steps. The sweet spot is about 6–7 ft.

## Run it

No build step. Either:

- Double-click `index.html`, or
- `npm start` to serve it locally (uses `npx serve`).

## Test it

```bash
npm test   # Node 18+, no dependencies
```

The tests check the lessons the page teaches, including that every hit rewards the right call and that the Banana Lab has a real sweet spot: the banana is longer but faster home, the square path brakes hard at the bags, Ray is first to first base at full speed, and Sid's slide stops him on second faster than stopping on his feet.

## Deploy to GitHub Pages

1. Push this repo to GitHub on the `main` branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) runs the tests, then publishes the site. Your URL will be `https://<user>.github.io/<repo>/`.

## How the physics works

Everything lives in [`js/physics.js`](js/physics.js), which has no DOM code, so it runs in the browser and in Node.

- Bases are 90 ft apart (big-league size) with youth running speeds, so the times are longer than a real Little League field. Field units are feet: home `(0,0)`, 1st `(90,0)`, 2nd `(90,90)`, 3rd `(0,90)`. The drawing rotates this 45° into a diamond.
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
js/hits.js               the hits: ball flight, fielders, throw timing (pure, testable)
js/playsim.js            Run it yourself: runner control, live defense, base coach (pure, testable)
js/play.js               Run it yourself: keyboard/touch input, drawing, innings
js/field.js              canvas field renderer (one per canvas)
js/stage.js              main field shared by the race and the game
js/race.js               the race, runner toggles, scoreboard
js/game.js               "You call it"
js/lab.js                Banana Lab
tests/                   node:test suites
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

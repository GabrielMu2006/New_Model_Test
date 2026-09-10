# Transparent mechanical wristwatch movement — standalone animated SVG

`mechanical-watch-movement.svg` is a single self-contained file: open it in any
modern browser and a skeleton wristwatch movement runs, with hour, minute and
second hands, an eight-pair gear train, a club-tooth escapement, a balance
wheel breathing on its hairspring, and a wound mainspring that actually drives
the whole thing. Pause/resume, a logarithmic speed control and a winding button
are built into the drawing itself — no HTML wrapper, no JavaScript file, no
fonts, images or data from anywhere outside the file.

```
open mechanical-watch-movement.svg          # macOS
```

The markup already contains the complete movement posed at 10:10:30, so a
viewer that refuses to run scripts still sees the watch; it simply cannot
animate or respond to the controls.

---

## 1. The movement in one table

Everything is derived from one master phase `Q` = number of escapement beats
elapsed. Every wheel angle is a fixed multiple of `Q`, which is why the parts
behave as a system rather than as separate loops.

| # | Part | Teeth | Speed | Direction (dial view) | Drives |
|---|------|-------|-------|------------------------|--------|
| 1 | Barrel + mainspring | 80 | 1 rev / 8 h | counter-clockwise | centre pinion 10 |
| 2 | Centre wheel | 48 | 1 rev / h | clockwise | third pinion 6 |
| 3 | Third wheel | 45 | 8 rev / h | counter-clockwise | fourth pinion 6 |
| 4 | Fourth wheel | 48 | 1 rev / min | clockwise | escape pinion 6, seconds intermediate 16 |
| 5 | Escape wheel | 15 | 1 rev / 7.5 s | counter-clockwise | pallet fork |
| 6 | Pallet fork | — | 4 swings / s | ±4.5° | releases one tooth per beat |
| 7 | Balance + hairspring | — | 2 Hz | ±270° | locks the fork every beat |
| 8 | Motion work (cannon 8 → minute 36, minute pinion 12 → hour 32) | — | 12 : 1 | hour hand clockwise | hour + minute hands |
| 9 | Indirect centre seconds (48 → 16/18 → 54) | — | 1 : 1 | seconds hand clockwise | second hand |

Beat rate: **4 beats/s = 2 Hz = 14 400 A/h**, with a 15-tooth escape wheel, so
each beat advances the escape wheel exactly half a tooth (12°).

Direction rule: two gears in mesh always turn opposite ways. Reading the table
downwards the signs alternate — barrel ↺, centre ↷, third ↺, fourth ↷,
escape ↺ — and the seconds train is driven through two meshes so the seconds
hand keeps the fourth wheel's clockwise sense.

## 2. Why it is coherent, not decorative

* **One clock.** `state(Q)` in `src/model.js` maps a single scalar to every
  angle. Pausing, speeding up or resetting therefore cannot desynchronise
  anything; there is no per-part animation.
* **The escapement quantises the train.** The whole train, not just the escape
  wheel, advances only during the lift/impulse window (about 13 % of each
  beat) and is locked for the rest. That is why the seconds hand sweeps in
  four small steps per second instead of gliding: it is the same stepping the
  escape wheel gets from the pallet fork.
* **Meshing is solved, not eyeballed.** For every mesh the tooth phase is
  solved so a driver tooth and a driven gap meet on the line of centres. The
  fourth wheel drives two pinions (escape and the seconds intermediate), so
  its phase is fixed once and both pinions are phased to it.
* **The power source is real.** The mainspring's coil count and bunching follow
  the winding state; the reserve drains over 40 simulated hours, the watch
  stops when it is empty, and **WIND** refills it. The spiral's inner end is
  pinned to the arbor and its outer end to the barrel wall, so it visibly
  unwinds as the barrel turns.

## 3. Controls

| Control | Action |
|---|---|
| ▶ / ❚❚ button, `Space` | pause / resume — freezes the master phase |
| speed slider | 0.1× … 600×, logarithmic; drag or click the track |
| preset chips | 0.25×, 1×, 10×, 60× |
| `←` `→` (or `↑` `↓`) | halve / increase the speed by 1.35× |
| `W` or the WIND button | rewind the mainspring to 100 % |
| `R` | reset to beat 0 (10:10:30, fully wound) |

At 1× the balance oscillates at its real 2 Hz and the second hand ticks four
times a second. Slow to 0.25× to watch the pallet fork release individual
teeth; wind up to 60× to see the minute and hour hands travel and the
mainspring unwind.

## 4. Repository layout

```
mechanical-watch-movement.svg   the deliverable (generated, 132 kB, self-contained)
src/model.js                    pure kinematics, gear geometry, spring spirals
src/runtime.js                  DOM binding, requestAnimationFrame loop, controls
build.mjs                       emits the SVG from the model
verify.mjs                      84 kinematic/geometry/asset checks on the SVG
tools/browser.mjs               headless-Chrome probes: shots, runtime, controls
tools/pixels.mjs                decodes a screenshot and checks it against the model
screenshots/                    rendered evidence (see §6)
```

`src/model.js` is inlined verbatim into the SVG's `<script>` and is also
imported by the build and the tests, so the drawing, the animation and the
verification share exactly one definition of the movement. The generator is
included for reproducibility; the SVG does not need it at runtime.

## 5. Running the checks

```bash
./check.sh                      # regenerate + all browser-free gates, ~10 s
./check.sh --with-browser       # the same plus the headless-Chrome probes
```

or individually:

```bash
node build.mjs                  # regenerate the SVG
node verify.mjs                 # 84 checks: ratios, directions, phases, markup
node tools/pixels.mjs screenshots/frozen.png      # 26 rendered-pixel checks
node tools/browser.mjs shot screenshots/frozen.png "0 0 1240 920" 900 static
node tools/browser.mjs probe 8000                 # runtime: no JS errors, parts move
node tools/browser.mjs controls 20000             # pause, speed, slider, wind, keys
```

The browser probes are opt-in: launching Chrome writes to Chrome's own profile,
crashpad and keychain state outside this workspace, which this session's file
policy denies. Their recorded output from the last run is kept in
`evidence/browser-probes.txt`.

What the gates actually prove:

* **`verify.mjs`** — the file is well-formed XML with no external references of
  any kind; every mesh has the exact pitch-circle centre distance and the
  correct tooth/gap phase at arbitrary beat counts (including after 24
  simulated hours); each wheel's speed and direction is what the table says;
  the escape wheel advances exactly 12° per beat and is stationary for >85 % of
  it; the fork swings exactly once per beat; the balance crosses centre at
  every beat with alternating direction; the hands are geared to the same
  train; the static markup equals the model at beat 0; every DOM id the
  runtime touches exists; the embedded script parses.
* **`tools/pixels.mjs`** — decodes the actual PNG and checks the picture, not
  the source: a ruby jewel at each pivot, openworked golden rims, the barrel
  really drawing ~19 teeth across an 85° arc (80 teeth total), the third wheel
  ~10 across 80° (45 teeth), the escape wheel ~5.4 across 130° (15 teeth), the
  three hands lying on their computed angles with nothing where they are not,
  60 chapter-ring marks, all three panels carrying text, and no artwork clipped
  at the canvas edge.
* **`tools/browser.mjs probe`** — loads the SVG, records any JS error, and
  confirms the rotors and hands change over time and the hairspring is rebuilt.
* **`tools/browser.mjs controls`** — drives the real UI: pause freezes the
  train, resume restarts it, the 60× preset makes the second hand run, the
  slider reaches 600× and 0.1×, `Space` pauses/resumes, `R` returns the clock
  to 10:10:30 and WIND refills the reserve.

## 6. Rendered evidence

`screenshots/` holds what the gates looked at:

| File | What it shows |
|---|---|
| `frozen.png` | script removed — the static pose the pixel gate measures |
| `final-full.png` | the whole watch plus control panels |
| `final-train.png`, `final-escape.png` | train and escapement close-ups |
| `06-panels.png` | status / movement-map / time-control panels |
| `09-scaled.png`, `10-minimal.png` | render-probe calibration frames |
| `../evidence/browser-probes.txt` | recorded headless-Chrome probe output |

## 7. Known simplifications

* This is a **schematic superposition of the movement's planes**, as in a
  skeleton watch where every part is visible at once. Real wheels sit at
  different heights and partially hide one another; here the drawing order
  (plate → bridges → train → dial-side work → jewels → hands) keeps each part
  readable instead.
* Gear teeth are a stylised trapezoidal profile with a solved phase, not a true
  involute cut, and the pallet jewels intercept teeth geometrically rather than
  simulating locking faces, drop and slide.
* The balance amplitude is a pure sinusoid; a real balance is impulsed once per
  beat and its amplitude decays slowly. The impulse pin still sweeps the fork's
  notch at every zero crossing, so the fork snaps exactly on the beat.
* The power reserve (40 h) and the run-down stop are modelled, but the balance
  stops dead rather than coasting to rest.
* Interactive controls need a script-capable viewer; embedded as `<img>` or as
  a CSS background the file shows the frozen 10:10:30 pose.

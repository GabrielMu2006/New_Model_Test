# 2D Mechanical Linkage Designer

An interactive editor for planar mechanisms: place fixed pivots, rotating joints,
rigid links of exact length and sliders on rails, connect them into mechanisms,
pick a motor, then play the motion. Every pose is produced by a real constraint
solver, so **rigid links keep their exact length and constrained joints stay
attached** — at every step, not just at the start.

Crank-slider and four-bar linkages both ship as one-click presets, and both can
equally be built from an empty canvas with the drawing tools.

```
open dist/linkage-designer.html          # single file, no server, no install
# or work on the modular sources:
npm run serve                            # → http://127.0.0.1:8137/index.html
```

No build step, no dependencies, no network access: plain ES modules, a canvas and
Node only for the tests.

---

## 1. Quick start

| Step | What to do |
| --- | --- |
| 1 | Press **⏵ Play** (or `Space`). A four-bar linkage is loaded on first run. |
| 2 | Try the presets on the left: **Four-bar linkage**, **Crank-slider**, **Offset crank-slider**, **Double-rocker (jams)**, **Crank-slider + end stops**. |
| 3 | Drag any joint with the mouse — the linkage moves, links stay rigid and the crank is back-driven. |
| 4 | Scrub **Crank angle**, or press `S` to step one frame, `R` to reset to the design pose. |
| 5 | Open the **Joints / Links / Motors** tabs on the right to read live coordinates and lengths. |
| 6 | Name the mechanism and press **Save**; reload it later from the slot list, or use **Export .json**. |

Press `?` in the app for the same guide without leaving the page.

### Build a crank-slider from scratch (about 60 seconds)

1. **✚ Blank mechanism**.
2. Tool **▲ Fixed pivot** → click once (this is the crank centre).
3. Tool **═ Track** → click twice to lay a straight rail.
4. Tool **▣ Slider** → click near the rail; the slider snaps onto it.
5. Tool **● Rotating joint** → click where the crank pin should start.
6. Type `40` into **Exact link length** and tick *use value*; tool **▬ Rigid link** →
   click the fixed pivot, then the crank pin. The link is created at exactly 40 mm.
7. Untick *use value*; link the crank pin to the slider (the drawn distance is used).
8. Tool **↻ Motor** → click the fixed pivot. Press **Play**.

### Build a four-bar

Fixed pivots A and D, a rotating joint B, a rotating joint C, then links A–B,
B–C, C–D and A–D. Set exact lengths either while drawing or afterwards in the
inspector; the solver immediately pulls the joints to satisfy them. The
**Structure** panel reports mobility: one free degree of freedom before the
motor, zero after — a correctly assembled four-bar.

---

## 2. Tools and controls

| Tool | Key | Action |
| --- | --- | --- |
| Select / drag | `1` | click to select, drag a joint to move the mechanism, shift-click to multi-select, drag empty space to pan |
| Fixed pivot | `2` | pin a joint to the ground |
| Rotating joint | `3` | free pin joint |
| Rigid link | `4` | click two joints (clicking empty space creates the joint); optional exact length |
| Track / rail | `5` | two clicks define a ground-fixed rail |
| Slider | `6` | click near a rail; the slider is constrained to it |
| Motor | `7` | click a joint that has a link attached; that link becomes the driven crank |
| Delete | `8` | remove the clicked joint, link, rail or motor |

Transport: **Play/Pause**, **Step** (one frame), **⟲ 2° / 2° ⟳** (rotate the crank
by 2°), **Reset** (back to the design pose), **Clear paths**, **Crank angle**
scrubber and a **Speed** multiplier (0.05×–4×).

Display toggles: grid, joint labels, coordinates, lengths/dimensions, motion
paths, snap to grid, grid size.

Keyboard: `Space` play/pause · `S` step · `R` reset · `F` fit view · `[` `]` crank
∓2° · arrows nudge the selection (shift = ×10) · `G` `L` `C` `D` display toggles ·
`1…8` tools · `Delete` delete selection · `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z`
redo · `Ctrl/Cmd+S` save to slot · `?` help · `Esc` cancel.

### Reading the status bar

`link error`, `rail offset` and `motor error` are live residuals in millimetres /
degrees. `link error` reads `0.0e+0` for a healthy mechanism — that is the
guarantee that rigid links are still rigid. `mobility` is the number of
unconstrained degrees of freedom, computed numerically from the rank of the
constraint Jacobian; a well-formed driven mechanism shows `0`.

### Saving

* **Slots** — named mechanisms in browser `localStorage`, listed with a timestamp,
  restorable with one click.
* **Export / Import .json** — a portable file; you can also drag a `.json` file
  onto the canvas.
* **Autosave** — the current mechanism is restored the next time you open the app.
* A damaged or partial file still opens: unusable entities are dropped and the
  warnings are reported instead of the file being rejected.

---

## 3. How the solver works

Every moving joint contributes two unknowns. The mechanism is the zero set of a
handful of scalar constraints `C(x) = 0`:

| Constraint | Equation | Meaning |
| --- | --- | --- |
| link | `‖p_b − p_a‖ − L = 0` | the rigid link keeps its exact length `L` |
| track | `n · (p − a_track) = 0` | the slider stays on its rail (rails are ground-fixed) |
| stop | `u · (p − a_track) − s_limit = 0` | a slider resting on an end stop |
| motor | `wrap(θ(p) − θ_cmd) = 0` | the driven link holds the commanded orientation |

The pose is found with a damped Gauss-Newton (Levenberg-Marquardt) iteration on
`min ‖J Δx + C‖²`, using analytic Jacobians. On top of the plain iteration:

* **Backtracking line search.** Near a toggle position (coupler and rocker
  collinear) the Jacobian is singular; shortening the same Newton direction
  instead of inflating the damping lets the mechanism pass through dead centres
  rather than creeping to a halt. Verified on 40 random Grashof crank-rockers.
* **Recovery pass.** If the commanded pose is unreachable — a hard stop, a jammed
  or over-constrained linkage — the solver re-solves with the motor rows removed.
  The motor command is the constraint that gives way; the geometry never does.
* **Angle ramping.** Scrubbing the crank or loading a mechanism walks the angle
  in small increments instead of jumping, so the solver follows the real motion
  and stays on the correct assembly branch.
* **Jam bisection.** During simulation each sub-step that cannot be solved is
  bisected: the largest feasible fraction is kept, so the mechanism glides right
  up to a stop or a dead centre. If nothing forward is possible the mechanism
  settles exactly on the limit, the pose stays valid, and playback stops with a
  message naming the blocking constraint.
* **Interactive dragging** adds soft target rows, then a cleanup pass with the
  soft rows removed, so the pulled joint lands as close to the pointer as the
  geometry allows and the lengths are still exact afterwards. The motor is
  suspended during a drag, which is what makes the mechanism back-drive.

Mobility (`2·n_free − rank(J)`) is computed by rank-revealing elimination on the
Jacobian, so redundant links, under-driven mechanisms and locked structures are
reported honestly instead of silently.

Performance: a four-bar solves a 240 Hz time step in a few iterations; the frame
loop is driven by `requestAnimationFrame` and the canvas only redraws when
something changed.

---

## 4. Verification

```
npm test          # 66 solver / model / IO / bundle tests, no dependencies
npm run build     # regenerate dist/linkage-designer.html
node tools/browser-check.mjs            # 65 checks in real Chrome, modular build
node tools/browser-check.mjs --target dist   # same checks on the single-file build
```

`npm test` covers arithmetic and linear algebra, the model and its validation,
the solver (constraints, mobility, recovery), the four-bar and crank-slider
presets, the simulation controls, save/load/undo, view and hit-testing, the
renderer (driven through a mock 2D context), page wiring, the single-file bundle
and a **randomised robustness suite**: 40 randomly generated Grashof crank-rockers
(random joint order, random link direction) and 25 random crank-sliders, each
simulated for 2–2.5 s of model time while every link length and rail offset is
checked on every step.

Kinematic correctness is checked directly, not just stability: the crank-slider
stroke equals `2 × crank radius` to `1e-6 mm`; a full crank revolution returns
every joint to its start pose to `1e-6 mm`; the pose is a *single-valued function*
of the crank angle (no hysteresis between running and scrubbing); two separate
linkages can be joined into one mechanism, and an incompatible join is reported
as a jam with every link still exactly its own length.

`tools/browser-check.mjs` drives the real application in the locally installed
Chrome (headless, throw-away profile, its own static server on `127.0.0.1`, no
external network) over the DevTools protocol and checks, among others:

* the page boots with no console errors and no uncaught exceptions;
* the canvas is genuinely painted, the layout is sane and nothing overflows at
  390 / 768 / 1440 px;
* a four-bar runs in real time with a worst link error of `2.8e-14 mm`, and Reset
  returns to the design pose to `2.8e-14 mm`;
* the crank-slider stroke equals `2 × crank radius` to `1e-6 mm` while scrubbing
  through 145 crank angles, with rail offsets below `1e-16 mm`;
* a crank-slider is built **entirely with the tools and the mouse** from an empty
  canvas (fixed pivot → rail → slider → joint → exact 40 mm link → rod → motor),
  then runs without jamming and keeps every constraint;
* real mouse input drags a joint, wheel-zooms and pans; the delete tool removes an
  object with its links; undo/redo, the read-out tabs, save slots and the jamming
  preset all behave;
* the half-finished states a designer actually lives in do not throw: an empty
  canvas, a lone joint, a link with no motor, and dragging an un-powered link.

Both suites were green on the final revision: **66/66** Node tests and **65/65**
browser checks, for the modular build and for the single-file build.

### Bugs this testing actually caught

1. **Constraint assembly depended on entry order.** The normal equations were
   assembled from the upper triangle of each row, assuming entries were sorted by
   variable index. A link created from a later joint back to an earlier one
   (`C → B` after joints were placed `A, B, C`) contributed to the wrong half of
   the matrix and the solver stalled, moving the joint a fraction of a millimetre
   per iteration. The presets never hit it — building a crank-slider with the
   mouse did. Fixed by accumulating the full outer product; regression test
   *"a link works no matter which way round its joints were created"*.
2. **Toggle positions stopped the mechanism.** With only damping to fall back on,
   a mechanism that reached a collinear (dead-centre) configuration crept and was
   reported as blocked. Fixed with the backtracking line search; regression test
   *"random four-bars keep their links rigid whatever the joint order"*.
3. **The help dialog covered the whole application.** `.overlay { display: flex }`
   outranks the user agent's `[hidden]` rule, so the modal stayed visible on load
   and swallowed every mouse event. Only a real browser could see this. Fixed with
   an explicit `.overlay[hidden] { display: none }` rule and guarded by a test.

4. **A failed pointer capture aborted the drag.** `setPointerCapture` throws
   `NotFoundError` when no pointer with that id is active; the exception escaped
   the handler and left the interaction half-finished. Capture is now treated as a
   convenience and never as a requirement.

The first two were silent numerical failures that no smoke test would have shown;
the third made the app unusable despite every unit test passing.

---

## 5. Project layout

```
index.html                 application shell (modular sources)
styles.css                 theme, layout, responsive rules
src/math.js                vectors, angles, Gaussian elimination, matrix rank
src/model.js               joints / links / tracks / motors, validation, measures
src/solver.js              constraint assembly, LM solver, mobility, residuals
src/simulate.js            play / pause / step / reset, sub-stepping, jam handling
src/presets.js             four-bar, crank-slider, offset, jamming, end stops
src/serialize.js           JSON format, sanitising, storage slots
src/history.js             snapshot undo / redo
src/view.js                camera, screen↔world, hit testing
src/render.js              canvas renderer (context-agnostic, mockable)
src/app.js                 DOM wiring: tools, inspector, read-outs, transport
tests/run-tests.mjs        the whole Node test suite
tools/build-single-file.mjs  bundles src/ + css + html into dist/
tools/serve.mjs            static server for the modular build
tools/browser-check.mjs    end-to-end checks driven through Chrome DevTools
dist/linkage-designer.html generated single-file build (open it directly)
artifacts/                 verification evidence: the e2e screenshot, the input probe used to
                           diagnose the overlay bug, and solver-debug.mjs — a throwaway
                           instrumented copy of the solver from that investigation (not a
                           source of truth; src/solver.js is)
```

`dist/linkage-designer.html` is generated — run `npm run build` after changing
anything in `src/`, `index.html` or `styles.css`; a test fails if it is stale.

---

## 6. Limitations and honest notes

* **Rails are ground-fixed.** A slider riding on a *moving* link (a slot in a
  swinging body) is not supported; tracks do not move during simulation. The
  Scotch-yoke style drive where the slot itself translates is therefore not
  modelled.
* **One motor per joint**, and any number of motors overall. A motor drives the
  orientation of one link about one of its end joints; gear trains, belts and
  torque/force simulation are out of scope. This is a kinematic designer, not a
  dynamics simulator: no mass, no inertia, no gravity.
* **Static friction and backlash are not modelled.** End stops are geometrical
  limits; a jammed linkage is reported, not analysed.
* **Assemblies are followed, not searched.** The solver converges to the branch
  nearest the current pose. Loading a mechanism whose design pose is on a
  different branch than the stored pose, or dragging a linkage *through* a
  singular configuration, can settle on the mirrored assembly — that is normal
  behaviour for a position solver, and Reset returns to the design pose.
* **Browser storage** (`localStorage`) may be unavailable in private mode or for
  `file://` origins in some browsers; the app detects this, says so in the Save
  panel, and keeps Export/Import `.json` working (in-memory slots still work for
  the session).
* **Units are millimetres** in a y-up world; the scale bar and all read-outs use
  that unit. There is no unit switcher.
* The automated checks were run on macOS with Node 24 and the locally installed
  Google Chrome (headless). Other browsers were not exercised.

# Interactive Solar System

An animated, interactive orrery: the Sun, all eight planets, Earth's Moon, the
four Galilean moons of Jupiter, orbit paths, orbital trails, pause/resume,
adjustable simulation speed, zoom and pan, click-to-inspect, and a smooth
switch between the Solar System view and a selected planet's own system.

**No build step, no dependencies, no network access.** Plain HTML, CSS and
ES5-compatible JavaScript that runs from a static file server — or straight
off the disk.

---

## Run it

```bash
# any static server works; python3 ships with macOS and Linux
cd task-19-interactive-solar-system
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` directly with `file://` also works: the scripts are
classic `<script src>` tags, not ES modules, so no server is strictly required.

Requires a browser with canvas, `requestAnimationFrame` and pointer events
(any current Chrome, Firefox, Safari or Edge).

---

## Controls

| Input | Action |
| --- | --- |
| Click a body | Inspect it (distance, speed, period, phase, physical data) |
| Double-click a body | Focus the camera on it |
| Drag | Pan |
| Wheel / pinch | Zoom, anchored at the pointer |
| **Space** | Pause / resume |
| **←** / **→** | Slow down / speed up |
| **+** / **−** | Zoom in / out |
| **0** | Back to the Solar System view |
| **1**…**8** | Focus Mercury … Neptune |
| **T** / **O** | Toggle trails / orbit paths |
| **Esc** | Close the inspector, then return to the Solar System view |

Sidebar controls: play/pause, a logarithmic speed slider from 0.01 to 10,000
days per second (negative runs backwards) plus quick presets, view presets
(Full / System / Inner / Planet), camera tilt, and display toggles.

---

## How it works

```
index.html          markup and control surface
styles.css          theme and responsive layout
js/orbital.js       Kepler's equation, orbital elements, circular moon orbits
js/data.js          the catalogue: physical values + display knobs
js/simulation.js    simulation time and body state (positionAt / orbitPathAt)
js/projection.js    AU -> pixels, the camera, and the exact inverse
js/render.js        canvas drawing
js/ui.js            app state, the time loop, all interaction
js/main.js          DOM wiring
tests/*             verification (node, no browser needed)
```

Load order matters and is asserted by `tests/dom-check.js`.

### Two invariants do most of the work

**1. Position is a pure function of simulation time.**

The only mutable quantity in the simulation is a scalar, `time`, in days.
Every position is derived from it:

```js
planet = f(time)                       // heliocentric, AU
moon   = parentPosition(time) + localOrbit(time)
```

Nothing is integrated frame by frame, so there is no accumulated error and no
state to corrupt. This is what makes the speed control safe: a speed change
alters only the rate at which `time` advances.

That single rule is what satisfies both of the hard requirements:

* **Moons keep orbiting while their planet moves.** A moon's local position is
  evaluated in its parent's frame and then added to the parent's *current*
  heliocentric position. The parent's motion is included by construction. Over
  a full Earth year the Moon's distance from Earth is constant to 1e-13 AU, and
  it completes exactly 13 sidereal months — asserted in `tests/verify.js`.
* **Changing speed never causes a jump.** No code path moves a body; positions
  are recomputed from a number. `tests/verify.js` runs the same elapsed time
  through a constant speed and through a schedule that jumps 1 → 20000 → 0
  (paused) → −4 → 365 days/s, and requires the resulting positions to agree.
  It also verifies that no frame-to-frame hop exceeds the analytic chord for
  that frame's own `dt`, which is what a jump would look like.

**2. There is exactly one world space.**

The Solar System view and the planet view are the *same scene* at different
camera zoom. Switching views animates the camera; it never re-seeds a body,
re-phases an orbit, or switches to a different position formula. A moon
therefore cannot detach during a transition, because nothing about its
definition changes.

Supporting details:

| Concern | Approach |
| --- | --- |
| Distance compression | Distances span 100x (0.39–39 AU), so radial distance from the camera's focus is passed through a monotonic power curve. It is *exactly* linear within 0.25 AU, which is wider than the largest moon system, so moon orbits are rendered through a strict similarity and stay true circles at every zoom. |
| Picking | `unproject()` is an exact inverse of the forward map — verified to < 1e-6 px over a grid of zooms, tilts and camera positions, including points far off-centre. Clicking therefore lands on the body you are actually over, on the compressed scene. |
| Camera tilt | A real orthographic rotation about the X axis, not a raster squeeze. At tilt 0 the projection is a uniform similarity; at tilt 1 it looks straight down the ecliptic and Mercury's 7° and Pluto's 17° inclinations become visible. |
| Trails | Recorded at *absolute* multiples of a fixed interval, so a trail's shape is identical whatever speed it was recorded at. Moon trails are heliocentric, so they draw real epicycles. |
| Orbit paths | Generated by `sim.orbitPathAt()`, the same module that moves the bodies, and sampled adaptively so the polyline never visibly separates from the body sitting on it (max deviation < 0.3 px). |

### Fidelity, and where it is deliberately not to scale

Positions come from real J2000 orbital elements: semi-major axes,
eccentricities, inclinations, arguments of perihelion and mean longitudes, with
sidereal periods from the NASA/JPL fact sheets. All eight planets satisfy
Kepler's third law to within 0.13%, and computed mean orbital speeds match
published values to within 1.1% (both asserted in the tests).

Two things are **not** to scale, and are labelled as such in the UI:

1. **Body sizes.** True radii are 1e-5–4.6e-3 AU; at the wide-system layout the
   Sun would be 0.15 px across and Earth 0.0017 px. Sizes therefore use a
   sublinear compression of the true radius, shared by every body, which
   preserves the real size *order* at every zoom and viewport. The **True body
   scale** toggle switches to the honest, and almost entirely invisible,
   proportional rendering.
2. **The Sun's disc.** Held at a fixed small radius so it cannot cover Mercury
   and Venus; its corona is drawn much wider and conveys the Sun's brightness
   and dominance. Everything else (relative orbits, relative periods,
   eccentricity, inclination) is real.

The simulation is a **kinematic orrery, not an ephemeris**: it will not tell you
where Mars is on a given date. Moon orbits are circular (real eccentricities
are ≤ 0.007 except the Moon's 0.055), Saturn's and Uranus's many other moons are
not modelled, and the catalogue stops at Pluto, which is drawn with a dashed
orbit and labelled a dwarf planet.

---

## Verification

Everything below runs in Node with **no browser and no dependencies**.

```bash
node tests/verify.js          # 87 checks: physics, projection, invariants
node tests/dom-check.js       # 49 checks: assets, DOM wiring, accessibility
node tests/render-png.js      # renders 11 scenes to tests/out/*.png
node tests/tune-size-model.js # re-derives the body-size constants
```

`tests/verify.js` proves the claims made above rather than restating them. The
load-bearing ones:

* a constant-speed run and an erratic run over the same elapsed time produce the
  same position;
* no frame-to-frame hop exceeds the analytic chord for its own `dt`, across a
  speed schedule that includes pausing and running backwards;
* the frame guard limits how far time advances without ever altering state;
* the Moon holds its orbit to 1e-13 AU across a full Earth year and completes
  exactly 13 sidereal months;
* every moon holds its orbit across a full parent-planet revolution;
* `project` → `unproject` → `project` round-trips exactly, over a grid of zooms,
  tilts and camera offsets;
* the drawn size order of all twelve bodies matches the real one at every zoom
  on three viewport sizes;
* every body is clickable at the position it is drawn at.

`tests/tune-size-model.js` sweeps the size-model parameter space (millions of
combinations) against an explicit constraint list and reports the settings
baked into `js/projection.js`, so those constants can be re-derived rather than
guessed if the view presets change.

`tests/render-png.js` includes a small software rasteriser so scenes can be
rendered to PNG and inspected as images. This is a verification tool only; the
application never uses it.

### Not verified here

No test in this repository drives a real browser, so the following are checked
statically (`dom-check.js`) or by inspection, not by execution: canvas rendering
fidelity in a specific browser engine, pointer and pinch gesture handling, and
the responsive layout at real viewport sizes. `tests/out/*.png` approximates the
rendering but is produced by the software rasteriser, not by a browser.

# Rube Goldberg Machine

An interactive, animated Rube Goldberg machine that runs entirely in the browser.
Open **`index.html`** (double-click works — no server, no build step, no network,
no external assets).

Everything is hand-written: the physics engine, the machine, the renderer and the
synthesised sound. There is no physics library and no canvas framework.

---

## Controls

| Control | What it does |
| --- | --- |
| **Start** | Releases the launcher latch and runs the machine in real time |
| **Pause** | Freezes the simulation exactly where it is |
| **Resume** | Same button as Start while paused |
| **Step** | Advances one small slice of simulation time, played back slowly so you can watch it |
| **Reset** | Restores the exact start state (snapshot restore, not a re-simulation) |
| **Slow-mo** | 0.25× playback |
| **Sound on/off** | Synthesised impacts, whooshes, chimes |

Keyboard: `Space` start/pause, `→` step, `R` reset, `S` slow-mo, `M` sound.

The simulation always advances in fixed **1/240 s** steps. The controls change only
how much simulated time is fed in per frame, so the machine behaves identically at
any frame rate and can be paused, stepped and replayed deterministically.

---

## The eight stages

| # | Stage | Mechanism |
| --- | --- | --- |
| 1 | Spring launcher & domino run | A compressed spring drives a ram into the first of seven dominoes |
| 2 | Marble A rolls the ramp | The last domino shoves marble A onto a curved ramp — height becomes speed |
| 3 | Pendulum strike | Marble A knocks a hanging bob, which sweeps marble B off its perch |
| 4 | Chute & counterweight bucket | Marble B races down a steel chute and lands in a hanging V-bucket |
| 5 | Rope over the pulley | The loaded bucket drops; the rope lifts a gate and frees marble E |
| 6 | Counterweight swing | The loaded bucket's swing carries its rim into marble F's perch and knocks F loose |
| 7 | Spiral chute | Marble F drops onto a long curved chute and races down to the floor |
| 8 | Bell finale | Marble F lands on the bell; chime, fanfare and confetti |

Stage transitions are physical: a contact, a lever, a weight or a momentum transfer.
No stage has a timer. The `test` on each stage is a **read-only observer** used only
to label progress in the HUD; it never drives motion.

### Honest note on the causal chain

* The main chain is **1 → 2 → 3 → 4 → 6 → 7 → 8**, and every link is a real physical
  hand-off, verified by the headless harness.
* **Stage 5 is a parallel branch, not an in-line link.** Stage 4 (marble B landing in
  the bucket) causes *both* the gate lift (stage 5) and the swing that knocks marble F
  loose (stage 6). Marble E's release is a visible, physically-caused action, but it
  does not itself trigger anything downstream. This falls short of the ideal "each
  stage causes the next" for stage 5; see *Known limitations*.
* The three hanging balls drawn at x≈1080–1136 are a Newton's-cradle style ornament.
  They are simulated (they are real constrained bodies) but marble E misses them, so
  they do not participate in the chain. Stage 6 is therefore named and described
  after what actually happens, not after the ornament.

---

## Files

```
index.html            page shell, controls, stage tracker
styles.css            dark workshop UI, responsive layout
js/physics.js         2D Verlet particle engine (from scratch)
js/machine.js         the machine: geometry, constraints, stage definitions
js/render.js          canvas 2D renderer (no physics writes)
js/audio.js           synthesised WebAudio effects
js/app.js             fixed-step loop, transport state machine, HUD
tools/engine-check.js 8 self-checks of the physics engine
tools/overlaps.js     reports initial interpenetration
tools/simulate.js     headless run + stage timeline
```

### The engine (`js/physics.js`)

Verlet particles with mass and radius; distance constraints (`exact`/`max`/`min`);
force-based springs; a `PulleyConstraint` enforcing exact rope path length; static
segment and circle colliders; dynamic capsules (rods, buckets, gates); spatial-hash
broadphase; rolling-disc spin dynamics; per-axis locks; fixed timestep with a
deterministic snapshot/restore; NaN guards and out-of-bounds parking so a numerical
blow-up can never corrupt the scene.

---

## Verification performed

```bash
node --check js/*.js        # all browser scripts parse
node tools/engine-check.js  # All engine checks passed (8/8)
node tools/overlaps.js      # reports initial interpenetration
node tools/simulate.js      # fired 8/8 stages  ->  CHAIN OK
```

Measured stage times from `node tools/simulate.js`:

```
1. t=1.77s   2. t=5.28s   3. t=6.56s   4. t=7.41s
5. t=7.47s   6. t=8.37s   7. t=10.12s  8. t=10.32s
```

Stage 5 only fires when the gate has genuinely lifted (rest 857.6 → below 840), and
stage 6 only fires once marble F has actually left its perch (rest 948 → above 962).
Both thresholds were raised after the first version was found to be satisfied by the
resting state, which would have reported false progress.

`tools/overlaps.js` reports small deliberate initial overlaps (dominoes resting a few
pixels into their shelf, marble F resting on its perch, the bucket rim near the perch
end). These are settled by `M.settle(2.2)` before the machine is armed, which is why
the opening frame is perfectly still.

---

## Known limitations

* **No browser verification was performed.** This environment has no browser, so the
  UI was checked only statically (every element id referenced by `js/app.js` exists in
  `index.html`, and all scripts parse). The physics chain is verified headlessly. Treat
  the visual and audio behaviour as unverified.
* **Stage 5 does not cause stage 6** (parallel branch, described above).
* The Newton's-cradle ornament is not part of the chain.
* Marbles that finish their stage fall out of the world and are parked out of bounds
  (`killY`); the harness skips parked particles when checking for runaways.
* The bell and confetti finale are triggered by the stage-8 observer, not by the
  physical impact itself — the impact is real, but the celebration is a UI effect.

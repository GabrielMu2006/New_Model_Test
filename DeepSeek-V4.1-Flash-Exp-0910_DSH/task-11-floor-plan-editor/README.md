# Floor Plan Editor

A small 2D floor-plan editor that runs in the browser with **no build step and no
dependencies**. Draw walls, drop in doors and windows, arrange furniture, and read
each room's dimensions and area live as you edit.

```
open index.html          # or double-click it
```

Works straight from `file://` — the three scripts are classic (non-module) scripts,
so no server is required.

---

## What it does

| Tool | How it works |
| --- | --- |
| **Select** (`V`) | Drag objects, drag wall endpoints (round handles), drag doors/windows along their wall, rotate with the grip above an object. Click a wall/object/opening to select it; drag empty space to marquee-select; click a room label to inspect it. |
| **Wall** (`W`) | Drag to draw a wall. Keep dragging after releasing to chain walls; endpoints snap to nearby existing endpoints so corners close cleanly. Hold `Shift` for 45° steps, `Alt` to ignore snapping. `Esc` ends the chain. |
| **Door** (`D`) | Click a wall to place a door (0.9 m by default), then drag it along the wall to slide it. `Shift`+`F` or the *Flip* button mirrors the swing. |
| **Window** (`N`) | Click a wall to place a window (1.3 m by default) and drag to reposition it. |
| **Furniture palette** | Pick a preset (bed, sofa, table, chair, desk, cabinet, plant, WC, sink, stove), then click the canvas to place it. Click an existing item to drag it. |

Every room is detected automatically from the wall graph and labelled with
`width × height` and its area. Select a room to draw dimension lines around it and
see exact numbers in the properties panel.

Other things it does:

- **Undo / redo** — `Ctrl`+`Z` / `Ctrl`+`Shift`+`Z` (or `Ctrl`+`Y`), 120 steps.
- **Zoom / pan** — mouse wheel zooms at the cursor; hold `Space` (or the middle
  mouse button) and drag to pan; `F` fits the plan to the window.
- **Snapping** — 0.1 m grid plus endpoint snapping; toggle with `G`.
- **Live dimensions** — the `Dims` button toggles room labels.
- **Autosave** — the plan is saved to `localStorage` and restored on reload.
- **Save / Load** — export the plan as JSON (`Ctrl`+`S` or the *Save* button) and
  read it back with *Load*.
- **PNG export** — the *PNG* button renders the plan on a white background,
  cropped to its bounds, ready to drop into a document.
- **Demo plan** — a small 3-room apartment loads on first run so there is
  something to poke at. *New* clears it.

### Keyboard

| Key | Action |
| --- | --- |
| `V` `W` `D` `N` | Select · Wall · Door · Window |
| `Shift` + drag | Constrain a wall to 45° steps |
| `Alt` + drag | Temporarily ignore snapping |
| `Esc` | End wall chain / clear selection / back to Select |
| `Delete` | Delete the selection (deleting a wall also removes its openings) |
| `Ctrl`+`Z`, `Ctrl`+`Shift`+`Z` | Undo / redo |
| `R` | Rotate the selected object by 15° |
| `Ctrl`+`D` | Duplicate the selected object |
| `Shift`+`F` | Flip the selected door's swing |
| `F` | Fit the plan to the window |
| `G` | Toggle snapping |
| Wheel / `Space`+drag | Zoom / pan |

---

## How rooms are measured

`geometry.js` builds a planar graph from the walls: endpoints within 1 mm are
merged into one node, and any node lying on the middle of a wall **splits that
wall** — so a partition that butts into the middle of another wall still closes a
room (T-junctions). It then walks every half-edge cycle, always taking the next
edge immediately clockwise from the incoming one, and keeps the cycles with a
positive signed area. Those are exactly the interior faces; dangling walls
produce degenerate zero-area cycles and are dropped.

Dimensions are measured **on the wall centerlines** — a 5 × 6 m room with 0.15 m
walls has 4.85 × 5.85 m of clear internal space. The properties panel says so
explicitly rather than pretending otherwise.

---

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup and styling; loads the two scripts. |
| `geometry.js` | Pure geometry: projection, polygon area/centroid, wall quads, room detection. No DOM access, so it runs under Node too. |
| `app.js` | State, rendering, tools, hit-testing, properties panel, persistence. |
| `test-geometry.js` | Node unit tests for `geometry.js`. |
| `selftest.js` / `selftest.html` | In-browser test suite that drives the real UI with synthetic pointer events. |
| `run-tests.js` | Test entry point: runs both suites and writes `screenshot.png`. |
| `shot.html` | Harness that loads the editor and selects a room, for screenshots. |

## Tests

```
node run-tests.js        # or: npm test
```

This runs 21 geometry unit tests under Node, then boots the editor in headless
Chromium and runs 52 end-to-end checks — drawing walls by dragging, chained
endpoint snapping, room detection and dimensions, door/window placement and
dragging, furniture dragging on the grid, selection, marquee, undo/redo, wall
endpoint dragging, keyboard shortcuts, panel buttons, autosave, PNG export, and
a pixel probe that proves round objects really paint as ellipses. It finishes by
writing `screenshot.png` from the live editor.

The browser suite needs a Chromium/Chrome binary. It looks in the Playwright
cache and `/Applications`, or you can point `CHROME_BIN` at one:

```
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node run-tests.js
```

## Scripting hook

The editor exposes a small API for automation and embedding:

```js
FloorPlan.state          // live state: walls, openings, objects, selection, view
FloorPlan.rooms()        // detected rooms with {polygon, area, width, height, centroid}
FloorPlan.setTool('wall')
FloorPlan.toWorld(x, y)  // screen px → meters
FloorPlan.toScreen(pt)   // meters → screen px
FloorPlan.fit()
FloorPlan.render()
FloorPlan.exportPNG()
FloorPlan.undo() / .redo() / .deleteSelection()
```

The plan JSON format is deliberately plain:

```json
{
  "v": 1,
  "walls":    [{ "id": 1, "ax": 0, "ay": 0, "bx": 8, "by": 0, "thickness": 0.15 }],
  "openings": [{ "id": 7, "wallId": 1, "kind": "door", "t": 0.11, "width": 0.9, "flip": false }],
  "objects":  [{ "id": 9, "kind": "bed", "x": 6.9, "y": 4.9, "w": 1.6, "h": 2, "rot": 0, "label": "Bed" }],
  "nextId": 20,
  "view":     { "panX": 200, "panY": 90, "scale": 110 }
}
```

World units are **meters**, with the Y axis pointing down. Openings store their
position as `t`, the fraction along the wall (0 = wall start, 1 = wall end), so
they stay put when a wall is resized.

## Notes and limits

- Rooms are detected from closed loops of walls. Open loops, self-intersecting
  walls, and curved walls are not supported — it is a simple orthogonal-plan
  editor, not a CAD package.
- A wall drawn across a room's interior splits it into two rooms only if the wall
  actually meets the boundary walls; a free-floating partition with gaps at both
  ends is correctly ignored.
- Objects are decorative: they are not considered by room detection, and they do
  not collide with each other or with walls.
- The canvas renders at up to 2× device pixel ratio.

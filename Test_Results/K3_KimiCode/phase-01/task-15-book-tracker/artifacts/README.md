# Book Tracker

A small, dependency-free web app for keeping track of books: what you want to
read, what you are reading, and what you have finished.

## Run it

Open `index.html` in any modern browser — no build step, no server, no network
needed. (If your browser restricts `file://` pages, serve the folder instead:
`python3 -m http.server 8000` and visit <http://localhost:8000/>.)

## Features

- **Add / edit / delete books** with title (required), author, genre, status
  (want to read / reading / finished), optional 1–5 rating, finish date, and
  free-text notes. "Want to read" books cannot carry a rating; finishing a
  book records a finish date (defaults to today).
- **Search** by title, author or genre; **filter** by status; **sort** by date
  added, title, author or rating, ascending or descending.
- **Statistics** header: totals per status and average rating.
- **Persistence** in the browser's `localStorage` — data survives reloads and
  browser restarts on the same machine/browser.
- **Export / import** the whole library as JSON. Import merges into the
  current library and regenerates colliding ids, and validates the file before
  touching your data.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and book-card template |
| `styles.css` | Styling (warm paper look, responsive down to phone width) |
| `core.js` | Pure data-model logic: validation, create/update, search/filter/sort, stats, JSON export/import. No DOM — also loadable from Node |
| `app.js` | UI layer: rendering, event handling, `localStorage` persistence |
| `tests/core.test.js` | Unit tests for `core.js` (`node --test tests/core.test.js`) |
| `tests/app.smoke.js` | Node smoke test that runs `app.js` against a minimal fake DOM and drives the real event handlers (`node tests/app.smoke.js`) |

## Verification done

- `node --test tests/core.test.js` — 15/15 passing
- `node tests/app.smoke.js` — covers add, validation failure, edit, search,
  filter, delete, import (including malformed file and duplicate ids), export
  and reload-from-storage; passing
- `node --check` on all JS files; cross-check that every DOM id/class used by
  `app.js` exists in `index.html`

## Known limitations

- Data lives only in the current browser's localStorage; there is no sync,
  multi-user support or server backend. Use Export for backups.
- The smoke test uses a hand-rolled fake DOM, so it verifies wiring and logic
  but not real browser rendering — no headless browser was available in this
  environment. A quick manual open of `index.html` is recommended for visual
  confirmation.
- Ratings are whole numbers 1–5 only; no half stars, cover images, or page
  counts.

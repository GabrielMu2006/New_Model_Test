# Skylight — Weather Dashboard

A polished, dependency-free weather dashboard that runs straight from the file
system. It shows live conditions for anywhere on earth, and the whole page —
background, glyphs, particles — changes with the actual weather and local time.

```
open index.html          # or double-click it
```

No build step, no framework, no API key. The five scripts are classic
(non-module) scripts, so `file://` works as well as a server.

```bash
python3 -m http.server 8777      # or: npm start
open http://127.0.0.1:8777/index.html
```

---

## What it shows

| Section | Contents |
| --- | --- |
| **Hero** | Location, local clock, animated condition glyph, current temperature, feels-like, today's high/low, wind · humidity · UV · air-quality chips, and a 12-hour temperature curve with rain-chance bars. |
| **Hourly** | 24 scrollable hours from now: time, glyph, temperature and chance of rain — plus an optional detail row (feels-like, wind, humidity) behind *Show details*. |
| **7-day outlook** | Weekday, glyph, a range bar per day on a shared scale, high/low and peak rain chance. Today's bar carries a marker at the current temperature. |
| **Details** | Eight live cards: wind (compass + gusts + Beaufort), humidity (gauge + dew point + 24 h range), UV index (gauge + today's peak), air quality (US AQI ring + PM2.5/PM10), pressure (trend sparkline), visibility (meter), precipitation outlook, and sun (arc with sunrise/sunset, daylight length, solar noon). |

### Controls

| Control | Behaviour |
| --- | --- |
| Search | Type 2+ characters for live geocoding results. `↑` `↓` to move, `Enter` to open, `Esc` to dismiss. |
| `/` | Focus the search box from anywhere. `⌘K` / `Ctrl+K` too. |
| `°C` / `°F` | Switch units everywhere: temperatures, wind (km/h ↔ mph), precipitation (mm ↔ in) and visibility (km ↔ mi). |
| ☀ / ☾ | Toggle the light and dark surface theme. The default follows your OS preference. |
| ⟳ | Refresh immediately. Data also refreshes every 10 minutes and when the tab regains focus. |
| **My location** | Uses the browser's geolocation API, with a clear message if permission is denied. |

---

## The sky follows the weather

The palette, the ambient canvas and the glyphs are all driven by the current WMO
weather code plus the day/night flag — eleven distinct states:

`clear-day` · `clear-night` · `partly-day` · `partly-night` · `cloudy-day` ·
`cloudy-night` · `fog` · `rain` · `snow` · `storm`

Each state sets its own sky gradient, accent colour and particle system:

- **Clear day** — warm sun with slowly rotating rays, drifting light.
- **Clear night** — crescent moon (drawn with a mask, so it works on any sky) and twinkling stars.
- **Rain / showers** — slanted falling streaks.
- **Storm** — heavier rain plus occasional lightning flashes across the sky.
- **Snow** — flakes that sway as they fall.
- **Fog** — soft drifting haze bands.
- **Cloudy** — layered cloud glyphs and slow light puffs.

The light theme washes the sky to a soft pastel so the dashboard stays readable;
the dark theme keeps it rich. Both are verified by an automated contrast audit
(see [Testing](#testing)).

## Weather glyphs

Every icon is hand-built SVG in `js/icons.js` — no icon font, no sprite, no
network request. Each has small, restrained CSS animations: sun rays rotate,
clouds drift, drops fall, flakes spin, lightning flickers, stars twinkle. All of
it is disabled under `prefers-reduced-motion: reduce`.

---

## Data

Live data comes from [Open-Meteo](https://open-meteo.com/), which needs no API
key:

| Endpoint | Used for |
| --- | --- |
| `api.open-meteo.com/v1/forecast` | current, hourly (72 h) and daily (7 d) |
| `air-quality-api.open-meteo.com` | US AQI, PM2.5, PM10, ozone |
| `geocoding-api.open-meteo.com` | city search |

The dashboard degrades gracefully and never renders empty:

1. **Live** — fresh response from Open-Meteo.
2. **Cached** — if the network fails, the last successful response (< 15 min) is restored from `localStorage` and the badge reads *cached*.
3. **Offline model** — otherwise a deterministic local model (`WXApi.simulate`) generates a physically plausible forecast from the coordinates, date and a seeded PRNG: seasonal baseline by latitude, a diurnal temperature curve, humidity, pressure, wind, cloud cover, UV from solar elevation, and sunrise/sunset from a NOAA solar-position calculation. The badge reads *offline model*.

The badge in the hero always states which of the three you are looking at.

---

## Files

```
index.html              markup only — semantic, labelled, no inline styles
styles.css              design tokens, sky palettes, components, responsive rules
js/weather.js           WMO codes, unit conversion, formatting, sun helpers   (pure)
js/icons.js             animated SVG weather glyphs
js/charts.js            hand-rolled SVG charts: curve, compass, gauges, arc, sparkline
js/api.js               network layer, caching, offline simulation, solar model
js/effects.js           canvas particle systems per sky state
js/app.js               state, rendering and interaction
run-tests.js            112 unit assertions (no browser needed)
tools/                  browser-based verification harnesses (see below)
```

`js/weather.js`, `js/charts.js` and `js/api.js` are DOM-free and load in Node for
testing; everything is attached to small globals (`WX`, `WXIcon`, `WXChart`,
`WXApi`, `WXEffects`).

---

## Testing

```bash
npm test              # 112 unit assertions — WMO mapping, units, timezone
                      # parsing, solar model, offline simulation, chart geometry
npm run interact      # drives every control in a real browser (11 checks)
npm run contrast      # WCAG contrast audit in both themes
npm run states        # screenshots all 11 sky states
npm run verify        # everything above, in order
```

The browser harnesses live in `tools/` and use Playwright:

| Tool | What it proves |
| --- | --- |
| `tools/capture.js` | Renders 4 viewports × 2 themes, then audits each for console errors, failed requests, missing elements, horizontal overflow and zero-size visualisations. |
| `tools/contrast.js` | Hides the glyphs of every text element, re-screenshots, samples the **real rendered backdrop pixels** behind each label, and computes the WCAG ratio. Catches things a gradient makes impossible to reason about statically. |
| `tools/interact.js` | Unit toggle, hourly detail toggle, chart hover tooltip, search → select a city, `/` shortcut, theme toggle, refresh, and denied geolocation. |
| `tools/states.js` | Injects deterministic datasets for all 11 sky states and screenshots each one, so rain/snow/storm can be reviewed even when it is sunny outside. |
| `tools/inspect.js` | High-DPI crops of each section for close visual review. |

Artifacts land in `shots/`.

### Bugs this loop caught and fixed

- **Timezone double-offset** — the API returns wall-clock strings with no zone
  designator. `Date.parse` localised them to the browser's zone and the location
  offset was then subtracted again, so at 11 PM the strip started at 7 AM:
  temperatures appeared to rise overnight and daytime hours showed moon icons.
- **Hour angle in degrees treated as hours** — the offline sunrise/sunset model
  was ~193 hours long. It now applies the 0.833° refraction correction and
  returns hours, matching published values within a few minutes.
- **Light-theme hero was unreadable** — dark text sat on the dark night-sky
  gradient at 1.2:1. The light theme now washes the sky to a pastel and darkens
  the secondary inks; every label passes 4.5:1.
- **Invisible lightning** — the bolt's flash animation held `opacity: 0` for 62%
  of its cycle, so the storm icon usually looked like a plain rain cloud.
- **Crescent moon** — the cut-out was a hard-coded dark circle that looked like a
  hole on a light sky; it is now an SVG mask.
- **Wind compass contradicted its own label** — the needle pointed downwind while
  the caption read the upwind bearing. It now points at the source bearing.
- **Duplicated sunrise/sunset** — shown twice on the sun card; the card now shows
  daylight length and solar noon instead.

---

## Accessibility and details

- Every control is a real `<button>` with an accessible name; the search is a
  proper ARIA combobox with `role="listbox"` options and keyboard navigation.
- Status messages (refresh, offline, geolocation errors) go to a live region.
- Contrast is audited automatically and passes WCAG AA for all text in both themes.
- `prefers-reduced-motion: reduce` stops all icon animations, canvas particles and
  transitions, and the canvas renders a single static frame instead of looping.
- The canvas is `aria-hidden`; icons are `role="presentation"` with text labels
  alongside, so nothing depends on the visuals.
- Layout is fluid from 320 px to ultrawide, and the hourly strip is a
  keyboard-scrollable region with a fade affordance.
- A print stylesheet drops the sky, chrome and controls and keeps the data.

## Browser support

Modern evergreen browsers (Chrome, Safari, Firefox, Edge). Uses `backdrop-filter`,
CSS `color-mix()`, `mask-image`, `Intl`, `fetch` with `AbortController`,
`ResizeObserver`-free resize handling, and `localStorage` — all guarded so a
failure degrades to a usable page.

## License

MIT.

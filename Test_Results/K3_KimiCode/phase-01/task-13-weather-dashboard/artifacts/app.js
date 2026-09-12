/* ============================================================
   Atmos — Weather Dashboard
   Self-contained: simulated data, inline SVG, no network calls
   ============================================================ */
"use strict";

/* ---------- Weather icon library (SVG, animated via CSS) ---------- */

const CLOUD_FRONT = "#ccd7e2";
const CLOUD_BACK = "#a3b3c2";
const SUN_FILL = "#f6bb41";
const SUN_HI = "#f9d77e";
const MOON_FILL = "#ece6d2";
const RAIN_FILL = "#6aa8dd";
const SNOW_FILL = "#d7e7f4";
const BOLT_FILL = "#f7cd45";
const FOG_FILL = "#c3ced6";

function sunRays(cx, cy) {
  let lines = "";
  for (let a = 0; a < 360; a += 45) {
    lines += `<line x1="${cx}" y1="${cy - 33}" x2="${cx}" y2="${cy - 23}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  return `<g class="rays" stroke="${SUN_FILL}" stroke-width="5.5" stroke-linecap="round">${lines}</g>`;
}

function sunBody(cx, cy, r) {
  return `<circle class="sun-core" cx="${cx}" cy="${cy}" r="${r}" fill="${SUN_FILL}"/>
          <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.28}" r="${r * 0.42}" fill="${SUN_HI}" opacity="0.85"/>`;
}

function moonBody(cx, cy, scale) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <path fill-rule="evenodd" fill="${MOON_FILL}"
      d="M -26 0 a 26 26 0 1 1 52 0 a 26 26 0 1 1 -52 0 z
         M -11 -9 a 21 21 0 1 1 42 0 a 21 21 0 1 1 -42 0 z"/>
  </g>`;
}

function star(x, y, s, cls) {
  return `<path class="${cls}" transform="translate(${x} ${y}) scale(${s})" fill="${MOON_FILL}"
    d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z"/>`;
}

function cloudGroup(cls, fill, tx, ty, s) {
  return `<g class="${cls}" transform="translate(${tx} ${ty}) scale(${s})" fill="${fill}">
    <circle cx="36" cy="50" r="15"/>
    <circle cx="55" cy="40" r="20"/>
    <circle cx="70" cy="52" r="13"/>
    <rect x="26" y="48" width="56" height="20" rx="10"/>
  </g>`;
}

function rainDrops(kind) {
  if (kind === "drizzle") {
    return `<g stroke="${RAIN_FILL}" stroke-width="3.4" stroke-linecap="round">
      <line class="drop" x1="38" y1="76" x2="36.5" y2="81.5"/>
      <line class="drop d2" x1="52" y1="76" x2="50.5" y2="81.5"/>
      <line class="drop d3" x1="66" y1="76" x2="64.5" y2="81.5"/>
    </g>`;
  }
  return `<g stroke="${RAIN_FILL}" stroke-width="4.6" stroke-linecap="round">
    <line class="drop" x1="38" y1="74" x2="35" y2="84"/>
    <line class="drop d2" x1="52" y1="74" x2="49" y2="84"/>
    <line class="drop d3" x1="66" y1="74" x2="63" y2="84"/>
  </g>`;
}

function snowFlakes() {
  return `<g fill="${SNOW_FILL}">
    <circle class="flake" cx="38" cy="78" r="3.4"/>
    <circle class="flake f2" cx="52" cy="80" r="3.4"/>
    <circle class="flake f3" cx="66" cy="77" r="3.4"/>
  </g>`;
}

function bolt() {
  return `<path class="bolt" fill="${BOLT_FILL}" d="M55 60 L40 82 h9.5 L45 100 L65 74 h-10.5 L61 60 Z"/>`;
}

function fogLines() {
  return `<g stroke="${FOG_FILL}" stroke-width="5" stroke-linecap="round">
    <line class="fog-line" x1="28" y1="80" x2="72" y2="80"/>
    <line class="fog-line l2" x1="36" y1="90" x2="78" y2="90"/>
    <line class="fog-line l3" x1="24" y1="90" x2="34" y2="90" opacity="0"/>
  </g>`;
}

const ICON_BUILDERS = {
  "clear-day": () => sunRays(50, 50) + sunBody(50, 50, 20),
  "clear-night": () =>
    moonBody(48, 46, 1) + star(74, 26, 1, "moon-star") + star(64, 64, 0.7, "moon-star s2") + star(24, 20, 0.6, "moon-star s2"),
  "partly-cloudy-day": () =>
    `<g transform="translate(16 12) scale(0.6)">${sunRays(50, 50)}${sunBody(50, 50, 20)}</g>` +
    cloudGroup("cloud-drift", CLOUD_FRONT, 14, 26, 1),
  "partly-cloudy-night": () =>
    moonBody(36, 30, 0.72) + star(72, 20, 0.7, "moon-star") + cloudGroup("cloud-drift", CLOUD_FRONT, 14, 28, 1),
  "cloudy": () =>
    cloudGroup("cloud-drift-slow", CLOUD_BACK, 6, -2, 0.72) + cloudGroup("cloud-drift", CLOUD_FRONT, 8, 20, 1),
  "drizzle": () => cloudGroup("cloud-drift", CLOUD_FRONT, 4, 8, 1) + rainDrops("drizzle"),
  "rain": () => cloudGroup("cloud-drift", CLOUD_FRONT, 4, 6, 1) + rainDrops("rain"),
  "thunderstorm": () =>
    cloudGroup("cloud-drift", CLOUD_FRONT, 4, 2, 1) + bolt() +
    `<g stroke="${RAIN_FILL}" stroke-width="4.6" stroke-linecap="round"><line class="drop d2" x1="72" y1="72" x2="69" y2="82"/></g>`,
  "snow": () => cloudGroup("cloud-drift", CLOUD_FRONT, 4, 6, 1) + snowFlakes(),
  "fog": () => cloudGroup("cloud-drift", CLOUD_FRONT, 4, -2, 0.94) + fogLines(),
  "wind": () => `<g fill="none" stroke="${FOG_FILL}" stroke-width="6" stroke-linecap="round">
      <path class="gust" d="M16 36 H60 a10 10 0 1 0 -10 -10"/>
      <path class="gust g2" d="M16 54 H74"/>
      <path class="gust" d="M16 72 H56 a10 10 0 1 1 -10 10"/>
    </g>`,
};

const COND_LABELS = {
  "clear-day": "Clear",
  "clear-night": "Clear",
  "partly-cloudy-day": "Partly cloudy",
  "partly-cloudy-night": "Partly cloudy",
  "cloudy": "Overcast",
  "drizzle": "Light drizzle",
  "rain": "Rain",
  "thunderstorm": "Thunderstorms",
  "snow": "Snow",
  "fog": "Fog",
  "wind": "Windy",
};

function wxIcon(cond) {
  const build = ICON_BUILDERS[cond] || ICON_BUILDERS["cloudy"];
  return `<svg class="wx" viewBox="0 0 100 100" role="img" aria-label="${COND_LABELS[cond] || cond}">${build()}</svg>`;
}

/* ---------- Small stroke icons (UI) ---------- */

function uiIcon(name, size) {
  const paths = {
    wind: '<path d="M3 8h9a3 3 0 1 0-3-3"/><path d="M3 12h13a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
    drop: '<path d="M12 3.5s6 6.6 6 11a6 6 0 1 1-12 0c0-4.4 6-11 6-11Z"/>',
    uv: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    gauge: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l3.8-3.8"/>',
    eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    sunrise: '<path d="M6 16.5a6 6 0 0 1 12 0"/><path d="M12 4v5M9.5 6.5 12 4l2.5 2.5"/><path d="M3 20.5h18"/>',
    sunset: '<path d="M6 16.5a6 6 0 0 1 12 0"/><path d="M12 9V4M9.5 6.5 12 9l2.5-2.5"/><path d="M3 20.5h18"/>',
    thermo: '<path d="M10 13.5V4a2 2 0 1 1 4 0v9.5a4.5 4.5 0 1 1-4 0Z"/>',
    umbrella: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z"/><path d="M12 12v6.5a2.5 2.5 0 0 0 5 0"/>',
    leaf: '<path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15Z"/><path d="M5 19c3.5-6 7.5-9.5 11-11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  };
  return `<svg viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
}

/* ---------- Simulated data ---------- */
/* timeline: 24 entries indexed by local clock hour.
   c clear-day, n clear-night, p partly-day, m partly-night,
   o cloudy, z drizzle, r rain, t thunderstorm, s snow, f fog, w wind */
const CODE_TO_COND = {
  c: "clear-day", n: "clear-night", p: "partly-cloudy-day", m: "partly-cloudy-night",
  o: "cloudy", z: "drizzle", r: "rain", t: "thunderstorm", s: "snow", f: "fog", w: "wind",
};

const CITIES = [
  {
    id: "sf",
    name: "San Francisco",
    region: "California, United States",
    tz: "America/Los_Angeles",
    seed: 11,
    cycle: { avg: 16.5, amp: 4.5 },
    timelineStr: "ffffffffopppppcccppmmmff",
    daily: [
      { hi: 21, lo: 13, cond: "partly-cloudy-day", pop: 10, mm: 0 },
      { hi: 22, lo: 13, cond: "clear-day", pop: 0, mm: 0 },
      { hi: 23, lo: 14, cond: "clear-day", pop: 0, mm: 0 },
      { hi: 22, lo: 14, cond: "partly-cloudy-day", pop: 10, mm: 0 },
      { hi: 20, lo: 13, cond: "cloudy", pop: 20, mm: 0 },
      { hi: 19, lo: 12, cond: "drizzle", pop: 40, mm: 0.8 },
      { hi: 20, lo: 12, cond: "partly-cloudy-day", pop: 20, mm: 0 },
    ],
    details: { windKmh: 18, windDeg: 250, gustKmh: 29, humidity: 74, dewC: 12, uv: 5,
      pressure: 1017, pressureTrend: 0, visKm: 14, aqi: 35, precipMm: 0, pop: 10 },
    sun: { rise: "6:52", set: "19:28" },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    region: "Kantō, Japan",
    tz: "Asia/Tokyo",
    seed: 23,
    cycle: { avg: 24, amp: 3 },
    timelineStr: "rrrrzzzzrrtttrrrrrzzrrrr",
    daily: [
      { hi: 26, lo: 22, cond: "thunderstorm", pop: 90, mm: 35 },
      { hi: 27, lo: 22, cond: "rain", pop: 80, mm: 18 },
      { hi: 28, lo: 23, cond: "partly-cloudy-day", pop: 40, mm: 4 },
      { hi: 29, lo: 23, cond: "clear-day", pop: 20, mm: 0 },
      { hi: 30, lo: 24, cond: "clear-day", pop: 10, mm: 0 },
      { hi: 29, lo: 24, cond: "partly-cloudy-day", pop: 30, mm: 0 },
      { hi: 27, lo: 23, cond: "rain", pop: 60, mm: 9 },
    ],
    details: { windKmh: 26, windDeg: 140, gustKmh: 44, humidity: 88, dewC: 22, uv: 2,
      pressure: 1002, pressureTrend: -1, visKm: 6, aqi: 28, precipMm: 12.4, pop: 90 },
    sun: { rise: "5:22", set: "17:52" },
  },
  {
    id: "london",
    name: "London",
    region: "England, United Kingdom",
    tz: "Europe/London",
    seed: 37,
    cycle: { avg: 14, amp: 3.5 },
    timelineStr: "ooooozzooozzoooooozzoooo",
    daily: [
      { hi: 17, lo: 11, cond: "cloudy", pop: 30, mm: 1 },
      { hi: 18, lo: 11, cond: "drizzle", pop: 45, mm: 2 },
      { hi: 16, lo: 10, cond: "rain", pop: 65, mm: 6 },
      { hi: 15, lo: 9, cond: "partly-cloudy-day", pop: 25, mm: 0 },
      { hi: 16, lo: 9, cond: "partly-cloudy-day", pop: 20, mm: 0 },
      { hi: 17, lo: 10, cond: "cloudy", pop: 35, mm: 0 },
      { hi: 16, lo: 10, cond: "drizzle", pop: 40, mm: 1 },
    ],
    details: { windKmh: 22, windDeg: 230, gustKmh: 38, humidity: 81, dewC: 11, uv: 2,
      pressure: 1009, pressureTrend: 1, visKm: 9, aqi: 22, precipMm: 0.6, pop: 30 },
    sun: { rise: "6:28", set: "19:24" },
  },
  {
    id: "sydney",
    name: "Sydney",
    region: "New South Wales, Australia",
    tz: "Australia/Sydney",
    seed: 51,
    cycle: { avg: 19, amp: 5 },
    timelineStr: "nnnnnnnppcccccccccpmmnnn",
    daily: [
      { hi: 24, lo: 13, cond: "clear-day", pop: 0, mm: 0 },
      { hi: 25, lo: 14, cond: "clear-day", pop: 0, mm: 0 },
      { hi: 23, lo: 14, cond: "partly-cloudy-day", pop: 10, mm: 0 },
      { hi: 21, lo: 13, cond: "cloudy", pop: 30, mm: 0 },
      { hi: 20, lo: 12, cond: "drizzle", pop: 35, mm: 1 },
      { hi: 22, lo: 12, cond: "partly-cloudy-day", pop: 15, mm: 0 },
      { hi: 24, lo: 13, cond: "clear-day", pop: 5, mm: 0 },
    ],
    details: { windKmh: 14, windDeg: 315, gustKmh: 22, humidity: 52, dewC: 8, uv: 7,
      pressure: 1021, pressureTrend: 0, visKm: 24, aqi: 18, precipMm: 0, pop: 0 },
    sun: { rise: "5:56", set: "17:44" },
  },
  {
    id: "reykjavik",
    name: "Reykjavík",
    region: "Capital Region, Iceland",
    tz: "Atlantic/Reykjavik",
    seed: 67,
    cycle: { avg: 3, amp: 2.5 },
    timelineStr: "sssssoosssoosssooossssss",
    daily: [
      { hi: 5, lo: -1, cond: "snow", pop: 70, mm: 4 },
      { hi: 4, lo: -2, cond: "snow", pop: 60, mm: 3 },
      { hi: 3, lo: -3, cond: "cloudy", pop: 40, mm: 0 },
      { hi: 4, lo: -2, cond: "partly-cloudy-day", pop: 30, mm: 0 },
      { hi: 2, lo: -4, cond: "clear-day", pop: 20, mm: 0 },
      { hi: 1, lo: -4, cond: "clear-day", pop: 15, mm: 0 },
      { hi: 3, lo: -2, cond: "snow", pop: 50, mm: 2 },
    ],
    details: { windKmh: 41, windDeg: 20, gustKmh: 63, humidity: 76, dewC: -2, uv: 1,
      pressure: 995, pressureTrend: 1, visKm: 3, aqi: 12, precipMm: 2.4, pop: 70 },
    sun: { rise: "6:37", set: "20:12" },
  },
];

/* ---------- State ---------- */

const STORE_KEY = "atmos.state.v1";

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveStore(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function initState() {
  const params = new URLSearchParams(location.search);
  const stored = loadStore();
  const cityIds = CITIES.map((c) => c.id);
  let city = params.get("city") || stored.city || "sf";
  if (!cityIds.includes(city)) city = "sf";
  let units = (params.get("units") || stored.units || "c").toLowerCase();
  if (units !== "c" && units !== "f") units = "c";
  let theme = (params.get("theme") || stored.theme || "").toLowerCase();
  if (theme !== "dark" && theme !== "light") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return { city, units, theme };
}

let state = initState();

function syncUrl() {
  const p = new URLSearchParams({ city: state.city, units: state.units, theme: state.theme });
  history.replaceState(null, "", location.pathname + "?" + p.toString());
}

/* ---------- Helpers ---------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cityById(id) { return CITIES.find((c) => c.id === id); }

function timeline(city) { return city.timelineStr.split("").map((c) => CODE_TO_COND[c] || "cloudy"); }

function cityDate(tz) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

function cityHour(tz) { return cityDate(tz).getHours(); }

function fmtClock(tz) {
  const d = cityDate(tz);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} · ${hh}:${mm}`;
}

function hourLabel(h) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtTemp(c) {
  const v = state.units === "f" ? c * 9 / 5 + 32 : c;
  return Math.round(v);
}
function unitDeg() { return state.units === "f" ? "°F" : "°C"; }
function fmtSpeed(kmh) {
  return state.units === "f" ? `${Math.round(kmh * 0.6214)} mph` : `${Math.round(kmh)} km/h`;
}
function fmtVis(km) {
  return state.units === "f" ? `${(km * 0.6214).toFixed(km >= 16 ? 0 : 1)} mi` : `${Math.round(km)} km`;
}
function fmtPressure(hpa) {
  return state.units === "f" ? `${(hpa * 0.02953).toFixed(2)} inHg` : `${Math.round(hpa)} hPa`;
}
function fmtPrecip(mm) {
  if (state.units === "f") return mm === 0 ? "0 in" : `${(mm / 25.4).toFixed(2)} in`;
  return mm === 0 ? "0 mm" : `${mm % 1 === 0 ? mm : mm.toFixed(1)} mm`;
}

function compass16(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function uvInfo(uv) {
  if (uv <= 2) return { label: "Low", color: "#4db56a", level: 0 };
  if (uv <= 5) return { label: "Moderate", color: "#f0c93f", level: 1 };
  if (uv <= 7) return { label: "High", color: "#ef9638", level: 2 };
  if (uv <= 10) return { label: "Very high", color: "#e05b4b", level: 3 };
  return { label: "Extreme", color: "#a55bd6", level: 4 };
}

function aqiInfo(aqi) {
  if (aqi <= 50) return { label: "Good", level: 0 };
  if (aqi <= 100) return { label: "Moderate", level: 1 };
  if (aqi <= 150) return { label: "Unhealthy for some", level: 2 };
  if (aqi <= 200) return { label: "Unhealthy", level: 3 };
  return { label: "Very unhealthy", level: 4 };
}

function visLabel(km) {
  if (km >= 20) return "Excellent";
  if (km >= 10) return "Clear";
  if (km >= 5) return "Moderate";
  return "Poor";
}

/* hourly series for the selected city, anchored to its local hour */
function hourlySeries(city) {
  const rand = mulberry32(city.seed * 1000); // deterministic per city
  const tl = timeline(city);
  const nowH = cityHour(city.tz);
  const out = [];
  for (let i = 0; i < 24; i++) {
    const h = (nowH + i) % 24;
    const wave = Math.cos(((h - 15) / 24) * 2 * Math.PI);
    const jitter = (rand() - 0.5) * 1.6;
    const temp = city.cycle.avg + city.cycle.amp * wave + jitter;
    const cond = tl[h];
    const wet = { rain: 70, thunderstorm: 90, drizzle: 45, snow: 65 };
    const pop = wet[cond] ? wet[cond] + Math.round((rand() - 0.5) * 20) : Math.round(rand() * 12);
    out.push({ h, temp, cond, pop: Math.max(0, Math.min(100, pop)) });
  }
  // soften the current hour toward today's hi/lo midpoint so hero matches
  const d0 = city.daily[0];
  out[0].temp = Math.max(d0.lo + 1, Math.min(d0.hi - 0.5, out[0].temp));
  return out;
}

/* Catmull-Rom → cubic Bézier smoothing */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1), c1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
    const c2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1), c2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/* ---------- Renderers ---------- */

const COL_W = 68;
const COL_H = 196;
const TRACK_PAD_X = 8;
const TRACK_PAD_TOP = 12;
const CURVE_TOP = 84;   // column-local y of warmest point
const CURVE_BOT = 158;  // column-local y of coolest point

function renderTabs() {
  const nav = document.getElementById("cityTabs");
  nav.innerHTML = CITIES.map((c) =>
    `<button type="button" role="tab" data-city="${c.id}" aria-selected="${c.id === state.city}">${c.name}</button>`
  ).join("");
  nav.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { state.city = b.dataset.city; saveStore(state); syncUrl(); renderAll(); })
  );
}

function renderHero(city, series) {
  const now = series[0];
  const d0 = city.daily[0];
  const det = city.details;
  const hero = document.getElementById("hero");
  hero.className = `card hero cond-${now.cond}`;

  document.getElementById("heroCity").textContent = city.name;
  document.getElementById("heroRegion").textContent = city.region;
  document.getElementById("heroIcon").innerHTML = wxIcon(now.cond);
  document.getElementById("heroTemp").textContent = fmtTemp(now.temp);
  document.getElementById("heroDeg").textContent = unitDeg();
  document.getElementById("heroCond").textContent = COND_LABELS[now.cond];
  const feels = now.temp + ({ rain: -1.5, thunderstorm: -1, drizzle: -1, snow: -3, fog: -0.5, wind: -2 }[now.cond] || 0)
    + (det.windKmh > 30 ? -1.5 : 0) + (det.humidity > 80 && now.temp > 24 ? 1.5 : 0);
  document.getElementById("heroFeels").textContent = `Feels like ${fmtTemp(feels)}°`;
  document.getElementById("heroHigh").textContent = `H: ${fmtTemp(d0.hi)}°`;
  document.getElementById("heroLow").textContent = `L: ${fmtTemp(d0.lo)}°`;

  const chips = [
    ["thermo", `Feels ${fmtTemp(feels)}°`],
    ["wind", `${fmtSpeed(det.windKmh)} ${compass16(det.windDeg)}`],
    ["drop", `${det.humidity}% humidity`],
    ["uv", `UV ${det.uv} · ${uvInfo(det.uv).label}`],
    ["umbrella", `${det.pop}% precip`],
  ];
  document.getElementById("heroChips").innerHTML = chips
    .map(([ic, txt]) => `<li>${uiIcon(ic, 15)}<span>${txt}</span></li>`).join("");
  document.getElementById("heroUpdated").textContent = "Updated 5 min ago";
}

function renderClock(city) {
  document.getElementById("heroClock").textContent = fmtClock(city.tz) + " local";
}

function renderHourly(city, series) {
  const temps = series.map((s) => s.temp);
  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  const span = Math.max(2, tMax - tMin);
  const yFor = (t) => CURVE_TOP + (1 - (t - tMin) / span) * (CURVE_BOT - CURVE_TOP);

  const trackW = TRACK_PAD_X * 2 + COL_W * series.length;
  const trackH = TRACK_PAD_TOP + COL_H + 10;

  const pts = series.map((s, i) => ({
    x: TRACK_PAD_X + COL_W * i + COL_W / 2,
    y: TRACK_PAD_TOP + yFor(s.temp),
  }));

  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${trackH - 6} L ${pts[0].x} ${trackH - 6} Z`;

  const svg = `<svg class="hourly-curve" width="${trackW}" height="${trackH}" viewBox="0 0 ${trackW} ${trackH}" aria-hidden="true">
    <defs>
      <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--accent)" stop-opacity="0.20"/>
        <stop offset="1" style="stop-color:var(--accent)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path class="carea" d="${area}"/>
    <path class="cline" d="${line}"/>
    ${pts.map((p) => `<circle class="dot" cx="${p.x}" cy="${p.y}" r="3"/>`).join("")}
  </svg>`;

  const cols = series.map((s, i) => {
    const labelTop = yFor(s.temp) - 30;
    const isNow = i === 0;
    return `<div class="h-col">
      <span class="h-time${isNow ? " now" : ""}">${isNow ? "Now" : hourLabel(s.h)}</span>
      <span class="h-icon">${wxIcon(s.cond)}</span>
      <span class="h-temp" style="top:${labelTop.toFixed(1)}px">${fmtTemp(s.temp)}°</span>
      <span class="h-precip${s.pop < 20 ? " zero" : ""}">${s.pop}%</span>
    </div>`;
  }).join("");

  const track = document.getElementById("hourlyTrack");
  track.innerHTML = svg + `<div class="hour-cols">${cols}</div>`;
  document.getElementById("hourlySub").textContent = `Next 24 hours · until ${hourLabel(series[series.length - 1].h)}`;
  document.getElementById("hourlyScroll").scrollLeft = 0;
}

function renderDaily(city, series) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const base = cityDate(city.tz);
  const weekLo = Math.min(...city.daily.map((d) => d.lo));
  const weekHi = Math.max(...city.daily.map((d) => d.hi));
  const span = Math.max(1, weekHi - weekLo);
  const nowTemp = series[0].temp;

  const rows = city.daily.map((d, i) => {
    const date = new Date(base.getTime() + i * 86400000);
    const name = i === 0 ? "Today" : days[date.getDay()];
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const left = ((d.lo - weekLo) / span) * 100;
    const width = Math.max(6, ((d.hi - d.lo) / span) * 100);
    const showDot = i === 0 && nowTemp >= d.lo && nowTemp <= d.hi;
    const dotLeft = showDot ? ((nowTemp - weekLo) / span) * 100 : 0;
    return `<li class="d-row">
      <span class="d-day">${name}<span class="d-date">${dateStr}</span></span>
      <span class="d-icon">${wxIcon(d.cond)}</span>
      <span class="d-precip${d.pop < 20 ? " zero" : ""}">${uiIcon("drop", 11)}${d.pop}%</span>
      <span class="d-temp lo">${fmtTemp(d.lo)}°</span>
      <span class="d-range">
        <span class="d-range-fill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span>
        ${showDot ? `<span class="d-range-dot" style="left:${dotLeft.toFixed(1)}%"></span>` : ""}
      </span>
      <span class="d-temp">${fmtTemp(d.hi)}°</span>
    </li>`;
  }).join("");

  document.getElementById("dailyList").innerHTML = rows;
  document.getElementById("dailySub").textContent = `Week range ${fmtTemp(weekLo)}° – ${fmtTemp(weekHi)}°`;
}

/* ----- detail tiles ----- */

function compassSvg(deg) {
  const letters = [["N", 38, 9], ["E", 68, 41], ["S", 38, 73], ["W", 8, 41]];
  return `<svg class="compass" viewBox="0 0 76 76" aria-hidden="true">
    <circle class="dial" cx="38" cy="38" r="30"/>
    ${letters.map(([t, x, y]) => `<text class="card-letter" x="${x}" y="${y}" text-anchor="middle">${t}</text>`).join("")}
    <g transform="rotate(${deg} 38 38)">
      <path class="needle" d="M38 15 L42.5 40 L38 35.5 L33.5 40 Z"/>
    </g>
    <circle class="hub" cx="38" cy="38" r="3.4"/>
  </svg>`;
}

function gaugeSvg(frac, color) {
  const len = Math.PI * 44;
  const angle = Math.PI * (1 - Math.min(1, Math.max(0, frac)));
  const nx = 54 + 34 * Math.cos(angle), ny = 56 - 34 * Math.sin(angle);
  return `<svg class="gauge" viewBox="0 0 108 62" aria-hidden="true">
    <path class="arc-bg" d="M 10 56 A 44 44 0 0 1 98 56"/>
    <path class="arc-val" d="M 10 56 A 44 44 0 0 1 98 56" stroke="${color}"
      stroke-dasharray="${(frac * len).toFixed(1)} ${len.toFixed(1)}"/>
    <line class="needle" x1="54" y1="56" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"/>
    <circle class="needle-hub" cx="54" cy="56" r="3"/>
  </svg>`;
}

function sunArcSvg(city) {
  const rise = toMinutes(city.sun.rise);
  const set = toMinutes(city.sun.set);
  const nowD = cityDate(city.tz);
  const nowM = nowD.getHours() * 60 + nowD.getMinutes();
  const frac = Math.max(0, Math.min(1, (nowM - rise) / (set - rise)));
  const day = nowM >= rise && nowM <= set;
  const a = Math.PI * (1 - frac);
  const x = 100 + 70 * Math.cos(a), y = 92 - 70 * Math.sin(a);
  const daylightH = Math.floor((set - rise) / 60), daylightM = (set - rise) % 60;
  return {
    dayLength: `${daylightH}h ${String(daylightM).padStart(2, "0")}m`,
    day,
    svg: `<svg class="sun-arc" viewBox="0 0 200 104" aria-hidden="true">
      <line class="horizon" x1="8" y1="92" x2="192" y2="92"/>
      <path class="path" d="M 30 92 A 70 70 0 0 1 170 92"/>
      ${day ? `<path class="path-done" d="M 30 92 A 70 70 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}"/>` : ""}
      ${day ? `<circle class="sun-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5"/>` : ""}
    </svg>`,
  };
}

function renderDetails(city, series) {
  const det = city.details;
  const uv = uvInfo(det.uv);
  const aqi = aqiInfo(det.aqi);
  const sun = sunArcSvg(city);
  const trend = det.pressureTrend > 0 ? ["arrowUp", "Rising"] : det.pressureTrend < 0 ? ["arrowDown", "Falling"] : ["clock", "Steady"];

  const popBars = [];
  for (let i = 0; i < 8; i++) {
    const s = series[Math.min(series.length - 1, i * 3)];
    popBars.push(`<span style="height:${Math.max(7, s.pop * 0.44).toFixed(0)}px" title="${s.pop}%"></span>`);
  }

  const tiles = [
    `<div class="tile">
      <div class="tile-label">${uiIcon("wind", 13)}Wind</div>
      <div class="tile-value">${fmtSpeed(det.windKmh).replace(" ", '<span class="unit">') + "</span>"}</div>
      <div class="tile-sub">${compass16(det.windDeg)} · gusts ${fmtSpeed(det.gustKmh)}</div>
      <div class="tile-viz">${compassSvg(det.windDeg)}</div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("drop", 13)}Humidity</div>
      <div class="tile-value">${det.humidity}<span class="unit">%</span></div>
      <div class="tile-sub">Dew point ${fmtTemp(det.dewC)}°</div>
      <div class="tile-viz" style="display:block">
        <div class="bar-track"><div class="bar-fill" style="width:${det.humidity}%;background:#4d8ecb"></div></div>
      </div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("uv", 13)}UV index</div>
      <div class="tile-value">${det.uv}<span class="unit">${uv.label}</span></div>
      <div class="tile-sub">${uv.level === 0 ? "No protection needed" : uv.level === 1 ? "Protection advised midday" : "Protection essential"}</div>
      <div class="tile-viz">${gaugeSvg(det.uv / 11, uv.color)}</div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("gauge", 13)}Pressure</div>
      <div class="tile-value">${fmtPressure(det.pressure).replace(/^([\d.]+)(.*)$/, (m, n, u) => `${n}<span class="unit">${u.trim()}</span>`)}</div>
      <div class="tile-sub" style="display:flex;align-items:center;gap:4px">${uiIcon(trend[0], 13)}${trend[1]}</div>
      <div class="tile-viz">${gaugeSvg((det.pressure - 980) / 60, "var(--accent)")}</div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("eye", 13)}Visibility</div>
      <div class="tile-value">${fmtVis(det.visKm).replace(/^([\d.]+)(.*)$/, (m, n, u) => `${n}<span class="unit">${u.trim()}</span>`)}</div>
      <div class="tile-sub">${visLabel(det.visKm)}</div>
      <div class="tile-viz" style="display:block">
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, det.visKm / 30 * 100).toFixed(0)}%;background:#7ba5c9"></div></div>
      </div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("leaf", 13)}Air quality</div>
      <div class="tile-value">${det.aqi}<span class="aqi-pill aqi-${aqi.level}">${aqi.label}</span></div>
      <div class="tile-sub">US AQI · primary PM2.5</div>
      <div class="tile-viz" style="display:block">
        <div class="aqi-scale">${[0, 1, 2, 3, 4].map((i) => `<span class="${i <= aqi.level ? "on-" + i : ""}"></span>`).join("")}</div>
      </div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("sunrise", 13)}Sunrise &amp; sunset</div>
      <div class="tile-viz" style="flex-direction:column;gap:3px">
        ${sun.svg}
        <div class="sun-times">
          <div class="st"><span>Sunrise</span><strong>${city.sun.rise}</strong></div>
          <div class="st"><span>Sunset</span><strong>${city.sun.set}</strong></div>
        </div>
      </div>
      <div class="tile-sub" style="margin-top:7px">${sun.day ? `Daylight ${sun.dayLength}` : `Night · day ${sun.dayLength}`}</div>
    </div>`,
    `<div class="tile">
      <div class="tile-label">${uiIcon("umbrella", 13)}Precipitation</div>
      <div class="tile-value">${fmtPrecip(det.precipMm).replace(/^([\d.]+)(.*)$/, (m, n, u) => `${n}<span class="unit">${u.trim() || (state.units === "f" ? "in" : "mm")}</span>`)}</div>
      <div class="tile-sub">Last 24h · ${det.pop}% chance</div>
      <div class="precip-bars">${popBars.join("")}</div>
    </div>`,
  ];

  document.getElementById("detailsGrid").innerHTML = tiles.join("");
}

/* ---------- Controls ---------- */

function renderControls() {
  document.documentElement.dataset.theme = state.theme;
  const tt = document.getElementById("themeToggle");
  tt.setAttribute("aria-pressed", String(state.theme === "dark"));
  document.getElementById("unitC").setAttribute("aria-pressed", String(state.units === "c"));
  document.getElementById("unitF").setAttribute("aria-pressed", String(state.units === "f"));
  document.querySelectorAll("#cityTabs button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.city === state.city)));
}

function renderAll() {
  const city = cityById(state.city);
  const series = hourlySeries(city);
  renderControls();
  renderTabs();
  renderHero(city, series);
  renderClock(city);
  renderHourly(city, series);
  renderDaily(city, series);
  renderDetails(city, series);
  document.title = `${city.name} · Atmos Weather`;
}

/* ---------- Events ---------- */

document.getElementById("unitC").addEventListener("click", () => {
  state.units = "c"; saveStore(state); syncUrl(); renderAll();
});
document.getElementById("unitF").addEventListener("click", () => {
  state.units = "f"; saveStore(state); syncUrl(); renderAll();
});
document.getElementById("themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveStore(state); syncUrl(); renderControls();
});

let clockTimer = null;
function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(() => renderClock(cityById(state.city)), 30000);
}

renderAll();
startClock();

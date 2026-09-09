#!/usr/bin/env node
/**
 * run-tests.js — unit tests for the pure logic (no browser required).
 *
 *   node run-tests.js
 *
 * Covers the WMO mapping, unit conversion, formatting helpers, timezone
 * parsing, the solar model and the offline simulation. Browser-side checks
 * (rendering, contrast, interaction) live in tools/.
 */
'use strict';

/* Load the browser scripts into a shared global so their IIFEs attach to it. */
global.window = global;
require('./js/weather.js');
require('./js/charts.js');
require('./js/api.js');

const WX = global.WX, Api = global.WXApi, Chart = global.WXChart;

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail ? '  — ' + detail : '')); }
}
function eq(name, actual, expected, tol) {
  const good = tol == null ? actual === expected : Math.abs(actual - expected) <= tol;
  ok(name, good, good ? null : `got ${actual}, expected ${expected}${tol ? ' ±' + tol : ''}`);
}
function near(name, actual, expected, tol) { eq(name, actual, expected, tol); }
function group(title) { console.log('\n' + title); }

/* ── WMO codes ────────────────────────────────────────────────────────── */
group('WMO weather codes');
eq('0 is clear', WX.describe(0).label, 'Clear sky');
eq('0 maps to the clear glyph', WX.describe(0).kind, 'clear');
eq('3 is overcast', WX.describe(3).label, 'Overcast');
eq('65 is heavy rain', WX.describe(65).label, 'Heavy rain');
eq('75 is heavy snow', WX.describe(75).kind, 'snow');
eq('95 is a thunderstorm', WX.describe(95).group, 'storm');
eq('unknown code falls back safely', WX.describe(1234).label, 'Unknown');
eq('sky: clear day', WX.skyState(0, true), 'clear-day');
eq('sky: clear night', WX.skyState(0, false), 'clear-night');
eq('sky: partly cloudy night', WX.skyState(2, false), 'partly-night');
eq('sky: overcast night', WX.skyState(3, false), 'cloudy-night');
eq('sky: rain', WX.skyState(63, true), 'rain');
eq('sky: snow', WX.skyState(73, true), 'snow');
eq('sky: fog', WX.skyState(45, true), 'fog');
eq('sky: storm', WX.skyState(96, true), 'storm');

/* ── Units ────────────────────────────────────────────────────────────── */
group('Unit conversion');
eq('0 °C = 32 °F', WX.c2f(0), 32, 1e-9);
eq('100 °C = 212 °F', WX.c2f(100), 212, 1e-9);
eq('32 °F = 0 °C', WX.f2c(32), 0, 1e-9);
eq('temp() passes C through', WX.temp(20, 'C'), 20);
eq('temp() converts to F', WX.temp(20, 'F'), 68, 1e-9);
eq('100 km/h = 62.137 mph', WX.speed(100, 'F'), 62.1371, 1e-3);
eq('25.4 mm = 1 in', WX.precip(25.4, 'F'), 1, 1e-9);
eq('1609.344 m = 1 mi', WX.distance(1609.344, 'F'), 1, 1e-9);
eq('1000 m = 1 km', WX.distance(1000, 'C'), 1, 1e-9);
eq('speed unit label', WX.speedUnit('F'), 'mph');
eq('distance unit label', WX.distanceUnit('C'), 'km');
eq('tempText rounds', WX.tempText(21.6, 'C'), '22');
eq('tempText handles null', WX.tempText(null, 'C'), '—');
eq('tempText1 keeps a decimal', WX.tempText1(21.64, 'C'), '21.6');
eq('round(1.236, 2)', WX.round(1.236, 2), 1.24, 1e-9);

/* ── Wind ─────────────────────────────────────────────────────────────── */
group('Wind');
eq('0° is N', WX.windDir(0), 'N');
eq('90° is E', WX.windDir(90), 'E');
eq('180° is S', WX.windDir(180), 'S');
eq('270° is W', WX.windDir(270), 'W');
eq('348° wraps to NNW', WX.windDir(348), 'NNW');
eq('359° is N', WX.windDir(359), 'N');
eq('-10° is N', WX.windDir(-10), 'N');
eq('calm at 0 km/h', WX.windLabel(0), 'Calm');
eq('gale at 70 km/h', WX.windLabel(70), 'Gale');
ok('null direction is safe', WX.windDir(null) === '—');

/* ── AQI / UV / notes ─────────────────────────────────────────────────── */
group('Air quality and UV bands');
eq('AQI 20 is Good', WX.aqi(20).label, 'Good');
eq('AQI 75 is Moderate', WX.aqi(75).label, 'Moderate');
eq('AQI 175 is Unhealthy', WX.aqi(175).label, 'Unhealthy');
eq('AQI 400 is Hazardous', WX.aqi(400).label, 'Hazardous');
eq('UV 1 is Low', WX.uv(1).label, 'Low');
eq('UV 4 is Moderate', WX.uv(4).label, 'Moderate');
eq('UV 6 is High', WX.uv(6).label, 'High');
eq('UV 9 is Very high', WX.uv(9).label, 'Very high');
eq('UV 11 is Extreme', WX.uv(11).label, 'Extreme');
eq('pressure 1012 is Normal', WX.pressureNote(1012, 0), 'Normal · steady');
eq('pressure rising', WX.pressureNote(1015, 2), 'Normal · rising');
eq('pressure falling', WX.pressureNote(995, -3), 'Low · falling');
eq('visibility 500 m is Fog', WX.visibilityNote(500), 'Fog');
eq('humidity 30%', WX.humidityNote(30), 'Dry air');
eq('dew point 22 is muggy', WX.dewNote(22), 'Muggy');
eq('dew point 25 is oppressive', WX.dewNote(25), 'Oppressive');
ok('precipNote(0)', WX.precipNote(0) === 'No precipitation');

/* ── Dew point maths ──────────────────────────────────────────────────── */
group('Dew point (Magnus)');
near('20 °C / 50 % ≈ 9.3 °C', WX.dewPoint(20, 50), 9.3, 0.4);
near('30 °C / 80 % ≈ 26.2 °C', WX.dewPoint(30, 80), 26.2, 0.4);
near('dew point = temp at 100 % RH', WX.dewPoint(15, 100), 15, 0.1);
ok('dewPoint(null) is null', WX.dewPoint(null, 50) === null);

/* ── Timezone parsing — the regression that matters most ──────────────── */
group('Local time parsing (regression)');
const SH_OFF = 8 * 3600;
eq('23:00 in UTC+8 is 15:00 UTC',
  new Date(WX.parseLocal('2026-09-08T23:00', SH_OFF)).toISOString(),
  '2026-09-08T15:00:00.000Z');
eq('00:00 in UTC+8 is 16:00 UTC the day before',
  new Date(WX.parseLocal('2026-09-09T00:00', SH_OFF)).toISOString(),
  '2026-09-08T16:00:00.000Z');
eq('negative offset: 10:00 in UTC-7 is 17:00 UTC',
  new Date(WX.parseLocal('2026-09-08T10:00', -7 * 3600)).toISOString(),
  '2026-09-08T17:00:00.000Z');
eq('half-hour offset: 10:00 in UTC+5:30 is 04:30 UTC',
  new Date(WX.parseLocal('2026-09-08T10:00', 5.5 * 3600)).toISOString(),
  '2026-09-08T04:30:00.000Z');
eq('round trip keeps the wall clock',
  WX.hhmm(WX.parseLocal('2026-09-08T07:05', SH_OFF), SH_OFF), '7:05 AM');
eq('round trip on a negative offset',
  WX.hhmm(WX.parseLocal('2026-01-02T19:45', -5 * 3600), -5 * 3600), '7:45 PM');
eq('date-only strings are read at noon',
  WX.dayKey(WX.parseLocal('2026-09-08', SH_OFF), SH_OFF), '2026-9-8');
eq('seconds are preserved',
  new Date(WX.parseLocal('2026-09-08T23:00:30', SH_OFF)).toISOString(),
  '2026-09-08T15:00:30.000Z');

/* ── Clock formatting ─────────────────────────────────────────────────── */
group('Clock and calendar formatting');
const noon = Date.UTC(2026, 8, 8, 12, 0, 0);
eq('hhmm 12:00 → 12:00 PM', WX.hhmm(noon, 0), '12:00 PM');
eq('hhmm 00:00 → 12:00 AM', WX.hhmm(Date.UTC(2026, 8, 8, 0, 0, 0), 0), '12:00 AM');
eq('hourLabel 13:00 → 1 PM', WX.hourLabel(Date.UTC(2026, 8, 8, 13, 0, 0), 0), '1 PM');
eq('weekdayShort', WX.weekdayShort(noon, 0), 'Tue');
eq('monthDay', WX.monthDay(noon, 0), 'Sep 8');
eq('dayKey', WX.dayKey(noon, 0), '2026-9-8');
eq('relative: 30 s → just now', WX.relative(1000, 31000), 'just now');
eq('relative: 5 min', WX.relative(0, 5 * 60000), '5 min ago');
eq('relative: 2 hours', WX.relative(0, 2 * 3600000), '2 hours ago');
eq('relative: 1 day', WX.relative(0, 25 * 3600000), '1 day ago');

/* ── Daylight ─────────────────────────────────────────────────────────── */
group('Daylight helpers');
eq('progress before sunrise is 0', WX.daylightProgress(100, 200, 50), 0);
eq('progress after sunset is 1', WX.daylightProgress(100, 200, 250), 1);
eq('progress at midday is 0.5', WX.daylightProgress(100, 300, 200), 0.5, 1e-9);
eq('durationText', WX.durationText(12.5 * 3600000), '12h 30m');
eq('durationText pads minutes', WX.durationText(9.05 * 3600000), '9h 03m');

/* ── Solar model ──────────────────────────────────────────────────────── */
group('Solar model (offline fallback)');
function localMidnightUTC(y, m, d, offSec) { return Date.UTC(y, m, d) - offSec * 1000; }
/* Reference values from the Open-Meteo API for London, 2026-09-08. */
const london = Api.sunTimes(51.5072, -0.1276, localMidnightUTC(2026, 8, 8, 3600), 3600);
const refSunrise = Date.parse('2026-09-08T06:24:00+01:00');
const refSunset = Date.parse('2026-09-08T19:31:00+01:00');
ok('London sunrise within 6 min of the reference',
  Math.abs(london.sunrise - refSunrise) < 6 * 60000,
  'computed ' + WX.hhmm(london.sunrise, 3600));
ok('London sunset within 6 min of the reference',
  Math.abs(london.sunset - refSunset) < 6 * 60000,
  'computed ' + WX.hhmm(london.sunset, 3600));
const dayLen = WX.daylightLength(london.sunrise, london.sunset) / 3600000;
near('London daylight ≈ 13.1 h', dayLen, 13.1, 0.2);
/* The equator has ~12 h of daylight all year. */
const quito = Api.sunTimes(0.18, -78.5, localMidnightUTC(2026, 8, 8, -5 * 3600), -5 * 3600);
near('Quito daylight ≈ 12 h', WX.daylightLength(quito.sunrise, quito.sunset) / 3600000, 12.0, 0.3);
/* Polar night north of the arctic circle in December. */
const svalbard = Api.sunTimes(78.2, 15.6, localMidnightUTC(2026, 11, 21, 3600), 3600);
ok('Svalbard has polar night in December', svalbard.polar === true);

/* ── Offline simulation ───────────────────────────────────────────────── */
group('Offline simulation');
const place = {
  name: 'Testville', country: 'Testland', countryCode: 'TT', admin1: '',
  latitude: 40, longitude: -74, timezone: 'America/New_York', utcOffsetSeconds: -4 * 3600
};
const sim = Api.simulate(place, Date.UTC(2026, 8, 8, 16, 0, 0));
eq('simulation marks itself as demo data', sim.source, 'demo');
eq('72 hours of hourly data', sim.hourly.time.length, 72);
eq('7 days of daily data', sim.daily.time.length, 7);
eq('24 h of uv_index', sim.hourly.uv_index.length, 72);
ok('current temperature is a finite number', Number.isFinite(sim.current.temperature_2m));
ok('current weather code is known', !!WX.WMO[sim.current.weather_code]);
ok('no NaN anywhere in the hourly block',
  Object.keys(sim.hourly).every(k => sim.hourly[k].every(v => v === null || !Number.isNaN(v))));
ok('no NaN anywhere in the daily block',
  Object.keys(sim.daily).every(k => sim.daily[k].every(v => v === null || !Number.isNaN(v))));
ok('temperatures are physically plausible',
  sim.hourly.temperature_2m.every(t => t > -60 && t < 60));
ok('humidity is 0–100 %', sim.hourly.relative_humidity_2m.every(h => h >= 0 && h <= 100));
ok('precipitation probability is 0–100 %',
  sim.hourly.precipitation_probability.every(p => p >= 0 && p <= 100));
ok('wind speed is non-negative', sim.hourly.wind_speed_10m.every(w => w >= 0));
ok('UV index is 0–15', sim.hourly.uv_index.every(u => u >= 0 && u <= 15));
ok('daily min never exceeds daily max',
  sim.daily.temperature_2m_min.every((lo, i) => lo <= sim.daily.temperature_2m_max[i]));
ok('is_day is 0 or 1', sim.hourly.is_day.every(v => v === 0 || v === 1));
ok('daytime hours are a contiguous block each day',
  sim.hourly.is_day.slice(0, 24).join('').replace(/^0+/, '').replace(/0+$/, '').indexOf('0') === -1);
ok('AQI is present and plausible', sim.air.us_aqi >= 0 && sim.air.us_aqi <= 300);
const sim2 = Api.simulate(place, Date.UTC(2026, 8, 8, 16, 0, 0));
eq('simulation is deterministic', sim2.hourly.temperature_2m[5], sim.hourly.temperature_2m[5]);

/* ── Chart geometry ───────────────────────────────────────────────────── */
group('Chart geometry');
const path = Chart.smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
ok('smoothPath starts with a move command', path.startsWith('M'));
ok('smoothPath contains no NaN', path.indexOf('NaN') === -1);
ok('smoothPath is a cubic curve for 3+ points', path.indexOf('C') > -1);
ok('smoothPath handles a single point', Chart.smoothPath([{ x: 1, y: 2 }]) === 'M1.0 2.0');
ok('smoothPath handles an empty list', Chart.smoothPath([]) === '');

/* ── Report ───────────────────────────────────────────────────────────── */
console.log('\n' + '─'.repeat(60));
if (fail) {
  console.log(`${fail} FAILED of ${pass + fail}:`);
  failures.forEach(f => console.log('  ✗ ' + f));
} else {
  console.log(`all ${pass} assertions passed`);
}
process.exit(fail ? 1 : 0);

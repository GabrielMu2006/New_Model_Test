#!/usr/bin/env node
/**
 * tools/states.js — render every sky state and screenshot it.
 *
 * Builds deterministic datasets locally (no network) so all weather palettes,
 * glyphs and ambient effects can be reviewed regardless of live conditions.
 *
 *   node tools/states.js [--url ...] [--out shots/states] [--theme dark|light]
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW ||
  '/Users/gabrielmu/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const URL_ = arg('url', 'http://127.0.0.1:8777/index.html');
const OUT = path.resolve(arg('out', 'shots/states'));
const THEME = arg('theme', 'dark');

/* name -> [wmo code, isDay] */
const STATES = {
  'clear-day': [0, 1],
  'clear-night': [0, 0],
  'partly-day': [2, 1],
  'partly-night': [2, 0],
  'cloudy-day': [3, 1],
  'cloudy-night': [3, 0],
  'fog': [45, 1],
  'rain': [63, 1],
  'showers': [81, 1],
  'storm': [95, 1],
  'snow': [73, 1]
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, locale: 'en-US'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(t => { try { localStorage.setItem('skylight.theme', t); } catch (e) {} }, THEME);
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#tempNow').textContent.trim() !== '—',
    { timeout: 30000 });

  const report = [];
  for (const [name, [code, isDay]] of Object.entries(STATES)) {
    const info = await page.evaluate(({ code, isDay }) => {
      const Api = window.WXApi;
      const place = {
        name: 'Weather Test', admin1: '', country: 'Testland', countryCode: 'TT',
        latitude: 40.7, longitude: -74, timezone: 'America/New_York', utcOffsetSeconds: -4 * 3600
      };
      const base = Api.simulate(place, Date.now());
      base.source = 'demo';
      base.current.weather_code = code;
      base.current.is_day = isDay;
      base.current.temperature_2m = code === 73 ? -3.4 : code === 95 ? 21.6 : 17.8;
      base.current.apparent_temperature = base.current.temperature_2m - 1.5;
      base.current.wind_speed_10m = code === 95 ? 42 : 14;
      base.current.wind_gusts_10m = base.current.wind_speed_10m * 1.8;
      base.current.precipitation = code >= 51 ? 1.4 : 0;
      base.current.cloud_cover = code === 0 ? 4 : code === 2 ? 40 : 92;
      /* Make the whole strip agree with the forced condition. */
      base.hourly.weather_code = base.hourly.weather_code.map((c, i) => (i % 7 === 5 ? code : c));
      base.daily.weather_code = base.daily.weather_code.map((c, i) => (i === 0 ? code : c));
      base.daily.temperature_2m_max[0] = base.current.temperature_2m + 4;
      base.daily.temperature_2m_min[0] = base.current.temperature_2m - 5;
      window.Skylight.inject(base);
      return {
        sky: document.documentElement.dataset.sky,
        cond: document.querySelector('#condText').textContent,
        iconPaths: document.querySelectorAll('#heroIcon svg *').length,
        iconKind: window.WX.describe(code).kind
      };
    }, { code, isDay });

    await page.waitForTimeout(1400); /* let the canvas particles settle */
    const hero = await page.$('#hero');
    await hero.screenshot({ path: path.join(OUT, `${name}-${THEME}.png`) });
    await page.screenshot({ path: path.join(OUT, `${name}-${THEME}-fold.png`) });
    report.push(`${name.padEnd(13)} sky=${String(info.sky).padEnd(13)} kind=${String(info.iconKind).padEnd(8)} glyphNodes=${info.iconPaths}`);
  }

  console.log(report.join('\n'));
  console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nno console/page errors');
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });

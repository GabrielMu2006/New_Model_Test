#!/usr/bin/env node
/**
 * tools/inspect.js — capture individual sections at high DPI for close review.
 *
 *   node tools/inspect.js [--url ...] [--out shots/regions] [--theme dark|light]
 *                         [--width 1440] [--city "Tokyo"] [--unit F] [--hover]
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
const has = name => process.argv.includes('--' + name);

const URL_ = arg('url', 'http://127.0.0.1:8777/index.html');
const OUT = path.resolve(arg('out', 'shots/regions'));
const THEME = arg('theme', 'dark');
const WIDTH = Number(arg('width', 1440));
const CITY = arg('city', null);
const UNIT = arg('unit', null);

const SECTIONS = [
  ['topbar', '.topbar'],
  ['hero', '#hero'],
  ['hourly', 'main > section:nth-of-type(2)'],
  ['daily', 'main > section:nth-of-type(3)'],
  ['details', '#details'],
  ['foot', '.foot']
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: 1000 },
    deviceScaleFactor: 2.5,
    locale: 'en-US'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript(t => {
    try { localStorage.setItem('skylight.theme', t); } catch (e) {}
  }, THEME);

  await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelectorAll('#daily .day').length >= 5 &&
          document.querySelector('#tempNow').textContent.trim() !== '—',
    { timeout: 30000 });

  if (CITY) {
    await page.evaluate(name => {
      const c = Object.values(window.Skylight.zoneCity).find(x => x.name === name);
      if (c) return window.Skylight.setPlace(c);
      return null;
    }, CITY);
    await page.waitForTimeout(2500);
  }
  if (UNIT) {
    await page.click(UNIT === 'F' ? '#unitF' : '#unitC');
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(800);

  for (const [name, sel] of SECTIONS) {
    const el = await page.$(sel);
    if (!el) { console.log('missing section', name, sel); continue; }
    await el.screenshot({ path: path.join(OUT, `${name}-${THEME}.png`) });
  }

  if (has('hover')) {
    const box = await page.$('#heroSpark');
    const b = await box.boundingBox();
    await page.mouse.move(b.x + b.width * 0.42, b.y + b.height * 0.5);
    await page.waitForTimeout(500);
    await box.screenshot({ path: path.join(OUT, `herochart-hover-${THEME}.png`) });
  }

  await page.screenshot({ path: path.join(OUT, `full-${THEME}.png`), fullPage: true });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
  console.log('regions in', OUT);
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });

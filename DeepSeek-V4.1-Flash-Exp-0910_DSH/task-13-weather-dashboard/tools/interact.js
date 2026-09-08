#!/usr/bin/env node
/**
 * tools/interact.js — drive every control and assert the result.
 * Captures screenshots of each interactive state.
 *
 *   node tools/interact.js [--url ...] [--out shots/interact]
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
const OUT = path.resolve(arg('out', 'shots/interact'));

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(
    () => document.querySelectorAll('#daily .day').length >= 5 &&
          document.querySelector('#tempNow').textContent.trim() !== '—', { timeout: 30000 });

  const place0 = await page.textContent('#placeName');
  const tempC = await page.textContent('#tempNow');
  const unitC = await page.textContent('#tempUnit');

  /* 1 — unit toggle */
  await page.click('#unitF');
  await page.waitForTimeout(500);
  const tempF = await page.textContent('#tempNow');
  const unitF = await page.textContent('#tempUnit');
  const expectF = Math.round(Number(tempC) * 9 / 5 + 32);
  check('°F toggle converts temperature', Number(tempF) === expectF && unitF === '°F',
    `${tempC}${unitC} -> ${tempF}${unitF} (expected ${expectF})`);
  await page.screenshot({ path: path.join(OUT, 'unit-fahrenheit.png'), fullPage: true });
  await page.click('#unitC');
  await page.waitForTimeout(400);
  check('°C toggle restores', (await page.textContent('#tempUnit')) === '°C');

  /* 2 — hourly detail toggle */
  await page.click('#hourlyToggle');
  await page.waitForTimeout(400);
  const detailed = await page.evaluate(() => document.querySelector('.hourly').classList.contains('is-detailed'));
  const extraVisible = await page.evaluate(() => {
    const e = document.querySelector('.hour__extra');
    return e ? getComputedStyle(e).display !== 'none' : false;
  });
  check('hourly "Show details" reveals extra rows', detailed && extraVisible);
  const hourlyBox = await (await page.$('main > section:nth-of-type(2)')).boundingBox();
  await page.screenshot({ path: path.join(OUT, 'hourly-detailed.png'), clip: hourlyBox });
  await page.click('#hourlyToggle');
  await page.waitForTimeout(300);

  /* 3 — hero chart hover tooltip */
  const spark = await page.$('#heroSpark');
  const sb = await spark.boundingBox();
  await page.mouse.move(sb.x + sb.width * 0.55, sb.y + sb.height * 0.45);
  await page.waitForTimeout(400);
  const tipOn = await page.evaluate(() => {
    const t = document.querySelector('.spark__tip');
    return t && t.classList.contains('is-on') ? t.textContent : null;
  });
  check('chart hover shows a tooltip', !!tipOn, tipOn ? `"${tipOn}"` : 'no tooltip');
  await spark.screenshot({ path: path.join(OUT, 'chart-hover.png') });
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);

  /* 4 — search combobox */
  await page.click('#searchInput');
  await page.type('#searchInput', 'Tokyo', { delay: 40 });
  await page.waitForSelector('.search__opt', { timeout: 15000 });
  const optCount = await page.evaluate(() => document.querySelectorAll('.search__opt').length);
  check('search returns results', optCount > 0, `${optCount} options`);
  await page.screenshot({ path: path.join(OUT, 'search-open.png'), clip: { x: 380, y: 0, width: 700, height: 420 } });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  const place1 = await page.textContent('#placeName');
  check('selecting a result loads that city', place1 !== place0, `${place0} -> ${place1}`);
  await page.screenshot({ path: path.join(OUT, 'after-search.png'), fullPage: true });

  /* 5 — keyboard shortcut focuses search */
  await page.keyboard.press('Escape');
  await page.click('body', { position: { x: 20, y: 600 } });
  await page.keyboard.press('/');
  await page.waitForTimeout(200);
  const focused = await page.evaluate(() => document.activeElement.id);
  check('"/" focuses the search box', focused === 'searchInput', 'focus=' + focused);
  await page.keyboard.press('Escape');

  /* 6 — theme toggle */
  const theme0 = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('#themeBtn');
  await page.waitForTimeout(600);
  const theme1 = await page.evaluate(() => document.documentElement.dataset.theme);
  check('theme toggle switches theme', theme0 !== theme1, `${theme0} -> ${theme1}`);
  await page.screenshot({ path: path.join(OUT, 'theme-toggled.png'), fullPage: true });
  await page.click('#themeBtn');
  await page.waitForTimeout(400);

  /* 7 — refresh button */
  await page.click('#refreshBtn');
  await page.waitForTimeout(5000);
  const stillRendered = await page.evaluate(() => document.querySelector('#tempNow').textContent.trim() !== '—');
  check('refresh keeps the dashboard rendered', stillRendered);

  /* 8 — geolocation denial is handled gracefully */
  await ctx.clearPermissions();
  await page.click('#locateBtn');
  await page.waitForTimeout(3000);
  const toast = await page.evaluate(() => {
    const t = document.getElementById('toast');
    return t && !t.hidden ? t.textContent : null;
  });
  check('denied geolocation surfaces a message', !!toast, toast || 'no toast');
  await page.screenshot({ path: path.join(OUT, 'locate-denied.png'), clip: { x: 300, y: 780, width: 840, height: 170 } });

  /* 9 — no console errors during the whole run */
  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const failed = checks.filter(c => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

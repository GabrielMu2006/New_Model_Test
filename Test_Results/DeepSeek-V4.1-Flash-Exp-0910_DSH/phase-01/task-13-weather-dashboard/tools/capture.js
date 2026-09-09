#!/usr/bin/env node
/**
 * tools/capture.js — headless render + visual audit for the Skylight dashboard.
 *
 *   node tools/capture.js [--url http://127.0.0.1:8777] [--out shots] [--city "Tokyo"]
 *
 * Produces full-page screenshots for each theme/viewport combination and prints
 * a report of console errors, failed requests and layout overflows.
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
const OUT = path.resolve(arg('out', 'shots'));
const CITY = arg('city', null);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 950, dsf: 2 },
  { name: 'laptop', width: 1180, height: 800, dsf: 2 },
  { name: 'tablet', width: 834, height: 1000, dsf: 2 },
  { name: 'mobile', width: 390, height: 844, dsf: 3 }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];
  const results = [];

  for (const vp of VIEWPORTS) {
    for (const theme of ['dark', 'light']) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dsf,
        colorScheme: theme,
        reducedMotion: 'no-preference',
        locale: 'en-US'
      });
      const page = await ctx.newPage();

      const consoleErrors = [];
      const pageErrors = [];
      const failed = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('requestfailed', r => failed.push(r.url() + ' :: ' + (r.failure() || {}).errorText));

      await page.addInitScript(t => {
        try { localStorage.setItem('skylight.theme', t); } catch (e) {}
      }, theme);

      await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
      // Wait until the dashboard has real data rendered.
      await page.waitForFunction(
        () => document.querySelectorAll('#daily .day').length >= 5 &&
              document.querySelector('#tempNow').textContent.trim() !== '—',
        { timeout: 30000 }
      ).catch(() => problems.push(`${vp.name}/${theme}: data did not render in time`));

      if (CITY) {
        await page.evaluate(name => {
          const zone = Object.values(window.Skylight.zoneCity).find(c => c.name === name);
          if (zone) return window.Skylight.setPlace(zone);
          return null;
        }, CITY);
        await page.waitForTimeout(2500);
      }

      await page.waitForTimeout(900);

      const audit = await page.evaluate(() => {
        const out = { overflows: [], missing: [], sky: document.documentElement.dataset.sky,
          theme: document.documentElement.dataset.theme,
          temp: document.querySelector('#tempNow').textContent,
          cond: document.querySelector('#condText').textContent,
          place: document.querySelector('#placeName').textContent,
          badge: document.querySelector('#sourceBadge').textContent,
          tiles: document.querySelectorAll('#details .tile').length,
          hours: document.querySelectorAll('#hourly .hour').length,
          days: document.querySelectorAll('#daily .day').length,
          docW: document.documentElement.scrollWidth,
          winW: window.innerWidth };
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          if (r.right > window.innerWidth + 1.5 || r.left < -1.5) {
            if (el.closest('.hourly')) return; // intentional horizontal scroller
            const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName;
            out.overflows.push(String(cls) + ' right=' + Math.round(r.right) + ' left=' + Math.round(r.left));
          }
        });
        // Any empty containers that should have content?
        [['#heroIcon svg', 'hero icon'], ['#heroSpark svg', 'hero chart'],
         ['#hourly .hour', 'hourly cells'], ['#daily .day', 'daily rows'],
         ['#details .tile', 'detail tiles']].forEach(([sel, label]) => {
          if (!document.querySelector(sel)) out.missing.push(label);
        });
        // Any tile whose visualisation failed to draw?
        document.querySelectorAll('#details .tile').forEach((t, i) => {
          const label = t.querySelector('.tile__label');
          const svg = t.querySelector('svg');
          if (!svg && !t.querySelector('.tile__meter')) out.missing.push('viz in tile ' + (label ? label.textContent.trim() : i));
        });
        return out;
      });

      const file = path.join(OUT, `${vp.name}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await page.screenshot({ path: path.join(OUT, `${vp.name}-${theme}-fold.png`) });

      results.push({ viewport: vp.name, theme, file, audit, consoleErrors, pageErrors, failed });

      if (consoleErrors.length) problems.push(`${vp.name}/${theme}: console ${consoleErrors.slice(0, 3).join(' | ')}`);
      if (pageErrors.length) problems.push(`${vp.name}/${theme}: pageerror ${pageErrors.slice(0, 3).join(' | ')}`);
      if (failed.length) problems.push(`${vp.name}/${theme}: requestfailed ${failed.slice(0, 3).join(' | ')}`);
      if (audit.overflows.length) problems.push(`${vp.name}/${theme}: overflow ${audit.overflows.slice(0, 6).join(' | ')}`);
      if (audit.missing.length) problems.push(`${vp.name}/${theme}: missing ${audit.missing.join(', ')}`);
      if (audit.docW > audit.winW + 2) problems.push(`${vp.name}/${theme}: page scrolls horizontally (${audit.docW} > ${audit.winW})`);

      await ctx.close();
    }
  }

  await browser.close();

  console.log('\n=== render audit ===');
  for (const r of results) {
    console.log(
      `${r.viewport.padEnd(8)} ${r.theme.padEnd(5)} sky=${String(r.audit.sky).padEnd(13)} ` +
      `temp=${String(r.audit.temp).padStart(4)} tiles=${r.audit.tiles} hours=${r.audit.hours} ` +
      `days=${r.audit.days} place="${r.audit.place}" badge=${r.audit.badge}`
    );
  }
  console.log('\n=== problems ===');
  console.log(problems.length ? problems.map(p => ' - ' + p).join('\n') : ' none');
  console.log(`\nscreenshots in ${OUT}`);
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

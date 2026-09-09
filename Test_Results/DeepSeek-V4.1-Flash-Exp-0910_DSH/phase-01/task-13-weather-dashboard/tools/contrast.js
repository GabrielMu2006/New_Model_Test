#!/usr/bin/env node
/**
 * tools/contrast.js — objective WCAG contrast audit.
 *
 * Renders the page, then for every visible text node samples the ACTUAL
 * rendered backdrop pixels (by hiding the text and re-screenshotting) and
 * computes the contrast ratio of the text colour against that backdrop.
 *
 *   node tools/contrast.js [--url ...] [--theme dark|light] [--width 1440]
 *                          [--city "Shanghai"] [--min 4.5]
 */
'use strict';

const path = require('path');
const { chromium } = require(process.env.PW ||
  '/Users/gabrielmu/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const URL_ = arg('url', 'http://127.0.0.1:8777/index.html');
const THEME = arg('theme', 'dark');
const WIDTH = Number(arg('width', 1440));
const CITY = arg('city', null);
const MIN = Number(arg('min', 4.5));

function parseColor(str) {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function over(fg, bg) {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}
function lum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US'
  });
  const page = await ctx.newPage();
  await page.addInitScript(t => { try { localStorage.setItem('skylight.theme', t); } catch (e) {} }, THEME);
  await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelectorAll('#daily .day').length >= 5 &&
          document.querySelector('#tempNow').textContent.trim() !== '—', { timeout: 30000 });
  if (CITY) {
    await page.evaluate(n => {
      const c = Object.values(window.Skylight.zoneCity).find(x => x.name === n);
      if (c) return window.Skylight.setPlace(c);
    }, CITY);
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(700);

  /* Collect every visible text-bearing leaf element. */
  const items = await page.evaluate(() => {
    const out = [];
    const walk = el => {
      const own = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3 && n.textContent.trim())
        .map(n => n.textContent.trim()).join(' ');
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (own && cs.visibility !== 'hidden' && cs.display !== 'none' &&
          parseFloat(cs.opacity) > 0.05 && r.width > 1 && r.height > 1) {
        out.push({
          text: own.slice(0, 42),
          tag: el.tagName.toLowerCase(),
          cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').slice(0, 48),
          color: cs.color,
          fontSize: parseFloat(cs.fontSize),
          bold: parseInt(cs.fontWeight, 10) >= 600,
          x: r.left + window.scrollX, y: r.top + window.scrollY,
          w: r.width, h: r.height
        });
      }
      for (const c of el.children) walk(c);
    };
    walk(document.body);
    return out;
  });

  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const shotWithText = await page.screenshot({ fullPage: true });

  await page.evaluate(() => {
    /* Hide only the glyphs — keep every background, badge and chip intact. */
    const walk = el => {
      const own = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim()).length;
      if (own) { el.style.color = 'transparent'; el.style.textShadow = 'none'; }
      for (const c of el.children) walk(c);
    };
    walk(document.body);
  });
  await page.waitForTimeout(250);
  const shotNoText = await page.screenshot({ fullPage: true });

  /* Sample backdrops in the page using a canvas fed from the screenshot. */
  const samples = await page.evaluate(async ({ b64, items }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    c2.drawImage(img, 0, 0);
    const sx = img.width / document.documentElement.scrollWidth;
    const sy = img.height / document.documentElement.scrollHeight;
    return items.map(it => {
      const pts = [];
      for (let fx = 0.12; fx <= 0.88; fx += 0.19) {
        for (let fy = 0.2; fy <= 0.8; fy += 0.3) {
          const px = Math.round((it.x + it.w * fx) * sx);
          const py = Math.round((it.y + it.h * fy) * sy);
          if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
          const d = c2.getImageData(px, py, 1, 1).data;
          pts.push([d[0], d[1], d[2]]);
        }
      }
      if (!pts.length) return null;
      /* Use the median-luminance sample as the backdrop. */
      pts.sort((a, b) => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) - (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]));
      const mid = pts[Math.floor(pts.length / 2)];
      return { r: mid[0], g: mid[1], b: mid[2], a: 1 };
    });
  }, { b64: shotNoText.toString('base64'), items });

  const failures = [];
  const warnings = [];
  items.forEach((it, i) => {
    const s = samples[i];
    if (!s) return;
    const fg = parseColor(it.color);
    if (!fg) return;
    const text = over(fg, s);
    const cr = ratio(text, s);
    const large = it.fontSize >= 24 || (it.fontSize >= 18.66 && it.bold);
    const need = large ? 3.0 : MIN;
    const rec = { ...it, cr: Math.round(cr * 100) / 100, need, backdrop: `rgb(${s.r},${s.g},${s.b})` };
    if (cr < need) (cr < need - 1.2 ? failures : warnings).push(rec);
  });

  const fmt = r => `  ${r.cr.toFixed(2)}:1 (need ${r.need}) [${r.fontSize}px${r.bold ? ' bold' : ''}] ` +
    `"${r.text}" <${r.tag} class="${r.cls}"> fg=${r.color} bg=${r.backdrop}`;

  console.log(`\n=== contrast audit · ${THEME} · ${WIDTH}px · ${CITY || 'default'} ===`);
  console.log(`checked ${items.length} text elements`);
  console.log(`\nFAIL (< ${MIN}, minus tolerance):`);
  console.log(failures.length ? failures.sort((a, b) => a.cr - b.cr).map(fmt).join('\n') : '  none');
  console.log(`\nBORDERLINE:`);
  console.log(warnings.length ? warnings.sort((a, b) => a.cr - b.cr).map(fmt).join('\n') : '  none');

  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

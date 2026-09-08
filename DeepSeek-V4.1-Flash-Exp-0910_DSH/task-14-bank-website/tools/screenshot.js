#!/usr/bin/env node
/**
 * Screenshot harness for the Meridian Bank site.
 *
 *   node tools/screenshot.js                        # every page, desktop
 *   node tools/screenshot.js index.html --mobile    # one page, phone viewport
 *   node tools/screenshot.js index.html --slices 5  # tall page in readable bands
 *   node tools/screenshot.js index.html --clip 0,1400
 *
 * Writes PNGs to tools/shots/ and reports any console or page errors.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, launch, newPage } = require('./cdp');

const PORT = 9300 + (process.pid % 300);
const OUT_DIR = path.join(__dirname, 'shots');

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? def : argv[i + 1];
};
const MOBILE = argv.includes('--mobile');
const WIDTH = Number(flag('width', MOBILE ? 390 : 1440));
const HEIGHT = Number(flag('height', MOBILE ? 844 : 900));
const SLICES = Number(flag('slices', 0));
const CLIP = flag('clip', null);
const ONLY = argv.filter((a) => a.endsWith('.html'));

(async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { cdp, cleanup } = await launch(PORT);
  const pages = ONLY.length
    ? ONLY
    : fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

  let problems = 0;

  for (const file of pages) {
    const page = await newPage(cdp, { width: WIDTH, height: HEIGHT, mobile: MOBILE });
    await page.goto('file://' + path.join(ROOT, file));
    await page.settle();

    const fullH = await page.contentHeight();
    let bands;
    if (CLIP) {
      const [y, h] = CLIP.split(',').map(Number);
      bands = [{ y, h: h || HEIGHT }];
    } else if (SLICES > 0) {
      const h = Math.ceil(fullH / SLICES);
      bands = Array.from({ length: SLICES }, (_, i) => ({ y: i * h, h }));
    } else {
      bands = [{ y: 0, h: fullH }];
    }

    const errors = page.messages.filter((m) => /EXCEPTION|^error|^LOG/.test(m));
    const warns = page.messages.filter((m) => !errors.includes(m));
    problems += errors.length;

    const suffix = MOBILE ? '-mobile' : '';
    for (const band of bands) {
      const height = Math.min(band.h, fullH - band.y);
      if (height <= 0) continue;
      const tag = bands.length > 1 ? '-' + band.y : '';
      const name = file.replace(/\.html$/, '') + suffix + tag + '.png';
      await page.screenshot(path.join(OUT_DIR, name), {
        x: 0, y: band.y, width: WIDTH, height, scale: 1
      });
      const status = errors.length ? `✗ ${errors.length} error(s)` : '✓';
      console.log(`  ${status}  ${name.padEnd(26)} ${WIDTH}×${height}`);
    }

    errors.forEach((m) => console.log(`        ${m}`));
    warns.forEach((m) => console.log(`        ${m}`));
    await page.close();
  }

  cleanup();
  console.log(`\n  ${pages.length} page(s) captured to tools/shots/`);
  process.exit(problems ? 1 : 0);
})().catch((err) => {
  console.error('screenshot harness failed:', err.stack || err.message);
  process.exit(1);
});

/**
 * run-tests.js — one command that proves the calculator works.
 *
 *   1. unit-tests the pure engine under Node              (test-engine.js)
 *   2. drives the real UI in a headless Chromium          (selftest.html)
 *   3. writes screenshot.png from the live app            (shot.html)
 *
 *   node run-tests.js
 *
 * CHROME_BIN may point at a Chrome/Chromium binary; otherwise a Playwright
 * cache or a system Chrome install is used.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = __dirname;

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const names = new Set(['Chromium', 'chrome', 'Google Chrome for Testing', 'Google Chrome',
    'headless_shell', 'chrome-headless-shell']);
  const roots = [
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright'),
    '/Applications/Google Chrome.app/Contents/MacOS'
  ];
  const found = [];
  function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && names.has(e.name)) {
        try { fs.accessSync(full, fs.constants.X_OK); found.push(full); } catch (err) { /* skip */ }
      } else if (e.isDirectory()) walk(full, depth + 1);
    }
  }
  roots.forEach((r) => { if (fs.existsSync(r)) walk(r, 0); });
  // Prefer the bare headless shell: it is the most reliable in sandboxed CI.
  found.sort((a, b) => (/headless[_-]shell/.test(b) ? 1 : 0) - (/headless[_-]shell/.test(a) ? 1 : 0));
  if (found.length) return found[0];
  throw new Error('No Chromium binary found — set CHROME_BIN.');
}

function chromeFlags(profile, extra) {
  return [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-crash-reporter',
    '--no-first-run',
    '--allow-file-access-from-files',
    '--user-data-dir=' + profile
  ].concat(extra);
}

/* ---------------------------------------------------------------- engine */

function engineTests() {
  console.log('\n── engine unit tests (node) ──\n');
  const res = spawnSync(process.execPath, [path.join(DIR, 'test-engine.js')], { encoding: 'utf8' });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  return res.status === 0;
}

/* ------------------------------------------------------------ browser e2e */

function browserTests() {
  console.log('\n── browser self test (headless Chromium) ──\n');
  const bin = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'calc-test-'));
  const page = 'file://' + path.join(DIR, 'selftest.html');

  const run = spawnSync(bin, chromeFlags(profile, [
    '--window-size=1000,900',
    '--virtual-time-budget=30000',
    '--dump-dom',
    page
  ]), { encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });

  const html = run.stdout || '';
  const m = html.match(/###([\s\S]*?)###/);
  if (!m) {
    console.error('No test payload found in browser output.');
    console.error('chrome exit:', run.status, run.error ? String(run.error) : '');
    console.error(html.slice(0, 800));
    return false;
  }

  let payload;
  try { payload = JSON.parse(m[1]); }
  catch (err) { console.error('Could not parse test payload:', err.message); return false; }

  payload.results.forEach((r) => {
    console.log((r.ok ? 'pass  ' : 'FAIL  ') + r.name + (r.ok || r.extra === null ? '' : '  → ' + JSON.stringify(r.extra)));
  });
  if (payload.pageErrors.length) {
    console.log('\npage errors:');
    payload.pageErrors.forEach((e) => console.log('  ! ' + e));
  }
  console.log('\n' + (payload.failed
    ? payload.failed + ' of ' + payload.results.length + ' browser checks FAILED'
    : 'ALL ' + payload.results.length + ' browser checks passed'));
  return payload.failed === 0 && payload.pageErrors.length === 0;
}

/* -------------------------------------------------------------- screenshot */

function screenshot() {
  const bin = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'calc-shot-'));
  const outFile = path.join(DIR, 'screenshot.png');
  const run = spawnSync(bin, chromeFlags(profile, [
    '--window-size=1200,900',
    '--virtual-time-budget=8000',
    '--screenshot=' + outFile,
    'file://' + path.join(DIR, 'shot.html')
  ]), { encoding: 'utf8', timeout: 180000 });

  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
    console.log('\nscreenshot → ' + outFile + ' (' + Math.round(fs.statSync(outFile).size / 1024) + ' kB)');
    return true;
  }
  console.error('screenshot failed:', run.status, (run.stderr || '').slice(0, 300));
  return false;
}

/* ------------------------------------------------------------------- main */

const engineOk = engineTests();
const browserOk = browserTests();
const shotOk = screenshot();

console.log('\n' + (engineOk && browserOk ? 'SUITE PASSED' : 'SUITE FAILED') +
  (shotOk ? '' : ' (screenshot unavailable)'));
process.exitCode = engineOk && browserOk ? 0 : 1;

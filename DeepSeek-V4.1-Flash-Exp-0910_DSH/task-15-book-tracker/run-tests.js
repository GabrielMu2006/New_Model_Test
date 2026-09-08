/**
 * run-tests.js — one command that proves Shelf works.
 *
 *   1. unit-tests the pure engine under Node              (test-engine.js)
 *   2. drives the real UI in headless Chromium            (selftest.html)
 *   3. writes screenshot.png from the live app            (shot.html)
 *
 *   node run-tests.js
 *
 * CHROME_BIN may point at a Chrome/Chromium binary; otherwise a Playwright
 * cache or the system Chrome install is used.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = __dirname;

/* ------------------------------------------------------------------ chrome */

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const names = new Set(['Chromium', 'chrome', 'Google Chrome for Testing', 'Google Chrome',
    'headless_shell', 'chrome-headless-shell']);
  const roots = [
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright'),
    '/Applications/Google Chrome.app/Contents/MacOS',
    '/Applications/Chromium.app/Contents/MacOS'
  ];
  const found = [];
  function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && names.has(e.name)) {
        try { fs.accessSync(full, fs.constants.X_OK); found.push(full); } catch (err) { /* skip */ }
      } else if (e.isDirectory()) walk(full, depth + 1);
    }
  }
  roots.forEach((r) => { if (fs.existsSync(r)) walk(r, 0); });
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
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    '--user-data-dir=' + profile
  ].concat(extra || []);
}

/**
 * Headless Chrome on macOS does not always exit after rendering, so we watch its
 * output (or an output file) and shut it down as soon as the work is done. That
 * turns a flat 3-minute timeout into a couple of seconds.
 */
function runChrome(options) {
  const { url, args, timeoutMs, isDone, watchFile } = options;
  const bin = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-chrome-'));

  return new Promise((resolve) => {
    const child = spawn(bin, chromeFlags(profile, args).concat([url]), {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let lastSize = -1;
    let stableFor = 0;

    function kill() {
      try { process.kill(-child.pid, 'SIGKILL'); } catch (err) { try { child.kill('SIGKILL'); } catch (e) { /* gone */ } }
    }

    function finish(code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poller);
      kill();
      resolve({ stdout, stderr, code });
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (isDone && !settled && isDone(stdout)) setTimeout(() => finish(0), 60);
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => finish(code === null ? -1 : code));
    child.on('error', () => finish(-1));

    const timer = setTimeout(() => finish('timeout'), timeoutMs || 120000);

    let poller = null;
    if (watchFile) {
      poller = setInterval(() => {
        let size = 0;
        try { size = fs.statSync(watchFile).size; } catch (err) { return; }
        if (size > 1000 && size === lastSize) {
          if (++stableFor >= 3) finish(0);
        } else {
          stableFor = 0;
        }
        lastSize = size;
      }, 150);
    }
  });
}

/* ------------------------------------------------------------------ engine */

function engineTests() {
  console.log('\n── engine unit tests (node) ──\n');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(DIR, 'test-engine.js')], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === 0));
  });
}

/* --------------------------------------------------------------- browser */

async function browserTests() {
  console.log('\n── browser self test (headless Chromium) ──\n');
  const run = await runChrome({
    url: 'file://' + path.join(DIR, 'selftest.html'),
    args: ['--window-size=1280,900', '--virtual-time-budget=25000', '--dump-dom'],
    timeoutMs: 180000,
    isDone: (out) => /###\{[\s\S]*\}###/.test(out)
  });

  const match = run.stdout.match(/###([\s\S]*?)###/);
  if (!match) {
    console.error('No test payload found in browser output.');
    console.error('chrome exit:', run.code);
    console.error((run.stdout || '').slice(0, 1200));
    console.error((run.stderr || '').slice(0, 600));
    return false;
  }

  let payload;
  try { payload = JSON.parse(match[1]); }
  catch (err) {
    console.error('Could not parse the test payload:', err.message);
    return false;
  }

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

/* ------------------------------------------------------------ screenshot */

async function screenshot() {
  const outFile = path.join(DIR, 'screenshot.png');
  try { fs.unlinkSync(outFile); } catch (err) { /* fine */ }

  const run = await runChrome({
    url: 'file://' + path.join(DIR, 'shot.html'),
    args: ['--window-size=1440,1000', '--virtual-time-budget=12000', '--screenshot=' + outFile],
    timeoutMs: 120000,
    watchFile: outFile
  });

  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
    console.log('\nscreenshot → ' + outFile + ' (' + Math.round(fs.statSync(outFile).size / 1024) + ' kB)');
    return true;
  }
  console.error('screenshot failed:', run.code, (run.stderr || '').slice(0, 300));
  return false;
}

/* ------------------------------------------------------------------- main */

(async function main() {
  const engineOk = await engineTests();
  const browserOk = await browserTests();
  const shotOk = await screenshot();

  console.log('\n' + (engineOk && browserOk ? 'SUITE PASSED' : 'SUITE FAILED') +
    (shotOk ? '' : ' (screenshot unavailable)'));
  process.exitCode = engineOk && browserOk ? 0 : 1;
})();

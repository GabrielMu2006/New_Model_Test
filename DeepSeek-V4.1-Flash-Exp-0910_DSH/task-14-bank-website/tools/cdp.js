/**
 * Shared DevTools-protocol helpers for the Meridian Bank tooling.
 * Drives the Playwright-bundled Chrome headless shell with Node's built-in
 * WebSocket — no npm dependencies, nothing to install.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const cache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cache)) return null;
  for (const dir of fs.readdirSync(cache)) {
    if (!dir.startsWith('chromium_headless_shell-')) continue;
    for (const flavour of fs.readdirSync(path.join(cache, dir))) {
      const bin = path.join(cache, dir, flavour, 'chrome-headless-shell');
      if (fs.existsSync(bin)) return bin;
    }
  }
  return null;
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else {
        this.listeners.forEach((fn) => fn(msg));
      }
    });
  }
  send(method, params, sessionId) {
    const id = ++this.seq;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(fn) { this.listeners.push(fn); return fn; }
  off(fn) { this.listeners = this.listeners.filter((f) => f !== fn); }
}

async function waitForBrowser(port) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const info = await res.json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch (err) { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('headless browser never became reachable');
}

/** Launch the browser and return a connected client plus a cleanup function. */
async function launch(port) {
  const bin = findChrome();
  if (!bin) throw new Error('No chrome-headless-shell found — set CHROME_BIN.');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-cdp-'));
  const child = spawn(bin, [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--disable-crash-reporter', '--disable-background-networking', '--mute-audio',
    '--disable-features=Translate', '--force-color-profile=srgb',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', () => {});

  const wsUrl = await waitForBrowser(port);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('could not connect to the browser')));
  });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch (err) { /* ignore */ }
    try { ws.close(); } catch (err) { /* ignore */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (err) { /* ignore */ }
  };

  return { cdp: new CDP(ws), cleanup, bin };
}

/** Open a page target at a given viewport and collect its console noise. */
async function newPage(cdp, { width = 1440, height = 900, mobile = false } = {}) {
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const messages = [];

  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      messages.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      messages.push(msg.params.type.toUpperCase() + ': ' +
        msg.params.args.map((a) => a.value || a.description || a.type).join(' '));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      messages.push('LOG: ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
    }
  });

  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height
  }, sessionId);

  const page = {
    sessionId,
    messages,
    async goto(url) {
      await cdp.send('Page.navigate', { url }, sessionId);
      await new Promise((resolve) => {
        const done = (msg) => {
          if (msg.method === 'Page.loadEventFired' && msg.sessionId === sessionId) resolve();
        };
        cdp.on(done);
        setTimeout(resolve, 8000);
      });
      await sleep(300);
    },
    async evaluate(expression) {
      const res = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true
      }, sessionId);
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception
          ? res.exceptionDetails.exception.description
          : res.exceptionDetails.text);
      }
      return res.result.value;
    },
    /** Scroll top-to-bottom so IntersectionObserver work settles. */
    async settle() {
      await page.evaluate(`(function(){var h=document.documentElement.scrollHeight;
        for(var y=0;y<h;y+=${Math.round(height * 0.7)}){window.scrollTo(0,y);}
        window.scrollTo(0,0);return h;})()`);
      await sleep(900);
    },
    async contentHeight() {
      const m = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
      const size = m.cssContentSize || m.contentSize;
      return Math.min(Math.ceil(size.height), 30000);
    },
    async screenshot(file, clip) {
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, clip
      }, sessionId);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      return file;
    },
    async close() {
      await cdp.send('Target.closeTarget', { targetId: target.targetId });
    }
  };

  return page;
}

module.exports = { ROOT, findChrome, CDP, launch, newPage, sleep };

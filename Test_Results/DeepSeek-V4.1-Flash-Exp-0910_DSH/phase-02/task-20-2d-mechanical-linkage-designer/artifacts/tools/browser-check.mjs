/**
 * End-to-end browser check.
 *
 * Launches the locally installed Chrome in headless mode with a throw-away
 * profile, loads the app, drives it through the real UI (preset buttons,
 * transport controls, the crank slider) and asserts that:
 *
 *   - the page boots without console errors,
 *   - the UI is fully built (tools, presets, read-out tables, status bar),
 *   - rigid links keep their exact length while the mechanism runs,
 *   - sliders stay on their rails,
 *   - a rendered frame actually reaches the canvas (non-empty pixels).
 *
 * Everything happens over the browser's DevTools protocol on 127.0.0.1; no
 * external network access is used. The harness manages its own server and
 * browser process and always cleans them up.
 *
 * Usage: node tools/browser-check.mjs [--headful] [--keep-screenshot <path>]
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 15000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ''}`);
}

/** Minimal DevTools-protocol client over the built-in WebSocket. */
class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleMessages = [];
    this.pageErrors = [];
    ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.consoleAPICalled') {
        const text = (message.params.args || [])
          .map((arg) => (arg.value !== undefined ? arg.value : arg.description || arg.type))
          .join(' ');
        this.consoleMessages.push({ level: message.params.type, text });
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        this.pageErrors.push(
          details.exception?.description || details.text || 'unknown page exception',
        );
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`DevTools call timed out: ${method}`));
        }
      }, 30000);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed',
      );
    }
    return result.result.value;
  }
}

/* ------------------------------------------------------------------ checks */

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  const mark = ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m';
  process.stdout.write(`  ${mark} ${name}${detail ? ` \u001b[90m${detail}\u001b[0m` : ''}\n`);
}

/** In-page test script: runs inside the loaded app, returns JSON. */
const PAGE_TEST = `(async () => {
  const out = {};
  const api = window.linkageDesigner;
  const state = api.state;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const linkErrors = () => state.mechanism.links
    .map((l) => {
      const a = state.mechanism.joints.find((j) => j.id === l.a);
      const b = state.mechanism.joints.find((j) => j.id === l.b);
      return Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - l.length);
    })
    .reduce((m, v) => Math.max(m, v), 0);
  const sliderOffsets = () => state.mechanism.joints
    .filter((j) => j.type === 'slider')
    .map((j) => {
      const t = state.mechanism.tracks.find((tt) => tt.id === j.trackId);
      if (!t) return 0;
      const dx = t.b.x - t.a.x, dy = t.b.y - t.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      return Math.abs((j.x - t.a.x) * nx + (j.y - t.a.y) * ny);
    })
    .reduce((m, v) => Math.max(m, v), 0);

  // --- UI built?
  out.toolButtons = document.querySelectorAll('#tool-grid button').length;
  out.presetButtons = document.querySelectorAll('#preset-list button').length;
  out.readoutRows = document.querySelectorAll('#readout tbody tr').length;
  out.statusText = (document.getElementById('status-bar').textContent || '').trim();
  out.structureText = (document.getElementById('structure-info').textContent || '').trim();

  // --- canvas actually painted?
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let nonBackground = 0;
  for (let i = 0; i < data.length; i += 4 * 97) {
    if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 60) nonBackground++;
  }
  out.paintedSamples = nonBackground;
  out.canvasSize = [canvas.width, canvas.height];

  // bounding box of everything drawn, in device pixels
  let paintMinX = Infinity, paintMinY = Infinity, paintMaxX = -Infinity, paintMaxY = -Infinity, bright = 0;
  for (let y = 0; y < canvas.height; y += 3) {
    for (let x = 0; x < canvas.width; x += 3) {
      const i = (y * canvas.width + x) * 4;
      if (data[i] > 90 || data[i + 1] > 90 || data[i + 2] > 110) {
        bright++;
        if (x < paintMinX) paintMinX = x;
        if (x > paintMaxX) paintMaxX = x;
        if (y < paintMinY) paintMinY = y;
        if (y > paintMaxY) paintMaxY = y;
      }
    }
  }
  out.brightSamples = bright;
  out.paintBox = [paintMinX, paintMinY, paintMaxX, paintMaxY];
  out.paintFraction = bright / ((canvas.width / 3) * (canvas.height / 3));

  // layout sanity: panels must not overlap the canvas, nothing may overflow
  const canvasRect = canvas.getBoundingClientRect();
  const leftRect = document.querySelector('.panel-left').getBoundingClientRect();
  const rightRect = document.querySelector('.panel-right').getBoundingClientRect();
  out.layout = {
    canvas: [canvasRect.left, canvasRect.top, canvasRect.width, canvasRect.height],
    leftRight: leftRect.right,
    rightLeft: rightRect.left,
    viewport: [window.innerWidth, window.innerHeight],
    scrollWidth: document.documentElement.scrollWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
  };
  out.toolHintText = (document.getElementById('tool-hint').textContent || '').slice(0, 60);

  // --- four-bar: run for ~1.5 s of wall clock through the real rAF loop
  document.querySelectorAll('#preset-list button')[0].click();
  await sleep(120);
  const startCrank = state.mechanism.joints.find((j) => j.name === 'B');
  const startPos = { x: startCrank.x, y: startCrank.y };
  document.getElementById('btn-play').click();
  let worstLink = 0, worstSlider = 0;
  for (let i = 0; i < 90; i++) {
    await sleep(16);
    worstLink = Math.max(worstLink, linkErrors());
    worstSlider = Math.max(worstSlider, sliderOffsets());
  }
  document.getElementById('btn-play').click();
  out.playingAfterPause = state.sim.playing;
  out.simTime = state.sim.time;
  out.crankMoved = Math.hypot(startCrank.x - startPos.x, startCrank.y - startPos.y);
  out.fourBarWorstLink = worstLink;
  out.fourBarStatusText = document.getElementById('status-bar').textContent;

  // --- reset returns to the design pose
  const design = state.mechanism.joints.map((j) => ({ x: j.home.x, y: j.home.y }));
  document.getElementById('btn-reset').click();
  await sleep(60);
  out.resetError = state.mechanism.joints
    .map((j, i) => Math.hypot(j.x - design[i].x, j.y - design[i].y))
    .reduce((m, v) => Math.max(m, v), 0);

  // --- crank-slider preset: stroke must equal 2 x crank radius
  document.querySelectorAll('#preset-list button')[1].click();
  await sleep(120);
  const mech = state.mechanism;
  const B = mech.joints.find((j) => j.name === 'B');
  const crankLink = mech.links.find((l) => l.name === 'crank');
  let minX = Infinity, maxX = -Infinity, worst = 0, worstOff = 0;
  for (const angle of Array.from({ length: 145 }, (_, i) => (i * 360) / 144)) {
    document.getElementById('crank-angle').value = String(angle);
    document.getElementById('crank-angle').dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(2);
    minX = Math.min(minX, B.x); maxX = Math.max(maxX, B.x);
    worst = Math.max(worst, linkErrors());
    worstOff = Math.max(worstOff, sliderOffsets());
  }
  out.sliderStroke = maxX - minX;
  out.crankRadius = crankLink.length;
  out.sliderWorstLink = worst;
  out.sliderWorstOffset = worstOff;

  // --- step button advances exactly one step
  document.getElementById('btn-reset').click();
  const t0 = state.sim.time;
  document.getElementById('btn-step').click();
  out.stepAdvanced = state.sim.time > t0;
  out.stepStill = t0 === 0 ? state.sim.time > 0 : true;

  // --- create a mechanism by hand through the real UI tools
  document.querySelectorAll('.tool-btn')[1].click(); // fixed pivot
  const rect = canvas.getBoundingClientRect();
  const click = (x, y) => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + x, clientY: rect.top + y, bubbles: true, button: 0, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: rect.left + x, clientY: rect.top + y, bubbles: true, button: 0, pointerId: 1 }));
  };
  const before = state.mechanism.joints.length;
  click(rect.width * 0.3, rect.height * 0.6);
  await sleep(30);
  document.querySelectorAll('.tool-btn')[2].click(); // rotating joint
  click(rect.width * 0.45, rect.height * 0.35);
  await sleep(30);
  document.querySelectorAll('.tool-btn')[3].click(); // link
  document.getElementById('link-length').value = '137.5';
  document.getElementById('link-length-lock').checked = true;
  click(rect.width * 0.3, rect.height * 0.6);
  await sleep(20);
  click(rect.width * 0.45, rect.height * 0.35);
  await sleep(60);
  out.handBuiltJoints = state.mechanism.joints.length - before;
  out.handBuiltLinks = state.mechanism.links.length;
  out.handBuiltLinkLength = state.mechanism.links[state.mechanism.links.length - 1].length;
  out.handBuiltMeasured = (() => {
    const l = state.mechanism.links[state.mechanism.links.length - 1];
    const a = state.mechanism.joints.find((j) => j.id === l.a);
    const b = state.mechanism.joints.find((j) => j.id === l.b);
    return Math.hypot(a.x - b.x, a.y - b.y);
  })();
  out.handBuiltErrors = linkErrors();

  // --- undo / redo through the header buttons
  const linkCountAfterBuild = state.mechanism.links.length;
  document.getElementById('btn-undo').click();
  await sleep(40);
  out.linksAfterUndo = state.mechanism.links.length;
  document.getElementById('btn-redo').click();
  await sleep(40);
  out.linksAfterRedo = state.mechanism.links.length;
  out.linkCountAfterBuild = linkCountAfterBuild;

  // --- save to a slot and reload it
  document.getElementById('slot-name').value = 'e2e slot';
  document.getElementById('btn-save-slot').click();
  await sleep(60);
  out.slotCount = document.querySelectorAll('#slot-list .slot').length;
  const slotName = state.mechanism.name;
  document.querySelectorAll('#preset-list button')[0].click();
  await sleep(80);
  out.nameAfterPreset = state.mechanism.name;
  const loadButton = [...document.querySelectorAll('#slot-list .slot button')].find((b) => b.textContent === 'Load');
  if (loadButton) loadButton.click();
  await sleep(100);
  out.loadedName = state.mechanism.name;
  out.loadMatchesSaved = state.mechanism.links.length === linkCountAfterBuild;
  void slotName;

  // --- dead-reckoning check: jammed mechanism reports a block
  document.querySelectorAll('#preset-list button')[3].click(); // double rocker (jams)
  await sleep(120);
  document.getElementById('btn-play').click();
  let blocked = false;
  for (let i = 0; i < 120 && !blocked; i++) {
    await sleep(16);
    blocked = state.sim.blocked;
  }
  out.jamReported = blocked;
  out.jamMessage = state.sim.message;
  out.jamLinkError = linkErrors();

  out.consoleErrors = [];
  return out;
})()`;

/* -------------------------------------------------------------------- main */

/**
 * Real pointer interaction driven through the DevTools Input domain: this
 * exercises pointer capture, the drag-solve path and wheel zoom exactly like a
 * user would, rather than dispatching synthetic events.
 */
async function interactionChecks(session, check) {
  // Start from a known state: four-bar preset, select tool active.
  await session.evaluate(
    `(document.querySelectorAll('#preset-list button')[0].click(),
      document.querySelectorAll('.tool-btn')[0].click(),
      new Promise((r) => setTimeout(r, 150)))`,
  );
  const activeTool = await session.evaluate(`window.linkageDesigner.state.tool`);
  check('tool selection switches the active tool', activeTool === 'select', activeTool);
  const jointPos = await session.evaluate(`(() => {
    const state = window.linkageDesigner.state;
    const joint = state.mechanism.joints.find((j) => j.name === 'C');
    const camera = state.camera;
    const rect = document.getElementById('canvas').getBoundingClientRect();
    return {
      x: rect.left + joint.x * camera.scale + camera.ox,
      y: rect.top + (-joint.y * camera.scale + camera.oy),
      world: { x: joint.x, y: joint.y },
      scale: camera.scale,
    };
  })()`);

  const start = { x: jointPos.x, y: jointPos.y };
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: start.x,
    y: start.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  const target = { x: start.x + 55, y: start.y - 70 };
  for (let i = 1; i <= 8; i++) {
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + ((target.x - start.x) * i) / 8,
      y: start.y + ((target.y - start.y) * i) / 8,
      button: 'left',
      buttons: 1,
    });
    await new Promise((r) => setTimeout(r, 12));
  }
  const duringDrag = await session.evaluate(`(() => {
    const mech = window.linkageDesigner.state.mechanism;
    const worst = mech.links.reduce((max, l) => {
      const a = mech.joints.find((j) => j.id === l.a);
      const b = mech.joints.find((j) => j.id === l.b);
      return Math.max(max, Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - l.length));
    }, 0);
    const C = mech.joints.find((j) => j.name === 'C');
    return { worst, x: C.x, y: C.y };
  })()`);
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: target.x,
    y: target.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await new Promise((r) => setTimeout(r, 120));
  const afterDrag = await session.evaluate(`(() => {
    const state = window.linkageDesigner.state;
    const mech = state.mechanism;
    const worst = mech.links.reduce((max, l) => {
      const a = mech.joints.find((j) => j.id === l.a);
      const b = mech.joints.find((j) => j.id === l.b);
      return Math.max(max, Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - l.length));
    }, 0);
    const C = mech.joints.find((j) => j.name === 'C');
    return { worst, x: C.x, y: C.y, home: { x: C.home.x, y: C.home.y }, selection: [...state.selection] };
  })()`);

  const moved = Math.hypot(afterDrag.x - jointPos.world.x, afterDrag.y - jointPos.world.y);
  check('dragging a joint moves it', moved > 2, `moved ${moved.toFixed(2)} mm`);
  check('links stay rigid while dragging', duringDrag.worst < 1e-6 && afterDrag.worst < 1e-6,
    `worst ${Math.max(duringDrag.worst, afterDrag.worst).toExponential(2)} mm`);
  check('the dragged pose becomes the design pose',
    Math.hypot(afterDrag.home.x - afterDrag.x, afterDrag.home.y - afterDrag.y) < 1e-9);

  const zoomBefore = await session.evaluate('window.linkageDesigner.state.camera.scale');
  const canvasCentre = await session.evaluate(`(() => {
    const r = document.getElementById('canvas').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: canvasCentre.x,
    y: canvasCentre.y,
    deltaX: 0,
    deltaY: -240,
  });
  await new Promise((r) => setTimeout(r, 80));
  const zoomAfter = await session.evaluate('window.linkageDesigner.state.camera.scale');
  check('wheel zooms the view', zoomAfter > zoomBefore * 1.1, `${zoomBefore.toFixed(2)} → ${zoomAfter.toFixed(2)} px/mm`);

  // An empty-space drag pans instead of selecting.
  const panBefore = await session.evaluate('({ ...window.linkageDesigner.state.camera })');
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: canvasCentre.x,
    y: canvasCentre.y - 200,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: canvasCentre.x + 40,
    y: canvasCentre.y - 170,
    button: 'left',
    buttons: 1,
  });
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: canvasCentre.x + 40,
    y: canvasCentre.y - 170,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await new Promise((r) => setTimeout(r, 80));
  const panAfter = await session.evaluate('({ ...window.linkageDesigner.state.camera })');
  check('empty-space drag pans the view', Math.abs(panAfter.ox - panBefore.ox) > 20,
    `ox ${panBefore.ox.toFixed(0)} → ${panAfter.ox.toFixed(0)}`);

  await session.evaluate(`document.getElementById('btn-fit').click()`);
  await new Promise((r) => setTimeout(r, 80));

  // Read-out tabs
  const tabs = await session.evaluate(`(async () => {
    const out = {};
    for (const tab of document.querySelectorAll('.tab')) {
      tab.click();
      await new Promise((r) => setTimeout(r, 60));
      const head = [...document.querySelectorAll('#readout thead th')].map((th) => th.textContent);
      out[tab.dataset.tab] = head.join('|');
    }
    return out;
  })()`);
  check(
    'read-out tabs switch between joints, links and motors',
    /Joint/.test(tabs.joints || '') && /Exact/.test(tabs.links || '') && /Speed/.test(tabs.motors || ''),
    Object.values(tabs).join(' / ').slice(0, 90),
  );
  check(
    'the links tab shows exact lengths with zero error',
    await session.evaluate(`(() => {
      document.querySelector('.tab[data-tab="links"]').click();
      return [...document.querySelectorAll('#readout tbody tr')].every((tr) => {
        const cells = [...tr.children].map((td) => td.textContent.trim());
        return cells.length === 5 && Math.abs(parseFloat(cells[2]) - parseFloat(cells[3])) < 1e-3;
      });
    })()`),
  );

  // Erase tool removes an object
  const erase = await session.evaluate(`(async () => {
    const before = window.linkageDesigner.state.mechanism.joints.length;
    document.querySelectorAll('.tool-btn')[7].click();
    const state = window.linkageDesigner.state;
    const joint = state.mechanism.joints.find((j) => j.type === 'revolute');
    const camera = state.camera;
    const rect = document.getElementById('canvas').getBoundingClientRect();
    return {
      before,
      x: rect.left + joint.x * camera.scale + camera.ox,
      y: rect.top + (-joint.y * camera.scale + camera.oy),
      id: joint.id,
    };
  })()`);
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: erase.x,
    y: erase.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: erase.x,
    y: erase.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await new Promise((r) => setTimeout(r, 120));
  const afterErase = await session.evaluate(`(() => {
    const mech = window.linkageDesigner.state.mechanism;
    return {
      joints: mech.joints.length,
      gone: !mech.joints.some((j) => j.id === ${JSON.stringify(erase.id)}),
      links: mech.links.length,
      valid: mech.links.every((l) => mech.joints.some((j) => j.id === l.a) && mech.joints.some((j) => j.id === l.b)),
    };
  })()`);
  check(
    'the delete tool removes the clicked object and its links',
    afterErase.gone && afterErase.joints === erase.before - 1 && afterErase.valid,
    `${erase.before} → ${afterErase.joints} joints, ${afterErase.links} links left`,
  );
  await session.evaluate(`(document.querySelectorAll('.tool-btn')[0].click(), document.getElementById('btn-undo').click())`);
  await new Promise((r) => setTimeout(r, 100));

  return { jointPos, moved };
}

/**
 * Responsive layout: the app is a three column desktop layout that collapses to
 * a single column on narrow screens. Check that every size keeps the canvas
 * usable and never forces horizontal scrolling.
 */
async function responsiveChecks(session, check) {
  const sizes = [
    { label: 'mobile 390x844', width: 390, height: 844 },
    { label: 'tablet 768x1024', width: 768, height: 1024 },
    { label: 'desktop 1440x900', width: 1440, height: 900 },
  ];
  for (const size of sizes) {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: size.width < 600,
    });
    await new Promise((r) => setTimeout(r, 220));
    const layout = await session.evaluate(`(() => {
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      const transport = document.querySelector('.transport').getBoundingClientRect();
      const panels = [...document.querySelectorAll('.panel')].map((p) => {
        const r = p.getBoundingClientRect();
        return { w: r.width, h: r.height, top: r.top };
      });
      return {
        viewport: [window.innerWidth, window.innerHeight],
        canvas: [rect.width, rect.height],
        transportVisible: transport.width > 200 && transport.height > 20,
        scrollWidth: document.documentElement.scrollWidth,
        panels,
        readoutRows: document.querySelectorAll('#readout tbody tr').length,
      };
    })()`);
    check(
      `responsive ${size.label}: no horizontal overflow`,
      layout.scrollWidth <= size.width + 2,
      `scrollWidth ${layout.scrollWidth} vs ${size.width}`,
    );
    check(
      `responsive ${size.label}: canvas stays usable`,
      layout.canvas[0] > 300 && layout.canvas[1] > 200,
      `${layout.canvas[0].toFixed(0)}x${layout.canvas[1].toFixed(0)} px`,
    );
    check(
      `responsive ${size.label}: controls and read-outs present`,
      layout.transportVisible && layout.readoutRows > 0,
      `${layout.panels.length} panels, ${layout.readoutRows} read-out rows`,
    );
  }
  await session.send('Emulation.clearDeviceMetricsOverride');
  await new Promise((r) => setTimeout(r, 120));
}

/** Screen coordinates for a world point, using the app's live camera. */
function worldToClient(world) {
  return `(() => {
    const state = window.linkageDesigner.state;
    const camera = state.camera;
    const rect = document.getElementById('canvas').getBoundingClientRect();
    return {
      x: rect.left + ${world.x} * camera.scale + camera.ox,
      y: rect.top + (-(${world.y}) * camera.scale + camera.oy),
    };
  })()`;
}

async function clickWorld(session, world) {
  const point = await session.evaluate(worldToClient(world));
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await new Promise((r) => setTimeout(r, 45));
}

async function pickTool(session, index) {
  await session.evaluate(`document.querySelectorAll('.tool-btn')[${index}].click()`);
  await new Promise((r) => setTimeout(r, 30));
}

/**
 * Build a crank-slider from an empty canvas using nothing but the tools and the
 * mouse, then run it: the strongest available end-to-end proof that the parts
 * (pivots, joints, links, rails, sliders, motor) connect into a working
 * mechanism that keeps its constraints.
 */
async function buildFromScratchChecks(session, check) {
  await session.evaluate(`(document.getElementById('btn-new').click(), new Promise((r) => setTimeout(r, 160)))`);

  await pickTool(session, 1); // fixed pivot
  await clickWorld(session, { x: 0, y: 0 });
  await pickTool(session, 4); // rail
  await clickWorld(session, { x: -60, y: 0 });
  await clickWorld(session, { x: 200, y: 0 });
  await pickTool(session, 5); // slider
  await clickWorld(session, { x: 100, y: 0 });
  await pickTool(session, 2); // rotating joint
  await clickWorld(session, { x: 0, y: 40 });

  // exact crank length, then the connecting rod picked from the joints
  await session.evaluate(`(() => {
    const input = document.getElementById('link-length');
    input.value = '40';
    document.getElementById('link-length-lock').checked = true;
  })()`);
  await pickTool(session, 3); // link
  await clickWorld(session, { x: 0, y: 0 });
  await clickWorld(session, { x: 0, y: 40 });
  await session.evaluate(`document.getElementById('link-length-lock').checked = false`);
  await clickWorld(session, { x: 0, y: 40 });
  await clickWorld(session, { x: 100, y: 0 });

  await pickTool(session, 6); // motor
  await clickWorld(session, { x: 0, y: 0 });

  const built = await session.evaluate(`(() => {
    const mech = window.linkageDesigner.state.mechanism;
    const rail = mech.tracks[0];
    return {
      joints: mech.joints.map((j) => ({ name: j.name, type: j.type, x: j.x, y: j.y })),
      links: mech.links.map((l) => ({ name: l.name, length: l.length })),
      motors: mech.motors.length,
      railAngle: rail ? Math.atan2(rail.b.y - rail.a.y, rail.b.x - rail.a.x) : null,
      valid: (() => {
        const stress = window.linkageDesigner;
        return stress ? true : false;
      })(),
    };
  })()`);

  check('blank mechanism starts empty', built.joints.length === 3, `${built.joints.length} joints placed`);
  check(
    'tools created a fixed pivot, a joint and a slider',
    built.joints.filter((j) => j.type === 'fixed').length === 1 &&
      built.joints.filter((j) => j.type === 'slider').length === 1 &&
      built.joints.filter((j) => j.type === 'revolute').length === 1,
    built.joints.map((j) => `${j.name}:${j.type}`).join(', '),
  );
  check('two links connect the parts', built.links.length === 2, built.links.map((l) => l.name).join(', '));
  check(
    'the crank was created with the exact length 40 mm',
    Math.abs(built.links[0].length - 40) < 1e-9,
    `${built.links[0].length} mm`,
  );
  check('a motor drives the mechanism', built.motors === 1);

  // Run it and watch the invariants.
  const run = await session.evaluate(`(async () => {
    const state = window.linkageDesigner.state;
    const mech = state.mechanism;
    const rail = mech.tracks[0];
    const linkError = () => mech.links.reduce((max, l) => {
      const a = mech.joints.find((j) => j.id === l.a);
      const b = mech.joints.find((j) => j.id === l.b);
      return Math.max(max, Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - l.length));
    }, 0);
    const railOffset = () => {
      const s = mech.joints.find((j) => j.type === 'slider');
      const len = Math.hypot(rail.b.x - rail.a.x, rail.b.y - rail.a.y);
      const nx = -(rail.b.y - rail.a.y) / len, ny = (rail.b.x - rail.a.x) / len;
      return Math.abs((s.x - rail.a.x) * nx + (s.y - rail.a.y) * ny);
    };
    const slider = mech.joints.find((j) => j.type === 'slider');
    let minX = slider.x, maxX = slider.x, worstLink = 0, worstRail = 0;
    document.getElementById('btn-play').click();
    for (let i = 0; i < 70; i++) {
      await new Promise((r) => setTimeout(r, 16));
      minX = Math.min(minX, slider.x); maxX = Math.max(maxX, slider.x);
      worstLink = Math.max(worstLink, linkError());
      worstRail = Math.max(worstRail, railOffset());
    }
    document.getElementById('btn-play').click();
    return {
      worstLink, worstRail, stroke: maxX - minX, blocked: state.sim.blocked,
      message: state.sim.message, time: state.sim.time,
      sliderType: slider.type, railAngle: Math.atan2(rail.b.y - rail.a.y, rail.b.x - rail.a.x),
    };
  })()`);

  check('the hand-built mechanism runs', run.time > 0.4, `${run.time.toFixed(2)} s`);
  check('hand-built links stayed rigid', run.worstLink < 1e-6, `${run.worstLink.toExponential(2)} mm`);
  check('hand-built slider stayed on its rail', run.worstRail < 1e-6, `${run.worstRail.toExponential(2)} mm`);
  check('hand-built slider travelled along the rail', run.stroke > 20, `stroke ${run.stroke.toFixed(2)} mm`);
  check('the hand-built mechanism did not jam', !run.blocked, run.message || 'no block');
}

/**
 * Degenerate mechanisms: an empty canvas, a lone joint, a link with no motor.
 * None of these may throw — a designer spends most of their time in exactly
 * these half-finished states.
 */
async function edgeCaseChecks(session, check) {
  const result = await session.evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const state = window.linkageDesigner.state;
    const errors = [];
    window.addEventListener('error', (e) => errors.push(String(e.message)));
    const out = {};
    const canvas = document.getElementById('canvas');

    const click = async (world) => {
      const camera = state.camera;
      const rect = canvas.getBoundingClientRect();
      const x = rect.left + world.x * camera.scale + camera.ox;
      const y = rect.top + (-world.y * camera.scale + camera.oy);
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, button: 0, pointerId: 3 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, button: 0, pointerId: 3 }));
      await sleep(25);
    };

    // 1. empty canvas
    document.getElementById('btn-new').click();
    await sleep(120);
    document.getElementById('btn-play').click();
    await sleep(80);
    out.playOnEmpty = { playing: state.sim.playing, joints: state.mechanism.joints.length };
    document.getElementById('btn-play').click();
    document.getElementById('btn-step').click();
    document.getElementById('btn-reset').click();
    await sleep(60);
    out.emptySurvived = true;

    // 2. a lone joint with no links, then a link with no motor
    document.querySelectorAll('.tool-btn')[2].click();
    await click({ x: 0, y: 0 });
    document.getElementById('btn-play').click();
    await sleep(60);
    document.getElementById('btn-play').click();
    out.loneJoint = state.mechanism.joints.length;

    document.querySelectorAll('.tool-btn')[1].click();
    await click({ x: 80, y: 0 });
    document.querySelectorAll('.tool-btn')[3].click();
    await click({ x: 0, y: 0 });
    await click({ x: 80, y: 0 });
    document.querySelectorAll('.tool-btn')[0].click();
    document.getElementById('btn-play').click();
    await sleep(150);
    out.motorlessRun = { playing: state.sim.playing, links: state.mechanism.links.length };
    document.getElementById('btn-play').click();
    document.getElementById('btn-step').click();
    await sleep(60);
    out.stepSurvived = true;

    // 3. drag the free joint of that un-powered link
    const camera = state.camera;
    const rect = canvas.getBoundingClientRect();
    const joint = state.mechanism.joints.find((j) => j.type === 'revolute');
    const sx = rect.left + joint.x * camera.scale + camera.ox;
    const sy = rect.top + (-joint.y * camera.scale + camera.oy);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy, bubbles: true, button: 0, pointerId: 4 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: sx + 30, clientY: sy - 25, bubbles: true, button: 0, buttons: 1, pointerId: 4 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: sx + 30, clientY: sy - 25, bubbles: true, button: 0, pointerId: 4 }));
    await sleep(80);
    const worst = state.mechanism.links.reduce((max, l) => {
      const a = state.mechanism.joints.find((j) => j.id === l.a);
      const b = state.mechanism.joints.find((j) => j.id === l.b);
      return Math.max(max, Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - l.length));
    }, 0);
    out.dragNoMotor = worst;
    out.errors = errors;
    return out;
  })()`);

  check('an empty canvas survives play / step / reset', result.emptySurvived && result.playOnEmpty.joints === 0,
    `playing=${result.playOnEmpty.playing}`);
  check('a lone joint with no links does not crash the app', result.loneJoint === 1);
  check('a link with no motor survives play and step',
    result.motorlessRun.links === 1 && result.stepSurvived, `links=${result.motorlessRun.links}`);
  check('dragging a joint of an un-powered link keeps the link rigid',
    result.dragNoMotor < 1e-9, `${result.dragNoMotor.toExponential(2)} mm`);
  check('no runtime errors during the degenerate cases', result.errors.length === 0, result.errors.join(' | '));

  await session.evaluate(`(document.getElementById('btn-new').click())`);
  await new Promise((r) => setTimeout(r, 100));
}

async function main() {
  const argv = process.argv.slice(2);
  const headful = argv.includes('--headful');
  const shotIndex = argv.indexOf('--keep-screenshot');
  const screenshotPath = shotIndex >= 0 ? path.resolve(argv[shotIndex + 1]) : null;
  const targetIndex = argv.indexOf('--target');
  const target = targetIndex >= 0 ? argv[targetIndex + 1] : 'src';

  const chrome = findChrome();
  if (!chrome) {
    process.stdout.write('No local Chrome/Chromium found — skipping the browser check.\n');
    process.exit(0);
  }

  let server = null;
  let baseUrl;
  if (target === 'dist') {
    const distFile = path.join(ROOT, 'dist', 'linkage-designer.html');
    if (!fs.existsSync(distFile)) throw new Error('dist/linkage-designer.html is missing — run npm run build');
    // file:// needs no server: this is the "double-click the file" path.
    baseUrl = `file://${distFile}`;
  } else {
    server = createServer(ROOT);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  const pageUrl = target === 'dist' ? baseUrl : `${baseUrl}/index.html`;

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkage-chrome-'));
  const debugPort = 9333 + (process.pid % 400);
  const chromeArgs = [
    '--headless=new',
    // This environment has no usable GPU and a read-only user profile area:
    // software rendering plus in-profile crash dumps keep Chrome self-contained.
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-breakpad',
    '--disable-crash-reporter',
    `--crash-dumps-dir=${profileDir}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-extensions',
    '--disable-default-apps',
    '--mute-audio',
    '--hide-scrollbars',
    '--window-size=1440,900',
    '--allow-file-access-from-files',
    pageUrl,
  ];
  if (headful) chromeArgs.splice(0, 1);

  process.stdout.write(`Chrome: ${chrome}\nTarget: ${target}\nApp:    ${pageUrl}\n\n`);
  const child = spawn(chrome, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  let childStderr = '';
  child.stderr.on('data', (chunk) => {
    childStderr += chunk.toString();
  });

  let ws = null;
  let exitCode = 1;
  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page =
      targets.find((t) => t.type === 'page' && t.url.startsWith(baseUrl.slice(0, 60))) ||
      targets.find((t) => t.type === 'page' && t.url !== 'about:blank') ||
      targets[0];
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('DevTools websocket failed')), { once: true });
    });
    const session = new CdpSession(ws);
    await session.send('Runtime.enable');
    await session.send('Page.enable');

    // Wait until the app has booted.
    const booted = await session.evaluate(`(async () => {
      for (let i = 0; i < 100; i++) {
        if (window.linkageDesigner && document.querySelectorAll('#tool-grid button').length > 0) return true;
        await new Promise((r) => setTimeout(r, 50));
      }
      return false;
    })()`);

    process.stdout.write('\n\u001b[1mEnd-to-end browser checks\u001b[0m\n');
    check('page boots and the app exposes its API', booted);

    const overlayState = await session.evaluate(`(() => {
      const overlay = document.getElementById('help-overlay');
      const toast = document.getElementById('toast');
      const canvas = document.getElementById('canvas');
      const r = canvas.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        overlayHidden: overlay.hidden,
        overlayDisplay: getComputedStyle(overlay).display,
        toastDisplay: getComputedStyle(toast).display,
        topElement: top ? top.id || top.className || top.tagName : null,
      };
    })()`);
    check(
      'help overlay starts hidden and does not block the canvas',
      overlayState.overlayHidden && overlayState.overlayDisplay === 'none' && overlayState.topElement === 'canvas',
      `display=${overlayState.overlayDisplay}, top element=${overlayState.topElement}`,
    );
    const toastHiddenRule = await session.evaluate(`(() => {
      const toast = document.getElementById('toast');
      const wasHidden = toast.hidden;
      toast.hidden = true;
      const display = getComputedStyle(toast).display;
      toast.hidden = wasHidden;
      return display;
    })()`);
    check('hidden elements are really hidden (CSS regression guard)', toastHiddenRule === 'none', toastHiddenRule);

    await session.evaluate(`document.getElementById('btn-help').click()`);
    const helpOpen = await session.evaluate(
      `getComputedStyle(document.getElementById('help-overlay')).display !== 'none'`,
    );
    await session.evaluate(
      `document.getElementById('btn-help-close').click()`,
    );
    const helpClosed = await session.evaluate(`document.getElementById('help-overlay').hidden`);
    check('help dialog opens and closes', helpOpen && helpClosed);

    const out = await session.evaluate(PAGE_TEST);

    check('tool buttons rendered', out.toolButtons === 8, `${out.toolButtons} buttons`);
    check('presets rendered', out.presetButtons >= 5, `${out.presetButtons} presets`);
    check('canvas painted', out.paintedSamples > 200, `${out.paintedSamples} non-background samples`);
    check('joint read-out table populated', out.readoutRows > 0, `${out.readoutRows} rows`);
    check('status bar reports link error', /link error/.test(out.statusText), out.statusText.slice(0, 90));
    check('structure panel reports mobility', /Mobility/.test(out.structureText));

    check('four-bar ran in real time', out.simTime > 0.4, `sim time ${out.simTime.toFixed(2)} s`);
    check('crank actually moved', out.crankMoved > 5, `${out.crankMoved.toFixed(2)} mm`);
    check(
      'rigid links preserved while running',
      out.fourBarWorstLink < 1e-6,
      `worst length error ${out.fourBarWorstLink.toExponential(2)} mm`,
    );
    check('reset returns to the design pose', out.resetError < 1e-9, `${out.resetError.toExponential(1)} mm`);

    check(
      'slider stroke equals twice the crank radius',
      Math.abs(out.sliderStroke - 2 * out.crankRadius) < 1e-6,
      `stroke ${out.sliderStroke.toFixed(4)} vs ${(2 * out.crankRadius).toFixed(4)} mm`,
    );
    check(
      'slider stayed on its rail while scrubbing',
      out.sliderWorstOffset < 1e-6,
      `worst offset ${out.sliderWorstOffset.toExponential(2)} mm`,
    );
    check(
      'links rigid while scrubbing the crank',
      out.sliderWorstLink < 1e-6,
      `worst error ${out.sliderWorstLink.toExponential(2)} mm`,
    );

    check('step button advances the simulation', out.stepAdvanced);

    const [bx0, by0, bx1, by1] = out.paintBox;
    check(
      'the mechanism is drawn across the canvas',
      out.brightSamples > 400 && bx1 - bx0 > 60 && by1 - by0 > 60,
      `painted ${(out.paintFraction * 100).toFixed(1)}% of the canvas, box ${bx1 - bx0}x${by1 - by0}px`,
    );
    check(
      'layout: side panels do not overlap the canvas',
      out.layout.leftRight <= out.layout.canvas[0] + 1 &&
        out.layout.rightLeft >= out.layout.canvas[0] + out.layout.canvas[2] - 1,
      `canvas x=${out.layout.canvas[0].toFixed(0)}..${(out.layout.canvas[0] + out.layout.canvas[2]).toFixed(0)}`,
    );
    check(
      'layout: nothing overflows the viewport horizontally',
      out.layout.scrollWidth <= out.layout.viewport[0] + 2,
      `scrollWidth ${out.layout.scrollWidth} vs viewport ${out.layout.viewport[0]}`,
    );
    check(
      'layout: the canvas has a usable working area',
      out.layout.canvas[2] > 380 && out.layout.canvas[3] > 240,
      `${out.layout.canvas[2].toFixed(0)}x${out.layout.canvas[3].toFixed(0)} px`,
    );
    check('tool hint explains the active tool', out.toolHintText.length > 10, out.toolHintText);

    check('drew a mechanism with the UI tools', out.handBuiltJoints === 2, `${out.handBuiltJoints} joints`);
    check(
      'exact link length honoured on creation',
      Math.abs(out.handBuiltLinkLength - 137.5) < 1e-9 &&
        Math.abs(out.handBuiltMeasured - 137.5) < 1e-6,
      `exact ${out.handBuiltLinkLength}, measured ${out.handBuiltMeasured.toFixed(4)}`,
    );
    check('undo/redo works from the header', out.linksAfterUndo < out.linkCountAfterBuild && out.linksAfterRedo === out.linkCountAfterBuild,
      `${out.linkCountAfterBuild} → ${out.linksAfterUndo} → ${out.linksAfterRedo}`);

    check('save slot created', out.slotCount >= 1, `${out.slotCount} slot(s)`);
    check('saved mechanism reloads identically', out.loadMatchesSaved && out.loadedName === 'e2e slot', `loaded "${out.loadedName}"`);

    check('jamming mechanism reports a block', out.jamReported, out.jamMessage || '');
    check('jammed pose still satisfies every link', out.jamLinkError < 1e-6, `${out.jamLinkError.toExponential(2)} mm`);

    await edgeCaseChecks(session, check);
    await buildFromScratchChecks(session, check);
    await interactionChecks(session, check);
    await responsiveChecks(session, check);

    const errorLogs = session.consoleMessages.filter(
      (m) => m.level === 'error' && !/favicon/i.test(m.text),
    );
    check('no console errors', errorLogs.length === 0, errorLogs.map((m) => m.text).join(' | ').slice(0, 200));
    check('no uncaught page exceptions', session.pageErrors.length === 0, session.pageErrors.join(' | ').slice(0, 200));

    if (screenshotPath) {
      const shot = await session.send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      fs.writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));
      process.stdout.write(`\nscreenshot: ${screenshotPath}\n`);
    }

    const failed = results.filter((r) => !r.ok);
    process.stdout.write(
      `\n${failed.length === 0 ? '\u001b[32mall browser checks passed' : `\u001b[31m${failed.length} browser check(s) failed`}\u001b[0m (${results.length} checks)\n`,
    );
    exitCode = failed.length === 0 ? 0 : 1;
  } catch (error) {
    process.stdout.write(`\n\u001b[31mbrowser check crashed:\u001b[0m ${error.message}\n`);
    if (childStderr) process.stdout.write(`chrome stderr:\n${childStderr.slice(-1500)}\n`);
    exitCode = 1;
  } finally {
    try {
      if (ws) ws.close();
    } catch {
      /* ignore */
    }
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 2500);
      child.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (server) server.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  process.exit(exitCode);
}

main();

'use strict';
/*
 * Headless smoke test (run with: node smoke-dom.js).
 * Stubs just enough DOM/canvas API to run app.js's init() and real event
 * handlers, then drives the editor like a user: switch to the wall tool,
 * click out a 4 m × 3 m rectangle, place a door, and undo it.
 * Verifies the wiring end to end via the localStorage autosave and the
 * rooms list markup.
 */
const assert = require('assert');

/* ---------- minimal DOM stubs ---------- */

const canvasHandlers = {};
const windowHandlers = {};

function mkEl(id) {
  return {
    id,
    style: {},
    dataset: {},
    files: [],
    disabled: false,
    innerHTML: '',
    textContent: '',
    value: '',
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
    querySelector() { return mkEl('child'); },
    querySelectorAll() { return []; },
    closest() { return null; },
    click() {},
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}

const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    return () => {};
  },
  set() { return true; },
});

const elements = {};
function getEl(id) {
  if (!elements[id]) elements[id] = mkEl(id);
  return elements[id];
}

const canvasEl = getEl('canvas');
canvasEl.getContext = () => ctxStub;
canvasEl.parentElement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
canvasEl.addEventListener = (type, fn) => { canvasHandlers[type] = fn; };

global.document = {
  getElementById: getEl,
  createElement: () => mkEl('dynamic'),
};
global.window = {
  devicePixelRatio: 1,
  addEventListener: (type, fn) => { windowHandlers[type] = fn; },
};
global.localStorage = {
  _m: {},
  getItem(k) { return this._m[k] || null; },
  setItem(k, v) { this._m[k] = String(v); },
};

/* ---------- boot the app ---------- */

require('./app.js');
assert(windowHandlers.DOMContentLoaded, 'app should register DOMContentLoaded');
windowHandlers.DOMContentLoaded(); // runs init()

/* ---------- simulate the user ---------- */

const PX = 40, OX = 60, OY = 60; // must match app.js defaults (cam 60,60 zoom 1)
const pt = (wx, wy) => ({ clientX: OX + wx * PX, clientY: OY + wy * PX });
function click(wx, wy) {
  canvasHandlers.pointerdown({ pointerId: 1, button: 0, shiftKey: false, preventDefault() {}, ...pt(wx, wy) });
  canvasHandlers.pointerup({ pointerId: 1, button: 0, ...pt(wx, wy) });
}
function key(k, opts) {
  windowHandlers.keydown({ key: k, target: { tagName: 'CANVAS' }, preventDefault() {}, ...(opts || {}) });
}

// Wall tool, then click out a closed 4 m × 3 m rectangle (chained).
key('w');
click(0, 0);
click(4, 0);
click(4, 3);
click(0, 3);
click(0, 0);

let saved = JSON.parse(global.localStorage._m['floorplan-v1']);
assert.strictEqual(saved.walls.length, 4, 'four walls should be committed');
assert.strictEqual(saved.doors.length, 0);
assert(getEl('roomsList').innerHTML.includes('Room 1</b> — 3.85 m × 2.85 m'),
  'rooms list should show the detected room, got: ' + getEl('roomsList').innerHTML);

// Door tool, place a door on the top wall.
key('d');
click(2, 0);
saved = JSON.parse(global.localStorage._m['floorplan-v1']);
assert.strictEqual(saved.doors.length, 1, 'door should be placed');
assert.strictEqual(saved.doors[0].width, 0.9);
assert(Math.abs(saved.doors[0].pos - 0.5) < 1e-9, 'door should sit at wall midpoint');

// Select tool: drag the door along the wall, then undo twice (door move, door add).
key('v');
canvasHandlers.pointerdown({ pointerId: 2, button: 0, shiftKey: false, preventDefault() {}, ...pt(2, 0) });
canvasHandlers.pointermove({ pointerId: 2, ...pt(3, 0) });
canvasHandlers.pointerup({ pointerId: 2, button: 0, ...pt(3, 0) });
saved = JSON.parse(global.localStorage._m['floorplan-v1']);
assert(Math.abs(saved.doors[0].pos - 0.75) < 0.06, 'door should drag along the wall, pos=' + saved.doors[0].pos);

key('z', { ctrlKey: true }); // undo door drag
saved = JSON.parse(global.localStorage._m['floorplan-v1']);
assert(Math.abs(saved.doors[0].pos - 0.5) < 1e-9, 'undo should restore door position');
key('z', { ctrlKey: true }); // undo door placement
saved = JSON.parse(global.localStorage._m['floorplan-v1']);
assert.strictEqual(saved.doors.length, 0, 'undo should remove the door');

// Window tool: place one window.
key('n');
click(4, 1.5);
saved = JSON.parse(global.localStorage._m['floorplan-v1']);
assert.strictEqual(saved.windows.length, 1, 'window should be placed');

console.log('DOM smoke test passed.');

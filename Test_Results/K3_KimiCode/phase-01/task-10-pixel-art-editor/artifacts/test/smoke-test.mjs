// Smoke test for app.js — runs the real editor script against a minimal
// fake DOM/canvas in Node, and asserts each required feature works:
// drawing, erasing, color selection, brush size, undo/redo, zoom, PNG export.
//
// Run: node test/smoke-test.mjs

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'app.js'), 'utf8');

// ---------- Fake canvas 2D context with real pixel storage ----------
function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

class FakeCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.imageSmoothingEnabled = true;
    this.reset();
  }
  reset() {
    this._data = new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4);
  }
  _clampRect(x, y, w, h) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(this.canvas.width, x + w), y1 = Math.min(this.canvas.height, y + h);
    return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
  }
  fillRect(x, y, w, h) {
    const [r, g, b, a] = hexToRgba(this.fillStyle);
    const [cx, cy, cw, ch] = this._clampRect(x, y, w, h);
    for (let py = cy; py < cy + ch; py++) {
      for (let px = cx; px < cx + cw; px++) {
        const i = (py * this.canvas.width + px) * 4;
        this._data[i] = r; this._data[i + 1] = g; this._data[i + 2] = b; this._data[i + 3] = a;
      }
    }
  }
  clearRect(x, y, w, h) {
    const [cx, cy, cw, ch] = this._clampRect(x, y, w, h);
    for (let py = cy; py < cy + ch; py++) {
      for (let px = cx; px < cx + cw; px++) {
        const i = (py * this.canvas.width + px) * 4;
        this._data.fill(0, i, i + 4);
      }
    }
  }
  drawImage(src, dx, dy, dw, dh) {
    const sw = src.width, sh = src.height;
    if (dw === undefined) { dw = sw; dh = sh; }
    const sdata = src.getContext('2d')._data;
    for (let py = 0; py < dh; py++) {
      for (let px = 0; px < dw; px++) {
        const sx = Math.floor((px / dw) * sw), sy = Math.floor((py / dh) * sh);
        const si = (sy * sw + sx) * 4;
        const tx = dx + px, ty = dy + py;
        if (tx < 0 || ty < 0 || tx >= this.canvas.width || ty >= this.canvas.height) continue;
        const ti = (ty * this.canvas.width + tx) * 4;
        for (let k = 0; k < 4; k++) this._data[ti + k] = sdata[si + k];
      }
    }
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const si = ((y + py) * this.canvas.width + (x + px)) * 4;
        for (let k = 0; k < 4; k++) out[(py * w + px) * 4 + k] = this._data[si + k];
      }
    }
    return { width: w, height: h, data: out };
  }
  putImageData(img, x, y) {
    for (let py = 0; py < img.height; py++) {
      for (let px = 0; px < img.width; px++) {
        const si = (py * img.width + px) * 4;
        const ti = ((y + py) * this.canvas.width + (x + px)) * 4;
        for (let k = 0; k < 4; k++) this._data[ti + k] = img.data[si + k];
      }
    }
  }
  pixel(x, y) {
    const i = (y * this.canvas.width + x) * 4;
    return [...this._data.slice(i, i + 4)];
  }
  beginPath() {} moveTo() {} lineTo() {} stroke() {} strokeRect() {}
}

// ---------- Fake DOM ----------
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.title = '';
    this._listeners = {};
    const classes = new Set();
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : force;
        if (on) classes.add(c); else classes.delete(c);
      },
    };
  }
  addEventListener(type, fn) { (this._listeners[type] ??= []).push(fn); }
  dispatch(type, event = {}) { for (const fn of this._listeners[type] || []) fn(event); }
  appendChild(child) { this.children.push(child); }
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width || 100, height: this.height || 100 };
  }
  click() { this.dispatch('click', {}); }
}

const createdCanvases = [];
const clickedAnchors = [];

class FakeCanvas extends FakeElement {
  constructor() {
    super('canvas');
    this._w = 300; this._h = 150;
    this._ctx = new FakeCtx(this);
  }
  get width() { return this._w; }
  set width(v) { this._w = v; this._ctx.reset(); } // matches browser: resets pixels
  get height() { return this._h; }
  set height(v) { this._h = v; this._ctx.reset(); }
  getContext() { return this._ctx; }
  toDataURL(type) { return `data:${type};base64,FAKEPNG`; }
}

const elements = {};
for (const id of [
  'color-input', 'palette', 'brush-size', 'brush-size-label', 'zoom-label',
  'canvas-size', 'status-info', 'undo', 'redo', 'tool-pencil', 'tool-eraser',
  'zoom-in', 'zoom-out', 'new-canvas', 'clear', 'export',
]) elements[id] = new FakeElement('div');
elements.view = new FakeCanvas();
elements['color-input'].value = '#1a1c2c';
elements['brush-size'].value = '1';
elements['canvas-size'].value = '32';

const documentFake = {
  activeElement: null,
  getElementById: (id) => elements[id] ?? null,
  createElement(tag) {
    if (tag === 'canvas') {
      const c = new FakeCanvas();
      createdCanvases.push(c);
      return c;
    }
    const el = new FakeElement(tag);
    if (tag === 'a') {
      el.click = () => clickedAnchors.push({ href: el.href, download: el.download });
    }
    return el;
  },
};
const windowListeners = {};
const windowFake = {
  addEventListener(type, fn) { (windowListeners[type] ??= []).push(fn); },
};

vm.runInNewContext(source, { document: documentFake, window: windowFake });

// art = first canvas the script creates via document.createElement
const art = createdCanvases[0];
const artCtx = art.getContext('2d');

// ---------- Test helpers ----------
let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failures++; console.error(`FAIL  ${msg}`); }
}
function pointer(type, px, py, opts = {}) {
  const z = elements.view.width / art.width;
  elements.view.dispatch(type, {
    button: 0,
    pointerId: 1,
    clientX: (px + 0.5) * z,
    clientY: (py + 0.5) * z,
    preventDefault() {},
    ...opts,
  });
}
function key(keyName, opts = {}) {
  for (const fn of windowListeners.keydown || []) {
    fn({ key: keyName, preventDefault() {}, ...opts });
  }
}
const isTransparent = (p) => p[3] === 0;

// ---------- 1. Initialization ----------
console.log('init');
assert(art.width === 32 && art.height === 32, 'canvas starts at 32×32');
assert(elements.view.width === 32 * 16, 'view renders at 16× zoom');
assert(elements.palette.children.length === 16, 'palette has 16 swatches');
assert(elements.undo.disabled === true, 'undo disabled with empty history');

// ---------- 2. Color selection + drawing ----------
console.log('drawing & color');
elements.palette.children[3].click(); // #b13e53 red
assert(elements['color-input'].value === '#b13e53', 'palette click sets color input');

pointer('pointerdown', 0, 0);
pointer('pointermove', 5, 0);
pointer('pointerup', 5, 0);
assert(artCtx.pixel(0, 0).join() === '177,62,83,255', 'stroke start pixel drawn in selected color');
assert(artCtx.pixel(3, 0).join() === '177,62,83,255', 'fast drag interpolates line between pixels');
assert(artCtx.pixel(5, 0).join() === '177,62,83,255', 'stroke end pixel drawn');
assert(isTransparent(artCtx.pixel(0, 1)), 'neighbouring row untouched');
assert(elements.undo.disabled === false, 'undo enabled after stroke');

// ---------- 3. Eraser ----------
console.log('erasing');
elements['tool-eraser'].click();
pointer('pointerdown', 0, 0);
pointer('pointerup', 0, 0);
assert(isTransparent(artCtx.pixel(0, 0)), 'eraser clears pixel');
elements.palette.children[3].click(); // selecting a color switches back to pencil
pointer('pointerdown', 0, 0);
pointer('pointerup', 0, 0);
assert(artCtx.pixel(0, 0).join() === '177,62,83,255', 'picking a color re-selects pencil');

// right-click erases with pencil active
pointer('pointerdown', 5, 0, { button: 2 });
pointer('pointerup', 5, 0, { button: 2 });
assert(isTransparent(artCtx.pixel(5, 0)), 'right-click erases');

// ---------- 4. Brush size ----------
console.log('brush size');
elements['brush-size'].value = '3';
elements['brush-size'].dispatch('input');
pointer('pointerdown', 10, 10);
pointer('pointerup', 10, 10);
assert(artCtx.pixel(9, 9)[3] === 255 && artCtx.pixel(11, 11)[3] === 255, 'size-3 brush covers 3×3 block');
assert(isTransparent(artCtx.pixel(8, 8)), 'size-3 brush does not bleed to 4×4');

// ---------- 5. Undo / redo ----------
console.log('undo/redo');
elements.undo.click(); // undo brush stamp
assert(isTransparent(artCtx.pixel(10, 10)), 'undo removes brush stroke');
elements.undo.click(); // undo right-click erase (restores pixel 5,0)
assert(artCtx.pixel(5, 0).join() === '177,62,83,255', 'undo restores erased pixel');
elements.redo.click();
assert(isTransparent(artCtx.pixel(5, 0)), 'redo re-applies erase');
assert(elements.redo.disabled === false, 'redo stack still has entries');
while (!elements.undo.disabled) elements.undo.click();
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  if (!isTransparent(artCtx.pixel(x, y))) {
    assert(false, `canvas fully restored to blank after undoing all strokes (pixel ${x},${y} set)`);
    y = 32; break;
  }
}
assert(elements.undo.disabled, 'undo disabled once history exhausted');

// keyboard shortcut: redo everything via Ctrl+Shift+Z is covered next with one stroke
pointer('pointerdown', 2, 2);
pointer('pointerup', 2, 2);
key('z', { ctrlKey: true });
assert(isTransparent(artCtx.pixel(2, 2)), 'Ctrl+Z undoes');
key('Z', { ctrlKey: true, shiftKey: true });
assert(artCtx.pixel(2, 2)[3] === 255, 'Ctrl+Shift+Z redoes');

// ---------- 6. Zoom ----------
console.log('zoom');
elements['zoom-in'].click();
assert(elements.view.width === 32 * 32, 'zoom in doubles to 32×');
assert(elements['zoom-label'].textContent === '32×', 'zoom label updates');
elements['zoom-in'].click();
assert(elements.view.width === 32 * 32, 'zoom clamped at max 32×');
elements['zoom-out'].click();
elements['zoom-out'].click();
assert(elements.view.width === 32 * 8, 'zoom out halves to 8×');
elements.view.dispatch('wheel', { ctrlKey: true, deltaY: -1, preventDefault() {} });
assert(elements.view.width === 32 * 9, 'Ctrl+scroll zooms in by one step');
key('-');
assert(elements.view.width === 32 * 5, 'keyboard "-" zooms out (9/2 rounds to 5×)');
// zoom view must still reflect art pixels (scaled copy)
assert(elements.view.getContext('2d').pixel(2 * 5, 2 * 5)[3] === 255, 'view shows drawn pixel after zoom');

// ---------- 7. New canvas / clear ----------
console.log('new/clear');
elements['canvas-size'].value = '16';
elements['new-canvas'].click();
assert(art.width === 16 && art.height === 16, 'New creates 16×16 canvas');
assert(isTransparent(artCtx.pixel(2, 2)), 'new canvas starts blank');
elements.undo.click();
assert(art.width === 32 && art.height === 32, 'undo restores previous canvas size');
assert(artCtx.pixel(2, 2)[3] === 255, 'undo restores previous canvas content');
elements['clear'].click();
assert(isTransparent(artCtx.pixel(2, 2)), 'Clear empties the canvas');
elements.undo.click();
assert(artCtx.pixel(2, 2)[3] === 255, 'Clear is undoable');

// ---------- 8. PNG export ----------
console.log('export');
const canvasesBefore = createdCanvases.length;
elements['export'].click();
assert(clickedAnchors.length === 1, 'export triggers one download');
assert(clickedAnchors[0].download === 'pixel-art-32x32.png', 'download named pixel-art-32x32.png');
assert(clickedAnchors[0].href.startsWith('data:image/png'), 'download href is a PNG data URL');
const exportCanvas = createdCanvases[canvasesBefore];
assert(exportCanvas.width === 32 && exportCanvas.height === 32, 'export canvas is 1:1 art size');
assert(exportCanvas.getContext('2d').pixel(2, 2).join() === artCtx.pixel(2, 2).join(), 'export pixels match art');

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

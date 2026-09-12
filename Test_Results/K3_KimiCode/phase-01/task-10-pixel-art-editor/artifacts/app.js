(() => {
  'use strict';

  // ---- DOM ----
  const view = document.getElementById('view');
  const ctx = view.getContext('2d');
  const colorInput = document.getElementById('color-input');
  const paletteEl = document.getElementById('palette');
  const brushInput = document.getElementById('brush-size');
  const brushLabel = document.getElementById('brush-size-label');
  const zoomLabel = document.getElementById('zoom-label');
  const sizeSelect = document.getElementById('canvas-size');
  const statusInfo = document.getElementById('status-info');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');

  // ---- Pixel data lives on an offscreen 1:1 canvas ----
  const art = document.createElement('canvas');
  const artCtx = art.getContext('2d', { willReadFrequently: true });

  const MIN_ZOOM = 2;
  const MAX_ZOOM = 32;
  const MAX_HISTORY = 100;

  const state = {
    zoom: 16,
    tool: 'pencil',       // 'pencil' | 'eraser'
    color: '#1a1c2c',
    brushSize: 1,
    drawing: false,
    strokeTool: 'pencil', // tool locked in for the current stroke
    lastPixel: null,
    hoverPixel: null,
    undoStack: [],
    redoStack: [],
  };

  const PALETTE = [
    '#000000', '#1a1c2c', '#5d275d', '#b13e53',
    '#ef7d57', '#ffcd75', '#a7f070', '#38b764',
    '#257179', '#29366f', '#3b5dc9', '#41a6f6',
    '#73eff7', '#f4f4f4', '#94b0c2', '#566c86',
  ];

  // ---- History ----
  function snapshot() {
    return {
      w: art.width,
      h: art.height,
      data: artCtx.getImageData(0, 0, art.width, art.height),
    };
  }

  function restore(snap) {
    if (art.width !== snap.w || art.height !== snap.h) {
      art.width = snap.w;
      art.height = snap.h;
    }
    artCtx.putImageData(snap.data, 0, 0);
    redraw();
  }

  function pushUndo() {
    state.undoStack.push(snapshot());
    if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
    state.redoStack.length = 0;
    updateHistoryButtons();
  }

  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(snapshot());
    restore(state.undoStack.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(snapshot());
    restore(state.redoStack.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    undoBtn.disabled = state.undoStack.length === 0;
    redoBtn.disabled = state.redoStack.length === 0;
  }

  // ---- Rendering ----
  function redraw() {
    const z = state.zoom;
    view.width = art.width * z;
    view.height = art.height * z;
    ctx.imageSmoothingEnabled = false;

    // Checkerboard so transparent pixels are visible.
    const c = Math.max(2, Math.round(z / 2));
    for (let y = 0, row = 0; y < view.height; y += c, row++) {
      for (let x = 0, col = 0; x < view.width; x += c, col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#3a3f4a' : '#2e333c';
        ctx.fillRect(x, y, c, c);
      }
    }

    ctx.drawImage(art, 0, 0, view.width, view.height);

    if (z >= 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= art.width; x++) {
        ctx.moveTo(x * z + 0.5, 0);
        ctx.lineTo(x * z + 0.5, view.height);
      }
      for (let y = 0; y <= art.height; y++) {
        ctx.moveTo(0, y * z + 0.5);
        ctx.lineTo(view.width, y * z + 0.5);
      }
      ctx.stroke();
    }

    if (state.hoverPixel) {
      const o = brushOffset();
      const s = state.brushSize * z;
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        (state.hoverPixel.x - o) * z + 0.5,
        (state.hoverPixel.y - o) * z + 0.5,
        s - 1, s - 1
      );
    }

    updateStatus();
  }

  function updateStatus() {
    const pos = state.hoverPixel
      ? ` · (${state.hoverPixel.x}, ${state.hoverPixel.y})`
      : '';
    statusInfo.textContent = `${art.width}×${art.height} · ${state.zoom}× zoom${pos}`;
  }

  // ---- Drawing ----
  function brushOffset() {
    return Math.floor(state.brushSize / 2);
  }

  function stamp(px, py, tool) {
    const o = brushOffset();
    const x = px - o;
    const y = py - o;
    const s = state.brushSize;
    if (tool === 'eraser') {
      artCtx.clearRect(x, y, s, s);
    } else {
      artCtx.fillStyle = state.color;
      artCtx.fillRect(x, y, s, s);
    }
  }

  function strokeTo(px, py) {
    const from = state.lastPixel;
    if (!from) {
      stamp(px, py, state.strokeTool);
      return;
    }
    const dx = px - from.x;
    const dy = py - from.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return;
    for (let i = 1; i <= steps; i++) {
      stamp(
        from.x + Math.round((dx * i) / steps),
        from.y + Math.round((dy * i) / steps),
        state.strokeTool
      );
    }
  }

  function eventPixel(e) {
    const rect = view.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * art.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * art.height);
    return { x, y };
  }

  view.addEventListener('contextmenu', (e) => e.preventDefault());

  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    view.setPointerCapture(e.pointerId);
    state.drawing = true;
    state.strokeTool = e.button === 2 ? 'eraser' : state.tool; // right-click erases
    pushUndo();
    state.lastPixel = null;
    strokeToPixel(e);
  });

  view.addEventListener('pointermove', (e) => {
    state.hoverPixel = eventPixel(e);
    if (state.drawing) strokeToPixel(e);
    else redraw(); // move brush highlight
  });

  function strokeToPixel(e) {
    const p = eventPixel(e);
    strokeTo(p.x, p.y);
    state.lastPixel = p;
    redraw();
  }

  function endStroke() {
    state.drawing = false;
    state.lastPixel = null;
  }
  view.addEventListener('pointerup', endStroke);
  view.addEventListener('pointercancel', endStroke);
  view.addEventListener('pointerleave', () => {
    state.hoverPixel = null;
    redraw();
  });

  // Ctrl+scroll zooms, plain scroll scrolls the stage.
  view.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(state.zoom + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  // ---- Tools / colors / brush ----
  function setTool(tool) {
    state.tool = tool;
    document.getElementById('tool-pencil').classList.toggle('active', tool === 'pencil');
    document.getElementById('tool-eraser').classList.toggle('active', tool === 'eraser');
  }
  document.getElementById('tool-pencil').addEventListener('click', () => setTool('pencil'));
  document.getElementById('tool-eraser').addEventListener('click', () => setTool('eraser'));

  function setColor(hex) {
    state.color = hex;
    colorInput.value = hex;
    setTool('pencil');
    for (const el of paletteEl.children) {
      el.classList.toggle('selected', el.dataset.color === hex);
    }
  }
  colorInput.addEventListener('input', () => setColor(colorInput.value));

  for (const hex of PALETTE) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.dataset.color = hex;
    sw.style.background = hex;
    sw.title = hex;
    sw.addEventListener('click', () => setColor(hex));
    paletteEl.appendChild(sw);
  }

  function setBrushSize(n) {
    state.brushSize = Math.min(8, Math.max(1, n));
    brushInput.value = state.brushSize;
    brushLabel.textContent = state.brushSize;
    redraw();
  }
  brushInput.addEventListener('input', () => setBrushSize(Number(brushInput.value)));

  // ---- Zoom ----
  function setZoom(z) {
    state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z)));
    zoomLabel.textContent = `${state.zoom}×`;
    redraw();
  }
  document.getElementById('zoom-in').addEventListener('click', () => setZoom(state.zoom * 2));
  document.getElementById('zoom-out').addEventListener('click', () => setZoom(state.zoom / 2));

  // ---- Canvas lifecycle ----
  function newCanvas(size) {
    pushUndo();
    art.width = size;
    art.height = size; // fresh canvas is fully transparent
    redraw();
  }
  document.getElementById('new-canvas').addEventListener('click', () => {
    newCanvas(Number(sizeSelect.value));
  });
  document.getElementById('clear').addEventListener('click', () => {
    pushUndo();
    artCtx.clearRect(0, 0, art.width, art.height);
    redraw();
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  // ---- Export ----
  document.getElementById('export').addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = art.width;
    out.height = art.height;
    out.getContext('2d').drawImage(art, 0, 0);
    const link = document.createElement('a');
    link.download = `pixel-art-${art.width}x${art.height}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  });

  // ---- Keyboard shortcuts ----
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (mod) return;

    switch (e.key) {
      case 'b': case 'B': setTool('pencil'); break;
      case 'e': case 'E': setTool('eraser'); break;
      case '[': setBrushSize(state.brushSize - 1); break;
      case ']': setBrushSize(state.brushSize + 1); break;
      case '+': case '=': setZoom(state.zoom * 2); break;
      case '-': case '_': setZoom(state.zoom / 2); break;
    }
  });

  // ---- Init ----
  newCanvasBare(32);
  function newCanvasBare(size) {
    art.width = size;
    art.height = size;
  }
  setColor(state.color);
  setBrushSize(1);
  setZoom(16);
  updateHistoryButtons();
})();

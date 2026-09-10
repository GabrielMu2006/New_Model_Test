(() => {
  'use strict';

  const GRID = 32;
  const EMPTY = null;
  const colors = ['#17151f', '#51475f', '#f5efff', '#ff5c7a', '#ff9b6a', '#ffd166', '#62d49d', '#40c6d4', '#508cff', '#9d7bff'];
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  const preview = document.getElementById('previewCanvas');
  const previewCtx = preview.getContext('2d');
  let toastTimer;
  let statusTimer;
  const state = {
    pixels: Array(GRID * GRID).fill(EMPTY),
    tool: 'draw', color: '#ff5c7a', brush: 1, scale: 16,
    drawing: false, strokeChanged: false, lastCell: null,
    undo: [], redo: []
  };

  const checkerA = '#dedce1';
  const checkerB = '#c6c3ca';
  const byId = id => document.getElementById(id);

  function resizeCanvas() {
    const size = GRID * state.scale;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    byId('zoomValue').value = `${state.scale * 100}%`;
    byId('zoomValue').textContent = `${state.scale * 100}%`;
    render();
  }

  function render() {
    const s = state.scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        ctx.fillStyle = (x + y) % 2 ? checkerB : checkerA;
        ctx.fillRect(x * s, y * s, s, s);
        const color = state.pixels[y * GRID + x];
        if (color) { ctx.fillStyle = color; ctx.fillRect(x * s, y * s, s, s); }
      }
    }
    if (s >= 12) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(42, 37, 52, .17)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID; i++) {
        const p = i * s + .5;
        ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height);
        ctx.moveTo(0, p); ctx.lineTo(canvas.width, p);
      }
      ctx.stroke();
    }
    renderPreview();
  }

  function renderPreview() {
    previewCtx.clearRect(0, 0, GRID, GRID);
    state.pixels.forEach((color, index) => {
      if (!color) return;
      previewCtx.fillStyle = color;
      previewCtx.fillRect(index % GRID, Math.floor(index / GRID), 1, 1);
    });
  }

  function snapshot() { return state.pixels.slice(); }
  function pushUndo(before) {
    if (!state.strokeChanged) return;
    state.undo.push(before);
    if (state.undo.length > 80) state.undo.shift();
    state.redo.length = 0;
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    byId('undoButton').disabled = state.undo.length === 0;
    byId('redoButton').disabled = state.redo.length === 0;
  }
  function undo() {
    if (!state.undo.length) return;
    state.redo.push(snapshot()); state.pixels = state.undo.pop();
    updateHistoryButtons(); render(); setStatus('Undo');
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot()); state.pixels = state.redo.pop();
    updateHistoryButtons(); render(); setStatus('Redo');
  }

  function setPixel(x, y, erase = false) {
    const offset = Math.floor((state.brush - 1) / 2);
    const value = erase || state.tool === 'erase' ? EMPTY : state.color;
    for (let by = 0; by < state.brush; by++) {
      for (let bx = 0; bx < state.brush; bx++) {
        const px = x + bx - offset, py = y + by - offset;
        if (px < 0 || py < 0 || px >= GRID || py >= GRID) continue;
        const index = py * GRID + px;
        if (state.pixels[index] !== value) { state.pixels[index] = value; state.strokeChanged = true; }
      }
    }
  }

  function drawLine(a, b, erase) {
    let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      setPixel(x0, y0, erase);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function cellFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(GRID - 1, Math.floor((event.clientX - rect.left) / rect.width * GRID))),
      y: Math.max(0, Math.min(GRID - 1, Math.floor((event.clientY - rect.top) / rect.height * GRID)))
    };
  }

  let beforeStroke = null;
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    state.drawing = true; state.strokeChanged = false; beforeStroke = snapshot();
    state.lastCell = cellFromEvent(event);
    setPixel(state.lastCell.x, state.lastCell.y, event.button === 2);
    render();
  });
  canvas.addEventListener('pointermove', event => {
    const cell = cellFromEvent(event);
    byId('cursorPosition').textContent = `X ${String(cell.x).padStart(2, '0')}   Y ${String(cell.y).padStart(2, '0')}`;
    if (!state.drawing) return;
    drawLine(state.lastCell, cell, (event.buttons & 2) === 2);
    state.lastCell = cell; render();
  });
  function endStroke() {
    if (!state.drawing) return;
    state.drawing = false; pushUndo(beforeStroke); state.lastCell = null;
    setStatus(state.tool === 'erase' ? 'Pixels erased' : 'Stroke added');
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('pointerleave', () => { byId('cursorPosition').innerHTML = 'X — &nbsp; Y —'; });
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  function chooseTool(tool) {
    state.tool = tool;
    document.querySelectorAll('.tool').forEach(button => {
      const active = button.dataset.tool === tool;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
    });
    setStatus(tool === 'draw' ? 'Pencil selected' : 'Eraser selected');
  }
  document.querySelectorAll('.tool').forEach(button => button.addEventListener('click', () => chooseTool(button.dataset.tool)));
  document.querySelectorAll('.brush-size').forEach(button => button.addEventListener('click', () => {
    state.brush = Number(button.dataset.size);
    document.querySelectorAll('.brush-size').forEach(item => {
      const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-checked', active);
    });
    setStatus(`${state.brush} px brush`);
  }));

  function chooseColor(color) {
    state.color = color.toLowerCase(); chooseTool('draw');
    byId('colorInput').value = state.color;
    byId('colorPreview').style.background = state.color;
    byId('colorValue').textContent = state.color.toUpperCase();
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color === state.color));
  }
  colors.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button'; swatch.className = 'swatch'; swatch.dataset.color = color;
    swatch.style.background = color; swatch.setAttribute('aria-label', `Use color ${color}`);
    swatch.addEventListener('click', () => chooseColor(color)); byId('palette').appendChild(swatch);
  });
  byId('colorInput').addEventListener('input', event => chooseColor(event.target.value));
  byId('colorPreview').addEventListener('click', () => byId('colorInput').click());
  chooseColor(state.color);

  function setZoom(next) {
    state.scale = Math.max(8, Math.min(24, next));
    byId('zoomSlider').value = state.scale; resizeCanvas();
  }
  byId('zoomSlider').addEventListener('input', event => setZoom(Number(event.target.value)));
  byId('zoomOut').addEventListener('click', () => setZoom(state.scale - 2));
  byId('zoomIn').addEventListener('click', () => setZoom(state.scale + 2));
  byId('undoButton').addEventListener('click', undo);
  byId('redoButton').addEventListener('click', redo);

  byId('clearButton').addEventListener('click', () => {
    if (state.pixels.every(pixel => pixel === EMPTY)) return;
    const before = snapshot(); state.pixels.fill(EMPTY); state.strokeChanged = true; pushUndo(before); render(); setStatus('Canvas cleared');
  });

  byId('exportButton').addEventListener('click', () => {
    const output = document.createElement('canvas'); output.width = GRID; output.height = GRID;
    const out = output.getContext('2d');
    state.pixels.forEach((color, index) => {
      if (!color) return; out.fillStyle = color; out.fillRect(index % GRID, Math.floor(index / GRID), 1, 1);
    });
    const link = document.createElement('a');
    link.download = `bitty-art-${new Date().toISOString().slice(0, 10)}.png`; link.href = output.toDataURL('image/png'); link.click();
    showToast('PNG exported at 32 × 32'); setStatus('Export complete');
  });

  document.addEventListener('keydown', event => {
    if (event.target.matches('input')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    else if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    else if (event.key.toLowerCase() === 'p') chooseTool('draw');
    else if (event.key.toLowerCase() === 'e') chooseTool('erase');
  });

  function showToast(message) {
    const toast = byId('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  function setStatus(message) {
    clearTimeout(statusTimer); byId('statusText').textContent = message;
    statusTimer = setTimeout(() => { byId('statusText').textContent = 'Ready to draw'; }, 1800);
  }

  resizeCanvas();
})();

'use strict';

/* ============================================================
 * Pure geometry helpers (also used by test.js via module.exports)
 * ============================================================ */

function snap(v, step) {
  return Math.round(v / step) * step;
}

function wallLength(w) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function projectParam(px, py, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const l2 = dx * dx + dy * dy;
  return l2 ? ((px - w.x1) * dx + (py - w.y1) * dy) / l2 : 0;
}

function wallPoint(w, t) {
  return { x: w.x1 + (w.x2 - w.x1) * t, y: w.y1 + (w.y2 - w.y1) * t };
}

function wallNormal(w) {
  const L = wallLength(w) || 1;
  return { x: -(w.y2 - w.y1) / L, y: (w.x2 - w.x1) / L };
}

/* ============================================================
 * Room detection.
 * Walls are rasterized onto a fine grid (door spans stay open,
 * windows stay closed), the exterior is flood-filled from the
 * grid border, and every remaining connected pocket of free
 * cells is a room. Dimensions are the interior bounding box
 * measured between wall inner faces; area is cell-based.
 * ============================================================ */

function computeRooms(walls, doors, opts) {
  opts = opts || {};
  const TH = opts.thickness || 0.15;
  let res = opts.res || 0.05;
  if (!walls.length) return { rooms: [], grid: null };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2);
    maxY = Math.max(maxY, w.y1, w.y2);
  }
  const M = 0.5; // margin around the plan so the exterior can be flood-filled
  minX -= M; minY -= M; maxX += M; maxY += M;

  let W, H;
  for (;;) {
    W = Math.max(1, Math.ceil((maxX - minX) / res));
    H = Math.max(1, Math.ceil((maxY - minY) / res));
    if (W * H <= 2000000 || res >= 0.5) break;
    res *= 2; // very large plans: coarsen to bound the cell count
  }

  // Passable spans (doors only), per wall, as [t0, t1] parameter ranges.
  const spans = walls.map(w => {
    const L = wallLength(w) || 1;
    return doors
      .filter(d => d.wallId === w.id)
      .map(d => {
        const half = d.width / 2 / L;
        const jamb = 0.06 / L;
        return [d.pos - half + jamb, d.pos + half - jamb];
      });
  });

  const N = W * H;
  const blocked = new Uint8Array(N);
  // Cells whose center sits exactly on the wall inner face count as interior;
  // the epsilon makes that boundary classification float-deterministic.
  const halfTh2 = (TH / 2 - 1e-6) * (TH / 2 - 1e-6);
  for (let j = 0; j < H; j++) {
    const y = minY + (j + 0.5) * res;
    for (let i = 0; i < W; i++) {
      const x = minX + (i + 0.5) * res;
      let b = 0;
      for (let k = 0; k < walls.length; k++) {
        const w = walls[k];
        const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
        const l2 = dx * dx + dy * dy;
        const u = l2 ? ((x - w.x1) * dx + (y - w.y1) * dy) / l2 : 0;
        const cu = Math.max(0, Math.min(1, u));
        const cx = w.x1 + cu * dx, cy = w.y1 + cu * dy;
        const ddx = x - cx, ddy = y - cy;
        if (ddx * ddx + ddy * ddy < halfTh2) {
          let pass = false;
          for (const s of spans[k]) {
            if (u > s[0] && u < s[1]) { pass = true; break; }
          }
          if (!pass) { b = 1; break; }
        }
      }
      blocked[j * W + i] = b;
    }
  }

  // Flood-fill the exterior from the border.
  const outside = new Uint8Array(N);
  const stack = [];
  function seed(j, i) {
    const idx = j * W + i;
    if (!blocked[idx] && !outside[idx]) { outside[idx] = 1; stack.push(idx); }
  }
  function tryFill(idx) {
    if (!blocked[idx] && !outside[idx]) { outside[idx] = 1; stack.push(idx); }
  }
  for (let i = 0; i < W; i++) { seed(0, i); seed(H - 1, i); }
  for (let j = 0; j < H; j++) { seed(j, 0); seed(j, W - 1); }
  while (stack.length) {
    const idx = stack.pop();
    const i = idx % W, j = (idx - i) / W;
    if (i > 0) tryFill(idx - 1);
    if (i < W - 1) tryFill(idx + 1);
    if (j > 0) tryFill(idx - W);
    if (j < H - 1) tryFill(idx + W);
  }

  // Remaining free pockets are rooms.
  const visited = new Uint8Array(N);
  const rooms = [];
  for (let idx0 = 0; idx0 < N; idx0++) {
    if (blocked[idx0] || outside[idx0] || visited[idx0]) continue;
    const cells = [];
    let minI = W, maxI = 0, minJ = H, maxJ = 0;
    visited[idx0] = 1;
    const q = [idx0];
    while (q.length) {
      const idx = q.pop();
      cells.push(idx);
      const i = idx % W, j = (idx - i) / W;
      if (i < minI) minI = i;
      if (i > maxI) maxI = i;
      if (j < minJ) minJ = j;
      if (j > maxJ) maxJ = j;
      const nb = [];
      if (i > 0) nb.push(idx - 1);
      if (i < W - 1) nb.push(idx + 1);
      if (j > 0) nb.push(idx - W);
      if (j < H - 1) nb.push(idx + W);
      for (const n of nb) {
        if (!blocked[n] && !outside[n] && !visited[n]) { visited[n] = 1; q.push(n); }
      }
    }
    rooms.push({
      area: cells.length * res * res,
      width: (maxI - minI) * res,
      height: (maxJ - minJ) * res,
      cx: minX + (minI + maxI + 1) / 2 * res,
      cy: minY + (minJ + maxJ + 1) / 2 * res,
      cells,
    });
  }
  rooms.sort((a, b) => b.area - a.area);
  return {
    rooms: rooms.filter(r => r.area >= 1), // ignore slivers between walls
    grid: { minX, minY, res, W, H },
  };
}

/* ============================================================
 * Editor (browser only below this line)
 * ============================================================ */

const PX = 40;          // canvas pixels per meter at zoom 1
const SNAP_STEP = 0.25; // meters
const WALL_TH = 0.15;   // wall thickness in meters
const DOOR_W = 0.9;
const WINDOW_W = 1.2;
const STORE_KEY = 'floorplan-v1';

let state = { walls: [], doors: [], windows: [], nextId: 1 };
let roomData = { rooms: [], grid: null };
let tool = 'select';
let selected = null;       // { kind: 'wall'|'door'|'window', id }
let pendingStart = null;   // first point of the wall being drawn
let mouse = { sx: 0, sy: 0, wx: 0, wy: 0, inside: false };
let dragInfo = null;
let panInfo = null;
let spaceDown = false;
let hoverPlace = null;     // ghost placement for door/window tools
let showLengths = true;
const cam = { x: 60, y: 60, z: 1 };
let canvas = null, ctx = null, dpr = 1;
let history = [];
let hIndex = -1;
let els = {};

function nid() { return state.nextId++; }
function getWall(id) { return state.walls.find(w => w.id === id); }
function getDoor(id) { return state.doors.find(d => d.id === id); }
function getWindow(id) { return state.windows.find(d => d.id === id); }

function worldToScreen(wx, wy) {
  return { x: wx * PX * cam.z + cam.x, y: wy * PX * cam.z + cam.y };
}
function screenToWorld(sx, sy) {
  return { x: (sx - cam.x) / (PX * cam.z), y: (sy - cam.y) / (PX * cam.z) };
}
function eventPos(e) {
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const w = screenToWorld(sx, sy);
  return { sx, sy, wx: w.x, wy: w.y };
}
function snappedPoint(p) {
  return { x: snap(p.x, SNAP_STEP), y: snap(p.y, SNAP_STEP) };
}

/* ---------- persistence / history ---------- */

function snapshot() { return JSON.stringify(state); }

function saveLocal() {
  try { localStorage.setItem(STORE_KEY, snapshot()); } catch (e) { /* ignore */ }
}

function normalizeState(d) {
  const s = { walls: [], doors: [], windows: [], nextId: 1 };
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
  let maxId = 0;
  for (const w of (d && d.walls) || []) {
    if (!w) continue;
    const o = { id: num(w.id), x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2) };
    if (!o.id) o.id = ++maxId;
    if (wallLength(o) >= 0.05) { s.walls.push(o); maxId = Math.max(maxId, o.id); }
  }
  const hasWall = id => s.walls.some(w => w.id === id);
  for (const dr of (d && d.doors) || []) {
    if (!dr || !hasWall(dr.wallId)) continue;
    const o = {
      id: num(dr.id) || ++maxId,
      wallId: dr.wallId,
      pos: Math.max(0, Math.min(1, num(dr.pos))),
      width: Math.max(0.5, Math.min(2, num(dr.width) || DOOR_W)),
      swing: dr.swing === -1 ? -1 : 1,
    };
    s.doors.push(o); maxId = Math.max(maxId, o.id);
  }
  for (const wn of (d && d.windows) || []) {
    if (!wn || !hasWall(wn.wallId)) continue;
    const o = {
      id: num(wn.id) || ++maxId,
      wallId: wn.wallId,
      pos: Math.max(0, Math.min(1, num(wn.pos))),
      width: Math.max(0.4, Math.min(3, num(wn.width) || WINDOW_W)),
    };
    s.windows.push(o); maxId = Math.max(maxId, o.id);
  }
  s.nextId = maxId + 1;
  return s;
}

function loadLocal() {
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s) state = normalizeState(JSON.parse(s));
  } catch (e) { /* start empty */ }
}

function pushHistory() {
  const s = snapshot();
  if (history[hIndex] === s) return;
  history = history.slice(0, hIndex + 1);
  history.push(s);
  if (history.length > 100) history.shift();
  hIndex = history.length - 1;
  updateUndoButtons();
}

function undo() {
  if (hIndex <= 0) return;
  hIndex--;
  state = JSON.parse(history[hIndex]);
  selected = null; pendingStart = null; dragInfo = null;
  afterStateChange();
  updateUndoButtons();
}

function redo() {
  if (hIndex >= history.length - 1) return;
  hIndex++;
  state = JSON.parse(history[hIndex]);
  selected = null; pendingStart = null; dragInfo = null;
  afterStateChange();
  updateUndoButtons();
}

function updateUndoButtons() {
  if (!els.btnUndo) return;
  els.btnUndo.disabled = hIndex <= 0;
  els.btnRedo.disabled = hIndex >= history.length - 1;
}

/* Remove/clamp openings whose host wall shrank; drop zero-length walls. */
function cleanup() {
  state.walls = state.walls.filter(w => wallLength(w) >= 0.05);
  const keepOpening = o => {
    const w = getWall(o.wallId);
    if (!w) return false;
    const L = wallLength(w);
    if (L < o.width + 0.12) return false;
    const margin = (o.width / 2 + 0.06) / L;
    o.pos = Math.max(margin, Math.min(1 - margin, o.pos));
    return true;
  };
  state.doors = state.doors.filter(keepOpening);
  state.windows = state.windows.filter(keepOpening);
}

function commit(fn) {
  fn();
  cleanup();
  pushHistory();
  afterStateChange();
}

function afterStateChange() {
  roomData = computeRooms(state.walls, state.doors, { thickness: WALL_TH });
  renderRoomsList();
  updatePanel();
  saveLocal();
  redraw();
}

/* ---------- rendering ---------- */

function resize() {
  const wrap = canvas.parentElement;
  const r = wrap.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  redraw();
}

function redraw() {
  if (!ctx) return;
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, cw, ch);
  drawGrid(cw, ch);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(PX * cam.z, PX * cam.z);
  if (!dragInfo && !panInfo) drawRooms(); // room tint is refreshed on drop
  drawWalls();
  drawOpenings();
  drawGhostAndPending();
  ctx.restore();
  drawLabels();
}

function drawGrid(cw, ch) {
  const tl = screenToWorld(0, 0), br = screenToWorld(cw, ch);
  ctx.lineWidth = 1;
  for (const [step, color] of [[0.5, '#eeece8'], [1, '#dfdbd4']]) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = Math.ceil(tl.x / step) * step; x <= br.x + 1e-9; x += step) {
      const sx = Math.round(worldToScreen(x, 0).x) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, ch);
    }
    for (let y = Math.ceil(tl.y / step) * step; y <= br.y + 1e-9; y += step) {
      const sy = Math.round(worldToScreen(0, y).y) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(cw, sy);
    }
    ctx.stroke();
  }
}

function drawRooms() {
  const g = roomData.grid;
  if (!g) return;
  const fills = ['#dde8d9', '#dbe4ec', '#eee6d8', '#e7dfe9', '#dce9e6', '#ece0d7'];
  roomData.rooms.forEach((r, ri) => {
    ctx.fillStyle = fills[ri % fills.length];
    for (const idx of r.cells) {
      const i = idx % g.W, j = (idx - i) / g.W;
      ctx.fillRect(g.minX + i * g.res - 0.001, g.minY + j * g.res - 0.001, g.res + 0.002, g.res + 0.002);
    }
  });
}

function fillQuad(p1, p2, n, half, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p1.x + n.x * half, p1.y + n.y * half);
  ctx.lineTo(p2.x + n.x * half, p2.y + n.y * half);
  ctx.lineTo(p2.x - n.x * half, p2.y - n.y * half);
  ctx.lineTo(p1.x - n.x * half, p1.y - n.y * half);
  ctx.closePath();
  ctx.fill();
}

function wallSpans(w) {
  // Sorted [t0, t1] parameter ranges cut out of the wall by doors/windows.
  const L = wallLength(w) || 1;
  const ops = [];
  for (const d of state.doors) if (d.wallId === w.id) ops.push({ t: d.pos, w: d.width });
  for (const d of state.windows) if (d.wallId === w.id) ops.push({ t: d.pos, w: d.width });
  ops.sort((a, b) => a.t - b.t);
  return ops.map(o => [o.t - o.w / 2 / L, o.t + o.w / 2 / L]);
}

function hasNeighbor(wall, x, y) {
  for (const w of state.walls) {
    if (w === wall) continue;
    if (Math.hypot(w.x1 - x, w.y1 - y) < 1e-6) return true;
    if (Math.hypot(w.x2 - x, w.y2 - y) < 1e-6) return true;
  }
  return false;
}

function drawWalls() {
  const half = WALL_TH / 2;
  for (const w of state.walls) {
    const isSel = selected && selected.kind === 'wall' && selected.id === w.id;
    const color = isSel ? '#205d9e' : '#3a3733';
    const n = wallNormal(w);
    const spans = wallSpans(w);
    let cur = 0;
    const pieces = [];
    for (const s of spans) {
      if (s[0] - cur > 0.002) pieces.push([cur, s[0]]);
      cur = s[1];
    }
    if (1 - cur > 0.002) pieces.push([cur, 1]);
    for (const [t0, t1] of pieces) {
      fillQuad(wallPoint(w, t0), wallPoint(w, t1), n, half, color);
    }
    // round join caps where this wall meets another
    for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      if (hasNeighbor(w, x, y)) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawDoor(wall, d, ghost) {
  const L = wallLength(wall);
  const dir = { x: (wall.x2 - wall.x1) / L, y: (wall.y2 - wall.y1) / L };
  const n = wallNormal(wall);
  const c = wallPoint(wall, d.pos);
  const half = d.width / 2;
  const hinge = { x: c.x - dir.x * half, y: c.y - dir.y * half };
  const gapEnd = { x: c.x + dir.x * half, y: c.y + dir.y * half };
  const alpha = ghost ? 0.45 : 1;
  // jambs
  ctx.globalAlpha = alpha;
  for (const p of [hinge, gapEnd]) {
    const j1 = { x: p.x - dir.x * 0.03, y: p.y - dir.y * 0.03 };
    const j2 = { x: p.x + dir.x * 0.03, y: p.y + dir.y * 0.03 };
    fillQuad(j1, j2, n, WALL_TH / 2, '#3a3733');
  }
  // leaf at 45 degrees + swing arc
  const swing = d.swing || 1;
  const a0 = Math.atan2(dir.y, dir.x);
  const a1 = a0 + (Math.PI / 4) * swing;
  const leaf = { x: hinge.x + Math.cos(a1) * d.width, y: hinge.y + Math.sin(a1) * d.width };
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y);
  ctx.lineTo(leaf.x, leaf.y);
  ctx.stroke();
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.arc(hinge.x, hinge.y, d.width, a0, a1, swing < 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (!ghost && selected && selected.kind === 'door' && selected.id === d.id) {
    outlineGap(hinge, gapEnd, n);
  }
}

function drawWindow(wall, d, ghost) {
  const L = wallLength(wall);
  const dir = { x: (wall.x2 - wall.x1) / L, y: (wall.y2 - wall.y1) / L };
  const n = wallNormal(wall);
  const c = wallPoint(wall, d.pos);
  const half = d.width / 2;
  const p1 = { x: c.x - dir.x * half, y: c.y - dir.y * half };
  const p2 = { x: c.x + dir.x * half, y: c.y + dir.y * half };
  const off = WALL_TH / 4;
  ctx.globalAlpha = ghost ? 0.45 : 1;
  fillQuad(p1, p2, n, WALL_TH / 2, '#fbfaf7'); // backing
  ctx.strokeStyle = '#3c3c3c';
  ctx.lineWidth = 0.025;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(p1.x + n.x * off * s, p1.y + n.y * off * s);
    ctx.lineTo(p2.x + n.x * off * s, p2.y + n.y * off * s);
    ctx.stroke();
  }
  for (const p of [p1, p2]) { // end caps
    ctx.beginPath();
    ctx.moveTo(p.x + n.x * WALL_TH / 2, p.y + n.y * WALL_TH / 2);
    ctx.lineTo(p.x - n.x * WALL_TH / 2, p.y - n.y * WALL_TH / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (!ghost && selected && selected.kind === 'window' && selected.id === d.id) {
    outlineGap(p1, p2, n);
  }
}

function outlineGap(p1, p2, n) {
  const m = WALL_TH / 2 + 0.05;
  ctx.strokeStyle = '#1e6fd9';
  ctx.lineWidth = 0.03;
  ctx.setLineDash([0.1, 0.08]);
  ctx.beginPath();
  ctx.moveTo(p1.x + n.x * m, p1.y + n.y * m);
  ctx.lineTo(p2.x + n.x * m, p2.y + n.y * m);
  ctx.lineTo(p2.x - n.x * m, p2.y - n.y * m);
  ctx.lineTo(p1.x - n.x * m, p1.y - n.y * m);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawOpenings() {
  for (const d of state.doors) {
    const w = getWall(d.wallId);
    if (w) drawDoor(w, d, false);
  }
  for (const d of state.windows) {
    const w = getWall(d.wallId);
    if (w) drawWindow(w, d, false);
  }
}

function drawGhostAndPending() {
  // ghost door/window following the cursor
  if ((tool === 'door' || tool === 'window') && hoverPlace && !dragInfo) {
    const ghost = {
      id: -1, wallId: hoverPlace.wall.id, pos: hoverPlace.pos,
      width: tool === 'door' ? DOOR_W : WINDOW_W, swing: 1,
    };
    if (tool === 'door') drawDoor(hoverPlace.wall, ghost, true);
    else drawWindow(hoverPlace.wall, ghost, true);
  }
  // rubber band while drawing a wall
  if (tool === 'wall' && pendingStart) {
    const t = currentWallTarget();
    if (t) {
      ctx.strokeStyle = '#1e6fd9';
      ctx.lineWidth = WALL_TH;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(pendingStart.x, pendingStart.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.03;
      ctx.setLineDash([0.12, 0.1]);
      ctx.beginPath();
      ctx.moveTo(pendingStart.x, pendingStart.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#1e6fd9';
      ctx.fillRect(pendingStart.x - 0.07, pendingStart.y - 0.07, 0.14, 0.14);
    }
  }
}

function currentWallTarget() {
  if (!mouse.inside) return null;
  let t = snappedPoint(mouse);
  if (pendingStart && mouse.shift) {
    if (Math.abs(t.x - pendingStart.x) >= Math.abs(t.y - pendingStart.y)) t = { x: t.x, y: pendingStart.y };
    else t = { x: pendingStart.x, y: t.y };
    t = snappedPoint(t);
  }
  return t;
}

/* Screen-space text + handles (constant size regardless of zoom). */
function drawLabels() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (showLengths) {
    for (const w of state.walls) {
      const L = wallLength(w);
      if (L < 0.01) continue;
      const mid = wallPoint(w, 0.5);
      const n = wallNormal(w);
      const s = worldToScreen(mid.x + n.x * 0.32, mid.y + n.y * 0.32);
      drawText(s.x, s.y, L.toFixed(2) + ' m', '11px sans-serif', '#444', true);
    }
  }

  roomData.rooms.forEach((r, i) => {
    const s = worldToScreen(r.cx, r.cy);
    drawText(s.x, s.y - 14, 'Room ' + (i + 1), 'bold 13px sans-serif', '#2c4632', false);
    drawText(s.x, s.y + 2, r.width.toFixed(2) + ' m × ' + r.height.toFixed(2) + ' m', '11px sans-serif', '#3c3c3c', true);
    drawText(s.x, s.y + 16, r.area.toFixed(1) + ' m²', '11px sans-serif', '#6a6a6a', true);
  });

  if (tool === 'wall' && pendingStart) {
    const t = currentWallTarget();
    if (t) {
      const L = Math.hypot(t.x - pendingStart.x, t.y - pendingStart.y);
      const s = worldToScreen((pendingStart.x + t.x) / 2, (pendingStart.y + t.y) / 2);
      drawText(s.x, s.y - 10, L.toFixed(2) + ' m', 'bold 12px sans-serif', '#1e6fd9', true);
    }
  }

  // endpoint handles on the selected wall
  if (selected && selected.kind === 'wall') {
    const w = getWall(selected.id);
    if (w) {
      for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
        const s = worldToScreen(x, y);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1e6fd9';
        ctx.lineWidth = 1.5;
        ctx.fillRect(s.x - 4.5, s.y - 4.5, 9, 9);
        ctx.strokeRect(s.x - 4.5, s.y - 4.5, 9, 9);
      }
    }
  }
}

function drawText(x, y, text, font, color, bg) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bg) {
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(251,250,247,0.85)';
    ctx.fillRect(x - w / 2 - 3, y - 8, w + 6, 16);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/* ---------- hit testing ---------- */

function hitTest(p) {
  if (selected && selected.kind === 'wall') {
    const w = getWall(selected.id);
    if (w) {
      const r = 8 / (PX * cam.z);
      if (Math.hypot(p.x - w.x1, p.y - w.y1) < r) return { type: 'handle', wall: w, index: 1 };
      if (Math.hypot(p.x - w.x2, p.y - w.y2) < r) return { type: 'handle', wall: w, index: 2 };
    }
  }
  let best = null, bestD = 0.35;
  for (const d of state.doors) {
    const w = getWall(d.wallId);
    if (!w) continue;
    const c = wallPoint(w, d.pos);
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    if (dist < bestD) { bestD = dist; best = { type: 'opening', kind: 'door', obj: d }; }
  }
  for (const d of state.windows) {
    const w = getWall(d.wallId);
    if (!w) continue;
    const c = wallPoint(w, d.pos);
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    if (dist < bestD) { bestD = dist; best = { type: 'opening', kind: 'window', obj: d }; }
  }
  if (best) return best;
  best = null; bestD = WALL_TH / 2 + 0.08;
  for (const w of state.walls) {
    const dist = distToSegment(p.x, p.y, w.x1, w.y1, w.x2, w.y2);
    if (dist < bestD) { bestD = dist; best = { type: 'wall', wall: w }; }
  }
  return best;
}

function findWelded(wall, index) {
  const x = index === 1 ? wall.x1 : wall.x2;
  const y = index === 1 ? wall.y1 : wall.y2;
  const list = [];
  for (const w of state.walls) {
    if (Math.hypot(w.x1 - x, w.y1 - y) < 1e-6) list.push({ w, index: 1 });
    if (Math.hypot(w.x2 - x, w.y2 - y) < 1e-6) list.push({ w, index: 2 });
  }
  return list;
}

function findPlacement(p, width) {
  let best = null, bestD = 0.4;
  for (const w of state.walls) {
    const L = wallLength(w);
    if (L < width + 0.12) continue;
    const d = distToSegment(p.x, p.y, w.x1, w.y1, w.x2, w.y2);
    if (d < bestD) {
      const u = projectParam(p.x, p.y, w);
      const margin = (width / 2 + 0.06) / L;
      bestD = d;
      best = { wall: w, pos: Math.max(margin, Math.min(1 - margin, u)) };
    }
  }
  return best;
}

/* ---------- input handlers ---------- */

function onDown(e) {
  canvas.setPointerCapture(e.pointerId);
  const p = eventPos(e);
  mouse = { ...p, inside: true, shift: e.shiftKey };
  if (e.button === 1 || (e.button === 0 && spaceDown)) {
    panInfo = { sx: p.sx, sy: p.sy, camx: cam.x, camy: cam.y };
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  if (e.button !== 0) return;
  const wpt = { x: p.wx, y: p.wy };

  if (tool === 'wall') {
    const t = snappedPoint(wpt);
    if (!pendingStart) {
      pendingStart = t;
    } else {
      let end = t;
      if (e.shiftKey) {
        end = Math.abs(t.x - pendingStart.x) >= Math.abs(t.y - pendingStart.y)
          ? { x: t.x, y: pendingStart.y } : { x: pendingStart.x, y: t.y };
        end = snappedPoint(end);
      }
      const a = pendingStart, b = end;
      if (Math.hypot(b.x - a.x, b.y - a.y) >= SNAP_STEP) {
        commit(() => {
          state.walls.push({ id: nid(), x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        });
        pendingStart = b;
      }
    }
    redraw();
    return;
  }

  if (tool === 'door' || tool === 'window') {
    const width = tool === 'door' ? DOOR_W : WINDOW_W;
    const pl = findPlacement(wpt, width);
    if (pl) {
      commit(() => {
        if (tool === 'door') {
          state.doors.push({ id: nid(), wallId: pl.wall.id, pos: pl.pos, width, swing: 1 });
        } else {
          state.windows.push({ id: nid(), wallId: pl.wall.id, pos: pl.pos, width });
        }
      });
    }
    return;
  }

  // select tool
  const hit = hitTest(wpt);
  if (!hit) {
    selected = null;
    updatePanel();
    redraw();
    return;
  }
  if (hit.type === 'handle') {
    selected = { kind: 'wall', id: hit.wall.id };
    dragInfo = { kind: 'endpoint', welded: findWelded(hit.wall, hit.index), moved: false };
  } else if (hit.type === 'opening') {
    selected = { kind: hit.kind, id: hit.obj.id };
    dragInfo = { kind: 'opening', obj: hit.obj, moved: false };
  } else {
    selected = { kind: 'wall', id: hit.wall.id };
    const g = snappedPoint(wpt);
    dragInfo = {
      kind: 'wall', wall: hit.wall, grab: g,
      sx1: hit.wall.x1, sy1: hit.wall.y1, sx2: hit.wall.x2, sy2: hit.wall.y2,
      moved: false,
    };
  }
  updatePanel();
  redraw();
}

function onMove(e) {
  const p = eventPos(e);
  mouse = { ...p, inside: true, shift: e.shiftKey };

  if (panInfo) {
    cam.x = panInfo.camx + (p.sx - panInfo.sx);
    cam.y = panInfo.camy + (p.sy - panInfo.sy);
    updateStatus();
    redraw();
    return;
  }

  if (dragInfo) {
    const wpt = { x: p.wx, y: p.wy };
    if (dragInfo.kind === 'endpoint') {
      const t = snappedPoint(wpt);
      for (const it of dragInfo.welded) {
        if (it.index === 1) { it.w.x1 = t.x; it.w.y1 = t.y; }
        else { it.w.x2 = t.x; it.w.y2 = t.y; }
      }
      dragInfo.moved = true;
    } else if (dragInfo.kind === 'wall') {
      const t = snappedPoint(wpt);
      const dx = t.x - dragInfo.grab.x, dy = t.y - dragInfo.grab.y;
      const w = dragInfo.wall;
      w.x1 = dragInfo.sx1 + dx; w.y1 = dragInfo.sy1 + dy;
      w.x2 = dragInfo.sx2 + dx; w.y2 = dragInfo.sy2 + dy;
      dragInfo.moved = true;
    } else if (dragInfo.kind === 'opening') {
      const o = dragInfo.obj;
      const w = getWall(o.wallId);
      if (w) {
        const L = wallLength(w);
        const margin = (o.width / 2 + 0.06) / (L || 1);
        o.pos = Math.max(margin, Math.min(1 - margin, projectParam(wpt.x, wpt.y, w)));
        dragInfo.moved = true;
      }
    }
    redraw();
    return;
  }

  if (tool === 'door' || tool === 'window') {
    hoverPlace = findPlacement({ x: p.wx, y: p.wy }, tool === 'door' ? DOOR_W : WINDOW_W);
  }
  updateStatus();
  if (tool !== 'select') redraw();
}

function onUp(e) {
  if (panInfo) { panInfo = null; canvas.style.cursor = cursorForTool(); return; }
  if (dragInfo) {
    if (dragInfo.moved) {
      cleanup();
      pushHistory();
      afterStateChange();
    }
    dragInfo = null;
    redraw();
  }
}

function onLeave() {
  mouse.inside = false;
  hoverPlace = null;
  updateStatus();
  redraw();
}

function onDbl(e) {
  if (tool !== 'select') return;
  const p = eventPos(e);
  const hit = hitTest({ x: p.wx, y: p.wy });
  if (hit && hit.type === 'opening' && hit.kind === 'door') {
    const d = hit.obj;
    commit(() => { d.swing = -(d.swing || 1); });
  }
}

function onWheel(e) {
  e.preventDefault();
  const p = eventPos(e);
  const factor = Math.exp(-e.deltaY * 0.0012);
  const z = Math.max(0.25, Math.min(4, cam.z * factor));
  cam.x = p.sx - p.wx * PX * z;
  cam.y = p.sy - p.wy * PX * z;
  cam.z = z;
  updateStatus();
  redraw();
}

function onKeyDown(e) {
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const k = e.key.toLowerCase();
  if (e.key === ' ') {
    spaceDown = true;
    if (!dragInfo) canvas.style.cursor = 'grab';
    e.preventDefault();
  } else if (e.key === 'Escape' || (e.key === 'Enter' && tool === 'wall')) {
    if (dragInfo && dragInfo.moved) {
      cleanup();
      pushHistory();
      afterStateChange();
    }
    dragInfo = null;
    pendingStart = null;
    selected = null;
    updatePanel();
    redraw();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
  } else if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) {
    e.preventDefault(); undo();
  } else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) {
    e.preventDefault(); redo();
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (k === 'v') setTool('select');
    else if (k === 'w') setTool('wall');
    else if (k === 'd') setTool('door');
    else if (k === 'n') setTool('window');
  }
}

function onKeyUp(e) {
  if (e.key === ' ') {
    spaceDown = false;
    canvas.style.cursor = cursorForTool();
  }
}

/* ---------- actions ---------- */

function deleteSelected() {
  if (!selected) return;
  commit(() => {
    if (selected.kind === 'wall') {
      state.walls = state.walls.filter(w => w.id !== selected.id);
      state.doors = state.doors.filter(d => d.wallId !== selected.id);
      state.windows = state.windows.filter(d => d.wallId !== selected.id);
    } else if (selected.kind === 'door') {
      state.doors = state.doors.filter(d => d.id !== selected.id);
    } else if (selected.kind === 'window') {
      state.windows = state.windows.filter(d => d.id !== selected.id);
    }
  });
  selected = null;
  updatePanel();
  redraw();
}

function cursorForTool() {
  return tool === 'select' ? 'default' : 'crosshair';
}

const TOOL_HINTS = {
  select: 'Click to select · drag to move · drag handles to reshape · double-click a door to flip its swing',
  wall: 'Click to start a wall · click to finish (chains) · Shift = straight · Esc/Enter = stop',
  door: 'Click a wall to place a door (0.9 m) — drag it along the wall afterwards',
  window: 'Click a wall to place a window (1.2 m) — drag it along the wall afterwards',
};

function setTool(t) {
  tool = t;
  pendingStart = null;
  hoverPlace = null;
  dragInfo = null;
  for (const b of els.tools.querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.tool === t);
  }
  els.statusTool.textContent = TOOL_HINTS[t];
  canvas.style.cursor = cursorForTool();
  redraw();
}

function updateStatus() {
  els.statusPos.textContent = mouse.inside
    ? `x ${mouse.wx.toFixed(2)} m · y ${mouse.wy.toFixed(2)} m · zoom ${Math.round(cam.z * 100)}%`
    : `zoom ${Math.round(cam.z * 100)}%`;
}

function renderRoomsList() {
  if (!roomData.rooms.length) {
    els.roomsList.innerHTML = '<li class="muted">No enclosed rooms yet.</li>';
    return;
  }
  els.roomsList.innerHTML = roomData.rooms.map((r, i) =>
    `<li><b>Room ${i + 1}</b> — ${r.width.toFixed(2)} m × ${r.height.toFixed(2)} m · ${r.area.toFixed(1)} m²</li>`
  ).join('');
}

function updatePanel() {
  const p = els.panel;
  if (!selected) {
    p.innerHTML = '<p class="muted">Nothing selected.</p>';
    return;
  }
  if (selected.kind === 'wall') {
    const w = getWall(selected.id);
    if (!w) { selected = null; return updatePanel(); }
    p.innerHTML =
      '<div class="row"><b>Wall</b></div>' +
      `<div class="row">Length: ${wallLength(w).toFixed(2)} m</div>` +
      `<div class="row">Thickness: ${WALL_TH.toFixed(2)} m</div>` +
      '<div class="row"><button id="btnDeleteSel">Delete wall</button></div>';
    p.querySelector('#btnDeleteSel').addEventListener('click', deleteSelected);
  } else if (selected.kind === 'door') {
    const d = getDoor(selected.id);
    if (!d) { selected = null; return updatePanel(); }
    p.innerHTML =
      '<div class="row"><b>Door</b></div>' +
      `<div class="row"><label>Width</label><input type="number" id="inpW" min="0.6" max="1.5" step="0.05" value="${d.width.toFixed(2)}"> m</div>` +
      '<div class="row"><button id="btnFlip">Flip swing</button><button id="btnDeleteSel">Delete</button></div>';
    p.querySelector('#inpW').addEventListener('change', ev => {
      const v = Math.max(0.6, Math.min(1.5, parseFloat(ev.target.value) || d.width));
      commit(() => { d.width = v; });
    });
    p.querySelector('#btnFlip').addEventListener('click', () => commit(() => { d.swing = -(d.swing || 1); }));
    p.querySelector('#btnDeleteSel').addEventListener('click', deleteSelected);
  } else if (selected.kind === 'window') {
    const d = getWindow(selected.id);
    if (!d) { selected = null; return updatePanel(); }
    p.innerHTML =
      '<div class="row"><b>Window</b></div>' +
      `<div class="row"><label>Width</label><input type="number" id="inpW" min="0.6" max="2.4" step="0.1" value="${d.width.toFixed(2)}"> m</div>` +
      '<div class="row"><button id="btnDeleteSel">Delete</button></div>';
    p.querySelector('#inpW').addEventListener('change', ev => {
      const v = Math.max(0.6, Math.min(2.4, parseFloat(ev.target.value) || d.width));
      commit(() => { d.width = v; });
    });
    p.querySelector('#btnDeleteSel').addEventListener('click', deleteSelected);
  }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'floorplan.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.walls)) throw new Error('bad shape');
      const s = normalizeState(data);
      selected = null;
      commit(() => { state = s; });
    } catch (err) {
      alert('Could not import: not a valid floor plan JSON file.');
    }
  };
  reader.readAsText(file);
}

/* ---------- init ---------- */

function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  els = {
    tools: document.getElementById('tools'),
    panel: document.getElementById('panel'),
    roomsList: document.getElementById('roomsList'),
    statusTool: document.getElementById('statusTool'),
    statusPos: document.getElementById('statusPos'),
    chkLengths: document.getElementById('chkLengths'),
    btnUndo: document.getElementById('btnUndo'),
    btnRedo: document.getElementById('btnRedo'),
  };

  loadLocal();
  history = [snapshot()];
  hIndex = 0;

  els.tools.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setTool(b.dataset.tool);
  });
  els.chkLengths.addEventListener('change', e => { showLengths = e.target.checked; redraw(); });
  els.btnUndo.addEventListener('click', undo);
  els.btnRedo.addEventListener('click', redo);
  document.getElementById('btnResetView').addEventListener('click', () => {
    cam.x = 60; cam.y = 60; cam.z = 1;
    updateStatus();
    redraw();
  });
  document.getElementById('btnExport').addEventListener('click', exportJSON);
  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) importJSON(fileInput.files[0]);
    fileInput.value = '';
  });
  document.getElementById('btnClear').addEventListener('click', () => {
    if (!state.walls.length && !state.doors.length && !state.windows.length) return;
    if (confirm('Delete the entire plan?')) {
      commit(() => { state = { walls: [], doors: [], windows: [], nextId: 1 }; });
      selected = null;
    }
  });

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', onDbl);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resize);

  setTool('select');
  updateUndoButtons();
  updateStatus();
  resize();
  afterStateChange();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { snap, wallLength, distToSegment, projectParam, computeRooms };
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}

/*!
 * app.js — 2D floor-plan editor.
 *
 * Tools: Select · Wall · Door · Window · Furniture palette.
 * Rooms are detected from the wall graph (see geometry.js) and labelled with
 * their dimensions and area.
 */
(function () {
  'use strict';

  var G = window.FloorPlanGeom;
  if (!G) {
    document.body.innerHTML = '<p style="padding:24px;font:14px system-ui">geometry.js failed to load.</p>';
    return;
  }

  /* ============================================================
   * Presets
   * ============================================================ */

  var PRESETS = {
    bed:     { w: 1.60, h: 2.00, label: 'Bed',     fill: '#8fb6f0' },
    sofa:    { w: 2.00, h: 0.90, label: 'Sofa',    fill: '#b79ce0' },
    table:   { w: 1.40, h: 0.80, label: 'Table',   fill: '#d9b98a' },
    chair:   { w: 0.50, h: 0.50, label: 'Chair',   fill: '#cfa877' },
    desk:    { w: 1.40, h: 0.70, label: 'Desk',    fill: '#8fd0b0' },
    cabinet: { w: 1.00, h: 0.50, label: 'Cabinet', fill: '#a8b3c0' },
    plant:   { w: 0.60, h: 0.60, label: 'Plant',   fill: '#8fd08a', round: true },
    wc:      { w: 0.40, h: 0.65, label: 'WC',      fill: '#9fc7e8', round: true },
    sink:    { w: 0.60, h: 0.45, label: 'Sink',    fill: '#9fc7e8' },
    stove:   { w: 0.60, h: 0.60, label: 'Stove',   fill: '#c0c6cc' }
  };

  var THEME = {
    dark: {
      bg: '#0f1216',
      gridMinor: 'rgba(255,255,255,0.045)',
      gridMajor: 'rgba(255,255,255,0.10)',
      axis: 'rgba(90,150,230,0.30)',
      wall: '#d8e0ea', wallEdge: '#7c8896',
      roomFill: 'rgba(76,154,255,0.07)', roomStroke: 'rgba(120,170,240,0.28)',
      dim: '#6f7d8b',
      sel: '#4c9aff',
      pillBg: 'rgba(12,16,21,0.82)', pillBorder: 'rgba(255,255,255,0.10)',
      pillText: '#dbe7f5', pillDim: '#9fb4cc',
      objStroke: 'rgba(10,14,19,0.8)', objText: 'rgba(10,14,19,0.72)',
      glass: '#bfe0ff'
    },
    light: {
      bg: '#ffffff',
      gridMinor: 'rgba(0,0,0,0.05)',
      gridMajor: 'rgba(0,0,0,0.12)',
      axis: 'rgba(30,90,180,0.28)',
      wall: '#333d4a', wallEdge: '#0d1218',
      roomFill: 'rgba(76,154,255,0.10)', roomStroke: 'rgba(30,90,180,0.35)',
      dim: '#5b6673',
      sel: '#1f6feb',
      pillBg: 'rgba(255,255,255,0.92)', pillBorder: 'rgba(0,0,0,0.12)',
      pillText: '#16202b', pillDim: '#4a5766',
      objStroke: 'rgba(0,0,0,0.55)', objText: 'rgba(0,0,0,0.6)',
      glass: '#4a7fb5'
    }
  };

  /* ============================================================
   * State
   * ============================================================ */

  var S = {
    walls: [], openings: [], objects: [],
    tool: 'select', preset: 'table',
    sel: new Set(), selRoom: null,
    panX: 0, panY: 0, scale: 62,
    grid: 0.1, snap: true, showDims: true,
    wallThickness: 0.15,
    nextId: 1
  };

  var drag = { mode: 'none' };
  var chainStart = null;
  var spaceDown = false;
  var geomVersion = 0;
  var roomCache = { version: -1, list: [] };
  var undoStack = [], redoStack = [];
  var renderQueued = false;
  var paintedOnce = false;
  var saveTimer = null;

  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var $ = function (sel) { return document.querySelector(sel); };
  var statusCoords = $('#st-coords');
  var statusHint = $('#st-hint');

  /* ============================================================
   * Small helpers
   * ============================================================ */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function uid() { return S.nextId++; }
  function fmt(v, d) { return v.toFixed(d === undefined ? 2 : d); }

  function snapValue(v) { return S.snap ? Math.round(v / S.grid) * S.grid : v; }

  function snapPoint(p, mods) {
    if (!S.snap || (mods && mods.alt)) return { x: p.x, y: p.y };
    var tol = 11 / S.scale;
    var best = null;
    for (var i = 0; i < S.walls.length; i++) {
      var w = S.walls[i];
      var pts = [{ x: w.ax, y: w.ay }, { x: w.bx, y: w.by }];
      for (var j = 0; j < 2; j++) {
        var d = Math.hypot(pts[j].x - p.x, pts[j].y - p.y);
        if (d < tol && (!best || d < best.d)) best = { d: d, x: pts[j].x, y: pts[j].y };
      }
    }
    if (best) return { x: best.x, y: best.y };
    return { x: snapValue(p.x), y: snapValue(p.y) };
  }

  function constrainAngle(a, b, stepDeg) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.hypot(dx, dy);
    if (len < 1e-9) return { x: b.x, y: b.y };
    var step = (stepDeg || 45) * Math.PI / 180;
    var ang = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
  }

  function wallById(id) {
    for (var i = 0; i < S.walls.length; i++) if (S.walls[i].id === id) return S.walls[i];
    return null;
  }
  function wallEnds(w) { return [{ x: w.ax, y: w.ay }, { x: w.bx, y: w.by }]; }
  function wallLength(w) { return G.dist({ x: w.ax, y: w.ay }, { x: w.bx, y: w.by }); }
  function pointOnWall(w, t) {
    return { x: w.ax + (w.bx - w.ax) * t, y: w.ay + (w.by - w.ay) * t };
  }
  function selKey(type, id) { return type + id; }
  function parseKey(k) { return { t: k.charAt(0), id: parseInt(k.slice(1), 10) }; }
  function isSel(type, id) { return S.sel.has(selKey(type, id)); }

  /* ============================================================
   * History
   * ============================================================ */

  function snapshot() {
    return JSON.stringify({ walls: S.walls, openings: S.openings, objects: S.objects, nextId: S.nextId });
  }
  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 120) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }
  function applySnapshot(json) {
    var d = JSON.parse(json);
    S.walls = d.walls; S.openings = d.openings; S.objects = d.objects; S.nextId = d.nextId;
    S.sel.clear(); S.selRoom = null;
    invalidate(); refreshProps();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
    updateHistoryButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    $('#btn-undo').style.opacity = undoStack.length ? '1' : '0.4';
    $('#btn-redo').style.opacity = redoStack.length ? '1' : '0.4';
  }

  /* ============================================================
   * Derived geometry / rendering invalidation
   * ============================================================ */

  function invalidate() {
    geomVersion++;
    scheduleSave();
    requestRender();
  }
  function requestRender() {
    if (renderQueued) return;
    // Paint the very first frame synchronously so the canvas is never left
    // blank in environments that throttle or skip requestAnimationFrame
    // (hidden/occluded frames, some headless and automation contexts).
    if (!paintedOnce) { render(); return; }
    renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; render(); });
  }
  function rooms() {
    if (roomCache.version !== geomVersion) {
      roomCache = { version: geomVersion, list: G.detectRooms(S.walls) };
    }
    return roomCache.list;
  }
  function contentBounds() {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    function add(x, y) {
      if (x < b.minX) b.minX = x;
      if (y < b.minY) b.minY = y;
      if (x > b.maxX) b.maxX = x;
      if (y > b.maxY) b.maxY = y;
    }
    S.walls.forEach(function (w) { add(w.ax, w.ay); add(w.bx, w.by); });
    S.objects.forEach(function (o) { G.objectCorners(o).forEach(function (p) { add(p.x, p.y); }); });
    if (!isFinite(b.minX)) return null;
    b.width = b.maxX - b.minX; b.height = b.maxY - b.minY;
    return b;
  }

  /* ============================================================
   * View transform
   * ============================================================ */

  function toWorld(sx, sy) {
    return { x: (sx - S.panX) / S.scale, y: (sy - S.panY) / S.scale };
  }
  function toScreen(p) {
    return { x: p.x * S.scale + S.panX, y: p.y * S.scale + S.panY };
  }
  function screenPt(e) {
    var r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function fitView(retry) {
    var W = cv.clientWidth, H = cv.clientHeight;
    if ((!W || !H) && (retry || 0) < 10) {
      requestAnimationFrame(function () { fitView((retry || 0) + 1); });
      return;
    }
    var b = contentBounds();
    if (!b) {
      S.scale = 62; S.panX = W / 2; S.panY = H / 2 + 20;
      requestRender(); return;
    }
    var padX = 90, padTop = 90, padBottom = 70;
    var w = Math.max(b.width, 0.6), h = Math.max(b.height, 0.6);
    S.scale = clamp(Math.min((W - padX * 2) / w, (H - padTop - padBottom) / h), 6, 400);
    var cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    S.panX = W / 2 - cx * S.scale;
    S.panY = padTop + (H - padTop - padBottom) / 2 - cy * S.scale;
    requestRender();
  }

  /* ============================================================
   * Hit testing
   * ============================================================ */

  function hitWall(p, tolWorld) {
    var best = null;
    for (var i = 0; i < S.walls.length; i++) {
      var w = S.walls[i];
      var e = wallEnds(w);
      var r = G.projectOnSegment(p, e[0], e[1]);
      var d = r.dist - w.thickness / 2;
      if (d <= tolWorld && (!best || d < best.d)) best = { wall: w, d: d, proj: r };
    }
    return best;
  }

  function hitOpening(p, tolWorld) {
    var best = null;
    for (var i = 0; i < S.openings.length; i++) {
      var o = S.openings[i];
      var w = wallById(o.wallId);
      if (!w) continue;
      var e = wallEnds(w);
      var L = wallLength(w);
      var r = G.projectOnSegment(p, e[0], e[1]);
      var along = Math.abs(r.t * L - o.t * L);
      if (along <= o.width / 2 + tolWorld && r.dist <= Math.max(w.thickness, 0.16) + tolWorld) {
        if (!best || r.dist < best.d) best = { opening: o, wall: w, d: r.dist };
      }
    }
    return best;
  }

  function hitObject(p) {
    for (var i = S.objects.length - 1; i >= 0; i--) {
      if (G.pointInObject(p, S.objects[i])) return S.objects[i];
    }
    return null;
  }

  /** World position of the rotation grip above an object. */
  function objectHandle(o) {
    var c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    var lx = 0, ly = -(o.h / 2) - 0.28;
    return { x: o.x + lx * c - ly * s, y: o.y + lx * s + ly * c };
  }

  function endpointHandleHit(sp) {
    var keys = Array.from(S.sel);
    for (var i = 0; i < keys.length; i++) {
      var k = parseKey(keys[i]);
      if (k.t !== 'w') continue;
      var w = wallById(k.id);
      if (!w) continue;
      var ends = wallEnds(w);
      for (var j = 0; j < 2; j++) {
        var sc = toScreen(ends[j]);
        if (Math.hypot(sc.x - sp.x, sc.y - sp.y) <= 9) {
          return { wall: w, which: j === 0 ? 'a' : 'b' };
        }
      }
    }
    return null;
  }

  function rotateHandleHit(sp) {
    var objs = selectedObjects();
    if (objs.length !== 1) return null;
    var sc = toScreen(objectHandle(objs[0]));
    return Math.hypot(sc.x - sp.x, sc.y - sp.y) <= 11 ? objs[0] : null;
  }

  function hitRoomLabel(sp) {
    var rs = rooms();
    for (var i = 0; i < rs.length; i++) {
      var sc = toScreen(rs[i].centroid);
      if (Math.hypot(sc.x - sp.x, sc.y - sp.y) <= 58) return rs[i];
    }
    return null;
  }

  function selectedObjects() {
    var out = [];
    S.sel.forEach(function (k) {
      var p = parseKey(k);
      if (p.t !== 'o') return;
      var o = S.objects.filter(function (x) { return x.id === p.id; })[0];
      if (o) out.push(o);
    });
    return out;
  }

  /* ============================================================
   * Selection helpers
   * ============================================================ */

  function setSel(type, id) { S.sel.clear(); S.selRoom = null; S.sel.add(selKey(type, id)); }
  function toggleSel(type, id) {
    var k = selKey(type, id);
    if (S.sel.has(k)) S.sel.delete(k); else S.sel.add(k);
    S.selRoom = null;
  }

  function deleteSelection() {
    if (!S.sel.size) return;
    pushHistory();
    var keys = Array.from(S.sel);
    keys.forEach(function (k) {
      var p = parseKey(k);
      if (p.t === 'w') {
        S.walls = S.walls.filter(function (w) { return w.id !== p.id; });
        S.openings = S.openings.filter(function (o) { return o.wallId !== p.id; });
      } else if (p.t === 'o') {
        S.objects = S.objects.filter(function (o) { return o.id !== p.id; });
      } else if (p.t === 'p') {
        S.openings = S.openings.filter(function (o) { return o.id !== p.id; });
      }
    });
    S.sel.clear(); S.selRoom = null;
    invalidate(); refreshProps();
  }

  /** Mirror the swing of every selected door (Shift+F). */
  function flipSelectedDoors() {
    var targets = [];
    S.sel.forEach(function (k) {
      var p = parseKey(k);
      if (p.t !== 'p') return;
      var op = S.openings.filter(function (x) { return x.id === p.id; })[0];
      if (op && op.kind === 'door') targets.push(op);
    });
    if (!targets.length) return;
    pushHistory();
    targets.forEach(function (op) { op.flip = !op.flip; });
    invalidate(); refreshProps();
  }

  function duplicateSelection() {
    var objs = selectedObjects();
    if (!objs.length) return;
    pushHistory();
    S.sel.clear();
    objs.forEach(function (o) {
      var copy = {
        id: uid(), kind: o.kind, x: o.x + 0.4, y: o.y + 0.4,
        w: o.w, h: o.h, rot: o.rot, label: o.label, round: !!o.round
      };
      S.objects.push(copy);
      S.sel.add(selKey('o', copy.id));
    });
    invalidate(); refreshProps();
  }

  /* ============================================================
   * Drawing primitives
   * ============================================================ */

  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function pill(c, cx, cy, lines, pal, opts) {
    opts = opts || {};
    var size = opts.size || 12;
    var lh = size + 3;
    c.save();
    c.font = (opts.weight || '600') + ' ' + size + 'px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var w = 0;
    for (var i = 0; i < lines.length; i++) w = Math.max(w, c.measureText(lines[i]).width);
    var h = lines.length * lh;
    var padX = opts.padX === undefined ? 7 : opts.padX;
    var padY = opts.padY === undefined ? 4 : opts.padY;
    roundRectPath(c, cx - w / 2 - padX, cy - h / 2 - padY, w + padX * 2, h + padY * 2, 5);
    c.fillStyle = opts.bg || pal.pillBg;
    c.fill();
    if (opts.border !== false) { c.strokeStyle = pal.pillBorder; c.lineWidth = 1; c.stroke(); }
    c.fillStyle = opts.color || pal.pillText;
    for (var j = 0; j < lines.length; j++) {
      c.fillText(lines[j], cx, cy - h / 2 + lh / 2 + j * lh);
    }
    c.restore();
  }

  function drawGrid(c, x0, y0, x1, y1, s, pal) {
    var candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10];
    var step = candidates[candidates.length - 1];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] * s >= 14) { step = candidates[i]; break; }
    }
    var major = step * 5;
    c.lineWidth = 1 / s;
    c.strokeStyle = pal.gridMinor;
    c.beginPath();
    var startX = Math.floor(x0 / step) * step;
    for (var x = startX; x <= x1; x += step) {
      if (Math.abs(x % major) < 1e-6 || Math.abs(Math.abs(x % major) - major) < 1e-6) continue;
      c.moveTo(x, y0); c.lineTo(x, y1);
    }
    var startY = Math.floor(y0 / step) * step;
    for (var y = startY; y <= y1; y += step) {
      if (Math.abs(y % major) < 1e-6 || Math.abs(Math.abs(y % major) - major) < 1e-6) continue;
      c.moveTo(x0, y); c.lineTo(x1, y);
    }
    c.stroke();

    c.strokeStyle = pal.gridMajor;
    c.beginPath();
    for (var x2 = Math.floor(x0 / major) * major; x2 <= x1; x2 += major) { c.moveTo(x2, y0); c.lineTo(x2, y1); }
    for (var y2 = Math.floor(y0 / major) * major; y2 <= y1; y2 += major) { c.moveTo(x0, y2); c.lineTo(x1, y2); }
    c.stroke();

    if (x0 < 0 && x1 > 0) { c.strokeStyle = pal.axis; c.beginPath(); c.moveTo(0, y0); c.lineTo(0, y1); c.stroke(); }
    if (y0 < 0 && y1 > 0) { c.strokeStyle = pal.axis; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, 0); c.stroke(); }
  }

  /** Intervals of a wall that are NOT covered by an opening, in meters along the wall. */
  function wallSegments(w) {
    var L = wallLength(w);
    var ops = S.openings.filter(function (o) { return o.wallId === w.id; })
      .map(function (o) { return { c: o.t * L, half: o.width / 2 }; })
      .sort(function (p, q) { return p.c - q.c; });
    var segs = [], cur = 0;
    ops.forEach(function (o) {
      var s = Math.max(0, o.c - o.half), e = Math.min(L, o.c + o.half);
      if (s > cur) segs.push([cur, s]);
      cur = Math.max(cur, e);
    });
    if (cur < L) segs.push([cur, L]);
    return segs;
  }

  function drawWallQuad(c, a, b, thickness, fill, stroke, lw) {
    var q = G.wallQuad(a, b, thickness);
    c.beginPath();
    c.moveTo(q[0].x, q[0].y);
    for (var i = 1; i < 4; i++) c.lineTo(q[i].x, q[i].y);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  }

  function drawOpening(c, o, w, pal, s) {
    var a = { x: w.ax, y: w.ay }, b = { x: w.bx, y: w.by };
    var L = wallLength(w);
    var u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
    var n = { x: -u.y, y: u.x };
    var cw = { x: a.x + u.x * o.t * L, y: a.y + u.y * o.t * L };
    var half = o.width / 2;
    var t = Math.max(w.thickness, 0.08);

    if (o.kind === 'window') {
      // frame
      var p1 = { x: cw.x - u.x * half, y: cw.y - u.y * half };
      var p2 = { x: cw.x + u.x * half, y: cw.y + u.y * half };
      c.beginPath();
      c.moveTo(p1.x + n.x * t / 2, p1.y + n.y * t / 2);
      c.lineTo(p2.x + n.x * t / 2, p2.y + n.y * t / 2);
      c.lineTo(p2.x - n.x * t / 2, p2.y - n.y * t / 2);
      c.lineTo(p1.x - n.x * t / 2, p1.y - n.y * t / 2);
      c.closePath();
      c.fillStyle = pal.bg; c.fill();
      c.strokeStyle = pal.wallEdge; c.lineWidth = 1 / s; c.stroke();
      // glazing
      c.strokeStyle = pal.glass;
      c.lineWidth = Math.max(1.2 / s, t * 0.10);
      [-0.18, 0.18].forEach(function (k) {
        c.beginPath();
        c.moveTo(p1.x + n.x * t * k, p1.y + n.y * t * k);
        c.lineTo(p2.x + n.x * t * k, p2.y + n.y * t * k);
        c.stroke();
      });
    } else {
      // door: leaf + swing arc
      var sgn = o.flip ? -1 : 1;
      var hinge = {
        x: a.x + u.x * (o.t * L + sgn * -half),
        y: a.y + u.y * (o.t * L + sgn * -half)
      };
      var leafDir = { x: n.x * sgn, y: n.y * sgn };
      var wallDir = { x: u.x * sgn, y: u.y * sgn };
      var tip = { x: hinge.x + leafDir.x * o.width, y: hinge.y + leafDir.y * o.width };

      c.strokeStyle = pal.glass;
      c.lineWidth = Math.max(1 / s, t * 0.13);
      c.beginPath();
      c.moveTo(hinge.x, hinge.y);
      c.lineTo(tip.x, tip.y);
      c.stroke();

      var a0 = Math.atan2(leafDir.y, leafDir.x);
      var a1 = Math.atan2(wallDir.y, wallDir.x);
      var d = a1 - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      c.strokeStyle = pal.dim;
      c.lineWidth = 1 / s;
      c.setLineDash([3 / s, 3 / s]);
      c.beginPath();
      c.arc(hinge.x, hinge.y, o.width, a0, a1, d < 0);
      c.stroke();
      c.setLineDash([]);
    }
  }

  function drawObject(c, o, pal, s) {
    var preset = PRESETS[o.kind] || {};
    var fill = preset.fill || '#a8b3c0';
    c.save();
    c.translate(o.x, o.y);
    c.rotate(o.rot || 0);
    c.beginPath();
    if (o.round) {
      c.ellipse(0, 0, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    } else {
      roundRectPath(c, -o.w / 2, -o.h / 2, o.w, o.h, Math.min(0.06, o.w / 6, o.h / 6));
    }
    c.fillStyle = fill;
    c.globalAlpha = 0.92;
    c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = pal.objStroke;
    c.lineWidth = 1.2 / s;
    c.stroke();

    if (!o.round) {
      // subtle inner line to read as furniture
      c.beginPath();
      c.moveTo(-o.w / 2 + 0.08, -o.h / 2 + 0.08);
      c.lineTo(o.w / 2 - 0.08, -o.h / 2 + 0.08);
      c.strokeStyle = 'rgba(0,0,0,0.13)';
      c.lineWidth = 1 / s;
      c.stroke();
    }
    c.restore();
  }

  function drawDimLine(c, p1, p2, text, off, pal, labels, s, view) {
    var dx = p2.x - p1.x, dy = p2.y - p1.y;
    var L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    var u = { x: dx / L, y: dy / L };
    var n = { x: -u.y, y: u.x };
    var a = { x: p1.x + n.x * off, y: p1.y + n.y * off };
    var b = { x: p2.x + n.x * off, y: p2.y + n.y * off };
    c.strokeStyle = pal.dim;
    c.lineWidth = 1 / s;
    c.beginPath();
    c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.moveTo(p1.x, p1.y); c.lineTo(a.x + u.x * 0.12 * Math.sign(off), a.y + u.y * 0.12 * Math.sign(off));
    c.moveTo(p2.x, p2.y); c.lineTo(b.x - u.x * 0.12 * Math.sign(off), b.y - u.y * 0.12 * Math.sign(off));
    c.stroke();
    // ticks
    var tick = 0.09;
    c.beginPath();
    c.moveTo(a.x - n.x * tick + u.x * tick, a.y - n.y * tick + u.y * tick);
    c.lineTo(a.x + n.x * tick - u.x * tick, a.y + n.y * tick - u.y * tick);
    c.moveTo(b.x - n.x * tick + u.x * tick, b.y - n.y * tick + u.y * tick);
    c.lineTo(b.x + n.x * tick - u.x * tick, b.y + n.y * tick - u.y * tick);
    c.stroke();

    var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    labels.push(function (sc, pal2) {
      pill(sc, mid.x * s + view.panX, mid.y * s + view.panY, [text], pal2, { size: 11, padX: 5, padY: 2 });
    });
  }

  /* ============================================================
   * Scene rendering
   * ============================================================ */

  function drawScene(c, W, H, view, opts) {
    var pal = opts.dark ? THEME.dark : THEME.light;
    var s = view.scale;
    var labels = [];

    c.save();
    c.fillStyle = pal.bg;
    c.fillRect(0, 0, W, H);
    c.translate(view.panX, view.panY);
    c.scale(s, s);

    var vx0 = -view.panX / s, vy0 = -view.panY / s;
    var vx1 = (W - view.panX) / s, vy1 = (H - view.panY) / s;

    if (opts.grid) drawGrid(c, vx0, vy0, vx1, vy1, s, pal);

    // ---- rooms -------------------------------------------------------
    var rs = rooms();
    var selectedRoom = opts.sel ? S.selRoom : null;
    rs.forEach(function (r) {
      c.beginPath();
      r.polygon.forEach(function (p, i) { i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
      c.closePath();
      c.fillStyle = pal.roomFill;
      c.fill();
      c.strokeStyle = pal.roomStroke;
      c.lineWidth = 1 / s;
      c.stroke();
    });

    if (opts.labels) {
      rs.forEach(function (r) {
        var sc = { x: r.centroid.x * s + view.panX, y: r.centroid.y * s + view.panY };
        var lines = [fmt(r.width) + ' × ' + fmt(r.height) + ' m', fmt(r.area, 1) + ' m²'];
        labels.push(function (cc, pal2) {
          pill(cc, sc.x, sc.y, lines, pal2, { size: 12, padX: 8, padY: 5 });
        });
      });
    }

    // ---- walls -------------------------------------------------------
    S.walls.forEach(function (w) {
      var a = { x: w.ax, y: w.ay }, b = { x: w.bx, y: w.by };
      var L = wallLength(w);
      var u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
      wallSegments(w).forEach(function (seg) {
        var p1 = { x: a.x + u.x * seg[0], y: a.y + u.y * seg[0] };
        var p2 = { x: a.x + u.x * seg[1], y: a.y + u.y * seg[1] };
        drawWallQuad(c, p1, p2, w.thickness, pal.wall, pal.wallEdge, 1 / s);
      });
      // jamb caps at openings keep the wall ends looking solid
      S.openings.filter(function (o) { return o.wallId === w.id; }).forEach(function (o) {
        var cw = o.t * L;
        [cw - o.width / 2, cw + o.width / 2].forEach(function (d) {
          if (d < 0.001 || d > L - 0.001) return;
          var p = { x: a.x + u.x * d, y: a.y + u.y * d };
          c.beginPath();
          c.moveTo(p.x - (-u.y) * w.thickness / 2, p.y - u.x * w.thickness / 2);
          c.lineTo(p.x + (-u.y) * w.thickness / 2, p.y + u.x * w.thickness / 2);
          c.strokeStyle = pal.wallEdge;
          c.lineWidth = 1 / s;
          c.stroke();
        });
      });
    });

    // ---- openings ----------------------------------------------------
    S.openings.forEach(function (o) {
      var w = wallById(o.wallId);
      if (w) drawOpening(c, o, w, pal, s);
    });

    // ---- objects -----------------------------------------------------
    S.objects.forEach(function (o) { drawObject(c, o, pal, s); });
    if (opts.labels) {
      S.objects.forEach(function (o) {
        var preset = PRESETS[o.kind] || {};
        var text = o.label || preset.label || '';
        if (!text) return;
        var sc = { x: o.x * s + view.panX, y: o.y * s + view.panY };
        labels.push(function (cc, pal2) {
          cc.save();
          cc.font = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
          cc.textAlign = 'center';
          cc.textBaseline = 'middle';
          cc.fillStyle = pal2.objText;
          cc.fillText(text, sc.x, sc.y);
          cc.restore();
        });
      });
    }

    // ---- selection ---------------------------------------------------
    if (opts.sel) {
      S.sel.forEach(function (key) {
        var p = parseKey(key);
        if (p.t === 'w') {
          var w = wallById(p.id);
          if (!w) return;
          drawWallQuad(c, { x: w.ax, y: w.ay }, { x: w.bx, y: w.by }, w.thickness + 0.06, 'rgba(76,154,255,0.28)', pal.sel, 1.5 / s);
          wallEnds(w).forEach(function (pt) {
            c.beginPath();
            c.arc(pt.x, pt.y, 5 / s, 0, Math.PI * 2);
            c.fillStyle = pal.sel;
            c.fill();
            c.strokeStyle = pal.bg;
            c.lineWidth = 1.5 / s;
            c.stroke();
          });
          var L2 = wallLength(w);
          var mid = { x: (w.ax + w.bx) / 2, y: (w.ay + w.by) / 2 };
          var nx = -(w.by - w.ay) / (L2 || 1), ny = (w.bx - w.ax) / (L2 || 1);
          var off = w.thickness / 2 + 0.22;
          labels.push((function (mx, my) {
            return function (cc, pal2) {
              pill(cc, mx * s + view.panX, my * s + view.panY, [fmt(L2) + ' m'], pal2, { size: 11, padX: 6, padY: 3, border: true });
            };
          })(mid.x + nx * off, mid.y + ny * off));
        } else if (p.t === 'o') {
          var o = S.objects.filter(function (x) { return x.id === p.id; })[0];
          if (!o) return;
          var corners = G.objectCorners(o);
          c.beginPath();
          corners.forEach(function (pt, i) { i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y); });
          c.closePath();
          c.strokeStyle = pal.sel;
          c.lineWidth = 1.8 / s;
          c.setLineDash([5 / s, 4 / s]);
          c.stroke();
          c.setLineDash([]);
          if (selectedObjects().length === 1) {
            var hp = objectHandle(o);
            var edge = { x: o.x - Math.sin(o.rot || 0) * (o.h / 2), y: o.y + Math.cos(o.rot || 0) * (o.h / 2) };
            c.beginPath();
            c.moveTo(edge.x, edge.y);
            c.lineTo(hp.x, hp.y);
            c.strokeStyle = pal.sel;
            c.lineWidth = 1 / s;
            c.stroke();
            c.beginPath();
            c.arc(hp.x, hp.y, 5 / s, 0, Math.PI * 2);
            c.fillStyle = pal.sel;
            c.fill();
          }
        } else if (p.t === 'p') {
          var op = S.openings.filter(function (x) { return x.id === p.id; })[0];
          if (!op) return;
          var wl = wallById(op.wallId);
          if (!wl) return;
          var L3 = wallLength(wl);
          var aa = pointOnWall(wl, clamp(op.t - (op.width / 2) / L3, 0, 1));
          var bb = pointOnWall(wl, clamp(op.t + (op.width / 2) / L3, 0, 1));
          drawWallQuad(c, aa, bb, Math.max(wl.thickness, 0.18) + 0.05, 'rgba(76,154,255,0.30)', pal.sel, 1.4 / s);
        }
      });

      // marquee
      if (drag.mode === 'marquee' && drag.rect) {
        var r = drag.rect;
        c.fillStyle = 'rgba(76,154,255,0.12)';
        c.strokeStyle = pal.sel;
        c.lineWidth = 1 / s;
        c.setLineDash([6 / s, 4 / s]);
        c.fillRect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0));
        c.strokeRect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0));
        c.setLineDash([]);
      }

      // wall being drawn
      if (drag.mode === 'wall' && drag.a && drag.b) {
        drawWallQuad(c, drag.a, drag.b, S.wallThickness, 'rgba(76,154,255,0.45)', pal.sel, 1.4 / s);
        var len = G.dist(drag.a, drag.b);
        var m2 = { x: (drag.a.x + drag.b.x) / 2, y: (drag.a.y + drag.b.y) / 2 };
        labels.push((function (mx, my, ln) {
          return function (cc, pal2) {
            pill(cc, mx * s + view.panX, my * s + view.panY, [fmt(ln) + ' m'], pal2, { size: 11, padX: 6, padY: 3 });
          };
        })(m2.x, m2.y, len));
      }

      // selected room: dimension lines
      if (selectedRoom) {
        var bb = selectedRoom.bounds;
        drawDimLine(c, { x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.minY },
          fmt(bb.width) + ' m', -0.45, pal, labels, s, view);
        // Traversed bottom→top so the -0.45 offset lands outside the room,
        // matching the horizontal line above.
        drawDimLine(c, { x: bb.minX, y: bb.maxY }, { x: bb.minX, y: bb.minY },
          fmt(bb.height) + ' m', -0.45, pal, labels, s, view);
      }
    }

    c.restore();

    // ---- deferred screen-space labels --------------------------------
    for (var i = 0; i < labels.length; i++) labels[i](c, pal);
  }

  function render() {
    var W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, W, H, { panX: S.panX, panY: S.panY, scale: S.scale },
      { dark: true, grid: true, labels: S.showDims, sel: true });
    paintedOnce = true;
  }

  /* ============================================================
   * Pointer interaction
   * ============================================================ */

  function setStatusHint(text) { statusHint.textContent = text; }

  var HINTS = {
    select: 'Drag to move · drag empty space to select · click a room label for dimensions',
    wall: 'Drag to draw · release and keep dragging to chain walls · Shift = 45° · Esc ends chain',
    door: 'Click a wall to add a door · drag to slide it along the wall',
    window: 'Click a wall to add a window · drag to slide it along the wall',
    obj: 'Click to place · click an existing item to drag it · Esc returns to Select'
  };

  function setTool(t) {
    S.tool = t;
    chainStart = null;
    document.querySelectorAll('[data-tool]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === t);
    });
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.classList.toggle('active', t === 'obj' && b.dataset.preset === S.preset);
    });
    cv.style.cursor = t === 'select' ? 'default' : t === 'wall' ? 'crosshair' : 'copy';
    setStatusHint(HINTS[t] || '');
    requestRender();
  }

  function setPreset(kind) {
    S.preset = kind;
    setTool('obj');
  }

  function onDown(e) {
    if (e.button === 2) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic / stale pointer */ }
    var sp = screenPt(e);
    var wp = toWorld(sp.x, sp.y);
    drag.pointerId = e.pointerId;
    drag.start = sp;
    drag.startWorld = wp;
    drag.moved = false;

    if (e.button === 1 || spaceDown) {
      drag.mode = 'pan';
      drag.panStart = { x: S.panX, y: S.panY };
      return;
    }

    if (S.tool === 'wall') { startWallDrag(wp, e); return; }
    if (S.tool === 'door' || S.tool === 'window') { startOpeningDrag(wp, S.tool); return; }
    if (S.tool === 'obj') {
      var existing = hitObject(wp);
      if (existing) { startObjectDrag(existing, wp, e); return; }
      pushHistory();
      var preset = PRESETS[S.preset] || PRESETS.table;
      var o = {
        id: uid(), kind: S.preset, x: snapValue(wp.x), y: snapValue(wp.y),
        w: preset.w, h: preset.h, rot: 0, label: preset.label, round: !!preset.round
      };
      S.objects.push(o);
      setSel('o', o.id);
      invalidate(); refreshProps();
      return;
    }
    startSelectDrag(sp, wp, e);
  }

  function startWallDrag(wp, e) {
    S.selRoom = null;
    var start;
    if (chainStart && G.dist(wp, chainStart) < 0.3) start = { x: chainStart.x, y: chainStart.y };
    else start = snapPoint(wp, e);
    drag.mode = 'wall';
    drag.a = start;
    drag.b = start;
  }

  function startOpeningDrag(wp, kind) {
    S.selRoom = null;
    var h = hitWall(wp, 14 / S.scale);
    if (!h) { drag.mode = 'none'; return; }
    var existing = hitOpening(wp, 8 / S.scale);
    if (existing && existing.opening.kind === kind) {
      pushHistory();
      drag.mode = 'opening';
      drag.opening = existing.opening;
      drag.wall = existing.wall;
      setSel('p', existing.opening.id);
      refreshProps();
      return;
    }
    var wall = h.wall;
    var L = wallLength(wall);
    var width = kind === 'door' ? 0.9 : 1.3;
    width = Math.min(width, Math.max(0.3, L * 0.9));
    var halfT = L > 0 ? (width / 2) / L : 0;
    pushHistory();
    var o = {
      id: uid(), wallId: wall.id, kind: kind,
      t: clamp(h.proj.t, halfT, 1 - halfT), width: width, flip: false
    };
    S.openings.push(o);
    drag.mode = 'opening';
    drag.opening = o;
    drag.wall = wall;
    setSel('p', o.id);
    invalidate(); refreshProps();
  }

  function startObjectDrag(o, wp, e) {
    S.selRoom = null;
    if (e.shiftKey) toggleSel('o', o.id);
    else if (!isSel('o', o.id)) setSel('o', o.id);
    pushHistory();
    drag.mode = 'objects';
    drag.grab = { x: wp.x, y: wp.y };
    drag.origins = selectedObjects().map(function (x) { return { o: x, x: x.x, y: x.y }; });
    refreshProps();
  }

  function startSelectDrag(sp, wp, e) {
    var handle = endpointHandleHit(sp);
    if (handle) {
      S.selRoom = null;
      pushHistory();
      drag.mode = 'endpoint';
      drag.wall = handle.wall;
      drag.which = handle.which;
      return;
    }
    var rot = rotateHandleHit(sp);
    if (rot) {
      S.selRoom = null;
      pushHistory();
      drag.mode = 'rotate';
      drag.obj = rot;
      drag.origRot = rot.rot || 0;
      drag.startAngle = Math.atan2(wp.y - rot.y, wp.x - rot.x);
      return;
    }
    var obj = hitObject(wp);
    if (obj) { startObjectDrag(obj, wp, e); return; }

    var op = hitOpening(wp, 8 / S.scale);
    if (op) {
      setSel('p', op.opening.id);
      pushHistory();
      drag.mode = 'opening';
      drag.opening = op.opening;
      drag.wall = op.wall;
      invalidate(); refreshProps();
      return;
    }

    var wl = hitWall(wp, 7 / S.scale);
    if (wl) {
      if (e.shiftKey) toggleSel('w', wl.wall.id);
      else setSel('w', wl.wall.id);
      invalidate(); refreshProps();
      drag.mode = 'none';
      return;
    }

    var room = hitRoomLabel(sp);
    if (room) {
      S.sel.clear();
      S.selRoom = room;
      invalidate(); refreshProps();
      return;
    }

    S.sel.clear(); S.selRoom = null;
    drag.mode = 'marquee';
    drag.rect = { x0: wp.x, y0: wp.y, x1: wp.x, y1: wp.y };
    invalidate(); refreshProps();
  }

  function onMove(e) {
    var sp = screenPt(e);
    var wp = toWorld(sp.x, sp.y);
    statusCoords.textContent = fmt(wp.x) + ', ' + fmt(wp.y) + ' m';

    if (drag.mode === 'none') return;
    drag.moved = true;

    if (drag.mode === 'pan') {
      S.panX = drag.panStart.x + (sp.x - drag.start.x);
      S.panY = drag.panStart.y + (sp.y - drag.start.y);
      requestRender();
      return;
    }

    if (drag.mode === 'wall') {
      var end = snapPoint(wp, e);
      if (e.shiftKey) end = constrainAngle(drag.a, end, 45);
      drag.b = end;
      requestRender();
      return;
    }

    if (drag.mode === 'opening') {
      var w = drag.wall, o = drag.opening;
      if (!w || !o) return;
      var L = wallLength(w);
      var r = G.projectOnSegment(wp, { x: w.ax, y: w.ay }, { x: w.bx, y: w.by });
      var halfT = L > 0 ? (o.width / 2) / L : 0;
      o.t = clamp(r.t, halfT, 1 - halfT);
      invalidate();
      return;
    }

    if (drag.mode === 'endpoint') {
      var wl = drag.wall;
      var p = snapPoint(wp, e);
      if (drag.which === 'a') { wl.ax = p.x; wl.ay = p.y; }
      else { wl.bx = p.x; wl.by = p.y; }
      invalidate();
      return;
    }

    if (drag.mode === 'objects') {
      var dx = wp.x - drag.grab.x, dy = wp.y - drag.grab.y;
      if (S.snap && !e.altKey && drag.origins.length) {
        var primary = drag.origins[0];
        var tx = snapValue(primary.x + dx), ty = snapValue(primary.y + dy);
        dx = tx - primary.x; dy = ty - primary.y;
      }
      drag.origins.forEach(function (it) {
        it.o.x = it.x + dx;
        it.o.y = it.y + dy;
      });
      invalidate();
      return;
    }

    if (drag.mode === 'rotate') {
      var o2 = drag.obj;
      var ang = Math.atan2(wp.y - o2.y, wp.x - o2.x) - drag.startAngle + drag.origRot;
      var step = e.shiftKey ? Math.PI / 12 : Math.PI / 180;
      o2.rot = Math.round(ang / step) * step;
      invalidate();
      return;
    }

    if (drag.mode === 'marquee') {
      drag.rect.x1 = wp.x;
      drag.rect.y1 = wp.y;
      requestRender();
    }
  }

  function onUp(e) {
    if (drag.mode === 'none') return;

    if (drag.mode === 'wall') {
      if (drag.a && drag.b && G.dist(drag.a, drag.b) > 0.03) {
        pushHistory();
        S.walls.push({
          id: uid(), ax: drag.a.x, ay: drag.a.y, bx: drag.b.x, by: drag.b.y,
          thickness: S.wallThickness
        });
        chainStart = { x: drag.b.x, y: drag.b.y };
        invalidate(); refreshProps();
      } else if (!drag.moved) {
        chainStart = null;
      }
    } else if (drag.mode === 'marquee') {
      applyMarquee(drag.rect);
      refreshProps();
    } else if (drag.mode === 'objects' || drag.mode === 'endpoint' || drag.mode === 'rotate' || drag.mode === 'opening') {
      refreshProps();
    }

    drag.mode = 'none';
    drag.rect = null;
    requestRender();
  }

  function applyMarquee(r) {
    if (!r) return;
    var box = {
      minX: Math.min(r.x0, r.x1), maxX: Math.max(r.x0, r.x1),
      minY: Math.min(r.y0, r.y1), maxY: Math.max(r.y0, r.y1)
    };
    if (box.maxX - box.minX < 0.05 && box.maxY - box.minY < 0.05) return;
    S.sel.clear();
    S.objects.forEach(function (o) {
      if (G.pointInRect({ x: o.x, y: o.y }, box)) S.sel.add(selKey('o', o.id));
    });
    S.walls.forEach(function (w) {
      if (G.segIntersectsRect({ x: w.ax, y: w.ay }, { x: w.bx, y: w.by }, box)) S.sel.add(selKey('w', w.id));
    });
    S.openings.forEach(function (o) {
      var w = wallById(o.wallId);
      if (w && G.pointInRect(pointOnWall(w, o.t), box)) S.sel.add(selKey('p', o.id));
    });
  }

  /* ============================================================
   * Properties panel
   * ============================================================ */

  function bindNum(input, apply) {
    if (!input) return;
    var editing = false;
    input.addEventListener('input', function () {
      var v = parseFloat(input.value);
      if (!isFinite(v)) return;
      if (!editing) { pushHistory(); editing = true; }
      apply(v);
    });
    input.addEventListener('change', function () { editing = false; });
    input.addEventListener('blur', function () { editing = false; });
  }

  function refreshProps() {
    var body = $('#props-body');

    if (S.selRoom) {
      var r = S.selRoom;
      body.innerHTML =
        '<div class="readout">' +
        '<div><span class="k">Size</span> <b>' + fmt(r.width) + ' × ' + fmt(r.height) + ' m</b></div>' +
        '<div><span class="k">Area</span> <b>' + fmt(r.area, 2) + ' m²</b></div>' +
        '<div style="color:#8b98a5;font-size:11px;margin-top:4px">measured on wall centerlines</div>' +
        '</div>';
      return;
    }

    var items = Array.from(S.sel);
    if (!items.length) {
      var n = rooms().length;
      body.innerHTML = '<p class="empty">Nothing selected.</p>' +
        (n ? '<p class="empty" style="margin-top:8px">' + n + ' room' + (n > 1 ? 's' : '') + ' detected. Click a room label for its dimensions.</p>' : '');
      return;
    }

    if (items.length > 1) {
      body.innerHTML = '<p class="empty">' + items.length + ' items selected.</p>' +
        '<div class="btnrow"><button class="danger" id="pp-del">Delete all</button></div>';
      $('#pp-del').onclick = deleteSelection;
      return;
    }

    var k = parseKey(items[0]);

    if (k.t === 'w') {
      var w = wallById(k.id);
      if (!w) { S.sel.clear(); return refreshProps(); }
      var L = wallLength(w);
      var ang = Math.atan2(w.by - w.ay, w.bx - w.ax) * 180 / Math.PI;
      body.innerHTML =
        '<div class="readout"><div><span class="k">Length</span> <b>' + fmt(L) + ' m</b></div>' +
        '<div><span class="k">Angle</span> <b>' + fmt(ang, 1) + '°</b></div></div>' +
        '<div class="row"><label>Thickness</label><input id="pp-th" type="number" step="0.01" min="0.04" max="1" value="' + fmt(w.thickness) + '"></div>' +
        '<div class="row"><label>End</label><span class="val">' + fmt(w.ax) + ',' + fmt(w.ay) + ' → ' + fmt(w.bx) + ',' + fmt(w.by) + '</span></div>' +
        '<div class="btnrow"><button class="danger" id="pp-del">Delete wall</button></div>';
      bindNum($('#pp-th'), function (v) { w.thickness = clamp(v, 0.02, 2); invalidate(); });
      $('#pp-del').onclick = deleteSelection;
      return;
    }

    if (k.t === 'p') {
      var op = S.openings.filter(function (x) { return x.id === k.id; })[0];
      if (!op) { S.sel.clear(); return refreshProps(); }
      var wall = wallById(op.wallId);
      var wl = wall ? wallLength(wall) : 0;
      body.innerHTML =
        '<div class="readout"><div><span class="k">Type</span> <b>' + (op.kind === 'door' ? 'Door' : 'Window') + '</b></div>' +
        '<div><span class="k">Position</span> <b>' + fmt(op.t * wl) + ' m</b> <span class="k">along wall</span></div></div>' +
        '<div class="row"><label>Width</label><input id="pp-w" type="number" step="0.05" min="0.3" max="6" value="' + fmt(op.width) + '"></div>' +
        (op.kind === 'door'
          ? '<div class="row"><label>Swing side</label><button id="pp-flip" class="ghost">Flip</button></div>'
          : '') +
        '<div class="btnrow"><button class="danger" id="pp-del">Delete</button></div>';
      bindNum($('#pp-w'), function (v) {
        var maxW = wl * 0.95;
        op.width = clamp(v, 0.2, Math.max(0.3, maxW));
        var halfT = wl > 0 ? (op.width / 2) / wl : 0;
        op.t = clamp(op.t, halfT, 1 - halfT);
        invalidate();
      });
      if ($('#pp-flip')) $('#pp-flip').onclick = function () { pushHistory(); op.flip = !op.flip; invalidate(); };
      $('#pp-del').onclick = deleteSelection;
      return;
    }

    if (k.t === 'o') {
      var o = S.objects.filter(function (x) { return x.id === k.id; })[0];
      if (!o) { S.sel.clear(); return refreshProps(); }
      var preset = PRESETS[o.kind] || {};
      body.innerHTML =
        '<div class="readout"><div><span class="k">Type</span> <b>' + (preset.label || o.kind) + '</b></div>' +
        '<div><span class="k">At</span> <b>' + fmt(o.x) + ', ' + fmt(o.y) + '</b></div></div>' +
        '<div class="row"><label>Width</label><input id="pp-w" type="number" step="0.05" min="0.1" value="' + fmt(o.w) + '"></div>' +
        '<div class="row"><label>Depth</label><input id="pp-h" type="number" step="0.05" min="0.1" value="' + fmt(o.h) + '"></div>' +
        '<div class="row"><label>Rotation</label><input id="pp-r" type="number" step="15" value="' + fmt((o.rot || 0) * 180 / Math.PI, 0) + '"></div>' +
        '<div class="row"><label>Label</label><input id="pp-l" type="text" value="' + (o.label || '') + '"></div>' +
        '<div class="btnrow"><button class="danger" id="pp-del">Delete</button></div>';
      bindNum($('#pp-w'), function (v) { o.w = clamp(v, 0.05, 30); invalidate(); });
      bindNum($('#pp-h'), function (v) { o.h = clamp(v, 0.05, 30); invalidate(); });
      bindNum($('#pp-r'), function (v) { o.rot = v * Math.PI / 180; invalidate(); });
      var labelInput = $('#pp-l');
      labelInput.addEventListener('input', function () { o.label = labelInput.value; scheduleSave(); requestRender(); });
      $('#pp-del').onclick = deleteSelection;
      return;
    }
  }

  /* ============================================================
   * Persistence
   * ============================================================ */

  var LS_KEY = 'floorplan-editor.v1';

  function serialize() {
    return JSON.stringify({
      v: 1, walls: S.walls, openings: S.openings, objects: S.objects,
      nextId: S.nextId, view: { panX: S.panX, panY: S.panY, scale: S.scale }
    }, null, 0);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_KEY, serialize()); } catch (err) { /* private mode */ }
    }, 400);
  }

  function loadData(data, keepView) {
    S.walls = data.walls || [];
    S.openings = data.openings || [];
    S.objects = (data.objects || []).map(function (o) {
      if (o.round === undefined) {
        var p = PRESETS[o.kind];
        o.round = !!(p && p.round);
      }
      return o;
    });
    S.nextId = data.nextId || 1;
    S.sel.clear(); S.selRoom = null;
    undoStack.length = 0; redoStack.length = 0;
    updateHistoryButtons();
    invalidate(); refreshProps();
    if (keepView && data.view) {
      S.panX = data.view.panX; S.panY = data.view.panY; S.scale = data.view.scale;
      requestRender();
    } else {
      fitView();
    }
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function saveJSON() {
    downloadBlob(new Blob([serialize()], { type: 'application/json' }), 'floor-plan.json');
  }

  function exportPNG() {
    var b = contentBounds();
    if (!b) return;
    var pad = 0.7;
    var w = b.width + pad * 2, h = b.height + pad * 2;
    var scale = Math.min(1800 / w, 1300 / h, 240);
    scale = Math.max(scale, 8);
    var W = Math.max(240, Math.round(w * scale));
    var H = Math.max(240, Math.round(h * scale));
    var off = document.createElement('canvas');
    var dpr = 2;
    off.width = W * dpr; off.height = H * dpr;
    var octx = off.getContext('2d');
    octx.scale(dpr, dpr);
    var view = { panX: (pad - b.minX) * scale, panY: (pad - b.minY) * scale, scale: scale };
    drawScene(octx, W, H, view, { dark: false, grid: false, labels: true, sel: false });
    if (off.toBlob) off.toBlob(function (blob) { downloadBlob(blob, 'floor-plan.png'); });
    else window.open(off.toDataURL('image/png'));
  }

  /* ============================================================
   * Demo plan
   * ============================================================ */

  function demoPlan() {
    var T = 0.15;
    var id = 1;
    function wall(ax, ay, bx, by) { return { id: id++, ax: ax, ay: ay, bx: bx, by: by, thickness: T }; }

    var bottom = wall(0, 0, 8, 0);
    var right = wall(8, 0, 8, 6);
    var top = wall(8, 6, 0, 6);
    var left = wall(0, 6, 0, 0);
    var midV = wall(5, 0, 5, 6);
    var midH = wall(5, 3.2, 8, 3.2);

    function op(w, kind, t, width, flip) {
      return { id: id++, wallId: w.id, kind: kind, t: t, width: width, flip: !!flip };
    }
    function obj(kind, x, y, rotDeg) {
      var p = PRESETS[kind];
      return {
        id: id++, kind: kind, x: x, y: y, w: p.w, h: p.h,
        rot: (rotDeg || 0) * Math.PI / 180, label: p.label, round: !!p.round
      };
    }

    return {
      nextId: id + 1,
      walls: [bottom, right, top, left, midV, midH],
      openings: [
        op(bottom, 'door', 0.1125, 0.95),        // entrance → living room
        op(midV, 'door', 0.75, 0.85),            // living room → bedroom
        op(midH, 'door', 0.5, 0.75),             // bedroom → bathroom
        op(top, 'window', 0.2, 1.4),             // bedroom window
        op(top, 'window', 0.7, 1.6),             // living room window
        op(left, 'window', 0.5, 1.6),            // living room window
        op(right, 'window', 0.75, 1.2)           // bedroom window
      ],
      objects: [
        obj('sofa', 2.8, 5.4), obj('table', 2.8, 3.5), obj('chair', 2.8, 2.8),
        obj('chair', 2.8, 4.2), obj('desk', 2.2, 1.0), obj('plant', 0.6, 1.9),
        obj('bed', 6.9, 4.9), obj('cabinet', 5.5, 5.6),
        obj('wc', 5.5, 0.7), obj('sink', 7.4, 0.45)
      ]
    };
  }

  /* ============================================================
   * Keyboard
   * ============================================================ */

  window.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    var key = e.key;
    var lower = key.toLowerCase();

    if (e.ctrlKey || e.metaKey) {
      if (lower === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (lower === 'y') { e.preventDefault(); redo(); return; }
      if (lower === 'd') { e.preventDefault(); duplicateSelection(); return; }
      if (lower === 's') { e.preventDefault(); saveJSON(); return; }
      return;
    }

    if (key === ' ') { spaceDown = true; e.preventDefault(); cv.style.cursor = 'grab'; return; }
    if (key === 'Escape') {
      chainStart = null;
      if (S.sel.size || S.selRoom) { S.sel.clear(); S.selRoom = null; invalidate(); refreshProps(); }
      else setTool('select');
      return;
    }
    if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }

    if (lower === 'v') { setTool('select'); return; }
    if (lower === 'w') { setTool('wall'); return; }
    if (lower === 'd') { setTool('door'); return; }
    if (lower === 'n') { setTool('window'); return; }
    if (lower === 'f') {
      if (e.shiftKey) flipSelectedDoors();
      else fitView();
      return;
    }
    if (lower === 'g') { toggleSnap(); return; }
    if (lower === 'r') {
      var objs = selectedObjects();
      if (objs.length) {
        pushHistory();
        objs.forEach(function (o) { o.rot = (o.rot || 0) + Math.PI / 12; });
        invalidate(); refreshProps();
      }
      return;
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === ' ') {
      spaceDown = false;
      cv.style.cursor = S.tool === 'select' ? 'default' : S.tool === 'wall' ? 'crosshair' : 'copy';
    }
  });

  /* ============================================================
   * Wiring
   * ============================================================ */

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', function () { drag.mode = 'none'; });
  cv.addEventListener('dblclick', function () { chainStart = null; requestRender(); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var sp = screenPt(e);
    var before = toWorld(sp.x, sp.y);
    var factor = Math.exp(-e.deltaY * 0.0016);
    S.scale = clamp(S.scale * factor, 6, 500);
    S.panX = sp.x - before.x * S.scale;
    S.panY = sp.y - before.y * S.scale;
    requestRender();
  }, { passive: false });

  document.querySelectorAll('[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.dataset.tool); });
  });

  var palette = $('#palette');
  Object.keys(PRESETS).forEach(function (kind) {
    var p = PRESETS[kind];
    var b = document.createElement('button');
    b.className = 'toolbtn';
    b.dataset.preset = kind;
    b.title = p.label + ' (' + p.w + ' × ' + p.h + ' m)';
    b.innerHTML = '<span class="sw" style="background:' + p.fill + '"></span><span>' + p.label + '</span>';
    b.addEventListener('click', function () { setPreset(kind); });
    palette.appendChild(b);
  });

  $('#btn-undo').onclick = undo;
  $('#btn-redo').onclick = redo;
  $('#btn-fit').onclick = fitView;

  function toggleSnap() {
    S.snap = !S.snap;
    $('#btn-grid').classList.toggle('active', S.snap);
    requestRender();
  }
  $('#btn-grid').onclick = toggleSnap;

  $('#btn-dims').onclick = function () {
    S.showDims = !S.showDims;
    $('#btn-dims').classList.toggle('active', S.showDims);
    requestRender();
  };

  $('#btn-new').onclick = function () {
    if (!confirm('Start a new empty plan? Unsaved work will be lost.')) return;
    loadData({ walls: [], openings: [], objects: [], nextId: 1 });
  };
  $('#btn-save').onclick = saveJSON;
  $('#btn-png').onclick = exportPNG;
  $('#btn-load').onclick = function () { $('#file').click(); };
  $('#file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { loadData(JSON.parse(String(reader.result))); }
      catch (err) { alert('That file is not a valid floor plan.'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  });
  $('#btn-help').onclick = function () { $('#help').classList.toggle('open'); };

  window.addEventListener('resize', requestRender);
  if (window.ResizeObserver) new ResizeObserver(requestRender).observe(cv);

  /* ============================================================
   * Scripting / automation hook
   * ============================================================ */

  window.FloorPlan = {
    state: S,
    rooms: rooms,
    render: render,
    fit: fitView,
    toWorld: toWorld,
    toScreen: toScreen,
    setTool: setTool,
    exportPNG: exportPNG,
    deleteSelection: deleteSelection,
    undo: undo,
    redo: redo
  };

  /* ============================================================
   * Boot
   * ============================================================ */

  (function boot() {
    var loaded = null;
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (err) { loaded = null; }

    if (loaded && loaded.walls && loaded.walls.length) {
      loadData(loaded, true);
    } else {
      loadData(demoPlan(), false);
    }
    setTool('select');
    updateHistoryButtons();
    refreshProps();
    requestRender();
  })();
})();

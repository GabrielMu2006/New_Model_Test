/* 2D Mechanical Linkage Designer - UI, tools, simulation loop, persistence.
 * Dependency-free (only needs LinkageSolver from solver.js). Works from file://.
 */
(function () {
'use strict';

var S = window.LinkageSolver;
var SNAP = 5;
var MIN_TRACK_LEN = 10;

/* ---------------- safe storage (localStorage may throw on file://) -------- */
var store = (function () {
  var mem = {};
  var ls = null;
  try { ls = window.localStorage; ls.getItem('__t'); } catch (e) { ls = null; }
  return {
    get: function (k) {
      try { if (ls) return ls.getItem(k); } catch (e) {}
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    set: function (k, v) {
      mem[k] = v;
      try { if (ls) ls.setItem(k, v); } catch (e) {}
    }
  };
})();

/* ---------------- state ---------------------------------------------------- */
var state = {
  mech: null,
  initial: null,          // { joints: {id:{x,y}}, angle } reset baseline
  tool: 'select',
  selection: null,        // { kind: 'joint'|'link'|'track', id }
  pendingLink: null,      // { a: jointId }
  running: false,
  simTime: 0,
  playSpeed: 1,
  trace: { jointId: null, enabled: true, pts: [] },
  view: { cx: 0, cy: 20, scale: 1 },
  counters: { J: 0, L: 0, T: 0 },
  show: { labels: true, coords: true, lengths: true, grid: true, snap: true },
  drag: null,             // active pointer gesture
  lastTables: 0
};

/* ---------------- dom ------------------------------------------------------ */
function $(id) { return document.getElementById(id); }
var canvas = $('view'), ctx = canvas.getContext('2d');
var els = {
  hint: $('hint'), cursor: $('cursorPos'), stats: $('mechStats'),
  solver: $('solverStatus'), msg: $('msg'),
  driver: $('driverSelect'), rpm: $('rpmInput'), dir: $('dirSelect'),
  speed: $('speedSelect'), angle: $('angleOut'), time: $('timeOut'), run: $('runOut'),
  play: $('btnPlay'), editor: $('editor'),
  pending: $('pendingPanel'), pendingInfo: $('pendingInfo'), pendingLen: $('pendingLength'),
  traceSel: $('traceSelect'),
  jointTable: $('jointTable').querySelector('tbody'),
  linkTable: $('linkTable').querySelector('tbody'),
  jointCount: $('jointCount'), linkCount: $('linkCount'), err: $('errOut'),
  name: $('mechName'), slots: $('slotSelect'), json: $('jsonBox')
};

var msgTimer = null;
function say(t) {
  els.msg.textContent = t || '';
  if (msgTimer) clearTimeout(msgTimer);
  if (t) msgTimer = setTimeout(function () { els.msg.textContent = ''; }, 6000);
}

/* ---------------- mechanism helpers ---------------------------------------- */
function blankMech(name) {
  return {
    name: name || 'untitled',
    joints: [], links: [], tracks: [],
    driver: { linkId: null, rpm: 30, dir: 1, angle: 0 }
  };
}

function nextId(prefix) {
  var coll = prefix === 'J' ? state.mech.joints : prefix === 'L' ? state.mech.links : state.mech.tracks;
  var id;
  do {
    state.counters[prefix]++;
    id = prefix + state.counters[prefix];
  } while (coll.some(function (o) { return o.id === id; }));
  return id;
}

function addJoint(type, x, y, trackId, name) {
  var id = nextId('J');
  var j = { id: id, name: name || id, type: type, x: x, y: y, trackId: trackId || null };
  state.mech.joints.push(j);
  return j;
}

function addTrack(x1, y1, x2, y2, name) {
  var id = nextId('T');
  var t = { id: id, name: name || id, x1: x1, y1: y1, x2: x2, y2: y2 };
  state.mech.tracks.push(t);
  return t;
}

function addLink(a, b, length, name) {
  var id = nextId('L');
  var l = { id: id, name: name || id, a: a, b: b, length: length };
  state.mech.links.push(l);
  return l;
}

function movable(j) { return j && j.type !== 'fixed'; }

function snapshotInitial() {
  state.initial = S.capturePose(state.mech);
}

function syncDriverAngle() {
  var a = S.driverAngleFromGeometry(state.mech);
  if (a != null) state.mech.driver.angle = a;
}

/* Called after any user edit that re-poses the mechanism. */
function afterEdit(message) {
  syncDriverAngle();
  snapshotInitial();
  state.trace.pts = [];
  refreshAll();
  if (message) say(message);
}

function nearestTrack(x, y, maxD) {
  var best = null, bestD = maxD;
  for (var i = 0; i < state.mech.tracks.length; i++) {
    var t = state.mech.tracks[i];
    var d = S.distToTrack(x, y, t);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/* Track whose segment (generously extended) passes near (x, y) — for slider snapping. */
function sliderSnapTrack(x, y, maxD) {
  var best = null, bestD = maxD;
  for (var i = 0; i < state.mech.tracks.length; i++) {
    var t = state.mech.tracks[i];
    var dx = t.x2 - t.x1, dy = t.y2 - t.y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) continue;
    var frac = ((x - t.x1) * dx + (y - t.y1) * dy) / len2;
    if (frac < -0.5 || frac > 1.5) continue;
    var d = S.distToTrack(x, y, t);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/* Move `moving` so |stationary,moving| == L, respecting slider rails. */
function seatEndpoint(stationary, moving, L) {
  var d = S.dist(stationary.x, stationary.y, moving.x, moving.y);
  if (moving.type === 'slider') {
    var T = S.trackById(state.mech, moving.trackId);
    if (!T) return { ok: false, reason: 'slider ' + moving.name + ' has no track' };
    var pts = S.circleTrack(stationary.x, stationary.y, L, T);
    if (!pts.length) return { ok: false, reason: 'length ' + L + ' cannot reach the rail of ' + moving.name };
    pts.sort(function (p, q) {
      return S.dist(p.x, p.y, moving.x, moving.y) - S.dist(q.x, q.y, moving.x, moving.y);
    });
    moving.x = pts[0].x; moving.y = pts[0].y;
  } else {
    var ux = d > 1e-9 ? (moving.x - stationary.x) / d : 1;
    var uy = d > 1e-9 ? (moving.y - stationary.y) / d : 0;
    moving.x = stationary.x + ux * L; moving.y = stationary.y + uy * L;
  }
  return { ok: true };
}

/* Seat joint B (preferred) or joint A so |AB| == L. Never recurses. */
function placeEndpointForLength(A, B, L) {
  var r = null;
  if (movable(B)) {
    r = seatEndpoint(A, B, L);
    if (r.ok || !movable(A)) return r;
  }
  if (movable(A)) return seatEndpoint(B, A, L);
  if (!r) {
    var d = S.dist(A.x, A.y, B.x, B.y);
    if (Math.abs(d - L) < 0.5) return { ok: true };
    r = { ok: false, reason: 'both joints are fixed pivots' };
  }
  return r;
}

/* ---------------- examples --------------------------------------------------- */
function buildFourBar() {
  state.counters = { J: 0, L: 0, T: 0 };
  state.mech = blankMech('four-bar');
  var P0 = addJoint('fixed', -150, 60, null, 'P0');
  var P1 = addJoint('fixed', 150, 60, null, 'P1');
  var th = -60 * Math.PI / 180, crank = 70;
  var A = addJoint('free', P0.x + crank * Math.cos(th), P0.y + crank * Math.sin(th), null, 'A');
  var sols = S.circleCircle(A.x, A.y, 260, P1.x, P1.y, 180);
  sols.sort(function (p, q) { return p.y - q.y; });
  var B = addJoint('free', sols[0].x, sols[0].y, null, 'B');
  // Coupler tracer point: rigid triangle A-B-C.
  var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  var vx = B.x - A.x, vy = B.y - A.y;
  var n = Math.sqrt(vx * vx + vy * vy);
  var C = addJoint('free', mx + (-vy / n) * 55, my + (vx / n) * 55, null, 'C');
  addLink(P0.id, A.id, crank, 'Crank');
  addLink(A.id, B.id, 260, 'Coupler');
  addLink(P1.id, B.id, 180, 'Rocker');
  addLink(A.id, C.id, S.dist(A.x, A.y, C.x, C.y), 'ArmA');
  addLink(B.id, C.id, S.dist(B.x, B.y, C.x, C.y), 'ArmB');
  state.mech.driver = { linkId: state.mech.links[0].id, rpm: 24, dir: 1, angle: th };
  state.trace = { jointId: C.id, enabled: true, pts: [] };
}

function buildCrankSlider() {
  state.counters = { J: 0, L: 0, T: 0 };
  state.mech = blankMech('crank-slider');
  var P0 = addJoint('fixed', -170, 40, null, 'P0');
  var T = addTrack(-80, 40, 220, 40, 'Rail');
  var th = -35 * Math.PI / 180, crank = 60, rod = 230;
  var A = addJoint('free', P0.x + crank * Math.cos(th), P0.y + crank * Math.sin(th), null, 'A');
  var sols = S.circleTrack(A.x, A.y, rod, { x1: T.x1, y1: T.y1, x2: T.x2, y2: T.y2 });
  sols.sort(function (p, q) { return q.x - p.x; });
  var sl = addJoint('slider', sols[0].x, sols[0].y, T.id, 'S');
  addLink(P0.id, A.id, crank, 'Crank');
  addLink(A.id, sl.id, rod, 'Rod');
  state.mech.driver = { linkId: state.mech.links[0].id, rpm: 36, dir: 1, angle: th };
  state.trace = { jointId: A.id, enabled: true, pts: [] };
}

/* ---------------- validation / serialisation --------------------------------- */
function validateMech(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  var warns = [];
  var m = blankMech(typeof o.name === 'string' ? o.name.slice(0, 60) : 'imported');
  if (!Array.isArray(o.joints) || !Array.isArray(o.links) || !Array.isArray(o.tracks)) {
    throw new Error('joints/links/tracks must be arrays');
  }
  var ids = {}, i, j;
  o.tracks.forEach(function (t) {
    if (!t || typeof t.id !== 'string' || ids[t.id]) throw new Error('bad track id');
    ids[t.id] = true;
    var tx1 = isFinite(+t.x1) ? +t.x1 : 0, ty1 = isFinite(+t.y1) ? +t.y1 : 0;
    var tx2 = isFinite(+t.x2) ? +t.x2 : tx1 + 200, ty2 = isFinite(+t.y2) ? +t.y2 : ty1;
    if (Math.hypot(tx2 - tx1, ty2 - ty1) < 1e-6) {
      tx2 = tx1 + 200; ty2 = ty1;
      warns.push('track ' + t.id + ' was degenerate; rebuilt as a horizontal rail');
    }
    m.tracks.push({ id: t.id, name: String(t.name || t.id), x1: tx1, y1: ty1, x2: tx2, y2: ty2 });
  });
  o.joints.forEach(function (t) {
    if (!t || typeof t.id !== 'string' || ids[t.id]) throw new Error('bad joint id');
    ids[t.id] = true;
    var type = t.type === 'fixed' || t.type === 'slider' ? t.type : 'free';
    var trackId = type === 'slider' ? t.trackId : null;
    if (type === 'slider' && !S.trackById(m, trackId)) {
      warns.push('slider ' + t.id + ' lost its track; made free');
      type = 'free'; trackId = null;
    }
    j = { id: t.id, name: String(t.name || t.id), type: type, x: +t.x || 0, y: +t.y || 0, trackId: trackId };
    if (type === 'slider') {
      var T = S.trackById(m, trackId);
      var p = S.projectToLine(j.x, j.y, S.trackLine(T));
      j.x = p.x; j.y = p.y;
    }
    m.joints.push(j);
  });
  o.links.forEach(function (l) {
    if (!l || typeof l.id !== 'string' || ids[l.id]) throw new Error('bad link id');
    ids[l.id] = true;
    var A = S.jointById(m, l.a), B = S.jointById(m, l.b);
    if (!A || !B) throw new Error('link ' + l.id + ' references a missing joint');
    if (l.a === l.b) throw new Error('link ' + l.id + ' connects a joint to itself');
    var len = +l.length;
    if (!(len > 0)) {
      len = S.dist(A.x, A.y, B.x, B.y) || 50;
      warns.push('link ' + l.id + ' length repaired to ' + len.toFixed(1));
    }
    m.links.push({ id: l.id, name: String(l.name || l.id), a: l.a, b: l.b, length: len });
  });
  var drv = o.driver || {};
  var dl = S.linkById(m, drv.linkId);
  var okDrv = dl && (function () {
    var A = S.jointById(m, dl.a), B = S.jointById(m, dl.b);
    return (A.type === 'fixed') !== (B.type === 'fixed');
  })();
  m.driver = {
    linkId: okDrv ? drv.linkId : null,
    rpm: Math.min(240, Math.max(1, +drv.rpm || 30)),
    dir: +drv.dir === -1 ? -1 : 1,
    angle: +drv.angle || 0
  };
  if (drv.linkId && !okDrv) warns.push('saved drive link was not a pivot→joint crank; motor cleared');
  var a0 = S.driverAngleFromGeometry(m);
  if (a0 != null) m.driver.angle = a0;
  // Preserve the saved reset pose when present and sane.
  var initial = null;
  if (o.initial && o.initial.joints && typeof o.initial.joints === 'object') {
    var pose = {};
    Object.keys(o.initial.joints).forEach(function (id) {
      var J = S.jointById(m, id);
      var p = o.initial.joints[id];
      if (J && p && isFinite(+p.x) && isFinite(+p.y)) pose[id] = { x: +p.x, y: +p.y };
    });
    if (Object.keys(pose).length === m.joints.length) {
      initial = { joints: pose, angle: isFinite(+o.initial.angle) ? +o.initial.angle : m.driver.angle };
    } else {
      warns.push('saved reset pose did not match the joints; reset starts from the loaded pose');
    }
  }
  return { mech: m, warns: warns, initial: initial };
}

function serialize() {
  return {
    app: 'linkage-designer', version: 1,
    name: state.mech.name,
    joints: state.mech.joints, links: state.mech.links, tracks: state.mech.tracks,
    driver: state.mech.driver,
    initial: state.initial
  };
}

function adoptMech(m, initial, traceJointId) {
  state.mech = m;
  state.counters = { J: 0, L: 0, T: 0 };
  m.joints.forEach(function (j) {
    var n = parseInt(String(j.id).replace(/^\D+/, ''), 10);
    if (n > state.counters.J) state.counters.J = n;
  });
  m.links.forEach(function (l) {
    var n = parseInt(String(l.id).replace(/^\D+/, ''), 10);
    if (n > state.counters.L) state.counters.L = n;
  });
  m.tracks.forEach(function (t) {
    var n = parseInt(String(t.id).replace(/^\D+/, ''), 10);
    if (n > state.counters.T) state.counters.T = n;
  });
  S.solve(m, [], 80);
  syncDriverAngle();
  state.initial = initial || S.capturePose(m);
  state.simTime = 0;
  state.running = false;
  state.selection = null;
  state.pendingLink = null;
  var tj = traceJointId && S.jointById(m, traceJointId) ? traceJointId
    : (m.joints.length ? m.joints[m.joints.length - 1].id : null);
  state.trace = { jointId: tj, enabled: true, pts: [] };
  els.name.value = m.name || 'untitled';
  refreshAll();
}

/* ---------------- view transform --------------------------------------------- */
function resizeCanvas() {
  var r = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var w = Math.max(50, Math.round(r.width * dpr)), h = Math.max(50, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function w2s(x, y) {
  var r = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var v = state.view;
  return {
    x: (x - v.cx) * v.scale * dpr + canvas.width / 2,
    y: (y - v.cy) * v.scale * dpr + canvas.height / 2,
    s: v.scale * dpr
  };
}

function s2w(px, py) {
  var r = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var v = state.view;
  return {
    x: (px * dpr - canvas.width / 2) / (v.scale * dpr) + v.cx,
    y: (py * dpr - canvas.height / 2) / (v.scale * dpr) + v.cy
  };
}

function viewRectWorld() {
  var a = s2w(0, 0), b = s2w(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

function fitView() {
  var m = state.mech, xs = [], ys = [];
  m.joints.forEach(function (j) { xs.push(j.x); ys.push(j.y); });
  m.tracks.forEach(function (t) { xs.push(t.x1, t.x2); ys.push(t.y1, t.y2); });
  var r = canvas.getBoundingClientRect();
  if (!xs.length) { state.view = { cx: 0, cy: 0, scale: 1 }; return; }
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  var pad = 90;
  var sx = r.width / Math.max(50, (x1 - x0) + pad * 2);
  var sy = r.height / Math.max(50, (y1 - y0) + pad * 2);
  state.view.scale = Math.min(sx, sy, 3);
  state.view.cx = (x0 + x1) / 2;
  state.view.cy = (y0 + y1) / 2;
}

function snapV(v) { return state.show.snap ? Math.round(v / SNAP) * SNAP : v; }

/* ---------------- hit testing -------------------------------------------------- */
function hitJoint(w) {
  var tol = 12 / state.view.scale, best = null, bd = tol;
  state.mech.joints.forEach(function (j) {
    var d = S.dist(w.x, w.y, j.x, j.y);
    if (d < bd) { bd = d; best = j; }
  });
  return best;
}

function distSeg(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var l2 = dx * dx + dy * dy;
  var t = l2 > 1e-12 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return S.dist(px, py, x1 + dx * t, y1 + dy * t);
}

function hitLink(w) {
  var tol = 8 / state.view.scale, best = null, bd = tol;
  state.mech.links.forEach(function (l) {
    var A = S.jointById(state.mech, l.a), B = S.jointById(state.mech, l.b);
    if (!A || !B) return;
    var d = distSeg(w.x, w.y, A.x, A.y, B.x, B.y);
    if (d < bd) { bd = d; best = l; }
  });
  return best;
}

function hitTrack(w) {
  var tol = 9 / state.view.scale, best = null, bd = tol;
  state.mech.tracks.forEach(function (t) {
    var d = distSeg(w.x, w.y, t.x1, t.y1, t.x2, t.y2);
    if (d < bd) { bd = d; best = t; }
  });
  return best;
}

/* ---------------- rendering ----------------------------------------------------- */
function drawGrid() {
  var vr = viewRectWorld();
  var step = SNAP * 5;
  var minor = '#e2e8ef', major = '#c9d4df', axis = '#9fb0c1';
  ctx.lineWidth = 1;
  for (var x = Math.floor(vr.x0 / step) * step; x <= vr.x1; x += step) {
    var p = w2s(x, 0);
    ctx.strokeStyle = Math.abs(x) < 1e-9 ? axis : (Math.round(x / (step * 5)) === x / (step * 5) ? major : minor);
    ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke();
  }
  for (var y = Math.floor(vr.y0 / step) * step; y <= vr.y1; y += step) {
    var q = w2s(0, y);
    ctx.strokeStyle = Math.abs(y) < 1e-9 ? axis : (Math.round(y / (step * 5)) === y / (step * 5) ? major : minor);
    ctx.beginPath(); ctx.moveTo(0, q.y); ctx.lineTo(canvas.width, q.y); ctx.stroke();
  }
}

function drawTracks() {
  var vr = viewRectWorld();
  state.mech.tracks.forEach(function (t) {
    var sel = state.selection && state.selection.kind === 'track' && state.selection.id === t.id;
    var line = S.trackLine(t);
    // Infinite rail (clipped long segment across the viewport).
    var diag = Math.hypot(vr.x1 - vr.x0, vr.y1 - vr.y0);
    var cx = (t.x1 + t.x2) / 2, cy = (t.y1 + t.y2) / 2;
    var a = w2s(cx - line.dx * diag, cy - line.dy * diag);
    var b = w2s(cx + line.dx * diag, cy + line.dy * diag);
    ctx.strokeStyle = sel ? '#0b6bcb' : '#94a3b8';
    ctx.lineWidth = sel ? 5 : 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    // Defined segment + end stops.
    var p1 = w2s(t.x1, t.y1), p2 = w2s(t.x2, t.y2);
    ctx.strokeStyle = sel ? '#0b6bcb' : '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    var ang = Math.atan2(t.y2 - t.y1, t.x2 - t.x1);
    [p1, p2].forEach(function (p) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
      ctx.strokeStyle = sel ? '#0b6bcb' : '#475569'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
      ctx.restore();
    });
    if (state.show.labels) {
      ctx.fillStyle = '#475569'; ctx.font = '12px sans-serif';
      ctx.fillText(t.name, (p1.x + p2.x) / 2 + 8, (p1.y + p2.y) / 2 - 8);
    }
  });
}

function drawTrace() {
  var pts = state.trace.pts;
  if (!state.trace.enabled || pts.length < 2) return;
  ctx.strokeStyle = 'rgba(11, 107, 203, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (var i = 0; i < pts.length; i++) {
    var p = w2s(pts[i].x, pts[i].y);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function linkColor(l, isDriver) {
  if (state.selection && state.selection.kind === 'link' && state.selection.id === l.id) return '#0b6bcb';
  return isDriver ? '#c2410c' : '#334155';
}

function drawLinks() {
  state.mech.links.forEach(function (l) {
    var A = S.jointById(state.mech, l.a), B = S.jointById(state.mech, l.b);
    if (!A || !B) return;
    var a = w2s(A.x, A.y), b = w2s(B.x, B.y);
    var isDriver = state.mech.driver.linkId === l.id;
    ctx.lineCap = 'round';
    ctx.strokeStyle = linkColor(l, isDriver);
    ctx.lineWidth = isDriver ? 10 : 8;
    ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (isDriver) { // motor glyph on the pivot end
      var P = A.type === 'fixed' ? a : b;
      ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y, 14, 0, Math.PI * 2); ctx.stroke();
    }
    if (state.show.lengths || state.show.labels) {
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var txt = (state.show.labels ? l.name + ' · ' : '') +
        (state.show.lengths ? l.length.toFixed(1) : '');
      if (!txt) return;
      ctx.font = '12px sans-serif';
      var w = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(mx - w / 2 - 4, my - 20, w + 8, 17);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(txt, mx - w / 2, my - 7);
    }
  });
}

function drawJoints() {
  state.mech.joints.forEach(function (j) {
    var p = w2s(j.x, j.y);
    var sel = state.selection && state.selection.kind === 'joint' && state.selection.id === j.id;
    var isDriverJoint = (function () {
      var d = S.driverEnds(state.mech);
      return d && d.crank.id === j.id;
    })();
    if (sel) {
      ctx.strokeStyle = '#0b6bcb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke();
    }
    if (j.type === 'fixed') {
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - 14, p.y + 12); ctx.lineTo(p.x + 14, p.y + 12); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (var hx = -12; hx <= 12; hx += 6) {
        ctx.beginPath(); ctx.moveTo(p.x + hx, p.y + 12); ctx.lineTo(p.x + hx - 5, p.y + 19); ctx.stroke();
      }
    } else if (j.type === 'slider') {
      var T = S.trackById(state.mech, j.trackId);
      var ang = T ? Math.atan2(T.y2 - T.y1, T.x2 - T.x1) : 0;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
      ctx.fillStyle = isDriverJoint ? '#c2410c' : '#0e7490';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-9, -9, 18, 18); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = isDriverJoint ? '#c2410c' : '#b45309';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (state.show.labels || state.show.coords) {
      var parts = [];
      if (state.show.labels) parts.push(j.name);
      if (state.show.coords) parts.push('(' + j.x.toFixed(1) + ', ' + j.y.toFixed(1) + ')');
      var txt = parts.join(' ');
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      var w = ctx.measureText(txt).width;
      ctx.fillRect(p.x + 11, p.y + 8, w + 8, 17);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(txt, p.x + 15, p.y + 21);
    }
  });
}

function drawPending() {
  if (state.pendingLink) {
    var A = S.jointById(state.mech, state.pendingLink.a);
    if (A) {
      var p = w2s(A.x, A.y);
      ctx.strokeStyle = '#0b6bcb'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  var d = state.drag;
  if (d && d.kind === 'track-new' && d.cur) {
    var a = w2s(d.start.x, d.start.y), b = w2s(d.cur.x, d.cur.y);
    ctx.strokeStyle = '#0b6bcb'; ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function draw() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.show.grid) drawGrid();
  drawTracks();
  drawTrace();
  drawLinks();
  drawJoints();
  drawPending();
}

/* ---------------- tables / panels -------------------------------------------- */
function fmtErr(e) {
  if (!(e >= 0)) return '—';
  return e < 1e-4 ? e.toExponential(1) : e.toFixed(4);
}

function refreshTables(err) {
  err = err || S.errors(state.mech);
  var jt = els.jointTable;
  jt.innerHTML = '';
  state.mech.joints.forEach(function (j) {
    var tr = document.createElement('tr');
    if (state.selection && state.selection.kind === 'joint' && state.selection.id === j.id) tr.className = 'sel';
    var typeLbl = j.type === 'fixed' ? 'pivot' : (j.type === 'slider' ? 'slider' : 'joint');
    tr.innerHTML = '<td></td><td></td><td></td><td></td>';
    tr.children[0].textContent = j.name;
    tr.children[1].textContent = typeLbl;
    tr.children[2].textContent = j.x.toFixed(1);
    tr.children[3].textContent = j.y.toFixed(1);
    (function (id) {
      tr.addEventListener('click', function () {
        state.selection = { kind: 'joint', id: id };
        setTool('select'); refreshAll();
      });
    })(j.id);
    jt.appendChild(tr);
  });
  els.jointCount.textContent = '(' + state.mech.joints.length + ')';

  var lt = els.linkTable;
  lt.innerHTML = '';
  var byId = {};
  err.links.forEach(function (e) { byId[e.id] = e; });
  state.mech.links.forEach(function (l) {
    var e = byId[l.id] || { actual: NaN, err: NaN };
    var A = S.jointById(state.mech, l.a), B = S.jointById(state.mech, l.b);
    var tr = document.createElement('tr');
    if (state.selection && state.selection.kind === 'link' && state.selection.id === l.id) tr.className = 'sel';
    tr.innerHTML = '<td></td><td></td><td></td><td></td>';
    tr.children[0].textContent = l.name + ' (' + (A ? A.name : '?') + '–' + (B ? B.name : '?') + ')';
    tr.children[1].textContent = l.length.toFixed(2);
    tr.children[2].textContent = isFinite(e.actual) ? e.actual.toFixed(2) : '—';
    tr.children[3].textContent = isFinite(e.err) ? fmtErr(e.err) : '—';
    (function (id) {
      tr.addEventListener('click', function () {
        state.selection = { kind: 'link', id: id };
        setTool('select'); refreshAll();
      });
    })(l.id);
    lt.appendChild(tr);
  });
  els.linkCount.textContent = '(' + state.mech.links.length + ')';

  var badge = err.maxErr < 0.05 ? '<span class="badge ok">RIGID ✓</span>'
    : err.maxErr < 1 ? '<span class="badge warn">SETTLING</span>'
    : '<span class="badge bad">BROKEN</span>';
  els.err.innerHTML = 'max link error <b>' + fmtErr(err.maxLinkErr) + '</b> (rel ' +
    (err.maxLinkRel < 1e-4 ? err.maxLinkRel.toExponential(1) : err.maxLinkRel.toFixed(6)) +
    ') · max slider off-track <b>' + fmtErr(err.maxSliderErr) + '</b> ' + badge;
  els.solver.textContent = 'links ' + state.mech.links.length + ' · max err ' + fmtErr(err.maxErr);
  els.stats.textContent = state.mech.joints.length + ' joints · ' + state.mech.links.length +
    ' links · ' + state.mech.tracks.length + ' tracks';
}

function crankCandidates() {
  return state.mech.links.filter(function (l) {
    var A = S.jointById(state.mech, l.a), B = S.jointById(state.mech, l.b);
    return A && B && (A.type === 'fixed') !== (B.type === 'fixed');
  });
}

function refreshDriverOptions() {
  var sel = els.driver, cur = state.mech.driver.linkId;
  sel.innerHTML = '';
  var none = document.createElement('option');
  none.value = ''; none.textContent = 'No motor (static)';
  sel.appendChild(none);
  crankCandidates().forEach(function (l) {
    var A = S.jointById(state.mech, l.a), B = S.jointById(state.mech, l.b);
    var o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name + ' (' + A.name + '→' + B.name + ', L=' + l.length.toFixed(1) + ')';
    sel.appendChild(o);
  });
  sel.value = cur || '';
  els.rpm.value = state.mech.driver.rpm;
  els.dir.value = String(state.mech.driver.dir);
}

function refreshTraceOptions() {
  var sel = els.traceSel;
  sel.innerHTML = '';
  state.mech.joints.forEach(function (j) {
    var o = document.createElement('option');
    o.value = j.id; o.textContent = j.name + ' (' + j.type + ')';
    sel.appendChild(o);
  });
  if (state.trace.jointId && S.jointById(state.mech, state.trace.jointId)) {
    sel.value = state.trace.jointId;
  } else {
    state.trace.jointId = state.mech.joints.length ? state.mech.joints[0].id : null;
    if (state.trace.jointId) sel.value = state.trace.jointId;
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/* Selection editor */
function refreshEditor() {
  var ed = els.editor;
  var sel = state.selection;
  if (!sel) {
    ed.innerHTML = 'Nothing selected. Use the Select tool and click a joint, link or track.';
    return;
  }
  if (sel.kind === 'joint') {
    var j = S.jointById(state.mech, sel.id);
    if (!j) { state.selection = null; refreshEditor(); return; }
    var tracks = state.mech.tracks.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (j.trackId === t.id ? ' selected' : '') + '>' +
        esc(t.name) + '</option>';
    }).join('');
    ed.innerHTML =
      '<div class="ed-grid">' +
      '<label class="full"><span class="lbl">Name</span><input id="edName" type="text" value="' + esc(j.name) + '"></label>' +
      '<label><span class="lbl">Type</span><select id="edType">' +
      '<option value="fixed"' + (j.type === 'fixed' ? ' selected' : '') + '>fixed pivot</option>' +
      '<option value="free"' + (j.type === 'free' ? ' selected' : '') + '>rotating joint</option>' +
      '<option value="slider"' + (j.type === 'slider' ? ' selected' : '') + '>slider</option>' +
      '</select></label>' +
      '<label><span class="lbl">Track (sliders)</span><select id="edTrack">' + tracks + '</select></label>' +
      '<label><span class="lbl">X</span><input id="edX" type="number" step="0.1" value="' + j.x.toFixed(2) + '"></label>' +
      '<label><span class="lbl">Y</span><input id="edY" type="number" step="0.1" value="' + j.y.toFixed(2) + '"></label>' +
      '</div>' +
      '<div class="row btns" style="margin-top:8px">' +
      '<button id="edApply" class="primary">Apply</button>' +
      '<button id="edTrace">Trace this</button>' +
      '<button id="edDel">Delete</button></div>';
    $('edApply').addEventListener('click', function () {
      j.name = $('edName').value.trim() || j.id;
      var nt = $('edType').value;
      var nx = parseFloat($('edX').value), ny = parseFloat($('edY').value);
      if (!isFinite(nx) || !isFinite(ny)) { say('Coordinates must be numbers.'); return; }
      if (nt === 'slider') {
        var tid = $('edTrack').value || null;
        if (!tid || !S.trackById(state.mech, tid)) {
          var T = nearestTrack(nx, ny, 1e9) || addTrack(nx - 130, ny, nx + 130, ny);
          tid = T.id;
        }
        j.type = 'slider'; j.trackId = tid;
        var p = S.projectToLine(nx, ny, S.trackLine(S.trackById(state.mech, tid)));
        j.x = p.x; j.y = p.y;
      } else {
        j.type = nt; j.trackId = null; j.x = nx; j.y = ny;
      }
      S.solve(state.mech, [j.id], 60);
      afterEdit(j.name + ' updated.');
    });
    $('edTrace').addEventListener('click', function () {
      state.trace.jointId = j.id; state.trace.enabled = true;
      $('chkTrace').checked = true; state.trace.pts = [];
      refreshAll(); say('Tracing ' + j.name + '.');
    });
    $('edDel').addEventListener('click', function () { deleteJoint(j.id); });
  } else if (sel.kind === 'link') {
    var l = S.linkById(state.mech, sel.id);
    if (!l) { state.selection = null; refreshEditor(); return; }
    var A = S.jointById(state.mech, l.a), B = S.jointById(state.mech, l.b);
    var e = S.errors(state.mech);
    var le = e.links.filter(function (x) { return x.id === l.id; })[0] || {};
    var eligible = A && B && (A.type === 'fixed') !== (B.type === 'fixed');
    ed.innerHTML =
      '<div class="ed-grid">' +
      '<label class="full"><span class="lbl">Name</span><input id="edName" type="text" value="' + esc(l.name) + '"></label>' +
      '<div class="full small">Endpoints: <b>' + esc(A ? A.name : '?') + ' – ' + esc(B ? B.name : '?') +
      '</b> · actual ' + (isFinite(le.actual) ? le.actual.toFixed(3) : '—') + '</div>' +
      '<label class="full"><span class="lbl">Exact nominal length</span>' +
      '<input id="edLen" type="number" min="1" step="0.1" value="' + l.length.toFixed(2) + '"></label>' +
      '</div>' +
      '<div class="row btns" style="margin-top:8px">' +
      '<button id="edApply" class="primary">Apply length</button>' +
      (eligible ? '<button id="edDrive">Make driver</button>' : '') +
      '<button id="edDel">Delete</button></div>';
    $('edApply').addEventListener('click', function () {
      var L = parseFloat($('edLen').value);
      if (!(L > 0) || L > 10000) { say('Length must be a positive number.'); return; }
      l.name = $('edName').value.trim() || l.id;
      var r = placeEndpointForLength(A, B, L);
      if (!r.ok && l.a !== l.b) {
        // try seating the other endpoint instead
        r = placeEndpointForLength(B, A, L);
      }
      if (!r.ok) { say('Cannot apply length: ' + r.reason + '.'); return; }
      l.length = L;
      S.solve(state.mech, [l.a, l.b], 80);
      afterEdit('Link ' + l.name + ' set to exactly ' + L + '.');
    });
    var md = $('edDrive');
    if (md) md.addEventListener('click', function () {
      state.mech.driver.linkId = l.id;
      afterEdit(l.name + ' is now the drive crank.');
    });
    $('edDel').addEventListener('click', function () { deleteLink(l.id); });
  } else if (sel.kind === 'track') {
    var t = S.trackById(state.mech, sel.id);
    if (!t) { state.selection = null; refreshEditor(); return; }
    var angDeg = Math.atan2(t.y2 - t.y1, t.x2 - t.x1) * 180 / Math.PI;
    var users = state.mech.joints.filter(function (x) { return x.type === 'slider' && x.trackId === t.id; });
    ed.innerHTML =
      '<div class="ed-grid">' +
      '<label class="full"><span class="lbl">Name</span><input id="edName" type="text" value="' + esc(t.name) + '"></label>' +
      '<label><span class="lbl">X1</span><input id="edX1" type="number" step="1" value="' + t.x1.toFixed(1) + '"></label>' +
      '<label><span class="lbl">Y1</span><input id="edY1" type="number" step="1" value="' + t.y1.toFixed(1) + '"></label>' +
      '<label><span class="lbl">X2</span><input id="edX2" type="number" step="1" value="' + t.x2.toFixed(1) + '"></label>' +
      '<label><span class="lbl">Y2</span><input id="edY2" type="number" step="1" value="' + t.y2.toFixed(1) + '"></label>' +
      '<label class="full"><span class="lbl">Angle (deg)</span><input id="edAng" type="number" step="1" value="' +
      angDeg.toFixed(1) + '"></label>' +
      '<div class="full small">Sliders on this rail: <b>' +
      (users.length ? esc(users.map(function (u) { return u.name; }).join(', ')) : 'none') + '</b></div>' +
      '</div>' +
      '<div class="row btns" style="margin-top:8px">' +
      '<button id="edApply" class="primary">Apply</button>' +
      '<button id="edRotate">Apply angle</button>' +
      '<button id="edDel">Delete</button></div>';
    $('edApply').addEventListener('click', function () {
      var v = ['edX1', 'edY1', 'edX2', 'edY2'].map(function (id) { return parseFloat($(id).value); });
      if (v.some(function (x) { return !isFinite(x); })) { say('Track endpoints must be numbers.'); return; }
      if (S.dist(v[0], v[1], v[2], v[3]) < MIN_TRACK_LEN) { say('Track is too short.'); return; }
      t.name = $('edName').value.trim() || t.id;
      t.x1 = v[0]; t.y1 = v[1]; t.x2 = v[2]; t.y2 = v[3];
      reseatSliders(t);
      afterEdit('Track ' + t.name + ' updated.');
    });
    $('edRotate').addEventListener('click', function () {
      var deg = parseFloat($('edAng').value);
      if (!isFinite(deg)) { say('Angle must be a number.'); return; }
      rotateTrack(t, deg * Math.PI / 180);
    });
    $('edDel').addEventListener('click', function () { deleteTrack(t.id); });
  }
}

function reseatSliders(t) {
  var line = S.trackLine(t);
  var pins = [];
  state.mech.joints.forEach(function (j) {
    if (j.type === 'slider' && j.trackId === t.id) {
      var p = S.projectToLine(j.x, j.y, line);
      j.x = p.x; j.y = p.y; pins.push(j.id);
    }
  });
  S.solve(state.mech, pins, 60);
}

function rotateTrack(t, rad) {
  var cx = (t.x1 + t.x2) / 2, cy = (t.y1 + t.y2) / 2;
  var half = S.dist(t.x1, t.y1, t.x2, t.y2) / 2;
  t.x1 = cx - Math.cos(rad) * half; t.y1 = cy - Math.sin(rad) * half;
  t.x2 = cx + Math.cos(rad) * half; t.y2 = cy + Math.sin(rad) * half;
  reseatSliders(t);
  afterEdit('Track ' + t.name + ' rotated.');
}

/* ---------------- delete ------------------------------------------------------- */
function deleteJoint(id) {
  var j = S.jointById(state.mech, id);
  if (!j) return;
  var n = state.mech.links.filter(function (l) { return l.a === id || l.b === id; }).length;
  state.mech.links = state.mech.links.filter(function (l) { return l.a !== id && l.b !== id; });
  state.mech.joints = state.mech.joints.filter(function (x) { return x.id !== id; });
  if (state.mech.driver.linkId && !S.linkById(state.mech, state.mech.driver.linkId)) {
    state.mech.driver.linkId = null;
  }
  if (state.trace.jointId === id) {
    state.trace.jointId = state.mech.joints.length ? state.mech.joints[0].id : null;
    state.trace.pts = [];
  }
  if (state.pendingLink && state.pendingLink.a === id) {
    state.pendingLink = null; els.pending.hidden = true;
  }
  state.selection = null;
  afterEdit('Deleted ' + j.name + ' and ' + n + ' attached link(s).');
}

function deleteLink(id) {
  var l = S.linkById(state.mech, id);
  if (!l) return;
  state.mech.links = state.mech.links.filter(function (x) { return x.id !== id; });
  if (state.mech.driver.linkId === id) state.mech.driver.linkId = null;
  state.selection = null;
  afterEdit('Deleted link ' + l.name + '.');
}

function deleteTrack(id) {
  var t = S.trackById(state.mech, id);
  if (!t) return;
  var users = state.mech.joints.filter(function (j) { return j.type === 'slider' && j.trackId === id; });
  if (users.length) {
    say('Track ' + t.name + ' still carries slider(s) ' +
      users.map(function (u) { return u.name; }).join(', ') + '. Move or delete them first.');
    return;
  }
  state.mech.tracks = state.mech.tracks.filter(function (x) { return x.id !== id; });
  state.selection = null;
  afterEdit('Deleted track ' + t.name + '.');
}

/* ---------------- tools ---------------------------------------------------------- */
var TOOL_HINTS = {
  select: 'Select: click a joint / link / track. Drag joints to pose (lengths preserved). Drag empty space to pan. Wheel zooms.',
  fixed: 'Fixed pivot: click empty canvas to anchor a ground pin.',
  joint: 'Rotating joint: click empty canvas to drop a free pin.',
  slider: 'Slider: click near a rail to ride it, or click empty canvas to create a slider on a new horizontal rail.',
  track: 'Track: press, drag and release to draw a slider rail.',
  link: 'Rigid link: click the first joint, then the second joint, then set the exact length.',
  delete: 'Delete: click a joint, link or free track to remove it.'
};

function setTool(t) {
  state.tool = t;
  state.pendingLink = null;
  els.pending.hidden = true;
  document.querySelectorAll('.tool').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tool') === t);
  });
  els.hint.textContent = TOOL_HINTS[t] || '';
  canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
}

function updatePendingPanel(A, B) {
  els.pending.hidden = false;
  var d = S.dist(A.x, A.y, B.x, B.y);
  els.pendingInfo.innerHTML = 'Between <b>' + esc(A.name) + '</b> and <b>' + esc(B.name) +
    '</b> · current distance <b>' + d.toFixed(2) + '</b>';
  els.pendingLen.value = d.toFixed(1);
  setTimeout(function () { els.pendingLen.focus(); els.pendingLen.select(); }, 0);
}

function confirmPendingLink() {
  var p = state.pendingLink;
  if (!p || !p.b) return;
  var A = S.jointById(state.mech, p.a), B = S.jointById(state.mech, p.b);
  if (!A || !B) { state.pendingLink = null; els.pending.hidden = true; return; }
  if (A.id === B.id) { say('A link needs two different joints.'); return; }
  if (state.mech.links.some(function (l) {
    return (l.a === A.id && l.b === B.id) || (l.a === B.id && l.b === A.id);
  })) { say(A.name + ' and ' + B.name + ' are already linked.'); return; }
  var L = parseFloat(els.pendingLen.value);
  if (!(L > 0) || L > 10000) { say('Length must be a positive number.'); return; }
  var r = placeEndpointForLength(A, B, L);
  if (!r.ok) { say('Cannot create link: ' + r.reason + '.'); return; }
  var l = addLink(A.id, B.id, L);
  S.solve(state.mech, [A.id, B.id], 80);
  state.pendingLink = null;
  els.pending.hidden = true;
  state.selection = { kind: 'link', id: l.id };
  afterEdit('Link ' + l.name + ' created with exact length ' + L + '.');
}

/* Pointer interaction on the canvas */
function canvasPos(evt) {
  var r = canvas.getBoundingClientRect();
  return { x: evt.clientX - r.left, y: evt.clientY - r.top };
}

canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

canvas.addEventListener('pointerdown', function (evt) {
  canvas.setPointerCapture(evt.pointerId);
  var w = s2w(canvasPos(evt).x, canvasPos(evt).y);
  var ws = { x: snapV(w.x), y: snapV(w.y) };

  if (evt.button === 1 || evt.button === 2 || (state.tool === 'select' && evt.shiftKey)) {
    state.drag = { kind: 'pan', sx: evt.clientX, sy: evt.clientY, cx: state.view.cx, cy: state.view.cy };
    return;
  }
  if (evt.button !== 0) return;

  if (state.tool === 'fixed' || state.tool === 'joint') {
    var j = addJoint(state.tool === 'fixed' ? 'fixed' : 'free', ws.x, ws.y);
    state.selection = { kind: 'joint', id: j.id };
    afterEdit((j.type === 'fixed' ? 'Fixed pivot ' : 'Joint ') + j.name + ' created at (' +
      ws.x.toFixed(0) + ', ' + ws.y.toFixed(0) + ').');
    return;
  }
  if (state.tool === 'slider') {
    var T = sliderSnapTrack(w.x, w.y, 18 / state.view.scale);
    if (!T) {
      T = addTrack(ws.x - 130, ws.y, ws.x + 130, ws.y);
      var s0 = addJoint('slider', ws.x, ws.y, T.id);
      state.selection = { kind: 'joint', id: s0.id };
      afterEdit('Slider ' + s0.name + ' created on new rail ' + T.name + '.');
    } else {
      var p = S.projectToLine(w.x, w.y, S.trackLine(T));
      var s1 = addJoint('slider', p.x, p.y, T.id);
      state.selection = { kind: 'joint', id: s1.id };
      afterEdit('Slider ' + s1.name + ' snapped onto rail ' + T.name + '.');
    }
    return;
  }
  if (state.tool === 'track') {
    state.drag = { kind: 'track-new', start: ws, cur: ws };
    return;
  }
  if (state.tool === 'link') {
    var jt = hitJoint(w);
    if (!jt) { say('Link tool: click a joint first.'); return; }
    if (!state.pendingLink) {
      state.pendingLink = { a: jt.id };
      say('Link from ' + jt.name + ': now click the second joint.');
      draw();
    } else if (state.pendingLink.a === jt.id) {
      say('Pick a different second joint (a link needs two joints).');
    } else {
      state.pendingLink.b = jt.id;
      updatePendingPanel(S.jointById(state.mech, state.pendingLink.a), jt);
    }
    return;
  }
  if (state.tool === 'delete') {
    var dj = hitJoint(w);
    if (dj) { deleteJoint(dj.id); return; }
    var dl = hitLink(w);
    if (dl) { deleteLink(dl.id); return; }
    var dt = hitTrack(w);
    if (dt) { deleteTrack(dt.id); return; }
    say('Nothing to delete here.');
    return;
  }
  // select tool
  var sj = hitJoint(w);
  if (sj) {
    state.selection = { kind: 'joint', id: sj.id };
    pause();
    state.drag = { kind: 'joint', id: sj.id, moved: false };
    refreshAll();
    return;
  }
  var st = hitTrack(w);
  var sl = hitLink(w);
  if (sl) {
    state.selection = { kind: 'link', id: sl.id };
    refreshAll();
    state.drag = { kind: 'maybe-pan', sx: evt.clientX, sy: evt.clientY, cx: state.view.cx, cy: state.view.cy };
    return;
  }
  if (st) {
    state.selection = { kind: 'track', id: st.id };
    pause();
    var users = state.mech.joints.filter(function (x) { return x.type === 'slider' && x.trackId === st.id; });
    state.drag = {
      kind: 'track-move', id: st.id, moved: false,
      last: w, sliders: users.map(function (u) { return u.id; })
    };
    refreshAll();
    return;
  }
  state.selection = null;
  state.drag = { kind: 'pan', sx: evt.clientX, sy: evt.clientY, cx: state.view.cx, cy: state.view.cy };
  refreshAll();
});

canvas.addEventListener('pointermove', function (evt) {
  var cp = canvasPos(evt);
  var w = s2w(cp.x, cp.y);
  els.cursor.textContent = 'cursor (' + w.x.toFixed(1) + ', ' + w.y.toFixed(1) + ')';
  var d = state.drag;
  if (!d) return;
  if (d.kind === 'pan' || d.kind === 'maybe-pan') {
    var mdx = evt.clientX - d.sx, mdy = evt.clientY - d.sy;
    if (d.kind === 'maybe-pan' && Math.hypot(mdx, mdy) < 4) return;
    d.kind = 'pan';
    var wNow = s2w(cp.x, cp.y);
    if (!d.w0) { d.w0 = wNow; return; }
    // Shift the view so the world point under the cursor follows the pointer.
    state.view.cx -= (wNow.x - d.w0.x);
    state.view.cy -= (wNow.y - d.w0.y);
    draw();
    return;
  }
  if (d.kind === 'track-new') {
    d.cur = { x: snapV(w.x), y: snapV(w.y) };
    draw();
    return;
  }
  if (d.kind === 'joint') {
    var j = S.jointById(state.mech, d.id);
    if (!j) { state.drag = null; return; }
    d.moved = true;
    var tx = snapV(w.x), ty = snapV(w.y);
    if (j.type === 'slider') {
      var T = S.trackById(state.mech, j.trackId);
      if (T) { var p = S.projectToLine(tx, ty, S.trackLine(T)); tx = p.x; ty = p.y; }
    }
    j.x = tx; j.y = ty;
    var pins = state.mech.joints.filter(function (x) { return x.type === 'fixed'; }).map(function (x) { return x.id; });
    pins.push(j.id);
    S.solve(state.mech, pins, 40);
    draw();
    refreshTables();
    return;
  }
  if (d.kind === 'track-move') {
    var t = S.trackById(state.mech, d.id);
    if (!t) { state.drag = null; return; }
    d.moved = true;
    var ddx = w.x - d.last.x, ddy = w.y - d.last.y;
    d.last = w;
    t.x1 += ddx; t.y1 += ddy; t.x2 += ddx; t.y2 += ddy;
    d.sliders.forEach(function (id) {
      var u = S.jointById(state.mech, id);
      if (u) { u.x += ddx; u.y += ddy; }
    });
    var pins2 = state.mech.joints.filter(function (x) { return x.type === 'fixed'; }).map(function (x) { return x.id; });
    S.solve(state.mech, pins2.concat(d.sliders), 40);
    draw();
    refreshTables();
  }
});

function endGesture(evt) {
  var d = state.drag;
  state.drag = null;
  if (!d) return;
  if (d.kind === 'track-new') {
    var len = S.dist(d.start.x, d.start.y, d.cur.x, d.cur.y);
    if (len < MIN_TRACK_LEN) { say('Track too short — drag a longer rail.'); draw(); return; }
    var t = addTrack(d.start.x, d.start.y, d.cur.x, d.cur.y);
    state.selection = { kind: 'track', id: t.id };
    afterEdit('Track ' + t.name + ' created (length ' + len.toFixed(1) + ').');
    return;
  }
  if ((d.kind === 'joint' || d.kind === 'track-move') && d.moved) {
    afterEdit();
    say('Posed. Lengths preserved — Reset returns here.');
  }
  draw();
}
canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', function () { state.drag = null; draw(); });

canvas.addEventListener('wheel', function (evt) {
  evt.preventDefault();
  var cp = canvasPos(evt);
  var before = s2w(cp.x, cp.y);
  var f = evt.deltaY > 0 ? 1 / 1.12 : 1.12;
  state.view.scale = Math.min(8, Math.max(0.1, state.view.scale * f));
  var after = s2w(cp.x, cp.y);
  state.view.cx += before.x - after.x;
  state.view.cy += before.y - after.y;
  draw();
}, { passive: false });

/* ---------------- simulation --------------------------------------------------- */
function omega() {
  return state.mech.driver.dir * state.mech.driver.rpm * 2 * Math.PI / 60;
}

function pushTrace() {
  if (!state.trace.enabled || !state.trace.jointId) return;
  var j = S.jointById(state.mech, state.trace.jointId);
  if (!j) return;
  var pts = state.trace.pts;
  var last = pts[pts.length - 1];
  if (!last || S.dist(last.x, last.y, j.x, j.y) > 0.4) {
    pts.push({ x: j.x, y: j.y });
    if (pts.length > 8000) pts.splice(0, pts.length - 8000);
  }
}

function doStep(frames) {
  pause();
  if (!S.driverEnds(state.mech)) { say('Choose a drive (crank) link first.'); return; }
  var dTheta = omega() * (1 / 60);
  for (var i = 0; i < frames; i++) {
    S.step(state.mech, dTheta, 120);
    state.simTime += 1 / 60;
    pushTrace();
  }
  refreshAll();
}

function play() {
  if (state.running) return;
  if (!S.driverEnds(state.mech)) { say('Choose a drive (crank) link first — see the Motor panel.'); return; }
  state.running = true;
  els.play.textContent = 'Pause';
  els.run.textContent = 'running';
}

function pause() {
  if (!state.running) return;
  state.running = false;
  els.play.textContent = 'Play';
  els.run.textContent = 'paused';
}

function togglePlay() { if (state.running) pause(); else play(); }

function resetSim() {
  pause();
  S.restorePose(state.mech, state.initial);
  state.simTime = 0;
  state.trace.pts = [];
  say('Reset to the initial pose.');
  refreshAll();
}

var lastFrame = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (!state.running) { lastFrame = now; return; }
  if (!lastFrame) lastFrame = now;
  var dtReal = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  var dtSim = dtReal * state.playSpeed;
  S.step(state.mech, omega() * dtSim, 120);
  state.simTime += dtSim;
  pushTrace();
  var deg = ((state.mech.driver.angle * 180 / Math.PI) % 360 + 360) % 360;
  els.angle.textContent = deg.toFixed(1) + '°';
  els.time.textContent = state.simTime.toFixed(2) + ' s';
  draw();
  if (now - state.lastTables > 150) { state.lastTables = now; refreshTables(); }
}

/* ---------------- refresh -------------------------------------------------------- */
function refreshAll() {
  refreshDriverOptions();
  refreshTraceOptions();
  refreshEditor();
  refreshTables();
  els.name.value = state.mech.name || 'untitled';
  var deg = ((state.mech.driver.angle * 180 / Math.PI) % 360 + 360) % 360;
  els.angle.textContent = state.mech.driver.linkId ? deg.toFixed(1) + '°' : '—';
  els.time.textContent = state.simTime.toFixed(2) + ' s';
  draw();
}

/* ---------------- save / reload ----------------------------------------------------- */
function slots() {
  try { return JSON.parse(store.get('linkageDesigner.v1.slots') || '{}'); }
  catch (e) { return {}; }
}

function refreshSlots() {
  var s = slots();
  els.slots.innerHTML = '';
  ['1', '2', '3', '4', '5'].forEach(function (k) {
    var o = document.createElement('option');
    o.value = k;
    o.textContent = 'Slot ' + k + (s[k] ? ' — ' + (s[k].name || 'mechanism') : ' (empty)');
    els.slots.appendChild(o);
  });
}

function download(name, text) {
  var blob = new Blob([text], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function wireUI() {
  document.querySelectorAll('.tool').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
  });
  $('btnNew').addEventListener('click', function () {
    pause();
    state.counters = { J: 0, L: 0, T: 0 };
    adoptMech(blankMech('untitled'));
    fitView(); refreshAll();
    say('New empty mechanism. Start with fixed pivots.');
  });
  $('btnExFour').addEventListener('click', function () {
    pause(); buildFourBar();
    adoptMech(state.mech, null, state.trace.jointId);
    fitView(); refreshAll();
    say('Four-bar loaded: Crank → Coupler → Rocker. Press Play.');
  });
  $('btnExSlider').addEventListener('click', function () {
    pause(); buildCrankSlider();
    adoptMech(state.mech, null, state.trace.jointId);
    fitView(); refreshAll();
    say('Crank-slider loaded: Crank → Rod → Slider. Press Play.');
  });
  $('btnSaveFile').addEventListener('click', function () {
    state.mech.name = els.name.value.trim() || 'untitled';
    download(state.mech.name.replace(/[^\w\-]+/g, '_') + '.linkage.json',
      JSON.stringify(serialize(), null, 2));
    say('Saved ' + state.mech.name + ' to file.');
  });
  $('btnLoadFile').addEventListener('click', function () { $('fileInput').click(); });
  $('fileInput').addEventListener('change', function () {
    var f = $('fileInput').files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var v = validateMech(JSON.parse(rd.result));
        pause();
        adoptMech(v.mech, v.initial || null);
        if (v.warns.length) say('Loaded with notes: ' + v.warns.join('; '));
        else say('Loaded ' + v.mech.name + ' from file.');
        fitView(); refreshAll();
      } catch (e) { say('Load failed: ' + e.message); }
    };
    rd.readAsText(f);
    $('fileInput').value = '';
  });

  els.play.addEventListener('click', togglePlay);
  $('btnStep').addEventListener('click', function () { doStep(1); });
  $('btnStep10').addEventListener('click', function () { doStep(10); });
  $('btnReset').addEventListener('click', resetSim);
  $('btnSetInitial').addEventListener('click', function () {
    snapshotInitial(); say('Current pose stored as the reset pose.');
  });

  els.driver.addEventListener('change', function () {
    state.mech.driver.linkId = els.driver.value || null;
    afterEdit(state.mech.driver.linkId ? 'Motor set. Press Play.' : 'Motor cleared.');
  });
  els.rpm.addEventListener('change', function () {
    var v = Math.min(240, Math.max(1, parseFloat(els.rpm.value) || 30));
    els.rpm.value = v; state.mech.driver.rpm = v;
  });
  els.dir.addEventListener('change', function () {
    state.mech.driver.dir = els.dir.value === '-1' ? -1 : 1;
  });
  els.speed.addEventListener('change', function () {
    state.playSpeed = parseFloat(els.speed.value) || 1;
  });

  els.traceSel.addEventListener('change', function () {
    state.trace.jointId = els.traceSel.value || null;
    state.trace.pts = [];
    draw();
  });
  $('btnClearTrace').addEventListener('click', function () { state.trace.pts = []; draw(); });
  $('btnFitView').addEventListener('click', fitView);

  $('chkLabels').addEventListener('change', function (e) { state.show.labels = e.target.checked; draw(); });
  $('chkCoords').addEventListener('change', function (e) { state.show.coords = e.target.checked; draw(); });
  $('chkLengths').addEventListener('change', function (e) { state.show.lengths = e.target.checked; draw(); });
  $('chkGrid').addEventListener('change', function (e) { state.show.grid = e.target.checked; draw(); });
  $('chkSnap').addEventListener('change', function (e) { state.show.snap = e.target.checked; });
  $('chkTrace').addEventListener('change', function (e) { state.trace.enabled = e.target.checked; draw(); });

  els.name.addEventListener('change', function () {
    state.mech.name = els.name.value.trim() || 'untitled';
  });

  $('btnSlotSave').addEventListener('click', function () {
    state.mech.name = els.name.value.trim() || 'untitled';
    var s = slots();
    s[els.slots.value] = serialize();
    store.set('linkageDesigner.v1.slots', JSON.stringify(s));
    refreshSlots();
    say('Stored "' + state.mech.name + '" in slot ' + els.slots.value + '.');
  });
  $('btnSlotLoad').addEventListener('click', function () {
    var s = slots()[els.slots.value];
    if (!s) { say('Slot ' + els.slots.value + ' is empty.'); return; }
    try {
      var v = validateMech(s);
      pause();
      adoptMech(v.mech, v.initial || null);
      fitView(); refreshAll();
      say('Recalled "' + v.mech.name + '" from slot ' + els.slots.value + '.');
    } catch (e) { say('Recall failed: ' + e.message); }
  });

  $('btnExportText').addEventListener('click', function () {
    state.mech.name = els.name.value.trim() || 'untitled';
    els.json.value = JSON.stringify(serialize(), null, 2);
    els.json.select();
    say('JSON exported to the text box (copy it anywhere).');
  });
  $('btnImportText').addEventListener('click', function () {
    try {
      var v = validateMech(JSON.parse(els.json.value));
      pause();
      adoptMech(v.mech, null);
      fitView(); refreshAll();
      say('Imported "' + v.mech.name + '".' + (v.warns.length ? ' Notes: ' + v.warns.join('; ') : ''));
    } catch (e) { say('Import failed: ' + e.message); }
  });

  $('btnPendingOk').addEventListener('click', confirmPendingLink);
  $('btnPendingCancel').addEventListener('click', function () {
    state.pendingLink = null; els.pending.hidden = true; say('Link cancelled.');
  });
  els.pendingLen.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmPendingLink();
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') {
      state.pendingLink = null; els.pending.hidden = true;
      state.selection = null; refreshAll();
      return;
    }
    if (typing) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'n' || e.key === 'N') doStep(1);
    else if (e.key === 'r' || e.key === 'R') resetSim();
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      var s = state.selection;
      if (!s) return;
      if (s.kind === 'joint') deleteJoint(s.id);
      else if (s.kind === 'link') deleteLink(s.id);
      else if (s.kind === 'track') deleteTrack(s.id);
    }
    else if (e.key >= '1' && e.key <= '7') {
      setTool(['select', 'fixed', 'joint', 'slider', 'track', 'link', 'delete'][+e.key - 1]);
    }
  });

  window.addEventListener('resize', draw);
}

/* ---------------- boot --------------------------------------------------------- */
function boot() {
  state.mech = blankMech('four-bar');
  buildFourBar();
  state.mech.name = 'four-bar';
  wireUI();
  refreshSlots();
  adoptMech(state.mech, null, state.trace.jointId);
  setTool('select');
  fitView();
  refreshAll();
  say('Four-bar example loaded. Press Play, or build your own with the tools.');
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();

/* ==========================================================================
 * tests/render-png.js — render frames to PNG, with no browser.
 *
 *     node tests/render-png.js [outDir]
 *
 * WHY THIS EXISTS
 *   The layout of a compressed Solar System is impossible to get right by
 *   reasoning alone: whether Neptune fits, whether a moon system clears its
 *   planet's disc, whether labels collide, whether trails read as ellipses —
 *   all of that is a judgement about pixels. This script reimplements just
 *   enough of the Canvas 2D API (paths, fills, strokes, radial gradients) on
 *   a software rasteriser and draws the SAME scene the browser draws, using
 *   the SAME modules, so the result can be inspected and diffed as an image.
 *
 * It is a verification tool only; the application itself never uses it.
 * ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var O = require(path.join(__dirname, '..', 'js', 'orbital.js'));
var D = require(path.join(__dirname, '..', 'js', 'data.js'));
var S = require(path.join(__dirname, '..', 'js', 'simulation.js'));
var P = require(path.join(__dirname, '..', 'js', 'projection.js'));

var TAU = Math.PI * 2;

/* ==================================================================== *
 * Minimal software canvas
 * ==================================================================== */

function Ctx(w, h) {
  this.w = w; this.h = h;
  this.buf = new Float32Array(w * h * 3);
  this.path = [];          // list of subpaths, each an array of [x,y]
  this._cur = null;
  this.fillStyle = '#000';
  this.strokeStyle = '#fff';
  this.lineWidth = 1;
  this.globalAlpha = 1;
  this.font = '';
  this.textBaseline = 'alphabetic';
  this._dash = null;
  this._grad = null;
  this._fillRule = 'nonzero';
}

Ctx.prototype._px = function (x, y, r, g, b, a) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  if (a <= 0) return;
  if (a > 1) a = 1;
  var i = (y * this.w + x) * 3;
  var ia = 1 - a;
  this.buf[i] = this.buf[i] * ia + r * a;
  this.buf[i + 1] = this.buf[i + 1] * ia + g * a;
  this.buf[i + 2] = this.buf[i + 2] * ia + b * a;
};

/* ---- colours ---- */
var NAMED = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0]
};
function parseColor(c) {
  if (typeof c !== 'string') return { r: 255, g: 255, b: 255, a: 1 };
  c = c.trim();
  var m;
  if (c[0] === '#') {
    var h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    var p = m[1].split(',').map(function (s) { return parseFloat(s); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  if (NAMED[c]) {
    return { r: NAMED[c][0], g: NAMED[c][1], b: NAMED[c][2], a: 1 };
  }
  return { r: 255, g: 0, b: 255, a: 1 };
}

/* ---- gradients ---- */
Ctx.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
  return { kind: 'radial', x0: x0, y0: y0, r0: r0, r1: r1, stops: [] };
};
Ctx.prototype.createLinearGradient = function () {
  return { kind: 'linear', stops: [] };
};

function gradAdd(g, off, col) { g.stops.push({ off: off, c: parseColor(col) }); }

function gradColor(g, x, y) {
  if (!g || !g.stops.length) return { r: 0, g: 0, b: 0, a: 1 };
  var t;
  if (g.kind === 'radial') {
    var d = Math.hypot(x - g.x0, y - g.y0);
    t = (d - g.r0) / Math.max(1e-6, g.r1 - g.r0);
  } else {
    t = 0;
  }
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  var a = g.stops[0], b = g.stops[g.stops.length - 1];
  for (var i = 0; i < g.stops.length - 1; i++) {
    if (t >= g.stops[i].off && t <= g.stops[i + 1].off) {
      a = g.stops[i]; b = g.stops[i + 1]; break;
    }
  }
  var span = b.off - a.off;
  var u = span > 1e-9 ? (t - a.off) / span : 0;
  return {
    r: a.c.r + (b.c.r - a.c.r) * u,
    g: a.c.g + (b.c.g - a.c.g) * u,
    b: a.c.b + (b.c.b - a.c.b) * u,
    a: a.c.a + (b.c.a - a.c.a) * u
  };
}

/* ---- paths ---- */
Ctx.prototype.beginPath = function () { this.path = []; this._cur = null; };
Ctx.prototype.moveTo = function (x, y) { this._cur = [[x, y]]; this.path.push(this._cur); };
Ctx.prototype.lineTo = function (x, y) {
  if (!this._cur) this.moveTo(x, y);
  else this._cur.push([x, y]);
};
Ctx.prototype.closePath = function () {
  if (this._cur && this._cur.length) this._cur.push(this._cur[0].slice());
};
Ctx.prototype.arc = function (x, y, r, a0, a1, ccw) {
  if (r <= 0) return;
  var steps = Math.max(8, Math.min(200, Math.ceil(r * 2)));
  var span = a1 - a0;
  if (ccw && span > 0) span -= TAU;
  if (!ccw && span < 0) span += TAU;
  this._cur = [];
  for (var i = 0; i <= steps; i++) {
    var a = a0 + span * (i / steps);
    this._cur.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  this.path.push(this._cur);
};
Ctx.prototype.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) {
  var steps = Math.max(12, Math.min(220, Math.ceil(Math.max(rx, ry) * 2)));
  var span = a1 - a0;
  if (ccw && span > 0) span -= TAU;
  this._cur = [];
  for (var i = 0; i <= steps; i++) {
    var a = a0 + span * (i / steps);
    var px = Math.cos(a) * rx, py = Math.sin(a) * ry;
    var cx = px * Math.cos(rot) - py * Math.sin(rot);
    var cy = px * Math.sin(rot) + py * Math.cos(rot);
    this._cur.push([x + cx, y + cy]);
  }
  this.path.push(this._cur);
};
Ctx.prototype.arcTo = function () { /* not used by the renderer */ };
Ctx.prototype.setLineDash = function (d) { this._dash = d && d.length ? d : null; };
Ctx.prototype.measureText = function (t) {
  return { width: t.length * 6.1 };   // approximation of an 11.5px sans face
};
Ctx.prototype.save = function () {};
Ctx.prototype.restore = function () {};
Ctx.prototype.setTransform = function () {};
Ctx.prototype.fillText = function (text, x, y) {
  var c = parseColor(this.fillStyle);
  var a = c.a * this.globalAlpha;
  // 5x7 bitmap font is overkill here; a simple stroke-font renders the label
  // box position, which is what the layout check needs.
  drawSimpleText(this, text, x, y, c, a);
};
Ctx.prototype.fillRect = function (x, y, w, h) {
  var c = parseColor(this.fillStyle);
  for (var j = 0; j < h; j++) {
    for (var i = 0; i < w; i++) {
      this._px(x + i, y + j, c.r, c.g, c.b, c.a * this.globalAlpha);
    }
  }
};
Ctx.prototype.clearRect = function () { /* the frame is fully repainted */ };

function scanlineFill(ctx, pts, colorFn, evenOdd) {
  if (pts.length < 3) return;
  var minY = Infinity, maxY = -Infinity, i;
  for (i = 0; i < pts.length; i++) {
    if (pts[i][1] < minY) minY = pts[i][1];
    if (pts[i][1] > maxY) maxY = pts[i][1];
  }
  var y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(ctx.h - 1, Math.ceil(maxY));
  var xs = [];
  for (var y = y0; y <= y1; y++) {
    xs.length = 0;
    var cy = y + 0.5;
    for (i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var ay = a[1], by = b[1];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
        var t = (cy - ay) / (by - ay);
        xs.push({ x: a[0] + (b[0] - a[0]) * t, dir: by > ay ? 1 : -1 });
      }
    }
    if (xs.length < 2) continue;
    xs.sort(function (p, q) { return p.x - q.x; });
    var spans = [];
    if (evenOdd) {
      for (i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i].x, xs[i + 1].x]);
    } else {
      var wind = 0, startX = 0;
      for (i = 0; i < xs.length; i++) {
        if (wind === 0) startX = xs[i].x;
        wind += xs[i].dir;
        if (wind === 0) spans.push([startX, xs[i].x]);
      }
    }
    spans.forEach(function (sp) {
      var sx = Math.max(0, Math.floor(sp[0]));
      var ex = Math.min(ctx.w - 1, Math.ceil(sp[1]));
      for (var x = sx; x <= ex; x++) {
        var col = colorFn(x + 0.5, cy);
        ctx._px(x, y, col.r, col.g, col.b, col.a);
      }
    });
  }
}

Ctx.prototype.fill = function (rule) {
  var evenOdd = rule === 'evenodd';
  var self = this;
  var solid = typeof this.fillStyle === 'string' ? parseColor(this.fillStyle) : null;
  var grad = solid ? null : this.fillStyle;
  var ga = this.globalAlpha;
  this.path.forEach(function (sub) {
    if (sub.length < 3) return;
    scanlineFill(self, sub, function (x, y) {
      var c = solid || gradColor(grad, x, y);
      return { r: c.r, g: c.g, b: c.b, a: c.a * ga };
    }, evenOdd);
  });
};

Ctx.prototype.stroke = function () {
  var c = typeof this.strokeStyle === 'string'
    ? parseColor(this.strokeStyle) : gradColor(this.strokeStyle, 0, 0);
  var a = c.a * this.globalAlpha;
  var lw = Math.max(0.7, this.lineWidth);
  var self = this;
  this.path.forEach(function (sub) {
    if (sub.length < 2) {
      // A single-point "path" from arc() with identical endpoints
      if (sub.length === 1) self._dot(sub[0][0], sub[0][1], lw / 2, c, a);
      return;
    }
    for (var i = 1; i < sub.length; i++) {
      self._seg(sub[i - 1][0], sub[i - 1][1], sub[i][0], sub[i][1], lw, c, a);
    }
    if (sub.length === 2) self._dot(sub[0][0], sub[0][1], lw / 2, c, a);
  });
};

Ctx.prototype._seg = function (x0, y0, x1, y1, lw, c, a) {
  var dx = x1 - x0, dy = y1 - y0;
  var len = Math.hypot(dx, dy);
  if (len < 1e-9) { this._dot(x0, y0, lw / 2, c, a); return; }
  var steps = Math.ceil(len) + 1;
  var r = lw / 2;
  for (var i = 0; i <= steps; i++) {
    var t = i / steps;
    this._dot(x0 + dx * t, y0 + dy * t, r, c, a);
  }
};

Ctx.prototype._dot = function (x, y, r, c, a) {
  if (r <= 0.5) { this._px(Math.round(x), Math.round(y), c.r, c.g, c.b, a); return; }
  var r2 = r * r;
  var x0 = Math.floor(x - r), x1 = Math.ceil(x + r);
  var y0 = Math.floor(y - r), y1 = Math.ceil(y + r);
  for (var yy = y0; yy <= y1; yy++) {
    for (var xx = x0; xx <= x1; xx++) {
      var ddx = xx + 0.5 - x, ddy = yy + 0.5 - y;
      var d2 = ddx * ddx + ddy * ddy;
      if (d2 <= r2) {
        var cov = Math.min(1, (r2 - d2) / Math.max(1e-6, r));
        this._px(xx, yy, c.r, c.g, c.b, a * Math.min(1, 0.55 + cov));
      }
    }
  }
};

/* ---- a compact 5x7 font so labels are actually readable in the PNG ---- */
var GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '11111', '10001', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '01110', '00011'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '×': ['00000', '10001', '01010', '00100', '01010', '10001', '00000']
};

function drawSimpleText(ctx, text, x, y, c, a) {
  var s = 1.55;                 // scale so caps are ~11 px tall
  var gw = 6 * s, gh = 7 * s;
  var cx = x, cy = y - gh / 2;  // vertically centred like the renderer
  for (var i = 0; i < text.length; i++) {
    var ch = text[i].toUpperCase();
    var g = GLYPHS[ch] || GLYPHS[' '];
    for (var r = 0; r < 7; r++) {
      for (var col = 0; col < 5; col++) {
        if (g[r][col] === '1') {
          var px = cx + col * s, py = cy + r * s;
          for (var sy = 0; sy < Math.ceil(s); sy++) {
            for (var sx = 0; sx < Math.ceil(s); sx++) {
              ctx._px(Math.round(px + sx), Math.round(py + sy), c.r, c.g, c.b, a);
            }
          }
        }
      }
    }
    cx += gw;
  }
}

/* ---- PNG encoding ---- */
function crc32(buf) {
  var table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  var crc = -1;
  for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var t = Buffer.from(type, 'ascii');
  var body = Buffer.concat([t, data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, ctx) {
  var w = ctx.w, h = ctx.h;
  var raw = Buffer.alloc((w * 3 + 1) * h);
  var p = 0;
  for (var y = 0; y < h; y++) {
    raw[p++] = 0;
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 3;
      raw[p++] = Math.max(0, Math.min(255, Math.round(ctx.buf[i])));
      raw[p++] = Math.max(0, Math.min(255, Math.round(ctx.buf[i + 1])));
      raw[p++] = Math.max(0, Math.min(255, Math.round(ctx.buf[i + 2])));
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

/* ==================================================================== *
 * Scene drawing — mirrors js/render.js but without gradients, so the
 * layout (positions, sizes, orbit rings, trails, labels) can be judged.
 * ==================================================================== */

function rgbaOf(hex, a) {
  var h = hex.replace('#', '');
  var n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function shade(hex, f) {
  var h = hex.replace('#', '');
  var n = parseInt(h, 16);
  var r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  var g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  var b = Math.min(255, (n & 255) * f) | 0;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function orbitSegments(rPx) {
  if (rPx <= 0) return 96;
  var need = Math.PI / Math.sqrt(2 * 0.35 / rPx);
  var s = Math.min(2048, Math.max(96, Math.ceil(need)));
  return Math.pow(2, Math.ceil(Math.log2(s)));
}

function orbitRadiusPx(sim, cam, view, scale, body) {
  var centre = body.kind === 'moon'
    ? sim.positionAt(body.parentBody, sim.time) : { x: 0, y: 0, z: 0 };
  var rAU = body.kind === 'moon' ? body.orbitRadiusAU : body.a;
  var a = P.project(cam, view, scale, centre);
  var b = P.project(cam, view, scale, { x: centre.x + rAU, y: centre.y, z: centre.z });
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Draw a full scene. Returns the projected screen positions so a caller can
 * assert on them as well as look at the picture.
 */
function drawScene(opts) {
  var sim = new S.Sim();
  sim.time = opts.time || 0;
  var cam = new P.Camera();
  cam.zoom = opts.zoom;
  cam.tilt = opts.tilt === undefined ? 0.5 : opts.tilt;
  cam.x = opts.camX || 0;
  cam.y = opts.camY || 0;
  var W = opts.width || 1280, H = opts.height || 800;
  var ctx = new Ctx(W, H);
  var view = P.makeView(cam, W, H);
  var scale = new P.WorldScale(cam.zoom);

  if (opts.focusId) {
    // The camera lives in the viewing frame, so the pan target is the body's
    // position ROTATED into that frame (see projection.js). Using the raw
    // ecliptic position would offset the view by the body's inclination.
    var fp = sim.positionAt(sim.byId[opts.focusId], sim.time);
    cam.x = fp.x;
    cam.y = fp.y * view.ca - fp.z * view.sa;
  }

  ctx.fillStyle = '#05060c';
  ctx.fillRect(0, 0, W, H);

  // screen positions
  var screen = {};
  sim.bodies.forEach(function (b) {
    screen[b.id] = P.project(cam, view, scale, sim.positionAt(b, sim.time));
  });

  // orbits
  if (opts.orbits !== false) {
    sim.bodies.forEach(function (b) {
      if (b.kind === 'star') return;
      var segs = orbitSegments(orbitRadiusPx(sim, cam, view, scale, b));
      var pts = sim.orbitPathAt(b, sim.time, segs);
      ctx.beginPath();
      pts.forEach(function (p) {
        var s = P.project(cam, view, scale, p);
        ctx.lineTo(s.x, s.y);
      });
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgbaOf(b.color, b.kind === 'moon' ? 0.42 : 0.34);
      ctx.stroke();
    });
  }

  // trails
  if (opts.trails !== false) {
    sim.bodies.forEach(function (b) {
      if (b.kind === 'star') return;
      var iv = sim.trailInterval(b);
      var n = 300;
      ctx.beginPath();
      for (var k = n; k >= 1; k--) {
        var p = sim.positionAt(b, sim.time - k * iv);
        var s = P.project(cam, view, scale, p);
        ctx.lineTo(s.x, s.y);
      }
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgbaOf(b.glow || b.color, 0.45);
      ctx.stroke();
    });
  }

  // bodies
  sim.bodies.forEach(function (b) {
    var s = screen[b.id];
    var r = P.radiusPx(b, cam, view, scale, !!opts.trueScale);
    if (b.kind === 'star') {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 3.2, 0, TAU);
      ctx.fillStyle = 'rgba(255,170,40,0.18)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.fillStyle = shade(b.color, 1.0);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(r, 0.7), 0, TAU);
      ctx.fillStyle = b.color;
      ctx.fill();
    }
    if (b.id === opts.selectedId) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(r + 6, 9), 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  });

  // labels (collision-avoiding, same policy as the renderer)
  if (opts.labels !== false) {
    var placed = [];
    var list = sim.bodies.filter(function (b) { return b.kind !== 'moon'; });
    if (opts.focusId && cam.zoom > 20) {
      (sim.moonsByParent[opts.focusId] || []).forEach(function (m) { list.push(m); });
    }
    ctx.fillStyle = '#c8d4f5';
    list.forEach(function (b) {
      var s = screen[b.id];
      var r = P.radiusPx(b, cam, view, scale, !!opts.trueScale);
      var tw = ctx.measureText(b.name).width, pad = 4, w = tw + pad * 2, h = 15;
      var cands = [
        { x: s.x + r + 7, y: s.y - h / 2 },
        { x: s.x - r - 7 - w, y: s.y - h / 2 },
        { x: s.x - w / 2, y: s.y - r - 7 - h },
        { x: s.x - w / 2, y: s.y + r + 7 }
      ];
      var chosen = null;
      for (var i = 0; i < cands.length; i++) {
        var box = { x: cands[i].x, y: cands[i].y, w: w, h: h };
        if (box.x < 2 || box.x + box.w > W - 2 || box.y < 2 || box.y + box.h > H - 2) continue;
        var clash = placed.some(function (o) {
          return box.x < o.x + o.w + 3 && box.x + box.w + 3 > o.x &&
                 box.y < o.y + o.h + 2 && box.y + box.h + 2 > o.y;
        });
        if (!clash) { chosen = box; break; }
      }
      if (!chosen) return;
      placed.push(chosen);
      ctx.fillStyle = 'rgba(6,8,18,0.72)';
      ctx.fillRect(chosen.x, chosen.y, chosen.w, chosen.h);
      ctx.fillStyle = '#dbe4ff';
      ctx.fillText(b.name, chosen.x + pad, chosen.y + h / 2);
    });
  }

  return { ctx: ctx, screen: screen, cam: cam, view: view, scale: scale, sim: sim };
}

/* ==================================================================== *
 * CLI
 * ==================================================================== */

function main() {
  var outDir = process.argv[2] || path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  var shots = [
    { name: '01-full-system', zoom: 0.7, time: 0, selectedId: 'earth',
      note: 'the full system preset, Mercury out to Pluto' },
    { name: '02-system-view', zoom: 8, time: 0, selectedId: 'earth',
      note: 'the default view preset' },
    { name: '02b-inner', zoom: 40, time: 0,
      note: 'inner preset: Mercury to Mars' },
    { name: '03-jupiter-view', zoom: 1000, time: 0, focusId: 'jupiter',
      selectedId: 'io',
      note: "Jupiter's Galilean moons at the local scale" },
    { name: '04-earth-moon-view', zoom: 1000, time: 0, focusId: 'earth',
      selectedId: 'moon',
      note: "Earth and the Moon, Moon's orbit ring" },
    { name: '05-earth-moon-close', zoom: 2200, time: 0, focusId: 'earth',
      note: 'close on Earth: the Moon should be clearly outside the disc' },
    { name: '06-system-tilted', zoom: 8, time: 900, tilt: 0.18,
      note: 'low tilt: orbits foreshorten toward edge-on' },
    { name: '07-neptune', zoom: 300, time: 2000, focusId: 'neptune',
      note: 'outer system focus' },
    { name: '08-saturn-rings', zoom: 600, time: 0, focusId: 'saturn',
      note: 'Saturn: ring system' },
    { name: '09-true-scale', zoom: 1000, time: 0, focusId: 'jupiter',
      trueScale: true,
      note: 'TRUE SCALE bodies: Jupiter and moons become specks (correct!)' },
    { name: '10-mobile', width: 390, height: 780, zoom: 8, time: 0,
      note: 'narrow viewport' }
  ];

  var manifest = [];
  shots.forEach(function (sh) {
    var r = drawScene(sh);
    var file = path.join(outDir, sh.name + '.png');
    var bytes = writePng(file, r.ctx);

    // measure every body's drawn radius and its screen position
    var rows = r.sim.bodies.map(function (b) {
      var s = r.screen[b.id];
      var rad = P.radiusPx(b, r.cam, r.view, r.scale, !!sh.trueScale);
      var onScreen = s.x >= 0 && s.x <= r.ctx.w && s.y >= 0 && s.y <= r.ctx.h;
      return {
        id: b.id,
        x: +s.x.toFixed(1), y: +s.y.toFixed(1),
        r: +rad.toFixed(2),
        onScreen: onScreen
      };
    });
    manifest.push({ shot: sh.name, note: sh.note, file: file, bytes: bytes, bodies: rows });
    console.log(sh.name.padEnd(22) + (bytes / 1024).toFixed(0).padStart(5) + ' KB  ' + sh.note);
  });

  var manifestFile = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log('\nwrote ' + shots.length + ' PNGs + manifest.json to ' + outDir);
}

if (require.main === module) main();

module.exports = { drawScene: drawScene, writePng: writePng, Ctx: Ctx };

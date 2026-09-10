/* ==========================================================================
   physics.js — a compact 2D particle physics engine (Verlet + constraints)
   --------------------------------------------------------------------------
   Written from scratch for the Rube Goldberg machine. It is deliberately
   small but it is a *real* simulator: nothing in the machine moves because a
   timer told it to. Every stage is driven by contacts, gravity, leverage and
   momentum, so stage N+1 can only happen if stage N physically pushes it.

   Model
     * Particles      : position + implied velocity (Verlet), mass, radius.
     * DistanceConstraint : rigid rods / ropes / pivots (solved iteratively).
     * Spring         : soft force-based spring (used by the launcher).
     * PulleyConstraint   : rope over a pulley, exact path-length constraint.
     * Segment/Circle : static colliders (ramps, walls, chutes, pulley wheels).
     * World          : fixed-timestep integrator + collision resolution.

   Units: 1 world unit = 1 pixel, gravity in px/s^2. Timestep is fixed so the
   whole simulation is deterministic and can be replayed, paused or stepped.
   ========================================================================== */

'use strict';

var clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
var EPS = 1e-9;

/* -------------------------------------------------------------------------- */
/* Particle                                                                   */
/* -------------------------------------------------------------------------- */

function Particle(x, y, opts) {
  opts = opts || {};
  this.x = x; this.y = y;
  this.px = x; this.py = y;
  this.r = opts.r !== undefined ? opts.r : 5;
  this.mass = opts.mass !== undefined ? opts.mass : 1;
  this.pinned = !!opts.pinned;
  this.invMass = this.pinned ? 0 : 1 / this.mass;
  this.damping = opts.damping !== undefined ? opts.damping : 0.9995;
  this.restitution = opts.restitution !== undefined ? opts.restitution : 0.12;
  this.friction = opts.friction !== undefined ? opts.friction : 0.35;
  /* rolling discs get proper spin dynamics (ball rolls instead of sliding) */
  this.rolls = !!opts.rolls;
  this.spinDamping = opts.spinDamping !== undefined ? opts.spinDamping : 0.995;
  this.angle = 0;
  this.angVel = 0;
  /* axis lock: 'x' keeps the particle on a vertical rail, 'y' on horizontal */
  this.lockAxis = opts.lockAxis || null;
  this.lockValue = opts.lockValue !== undefined ? opts.lockValue : (this.lockAxis === 'x' ? x : y);
  this.collides = opts.collides !== undefined ? opts.collides : true;
  this.tag = opts.tag || '';
  /* runtime bookkeeping (audio / fx / stage triggers) */
  this.impactSpeed = 0;
  this.contact = false;
}

Particle.prototype.vx = function (dt) { return (this.x - this.px) / dt; };
Particle.prototype.vy = function (dt) { return (this.y - this.py) / dt; };

/* Impulse in mass * (px/s). */
Particle.prototype.applyImpulse = function (jx, jy, dt) {
  if (this.pinned) return;
  this.px -= jx * this.invMass * dt;
  this.py -= jy * this.invMass * dt;
};

/* Direct velocity change in px/s. */
Particle.prototype.addVelocity = function (dvx, dvy, dt) {
  if (this.pinned) return;
  this.px -= dvx * dt;
  this.py -= dvy * dt;
};

Particle.prototype.speed = function (dt) {
  var dx = (this.x - this.px) / dt, dy = (this.y - this.py) / dt;
  return Math.sqrt(dx * dx + dy * dy);
};

Particle.prototype.snapshot = function () {
  return { x: this.x, y: this.y, px: this.px, py: this.py, angle: this.angle, angVel: this.angVel };
};
Particle.prototype.restore = function (s) {
  this.x = s.x; this.y = s.y; this.px = s.px; this.py = s.py;
  this.angle = s.angle; this.angVel = s.angVel;
};

/* -------------------------------------------------------------------------- */
/* Distance constraint — rigid rod, rope (max) or strut (min)                 */
/* -------------------------------------------------------------------------- */

function DistanceConstraint(a, b, opts) {
  opts = opts || {};
  var dx = b.x - a.x, dy = b.y - a.y;
  this.a = a; this.b = b;
  this.length = opts.length !== undefined ? opts.length : Math.sqrt(dx * dx + dy * dy);
  this.stiffness = opts.stiffness !== undefined ? opts.stiffness : 1;
  this.mode = opts.mode || 'exact';   // 'exact' | 'max' | 'min'
  this.enabled = true;
}

DistanceConstraint.prototype.solve = function () {
  if (!this.enabled) return;
  var a = this.a, b = this.b;
  var dx = b.x - a.x, dy = b.y - a.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return;
  var diff = d - this.length;
  if (this.mode === 'max' && diff <= 0) return;
  if (this.mode === 'min' && diff >= 0) return;
  var w = a.invMass + b.invMass;
  if (w === 0) return;
  var k = (this.stiffness * diff) / (d * w);
  var nx = dx * k, ny = dy * k;
  a.x += nx * a.invMass; a.y += ny * a.invMass;
  b.x -= nx * b.invMass; b.y -= ny * b.invMass;
};

/* -------------------------------------------------------------------------- */
/* Spring — soft, force based, integrated (not solved iteratively)            */
/* -------------------------------------------------------------------------- */

function Spring(a, b, opts) {
  opts = opts || {};
  var dx = b.x - a.x, dy = b.y - a.y;
  this.a = a; this.b = b;
  this.rest = opts.rest !== undefined ? opts.rest : Math.sqrt(dx * dx + dy * dy);
  this.k = opts.k !== undefined ? opts.k : 60;          // 1/s^2 style stiffness
  this.damping = opts.damping !== undefined ? opts.damping : 0.6;
  this.enabled = true;
  this.compression = 0;   // for rendering
}

Spring.prototype.apply = function (dt) {
  if (!this.enabled) return;
  var a = this.a, b = this.b;
  var dx = b.x - a.x, dy = b.y - a.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d < EPS) return;
  var nx = dx / d, ny = dy / d;
  var stretch = d - this.rest;
  this.compression = stretch;
  var f = -this.k * stretch;                       // negative = pull together
  /* relative velocity damping along the spring axis */
  var rvx = (b.x - b.px) - (a.x - a.px);
  var rvy = (b.y - b.py) - (a.y - a.py);
  var vn = (rvx * nx + rvy * ny) / dt;
  f -= this.damping * vn;
  var ax = nx * f, ay = ny * f;
  if (a.invMass) { a.x -= ax * a.invMass * dt * dt; a.y -= ay * a.invMass * dt * dt; }
  if (b.invMass) { b.x += ax * b.invMass * dt * dt; b.y += ay * b.invMass * dt * dt; }
};

/* -------------------------------------------------------------------------- */
/* PulleyConstraint — rope of fixed total length running over a pulley        */
/* -------------------------------------------------------------------------- */

function PulleyConstraint(a, b, pulley, opts) {
  opts = opts || {};
  this.a = a; this.b = b;
  this.pulley = pulley;                       // {x, y, r}
  this.length = opts.length !== undefined ? opts.length : this.pathLength();
  this.stiffness = opts.stiffness !== undefined ? opts.stiffness : 1;
  this.enabled = true;
}

PulleyConstraint.prototype.pathLength = function () {
  var p = this.pulley;
  var d1 = Math.sqrt((this.a.x - p.x) * (this.a.x - p.x) + (this.a.y - p.y) * (this.a.y - p.y));
  var d2 = Math.sqrt((this.b.x - p.x) * (this.b.x - p.x) + (this.b.y - p.y) * (this.b.y - p.y));
  return d1 + d2;
};

PulleyConstraint.prototype.solve = function () {
  if (!this.enabled) return;
  var p = this.pulley;
  var ax = this.a.x - p.x, ay = this.a.y - p.y;
  var bx = this.b.x - p.x, by = this.b.y - p.y;
  var d1 = Math.sqrt(ax * ax + ay * ay) || EPS;
  var d2 = Math.sqrt(bx * bx + by * by) || EPS;
  var diff = (d1 + d2) - this.length;
  if (Math.abs(diff) < 1e-6) return;
  var w = this.a.invMass + this.b.invMass;
  if (w === 0) return;
  var lambda = (this.stiffness * diff) / w;
  var u1x = ax / d1, u1y = ay / d1;
  var u2x = bx / d2, u2y = by / d2;
  this.a.x -= u1x * lambda * this.a.invMass;
  this.a.y -= u1y * lambda * this.a.invMass;
  this.b.x -= u2x * lambda * this.b.invMass;
  this.b.y -= u2y * lambda * this.b.invMass;
};

/* -------------------------------------------------------------------------- */
/* Static colliders                                                           */
/* -------------------------------------------------------------------------- */

function Segment(ax, ay, bx, by, opts) {
  opts = opts || {};
  this.ax = ax; this.ay = ay; this.bx = bx; this.by = by;
  this.r = opts.r !== undefined ? opts.r : 4;              // half thickness
  this.restitution = opts.restitution !== undefined ? opts.restitution : 0.1;
  this.friction = opts.friction !== undefined ? opts.friction : 0.3;
  this.oneWay = opts.oneWay || false;
  this.tag = opts.tag || '';
  this.minX = Math.min(ax, bx) - this.r; this.maxX = Math.max(ax, bx) + this.r;
  this.minY = Math.min(ay, by) - this.r; this.maxY = Math.max(ay, by) + this.r;
  /* used by the renderer for cosmetic variation */
  this.style = opts.style || null;
}

Segment.prototype.normal = function () {
  var dx = this.bx - this.ax, dy = this.by - this.ay;
  var d = Math.sqrt(dx * dx + dy * dy) || EPS;
  return { x: -dy / d, y: dx / d };
};

function CircleCollider(x, y, r, opts) {
  opts = opts || {};
  this.x = x; this.y = y; this.r = r;
  this.restitution = opts.restitution !== undefined ? opts.restitution : 0.1;
  this.friction = opts.friction !== undefined ? opts.friction : 0.2;
  this.tag = opts.tag || '';
}

/* -------------------------------------------------------------------------- */
/* Spatial hash                                                               */
/* -------------------------------------------------------------------------- */

function SpatialHash(cell) {
  this.cell = cell;
  this.map = new Map();
}

SpatialHash.prototype.key = function (cx, cy) { return cx * 73856093 ^ cy * 19349663; };

SpatialHash.prototype.insert = function (item, minX, minY, maxX, maxY) {
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
  var c = this.cell;
  var x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
  var y0 = Math.floor(minY / c), y1 = Math.floor(maxY / c);
  if (x1 - x0 > 64 || y1 - y0 > 64) return;      // absurd span: ignore
  x0 = clamp(x0, -100000, 100000); x1 = clamp(x1, -100000, 100000);
  y0 = clamp(y0, -100000, 100000); y1 = clamp(y1, -100000, 100000);
  for (var cx = x0; cx <= x1; cx++) {
    for (var cy = y0; cy <= y1; cy++) {
      var k = this.key(cx, cy);
      var bucket = this.map.get(k);
      if (!bucket) { bucket = []; this.map.set(k, bucket); }
      bucket.push(item);
    }
  }
};

SpatialHash.prototype.query = function (x, y) {
  return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell)));
};

SpatialHash.prototype.clear = function () { this.map.clear(); };

/* -------------------------------------------------------------------------- */
/* World                                                                      */
/* -------------------------------------------------------------------------- */

function World(opts) {
  opts = opts || {};
  this.dt = opts.dt !== undefined ? opts.dt : 1 / 240;
  this.gx = opts.gx !== undefined ? opts.gx : 0;
  this.gy = opts.gy !== undefined ? opts.gy : 1000;
  this.iterations = opts.iterations !== undefined ? opts.iterations : 7;
  this.airDamping = opts.airDamping !== undefined ? opts.airDamping : 0.9995;
  this.particles = [];
  this.constraints = [];
  this.springs = [];
  this.segments = [];
  this.circles = [];
  this.capsules = [];          // dynamic capsule colliders (rods)
  this.time = 0;
  this.grid = new SpatialHash(56);
  this.segGrid = new SpatialHash(56);
  this.capGrid = new SpatialHash(56);
  this.impactEvents = [];      // {x, y, speed, mass, tag} for audio + sparks
  this.staticDirty = true;
  this.killY = opts.killY !== undefined ? opts.killY : 1e9;
  this.killX = opts.killX !== undefined ? opts.killX : 1600;
  this.onContact = null;
}

World.prototype.addCapsule = function (a, b, r, body) {
  var cap = { a: a, b: b, r: r, body: body || null };
  this.capsules.push(cap);
  return cap;
};

World.prototype.addParticle = function (p) { this.particles.push(p); return p; };

World.prototype.rod = function (x1, y1, x2, y2, opts) {
  opts = opts || {};
  var a = this.addParticle(new Particle(x1, y1, opts));
  var b = this.addParticle(new Particle(x2, y2, opts));
  var c = new DistanceConstraint(a, b, { length: opts.length, stiffness: opts.stiffness });
  this.constraints.push(c);
  return { a: a, b: b, constraint: c };
};

World.prototype.pin = function (a, b, opts) {
  var c = new DistanceConstraint(a, b, opts);
  this.constraints.push(c);
  return c;
};

World.prototype.addSegment = function (seg) {
  this.segments.push(seg); this.staticDirty = true; return seg;
};

World.prototype.addCircle = function (c) {
  this.circles.push(c); this.staticDirty = true; return c;
};

World.prototype.rebuildStatic = function () {
  var g = this.segGrid;
  g.clear();
  var pad = 24;
  for (var i = 0; i < this.segments.length; i++) {
    var s = this.segments[i];
    g.insert(s, s.minX - pad, s.minY - pad, s.maxX + pad, s.maxY + pad);
  }
  this.staticDirty = false;
};

/* -- dynamic capsules (a rod is a solid bar, not a dotted line) ------------ */

World.prototype.rebuildCapsules = function () {
  var g = this.capGrid;
  g.clear();
  var pad = 22;
  for (var i = 0; i < this.capsules.length; i++) {
    var cap = this.capsules[i];
    var minX = Math.min(cap.a.x, cap.b.x) - cap.r, maxX = Math.max(cap.a.x, cap.b.x) + cap.r;
    var minY = Math.min(cap.a.y, cap.b.y) - cap.r, maxY = Math.max(cap.a.y, cap.b.y) + cap.r;
    g.insert(cap, minX - pad, minY - pad, maxX + pad, maxY + pad);
  }
};

World.prototype.solveParticleCapsule = function (p, cap, dt) {
  var a = cap.a, b = cap.b;
  if (a === p || b === p) return;
  if (cap.body && p.body && cap.body === p.body) return;

  var ex = b.x - a.x, ey = b.y - a.y;
  var len2 = ex * ex + ey * ey;
  var t = len2 > EPS ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2 : 0;
  t = clamp(t, 0, 1);
  var cx = a.x + ex * t, cy = a.y + ey * t;
  var dx = p.x - cx, dy = p.y - cy;
  var minD = p.r + cap.r;
  var d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD) return;
  var d = Math.sqrt(d2);
  var nx, ny;
  if (d < EPS) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
  var pen = minD - d;

  var wA = 1 - t, wB = t;
  var rodW = wA * wA * a.invMass + wB * wB * b.invMass;
  var w = p.invMass + rodW;
  if (w === 0) return;

  /* velocity neutral positional fix */
  var corr = pen / w;
  p.x += nx * corr * p.invMass; p.y += ny * corr * p.invMass;
  p.px += nx * corr * p.invMass; p.py += ny * corr * p.invMass;
  var rax = -nx * corr * wA, ray = -ny * corr * wA;
  a.x += rax * a.invMass; a.y += ray * a.invMass;
  a.px += rax * a.invMass; a.py += ray * a.invMass;
  var rbx = -nx * corr * wB, rby = -ny * corr * wB;
  b.x += rbx * b.invMass; b.y += rby * b.invMass;
  b.px += rbx * b.invMass; b.py += rby * b.invMass;

  /* relative velocity at the contact */
  var vpx = (p.x - p.px) / dt, vpy = (p.y - p.py) / dt;
  var vcx = wA * (a.x - a.px) / dt + wB * (b.x - b.px) / dt;
  var vcy = wA * (a.y - a.py) / dt + wB * (b.y - b.py) / dt;
  var rvx = vpx - vcx, rvy = vpy - vcy;
  var vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;
  p.contact = true;

  var e = Math.min(p.restitution, a.restitution, b.restitution);
  var Jn = -(1 + e) * vn / w;
  p.px -= nx * Jn * p.invMass * dt; p.py -= ny * Jn * p.invMass * dt;
  a.px += nx * Jn * wA * a.invMass * dt; a.py += ny * Jn * wA * a.invMass * dt;
  b.px += nx * Jn * wB * b.invMass * dt; b.py += ny * Jn * wB * b.invMass * dt;

  if (-vn > 45) {
    this.impactEvents.push({ x: cx, y: cy, speed: -vn, mass: Math.min(p.mass, 1 / (w || 1)), tag: cap.body || 'rod' });
  }

  /* friction */
  var tx = -ny, ty = nx;
  var vt = rvx * tx + rvy * ty;
  var eff = w;
  if (p.rolls) { vt -= p.angVel * p.r; eff += 2 * p.invMass; }
  var mu = Math.sqrt(Math.max(p.friction, 0.001) * Math.max(a.friction, 0.001));
  var Jt = clamp(-vt / eff, -mu * Math.abs(Jn), mu * Math.abs(Jn));
  p.px -= tx * Jt * p.invMass * dt; p.py -= ty * Jt * p.invMass * dt;
  a.px += tx * Jt * wA * a.invMass * dt; a.py += ty * Jt * wA * a.invMass * dt;
  b.px += tx * Jt * wB * b.invMass * dt; b.py += ty * Jt * wB * b.invMass * dt;
  if (p.rolls) p.angVel -= 2 * Jt * p.invMass / p.r;
};

/* -- integration ---------------------------------------------------------- */

World.prototype.integrate = function () {
  var dt = this.dt, dt2 = dt * dt;
  var ps = this.particles;
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (p.pinned) continue;
    var vx = (p.x - p.px) * p.damping;
    var vy = (p.y - p.py) * p.damping;
    p.px = p.x; p.py = p.y;
    p.x += vx + this.gx * dt2;
    p.y += vy + this.gy * dt2;
    p.impactSpeed = 0;
    p.contact = false;
  }
};

World.prototype.applyLocks = function () {
  var ps = this.particles;
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (!p.lockAxis) continue;
    if (p.lockAxis === 'x') { p.x = p.lockValue; p.px = p.lockValue; }
    else { p.y = p.lockValue; p.py = p.lockValue; }
  }
};

/* -- collision ------------------------------------------------------------ */

World.prototype.collide = function () {
  var dt = this.dt;
  var ps = this.particles;
  var i, j, p;

  /* dynamic vs dynamic */
  var grid = this.grid;
  grid.clear();
  for (i = 0; i < ps.length; i++) {
    p = ps[i];
    if (!p.collides || p.invMass === 0) continue;
    grid.insert(p, p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r);
  }
  for (i = 0; i < ps.length; i++) {
    p = ps[i];
    if (!p.collides || p.invMass === 0) continue;
    var bucket = grid.query(p.x, p.y);
    if (!bucket) continue;
    for (j = 0; j < bucket.length; j++) {
      var q = bucket[j];
      if (q === p) continue;
      if (q.tag && p.tag && q.tag === p.tag && q.__rod === p.__rod) continue;
      this.solvePair(p, q, dt);
    }
  }

  /* dynamic vs static */
  if (this.staticDirty) this.rebuildStatic();
  var sg = this.segGrid;
  for (i = 0; i < ps.length; i++) {
    p = ps[i];
    if (!p.collides || p.invMass === 0) continue;
    var sb = sg.query(p.x, p.y);
    if (sb) {
      for (j = 0; j < sb.length; j++) this.solveParticleSegment(p, sb[j], dt);
    }
    for (j = 0; j < this.circles.length; j++) this.solveParticleCircle(p, this.circles[j], dt);
  }

  /* dynamic vs dynamic capsules (rods act as solid bars) */
  if (this.capsules.length) {
    this.rebuildCapsules();
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (!p.collides || p.invMass === 0) continue;
      var cb = this.capGrid.query(p.x, p.y);
      if (!cb) continue;
      for (j = 0; j < cb.length; j++) this.solveParticleCapsule(p, cb[j], dt);
    }
  }
};

World.prototype.solvePair = function (a, b, dt) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var minD = a.r + b.r;
  var d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 < EPS) return;
  var d = Math.sqrt(d2);
  var nx = dx / d, ny = dy / d;          // normal, a -> b
  var pen = minD - d;
  var w = a.invMass + b.invMass;
  if (w === 0) return;

  /* positional correction, mass weighted (velocity neutral) */
  var corr = pen / w;
  a.x -= nx * corr * a.invMass; a.y -= ny * corr * a.invMass;
  a.px -= nx * corr * a.invMass; a.py -= ny * corr * a.invMass;
  b.x += nx * corr * b.invMass; b.y += ny * corr * b.invMass;
  b.px += nx * corr * b.invMass; b.py += ny * corr * b.invMass;

  /* relative velocity of b with respect to a */
  var rvx = (b.x - b.px) - (a.x - a.px);
  var rvy = (b.y - b.py) - (a.y - a.py);
  var vn = (rvx * nx + rvy * ny) / dt;
  if (vn > 0) return;                    // separating

  var e = Math.min(a.restitution, b.restitution);
  var Jn = -(1 + e) * vn / w;            // impulse magnitude (mass * velocity)
  a.px += nx * Jn * a.invMass * dt; a.py += ny * Jn * a.invMass * dt;
  b.px -= nx * Jn * b.invMass * dt; b.py -= ny * Jn * b.invMass * dt;

  if (-vn > 40) {
    this.impactEvents.push({ x: a.x + nx * a.r, y: a.y + ny * a.r, speed: -vn, mass: Math.min(a.mass, b.mass), tag: 'pair' });
  }

  /* tangential friction (with rolling discs) */
  var tx = -ny, ty = nx;
  var vt = (rvx * tx + rvy * ty) / dt;
  var eff = w;
  if (a.rolls) { vt -= a.angVel * a.r; eff += 2 * a.invMass; }
  if (b.rolls) { vt -= b.angVel * b.r; eff += 2 * b.invMass; }
  var mu = Math.sqrt(Math.max(a.friction, 0.001) * Math.max(b.friction, 0.001));
  var Jt = clamp(-vt / eff, -mu * Math.abs(Jn), mu * Math.abs(Jn));
  a.px += tx * Jt * a.invMass * dt; a.py += ty * Jt * a.invMass * dt;
  b.px -= tx * Jt * b.invMass * dt; b.py -= ty * Jt * b.invMass * dt;
  if (a.rolls) a.angVel -= 2 * Jt * a.invMass / a.r;
  if (b.rolls) b.angVel -= 2 * Jt * b.invMass / b.r;
};

World.prototype.solveParticleSegment = function (p, s, dt) {
  var ax = s.ax, ay = s.ay;
  var ex = s.bx - ax, ey = s.by - ay;
  var len2 = ex * ex + ey * ey;
  var t = len2 > EPS ? ((p.x - ax) * ex + (p.y - ay) * ey) / len2 : 0;
  t = clamp(t, 0, 1);
  var cx = ax + ex * t, cy = ay + ey * t;
  var dx = p.x - cx, dy = p.y - cy;
  var minD = p.r + s.r;
  var d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD) return;
  var d = Math.sqrt(d2);
  var nx, ny;
  if (d < EPS) {
    var n = s.normal();
    nx = n.x; ny = n.y;
    d = 0;
  } else { nx = dx / d; ny = dy / d; }

  if (s.oneWay) {
    var nrm = s.normal();
    if (nx * nrm.x + ny * nrm.y < 0.2) return;
  }

  var pen = minD - d;
  /* Move position *and* previous position: a pure positional fix must not
     inject velocity, otherwise resting contacts lose friction and never roll. */
  p.x += nx * pen; p.y += ny * pen;
  p.px += nx * pen; p.py += ny * pen;

  var vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
  var vn = vx * nx + vy * ny;
  if (vn >= 0) return;
  p.contact = true;

  var e = s.restitution;
  var Jn = -(1 + e) * vn;                       // dv along normal
  p.px -= nx * Jn * dt; p.py -= ny * Jn * dt;

  if (-vn > 45) {
    this.impactEvents.push({ x: cx, y: cy, speed: -vn, mass: p.mass, tag: s.tag || 'static' });
  }

  /* tangential friction (with rolling discs) */
  var tx = -ny, ty = nx;
  var vt = vx * tx + vy * ty;
  var eff = 1;
  if (p.rolls) { vt -= p.angVel * p.r; eff = 3; }
  var mu = Math.sqrt(Math.max(p.friction, 0.001) * Math.max(s.friction, 0.001));
  var Jt = clamp(-vt / eff, -mu * Math.abs(Jn), mu * Math.abs(Jn));
  p.px -= tx * Jt * dt; p.py -= ty * Jt * dt;
  if (p.rolls) p.angVel -= 2 * Jt / p.r;
};

World.prototype.solveParticleCircle = function (p, c, dt) {
  var dx = p.x - c.x, dy = p.y - c.y;
  var minD = p.r + c.r;
  var d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD) return;
  var d = Math.sqrt(d2) || EPS;
  var nx = dx / d, ny = dy / d;
  var pen = minD - d;
  p.x += nx * pen; p.y += ny * pen;
  p.px += nx * pen; p.py += ny * pen;
  var vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
  var vn = vx * nx + vy * ny;
  if (vn >= 0) return;
  var Jn = -(1 + c.restitution) * vn;
  p.px -= nx * Jn * dt; p.py -= ny * Jn * dt;
  var tx = -ny, ty = nx;
  var vt = vx * tx + vy * ty;
  var Jt = clamp(-vt / 1, -c.friction * Math.abs(Jn), c.friction * Math.abs(Jn));
  p.px -= tx * Jt * dt; p.py -= ty * Jt * dt;
};

/* -- main step ------------------------------------------------------------ */

World.prototype.step = function () {
  var dt = this.dt;
  this.impactEvents.length = 0;
  this.integrate();

  for (var k = 0; k < this.springs.length; k++) this.springs[k].apply(dt);

  for (var it = 0; it < this.iterations; it++) {
    for (var i = 0; i < this.constraints.length; i++) this.constraints[i].solve();
    this.collide();
    this.applyLocks();
  }

  /* spin integration for rolling bodies */
  for (var j = 0; j < this.particles.length; j++) {
    var p = this.particles[j];
    if (!p.rolls) continue;
    p.angle += p.angVel * dt;
    p.angVel *= p.spinDamping;
    if (p.angVel > 400) p.angVel = 400;
    if (p.angVel < -400) p.angVel = -400;
  }

  /* safety net: a numerical blow-up must never corrupt the whole scene, and
     anything that leaves the stage is parked so it cannot run away forever */
  for (var g = 0; g < this.particles.length; g++) {
    var q = this.particles[g];
    if (!isFinite(q.x) || !isFinite(q.y)) {
      q.x = q.px = isFinite(q.px) ? q.px : 0;
      q.y = q.py = isFinite(q.py) ? q.py : 0;
      q.angVel = 0;
    }
    if (q.y > this.killY) {
      q.y = q.py = this.killY;
      q.x = q.px = clamp(q.x, -200, this.killX + 200);
      q.angVel = 0;
      q.escaped = true;
    }
  }

  this.time += dt;
};

World.prototype.run = function (seconds) {
  var n = Math.round(seconds / this.dt);
  for (var i = 0; i < n; i++) this.step();
  return n;
};

/* -- snapshots (used for a deterministic reset) --------------------------- */

World.prototype.snapshot = function () {
  var arr = new Array(this.particles.length);
  for (var i = 0; i < this.particles.length; i++) arr[i] = this.particles[i].snapshot();
  return { particles: arr, time: this.time };
};

World.prototype.restore = function (snap) {
  for (var i = 0; i < this.particles.length && i < snap.particles.length; i++) {
    this.particles[i].restore(snap.particles[i]);
  }
  this.time = snap.time;
  this.impactEvents.length = 0;
};

/* Node + browser export ---------------------------------------------------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Particle: Particle,
    DistanceConstraint: DistanceConstraint,
    Spring: Spring,
    PulleyConstraint: PulleyConstraint,
    Segment: Segment,
    CircleCollider: CircleCollider,
    World: World,
    clamp: clamp
  };
}

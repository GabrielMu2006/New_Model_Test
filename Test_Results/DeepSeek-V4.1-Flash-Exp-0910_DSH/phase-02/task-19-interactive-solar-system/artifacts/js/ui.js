/* ==========================================================================
 * ui.js — application state, the time loop, and every user interaction.
 *
 * THE TIME MODEL (this is what satisfies "speed changes must not cause jumps")
 * -------------------------------------------------------------------------
 * The only thing that advances is a scalar `sim.time`, in simulation days:
 *
 *      sim.time += speedDaysPerSecond * realDeltaSeconds
 *
 * Body positions are pure functions of sim.time (see simulation.js), so:
 *   * changing speed changes only the RATE at which time advances; the state
 *     is untouched, so nothing can jump;
 *   * pausing simply stops advancing time, so the scene freezes exactly;
 *   * resuming, reversing, or jumping from 0.01x to 10000x all continue from
 *     the same orbital phase — no re-seeding, no re-phasing.
 * A per-frame guard splits large advances into <= MAX_FRAME_DAYS chunks so a
 * slow frame or a huge speed cannot skip over a trail's sampling interval.
 * The guard limits how far time gets in one frame; it never changes state.
 *
 * Trails record position at ABSOLUTE multiples of a fixed interval, so the
 * recorded path is identical whatever speed it was recorded at.
 * ========================================================================== */
(function (global) {
  'use strict';

  var O = global.SolarOrbital;
  var P = global.SolarProjection;
  var SIM = global.SolarSim;
  var RENDER = global.SolarRender;
  var DATA = global.SolarData;

  // View presets. The Solar System preset shows the four inner planets clearly
  // plus Jupiter; the Full preset shrinks everything until Neptune and Pluto
  // are on screen as well.
  var ZOOM_FULL = 0.62;
  var ZOOM_SYSTEM = 8;
  var ZOOM_INNER = 40;
  var ZOOM_FOCUS = 1000;        // a planet's moon system fills the view here
  var MAX_FRAME_DAYS = 30;      // per-step cap on simulated days
  var MAX_ANCHORS_PER_FRAME = 90; // trail catch-up budget per body per frame
  var ZOOM_MIN = 0.7;   // the full-system preset; below this bodies reorder
  var ZOOM_MAX = 2512;
  var D2R = Math.PI / 180;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function nowMs() {
    return global.performance && global.performance.now
      ? global.performance.now() : Date.now();
  }

  /* ------------------------------------------------------------------ *
   * Calendar formatting: sim.time is days since J2000.0 (2000-01-01 12:00)
   * ------------------------------------------------------------------ */
  function formatSimDate(t) {
    var jd = 2451545.0 + t;
    var z = Math.floor(jd + 0.5);
    var f = jd + 0.5 - z;
    var alpha = Math.floor((z - 1867216.25) / 36524.25);
    var A = z + 1 + alpha - Math.floor(alpha / 4);
    var B = A + 1524;
    var C = Math.floor((B - 122.1) / 365.25);
    var D = Math.floor(365.25 * C);
    var E = Math.floor((B - D) / 30.6001);
    var day = B - D - Math.floor(30.6001 * E) + f;
    var month = E < 14 ? E - 1 : E - 13;
    var year = month > 2 ? C - 4716 : C - 4715;

    var dayInt = Math.floor(day);
    var frac = day - dayInt;
    var hours = frac * 24;
    var hh = Math.floor(hours);
    var mm = Math.floor((hours - hh) * 60);

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var yStr = year < 0 ? (Math.abs(year) + ' BCE') : String(year);
    return dayInt + ' ' + MONTHS[month - 1] + ' ' + yStr +
           '  ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  function formatSpeed(daysPerSecond) {
    var a = Math.abs(daysPerSecond);
    var sign = daysPerSecond < 0 ? '\u2212' : '';
    if (a === 0) return 'paused';
    if (a < 1 / 24) return sign + (a * 24 * 60).toFixed(1) + ' min/s';
    if (a < 1) return sign + (a * 24).toFixed(1) + ' hour/s';
    if (a < 10) return sign + a.toFixed(2) + ' day/s';
    if (a < 400) return sign + a.toFixed(0) + ' day/s';
    return sign + (a / 365.256).toFixed(a < 4000 ? 1 : 0) + ' year/s';
  }

  function formatPeriod(days) {
    if (days < 1) return (days * 24).toFixed(2) + ' h';
    if (days < 400) return days.toFixed(days < 10 ? 3 : 1) + ' d';
    return (days / 365.256).toFixed(2) + ' yr';
  }

  function formatDistanceAU(au) {
    if (au < 0.01) return (au * 149597870.7).toFixed(0) + ' km';
    return au.toFixed(au < 10 ? 3 : 2) + ' AU';
  }

  /* ------------------------------------------------------------------ *
   * App
   * ------------------------------------------------------------------ */

  function App(canvas) {
    this.sim = new SIM.Sim();
    this.cam = new P.Camera();
    this.renderer = new RENDER.Renderer(canvas);
    this.canvas = canvas;

    this.paused = true;
    this.speed = 1;                 // days per second
    this.speedPrecision = 0.01;     // logarithmic slider step

    this.selectedId = null;
    this.focusId = null;
    this.hoverId = null;
    this.follow = false;

    this.opts = {
      orbits: true,
      trails: true,
      labels: true,
      trueScale: false
    };

    this.trails = {};
    this.trailKey = {};
    this.screen = {};
    this.positions = {};
    this.labelBodies = [];

    this._drag = null;
    this._pointers = new Map();
    this._pinch = null;
    this._lastFrame = 0;
    this._elapsed = 0;
    this.trailLag = false;
    this._toastTimer = 0;
    this._rafId = 0;

    this.onFrame = null;            // set by the shell for DOM syncing
    this.onSelect = null;
    this.onFocus = null;

    this._bindInput();
  }

  App.prototype.attach = function () {
    this.renderer.resize();
    this.cam.zoom = ZOOM_SYSTEM;
    this.cam.tilt = 0.5;
    this.cam.x = 0;
    this.cam.y = 0;
    this.seedTrails();
    this.refreshLabels();
    this.start();
  };

  App.prototype.start = function () {
    var self = this;
    if (this._rafId) return;
    this._lastFrame = nowMs();
    var tick = function (now) {
      self._rafId = global.requestAnimationFrame(tick);
      self.frame(now);
    };
    this._rafId = global.requestAnimationFrame(tick);
  };

  App.prototype.stop = function () {
    if (this._rafId) global.cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  };

  /* ------------------------------------------------------------- trails */

  App.prototype.seedTrails = function () {
    this.trails = {};
    this.trailKey = {};
    var sim = this.sim;
    for (var i = 0; i < sim.bodies.length; i++) {
      var b = sim.bodies[i];
      var cap = sim.trailCapacity(b);
      var arr = [];
      if (cap > 2) {
        var iv = sim.trailInterval(b);
        // Backfill one full orbit so the rings are complete from the first
        // frame rather than growing in from nothing.
        var span = Math.min(
          b.kind === 'moon' ? b.period : (b.period || 365),
          b.kind === 'moon' ? b.period : 400 * 365
        );
        var n = Math.min(cap, Math.floor(span / iv));
        for (var k = n; k >= 1; k--) {
          arr.push(sim.positionAt(b, sim.time - k * iv));
        }
      }
      this.trails[b.id] = { points: arr };
      this.trailKey[b.id] = Math.floor(sim.time / sim.trailInterval(b));
    }
  };

  /**
   * Record trail samples at absolute multiples of each body's interval.
   * Because the anchor times are absolute, the recorded path is independent
   * of the speed at which it was recorded.
   */
  App.prototype.updateTrails = function () {
    var sim = this.sim;
    var t = sim.time;
    for (var i = 0; i < sim.bodies.length; i++) {
      var b = sim.bodies[i];
      var cap = sim.trailCapacity(b);
      if (cap <= 2) continue;
      var iv = sim.trailInterval(b);
      var key = Math.floor(t / iv);
      var last = this.trailKey[b.id];
      var tr = this.trails[b.id];
      if (tr === undefined) {
        tr = this.trails[b.id] = { points: [] };
        last = key - 1;
      }
      if (key === last) continue;

      var from = last + 1, to = key;
      var steps = to - from + 1;
      if (steps > MAX_ANCHORS_PER_FRAME) {
        // At extreme speeds the number of anchors between frames can exceed
        // the per-frame budget. Skip ahead rather than stall the frame, and
        // record it so the UI can say the trails are trailing — the alternative
        // is silently drawing a shortened trail and pretending it is complete.
        from = to - MAX_ANCHORS_PER_FRAME + 1;
        this.trailLag = true;
      }
      for (var k = from; k <= to; k++) {
        tr.points.push(sim.positionAt(b, k * iv));
      }
      if (tr.points.length > cap) tr.points.splice(0, tr.points.length - cap);
      this.trailKey[b.id] = to;
    }
  };

  /* --------------------------------------------------------- label list */

  /** Which bodies get labels: named planets always, moons when focused. */
  App.prototype.refreshLabels = function () {
    var sim = this.sim;
    var out = [];
    var z = this.cam.zoom;
    var parentId = this.focusId || (this.selectedId
      ? (sim.byId[this.selectedId].kind === 'moon'
          ? sim.byId[this.selectedId].parent
          : this.selectedId)
      : null);

    for (var i = 0; i < sim.bodies.length; i++) {
      var b = sim.bodies[i];
      if (b.kind === 'moon') continue;
      out.push(b);
    }
    // Show moons of the focused / selected planet once the camera is close.
    if (parentId && z > 20) {
      var moons = sim.moonsByParent[parentId] || [];
      for (var m = 0; m < moons.length; m++) out.push(moons[m]);
    }
    // Also label every moon whose system is on screen and large enough.
    for (var j = 0; j < sim.bodies.length; j++) {
      var mb = sim.bodies[j];
      if (mb.kind !== 'moon') continue;
      if (out.indexOf(mb) !== -1) continue;
      var s = this.screen[mb.id];
      if (!s) continue;
      var p = this.screen[mb.parent];
      if (!p) continue;
      if (Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 46) out.push(mb);
    }
    this.labelBodies = out;
  };

  /* ------------------------------------------------------------- camera */

  App.prototype.fitSystem = function (instant) {
    this.focusId = null;
    if (this.onFocus) this.onFocus(null);
    this.setZoom(ZOOM_SYSTEM, instant ? 0 : undefined, 6.5);
    this.panTo(0, 0, instant);
    this.refreshLabels();
  };

  App.prototype.focusOn = function (id, instant) {
    if (!id || !this.sim.byId[id]) return this.fitSystem(instant);
    var body = this.sim.byId[id];
    // A moon is inspected inside its parent's system: centring on the moon
    // would put the parent off-screen and hide the very relationship the
    // view exists to show.
    var centreId = body.kind === 'moon' ? body.parent : body.id;
    this.focusId = centreId;
    if (this.onFocus) this.onFocus(centreId);
    this.setZoom(ZOOM_FOCUS, instant ? 0 : undefined, 8.5);
    this.panToId(centreId, instant);
    this.refreshLabels();
  };

  App.prototype.setZoom = function (target, instant, tau) {
    this._zoomTarget = clamp(target, ZOOM_MIN, ZOOM_MAX);
    if (instant) this.cam.zoom = this._zoomTarget;
    else if (!this._zoomTau) this._zoomTau = tau || 9;
  };

  App.prototype.panTo = function (x, y, instant) {
    this._panTarget = { x: x, y: y };
    if (instant) { this.cam.x = x; this.cam.y = y; }
  };

  /**
   * Aim the camera at a body.
   *
   * The camera is expressed in the camera's own viewing frame (see
   * projection.js), so the body's position is rotated into that same frame
   * before it becomes the pan target. Using the raw ecliptic position instead
   * would offset the view by the body's inclination — Jupiter would land ~700
   * px below centre at deep zoom, which looks exactly like a camera that
   * refuses to follow.
   */
  App.prototype.panToId = function (id, instant) {
    var p = this.viewPos(id, this.sim.time);
    this.panTo(p.x, p.y, instant);
  };

  /** A body's AU position rotated into the camera's viewing frame. */
  App.prototype.viewPos = function (id, t) {
    var au = this.sim.positionAt(this.sim.byId[id], t);
    var v = this._view;
    if (!v) return { x: au.x, y: au.y };
    return { x: au.x, y: au.y * v.ca - au.z * v.sa };
  };

  /** Zoom by a factor, keeping the world point under (sx, sy) fixed. */
  App.prototype.zoomAt = function (factor, sx, sy) {
    var view = this._view;
    if (!view) return;
    var scale = this._scale;
    var before = P.unproject(this.cam, view, scale, sx, sy);
    var target = clamp(this.cam.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    this.cam.zoom = target;
    this._zoomTarget = target;
    var scale2 = new P.WorldScale(target);
    var after = P.unproject(this.cam, view, scale2, sx, sy);
    // Move the camera so `before` stays under the pointer. Cancel any running
    // pan tween, otherwise it would fight this.
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this._panTarget = { x: this.cam.x, y: this.cam.y };
    this._zoomTau = 0;
    this.refreshLabels();
  };

  /* ---------------------------------------------------------- main loop */

  App.prototype.frame = function (now) {
    var real = (now - this._lastFrame) / 1000;
    this._lastFrame = now;
    if (!isFinite(real) || real < 0) real = 0;
    // A tab that was backgrounded can hand us a multi-second delta; clamp it
    // so returning to the tab never fast-forwards the simulation.
    real = Math.min(real, 0.1);
    this._elapsed += real;

    if (!this.paused && this.speed !== 0) {
      this.advance(real);
    }

    this.updateCamera(real);
    this.render(now / 1000);

    if (this.onFrame) this.onFrame(this, real);
  };

  /**
   * Advance simulation time. Large advances are split into <= MAX_FRAME_DAYS
   * steps so trail sampling stays dense; the clamp caps how far time travels
   * in one frame and never alters the resulting state.
   */
  App.prototype.advance = function (realSeconds) {
    this.trailLag = false;
    var want = this.speed * realSeconds;
    var left = Math.abs(want);
    var sign = want < 0 ? -1 : 1;
    var guard = 0;
    while (left > 1e-12 && guard++ < 64) {
      var h = Math.min(MAX_FRAME_DAYS, left);
      this.sim.time += sign * h;
      left -= h;
    }
    this.updateTrails();
  };

  App.prototype.updateCamera = function (real) {
    var k = Math.min(1, real * 9);

    // Follow keeps the camera on a moving body. The target is recomputed from
    // the CURRENT simulation time every frame, so the camera tracks the body
    // along its orbit instead of drifting behind it.
    if (this.follow && this.focusId) {
      var p = this.viewPos(this.focusId, this.sim.time);
      this._panTarget = { x: p.x, y: p.y };
      this.cam.x += (p.x - this.cam.x) * Math.min(1, real * 14);
      this.cam.y += (p.y - this.cam.y) * Math.min(1, real * 14);
    } else if (this._panTarget) {
      this.cam.x += (this._panTarget.x - this.cam.x) * k;
      this.cam.y += (this._panTarget.y - this.cam.y) * k;
      if (Math.abs(this._panTarget.x - this.cam.x) < 1e-9 &&
          Math.abs(this._panTarget.y - this.cam.y) < 1e-9) {
        this._panTarget = null;
      }
    }

    if (this._zoomTarget) {
      var tau = this._zoomTau || 9;
      var kz = Math.min(1, real * tau);
      var lz = Math.log(this.cam.zoom);
      var lt = Math.log(this._zoomTarget);
      lz += (lt - lz) * kz;
      // Snap when the remaining logarithmic distance is negligible.
      this.cam.zoom = Math.abs(lt - lz) < 1e-4 ? this._zoomTarget : Math.exp(lz);
    }
  };

  App.prototype.render = function (clock) {
    this.renderer.resize();
    var w = this.renderer.width, h = this.renderer.height;
    var view = P.makeView(this.cam, w, h);

    // A single projection object per frame: every element is drawn and picked
    // through this exact transform.
    var scale = new P.WorldScale(this.cam.zoom);
    this._view = view;
    this._scale = scale;

    var sim = this.sim;
    var screen = {};
    var positions = {};

    for (var i = 0; i < sim.bodies.length; i++) {
      var b = sim.bodies[i];
      var au = sim.positionAt(b, sim.time);
      positions[b.id] = au;
      var sp = P.project(this.cam, view, scale, au);
      // Draw order key: bodies farther along the view's depth axis are drawn
      // first, so a nearer body overlaps a farther one. Inclination puts the
      // difference in z, which the tilt maps into screen depth.
      sp.depth = au.y - this.cam.y + au.z * Math.sin(this.cam.tilt * Math.PI / 2);
      screen[b.id] = sp;
    }
    this.screen = screen;
    this.positions = positions;

    // Label policy depends on where bodies ended up this frame.
    if (this.opts.labels) this.refreshLabels();

    this.renderer.draw({
      sim: sim,
      cam: this.cam,
      view: view,
      scale: scale,
      bodies: sim.bodies,
      screen: screen,
      positions: positions,
      trails: this.trails,
      selectedId: this.selectedId,
      hoverId: this.hoverId,
      focusId: this.focusId,
      labelBodies: this.opts.labels ? this.labelBodies : [],
      opts: this.opts,
      time: clock
    });
  };

  /* --------------------------------------------------------------- input */

  App.prototype._localPoint = function (ev) {
    var rect = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  App.prototype._bindInput = function () {
    var self = this;
    var canvas = this.canvas;

    canvas.addEventListener('pointerdown', function (ev) {
      canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
      var pt = self._localPoint(ev);
      self._pointers.set(ev.pointerId, pt);
      if (self._pointers.size === 1) {
        self._drag = {
          x: pt.x, y: pt.y,
          startX: pt.x, startY: pt.y,
          moved: false,
          camX: self.cam.x, camY: self.cam.y,
          time: nowMs()
        };
        canvas.classList.add('is-panning');
      } else if (self._pointers.size === 2) {
        var pts = Array.from(self._pointers.values());
        self._pinch = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          zoom: self.cam.zoom,
          mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        };
        self._drag = null;
      }
    });

    canvas.addEventListener('pointermove', function (ev) {
      var pt = self._localPoint(ev);
      if (self._pointers.has(ev.pointerId)) self._pointers.set(ev.pointerId, pt);

      if (self._pinch && self._pointers.size === 2) {
        var pts = Array.from(self._pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        if (self._pinch.dist > 8 && d > 8) {
          var f = d / self._pinch.dist;
          self.zoomAt(f / (self.cam.zoom / self._pinch.zoom), mid.x, mid.y);
          self._pinch.dist = d;
          self._pinch.zoom = self.cam.zoom;
        }
        return;
      }

      if (self._drag) {
        var dx = pt.x - self._drag.x;
        var dy = pt.y - self._drag.y;
        if (!self._drag.moved &&
            Math.hypot(pt.x - self._drag.startX, pt.y - self._drag.startY) > 4) {
          self._drag.moved = true;
          self.follow = false;
          self._syncFollow && self._syncFollow();
        }
        if (self._drag.moved) self._dragTo(pt, dx, dy);
        return;
      }

      // Hover feedback for the cursor and the highlight ring.
      var hit = self.pick(pt.x, pt.y);
      var id = hit ? hit.id : null;
      if (id !== self.hoverId) {
        self.hoverId = id;
        self.canvas.classList.toggle('is-hot', !!id);
      }
    });

    function endPointer(ev) {
      self._pointers.delete(ev.pointerId);
      if (self._pointers.size < 2) self._pinch = null;
      if (self._pointers.size === 0) {
        canvas.classList.remove('is-panning');
        if (self._drag) {
          var wasClick = !self._drag.moved;
          var pt = self._localPoint(ev);
          self._drag = null;
          if (wasClick) {
            var hit = self.pick(pt.x, pt.y);
            self.select(hit ? hit.id : null);
          }
        }
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    canvas.addEventListener('dblclick', function (ev) {
      var pt = self._localPoint(ev);
      var hit = self.pick(pt.x, pt.y);
      if (hit) {
        self.select(hit.id);
        self.focusOn(hit.id);
      }
    });

    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var pt = self._localPoint(ev);
      var unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1;
      var dy = ev.deltaY * unit;
      var factor = Math.exp(-dy * 0.0016);
      self.zoomAt(factor, pt.x, pt.y);
    }, { passive: false });
  };

  /** Drag in screen space -> camera move, using the exact inverse. */
  App.prototype._dragTo = function (pt, dx, dy) {
    var view = this._view, scale = this._scale;
    if (!view || !scale) return;
    // Move the camera opposite to the drag so content follows the pointer.
    var here = P.unproject(this.cam, view, scale, this._drag.startX, this._drag.startY);
    var there = P.unproject(this.cam, view, scale,
      this._drag.startX + dx, this._drag.startY + dy);
    this.cam.x = this._drag.camX - (there.x - here.x);
    this.cam.y = this._drag.camY - (there.y - here.y);
    this._panTarget = { x: this.cam.x, y: this.cam.y };
    this._zoomTau = 0;
  };

  /* --------------------------------------------------------------- pick */

  /**
   * Which body is under this canvas point?
   *
   * Positions and radii come from the same per-frame projection the renderer
   * used, so the target picked is exactly the disc the user sees. Moons are
   * only pickable when they are drawn at a usable size, otherwise a click near
   * a planet would sometimes select an invisible moon instead.
   */
  App.prototype.pick = function (px, py) {
    var best = null, bestScore = Infinity;
    var cam = this.cam, view = this._view, scale = this._scale;
    if (!view || !scale) return null;

    for (var i = 0; i < this.sim.bodies.length; i++) {
      var b = this.sim.bodies[i];
      var s = this.screen[b.id];
      if (!s) continue;
      var r = P.radiusPx(b, cam, view, scale, this.opts.trueScale);
      var hit = P.hitRadiusPx(b, cam, view, scale);
      var d = Math.hypot(px - s.x, py - s.y);
      if (d > hit) continue;

      // Prefer the closest hit; break ties (overlapping discs) by preferring
      // the smaller body, which is the one the user was aiming at.
      var score = d - r * 0.35 + (b.kind === 'moon' ? 0 : 0.001);
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
  };

  /* ------------------------------------------------------------- actions */

  App.prototype.togglePlay = function (force) {
    this.paused = force === undefined ? !this.paused : !!force;
    if (!this.paused && this.speed === 0) this.speed = 1;
    return this.paused;
  };

  App.prototype.setSpeed = function (daysPerSecond) {
    this.speed = daysPerSecond;
    if (daysPerSecond !== 0) this.paused = false;
    return this.speed;
  };

  App.prototype.resetTime = function () {
    this.sim.time = 0;
    this.seedTrails();
  };

  App.prototype.select = function (id) {
    this.selectedId = id || null;
    if (this.onSelect) this.onSelect(this.selectedId);
    this.refreshLabels();
    return this.selectedId;
  };

  App.prototype.setFollow = function (on) {
    this.follow = !!on && !!this.focusId;
    if (this.follow) {
      var p = this.viewPos(this.focusId, this.sim.time);
      this._panTarget = { x: p.x, y: p.y };
    }
    return this.follow;
  };

  App.prototype.setOption = function (key, value) {
    this.opts[key] = value;
    if (key === 'trails' && value) this.seedTrails();
    return this.opts[key];
  };

  App.prototype.toast = function (message, ms) {
    this._toast = message;
    this._toastUntil = nowMs() + (ms || 2600);
  };

  /** A body's state at the current time, for the inspector readout. */
  App.prototype.liveInfo = function (id) {
    var sim = this.sim;
    var b = sim.byId[id];
    if (!b) return null;
    var au = this.positions[id] || sim.positionAt(b, sim.time);
    var rSun = Math.sqrt(au.x * au.x + au.y * au.y + au.z * au.z);
    var out = { distanceAU: rSun };

    if (b.kind === 'moon') {
      var p = this.positions[b.parent] || sim.positionAt(b.parentBody, sim.time);
      out.parentDistanceAU = Math.sqrt(
        (au.x - p.x) * (au.x - p.x) +
        (au.y - p.y) * (au.y - p.y) +
        (au.z - p.z) * (au.z - p.z)
      );
      var ang = Math.atan2(au.y - p.y, au.x - p.x);
      out.phaseDeg = ((ang / D2R) % 360 + 360) % 360;
      // Circular-orbit speed, v = 2*pi*a/T (a is the orbit radius here).
      out.velocityKms = (2 * Math.PI * b.orbitRadiusAU * 149597870.7) / (b.period * 86400);
    } else if (b.kind === 'planet' || b.kind === 'dwarf') {
      out.velocityKms = (2 * Math.PI * b.a * 149597870.7) / (b.period * 86400);
      var lon = Math.atan2(au.y, au.x);
      out.longitudeDeg = ((lon / D2R) % 360 + 360) % 360;
    }
    return out;
  };

  var api = {
    App: App,
    ZOOM_FULL: ZOOM_FULL,
    ZOOM_SYSTEM: ZOOM_SYSTEM,
    ZOOM_INNER: ZOOM_INNER,
    ZOOM_FOCUS: ZOOM_FOCUS,
    formatSimDate: formatSimDate,
    formatSpeed: formatSpeed,
    formatPeriod: formatPeriod,
    formatDistanceAU: formatDistanceAU,
    MAX_FRAME_DAYS: MAX_FRAME_DAYS
  };

  global.SolarApp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

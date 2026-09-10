/* ==========================================================================
 * render.js — canvas rendering of the Solar System.
 *
 * Draw order (back to front):
 *   starfield -> orbit paths -> trails -> Sun -> planets/moons -> labels
 *
 * Everything is drawn from positions computed for ONE simulation time and ONE
 * camera transform per frame, so no two elements can disagree about where a
 * body is. The picking pass in ui.js reuses the same positions.
 * ========================================================================== */
(function (global) {
  'use strict';

  var P = global.SolarProjection;

  /* ------------------------------------------------------------------ *
   * Colour helpers
   * ------------------------------------------------------------------ */

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function shade(hex, factor) {
    var c = hexToRgb(hex);
    return 'rgb(' +
      Math.round(Math.min(255, c.r * factor)) + ',' +
      Math.round(Math.min(255, c.g * factor)) + ',' +
      Math.round(Math.min(255, c.b * factor)) + ')';
  }

  /* ------------------------------------------------------------------ *
   * Deterministic starfield. Seeded once so the sky is stable between
   * frames and between reloads; generated in world space so it parallaxes
   * correctly when the camera pans or zooms.
   * ------------------------------------------------------------------ */

  /**
   * Stars are authored in a fixed TILED field of STARS_FIELD px, in screen
   * space. Drawing the 3x3 neighbourhood of tiles and wrapping in screen space
   * keeps the whole viewport covered for any pan or zoom — an earlier version
   * drew a single patch centred on the camera, which left most of a 1280 px
   * canvas empty and produced a visible clump in the middle.
   */
  var STARS_FIELD = 260;

  function makeStars(count) {
    var seed = 0x9e3779b9;
    function rnd() {
      // xorshift32 — deterministic, so the sky is identical every reload
      seed ^= seed << 13; seed >>>= 0;
      seed ^= seed >>> 17;
      seed ^= seed << 5;  seed >>>= 0;
      return seed / 4294967296;
    }
    var stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: rnd() * STARS_FIELD,
        y: rnd() * STARS_FIELD,
        r: 0.35 + rnd() * 0.95,
        a: 0.16 + rnd() * 0.6,
        tw: rnd() * Math.PI * 2
      });
    }
    return stars;
  }

  /* ------------------------------------------------------------------ *
   * Renderer
   * ------------------------------------------------------------------ */

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.stars = makeStars(420);
  }

  Renderer.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (this.width === w && this.height === h && this.dpr === dpr) return false;
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    return true;
  };

  /**
   * Draw one frame.
   *
   * `state` carries everything the frame needs:
   *   sim, cam, positions (bodyId -> AU), screen (bodyId -> projected px),
   *   scale, view, bodies, selectedId, hoverId, opts, time
   */
  Renderer.prototype.draw = function (state) {
    var ctx = this.ctx;
    var cam = state.cam;
    var view = state.view;
    var scale = state.scale;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawStars(ctx, cam, scale, state.time);

    if (state.opts.orbits) this.drawOrbits(ctx, state);
    if (state.opts.trails) this.drawTrails(ctx, state);

    // Bodies are drawn sorted by their on-screen depth so a nearer body
    // correctly overlaps a farther one.
    var order = state.bodies.slice().sort(function (a, b) {
      var pa = state.screen[a.id], pb = state.screen[b.id];
      if (!pa || !pb) return 0;
      return pa.depth - pb.depth;
    });

    for (var i = 0; i < order.length; i++) {
      this.drawBody(ctx, state, order[i]);
    }

    if (state.opts.labels) this.drawLabels(ctx, state);
  };

  /* ---------------------------------------------------------- starfield */

  Renderer.prototype.drawStars = function (ctx, cam, scale, time) {
    var w = this.width, h = this.height;
    var F = STARS_FIELD;
    // Slow parallax: the field drifts and scales gently with the camera so it
    // reads as a background rather than a texture stuck to the screen.
    var s = Math.max(0.6, Math.min(4, 1 + Math.log10(Math.max(cam.zoom, 1)) * 0.16));
    var ox = -cam.x * 0.35;
    var oy = -cam.y * 0.35;

    ctx.fillStyle = '#dce6ff';
    for (var i = 0; i < this.stars.length; i++) {
      var st = this.stars[i];
      // Screen-space wrap, then the 3x3 tile neighbourhood, so every pixel of
      // the canvas is covered however far the camera has been panned.
      var bx = ((st.x * s + ox) % F + F) % F;
      var by = ((st.y * s + oy) % F + F) % F;
      var tw = 0.82 + 0.18 * Math.sin(time * 0.7 + st.tw);
      var alpha = st.a * tw;
      for (var gx = -1; gx <= 1; gx++) {
        var x = bx + gx * F;
        if (x < -3 || x > w + 3) continue;
        for (var gy = -1; gy <= 1; gy++) {
          var y = by + gy * F;
          if (y < -3 || y > h + 3) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(x, y, st.r, 0, P.TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ------------------------------------------------------------- orbits */

  var ORBIT_CHORD_TOL_PX = 0.35;   // max gap between an orbit polyline and its arc

  /**
   * On-screen radius of a body's orbit, in pixels, at the current camera.
   * Used to decide how finely the orbit path must be sampled.
   */
  Renderer.prototype.orbitRadiusPx = function (body, state) {
    var sim = state.sim, cam = state.cam, view = state.view, scale = state.scale;
    var centre;
    if (body.kind === 'moon') {
      centre = sim.positionAt(body.parentBody, sim.time);
    } else {
      centre = { x: 0, y: 0, z: 0 };
    }
    var rAU = body.kind === 'moon' ? body.orbitRadiusAU : body.a;
    var a = P.project(cam, view, scale, centre);
    var b = P.project(cam, view, scale,
      { x: centre.x + rAU, y: centre.y, z: centre.z });
    return Math.hypot(b.x - a.x, b.y - a.y);
  };


  /**
   * Draw the closed orbit path of every planet and moon.
   *
   * Paths come from sim.orbitPathAt(), which uses the SAME orbital maths as
   * the moving bodies — a moon's ring is generated in its parent's local frame
   * and then offset by the parent's current heliocentric position. The ring
   * therefore travels with the planet instead of being a static circle.
   */
  Renderer.prototype.drawOrbits = function (ctx, state) {
    var sim = state.sim;
    var cam = state.cam, view = state.view, scale = state.scale;

    for (var i = 0; i < state.bodies.length; i++) {
      var body = state.bodies[i];
      if (body.kind === 'star') continue;

      // Adapt the segment count to the body's on-screen orbit radius, so the
      // polyline never visibly separates from the body sitting on it. A chord
      // of half-angle d deviates from its arc by r*(1-cos d) ~ r*d^2/2; solve
      // that for a sub-pixel error and round up to a power of two for caching.
      var rAUorbit = this.orbitRadiusPx(body, state);
      var segs = 96;
      if (rAUorbit > 0) {
        var need = Math.PI / Math.sqrt(2 * ORBIT_CHORD_TOL_PX / rAUorbit);
        segs = Math.min(2048, Math.max(96, Math.ceil(need)));
        segs = Math.pow(2, Math.ceil(Math.log2(segs)));
      }

      var pts = sim.orbitPathAt(body, sim.time, segs);
      var isMoon = body.kind === 'moon';
      var selected = body.id === state.selectedId;
      var hovered = body.id === state.hoverId;

      var alpha = isMoon ? 0.42 : (body.kind === 'dwarf' ? 0.24 : 0.3);
      if (selected) alpha = 0.9;
      else if (hovered) alpha = 0.62;

      ctx.beginPath();
      var started = false;
      for (var q = 0; q < pts.length; q++) {
        var sp = P.project(cam, view, scale, pts[q]);
        if (!isFinite(sp.x) || !isFinite(sp.y)) { started = false; continue; }
        if (!started) { ctx.moveTo(sp.x, sp.y); started = true; }
        else ctx.lineTo(sp.x, sp.y);
      }
      if (body.kind === 'dwarf') ctx.setLineDash([4, 5]);
      ctx.lineWidth = selected ? 1.7 : 1;
      ctx.strokeStyle = rgba(body.color, alpha);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  /* ------------------------------------------------------------- trails */

  Renderer.prototype.drawTrails = function (ctx, state) {
    var cam = state.cam, view = state.view, scale = state.scale;
    var trails = state.trails;

    for (var id in trails) {
      var tr = trails[id];
      if (!tr || !tr.points || tr.points.length < 2) continue;
      var body = state.sim.byId[id];
      if (!body) continue;

      var pts = tr.points;
      var selected = id === state.selectedId;
      var isMoon = body.kind === 'moon';

      // Oldest -> newest, so the freshest segment sits on top.
      var n = pts.length;
      var steps = 26;                       // gradient resolution
      var per = Math.max(1, Math.floor(n / steps));
      var prev = null;

      for (var s = 0; s < steps; s++) {
        var from = s * per;
        var to = Math.min(n - 1, (s + 1) * per);
        if (to <= from) continue;
        var u = s / (steps - 1);            // 0 = oldest, 1 = newest
        var alpha = (isMoon ? 0.5 : 0.62) * (0.06 + 0.94 * u * u);
        if (selected) alpha = Math.min(1, alpha * 1.5);
        ctx.beginPath();
        var started = false;
        for (var q = from; q <= to; q++) {
          var sp = P.project(cam, view, scale, pts[q]);
          if (!isFinite(sp.x) || !isFinite(sp.y)) { started = false; continue; }
          if (!started) { ctx.moveTo(sp.x, sp.y); started = true; }
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.strokeStyle = rgba(body.glow || body.color, alpha);
        ctx.lineWidth = selected ? 1.8 : (isMoon ? 1 : 1.3);
        ctx.stroke();
      }
    }
  };

  /* ------------------------------------------------------------- bodies */

  Renderer.prototype.drawBody = function (ctx, state, body) {
    var s = state.screen[body.id];
    if (!s) return;
    var cam = state.cam, view = state.view, scale = state.scale;
    var r = P.radiusPx(body, cam, view, scale, state.opts.trueScale);
    var x = s.x, y = s.y;
    if (x < -r - 40 || x > this.width + r + 40 || y < -r - 40 || y > this.height + r + 40) return;

    var selected = body.id === state.selectedId;
    var hovered = body.id === state.hoverId;
    var isSun = body.kind === 'star';
    var isPlanet = body.kind === 'planet' || body.kind === 'dwarf';

    /* --- Sun: corona + disc --- */
    if (isSun) {
      // The corona is what communicates the Sun's brightness, and it is the
      // only place its true scale is hinted at (the disc itself is a fixed
      // size — see RULE 2 in projection.js). Keeping it tight matters: a wide
      // bright halo washes out Mercury and Venus, which sit close in.
      var glowR = Math.max(r * 3.1, 34);
      var grad = ctx.createRadialGradient(x, y, Math.max(0, r * 0.5), x, y, glowR);
      grad.addColorStop(0, 'rgba(255, 236, 176, 0.92)');
      grad.addColorStop(0.2, 'rgba(255, 198, 90, 0.42)');
      grad.addColorStop(0.5, 'rgba(255, 152, 44, 0.13)');
      grad.addColorStop(1, 'rgba(255, 120, 20, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, P.TAU);
      ctx.fill();

      var core = ctx.createRadialGradient(x, y, 0, x, y, Math.max(r, 0.6));
      core.addColorStop(0, '#fffdf0');
      core.addColorStop(0.55, '#ffe07a');
      core.addColorStop(1, '#ffab21');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(r, 0.8), 0, P.TAU);
      ctx.fill();

      if (selected || hovered) this.drawSelectionRing(ctx, x, y, Math.max(r, 3), body.glow, selected);
      return;
    }

    /* --- Rings behind the body (Saturn, Uranus) --- */
    if (body.ring && r > 1.6) this.drawRing(ctx, x, y, r, body, state, true);

    /* --- Planet / moon disc, lit from the Sun's direction --- */
    var sunScreen = state.screen['sun'];
    var lx = 0, ly = 0;
    if (sunScreen) {
      var dx = sunScreen.x - x, dy = sunScreen.y - y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      lx = dx / d; ly = dy / d;
    }
    var rad = Math.max(r, 0.7);
    var g = ctx.createRadialGradient(
      x + lx * rad * 0.45, y + ly * rad * 0.45, rad * 0.06,
      x, y, rad
    );
    g.addColorStop(0, shade(body.glow || body.color, 1.25));
    g.addColorStop(0.5, body.color);
    g.addColorStop(1, shade(body.color, 0.42));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, P.TAU);
    ctx.fill();

    // A faint rim on the sunlit side sells the sphere.
    if (rad > 3) {
      ctx.strokeStyle = rgba(body.glow || body.color, 0.5);
      ctx.lineWidth = Math.max(0.6, rad * 0.08);
      ctx.beginPath();
      ctx.arc(x - lx * rad * 0.12, y - ly * rad * 0.12, rad * 0.94,
        Math.atan2(ly, lx) - 2.0, Math.atan2(ly, lx) + 2.0);
      ctx.stroke();
    }

    /* --- A subtle glow for planets so tiny ones read as bodies --- */
    if (isPlanet) {
      var halo = ctx.createRadialGradient(x, y, rad, x, y, rad * 2.5);
      halo.addColorStop(0, rgba(body.glow || body.color, 0.24));
      halo.addColorStop(1, rgba(body.color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, rad * 2.5, 0, P.TAU);
      ctx.fill();
    }

    if (body.ring && r > 1.6) this.drawRing(ctx, x, y, r, body, state, false);

    if (selected || hovered) {
      this.drawSelectionRing(ctx, x, y, rad, body.glow || body.color, selected);
    }
  };

  /** Selection / hover ring, drawn outside the disc so it never hides it. */
  Renderer.prototype.drawSelectionRing = function (ctx, x, y, r, color, selected) {
    var rr = Math.max(r + 6, 9);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, P.TAU);
    ctx.strokeStyle = rgba(color, selected ? 0.95 : 0.55);
    ctx.lineWidth = selected ? 1.8 : 1.2;
    if (!selected) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, rr + 3.5, 0, P.TAU);
      ctx.strokeStyle = rgba(color, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  /** Planetary ring system: an ellipse in the body's equatorial plane. */
  Renderer.prototype.drawRing = function (ctx, x, y, r, body, state, behind) {
    var inner = r * body.ring[0];
    var outer = r * body.ring[1];
    // Rings lie in the planet's equatorial plane. From the camera that reads
    // as an ellipse whose flattening follows the same viewing rotation as the
    // orbits (view.ca = cos of the tilt angle), so rings stay glued to the
    // scene geometry as the tilt slider moves.
    var flat = Math.max(0.05, state.view.ca);
    ctx.beginPath();
    ctx.ellipse(x, y, outer, outer * flat, 0, 0, P.TAU);
    ctx.ellipse(x, y, inner, inner * flat, 0, 0, P.TAU);
    ctx.fillStyle = rgba(body.glow || body.color, behind ? 0.14 : 0.32);
    ctx.fill('evenodd');
  };

  /* ------------------------------------------------------------- labels */

  Renderer.prototype.drawLabels = function (ctx, state) {
    var placed = [];
    var list = state.labelBodies || [];
    ctx.font = '500 11.5px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';

    for (var i = 0; i < list.length; i++) {
      var body = list[i];
      var s = state.screen[body.id];
      if (!s) continue;
      var r = P.radiusPx(body, state.cam, state.view, state.scale, state.opts.trueScale);
      var text = body.name;
      var tw = ctx.measureText(text).width;
      var pad = 4;
      var w = tw + pad * 2;
      var h = 15;

      // Try the right side of the body first, then left, then above, then
      // below; take the first placement that does not collide.
      var candidates = [
        { x: s.x + r + 7, y: s.y - h / 2 },
        { x: s.x - r - 7 - w, y: s.y - h / 2 },
        { x: s.x - w / 2, y: s.y - r - 7 - h },
        { x: s.x - w / 2, y: s.y + r + 7 }
      ];
      var chosen = null;
      for (var c = 0; c < candidates.length; c++) {
        var box = { x: candidates[c].x, y: candidates[c].y, w: w, h: h };
        if (box.x < 2 || box.x + box.w > this.width - 2) continue;
        if (box.y < 2 || box.y + box.h > this.height - 2) continue;
        var clash = false;
        for (var p = 0; p < placed.length; p++) {
          var o = placed[p];
          if (box.x < o.x + o.w + 3 && box.x + box.w + 3 > o.x &&
              box.y < o.y + o.h + 2 && box.y + box.h + 2 > o.y) { clash = true; break; }
        }
        if (!clash) { chosen = box; break; }
      }
      if (!chosen) continue;
      placed.push(chosen);

      var selected = body.id === state.selectedId;
      ctx.globalAlpha = selected ? 1 : 0.86;
      ctx.fillStyle = 'rgba(6,8,18,0.62)';
      ctx.beginPath();
      var rr = 3;
      roundRect(ctx, chosen.x, chosen.y, chosen.w, chosen.h, rr);
      ctx.fill();

      ctx.fillStyle = selected ? '#ffffff' : '#c8d4f5';
      ctx.fillText(text, chosen.x + pad, chosen.y + h / 2 + 0.5);
      ctx.globalAlpha = 1;

      // Leader line for the selected body so the label is unambiguous.
      if (selected) {
        ctx.beginPath();
        ctx.moveTo(s.x + Math.sign(chosen.x - s.x) * (r + 2), s.y);
        ctx.lineTo(chosen.x < s.x ? chosen.x + chosen.w : chosen.x, chosen.y + h / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var api = {
    Renderer: Renderer,
    makeStars: makeStars,
    rgba: rgba,
    shade: shade
  };

  global.SolarRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

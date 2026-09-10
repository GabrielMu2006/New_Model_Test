/* ==========================================================================
 * projection.js — AU -> screen pixels, camera, and the exact inverse.
 *
 * THE ONE-WORLD-SPACE RULE
 *   There is a single world space (heliocentric AU, plus a fixed tilt). The
 *   "Solar System view" and the "planet view" are the SAME scene seen at
 *   different camera zoom. Switching views animates the camera; it never
 *   re-seeds a body, never re-derives a moon's position from a different
 *   formula, and therefore can never detach a moon from its planet.
 *
 * WHY THE RADIAL CURVE
 *   Distances span 0.39 AU (Mercury) to 39 AU (Pluto) — a 100x range. A radial
 *   power curve is applied about the camera's focus point:
 *
 *        d_px = z * K * d_AU ^ e(d),      e(d) = 1 inside LINEAR_RADIUS,
 *                                         e(d) -> K_FAR far away.
 *
 *   With K_FAR < 1, the outer system is pulled in enough to fit on screen.
 *
 *   Two properties matter and both are exact, not approximate:
 *     (a) K is normalised so that 1 AU == `refPx` pixels, giving the classic
 *         "1 AU = 24 px" system layout at zoom 1.
 *     (b) e(d) == 1 for every d <= LINEAR_RADIUS (0.25 AU). The widest moon
 *         system in this scene (Callisto, 0.0126 AU) sits deep inside that
 *         region, so moon orbits are rendered through a strict similarity
 *         transform: a circle stays a circle, at every zoom, in every view.
 *         Moon orbits can never look elliptical or egg-shaped.
 *
 * RADIUS IS SCALED BY A DIFFERENT LAW (on purpose)
 *   True radii are 1e-5..4.6e-3 AU: at the system layout the Sun would be
 *   0.1 px wide. Bodies therefore use two size models, crossfaded by zoom:
 *     - "schematic": magnified up to ~3.7x for legibility in the wide view,
 *       with roughly true relative sizes between planets;
 *     - "true ratio": radii in exact proportion to each other (Sun 109x
 *       Earth, Jupiter 11x Earth, Moon 0.27x Earth), applied once the camera
 *       is close enough for that to be meaningful.
 *   The switch is a smooth crossfade (see SIZE_BLEND_*), never a pop.
 * ========================================================================== */
(function (global) {
  'use strict';

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  var SYSTEM_REF_PX = 16;      // px per AU^1 at zoom 1 in the wide view
  var LINEAR_RADIUS = 0.25;    // AU — inside this, the map is exactly linear
  var FAR_RADIUS = 24;         // AU — beyond this, full compression
  var K_FAR = 0.62;            // compression exponent for the outer system

  // ---------------------------------------------------------------------
  // BODY RADII  (read this before changing any number below)
  //
  // Physical radii span 1e-5..4.6e-3 AU. At the wide-system layout (1 AU =
  // 16 px) a strictly proportional rendering makes the Sun 0.15 px across and
  // Earth 0.0017 px: nothing would be visible, let alone clickable. Every
  // Solar System figure ever printed magnifies its bodies; the question is
  // only HOW. Two rules do all the work here.
  //
  // RULE 1 — one global formula for every body except the Sun:
  //
  //      drawn(r) = FLOOR_PX * p  +  BASE_PX * p * mag(zoom),   p = (r/rE)^0.75
  //
  //   The 0.75 exponent is SUBLINEAR compression of the true radius: it
  //   squeezes the real Sun:Earth ratio of 109 down to 34, and SQUARES UP the
  //   low end, turning the true Moon:Earth ratio of 0.27 into 0.41 — which is
  //   what makes a moon genuinely resolvable beside its planet.
  //   Both terms rise strictly with r, so the drawing preserves the real size
  //   ORDER at every zoom and every viewport: Sun > Jupiter > Saturn >
  //   Uranus > Neptune > Earth > Venus > Mars > Ganymede > Mercury > Io >
  //   Moon. tests/verify.js asserts that whole chain.
  //   mag(zoom) is ONE shared magnification, larger in the wide view where
  //   bodies would otherwise be sub-pixel, fading as the camera closes in.
  //
  // RULE 2 — the Sun's DISC has a fixed on-screen size (SUN_DISC_PX).
  //
  //   The Sun is the one body this model cannot place and still show anything
  //   else: at the wide layout its honest drawn radius is ~180 px against
  //   Mercury's 12 px orbit, so it covers the inner planets.
  //   Rather than distort the shared formula (which would break the ordering
  //   of every other body), its disc is drawn at a constant few-pixel radius
  //   and its CORONA is drawn much wider and scaled with zoom. That is exactly
  //   how planetarium software and textbook figures handle a star that is
  //   physically 109x its largest planet, and it keeps the Sun unambiguously
  //   the brightest thing on screen at every zoom.
  //
  // Sizes are therefore RELATIVE, not to scale, and the UI labels them as
  // such. The "true scale" toggle switches to the proportional rendering
  // (same pixels-per-AU as the orbits), where the Sun really is 109x Earth and
  // every planet is a sub-pixel speck.
  // ---------------------------------------------------------------------
  // Constants below are not hand-waved: tests/tune-size-model.js sweeps this
  // parameter space against an explicit constraint list (size ordering at every
  // preset, Mercury visible and clear of the Sun's disc, Earth a legible disc,
  // the Moon's orbit clear of Earth's disc, Callisto's orbit on screen) and
  // these values are the top-ranked solution it reports.
  var EARTH_RADIUS_AU = 6371.0 / 149597870.7;
  var SIZE_EXPONENT = 0.75;   // sublinear compression of the true radius
  var FLOOR_EXP = 0.75;       // the floor uses the same exponent, on purpose
  var BASE_PX = 5;            // Earth's drawn radius from the size model, mag = 1
  var FLOOR_PX = 0.8;         // readability floor, as a fraction of the model
  var MAG_WIDE = 4;           // magnification at zoom 1 (the wide system view)
  var MAG_FADE = 1.2;         // how fast the magnification fades with zoom
  var MAG_DEEP = 0.7;         // magnification floor (deep view)
  var SOFT_KNEE = 6;          // px: above this, drawn radii compress gently
  var SOFT_POWER = 0.4;       // ...by this factor, keeping the curve monotonic
  var MIN_RADIUS_PX = 0.5;    // a disc is never drawn smaller than this
  var SUN_DISC_PX = 26;       // the Sun's disc radius, fixed (see RULE 2)
  var MIN_HIT_PX = 16;        // a click target is never smaller than this

  function smoothstep(u) {
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    return u * u * (3 - 2 * u);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ------------------------------------------------------------------ *
   * World scale                                                         *
   * ------------------------------------------------------------------ */

  /**
   * The map is governed by two numbers: `z` (zoom) and `globalBlend`, which
   * says how "deep" the camera is. They are kept in lock-step:
   *   deepBlend(z) = 0 for z <= 1.35 (the whole system fits), rising to 1 by
   *   z = 260 (a planet's moon system fills the screen).
   */
  function deepBlendForZoom(z) {
    return smoothstep((Math.log(Math.max(z, 1e-6)) - Math.log(1.35)) /
                      (Math.log(260) - Math.log(1.35)));
  }

  function WorldScale(zoom) {
    this.z = zoom;
    this.deep = deepBlendForZoom(zoom);
    // k = 1 when the camera is deep (local geometry exact and undistorted),
    // K_FAR when showing the whole system (only then is compression needed).
    this.k = 1 + (K_FAR - 1) * this.deep;
    this.K = SYSTEM_REF_PX;   // 1 AU == 24 px at zoom 1 by construction
  }

  /** Exponent applied at distance d from the camera's focus point. */
  WorldScale.prototype.exponentAt = function (d) {
    if (this.k >= 0.9999) return 1;
    if (d <= LINEAR_RADIUS) return 1;
    var lo = Math.log(LINEAR_RADIUS), hi = Math.log(FAR_RADIUS);
    var u = smoothstep((Math.log(d) - lo) / (hi - lo));
    return 1 + (this.k - 1) * u;
  };

  WorldScale.prototype.exponentForAU = function (au) {
    var d = Math.sqrt(au.x * au.x + au.y * au.y + au.z * au.z);
    return this.exponentAt(d);
  };

  /* ------------------------------------------------------------------ *
   * Camera                                                              *
   * ------------------------------------------------------------------ */

  function Camera() {
    this.x = 0;          // AU — the world point drawn at the canvas centre,
    this.y = 0;          //      expressed in the TILTED plane (see below)
    this.zoom = 1;
    this.tilt = 0.5;     // 0 = edge-on to the ecliptic, 1 = straight down
  }

  /**
   * Per-frame view geometry.
   *
   * THE TILT IS A CAMERA ROTATION, NOT A RASTER SQUEEZE.
   *
   * An earlier version compressed the vertical screen axis (y *= k) while
   * spacing the orbits isotropically. That is geometrically inconsistent: a
   * circle of radius r about the Sun kept its radius r in x but became an
   * ellipse in y, so a moon's orbit was not circular in the same sense the
   * orbit spacing was. The distances and the shapes disagreed.
   *
   * Here the view is an honest orthographic projection. A point p in the
   * ecliptic frame is rotated about the X axis by the tilt angle alpha:
   *
   *      rx = px
   *      ry = py*cos(alpha) - pz*sin(alpha)
   *      rz = py*sin(alpha) + pz*cos(alpha)
   *
   * and then drawn as (cx + rx*s, cy + ry*s): ONE uniform scale s on both
   * screen axes. Because the map is a real rotation followed by a uniform
   * scale, similarities are preserved exactly:
   *   * with alpha = 0 the view is exactly edge-on and a circle of radius r
   *     about the focus point draws as a true circle of radius r*s — this is
   *     what the moon-orbit tests assert;
   *   * with alpha = pi/2 you look straight down the ecliptic plane and the
   *     inclinations of Mercury (7 deg) and Pluto (17 deg) become visible.
   */
  function makeView(cam, width, height) {
    var alpha = cam.tilt * (Math.PI / 2);
    return {
      cx: width / 2,
      cy: height / 2,
      width: width,
      height: height,
      alpha: alpha,
      ca: Math.cos(alpha),
      sa: Math.sin(alpha)
    };
  }

  /** Rotate an ecliptic-frame AU vector into the camera's viewing frame. */
  function rotate(view, au) {
    return {
      x: au.x,
      y: au.y * view.ca - au.z * view.sa,
      z: au.y * view.sa + au.z * view.ca
    };
  }

  /** Inverse of `rotate`. */
  function unrotate(view, v) {
    return {
      x: v.x,
      y: v.y * view.ca + v.z * view.sa,
      z: -v.y * view.sa + v.z * view.ca
    };
  }

  /** Heliocentric AU -> screen pixels. */
  function project(cam, view, scale, au) {
    var r = rotate(view, au);
    var dx = r.x - cam.x, dy = r.y - cam.y, dz = r.z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var e = scale.exponentAt(d);
    var s = cam.zoom * scale.K * Math.pow(Math.max(d, 1e-12), e - 1);
    return {
      x: view.cx + dx * s,
      y: view.cy + dy * s,
      gx: dx * s,
      gy: dy * s,
      scale: s,
      dist: d,
      depth: dz
    };
  }

  /**
   * EXACT inverse: screen pixels -> heliocentric AU, on the reference plane
   * (the 2-D plane through the camera, i.e. rz = 0).
   *
   * Two traps, both of which produced a visibly wrong inverse before this was
   * derived properly:
   *
   *  (1) The SCALE depends on the AU radius, so inverting `r -> d` from the
   *      *screen* radius is inconsistent with the forward map.
   *  (2) The tilt is a rotation, so the pre-image is not the screen offset
   *      divided by a constant — it has to be carried back through the same
   *      rotation. Anything else stretches one axis and misplaces clicks.
   *
   * `gOf(rad)` pushes a candidate AU radius along the pointer's ray through
   * the REAL forward map, and |gOf| is monotone in `rad`, so one bisection
   * lands on the true pre-image and forward/inverse agree by construction.
   */
  function unproject(cam, view, scale, sx, sy) {
    var gx = sx - view.cx;
    var gy = sy - view.cy;
    var rScreen = Math.sqrt(gx * gx + gy * gy);
    if (rScreen < 1e-12) {
      return unrotate(view, { x: cam.x, y: cam.y, z: 0 });
    }

    var ux = gx / rScreen, uy = gy / rScreen;
    var Kz = cam.zoom * scale.K;
    var dir = { x: 0, y: 0 };

    function gOf(rad) {
      if (rad <= 0) { dir.x = 0; dir.y = 0; return 0; }
      dir.x = ux * rad;
      dir.y = uy * rad;
      var e = scale.exponentAt(rad);
      var s = Kz * Math.pow(rad, e - 1);
      return Math.sqrt((dir.x * s) * (dir.x * s) + (dir.y * s) * (dir.y * s));
    }

    // Grow the bracket from the screen-space estimate so the NEAREST
    // pre-image wins: doubling from zero converges on the farthest one, which
    // for a deeply zoomed-in camera is a point many AU away that happens to
    // project onto the same pixel.
    var lo = 0;
    var hi = Math.max(rScreen / Kz, 1e-9);
    var guard = 0;
    while (gOf(hi) < rScreen && guard++ < 512) hi *= 1.25;
    for (var i = 0; i < 120; i++) {
      var mid = 0.5 * (lo + hi);
      if (gOf(mid) < rScreen) lo = mid; else hi = mid;
      if (hi - lo <= 1e-14 * Math.max(1, hi)) break;
    }
    gOf(0.5 * (lo + hi));
    return unrotate(view, { x: cam.x + dir.x, y: cam.y + dir.y, z: 0 });
  }

  /* ------------------------------------------------------------------ *
   * Body radii                                                          *
   * ------------------------------------------------------------------ */

  /** Shared magnification at a given zoom (identical for every body). */
  function sizeMagnification(zoom) {
    var m = MAG_WIDE / Math.pow(Math.max(zoom, 1e-6), MAG_FADE);
    return m < MAG_DEEP ? MAG_DEEP : m;
  }

  /** Effective scale of the size model, exposed for the HUD readout. */
  function sizeScaleFactor(cam) {
    return BASE_PX * sizeMagnification(cam.zoom);
  }

  /**
   * Radius in pixels. See the constants block for RULE 1 and RULE 2.
   * `trueScale` switches to the physically proportional rendering (identical
   * pixels-per-AU to the orbits): correct, and almost entirely invisible.
   */
  function radiusPx(body, cam, view, scale, trueScale) {
    var ratio = body.radiusAU / EARTH_RADIUS_AU;
    if (trueScale) {
      return Math.max(ratio * EARTH_RADIUS_AU * cam.zoom * scale.K, MIN_RADIUS_PX);
    }

    if (body.kind === 'star') {
      // RULE 2. The corona in the renderer is what conveys the Sun's size and
      // brightness; the disc stays small enough to leave the inner planets
      // visible and clickable.
      return SUN_DISC_PX;
    }

    var p = Math.pow(ratio, SIZE_EXPONENT);
    var drawn = FLOOR_PX * p + BASE_PX * p * sizeMagnification(cam.zoom);
    if (drawn < MIN_RADIUS_PX) drawn = MIN_RADIUS_PX;
    // Gentle, strictly monotonic compression of the largest bodies, so the
    // biggest planet cannot grow without bound while the ordering survives.
    if (drawn > SOFT_KNEE) {
      drawn = SOFT_KNEE * Math.pow(drawn / SOFT_KNEE, SOFT_POWER);
    }
    return drawn;
  }

  /** Generous screen-space catch radius for clicking / hover. */
  function hitRadiusPx(body, cam, view, scale) {
    var r = radiusPx(body, cam, view, scale);
    return Math.max(r * 1.15 + 10, MIN_HIT_PX);
  }

  var api = {
    Camera: Camera,
    WorldScale: WorldScale,
    makeView: makeView,
    project: project,
    unproject: unproject,
    radiusPx: radiusPx,
    hitRadiusPx: hitRadiusPx,
    sizeScaleFactor: sizeScaleFactor,
    sizeMagnification: sizeMagnification,
    MIN_HIT_PX: MIN_HIT_PX,
    SIZE_EXPONENT: SIZE_EXPONENT,
    deepBlendForZoom: deepBlendForZoom,
    smoothstep: smoothstep,
    clamp: clamp,
    SYSTEM_REF_PX: SYSTEM_REF_PX,
    LINEAR_RADIUS: LINEAR_RADIUS,
    FAR_RADIUS: FAR_RADIUS,
    K_FAR: K_FAR,
    DEG: DEG,
    TAU: TAU
  };

  global.SolarProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

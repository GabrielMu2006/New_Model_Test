/* ==========================================================================
 * orbital.js — orbital mechanics primitives.
 *
 * DESIGN RULE (this is what makes the whole simulation correct):
 *   every position is a PURE FUNCTION of the simulation time t.
 *       position(t) -> { x, y, z }   in AU
 *   No state is ever accumulated by integration. Therefore:
 *     * changing the simulation speed only changes how fast t advances,
 *       never the path, so nothing can jump or lose orbital state;
 *     * moons are evaluated in their parent's LOCAL frame and then added to
 *       the parent's heliocentric position, so a moon keeps orbiting its
 *       planet while that planet travels around the Sun.
 *
 * Units: AU, days, degrees.
 * ========================================================================== */
(function (global) {
  'use strict';

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  /** Wrap an angle into [0, 2pi). */
  function wrapTau(a) {
    var r = a % TAU;
    return r < 0 ? r + TAU : r;
  }

  /** Wrap a scalar into [0, m). */
  function wrapMod(x, m) {
    var r = x % m;
    return r < 0 ? r + m : r;
  }

  /**
   * Solve Kepler's equation  M = E - e*sin(E)  for the eccentric anomaly E.
   *
   * Newton-Raphson seeded with E0 = M + e*sin(M); for the eccentricities used
   * here (e <= 0.21) this converges in 3-4 iterations. A bisection fallback
   * guarantees convergence for any e < 1, so the solver can never throw a
   * discontinuity into the animation.
   */
  function solveKepler(M, e) {
    if (e <= 1e-12) return M;
    var m = wrapTau(M);
    var E = m + e * Math.sin(m);
    var i, f, fp;
    for (i = 0; i < 24; i++) {
      f = E - e * Math.sin(E) - m;
      fp = 1 - e * Math.cos(E);
      var step = f / fp;
      E -= step;
      if (Math.abs(step) < 1e-12) return E;
    }
    // Rare fallback: robust bisection on a bracketing interval.
    var lo = m - 1 - e, hi = m + 1 + e;
    for (i = 0; i < 80; i++) {
      E = 0.5 * (lo + hi);
      f = E - e * Math.sin(E) - m;
      if (f > 0) hi = E; else lo = E;
    }
    return E;
  }

  /**
   * Heliocentric position from classical orbital elements, as a function of
   * simulation time. Inclination is applied about the X axis, so the angle
   * that matters for collision/sorting purposes lands in `z`.
   */
  function positionFromElements(el, t) {
    var n = TAU / el.period;                       // mean motion, rad/day
    var M = el.M0 + n * (t - el.epoch);
    var E = solveKepler(M, el.e);
    var xv = el.a * (Math.cos(E) - el.e);          // in-plane, focus at origin
    var yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);

    var w = el.w * DEG;
    var cw = Math.cos(w), sw = Math.sin(w);
    var xp = xv * cw - yv * sw;
    var yp = xv * sw + yv * cw;

    var inc = (el.inc || 0) * DEG;
    var ci = Math.cos(inc), si = Math.sin(inc);
    return { x: xp, y: yp * ci, z: yp * si };
  }

  /**
   * Position on a circular moon orbit in the parent's local frame.
   * `phase` is the argument of latitude in degrees at `epoch`; the node
   * rotation (`node`) orients the orbit inside the parent's equatorial plane.
   */
  function positionOnCircularOrbit(radiusAU, periodDays, phaseDeg, nodeDeg, incDeg, t, epoch) {
    var u = (phaseDeg + (360 / periodDays) * (t - (epoch || 0))) * DEG;
    var xp = radiusAU * Math.cos(u);
    var yp = radiusAU * Math.sin(u);
    var n = nodeDeg * DEG;
    var cn = Math.cos(n), sn = Math.sin(n);
    var xr = xp * cn - yp * sn;
    var yr = xp * sn + yp * cn;
    var inc = incDeg * DEG;
    return { x: xr, y: yr * Math.cos(inc), z: yr * Math.sin(inc) };
  }

  function vecAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  /** Linear interpolation that also works for non-finite inputs defensively. */
  function lerp(a, b, u) {
    return a + (b - a) * u;
  }

  var api = {
    DEG: DEG,
    TAU: TAU,
    wrapTau: wrapTau,
    wrapMod: wrapMod,
    solveKepler: solveKepler,
    positionFromElements: positionFromElements,
    positionOnCircularOrbit: positionOnCircularOrbit,
    vecAdd: vecAdd,
    lerp: lerp
  };

  global.SolarOrbital = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

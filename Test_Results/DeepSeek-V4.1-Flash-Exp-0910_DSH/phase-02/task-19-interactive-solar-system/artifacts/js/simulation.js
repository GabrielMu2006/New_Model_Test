/* ==========================================================================
 * simulation.js — time and body state.
 *
 * The ONLY mutable quantity in the simulation is `time` (simulation days).
 * Every body position is derived from `time` by a pure function, so the
 * simulation can never drift, jump, or lose orbital state when the speed
 * changes — speed only decides how much `time` advances per real second.
 *
 * Hierarchy:  Sun  <-  planet  <-  moon
 *   planet position = f(time)                     (heliocentric, AU)
 *   moon   position = planet position + local(time)   (AU)
 * The moon term is evaluated in the parent's LOCAL frame, then added to the
 * parent's moving position — that is exactly why a moon keeps orbiting its
 * planet while the planet itself travels around the Sun.
 * ========================================================================== */
(function (global) {
  'use strict';

  var O = global.SolarOrbital;
  var D = global.SolarData;

  var BODY_BY_ID = {};

  function Sim() {
    this.time = 0;              // simulation time in days since J2000
    this.bodies = [];           // flat list, stable order: sun, planets, moons
    this.planetById = {};
    this.moonsByParent = {};
    this.build();
  }

  Sim.prototype.build = function () {
    var self = this;
    var sun = D.SUN;

    var sunBody = {
      id: sun.id,
      name: sun.name,
      kind: 'star',
      parent: null,
      radiusKm: sun.radiusKm,
      radiusAU: sun.radiusKm * D.KM_TO_AU,
      schematicBase: 9.0,
      color: sun.color,
      glow: sun.glow,
      rotDays: sun.rotDays,
      tilt: 0,
      facts: sun.facts,
      blurb: sun.blurb,
      orbit: null,
      // Position accessor pattern: (t) -> AU vector
      local: function () { return { x: 0, y: 0, z: 0 }; },
      ref: sun
    };

    this.bodies.push(sunBody);
    BODY_BY_ID[sun.id] = sunBody;

    D.PLANETS.forEach(function (p) {
      var planet = {
        id: p.id,
        name: p.name,
        kind: p.kind,
        parent: 'sun',
        parentBody: sunBody,
        radiusKm: p.radiusKm,
        radiusAU: p.radiusKm * D.KM_TO_AU,
        schematicBase: p.schematicBase,
        ring: p.ring || null,
        color: p.color,
        glow: p.glow,
        rotDays: p.rotDays,
        tilt: p.tilt,
        period: p.period,
        a: p.a,
        e: p.e,
        inc: p.inc,
        facts: p.facts,
        blurb: p.blurb,
        ref: p
      };
      planet.local = (function (el) {
        return function (t) { return O.positionFromElements(el, t); };
      })({ a: p.a, e: p.e, inc: p.inc, w: p.w, M0: p.M0, period: p.period, epoch: 0 });

      self.bodies.push(planet);
      BODY_BY_ID[planet.id] = planet;
      self.planetById[planet.id] = planet;
      self.moonsByParent[planet.id] = [];
    });

    D.MOONS.forEach(function (m) {
      var parent = self.planetById[m.parent];
      var moon = {
        id: m.id,
        name: m.name,
        kind: 'moon',
        parent: m.parent,
        parentBody: parent,
        radiusKm: m.radiusKm,
        radiusAU: m.radiusKm * D.KM_TO_AU,
        schematicBase: m.schematicBase,
        color: m.color,
        glow: m.glow,
        rotDays: m.rotDays,
        tilt: 0,
        tidallyLocked: !!m.tidallyLocked,
        period: m.period,
        orbitRadiusAU: m.aKm * D.KM_TO_AU,
        facts: m.facts,
        blurb: m.blurb,
        ref: m
      };
      moon.local = (function (mm) {
        return function (t) {
          return O.positionOnCircularOrbit(
            mm.aKm * D.KM_TO_AU, mm.period, mm.phase, mm.node, mm.inc, t, 0
          );
        };
      })(m);

      self.bodies.push(moon);
      BODY_BY_ID[moon.id] = moon;
      self.moonsByParent[m.parent].push(moon);
    });

    this.byId = BODY_BY_ID;
    return this;
  };

  /** Heliocentric position (AU) at an arbitrary simulation time. */
  Sim.prototype.positionAt = function (body, t) {
    var local = body.local(t);
    if (!body.parentBody) return local;
    var p = this.positionAt(body.parentBody, t);
    return { x: p.x + local.x, y: p.y + local.y, z: p.z + local.z };
  };

  /** Positions of every body at the CURRENT simulation time. */
  Sim.prototype.snapshot = function () {
    var t = this.time;
    var out = {};
    for (var i = 0; i < this.bodies.length; i++) {
      var b = this.bodies[i];
      out[b.id] = this.positionAt(b, t);
    }
    return out;
  };

  /**
   * Smallest distance (AU) between two bodies at time t. Used by the
   * self-test to prove that a moon stays bound to its parent: this distance
   * must stay inside the moon's orbit radius no matter where the planet is.
   */
  Sim.prototype.distanceAt = function (aId, bId, t) {
    var a = this.positionAt(this.byId[aId], t);
    var b = this.positionAt(this.byId[bId], t);
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
  };

  /**
   * The closed orbit path of a body, as AU points, at simulation time `t`.
   *
   * This exists so the renderer never re-implements orbital maths:
   *   * a planet's path is its true ellipse (eccentricity, perihelion
   *     orientation and inclination included);
   *   * a moon's path is a circle traced in its parent's LOCAL frame and then
   *     offset by the parent's current heliocentric position — so the ring
   *     travels with the planet and can never drift away from the body that is
   *     actually drawn along it.
   *
   * `segments` controls smoothness; the result has segments + 1 points so the
   * path closes exactly.
   */
  Sim.prototype.orbitPathAt = function (body, t, segments) {
    segments = segments || 128;
    var pts = new Array(segments + 1);
    var i;

    if (body.kind === 'moon') {
      var rAU = body.orbitRadiusAU;
      var m = body.ref;
      var node = m.node * O.DEG;
      var inc = m.inc * O.DEG;
      var cn = Math.cos(node), sn = Math.sin(node);
      var ci = Math.cos(inc), si = Math.sin(inc);
      var parent = this.positionAt(body.parentBody, t);
      for (i = 0; i <= segments; i++) {
        var u = (i / segments) * O.TAU;
        var xp = rAU * Math.cos(u), yp = rAU * Math.sin(u);
        var xr = xp * cn - yp * sn;
        var yr = xp * sn + yp * cn;
        pts[i] = {
          x: parent.x + xr,
          y: parent.y + yr * ci,
          z: parent.z + yr * si
        };
      }
      return pts;
    }

    // Planet: sweep the eccentric anomaly once around the ellipse. Using E
    // rather than the mean anomaly spreads the samples evenly along the curve,
    // which is what keeps the orbit line smooth.
    var el = body.ref;
    var w = el.w * O.DEG;
    var cw = Math.cos(w), sw = Math.sin(w);
    var pInc = el.inc * O.DEG;
    var pci = Math.cos(pInc), psi = Math.sin(pInc);
    for (i = 0; i <= segments; i++) {
      var E = (i / segments) * O.TAU;
      var xv = body.a * (Math.cos(E) - body.e);
      var yv = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(E);
      var xp2 = xv * cw - yv * sw;
      var yp2 = xv * sw + yv * cw;
      pts[i] = { x: xp2, y: yp2 * pci, z: yp2 * psi };
    }
    return pts;
  };

  /** Angular speed in degrees/day: the "relative orbital speed" readout. */
  Sim.prototype.angularSpeedDegPerDay = function (body) {
    if (body.kind === 'star') return 360 / body.rotDays;
    return 360 / body.period;
  };

  Sim.prototype.orbitRadiusAU = function (body) {
    return body.kind === 'moon' ? body.orbitRadiusAU : (body.a || 0);
  };

  /**
   * Trail-sample spacing: about 1/360 of one orbit, clamped so that neither
   * Mercury (fast) nor Pluto (slow) produces an unreasonable buffer.
   */
  Sim.prototype.trailInterval = function (body) {
    var period = body.kind === 'star' ? 25 : body.period;
    return Math.min(Math.max(period / 360, 0.02), 20);
  };

  Sim.prototype.trailCapacity = function (body) {
    return body.kind === 'star' ? 2 : 900;
  };

  var api = { Sim: Sim, byId: function (id) { return BODY_BY_ID[id]; } };
  global.SolarSim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

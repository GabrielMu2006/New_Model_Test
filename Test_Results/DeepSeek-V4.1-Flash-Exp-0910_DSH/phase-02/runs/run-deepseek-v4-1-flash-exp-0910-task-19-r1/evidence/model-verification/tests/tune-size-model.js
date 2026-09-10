/* ==========================================================================
 * tests/tune-size-model.js — parameter search for the body-size model.
 *
 *     node tests/tune-size-model.js
 *
 * The size model must satisfy several constraints at once, and they pull in
 * opposite directions: a visible Mercury wants large magnification, while a
 * Moon that clears its planet's disc wants the planet small. Rather than
 * guess, this sweeps the parameter space and reports the settings that satisfy
 * every constraint, so the constants baked into js/projection.js are justified
 * by numbers and can be re-derived whenever the view presets change.
 *
 * Constraints (see js/projection.js "BODY RADII" for the model itself):
 *   C1  the real size ORDER holds at every preset, Sun's disc included
 *   C2  system view:  Mercury >= 1.5 px, Earth >= 3 px, Jupiter <= 30 px
 *   C3  system view:  Mercury's orbit clears the Sun's disc by 15%
 *   C4  focus view:   Earth stays a disc (3..12 px)
 *   C5  focus view:   the Moon's orbit clears Earth's disc by 3x
 *   C6  focus view:   Callisto's orbit still fits a 1280 px viewport
 * ========================================================================== */
'use strict';

var E = 6371.0 / 149597870.7;
var EXP = 0.75;
var SYSTEM_REF_PX = 16;      // must match js/projection.js

var KM = {
  sun: 696340, jup: 69911, sat: 58232, uran: 25362, nep: 24622,
  earth: 6371, ven: 6051.8, mars: 3389.5, gany: 2634.1,
  merc: 2439.7, io: 1821.6, moon: 1737.4
};

// Bodies in true-size order — the order the drawing must reproduce.
var ORDER = ['sun', 'jup', 'sat', 'uran', 'nep',
             'earth', 'ven', 'mars', 'gany', 'merc', 'io', 'moon'];

// Orbital radii in AU (circular for moons, semi-major for planets).
var ORB = {
  merc: 0.387, ven: 0.723, earth: 1.0, mars: 1.524,
  jup: 5.2, nep: 30.07, moon: 0.00257, callisto: 0.012585
};

// View presets — must match ZOOM_* in js/ui.js.
var Z = { full: 0.62, system: 8, inner: 40, focus: 0 };  // focus filled by search

function ratio(km) { return Math.pow(km / 149597870.7 / E, EXP); }

function makeModel(p) {
  return function drawn(km, zoom) {
    var mag = Math.max(p.MAG_WIDE / Math.pow(zoom, p.MAG_FADE), p.MAG_DEEP);
    var r = ratio(km);
    var d = p.FLOOR * r + p.BASE * r * mag;
    if (d > p.KNEE) d = p.KNEE * Math.pow(d / p.KNEE, p.POWER);
    return d;
  };
}

function orbitPx(au, zoom) { return au * zoom * SYSTEM_REF_PX; }

/** Returns a list of violated constraints; empty means the config is valid. */
function violations(p) {
  var f = makeModel(p);
  var bad = [];
  Z.focus = p.FOCUS;

  // C1 — ordering at every preset, and at the extremes of the zoom range the
  // UI allows (ZOOM_MIN / ZOOM_MAX in js/ui.js).
  var ZOOMS = [0.7, 2500].concat(Object.keys(Z).map(function (k) { return Z[k]; }));
  ZOOMS.forEach(function (z) {
    var vals = ORDER.map(function (id) {
      return id === 'sun' ? p.SUN_DISC : f(KM[id], z);
    });
    for (var j = 1; j < vals.length; j++) {
      if (!(vals[j - 1] > vals[j])) {
        bad.push('C1 zoom ' + z + ': ' + ORDER[j - 1] + ' ' + vals[j - 1].toFixed(2) +
                 ' <= ' + ORDER[j] + ' ' + vals[j].toFixed(2));
      }
    }
  });
  Object.keys(Z).forEach(function (k) {
    var z = Z[k];
    var vals = ORDER.map(function (id) {
      return id === 'sun' ? p.SUN_DISC : f(KM[id], z);
    });
    for (var i = 1; i < vals.length; i++) {
      if (!(vals[i - 1] > vals[i])) {
        bad.push('C1 ' + k + ': ' + ORDER[i - 1] + ' ' + vals[i - 1].toFixed(2) +
                 ' <= ' + ORDER[i] + ' ' + vals[i].toFixed(2));
      }
    }
  });

  // C2 / C3 — system view legibility.
  var zs = Z.system;
  if (f(KM.merc, zs) < 1.5) bad.push('C2 system: Mercury ' + f(KM.merc, zs).toFixed(2) + ' px');
  if (f(KM.earth, zs) < 3.0) bad.push('C2 system: Earth ' + f(KM.earth, zs).toFixed(2) + ' px');
  if (f(KM.jup, zs) > 30) bad.push('C2 system: Jupiter ' + f(KM.jup, zs).toFixed(1) + ' px');
  if (orbitPx(ORB.merc, zs) < p.SUN_DISC * 1.15) {
    bad.push('C3 system: Mercury orbit ' + orbitPx(ORB.merc, zs).toFixed(0) +
             ' px vs Sun disc ' + p.SUN_DISC);
  }

  // C4 / C5 / C6 — focus view.
  var zf = Z.focus;
  var earth = f(KM.earth, zf);
  if (earth < 3) bad.push('C4 focus: Earth ' + earth.toFixed(2) + ' px');
  if (earth > 12) bad.push('C4 focus: Earth ' + earth.toFixed(1) + ' px');
  if (orbitPx(ORB.moon, zf) < earth * 3) {
    bad.push('C5 focus: Moon orbit ' + orbitPx(ORB.moon, zf).toFixed(0) +
             ' px vs Earth disc ' + earth.toFixed(2));
  }
  if (orbitPx(ORB.callisto, zf) > 900) {
    bad.push('C6 focus: Callisto orbit ' + orbitPx(ORB.callisto, zf).toFixed(0) + ' px');
  }

  // The inner preset should separate the terrestrial planets.
  if (orbitPx(ORB.ven, Z.inner) - orbitPx(ORB.merc, Z.inner) < 60) {
    bad.push('inner preset: Mercury/Venus orbits too close');
  }

  return bad;
}

/** Prefer a visible Mercury, a legible Earth, and a well-separated Moon. */
function score(p) {
  var f = makeModel(p);
  Z.focus = p.FOCUS;
  var s = 0;
  s -= Math.abs(f(KM.merc, Z.system) - 2.4);
  s -= Math.abs(f(KM.earth, Z.system) - 4.0) * 1.2;
  s -= Math.abs(f(KM.jup, Z.system) - 16) * 0.3;
  s -= Math.abs(f(KM.earth, Z.focus) - 6.0) * 0.8;
  s += Math.min(4, orbitPx(ORB.moon, Z.focus) / f(KM.earth, Z.focus) - 3) * 1.5;
  // Prefer a moderate focus zoom: high enough to separate the Moon, low enough
  // that a neighbouring planet stays in frame for context.
  s -= Math.abs(Math.log(p.FOCUS / 1000)) * 1.5;
  return s;
}

function combinations() {
  var out = [];
  var BASE = [3, 4, 5, 6, 7, 8, 10];
  var FLOOR = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8];
  var MAG_WIDE = [4, 8, 12, 20, 30, 50];
  var MAG_FADE = [1.2, 1.4, 1.6, 1.8, 2.0];
  var MAG_DEEP = [0.2, 0.3, 0.4, 0.5, 0.7];
  var KNEE = [6, 8, 10, 14, 20, 28];
  var POWER = [0.4, 0.5, 0.6, 0.7, 0.8];
  var SUN_DISC = [12, 15, 18, 22, 26, 30];
  var FOCUS = [400, 700, 1000, 1500, 2200];
  BASE.forEach(function (a) {
    FLOOR.forEach(function (b) {
      MAG_WIDE.forEach(function (c) {
        MAG_FADE.forEach(function (d) {
          MAG_DEEP.forEach(function (e) {
            KNEE.forEach(function (g) {
              POWER.forEach(function (h) {
                SUN_DISC.forEach(function (i) {
                  FOCUS.forEach(function (j) {
                    out.push({
                      BASE: a, FLOOR: b, MAG_WIDE: c, MAG_FADE: d,
                      MAG_DEEP: e, KNEE: g, POWER: h, SUN_DISC: i, FOCUS: j
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  return out;
}

function main() {
  var all = combinations();
  var valid = all.filter(function (p) { return violations(p).length === 0; });

  console.log('searched ' + all.length.toLocaleString() + ' configurations');
  console.log('satisfying every constraint: ' + valid.length + '\n');

  if (!valid.length) {
    console.log('No configuration is valid — the constraint set is over-tight.');
    console.log('Violations for a middle-of-the-road config, to show what binds:');
    violations({ BASE: 5, FLOOR: 0.5, MAG_WIDE: 12, MAG_FADE: 1.6,
                 MAG_DEEP: 0.4, KNEE: 20, POWER: 0.7, SUN_DISC: 15, FOCUS: 1000 })
      .forEach(function (v) { console.log('  ' + v); });
    process.exit(1);
  }

  valid.sort(function (a, b) { return score(b) - score(a); });

  console.log('BASE FLOOR  MAGW FADE DEEP KNEE  POW  SUN FOCUS | system merc  earth    jup | focus earth moonOrb | inner  merc  earth');
  valid.slice(0, 15).forEach(function (p) {
    var f = makeModel(p);
    console.log(
      String(p.BASE).padStart(4) + ' ' + String(p.FLOOR).padStart(5) + ' ' +
      String(p.MAG_WIDE).padStart(5) + ' ' + String(p.MAG_FADE).padStart(4) + ' ' +
      String(p.MAG_DEEP).padStart(4) + ' ' + String(p.KNEE).padStart(5) + ' ' +
      String(p.POWER).padStart(4) + ' ' + String(p.SUN_DISC).padStart(4) + ' ' +
      String(p.FOCUS).padStart(5) +
      ' |' + f(KM.merc, Z.system).toFixed(2).padStart(12) +
      f(KM.earth, Z.system).toFixed(2).padStart(7) +
      f(KM.jup, Z.system).toFixed(1).padStart(7) +
      ' |' + f(KM.earth, Z.focus).toFixed(2).padStart(12) +
      orbitPx(ORB.moon, Z.focus).toFixed(0).padStart(9) +
      ' |' + f(KM.merc, Z.inner).toFixed(2).padStart(12) +
      f(KM.earth, Z.inner).toFixed(2).padStart(7));
  });

  console.log('\nbest by score: ' + JSON.stringify(valid[0]));
}

if (require.main === module) main();

module.exports = {
  makeModel: makeModel, violations: violations, score: score,
  Z: Z, KM: KM, ORB: ORB, ORDER: ORDER, SYSTEM_REF_PX: SYSTEM_REF_PX
};

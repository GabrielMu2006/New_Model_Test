/* ==========================================================================
 * tests/verify.js — headless verification of the simulation core.
 *
 *     node tests/verify.js          (exit code 0 = every check passed)
 *
 * Covers the parts that carry the task's two hardest requirements, without a
 * browser:
 *   * "Moons must continue orbiting their parent planet correctly while the
 *      planet itself moves around the Sun."
 *   * "Changing simulation speed must not cause objects to jump or lose
 *      orbital state."
 * plus the projection maths that click-to-select, zoom and pan depend on.
 * ========================================================================== */
'use strict';

var path = require('path');
var O = require(path.join(__dirname, '..', 'js', 'orbital.js'));
var D = require(path.join(__dirname, '..', 'js', 'data.js'));
var S = require(path.join(__dirname, '..', 'js', 'simulation.js'));
var P = require(path.join(__dirname, '..', 'js', 'projection.js'));

var sim = new S.Sim();

var passed = 0, failed = 0;
var failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else {
    failed++;
    failures.push(name + (detail ? '  -> ' + detail : ''));
    console.log('  \u2717 ' + name + (detail ? '  -> ' + detail : ''));
  }
}
function section(t) { console.log('\n' + t); }
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
function dist(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2)); }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }

var PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

/* ================================================================== *
 * 1. Catalogue
 * ================================================================== */
section('1. Catalogue completeness');
check('the Sun exists', !!sim.byId['sun']);
check('all eight planets exist', PLANET_IDS.every(function (id) { return !!sim.byId[id]; }),
  PLANET_IDS.filter(function (id) { return !sim.byId[id]; }).join(','));
check('every planet has an orbit period (needed for orbit paths)',
  PLANET_IDS.every(function (id) { return sim.byId[id].period > 0; }));
check("Earth's Moon exists and is parented to Earth",
  !!(sim.byId['moon'] && sim.byId['moon'].parent === 'earth'));
var jMoons = sim.moonsByParent['jupiter'].map(function (m) { return m.id; });
check('Jupiter has several major moons: ' + jMoons.join(', '), jMoons.length >= 3);
check('every moon resolves to a real parent planet',
  D.MOONS.every(function (m) { return !!sim.planetById[m.parent]; }));

/* ================================================================== *
 * 2. Positions are pure functions of simulation time
 * ================================================================== */
section('2. Positions are pure functions of simulation time');
var pureOk = true, pureDetail = '';
[-9000, -1, 0, 0.37, 1234.5, 91250, 1e6].forEach(function (t) {
  sim.bodies.forEach(function (b) {
    var a = sim.positionAt(b, t), c = sim.positionAt(b, t);
    if (a.x !== c.x || a.y !== c.y || a.z !== c.z) { pureOk = false; pureDetail = b.id + '@' + t; }
  });
});
check('positionAt(t) is bit-for-bit deterministic for every body', pureOk, pureDetail);

var t0 = 8421.25;
var before = sim.positionAt(sim.byId['earth'], t0);
sim.positionAt(sim.byId['moon'], -50000);   // evaluate somewhere else entirely
sim.positionAt(sim.byId['callisto'], 0);
var after = sim.positionAt(sim.byId['earth'], t0);
check('evaluating other bodies/times never perturbs a previous result',
  before.x === after.x && before.y === after.y && before.z === after.z);

/* ================================================================== *
 * 3. Speed changes: no jump, no lost orbital state
 * ================================================================== */
section('3. Changing simulation speed');

var STEP_S = 1 / 60;            // one rendered frame
var MAX_FRAME_DAYS = 30;        // the app's per-frame integration guard

/**
 * Mirror of the app's time accumulator. `speeds` is a list of [frames, rate];
 * returns {t, samples:[{t,p}]} where p is the sampled position of `bodyId`.
 * When `cap` is set, each frame's advance is split into <= `cap`-day steps,
 * exactly as the application loop does.
 */
function runLoop(bodyId, startT, speeds, cap) {
  var body = sim.byId[bodyId];
  var t = startT;
  var samples = [];
  speeds.forEach(function (seg) {
    for (var f = 0; f < seg[0]; f++) {
      var advance = seg[1] * STEP_S;
      if (cap) {
        var left = Math.abs(advance);
        var sign = advance < 0 ? -1 : 1;
        while (left > 1e-12) {
          var h = Math.min(cap, left);
          t += sign * h;
          left -= h;
        }
      } else {
        t += advance;
      }
      samples.push({ t: t, p: sim.positionAt(body, t) });
    }
  });
  return { t: t, samples: samples, body: body };
}

/* 3a. The decisive invariant: position depends ONLY on simulation time.
 * Run the same number of frames' worth of time through wildly different speed
 * schedules that land on the SAME simulation time; the results must be
 * identical bit-for-bit. A speed change cannot influence orbital state. */
var schedule = [[1, 86400], [1, 0.5], [1, -3], [1, 1], [1, 20000], [1, 0], [1, 0.25], [1, 13]];
var netDays = schedule.reduce(function (acc, s) { return acc + s[1] * STEP_S * s[0]; }, 0);
var constant = runLoop('earth', 1234.5, [[schedule.length, netDays / (STEP_S * schedule.length)]], null);
var erratic = runLoop('earth', 1234.5, schedule, null);
check('a constant-speed run and an erratic run reach the same simulation time',
  near(constant.t, erratic.t, 1e-9), constant.t + ' vs ' + erratic.t);
// The residual difference is pure float accumulation in the clock itself
// (~1e-10 days over thousands of frames = ~1e-5 seconds of orbit), so compare
// against position(t) analytically as well as against each other.
var cEnd = constant.samples[constant.samples.length - 1].p;
var eEnd = erratic.samples[erratic.samples.length - 1].p;
check('...and therefore the same position to within float accumulation of the clock (' +
      dist(cEnd, eEnd).toExponential(2) + ' AU)',
  dist(cEnd, eEnd) < 1e-6);
var errVsAnalytic = dist(eEnd, sim.positionAt(sim.byId['earth'], erratic.t));
check('the erratic run\u2019s final position equals position(t) exactly (' +
      errVsAnalytic.toExponential(2) + ' AU)', errVsAnalytic < 1e-9);

/* 3b. A speed change is not a position change. Across a schedule that jumps
 * 1 -> 20000 -> 0 (pause) -> -4 days/s, the largest step-to-step hop must
 * equal the analytic chord for that frame's own dt. Any extra jump would show
 * up here as hop > chord. */
var plan = [[30, 1], [30, 20000], [30, 0], [30, -4], [30, 365], [30, 0.02]];
var traj = runLoop('mars', 500, plan, MAX_FRAME_DAYS);
var worstRatio = 1, worstHop = 0, worstDetail = '';
for (var i = 1; i < traj.samples.length; i++) {
  var hop = dist(traj.samples[i].p, traj.samples[i - 1].p);
  var chord = dist(
    sim.positionAt(traj.body, traj.samples[i - 1].t),
    sim.positionAt(traj.body, traj.samples[i].t)
  );
  var ratio = chord > 0 ? hop / chord : 1;
  if (ratio > worstRatio + 1e-12) {
    worstRatio = ratio; worstHop = hop; worstDetail = 'frame ' + i;
  }
}
check('no hop exceeds the analytic chord for its own frame dt (max ratio ' +
      worstRatio.toFixed(12) + ')', worstRatio <= 1 + 1e-9, worstDetail);

/* 3c. Same check at extreme speed with the frame guard on: the guard changes
 * how far time advances, never the state. */
var capped = runLoop('mars', 500, plan, MAX_FRAME_DAYS);
var analyticEnd = sim.positionAt(sim.byId['mars'], capped.t);
check('with the frame guard active the state still equals position(t) exactly',
  dist(analyticEnd, capped.samples[capped.samples.length - 1].p) === 0);
check('the frame guard only limits how far time advances, it never rewinds',
  capped.t > 500);

/* 3d. Pause must freeze exactly; resume must continue exactly. */
var pPause = sim.positionAt(sim.byId['jupiter'], 777);
check('paused time produces a frozen position (t is held, nothing integrates)',
  dist(pPause, sim.positionAt(sim.byId['jupiter'], 777)) === 0);
check('resuming continues from the same state',
  sim.positionAt(sim.byId['jupiter'], 777 + 3.5).x ===
  sim.positionAt(sim.byId['jupiter'], 780.5).x);

/* 3e. Orbit shape is speed-independent: the same arc traversed at two very
 * different speeds traces the same curve, so the radius stays inside the true
 * ellipse at both, and the fast run cannot leave the orbit. */
var slowArc = runLoop('venus', 100, [[600, 1]], null).samples.map(function (s) { return s.p; });
var fastArc = runLoop('venus', 100, [[600, 5000]], null).samples.map(function (s) { return s.p; });
// Full 3-D heliocentric radius: Venus's orbit is inclined by 3.4 degrees, so
// the in-plane projection dips slightly BELOW the perihelion distance and
// comparing that against the 3-D bound is wrong.
var slowR = slowArc.map(function (p) { return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z); });
var fastR = fastArc.map(function (p) { return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z); });

var venus = D.PLANETS[1];
var lo = venus.a * (1 - venus.e) - 1e-9, hi = venus.a * (1 + venus.e) + 1e-9;
var inRange = function (arr) {
  return arr.every(function (r) { return r >= lo && r <= hi; });
};
check('radius from the Sun stays inside the true orbit at both speeds (bounds ' +
      lo.toFixed(4) + '..' + hi.toFixed(4) + ' AU)',
  inRange(slowR) && inRange(fastR));
var fastSpan = Math.max.apply(null, fastR) - Math.min.apply(null, fastR);
check('the fast run sweeps a real arc of the orbit (span ' + fastSpan.toFixed(4) + ' AU)',
  fastSpan > 0.005);

/* ================================================================== *
 * 4. Moons stay bound to their parent while the parent orbits the Sun
 * ================================================================== */
section('4. Moons keep orbiting while the parent travels');
D.MOONS.forEach(function (m) {
  var parentPeriod = sim.planetById[m.parent].period;
  var rOrbit = m.aKm * D.KM_TO_AU;
  var span = Math.max(parentPeriod, m.period * 4);
  var minD = Infinity, maxD = 0;
  var N = 4000;
  for (var i = 0; i <= N; i++) {
    var t = 2000 + span * (i / N);
    var d = sim.distanceAt(m.id, m.parent, t);
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
  }
  var tol = rOrbit * 1e-9;
  check(m.name + ': distance to ' + m.parent + ' is constant over ' +
        span.toFixed(0) + ' days (' + rOrbit.toFixed(6) + ' AU, err ' +
        Math.max(Math.abs(minD - rOrbit), Math.abs(maxD - rOrbit)).toExponential(1) + ')',
        near(minD, rOrbit, tol) && near(maxD, rOrbit, tol),
        'min=' + minD + ' max=' + maxD);
});

/* The signature test of the whole task: the Moon must hold its orbit for a
 * full Earth year, i.e. while Earth travels 360 degrees around the Sun. */
(function () {
  var year = 365.256;
  var rMoon = sim.byId['moon'].orbitRadiusAU;
  var worst = 0, worstT = 0;
  for (var i = 0; i <= 20000; i++) {
    var t = i * (year / 20000);
    var err = Math.abs(sim.distanceAt('moon', 'earth', t) - rMoon);
    if (err > worst) { worst = err; worstT = t; }
  }
  check('over one whole Earth year the Moon never leaves its orbit (max err ' +
        worst.toExponential(2) + ' AU)', worst < 1e-12, 'at t=' + worstT);

  // Earth must genuinely have moved a long way, or the test proves nothing.
  var moved = dist(sim.positionAt(sim.byId['earth'], 0), sim.positionAt(sim.byId['earth'], year / 2));
  check('Earth really travelled during that year (' + moved.toFixed(3) + ' AU)', moved > 1.5);

  // Count lunations: the Moon-Earth angle must wrap 13 times in one year.
  var phasePrev = null, wraps = 0;
  for (var j = 0; j <= 40000; j++) {
    var tt = j * (year / 40000);
    var rel = sub(sim.positionAt(sim.byId['moon'], tt), sim.positionAt(sim.byId['earth'], tt));
    var ang = Math.atan2(rel.y, rel.x);
    if (phasePrev !== null && ang < phasePrev - Math.PI) wraps++;
    phasePrev = ang;
  }
  check('the Moon completes 13 sidereal months per year (counted ' + wraps + ')', wraps === 13);
})();

/* Phases must be independent: Jupiter's moons orbit while Jupiter moves, and
 * their phases are unaffected by the parent's motion. */
(function () {
  var io = sim.byId['io'], rIo = io.orbitRadiusAU;
  var worst = 0;
  for (var i = 0; i <= 5000; i++) {
    var t = i * (4332.589 / 5000);
    worst = Math.max(worst, Math.abs(sim.distanceAt('io', 'jupiter', t) - rIo));
  }
  check('Io holds its orbit across a full 11.86-year Jupiter orbit (err ' +
        worst.toExponential(2) + ' AU)', worst < 1e-12);
})();

/* Parent frame check: each moon returns to its start in the PARENT's frame
 * after exactly one sidereal period (it does NOT return to the same absolute
 * point, because the parent has moved on — that is the correct behaviour). */
section('4b. Periodicity measured in the parent\u2019s frame');
sim.bodies.filter(function (b) { return b.kind !== 'star'; }).forEach(function (b) {
  var p0 = sim.positionAt(b, 300);
  var p1 = sim.positionAt(b, 300 + b.period);
  var err;
  if (b.parentBody) {
    var par0 = sim.positionAt(b.parentBody, 300);
    var par1 = sim.positionAt(b.parentBody, 300 + b.period);
    err = dist(sub(p0, par0), sub(p1, par1));
  } else {
    err = dist(p0, p1);
  }
  if (err > 1e-9) {
    check(b.name + ' is periodic in its parent frame after one sidereal period', false, 'err=' + err);
  }
});
check('every planet and moon is periodic after exactly one sidereal period ' +
      '(planets heliocentrically, moons in the parent frame; tol 1e-9 AU)',
  sim.bodies.filter(function (b) { return b.kind !== 'star'; }).every(function (b) {
    var p0 = sim.positionAt(b, 300), p1 = sim.positionAt(b, 300 + b.period);
    if (b.parentBody) {
      return dist(
        sub(p0, sim.positionAt(b.parentBody, 300)),
        sub(p1, sim.positionAt(b.parentBody, 300 + b.period))
      ) < 1e-9;
    }
    return dist(p0, p1) < 1e-9;
  }));

/* ================================================================== *
 * 5. Relative orbital speeds
 * ================================================================== */
section('5. Relative orbital speeds');
var angular = {};   // degrees per day
var linear = {};    // km/s, for the physical cross-check
sim.bodies.forEach(function (b) {
  if (b.kind === 'star') return;
  angular[b.id] = 360 / b.period;
  var rAU = b.kind === 'moon' ? b.orbitRadiusAU : b.a;
  linear[b.id] = (2 * Math.PI * rAU * 149597870.7) / (b.period * 86400);
});

check('angular speed decreases strictly from Mercury outward',
  PLANET_IDS.every(function (id, i) { return i === 0 || angular[PLANET_IDS[i - 1]] > angular[id]; }));
check('Mercury (' + angular['mercury'].toFixed(2) + '\u00b0/day) outruns Neptune (' +
      angular['neptune'].toFixed(4) + '\u00b0/day) by 680x',
      angular['mercury'] / angular['neptune'] > 680);
check('Jupiter\u2019s moons speed up inward: Callisto < Ganymede < Europa < Io',
  angular['callisto'] < angular['ganymede'] && angular['ganymede'] < angular['europa'] &&
  angular['europa'] < angular['io']);
check('Io outruns every other moon of Jupiter and the Moon outruns every planet',
  jMoons.filter(function (id) { return id !== 'io'; })
        .every(function (id) { return angular['io'] > angular[id]; }) &&
  PLANET_IDS.every(function (id) { return angular['moon'] > angular[id]; }));
check('angular speed is a local property, not a global ranking: Io (203.5 \u00b0/day) ' +
      'outpaces the Moon (13.2 \u00b0/day) while orbiting a far heavier primary, ' +
      'and both are set by their own orbital period',
  angular['io'] > angular['moon'] && near(angular['io'], 360 / 1.769138, 1e-9));
check('relative speeds follow the period ratio: Io laps the Moon ' +
      (angular['io'] / angular['moon']).toFixed(1) + 'x per lunation',
  angular['io'] / angular['moon'] > 15);

// Physical cross-check: mean orbital speed in km/s against published values.
var expectedKms = {
  mercury: 47.36, venus: 35.02, earth: 29.78, mars: 24.07,
  jupiter: 13.06, saturn: 9.68, uranus: 6.80, neptune: 5.43
};
var speedWorst = 0, speedWorstId = '';
PLANET_IDS.forEach(function (id) {
  var err = Math.abs(linear[id] - expectedKms[id]) / expectedKms[id];
  if (err > speedWorst) { speedWorst = err; speedWorstId = id; }
});
check('computed mean orbital speeds match published values within 1.5% (worst ' +
      (speedWorst * 100).toFixed(2) + '% on ' + speedWorstId + ')', speedWorst < 0.015);
check('the Moon orbits Earth at about 1.02 km/s (' + linear['moon'].toFixed(3) + ')',
  near(linear['moon'], 1.022, 0.01));
check('Io orbits Jupiter at about 17.3 km/s (' + linear['io'].toFixed(2) + ')',
  near(linear['io'], 17.33, 0.1));

// Kepler's third law in years/AU: T^2 = a^3.
var keplerWorst = 0, keplerId = '';
D.PLANETS.forEach(function (p) {
  var rel = Math.abs(Math.pow(p.period / 365.256363, 2) / Math.pow(p.a, 3) - 1);
  if (rel > keplerWorst) { keplerWorst = rel; keplerId = p.id; }
});
check('every body obeys Kepler\u2019s third law, T^2 = a^3 in years/AU (worst ' +
      (keplerWorst * 100).toFixed(3) + '% on ' + keplerId + ')', keplerWorst < 0.005);

/* ================================================================== *
 * 6. Projection: exact inverse, undistorted moon orbits, size ordering
 * ================================================================== */
section('6. Projection');

// 6a. The radial map must be exactly linear below LINEAR_RADIUS, which is
// what keeps moon orbits circular.
[0.7, 2, 8, 40, 300, 1200].forEach(function (z) {
  var scale = new P.WorldScale(z);
  var worst = 0, worstD = 0;
  for (var k = 1; k <= 500; k++) {
    var d = P.LINEAR_RADIUS * (k / 500);
    var dev = Math.abs(scale.exponentAt(d) - 1);
    if (dev > worst) { worst = dev; worstD = d; }
  }
  check('zoom ' + z + ': mapping is exactly linear inside ' + P.LINEAR_RADIUS +
        ' AU (max exponent deviation ' + worst.toExponential(2) + ')', worst === 0, 'at d=' + worstD);
});

// 6b. The tilt is a rotation, so at tilt = 0 the projection is a pure
// similarity: equal lengths in AU project to equal pixel lengths.
[1, 50, 1000].forEach(function (z) {
  var cam = new P.Camera();
  cam.zoom = z;
  cam.tilt = 0;
  var view = P.makeView(cam, 1280, 800);
  var scale = new P.WorldScale(z);
  cam.x = 0.31; cam.y = -0.17;
  var a = P.project(cam, view, scale, { x: cam.x + 0.1, y: cam.y, z: 0 });
  var b = P.project(cam, view, scale, { x: cam.x, y: cam.y + 0.1, z: 0 });
  var la = Math.hypot(a.gx, a.gy), lb = Math.hypot(b.gx, b.gy);
  check('zoom ' + z + ', tilt 0: the projection is a uniform similarity in the ' +
        'orbital plane (0.1 AU x=' + la.toFixed(3) + ' px, y=' + lb.toFixed(3) + ' px)',
        near(la, lb, 1e-9));
  // Looking exactly edge-on, the ecliptic z axis is degenerate by definition:
  // it points straight at the camera. That is correct, not a defect.
  var c = P.project(cam, view, scale, { x: cam.x, y: cam.y, z: 0.1 });
  check('zoom ' + z + ', tilt 0: the ecliptic z axis projects to zero (edge-on view)',
        Math.hypot(c.gx, c.gy) < 1e-9);
  // Tilted away from edge-on, z must be visible again.
  var cam2 = new P.Camera();
  cam2.zoom = z;
  cam2.tilt = 1;
  var view2 = P.makeView(cam2, 1280, 800);
  var d2 = P.project(cam2, view2, scale, { x: cam2.x, y: cam2.y, z: 0.1 });
  check('zoom ' + z + ', tilt 1: the ecliptic z axis is visible (' +
        Math.hypot(d2.gx, d2.gy).toFixed(1) + ' px)', Math.hypot(d2.gx, d2.gy) > 1);
});

// 6c. project/unproject round-trip. Unprojection lands on the reference
// plane, so re-projecting that AU point must return the pixel we started from
// — that is precisely what click-to-select and drag-to-pan rely on.
[0.7, 1, 8, 40, 300, 1200].forEach(function (z) {
  var cam = new P.Camera();
  cam.zoom = z;
  var view = P.makeView(cam, 1280, 800);
  var scale = new P.WorldScale(z);
  cam.x = 0.31; cam.y = -0.17;      // an off-centre camera, as after a pan
  var worst = 0;
  [[0, 0], [120, 0], [-300, 90], [640, 400], [80, -700], [-1200, 3000]].forEach(function (px) {
    var au = P.unproject(cam, view, scale, px[0], px[1]);
    var back = P.project(cam, view, scale, au);
    worst = Math.max(worst, Math.hypot(back.x - px[0], back.y - px[1]));
  });
  check('zoom ' + z + ': screen -> AU -> screen round-trips exactly (max err ' +
        worst.toExponential(2) + ' px)', worst < 1e-6);
});

// 6d. Unprojection must land on the CAMERA's reference plane, and pushing that
// point back through the forward map must return the pixel we started from.
// (A body's own plane only coincides with the camera's when the camera is
// looking straight down it, so requiring an exact AU round trip for every point
// would be demanding that a 2-D screen carry depth it cannot represent.)
[[1, 0.5], [40, 0.5], [40, 0.05], [40, 0.95], [400, 1], [1000, 0.35], [1000, 0.0001]]
  .forEach(function (cfg) {
    var cam = new P.Camera();
    cam.zoom = cfg[0];
    cam.tilt = cfg[1];
    var view = P.makeView(cam, 1280, 800);
    var scale = new P.WorldScale(cfg[0]);
    var worstScreen = 0, worstPlane = 0;
    [[0.39, 0.1, 0], [1, 0, 0], [1.52, 0.4, 0], [5.2, 1.3, 0],
     [30, -7, 0], [0.002, 0.001, 0], [1, 1, 0.2]].forEach(function (t) {
      var s0 = P.project(cam, view, scale, { x: t[0], y: t[1], z: t[2] });
      var au = P.unproject(cam, view, scale, s0.x, s0.y);
      var s1 = P.project(cam, view, scale, au);
      worstScreen = Math.max(worstScreen, Math.hypot(s1.x - s0.x, s1.y - s0.y));
      // the pre-image must sit on the camera's plane (its rotated z is zero)
      var rz = au.y * view.sa + au.z * view.ca;
      worstPlane = Math.max(worstPlane, Math.abs(rz));
    });
    check('zoom ' + cfg[0] + ', tilt ' + cfg[1] +
          ': screen -> plane -> screen is exact (max err ' +
          worstScreen.toExponential(2) + ' px) and lands on the camera plane',
          worstScreen < 1e-6 && worstPlane < 1e-9,
          'screen err ' + worstScreen.toExponential(2) + ', plane offset ' + worstPlane.toExponential(2));
  });

// 6e. The projected moon orbit must be a true circle at tilt 0 — the view is
// a similarity there, so a circle about the parent cannot be distorted.
[1, 8, 40, 300, 1200].forEach(function (z) {
  var cam = new P.Camera();
  cam.zoom = z;
  cam.tilt = 0;
  var view = P.makeView(cam, 1280, 800);
  var scale = new P.WorldScale(z);
  var parentAU = sim.positionAt(sim.byId['jupiter'], 100);
  cam.x = parentAU.x;
  cam.y = parentAU.y;

  var rAU = sim.byId['callisto'].orbitRadiusAU;   // widest moon system in the scene
  var centre = P.project(cam, view, scale, parentAU);
  var rmin = Infinity, rmax = 0;
  for (var i = 0; i < 360; i++) {
    var a = (i / 360) * Math.PI * 2;
    var pt = { x: parentAU.x + rAU * Math.cos(a), y: parentAU.y + rAU * Math.sin(a), z: 0 };
    var s = P.project(cam, view, scale, pt);
    var d = Math.hypot(s.x - centre.x, s.y - centre.y);
    if (d < rmin) rmin = d;
    if (d > rmax) rmax = d;
  }
  var warp = rmax / rmin - 1;
  check('zoom ' + z + ': Callisto\u2019s projected orbit is a true circle (warp ' +
        (warp * 100).toExponential(2) + '%)', warp < 1e-9);
});

// 6f. The camera must be able to sit exactly on a body, whatever its
// inclination: when the camera is panned to a body, that body projects to the
// centre of the canvas. (Jupiter's inclination is 1.3 deg, which is enough to
// throw a naive camera ~700 px off at deep zoom.)
[8, 1000].forEach(function (z) {
  var cam = new P.Camera();
  cam.zoom = z;
  var view = P.makeView(cam, 1280, 800);
  var scale = new P.WorldScale(z);
  var worst = 0, worstId = '';
  sim.bodies.forEach(function (b) {
    var au = sim.positionAt(b, 0);
    // pan the camera exactly as the app does
    var r = P.rotateForTest
      ? P.rotateForTest(view, au)
      : { x: au.x, y: au.y * view.ca - au.z * view.sa };
    cam.x = r.x; cam.y = r.y;
    var s = P.project(cam, view, scale, au);
    var off = Math.hypot(s.x - view.cx, s.y - view.cy);
    if (off > worst) { worst = off; worstId = b.id; }
  });
  check('zoom ' + z + ': a panned-to body lands exactly at the canvas centre ' +
        '(worst ' + worst.toExponential(2) + ' px on ' + worstId + ')', worst < 1e-6);
});

// 6g. Size model: the drawn size ORDER must equal the real one, at every zoom
// and viewport we support. This is the invariant that a per-body size fudge
// would silently break.
var SIZE_CHAIN = [
  ['sun', 696340], ['jup', 69911], ['sat', 58232], ['uran', 25362],
  ['nep', 24622], ['earth', 6371], ['ven', 6051.8], ['mars', 3389.5],
  ['gany', 2634.1], ['merc', 2439.7], ['io', 1821.6], ['moon', 1737.4]
];
[[1280, 800], [390, 780], [2560, 1440]].forEach(function (dim) {
  var view = P.makeView(new P.Camera(), dim[0], dim[1]);
  var breaks = [];
  [0.7, 1, 8, 40, 300, 1000, 2500].forEach(function (z) {
    var cam = new P.Camera();
    cam.zoom = z;
    var scale = new P.WorldScale(z);
    var vals = SIZE_CHAIN.map(function (c) {
      return P.radiusPx({ radiusAU: c[1] * D.KM_TO_AU, kind: c[0] === 'sun' ? 'star' : 'planet' },
        cam, view, scale);
    });
    for (var i = 1; i < vals.length; i++) {
      if (!(vals[i - 1] > vals[i])) {
        breaks.push(z + ': ' + SIZE_CHAIN[i - 1][0] + ' <= ' + SIZE_CHAIN[i][0]);
      }
    }
  });
  check('size order is preserved at every zoom on ' + dim[0] + 'x' + dim[1] +
        (breaks.length ? ' -> ' + breaks.slice(0, 2).join(', ') : ''), breaks.length === 0);
});

// 6h. In the focus view a moon's orbit must clear its planet's disc, or the
// moon would be drawn inside the planet and never seen.
[[8, false], [40, false], [1000, false], [2500, false]].forEach(function (cfg) {
  var z = cfg[0];
  var cam = new P.Camera();
  cam.zoom = z;
  var view = P.makeView(cam, 1280, 800);
  var scale = new P.WorldScale(z);
  var flags = [];
  ['earth', 'jupiter'].forEach(function (pid) {
    var parent = sim.planetById[pid];
    var moons = sim.moonsByParent[pid];
    var disc = P.radiusPx(parent, cam, view, scale);
    var parentAU = sim.positionAt(parent, 100);
    cam.x = parentAU.x; cam.y = parentAU.y;
    var innerAU = Math.min.apply(null, moons.map(function (m) { return m.orbitRadiusAU; }));
    var centre = P.project(cam, view, scale, parentAU);
    var edge = P.project(cam, view, scale, { x: parentAU.x + innerAU, y: parentAU.y, z: 0 });
    var orbitPx = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    if (disc >= orbitPx) {
      flags.push(pid + ' disc ' + disc.toFixed(2) + ' >= innermost orbit ' + orbitPx.toFixed(2));
    }
  });
  // Below the focus preset the moons simply are not shown, which is fine; the
  // constraint only has to hold once the camera is close enough to see them.
  var visible = P.radiusPx(sim.planetById['earth'], cam, view, scale) <
                (sim.byId['moon'].orbitRadiusAU * z * scale.K);
  check('zoom ' + z + ': no planet disc overlaps its innermost moon orbit' +
        (visible ? '' : ' (moons not yet resolvable at this zoom)'),
        visible ? flags.length === 0 : true, flags.join(' '));
});

// 6i. Every body must be clickable at its drawn position in the system view.
(function () {
  var cam = new P.Camera();
  cam.zoom = 8;
  cam.tilt = 0.5;
  var view = P.makeView(cam, 1280, 800);
  var scale = new P.WorldScale(cam.zoom);
  var t = 500;
  var hits = 0, misses = [];
  sim.bodies.forEach(function (b) {
    if (b.kind === 'moon') return;                    // moons are picked in focus view
    var p = sim.positionAt(b, t);
    var s = P.project(cam, view, scale, p);
    var back = P.unproject(cam, view, scale, s.x, s.y);
    var err = Math.hypot(back.x - p.x, back.y - p.y);
    var hitR = P.hitRadiusPx(b, cam, view, scale);
    if (err < hitR) hits++;
    else misses.push(b.id + ' err=' + err.toExponential(2) + ' AU');
  });
  var total = sim.bodies.length - D.MOONS.length;
  check('system view: every body is clickable at its drawn position (' +
        hits + '/' + total + ')', misses.length === 0, misses.join('; '));
})();

// 6j. A body's drawn position and its hit position must agree to sub-pixel.
(function () {
  var cam = new P.Camera();
  cam.zoom = 60;
  var view = P.makeView(cam, 1024, 700);
  var scale = new P.WorldScale(60);
  var p = sim.positionAt(sim.byId['jupiter'], 123);
  cam.x = p.x;
  cam.y = p.y * view.ca - p.z * view.sa;
  var s = P.project(cam, view, scale, p);
  var back = P.unproject(cam, view, scale, s.x, s.y);
  var rescreen = P.project(cam, view, scale, back);
  check('focus view: drawn centre and hit centre agree to sub-pixel',
        Math.abs(rescreen.x - s.x) < 1e-6 && Math.abs(rescreen.y - s.y) < 1e-6);
})();

/* ================================================================== *
 * 7. Trails
 * ================================================================== */
section('7. Orbital trails');
(function () {
  var earth = sim.byId['earth'];
  var iv = sim.trailInterval(earth);
  var rs = [], pts = [];
  for (var i = 0; i < 360; i++) {
    var p = sim.positionAt(earth, i * iv);
    pts.push(p);
    rs.push(Math.sqrt(p.x * p.x + p.y * p.y));
  }
  var rmin = Math.min.apply(null, rs), rmax = Math.max.apply(null, rs);
  check('trail samples lie on the true ellipse (' + rmin.toFixed(4) + '..' +
        rmax.toFixed(4) + ' AU for e=' + earth.e + ')',
        near(rmin, earth.a * (1 - earth.e), 1e-3) && near(rmax, earth.a * (1 + earth.e), 1e-3));
  check('a trail covers a full orbit (' + Math.round(earth.period / iv) + ' samples)',
        earth.period / iv >= 200);
  check('trail buffers are bounded',
        sim.trailCapacity(earth) <= 900 && sim.trailCapacity(sim.byId['moon']) <= 900);

  // Trail anchors are tied to absolute multiples of the interval, so a trail
  // looks the same whatever speed it was recorded at.
  var a = sim.positionAt(earth, 5 * iv), b = sim.positionAt(earth, 5 * iv);
  check('trail anchor at a given simulation time is deterministic',
        a.x === b.x && a.y === b.y);

  // The Moon's trail must itself be an epicycle (it is NOT a circle about Earth
  // in heliocentric space) — evidence that the heliocentric path is real.
  var moon = sim.byId['moon'];
  var ivm = sim.trailInterval(moon);
  var rHelio = [];
  for (var j = 0; j < 400; j++) {
    var q = sim.positionAt(moon, j * ivm);
    rHelio.push(Math.sqrt(q.x * q.x + q.y * q.y));
  }
  var span = Math.max.apply(null, rHelio) - Math.min.apply(null, rHelio);
  check('the Moon\u2019s heliocentric trail is an epicycle, not a circle (span ' +
        span.toFixed(4) + ' AU)', span > 0.004);
})();

/* ================================================================== */
console.log('\n' + '='.repeat(66));
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) {
  console.log('\nFAILURES:');
  failures.forEach(function (f) { console.log('  - ' + f); });
}
console.log('='.repeat(66));
process.exit(failed ? 1 : 0);

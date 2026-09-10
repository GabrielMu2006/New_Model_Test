/* ------------------------------------------------------------------------
 * model.js — pure kinematics + geometry of the skeleton movement.
 *
 * No DOM access, no external data. Loaded by build.mjs / verify.mjs in Node
 * and inlined verbatim into the <script> of the standalone SVG, so the
 * animated file and the tests share exactly one source of truth.
 *
 * Train (dial-side view, +angle = clockwise on screen):
 *
 *   barrel 80 ──> center pinion 10      center wheel 48 ──> third pinion 6
 *   third wheel 45 ──> fourth pinion 6  fourth wheel 48 ──> escape pinion 6
 *   escape wheel 15 (coarser module)    fourth wheel 48 ──> seconds train
 *   cannon 8 ──> minute wheel 36        minute pinion 12 ──> hour wheel 32
 *
 * Every wheel angle is a fixed multiple of ONE master phase Q (the number of
 * escapement beats), so the whole movement is one coherent system: the
 * escapement quantises the train, the train drives the hands.
 * ---------------------------------------------------------------------- */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = 180 / Math.PI;

  /* ---------------- design constants ---------------------------------- */
  var MODULE = 2.6;             // pitch diameter (px) per tooth, train wheels
  var ESC_MODULE = 3.64;        // escape wheels are cut with a coarser module
  var BEATS_PER_SEC = 4;        // 4 beats/s = 2 Hz = 14 400 A/h
  var ESCAPE_TEETH = 15;
  var BEATS_PER_ESCAPE_REV = ESCAPE_TEETH * 2;          // 30 beats / turn
  var BALANCE_AMPLITUDE = 270;  // degrees each side of centre
  var PALLET_AMPLITUDE = 4.5;   // pallet-fork swing, degrees each side
  var LIFT_START = 0.03;        // fraction of a beat: unlocking
  var LIFT_END = 0.16;          // fraction of a beat: locked again
  var FULL_WIND_BEATS = 40 * 3600 * BEATS_PER_SEC;      // 40 h power reserve

  var CX = 470, CY = 460;       // centre arbor (watch centre) on the canvas

  /* ---------------- tiny helpers -------------------------------------- */
  function polar(o, dist, deg) {
    var a = deg / DEG;
    return { x: o.x + dist * Math.cos(a), y: o.y - dist * Math.sin(a) };
  }
  function mid(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function deg2(a, b) { return Math.atan2(b.y - a.y, b.x - a.x) * DEG; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function mod(v, m) { var r = v % m; return r < 0 ? r + m : r; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function n(v) {
    var s = (Math.round(v * 100) / 100).toFixed(2);
    return s.replace(/\.?0+$/, '');
  }

  /* ---------------- tooth counts -------------------------------------- */
  var TEETH = {
    barrel: 80,
    centerPinion: 10, centerWheel: 48,
    thirdPinion: 6, thirdWheel: 45,
    fourthPinion: 6, fourthWheel: 48,
    escapePinion: 6, escapeWheel: ESCAPE_TEETH,
    cannon: 8, minuteWheel: 36, minutePinion: 12, hourWheel: 32,
    compoundPinion: 16, compoundWheel: 18, secondsWheel: 54
  };
  var pitchR = function (teeth, mod) { return (mod || MODULE) * teeth / 2; };
  var meshD = function (ta, tb, mod) { return (mod || MODULE) * (ta + tb) / 2; };

  /* ---------------- arbor layout --------------------------------------
   * Positions are derived from the mesh centre distances, so the layout can
   * never drift away from the gear ratios.                                 */
  var ARBOR = {};
  ARBOR.center = { x: CX, y: CY };
  ARBOR.barrel = polar(ARBOR.center, meshD(TEETH.barrel, TEETH.centerPinion), 150);
  ARBOR.third = polar(ARBOR.center, meshD(TEETH.centerWheel, TEETH.thirdPinion), 55);
  ARBOR.fourth = polar(ARBOR.third, meshD(TEETH.thirdWheel, TEETH.fourthPinion), 0);
  ARBOR.escape = polar(ARBOR.fourth, meshD(TEETH.fourthWheel, TEETH.escapePinion), -60);
  ARBOR.balance = polar(ARBOR.escape, 165, 250);
  ARBOR.pallet = mid(ARBOR.escape, ARBOR.balance, 74.3 / 165);
  ARBOR.compound = (function () {
    /* intersection of  circle(center, r to seconds wheel)  and
     *                 circle(fourth, r to compound pinion)   */
    var r1 = meshD(TEETH.compoundWheel, TEETH.secondsWheel);
    var r2 = meshD(TEETH.fourthWheel, TEETH.compoundPinion);
    var A = ARBOR.center, B = ARBOR.fourth, d = dist(A, B);
    var a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
    var h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
    var ux = (B.x - A.x) / d, uy = (B.y - A.y) / d;
    return { x: A.x + ux * a - uy * h, y: A.y + uy * a + ux * h };
  })();
  ARBOR.minuteWheel = polar(ARBOR.center, meshD(TEETH.cannon, TEETH.minuteWheel), 200);
  ARBOR.hourWheel = ARBOR.center;   // coaxial with the centre arbor
  ARBOR.secondsWheel = ARBOR.center; // coaxial too (indirect centre seconds)

  /* ---------------- gear registry --------------------------------------
   * key -> { cx, cy, teeth, mod, rot }   rot names the master phase slot.   */
  var GEARMAP = {};
  function gear(key, arbor, teeth, mod, rot) {
    var a = ARBOR[arbor];
    /* x/y for point maths, cx/cy for path generation */
    GEARMAP[key] = { key: key, x: a.x, y: a.y, cx: a.x, cy: a.y, teeth: teeth, mod: mod, rot: rot };
    return GEARMAP[key];
  }
  gear('barrel.wheel', 'barrel', TEETH.barrel, MODULE, 'barrel');
  gear('center.pinion', 'center', TEETH.centerPinion, MODULE, 'center');
  gear('center.wheel', 'center', TEETH.centerWheel, MODULE, 'center');
  gear('third.pinion', 'third', TEETH.thirdPinion, MODULE, 'third');
  gear('third.wheel', 'third', TEETH.thirdWheel, MODULE, 'third');
  gear('fourth.pinion', 'fourth', TEETH.fourthPinion, MODULE, 'fourth');
  gear('fourth.wheel', 'fourth', TEETH.fourthWheel, MODULE, 'fourth');
  gear('escape.pinion', 'escape', TEETH.escapePinion, MODULE, 'escape');
  gear('escape.wheel', 'escape', TEETH.escapeWheel, ESC_MODULE, 'escape');
  gear('cannon', 'center', TEETH.cannon, MODULE, 'cannon');
  gear('minuteWheel.wheel', 'minuteWheel', TEETH.minuteWheel, MODULE, 'minuteWheel');
  gear('minuteWheel.pinion', 'minuteWheel', TEETH.minutePinion, MODULE, 'minuteWheel');
  gear('hourWheel', 'hourWheel', TEETH.hourWheel, MODULE, 'hourWheel');
  gear('compound.pinion', 'compound', TEETH.compoundPinion, MODULE, 'compound');
  gear('compound.wheel', 'compound', TEETH.compoundWheel, MODULE, 'compound');
  gear('seconds.wheel', 'secondsWheel', TEETH.secondsWheel, MODULE, 'secondsWheel');

  /* ---------------- meshing pairs (driver -> driven) ------------------- */
  var MESHES = [
    { a: 'barrel.wheel', b: 'center.pinion' },
    { a: 'center.wheel', b: 'third.pinion' },
    { a: 'third.wheel', b: 'fourth.pinion' },
    { a: 'fourth.wheel', b: 'escape.pinion' },
    { a: 'fourth.wheel', b: 'compound.pinion' },
    { a: 'compound.wheel', b: 'seconds.wheel' },
    { a: 'cannon', b: 'minuteWheel.wheel' },
    { a: 'minuteWheel.pinion', b: 'hourWheel' }
  ];

  /* ---------------- master phase --------------------------------------
   * Q = number of beats elapsed (fractional during the impulse).
   * All angles are degrees, clockwise positive, at Q = 0 everything is 0. */
  var RATIO = {              // degrees of rotation per beat
    barrel: -1 / 320,
    center: 0.025,
    third: -0.2,
    fourth: 1.5,
    escape: -12,
    cannon: 0.025,
    minuteWheel: -1 / 180,
    hourWheel: 1 / 480,
    compound: -4.5,
    secondsWheel: 1.5
  };

  function beatPhase(Q) {
    var nn = Math.floor(Q);
    var p = Q - nn;
    /* the train is locked except during the lift / impulse window */
    var adv = smooth((p - LIFT_START) / (LIFT_END - LIFT_START));
    var q = nn + adv;
    var sign = (nn % 2 === 0) ? 1 : -1;
    /* pallet fork: snaps to the other banking during the same window */
    var t = smooth(p / LIFT_END);
    var fork = PALLET_AMPLITUDE * sign * (2 * t - 1);
    /* balance oscillates freely, one full beat per half period */
    var balance = BALANCE_AMPLITUDE * Math.sin(Math.PI * Q);
    return { n: nn, p: p, q: q, sign: sign, fork: fork, balance: balance, adv: adv };
  }

  /* hands are pressed on with a fixed offset; the classic 10:10:30 pose */
  var BASE_HOURS = 10, BASE_MIN = 10, BASE_SEC = 30;
  var HAND_OFFSET = {
    hour: 30 * (BASE_HOURS + BASE_MIN / 60 + BASE_SEC / 3600),
    minute: 6 * (BASE_MIN + BASE_SEC / 60),
    second: 6 * BASE_SEC
  };

  function state(Q) {
    var b = beatPhase(Q);
    var q = b.q;
    var s = {
      beats: Q, lockedBeats: b.n, beatFrac: b.p, lift: b.adv,
      barrel: RATIO.barrel * q,
      center: RATIO.center * q,
      third: RATIO.third * q,
      fourth: RATIO.fourth * q,
      escape: RATIO.escape * q,
      cannon: RATIO.cannon * q,
      minuteWheel: RATIO.minuteWheel * q,
      hourWheel: RATIO.hourWheel * q,
      compound: RATIO.compound * q,
      secondsWheel: RATIO.secondsWheel * q,
      pallet: b.fork,
      balance: b.balance,
      hourHand: HAND_OFFSET.hour + RATIO.hourWheel * q,
      minuteHand: HAND_OFFSET.minute + RATIO.cannon * q,
      secondHand: HAND_OFFSET.second + RATIO.secondsWheel * q,
      /* mainspring state: unwinds as the watch runs, reset by winding */
      elapsedSeconds: q / BEATS_PER_SEC,
      wind: 1
    };
    return s;
  }

  /* power reserve: fraction of the mainspring left, and a hard stop at empty */
  function windAt(Q, woundAt) {
    return clamp(1 - (Q - woundAt) / FULL_WIND_BEATS, 0, 1);
  }
  function isRunning(Q, woundAt) { return windAt(Q, woundAt) > 0.0005; }

  /* ---------------- time formatting ------------------------------------ */
  function clockText(seconds) {
    var t = Math.floor(seconds);
    var h = Math.floor(t / 3600) % 12; if (h === 0) h = 12;
    var m = Math.floor(t / 60) % 60;
    var s = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function speedText(v) {
    if (v >= 100) return Math.round(v) + '\u00d7';
    if (v >= 10) return (Math.round(v * 10) / 10).toFixed(1) + '\u00d7';
    return v.toFixed(2) + '\u00d7';
  }

  /* slider <-> speed: logarithmic, 0.1x .. 600x */
  var SPEED_MIN = 0.1, SPEED_MAX = 600;
  function sliderToSpeed(u) {
    var lo = Math.log(SPEED_MIN), hi = Math.log(SPEED_MAX);
    return Math.exp(lo + (hi - lo) * clamp(u, 0, 1));
  }
  function speedToSlider(v) {
    var lo = Math.log(SPEED_MIN), hi = Math.log(SPEED_MAX);
    return clamp((Math.log(clamp(v, SPEED_MIN, SPEED_MAX)) - lo) / (hi - lo), 0, 1);
  }

  /* ---------------- mesh phase solving --------------------------------
   * A gear's teeth sit at  phase + rot + 360k/N  (degrees, screen frame).
   * For a mesh the RELATIVE condition must hold for all time: whenever the
   * driver presents a tooth on the line of centres, the driven gear presents
   * a gap there. In tooth units that is  uA(Q) + uB(Q) = whole number, and
   * because the two rotations are exactly -N_a/N_b of each other the Q terms
   * cancel, so fixing it once fixes it forever.
   *
   * A wheel may drive two pinions (the fourth wheel drives the escape pinion
   * and the seconds intermediate). Its own phase is therefore decided once
   * and every driven pinion is phased to it, never the other way round.
   * Gears that are not in any mesh (the escape wheel itself, which drives the
   * pallet jewels) keep a free phase.                                      */
  function phaseDrivenFromDriver(ph, m) {
    var A = GEARMAP[m.a], B = GEARMAP[m.b];
    var pA = 360 / A.teeth, pB = 360 / B.teeth, phi = deg2(A, B);
    ph[m.b] = mod(phi + 180 - pB / 2 - pB * ((ph[m.a] - phi) / pA), pB);
  }
  function phaseDriverFromDriven(ph, m) {
    var A = GEARMAP[m.a], B = GEARMAP[m.b];
    var pA = 360 / A.teeth, pB = 360 / B.teeth, phi = deg2(A, B);
    ph[m.a] = mod(phi - pA * ((ph[m.b] + pB / 2 - phi - 180) / pB), pA);
  }
  function solvePhases() {
    var ph = {};
    MESHES.forEach(function (m) {
      var A = GEARMAP[m.a], B = GEARMAP[m.b];
      if (ph[m.a] === undefined && ph[m.b] === undefined) {
        ph[m.a] = mod(deg2(A, B), 360 / A.teeth);   // free choice, seeds the pair
      }
      if (ph[m.a] !== undefined && ph[m.b] === undefined) phaseDrivenFromDriver(ph, m);
      else if (ph[m.b] !== undefined && ph[m.a] === undefined) phaseDriverFromDriven(ph, m);
    });
    /* escape wheel: chosen so a club tooth rests on the entry pallet at the
     * first lock (odd beats) and on the exit pallet at the second (even).  */
    ph['escape.wheel'] = 8;
    return ph;
  }
  var PHASE = solvePhases();

  /* ---------------- escapement geometry ------------------------------- */
  var ESC = (function () {
    var E = ARBOR.escape, P = ARBOR.pallet, B = ARBOR.balance;
    var toPallet = deg2(E, P);
    var jewelR = pitchR(TEETH.escapeWheel, ESC_MODULE) + 2.7; // on the tip circle
    var span = 18;                                            // 1.5 tooth pitches
    return {
      centre: E,
      pivot: P,
      balance: B,
      jewelRadius: jewelR,
      jewelAngle: [toPallet - span, toPallet + span],
      palletArm: dist(E, P) - jewelR,
      notchArm: dist(P, B) - 15,
      forkAxis: deg2(P, B),
      impulsePinR: 18,
      rollerR: 20,
      pinAngle: deg2(B, P)   // where the impulse pin sits when the balance is centred
    };
  })();

  /* ---------------- path generators ----------------------------------- */
  function arcTo(r, a0, a1, cx, cy) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  /* trapezoidal (clock-wheel) outline, one tooth at a time */
  function gearOutline(g) {
    var mod = g.mod, N = g.teeth, phase = PHASE[g.key] || 0;
    var rp = pitchR(N, mod);
    var add = mod * 0.95, ded = mod * 1.28;
    var rTip = rp + add, rRoot = Math.max(rp - ded, rp * 0.42);
    var pitch = 360 / N;
    var hRoot = pitch * 0.34, hTip = pitch * 0.155;
    var d = '', i, a0, p;
    for (i = 0; i < N; i++) {
      a0 = (phase + i * pitch) / DEG;
      var a1 = (phase + i * pitch - hRoot) / DEG;
      var a2 = (phase + i * pitch - hTip) / DEG;
      var a3 = (phase + i * pitch + hTip) / DEG;
      var a4 = (phase + i * pitch + hRoot) / DEG;
      var a5 = (phase + (i + 1) * pitch - hRoot) / DEG;
      var q1 = { x: g.cx + rRoot * Math.cos(a1), y: g.cy + rRoot * Math.sin(a1) };
      var q2 = { x: g.cx + rTip * Math.cos(a2), y: g.cy + rTip * Math.sin(a2) };
      var q3 = { x: g.cx + rTip * Math.cos(a3), y: g.cy + rTip * Math.sin(a3) };
      var q4 = { x: g.cx + rRoot * Math.cos(a4), y: g.cy + rRoot * Math.sin(a4) };
      var q5 = { x: g.cx + rRoot * Math.cos(a5), y: g.cy + rRoot * Math.sin(a5) };
      if (i === 0) d += 'M' + n(q1.x) + ' ' + n(q1.y);
      d += 'L' + n(q2.x) + ' ' + n(q2.y);
      d += 'A' + n(rTip) + ' ' + n(rTip) + ' 0 0 1 ' + n(q3.x) + ' ' + n(q3.y);
      d += 'L' + n(q4.x) + ' ' + n(q4.y);
      d += 'A' + n(rRoot) + ' ' + n(rRoot) + ' 0 0 1 ' + n(q5.x) + ' ' + n(q5.y);
      p = a5;
    }
    d += 'Z';
    return { d: d, rp: rp, rTip: rTip, rRoot: rRoot };
  }

  /* openworked wheel: toothed ring (even-odd) + tapered crossings */
  function wheelPath(g, opts) {
    opts = opts || {};
    var out = gearOutline(g);
    var rimW = clamp(out.rp * (opts.rimScale || 0.085), 3.2, 10.5);
    var rimIn = Math.min(out.rRoot - 1.2, out.rp - rimW);
    var hubR = clamp(out.rp * (opts.hubScale || 0.17), 7, 17);
    var boreR = Math.max(hubR * 0.34, 3);
    var spokes = opts.spokes || 5;
    var rot = PHASE[g.key] || 0;

    /* ring: outline + inner circle, filled even-odd */
    var ring = out.d + 'M' + n(g.cx + rimIn) + ' ' + n(g.cy) +
      'A' + n(rimIn) + ' ' + n(rimIn) + ' 0 1 0 ' + n(g.cx - rimIn) + ' ' + n(g.cy) +
      'A' + n(rimIn) + ' ' + n(rimIn) + ' 0 1 0 ' + n(g.cx + rimIn) + ' ' + n(g.cy) + 'Z';

    /* crossings */
    var sp = '';
    var wOut = (opts.spokeAngle || 0.055), wIn = (opts.spokeAngleIn || 0.30);
    for (var i = 0; i < spokes; i++) {
      var a = (rot + i * 360 / spokes) / DEG;
      var o1 = arcTo(rimIn, a - wOut, a + wOut, g.cx, g.cy);
      var i1 = arcTo(hubR, a + wIn, a - wIn, g.cx, g.cy);
      sp += 'M' + n(o1.x0) + ' ' + n(o1.y0) +
        'A' + n(rimIn) + ' ' + n(rimIn) + ' 0 0 1 ' + n(o1.x1) + ' ' + n(o1.y1) +
        'L' + n(i1.x0) + ' ' + n(i1.y0) +
        'A' + n(hubR) + ' ' + n(hubR) + ' 0 0 1 ' + n(i1.x1) + ' ' + n(i1.y1) + 'Z';
    }
    /* hub ring */
    var hub = 'M' + n(g.cx + hubR) + ' ' + n(g.cy) +
      'A' + n(hubR) + ' ' + n(hubR) + ' 0 1 0 ' + n(g.cx - hubR) + ' ' + n(g.cy) +
      'A' + n(hubR) + ' ' + n(hubR) + ' 0 1 0 ' + n(g.cx + hubR) + ' ' + n(g.cy) +
      'M' + n(g.cx + boreR) + ' ' + n(g.cy) +
      'A' + n(boreR) + ' ' + n(boreR) + ' 0 1 0 ' + n(g.cx - boreR) + ' ' + n(g.cy) +
      'A' + n(boreR) + ' ' + n(boreR) + ' 0 1 0 ' + n(g.cx + boreR) + ' ' + n(g.cy) + 'Z';
    return { ring: ring, spokes: sp, hub: hub, rp: out.rp, rTip: out.rTip, rRoot: out.rRoot, hubR: hubR, boreR: boreR, rimIn: rimIn };
  }

  /* club-tooth escape wheel: steep leading face, club tip, long trailing slope */
  function escapeWheelPath(g) {
    var N = g.teeth, phase = PHASE[g.key] || 0;
    var rp = pitchR(N, g.mod);
    var rTip = rp + g.mod * 0.98, rRoot = rp - g.mod * 1.12;
    var d = '', i;
    for (i = 0; i < N; i++) {
      var a = phase + i * 360 / N;
      var lead = a - 11, tip0 = a - 4.5, tip1 = a + 2.5, tail = a + 14;
      var pts = [
        [rRoot, lead], [rTip, tip0], [rTip, tip1]
      ];
      if (i === 0) d += 'M' + pt(g, rRoot, lead);
      d += 'L' + pt(g, rTip, tip0);
      d += 'A' + n(rTip) + ' ' + n(rTip) + ' 0 0 1 ' + pt(g, rTip, tip1);
      /* concave back of the tooth */
      var c = pt(g, rRoot + g.mod * 0.75, a + 8.5);
      d += 'Q' + c + ' ' + pt(g, rRoot, tail);
      /* run along the root circle to the next tooth */
      d += 'A' + n(rRoot) + ' ' + n(rRoot) + ' 0 0 1 ' + pt(g, rRoot, lead + 360 / N);
    }
    d += 'Z';
    /* three lightening holes as an even-odd sub-path */
    var hubR = rp * 0.22, holeR = rp * 0.24, hr = rp * 0.56;
    d += circleSub(g.cx, g.cy, hubR);
    for (i = 0; i < 3; i++) {
      var ang = (phase + i * 120 + 60) / DEG;
      d += circleSub(g.cx + hr * Math.cos(ang), g.cy + hr * Math.sin(ang), holeR);
    }
    return { d: d, rp: rp, rTip: rTip, rRoot: rRoot, hubR: hubR };
  }
  function pt(g, r, deg) {
    var a = deg / DEG;
    return n(g.cx + r * Math.cos(a)) + ' ' + n(g.cy + r * Math.sin(a));
  }
  function circleSub(cx, cy, r) {
    return 'M' + n(cx + r) + ' ' + n(cy) +
      'A' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(cx - r) + ' ' + n(cy) +
      'A' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(cx + r) + ' ' + n(cy) + 'Z';
  }

  /* balance wheel: rim + two crossings + timing screws + roller */
  function balancePath(g) {
    var rimOut = g.r, rimIn = g.r - 15, hubR = 13, d = '';
    d += 'M' + n(g.cx + rimOut) + ' ' + n(g.cy) +
      'A' + n(rimOut) + ' ' + n(rimOut) + ' 0 1 0 ' + n(g.cx - rimOut) + ' ' + n(g.cy) +
      'A' + n(rimOut) + ' ' + n(rimOut) + ' 0 1 0 ' + n(g.cx + rimOut) + ' ' + n(g.cy) + 'Z';
    d += circleSub(g.cx, g.cy, rimIn);
    var sp = '';
    for (var i = 0; i < 2; i++) {
      var a = (i * 180) / DEG;
      var o1 = arcTo(rimIn, a - 0.075, a + 0.075, g.cx, g.cy);
      var i1 = arcTo(hubR, a + 0.42, a - 0.42, g.cx, g.cy);
      sp += 'M' + n(o1.x0) + ' ' + n(o1.y0) +
        'A' + n(rimIn) + ' ' + n(rimIn) + ' 0 0 1 ' + n(o1.x1) + ' ' + n(o1.y1) +
        'L' + n(i1.x0) + ' ' + n(i1.y0) +
        'A' + n(hubR) + ' ' + n(hubR) + ' 0 0 1 ' + n(i1.x1) + ' ' + n(i1.y1) + 'Z';
    }
    return { rim: d, spokes: sp, hubR: hubR, rimOut: rimOut, rimIn: rimIn };
  }

  /* pallet fork in local coordinates: +x points at the balance staff */
  function palletPath() {
    var na = ESC.notchArm, pa = ESC.palletArm;
    var d = '';
    /* main body: pivot boss -> notch arm, and the short pallet arm */
    d += 'M0 ' + n(-6.5);
    d += 'L' + n(na - 12) + ' ' + n(-4.6);
    d += 'L' + n(na - 3) + ' ' + n(-6.2);           // left horn
    d += 'L' + n(na) + ' ' + n(-4.4);
    d += 'L' + n(na - 2) + ' ' + n(-1.6);           // notch
    d += 'L' + n(na) + ' ' + n(4.4);
    d += 'L' + n(na - 3) + ' ' + n(6.2);
    d += 'L' + n(na - 12) + ' ' + n(4.6);
    d += 'L0 ' + n(6.5) + 'Z';
    /* pallet arm, wide at the jewels */
    d += 'M0 ' + n(-7.5);
    d += 'L' + n(-pa * 0.82) + ' ' + n(-11);
    d += 'L' + n(-pa) + ' ' + n(-8);
    d += 'L' + n(-pa) + ' ' + n(8);
    d += 'L' + n(-pa * 0.82) + ' ' + n(11);
    d += 'L0 ' + n(7.5) + 'Z';
    return { d: d, notchArm: na, palletArm: pa };
  }

  /* spiral generator used for both springs.
   * radius grows with s, angle interpolates between the two end angles. */
  function spiralPath(cx, cy, rIn, rOut, aInner, aOuter, opts) {
    opts = opts || {};
    var steps = opts.steps || Math.max(48, Math.round(Math.abs(aOuter - aInner) / 360 * 22));
    var exp = opts.exp || 1;
    var d = '';
    for (var i = 0; i <= steps; i++) {
      var s = i / steps;
      var r = rIn + (rOut - rIn) * Math.pow(s, exp);
      var a = (aInner + (aOuter - aInner) * s) / DEG;
      var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      d += (i === 0 ? 'M' : 'L') + n(x) + ' ' + n(y);
    }
    return d;
  }

  /* mainspring: coil count and bunching follow the winding state.
   * Drawn in barrel-local coordinates (the barrel group supplies rotation). */
  function mainspringPath(st, geo) {
    var wind = st.wind;
    var turns = 6.5 + 6.5 * wind;             // 6.5 .. 13 coils
    var aInner = -st.barrel + (geo.arborAngle || 0);
    var aOuter = aInner + 360 * turns;
    return spiralPath(geo.cx, geo.cy, geo.rIn, geo.rOut, aInner, aOuter, {
      exp: 1.45 - 0.45 * wind,                 // tightly wound bunching near the arbor
      steps: Math.round(turns * 26)
    });
  }

  /* hairspring: inner end rides the balance, outer end is pinned to the cock */
  function hairspringPath(st, geo) {
    var turns = 12;
    var aInner = st.balance + geo.innerAngle;
    var aOuter = geo.outerAngle;
    /* keep the outer end where it is, unwrap towards the inner end */
    var span = aOuter - aInner;
    return spiralPath(geo.cx, geo.cy, geo.rIn, geo.rOut, aInner, aInner + span, {
      exp: 1,
      steps: Math.round(turns * 26)
    });
  }

  var MAINSPRING_GEO = {
    cx: ARBOR.barrel.x, cy: ARBOR.barrel.y,
    rIn: 22, rOut: pitchR(TEETH.barrel, MODULE) - 20,
    arborAngle: 0
  };
  var HAIRSPRING_GEO = {
    cx: ARBOR.balance.x, cy: ARBOR.balance.y,
    rIn: 24, rOut: 76,          // clears the roller (r 20), stays inside the rim
    innerAngle: 90, outerAngle: 150
  };

  /* ---------------- what the renderer must keep in sync ---------------- */
  var ROTORS = [
    { id: 'rot-barrel', key: 'barrel', arbor: 'barrel' },
    { id: 'rot-center', key: 'center', arbor: 'center' },
    { id: 'rot-third', key: 'third', arbor: 'third' },
    { id: 'rot-fourth', key: 'fourth', arbor: 'fourth' },
    { id: 'rot-escape', key: 'escape', arbor: 'escape' },
    { id: 'rot-pallet', key: 'pallet', arbor: 'pallet' },
    { id: 'rot-balance', key: 'balance', arbor: 'balance' },
    { id: 'rot-cannon', key: 'cannon', arbor: 'center' },
    { id: 'rot-minuteWheel', key: 'minuteWheel', arbor: 'minuteWheel' },
    { id: 'rot-hourWheel', key: 'hourWheel', arbor: 'hourWheel' },
    { id: 'rot-compound', key: 'compound', arbor: 'compound' },
    { id: 'rot-secondsWheel', key: 'secondsWheel', arbor: 'secondsWheel' },
    { id: 'hand-hour', key: 'hourHand', arbor: 'center', local: true },
    { id: 'hand-minute', key: 'minuteHand', arbor: 'center', local: true },
    { id: 'hand-second', key: 'secondHand', arbor: 'center', local: true }
  ];

  /* ---------------- UI layout (shared by builder and runtime) ---------- */
  var UI = {
    width: 1240, height: 920,
    watch: { cx: CX, cy: CY, caseR: 400, dialR: 376, chapterR: 288 },
    panel: { x: 920, w: 285, x1: 1205 },
    readout: { y: 40, h: 168 },
    legend: { y: 226, h: 350 },
    controls: { y: 596, h: 284 },
    play: { cx: 962, cy: 648, r: 25 },
    speedLabel: { x: 1002, y: 656 },
    slider: { x0: 950, x1: 1185, y: 706, r: 11 },
    presets: [
      { v: 0.25, label: '0.25\u00d7' }, { v: 1, label: '1\u00d7' },
      { v: 10, label: '10\u00d7' }, { v: 60, label: '60\u00d7' }
    ],
    wind: { x: 950, y: 792, w: 118, h: 30 },
    hint: { x: 950, y: 852 }
  };

  var MODEL = {
    UI: UI,
    TAU: TAU, DEG: DEG,
    MODULE: MODULE, ESC_MODULE: ESC_MODULE,
    BEATS_PER_SEC: BEATS_PER_SEC,
    BEATS_PER_ESCAPE_REV: BEATS_PER_ESCAPE_REV,
    FULL_WIND_BEATS: FULL_WIND_BEATS,
    BALANCE_AMPLITUDE: BALANCE_AMPLITUDE,
    PALLET_AMPLITUDE: PALLET_AMPLITUDE,
    TEETH: TEETH, ARBOR: ARBOR, GEARMAP: GEARMAP, MESHES: MESHES,
    PHASE: PHASE, RATIO: RATIO, ESC: ESC, ROTORS: ROTORS,
    CX: CX, CY: CY,
    BASE_TIME: BASE_HOURS * 3600 + BASE_MIN * 60 + BASE_SEC,
    HAND_OFFSET: HAND_OFFSET,
    MAINSPRING_GEO: MAINSPRING_GEO, HAIRSPRING_GEO: HAIRSPRING_GEO,
    SPEED_MIN: SPEED_MIN, SPEED_MAX: SPEED_MAX,
    state: state, beatPhase: beatPhase, windAt: windAt, isRunning: isRunning,
    clockText: clockText, speedText: speedText,
    sliderToSpeed: sliderToSpeed, speedToSlider: speedToSlider,
    pitchR: pitchR, meshD: meshD, deg2: deg2, dist: dist, mod: mod, clamp: clamp,
    gearOutline: gearOutline, wheelPath: wheelPath, escapeWheelPath: escapeWheelPath,
    balancePath: balancePath, palletPath: palletPath, spiralPath: spiralPath,
    mainspringPath: mainspringPath, hairspringPath: hairspringPath,
    circleSub: circleSub, n: n
  };

  global.WatchModel = MODEL;
  if (typeof module !== 'undefined' && module.exports) module.exports = MODEL;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* Offline verification for the linkage designer kinematics core.
 * Run: node run_tests.js   (no dependencies, no network)
 *
 * Checks:
 *  1. circle/circle + circle/track intersection math
 *  2. four-bar linkage: 2 full crank revolutions keep every rigid link
 *     exact, the crank exact, the branch stable (closes the loop)
 *  3. crank-slider: rod exact, slider never leaves its rail, true stroke
 *  4. pose capture/restore round-trip
 *  5. save/reload round-trip through plain JSON
 */
'use strict';
const S = require('./solver.js');

let passed = 0, failed = 0;
function ok(cond, name, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

/* ---- builders mirror the examples shipped in app.js ---- */
function buildFourBar() {
  const mech = { joints: [], links: [], tracks: [],
    driver: { linkId: 'L1', rpm: 24, dir: 1, angle: 0 } };
  const P0 = { id: 'J1', name: 'P0', type: 'fixed', x: -150, y: 60, trackId: null };
  const P1 = { id: 'J2', name: 'P1', type: 'fixed', x: 150, y: 60, trackId: null };
  const th = -60 * Math.PI / 180;
  const A = { id: 'J3', name: 'A', type: 'free',
    x: P0.x + 70 * Math.cos(th), y: P0.y + 70 * Math.sin(th), trackId: null };
  const sols = S.circleCircle(A.x, A.y, 260, P1.x, P1.y, 180)
    .sort((p, q) => p.y - q.y);
  const B = { id: 'J4', name: 'B', type: 'free', x: sols[0].x, y: sols[0].y, trackId: null };
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const vx = B.x - A.x, vy = B.y - A.y, n = Math.hypot(vx, vy);
  const C = { id: 'J5', name: 'C', type: 'free',
    x: mx + (-vy / n) * 55, y: my + (vx / n) * 55, trackId: null };
  mech.joints.push(P0, P1, A, B, C);
  mech.links.push(
    { id: 'L1', name: 'Crank', a: 'J1', b: 'J3', length: 70 },
    { id: 'L2', name: 'Coupler', a: 'J3', b: 'J4', length: 260 },
    { id: 'L3', name: 'Rocker', a: 'J2', b: 'J4', length: 180 },
    { id: 'L4', name: 'ArmA', a: 'J3', b: 'J5', length: S.dist(A.x, A.y, C.x, C.y) },
    { id: 'L5', name: 'ArmB', a: 'J4', b: 'J5', length: S.dist(B.x, B.y, C.x, C.y) }
  );
  mech.driver.angle = th;
  return mech;
}

function buildCrankSlider() {
  const mech = { joints: [], links: [],
    tracks: [{ id: 'T1', name: 'Rail', x1: -80, y1: 40, x2: 220, y2: 40 }],
    driver: { linkId: 'L1', rpm: 36, dir: 1, angle: 0 } };
  const P0 = { id: 'J1', name: 'P0', type: 'fixed', x: -170, y: 40, trackId: null };
  const th = -35 * Math.PI / 180;
  const A = { id: 'J2', name: 'A', type: 'free',
    x: P0.x + 60 * Math.cos(th), y: P0.y + 60 * Math.sin(th), trackId: null };
  const sols = S.circleTrack(A.x, A.y, 230, mech.tracks[0]).sort((p, q) => q.x - p.x);
  const Sl = { id: 'J3', name: 'S', type: 'slider', x: sols[0].x, y: sols[0].y, trackId: 'T1' };
  mech.joints.push(P0, A, Sl);
  mech.links.push(
    { id: 'L1', name: 'Crank', a: 'J1', b: 'J2', length: 60 },
    { id: 'L2', name: 'Rod', a: 'J2', b: 'J3', length: 230 }
  );
  mech.driver.angle = th;
  return mech;
}

function frameStep(mech, rpm, dir) {
  return S.step(mech, dir * rpm * 2 * Math.PI / 60 * (1 / 60), 120);
}

/* ---- 1. intersection primitives ---- */
console.log('[1] intersection math');
{
  const pts = S.circleCircle(0, 0, 5, 6, 0, 5).sort((p, q) => p.y - q.y);
  ok(pts.length === 2, 'circle-circle returns two points');
  ok(approx(pts[0].x, 3, 1e-9) && approx(pts[0].y, -4, 1e-9), 'circle-circle point 1 is (3,-4)', JSON.stringify(pts[0]));
  ok(approx(pts[1].x, 3, 1e-9) && approx(pts[1].y, 4, 1e-9), 'circle-circle point 2 is (3,4)', JSON.stringify(pts[1]));
  ok(S.circleCircle(0, 0, 1, 10, 0, 1).length === 0, 'separate circles do not intersect');
  const rail = { x1: -100, y1: 0, x2: 100, y2: 0 };
  const ct = S.circleTrack(0, 3, 5, rail).sort((p, q) => p.x - q.x);
  ok(ct.length === 2 && approx(ct[0].x, -4, 1e-9) && approx(ct[1].x, 4, 1e-9),
    'circle-track intersection', JSON.stringify(ct));
  ok(S.circleTrack(0, 6, 5, rail).length === 0, 'circle missing the rail is empty');
}

/* ---- 2. four-bar: two full revolutions ---- */
console.log('[2] four-bar linkage, 2 crank revolutions');
{
  const mech = buildFourBar();
  S.solve(mech, [], 120);
  const e0 = S.errors(mech);
  ok(e0.maxLinkErr < 1e-9, 'initial assembly is exact', 'err=' + e0.maxLinkErr);
  const start = {};
  mech.joints.forEach(j => { start[j.id] = { x: j.x, y: j.y }; });
  let maxErr = 0, crankErr = 0;
  let minBy = 1e9, maxBy = -1e9;
  const frames = Math.round(2 * 60 * 60 / 24); // 2 revs at 24 rpm, 60 fps
  for (let i = 0; i < frames; i++) {
    const r = frameStep(mech, 24, 1);
    if (!r.ok) { ok(false, 'driver step ok'); break; }
    const e = S.errors(mech);
    if (e.maxLinkErr > maxErr) maxErr = e.maxLinkErr;
    const d = S.driverEnds(mech);
    const dc = S.dist(d.pivot.x, d.pivot.y, d.crank.x, d.crank.y);
    crankErr = Math.max(crankErr, Math.abs(dc - d.link.length));
    const B = S.jointById(mech, 'J4');
    minBy = Math.min(minBy, B.y); maxBy = Math.max(maxBy, B.y);
  }
  ok(maxErr < 1e-6, 'all rigid links preserved over 2 revolutions', 'maxErr=' + maxErr);
  ok(crankErr < 1e-9, 'drive crank length bit-exact', 'err=' + crankErr);
  ok(maxBy - minBy > 5, 'rocker actually swings', 'range=' + (maxBy - minBy));
  let closure = 0;
  mech.joints.forEach(j => {
    closure = Math.max(closure, S.dist(j.x, j.y, start[j.id].x, start[j.id].y));
  });
  ok(closure < 1e-2, 'mechanism closes the loop after full revolutions', 'drift=' + closure);
}

/* ---- 3. crank-slider ---- */
console.log('[3] crank-slider mechanism, 2 revolutions');
{
  const mech = buildCrankSlider();
  let maxLink = 0, maxRail = 0, minSx = 1e9, maxSx = -1e9;
  const frames = Math.round(2 * 60 * 60 / 36);
  for (let i = 0; i < frames; i++) {
    frameStep(mech, 36, 1);
    const e = S.errors(mech);
    maxLink = Math.max(maxLink, e.maxLinkErr);
    maxRail = Math.max(maxRail, e.maxSliderErr);
    const sl = S.jointById(mech, 'J3');
    minSx = Math.min(minSx, sl.x); maxSx = Math.max(maxSx, sl.x);
  }
  ok(maxLink < 1e-6, 'crank + rod lengths preserved', 'maxErr=' + maxLink);
  ok(maxRail < 1e-9, 'slider never leaves its rail', 'off-rail=' + maxRail);
  const stroke = maxSx - minSx;
  ok(Math.abs(stroke - 120) < 0.5, 'in-line slider stroke is 2x crank (~120)', 'stroke=' + stroke);
}

/* ---- 4. capture / restore ---- */
console.log('[4] pose capture and restore');
{
  const mech = buildFourBar();
  const snap = S.capturePose(mech);
  frameStep(mech, 24, 1);
  const moved = S.dist(mech.joints[2].x, mech.joints[2].y, snap.joints[mech.joints[2].id].x, snap.joints[mech.joints[2].id].y);
  ok(moved > 0.01, 'simulation moves the mechanism', 'moved=' + moved);
  S.restorePose(mech, snap);
  let back = 0;
  mech.joints.forEach(j => {
    back = Math.max(back, S.dist(j.x, j.y, snap.joints[j.id].x, snap.joints[j.id].y));
  });
  ok(back === 0, 'reset restores the exact initial pose', 'residual=' + back);
}

/* ---- 5. save / reload round-trip through JSON ---- */
console.log('[5] save / reload round-trip');
{
  const mech = buildCrankSlider();
  for (let i = 0; i < 30; i++) frameStep(mech, 36, 1);
  const snap = S.capturePose(mech);
  const file = JSON.parse(JSON.stringify({
    app: 'linkage-designer', version: 1, name: 't',
    joints: mech.joints, links: mech.links, tracks: mech.tracks,
    driver: mech.driver, initial: snap
  }));
  const re = { joints: file.joints, links: file.links, tracks: file.tracks, driver: file.driver };
  S.solve(re, [], 120);
  const e = S.errors(re);
  ok(e.maxErr < 1e-6, 'reloaded mechanism still assembles exactly', 'maxErr=' + e.maxErr);
  ok(re.driver.linkId === 'L1' && re.driver.rpm === 36, 'motor settings survive reload');
  ok(file.initial.joints.J3 && Math.abs(file.initial.joints.J3.x - snap.joints.J3.x) === 0,
    'reset pose survives reload');
}

/* ---- 6. open chain + manual posing ---- */
console.log('[6] open chain and manual posing');
{
  const mech = { joints: [
      { id: 'J1', name: 'P', type: 'fixed', x: 0, y: 0, trackId: null },
      { id: 'J2', name: 'A', type: 'free', x: 100, y: 0, trackId: null },
      { id: 'J3', name: 'B', type: 'free', x: 100, y: 100, trackId: null }
    ],
    links: [
      { id: 'L1', name: 'a', a: 'J1', b: 'J2', length: 100 },
      { id: 'L2', name: 'b', a: 'J2', b: 'J3', length: 100 }
    ],
    tracks: [], driver: { linkId: null, rpm: 30, dir: 1, angle: 0 } };
  // Drag the tip as a user would; the chain must follow without stretching.
  const tip = S.jointById(mech, 'J3');
  tip.x = 40; tip.y = 160;
  S.solve(mech, ['J3'], 120);
  const e = S.errors(mech);
  ok(e.maxLinkErr < 1e-6, 'dragged open chain keeps exact lengths', 'maxErr=' + e.maxLinkErr);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

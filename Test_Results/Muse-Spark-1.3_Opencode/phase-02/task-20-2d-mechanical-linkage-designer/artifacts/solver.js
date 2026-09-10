/* 2D Linkage Designer - kinematics core (no DOM, no dependencies).
 *
 * Mechanism shape (plain JSON-serialisable objects):
 *   mech = {
 *     joints: [{ id, name, type: 'fixed'|'free'|'slider', x, y, trackId }],
 *     links:  [{ id, name, a, b, length }],   // a,b are joint ids, length is exact
 *     tracks: [{ id, name, x1, y1, x2, y2 }], // slider rails (infinite lines)
 *     driver: { linkId, rpm, dir, angle }     // angle in radians (screen coords, +y down)
 *   }
 *
 * Solver strategy: position-based constraint projection.
 *  - The driving crank endpoint is pinned to pivot + L*(cos a, sin a).
 *  - All other distance constraints and slider rail constraints are
 *    iteratively projected until lengths are exact (to numerical precision).
 *  - Sub-stepping keeps each crank increment small so the correct
 *    assembly branch is preserved through full revolutions.
 */
(function (root) {
  'use strict';

  var MAX_STEP_RAD = 0.035; // ~2 degrees per sub-step
  var DEFAULT_ITERS = 120;

  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function jointById(mech, id) {
    for (var i = 0; i < mech.joints.length; i++) {
      if (mech.joints[i].id === id) return mech.joints[i];
    }
    return null;
  }

  function linkById(mech, id) {
    for (var i = 0; i < mech.links.length; i++) {
      if (mech.links[i].id === id) return mech.links[i];
    }
    return null;
  }

  function trackById(mech, id) {
    for (var i = 0; i < mech.tracks.length; i++) {
      if (mech.tracks[i].id === id) return mech.tracks[i];
    }
    return null;
  }

  // Unit direction + anchor of a track's infinite line. Degenerate -> horizontal.
  function trackLine(track) {
    var dx = track.x2 - track.x1, dy = track.y2 - track.y1;
    var n = Math.sqrt(dx * dx + dy * dy);
    if (n < 1e-9) return { px: track.x1, py: track.y1, dx: 1, dy: 0 };
    return { px: track.x1, py: track.y1, dx: dx / n, dy: dy / n };
  }

  function projectToLine(x, y, line) {
    var rx = x - line.px, ry = y - line.py;
    var t = rx * line.dx + ry * line.dy;
    return { x: line.px + line.dx * t, y: line.py + line.dy * t, t: t };
  }

  function distToTrack(x, y, track) {
    var p = projectToLine(x, y, trackLine(track));
    return dist(x, y, p.x, p.y);
  }

  // Intersection(s) of circles (x0,y0,r0) and (x1,y1,r1). Returns [] or [p] or [pA,pB].
  function circleCircle(x0, y0, r0, x1, y1, r1) {
    var dx = x1 - x0, dy = y1 - y0;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-12 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return [];
    var a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    var h2 = r0 * r0 - a * a;
    var h = Math.sqrt(Math.max(0, h2));
    var xm = x0 + (a * dx) / d, ym = y0 + (a * dy) / d;
    if (h < 1e-9) return [{ x: xm, y: ym }];
    var ox = (-dy * h) / d, oy = (dx * h) / d;
    return [
      { x: xm + ox, y: ym + oy },
      { x: xm - ox, y: ym - oy }
    ];
  }

  // Intersection(s) of circle (cx,cy,r) with the infinite line of a track.
  function circleTrack(cx, cy, r, track) {
    var line = trackLine(track);
    var p = projectToLine(cx, cy, line);
    var d = dist(cx, cy, p.x, p.y);
    if (d > r + 1e-9) return [];
    var h = Math.sqrt(Math.max(0, r * r - d * d));
    if (h < 1e-9) return [{ x: p.x, y: p.y }];
    return [
      { x: p.x + line.dx * h, y: p.y + line.dy * h },
      { x: p.x - line.dx * h, y: p.y - line.dy * h }
    ];
  }

  function pinnedSetFor(mech, extraPinned) {
    var s = {};
    for (var i = 0; i < mech.joints.length; i++) {
      if (mech.joints[i].type === 'fixed') s[mech.joints[i].id] = true;
    }
    if (extraPinned) {
      for (var k = 0; k < extraPinned.length; k++) s[extraPinned[k]] = true;
    }
    return s;
  }

  // One full projection pass over every constraint.
  function iterateOnce(mech, map, pinned) {
    var i, L, A, B, dx, dy, d, diff, wa, wb, ws;
    for (i = 0; i < mech.links.length; i++) {
      L = mech.links[i];
      A = map[L.a]; B = map[L.b];
      if (!A || !B) continue;
      wa = pinned[L.a] ? 0 : 1;
      wb = pinned[L.b] ? 0 : 1;
      ws = wa + wb;
      if (ws === 0) continue;
      dx = B.x - A.x; dy = B.y - A.y;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-12) {
        // Coincident points: separate along x so the solver can recover.
        dx = 1; dy = 0; d = 1;
        diff = -L.length / d;
      } else {
        diff = (d - L.length) / d;
      }
      A.x += dx * diff * (wa / ws);
      A.y += dy * diff * (wa / ws);
      B.x -= dx * diff * (wb / ws);
      B.y -= dy * diff * (wb / ws);
    }
    var J, T;
    for (i = 0; i < mech.joints.length; i++) {
      J = mech.joints[i];
      if (J.type !== 'slider' || pinned[J.id]) continue;
      T = map.__tracks[J.trackId];
      if (!T) continue;
      var p = projectToLine(J.x, J.y, trackLine(T));
      J.x = p.x; J.y = p.y;
    }
  }

  // Project all constraints. Mutates mech.joints in place.
  // extraPinned: array of joint ids held fixed during the solve.
  // iterations: number of projection sweeps.
  function solve(mech, extraPinned, iterations) {
    var iters = iterations == null ? DEFAULT_ITERS : iterations;
    var pinned = pinnedSetFor(mech, extraPinned);
    var map = {};
    var i;
    for (i = 0; i < mech.joints.length; i++) map[mech.joints[i].id] = mech.joints[i];
    map.__tracks = {};
    for (i = 0; i < mech.tracks.length; i++) map.__tracks[mech.tracks[i].id] = mech.tracks[i];
    for (i = 0; i < iters; i++) iterateOnce(mech, map, pinned);
    return pinned;
  }

  // Identify the crank link's pivot (fixed) and moving end. Returns null if invalid.
  function driverEnds(mech) {
    if (!mech.driver || !mech.driver.linkId) return null;
    var L = linkById(mech, mech.driver.linkId);
    if (!L) return null;
    var A = jointById(mech, L.a), B = jointById(mech, L.b);
    if (!A || !B) return null;
    if (A.type === 'fixed' && B.type !== 'fixed') return { link: L, pivot: A, crank: B };
    if (B.type === 'fixed' && A.type !== 'fixed') return { link: L, pivot: B, crank: A };
    return null;
  }

  function driverAngleFromGeometry(mech) {
    var d = driverEnds(mech);
    if (!d) return null;
    return Math.atan2(d.crank.y - d.pivot.y, d.crank.x - d.pivot.x);
  }

  // Place the crank endpoint exactly on its circle at angle `theta`, then solve.
  function poseDriver(mech, theta, iterations) {
    var d = driverEnds(mech);
    if (!d) { solve(mech, [], iterations); return false; }
    d.crank.x = d.pivot.x + d.link.length * Math.cos(theta);
    d.crank.y = d.pivot.y + d.link.length * Math.sin(theta);
    mech.driver.angle = theta;
    solve(mech, [d.crank.id], iterations);
    // Re-pin the crank exactly (projection of neighbours can nudge shared refs
    // only via their own copies -- joints are unique objects, so re-assert).
    d.crank.x = d.pivot.x + d.link.length * Math.cos(theta);
    d.crank.y = d.pivot.y + d.link.length * Math.sin(theta);
    return true;
  }

  // Advance the motor by dTheta radians, sub-stepping to preserve the branch.
  function step(mech, dTheta, iterations) {
    var d = driverEnds(mech);
    if (!d) { solve(mech, [], iterations); return { ok: false, reason: 'no-driver' }; }
    var n = Math.max(1, Math.ceil(Math.abs(dTheta) / MAX_STEP_RAD));
    var h = dTheta / n;
    var theta = mech.driver.angle;
    for (var i = 0; i < n; i++) {
      theta += h;
      poseDriver(mech, theta, iterations);
    }
    return { ok: true, substeps: n };
  }

  // Constraint residuals: rigid-link stretch + slider off-track distance.
  function errors(mech) {
    var out = { links: [], maxLinkErr: 0, maxLinkRel: 0, sliders: [], maxSliderErr: 0, maxErr: 0 };
    var i, A, B, actual, err;
    for (i = 0; i < mech.links.length; i++) {
      var L = mech.links[i];
      A = jointById(mech, L.a); B = jointById(mech, L.b);
      if (!A || !B) continue;
      actual = dist(A.x, A.y, B.x, B.y);
      err = Math.abs(actual - L.length);
      out.links.push({ id: L.id, nominal: L.length, actual: actual, err: err });
      if (err > out.maxLinkErr) out.maxLinkErr = err;
      var rel = L.length > 1e-12 ? err / L.length : err;
      if (rel > out.maxLinkRel) out.maxLinkRel = rel;
    }
    for (i = 0; i < mech.joints.length; i++) {
      var J = mech.joints[i];
      if (J.type !== 'slider') continue;
      var T = trackById(mech, J.trackId);
      if (!T) continue;
      err = distToTrack(J.x, J.y, T);
      out.sliders.push({ id: J.id, err: err });
      if (err > out.maxSliderErr) out.maxSliderErr = err;
    }
    out.maxErr = Math.max(out.maxLinkErr, out.maxSliderErr);
    out.assembled = out.maxLinkErr < 1 && out.maxSliderErr < 1;
    return out;
  }

  function capturePose(mech) {
    var pose = {};
    for (var i = 0; i < mech.joints.length; i++) {
      pose[mech.joints[i].id] = { x: mech.joints[i].x, y: mech.joints[i].y };
    }
    return { joints: pose, angle: mech.driver ? mech.driver.angle : 0 };
  }

  function restorePose(mech, snap) {
    if (!snap) return;
    for (var i = 0; i < mech.joints.length; i++) {
      var p = snap.joints[mech.joints[i].id];
      if (p) { mech.joints[i].x = p.x; mech.joints[i].y = p.y; }
    }
    if (mech.driver) mech.driver.angle = snap.angle || 0;
  }

  var api = {
    MAX_STEP_RAD: MAX_STEP_RAD,
    DEFAULT_ITERS: DEFAULT_ITERS,
    dist: dist,
    jointById: jointById,
    linkById: linkById,
    trackById: trackById,
    trackLine: trackLine,
    projectToLine: projectToLine,
    distToTrack: distToTrack,
    circleCircle: circleCircle,
    circleTrack: circleTrack,
    solve: solve,
    driverEnds: driverEnds,
    driverAngleFromGeometry: driverAngleFromGeometry,
    poseDriver: poseDriver,
    step: step,
    errors: errors,
    capturePose: capturePose,
    restorePose: restorePose
  };

  root.LinkageSolver = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

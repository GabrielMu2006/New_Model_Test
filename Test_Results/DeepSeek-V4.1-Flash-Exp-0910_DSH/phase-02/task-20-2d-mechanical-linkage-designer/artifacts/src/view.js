/**
 * Camera, coordinate conversion and hit testing.
 *
 * Pure geometry: no canvas, no DOM. The renderer and the pointer handling both
 * go through these helpers so what you click is exactly what you see.
 *
 * Screen space is y-down (canvas pixels); world space is y-up (millimetres).
 */

import { clamp, dist, distanceToSegment, projectOnLine } from './math.js';
import { JOINT_FIXED, JOINT_SLIDER } from './model.js';

export const HIT_RADIUS = 11; // pixels

export function createCamera(scale = 3.2, ox = 0, oy = 0) {
  return { scale, ox, oy };
}

export function cameraFromView(view, width, height) {
  return {
    scale: Number.isFinite(view?.scale) ? view.scale : 3.2,
    ox: Number.isFinite(view?.ox) ? view.ox : width / 2,
    oy: Number.isFinite(view?.oy) ? view.oy : height / 2,
  };
}

export function worldToScreen(camera, p) {
  return { x: p.x * camera.scale + camera.ox, y: -p.y * camera.scale + camera.oy };
}

export function screenToWorld(camera, p) {
  return { x: (p.x - camera.ox) / camera.scale, y: -(p.y - camera.oy) / camera.scale };
}

/** Convert a screen-space length (pixels) into world units. */
export function screenToWorldLength(camera, pixels) {
  return pixels / camera.scale;
}

export function panCamera(camera, dxPixels, dyPixels) {
  camera.ox += dxPixels;
  camera.oy += dyPixels;
  return camera;
}

/** Zoom around a screen point so the world point under it stays put. */
export function zoomCameraAt(camera, screenPoint, factor, limits = { min: 0.05, max: 400 }) {
  const before = screenToWorld(camera, screenPoint);
  const nextScale = clamp(camera.scale * factor, limits.min, limits.max);
  if (nextScale === camera.scale) return camera;
  camera.scale = nextScale;
  const after = worldToScreen(camera, before);
  camera.ox += screenPoint.x - after.x;
  camera.oy += screenPoint.y - after.y;
  return camera;
}

/** Bounding box of everything visible (joints + track endpoints). */
export function mechanismBounds(mech) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  };
  for (const j of mech.joints) include(j);
  for (const t of mech.tracks) {
    include(t.a);
    include(t.b);
  }
  for (const m of mech.motors) {
    const j = mech.joints.find((jj) => jj.id === m.jointId);
    if (j) include({ x: j.x + 30, y: j.y + 30 });
  }
  if (!Number.isFinite(minX)) return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

export function fitCameraToMechanism(camera, mech, width, height, padding = 70) {
  const b = mechanismBounds(mech);
  const bw = Math.max(b.maxX - b.minX, 1);
  const bh = Math.max(b.maxY - b.minY, 1);
  const availW = Math.max(width - padding * 2, 40);
  const availH = Math.max(height - padding * 2, 40);
  const scale = clamp(Math.min(availW / bw, availH / bh), 0.05, 400);
  camera.scale = scale;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  camera.ox = width / 2 - cx * scale;
  camera.oy = height / 2 + cy * scale;
  return camera;
}

/* ------------------------------------------------------------- hit testing */

/**
 * Find what is under the pointer.
 *
 * Priority: joints (they are the smallest and most numerous) → motors → tracks
 * → links. `tolerancePixels` widens the search for touch input.
 *
 * Returns `{ kind, id, distance, extra }` or null.
 */
export function hitTest(mech, screenPoint, camera, options = {}) {
  const tolerance = options.tolerancePixels != null ? options.tolerancePixels : HIT_RADIUS;
  const world = screenToWorld(camera, screenPoint);
  const worldTol = tolerance / camera.scale;
  let best = null;

  const consider = (candidate) => {
    if (!best || candidate.distance < best.distance) best = candidate;
  };

  // Joints
  for (const j of mech.joints) {
    const d = dist(world, j);
    const radiusWorld = (j.type === JOINT_FIXED ? 8 : 7) / camera.scale;
    if (d <= Math.max(radiusWorld, worldTol)) {
      consider({ kind: 'joint', id: j.id, distance: d, extra: { type: j.type } });
    }
  }
  if (best) return best;

  // Motor badges sit next to their joint
  for (const m of mech.motors) {
    const j = mech.joints.find((jj) => jj.id === m.jointId);
    if (!j) continue;
    const badge = { x: j.x + 26 / camera.scale, y: j.y + 26 / camera.scale };
    const d = dist(world, badge);
    if (d <= Math.max(10 / camera.scale, worldTol)) {
      consider({ kind: 'motor', id: m.id, distance: d });
    }
  }
  if (best) return best;

  // Tracks (the rail line, plus its endpoints for editing)
  for (const t of mech.tracks) {
    const d = distanceToSegment(world, t.a, t.b);
    if (d <= Math.max(4 / camera.scale, worldTol)) {
      consider({ kind: 'track', id: t.id, distance: d });
    }
  }
  if (best) return best;

  // Links
  for (const l of mech.links) {
    const ja = mech.joints.find((j) => j.id === l.a);
    const jb = mech.joints.find((j) => j.id === l.b);
    if (!ja || !jb) continue;
    const d = distanceToSegment(world, ja, jb);
    if (d <= Math.max(6 / camera.scale, worldTol)) {
      consider({ kind: 'link', id: l.id, distance: d });
    }
  }
  return best;
}

/** Track endpoint handle under the pointer (used by the track editor). */
export function hitTrackHandle(mech, screenPoint, camera, options = {}) {
  const tolerance = (options.tolerancePixels != null ? options.tolerancePixels : 10) / camera.scale;
  const world = screenToWorld(camera, screenPoint);
  let best = null;
  for (const t of mech.tracks) {
    for (const [key, p] of [
      ['a', t.a],
      ['b', t.b],
    ]) {
      const d = dist(world, p);
      if (d <= tolerance && (!best || d < best.distance)) {
        best = { kind: 'trackHandle', id: t.id, end: key, distance: d };
      }
    }
  }
  return best;
}

/** Nearest point on a track's infinite line, used when placing sliders. */
export function nearestTrack(mech, worldPoint, maxDistance = Infinity) {
  let best = null;
  for (const t of mech.tracks) {
    const l = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y);
    if (l < 1e-9) continue;
    const u = { x: (t.b.x - t.a.x) / l, y: (t.b.y - t.a.y) / l };
    const { point } = projectOnLine(worldPoint, t.a, u);
    const d = dist(worldPoint, point);
    if (d <= maxDistance && (!best || d < best.distance)) best = { track: t, point, distance: d };
  }
  return best;
}

export function snapPoint(p, gridSize, enabled) {
  if (!enabled || !(gridSize > 0)) return { x: p.x, y: p.y };
  return { x: Math.round(p.x / gridSize) * gridSize, y: Math.round(p.y / gridSize) * gridSize };
}

export function isSliderJoint(joint) {
  return joint && joint.type === JOINT_SLIDER;
}

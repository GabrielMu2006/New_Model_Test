/**
 * Mechanism data model.
 *
 * A mechanism is a plain serialisable object:
 *
 *   {
 *     version: 1,
 *     name:    "Four-bar linkage",
 *     units:   "mm",
 *     joints:  [{ id, type, x, y, home, name, trackId?, limits? }],
 *     links:   [{ id, a, b, length, name }],
 *     tracks:  [{ id, a, b, home, name, limits }],
 *     motors:  [{ id, jointId, linkId, omega, angle, angleHome, enabled }],
 *     view:    { scale, ox, oy, showGrid, showLabels, ... }
 *   }
 *
 * Joint types
 *   fixed     - pinned to the ground, never moves (a "fixed pivot")
 *   revolute  - free pin joint, connects links, moves with the mechanism
 *   slider    - pin joint constrained to stay on the line of a track
 *
 * Links are rigid bodies of an exact `length`; the solver enforces that length
 * at every step. Tracks are ground-fixed rails. A motor drives the orientation
 * of one link about one of its end joints.
 *
 * All functions mutate the mechanism in place unless documented otherwise, and
 * all of them are DOM-free so they can be unit-tested in Node.
 */

import { clone, dist, makeId, deepClone } from './math.js';

export const MODEL_VERSION = 1;

export const JOINT_FIXED = 'fixed';
export const JOINT_REVOLUTE = 'revolute';
export const JOINT_SLIDER = 'slider';

export const JOINT_TYPE_LABELS = {
  [JOINT_FIXED]: 'Fixed pivot',
  [JOINT_REVOLUTE]: 'Rotating joint',
  [JOINT_SLIDER]: 'Slider',
};

export function defaultView() {
  return {
    scale: 3.2,
    ox: 0,
    oy: 0,
    showGrid: true,
    showLabels: true,
    showDimensions: true,
    showTraces: true,
    snapToGrid: true,
    gridSize: 10,
  };
}

export function createMechanism(name = 'Untitled mechanism') {
  return {
    version: MODEL_VERSION,
    name,
    units: 'mm',
    joints: [],
    links: [],
    tracks: [],
    motors: [],
    view: defaultView(),
  };
}

/* ------------------------------------------------------------------ labels */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function nextJointName(mech) {
  const used = new Set(mech.joints.map((j) => j.name));
  for (let i = 0; i < 200; i++) {
    const base = LETTERS[i % 26] + (i >= 26 ? String(Math.floor(i / 26)) : '');
    if (!used.has(base)) return base;
  }
  return `J${mech.joints.length + 1}`;
}

function nextName(mech, list, prefix) {
  const used = new Set(list.map((item) => item.name));
  for (let i = 1; i < 999; i++) {
    const candidate = `${prefix}${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${prefix}${list.length + 1}`;
}

/* ------------------------------------------------------------------ joints */

export function addJoint(mech, options = {}) {
  const {
    type = JOINT_REVOLUTE,
    x = 0,
    y = 0,
    name,
    trackId = null,
    id = makeId('j'),
  } = options;
  const joint = {
    id,
    type,
    x,
    y,
    home: { x, y },
    name: name || nextJointName(mech),
    trackId: type === JOINT_SLIDER ? trackId : null,
  };
  mech.joints.push(joint);
  return joint;
}

export function addFixedPivot(mech, x, y, options = {}) {
  return addJoint(mech, { ...options, type: JOINT_FIXED, x, y });
}

export function addRevoluteJoint(mech, x, y, options = {}) {
  return addJoint(mech, { ...options, type: JOINT_REVOLUTE, x, y });
}

export function addSlider(mech, x, y, trackId, options = {}) {
  return addJoint(mech, { ...options, type: JOINT_SLIDER, x, y, trackId });
}

export function getJoint(mech, id) {
  return mech.joints.find((j) => j.id === id) || null;
}

export function jointIndex(mech, id) {
  return mech.joints.findIndex((j) => j.id === id);
}

/* ------------------------------------------------------------------- links */

export function addLink(mech, a, b, options = {}) {
  const ja = getJoint(mech, a);
  const jb = getJoint(mech, b);
  if (!ja || !jb) throw new Error('addLink: unknown joint');
  if (ja.id === jb.id) throw new Error('addLink: a link needs two different joints');
  let length = options.length;
  if (length == null) length = dist(ja, jb);
  if (!(length > 0)) {
    // Coincident joints: pick a nominal length so the model stays valid, the
    // geometry solver will pull the joints apart to satisfy it.
    length = 50;
  }
  const link = {
    id: options.id || makeId('l'),
    a: ja.id,
    b: jb.id,
    length,
    name: options.name || nextName(mech, mech.links, 'L'),
    kind: options.kind || 'rigid',
  };
  mech.links.push(link);
  return link;
}

export function getLink(mech, id) {
  return mech.links.find((l) => l.id === id) || null;
}

export function linksAtJoint(mech, jointId) {
  return mech.links.filter((l) => l.a === jointId || l.b === jointId);
}

export function otherEnd(link, jointId) {
  if (link.a === jointId) return link.b;
  if (link.b === jointId) return link.a;
  return null;
}

/** Distance between the two joints of a link, measured in the current pose. */
export function measureLink(mech, link) {
  const ja = getJoint(mech, link.a);
  const jb = getJoint(mech, link.b);
  if (!ja || !jb) return NaN;
  return dist(ja, jb);
}

/** Set the exact length of a rigid link (the solver moves joints to match). */
export function setLinkLength(mech, linkId, length) {
  const link = getLink(mech, linkId);
  if (!link) return false;
  if (!Number.isFinite(length) || length <= 0) return false;
  link.length = length;
  return true;
}

/* ------------------------------------------------------------------ tracks */

export function addTrack(mech, a, b, options = {}) {
  const p1 = { x: a.x, y: a.y };
  const p2 = { x: b.x, y: b.y };
  const track = {
    id: options.id || makeId('t'),
    a: p1,
    b: p2,
    home: { a: clone(p1), b: clone(p2) },
    name: options.name || nextName(mech, mech.tracks, 'T'),
    limits: options.limits || { enabled: false, min: null, max: null },
  };
  mech.tracks.push(track);
  return track;
}

export function getTrack(mech, id) {
  return mech.tracks.find((t) => t.id === id) || null;
}

/** Sliders riding on a given track. */
export function slidersOnTrack(mech, trackId) {
  return mech.joints.filter((j) => j.type === JOINT_SLIDER && j.trackId === trackId);
}

/* ------------------------------------------------------------------ motors */

export function addMotor(mech, jointId, linkId, options = {}) {
  const joint = getJoint(mech, jointId);
  const link = getLink(mech, linkId);
  if (!joint || !link) throw new Error('addMotor: unknown joint or link');
  if (link.a !== jointId && link.b !== jointId) {
    throw new Error('addMotor: the driven link must be attached to the motor joint');
  }
  const other = getJoint(mech, otherEnd(link, jointId));
  const angle = other ? Math.atan2(other.y - joint.y, other.x - joint.x) : 0;
  const motor = {
    id: options.id || makeId('m'),
    jointId,
    linkId,
    omega: options.omega != null ? options.omega : Math.PI, // rad/s
    angle, // commanded world angle of the driven link
    angleHome: angle,
    enabled: options.enabled !== false,
  };
  mech.motors.push(motor);
  return motor;
}

export function getMotor(mech, id) {
  return mech.motors.find((m) => m.id === id) || null;
}

export function motorAtJoint(mech, jointId) {
  return mech.motors.find((m) => m.jointId === jointId) || null;
}

/** Current commanded angle of a motor, read back from the pose. */
export function readMotorAngle(mech, motor) {
  const joint = getJoint(mech, motor.jointId);
  const link = getLink(mech, motor.linkId);
  if (!joint || !link) return motor.angle;
  const other = getJoint(mech, otherEnd(link, motor.jointId));
  if (!other) return motor.angle;
  return Math.atan2(other.y - joint.y, other.x - joint.x);
}

/* --------------------------------------------------------------- structure */

/** True when a joint can move at all (fixed pivots are ground). */
export function isMobile(joint) {
  return joint.type !== JOINT_FIXED;
}

/** Links whose both ends are pinned to the ground (drawn, but not solved). */
export function isGroundLink(mech, link) {
  const ja = getJoint(mech, link.a);
  const jb = getJoint(mech, link.b);
  return !!ja && !!jb && ja.type === JOINT_FIXED && jb.type === JOINT_FIXED;
}

/**
 * Split the mechanism into connected parts (a part = set of joints reachable
 * through links; sliders are attached to the ground through their track).
 */
export function connectedComponents(mech) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const j of mech.joints) parent.set(j.id, j.id);
  for (const l of mech.links) {
    if (parent.has(l.a) && parent.has(l.b)) union(l.a, l.b);
  }
  const groups = new Map();
  for (const j of mech.joints) {
    const root = find(j.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(j.id);
  }
  return [...groups.values()];
}

export function removeJoint(mech, jointId) {
  mech.joints = mech.joints.filter((j) => j.id !== jointId);
  mech.links = mech.links.filter((l) => l.a !== jointId && l.b !== jointId);
  mech.motors = mech.motors.filter((m) => m.jointId !== jointId);
  for (const m of mech.motors) {
    const link = getLink(mech, m.linkId);
    if (!link || (link.a !== m.jointId && link.b !== m.jointId)) {
      m.linkId = null;
    }
  }
  mech.motors = mech.motors.filter((m) => m.linkId);
}

export function removeLink(mech, linkId) {
  mech.links = mech.links.filter((l) => l.id !== linkId);
  mech.motors = mech.motors.filter((m) => m.linkId !== linkId);
}

export function removeTrack(mech, trackId) {
  mech.tracks = mech.tracks.filter((t) => t.id !== trackId);
  for (const j of mech.joints) {
    if (j.type === JOINT_SLIDER && j.trackId === trackId) {
      j.type = JOINT_REVOLUTE;
      j.trackId = null;
    }
  }
}

export function removeMotor(mech, motorId) {
  mech.motors = mech.motors.filter((m) => m.id !== motorId);
}

export function removeEntity(mech, id) {
  if (getJoint(mech, id)) return removeJoint(mech, id);
  if (getLink(mech, id)) return removeLink(mech, id);
  if (getTrack(mech, id)) return removeTrack(mech, id);
  if (getMotor(mech, id)) return removeMotor(mech, id);
  return false;
}

/** Entity kind lookup used by selection and the inspector. */
export function entityKind(mech, id) {
  if (getJoint(mech, id)) return 'joint';
  if (getLink(mech, id)) return 'link';
  if (getTrack(mech, id)) return 'track';
  if (getMotor(mech, id)) return 'motor';
  return null;
}

/* ------------------------------------------------------------------ poses */

/**
 * Design pose = home pose. `captureHome` freezes the current joint positions,
 * track endpoints and motor angles as the pose `reset()` returns to.
 */
export function captureHome(mech) {
  for (const j of mech.joints) j.home = { x: j.x, y: j.y };
  for (const t of mech.tracks) t.home = { a: clone(t.a), b: clone(t.b) };
  // The commanded angle follows the actual pose: after back-driving the
  // mechanism by hand the motor must not snap the crank back to a stale angle.
  for (const m of mech.motors) {
    const actual = readMotorAngle(mech, m);
    m.angle = actual;
    m.angleHome = actual;
  }
}

export function resetToHome(mech) {
  for (const j of mech.joints) {
    j.x = j.home.x;
    j.y = j.home.y;
  }
  for (const t of mech.tracks) {
    t.a = clone(t.home.a);
    t.b = clone(t.home.b);
  }
  for (const m of mech.motors) m.angle = m.angleHome;
}

/** Update the stored home for a single joint (used while dragging in edit mode). */
export function setJointHome(mech, jointId, p) {
  const j = getJoint(mech, jointId);
  if (!j) return;
  j.home = { x: p.x, y: p.y };
}

/* --------------------------------------------------------------- reporting */

/**
 * Measurement report for the read-out tables: every joint position and every
 * link's nominal vs. measured length, with the residual error.
 */
export function measure(mech) {
  const joints = mech.joints.map((j) => ({
    id: j.id,
    name: j.name,
    type: j.type,
    x: j.x,
    y: j.y,
    trackId: j.trackId,
  }));
  const links = mech.links.map((l) => {
    const measured = measureLink(mech, l);
    return {
      id: l.id,
      name: l.name,
      a: l.a,
      b: l.b,
      length: l.length,
      measured,
      error: Number.isFinite(measured) ? measured - l.length : NaN,
    };
  });
  let maxLengthError = 0;
  for (const l of links) {
    if (Number.isFinite(l.error)) maxLengthError = Math.max(maxLengthError, Math.abs(l.error));
  }
  return { joints, links, maxLengthError };
}

/** Slider positions expressed along their track (offset from track point a). */
export function sliderReadouts(mech) {
  return mech.joints
    .filter((j) => j.type === JOINT_SLIDER)
    .map((j) => {
      const track = getTrack(mech, j.trackId);
      if (!track) return { id: j.id, name: j.name, track: null, s: NaN, onTrack: false };
      const d = { x: track.b.x - track.a.x, y: track.b.y - track.a.y };
      const l = Math.hypot(d.x, d.y) || 1;
      const u = { x: d.x / l, y: d.y / l };
      const n = { x: -u.y, y: u.x };
      const rel = { x: j.x - track.a.x, y: j.y - track.a.y };
      const s = rel.x * u.x + rel.y * u.y;
      const h = rel.x * n.x + rel.y * n.y;
      return {
        id: j.id,
        name: j.name,
        trackId: track.id,
        trackName: track.name,
        s,
        offset: h,
        onTrack: Math.abs(h) < 1e-6,
      };
    });
}

/* -------------------------------------------------------------- validation */

export function validate(mech) {
  const errors = [];
  const warnings = [];
  const jointIds = new Set();
  for (const j of mech.joints) {
    if (jointIds.has(j.id)) errors.push(`Duplicate joint id ${j.id}`);
    jointIds.add(j.id);
    if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) {
      errors.push(`Joint ${j.name} has a non-finite position`);
    }
    if (j.type === JOINT_SLIDER && !getTrack(mech, j.trackId)) {
      errors.push(`Slider ${j.name} is not attached to a track`);
    }
  }
  const pairs = new Set();
  for (const l of mech.links) {
    const ja = getJoint(mech, l.a);
    const jb = getJoint(mech, l.b);
    if (!ja || !jb) {
      errors.push(`Link ${l.name} references a missing joint`);
      continue;
    }
    if (ja.id === jb.id) errors.push(`Link ${l.name} connects a joint to itself`);
    if (!(l.length > 0) || !Number.isFinite(l.length)) {
      errors.push(`Link ${l.name} has an invalid length`);
    }
    const key = [l.a, l.b].sort().join('|');
    if (pairs.has(key)) warnings.push(`Two links connect the same pair of joints (${ja.name}–${jb.name})`);
    pairs.add(key);
    if (isGroundLink(mech, l)) {
      const d = dist(ja, jb);
      if (Math.abs(d - l.length) > 1e-6) {
        warnings.push(
          `Ground link ${l.name} length is set by its two fixed pivots (${d.toFixed(2)} ${mech.units})`,
        );
      }
    }
  }
  for (const t of mech.tracks) {
    if (dist(t.a, t.b) < 1e-9) errors.push(`Track ${t.name} has zero length`);
  }
  for (const m of mech.motors) {
    const joint = getJoint(mech, m.jointId);
    const link = getLink(mech, m.linkId);
    if (!joint) {
      errors.push('A motor references a missing joint');
      continue;
    }
    if (!link) {
      errors.push(`Motor on ${joint.name} has no driven link`);
      continue;
    }
    if (link.a !== m.jointId && link.b !== m.jointId) {
      errors.push(`Motor on ${joint.name} drives a link that is not attached to it`);
    }
    if (!Number.isFinite(m.omega)) errors.push(`Motor on ${joint.name} has an invalid speed`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Structural summary used by the status bar: joint counts, mobility estimate
 * and whether the mechanism is fully driven.
 */
export function structureSummary(mech) {
  const counts = {
    fixed: 0,
    revolute: 0,
    slider: 0,
    links: mech.links.length,
    tracks: mech.tracks.length,
    motors: mech.motors.filter((m) => m.enabled).length,
  };
  for (const j of mech.joints) counts[j.type] = (counts[j.type] || 0) + 1;
  const mobile = mech.joints.filter(isMobile).length;
  return {
    counts,
    movingJoints: mobile,
    rawDof: mobile * 2,
    parts: connectedComponents(mech).length,
    driven: counts.motors > 0,
  };
}

export function cloneMechanism(mech) {
  return deepClone(mech);
}

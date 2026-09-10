/**
 * Saving and reloading mechanisms.
 *
 * Two layers:
 *  - JSON text (export/import files, copy & paste, tests)
 *  - named slots in any Web Storage-like backend (localStorage in the browser)
 *
 * Nothing in here touches the DOM: the storage backend is injected, which makes
 * the whole layer testable in Node with a tiny in-memory stub.
 */

import { deepClone, dist, makeId } from './math.js';
import {
  JOINT_FIXED,
  JOINT_REVOLUTE,
  JOINT_SLIDER,
  MODEL_VERSION,
  createMechanism,
  defaultView,
} from './model.js';

export const FILE_FORMAT = 'linkage-designer';
export const STORAGE_PREFIX = 'linkage-designer:v1:';
export const SLOT_INDEX_KEY = `${STORAGE_PREFIX}index`;

/* --------------------------------------------------------------- sanitising */

const JOINT_TYPES = new Set([JOINT_FIXED, JOINT_REVOLUTE, JOINT_SLIDER]);

function num(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Turn arbitrary parsed JSON into a mechanism that is guaranteed to be
 * structurally consistent. Invalid entities are dropped and reported instead of
 * throwing, so a partially damaged file still opens.
 */
export function sanitizeMechanism(raw) {
  const warnings = [];
  if (!raw || typeof raw !== 'object') throw new Error('Not a mechanism file');
  const mech = createMechanism(typeof raw.name === 'string' ? raw.name : 'Untitled mechanism');
  mech.units = typeof raw.units === 'string' ? raw.units : 'mm';
  mech.view = { ...defaultView(), ...(raw.view && typeof raw.view === 'object' ? raw.view : {}) };

  if (Number.isFinite(raw.version) && raw.version > MODEL_VERSION) {
    warnings.push(`File was written by a newer version (v${raw.version}); unknown data ignored.`);
  }

  const jointIds = new Set();
  for (const rj of Array.isArray(raw.joints) ? raw.joints : []) {
    if (!rj || typeof rj !== 'object') continue;
    let id = typeof rj.id === 'string' && rj.id ? rj.id : makeId('j');
    while (jointIds.has(id)) id = makeId('j');
    jointIds.add(id);
    const x = num(rj.x, 0);
    const y = num(rj.y, 0);
    const type = JOINT_TYPES.has(rj.type) ? rj.type : JOINT_REVOLUTE;
    mech.joints.push({
      id,
      type,
      x,
      y,
      home: {
        x: num(rj.home && rj.home.x, x),
        y: num(rj.home && rj.home.y, y),
      },
      name: typeof rj.name === 'string' && rj.name ? rj.name : id,
      trackId: type === JOINT_SLIDER && typeof rj.trackId === 'string' ? rj.trackId : null,
    });
  }

  const trackIds = new Set();
  for (const rt of Array.isArray(raw.tracks) ? raw.tracks : []) {
    if (!rt || typeof rt !== 'object') continue;
    const a = { x: num(rt.a && rt.a.x, 0), y: num(rt.a && rt.a.y, 0) };
    const b = { x: num(rt.b && rt.b.x, 100), y: num(rt.b && rt.b.y, 0) };
    if (dist(a, b) < 1e-9) {
      warnings.push('Dropped a zero-length track');
      continue;
    }
    let id = typeof rt.id === 'string' && rt.id ? rt.id : makeId('t');
    while (trackIds.has(id)) id = makeId('t');
    trackIds.add(id);
    const limits = rt.limits && typeof rt.limits === 'object' ? rt.limits : {};
    mech.tracks.push({
      id,
      a,
      b,
      home: {
        a: { x: num(rt.home && rt.home.a && rt.home.a.x, a.x), y: num(rt.home && rt.home.a && rt.home.a.y, a.y) },
        b: { x: num(rt.home && rt.home.b && rt.home.b.x, b.x), y: num(rt.home && rt.home.b && rt.home.b.y, b.y) },
      },
      name: typeof rt.name === 'string' && rt.name ? rt.name : id,
      limits: {
        enabled: bool(limits.enabled, false),
        min: Number.isFinite(limits.min) ? limits.min : null,
        max: Number.isFinite(limits.max) ? limits.max : null,
      },
    });
  }

  // Sliders must reference an existing track.
  for (const joint of mech.joints) {
    if (joint.type !== JOINT_SLIDER) continue;
    if (!joint.trackId || !trackIds.has(joint.trackId)) {
      warnings.push(`Slider ${joint.name} lost its track and became a rotating joint`);
      joint.type = JOINT_REVOLUTE;
      joint.trackId = null;
    }
  }

  const seenLinks = new Set();
  for (const rl of Array.isArray(raw.links) ? raw.links : []) {
    if (!rl || typeof rl !== 'object') continue;
    const a = typeof rl.a === 'string' ? rl.a : null;
    const b = typeof rl.b === 'string' ? rl.b : null;
    if (!a || !b || !jointIds.has(a) || !jointIds.has(b) || a === b) {
      warnings.push('Dropped a link with missing endpoints');
      continue;
    }
    const key = [a, b].sort().join('|');
    if (seenLinks.has(key)) {
      warnings.push('Dropped a duplicated link');
      continue;
    }
    seenLinks.add(key);
    const ja = mech.joints.find((j) => j.id === a);
    const jb = mech.joints.find((j) => j.id === b);
    let length = Number.isFinite(rl.length) && rl.length > 0 ? rl.length : dist(ja, jb);
    if (!(length > 0)) {
      length = 50;
      warnings.push('A link had a zero length; a nominal 50 unit length was used');
    }
    mech.links.push({
      id: typeof rl.id === 'string' && rl.id ? rl.id : makeId('l'),
      a,
      b,
      length,
      name: typeof rl.name === 'string' && rl.name ? rl.name : 'link',
      kind: rl.kind === 'ground' ? 'ground' : 'rigid',
    });
  }

  for (const rm of Array.isArray(raw.motors) ? raw.motors : []) {
    if (!rm || typeof rm !== 'object') continue;
    const jointId = typeof rm.jointId === 'string' ? rm.jointId : null;
    const linkId = typeof rm.linkId === 'string' ? rm.linkId : null;
    const link = linkId ? mech.links.find((l) => l.id === linkId) : null;
    if (!jointId || !jointIds.has(jointId) || !link) {
      warnings.push('Dropped a motor without a driven link');
      continue;
    }
    if (link.a !== jointId && link.b !== jointId) {
      warnings.push('Dropped a motor whose link is not attached to it');
      continue;
    }
    const joint = mech.joints.find((j) => j.id === jointId);
    const other = mech.joints.find((j) => j.id === (link.a === jointId ? link.b : link.a));
    const natural = other ? Math.atan2(other.y - joint.y, other.x - joint.x) : 0;
    const angle = Number.isFinite(rm.angle) ? rm.angle : natural;
    mech.motors.push({
      id: typeof rm.id === 'string' && rm.id ? rm.id : makeId('m'),
      jointId,
      linkId,
      omega: Number.isFinite(rm.omega) ? rm.omega : Math.PI,
      angle,
      angleHome: Number.isFinite(rm.angleHome) ? rm.angleHome : angle,
      enabled: bool(rm.enabled, true),
    });
  }

  return { mechanism: mech, warnings };
}

/* -------------------------------------------------------------- json layer */

export function serialize(mech, options = {}) {
  const payload = {
    format: FILE_FORMAT,
    version: MODEL_VERSION,
    savedAt: new Date(options.now != null ? options.now : Date.now()).toISOString(),
    mechanism: deepClone(mech),
  };
  return JSON.stringify(payload, null, options.pretty === false ? 0 : 2);
}

export function deserialize(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Not valid JSON: ${error.message}`);
  }
  const raw = parsed && parsed.mechanism ? parsed.mechanism : parsed;
  if (parsed && parsed.format && parsed.format !== FILE_FORMAT) {
    throw new Error(`Unexpected file format "${parsed.format}"`);
  }
  return sanitizeMechanism(raw);
}

/** Round-trip helper used by the tests and by "duplicate" actions. */
export function cloneViaJson(mech) {
  return deserialize(serialize(mech, { pretty: false })).mechanism;
}

/* ------------------------------------------------------------ slot storage */

function resolveBackend(backend) {
  if (backend) return backend;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export class StorageUnavailableError extends Error {
  constructor(message = 'Browser storage is not available in this context.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export function listSlots(backend) {
  const store = resolveBackend(backend);
  if (!store) return [];
  try {
    const raw = store.getItem(SLOT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && typeof s.name === 'string')
      .map((s) => ({
        name: s.name,
        savedAt: typeof s.savedAt === 'string' ? s.savedAt : null,
        jointCount: Number.isFinite(s.jointCount) ? s.jointCount : null,
      }));
  } catch {
    return [];
  }
}

function writeSlotIndex(store, slots) {
  store.setItem(SLOT_INDEX_KEY, JSON.stringify(slots));
}

export function saveSlot(name, mech, backend, options = {}) {
  const store = resolveBackend(backend);
  if (!store) throw new StorageUnavailableError();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('A slot name is required');
  const savedAt = new Date(options.now != null ? options.now : Date.now()).toISOString();
  const key = `${STORAGE_PREFIX}mech:${trimmed}`;
  try {
    store.setItem(key, serialize(mech, { now: options.now }));
    const slots = listSlots(store).filter((s) => s.name !== trimmed);
    slots.push({ name: trimmed, savedAt, jointCount: mech.joints.length });
    slots.sort((a, b) => a.name.localeCompare(b.name));
    writeSlotIndex(store, slots);
    return { name: trimmed, savedAt };
  } catch (error) {
    throw new Error(`Could not save "${trimmed}": ${error.message}`);
  }
}

export function loadSlot(name, backend) {
  const store = resolveBackend(backend);
  if (!store) throw new StorageUnavailableError();
  const key = `${STORAGE_PREFIX}mech:${String(name || '').trim()}`;
  const raw = store.getItem(key);
  if (!raw) throw new Error(`No saved mechanism named "${name}"`);
  return deserialize(raw);
}

export function deleteSlot(name, backend) {
  const store = resolveBackend(backend);
  if (!store) throw new StorageUnavailableError();
  const trimmed = String(name || '').trim();
  store.removeItem(`${STORAGE_PREFIX}mech:${trimmed}`);
  writeSlotIndex(
    store,
    listSlots(store).filter((s) => s.name !== trimmed),
  );
  return true;
}

export function renameSlot(oldName, newName, backend) {
  const store = resolveBackend(backend);
  if (!store) throw new StorageUnavailableError();
  const loaded = loadSlot(oldName, store);
  saveSlot(newName, loaded.mechanism, store);
  deleteSlot(oldName, store);
  return true;
}

/** In-memory backend used by the tests (and as a fallback in private mode). */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    get length() {
      return map.size;
    },
    _dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

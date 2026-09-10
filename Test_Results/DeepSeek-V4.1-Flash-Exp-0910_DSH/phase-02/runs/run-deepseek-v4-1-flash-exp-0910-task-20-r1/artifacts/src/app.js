/**
 * Application shell: DOM wiring, tools, inspector, read-outs and the render
 * loop. All the geometry, solving, simulation and persistence live in the
 * modules under `src/`; this file is only the user interface around them.
 */

import { TAU, deg, dist, fmt, projectOnLine, rad, wrapPi } from './math.js';
import {
  JOINT_FIXED,
  JOINT_REVOLUTE,
  JOINT_SLIDER,
  JOINT_TYPE_LABELS,
  addJoint,
  addLink,
  addMotor,
  addSlider,
  addTrack,
  captureHome,
  createMechanism,
  entityKind,
  getJoint,
  getLink,
  getMotor,
  getTrack,
  linksAtJoint,
  measure,
  otherEnd,
  removeEntity,
  setJointHome,
  sliderReadouts,
  structureSummary,
  validate,
} from './model.js';
import { solveConstraints, analyzeMobility, evaluateResiduals, solveWithMotorRamp } from './solver.js';
import { Simulation } from './simulate.js';
import { PRESETS, buildPreset } from './presets.js';
import {
  StorageUnavailableError,
  createMemoryStorage,
  deleteSlot,
  deserialize,
  listSlots,
  loadSlot,
  saveSlot,
  serialize,
} from './serialize.js';
import { History } from './history.js';
import { renderScene, THEME } from './render.js';
import {
  createCamera,
  fitCameraToMechanism,
  hitTest,
  hitTrackHandle,
  nearestTrack,
  screenToWorld,
  snapPoint,
  zoomCameraAt,
} from './view.js';

/* ------------------------------------------------------------------- tools */

const TOOLS = [
  {
    id: 'select',
    label: 'Select / drag',
    icon: '➤',
    key: '1',
    hint: 'Click to select. Drag a joint to move the mechanism: links stay rigid and the crank is back-driven. Shift-click adds to the selection.',
  },
  {
    id: 'fixed',
    label: 'Fixed pivot',
    icon: '▲',
    key: '2',
    hint: 'Click on the canvas to pin a joint to the ground (a fixed pivot).',
  },
  {
    id: 'revolute',
    label: 'Rotating joint',
    icon: '●',
    key: '3',
    hint: 'Click to place a free pin joint.',
  },
  {
    id: 'link',
    label: 'Rigid link',
    icon: '▬',
    key: '4',
    hint: 'Click a joint, then a second joint. Clicking empty space creates the joint. Set an exact length on the left.',
  },
  {
    id: 'track',
    label: 'Track / rail',
    icon: '═',
    key: '5',
    hint: 'Click the start and the end of a straight rail that a slider will ride on.',
  },
  {
    id: 'slider',
    label: 'Slider',
    icon: '▣',
    key: '6',
    hint: 'Click near a rail to add a slider constrained to it.',
  },
  {
    id: 'motor',
    label: 'Motor',
    icon: '↻',
    key: '7',
    hint: 'Click a joint that has at least one link: that link becomes the driven crank. Refine it in the inspector.',
  },
  {
    id: 'erase',
    label: 'Delete',
    icon: '⌫',
    key: '8',
    hint: 'Click any joint, link, rail or motor to delete it.',
  },
];

const { storage: STORAGE, persistent: STORAGE_PERSISTENT } = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('linkage-designer:probe', '1');
      localStorage.removeItem('linkage-designer:probe');
      return { storage: localStorage, persistent: true };
    }
  } catch {
    /* private mode, blocked cookies or a file:// origin without storage */
  }
  return { storage: createMemoryStorage(), persistent: false };
})();

const AUTOSAVE_KEY = 'linkage-designer:v1:autosave';

/* ------------------------------------------------------------------- state */

const state = {
  mechanism: createMechanism(),
  sim: null,
  camera: createCamera(3.2, 0, 0),
  selection: new Set(),
  hover: null,
  tool: 'select',
  pending: null,
  drag: null,
  history: new History({ limit: 120 }),
  width: 800,
  height: 600,
  activeTab: 'joints',
  needsRender: true,
  fps: 0,
  lastFrameTime: 0,
  lastReadoutRefresh: 0,
  dragTarget: null,
};

const dom = {};

/* ----------------------------------------------------------------- helpers */

function $(id) {
  return document.getElementById(id);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

let toastTimer = null;
function toast(message, kind = 'info', ms = 2600) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.className = `toast${kind === 'error' ? ' is-error' : kind === 'good' ? ' is-good' : ''}`;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, ms);
}

function setHint(text) {
  if (!dom.canvasHint) return;
  if (!text) {
    dom.canvasHint.hidden = true;
    return;
  }
  dom.canvasHint.textContent = text;
  dom.canvasHint.hidden = false;
}

/* -------------------------------------------------------------- mechanism */

/** Snapshot the current state onto the undo stack and run a mutation. */
function commit(label, mutate) {
  state.history.push(label, { mechanism: state.mechanism, selection: [...state.selection] });
  mutate();
  afterEdit({ recaptureHome: true });
}

function afterEdit(options = {}) {
  const { recaptureHome = false, resolve = true } = options;
  if (recaptureHome) {
    for (const joint of state.mechanism.joints) {
      if (joint.type !== JOINT_FIXED) setJointHome(state.mechanism, joint.id, joint);
    }
  }
  normalizeGroundLinks();
  if (resolve) solveConstraints(state.mechanism);
  state.sim.time = 0;
  state.sim.traces.clear();
  state.sim.ranges.clear();
  state.sim.recordTraces();
  autosave();
  refreshUI({ inspector: true });
  state.needsRender = true;
}

/** A link between two fixed pivots has its length fixed by the pivots. */
function normalizeGroundLinks() {
  for (const link of state.mechanism.links) {
    const ja = getJoint(state.mechanism, link.a);
    const jb = getJoint(state.mechanism, link.b);
    if (ja && jb && ja.type === JOINT_FIXED && jb.type === JOINT_FIXED) {
      link.length = dist(ja, jb);
      link.kind = 'ground';
    }
  }
}

function setMechanism(mech, options = {}) {
  state.mechanism = mech;
  if (options.keepHistory !== true) state.history.clear();
  state.selection.clear();
  state.pending = null;
  state.drag = null;
  state.hover = null;
  state.sim = new Simulation(state.mechanism);
  normalizeGroundLinks();
  solveConstraints(state.mechanism);
  if (options.fit !== false) fitView();
  dom.mechName.value = mech.name || 'Untitled mechanism';
  refreshUI({ inspector: true, slots: true });
  autosave();
  state.needsRender = true;
}

function fitView() {
  fitCameraToMechanism(state.camera, state.mechanism, state.width, state.height, 90);
  state.needsRender = true;
}

function autosave() {
  try {
    STORAGE.setItem(AUTOSAVE_KEY, serialize(state.mechanism, { pretty: false }));
  } catch {
    /* storage full or unavailable — not fatal */
  }
}

/* ------------------------------------------------------------------ canvas */

function resizeCanvas() {
  const canvas = dom.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.width = Math.max(1, Math.round(rect.width));
  state.height = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(state.width * dpr);
  canvas.height = Math.round(state.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.needsRender = true;
}

/**
 * Pointer capture keeps a drag alive when the pointer leaves the canvas. It can
 * legitimately fail (no active pointer, unsupported browser); a failed capture
 * must never break the drag itself.
 */
function capturePointer(pointerId) {
  try {
    dom.canvas.setPointerCapture(pointerId);
  } catch {
    /* capture is a convenience, not a requirement */
  }
}

function releasePointer(pointerId) {
  try {
    if (dom.canvas.hasPointerCapture && dom.canvas.hasPointerCapture(pointerId)) {
      dom.canvas.releasePointerCapture(pointerId);
    }
  } catch {
    /* already released */
  }
}

function pointerPosition(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function render() {
  const ctx = dom.canvas.getContext('2d');
  const sim = state.sim;
  renderScene(ctx, {
    mechanism: state.mechanism,
    camera: state.camera,
    width: state.width,
    height: state.height,
    selection: state.selection,
    hover: state.hover,
    simulation: sim,
    pending: state.pending,
    snapPoint: state.drag && state.drag.snap ? state.drag.snap : null,
    options: state.mechanism.view,
  });
}

/* ------------------------------------------------------------ pointer input */

function onPointerDown(event) {
  dom.canvas.focus();
  const screen = pointerPosition(event);
  const world = screenToWorld(state.camera, screen);
  const view = state.mechanism.view;
  const snapped = snapPoint(world, view.gridSize, view.snapToGrid);

  // Middle button, or space held with the left button, pans the view.
  if (event.button === 1 || (event.button === 0 && event.shiftKey && state.tool === 'select' && !state.hover)) {
    state.drag = { kind: 'pan', screen, origin: { x: state.camera.ox, y: state.camera.oy } };
    capturePointer(event.pointerId);
    return;
  }
  if (event.button !== 0) return;

  const hit = hitTest(state.mechanism, screen, state.camera, { tolerancePixels: 12 });

  switch (state.tool) {
    case 'select':
      handleSelectPointerDown(event, screen, world, hit);
      break;
    case 'fixed':
    case 'revolute': {
      if (hit && hit.kind === 'joint') {
        toast('That spot already has a joint — use the Link tool to connect joints.');
        return;
      }
      const type = state.tool === 'fixed' ? JOINT_FIXED : JOINT_REVOLUTE;
      commit(`add ${JOINT_TYPE_LABELS[type]}`, () => {
        const joint = addJoint(state.mechanism, { type, x: snapped.x, y: snapped.y });
        state.selection = new Set([joint.id]);
      });
      break;
    }
    case 'link':
      handleLinkClick(snapped, hit);
      break;
    case 'track': {
      if (!state.pending || state.pending.kind !== 'track') {
        state.pending = { kind: 'track', from: snapped, to: snapped };
        setHint('Click the far end of the rail…');
      } else {
        const from = state.pending.from;
        state.pending = null;
        setHint('');
        if (dist(from, snapped) < 1e-6) {
          toast('A rail needs two different points.', 'error');
          return;
        }
        commit('add track', () => {
          const track = addTrack(state.mechanism, from, snapped);
          state.selection = new Set([track.id]);
        });
        setTool('slider');
      }
      state.needsRender = true;
      break;
    }
    case 'slider': {
      const near = nearestTrack(state.mechanism, world, 14 / state.camera.scale + 6);
      if (!near) {
        toast('Click closer to a rail — add one with the Track tool first.', 'error');
        return;
      }
      commit('add slider', () => {
        const joint = addSlider(state.mechanism, near.point.x, near.point.y, near.track.id);
        state.selection = new Set([joint.id]);
      });
      break;
    }
    case 'motor': {
      if (!hit || hit.kind !== 'joint') {
        toast('Click a joint that has a link attached.', 'error');
        return;
      }
      const links = linksAtJoint(state.mechanism, hit.id);
      if (links.length === 0) {
        toast('That joint has no link yet — draw a link first.', 'error');
        return;
      }
      if (state.mechanism.motors.some((m) => m.jointId === hit.id)) {
        toast('That joint already has a motor.');
        state.selection = new Set([state.mechanism.motors.find((m) => m.jointId === hit.id).id]);
        refreshUI({ inspector: true });
        return;
      }
      commit('add motor', () => {
        const motor = addMotor(state.mechanism, hit.id, links[0].id, { omega: Math.PI });
        motor.angleHome = motor.angle;
        state.selection = new Set([motor.id]);
        captureHome(state.mechanism);
      });
      toast('Motor added — set its speed in the inspector.');
      break;
    }
    case 'erase': {
      if (!hit) return;
      commit(`delete ${hit.kind}`, () => {
        removeEntity(state.mechanism, hit.id);
        state.selection.delete(hit.id);
      });
      break;
    }
    default:
      break;
  }
  state.needsRender = true;
}

function handleSelectPointerDown(event, screen, world, hit) {
  const handle = hitTrackHandle(state.mechanism, screen, state.camera);
  const selectedTrack = handle && state.selection.has(handle.id);
  if (selectedTrack) {
    state.drag = {
      kind: 'trackHandle',
      id: handle.id,
      end: handle.end,
      screen,
    };
    capturePointer(event.pointerId);
    return;
  }

  if (hit) {
    if (event.shiftKey) {
      if (state.selection.has(hit.id)) state.selection.delete(hit.id);
      else state.selection.add(hit.id);
    } else if (!state.selection.has(hit.id)) {
      state.selection = new Set([hit.id]);
    }
    refreshUI({ inspector: true });

    if (hit.kind === 'joint') {
      const joint = getJoint(state.mechanism, hit.id);
      if (joint && joint.type !== JOINT_FIXED) {
        if (state.sim.playing) state.sim.pause();
        state.drag = { kind: 'joint', id: hit.id, screen };
        capturePointer(event.pointerId);
      } else if (joint) {
        state.drag = { kind: 'fixedJoint', id: hit.id, screen, start: { x: joint.x, y: joint.y } };
        capturePointer(event.pointerId);
      }
    }
    return;
  }

  // Empty space: start a pan, and clear the selection on a click without drag.
  state.selection.clear();
  refreshUI({ inspector: true });
  state.drag = { kind: 'pan', screen, origin: { x: state.camera.ox, y: state.camera.oy }, maybeClick: true };
  capturePointer(event.pointerId);
  void world;
}

function handleLinkClick(snapped, hit) {
  const mech = state.mechanism;
  let jointId = hit && hit.kind === 'joint' ? hit.id : null;
  if (!state.pending || state.pending.kind !== 'link') {
    if (!jointId) {
      // Create the joint on the fly so a link can be drawn in two clicks.
      state.history.push('create joint', { mechanism: mech, selection: [...state.selection] });
      const joint = addJoint(mech, { type: JOINT_REVOLUTE, x: snapped.x, y: snapped.y });
      jointId = joint.id;
    }
    const joint = getJoint(mech, jointId);
    state.pending = { kind: 'link', fromJointId: jointId, from: { x: joint.x, y: joint.y }, to: snapped };
    setHint('Click the second joint of the link…');
    state.needsRender = true;
    return;
  }

  const fromId = state.pending.fromJointId;
  state.pending = null;
  setHint('');
  if (!jointId) {
    const joint = addJoint(mech, { type: JOINT_REVOLUTE, x: snapped.x, y: snapped.y });
    jointId = joint.id;
  }
  if (jointId === fromId) {
    toast('A link needs two different joints.', 'error');
    return;
  }
  const existing = mech.links.find(
    (l) => (l.a === fromId && l.b === jointId) || (l.a === jointId && l.b === fromId),
  );
  if (existing) {
    toast('Those joints are already connected.');
    state.selection = new Set([existing.id]);
    refreshUI({ inspector: true });
    return;
  }
  const ja = getJoint(mech, fromId);
  const jb = getJoint(mech, jointId);
  const measured = dist(ja, jb);
  const useExact = dom.linkLengthLock.checked && Number.isFinite(parseFloat(dom.linkLength.value));
  const length = useExact ? Math.abs(parseFloat(dom.linkLength.value)) : measured;
  if (useExact && !(length > 0)) {
    toast('Enter a positive length, or untick "use value".', 'error');
    return;
  }
  commit('add link', () => {
    const link = addLink(mech, fromId, jointId, { length });
    state.selection = new Set([link.id]);
  });
  if (useExact) toast(`Link created with an exact length of ${fmt(length, 2)} mm.`, 'good');
  state.needsRender = true;
}

function onPointerMove(event) {
  const screen = pointerPosition(event);
  const world = screenToWorld(state.camera, screen);
  const view = state.mechanism.view;
  const snapped = snapPoint(world, view.gridSize, view.snapToGrid);

  if (state.drag) {
    const drag = state.drag;
    if (drag.kind === 'pan') {
      const dx = screen.x - drag.screen.x;
      const dy = screen.y - drag.screen.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.maybeClick = false;
      state.camera.ox = drag.origin.x + dx;
      state.camera.oy = drag.origin.y + dy;
      state.needsRender = true;
      return;
    }
    if (drag.kind === 'joint') {
      drag.snap = snapped;
      // Suspending the motor lets the pointer back-drive the linkage: grabbing
      // any joint moves the whole mechanism instead of fighting the crank.
      state.sim.dragSolve([{ jointId: drag.id, x: snapped.x, y: snapped.y, weight: 0.6 }], {
        ignoreMotors: true,
      });
      drag.moved = true;
      state.needsRender = true;
      refreshReadouts();
      return;
    }
    if (drag.kind === 'fixedJoint') {
      const joint = getJoint(state.mechanism, drag.id);
      if (joint) {
        drag.snap = snapped;
        drag.moved = true;
        joint.x = snapped.x;
        joint.y = snapped.y;
        setJointHome(state.mechanism, joint.id, joint);
        normalizeGroundLinks();
        solveConstraints(state.mechanism);
        state.needsRender = true;
        refreshReadouts();
      }
      return;
    }
    if (drag.kind === 'trackHandle') {
      const track = getTrack(state.mechanism, drag.id);
      if (track) {
        drag.snap = snapped;
        drag.moved = true;
        track[drag.end] = { x: snapped.x, y: snapped.y };
        track.home[drag.end] = { x: snapped.x, y: snapped.y };
        solveConstraints(state.mechanism);
        state.needsRender = true;
        refreshReadouts();
      }
      return;
    }
  }

  if (state.pending) {
    state.pending.to = snapped;
    state.needsRender = true;
  }

  const hit = hitTest(state.mechanism, screen, state.camera, { tolerancePixels: 10 });
  const changed =
    (hit && hit.id) !== (state.hover && state.hover.id) || (hit && hit.kind) !== (state.hover && state.hover.kind);
  if (changed) {
    state.hover = hit;
    state.needsRender = true;
  }
  updateCursor(hit);
}

function updateCursor(hit) {
  const canvas = dom.canvas;
  if (state.drag && state.drag.kind === 'pan') {
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (state.tool === 'erase') {
    canvas.style.cursor = hit ? 'not-allowed' : 'crosshair';
    return;
  }
  if (state.tool === 'select') {
    if (hit && hit.kind === 'joint') canvas.style.cursor = 'move';
    else if (hit) canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'grab';
    return;
  }
  canvas.style.cursor = 'crosshair';
}

function onPointerUp(event) {
  const drag = state.drag;
  state.drag = null;
  if (!drag) return;
  releasePointer(event.pointerId);
  if (drag.kind === 'pan') {
    state.needsRender = true;
    return;
  }
  if (drag.moved) {
    // The new geometry becomes the design (home) pose — including the motor's
    // commanded angle, so Play continues from where the drag left the crank.
    if (drag.kind === 'joint') state.sim.captureHome();
    normalizeGroundLinks();
    solveConstraints(state.mechanism);
    state.sim.time = 0;
    autosave();
    refreshUI({ inspector: true, slots: false });
  }
  state.needsRender = true;
}

function onWheel(event) {
  event.preventDefault();
  const screen = pointerPosition(event);
  const factor = Math.exp(-event.deltaY * 0.0016);
  zoomCameraAt(state.camera, screen, factor, { min: 0.05, max: 400 });
  state.needsRender = true;
}

function onDoubleClick(event) {
  const screen = pointerPosition(event);
  const hit = hitTest(state.mechanism, screen, state.camera, { tolerancePixels: 12 });
  if (!hit) {
    fitView();
    return;
  }
  if (hit.kind === 'joint') {
    const joint = getJoint(state.mechanism, hit.id);
    if (!joint) return;
    commit('cycle joint type', () => {
      joint.type =
        joint.type === JOINT_FIXED
          ? JOINT_REVOLUTE
          : joint.type === JOINT_REVOLUTE && state.mechanism.tracks.length
            ? JOINT_SLIDER
            : JOINT_FIXED;
      if (joint.type === JOINT_SLIDER && !joint.trackId) {
        const near = nearestTrack(state.mechanism, joint, Infinity);
        if (near) {
          joint.trackId = near.track.id;
          joint.x = near.point.x;
          joint.y = near.point.y;
        } else {
          joint.type = JOINT_REVOLUTE;
          toast('Add a rail first to make a slider.', 'error');
        }
      }
      if (joint.type !== JOINT_SLIDER) joint.trackId = null;
      state.selection = new Set([joint.id]);
    });
  }
}

/* ----------------------------------------------------------------- inputs */

function onKeyDown(event) {
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement;
  const meta = event.metaKey || event.ctrlKey;

  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (meta && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveCurrentSlot();
    return;
  }
  if (typing) {
    if (event.key === 'Escape') target.blur();
    return;
  }
  if (meta || event.altKey) return;

  // Arrow keys nudge the selected joint / rail (shift = 10x).
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    nudgeSelection(event.key, event.shiftKey);
    return;
  }

  const crankStep = event.key === '[' ? -2 : event.key === ']' ? 2 : 0;
  if (crankStep) {
    event.preventDefault();
    nudgeCrank(rad(crankStep));
    return;
  }

  const displayKeys = { g: 'showGrid', l: 'showLabels', c: 'showCoordinates', d: 'showDimensions' };

  switch (event.key) {
    case ' ':
      event.preventDefault();
      togglePlay();
      return;
    case 'Escape':
      state.pending = null;
      state.selection.clear();
      setHint('');
      setTool('select');
      refreshUI({ inspector: true });
      state.needsRender = true;
      return;
    case '?':
      toggleHelp(true);
      return;
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      deleteSelection();
      return;
    default:
      break;
  }

  const key = event.key.toLowerCase();
  if (key === 's') {
    stepOnce(1);
    return;
  }
  if (key === 'r') {
    resetSimulation();
    return;
  }
  if (key === 'f') {
    fitView();
    return;
  }
  if (displayKeys[key]) {
    state.mechanism.view[displayKeys[key]] = !state.mechanism.view[displayKeys[key]];
    state.needsRender = true;
    refreshDisplayToggles();
    return;
  }
  const tool = TOOLS.find((t) => t.key === event.key);
  if (tool) setTool(tool.id);
}

function nudgeSelection(key, big) {
  if (state.selection.size === 0) return;
  const step = (big ? 10 : 1) * (state.mechanism.view.gridSize || 10);
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
  const dy = key === 'ArrowUp' ? step : key === 'ArrowDown' ? -step : 0;
  let touched = false;
  for (const id of state.selection) {
    const joint = getJoint(state.mechanism, id);
    if (joint && joint.type !== JOINT_FIXED) {
      // A mobile joint is moved the same way a drag moves it (back-driving).
      const result = state.sim.dragSolve(
        [{ jointId: joint.id, x: joint.x + dx, y: joint.y + dy, weight: 0.6 }],
        { ignoreMotors: true },
      );
      if (result.converged) {
        state.sim.captureHome();
        touched = true;
      }
      continue;
    }
    if (joint) {
      joint.x += dx;
      joint.y += dy;
      setJointHome(state.mechanism, joint.id, joint);
      touched = true;
    }
    const track = getTrack(state.mechanism, id);
    if (track) {
      track.a = { x: track.a.x + dx, y: track.a.y + dy };
      track.b = { x: track.b.x + dx, y: track.b.y + dy };
      track.home = { a: { ...track.a }, b: { ...track.b } };
      touched = true;
    }
  }
  if (!touched) return;
  state.history.push('nudge', { mechanism: state.mechanism, selection: [...state.selection] });
  normalizeGroundLinks();
  solveConstraints(state.mechanism);
  autosave();
  refreshUI({ inspector: true });
  state.needsRender = true;
}

function deleteSelection() {
  if (state.selection.size === 0) {
    toast('Nothing is selected.');
    return;
  }
  commit('delete selection', () => {
    for (const id of [...state.selection]) removeEntity(state.mechanism, id);
    state.selection.clear();
  });
  toast('Deleted.');
}

/* ------------------------------------------------------------- transport */

function togglePlay() {
  if (!state.sim.hasDrive() && state.sim.playing === false && !state.mechanism.motors.length) {
    toast('Add a motor first (tool “Motor” then click a joint).', 'error');
    return;
  }
  if (state.sim.playing) {
    state.sim.pause();
  } else {
    state.sim.play();
    state.sim.blocked = false;
  }
  refreshTransport();
}

function stepOnce(direction = 1) {
  state.sim.pause();
  const result = state.sim.step(state.sim.stepSize * direction);
  refreshTransport();
  if (state.sim.blocked) toast(state.sim.message || 'Motion blocked.', 'error', 3600);
  void result;
}

function resetSimulation() {
  state.sim.pause();
  const result = state.sim.reset();
  refreshTransport();
  refreshReadouts();
  if (!result.converged) {
    toast('The design pose does not satisfy every constraint — check the reported error.', 'error', 4000);
  }
}

function nudgeCrank(delta) {
  const before = state.sim.converged;
  state.sim.pause();
  state.sim.nudgeDriveAngle(delta);
  refreshTransport();
  if (before && !state.sim.converged) toast(state.sim.message || 'That angle is unreachable.', 'error');
}

function setCrankAngleDegrees(value) {
  state.sim.pause();
  state.sim.setDriveAngle(rad(value));
  refreshTransport();
}

/* --------------------------------------------------------------- panels */

function refreshTransport() {
  const sim = state.sim;
  dom.btnPlay.textContent = sim.playing ? '⏸ Pause' : '▶ Play';
  dom.btnPlay.classList.toggle('is-playing', sim.playing);
  const motor = sim.mech.motors.find((m) => m.enabled) || sim.mech.motors[0];
  if (motor && document.activeElement !== dom.crankAngle) {
    const angleDeg = ((deg(motor.angle) % 360) + 360) % 360;
    dom.crankAngle.value = String(Math.round(angleDeg));
    dom.crankAngleOut.textContent = `${Math.round(angleDeg)}°`;
  }
  dom.btnUndo.disabled = !state.history.canUndo;
  dom.btnRedo.disabled = !state.history.canRedo;
}

function refreshStatus() {
  const sim = state.sim;
  const residuals = evaluateResiduals(state.mechanism);
  const status = sim.status();
  const mobility = analyzeMobility(state.mechanism);
  const parts = [];

  parts.push(el('span', {}, [el('b', { text: `${fmt(sim.time, 2)} s` })]));
  parts.push(
    el('span', {}, [
      'link error ',
      el('b', {
        class: residuals.maxLinkError < 1e-6 ? 'status-ok' : 'status-bad',
        text: `${residuals.maxLinkError.toExponential(1)} mm`,
      }),
    ]),
  );
  parts.push(
    el('span', {}, [
      'rail offset ',
      el('b', {
        class: residuals.maxSliderOffset < 1e-6 ? 'status-ok' : 'status-bad',
        text: `${residuals.maxSliderOffset.toExponential(1)} mm`,
      }),
    ]),
  );
  if (state.mechanism.motors.length) {
    parts.push(
      el('span', {}, [
        'motor error ',
        el('b', {
          class: residuals.maxMotorError < 1e-6 ? 'status-ok' : 'status-warn',
          text: `${fmt(deg(residuals.maxMotorError), 2)}°`,
        }),
      ]),
    );
  }
  const badgeClass =
    mobility.status === 'ok'
      ? 'status-ok'
      : mobility.status === 'over' || mobility.status === 'locked'
        ? 'status-bad'
        : 'status-warn';
  parts.push(
    el('span', {}, [
      'mobility ',
      el('b', { class: badgeClass, text: String(mobility.mobility) }),
      mobility.motors ? ` · driven by ${mobility.motors} motor${mobility.motors === 1 ? '' : 's'}` : '',
    ]),
  );
  if (state.mechanism.motors.length) {
    parts.push(el('span', {}, ['sub-steps ', el('b', { text: String(status.subSteps) })]));
  }
  parts.push(el('span', {}, [el('b', { text: `${state.fps.toFixed(0)} fps` })]));

  if (sim.playing) parts.push(el('span', { class: 'status-ok', text: '▶ running' }));
  else if (sim.blocked) parts.push(el('span', { class: 'status-bad', text: `⛔ ${sim.message}` }));
  else if (sim.atLimit) parts.push(el('span', { class: 'status-warn', text: '⏹ resting against a stop' }));
  else if (!sim.converged) parts.push(el('span', { class: 'status-warn', text: '⚠ pose not fully solved' }));

  dom.statusBar.replaceChildren(...parts);
}

function refreshStructure() {
  const mech = state.mechanism;
  const summary = structureSummary(mech);
  const mobility = analyzeMobility(mech);
  const v = validate(mech);
  const rows = [
    ['Fixed pivots', summary.counts.fixed],
    ['Rotating joints', summary.counts.revolute],
    ['Sliders', summary.counts.slider],
    ['Rigid links', summary.counts.links],
    ['Tracks', summary.counts.tracks],
    ['Motors', summary.counts.motors],
    ['Moving joints', summary.movingJoints],
    ['Separate parts', summary.parts],
    ['Mobility (before motors)', mobility.mobility],
    ['Mobility (with motors)', mobility.mobilityDriven],
  ];
  const nodes = rows.map(([label, value]) =>
    el('div', { class: 'kv' }, [el('span', { text: label }), el('span', { text: String(value) })]),
  );
  const badgeClass =
    mobility.status === 'ok'
      ? 'badge-ok'
      : mobility.status === 'over' || mobility.status === 'locked'
        ? 'badge-bad'
        : 'badge-warn';
  nodes.push(
    el('div', { class: 'kv' }, [
      el('span', { text: 'Status' }),
      el('span', {}, [el('span', { class: `badge ${badgeClass}`, text: mobility.status })]),
    ]),
  );
  nodes.push(el('p', { class: 'hint', text: mobility.note }));
  for (const warning of v.warnings.slice(0, 3)) {
    nodes.push(el('p', { class: 'warn-note', text: `⚠ ${warning}` }));
  }
  for (const error of v.errors.slice(0, 3)) {
    nodes.push(el('p', { class: 'bad-note', text: `⛔ ${error}` }));
  }
  dom.structureInfo.replaceChildren(...nodes);
}

function refreshDisplayToggles() {
  const view = state.mechanism.view;
  const items = [
    ['showGrid', 'Grid'],
    ['showLabels', 'Joint labels'],
    ['showCoordinates', 'Coordinates'],
    ['showDimensions', 'Lengths & dimensions'],
    ['showTraces', 'Motion paths'],
    ['snapToGrid', 'Snap to grid'],
  ];
  const nodes = items.map(([key, label]) =>
    el('label', { class: 'check' }, [
      el('input', {
        type: 'checkbox',
        checked: !!view[key],
        onchange: (event) => {
          view[key] = event.target.checked;
          state.needsRender = true;
        },
      }),
      el('span', { text: label }),
    ]),
  );
  nodes.push(
    el('label', { class: 'field' }, [
      el('span', { text: 'Grid size (mm)' }),
      el('input', {
        type: 'number',
        min: '1',
        step: '1',
        value: String(view.gridSize),
        onchange: (event) => {
          const value = parseFloat(event.target.value);
          if (value > 0) {
            view.gridSize = value;
            state.needsRender = true;
          }
        },
      }),
    ]),
  );
  dom.displayToggles.replaceChildren(...nodes);
}

function refreshReadouts() {
  const mech = state.mechanism;
  const report = measure(mech);
  const sliders = new Map(sliderReadouts(mech).map((s) => [s.id, s]));
  const travel = new Map(state.sim.travelReport().map((t) => [t.id, t]));
  let table;

  if (state.activeTab === 'joints') {
    const head = el('tr', {}, [
      el('th', { text: 'Joint' }),
      el('th', { text: 'Type' }),
      el('th', { class: 'num', text: 'X (mm)' }),
      el('th', { class: 'num', text: 'Y (mm)' }),
      el('th', { class: 'num', text: 'Travel' }),
    ]);
    const body = report.joints.map((joint) => {
      const t = travel.get(joint.id);
      const slider = sliders.get(joint.id);
      const typeLabel =
        joint.type === JOINT_FIXED ? 'fixed' : joint.type === JOINT_SLIDER ? 'slider' : 'revolute';
      const color =
        joint.type === JOINT_FIXED ? THEME.fixed : joint.type === JOINT_SLIDER ? THEME.slider : THEME.revolute;
      const cells = [
        el('td', {}, [
          el('span', { class: 'type-dot', style: `background:${color}` }),
          joint.name,
        ]),
        el('td', { text: typeLabel }),
        el('td', { class: 'num', text: fmt(joint.x, 2) }),
        el('td', { class: 'num', text: fmt(joint.y, 2) }),
        el('td', {
          class: 'num',
          text: t ? `${fmt(t.dx, 1)}×${fmt(t.dy, 1)}` : '—',
        }),
      ];
      const row = el('tr', { class: 'clickable' }, cells);
      if (state.selection.has(joint.id)) row.classList.add('is-selected');
      row.addEventListener('click', () => {
        state.selection = new Set([joint.id]);
        refreshUI({ inspector: true });
        state.needsRender = true;
      });
      if (slider) {
        row.title = `${joint.name} rides on ${slider.trackName} at s = ${fmt(slider.s, 2)} mm`;
      }
      return row;
    });
    table = el('table', {}, [el('thead', {}, [head]), el('tbody', {}, body)]);
  } else if (state.activeTab === 'links') {
    const head = el('tr', {}, [
      el('th', { text: 'Link' }),
      el('th', { text: 'Between' }),
      el('th', { class: 'num', text: 'Exact' }),
      el('th', { class: 'num', text: 'Measured' }),
      el('th', { class: 'num', text: 'Error' }),
    ]);
    const body = report.links.map((link) => {
      const ja = getJoint(mech, link.a);
      const jb = getJoint(mech, link.b);
      const bad = Math.abs(link.error) > 1e-4;
      const row = el('tr', { class: 'clickable' }, [
        el('td', { text: link.name }),
        el('td', { text: `${ja ? ja.name : '?'} – ${jb ? jb.name : '?'}` }),
        el('td', { class: 'num', text: fmt(link.length, 2) }),
        el('td', { class: 'num', text: fmt(link.measured, 2) }),
        el('td', {
          class: `num ${bad ? 'bad' : 'ok'}`,
          text: bad ? `${link.error > 0 ? '+' : ''}${fmt(link.error, 4)}` : '0.0000',
        }),
      ]);
      if (state.selection.has(link.id)) row.classList.add('is-selected');
      row.addEventListener('click', () => {
        state.selection = new Set([link.id]);
        refreshUI({ inspector: true });
        state.needsRender = true;
      });
      return row;
    });
    table = el('table', {}, [el('thead', {}, [head]), el('tbody', {}, body)]);
  } else {
    const head = el('tr', {}, [
      el('th', { text: 'Motor' }),
      el('th', { text: 'Link' }),
      el('th', { class: 'num', text: 'Speed' }),
      el('th', { class: 'num', text: 'Command' }),
      el('th', { class: 'num', text: 'Actual' }),
    ]);
    const body = mech.motors.map((motor) => {
      const joint = getJoint(mech, motor.jointId);
      const link = getLink(mech, motor.linkId);
      const other = link && joint ? getJoint(mech, otherEnd(link, joint.id)) : null;
      const actual = other && joint ? Math.atan2(other.y - joint.y, other.x - joint.x) : NaN;
      const row = el('tr', { class: 'clickable' }, [
        el('td', { text: joint ? joint.name : '?' }),
        el('td', { text: link ? link.name : '?' }),
        el('td', { class: 'num', text: `${fmt((motor.omega * 60) / TAU, 1)} rpm` }),
        el('td', { class: 'num', text: `${fmt(deg(motor.angle), 1)}°` }),
        el('td', { class: 'num', text: `${fmt(deg(actual), 1)}°` }),
      ]);
      if (state.selection.has(motor.id)) row.classList.add('is-selected');
      row.addEventListener('click', () => {
        state.selection = new Set([motor.id]);
        refreshUI({ inspector: true });
        state.needsRender = true;
      });
      return row;
    });
    if (body.length === 0) {
      table = el('p', { class: 'empty-note', text: 'No motor yet — pick the Motor tool and click a joint.' });
    } else {
      table = el('table', {}, [el('thead', {}, [head]), el('tbody', {}, body)]);
    }
  }
  dom.readout.replaceChildren(table);
}

/* -------------------------------------------------------------- inspector */

/**
 * A numeric field whose displayed value follows the model.
 *
 * `read` is a getter, so the field stays in sync while a joint is being dragged
 * or the simulation is running, without ever rebuilding the DOM (which would
 * steal focus or swallow clicks).
 */
function numberField(label, read, onChange, options = {}) {
  const current = typeof read === 'function' ? read() : read;
  const input = el('input', {
    type: 'number',
    step: options.step || '0.5',
    value: Number.isFinite(current) ? formatFieldValue(current) : '',
    min: options.min,
    max: options.max,
    dataset: { live: '1' },
  });
  input.__read = typeof read === 'function' ? read : () => current;
  const commitValue = () => {
    const parsed = parseFloat(input.value);
    if (!Number.isFinite(parsed)) {
      input.value = formatFieldValue(input.__read());
      return;
    }
    onChange(parsed);
  };
  input.addEventListener('change', commitValue);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      commitValue();
      input.blur();
    }
  });
  return el('label', { class: 'field' }, [el('span', { text: label }), input]);
}

function formatFieldValue(value) {
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value * 1e6) / 1e6);
}

/** Refresh every live field that the user is not currently editing. */
function syncLiveFields() {
  for (const input of dom.inspector.querySelectorAll('input[data-live]')) {
    if (document.activeElement === input || typeof input.__read !== 'function') continue;
    const next = formatFieldValue(input.__read());
    if (next !== '' && input.value !== next) input.value = next;
  }
}

function textField(label, value, onChange) {
  const input = el('input', { type: 'text', value: value || '' });
  input.addEventListener('change', () => onChange(input.value));
  return el('label', { class: 'field' }, [el('span', { text: label }), input]);
}

function refreshInspector() {
  const mech = state.mechanism;
  const ids = [...state.selection];
  const nodes = [];

  if (ids.length === 0) {
    nodes.push(
      el('p', {
        class: 'empty-note',
        text:
          'Nothing selected. Click a joint, link, rail or motor on the canvas — or start from a preset on the left.',
      }),
    );
  } else if (ids.length > 1) {
    nodes.push(el('h3', {}, [`${ids.length} objects selected`]));
    nodes.push(
      el('div', { class: 'field-row' }, [
        el('button', {
          class: 'btn is-danger',
          type: 'button',
          text: 'Delete selection',
          onclick: deleteSelection,
        }),
        el('button', {
          class: 'btn',
          type: 'button',
          text: 'Clear selection',
          onclick: () => {
            state.selection.clear();
            refreshUI({ inspector: true });
            state.needsRender = true;
          },
        }),
      ]),
    );
  } else {
    const id = ids[0];
    const kind = entityKind(mech, id);
    if (kind === 'joint') nodes.push(...jointInspector(getJoint(mech, id)));
    else if (kind === 'link') nodes.push(...linkInspector(getLink(mech, id)));
    else if (kind === 'track') nodes.push(...trackInspector(getTrack(mech, id)));
    else if (kind === 'motor') nodes.push(...motorInspector(getMotor(mech, id)));
  }

  dom.inspector.replaceChildren(...nodes);
}

function jointInspector(joint) {
  const mech = state.mechanism;
  const color =
    joint.type === JOINT_FIXED ? THEME.fixed : joint.type === JOINT_SLIDER ? THEME.slider : THEME.revolute;
  const nodes = [];
  nodes.push(
    el('h3', {}, [el('span', { class: 'swatch', style: `background:${color}` }), `${joint.name} · joint`]),
  );

  const typeSelect = el(
    'select',
    {
      onchange: (event) => {
        const next = event.target.value;
        commit('change joint type', () => {
          joint.type = next;
          if (next === JOINT_SLIDER) {
            const near = nearestTrack(mech, joint, Infinity);
            if (near) {
              joint.trackId = near.track.id;
            } else {
              toast('No rail available — add a track first.', 'error');
              joint.type = JOINT_REVOLUTE;
            }
          } else {
            joint.trackId = null;
          }
          if (next === JOINT_FIXED) setJointHome(mech, joint.id, joint);
        });
      },
    },
    Object.entries(JOINT_TYPE_LABELS).map(([value, label]) =>
      el('option', { value, selected: joint.type === value, text: label }),
    ),
  );
  nodes.push(el('label', { class: 'field' }, [el('span', { text: 'Type' }), typeSelect]));
  nodes.push(textField('Name', joint.name, (value) => {
    commit('rename joint', () => {
      joint.name = value || joint.name;
    });
  }));

  const xField = numberField('X (mm)', () => joint.x, (value) =>
    commit('move joint', () => {
      joint.x = value;
      setJointHome(mech, joint.id, joint);
    }),
  );
  const yField = numberField('Y (mm)', () => joint.y, (value) =>
    commit('move joint', () => {
      joint.y = value;
      setJointHome(mech, joint.id, joint);
    }),
  );
  nodes.push(el('div', { class: 'field-row' }, [xField, yField]));

  if (joint.type === JOINT_SLIDER) {
    const trackSelect = el(
      'select',
      {
        onchange: (event) => {
          commit('change joint track', () => {
            joint.trackId = event.target.value;
            const track = getTrack(mech, joint.trackId);
            if (track) {
              const l = dist(track.a, track.b) || 1;
              const u = { x: (track.b.x - track.a.x) / l, y: (track.b.y - track.a.y) / l };
              const projected = projectOnLine(joint, track.a, u).point;
              joint.x = projected.x;
              joint.y = projected.y;
              setJointHome(mech, joint.id, joint);
            }
          });
        },
      },
      mech.tracks.map((t) => el('option', { value: t.id, selected: joint.trackId === t.id, text: t.name })),
    );
    nodes.push(el('label', { class: 'field' }, [el('span', { text: 'Rides on rail' }), trackSelect]));
    const readout = sliderReadouts(mech).find((s) => s.id === joint.id);
    if (readout) {
      nodes.push(
        el('div', { class: 'kv-list' }, [
          el('div', { class: 'kv' }, [
            el('span', { text: 'Position along rail' }),
            el('span', { text: `${fmt(readout.s, 2)} mm` }),
          ]),
          el('div', { class: 'kv' }, [
            el('span', { text: 'Off-rail error' }),
            el('span', { text: `${readout.offset.toExponential(1)} mm` }),
          ]),
        ]),
      );
    }
  }

  nodes.push(
    el('p', {
      class: 'hint',
      text:
        joint.type === JOINT_FIXED
          ? 'Fixed pivots are the mechanism’s ground. Their position is the design pose.'
          : 'Drag this joint on the canvas: every link stays rigid while the solver follows.',
    }),
  );

  nodes.push(
    el('div', { class: 'field-row' }, [
      el('button', {
        class: 'btn is-danger',
        type: 'button',
        text: 'Delete joint',
        onclick: () =>
          commit('delete joint', () => {
            removeEntity(mech, joint.id);
            state.selection.clear();
          }),
      }),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Select attached links',
        onclick: () => {
          state.selection = new Set(linksAtJoint(mech, joint.id).map((l) => l.id));
          refreshUI({ inspector: true });
          state.needsRender = true;
        },
      }),
    ]),
  );
  return nodes;
}

function linkInspector(link) {
  const mech = state.mechanism;
  const ja = getJoint(mech, link.a);
  const jb = getJoint(mech, link.b);
  const measured = ja && jb ? dist(ja, jb) : NaN;
  const error = measured - link.length;
  const nodes = [];

  nodes.push(el('h3', {}, [el('span', { class: 'swatch', style: `background:${THEME.link}` }), `${link.name} · rigid link`]));
  nodes.push(textField('Name', link.name, (value) => {
    commit('rename link', () => {
      link.name = value || link.name;
    });
  }));

  nodes.push(
    numberField(
      'Exact length (mm)',
      () => link.length,
      (value) =>
        commit('change link length', () => {
          if (value > 0) link.length = value;
        }),
      { step: '1', min: '0.01' },
    ),
  );

  nodes.push(
    el('div', { class: 'kv-list' }, [
      el('div', { class: 'kv' }, [
        el('span', { text: 'Connects' }),
        el('span', { text: `${ja ? ja.name : '?'} – ${jb ? jb.name : '?'}` }),
      ]),
      el('div', { class: 'kv' }, [el('span', { text: 'Measured now' }), el('span', { text: `${fmt(measured, 3)} mm` })]),
      el('div', { class: 'kv' }, [
        el('span', { text: 'Length error' }),
        el('span', {
          class: Math.abs(error) < 1e-6 ? 'status-ok' : 'status-bad',
          text: `${error >= 0 ? '+' : ''}${error.toExponential(1)} mm`,
        }),
      ]),
    ]),
  );

  const suggestions = [50, 80, 100, 120, 150, 200];
  nodes.push(
    el(
      'div',
      { class: 'field-row' },
      suggestions.map((value) =>
        el('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: `${value}`,
          title: `Set the exact length to ${value} mm`,
          onclick: () =>
            commit('set link length', () => {
              link.length = value;
            }),
        }),
      ),
    ),
  );

  nodes.push(
    el('div', { class: 'field-row' }, [
      el('button', {
        class: 'btn is-danger',
        type: 'button',
        text: 'Delete link',
        onclick: () =>
          commit('delete link', () => {
            removeEntity(mech, link.id);
            state.selection.clear();
          }),
      }),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Use measured length',
        onclick: () =>
          commit('set link length', () => {
            link.length = measured;
          }),
      }),
    ]),
  );
  return nodes;
}

function trackInspector(track) {
  const mech = state.mechanism;
  const nodes = [];
  const length = dist(track.a, track.b);
  nodes.push(
    el('h3', {}, [el('span', { class: 'swatch', style: `background:${THEME.slider}` }), `${track.name} · rail`]),
  );

  const axis = (key, label) =>
    el('div', { class: 'field-row' }, [
      numberField(`${label} X`, () => track[key].x, (value) =>
        commit('move rail end', () => {
          track[key].x = value;
          track.home[key].x = value;
        }),
      ),
      numberField(`${label} Y`, () => track[key].y, (value) =>
        commit('move rail end', () => {
          track[key].y = value;
          track.home[key].y = value;
        }),
      ),
    ]);
  nodes.push(axis('a', 'Start'));
  nodes.push(axis('b', 'End'));

  nodes.push(
    el('div', { class: 'kv-list' }, [
      el('div', { class: 'kv' }, [el('span', { text: 'Rail length' }), el('span', { text: `${fmt(length, 2)} mm` })]),
      el('div', { class: 'kv' }, [
        el('span', { text: 'Angle' }),
        el('span', { text: `${fmt(deg(wrapPi(Math.atan2(track.b.y - track.a.y, track.b.x - track.a.x))), 2)}°` }),
      ]),
      el('div', { class: 'kv' }, [
        el('span', { text: 'Sliders on rail' }),
        el('span', { text: String(mech.joints.filter((j) => j.trackId === track.id).length) }),
      ]),
    ]),
  );

  const limits = track.limits || { enabled: false, min: null, max: null };
  track.limits = limits;
  const enable = el('input', {
    type: 'checkbox',
    checked: !!limits.enabled,
    onchange: (event) => {
      commit('toggle rail stops', () => {
        limits.enabled = event.target.checked;
        if (limits.enabled) {
          const l = dist(track.a, track.b) || 1;
          const u = { x: (track.b.x - track.a.x) / l, y: (track.b.y - track.a.y) / l };
          const sliders = mech.joints.filter((j) => j.trackId === track.id);
          const positions = sliders.map((j) => (j.x - track.a.x) * u.x + (j.y - track.a.y) * u.y);
          if (!Number.isFinite(limits.min)) {
            limits.min = positions.length ? Math.min(...positions) - 20 : -l / 2;
          }
          if (!Number.isFinite(limits.max)) {
            limits.max = positions.length ? Math.max(...positions) + 20 : l / 2;
          }
        }
      });
    },
  });
  nodes.push(el('label', { class: 'check' }, [enable, el('span', { text: 'End stops (limits travel)' })]));
  if (limits.enabled) {
    nodes.push(
      el('div', { class: 'field-row' }, [
        numberField('Min travel', () => limits.min, (value) =>
          commit('rail stop', () => {
            limits.min = value;
          }),
        ),
        numberField('Max travel', () => limits.max, (value) =>
          commit('rail stop', () => {
            limits.max = value;
          }),
        ),
      ]),
    );
    nodes.push(
      el('p', {
        class: 'hint',
        text: 'Travel is measured in mm along the rail from its start point. A slider that reaches a stop jams the mechanism — the simulation reports it.',
      }),
    );
  }

  nodes.push(
    el('div', { class: 'field-row' }, [
      el('button', {
        class: 'btn is-danger',
        type: 'button',
        text: 'Delete rail',
        onclick: () =>
          commit('delete rail', () => {
            removeEntity(mech, track.id);
            state.selection.clear();
          }),
      }),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Add slider here',
        onclick: () =>
          commit('add slider', () => {
            const mid = { x: (track.a.x + track.b.x) / 2, y: (track.a.y + track.b.y) / 2 };
            const joint = addSlider(mech, mid.x, mid.y, track.id);
            state.selection = new Set([joint.id]);
          }),
      }),
    ]),
  );
  return nodes;
}

function motorInspector(motor) {
  const mech = state.mechanism;
  const joint = getJoint(mech, motor.jointId);
  const link = getLink(mech, motor.linkId);
  const nodes = [];
  nodes.push(el('h3', {}, [el('span', { class: 'swatch', style: `background:${THEME.motor}` }), 'Motor']));

  const linkSelect = el(
    'select',
    {
      onchange: (event) => {
        commit('change driven link', () => {
          motor.linkId = event.target.value;
          const chosen = getLink(mech, motor.linkId);
          const other = getJoint(mech, otherEnd(chosen, motor.jointId));
          motor.angle = other ? Math.atan2(other.y - joint.y, other.x - joint.x) : 0;
          motor.angleHome = motor.angle;
        });
      },
    },
    linksAtJoint(mech, motor.jointId).map((l) =>
      el('option', { value: l.id, selected: l.id === motor.linkId, text: `${l.name} (${fmt(l.length, 1)} mm)` }),
    ),
  );
  nodes.push(el('label', { class: 'field' }, [el('span', { text: 'Driving joint' }), el('input', { type: 'text', value: joint ? joint.name : '?', disabled: true })]));
  nodes.push(el('label', { class: 'field' }, [el('span', { text: 'Driven link (the crank)' }), linkSelect]));

  nodes.push(
    numberField(
      'Speed (rpm)',
      () => (motor.omega * 60) / TAU,
      (value) =>
        commit('motor speed', () => {
          motor.omega = (value * TAU) / 60;
        }),
      { step: '1' },
    ),
  );
  nodes.push(
    numberField(
      'Commanded angle (°)',
      () => deg(motor.angle),
      (value) =>
        commit('motor angle', () => {
          motor.angle = rad(value);
          motor.angleHome = motor.angle;
        }),
      { step: '5' },
    ),
  );

  const enabled = el('input', {
    type: 'checkbox',
    checked: motor.enabled !== false,
    onchange: (event) => {
      commit('toggle motor', () => {
        motor.enabled = event.target.checked;
      });
    },
  });
  nodes.push(el('label', { class: 'check' }, [enabled, el('span', { text: 'Motor enabled' })]));

  const actual = (() => {
    if (!joint || !link) return NaN;
    const other = getJoint(mech, otherEnd(link, joint.id));
    return other ? Math.atan2(other.y - joint.y, other.x - joint.x) : NaN;
  })();
  nodes.push(
    el('div', { class: 'kv-list' }, [
      el('div', { class: 'kv' }, [el('span', { text: 'Actual crank angle' }), el('span', { text: `${fmt(deg(actual), 2)}°` })]),
      el('div', { class: 'kv' }, [
        el('span', { text: 'Tracking error' }),
        el('span', { text: `${fmt(deg(wrapPi(actual - motor.angle)), 3)}°` }),
      ]),
      el('div', { class: 'kv' }, [el('span', { text: 'Speed' }), el('span', { text: `${fmt(motor.omega, 3)} rad/s` })]),
    ]),
  );

  nodes.push(
    el('div', { class: 'field-row' }, [
      el('button', {
        class: 'btn is-danger',
        type: 'button',
        text: 'Delete motor',
        onclick: () =>
          commit('delete motor', () => {
            removeEntity(mech, motor.id);
            state.selection.clear();
          }),
      }),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Reverse direction',
        onclick: () =>
          commit('reverse motor', () => {
            motor.omega = -motor.omega;
          }),
      }),
    ]),
  );
  return nodes;
}

/* ------------------------------------------------------------ save / load */

function refreshSlots() {
  let slots = [];
  try {
    slots = listSlots(STORAGE);
  } catch {
    slots = [];
  }
  const nodes = slots.map((slot) =>
    el('div', { class: 'slot' }, [
      el('div', { class: 'slot-info' }, [
        el('div', { class: 'slot-name', text: slot.name }),
        el('div', {
          class: 'slot-meta',
          text: `${slot.savedAt ? new Date(slot.savedAt).toLocaleString() : 'saved earlier'}${
            slot.jointCount != null ? ` · ${slot.jointCount} joints` : ''
          }`,
        }),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        text: 'Load',
        onclick: () => {
          try {
            const { mechanism, warnings } = loadSlot(slot.name, STORAGE);
            setMechanism(mechanism);
            toast(
              warnings.length ? `Loaded “${slot.name}” with ${warnings.length} warning(s).` : `Loaded “${slot.name}”.`,
              warnings.length ? 'error' : 'good',
            );
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      }),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: '✕',
        title: 'Delete this saved mechanism',
        onclick: () => {
          try {
            deleteSlot(slot.name, STORAGE);
            refreshSlots();
            toast(`Deleted “${slot.name}”.`);
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      }),
    ]),
  );
  if (nodes.length === 0) {
    nodes.push(el('p', { class: 'empty-note', text: 'No saved mechanisms yet. Name one above and press Save.' }));
  }
  dom.slotList.replaceChildren(...nodes);
}

function saveCurrentSlot() {
  const name = (dom.slotName.value || state.mechanism.name || '').trim();
  if (!name) {
    toast('Give the mechanism a name first.', 'error');
    dom.slotName.focus();
    return;
  }
  try {
    state.mechanism.name = name;
    dom.mechName.value = name;
    saveSlot(name, state.mechanism, STORAGE);
    refreshSlots();
    toast(`Saved “${name}”.`, 'good');
  } catch (error) {
    toast(
      error instanceof StorageUnavailableError
        ? 'Browser storage is unavailable here — use Export .json instead.'
        : error.message,
      'error',
      4200,
    );
  }
}

function exportJson() {
  try {
    const text = serialize(state.mechanism);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = el('a', { href: url, download: `${(state.mechanism.name || 'mechanism').replace(/[^\w.-]+/g, '_')}.json` });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Mechanism exported as JSON.', 'good');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { mechanism, warnings } = deserialize(String(reader.result));
      setMechanism(mechanism);
      toast(
        warnings.length
          ? `Imported with ${warnings.length} warning(s): ${warnings[0]}`
          : `Imported “${mechanism.name}”.`,
        warnings.length ? 'error' : 'good',
        4000,
      );
    } catch (error) {
      toast(`Import failed: ${error.message}`, 'error', 4600);
    }
  };
  reader.onerror = () => toast('Could not read that file.', 'error');
  reader.readAsText(file);
}

/* ------------------------------------------------------------------- undo */

function undo() {
  const snapshot = state.history.undo({ mechanism: state.mechanism, selection: [...state.selection] });
  if (!snapshot) {
    toast('Nothing to undo.');
    return;
  }
  applySnapshot(snapshot);
  toast('Undo.');
}

function redo() {
  const snapshot = state.history.redo({ mechanism: state.mechanism, selection: [...state.selection] });
  if (!snapshot) {
    toast('Nothing to redo.');
    return;
  }
  applySnapshot(snapshot);
  toast('Redo.');
}

function applySnapshot(snapshot) {
  state.mechanism = snapshot.mechanism;
  state.selection = new Set((snapshot.selection || []).filter((id) => entityKind(state.mechanism, id)));
  state.sim = new Simulation(state.mechanism);
  dom.mechName.value = state.mechanism.name || 'Untitled mechanism';
  solveConstraints(state.mechanism);
  autosave();
  refreshUI({ inspector: true, slots: true });
  state.needsRender = true;
}

/* ------------------------------------------------------------------- boot */

function setTool(id) {
  state.tool = id;
  state.pending = null;
  const tool = TOOLS.find((t) => t.id === id);
  setHint(tool ? tool.hint : '');
  for (const button of dom.toolGrid.querySelectorAll('button')) {
    button.classList.toggle('is-active', button.dataset.tool === id);
  }
  if (dom.toolHint) dom.toolHint.textContent = tool ? tool.hint : '';
  if (dom.canvas) dom.canvas.style.cursor = id === 'select' ? 'grab' : 'crosshair';
}

function refreshUI(options = {}) {
  if (options.inspector !== false) refreshInspector();
  refreshReadouts();
  refreshStructure();
  refreshStatus();
  refreshTransport();
  if (options.slots) refreshSlots();
}

function buildToolButtons() {
  dom.toolGrid.replaceChildren(
    ...TOOLS.map((tool) =>
      el(
        'button',
        {
          class: 'btn tool-btn',
          type: 'button',
          dataset: { tool: tool.id },
          title: `${tool.label} (${tool.key})`,
          onclick: () => setTool(tool.id),
        },
        [
          el('span', { class: 'tool-icon', text: tool.icon }),
          el('span', { text: tool.label }),
          el('span', { class: 'tool-key', text: tool.key }),
        ],
      ),
    ),
  );
}

function buildPresetButtons() {
  dom.presetList.replaceChildren(
    ...PRESETS.map((preset) =>
      el(
        'button',
        {
          class: 'btn preset-btn',
          type: 'button',
          onclick: () => {
            state.history.push('load preset', { mechanism: state.mechanism, selection: [...state.selection] });
            const mech = buildPreset(preset.id);
            setMechanism(mech, { keepHistory: true });
            toast(`Loaded the ${preset.name}.`, 'good');
          },
        },
        [el('span', { text: preset.name }), el('small', { text: preset.description })],
      ),
    ),
  );
}

function toggleHelp(show) {
  const overlay = dom.helpOverlay;
  const next = show != null ? show : overlay.hidden;
  overlay.hidden = !next;
  if (next && dom.btnHelpClose) dom.btnHelpClose.focus();
}

function frame(now) {
  const dt = state.lastFrameTime ? Math.min((now - state.lastFrameTime) / 1000, 0.08) : 0;
  state.lastFrameTime = now;
  if (dt > 0) state.fps = state.fps ? state.fps * 0.9 + (1 / dt) * 0.1 : 1 / dt;

  const sim = state.sim;
  if (sim.playing) {
    sim.advance(dt * sim.speed);
    state.needsRender = true;
    if (sim.blocked) {
      refreshTransport();
      toast(sim.message || 'Motion blocked.', 'error', 4200);
    }
  }

  if (state.needsRender) {
    render();
    state.needsRender = false;
  }

  if (now - state.lastReadoutRefresh > 140) {
    state.lastReadoutRefresh = now;
    refreshReadouts();
    refreshStatus();
    refreshTransport();
    refreshStructure();
    syncLiveFields();
    if (state.drag && state.drag.moved && state.selection.size === 1) {
      // keep the kv read-outs (measured length, tracking error) honest while dragging
      refreshInspector();
    }
  }
  requestAnimationFrame(frame);
}

function boot() {
  dom.canvas = $('canvas');
  dom.mechName = $('mech-name');
  dom.btnPlay = $('btn-play');
  dom.btnStep = $('btn-step');
  dom.btnBackStep = $('btn-back-step');
  dom.btnFwdStep = $('btn-fwd-step');
  dom.btnReset = $('btn-reset');
  dom.btnClearTraces = $('btn-clear-traces');
  dom.btnUndo = $('btn-undo');
  dom.btnRedo = $('btn-redo');
  dom.btnFit = $('btn-fit');
  dom.btnHelp = $('btn-help');
  dom.btnHelpClose = $('btn-help-close');
  dom.helpOverlay = $('help-overlay');
  dom.crankAngle = $('crank-angle');
  dom.crankAngleOut = $('crank-angle-out');
  dom.playSpeed = $('play-speed');
  dom.playSpeedOut = $('play-speed-out');
  dom.toolGrid = $('tool-grid');
  dom.toolHint = $('tool-hint');
  dom.presetList = $('preset-list');
  dom.displayToggles = $('display-toggles');
  dom.structureInfo = $('structure-info');
  dom.inspector = $('inspector');
  dom.readout = $('readout');
  dom.statusBar = $('status-bar');
  dom.canvasHint = $('canvas-hint');
  dom.slotName = $('slot-name');
  dom.slotList = $('slot-list');
  dom.btnSaveSlot = $('btn-save-slot');
  dom.btnExport = $('btn-export');
  dom.btnImport = $('btn-import');
  dom.fileInput = $('file-input');
  dom.storageNote = $('storage-note');
  dom.btnNew = $('btn-new');
  dom.linkLength = $('link-length');
  dom.linkLengthLock = $('link-length-lock');
  dom.toast = $('toast');

  buildToolButtons();
  buildPresetButtons();
  refreshDisplayToggles();

  // Restore the previous session, otherwise start from the four-bar example.
  let initial = null;
  let restored = false;
  try {
    const raw = STORAGE.getItem(AUTOSAVE_KEY);
    if (raw) {
      const { mechanism } = deserialize(raw);
      if (mechanism.joints.length) {
        initial = mechanism;
        restored = true;
      }
    }
  } catch {
    initial = null;
  }
  if (!initial) initial = buildPreset('four-bar');
  setMechanism(initial, { fit: false });
  resizeCanvas();
  fitView();
  setTool('select');
  refreshSlots();

  dom.storageNote.textContent = STORAGE_PERSISTENT
    ? 'Saved mechanisms live in this browser (localStorage) and are restored next time. Use Export .json to keep a copy in a file.'
    : 'Browser storage is unavailable in this context (private mode or file://), so saving keeps names only for this session. Use Export .json to keep a copy in a file.';

  /* events */
  dom.canvas.addEventListener('pointerdown', onPointerDown);
  dom.canvas.addEventListener('pointermove', onPointerMove);
  dom.canvas.addEventListener('pointerup', onPointerUp);
  dom.canvas.addEventListener('pointercancel', onPointerUp);
  dom.canvas.addEventListener('pointerleave', () => {
    if (!state.drag) {
      state.hover = null;
      state.needsRender = true;
    }
  });
  dom.canvas.addEventListener('wheel', onWheel, { passive: false });
  dom.canvas.addEventListener('dblclick', onDoubleClick);
  dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => {
    resizeCanvas();
    state.needsRender = true;
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      resizeCanvas();
      state.needsRender = true;
    }).observe(dom.canvas.parentElement);
  }

  dom.btnPlay.addEventListener('click', togglePlay);
  dom.btnStep.addEventListener('click', () => stepOnce(1));
  dom.btnBackStep.addEventListener('click', () => nudgeCrank(rad(-2)));
  dom.btnFwdStep.addEventListener('click', () => nudgeCrank(rad(2)));
  dom.btnReset.addEventListener('click', resetSimulation);
  dom.btnClearTraces.addEventListener('click', () => {
    state.sim.clearTraces();
    state.needsRender = true;
  });
  dom.btnUndo.addEventListener('click', undo);
  dom.btnRedo.addEventListener('click', redo);
  dom.btnFit.addEventListener('click', fitView);
  dom.btnHelp.addEventListener('click', () => toggleHelp());
  dom.btnHelpClose.addEventListener('click', () => toggleHelp(false));
  dom.helpOverlay.addEventListener('click', (event) => {
    if (event.target === dom.helpOverlay) toggleHelp(false);
  });

  dom.crankAngle.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    dom.crankAngleOut.textContent = `${Math.round(value)}°`;
    setCrankAngleDegrees(value);
    refreshReadouts();
    state.needsRender = true;
  });
  dom.playSpeed.addEventListener('input', (event) => {
    const speed = parseFloat(event.target.value) / 100;
    state.sim.setSpeed(speed);
    dom.playSpeedOut.textContent = `${speed.toFixed(2)}×`;
  });

  dom.mechName.addEventListener('change', () => {
    state.mechanism.name = dom.mechName.value.trim() || 'Untitled mechanism';
    dom.slotName.value = state.mechanism.name;
    autosave();
  });

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      for (const other of document.querySelectorAll('.tab')) other.classList.toggle('is-active', other === tab);
      refreshReadouts();
    });
  }

  dom.btnNew.addEventListener('click', () => {
    state.history.push('new mechanism', { mechanism: state.mechanism, selection: [...state.selection] });
    const blank = createMechanism('Untitled mechanism');
    blank.view = { ...state.mechanism.view };
    setMechanism(blank, { keepHistory: true });
    setTool('fixed');
    toast('Blank canvas — place a fixed pivot to begin. Press ? for the guide.', 'good', 3800);
  });

  dom.btnSaveSlot.addEventListener('click', saveCurrentSlot);
  dom.btnExport.addEventListener('click', exportJson);
  dom.btnImport.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importJsonFile(file);
    event.target.value = '';
  });

  // Drag & drop a .json mechanism onto the canvas.
  dom.canvas.addEventListener('dragover', (event) => event.preventDefault());
  dom.canvas.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) importJsonFile(file);
  });

  dom.slotName.value = state.mechanism.name;
  refreshUI({ inspector: true, slots: true });
  requestAnimationFrame(frame);

  if (restored) {
    toast('Restored your last session. Pick a preset on the left to start from an example.', 'good', 4200);
  } else {
    toast('Four-bar linkage loaded — press Play, or pick another preset.', 'good', 4200);
  }

  // Expose a tiny hook for manual inspection in the browser console.
  window.linkageDesigner = { state, solveConstraints, solveWithMotorRamp, Simulation, renderScene };
}

if (typeof document !== 'undefined' && document.getElementById) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

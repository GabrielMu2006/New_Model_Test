/**
 * Ready-made mechanisms.
 *
 * Every preset is built from exact geometry: the initial pose satisfies all
 * constraint equations to machine precision, so the simulation starts clean.
 *
 * - Four-bar linkage (crank-rocker, Grashof)
 * - Crank-slider (in-line, slider travels 2x the crank radius)
 * - Offset crank-slider
 * - Double-rocker four-bar (non-Grashof: demonstrates jam detection)
 */

import { dist, rad } from './math.js';
import {
  addFixedPivot,
  addLink,
  addMotor,
  addRevoluteJoint,
  addSlider,
  addTrack,
  captureHome,
  createMechanism,
} from './model.js';

/**
 * Intersection of two circles; `branch` selects one of the two solutions.
 * Returns null when the circles do not intersect.
 */
export function circleIntersect(c1, r1, c2, r2, branch = 1) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) return null;
  if (d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = Math.sqrt(Math.max(0, hSq));
  const xm = c1.x + (a * dx) / d;
  const ym = c1.y + (a * dy) / d;
  const rx = (-dy / d) * h * branch;
  const ry = (dx / d) * h * branch;
  return { x: xm + rx, y: ym + ry };
}

/** A point at `angle` on a circle around `center`. */
function polar(center, radius, angle) {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

/* ------------------------------------------------------------------ four-bar */

/**
 * Classic crank-rocker: the crank (AB) turns a full revolution and the rocker
 * (CD) swings back and forth. Link lengths are Grashof-valid:
 * shortest + longest (40 + 120 = 160) <= other two (120 + 90 = 210).
 */
export function buildFourBar(options = {}) {
  const crank = options.crankLength != null ? options.crankLength : 40;
  const coupler = options.couplerLength != null ? options.couplerLength : 120;
  const rocker = options.rockerLength != null ? options.rockerLength : 90;
  const ground = options.groundLength != null ? options.groundLength : 120;

  const mech = createMechanism('Four-bar linkage');
  const A = addFixedPivot(mech, 0, 0, { name: 'A' });
  const D = addFixedPivot(mech, ground, 0, { name: 'D' });

  const crankAngle = rad(options.crankAngleDeg != null ? options.crankAngleDeg : 60);
  const Bpos = polar(A, crank, crankAngle);
  const B = addRevoluteJoint(mech, Bpos.x, Bpos.y, { name: 'B' });
  const Cpos =
    circleIntersect(Bpos, coupler, { x: D.x, y: D.y }, rocker, 1) || { x: D.x, y: rocker };
  const C = addRevoluteJoint(mech, Cpos.x, Cpos.y, { name: 'C' });

  const groundLink = addLink(mech, A.id, D.id, { name: 'ground', length: ground, kind: 'ground' });
  const crankLink = addLink(mech, A.id, B.id, { name: 'crank', length: crank });
  addLink(mech, B.id, C.id, { name: 'coupler', length: coupler });
  addLink(mech, C.id, D.id, { name: 'rocker', length: rocker });

  addMotor(mech, A.id, crankLink.id, { omega: 2.4 });
  captureHome(mech);
  // The ground link is defined by the two fixed pivots.
  groundLink.length = dist(A, D);
  return mech;
}

/* -------------------------------------------------------------- crank-slider */

/**
 * In-line crank-slider: the crank (OA) rotates, the connecting rod (AB) pushes
 * the slider B along a straight rail through the crank centre. With
 * crank < rod the crank turns continuously and the slider stroke is 2 * crank.
 */
export function buildCrankSlider(options = {}) {
  const crank = options.crankLength != null ? options.crankLength : 40;
  const rod = options.rodLength != null ? options.rodLength : 140;
  const offset = options.offset != null ? options.offset : 0;
  const railBack = options.railBack != null ? options.railBack : 60;
  const railFront = options.railFront != null ? options.railFront : crank + rod + 40;

  const mech = createMechanism(offset === 0 ? 'Crank-slider mechanism' : 'Offset crank-slider');
  const O = addFixedPivot(mech, 0, 0, { name: 'O' });
  const track = addTrack(mech, { x: -railBack, y: offset }, { x: railFront, y: offset }, {
    name: 'rail',
  });

  const crankAngle = rad(options.crankAngleDeg != null ? options.crankAngleDeg : 90);
  const Apos = polar(O, crank, crankAngle);
  const A = addRevoluteJoint(mech, Apos.x, Apos.y, { name: 'A' });

  // Slider position on the rail: solve |B - A| = rod with B.y = offset.
  const dy = Apos.y - offset;
  const reach = Math.sqrt(Math.max(0, rod * rod - dy * dy));
  const Bx = Apos.x + reach;
  const B = addSlider(mech, Bx, offset, track.id, { name: 'B' });

  addLink(mech, O.id, A.id, { name: 'crank', length: crank });
  addLink(mech, A.id, B.id, { name: 'connecting rod', length: rod });

  addMotor(mech, O.id, mech.links[0].id, { omega: 2.6 });
  captureHome(mech);
  return mech;
}

/* ------------------------------------------------------------ double rocker */

/**
 * Non-Grashof four-bar: neither link can rotate fully. Handy for seeing the
 * "blocked / jammed" reporting in action.
 */
export function buildDoubleRocker() {
  const mech = createMechanism('Double-rocker four-bar');
  const A = addFixedPivot(mech, 0, 0, { name: 'A' });
  const D = addFixedPivot(mech, 140, 0, { name: 'D' });
  const crank = 45;
  const coupler = 95;
  const rocker = 60;

  const Bpos = polar(A, crank, rad(50));
  const B = addRevoluteJoint(mech, Bpos.x, Bpos.y, { name: 'B' });
  const Cpos = circleIntersect(Bpos, coupler, { x: D.x, y: D.y }, rocker, 1);
  const C = addRevoluteJoint(mech, Cpos ? Cpos.x : D.x, Cpos ? Cpos.y : rocker, { name: 'C' });

  addLink(mech, A.id, D.id, { name: 'ground', length: dist(A, D), kind: 'ground' });
  const crankLink = addLink(mech, A.id, B.id, { name: 'input', length: crank });
  addLink(mech, B.id, C.id, { name: 'coupler', length: coupler });
  addLink(mech, C.id, D.id, { name: 'output', length: rocker });

  addMotor(mech, A.id, crankLink.id, { omega: 1.6 });
  captureHome(mech);
  return mech;
}

/* ------------------------------------------------------- crank-slider, stops */

/**
 * In-line crank-slider whose rail has end stops shorter than the full stroke:
 * the slider runs into a hard stop and the crank can no longer follow the
 * motor, which is exactly the situation the solver reports as blocked.
 */
export function buildCrankSliderWithStops() {
  const crank = 40;
  const rod = 140;
  const mech = createMechanism('Crank-slider with end stops');
  const O = addFixedPivot(mech, 0, 0, { name: 'O' });
  const track = addTrack(mech, { x: 60, y: 0 }, { x: 220, y: 0 }, {
    name: 'rail',
    limits: { enabled: true, min: 110, max: 170 },
  });
  const Apos = polar(O, crank, rad(90));
  const A = addRevoluteJoint(mech, Apos.x, Apos.y, { name: 'A' });
  const B = addSlider(mech, Apos.x + Math.sqrt(rod * rod - Apos.y * Apos.y), 0, track.id, {
    name: 'B',
  });
  const crankLink = addLink(mech, O.id, A.id, { name: 'crank', length: crank });
  addLink(mech, A.id, B.id, { name: 'connecting rod', length: rod });
  addMotor(mech, O.id, crankLink.id, { omega: 2.2 });
  captureHome(mech);
  return mech;
}

/* ------------------------------------------------------------------ registry */

export const PRESETS = [
  {
    id: 'four-bar',
    name: 'Four-bar linkage',
    description: 'Crank-rocker: the crank turns fully, the rocker swings. Grashof-valid.',
    build: buildFourBar,
  },
  {
    id: 'crank-slider',
    name: 'Crank-slider',
    description: 'In-line slider-crank: stroke = 2 x crank radius, exactly.',
    build: buildCrankSlider,
  },
  {
    id: 'crank-slider-offset',
    name: 'Offset crank-slider',
    description: 'Rail offset from the crank centre — shorter stroke, asymmetric motion.',
    build: () => buildCrankSlider({ offset: 30, railBack: 40, railFront: 220 }),
  },
  {
    id: 'double-rocker',
    name: 'Double-rocker (jams)',
    description: 'Non-Grashof four-bar; the motor jams at the toggle position.',
    build: buildDoubleRocker,
  },
  {
    id: 'crank-slider-stops',
    name: 'Crank-slider + end stops',
    description: 'Rail with hard stops shorter than the stroke: the crank jams against them.',
    build: buildCrankSliderWithStops,
  },
];

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

export function buildPreset(id) {
  const preset = getPreset(id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset.build();
}

export function emptyMechanism(name = 'Untitled mechanism') {
  return createMechanism(name);
}

/**
 * Rigid-body constraint solver for planar linkages.
 *
 * Formulation
 * -----------
 * Every mobile joint contributes two unknowns (x, y). The mechanism's joints
 * must satisfy a set of scalar constraints C(x) = 0:
 *
 *   distance   |p_b - p_a| - L = 0            (a rigid link keeps its length)
 *   onTrack    n . (p - a_track) = 0          (a slider stays on its rail)
 *   stop       u . (p - a_track) - s_max = 0  (slider hits an end stop)
 *   motor      wrap(theta(p) - theta_cmd) = 0 (the driven link's orientation)
 *
 * The system is solved with a damped Gauss-Newton (Levenberg-Marquardt)
 * iteration on the least-squares problem  min ||J dx + C||^2 :
 *
 *   (J^T J + lambda I) dx = -J^T C,   x <- x + dx
 *
 * lambda is adapted: it shrinks after a successful step and grows after a step
 * that increases the cost, which makes the solver stable through singular
 * configurations (toggle positions) instead of blowing up.
 *
 * Drag targets (interactive pulling with the mouse) are added as extra
 * low-weight rows, then removed for a final cleanup pass so that the rigid
 * constraints end up satisfied to machine precision.
 *
 * The module is DOM-free and deterministic; the test-suite drives it directly.
 */

import {
  EPS,
  angleDiff,
  dist,
  matrixRank,
  normalize,
  solveLinearSystem,
  wrapPi,
} from '../src/math.js';
import { JOINT_FIXED, JOINT_SLIDER, getJoint, getLink, getTrack, otherEnd } from '../src/model.js';

export const DEFAULT_TOLERANCE = 1e-9;
export const DEFAULT_MAX_ITERATIONS = 40;

/**
 * Constraint weights used by the least-squares solve.
 *
 * All physical rows carry the same weight: for a feasible pose every residual
 * is zero and weights are irrelevant, and equal weights keep the Gauss-Newton
 * steps large (a down-weighted row would slow convergence down by its squared
 * weight). Infeasible situations are handled structurally instead, by the
 * recovery pass in `solveConstraints`: rigid links and rails win, the motor
 * command is the constraint that gives way.
 */
export const DEFAULT_WEIGHTS = {
  link: 1,
  onTrack: 1,
  stop: 1,
  motor: 1,
  drag: 0.35,
};

/* ------------------------------------------------------------ build system */

/** Map every mobile joint to the index of its `x` unknown. */
export function buildVarIndex(mech) {
  const index = new Map();
  let count = 0;
  for (const j of mech.joints) {
    if (j.type === JOINT_FIXED) continue;
    index.set(j.id, count);
    count += 2;
  }
  return { index, count };
}

function makeRow(kind, label) {
  return { kind, label, entries: [], rhs: 0, weight: 1 };
}

function pushEntry(row, index, jointId, gx, gy) {
  const base = index.get(jointId);
  if (base === undefined) return;
  if (gx !== 0) row.entries.push([base, gx]);
  if (gy !== 0) row.entries.push([base + 1, gy]);
}

/**
 * Assemble every constraint row for the current pose of the mechanism.
 *
 * `options.dragTargets` - [{ jointId, x, y, weight }] soft rows used while the
 *                         user drags a joint with the mouse.
 * `options.ignoreMotors` - drop the motor rows (used to settle a jammed
 *                         mechanism against a hard stop).
 * `options.forceStops`   - activate slider end stops even before they are
 *                         reached, i.e. solve for the pose resting on the stop.
 */
export function buildRows(mech, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const { index, count } = buildVarIndex(mech);
  const rows = [];
  const hardLabels = [];

  // --- rigid links ---------------------------------------------------------
  for (const link of mech.links) {
    const ja = getJoint(mech, link.a);
    const jb = getJoint(mech, link.b);
    if (!ja || !jb) continue;
    const mobileA = index.has(ja.id);
    const mobileB = index.has(jb.id);
    if (!mobileA && !mobileB) continue; // ground link: both ends pinned
    const dx = jb.x - ja.x;
    const dy = jb.y - ja.y;
    const r = Math.hypot(dx, dy);
    if (r < 1e-9) continue; // degenerate; reported by validate()
    const ux = dx / r;
    const uy = dy / r;
    const row = makeRow('distance', `link ${link.name} length`);
    pushEntry(row, index, ja.id, -ux, -uy);
    pushEntry(row, index, jb.id, ux, uy);
    row.rhs = -(r - link.length);
    row.weight = weights.link;
    row.linkId = link.id;
    rows.push(row);
    hardLabels.push(row.label);
  }

  // --- sliders on tracks ---------------------------------------------------
  for (const joint of mech.joints) {
    if (joint.type !== JOINT_SLIDER) continue;
    const track = getTrack(mech, joint.trackId);
    if (!track) continue;
    const u = normalize({ x: track.b.x - track.a.x, y: track.b.y - track.a.y });
    if (u.x === 0 && u.y === 0) continue;
    const n = { x: -u.y, y: u.x };
    const rel = { x: joint.x - track.a.x, y: joint.y - track.a.y };
    const h = rel.x * n.x + rel.y * n.y;
    const row = makeRow('onTrack', `slider ${joint.name} on ${track.name}`);
    pushEntry(row, index, joint.id, n.x, n.y);
    row.rhs = -h;
    row.weight = weights.onTrack;
    row.jointId = joint.id;
    row.trackId = track.id;
    rows.push(row);
    hardLabels.push(row.label);

    // End stops. Normally the active-set rule applies (only once reached); with
    // `forceStops` the nearest stop is imposed so a jam can be resolved exactly.
    const limits = track.limits;
    if (limits && limits.enabled) {
      const s = rel.x * u.x + rel.y * u.y;
      const hasMax = Number.isFinite(limits.max);
      const hasMin = Number.isFinite(limits.min);
      let stopTarget = null;
      if (options.forceStops) {
        if (hasMax && hasMin) {
          stopTarget = Math.abs(s - limits.max) <= Math.abs(s - limits.min) ? limits.max : limits.min;
        } else if (hasMax) stopTarget = limits.max;
        else if (hasMin) stopTarget = limits.min;
      } else if (hasMax && s > limits.max) {
        stopTarget = limits.max;
      } else if (hasMin && s < limits.min) {
        stopTarget = limits.min;
      }
      if (stopTarget != null) {
        const stop = makeRow('stop', `slider ${joint.name} at ${track.name} stop ${stopTarget}`);
        pushEntry(stop, index, joint.id, u.x, u.y);
        stop.rhs = -(s - stopTarget);
        stop.weight = weights.stop;
        stop.jointId = joint.id;
        rows.push(stop);
        hardLabels.push(stop.label);
      }
    }
  }

  // --- motors --------------------------------------------------------------
  if (!options.ignoreMotors) {
    for (const motor of mech.motors) {
      if (!motor.enabled) continue;
      const joint = getJoint(mech, motor.jointId);
      const link = getLink(mech, motor.linkId);
      if (!joint || !link) continue;
      const otherId = otherEnd(link, joint.id);
      const other = getJoint(mech, otherId);
      if (!other) continue;
      if (!index.has(joint.id) && !index.has(other.id)) continue; // fully grounded
      const dx = other.x - joint.x;
      const dy = other.y - joint.y;
      const r2 = dx * dx + dy * dy;
      if (r2 < 1e-12) continue;
      const theta = Math.atan2(dy, dx);
      const C = wrapPi(theta - motor.angle);
      const gx = -dy / r2;
      const gy = dx / r2;
      const row = makeRow('motor', `motor on ${joint.name} (${link.name})`);
      pushEntry(row, index, other.id, gx, gy);
      pushEntry(row, index, joint.id, -gx, -gy);
      row.rhs = -C;
      row.weight = weights.motor;
      row.motorId = motor.id;
      rows.push(row);
      hardLabels.push(row.label);
    }
  }

  // --- soft drag rows ------------------------------------------------------
  const dragRows = [];
  for (const t of options.dragTargets || []) {
    const joint = getJoint(mech, t.jointId);
    if (!joint || !index.has(joint.id)) continue;
    const weight = t.weight != null ? t.weight : weights.drag;
    const rx = makeRow('drag', `drag ${joint.name} x`);
    pushEntry(rx, index, joint.id, 1, 0);
    rx.rhs = -(joint.x - t.x);
    rx.weight = weight;
    const ry = makeRow('drag', `drag ${joint.name} y`);
    pushEntry(ry, index, joint.id, 0, 1);
    ry.rhs = -(joint.y - t.y);
    ry.weight = weight;
    dragRows.push(rx, ry);
  }

  return { rows, dragRows, index, count, varCount: count, hardCount: rows.length };
}

/* ------------------------------------------------------------- evaluation */

function maxAbsResidual(rows) {
  let max = 0;
  let worst = null;
  for (const row of rows) {
    const C = Math.abs(row.rhs);
    if (C > max) {
      max = C;
      worst = row;
    }
  }
  return { max, worst };
}

function systemCost(mech, options) {
  const { rows, dragRows } = buildRows(mech, options);
  let cost = 0;
  for (const row of [...rows, ...dragRows]) cost += row.weight * row.weight * row.rhs * row.rhs;
  return cost;
}

function assembleNormalEquations(rows, n) {
  const N = [];
  for (let i = 0; i < n; i++) N.push(new Array(n).fill(0));
  const g = new Array(n).fill(0);
  for (const row of rows) {
    const w = row.weight;
    const e = row.entries;
    for (let i = 0; i < e.length; i++) {
      const [ii, ci] = e[i];
      const wi = ci * w;
      g[ii] += wi * row.rhs * w;
      for (let j = i; j < e.length; j++) {
        const [jj, cj] = e[j];
        N[ii][jj] += wi * cj * w;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) N[i][j] = N[j][i];
  }
  return { N, g };
}

function applyStep(mech, index, dx, scale = 1) {
  let norm = 0;
  for (const [jointId, base] of index) {
    const joint = getJoint(mech, jointId);
    if (!joint) continue;
    const sx = dx[base] * scale;
    const sy = dx[base + 1] * scale;
    joint.x += sx;
    joint.y += sy;
    norm = Math.max(norm, Math.abs(sx), Math.abs(sy));
  }
  return norm;
}

/** Snapshot / restore of every mobile joint position (used for trial steps). */
function snapshotPose(mech) {
  return mech.joints.map((j) => ({ id: j.id, x: j.x, y: j.y }));
}

function restorePose(mech, snap) {
  const byId = new Map(snap.map((s) => [s.id, s]));
  for (const j of mech.joints) {
    const s = byId.get(j.id);
    if (s) {
      j.x = s.x;
      j.y = s.y;
    }
  }
}

/* ----------------------------------------------------------------- solve */

/**
 * Run the damped least-squares iteration for the given row set.
 * Returns diagnostics; the mechanism is left at the best pose found.
 */
function iterate(mech, options, config) {
  const {
    tol = DEFAULT_TOLERANCE,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    useDragRows = true,
  } = config;
  const { index, varCount } = buildRows(mech, options);
  if (varCount === 0) {
    return { converged: true, iterations: 0, residual: 0, stepNorm: 0, singular: false };
  }

  let lambda = 1e-9;
  let iterations = 0;
  let residual = Infinity;
  let stepNorm = 0;
  let singular = false;
  let worstLabel = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    const built = buildRows(mech, options);
    const rows = useDragRows ? [...built.rows, ...built.dragRows] : built.rows;
    const evaluated = maxAbsResidual(built.rows);
    residual = evaluated.max;
    worstLabel = evaluated.worst ? evaluated.worst.label : null;

    if (rows.length === 0) {
      return { converged: true, iterations, residual: 0, stepNorm: 0, singular: false, worstLabel: null };
    }
    if (residual < tol && iter > 0 && stepNorm < 1e-9) break;

    const { N, g } = assembleNormalEquations(rows, varCount);
    let trace = 0;
    for (let i = 0; i < varCount; i++) trace += N[i][i];
    const damping = lambda * Math.max(trace / varCount, 1e-6);
    for (let i = 0; i < varCount; i++) N[i][i] += damping;

    const dx = solveLinearSystem(N, g);
    if (globalThis.__DEBUG_SOLVER__) {
      console.log('  iter', iter, 'lambda', lambda.toExponential(2), 'damping', damping.toExponential(3), 'dx', dx ? dx.map((v) => v.toFixed(5)).join(' ') : 'null', 'trace', trace.toFixed(4));
    }
    if (!dx) {
      lambda *= 100;
      singular = true;
      if (lambda > 1e12) break;
      continue;
    }

    const before = systemCost(mech, options);
    const snap = snapshotPose(mech);
    stepNorm = applyStep(mech, index, dx);
    const after = systemCost(mech, options);
    if (after <= before || stepNorm < 1e-13) {
      lambda = Math.max(lambda * 0.3, 1e-12);
      singular = false;
      if (stepNorm < 1e-13 && residual < tol) break;
    } else {
      restorePose(mech, snap);
      lambda *= 10;
      stepNorm = 0;
      if (lambda > 1e12) {
        singular = true;
        break;
      }
    }
  }

  const finalRows = buildRows(mech, options).rows;
  const finalEval = maxAbsResidual(finalRows);
  const finalBuilt = buildRows(mech, options);
  const dragEval = maxAbsResidual(finalBuilt.dragRows);
  return {
    converged: finalEval.max < tol,
    iterations,
    residual: finalEval.max,
    worstLabel: finalEval.worst ? finalEval.worst.label : null || worstLabel,
    dragResidual: dragEval.max,
    stepNorm,
    singular,
  };
}

/**
 * Solve the mechanism so that all hard constraints hold.
 *
 * @param {object} mech
 * @param {object} [options]
 * @param {Array}  [options.dragTargets] soft targets for interactive dragging
 * @param {number} [options.tol]         residual tolerance (default 1e-9)
 * @param {number} [options.maxIterations]
 * @returns {{converged:boolean, residual:number, iterations:number, dragResidual:number, singular:boolean, worstLabel:string|null}}
 */
export function solveConstraints(mech, options = {}) {
  const dragTargets = options.dragTargets || [];
  const tol = options.tol != null ? options.tol : DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations != null ? options.maxIterations : DEFAULT_MAX_ITERATIONS;

  let result;
  if (dragTargets.length > 0) {
    // Phase 1: pull the dragged joints towards the pointer while respecting
    // the rigid constraints as much as possible.
    result = iterate(mech, options, { tol, maxIterations, useDragRows: true });
    // Phase 2: remove the soft rows and clean up so lengths are exact.
    const cleanup = iterate(
      mech,
      { ...options, dragTargets: [] },
      { tol, maxIterations: Math.max(4, Math.round(maxIterations / 2)), useDragRows: false },
    );
    result = {
      ...cleanup,
      dragResidual: result.dragResidual,
      iterations: result.iterations + cleanup.iterations,
    };
  } else {
    result = iterate(mech, options, { tol, maxIterations, useDragRows: false });
  }

  if (result.converged || options.ignoreMotors || options.allowRecovery === false) {
    return result;
  }

  /*
   * Recovery pass.
   *
   * The commanded state is unreachable (a hard stop, a toggle position, a
   * jammed or over-constrained linkage). Solve again with the motor rows
   * removed: the mechanism then settles into the nearest pose in which every
   * rigid link keeps its exact length and every slider stays exactly on its
   * rail. The command is what gives way, never the geometry.
   */
  const physical = iterate(
    mech,
    { ...options, dragTargets: [], ignoreMotors: true },
    { tol, maxIterations, useDragRows: false },
  );
  const finalRows = buildRows(mech, options).rows;
  const finalEval = maxAbsResidual(finalRows);
  return {
    converged: false,
    recovered: true,
    physicalConverged: physical.converged,
    iterations: result.iterations + physical.iterations,
    residual: finalEval.max,
    worstLabel: result.worstLabel || (finalEval.worst ? finalEval.worst.label : null),
    unreachable: result.worstLabel,
    dragResidual: result.dragResidual,
    stepNorm: physical.stepNorm,
    singular: physical.singular,
  };
}

/* ------------------------------------------------------------- diagnostics */

/**
 * Per-constraint residuals in engineering units, used by the read-out panel
 * and by the tests ("do rigid links keep their length?").
 */
export function evaluateResiduals(mech) {
  const links = [];
  let maxLinkError = 0;
  for (const link of mech.links) {
    const ja = getJoint(mech, link.a);
    const jb = getJoint(mech, link.b);
    if (!ja || !jb) continue;
    const measured = dist(ja, jb);
    const error = measured - link.length;
    maxLinkError = Math.max(maxLinkError, Math.abs(error));
    links.push({ id: link.id, name: link.name, length: link.length, measured, error });
  }

  const sliders = [];
  let maxSliderOffset = 0;
  for (const joint of mech.joints) {
    if (joint.type !== JOINT_SLIDER) continue;
    const track = getTrack(mech, joint.trackId);
    if (!track) continue;
    const l = dist(track.a, track.b);
    if (l < EPS) continue;
    const u = { x: (track.b.x - track.a.x) / l, y: (track.b.y - track.a.y) / l };
    const n = { x: -u.y, y: u.x };
    const rel = { x: joint.x - track.a.x, y: joint.y - track.a.y };
    const offset = rel.x * n.x + rel.y * n.y;
    const s = rel.x * u.x + rel.y * u.y;
    maxSliderOffset = Math.max(maxSliderOffset, Math.abs(offset));
    sliders.push({ id: joint.id, name: joint.name, trackId: track.id, offset, s, travel: l });
  }

  const motors = [];
  let maxMotorError = 0;
  for (const motor of mech.motors) {
    if (!motor.enabled) continue;
    const joint = getJoint(mech, motor.jointId);
    const link = getLink(mech, motor.linkId);
    if (!joint || !link) continue;
    const other = getJoint(mech, otherEnd(link, joint.id));
    if (!other) continue;
    const theta = Math.atan2(other.y - joint.y, other.x - joint.x);
    const error = angleDiff(theta, motor.angle);
    maxMotorError = Math.max(maxMotorError, Math.abs(error));
    motors.push({ id: motor.id, jointId: joint.id, linkId: link.id, commanded: motor.angle, actual: theta, error });
  }

  return {
    links,
    sliders,
    motors,
    maxLinkError,
    maxSliderOffset,
    maxMotorError,
    maxError: Math.max(maxLinkError, maxSliderOffset, maxMotorError),
  };
}

/**
 * Mobility / degree-of-freedom analysis (Kutzbach-style, computed numerically
 * from the rank of the constraint Jacobian so that redundant links are
 * reported honestly).
 */
export function analyzeMobility(mech) {
  const { index, count } = buildVarIndex(mech);
  const { rows, dragRows } = buildRows(mech, {});
  const motorRows = rows.filter((r) => r.kind === 'motor');
  const kinematicRows = rows.filter((r) => r.kind !== 'motor');

  const dense = (rowList) =>
    rowList.map((row) => {
      const line = new Array(count).fill(0);
      for (const [i, c] of row.entries) line[i] += c;
      return line;
    });

  const rankKinematic = matrixRank(dense(kinematicRows), 1e-7);
  const rankAll = matrixRank(dense(rows), 1e-7);
  const freeVars = count;
  const mobility = freeVars - rankKinematic;
  const mobilityDriven = freeVars - rankAll;
  const redundancy = kinematicRows.length - rankKinematic;
  const enabledMotors = mech.motors.filter((m) => m.enabled).length;

  let status = 'ok';
  let note = '';
  if (freeVars === 0) {
    status = 'static';
    note = 'No moving joints — this is a fixed structure.';
  } else if (mobilityDriven > 0 && enabledMotors === 0) {
    status = 'undriven';
    note = `Mobility ${mobility}: pick a joint and add a motor to drive it.`;
  } else if (mobilityDriven > 0) {
    status = 'under';
    note = `${mobilityDriven} unconstrained degree${mobilityDriven === 1 ? '' : 's'} of freedom remain.`;
  } else if (redundancy > 0) {
    status = 'over';
    note = `${redundancy} redundant constraint${redundancy === 1 ? '' : 's'} — the mechanism may jam.`;
  } else if (mobilityDriven < 0) {
    status = 'locked';
    note = 'Over-constrained: the mechanism cannot move as commanded.';
  } else {
    status = 'ok';
    note = enabledMotors > 0 ? 'Fully constrained by the motor.' : 'Fully constrained.';
  }

  return {
    variables: count,
    movingJoints: count / 2,
    mobility,
    mobilityDriven,
    redundancy,
    rank: rankAll,
    rows: rows.length,
    motors: enabledMotors,
    status,
    note,
    hasDragRows: dragRows.length > 0,
  };
}

/** Convenience: solve and report residuals in one call. */
export function solveAndEvaluate(mech, options = {}) {
  const result = solveConstraints(mech, options);
  return { ...result, residuals: evaluateResiduals(mech) };
}

/**
 * Move the motors to their commanded angles by walking there in small steps.
 *
 * Newton's method converges to the branch nearest the current pose, so a large
 * jump (scrubbing the crank angle, loading a mechanism, hitting "jump to
 * angle") can land on the wrong assembly or fail outright. Ramping the angle in
 * increments of at most `maxAngleStep` follows the real motion instead, and
 * automatically halves the increment when it meets a toggle position.
 */
export function solveWithMotorRamp(mech, options = {}) {
  const tol = options.tol != null ? options.tol : DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations != null ? options.maxIterations : DEFAULT_MAX_ITERATIONS;
  const maxAngleStep = options.maxAngleStep != null ? options.maxAngleStep : 0.08;
  const active = mech.motors.filter((m) => m.enabled);
  if (active.length === 0) {
    return solveConstraints(mech, { tol, maxIterations });
  }

  const starts = active.map((m) => {
    const joint = getJoint(mech, m.jointId);
    const link = getLink(mech, m.linkId);
    if (!joint || !link) return m.angle;
    const other = getJoint(mech, otherEnd(link, joint.id));
    if (!other) return m.angle;
    return Math.atan2(other.y - joint.y, other.x - joint.x);
  });
  const deltas = active.map((m, i) => m.angle - starts[i]);
  let remaining = deltas.slice();
  const maxDelta = () => remaining.reduce((acc, d) => Math.max(acc, Math.abs(d)), 0);

  let step = maxAngleStep;
  let iterations = 0;
  let last = solveConstraints(mech, { tol, maxIterations });
  let guard = 0;

  while (maxDelta() > 1e-9 && guard < 600) {
    guard += 1;
    const total = maxDelta();
    const delta = Math.min(total, step);
    const fraction = delta / total;
    active.forEach((m, i) => {
      m.angle = starts[i] + (deltas[i] - remaining[i]) + remaining[i] * fraction;
    });
    last = solveConstraints(mech, { tol, maxIterations });
    iterations += last.iterations;
    if (last.converged) {
      remaining = remaining.map((r) => r * (1 - fraction));
      step = Math.min(maxAngleStep, step * 1.5);
    } else {
      step /= 2;
      if (step < 1e-4) break; // genuinely jammed
    }
  }

  // Leave the command at exactly what was asked for, even if it was unreachable.
  active.forEach((m, i) => {
    m.angle = starts[i] + deltas[i];
  });
  const finalCheck = solveConstraints(mech, { tol, maxIterations });
  return {
    ...finalCheck,
    iterations: iterations + finalCheck.iterations,
    ramped: true,
  };
}

/** Utility for tests and the UI: is every hard constraint satisfied? */
export function isSatisfied(mech, tol = 1e-6) {
  const r = evaluateResiduals(mech);
  return (
    r.maxLinkError <= tol &&
    r.maxSliderOffset <= tol &&
    r.maxMotorError <= tol
  );
}

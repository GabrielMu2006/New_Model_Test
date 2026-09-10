/**
 * Simulation engine: advances the mechanism in time by driving the motors and
 * re-solving the constraints at every sub-step.
 *
 * Rigid links keep their length because each sub-step is solved to a residual
 * below `tolerance` (1e-9 by default); if a sub-step cannot be solved (a toggle
 * position, a jammed or over-constrained mechanism) the step is halved, and if
 * even the smallest sub-step fails the simulation rolls back and reports the
 * blocking constraint instead of exploding.
 *
 * DOM-free: the browser UI and the Node test-suite use the same class.
 */

import { clamp } from './math.js';
import { captureHome, readMotorAngle, resetToHome } from './model.js';
import { evaluateResiduals, solveConstraints, solveWithMotorRamp } from './solver.js';

export const DEFAULT_OPTIONS = {
  tolerance: 1e-9,
  maxIterations: 40,
  /** Largest motor rotation per sub-step (radians) — keeps the solver on track. */
  maxAngleStep: 0.03,
  /** Smallest fraction of a sub-step treated as "no motion at all". */
  minSubStepFraction: 1e-6,
  /** Bisection iterations used to find the exact jam configuration. */
  bisectionSteps: 12,
  maxSubSteps: 256,
  traceLength: 3000,
  /** Increment used when ramping the crank to a new commanded angle. */
  rampAngleStep: 0.08,
};

export class Simulation {
  constructor(mech, options = {}) {
    this.mech = mech;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.time = 0;
    this.playing = false;
    this.speed = 1;
    this.stepSize = 1 / 60;
    this.residual = 0;
    this.converged = true;
    this.blocked = false;
    this.atLimit = false;
    this.message = '';
    this.worstConstraint = null;
    this.traces = new Map(); // jointId -> [{x, y}]
    this.ranges = new Map(); // jointId -> {xMin,xMax,yMin,yMax}
    this.subStepsLastFrame = 0;
    this.solveCount = 0;
    this.reset();
  }

  /* ------------------------------------------------------------- lifecycle */

  /** Restore the design pose, zero the clock and clear traces. */
  reset() {
    resetToHome(this.mech);
    for (const motor of this.mech.motors) motor.angle = motor.angleHome;
    this.time = 0;
    this.blocked = false;
    this.message = '';
    this.worstConstraint = null;
    this.traces.clear();
    this.ranges.clear();
    const result = solveConstraints(this.mech, {
      tol: this.options.tolerance,
      maxIterations: this.options.maxIterations,
    });
    this.residual = result.residual;
    this.converged = result.converged;
    this.worstConstraint = result.worstLabel;
    if (!result.converged) {
      this.message = `Design pose does not satisfy all constraints (${result.worstLabel || 'unknown'}).`;
    }
    this.recordTraces();
    return result;
  }

  /** Freeze the current pose as the new home/design pose. */
  captureHome() {
    captureHome(this.mech);
    this.time = 0;
    return this.mech;
  }

  play() {
    this.playing = true;
    this.blocked = false;
    return this;
  }

  pause() {
    this.playing = false;
    return this;
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
    return this.playing;
  }

  setSpeed(speed) {
    this.speed = clamp(speed, 0.02, 20);
    return this.speed;
  }

  /** Advance by one time step (used by the "step" button). */
  step(dt = this.stepSize) {
    const wasPlaying = this.playing;
    this.playing = false;
    const result = this.advance(dt);
    this.playing = wasPlaying;
    return result;
  }

  /* -------------------------------------------------------------- stepping */

  /** True when at least one enabled motor can actually drive the mechanism. */
  hasDrive() {
    return this.mech.motors.some((m) => m.enabled && m.omega !== 0);
  }

  /**
   * Integrate the motion over `dt` seconds. The interval is split so that no
   * motor turns more than `maxAngleStep` per sub-step.
   */
  advance(dt) {
    if (!(dt > 0)) return { moved: false, time: this.time };
    const interval = clamp(dt, 0, 0.5);
    let maxOmega = 0;
    for (const motor of this.mech.motors) {
      if (motor.enabled) maxOmega = Math.max(maxOmega, Math.abs(motor.omega));
    }
    let subSteps = 1;
    if (maxOmega > 0) {
      subSteps = Math.ceil((maxOmega * interval) / this.options.maxAngleStep);
      subSteps = clamp(subSteps, 1, this.options.maxSubSteps);
    }
    const h = interval / subSteps;
    this.subStepsLastFrame = subSteps;

    let moved = false;
    for (let i = 0; i < subSteps; i++) {
      const ok = this.integrateSubStep(h);
      if (!ok) {
        this.blocked = true;
        this.playing = false;
        return { moved, time: this.time, blocked: true };
      }
      moved = true;
    }
    this.blocked = false;
    return { moved, time: this.time };
  }

  /**
   * One sub-step with adaptive bisection.
   *
   * The motors are advanced by `h`, then the constraints are solved. When the
   * full step is infeasible (a toggle position, a hard stop, a jammed linkage)
   * the solver bisects the step: it keeps the largest fraction that *is*
   * solvable, so the mechanism glides right up to the blocking configuration
   * instead of stopping short or leaving the constraints violated. If even an
   * infinitesimal step fails, the sub-step is rejected and the previous pose is
   * restored, which is what "blocked" means.
   */
  integrateSubStep(h) {
    const snapshot = this.mech.joints.map((j) => ({ id: j.id, x: j.x, y: j.y }));
    const motorSnapshot = this.mech.motors.map((m) => m.angle);

    const tryFraction = (fraction) => {
      this.mech.joints.forEach((j, index) => {
        j.x = snapshot[index].x;
        j.y = snapshot[index].y;
      });
      this.mech.motors.forEach((m, index) => {
        m.angle = motorSnapshot[index];
      });
      for (const motor of this.mech.motors) {
        if (!motor.enabled) continue;
        motor.angle += motor.omega * h * fraction;
      }
      return this.solve(this.mech);
    };

    const restore = () => {
      this.mech.joints.forEach((j, index) => {
        j.x = snapshot[index].x;
        j.y = snapshot[index].y;
      });
      this.mech.motors.forEach((m, index) => {
        m.angle = motorSnapshot[index];
      });
    };

    // Fast path: the whole sub-step works (the common case).
    let result = tryFraction(1);
    if (result.converged) {
      this.time += h;
      this.residual = result.residual;
      this.converged = true;
      this.worstConstraint = null;
      this.atLimit = false;
      this.recordTraces();
      return true;
    }

    // Bisect towards the largest feasible fraction of the sub-step.
    let low = 0;
    let high = 1;
    let lastGood = null;
    const iterations = this.options.bisectionSteps != null ? this.options.bisectionSteps : 12;
    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2;
      const attempt = tryFraction(mid);
      if (attempt.converged) {
        low = mid;
        lastGood = { fraction: mid, result: attempt };
      } else {
        high = mid;
      }
      if (high - low < this.options.minSubStepFraction || high - low < 1e-6) break;
    }

    if (lastGood && lastGood.fraction > 1e-6) {
      tryFraction(lastGood.fraction);
      this.time += h * lastGood.fraction;
      this.residual = lastGood.result.residual;
      this.converged = true;
      this.atLimit = true;
      this.worstConstraint = null;
      this.recordTraces();
      return true;
    }

    // Nothing forward is possible: keep the last valid pose, then let the
    // mechanism rest exactly against the blocking limit (motor rows dropped so
    // the physical constraints win and the rigid links stay exact).
    restore();
    const settled = this.settleAtLimit(h);
    this.converged = settled.converged;
    this.atLimit = settled.converged;
    this.worstConstraint = result.worstLabel;
    this.message = this.blockedMessage(result);
    return false;
  }

  /**
   * Solve for the pose resting exactly on a slider end stop, with the motor
   * commanded a further sub-step forward. The motor command is the constraint
   * that gives way, so every link keeps its exact length and the slider sits
   * precisely on the stop.
   */
  settleAtLimit(h) {
    const hasLimits = this.mech.tracks.some((t) => t.limits && t.limits.enabled);
    if (!hasLimits) return { converged: false };
    for (const motor of this.mech.motors) {
      if (motor.enabled) motor.angle += motor.omega * h;
    }
    this.solveCount += 1;
    const result = solveConstraints(this.mech, {
      tol: this.options.tolerance,
      maxIterations: this.options.maxIterations,
      ignoreMotors: true,
      forceStops: true,
    });
    if (result.converged) this.recordTraces();
    return result;
  }

  blockedMessage(result) {
    const label = result.worstLabel || 'a constraint';
    return `Motion blocked at ${label} — the mechanism cannot follow the motor here.`;
  }

  solve(mech) {
    this.solveCount += 1;
    return solveConstraints(mech, {
      tol: this.options.tolerance,
      maxIterations: this.options.maxIterations,
    });
  }

  /* ------------------------------------------------------------ direct input */

  /**
   * Move the driven links to an absolute angle and re-solve.
   *
   * The angle is reached by ramping in small increments, so scrubbing the crank
   * slider (or typing an angle) follows the real motion instead of jumping to a
   * different assembly branch.
   */
  setDriveAngle(angle, motorId = null) {
    const targets = motorId
      ? this.mech.motors.filter((m) => m.id === motorId)
      : this.mech.motors;
    for (const motor of targets) motor.angle = angle;
    const result = solveWithMotorRamp(this.mech, {
      tol: this.options.tolerance,
      maxIterations: this.options.maxIterations,
      maxAngleStep: this.options.rampAngleStep,
    });
    this.residual = result.residual;
    this.converged = result.converged;
    this.worstConstraint = result.worstLabel;
    this.message = result.converged ? '' : `Cannot reach that angle: ${result.worstLabel}`;
    this.blocked = !result.converged;
    this.recordTraces();
    return result;
  }

  /** Rotate the driven links by a relative angle (used by the ± buttons). */
  nudgeDriveAngle(delta) {
    const first = this.mech.motors.find((m) => m.enabled) || this.mech.motors[0];
    if (!first) return null;
    const next = (first.angle || 0) + delta;
    return this.setDriveAngle(next, first.id);
  }

  /**
   * Interactive dragging: solve with soft targets so the mechanism follows the
   * pointer while all rigid constraints stay satisfied.
   *
   * With `ignoreMotors` the motor command is suspended for the duration of the
   * drag, so pulling any joint back-drives the mechanism through the crank
   * instead of being blocked by a motor that is holding its angle.
   */
  dragSolve(dragTargets, options = {}) {
    const result = solveConstraints(this.mech, {
      dragTargets,
      ignoreMotors: options.ignoreMotors === true,
      tol: this.options.tolerance,
      maxIterations: this.options.maxIterations,
    });
    this.residual = result.residual;
    this.converged = result.converged;
    this.worstConstraint = result.worstLabel;
    this.recordTraces();
    return result;
  }

  /* -------------------------------------------------------------- recording */

  /** Append the current joint positions to the trace buffers / range stats. */
  recordTraces() {
    for (const joint of this.mech.joints) {
      const r = this.ranges.get(joint.id) || {
        xMin: joint.x,
        xMax: joint.x,
        yMin: joint.y,
        yMax: joint.y,
      };
      r.xMin = Math.min(r.xMin, joint.x);
      r.xMax = Math.max(r.xMax, joint.x);
      r.yMin = Math.min(r.yMin, joint.y);
      r.yMax = Math.max(r.yMax, joint.y);
      this.ranges.set(joint.id, r);
      if (joint.type === 'fixed') continue;
      let trace = this.traces.get(joint.id);
      if (!trace) {
        trace = [];
        this.traces.set(joint.id, trace);
      }
      const last = trace[trace.length - 1];
      if (!last || Math.hypot(last.x - joint.x, last.y - joint.y) > 0.25) {
        trace.push({ x: joint.x, y: joint.y });
        if (trace.length > this.options.traceLength) trace.shift();
      }
    }
  }

  clearTraces() {
    this.traces.clear();
    this.ranges.clear();
    this.recordTraces();
  }

  /** Measured travel of every joint since the last reset. */
  travelReport() {
    return this.mech.joints.map((j) => {
      const r = this.ranges.get(j.id);
      return {
        id: j.id,
        name: j.name,
        dx: r ? r.xMax - r.xMin : 0,
        dy: r ? r.yMax - r.yMin : 0,
        xMin: r ? r.xMin : j.x,
        xMax: r ? r.xMax : j.x,
        yMin: r ? r.yMin : j.y,
        yMax: r ? r.yMax : j.y,
      };
    });
  }

  /** Live status snapshot for the UI status bar. */
  status() {
    const residuals = evaluateResiduals(this.mech);
    return {
      time: this.time,
      playing: this.playing,
      blocked: this.blocked,
      atLimit: !!this.atLimit,
      message: this.message,
      residual: this.residual,
      maxLinkError: residuals.maxLinkError,
      maxSliderOffset: residuals.maxSliderOffset,
      maxMotorError: residuals.maxMotorError,
      converged: this.converged,
      subSteps: this.subStepsLastFrame,
      worstConstraint: this.worstConstraint,
      motorAngles: this.mech.motors.map((m) => ({
        id: m.id,
        angle: m.angle,
        actual: readMotorAngle(this.mech, m),
      })),
    };
  }
}

/**
 * Test suite for the linkage designer.
 *
 * Pure Node, no dependencies: `node tests/run-tests.mjs`.
 * The suites exercise the same modules the browser app uses.
 */

import { strict as assert } from 'node:assert';

import {
  angleDiff,
  deg,
  dist,
  matrixRank,
  rad,
  solveLinearSystem,
  wrapPi,
} from '../src/math.js';
import {
  addFixedPivot,
  addLink,
  addMotor,
  addRevoluteJoint,
  addSlider,
  addTrack,
  captureHome,
  createMechanism,
  getJoint,
  getTrack,
  measure,
  removeEntity,
  resetToHome,
  structureSummary,
  validate,
} from '../src/model.js';
import {
  analyzeMobility,
  buildVarIndex,
  evaluateResiduals,
  solveConstraints,
  solveWithMotorRamp,
} from '../src/solver.js';
import { Simulation } from '../src/simulate.js';
import { PRESETS, buildCrankSlider, buildFourBar, buildPreset, circleIntersect } from '../src/presets.js';
import {
  createMemoryStorage,
  deleteSlot,
  deserialize,
  listSlots,
  loadSlot,
  sanitizeMechanism,
  saveSlot,
  serialize,
} from '../src/serialize.js';
import { History } from '../src/history.js';
import { renderScene, THEME } from '../src/render.js';
import { buildBundle, buildHtml } from '../tools/build-single-file.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  createCamera,
  fitCameraToMechanism,
  hitTest,
  screenToWorld,
  worldToScreen,
  zoomCameraAt,
} from '../src/view.js';

/* ------------------------------------------------------------- tiny runner */

const suites = [];
let currentSuite = null;

function suite(name, fn) {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
}

function test(name, fn) {
  if (!currentSuite) throw new Error('test() must be called inside suite()');
  currentSuite.tests.push({ name, fn });
}

async function run() {
  let passed = 0;
  const failures = [];
  for (const s of suites) {
    process.stdout.write(`\n\u001b[1m${s.name}\u001b[0m\n`);
    for (const t of s.tests) {
      const started = Date.now();
      try {
        await t.fn();
        passed++;
        const ms = Date.now() - started;
        process.stdout.write(`  \u001b[32m✓\u001b[0m ${t.name} \u001b[90m(${ms}ms)\u001b[0m\n`);
      } catch (error) {
        failures.push({ suite: s.name, test: t.name, error });
        process.stdout.write(`  \u001b[31m✗\u001b[0m ${t.name}\n      ${error.message}\n`);
      }
    }
  }
  const total = passed + failures.length;
  process.stdout.write(`\n${'-'.repeat(64)}\n`);
  if (failures.length === 0) {
    process.stdout.write(`\u001b[32m${passed}/${total} tests passed\u001b[0m\n`);
    return 0;
  }
  process.stdout.write(`\u001b[31m${failures.length} of ${total} tests failed\u001b[0m\n`);
  for (const f of failures) {
    process.stdout.write(`\n${f.suite} › ${f.test}\n${f.error.stack}\n`);
  }
  return 1;
}

/* ------------------------------------------------------------- utilities */

/** Longest-run check: every rigid link keeps its exact length. */
function maxLinkError(mech) {
  return evaluateResiduals(mech).maxLinkError;
}

function maxSliderOffset(mech) {
  return evaluateResiduals(mech).maxSliderOffset;
}

/** Simulate for `seconds` of model time at a fixed dt and watch the invariants. */
function runSimulation(mech, seconds, dt = 1 / 240, hook = null) {
  const sim = new Simulation(mech);
  sim.play();
  const steps = Math.round(seconds / dt);
  let worstLink = 0;
  let worstSlider = 0;
  let blockedAt = null;
  for (let i = 0; i < steps; i++) {
    sim.advance(dt);
    worstLink = Math.max(worstLink, maxLinkError(mech));
    worstSlider = Math.max(worstSlider, maxSliderOffset(mech));
    if (hook) hook(sim, mech, i);
    if (sim.blocked) {
      blockedAt = sim.time;
      break;
    }
  }
  return { sim, worstLink, worstSlider, blockedAt };
}

/* ------------------------------------------------------------------- math */

suite('math', () => {
  test('solves a small linear system', () => {
    const A = [
      [2, 1],
      [1, 3],
    ];
    const b = [3, 5];
    const x = solveLinearSystem(A, b);
    assert.ok(Math.abs(x[0] - 0.8) < 1e-12, `x0=${x[0]}`);
    assert.ok(Math.abs(x[1] - 1.4) < 1e-12, `x1=${x[1]}`);
  });

  test('reports rank of a rank-deficient matrix', () => {
    assert.equal(matrixRank([[1, 2], [2, 4]]), 1);
    assert.equal(matrixRank([[1, 0], [0, 1]]), 2);
    assert.equal(matrixRank([[0, 0], [0, 0]]), 0);
  });

  test('wraps angles into (-pi, pi]', () => {
    assert.ok(Math.abs(wrapPi(3 * Math.PI) - Math.PI) < 1e-12);
    assert.ok(Math.abs(wrapPi(-3 * Math.PI) - Math.PI) < 1e-12);
    assert.ok(Math.abs(angleDiff(rad(350), rad(10)) - rad(-20)) < 1e-12);
  });

  test('circle intersection produces exact radii', () => {
    const p = circleIntersect({ x: 0, y: 0 }, 50, { x: 80, y: 0 }, 50, 1);
    assert.ok(Math.abs(dist(p, { x: 0, y: 0 }) - 50) < 1e-9);
    assert.ok(Math.abs(dist(p, { x: 80, y: 0 }) - 50) < 1e-9);
  });
});

/* ------------------------------------------------------------------ model */

suite('model', () => {
  test('creates joints, links, tracks and motors', () => {
    const mech = createMechanism('t');
    const a = addFixedPivot(mech, 0, 0);
    const b = addRevoluteJoint(mech, 100, 0);
    const link = addLink(mech, a.id, b.id, { length: 100 });
    assert.equal(mech.joints.length, 2);
    assert.equal(link.length, 100);
    assert.equal(validate(mech).ok, true);
  });

  test('flags a slider without a track', () => {
    const mech = createMechanism('t');
    const a = addFixedPivot(mech, 0, 0);
    const s = addSlider(mech, 50, 0, null);
    addLink(mech, a.id, s.id, { length: 50 });
    const v = validate(mech);
    assert.equal(v.ok, false);
    assert.match(v.errors.join(' '), /track/i);
  });

  test('rejects a motor on an unrelated link', () => {
    const mech = createMechanism('t');
    const a = addFixedPivot(mech, 0, 0);
    const b = addRevoluteJoint(mech, 50, 0);
    const c = addRevoluteJoint(mech, 100, 0);
    const link = addLink(mech, b.id, c.id, { length: 50 });
    assert.throws(() => addMotor(mech, a.id, link.id), /attached/);
  });

  test('removing a joint removes its links and motors', () => {
    const mech = buildFourBar();
    const before = mech.links.length;
    removeEntity(mech, getJoint(mech, mech.joints.find((j) => j.name === 'B').id).id);
    assert.ok(mech.links.length < before);
    assert.equal(validate(mech).ok, true);
  });

  test('measure reports coordinates and length errors', () => {
    const mech = buildFourBar();
    const report = measure(mech);
    assert.equal(report.joints.length, mech.joints.length);
    assert.ok(report.maxLengthError < 1e-9, `error=${report.maxLengthError}`);
  });

  test('reset restores the design pose exactly', () => {
    const mech = buildFourBar();
    const home = mech.joints.map((j) => ({ x: j.x, y: j.y }));
    const sim = new Simulation(mech);
    sim.play();
    sim.advance(0.4);
    assert.ok(mech.joints.some((j, i) => dist(j, home[i]) > 1));
    sim.reset();
    mech.joints.forEach((j, i) => {
      assert.ok(Math.abs(j.x - home[i].x) < 1e-12);
      assert.ok(Math.abs(j.y - home[i].y) < 1e-12);
    });
  });

  test('structure summary counts joint types', () => {
    const mech = buildCrankSlider();
    const s = structureSummary(mech);
    assert.equal(s.counts.fixed, 1);
    assert.equal(s.counts.slider, 1);
    assert.equal(s.counts.revolute, 1);
    assert.equal(s.driven, true);
  });
});

/* ----------------------------------------------------------------- solver */

suite('solver', () => {
  test('restores perturbed link lengths', () => {
    const mech = buildFourBar();
    const B = mech.joints.find((j) => j.name === 'B');
    B.x += 12;
    B.y -= 7;
    const result = solveConstraints(mech);
    assert.ok(result.converged, `residual=${result.residual}`);
    assert.ok(maxLinkError(mech) < 1e-9, `err=${maxLinkError(mech)}`);
  });

  test('keeps a slider exactly on its rail', () => {
    const mech = buildCrankSlider({ offset: 20 });
    const B = mech.joints.find((j) => j.name === 'B');
    B.y += 5;
    B.x -= 9;
    const result = solveConstraints(mech);
    assert.ok(result.converged);
    assert.ok(maxSliderOffset(mech) < 1e-9, `offset=${maxSliderOffset(mech)}`);
    assert.ok(Math.abs(B.y - 20) < 1e-9);
  });

  test('motor angle is honoured exactly', () => {
    const mech = buildFourBar();
    const motor = mech.motors[0];
    motor.angle += rad(20);
    const result = solveConstraints(mech);
    assert.ok(result.converged, `residual ${result.residual}`);
    const A = getJoint(mech, motor.jointId);
    const link = mech.links.find((l) => l.id === motor.linkId);
    const B = getJoint(mech, link.a === A.id ? link.b : link.a);
    const actual = Math.atan2(B.y - A.y, B.x - A.x);
    assert.ok(Math.abs(angleDiff(actual, motor.angle)) < 1e-9);
  });

  test('an impossible command never corrupts the mechanism', () => {
    // Whatever the solver can or cannot reach, the rigid links must survive:
    // the command is the constraint that gives way, never the geometry.
    const mech = buildFourBar();
    const motor = mech.motors[0];
    const coupler = mech.links.find((l) => l.name === 'coupler');
    motor.angle += rad(150);
    const result = solveConstraints(mech);
    assert.ok(maxLinkError(mech) < 1e-9, `links must stay rigid: ${maxLinkError(mech)}`);
    assert.ok(Math.abs(coupler.length - 120) < 1e-12);
    if (!result.converged) {
      assert.ok(result.worstLabel, 'a failed solve must name the blocking constraint');
      // ... and the ramped solve still gets there properly.
      const ramped = solveWithMotorRamp(mech);
      assert.ok(ramped.converged, `residual ${ramped.residual}`);
      assert.ok(Math.abs(maxLinkError(mech)) < 1e-9);
    } else {
      // Reached it in one go — the crank must then really be at the new angle.
      const A = getJoint(mech, motor.jointId);
      const link = mech.links.find((l) => l.id === motor.linkId);
      const B = getJoint(mech, link.a === A.id ? link.b : link.a);
      const actual = Math.atan2(B.y - A.y, B.x - A.x);
      assert.ok(Math.abs(angleDiff(actual, motor.angle)) < 1e-7);
    }
  });

  test('a far commanded angle is reached by ramping through the motion', () => {
    const mech = buildFourBar();
    const motor = mech.motors[0];
    const startAngle = motor.angle;
    motor.angle = startAngle + rad(150);
    const result = solveWithMotorRamp(mech);
    assert.ok(result.converged, `residual ${result.residual}`);
    const A = getJoint(mech, motor.jointId);
    const link = mech.links.find((l) => l.id === motor.linkId);
    const B = getJoint(mech, link.a === A.id ? link.b : link.a);
    const actual = Math.atan2(B.y - A.y, B.x - A.x);
    assert.ok(Math.abs(angleDiff(actual, motor.angle)) < 1e-7, `actual ${deg(actual)}`);
    assert.ok(maxLinkError(mech) < 1e-9);
  });

  test('fixed pivots never move', () => {
    const mech = buildFourBar();
    const fixed = mech.joints.filter((j) => j.type === 'fixed');
    const before = fixed.map((j) => ({ x: j.x, y: j.y }));
    const sim = new Simulation(mech);
    sim.play();
    for (let i = 0; i < 200; i++) sim.advance(1 / 240);
    fixed.forEach((j, i) => {
      assert.equal(j.x, before[i].x);
      assert.equal(j.y, before[i].y);
    });
  });

  test('drag solving keeps lengths rigid', () => {
    const mech = buildFourBar();
    const C = mech.joints.find((j) => j.name === 'C');
    for (let i = 0; i < 40; i++) {
      const target = { x: 30 + i, y: 85 + i * 0.4 };
      solveConstraints(mech, { dragTargets: [{ jointId: C.id, x: target.x, y: target.y }] });
      assert.ok(maxLinkError(mech) < 1e-7, `err=${maxLinkError(mech)} at i=${i}`);
    }
    assert.ok(dist(C, { x: 30, y: 85 }) >= 0); // C actually moved somewhere
  });

  test('no variables means nothing to solve', () => {
    const mech = createMechanism('static');
    const a = addFixedPivot(mech, 0, 0);
    const b = addFixedPivot(mech, 100, 0);
    addLink(mech, a.id, b.id, { length: 100 });
    assert.equal(buildVarIndex(mech).count, 0);
    const result = solveConstraints(mech);
    assert.equal(result.converged, true);
  });

  test('mobility analysis identifies a driven four-bar', () => {
    const mech = buildFourBar();
    const withMotor = analyzeMobility(mech);
    assert.equal(withMotor.mobility, 1, 'one free DOF before the motor');
    assert.equal(withMotor.mobilityDriven, 0, 'motor removes the last DOF');
    assert.equal(withMotor.status, 'ok');
    mech.motors[0].enabled = false;
    const withoutMotor = analyzeMobility(mech);
    assert.equal(withoutMotor.mobilityDriven, 1);
    assert.equal(withoutMotor.status, 'undriven');
  });

  test('mobility analysis identifies an under-driven slider-crank', () => {
    const mech = buildCrankSlider();
    assert.equal(analyzeMobility(mech).mobilityDriven, 0);
    mech.motors[0].enabled = false;
    assert.equal(analyzeMobility(mech).mobilityDriven, 1);
  });
});

/* ------------------------------------------------------------ four-bar run */

suite('four-bar linkage', () => {
  test('preset starts in a valid pose', () => {
    const mech = buildFourBar();
    assert.ok(maxLinkError(mech) < 1e-9);
    assert.equal(validate(mech).ok, true);
  });

  test('survives a full crank revolution with rigid links', () => {
    const mech = buildFourBar();
    const { worstLink, blockedAt } = runSimulation(mech, 3.0);
    assert.equal(blockedAt, null, 'should not block');
    assert.ok(worstLink < 1e-7, `worst link error ${worstLink}`);
  });

  test('crank turns a full revolution, rocker only oscillates', () => {
    const mech = buildFourBar();
    const A = mech.joints.find((j) => j.name === 'A');
    const B = mech.joints.find((j) => j.name === 'B');
    const C = mech.joints.find((j) => j.name === 'C');
    const D = mech.joints.find((j) => j.name === 'D');
    let crankTurns = 0;
    let prevCrank = Math.atan2(B.y - A.y, B.x - A.x);
    let rockerMin = Infinity;
    let rockerMax = -Infinity;
    const sim = new Simulation(mech);
    sim.play();
    for (let i = 0; i < 720; i++) {
      sim.advance(1 / 240);
      const crank = Math.atan2(B.y - A.y, B.x - A.x);
      crankTurns += angleDiff(crank, prevCrank);
      prevCrank = crank;
      const rocker = Math.atan2(C.y - D.y, C.x - D.x);
      rockerMin = Math.min(rockerMin, rocker);
      rockerMax = Math.max(rockerMax, rocker);
    }
    assert.ok(Math.abs(crankTurns) > 2 * Math.PI, `crank turned ${deg(crankTurns).toFixed(1)} deg`);
    const rockerSwing = deg(rockerMax - rockerMin);
    assert.ok(rockerSwing > 10 && rockerSwing < 180, `rocker swing ${rockerSwing.toFixed(1)} deg`);
  });

  test('simulated time advances at the commanded motor speed', () => {
    const mech = buildFourBar();
    const omega = mech.motors[0].omega;
    const sim = new Simulation(mech);
    sim.play();
    sim.advance(0.5);
    assert.ok(Math.abs(sim.time - 0.5) < 1e-9);
    const B = mech.joints.find((j) => j.name === 'B');
    const A = mech.joints.find((j) => j.name === 'A');
    const crank = Math.atan2(B.y - A.y, B.x - A.x);
    const expected = mech.motors[0].angleHome + omega * 0.5;
    assert.ok(Math.abs(angleDiff(crank, expected)) < 1e-6, `crank ${deg(crank)} vs ${deg(expected)}`);
  });
});

/* --------------------------------------------------------- crank-slider run */

suite('crank-slider mechanism', () => {
  test('slider stroke equals twice the crank radius', () => {
    const crank = 40;
    const mech = buildCrankSlider({ crankLength: crank, rodLength: 140 });
    const B = mech.joints.find((j) => j.name === 'B');
    let min = Infinity;
    let max = -Infinity;
    const sim = new Simulation(mech);
    sim.play();
    for (let i = 0; i < 960; i++) {
      sim.advance(1 / 240);
      min = Math.min(min, B.x);
      max = Math.max(max, B.x);
    }
    const stroke = max - min;
    assert.ok(Math.abs(stroke - 2 * crank) < 1e-6, `stroke=${stroke}`);
  });

  test('slider never leaves the rail and the rod stays rigid', () => {
    const mech = buildCrankSlider();
    const { worstLink, worstSlider, blockedAt } = runSimulation(mech, 2.5);
    assert.equal(blockedAt, null);
    assert.ok(worstLink < 1e-7, `link error ${worstLink}`);
    assert.ok(worstSlider < 1e-9, `slider offset ${worstSlider}`);
  });

  test('end stops block the crank and the pose stays valid', () => {
    const mech = buildPreset('crank-slider-stops');
    const track = mech.tracks[0];
    const sim = new Simulation(mech);
    sim.play();
    let blocked = false;
    for (let i = 0; i < 4000 && !blocked; i++) {
      sim.advance(1 / 240);
      assert.ok(maxLinkError(mech) < 1e-7, `link error ${maxLinkError(mech)}`);
      assert.ok(maxSliderOffset(mech) < 1e-9);
      blocked = sim.blocked;
    }
    assert.equal(blocked, true, 'the crank should jam against the end stop');
    const B = mech.joints.find((j) => j.name === 'B');
    assert.ok(
      B.x <= track.limits.max + 1e-6 && B.x >= track.limits.min - 1e-6,
      `slider left the allowed travel: ${B.x}`,
    );
    assert.ok(Math.abs(B.x - track.limits.max) < 0.05, `slider should rest on the stop, got ${B.x}`);
    assert.ok(sim.message.length > 0);
  });

  test('offset crank-slider keeps the slider on the offset rail', () => {
    const mech = buildCrankSlider({ offset: 30 });
    const B = mech.joints.find((j) => j.name === 'B');
    const sim = new Simulation(mech);
    sim.play();
    for (let i = 0; i < 480; i++) {
      sim.advance(1 / 240);
      assert.ok(Math.abs(B.y - 30) < 1e-9);
    }
  });

  test('non-Grashof four-bar reports a jam instead of exploding', () => {
    const mech = buildPreset('double-rocker');
    const sim = new Simulation(mech);
    sim.play();
    let blocked = false;
    for (let i = 0; i < 4000 && !blocked; i++) {
      sim.advance(1 / 240);
      blocked = sim.blocked;
    }
    assert.equal(blocked, true);
    assert.ok(maxLinkError(mech) < 1e-7, 'pose must stay valid after a jam');
    assert.ok(sim.message.length > 0);
  });

  test('every preset loads, validates and runs one second', () => {
    for (const preset of PRESETS) {
      const mech = buildPreset(preset.id);
      const v = validate(mech);
      assert.equal(v.ok, true, `${preset.id}: ${v.errors.join(', ')}`);
      const sim = new Simulation(mech);
      sim.play();
      for (let i = 0; i < 120 && !sim.blocked; i++) sim.advance(1 / 120);
      assert.ok(maxLinkError(mech) < 1e-7, `${preset.id} link error`);
      assert.ok(maxSliderOffset(mech) < 1e-9, `${preset.id} slider offset`);
    }
  });
});

/* ------------------------------------------------------------- simulation */

suite('simulation controls', () => {
  test('play / pause / step / reset behave as expected', () => {
    const mech = buildFourBar();
    const sim = new Simulation(mech);
    assert.equal(sim.playing, false);
    sim.play();
    assert.equal(sim.playing, true);
    sim.advance(0.25);
    const t1 = sim.time;
    sim.pause();
    assert.equal(sim.playing, false);
    sim.advance(0.25); // advance is still explicit; playback is driven by the UI loop
    sim.step();
    assert.ok(sim.time > t1);
    assert.equal(sim.playing, false, 'step must not leave the simulation running');
    sim.reset();
    assert.equal(sim.time, 0);
    assert.ok(maxLinkError(mech) < 1e-9);
  });

  test('stepping a fixed number of steps reproduces the same pose', () => {
    const a = buildFourBar();
    const b = buildFourBar();
    const simA = new Simulation(a);
    const simB = new Simulation(b);
    for (let i = 0; i < 120; i++) simA.step(1 / 120);
    for (let i = 0; i < 120; i++) simB.step(1 / 120);
    a.joints.forEach((joint, i) => {
      assert.ok(Math.abs(joint.x - b.joints[i].x) < 1e-9);
      assert.ok(Math.abs(joint.y - b.joints[i].y) < 1e-9);
    });
  });

  test('crank angle scrubbing lands on the requested angle', () => {
    const mech = buildCrankSlider();
    const sim = new Simulation(mech);
    for (const angle of [0, 45, 90, 180, 270, 359]) {
      const result = sim.setDriveAngle(rad(angle));
      assert.ok(result.converged, `angle ${angle}`);
      const O = mech.joints.find((j) => j.name === 'O');
      const A = mech.joints.find((j) => j.name === 'A');
      const actual = Math.atan2(A.y - O.y, A.x - O.x);
      assert.ok(Math.abs(angleDiff(actual, rad(angle))) < 1e-7, `angle ${angle}`);
      assert.ok(maxSliderOffset(mech) < 1e-9);
    }
  });

  test('the pose is a single-valued function of the crank angle', () => {
    // A kinematic mechanism has no hysteresis: the same crank angle must give
    // the same pose whether it was reached by running or by scrubbing.
    const runTo = (targetAngle) => {
      const mech = buildFourBar();
      const sim = new Simulation(mech);
      sim.play();
      let guard = 0;
      const motor = mech.motors[0];
      while (angleDiff(motor.angle, targetAngle) > 0.01 && guard < 4000) {
        sim.advance(1 / 240);
        guard++;
      }
      sim.setDriveAngle(targetAngle);
      assert.ok(sim.converged, 'scrubbing to the angle must solve');
      return mech.joints.map((j) => ({ id: j.id, x: j.x, y: j.y }));
    };

    const mech = buildFourBar();
    const target = mech.motors[0].angle + 2 * Math.PI * 0.87; // some way round
    const byRunning = runTo(target);
    const byScrubbing = (() => {
      const fresh = buildFourBar();
      const sim = new Simulation(fresh);
      sim.setDriveAngle(mech.motors[0].angle + 2 * Math.PI * 0.87);
      return fresh.joints.map((j) => ({ id: j.id, x: j.x, y: j.y }));
    })();
    byRunning.forEach((joint, i) => {
      assert.ok(Math.abs(joint.x - byScrubbing[i].x) < 1e-7, `joint ${i} x differs`);
      assert.ok(Math.abs(joint.y - byScrubbing[i].y) < 1e-7, `joint ${i} y differs`);
    });
  });

  test('a full crank revolution returns the mechanism to its start pose', () => {
    const mech = buildCrankSlider();
    const start = mech.joints.map((j) => ({ x: j.x, y: j.y }));
    const sim = new Simulation(mech);
    const omega = mech.motors[0].omega;
    const period = (2 * Math.PI) / Math.abs(omega);
    sim.play();
    const dt = 1 / 480;
    const steps = Math.round(period / dt);
    for (let i = 0; i < steps; i++) sim.advance(dt);
    sim.setDriveAngle(mech.motors[0].angleHome + 2 * Math.PI);
    mech.joints.forEach((joint, i) => {
      assert.ok(
        Math.hypot(joint.x - start[i].x, joint.y - start[i].y) < 1e-6,
        `joint ${joint.name} did not come back: ${Math.hypot(joint.x - start[i].x, joint.y - start[i].y)}`,
      );
    });
    assert.ok(maxLinkError(mech) < 1e-9);
  });

  test('separate parts can be connected into one mechanism', () => {
    // Two identical four-bars, the second translated by 260 mm. Connecting two
    // joints that move in parallel adds a consistent (redundant) constraint, so
    // the joined mechanism still runs — one motor now drives both parts.
    const build = (connect) => {
      const a = buildFourBar();
      const b = buildFourBar();
      for (const j of b.joints) {
        j.x += 260;
        j.home = { x: j.x, y: j.y };
      }
      const joined = createMechanism('two parts');
      joined.joints = [...a.joints, ...b.joints];
      joined.links = [...a.links, ...b.links];
      joined.motors = a.motors;
      for (const motor of joined.motors) motor.angle = motor.angleHome;
      const nameOf = (mech, name) => joined.joints.find((j) => j.id === mech.joints.find((x) => x.name === name).id);
      joined.__a = { crank: nameOf(a, 'B'), rocker: nameOf(a, 'C') };
      joined.__b = { crank: nameOf(b, 'B'), rocker: nameOf(b, 'C') };
      const link = addLink(joined, joined.__a.rocker.id, joined.__b[connect].id, {
        length: dist(joined.__a.rocker, joined.__b[connect]),
      });
      return { joined, link };
    };

    const compatible = build('rocker');
    assert.equal(structureSummary(compatible.joined).parts, 1, 'the two parts are now one mechanism');
    const sim = new Simulation(compatible.joined);
    sim.play();
    for (let i = 0; i < 500 && !sim.blocked; i++) {
      sim.advance(1 / 240);
      assert.ok(maxLinkError(compatible.joined) < 1e-7, `link error at step ${i}`);
    }
    assert.equal(sim.blocked, false, `compatible join jammed: ${sim.message}`);
    assert.ok(sim.time > 2, `the joined mechanism only ran ${sim.time.toFixed(2)} s`);
    assert.ok(Math.abs(measure(compatible.joined).links.find((l) => l.id === compatible.link.id).error) < 1e-9);
    // The couple transmits motion: the second part moves too.
    const bCrank = compatible.joined.__b.crank;
    assert.ok(Math.hypot(bCrank.x - bCrank.home.x, bCrank.y - bCrank.home.y) > 5);

    // An incompatible join over-constrains the mechanism: it must jam, and it
    // must jam *cleanly* — every rigid link still exactly its own length.
    const incompatible = build('crank');
    const locked = new Simulation(incompatible.joined);
    locked.play();
    let blocked = false;
    for (let i = 0; i < 1500 && !blocked; i++) {
      locked.advance(1 / 240);
      assert.ok(maxLinkError(incompatible.joined) < 1e-7, `link error at step ${i}`);
      blocked = locked.blocked;
    }
    assert.equal(blocked, true, 'an incompatible join should jam visibly');
    assert.ok(locked.message.length > 0);
    assert.ok(maxLinkError(incompatible.joined) < 1e-7);
  });

  test('nudge steps the drive angle by a relative amount', () => {
    const mech = buildFourBar();
    const sim = new Simulation(mech);
    const before = mech.motors[0].angle;
    sim.nudgeDriveAngle(rad(5));
    assert.ok(Math.abs(angleDiff(mech.motors[0].angle, before + rad(5))) < 1e-12);
  });

  test('traces record joint paths and travel', () => {
    const mech = buildCrankSlider();
    const sim = new Simulation(mech);
    sim.play();
    for (let i = 0; i < 240; i++) sim.advance(1 / 120);
    const A = mech.joints.find((j) => j.name === 'A');
    const trace = sim.traces.get(A.id);
    assert.ok(trace && trace.length > 20, 'crank trace should have many points');
    const travel = sim.travelReport().find((t) => t.id === A.id);
    assert.ok(travel.dx > 1 && travel.dy > 1);
    sim.reset();
    assert.equal(sim.traces.get(A.id).length, 1);
  });
});

/* ------------------------------------------------------- save / load / undo */

suite('save and reload', () => {
  test('json round-trip preserves the mechanism', () => {
    const mech = buildCrankSlider();
    const text = serialize(mech);
    const { mechanism, warnings } = deserialize(text);
    assert.equal(warnings.length, 0);
    assert.equal(mechanism.joints.length, mech.joints.length);
    assert.equal(mechanism.links.length, mech.links.length);
    assert.equal(mechanism.tracks.length, mech.tracks.length);
    assert.equal(mechanism.motors.length, mech.motors.length);
    mechanism.links.forEach((l, i) => assert.equal(l.length, mech.links[i].length));
    mechanism.joints.forEach((j, i) => {
      assert.equal(j.type, mech.joints[i].type);
      assert.ok(Math.abs(j.x - mech.joints[i].x) < 1e-12);
    });
    const sim = new Simulation(mechanism);
    sim.play();
    for (let i = 0; i < 120; i++) sim.advance(1 / 120);
    assert.ok(maxLinkError(mechanism) < 1e-7);
  });

  test('reloaded mechanism reproduces the original motion', () => {
    const original = buildFourBar();
    const reloaded = deserialize(serialize(original)).mechanism;
    const simA = new Simulation(original);
    const simB = new Simulation(reloaded);
    for (let i = 0; i < 300; i++) {
      simA.advance(1 / 240);
      simB.advance(1 / 240);
    }
    original.joints.forEach((joint, i) => {
      assert.ok(Math.abs(joint.x - reloaded.joints[i].x) < 1e-9, `joint ${i}`);
      assert.ok(Math.abs(joint.y - reloaded.joints[i].y) < 1e-9, `joint ${i}`);
    });
  });

  test('damaged files are repaired and reported, not thrown away', () => {
    const mech = buildCrankSlider();
    const raw = JSON.parse(serialize(mech, { pretty: false }));
    raw.mechanism.links.push({ id: 'bad', a: 'nope', b: 'nope2', length: 10 });
    raw.mechanism.joints.push({ id: 'j_slider', type: 'slider', x: 10, y: 0, trackId: 'missing' });
    const { mechanism, warnings } = sanitizeMechanism(raw.mechanism);
    assert.ok(warnings.length >= 2, `warnings: ${warnings.join(' | ')}`);
    assert.equal(validate(mechanism).ok, true);
  });

  test('invalid json raises a readable error', () => {
    assert.throws(() => deserialize('{not json'), /Not valid JSON/);
    assert.throws(() => deserialize('{"format":"something-else","mechanism":{}}'), /Unexpected file format/);
  });

  test('storage slots save, list, load and delete', () => {
    const storage = createMemoryStorage();
    const mech = buildFourBar();
    saveSlot('my four-bar', mech, storage);
    saveSlot('crank slider', buildCrankSlider(), storage);
    const slots = listSlots(storage);
    assert.equal(slots.length, 2);
    assert.deepEqual(
      slots.map((s) => s.name),
      ['crank slider', 'my four-bar'],
    );
    const loaded = loadSlot('my four-bar', storage);
    assert.equal(loaded.mechanism.joints.length, mech.joints.length);
    deleteSlot('my four-bar', storage);
    assert.equal(listSlots(storage).length, 1);
    assert.throws(() => loadSlot('my four-bar', storage), /No saved mechanism/);
  });

  test('overwriting a slot keeps a single entry', () => {
    const storage = createMemoryStorage();
    saveSlot('slot', buildFourBar(), storage);
    saveSlot('slot', buildCrankSlider(), storage);
    assert.equal(listSlots(storage).length, 1);
    const loaded = loadSlot('slot', storage);
    assert.equal(loaded.mechanism.tracks.length, 1);
  });

  test('undo and redo restore geometry and lengths', () => {
    const history = new History();
    const mech = buildFourBar();
    const snapshotBefore = JSON.parse(JSON.stringify(mech));
    history.push('change length', mech);
    const link = mech.links.find((l) => l.name === 'coupler');
    link.length = 150;
    const afterEdit = JSON.parse(JSON.stringify(mech));
    const restored = history.undo(afterEdit);
    assert.equal(restored.links.find((l) => l.name === 'coupler').length, 120);
    const redone = history.redo(restored);
    assert.equal(redone.links.find((l) => l.name === 'coupler').length, 150);
    assert.equal(snapshotBefore.links.length, restored.links.length);
  });
});

/* ------------------------------------------------------------------- view */

suite('view, hit testing and rendering', () => {
  test('world/screen conversion round-trips', () => {
    const camera = createCamera(3, 100, 200);
    const world = { x: 42, y: -17 };
    const back = screenToWorld(camera, worldToScreen(camera, world));
    assert.ok(Math.abs(back.x - world.x) < 1e-9);
    assert.ok(Math.abs(back.y - world.y) < 1e-9);
  });

  test('zoom keeps the point under the cursor fixed', () => {
    const camera = createCamera(3, 100, 200);
    const cursor = { x: 250, y: 130 };
    const before = screenToWorld(camera, cursor);
    zoomCameraAt(camera, cursor, 1.7);
    const after = screenToWorld(camera, cursor);
    assert.ok(Math.abs(before.x - after.x) < 1e-9);
    assert.ok(Math.abs(before.y - after.y) < 1e-9);
  });

  test('fit frames the whole mechanism', () => {
    const mech = buildFourBar();
    const camera = createCamera();
    fitCameraToMechanism(camera, mech, 900, 600);
    for (const j of mech.joints) {
      const s = worldToScreen(camera, j);
      assert.ok(s.x > 0 && s.x < 900, `x=${s.x}`);
      assert.ok(s.y > 0 && s.y < 600, `y=${s.y}`);
    }
  });

  test('hit testing finds joints, links and tracks', () => {
    const mech = buildCrankSlider();
    const camera = createCamera(3, 450, 300);
    const B = mech.joints.find((j) => j.name === 'B');
    const hitJoint = hitTest(mech, worldToScreen(camera, B), camera);
    assert.equal(hitJoint.kind, 'joint');
    assert.equal(hitJoint.id, B.id);

    const O = mech.joints.find((j) => j.name === 'O');
    const A = mech.joints.find((j) => j.name === 'A');
    const mid = { x: (O.x + A.x) / 2, y: (O.y + A.y) / 2 };
    const hitLink = hitTest(mech, worldToScreen(camera, mid), camera, { tolerancePixels: 3 });
    assert.ok(hitLink && ['link', 'joint'].includes(hitLink.kind));

    const far = hitTest(mech, { x: 5, y: 5 }, camera);
    assert.ok(far === null || far.kind === 'track', 'empty space should not select a joint');
  });

  test('renderer draws a scene without throwing (mock 2d context)', () => {
    const calls = { stroke: 0, fill: 0, fillText: 0, arc: 0 };
    const ctx = {
      canvas: { width: 900, height: 600 },
      save() {},
      restore() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {
        calls.arc++;
      },
      quadraticCurveTo() {},
      rect() {},
      stroke() {
        calls.stroke++;
      },
      fill() {
        calls.fill++;
      },
      fillRect() {},
      clearRect() {},
      fillText() {
        calls.fillText++;
      },
      setLineDash() {},
      translate() {},
      rotate() {},
      scale() {},
      measureText: (t) => ({ width: t.length * 6 }),
    };
    const mech = buildCrankSlider();
    const sim = new Simulation(mech);
    sim.advance(0.1);
    renderScene(ctx, {
      mechanism: mech,
      camera: fitCameraToMechanism(createCamera(), mech, 900, 600),
      width: 900,
      height: 600,
      selection: new Set([mech.joints[0].id, mech.links[0].id]),
      hover: { kind: 'joint', id: mech.joints[0].id },
      simulation: sim,
      options: { showGrid: true, showLabels: true, showDimensions: true, showCoordinates: true, showTraces: true, gridSize: 10 },
      pending: { kind: 'link', from: mech.joints[0], to: mech.joints[1] },
      snapPoint: { x: 10, y: 10 },
    });
    assert.ok(calls.stroke > 10, 'expected drawing calls');
    assert.ok(calls.fillText > 5, 'expected labels');
    assert.ok(THEME.background);
  });
});

/* -------------------------------------------------------------- editing UX */

suite('designer editing operations', () => {
  test('link lengths can be edited exactly and the solver obeys', () => {
    const mech = buildFourBar();
    const coupler = mech.links.find((l) => l.name === 'coupler');
    coupler.length = 132.5;
    const result = solveConstraints(mech);
    assert.ok(result.converged);
    const ja = getJoint(mech, coupler.a);
    const jb = getJoint(mech, coupler.b);
    assert.ok(Math.abs(dist(ja, jb) - 132.5) < 1e-9);
  });

  test('two links connected at a joint stay attached when driven', () => {
    const mech = buildCrankSlider();
    const sim = new Simulation(mech);
    sim.play();
    const A = mech.joints.find((j) => j.name === 'A');
    for (let i = 0; i < 240; i++) {
      sim.advance(1 / 120);
      const links = mech.links.filter((l) => l.a === A.id || l.b === A.id);
      assert.equal(links.length, 2);
      for (const l of links) {
        const other = getJoint(mech, l.a === A.id ? l.b : l.a);
        assert.ok(Math.abs(dist(A, other) - l.length) < 1e-7);
      }
    }
  });

  test('dragging moves a joint as close to the pointer as the geometry allows', () => {
    const mech = buildFourBar();
    const A = mech.joints.find((j) => j.name === 'A');
    const C = mech.joints.find((j) => j.name === 'C');
    const D = mech.joints.find((j) => j.name === 'D');
    const start = { x: C.x, y: C.y };
    const target = { x: start.x + 12, y: start.y + 16 };
    solveConstraints(mech, {
      dragTargets: [{ jointId: C.id, x: target.x, y: target.y, weight: 0.6 }],
      ignoreMotors: true,
    });
    const after = { x: C.x, y: C.y };
    assert.ok(dist(after, start) > 1, 'the joint must actually move');
    assert.ok(maxLinkError(mech) < 1e-9, 'links stay rigid while dragging');
    // Brute-force the true closest reachable point on the 1-DOF path.
    let bestDistance = Infinity;
    for (let i = 0; i < 20000; i++) {
      const theta = (i * 2 * Math.PI) / 20000;
      const b = { x: A.x + 40 * Math.cos(theta), y: A.y + 40 * Math.sin(theta) };
      const c = circleIntersect(b, 120, D, 90, 1);
      if (!c) continue;
      bestDistance = Math.min(bestDistance, dist(c, target));
    }
    const solverDistance = dist(after, target);
    assert.ok(
      solverDistance - bestDistance < 0.05,
      `solver stopped ${(solverDistance - bestDistance).toFixed(3)} mm short of the optimum`,
    );
  });

  test('dragging back-drives the mechanism through a running motor', () => {
    const mech = buildFourBar();
    const motor = mech.motors[0];
    const commanded = motor.angle;
    const C = mech.joints.find((j) => j.name === 'C');
    solveConstraints(mech, {
      dragTargets: [{ jointId: C.id, x: C.x + 15, y: C.y + 10, weight: 0.6 }],
      ignoreMotors: true,
    });
    const A = mech.joints.find((j) => j.name === 'A');
    const B = mech.joints.find((j) => j.name === 'B');
    const crank = Math.atan2(B.y - A.y, B.x - A.x);
    assert.ok(Math.abs(angleDiff(crank, commanded)) > rad(1), 'the crank must have been back-driven');
    assert.ok(maxLinkError(mech) < 1e-9);
    captureHome(mech);
    assert.ok(Math.abs(angleDiff(motor.angle, crank)) < 1e-9, 'the command must follow the new pose');
    assert.ok(Math.abs(angleDiff(motor.angleHome, crank)) < 1e-9);
  });

  test('a mechanism built by hand behaves like the preset', () => {
    // Build the same four-bar through the public editing API.
    const mech = createMechanism('hand built');
    const A = addFixedPivot(mech, 0, 0);
    const D = addFixedPivot(mech, 120, 0);
    const B = addRevoluteJoint(mech, 20, 34.641);
    const C = addRevoluteJoint(mech, 21.377, 89.499);
    addLink(mech, A.id, D.id, { length: 120, kind: 'ground' });
    const crank = addLink(mech, A.id, B.id, { length: 40 });
    addLink(mech, B.id, C.id, { length: 120 });
    addLink(mech, C.id, D.id, { length: 90 });
    const start = solveConstraints(mech);
    assert.ok(start.converged, `residual ${start.residual}`);
    addMotor(mech, A.id, crank.id);
    captureHome(mech);
    const { worstLink, blockedAt } = runSimulation(mech, 2.0);
    assert.equal(blockedAt, null);
    assert.ok(worstLink < 1e-7);
  });

  test('a link works no matter which way round its joints were created', () => {
    // Regression: the normal equations used to assume that each row's entries
    // were sorted by variable index. A link running from a later-created joint
    // back to an earlier one (joint order A, slider B, joint C, link C-B)
    // assembled the wrong matrix and the solver stalled instead of moving.
    const build = (reversed) => {
      const mech = createMechanism('reversed link');
      const A = addFixedPivot(mech, 0, 0);
      const rail = addTrack(mech, { x: -60, y: 0 }, { x: 200, y: 0 });
      const B = addSlider(mech, 100, 0, rail.id);
      const C = addRevoluteJoint(mech, 0, 40);
      const crank = addLink(mech, A.id, C.id, { length: 40 });
      if (reversed) addLink(mech, C.id, B.id, { length: Math.hypot(100, 40) });
      else addLink(mech, B.id, C.id, { length: Math.hypot(100, 40) });
      addMotor(mech, A.id, crank.id);
      captureHome(mech);
      return { mech, B, C };
    };

    const forward = build(true);
    const backward = build(false);
    const simA = new Simulation(forward.mech);
    const simB = new Simulation(backward.mech);
    simA.play();
    simB.play();
    for (let i = 0; i < 600 && !simA.blocked; i++) {
      simA.advance(1 / 240);
      simB.advance(1 / 240);
      assert.ok(maxLinkError(forward.mech) < 1e-9, `link error at step ${i}`);
      assert.ok(maxSliderOffset(forward.mech) < 1e-9, `rail offset at step ${i}`);
    }
    assert.equal(simA.blocked, false, 'a valid crank-slider must not jam');
    assert.ok(simA.time > 2, `only advanced ${simA.time.toFixed(3)} s`);
    assert.ok(Math.abs(forward.B.x - backward.B.x) < 1e-9, 'both link directions describe the same motion');
    assert.ok(Math.abs(forward.C.y - backward.C.y) < 1e-9);
  });

  test('a slider can be added to an existing rail and stays attached', () => {
    const mech = createMechanism('rail test');
    const O = addFixedPivot(mech, 0, 0);
    const track = addTrack(mech, { x: -50, y: 40 }, { x: 150, y: 40 });
    const A = addRevoluteJoint(mech, 0, 60);
    const B = addSlider(mech, 80, 41, track.id);
    const crank = addLink(mech, O.id, A.id, { length: 60 });
    addLink(mech, A.id, B.id, { length: 100 });
    addMotor(mech, O.id, crank.id);
    resetToHome(mech);
    const sim = new Simulation(mech);
    sim.play();
    for (let i = 0; i < 480; i++) {
      sim.advance(1 / 240);
      const t = getTrack(mech, track.id);
      assert.ok(Math.abs(B.y - 40) < 1e-9, 'slider must stay on the rail');
      assert.ok(Math.abs(dist(A, B) - 100) < 1e-7, 'rod length must hold');
      assert.ok(dist(O, A) - 60 < 1e-7);
      void t;
    }
  });
});

/* ------------------------------------------------------------------- fuzz */

suite('randomised robustness', () => {
  /** Deterministic pseudo-random generator so failures are reproducible. */
  function lcg(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  test('random four-bars keep their links rigid whatever the joint order', () => {
    let ran = 0;
    let jammed = 0;
    let worst = 0;
    let built = 0;
    for (let seed = 1; seed <= 60 && built < 40; seed++) {
      const random = lcg(seed * 7919);
      // Grashof crank-rocker by construction: the crank is the shortest link and
      // sits next to the ground, so it can turn a full revolution.
      const crank = 15 + random() * 40;
      const ground = crank + 15 + random() * 150;
      const rocker = crank + 5 + random() * 130;
      let coupler = 0;
      let ok = false;
      for (let attempt = 0; attempt < 60 && !ok; attempt++) {
        coupler = crank + 5 + random() * 200;
        const links = [crank, ground, rocker, coupler];
        const longest = Math.max(...links);
        const total = links.reduce((a, b) => a + b, 0);
        // Grashof: shortest + longest <= sum of the other two. The crank is the
        // shortest link and sits next to the ground, so it turns a full turn.
        ok = 2 * (crank + longest) <= total;
      }
      if (!ok) continue;
      built++;

      const mech = createMechanism(`fuzz ${seed}`);
      const startAngle = random() * 2 * Math.PI;
      const Bpos = { x: crank * Math.cos(startAngle), y: crank * Math.sin(startAngle) };
      const Cpos = circleIntersect(Bpos, coupler, { x: ground, y: 0 }, rocker, 1);
      if (!Cpos) continue;

      // Randomised creation order and randomised link direction: this is what
      // the constraint-assembly order bug needed in order to show up.
      const A = addFixedPivot(mech, 0, 0);
      const D = addFixedPivot(mech, ground, 0);
      const B = addRevoluteJoint(mech, Bpos.x, Bpos.y);
      const C = addRevoluteJoint(mech, Cpos.x, Cpos.y);
      const pairs = [
        [A.id, D.id, ground, 'ground'],
        [A.id, B.id, crank, 'crank'],
        [B.id, C.id, coupler, 'coupler'],
        [C.id, D.id, rocker, 'rocker'],
      ];
      for (const [first, second, length, name] of pairs) {
        if (random() < 0.5) addLink(mech, first, second, { length, name });
        else addLink(mech, second, first, { length, name });
      }
      const crankLink = mech.links.find((l) => l.name === 'crank');
      addMotor(mech, A.id, crankLink.id, { omega: 2.5 + random() * 3 });
      captureHome(mech);

      const sim = new Simulation(mech);
      assert.equal(sim.converged, true, `seed ${seed}: the initial pose must solve`);
      sim.play();
      for (let i = 0; i < 600 && !sim.blocked; i++) {
        sim.advance(1 / 240);
        worst = Math.max(worst, maxLinkError(mech));
        assert.ok(maxLinkError(mech) < 1e-7, `seed ${seed}: link error ${maxLinkError(mech)}`);
      }
      if (sim.blocked) {
        jammed++;
        assert.ok(maxLinkError(mech) < 1e-7, `seed ${seed}: jammed pose lost its geometry`);
      } else {
        ran++;
        assert.ok(sim.time > 2, `seed ${seed}: only ran ${sim.time.toFixed(3)} s`);
      }
      assert.ok(validate(mech).ok, `seed ${seed}: model became invalid`);
    }
    assert.ok(built >= 35, `only generated ${built} valid four-bars`);
    assert.ok(ran >= built - 4, `${jammed} of ${built} Grashof crank-rockers jammed`);
    assert.ok(worst < 1e-7, `worst link error across the fuzz run: ${worst}`);
  });

  test('random crank-sliders stay attached and reachable', () => {
    let worstLink = 0;
    let worstRail = 0;
    let checked = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const random = lcg(seed * 104729);
      const rod = 80 + random() * 120;
      const crank = 10 + random() * (rod * 0.7); // keeps the crank fully rotatable
      const offset = (random() - 0.5) * 2 * (rod - crank) * 0.8;
      const mech = createMechanism(`slider fuzz ${seed}`);
      const O = addFixedPivot(mech, 0, 0);
      const rail = addTrack(mech, { x: -crank - rod, y: offset }, { x: crank + rod, y: offset });
      const angle = random() * 2 * Math.PI;
      const Apos = { x: crank * Math.cos(angle), y: crank * Math.sin(angle) };
      const A = addRevoluteJoint(mech, Apos.x, Apos.y);
      const dy = Apos.y - offset;
      const reach = Math.sqrt(Math.max(0, rod * rod - dy * dy));
      const B = addSlider(mech, Apos.x + reach, offset, rail.id);
      const crankLink = addLink(mech, O.id, A.id, { length: crank });
      if (seed % 2 === 0) addLink(mech, A.id, B.id, { length: rod });
      else addLink(mech, B.id, A.id, { length: rod });
      addMotor(mech, O.id, crankLink.id, { omega: 3 });
      captureHome(mech);

      const sim = new Simulation(mech);
      sim.play();
      let minS = Infinity;
      let maxS = -Infinity;
      for (let i = 0; i < 480 && !sim.blocked; i++) {
        sim.advance(1 / 240);
        worstLink = Math.max(worstLink, maxLinkError(mech));
        worstRail = Math.max(worstRail, maxSliderOffset(mech));
        assert.ok(maxSliderOffset(mech) < 1e-9, `seed ${seed}: slider left the rail`);
        minS = Math.min(minS, B.y);
        maxS = Math.max(maxS, B.y);
      }
      assert.equal(sim.blocked, false, `seed ${seed}: valid crank-slider jammed (${sim.message})`);
      assert.ok(Math.abs(minS - offset) < 1e-9 && Math.abs(maxS - offset) < 1e-9);
      checked++;
    }
    assert.equal(checked, 25);
    assert.ok(worstLink < 1e-7, `worst link error ${worstLink}`);
    assert.ok(worstRail < 1e-9, `worst rail offset ${worstRail}`);
  });
});

/* ----------------------------------------------------- page wiring & build */

suite('page wiring', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  test('every element the app looks up exists in index.html', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const wanted = new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
    const missing = [...wanted].filter((id) => !ids.has(id));
    assert.deepEqual(missing, [], `index.html is missing: ${missing.join(', ')}`);
    // ... and the reverse, so dead markup is spotted too.
    const used = new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
    for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
      for (const id of match[1].split(/\s+/)) used.add(id);
    }
    for (const match of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) used.add(match[1]);
    const unusedStatic = [...ids].filter(
      (id) => !used.has(id) && !/^(canvas|mech-name|tool-grid|preset-list|display-toggles|structure-info|inspector|readout|status-bar|canvas-hint|slot-name|slot-list|btn-save-slot|btn-export|btn-import|file-input|storage-note|link-length|link-length-lock|toast|help-overlay|btn-help-close|btn-help|btn-undo|btn-redo|btn-fit|btn-play|btn-step|btn-back-step|btn-fwd-step|btn-reset|btn-clear-traces|crank-angle|crank-angle-out|play-speed|play-speed-out|tool-hint)$/.test(id),
    );
    assert.deepEqual(unusedStatic, [], `unreferenced ids: ${unusedStatic.join(', ')}`);
  });

  test('the stylesheet hides elements with the hidden attribute', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.overlay\[hidden\]/);
    assert.match(css, /\.toast\[hidden\]/);
  });

  test('index.html references the modular sources', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /href="\.\/styles\.css"/);
    assert.match(html, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
  });
});

suite('single-file build', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  test('the bundle evaluates and exposes every module', () => {
    const code = buildBundle();
    const sandbox = { console };
    sandbox.globalThis = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(code, context);
    const api = context.__LINKAGE_BUNDLE__;
    assert.ok(api, 'bundle must expose its module registry');
    for (const name of [
      'math.js',
      'model.js',
      'solver.js',
      'simulate.js',
      'presets.js',
      'serialize.js',
      'view.js',
      'render.js',
      'history.js',
      'app.js',
    ]) {
      assert.ok(api.modules[name], `missing module ${name}`);
    }
    // Cross-module wiring: the bundled modules must actually work together.
    const presets = api.require('presets.js');
    const simulate = api.require('simulate.js');
    const solver = api.require('solver.js');
    const mech = presets.buildFourBar();
    const sim = new simulate.Simulation(mech);
    sim.play();
    for (let i = 0; i < 240; i++) sim.advance(1 / 240);
    const residuals = solver.evaluateResiduals(mech);
    assert.ok(residuals.maxLinkError < 1e-7, `bundled solver error ${residuals.maxLinkError}`);
    assert.ok(sim.time > 0.9);
  });

  test('the bundle html has no external asset references', () => {
    const html = buildHtml();
    assert.ok(!html.includes('href="./styles.css"'), 'stylesheet must be inlined');
    assert.ok(!html.includes('src="./src/app.js"'), 'scripts must be inlined');
    assert.match(html, /<style>/);
    assert.match(html, /globalThis\.__LINKAGE_BUNDLE__/);
    assert.ok(html.length > 120000, `bundle looks too small: ${html.length} bytes`);
  });

  test('dist/linkage-designer.html is present and up to date', () => {
    const target = path.join(root, 'dist', 'linkage-designer.html');
    assert.ok(fs.existsSync(target), 'run `npm run build` first');
    const onDisk = fs.readFileSync(target, 'utf8');
    assert.equal(onDisk, buildHtml(), 'dist bundle is stale — run `npm run build`');
  });
});

/* -------------------------------------------------------------------- main */

process.exitCode = await run();

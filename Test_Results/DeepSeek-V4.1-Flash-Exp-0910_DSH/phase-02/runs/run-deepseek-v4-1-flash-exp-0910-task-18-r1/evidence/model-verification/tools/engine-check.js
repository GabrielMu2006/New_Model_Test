/* Engine verification: conservation + contact behaviour.
   Run: node tools/engine-check.js */
'use strict';
const P = require('../js/physics.js');
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const fmt = (n, d = 2) => Number(n).toFixed(d);

/* 1. Ball rolls down a 30 degree ramp: it must gain spin (roll, not slide) */
{
  const w = new P.World({ dt: 1 / 240, gy: 1000 });
  w.addSegment(new P.Segment(0, 0, 400, 231, { r: 4, friction: 0.4 }));
  const ball = w.addParticle(new P.Particle(20, -18, { r: 14, rolls: true, mass: 1, friction: 0.5, restitution: 0.05 }));
  w.run(0.9);
  const v = ball.vx(w.dt);
  check('rolling ramp: gains forward speed', v > 150, `vx=${fmt(v)}`);
  check('rolling ramp: spin is clockwise/positive', ball.angVel > 5, `spin=${fmt(ball.angVel)} rad/s`);
  check('rolling ramp: spin ~ v/r (rolling not sliding)',
    Math.abs(ball.angVel - v / ball.r) / (v / ball.r) < 0.6,
    `spin=${fmt(ball.angVel)} v/r=${fmt(v / ball.r)}`);
}

/* 2. Sliding friction actually decelerates a block on a flat floor */
{
  const w = new P.World({ dt: 1 / 240, gy: 1000 });
  w.addSegment(new P.Segment(-2000, 0, 2000, 0, { r: 4, friction: 0.6 }));
  const p = w.addParticle(new P.Particle(0, -9, { r: 5, mass: 1, friction: 0.6, restitution: 0 }));
  p.addVelocity(400, 0, w.dt);
  w.run(0.5);
  check('sliding friction decelerates', p.vx(w.dt) < 380, `vx=${fmt(p.vx(w.dt))} after 0.5s`);
}

/* 3. Elastic-ish head-on transfer: moving ball hits resting equal ball */
{
  const w = new P.World({ dt: 1 / 240, gy: 0 });
  const a = w.addParticle(new P.Particle(0, 0, { r: 12, mass: 1, restitution: 0.9, friction: 0.2 }));
  const b = w.addParticle(new P.Particle(60, 0, { r: 12, mass: 1, restitution: 0.9, friction: 0.2 }));
  a.addVelocity(300, 0, w.dt);
  w.run(0.6);
  check('momentum transfer: resting ball is pushed away', b.vx(w.dt) > 150, `b.vx=${fmt(b.vx(w.dt))}`);
  check('momentum transfer: striker slows down', a.vx(w.dt) < b.vx(w.dt), `a.vx=${fmt(a.vx(w.dt))} b.vx=${fmt(b.vx(w.dt))}`);
}

/* 4. No tunnelling: fast ball crossing a thin wall must be stopped */
{
  const w = new P.World({ dt: 1 / 240, gy: 0 });
  w.addSegment(new P.Segment(100, -200, 100, 200, { r: 5, restitution: 0.3 }));
  const p = w.addParticle(new P.Particle(0, 0, { r: 10, restitution: 0.3 }));
  p.addVelocity(1500, 0, w.dt);
  w.run(0.5);
  check('no tunnelling through thin wall', p.x < 100, `x=${fmt(p.x)}`);
}

/* 5. Pendulum: swings for a long time, energy loss is slow */
{
  const w = new P.World({ dt: 1 / 240, gy: 1000 });
  const anchor = w.addParticle(new P.Particle(0, 0, { pinned: true, r: 2 }));
  const bob = w.addParticle(new P.Particle(100, 0, { r: 12, mass: 2 }));
  w.pin(anchor, bob, { length: 100 });
  const peak = () => { let m = 0; for (let i = 0; i < 240; i++) { w.step(); m = Math.max(m, Math.hypot(bob.vx(w.dt), bob.vy(w.dt))); } return m; };
  const s1 = peak(), s2 = peak(), s3 = peak();
  check('pendulum swings', s1 > 300, `peak speed=${fmt(s1)}`);
  check('pendulum keeps energy over seconds', s3 > s1 * 0.5, `peaks: ${fmt(s1)} / ${fmt(s2)} / ${fmt(s3)}`);
}

/* 6. A nudged standing rod topples flat onto the floor and stops */
{
  const w = new P.World({ dt: 1 / 240, gy: 1000 });
  w.addSegment(new P.Segment(-400, 0, 400, 0, { r: 4, friction: 0.6 }));
  const rod = w.rod(-5, -9, -5, -69, { r: 5, mass: 0.7, friction: 0.6 });
  rod.a.addVelocity(80, 0, w.dt);
  w.run(2.5);
  const flat = Math.abs(rod.b.y - rod.a.y) < 14;
  check('standing rod topples flat', flat, `base y=${fmt(rod.a.y, 1)} tip y=${fmt(rod.b.y, 1)}`);
  const speed = Math.hypot(rod.a.vx(w.dt), rod.a.vy(w.dt));
  check('toppled rod settles', speed < 60, `speed=${fmt(speed)}`);
}

/* 7. Pulley constraint: lowering one side raises the other by the same amount */
{
  const w = new P.World({ dt: 1 / 240, gy: 1000 });
  const pulley = { x: 0, y: 0, r: 14 };
  const left = w.addParticle(new P.Particle(-8, 160, { r: 6, mass: 3 }));
  const right = w.addParticle(new P.Particle(8, 160, { r: 6, mass: 0.5 }));
  w.constraints.push(new P.PulleyConstraint(left, right, pulley, {}));
  const y0 = left.y, y1 = right.y;
  w.run(1.2);
  const dLeft = left.y - y0, dRight = right.y - y1;
  check('pulley: heavy side sinks', dLeft > 5, `Δleft=${fmt(dLeft, 1)}`);
  check('pulley: light side rises by the same amount', Math.abs(dLeft + dRight) < 4, `Δleft=${fmt(dLeft, 1)} Δright=${fmt(dRight, 1)}`);
}

/* 8. Determinism */
{
  const runOnce = () => {
    const w = new P.World({ dt: 1 / 240, gy: 1000 });
    w.addSegment(new P.Segment(0, 0, 300, 200, { r: 4, friction: 0.3 }));
    const b = w.addParticle(new P.Particle(20, -30, { r: 9, rolls: true }));
    w.run(2.5);
    return [b.x, b.y, b.angle].map(v => Number(v.toFixed(9)));
  };
  const a = runOnce(), c = runOnce();
  check('deterministic replay', JSON.stringify(a) === JSON.stringify(c));
}

console.log(failures === 0 ? '\nAll engine checks passed.' : `\n${failures} engine check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

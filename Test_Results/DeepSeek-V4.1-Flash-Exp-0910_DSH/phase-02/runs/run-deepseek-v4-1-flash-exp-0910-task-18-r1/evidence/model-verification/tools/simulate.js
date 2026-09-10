/* Headless run of the machine: reports when each stage fires and how the
   chain behaves, without a browser.
   Run: node tools/simulate.js [--trace] [--max=40] */
'use strict';
const { buildMachine, WORLD_W, WORLD_H } = require('../js/machine.js');

const args = process.argv.slice(2);
const TRACE = args.includes('--trace');
const MAX = Number((args.find(a => a.startsWith('--max=')) || '--max=45').split('=')[1]);

const M = buildMachine();
M.settle(2.2);

const w = M.world;
console.log(`settled after 2.2s   bodies=${M.bodies.length} particles=${w.particles.length} segments=${w.segments.length}`);

/* report resting positions of the key pieces, useful when tuning */
const p = M.parts;
const pos = (n) => {
  const q = p[n];
  if (!q) return 'n/a';
  if (q.x !== undefined) return `(${q.x.toFixed(0)},${q.y.toFixed(0)})`;
  if (q.a) return `(${q.a.x.toFixed(0)},${q.a.y.toFixed(0)})-(${q.b.x.toFixed(0)},${q.b.y.toFixed(0)})`;
  if (q.points) return q.points.map(pt => `(${pt.x.toFixed(0)},${pt.y.toFixed(0)})`).join(' ');
  if (q.bob) return `bob(${q.bob.x.toFixed(0)},${q.bob.y.toFixed(0)})`;
  return '?';
};
for (const n of ['ram', 'A', 'B', 'E', 'F']) {
  console.log(`  rest ${n.padEnd(9)} ${pos(n)}`);
}

M.release();

const dt = w.dt;
const results = [];
let stageIdx = 0;
let t = 0;
let finishedAt = null;
const T_MAX = MAX;
let outOfBounds = [];

const stepReport = [];
while (t < T_MAX) {
  w.step();
  t += dt;
  M.time = t;

  if (stageIdx < M.stages.length && M.stages[stageIdx].test()) {
    const st = M.stages[stageIdx];
    st.done = true;
    results.push({ id: st.id, title: st.title, t });
    stageIdx++;
  }

  if (TRACE && Math.abs(t * 2 - Math.round(t * 2)) < 1e-9) {
    stepReport.push(`${t.toFixed(1)}s A(${p.A.x.toFixed(0)},${p.A.y.toFixed(0)}) B(${p.B.x.toFixed(0)},${p.B.y.toFixed(0)}) E(${p.E.x.toFixed(0)},${p.E.y.toFixed(0)}) F(${p.F.x.toFixed(0)},${p.F.y.toFixed(0)}) gate=${p.pulley.gateTop.y.toFixed(0)} bucket=${p.pulley.bucketTop.y.toFixed(0)} cradle=${p.cradle[2].bob.y.toFixed(0)}`);
  }
}

for (const pt of w.particles) {
  if (pt.escaped) continue;
  if (pt.x < -40 || pt.x > WORLD_W + 40 || pt.y < -60 || pt.y > WORLD_H + 60) {
    outOfBounds.push(`${pt.tag || '?'} at (${pt.x.toFixed(0)},${pt.y.toFixed(0)})`);
  }
}

if (TRACE) console.log('\n' + stepReport.join('\n'));

console.log('\nstage timeline:');
for (const st of M.stages) {
  const r = results.find(x => x.id === st.id);
  console.log(`  ${String(st.id).padStart(2)}. ${r ? `t=${r.t.toFixed(2)}s` : 'NEVER  '}  ${st.title}`);
}
console.log(`\nfired ${results.length}/${M.stages.length} stages`);
if (outOfBounds.length) console.log('OUT OF BOUNDS: ' + outOfBounds.join('; '));
const ok = results.length === M.stages.length && outOfBounds.length === 0;
console.log(ok ? 'CHAIN OK' : 'CHAIN INCOMPLETE');
process.exit(ok ? 0 : 1);

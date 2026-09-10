/* Reports geometry that starts interpenetrating — the usual cause of a
   machine that explodes during its settle phase.
   Run: node tools/overlaps.js */
'use strict';
const { buildMachine } = require('../js/machine.js');
const M = buildMachine();
const w = M.world;
const issues = [];

for (const p of w.particles) {
  if (p.pinned) continue;
  for (const s of w.segments) {
    const ex = s.bx - s.ax, ey = s.by - s.ay;
    const l2 = ex*ex + ey*ey;
    let t = l2 > 1e-9 ? ((p.x-s.ax)*ex + (p.y-s.ay)*ey)/l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = s.ax + ex*t, cy = s.ay + ey*t;
    const d = Math.hypot(p.x-cx, p.y-cy);
    const min = p.r + s.r;
    if (d < min - 1.0) issues.push(`particle ${p.body||p.tag}(${p.x.toFixed(0)},${p.y.toFixed(0)}) in static seg (${s.ax},${s.ay})-(${s.bx},${s.by}) overlap=${(min-d).toFixed(1)}`);
  }
  for (const c of w.circles) {
    const d = Math.hypot(p.x-c.x, p.y-c.y);
    if (d < p.r + c.r - 1.0) issues.push(`particle ${p.body||p.tag} in circle (${c.x},${c.y}) overlap=${(p.r+c.r-d).toFixed(1)}`);
  }
}
for (let i = 0; i < w.particles.length; i++) {
  const a = w.particles[i];
  if (a.pinned) continue;
  for (let j = i+1; j < w.particles.length; j++) {
    const b = w.particles[j];
    if (b.pinned) continue;
    if (a.body && b.body && a.body === b.body) continue;
    const d = Math.hypot(a.x-b.x, a.y-b.y);
    const min = a.r + b.r;
    if (d < min - 1.0) issues.push(`particles ${a.body||a.tag}(${a.x.toFixed(0)},${a.y.toFixed(0)}) & ${b.body||b.tag}(${b.x.toFixed(0)},${b.y.toFixed(0)}) overlap=${(min-d).toFixed(1)}`);
  }
}
for (const cap of w.capsules) {
  for (const p of w.particles) {
    if (p.pinned || p === cap.a || p === cap.b) continue;
    if (cap.body && p.body && cap.body === p.body) continue;
    const ex = cap.b.x-cap.a.x, ey = cap.b.y-cap.a.y;
    const l2 = ex*ex+ey*ey;
    let t = l2 > 1e-9 ? ((p.x-cap.a.x)*ex + (p.y-cap.a.y)*ey)/l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = cap.a.x + ex*t, cy = cap.a.y + ey*t;
    const d = Math.hypot(p.x-cx, p.y-cy);
    if (d < p.r + cap.r - 1.0) issues.push(`particle ${p.body||p.tag}(${p.x.toFixed(0)},${p.y.toFixed(0)}) in capsule ${cap.body} overlap=${(p.r+cap.r-d).toFixed(1)}`);
  }
}
if (!issues.length) console.log('no initial overlaps');
else { console.log(`${issues.length} initial overlap(s):`); issues.forEach(s => console.log('  ' + s)); }

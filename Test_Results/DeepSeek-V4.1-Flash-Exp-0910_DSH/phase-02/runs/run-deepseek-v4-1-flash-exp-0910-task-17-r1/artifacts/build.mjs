/* ------------------------------------------------------------------------
 * build.mjs — emits mechanical-watch-movement.svg
 *
 * The whole artwork is generated from src/model.js so the static markup and
 * the runtime animation can never disagree. The generated file is fully
 * standalone: no external assets, no network, no fonts beyond system stacks.
 *
 *   node build.mjs
 * ---------------------------------------------------------------------- */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const modelSrc = readFileSync(join(here, 'src', 'model.js'), 'utf8');
const runtimeSrc = readFileSync(join(here, 'src', 'runtime.js'), 'utf8');
await import('./src/model.js');
const M = globalThis.WatchModel;

/* ---------------- tiny svg helpers ------------------------------------ */
const A = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
const T = (name, attrs, inner = '') => `<${name}${A(attrs)}>${inner}</${name}>`;
const path = (d, attrs) => T('path', { d, ...attrs });
const circle = (cx, cy, r, attrs) => T('circle', { cx: M.n(cx), cy: M.n(cy), r: M.n(r), ...attrs });
const line = (x1, y1, x2, y2, attrs) => T('line', { x1: M.n(x1), y1: M.n(y1), x2: M.n(x2), y2: M.n(y2), ...attrs });
const text = (x, y, str, attrs) => T('text', { x: M.n(x), y: M.n(y), ...attrs }, str);
const g = (attrs, inner) => T('g', attrs, inner);
const rot = (deg, o) => `rotate(${M.n(M.mod(deg, 360))} ${M.n(o.x)} ${M.n(o.y)})`;
const localRot = (deg, o) => `translate(${M.n(o.x)} ${M.n(o.y)}) rotate(${M.n(M.mod(deg, 360))})`;

const UI = M.UI;
const W = UI.width, H = UI.height;
const CX = M.CX, CY = M.CY;
const CASE_R = UI.watch.caseR;          // 400
const BEZEL_R = CASE_R - 24;            // 376
const DIAL_R = UI.watch.dialR;          // 345
const PLATE_R = UI.watch.chapterR;      // 310 -> plate edge
const BALANCE_R = 105;

/* ---------------- gear styling ---------------------------------------- */
const BRASS = 'url(#gBrass)';
const ROSE = 'url(#gRose)';
const STEEL = 'url(#gSteel)';
const BLUED = 'url(#gBlued)';

const STYLE = {
  'barrel.wheel': { fill: BRASS, stroke: '#4a3108', sw: 1.4, spokes: 6, rimScale: 0.082, hubScale: 0.16 },
  'center.wheel': { fill: BRASS, stroke: '#4a3108', sw: 1.3, spokes: 5, rimScale: 0.095, hubScale: 0.20 },
  'third.wheel': { fill: BRASS, stroke: '#4a3108', sw: 1.3, spokes: 5, rimScale: 0.098, hubScale: 0.21 },
  'fourth.wheel': { fill: BRASS, stroke: '#4a3108', sw: 1.3, spokes: 5, rimScale: 0.098, hubScale: 0.21 },
  'center.pinion': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'third.pinion': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'fourth.pinion': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'escape.pinion': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'cannon': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'minuteWheel.wheel': { fill: 'url(#gMotion)', stroke: '#4a5560', sw: 1.1, spokes: 4, rimScale: 0.10, hubScale: 0.24 },
  'minuteWheel.pinion': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'hourWheel': { fill: 'url(#gMotion)', stroke: '#4a5560', sw: 1.1, spokes: 4, rimScale: 0.10, hubScale: 0.26 },
  'compound.pinion': { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true },
  'compound.wheel': { fill: ROSE, stroke: '#5c3320', sw: 1.1, spokes: 4, rimScale: 0.12, hubScale: 0.26 },
  'seconds.wheel': { fill: ROSE, stroke: '#5c3320', sw: 1.2, spokes: 5, rimScale: 0.095, hubScale: 0.20 }
};

function gearMarkup(key) {
  const gm = M.GEARMAP[key];
  const st = STYLE[key] || { fill: STEEL, stroke: '#39434f', sw: 1.1, solid: true };
  const out = [];
  if (st.solid || gm.teeth <= 16) {
    const o = M.gearOutline(gm);
    const bore = Math.max(o.rp * 0.30, 2.6);
    out.push(path(o.d + M.circleSub(gm.cx, gm.cy, bore), {
      fill: st.fill, 'fill-rule': 'evenodd', stroke: st.stroke, 'stroke-width': st.sw
    }));
    out.push(circle(gm.cx, gm.cy, Math.max(bore * 0.42, 1.4), { fill: '#0d1218' }));
  } else {
    const w = M.wheelPath(gm, { spokes: st.spokes, rimScale: st.rimScale, hubScale: st.hubScale });
    out.push(path(w.ring, {
      fill: st.fill, 'fill-rule': 'evenodd', stroke: st.stroke, 'stroke-width': st.sw
    }));
    out.push(path(w.spokes, { fill: st.fill, stroke: st.stroke, 'stroke-width': 0.6 }));
    out.push(path(w.hub, {
      fill: STEEL, 'fill-rule': 'evenodd', stroke: st.stroke, 'stroke-width': 0.9
    }));
    out.push(circle(gm.cx, gm.cy, w.boreR * 0.72, { fill: '#0d1218' }));
  }
  return out.join('');
}

function jewel(x, y, r, label) {
  return g({ class: 'jewel' },
    circle(x, y, r + 2.6, { fill: 'none', stroke: '#d9e3ee', 'stroke-width': '2', opacity: '0.85' }) +
    circle(x, y, r, { fill: 'url(#gRuby)', stroke: '#4a0d16', 'stroke-width': '0.9' }) +
    circle(x - r * 0.28, y - r * 0.3, r * 0.3, { fill: '#ffb9c0', opacity: '0.8' }) +
    (label ? T('title', {}, label) : ''));
}

/* ---------------- defs ------------------------------------------------- */
const defs = T('defs', {}, [
  T('linearGradient', { id: 'gCase', x1: '0', y1: '0', x2: '0.35', y2: '1' },
    T('stop', { offset: '0', 'stop-color': '#f4f8fc' }) +
    T('stop', { offset: '0.34', 'stop-color': '#b9c4d0' }) +
    T('stop', { offset: '0.62', 'stop-color': '#7b8794' }) +
    T('stop', { offset: '1', 'stop-color': '#3f4954' })),
  T('radialGradient', { id: 'gBrass', cx: '34%', cy: '28%', r: '82%' },
    T('stop', { offset: '0', 'stop-color': '#ffeec2' }) +
    T('stop', { offset: '0.38', 'stop-color': '#e3b761' }) +
    T('stop', { offset: '0.74', 'stop-color': '#bd8a33' }) +
    T('stop', { offset: '1', 'stop-color': '#7d5416' })),
  T('radialGradient', { id: 'gRose', cx: '34%', cy: '28%', r: '82%' },
    T('stop', { offset: '0', 'stop-color': '#ffd9c4' }) +
    T('stop', { offset: '0.4', 'stop-color': '#e0a077' }) +
    T('stop', { offset: '0.78', 'stop-color': '#b06c46' }) +
    T('stop', { offset: '1', 'stop-color': '#6d3a20' })),
  T('radialGradient', { id: 'gSteel', cx: '32%', cy: '26%', r: '85%' },
    T('stop', { offset: '0', 'stop-color': '#ffffff' }) +
    T('stop', { offset: '0.42', 'stop-color': '#d5dee7' }) +
    T('stop', { offset: '0.78', 'stop-color': '#93a1b0' }) +
    T('stop', { offset: '1', 'stop-color': '#5b6673' })),
  T('radialGradient', { id: 'gMotion', cx: '32%', cy: '26%', r: '85%' },
    T('stop', { offset: '0', 'stop-color': '#fbfdff' }) +
    T('stop', { offset: '0.45', 'stop-color': '#c3ced9' }) +
    T('stop', { offset: '1', 'stop-color': '#6d7a88' })),
  T('linearGradient', { id: 'gBlued', x1: '0', y1: '0', x2: '1', y2: '1' },
    T('stop', { offset: '0', 'stop-color': '#7ea8d8' }) +
    T('stop', { offset: '0.5', 'stop-color': '#3d6ba3' }) +
    T('stop', { offset: '1', 'stop-color': '#1d3f6b' })),
  T('radialGradient', { id: 'gRuby', cx: '34%', cy: '30%', r: '80%' },
    T('stop', { offset: '0', 'stop-color': '#ff7d8c' }) +
    T('stop', { offset: '0.45', 'stop-color': '#d63a4c' }) +
    T('stop', { offset: '1', 'stop-color': '#7d0f1e' })),
  T('radialGradient', { id: 'gDial', cx: '50%', cy: '45%', r: '62%' },
    T('stop', { offset: '0', 'stop-color': '#1b2530' }) +
    T('stop', { offset: '0.72', 'stop-color': '#141c26' }) +
    T('stop', { offset: '1', 'stop-color': '#0c1119' })),
  T('radialGradient', { id: 'gPlate', cx: '38%', cy: '30%', r: '78%' },
    T('stop', { offset: '0', 'stop-color': '#3c4756' }) +
    T('stop', { offset: '0.7', 'stop-color': '#2b3542' }) +
    T('stop', { offset: '1', 'stop-color': '#1d2530' })),
  T('radialGradient', { id: 'gBack', cx: '50%', cy: '50%', r: '72%' },
    T('stop', { offset: '0', 'stop-color': '#141d28' }) +
    T('stop', { offset: '1', 'stop-color': '#05080c' })),
  T('linearGradient', { id: 'gGlass', x1: '0', y1: '0', x2: '1', y2: '1' },
    T('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.13' }) +
    T('stop', { offset: '0.42', 'stop-color': '#ffffff', 'stop-opacity': '0.02' }) +
    T('stop', { offset: '1', 'stop-color': '#ffffff', 'stop-opacity': '0.07' })),
  T('pattern', { id: 'perlage', width: '26', height: '26', patternUnits: 'userSpaceOnUse' },
    circle(7, 7, 5.4, { fill: 'none', stroke: '#46525f', 'stroke-width': '1.1', opacity: '0.55' }) +
    circle(20, 19, 5.4, { fill: 'none', stroke: '#46525f', 'stroke-width': '1.1', opacity: '0.4' })),
  T('filter', { id: 'soft', x: '-25%', y: '-25%', width: '150%', height: '150%' },
    T('feGaussianBlur', { stdDeviation: '4' })),
  T('filter', { id: 'handShadow', x: '-40%', y: '-40%', width: '180%', height: '180%' },
    T('feGaussianBlur', { stdDeviation: '2.4' })),
  T('clipPath', { id: 'clipCase' }, circle(CX, CY, CASE_R - 6, {})),
  T('clipPath', { id: 'clipDial' }, circle(CX, CY, DIAL_R, {}))
].join(''));

/* ---------------- background ------------------------------------------ */
const bg =
  T('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#gBack)' }) +
  T('ellipse', { cx: CX, cy: CY - 40, rx: 560, ry: 470, fill: '#1a2634', opacity: '0.5' });

/* ---------------- case, dial, chapter ring ----------------------------- */
function lugs() {
  const out = [];
  for (const dir of [-1, 1]) {
    for (const side of [-1, 1]) {
      const a = ((dir > 0 ? 90 : 270) + side * 13) / M.DEG;
      const a2 = ((dir > 0 ? 90 : 270) + side * 27) / M.DEG;
      const p1 = { x: CX + (CASE_R - 26) * Math.cos(a), y: CY - (CASE_R - 26) * Math.sin(a) };
      const p2 = { x: CX + (CASE_R + 30) * Math.cos(a), y: CY - (CASE_R + 30) * Math.sin(a) };
      const p3 = { x: CX + (CASE_R + 30) * Math.cos(a2), y: CY - (CASE_R + 30) * Math.sin(a2) };
      const p4 = { x: CX + (CASE_R - 26) * Math.cos(a2), y: CY - (CASE_R - 26) * Math.sin(a2) };
      out.push(path(
        `M${M.n(p1.x)} ${M.n(p1.y)}L${M.n(p2.x)} ${M.n(p2.y)}` +
        `Q${M.n(CX + (CASE_R + 44) * Math.cos((a + a2) / 2))} ${M.n(CY - (CASE_R + 44) * Math.sin((a + a2) / 2))} ${M.n(p3.x)} ${M.n(p3.y)}` +
        `L${M.n(p4.x)} ${M.n(p4.y)}Z`,
        { fill: 'url(#gCase)', stroke: '#4a545f', 'stroke-width': '1.2', opacity: '0.92' }
      ));
    }
  }
  return out.join('');
}

function crown() {
  const x = CX + CASE_R - 4;
  let ridges = '';
  for (let i = -4; i <= 4; i++) {
    ridges += line(x + 6 + i * 2.4, CY - 13, x + 6 + i * 2.4, CY + 13, { stroke: '#5c6773', 'stroke-width': '1' });
  }
  return g({ class: 'crown' },
    T('rect', { x: M.n(x), y: M.n(CY - 15), width: '20', height: '30', rx: '7', fill: 'url(#gCase)', stroke: '#4a545f' }) +
    ridges + T('title', {}, 'Crown \u2014 winding / setting'));
}

function chapterRing() {
  const out = [];
  const rOut = DIAL_R - 8;
  out.push(T('circle', { cx: CX, cy: CY, r: DIAL_R, fill: 'none', stroke: '#2a3644', 'stroke-width': '1.2' }));
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 - 90) / M.DEG;
    const five = i % 5 === 0;
    const r1 = five ? DIAL_R - 36 : DIAL_R - 26;
    const w = five ? 2.4 : 1.1;
    out.push(line(
      CX + r1 * Math.cos(a), CY + r1 * Math.sin(a),
      CX + (rOut - 2) * Math.cos(a), CY + (rOut - 2) * Math.sin(a),
      { stroke: five ? '#dfe7f0' : '#8b98a6', 'stroke-width': w, 'stroke-linecap': 'round' }
    ));
  }
  /* hour batons */
  for (let h = 0; h < 12; h++) {
    const a = (h * 30 - 90) / M.DEG;
    const long = h % 3 === 0;
    const r1 = long ? DIAL_R - 76 : DIAL_R - 62;
    const w = h === 0 ? 6 : (long ? 4.6 : 3);
    out.push(line(
      CX + r1 * Math.cos(a), CY + r1 * Math.sin(a),
      CX + (DIAL_R - 20) * Math.cos(a), CY + (DIAL_R - 20) * Math.sin(a),
      { stroke: '#e8eef6', 'stroke-width': w, 'stroke-linecap': 'round' }
    ));
  }
  /* 12 o'clock marker */
  const a12 = -90 / M.DEG;
  out.push(path(
    `M${M.n(CX + (DIAL_R - 20) * Math.cos(a12) - 11)} ${M.n(CY + (DIAL_R - 20) * Math.sin(a12))}` +
    `L${M.n(CX + (DIAL_R - 4) * Math.cos(a12))} ${M.n(CY + (DIAL_R - 4) * Math.sin(a12))}` +
    `L${M.n(CX + (DIAL_R - 20) * Math.cos(a12) + 11)} ${M.n(CY + (DIAL_R - 20) * Math.sin(a12))}Z`,
    { fill: '#e8eef6' }
  ));
  /* numerals */
  for (const h of [12, 3, 6, 9]) {
    const a = (h * 30 - 90) / M.DEG;
    out.push(text(
      CX + (DIAL_R - 108) * Math.cos(a), CY + (DIAL_R - 108) * Math.sin(a) + 7,
      String(h),
      { fill: '#8d9aa8', 'font-size': '19', 'text-anchor': 'middle', 'font-weight': '300', 'letter-spacing': '0.5' }
    ));
  }
  out.push(text(CX, CY + DIAL_R - 24, 'SKELETON \u00b7 14 400 A/h', {
    fill: '#5f6c7a', 'font-size': '12', 'text-anchor': 'middle', 'letter-spacing': '2.6'
  }));
  return out.join('');
}

const casework = g({ id: 'case' },
  lugs() +
  T('circle', { cx: CX, cy: CY, r: CASE_R, fill: 'url(#gCase)', stroke: '#39424c', 'stroke-width': '1.5' }) +
  T('circle', { cx: CX, cy: CY, r: BEZEL_R, fill: 'none', stroke: '#e8eef6', 'stroke-width': '1', opacity: '0.45' }) +
  T('circle', { cx: CX, cy: CY, r: BEZEL_R - 4, fill: 'url(#gDial)' }) +
  T('circle', { cx: CX, cy: CY, r: DIAL_R, fill: 'none', stroke: '#0a0f15', 'stroke-width': '6', opacity: '0.8' }) +
  chapterRing() +
  crown());

/* ---------------- main plate ------------------------------------------ */
function mainPlate() {
  const arms = [];
  const armAngles = [100, 190, 312];
  for (const a0 of armAngles) {
    const a = a0 / M.DEG;
    const w = 15 / M.DEG;
    const r1 = 46, r2 = PLATE_R - 10;
    arms.push(path(
      `M${M.n(CX + r1 * Math.cos(a - w))} ${M.n(CY + r1 * Math.sin(a - w))}` +
      `L${M.n(CX + r2 * Math.cos(a - w * 0.55))} ${M.n(CY + r2 * Math.sin(a - w * 0.55))}` +
      `A${M.n(r2)} ${M.n(r2)} 0 0 1 ${M.n(CX + r2 * Math.cos(a + w * 0.55))} ${M.n(CY + r2 * Math.sin(a + w * 0.55))}` +
      `L${M.n(CX + r1 * Math.cos(a + w))} ${M.n(CY + r1 * Math.sin(a + w))}Z`,
      { fill: 'url(#gPlate)', stroke: '#151d26', 'stroke-width': '1' }
    ));
  }
  const ring =
    path(
      M.circleSub(CX, CY, PLATE_R) + M.circleSub(CX, CY, PLATE_R - 11),
      { fill: 'url(#gPlate)', 'fill-rule': 'evenodd', stroke: '#151d26', 'stroke-width': '1' }
    );
  const boss = path(
    M.circleSub(CX, CY, 52) + M.circleSub(CX, CY, 30),
    { fill: 'url(#gPlate)', 'fill-rule': 'evenodd', stroke: '#151d26', 'stroke-width': '1' }
  );
  return g({ id: 'plate', opacity: '0.95' },
    T('circle', { cx: CX, cy: CY, r: PLATE_R, fill: 'url(#perlage)', opacity: '0.5' }) +
    ring + arms.join('') + boss);
}

/* ---------------- bridges (dial side, semi transparent) ---------------- */
function bridge(dPath, label) {
  return g({ class: 'bridge' },
    path(dPath, { fill: 'url(#gPlate)', 'fill-rule': 'evenodd', stroke: '#8fa0b2', 'stroke-width': '1', opacity: '0.55' }) +
    (label ? T('title', {}, label) : ''));
}
const bridges =
  /* train bridge over third / fourth / escape */
  bridge(
    `M${M.n(CX + 30)} ${M.n(CY - 34)}` +
    `L${M.n(M.ARBOR.third.x - 26)} ${M.n(M.ARBOR.third.y - 30)}` +
    `L${M.n(M.ARBOR.fourth.x + 4)} ${M.n(M.ARBOR.fourth.y - 34)}` +
    `L${M.n(M.ARBOR.escape.x + 6)} ${M.n(M.ARBOR.escape.y - 18)}` +
    `L${M.n(M.ARBOR.escape.x - 16)} ${M.n(M.ARBOR.escape.y + 22)}` +
    `L${M.n(M.ARBOR.fourth.x - 12)} ${M.n(M.ARBOR.fourth.y + 30)}` +
    `L${M.n(M.ARBOR.third.x - 34)} ${M.n(M.ARBOR.third.y + 22)}Z`,
    'Train bridge \u2014 carries third, fourth and escape pivots') +
  /* barrel bridge */
  bridge(
    `M${M.n(CX - 40)} ${M.n(CY - 52)}` +
    `L${M.n(M.ARBOR.barrel.x - 8)} ${M.n(M.ARBOR.barrel.y - 58)}` +
    `L${M.n(M.ARBOR.barrel.x + 52)} ${M.n(M.ARBOR.barrel.y - 34)}` +
    `L${M.n(M.ARBOR.barrel.x + 40)} ${M.n(M.ARBOR.barrel.y + 20)}` +
    `L${M.n(CX - 34)} ${M.n(CY - 8)}Z`,
    'Barrel bridge') +
  /* balance cock */
  bridge(
    `M${M.n(CX - 6)} ${M.n(CY + 42)}` +
    `L${M.n(M.ARBOR.balance.x - 44)} ${M.n(M.ARBOR.balance.y - 34)}` +
    `L${M.n(M.ARBOR.balance.x + 12)} ${M.n(M.ARBOR.balance.y - 26)}` +
    `L${M.n(M.ARBOR.balance.x + 26)} ${M.n(M.ARBOR.balance.y + 10)}` +
    `L${M.n(M.ARBOR.balance.x - 30)} ${M.n(M.ARBOR.balance.y + 20)}Z`,
    'Balance cock \u2014 holds the balance staff and the hairspring stud');

/* ---------------- movement -------------------------------------------- */
const st0 = M.state(0);
st0.wind = 1;

const shadowDiscs = (() => {
  const out = [];
  for (const key of ['barrel.wheel', 'center.wheel', 'third.wheel', 'fourth.wheel', 'seconds.wheel',
    'minuteWheel.wheel', 'hourWheel', 'compound.wheel']) {
    const gm = M.GEARMAP[key];
    const r = M.pitchR(gm.teeth, gm.mod) + gm.mod * 0.9;
    out.push(circle(gm.cx + 3, gm.cy + 4, r, { fill: '#000000', opacity: '0.34' }));
  }
  const e = M.ARBOR.escape;
  out.push(circle(e.x + 3, e.y + 4, M.pitchR(15, M.ESC_MODULE) + 3, { fill: '#000000', opacity: '0.3' }));
  const b = M.ARBOR.balance;
  out.push(circle(b.x + 4, b.y + 5, BALANCE_R, { fill: '#000000', opacity: '0.36' }));
  return g({ filter: 'url(#soft)' }, out.join(''));
})();

/* barrel ---------------------------------------------------------------- */
const barrelGeo = M.MAINSPRING_GEO;
const barrelGroup = g({ id: 'rot-barrel', transform: rot(st0.barrel, M.ARBOR.barrel) },
  gearMarkup('barrel.wheel') +
  /* barrel drum wall */
  path(M.circleSub(barrelGeo.cx, barrelGeo.cy, barrelGeo.rOut + 4) +
    M.circleSub(barrelGeo.cx, barrelGeo.cy, barrelGeo.rIn - 6),
    { fill: 'url(#gBrass)', 'fill-rule': 'evenodd', opacity: '0.55', stroke: '#4a3108', 'stroke-width': '1' }) +
  path(M.mainspringPath(st0, barrelGeo), {
    id: 'spring-main', fill: 'none', stroke: 'url(#gBlued)', 'stroke-width': '3.4',
    'stroke-linecap': 'round', opacity: '0.95'
  }) +
  T('title', {}, 'Barrel + mainspring \u2014 1 turn every 8 h, counter-clockwise'));

/* escapement ------------------------------------------------------------ */
const escWheel = M.escapeWheelPath(M.GEARMAP['escape.wheel']);
const escapeGroup = g({ id: 'rot-escape', transform: rot(st0.escape, M.ARBOR.escape) },
  path(escWheel.d, {
    fill: STEEL, 'fill-rule': 'evenodd', stroke: '#39434f', 'stroke-width': '1'
  }) +
  circle(M.ARBOR.escape.x, M.ARBOR.escape.y, escWheel.hubR * 0.6, { fill: '#0d1218' }) +
  T('title', {}, 'Escape wheel \u2014 15 club teeth, 1 turn every 7.5 s, counter-clockwise'));

const fork = M.palletPath();
const forkAxis = M.ESC.forkAxis;
const palletGroup = g({ id: 'rot-pallet', transform: rot(st0.pallet, M.ARBOR.pallet) },
  g({ transform: `rotate(${M.n(forkAxis)} ${M.n(M.ARBOR.pallet.x)} ${M.n(M.ARBOR.pallet.y)})` },
    g({ transform: `translate(${M.n(M.ARBOR.pallet.x)} ${M.n(M.ARBOR.pallet.y)})` },
      path(fork.d, { fill: STEEL, stroke: '#39434f', 'stroke-width': '1.1', 'stroke-linejoin': 'round' }) +
      circle(0, 0, 6.5, { fill: 'url(#gSteel)', stroke: '#39434f', 'stroke-width': '1' }))) +
  M.ESC.jewelAngle.map((ang, i) => {
    const a = ang / M.DEG;
    const x = M.ARBOR.escape.x + M.ESC.jewelRadius * Math.cos(a);
    const y = M.ARBOR.escape.y + M.ESC.jewelRadius * Math.sin(a);
    return jewel(x, y, 5.4, i === 0 ? 'Entry pallet jewel' : 'Exit pallet jewel');
  }).join('') +
  T('title', {}, 'Pallet fork \u2014 releases one escape tooth per beat'));

/* balance --------------------------------------------------------------- */
const bal = M.balancePath({ cx: M.ARBOR.balance.x, cy: M.ARBOR.balance.y, r: BALANCE_R });
const screws = (() => {
  let s = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30) / M.DEG;
    const rr = BALANCE_R - 7.5;
    s += circle(M.ARBOR.balance.x + rr * Math.cos(a), M.ARBOR.balance.y + rr * Math.sin(a), 4.2,
      { fill: 'url(#gSteel)', stroke: '#3d4a57', 'stroke-width': '0.8' });
    s += circle(M.ARBOR.balance.x + rr * Math.cos(a), M.ARBOR.balance.y + rr * Math.sin(a), 1.6,
      { fill: '#2a333d' });
  }
  return s;
})();
const pinA = M.ESC.pinAngle / M.DEG;
const pinX = M.ARBOR.balance.x + M.ESC.impulsePinR * Math.cos(pinA);
const pinY = M.ARBOR.balance.y + M.ESC.impulsePinR * Math.sin(pinA);
const balanceGroup = g({ id: 'rot-balance', transform: rot(st0.balance, M.ARBOR.balance) },
  path(bal.rim, { fill: BRASS, 'fill-rule': 'evenodd', stroke: '#4a3108', 'stroke-width': '1.2' }) +
  path(bal.spokes, { fill: BRASS, stroke: '#4a3108', 'stroke-width': '0.8' }) +
  screws +
  circle(M.ARBOR.balance.x, M.ARBOR.balance.y, M.ESC.rollerR, {
    fill: 'url(#gSteel)', stroke: '#39434f', 'stroke-width': '1'
  }) +
  circle(M.ARBOR.balance.x, M.ARBOR.balance.y, M.ESC.rollerR * 0.52, { fill: '#1d252e' }) +
  circle(pinX, pinY, 4.6, { fill: 'url(#gRuby)', stroke: '#4a0d16', 'stroke-width': '0.8' }) +
  circle(M.ARBOR.balance.x, M.ARBOR.balance.y, 5.2, { fill: 'url(#gSteel)', stroke: '#39434f', 'stroke-width': '0.9' }) +
  T('title', {}, 'Balance wheel \u2014 2 Hz, \u00b1270\u00b0, carries the impulse jewel'));

const hairGroup = g({ id: 'hairspring' },
  path(M.hairspringPath(st0, M.HAIRSPRING_GEO), {
    id: 'spring-hair', fill: 'none', stroke: 'url(#gBlued)', 'stroke-width': '1.7',
    'stroke-linecap': 'round', opacity: '0.95'
  }) +
  T('title', {}, 'Hairspring \u2014 breathes once per balance swing'));

/* train ---------------------------------------------------------------- */
const train = [
  g({ id: 'rot-center', transform: rot(st0.center, M.ARBOR.center) },
    gearMarkup('center.wheel') + gearMarkup('center.pinion') +
    T('title', {}, 'Centre wheel \u2014 1 turn per hour, clockwise')),
  g({ id: 'rot-third', transform: rot(st0.third, M.ARBOR.third) },
    gearMarkup('third.wheel') + gearMarkup('third.pinion') +
    T('title', {}, 'Third wheel \u2014 8 turns per hour, counter-clockwise')),
  g({ id: 'rot-fourth', transform: rot(st0.fourth, M.ARBOR.fourth) },
    gearMarkup('fourth.wheel') + gearMarkup('fourth.pinion') +
    T('title', {}, 'Fourth wheel \u2014 1 turn per minute, clockwise')),
  escapeGroup,
  palletGroup,
  balanceGroup,
  hairGroup
].join('');

/* dial side: motion work + indirect centre seconds ---------------------- */
const dialSide = [
  g({ id: 'rot-secondsWheel', transform: rot(st0.secondsWheel, M.ARBOR.secondsWheel) },
    gearMarkup('seconds.wheel') +
    T('title', {}, 'Centre seconds wheel \u2014 indirect drive, 1 turn per minute')),
  g({ id: 'rot-compound', transform: rot(st0.compound, M.ARBOR.compound) },
    gearMarkup('compound.wheel') + gearMarkup('compound.pinion') +
    T('title', {}, 'Seconds intermediate \u2014 3:1 up, 1:3 down, net 1:1')),
  g({ id: 'rot-minuteWheel', transform: rot(st0.minuteWheel, M.ARBOR.minuteWheel) },
    gearMarkup('minuteWheel.wheel') + gearMarkup('minuteWheel.pinion') +
    T('title', {}, 'Minute wheel \u2014 part of the 12:1 motion work')),
  g({ id: 'rot-hourWheel', transform: rot(st0.hourWheel, M.ARBOR.hourWheel) },
    gearMarkup('hourWheel') +
    T('title', {}, 'Hour wheel \u2014 1 turn every 12 h, carries the hour hand')),
  g({ id: 'rot-cannon', transform: rot(st0.cannon, M.ARBOR.center) },
    gearMarkup('cannon') +
    T('title', {}, 'Cannon pinion \u2014 friction fit on the centre arbor, carries the minute hand'))
].join('');

/* jewels at the visible pivots ------------------------------------------ */
const jewelLayer = [
  ['barrel.wheel', 8], ['center.wheel', 9], ['third.wheel', 8], ['fourth.wheel', 8],
  ['escape.wheel', 7], ['minuteWheel.wheel', 7], ['compound.wheel', 6]
].map(([key, r]) => {
  const gm = M.GEARMAP[key];
  return jewel(gm.cx, gm.cy, r, 'Jewel bearing \u2014 ' + key.replace('.', ' '));
}).join('') +
  jewel(M.ARBOR.balance.x, M.ARBOR.balance.y, 7.5, 'Balance jewel, under the cock') +
  jewel(M.ARBOR.pallet.x, M.ARBOR.pallet.y, 5, 'Pallet fork pivot');

/* ---------------- hands ------------------------------------------------- */
function handShadow(inner) { return g({ filter: 'url(#handShadow)', opacity: '0.5' }, inner); }
function hourHand() {
  const L = 205;
  return (
    path(`M0 ${-L}L8 ${-L * 0.30}L11 -12L0 2L-11 -12L-8 ${-L * 0.30}Z`, { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1.4', 'stroke-linejoin': 'round' }) +
    path(`M0 ${-L}L3.4 ${-L * 0.30}L4 -12L0 2Z`, { fill: '#ffffff', opacity: '0.45' }) +
    path('M0 2L7 26L0 44L-7 26Z', { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1.2', 'stroke-linejoin': 'round' }) +
    circle(0, 0, 16, { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1.2' }) +
    circle(0, 0, 4.5, { fill: '#1a222b' })
  );
}
function minuteHand() {
  const L = 300;
  return (
    path(`M0 ${-L}L6 ${-L * 0.34}L8.5 -12L0 2L-8.5 -12L-6 ${-L * 0.34}Z`, { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1.4', 'stroke-linejoin': 'round' }) +
    path(`M0 ${-L}L2.8 ${-L * 0.34}L3.4 -12L0 2Z`, { fill: '#ffffff', opacity: '0.45' }) +
    path('M0 2L6 30L0 50L-6 30Z', { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1.2', 'stroke-linejoin': 'round' }) +
    circle(0, 0, 13, { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1.2' })
  );
}
function secondHand() {
  const L = 318;
  return (
    path(`M0 ${-L}L2.1 ${-L * 0.55}L2.6 -6L0 4L-2.6 -6L-2.1 ${-L * 0.55}Z`, { fill: 'url(#gBlued)', stroke: '#12243a', 'stroke-width': '0.8' }) +
    path(`M0 ${-L}L0 ${-L + 26}`, { stroke: '#e05a3c', 'stroke-width': '4.2', 'stroke-linecap': 'round' }) +
    circle(0, 46, 15, { fill: 'none', stroke: 'url(#gBlued)', 'stroke-width': '4' }) +
    circle(0, 0, 5.6, { fill: 'url(#gBlued)', stroke: '#12243a', 'stroke-width': '0.8' })
  );
}
const hands = [
  g({ id: 'hand-hour', transform: localRot(st0.hourHand, M.ARBOR.center) }, handShadow(hourHand()) + hourHand() + T('title', {}, 'Hour hand')),
  g({ id: 'hand-minute', transform: localRot(st0.minuteHand, M.ARBOR.center) }, handShadow(minuteHand()) + minuteHand() + T('title', {}, 'Minute hand')),
  g({ id: 'hand-second', transform: localRot(st0.secondHand, M.ARBOR.center) }, handShadow(secondHand()) + secondHand() + T('title', {}, 'Second hand')),
  circle(CX, CY, 9, { fill: 'url(#gSteel)', stroke: '#1a222b', 'stroke-width': '1' })
].join('');

/* glass ---------------------------------------------------------------- */
const glass = g({ 'clip-path': 'url(#clipCase)', 'pointer-events': 'none' },
  T('ellipse', { cx: CX - 150, cy: CY - 170, rx: 330, ry: 150, fill: 'url(#gGlass)', transform: `rotate(-28 ${CX} ${CY})` }) +
  T('ellipse', { cx: CX + 190, cy: CY + 210, rx: 240, ry: 110, fill: '#ffffff', opacity: '0.035', transform: `rotate(-28 ${CX} ${CY})` }));

/* ---------------- panels ------------------------------------------------ */
const P = UI.panel;
const panelBase = (y, h) => T('rect', {
  x: P.x, y, width: P.w, height: h, rx: 12,
  fill: '#0d141d', stroke: '#243040', 'stroke-width': '1', opacity: '0.92'
});
const smallTitle = (x, y, s) => text(x, y, s, {
  fill: '#6d7c8d', 'font-size': '10.5', 'letter-spacing': '2.2', 'font-weight': '600'
});

const readout = g({ id: 'readout' },
  panelBase(UI.readout.y, UI.readout.h) +
  smallTitle(P.x + 22, UI.readout.y + 30, 'MOVEMENT STATUS') +
  text(P.x + 22, UI.readout.y + 78, M.clockText(M.BASE_TIME), {
    id: 'clock-text', fill: '#eaf1f8', 'font-size': '40', 'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'letter-spacing': '1.5'
  }) +
  text(P.x1 - 22, UI.readout.y + 74, 'running', {
    id: 'state-text', fill: '#7fd8a0', 'font-size': '12', 'text-anchor': 'end', 'letter-spacing': '0.6'
  }) +
  text(P.x + 22, UI.readout.y + 108, 'POWER RESERVE', {
    fill: '#6d7c8d', 'font-size': '10.5', 'letter-spacing': '2.2', 'font-weight': '600'
  }) +
  text(P.x1 - 22, UI.readout.y + 108, '100%', {
    id: 'power-text', fill: '#cfdae6', 'font-size': '12', 'text-anchor': 'end'
  }) +
  T('rect', { x: P.x + 22, y: UI.readout.y + 118, width: '244', height: '7', rx: '3.5', fill: '#1b2532' }) +
  T('rect', { id: 'power-bar-fill', x: P.x + 22, y: UI.readout.y + 118, width: '244', height: '7', rx: '3.5', fill: 'url(#gBlued)' }) +
  text(P.x + 22, UI.readout.y + 150, '4 beats/s \u00b7 2 Hz \u00b7 14,400 A/h', {
    id: 'beat-text', fill: '#7b8b9c', 'font-size': '11.5'
  }));

const LEGEND = [
  ['Barrel + mainspring', '1 rev / 8 h  \u21ba', BRASS],
  ['Centre wheel', '1 rev / h  \u21bb', BRASS],
  ['Third wheel', '8 rev / h  \u21ba', BRASS],
  ['Fourth wheel', '1 rev / min  \u21bb', BRASS],
  ['Escape wheel', '1 rev / 7.5 s  \u21ba', STEEL],
  ['Pallet fork', '4 beats / s', STEEL],
  ['Balance + hairspring', '2 Hz  \u00b1270\u00b0', BRASS],
  ['Motion work', 'hour = minute / 12', 'url(#gMotion)'],
  ['Indirect centre seconds', '1 rev / min  \u21bb', ROSE]
];
const legend = g({ id: 'legend' },
  panelBase(UI.legend.y, UI.legend.h) +
  smallTitle(P.x + 22, UI.legend.y + 30, 'MOVEMENT MAP \u2014 ONE GEAR TRAIN') +
  LEGEND.map(([name, detail, fill], i) => {
    const y = UI.legend.y + 62 + i * 31;
    return (
      circle(P.x + 30, y - 4, 9, { fill, stroke: '#0a0f15', 'stroke-width': '1' }) +
      text(P.x + 30, y, String(i + 1), {
        fill: '#10161e', 'font-size': '10.5', 'text-anchor': 'middle', 'font-weight': '700'
      }) +
      text(P.x + 48, y, name, { fill: '#cfdae6', 'font-size': '12.5' }) +
      text(P.x1 - 22, y, detail, { fill: '#7b8b9c', 'font-size': '11.5', 'text-anchor': 'end' })
    );
  }).join('') +
  text(P.x + 22, UI.legend.y + UI.legend.h - 16, 'every angle is a multiple of the same beat count', {
    fill: '#5f6c7a', 'font-size': '10.5', 'font-style': 'italic'
  }));

const chip = (i, preset) => {
  const w = 60, x = P.x + 22 + i * (w + 5), y = 758;
  return g({
    id: 'preset-' + i, class: 'chip', tabindex: '0', role: 'button',
    'data-speed': preset.v, 'aria-label': 'Set speed to ' + preset.label
  },
    T('rect', { x, y, width: w, height: 26, rx: 13, class: 'chip-bg' }) +
    text(x + w / 2, y + 17.5, preset.label, { class: 'chip-label', 'text-anchor': 'middle' }));
};
const controls = g({ id: 'controls' },
  panelBase(UI.controls.y, UI.controls.h) +
  smallTitle(P.x + 22, UI.controls.y + 30, 'TIME CONTROL') +
  g({ id: 'btn-play', class: 'btn', tabindex: '0', role: 'button', 'aria-label': 'Pause animation', 'aria-pressed': 'false' },
    circle(UI.play.cx, UI.play.cy, UI.play.r, { class: 'btn-bg' }) +
    g({ transform: `translate(${M.n(UI.play.cx)} ${M.n(UI.play.cy)})` },
      path('M-6.5 -8.5h4.6v17h-4.6Z M1.9 -8.5h4.6v17h-4.6Z', { id: 'icon-pause', fill: '#e8eef6' }) +
      path('M-5 -9L8 0L-5 9Z', { id: 'icon-play', fill: '#e8eef6', style: 'display:none' }))) +
  text(UI.speedLabel.x, UI.speedLabel.y, '1.00\u00d7 real time', {
    id: 'speed-text', fill: '#e8eef6', 'font-size': '15', 'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  }) +
  text(P.x + 22, UI.slider.y - 16, 'SPEED', { fill: '#6d7c8d', 'font-size': '10.5', 'letter-spacing': '2.2', 'font-weight': '600' }) +
  T('rect', { id: 'slider-track', x: UI.slider.x0, y: UI.slider.y - 3.5, width: UI.slider.x1 - UI.slider.x0, height: 7, rx: 3.5, fill: '#1b2532' }) +
  T('rect', { id: 'slider-fill', x: UI.slider.x0, y: UI.slider.y - 3.5, width: '0', height: 7, rx: 3.5, fill: 'url(#gBlued)' }) +
  circle(UI.slider.x0, UI.slider.y, UI.slider.r, { id: 'slider-knob', fill: 'url(#gSteel)', stroke: '#0a0f15', 'stroke-width': '1.2' }) +
  T('rect', {
    id: 'slider-hit', x: UI.slider.x0 - 8, y: UI.slider.y - 18, width: UI.slider.x1 - UI.slider.x0 + 16, height: 36,
    fill: 'transparent', style: 'cursor:pointer', tabindex: '0', role: 'slider',
    'aria-label': 'Animation speed', 'aria-valuemin': String(M.SPEED_MIN), 'aria-valuemax': String(M.SPEED_MAX)
  }) +
  text(UI.slider.x0, UI.slider.y + 26, '0.1\u00d7', { fill: '#6d7c8d', 'font-size': '11' }) +
  text(UI.slider.x1, UI.slider.y + 26, '600\u00d7', { fill: '#6d7c8d', 'font-size': '11', 'text-anchor': 'end' }) +
  UI.presets.map((p, i) => chip(i, p)).join('') +
  g({ id: 'wind-btn', class: 'btn', tabindex: '0', role: 'button', 'aria-label': 'Wind the mainspring' },
    T('rect', { x: UI.wind.x, y: UI.wind.y, width: UI.wind.w, height: UI.wind.h, rx: 15, class: 'chip-bg' }) +
    text(UI.wind.x + 20, UI.wind.y + 20, '\u27f3', { fill: '#e8eef6', 'font-size': '15' }) +
    text(UI.wind.x + 42, UI.wind.y + 20, 'WIND', { fill: '#e8eef6', 'font-size': '12', 'letter-spacing': '1.4' })) +
  text(UI.hint.x, UI.hint.y, 'space pause \u00b7 \u2190 \u2192 speed \u00b7 W wind \u00b7 R reset', {
    fill: '#5f6c7a', 'font-size': '11'
  }) +
  text(UI.hint.x, UI.hint.y + 22, 'watch runs down after 40 h of simulated time', {
    fill: '#4d5866', 'font-size': '10.5', 'font-style': 'italic'
  }));

const nojs = text(P.x + 22, UI.hint.y + 44, 'JavaScript off \u2014 movement frozen', {
  id: 'js-note', fill: '#c98b5a', 'font-size': '10.5'
});

/* ---------------- assemble --------------------------------------------- */
const script = modelSrc + '\n' + runtimeSrc;

const svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  T('svg', {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H,
    'font-family': "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    role: 'img', 'aria-labelledby': 'doc-title doc-desc'
  },
    T('title', { id: 'doc-title' }, 'Transparent mechanical wristwatch movement \u2014 animated skeleton') +
    T('desc', { id: 'doc-desc' },
      'Animated, self-contained skeleton wristwatch movement. A 40-hour mainspring barrel drives the centre, third, ' +
      'fourth and escape wheels; the pallet fork releases one escape tooth per beat and the balance oscillates at 2 Hz. ' +
      'Hour, minute and second hands are geared to the same train. Pause/resume, speed and winding controls are built in.') +
    T('style', {}, [
      '.chip-bg{fill:#18222e;stroke:#2c3a4a;stroke-width:1}',
      '.chip:hover .chip-bg{stroke:#4a6280}',
      '.chip-on .chip-bg{fill:#1d3450;stroke:#4d7fb5}',
      '.chip-label{fill:#a9b8c7;font-size:11.5px}',
      '.chip-on .chip-label{fill:#dce9f7}',
      '.chip,.btn{cursor:pointer}',
      '.btn:focus .btn-bg,.chip:focus .chip-bg{stroke:#7fb2e8;stroke-width:2}',
      '.btn-bg{fill:#18222e;stroke:#2c3a4a;stroke-width:1}',
      '.btn:hover .btn-bg{fill:#1d2a38;stroke:#4a6280}',
      '.bridge{pointer-events:none}',
      'text{pointer-events:none}'
    ].join('\n')) +
    defs +
    bg +
    g({ id: 'watch' },
      casework +
      g({ id: 'movement', 'clip-path': 'url(#clipDial)' },
        mainPlate() +
        bridges +
        shadowDiscs +
        barrelGroup +
        train +
        dialSide +
        jewelLayer +
        glass) +
      hands) +
    g({ id: 'panels' }, readout + legend + controls + nojs) +
    T('script', { type: 'text/javascript' }, '<![CDATA[\n' + script + '\n]]>')
  )
].join('\n');

const outFile = join(here, 'mechanical-watch-movement.svg');
writeFileSync(outFile, svg, 'utf8');
console.log('wrote ' + outFile + ' (' + (svg.length / 1024).toFixed(1) + ' kB)');
console.log('arbors: ' + Object.keys(M.ARBOR).map((k) => k + '(' + M.n(M.ARBOR[k].x) + ',' + M.n(M.ARBOR[k].y) + ')').join(' '));

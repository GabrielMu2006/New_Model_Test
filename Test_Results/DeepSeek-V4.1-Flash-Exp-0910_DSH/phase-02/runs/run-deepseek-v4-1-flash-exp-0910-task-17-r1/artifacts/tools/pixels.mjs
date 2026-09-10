/* ------------------------------------------------------------------------
 * tools/pixels.mjs — proves the SVG actually RENDERS what the model says.
 *
 * Decodes a PNG screenshot with zlib (no dependencies) and checks the picture
 * against the model: jewels are red, wheels are bright, the barrel really has
 * 80 teeth, the hands are on their computed angles, the panels have text.
 *
 *   node tools/browser.mjs shot screenshots/frozen.png "0 0 1240 920" 900 static
 *   node tools/pixels.mjs screenshots/frozen.png
 * ---------------------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
await import(join(root, 'src', 'model.js'));
const M = globalThis.WatchModel;

/* ---------------- minimal PNG decoder ---------------------------------- */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, color = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error('only 8-bit PNGs supported, got ' + depth);
  const ch = color === 6 ? 4 : color === 2 ? 3 : color === 0 ? 1 : -1;
  if (ch < 0) throw new Error('unsupported colour type ' + color);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return {
    w, h, ch, data: out,
    at(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0];
      const i = (y * w + x) * ch;
      return [out[i], out[i + 1], out[i + 2]];
    }
  };
}

const file = process.argv[2] || join(root, 'screenshots', 'frozen.png');
const img = decodePng(readFileSync(file));
const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const isBright = (c) => luma(c) > 95;
const isRed = ([r, g, b]) => r > 105 && r - g > 45 && r - b > 35;
const isGold = ([r, g, b]) => r > 105 && g > 78 && r - b > 45;

/* the frozen shot is the static markup, so image pixels map 1:1 to model px */
const S = img.w / M.UI.width;
const px = (x, y) => img.at(Math.round(x * S), Math.round(y * S));

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  console.log((cond ? '  \u2713 ' : '  \u2717 ') + name + (cond ? '' : '  \u2014 ' + (detail || '')));
  if (!cond) failures++;
}

console.log('image ' + img.w + '\u00d7' + img.h + ', ' + img.ch + ' channels, scale ' + S);

/* ---------------- 1. every pivot has a ruby jewel ---------------------- */
console.log('\n1. jewels at the pivots');
const pivots = ['barrel.wheel', 'third.wheel', 'fourth.wheel', 'escape.wheel',
  'minuteWheel.wheel', 'compound.wheel'].map((k) => M.GEARMAP[k]);
pivots.push(M.ARBOR.balance, M.ARBOR.pallet);
pivots.forEach((p, i) => {
  let red = 0;
  for (let dx = -7; dx <= 7; dx++) {
    for (let dy = -7; dy <= 7; dy++) if (isRed(px(p.x + dx, p.y + dy))) red++;
  }
  ok('ruby jewel at pivot ' + (i + 1) + ' (' + Math.round(p.x) + ',' + Math.round(p.y) + ')', red >= 6, red + ' red px');
});

/* ---------------- 2. wheels are bright, openworked --------------------- */
console.log('\n2. wheels');
function ringStats(centre, radius, samples, fromDeg, toDeg) {
  let bright = 0, gold = 0;
  const a0 = (fromDeg === undefined ? 0 : fromDeg) / M.DEG;
  const a1 = (toDeg === undefined ? 360 : toDeg) / M.DEG;
  for (let i = 0; i < samples; i++) {
    const a = a0 + (a1 - a0) * (i / samples);
    const c = px(centre.x + radius * Math.cos(a), centre.y + radius * Math.sin(a));
    if (isBright(c)) bright++;
    if (isGold(c)) gold++;
  }
  return { bright: bright / samples, gold: gold / samples };
}
const barrel = M.GEARMAP['barrel.wheel'];
const bRim = ringStats(barrel, M.pitchR(M.TEETH.barrel) - 6, 720, 120, 300);
ok('barrel rim is drawn and golden (>85% of the clear arc)', bRim.gold > 0.85, JSON.stringify(bRim));
const bInner = ringStats(barrel, M.pitchR(M.TEETH.barrel) * 0.5, 360);
ok('barrel interior is open (crossings, not a solid disc)',
  bInner.gold < 0.8, 'inner gold ' + bInner.gold.toFixed(2));
const balance = ringStats(M.ARBOR.balance, 99, 720);
ok('balance rim is drawn, golden with steel screws', balance.bright > 0.95 && balance.gold > 0.7, JSON.stringify(balance));
const balanceInner = ringStats(M.ARBOR.balance, 45, 360);
ok('balance interior is open (two crossings only)', balanceInner.gold < 0.5,
  'inner gold ' + balanceInner.gold.toFixed(2));

/* ---------------- 3. the barrel really has 80 teeth -------------------- */
console.log('\n3. tooth counts in the drawing');
function countTeeth(centre, radius, fromDeg, toDeg, teethTotal) {
  /* walk an arc at the tip radius and count bright<->dark transitions */
  const steps = 4000;
  let transitions = 0, prev = null;
  for (let i = 0; i <= steps; i++) {
    const a = (fromDeg + (toDeg - fromDeg) * (i / steps)) / M.DEG;
    const c = px(centre.x + radius * Math.cos(a), centre.y + radius * Math.sin(a));
    const on = isBright(c);
    if (prev !== null && on !== prev) transitions++;
    prev = on;
  }
  return transitions / 2;      // one tooth = dark + bright
}
/* barrel: sample the upper-left arc that no other wheel covers */
const bTip = M.pitchR(M.TEETH.barrel) + 2.6 * 0.5;
const bCount = countTeeth(barrel, bTip, 120, 205, 80);
const bExpect = 80 * (205 - 120) / 360;
ok('barrel tooth count over an 85\u00b0 arc \u2248 ' + bExpect.toFixed(1) + ' teeth',
  Math.abs(bCount - bExpect) <= 2, 'counted ' + bCount.toFixed(1));

/* third wheel: clean arc on its upper side */
const third = M.GEARMAP['third.wheel'];
const tCount = countTeeth(third, M.pitchR(M.TEETH.thirdWheel) + 1.2, 250, 330, 45);
const tExpect = 45 * 80 / 360;
ok('third wheel tooth count over an 80\u00b0 arc \u2248 ' + tExpect.toFixed(1) + ' teeth',
  Math.abs(tCount - tExpect) <= 2, 'counted ' + tCount.toFixed(1));

/* escape wheel: coarse teeth, 15 around, sample a clean arc */
const esc = M.GEARMAP['escape.wheel'];
const eCount = countTeeth(esc, M.pitchR(M.TEETH.escapeWheel, M.ESC_MODULE) + 1.6, 190, 320, 15);
const eExpect = 15 * 130 / 360;
ok('escape wheel tooth count over a 130\u00b0 arc \u2248 ' + eExpect.toFixed(1) + ' teeth',
  Math.abs(eCount - eExpect) <= 1.5, 'counted ' + eCount.toFixed(1));

/* ---------------- 4. hands on their computed angles -------------------- */
console.log('\n4. hands');
const st = M.state(0);
function handHits(angleDeg, lengths) {
  let hit = 0;
  lengths.forEach((L) => {
    const a = angleDeg / M.DEG;
    let best = 0;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const c = px(M.CX + L * Math.sin(a) + dx, M.CY - L * Math.cos(a) + dy);
        best = Math.max(best, luma(c));
      }
    }
    if (best > 110) hit++;
  });
  return hit;
}
ok('hour hand lies on ' + M.mod(st.hourHand, 360).toFixed(1) + '\u00b0',
  handHits(M.mod(st.hourHand, 360), [80, 140, 185]) === 3);
ok('minute hand lies on ' + M.mod(st.minuteHand, 360).toFixed(1) + '\u00b0',
  handHits(M.mod(st.minuteHand, 360), [90, 170, 270]) === 3);
ok('second hand lies on ' + M.mod(st.secondHand, 360).toFixed(1) + '\u00b0',
  handHits(M.mod(st.secondHand, 360), [120, 220, 300]) === 3);
/* and nothing bright where a hand is NOT (proves we are not just measuring the dial) */
ok('no minute hand at the opposite angle',
  handHits(M.mod(st.minuteHand + 180, 360), [170, 270]) === 0);

/* ---------------- 5. chapter ring, case, panels ------------------------ */
console.log('\n5. case, chapter ring, panels');
let marks = 0;
for (let i = 0; i < 60; i++) {
  const a = (i * 6 - 90) / M.DEG;
  const x = M.CX + (M.UI.watch.dialR - 18) * Math.cos(a);
  const y = M.CY + (M.UI.watch.dialR - 18) * Math.sin(a);
  let best = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) best = Math.max(best, luma(px(x + dx, y + dy)));
  if (best > 95) marks++;
}
ok('60 minute marks around the chapter ring', marks >= 56, marks + '/60');
let ringPts = 0, ringHit = 0;
for (let i = 0; i < 180; i++) {
  const a = i / 180 * Math.PI * 2;
  const c = px(M.CX + 388 * Math.cos(a), M.CY + 388 * Math.sin(a));
  ringPts++; if (luma(c) > 60) ringHit++;
}
ok('bezel ring drawn all the way round', ringHit / ringPts > 0.95, (100 * ringHit / ringPts).toFixed(1) + '%');
function panelInk(x0, y0, w, h) {
  let ink = 0, total = 0;
  for (let y = y0; y < y0 + h; y += 2) {
    for (let x = x0; x < x0 + w; x += 2) {
      total++;
      if (luma(px(x, y)) > 70) ink++;
    }
  }
  return ink / total;
}
const P = M.UI.panel;
ok('status panel has ink', panelInk(P.x + 10, M.UI.readout.y + 10, P.w - 20, M.UI.readout.h - 20) > 0.02,
  panelInk(P.x + 10, M.UI.readout.y + 10, P.w - 20, M.UI.readout.h - 20).toFixed(3));
ok('movement-map panel has ink', panelInk(P.x + 10, M.UI.legend.y + 10, P.w - 20, M.UI.legend.h - 20) > 0.03,
  panelInk(P.x + 10, M.UI.legend.y + 10, P.w - 20, M.UI.legend.h - 20).toFixed(3));
ok('time-control panel has ink', panelInk(P.x + 10, M.UI.controls.y + 10, P.w - 20, M.UI.controls.h - 20) > 0.03,
  panelInk(P.x + 10, M.UI.controls.y + 10, P.w - 20, M.UI.controls.h - 20).toFixed(3));

/* ---------------- 6. nothing overflows the canvas ---------------------- */
console.log('\n6. framing');
let edgeInk = 0;
for (let x = 0; x < img.w; x += 3) {
  if (luma(px(x, 2)) > 60) edgeInk++;
  if (luma(px(x, img.h - 3)) > 60) edgeInk++;
}
for (let y = 0; y < img.h; y += 3) {
  if (luma(px(2, y)) > 60) edgeInk++;
  if (luma(px(img.w - 3, y)) > 60) edgeInk++;
}
ok('no artwork is cut off at the canvas edge', edgeInk === 0, edgeInk + ' lit edge pixels');
let covered = 0, total = 0;
for (let y = M.CY - 280; y < M.CY + 280; y += 3) {
  for (let x = M.CX - 280; x < M.CX + 280; x += 3) {
    if (Math.hypot(x - M.CX, y - M.CY) > 280) continue;
    total++;
    if (luma(px(x, y)) > 60) covered++;
  }
}
ok('movement aperture is well filled (' + (100 * covered / total).toFixed(1) + '% lit)', covered / total > 0.12);

console.log('\n' + (failures ? '\u2717 ' : '\u2713 ') + checks + ' pixel checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);

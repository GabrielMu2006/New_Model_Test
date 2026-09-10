/* ------------------------------------------------------------------------
 * verify.mjs — gate for mechanical-watch-movement.svg
 *
 * Checks, in order:
 *   1. the file is well formed XML and contains no external asset reference
 *   2. the gear train is kinematically consistent (ratios, directions, phases)
 *   3. the escapement quantises the train correctly
 *   4. the hands are geared to the same train
 *   5. the drawn geometry matches the model (arbor distances, containment)
 *   6. the static markup equals the model at beat 0
 *   7. every DOM id the runtime touches exists in the markup
 *   8. the embedded script parses
 *
 *   node verify.mjs
 * ---------------------------------------------------------------------- */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const SVG = join(here, 'mechanical-watch-movement.svg');
const RUNTIME_SRC = readFileSync(join(here, 'src', 'runtime.js'), 'utf8');
const MODEL_SRC = readFileSync(join(here, 'src', 'model.js'), 'utf8');
const svg = readFileSync(SVG, 'utf8');
await import('./src/model.js');
const M = globalThis.WatchModel;

let failures = 0;
let checks = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function ok(name, cond, detail) {
  checks++;
  if (cond) {
    console.log('  \u2713 ' + name);
  } else {
    failures++;
    console.log('  \u2717 ' + name + (detail ? '  \u2014 ' + detail : ''));
  }
}
function group(title) { console.log('\n' + title); }

/* ====================================================================== */
group('1. standalone file');
{
  const external = [];
  const patterns = [
    [/<script[^>]+src=/i, 'script src'],
    [/<image\b/i, 'image element'],
    [/<link\b/i, 'link element'],
    [/<use[^>]+href\s*=\s*"(?!#)/i, 'use href to external target'],
    [/@import/i, 'css @import'],
    [/url\(\s*['"]?(?!#)/i, 'url() to external resource'],
    [/<iframe\b|<embed\b|<object\b/i, 'embedded document'],
    [/xlink:href\s*=\s*"(?!#)/i, 'xlink:href to external target']
  ];
  patterns.forEach(([re, label]) => { if (re.test(svg)) external.push(label); });
  ok('no external asset references', external.length === 0, external.join(', '));

  const urls = svg.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  const allowed = urls.filter((u) => u !== 'http://www.w3.org/2000/svg');
  ok('only the SVG namespace appears as a URL', allowed.length === 0, allowed.slice(0, 3).join(', '));

  try {
    execFileSync('python3', ['-c',
      'import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])', SVG], { stdio: 'pipe' });
    ok('parses as well-formed XML', true);
  } catch (e) {
    ok('parses as well-formed XML', false, String(e.stderr || e).slice(0, 200));
  }

  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  const missingRefs = [...new Set(refs)].filter((r) => !ids.has(r));
  ok('every url(#id) resolves inside the file', missingRefs.length === 0, missingRefs.join(', '));
}

/* ====================================================================== */
group('2. gear train kinematics');
{
  const EPS = 1e-9;
  /* tooth counts and ratios must agree with the direction of every mesh */
  M.MESHES.forEach((m) => {
    const A = M.GEARMAP[m.a], B = M.GEARMAP[m.b];
    const expect = -A.teeth / B.teeth;
    const got = M.RATIO[B.rot] / M.RATIO[A.rot];
    ok('mesh ' + m.a + ' -> ' + m.b + ' ratio ' + expect.toFixed(4) + ' and opposite direction',
      near(expect, got, 1e-12), 'got ' + got);
  });

  /* named speeds, measured from the model over one simulated hour */
  const hour = M.state(M.BEATS_PER_SEC * 3600);
  const min = M.state(M.BEATS_PER_SEC * 60);
  const sec = M.state(M.BEATS_PER_SEC);
  ok('centre wheel: exactly 1 turn per hour, clockwise', near(hour.center, 360, 1e-9) && M.RATIO.center > 0);
  ok('third wheel: exactly 8 turns per hour, counter-clockwise', near(hour.third, -2880, 1e-9));
  ok('fourth wheel: exactly 1 turn per minute, clockwise', near(min.fourth, 360, 1e-9) && M.RATIO.fourth > 0);
  ok('barrel: exactly 1 turn per 8 hours, counter-clockwise', near(M.state(M.BEATS_PER_SEC * 3600 * 8).barrel, -360, 1e-9));
  ok('escape wheel: exactly 1 turn per 7.5 s, counter-clockwise',
    near(M.state(M.BEATS_PER_SEC * 7.5).escape, -360, 1e-9));
  ok('seconds wheel: exactly 1 turn per minute, clockwise', near(min.secondsWheel, 360, 1e-9));
  ok('hour wheel: exactly 1 turn per 12 h', near(M.state(M.BEATS_PER_SEC * 3600 * 12).hourWheel, 360, 1e-9));

  /* a whole day must not drift */
  const day = M.state(M.BEATS_PER_SEC * 3600 * 24);
  ok('after 24 h: centre 24 turns, fourth 1440, third 192, barrel 3',
    near(day.center, 8640, 1e-6) && near(day.fourth, 518400, 1e-6) &&
    near(day.third, -69120, 1e-6) && near(day.barrel, -1080, 1e-6));

  /* Meshing is a RELATIVE condition: whenever the driver presents a tooth on
   * the line of centres, the driven gear must present a gap there. Work in
   * tooth units, uA = offset of driver tooth 0 from the line of centres and
   * uB = offset of driven gap 0 (each measured from its own centre). The pair
   * stays in mesh iff uA + uB is a whole number of teeth at all times, and
   * both are integers at the instants a tooth actually arrives.            */
  const Qs = [0, 0.37, 1.62, 4.5, 17.25, 233.8, 1000.31, 12345.678];
  let worstRel = 0, worstLock = 0;
  M.MESHES.forEach((m) => {
    const A = M.GEARMAP[m.a], B = M.GEARMAP[m.b];
    const phi = M.deg2(A, B);
    const pA = 360 / A.teeth, pB = 360 / B.teeth;
    const uA = (Q) => (M.PHASE[m.a] + M.RATIO[A.rot] * Q - phi) / pA;
    const uB = (Q) => (M.PHASE[m.b] + M.RATIO[B.rot] * Q - (phi + 180 + pB / 2)) / pB;
    Qs.forEach((Q) => {
      const sum = uA(Q) + uB(Q);
      worstRel = Math.max(worstRel, Math.abs(sum - Math.round(sum)));
    });
    /* instants at which a driver tooth lands exactly on the line of centres:
     * alpha(Q) = alpha0 + rate*Q must be a multiple of the driver pitch     */
    const alpha0 = M.PHASE[m.a] - phi;
    for (let k = 0; k < 40; k++) {
      const Q = (k * pA - alpha0) / M.RATIO[A.rot];
      worstLock = Math.max(worstLock,
        Math.abs(uA(Q) - Math.round(uA(Q))), Math.abs(uB(Q) - Math.round(uB(Q))));
    }
  });
  ok('driver tooth and driven gap stay locked in phase at all times',
    worstRel < 1e-9, 'worst ' + worstRel.toExponential(2) + ' tooth');
  ok('at every tooth-passing instant both gears are exactly on phase',
    worstLock < 1e-9, 'worst ' + worstLock.toExponential(2) + ' tooth');

  /* two wheels on one arbor must share one rotation slot */
  const shared = [['center.pinion', 'center.wheel', 'center'], ['third.pinion', 'third.wheel', 'third'],
    ['fourth.pinion', 'fourth.wheel', 'fourth'], ['escape.pinion', 'escape.wheel', 'escape'],
    ['minuteWheel.wheel', 'minuteWheel.pinion', 'minuteWheel'],
    ['compound.pinion', 'compound.wheel', 'compound']];
  ok('wheel and pinion on the same arbor share one rotation',
    shared.every(([a, b, rot]) => M.GEARMAP[a].rot === rot && M.GEARMAP[b].rot === rot));
  ok('no two coaxial wheels are the same size (no moire)',
    Math.abs(M.pitchR(M.TEETH.centerWheel) - M.pitchR(M.TEETH.secondsWheel)) > 5 &&
    Math.abs(M.pitchR(M.TEETH.secondsWheel) - M.pitchR(M.TEETH.hourWheel)) > 5);
}

/* ====================================================================== */
group('3. escapement and balance');
{
  const beatsPerTurn = M.BEATS_PER_ESCAPE_REV;
  ok('escape wheel has ' + beatsPerTurn + ' beats per turn (' + (360 / beatsPerTurn) + ' deg per beat)',
    near(M.TEETH.escapeWheel * 2, beatsPerTurn, 0) && near(360 / beatsPerTurn, 12, 1e-9));

  /* one tooth per beat, and the wheel is locked most of the beat */
  const a0 = M.state(0).escape, a1 = M.state(1).escape;
  ok('escape wheel advances exactly one half tooth per beat', near(Math.abs(a1 - a0), 12, 1e-9));
  let locked = 0, sampled = 0, maxJump = 0;
  for (let i = 0; i < 400; i++) {
    const p = i / 400;
    const da = Math.abs(M.state(3 + p + 0.0025).escape - M.state(3 + p).escape);
    maxJump = Math.max(maxJump, da);
    if (da < 1e-9) locked++;
    sampled++;
  }
  ok('train is stationary for the majority of every beat (' + Math.round(100 * locked / sampled) + '% of samples)',
    locked / sampled > 0.7);
  ok('the whole impulse happens inside the beat', maxJump > 0 && maxJump < 12.01);

  /* the fork must make exactly one reversal per beat and never chatter */
  let reversals = 0, dir = 0, moved = 0;
  let prev = M.state(0).pallet;
  for (let i = 1; i <= 4000; i++) {
    const v = M.state(i / 500).pallet;
    const d = Math.sign(Math.round((v - prev) * 1e6));
    if (d !== 0) {
      moved++;
      if (dir !== 0 && d !== dir) reversals++;
      dir = d;
    }
    prev = v;
  }
  ok('pallet fork makes exactly one swing per beat (8 beats sampled)', reversals === 7,
    reversals + ' reversals, ' + moved + ' moving samples');
  const banked = [];
  for (let n = 0; n < 8; n++) banked.push(M.state(n + 0.5).pallet);
  ok('pallet fork rests on alternating bankings between beats',
    banked.every((v, i) => Math.abs(Math.abs(v) - M.PALLET_AMPLITUDE) < 1e-9 &&
      (i === 0 || Math.sign(v) === -Math.sign(banked[i - 1]))));

  /* balance: 2 beats per period, zero crossing at every beat, alternating */
  const zeroCross = [];
  for (let n = 0; n < 6; n++) zeroCross.push(M.state(n).balance);
  ok('balance passes through centre at every beat', zeroCross.every((v) => Math.abs(v) < 1e-9));
  const vel = [];
  for (let n = 0; n < 6; n++) vel.push(M.state(n + 0.01).balance - M.state(n - 0.01).balance);
  ok('balance direction alternates every beat (one period = 2 beats)',
    vel.every((v, i) => (i === 0 || Math.sign(v) === -Math.sign(vel[i - 1]))));
  ok('balance amplitude is ' + M.BALANCE_AMPLITUDE + ' deg',
    near(M.state(0.5).balance, M.BALANCE_AMPLITUDE, 1e-9) &&
    near(M.state(1.5).balance, -M.BALANCE_AMPLITUDE, 1e-9));
  ok('beat rate is ' + M.BEATS_PER_SEC + '/s = 2 Hz = ' + (M.BEATS_PER_SEC * 3600) + ' A/h',
    near(M.BEATS_PER_SEC, 4, 0) && near(M.BEATS_PER_SEC * 3600, 14400, 0));

  /* the pallet jewels must intercept the tooth tips */
  const jd = M.ESC.jewelAngle.map((ang) => {
    const a = ang / M.DEG;
    const x = M.ARBOR.escape.x + M.ESC.jewelRadius * Math.cos(a);
    const y = M.ARBOR.escape.y + M.ESC.jewelRadius * Math.sin(a);
    return { r: M.dist({ x, y }, M.ARBOR.escape), toPallet: true };
  });
  const tipR = M.pitchR(M.TEETH.escapeWheel, M.ESC_MODULE) + M.ESC_MODULE * 0.98;
  ok('both pallet jewels sit on the escape tooth circle',
    jd.every((j) => Math.abs(j.r - tipR) < 3.2), jd.map((j) => j.r.toFixed(1)).join(', ') + ' vs tip ' + tipR.toFixed(1));
  ok('pallet span is 1.5 tooth pitches (alternating lock)',
    near(M.ESC.jewelAngle[1] - M.ESC.jewelAngle[0], 1.5 * 360 / M.TEETH.escapeWheel, 1e-9));
  const notchTip = M.ESC.notchArm;
  ok('pallet notch reaches the balance impulse jewel radius',
    Math.abs(M.dist(M.ARBOR.pallet, M.ARBOR.balance) - notchTip - 15) < 1e-9 &&
    M.ESC.impulsePinR + 4.6 > 15 && M.ESC.impulsePinR - 4.6 < 15);
}

/* ====================================================================== */
group('4. hands are geared to the same train');
{
  const A = M.state(0), B = M.state(1234.5);
  const dHour = B.hourHand - A.hourHand, dMin = B.minuteHand - A.minuteHand, dSec = B.secondHand - A.secondHand;
  ok('minute hand = centre wheel (1 turn per hour)', near(dMin, M.state(1234.5).center - M.state(0).center, 1e-9));
  ok('hour hand advances exactly 1/12 of the minute hand', near(dHour * 12, dMin, 1e-6),
    dHour + ' vs ' + dMin / 12);
  ok('second hand is locked to the fourth wheel (1 turn per minute)',
    near(M.mod(dSec - (M.state(1234.5).fourth - M.state(0).fourth), 360), 0, 1e-9));
  ok('second hand turns clockwise like the fourth wheel', M.RATIO.secondsWheel > 0);
  ok('hands start at 10:10:30',
    near(M.mod(A.hourHand, 360), 30 * (10 + 10 / 60 + 30 / 3600), 1e-9) &&
    near(M.mod(A.minuteHand, 360), 6 * (10 + 30 / 60), 1e-9) &&
    near(M.mod(A.secondHand, 360), 180, 1e-9));
  const clock = M.clockText(M.BASE_TIME + M.state(M.BEATS_PER_SEC * 3661).elapsedSeconds);
  ok('clock readout follows the train (10:10:30 + 1 h 1 s = 11:11:31)', clock === '11:11:31', clock);
}

/* ====================================================================== */
group('5. drawn geometry');
{
  /* every mesh must sit at the exact centre distance of its pitch circles */
  let worstD = 0;
  M.MESHES.forEach((m) => {
    const A = M.GEARMAP[m.a], B = M.GEARMAP[m.b];
    const d = M.dist(A, B);
    const want = M.pitchR(A.teeth, A.mod) + M.pitchR(B.teeth, B.mod);
    worstD = Math.max(worstD, Math.abs(d - want));
  });
  ok('all arbor distances equal the pitch-circle sums', worstD < 1e-9, 'worst ' + worstD.toExponential(2));

  /* everything stays inside the dial aperture */
  let maxReach = 0, worstKey = '';
  Object.keys(M.GEARMAP).forEach((k) => {
    const gm = M.GEARMAP[k];
    const r = M.pitchR(gm.teeth, gm.mod) + gm.mod * 0.98;
    const reach = M.dist(gm, M.ARBOR.center) + r;
    if (reach > maxReach) { maxReach = reach; worstKey = k; }
  });
  const balanceReach = M.dist(M.ARBOR.balance, M.ARBOR.center) + 105;
  ok('gears stay inside the dial aperture (r ' + M.UI.watch.dialR + ')',
    maxReach < M.UI.watch.dialR && balanceReach < M.UI.watch.dialR,
    worstKey + ' reaches ' + maxReach.toFixed(1) + ', balance ' + balanceReach.toFixed(1));

  /* hands reach the chapter ring without overshooting the dial */
  ok('minute hand tip sits in the chapter ring', 300 > M.UI.watch.chapterR - 30 && 300 < M.UI.watch.dialR - 20);
  ok('second hand tip stays inside the dial', 318 < M.UI.watch.dialR - 10);

  /* springs live in their drums */
  ok('mainspring stays inside the barrel',
    M.MAINSPRING_GEO.rOut + 2 < M.pitchR(M.TEETH.barrel) - 4 &&
    M.MAINSPRING_GEO.rIn > 18);
  ok('hairspring sits between roller and balance rim',
    M.HAIRSPRING_GEO.rIn > M.ESC.rollerR && M.HAIRSPRING_GEO.rOut < 105 - 15,
    M.HAIRSPRING_GEO.rIn + '..' + M.HAIRSPRING_GEO.rOut);

  /* no wheel may be drawn on top of the same wheel twice */
  const sizes = {};
  Object.keys(M.GEARMAP).forEach((k) => {
    const gm = M.GEARMAP[k];
    sizes[k] = M.n(M.pitchR(gm.teeth, gm.mod));
  });
  ok('barrel is the largest wheel', Math.max(...Object.values(sizes).map(Number)) === Number(sizes['barrel.wheel']));
}

/* ====================================================================== */
group('6. static markup equals the model at beat 0');
{
  const st = M.state(0); st.wind = 1;
  M.ROTORS.forEach((r) => {
    const p = M.ARBOR[r.arbor];
    const a = M.n(M.mod(st[r.key], 360));
    const want = r.local
      ? 'translate(' + M.n(p.x) + ' ' + M.n(p.y) + ') rotate(' + a + ')'
      : 'rotate(' + a + ' ' + M.n(p.x) + ' ' + M.n(p.y) + ')';
    const m = svg.match(new RegExp('id="' + r.id + '"[^>]*transform="([^"]+)"'));
    ok('markup pose of #' + r.id + ' matches the model', !!m && m[1] === want, m ? m[1] + ' vs ' + want : 'not found');
  });
  const main = svg.match(/<path[^>]*id="spring-main"[^>]*>/);
  const mainD = main && main[0].match(/d="([^"]+)"/);
  ok('mainspring path matches the model', !!mainD && mainD[1] === M.mainspringPath(st, M.MAINSPRING_GEO));
  const hair = svg.match(/<path[^>]*id="spring-hair"[^>]*>/);
  const hairD = hair && hair[0].match(/d="([^"]+)"/);
  ok('hairspring path matches the model', !!hairD && hairD[1] === M.hairspringPath(st, M.HAIRSPRING_GEO));

  /* gear outlines must be reproducible from the model, not hand-edited */
  const barrelD = svg.match(/<path d="(M[^"]+)" fill="url\(#gBrass\)" fill-rule="evenodd" stroke="#4a3108"/);
  ok('first brass wheel path is model-generated',
    !!barrelD && barrelD[1] === M.wheelPath(M.GEARMAP['barrel.wheel'], { spokes: 6, rimScale: 0.082, hubScale: 0.16 }).ring);
}

/* ====================================================================== */
group('7. DOM contract between runtime and markup');
{
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const wanted = new Set(M.ROTORS.map((r) => r.id));
  [...RUNTIME_SRC.matchAll(/\$\('([^']+)'\)/g)].forEach((m) => wanted.add(m[1]));
  [...MODEL_SRC.matchAll(/\$\('([^']+)'\)/g)].forEach((m) => wanted.add(m[1]));
  const missing = [...wanted].filter((id) => !ids.has(id));
  ok('every id used by the runtime exists in the SVG', missing.length === 0, missing.join(', '));
  const presetIds = M.UI.presets.map((_, i) => 'preset-' + i);
  ok('speed presets are present', presetIds.every((id) => ids.has(id)), presetIds.join(', '));
  ok('slider has a pointer target', ids.has('slider-hit') && ids.has('slider-knob') && ids.has('slider-fill'));
}

/* ====================================================================== */
group('8. embedded script');
{
  const m = svg.match(/<script[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/script>/);
  ok('the SVG carries one inline script block', !!m);
  if (m) {
    ok('the inline script is exactly model.js + runtime.js',
      m[1].trim() === (MODEL_SRC + '\n' + RUNTIME_SRC).trim());
    const dir = mkdtempSync(join(tmpdir(), 'watch-verify-'));
    const f = join(dir, 'inline.js');
    writeFileSync(f, m[1], 'utf8');
    try {
      execFileSync('node', ['--check', f], { stdio: 'pipe' });
      ok('the inline script parses', true);
    } catch (e) {
      ok('the inline script parses', false, String(e.stderr).slice(0, 300));
    }
    ok('the inline script contains no CDATA terminator', !m[1].includes(']]>'));
  }
  ok('script type is executable JavaScript', /<script[^>]*type="text\/javascript"/.test(svg));
}

/* ====================================================================== */
group('9. controls behave');
{
  ok('pause/resume control exists', /id="btn-play"[^>]*role="button"/.test(svg));
  ok('speed slider is a labelled ARIA slider', /id="slider-hit"[^>]*role="slider"/.test(svg));
  ok('wind control exists', /id="wind-btn"[^>]*role="button"/.test(svg));
  ok('keyboard shortcuts are documented', /space pause/.test(svg));
  ok('speed mapping is monotone over the slider range',
    M.sliderToSpeed(0) < M.sliderToSpeed(0.25) && M.sliderToSpeed(0.25) < M.sliderToSpeed(1) &&
    near(M.sliderToSpeed(0), M.SPEED_MIN, 1e-9) && near(M.sliderToSpeed(1), M.SPEED_MAX, 1e-6));
  ok('slider round-trips', [0.1, 1, 10, 60, 599].every((v) => near(M.sliderToSpeed(M.speedToSlider(v)), v, 1e-6)));
  ok('speed 1 means real time (4 beats per second)',
    near(M.state(1).elapsedSeconds, 0.25, 1e-9));
  ok('power reserve lasts 40 simulated hours',
    near(M.FULL_WIND_BEATS / M.BEATS_PER_SEC, 40 * 3600, 0) &&
    near(M.windAt(M.FULL_WIND_BEATS, 0), 0, 1e-9) &&
    near(M.windAt(M.FULL_WIND_BEATS / 2, 0), 0.5, 1e-9));
}

/* ====================================================================== */
console.log('\n' + (failures ? '\u2717 ' : '\u2713 ') + checks + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);

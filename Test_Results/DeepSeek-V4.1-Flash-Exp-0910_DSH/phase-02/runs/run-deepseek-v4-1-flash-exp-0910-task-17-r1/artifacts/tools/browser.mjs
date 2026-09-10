/* ------------------------------------------------------------------------
 * tools/browser.mjs — headless-Chrome probes for the generated SVG.
 *
 *   node tools/browser.mjs shot  <out.png> [viewBox] [virtualMs]
 *   node tools/browser.mjs probe [virtualMs]
 *
 * "shot"  renders the file (optionally zoomed to a viewBox) to a PNG.
 * "probe"  inlines the SVG into a page, runs it under a recorder, and prints
 *          what the runtime did: JS errors, frame count, whether every rotor
 *          actually moves, hand coupling and readout text.
 * ---------------------------------------------------------------------- */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SVG_FILE = join(root, 'mechanical-watch-movement.svg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = join(root, '.tmp', 'chrome-' + process.pid);
const TMP = join(root, '.tmp');

const svg = readFileSync(SVG_FILE, 'utf8');
const [cmd, ...rest] = process.argv.slice(2);

mkdirSync(TMP, { recursive: true });
mkdirSync(PROFILE, { recursive: true });
process.on('exit', () => { try { rmSync(PROFILE, { recursive: true, force: true }); } catch {} });
mkdirSync(join(root, 'screenshots'), { recursive: true });

/* --dump-dom writes the whole document and then Chrome keeps running, so we
 * stop waiting as soon as the closing tag arrives */
function makeDumpReady() {
  let seen = false;
  return (out) => { seen = seen || /<\/html>/.test(out); return seen; };
}
let launches = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function runChrome(args, ms, ready) {
  /* macOS needs a moment between headless launches or the display link
   * initialisation fails and the browser never produces output */
  if (launches++) await sleep(3000);
  return new Promise((resolve) => {
    const child = spawn(CHROME, args, {
      env: { ...process.env, TMPDIR: TMP, HOME: join(root, '.home') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '', err = '', done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      try { child.kill('SIGKILL'); } catch {}
      setTimeout(() => resolve({ code, out, err }), 150);
    };
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => finish(-1), ms);
    const poll = ready ? setInterval(() => { if (ready(out)) finish(0); }, 200) : null;
    child.on('close', (code) => finish(code));
  });
}

const baseArgs = (w, h, extra) => [
  '--headless=new', '--no-sandbox', '--disable-crash-reporter', '--disable-gpu',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check', '--disable-component-update',
  /* never touch the macOS login keychain */
  '--use-mock-keychain', '--password-store=basic', '--disable-sync',
  '--disable-background-networking', '--disable-sync', '--disable-extensions',
  '--disable-features=Translate,MediaRouter,OptimizationHints',
  `--window-size=${w},${h}`, ...extra
];

if (cmd === 'shot') {
  const out = rest[0] || 'screenshots/shot.png';
  const viewBox = rest[1] || null;
  const budget = Number(rest[2] || 1200);
  const frozen = rest[3] === 'static';
  const [, , vw, vh] = (viewBox || '0 0 1240 920').split(/\s+/).map(Number);
  let source = svg;
  let file = SVG_FILE;
  if (frozen) source = source.replace(/<script[\s\S]*?<\/script>/, '');
  if (viewBox || frozen) {
    if (viewBox) source = source.replace(/viewBox="[^"]+"/, `viewBox="${viewBox}"`)
      .replace(/\swidth="\d+"\s+height="\d+"/, ` width="${vw}" height="${vh}"`);
    file = join(TMP, 'zoom-' + Date.now() + '.svg');
    writeFileSync(file, source, 'utf8');
  }
  const target = join(root, out);
  try { rmSync(target); } catch {}
  await runChrome(baseArgs(vw, vh, [
    `--virtual-time-budget=${budget}`,
    `--screenshot=${target}`,
    'file://' + file
  ]), budget + 25000, () => existsSync(target) && statSync(target).size > 2000);
  if (!existsSync(target)) {
    console.log('(shot retry)');
    await runChrome(baseArgs(vw, vh, [
      `--virtual-time-budget=${budget}`, `--screenshot=${target}`, 'file://' + file
    ]), budget + 25000, () => existsSync(target) && statSync(target).size > 2000);
  }
  console.log(existsSync(target) ? 'shot ' + out + ' ' + statSync(target).size + ' bytes' : 'FAILED ' + out);
  process.exit(existsSync(target) ? 0 : 1);
}

if (cmd === 'probe') {
  const budget = Number(rest[0] || 3000);
  const recorder = `
<script>
window.__probe = { errors: [], samples: [], frames: 0, t0: performance.now() };
(function tick(){ window.__probe.frames++; requestAnimationFrame(tick); })();
window.addEventListener('error', function (e) { window.__probe.errors.push(String(e.message)); });
var ro = new MutationObserver(function () {});
var ids = ['rot-barrel','rot-center','rot-third','rot-fourth','rot-escape','rot-pallet',
           'rot-balance','rot-cannon','rot-minuteWheel','rot-hourWheel','rot-compound',
           'rot-secondsWheel','hand-hour','hand-minute','hand-second'];
function snap() {
  var o = {};
  ids.forEach(function (id) {
    var n = document.getElementById(id);
    o[id] = n ? n.getAttribute('transform') : 'MISSING';
  });
  o.__clock = (document.getElementById('clock-text') || {}).textContent;
  o.__speed = (document.getElementById('speed-text') || {}).textContent;
  o.__power = (document.getElementById('power-text') || {}).textContent;
  o.__hair = (document.getElementById('spring-hair') || { getAttribute: function () { return ''; } }).getAttribute('d').length;
  o.__raf = window.__probe.frames;
  o.__now = Math.round(performance.now());
  return o;
}
setTimeout(function () {
  var hit = document.getElementById('slider-hit'), r = hit.getBoundingClientRect();
  var o = { bubbles: true, clientX: r.left + r.width * 0.73, clientY: r.top + r.height / 2,
            pointerId: 1, pointerType: 'mouse', isPrimary: true };
  hit.dispatchEvent(new PointerEvent('pointerdown', o));
  hit.dispatchEvent(new PointerEvent('pointerup', o));
}, 120);
[400, 900, 1400, 1900, 2400, 3400, 4200].forEach(function (t) {
  setTimeout(function () { window.__probe.samples.push(snap()); }, t);
});
setTimeout(function () {
  var out = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  out.setAttribute('id', 'probe-out');
  out.textContent = 'PROBE::' + JSON.stringify(window.__probe);
  document.documentElement.appendChild(out);
}, ${Math.max(budget - 300, 4500)});
</script>`;
  const page = svg.replace('</svg>', recorder + '</svg>');
  const file = join(TMP, 'probe.html');
  writeFileSync(file,
    '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#05080c">' + page + '</body>', 'utf8');
  const dumpReady = makeDumpReady();
  let res = await runChrome(baseArgs(1240, 920, [
    `--virtual-time-budget=${budget}`, '--dump-dom', 'file://' + file
  ]), budget + 60000, dumpReady);
  let m = res.out.match(/<text[^>]*id="probe-out"[^>]*>([\s\S]*?)<\/text>/);
  if (!m) {
    console.log('(probe retry)');
    res = await runChrome(baseArgs(1240, 920, [
      `--virtual-time-budget=${budget}`, '--dump-dom', 'file://' + file
    ]), budget + 60000, dumpReady);
    m = res.out.match(/<text[^>]*id="probe-out"[^>]*>([\s\S]*?)<\/text>/);
  }
  if (!m) { console.log('probe failed, no output. stderr tail:\n' + res.err.slice(-400)); process.exit(1); }
  const data = JSON.parse(m[1].replace(/PROBE::/, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  console.log('JS errors: ' + (data.errors.length ? JSON.stringify(data.errors) : 'none'));
  console.log('samples: ' + data.samples.length);
  const all = data.samples;
  const a = all[0], z = all[all.length - 1];
  let moving = 0, still = [];
  Object.keys(a).forEach((k) => {
    if (k.startsWith('__')) return;
    const poses = new Set(all.map((s) => s[k]));
    if (poses.size > 1) moving++;
    else still.push(k);
  });
  const total = Object.keys(a).length - 6;
  console.log('parts that changed pose across ' + all.length + ' samples: ' + moving + '/' + total);
  if (still.length) console.log('never changed: ' + still.join(', '));
  console.log('clock  ' + all.map((s) => s.__clock).join(' -> '));
  console.log('speed  ' + a.__speed + ' | power ' + a.__power);
  console.log('hairspring rebuilt: ' + new Set(all.map((s) => s.__hair)).size + ' distinct path lengths');
  console.log('rAF ticks: ' + all.map((s) => s.__raf).join(', ') + '  perf.now: ' + a.__now + ' -> ' + z.__now);
  const failed = data.errors.length || still.length;
  process.exit(failed ? 1 : 0);
}

if (cmd === 'controls') {
  const budget = Number(rest[0] || 30000);
  const inner = [
    'window.__ctl=[];',
    'function L(k,v){window.__ctl.push(k+"="+v);}',
    'function $(id){return document.getElementById(id);}',
    'function tr(id){return $(id).getAttribute("transform");}',
    'function txt(id){return $(id).textContent;}',
    'function click(id){$(id).dispatchEvent(new MouseEvent("click",{bubbles:true}));}',
    'function key(k){document.dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true}));}',
    'function waitFor(fn,ms,cb){var t0=Date.now();(function poll(){if(fn())return cb(true);',
    '  if(Date.now()-t0>ms)return cb(false);setTimeout(poll,60);})();}',
    'function finish(){var out=document.createElementNS("http://www.w3.org/2000/svg","text");',
    '  out.setAttribute("id","probe-out");out.textContent="PROBE::"+window.__ctl.join("|");',
    '  document.documentElement.appendChild(out);}',
    'setTimeout(function(){',
    '  var t0=tr("rot-fourth");',
    '  click("btn-play");',
    '  waitFor(function(){return txt("state-text")==="paused";},3000,function(){',
    '    L("pause_state",txt("state-text"));',
    '    L("paused_freezes_rotor",tr("rot-fourth")===t0);',
    '    L("pause_icon_shows_play",getComputedStyle($("icon-play")).display!=="none");',
    '    click("btn-play");',
    '    waitFor(function(){return tr("rot-fourth")!==t0;},3000,function(){',
    '      L("resume_moves_rotor",tr("rot-fourth")!==t0);',
    '      click("preset-3");',
    '      waitFor(function(){return txt("speed-text").indexOf("60")===0;},3000,function(){',
    '        L("preset_60x",txt("speed-text"));',
    '        var s1=tr("hand-second");',
    '        waitFor(function(){return tr("hand-second")!==s1;},3000,function(){',
    '          L("second_hand_runs_at_60x",tr("hand-second")!==s1);',
    '          var hit=$("slider-hit"),r=hit.getBoundingClientRect();',
    '          function drag(x){var o={bubbles:true,clientX:x,clientY:r.top+r.height/2,pointerId:1,pointerType:"mouse",isPrimary:true};',
    '            hit.dispatchEvent(new PointerEvent("pointerdown",o));',
    '            hit.dispatchEvent(new PointerEvent("pointermove",o));',
    '            hit.dispatchEvent(new PointerEvent("pointerup",o));}',
    '          drag(r.left+r.width-1);',
    '          waitFor(function(){return txt("speed-text").indexOf("600")===0;},3000,function(){',
    '            L("slider_max",txt("speed-text"));',
    '            drag(r.left+1);',
    '            waitFor(function(){return txt("speed-text").indexOf("0.1")===0;},3000,function(){',
    '              L("slider_min",txt("speed-text"));',
    '              key(" ");',
    '              waitFor(function(){return txt("state-text")==="paused";},3000,function(){',
    '                L("space_pauses",txt("state-text"));',
    '                key("r");',
    '                waitFor(function(){return txt("clock-text")==="10:10:30";},3000,function(){',
    '                  L("reset_clock",txt("clock-text"));',
    '                  click("wind-btn");',
    '                  waitFor(function(){return txt("power-text")==="100%";},3000,function(){',
    '                    L("wind_refills",txt("power-text"));',
    '                    key(" ");',
    '                    waitFor(function(){return txt("state-text")==="running";},3000,function(){',
    '                      L("space_resumes",txt("state-text"));',
    '                      finish();',
    '                    });',
    '                  });',
    '                });',
    '              });',
    '            });',
    '          });',
    '        });',
    '      });',
    '    });',
    '  });',
    '},600);'
  ].join('\n');
  const page = svg.replace('</svg>', '<script>' + inner + '</script></svg>');
  const file = join(TMP, 'controls.html');
  writeFileSync(file, '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#05080c">' + page + '</body>', 'utf8');
  const dumpReady = makeDumpReady();
  let res = await runChrome(baseArgs(1240, 920, [
    `--virtual-time-budget=${budget}`, '--dump-dom', 'file://' + file
  ]), budget + 60000, dumpReady);
  let m = res.out.match(/<text[^>]*id="probe-out"[^>]*>([\s\S]*?)<\/text>/);
  if (!m) {
    console.log('(controls retry)');
    res = await runChrome(baseArgs(1240, 920, [
      `--virtual-time-budget=${budget}`, '--dump-dom', 'file://' + file
    ]), budget + 60000, dumpReady);
    m = res.out.match(/<text[^>]*id="probe-out"[^>]*>([\s\S]*?)<\/text>/);
  }
  if (!m) { console.log('controls probe failed. stderr tail:\n' + res.err.slice(-400)); process.exit(1); }
  const pairs = m[1].replace(/PROBE::/, '').split('|');
  const want = {
    pause_state: 'paused', paused_freezes_rotor: 'true', pause_icon_shows_play: 'true',
    resume_moves_rotor: 'true', second_hand_runs_at_60x: 'true',
    space_pauses: 'paused', reset_clock: '10:10:30', wind_refills: '100%', space_resumes: 'running'
  };
  const startsWith = { preset_60x: '60', slider_max: '600', slider_min: '0.1' };
  let bad = 0;
  pairs.forEach((p) => {
    const eq = p.indexOf('=');
    const k = p.slice(0, eq), val = p.slice(eq + 1);
    let pass = true;
    if (want[k] !== undefined) pass = val === want[k];
    if (startsWith[k] !== undefined) pass = val.indexOf(startsWith[k]) === 0;
    if (!pass) bad++;
    console.log((pass ? '  \u2713 ' : '  \u2717 ') + k + ' = ' + val);
  });
  console.log(bad ? '\u2717 controls probe failed' : '\u2713 controls probe passed (' + pairs.length + ' signals)');
  process.exit(bad ? 1 : 0);
}

console.log('usage: node tools/browser.mjs shot <out.png> [viewBox] [ms] [static] | probe [ms] | controls [ms]');

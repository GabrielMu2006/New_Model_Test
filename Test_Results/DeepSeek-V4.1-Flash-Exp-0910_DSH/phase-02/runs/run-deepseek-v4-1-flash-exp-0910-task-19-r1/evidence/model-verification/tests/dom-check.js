/* ==========================================================================
 * tests/dom-check.js — static wiring verification.
 *
 *     node tests/dom-check.js
 *
 * There is no browser in this environment, so this checks everything about the
 * DOM layer that can be checked without one:
 *   * every referenced asset actually exists on disk and is non-empty;
 *   * every script the page loads parses as valid JavaScript;
 *   * every id main.js looks up through $() exists in index.html (a typo here
 *     would produce a silent null and a dead control);
 *   * every data-* attribute main.js reads is present somewhere in the markup;
 *   * no external URLs are referenced (the app must run fully offline);
 *   * the buttons main.js enables/disables are present.
 * ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

var passed = 0, failed = 0, failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; failures.push(name + (detail ? ' -> ' + detail : '')); console.log('  \u2717 ' + name + (detail ? ' -> ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

/* ------------------------------------------------------------------ */
section('1. Referenced assets exist and parse');

var refs = [];
html.replace(/<script src="([^"]+)"/g, function (_, src) { refs.push(src); return _; });
html.replace(/<link[^>]+href="([^"]+)"/g, function (_, href) {
  if (!/^(data:|https?:|#)/.test(href)) refs.push(href);
  return _;
});

refs.forEach(function (rel) {
  var f = path.join(ROOT, rel);
  var exists = fs.existsSync(f);
  var size = exists ? fs.statSync(f).size : 0;
  check('asset exists and is non-empty: ' + rel + (exists ? ' (' + size + ' bytes)' : ''),
    exists && size > 0);
});

refs.filter(function (r) { return /\.js$/.test(r); }).forEach(function (rel) {
  var src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  var ok = true, err = '';
  try { new vm.Script(src, { filename: rel }); }
  catch (e) { ok = false; err = e.message; }
  check('parses as JavaScript: ' + rel, ok, err);
});

var scripts = refs.filter(function (r) { return /\.js$/.test(r); });
var expectedOrder = ['orbital', 'data', 'simulation', 'projection', 'render', 'ui', 'main'];
var gotOrder = scripts.map(function (s) { return path.basename(s, '.js'); });
check('scripts load in dependency order (' + gotOrder.join(' -> ') + ')',
  JSON.stringify(gotOrder) === JSON.stringify(expectedOrder));

/* ------------------------------------------------------------------ */
section('2. No external resources (must run fully offline)');

var external = [];
html.replace(/(?:src|href)="([^"]+)"/g, function (_, u) {
  if (/^(https?:)?\/\//.test(u)) external.push(u);
  return _;
});
check('index.html references no external URLs', external.length === 0, external.join(', '));

var cssExternal = [];
fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8')
  .replace(/url\(([^)]+)\)/g, function (_, u) {
    if (!/^['"]?data:/.test(u)) cssExternal.push(u);
    return _;
  });
check('styles.css references no external URLs', cssExternal.length === 0, cssExternal.join(', '));

/* ------------------------------------------------------------------ */
section('3. Every id main.js looks up exists in the markup');

var htmlIds = {};
html.replace(/\bid="([^"]+)"/g, function (_, id) { htmlIds[id] = true; return _; });

// speedPresets: present in markup. The rest of the list must exist statically.
var wanted = [];
mainSrc.replace(/\$\('#([A-Za-z0-9_-]+)'\)/g, function (_, id) { wanted.push(id); return _; });
mainSrc.replace(/getElementById\('([A-Za-z0-9_-]+)'\)/g, function (_, id) { wanted.push(id); return _; });

// These are created at runtime by buildBodyList(), so absence from the static
// markup is correct. Asserted separately below.
var RUNTIME_CREATED = { bodyList: 'populated by buildBodyList()' };
var missing = wanted.filter(function (id) {
  return !htmlIds[id] && !RUNTIME_CREATED[id];
});
check('all ' + wanted.length + ' ids queried by main.js exist in index.html',
  missing.length === 0, 'missing: ' + missing.join(', '));

// Reverse direction: flag markup ids that nothing references (dead markup).
var referenced = {};
wanted.forEach(function (id) { referenced[id] = true; });
// Ids that are targets of aria-labelledby or <output for=...> are referenced
// from markup rather than from JS, so scan the whole HTML for them too.
var unused = Object.keys(htmlIds).filter(function (id) {
  if (referenced[id]) return false;
  if (new RegExp('["\'#]' + id + '["\']').test(mainSrc)) return false;
  if (new RegExp('#' + id + '\\b').test(mainSrc)) return false;
  // referenced from within index.html itself (aria-*, for=, list=, ...)
  var occurrences = html.split('"' + id + '"').length - 1;
  return occurrences < 2;
});
check('no obviously dead ids in the markup', unused.length === 0, unused.join(', '));

/* ------------------------------------------------------------------ */
section('4. data-* attributes main.js reads are present');

var wantedData = [];
mainSrc.replace(/dataset\.([A-Za-z0-9_]+)/g, function (_, d) { wantedData.push(d); return _; });
wantedData = wantedData.filter(function (v, i) { return wantedData.indexOf(v) === i; });

// `id` here is data-id on the buttons buildBodyList() creates at runtime.
var RUNTIME_DATA = { id: 'set by buildBodyList() on each .body-item' };
wantedData.forEach(function (d) {
  var attr = 'data-' + d.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
  if (RUNTIME_DATA[d]) {
    check('runtime-created elements supply ' + attr + ' (' + RUNTIME_DATA[d] + ')',
      new RegExp('dataset\\.' + d + '\\s*=').test(mainSrc));
    return;
  }
  check('markup provides ' + attr + ' (read as dataset.' + d + ')', html.indexOf(attr) !== -1);
});

/* ------------------------------------------------------------------ */
section('5. Query selectors and structural expectations');

var classSelectors = [];
mainSrc.replace(/querySelector(?:All)?\('\.([A-Za-z0-9_-]+)'\)/g, function (_, c) {
  classSelectors.push(c); return _;
});
classSelectors = classSelectors.filter(function (v, i) { return classSelectors.indexOf(v) === i; });
var CSS_ONLY_CLASSES = { 'body-item': true };   // created at runtime
classSelectors.forEach(function (c) {
  if (CSS_ONLY_CLASSES[c]) return;
  check('markup defines class .' + c, html.indexOf('class="' + c) !== -1 || html.indexOf(' ' + c + '"') !== -1 ||
    new RegExp('class="[^"]*\\b' + c + '\\b').test(html));
});

// .body-item is produced by buildBodyList() at runtime.
check('buildBodyList() creates .body-item elements',
  /className = 'body-item'/.test(mainSrc) || /class="body-item/.test(mainSrc));
check('buildBodyList() sets dataset.id',
  /b\.dataset\.id = body\.id/.test(mainSrc));

// The CSS must actually style the key hooks the JS toggles.
var css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
['is-selected', 'is-active', 'is-panning', 'is-hot', 'is-moon', 'is-live'].forEach(function (c) {
  check('styles.css handles state class .' + c, css.indexOf('.' + c) !== -1);
});

// Buttons the script enables/disables must exist as buttons.
['btnPlay', 'btnResetTime', 'btnSystemView', 'btnFollow', 'btnZoomIn', 'btnZoomOut',
 'btnHelp', 'btnPlanetView', 'inspectorClose', 'helpClose'].forEach(function (id) {
  var re = new RegExp('id="' + id + '"[^>]*');
  var m = re.exec(html);
  check('#' + id + ' is a <button>', !!m && /<button/.test(html.slice(Math.max(0, m.index - 200), m.index + m[0].length)));
});

/* ------------------------------------------------------------------ */
section('6. Accessibility basics');

check('canvas has a text alternative', /id="sky"[^>]*aria-label|aria-label="[^"]*"[^>]*id="sky"/.test(html));
var toggles = (html.match(/type="checkbox"/g) || []).length;
check('checkbox toggles are wrapped in <label> (' + toggles + ' toggles)',
  toggles > 0 && toggles === (html.match(/class="toggle"/g) || []).length);
check('the inspector is a labelled region', /id="inspector"[^>]*aria-label/.test(html));
check('the body list is a labelled nav', /<nav[^>]*aria-label/.test(html));
check('the help dialog is a <dialog>', /<dialog[^>]*id="helpDialog"/.test(html));
check('a live region exists for status messages', /aria-live="polite"/.test(html));

console.log('\n' + '='.repeat(60));
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) {
  console.log('\nFAILURES:');
  failures.forEach(function (f) { console.log('  - ' + f); });
}
console.log('='.repeat(60));
process.exit(failed ? 1 : 0);

/**
 * selftest.js — end-to-end test of the real app in a real browser.
 *
 * Runs inside selftest.html, drives index.html through its actual DOM
 * (button clicks and keyboard events), and writes a JSON report between
 * ### markers so run-tests.js can read it out of `--dump-dom`.
 */
(function () {
  'use strict';

  var out = document.getElementById('out');
  var frame = document.getElementById('frame');
  var results = [];
  var pageErrors = [];

  var ctx = { win: null, doc: null, buttons: {} };

  /* ------------------------------------------------------------- helpers */

  function record(name, ok, extra) {
    results.push({ name: name, ok: !!ok, extra: ok ? null : (extra === undefined ? null : extra) });
  }

  function eq(name, actual, expected) {
    var ok = actual === expected;
    record(name, ok, ok ? null : { actual: actual, expected: expected });
  }

  function ok(name, value, extra) {
    record(name, !!value, extra);
  }

  function attach() {
    var win = frame.contentWindow;
    var doc = frame.contentDocument;
    var buttons = {};
    Array.prototype.forEach.call(doc.querySelectorAll('[data-key]'), function (b) {
      buttons[b.dataset.key] = b;
    });
    ctx = { win: win, doc: doc, buttons: buttons };

    try {
      win.addEventListener('error', function (e) {
        pageErrors.push('window error: ' + (e.message || 'unknown'));
      });
      win.addEventListener('unhandledrejection', function (e) {
        pageErrors.push('unhandled rejection: ' + e.reason);
      });
      var origError = win.console.error;
      win.console.error = function () {
        pageErrors.push('console.error: ' + Array.prototype.join.call(arguments, ' '));
        return origError.apply(win.console, arguments);
      };
    } catch (err) { /* ignore */ }
  }

  function $(sel) { return ctx.doc.querySelector(sel); }

  function click(key) {
    var btn = ctx.buttons[key];
    if (!btn) throw new Error('no button with data-key=' + JSON.stringify(key));
    btn.click();
  }

  /** Space-separated keys; a run of digits is clicked one button at a time. */
  function type(keys) {
    String(keys).split(' ').forEach(function (k) {
      if (/^\d+$/.test(k)) k.split('').forEach(click);
      else if (k !== '') click(k);
    });
  }

  function key(name, opts) {
    var e = new ctx.win.KeyboardEvent('keydown', Object.assign({
      key: name, bubbles: true, cancelable: true
    }, opts || {}));
    ctx.doc.body.dispatchEvent(e);
    return e;
  }

  function display() { return $('#value').textContent; }
  function exprText() { return $('#expr').textContent.trim(); }
  function previewText() { return $('#preview').textContent.trim(); }

  function reset() {
    click('AC');
    click('MC');
    var clear = $('#historyClear');
    if (clear) clear.click();
  }

  /**
   * Wait until the app really booted inside the frame.
   * Checking readyState alone races: an iframe reports "complete" for the
   * initial about:blank document before the real navigation lands (easy to
   * hit when the page is served over http rather than file://).
   */
  function waitForLoad() {
    return new Promise(function (resolve, reject) {
      var tries = 0;
      (function poll() {
        var win = null;
        var doc = null;
        try { win = frame.contentWindow; doc = frame.contentDocument; } catch (err) { /* cross-origin */ }
        if (win && doc && doc.readyState === 'complete' && win.Calculator && win.CalcEngine) return resolve();
        if (tries++ > 400) return reject(new Error('the app did not boot inside the iframe'));
        setTimeout(poll, 25);
      }());
    });
  }

  /* ---------------------------------------------------------------- tests */

  async function run() {
    await waitForLoad();
    attach();

    /* --- boot ---------------------------------------------------------- */

    ok('iframe is laid out (not 0x0)', frame.getBoundingClientRect().width > 400);
    ok('CalcEngine global loaded', !!ctx.win.CalcEngine);
    ok('Calculator app object loaded', !!ctx.win.Calculator);
    ok('session exists', !!ctx.win.Calculator.session);
    eq('boot display', display(), '0');
    eq('29 keys rendered (6 rows x 5 columns, = spans 2)', ctx.doc.querySelectorAll('.key').length, 29);
    eq('display is an aria live region', $('#value').getAttribute('aria-live'), 'polite');

    var unnamed = Array.prototype.filter.call(ctx.doc.querySelectorAll('button'), function (b) {
      var label = (b.getAttribute('aria-label') || b.textContent || '').trim();
      return label === '';
    });
    eq('every button has an accessible name', unnamed.length, 0);

    var grid = ctx.win.getComputedStyle($('#keys'));
    eq('keys use a grid layout', grid.display, 'grid');
    eq('grid has 5 columns', grid.gridTemplateColumns.split(' ').length, 5);
    ok('equals spans two columns', ctx.buttons['='].getBoundingClientRect().width >
       ctx.buttons['0'].getBoundingClientRect().width * 1.8,
      { equals: ctx.buttons['='].getBoundingClientRect().width, zero: ctx.buttons['0'].getBoundingClientRect().width });

    var invisible = Array.prototype.filter.call(ctx.doc.querySelectorAll('.key'), function (b) {
      var r = b.getBoundingClientRect();
      return r.width < 20 || r.height < 20;
    });
    eq('no collapsed keys', invisible.length, 0);

    /* --- clicking ------------------------------------------------------ */

    reset();
    type('1 + 2 =');
    eq('1 + 2 = shows 3', display(), '3');

    reset();
    type('2 + 3 × 4 =');
    eq('precedence through the UI', display(), '14');

    reset();
    type('( 2 + 3 ) × 4 =');
    eq('parentheses through the UI', display(), '20');

    reset();
    type('1 2 3 ⌫');
    eq('backspace button', display(), '12');

    reset();
    type('5 ±');
    eq('sign toggle', display(), '-5');
    eq('sign toggle expression', exprText(), '-5');

    reset();
    type('9 √ =');
    eq('square root button', display(), '3');

    reset();
    type('5 x² =');
    eq('square button', display(), '25');

    reset();
    type('4 1/x =');
    eq('reciprocal button', display(), '0.25');

    reset();
    type('5 0 + 1 0 % =');
    eq('percent button', display(), '55');

    reset();
    type('0 . 1 + 0 . 2 =');
    eq('no floating point noise in the UI', display(), '0.3');

    /* --- live preview + armed operator --------------------------------- */

    reset();
    type('2 + 3');
    eq('running total preview', previewText(), '= 5');
    ok('pending operator is highlighted', ctx.buttons['+'].classList.contains('is-armed'),
      ctx.buttons['+'].className);
    type('=');
    eq('equals resolves the entry', display(), '5');
    ok('highlight clears after equals', !ctx.buttons['+'].classList.contains('is-armed'));

    /* --- errors -------------------------------------------------------- */

    reset();
    type('1 ÷ 0 =');
    eq('divide by zero message', display(), 'Cannot divide by zero');
    ok('error state is styled', $('#value').classList.contains('is-error'));
    eq('failed calculation adds no history', $('#historyList').children.length, 0);
    type('7');
    eq('typing after an error starts fresh', display(), '7');
    ok('error styling cleared', !$('#value').classList.contains('is-error'));

    /* --- memory -------------------------------------------------------- */

    reset();
    type('5 M+');
    ok('memory badge appears', !$('#memBadge').hidden);
    type('AC 3 M+ MR');
    eq('memory recall', display(), '8');
    click('MC');
    ok('memory badge hides after MC', $('#memBadge').hidden);

    /* --- history panel ------------------------------------------------- */

    reset();
    type('2 + 3 =');
    type('1 0 × 4 =');
    eq('history has two entries', $('#historyList').children.length, 2);
    eq('newest entry first', $('.history__item .history__result').textContent, '40');
    eq('newest expression text', $('.history__item .history__expr').textContent, '10 × 4 =');
    eq('history badge count', $('#historyCount').textContent, '2');

    $('.history__item').click();
    eq('clicking a history entry loads its value', display(), '40');

    var panel = $('#historyPanel');
    var toggle = $('#historyToggle');
    var wasOpen = !panel.hidden;
    toggle.click();
    eq('history toggle flips the panel', panel.hidden, wasOpen);
    eq('history toggle updates aria-expanded', toggle.getAttribute('aria-expanded'), String(!wasOpen));
    toggle.click();
    eq('history panel reopens', panel.hidden, false);

    /* --- persistence across reload ------------------------------------- */

    reset();
    type('7 + 8 =');
    eq('value before reload', display(), '15');
    await new Promise(function (resolve) {
      frame.addEventListener('load', function () { resolve(); }, { once: true });
      frame.contentWindow.location.reload();
    });
    await waitForLoad();
    attach();
    eq('history survives a reload', $('#historyList').children.length, 1);
    eq('reloaded history result', $('.history__item .history__result').textContent, '15');
    eq('entry is not restored (only history is)', display(), '0');

    /* --- keyboard ------------------------------------------------------ */

    reset();
    key('7');
    eq('keyboard digit', display(), '7');
    key('+');
    key('8');
    key('Enter');
    eq('keyboard Enter evaluates', display(), '15');

    reset();
    type('1 2 3');
    key('Backspace');
    eq('keyboard Backspace', display(), '12');
    key('Escape');
    eq('keyboard Escape clears', display(), '0');

    reset();
    key('6');
    key('*');
    key('7');
    key('Enter');
    eq('keyboard * means multiply', display(), '42');

    reset();
    key('8');
    key('/');
    key('4');
    key('Enter');
    eq('keyboard / means divide', display(), '2');

    reset();
    key('/');
    key('4');
    eq('a leading operator is ignored', display(), '4');

    reset();
    key('s');
    key('9');
    key('Enter');
    eq('keyboard s is square root', display(), '3');

    reset();
    key('5');
    key('q');
    key('Enter');
    eq('keyboard q is square', display(), '25');

    reset();
    key('5');
    key('n');
    eq('keyboard n toggles sign', display(), '-5');

    reset();
    type('5 0 + 1 0');
    key('%');
    key('Enter');
    eq('keyboard percent', display(), '55');

    reset();
    key('F5');
    eq('unmapped keys are ignored', display(), '0');

    /* --- keyboard must not double-fire on a focused button ------------- */

    reset();
    ctx.buttons['5'].focus();
    key('Enter');
    eq('Enter on a focused button does not double-fire', display(), '0');

    /* --- long number auto-fit ------------------------------------------ */

    reset();
    type('1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0');
    var valueEl = $('#value');
    var fontSize = parseFloat(ctx.win.getComputedStyle(valueEl).fontSize);
    ok('long number shrinks to fit', fontSize < 44, { fontSize: fontSize, text: display() });
    ok('long number does not overflow its box',
      valueEl.scrollWidth <= valueEl.clientWidth + 2,
      { scrollWidth: valueEl.scrollWidth, clientWidth: valueEl.clientWidth });
    eq('input is capped at 15 digits', display().replace(/,/g, '').length, 15);

    /* --- history clear + persistence of the empty state ---------------- */

    reset();
    type('1 + 1 =');
    $('#historyClear').click();
    eq('clear empties the history list', $('#historyList').children.length, 0);
    ok('empty state is shown', !$('#historyEmpty').hidden);
    ok('history count badge hides', $('#historyCount').hidden);

    /* --- responsive layout --------------------------------------------- */

    var cardWidth = $('.calculator').getBoundingClientRect().width;
    ok('calculator card is a sane width', cardWidth > 300 && cardWidth <= 460, { cardWidth: cardWidth });
    ok('history panel sits beside the calculator on wide screens',
      $('#historyPanel').getBoundingClientRect().left >=
      $('.calculator').getBoundingClientRect().right - 1,
      {
        historyLeft: $('#historyPanel').getBoundingClientRect().left,
        calcRight: $('.calculator').getBoundingClientRect().right
      });

    eq('no page errors during the run', pageErrors.length, 0);
  }

  /* --------------------------------------------------------------- report */

  function finish() {
    var failed = results.filter(function (r) { return !r.ok; }).length;
    results.forEach(function (r) {
      // also mirror to the visible log, which is handy when run by hand
      var line = (r.ok ? 'pass  ' : 'FAIL  ') + r.name +
        (r.ok || r.extra === null ? '' : '  → ' + JSON.stringify(r.extra));
      var pre = document.createElement('div');
      pre.textContent = line;
      out.appendChild(pre);
    });
    var tail = document.createElement('div');
    tail.textContent = failed
      ? failed + ' of ' + results.length + ' browser checks FAILED'
      : 'ALL ' + results.length + ' browser checks passed';
    out.appendChild(tail);
    out.setAttribute('data-done', '1');

    var payload = { results: results, failed: failed, pageErrors: pageErrors };
    var marker = document.createElement('div');
    marker.textContent = '###' + JSON.stringify(payload) + '###';
    out.appendChild(marker);
  }

  run().then(finish, function (err) {
    pageErrors.push('harness crash: ' + (err && err.stack ? err.stack : String(err)));
    record('harness completed', false, String(err && err.message ? err.message : err));
    finish();
  });
}());

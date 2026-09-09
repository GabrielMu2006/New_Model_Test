/**
 * app.js — DOM wiring for the calculator.
 *
 * All arithmetic lives in calc-engine.js; this file only translates clicks and
 * keystrokes into CalcSession.press() calls and paints the returned view model.
 */
(function () {
  'use strict';

  var Engine = window.CalcEngine;
  var STORE_KEY = 'calculator.v1';

  var els = {
    expr: document.getElementById('expr'),
    value: document.getElementById('value'),
    preview: document.getElementById('preview'),
    memBadge: document.getElementById('memBadge'),
    keys: document.getElementById('keys'),
    historyToggle: document.getElementById('historyToggle'),
    historyPanel: document.getElementById('historyPanel'),
    historyList: document.getElementById('historyList'),
    historyEmpty: document.getElementById('historyEmpty'),
    historyCount: document.getElementById('historyCount'),
    historyClear: document.getElementById('historyClear')
  };

  var session = new Engine.CalcSession();

  /** key name -> <button>, so keyboard presses can flash the matching key */
  var keyButtons = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-key]'), function (btn) {
    keyButtons[btn.dataset.key] = btn;
  });

  /* --------------------------------------------------------- persistence */

  function loadState() {
    var raw;
    try { raw = window.localStorage.getItem(STORE_KEY); } catch (err) { return; }
    if (!raw) return;
    var saved;
    try { saved = JSON.parse(raw); } catch (err) { return; }
    if (!saved || typeof saved !== 'object') return;
    if (Array.isArray(saved.history)) session.history = saved.history.slice(0, Engine.MAX_HISTORY);
    if (typeof saved.memory === 'number' && isFinite(saved.memory)) session.memory = saved.memory;
    session.memorySet = !!saved.memorySet;
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        history: session.history,
        memory: session.memory,
        memorySet: session.memorySet
      }));
    } catch (err) { /* private mode / quota: history simply stops persisting */ }
  }

  /* --------------------------------------------------------------- painting */

  function fitDisplay() {
    var el = els.value;
    el.style.fontSize = '';                     // back to the stylesheet value
    if (el.classList.contains('is-error')) { el.scrollLeft = 0; return; }
    var size = parseFloat(window.getComputedStyle(el).fontSize) || 44;
    var guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > 18 && guard++ < 30) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
    el.scrollLeft = el.scrollWidth;             // long numbers stay readable at the tail
  }

  function renderHistory(history) {
    var frag = document.createDocumentFragment();
    history.forEach(function (item, index) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history__item';
      btn.dataset.index = String(index);
      btn.title = item.expression + ' = ' + item.result;
      btn.setAttribute('aria-label', item.expression + ' equals ' + item.result);

      var expr = document.createElement('span');
      expr.className = 'history__expr';
      expr.textContent = item.expression + ' =';

      var result = document.createElement('span');
      result.className = 'history__result';
      result.textContent = item.result;

      btn.appendChild(expr);
      btn.appendChild(result);
      li.appendChild(btn);
      frag.appendChild(li);
    });
    els.historyList.textContent = '';
    els.historyList.appendChild(frag);

    els.historyEmpty.hidden = history.length > 0;
    els.historyCount.hidden = history.length === 0;
    els.historyCount.textContent = String(history.length);
  }

  function render() {
    var view = session.view();

    els.expr.textContent = view.expression || '\u00a0';
    els.expr.scrollLeft = els.expr.scrollWidth;

    els.value.textContent = view.display;
    els.value.classList.toggle('is-error', !!view.error);

    els.preview.textContent = view.preview || '\u00a0';

    els.memBadge.hidden = view.memory === null;
    if (view.memory !== null) els.memBadge.title = 'Memory: ' + Engine.formatNumber(view.memory);

    Object.keys(keyButtons).forEach(function (key) {
      keyButtons[key].classList.toggle('is-armed', key === view.pendingOp);
    });

    renderHistory(view.history);
    fitDisplay();
    saveState();
  }

  /* ---------------------------------------------------------------- input */

  function flash(key) {
    var btn = keyButtons[key];
    if (!btn) return;
    btn.classList.add('is-flash');
    window.setTimeout(function () { btn.classList.remove('is-flash'); }, 90);
  }

  function pressKey(key) {
    if (!key) return;
    session.press(key);
    render();
    flash(key);
  }

  els.keys.addEventListener('click', function (event) {
    var btn = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!btn) return;
    pressKey(btn.dataset.key);
  });

  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    // A focused button already handles Enter/Space natively — don't double-fire.
    var target = event.target;
    if (target && target.tagName === 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) return;

    var key = Engine.keyFor(event);
    if (!key) return;
    event.preventDefault();
    pressKey(key);
  });

  /* -------------------------------------------------------------- history */

  els.historyToggle.addEventListener('click', function () {
    var willOpen = els.historyPanel.hidden;
    els.historyPanel.hidden = !willOpen;
    els.historyToggle.setAttribute('aria-expanded', String(willOpen));
  });

  els.historyClear.addEventListener('click', function () {
    session.history.length = 0;
    render();
  });

  els.historyList.addEventListener('click', function (event) {
    var btn = event.target && event.target.closest ? event.target.closest('.history__item') : null;
    if (!btn) return;
    var item = session.history[Number(btn.dataset.index)];
    if (!item) return;
    session.load(item.value);
    render();
  });

  window.addEventListener('resize', fitDisplay);

  /* ---------------------------------------------------------------- start */

  loadState();

  // Wide screens have room for the history column; small ones get it on demand.
  if (window.innerWidth >= 720) {
    els.historyPanel.hidden = false;
    els.historyToggle.setAttribute('aria-expanded', 'true');
  }

  render();

  // Test hook — the browser self-test drives the real DOM, but reads state here.
  window.Calculator = {
    engine: Engine,
    session: session,
    render: render,
    pressKey: pressKey,
    keyButtons: keyButtons
  };
}());

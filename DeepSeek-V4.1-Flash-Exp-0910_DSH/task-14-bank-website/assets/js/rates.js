/* ==========================================================================
   Meridian Bank — rates table
   Client-side filter, search and sort for the rate sheet on rates.html.
   Progressive enhancement: without JavaScript the full table is simply shown.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-rates]');
  if (!root) return;

  var $ = function (sel, r) { return (r || root).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || root).querySelectorAll(sel)); };

  var tbody = $('tbody', root);
  var rows = $$('tr[data-cat]', tbody);
  var chips = $$('[data-filter]', root);
  var search = $('[data-search]', root);
  var shownOut = $('[data-shown]', root);
  var totalOut = $('[data-total]', root);
  var empty = $('[data-empty]', root);
  var table = $('table', root);
  var reset = $('[data-reset]', root);

  var state = { filter: 'all', q: '', sort: null, dir: -1 };

  if (totalOut) totalOut.textContent = String(rows.length);

  function apply() {
    var q = state.q.trim().toLowerCase();
    var shown = 0;

    rows.forEach(function (tr) {
      var matchesCat = state.filter === 'all' || tr.getAttribute('data-cat') === state.filter;
      var matchesQ = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
      var show = matchesCat && matchesQ;
      tr.hidden = !show;
      if (show) shown++;
    });

    if (state.sort) {
      rows.slice().sort(function (a, b) {
        var av = parseFloat(a.getAttribute('data-' + state.sort)) || 0;
        var bv = parseFloat(b.getAttribute('data-' + state.sort)) || 0;
        return (av - bv) * state.dir;
      }).forEach(function (tr) { tbody.appendChild(tr); });
    }

    if (shownOut) shownOut.textContent = String(shown);
    if (empty) empty.hidden = shown > 0;
    if (table) table.hidden = shown === 0;

    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('data-filter') === state.filter));
    });

    $$('[data-sort]', root).forEach(function (btn) {
      var isActive = btn.getAttribute('data-sort') === state.sort;
      btn.setAttribute('aria-sort', isActive ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.filter = chip.getAttribute('data-filter');
      apply();
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      state.q = search.value;
      apply();
    });
  }

  $$('[data-sort]', root).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-sort');
      if (state.sort === key) {
        state.dir = -state.dir;
      } else {
        state.sort = key;
        state.dir = -1; // best rate first
      }
      apply();
    });
  });

  if (reset) {
    reset.addEventListener('click', function () {
      state = { filter: 'all', q: '', sort: null, dir: -1 };
      if (search) search.value = '';
      apply();
    });
  }

  apply();
})();

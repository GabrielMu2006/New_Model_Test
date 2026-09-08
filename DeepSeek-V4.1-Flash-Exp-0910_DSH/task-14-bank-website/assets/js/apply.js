/* ==========================================================================
   Meridian Bank — account application wizard
   Four validated steps, a live review screen, and a confirmation panel.
   Validation is delegated to forms.js (loaded first via the page's scripts
   list); this module only owns step navigation and the summary.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-wizard]');
  if (!form) return;

  var Forms = window.MeridianForms;
  var doc = document;
  var $ = function (sel, r) { return (r || doc).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(sel)); };

  var panels = $$('[data-wpanel]');
  var stepDots = $$('[data-steps] [data-step]');
  var progress = $('[data-progress]');
  var backBtn = $('[data-back]');
  var nextBtn = $('[data-next]');
  var submitBtn = $('[data-submit]');
  var summary = $('[data-summary]');
  var navRow = $('[data-nav-row]');
  var success = $('[data-success]');
  var total = panels.length;
  var current = 1;

  var state = { funding: 0 };

  function panelFor(n) { return panels[n - 1]; }

  function render() {
    panels.forEach(function (panel, i) {
      panel.hidden = i + 1 !== current;
    });

    stepDots.forEach(function (dot) {
      var n = Number(dot.getAttribute('data-step'));
      dot.classList.toggle('is-done', n < current);
      if (n === current) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });

    if (progress) progress.style.width = Math.round((current / total) * 100) + '%';
    if (backBtn) backBtn.hidden = current === 1;
    if (nextBtn) nextBtn.hidden = current >= total;
    if (submitBtn) submitBtn.hidden = current < total;

    if (current === total) buildSummary();

    var heading = panelFor(current).querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function collect() {
    var data = {};
    $$('input, select, textarea', form).forEach(function (field) {
      if (!field.name) return;
      if (field.type === 'radio') {
        if (field.checked) data[field.name] = field.value;
      } else if (field.type === 'checkbox') {
        data[field.name] = field.checked;
      } else {
        data[field.name] = field.value.trim();
      }
    });
    return data;
  }

  function buildSummary() {
    if (!summary) return;
    var d = collect();
    var money = window.MeridianFinance ? window.MeridianFinance.money : function (n) { return '$' + n; };
    var rows = [
      ['Account', d.account || '—'],
      ['Name', [d.first, d.last].filter(Boolean).join(' ') || '—'],
      ['Email', d.email || '—'],
      ['Mobile', d.phone || '—'],
      ['Date of birth', d.dob || '—'],
      ['Address', [d.address, d.city, d.state, d.zip].filter(Boolean).join(', ') || '—'],
      ['Opening deposit', money(state.funding)],
      ['Funding method', d.method || '—'],
      ['Promo code', d.promo || 'None']
    ];
    summary.innerHTML = rows.map(function (row) {
      return '<div class="review__row"><dt>' + row[0] + '</dt><dd>' + escapeHtml(row[1]) + '</dd></div>';
    }).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function validateCurrent() {
    if (!Forms) return true;
    var firstBad = Forms.validateForm(panelFor(current));
    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      if (!validateCurrent()) return;
      if (current < total) { current++; render(); }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (current > 1) { current--; render(); }
    });
  }

  /* Funding choices: keep the selected amount in state. */
  var fundingGroup = $('[data-in="funding"]', form);
  if (fundingGroup) {
    $$('button', fundingGroup).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.funding = Number(btn.getAttribute('data-value')) || 0;
        if (current === total) buildSummary();
      });
    });
  }

  /* Enter should advance, never submit the whole application early. */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'button') return;
    e.preventDefault();
    if (current < total) nextBtn.click();
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); });

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      if (!validateCurrent()) return;
      var d = collect();
      var reference = 'MB-' + new Date().getFullYear() + '-' +
        String(Math.floor(100000 + Math.random() * 899999));

      form.hidden = true;
      if (navRow) navRow.hidden = true;
      var steps = $('[data-steps]');
      if (steps) steps.hidden = true;
      var bar = $('.progress');
      if (bar) bar.hidden = true;

      if (success) {
        success.hidden = false;
        var body = success.querySelector('[data-success-body]') || success;
        [['first', d.first], ['account', d.account], ['reference', reference]].forEach(function (pair) {
          $$('[data-fill="' + pair[0] + '"]', success).forEach(function (el) {
            el.textContent = pair[1] || '—';
          });
        });
        if (body) body = body; // no-op, keeps linters quiet
        success.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  render();
  window.MeridianApply = { get step() { return current; }, state: state };
})();

/* ==========================================================================
   Meridian Bank — calculators
   Wires the declarative [data-calc] widgets on loans.html and personal.html to
   the pure maths in finance.js. Every widget is described entirely in markup:
   inputs use data-in="name", outputs use data-out="name", so the same engine
   can be dropped on a page twice without id collisions.
   ========================================================================== */
(function () {
  'use strict';

  var F = window.MeridianFinance;
  if (!F) {
    console.error('calculators.js needs finance.js to be loaded first — check the page\'s scripts list.');
    return;
  }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(root, kind, name) { return $('[' + kind + '="' + name + '"]', root); }
  function setOut(root, name, text) {
    var node = el(root, 'data-out', name);
    if (node) node.textContent = text;
  }
  function width(root, name, pct) {
    var node = el(root, 'data-out', name);
    if (node) node.style.width = F.clamp(pct, 0, 100) + '%';
  }
  function segValue(root, name, fallback) {
    var group = el(root, 'data-in', name);
    if (!group) return fallback;
    var on = $('button[aria-pressed="true"]', group);
    return on ? Number(on.getAttribute('data-value')) : fallback;
  }
  function num(root, name, fallback) {
    var node = el(root, 'data-in', name);
    return node ? Number(node.value) : fallback;
  }
  function attrNum(root, name, fallback) {
    var v = Number(root.getAttribute(name));
    return isNaN(v) ? fallback : v;
  }
  /** Paint the filled portion of a range input via a CSS custom property. */
  function paintRange(node) {
    if (!node || node.type !== 'range') return;
    var min = Number(node.min), max = Number(node.max);
    var pct = max > min ? ((Number(node.value) - min) / (max - min)) * 100 : 0;
    node.style.setProperty('--fill', pct + '%');
  }

  /* --- shared chart painter --------------------------------------------- */
  function drawChart(root, start, monthly, apy, years) {
    var svg = el(root, 'data-out', 'chart');
    if (!svg) return;
    var line = el(root, 'data-out', 'chartLine');
    var area = el(root, 'data-out', 'chartArea');
    var dot = el(root, 'data-out', 'chartDot');

    var W = 320, H = 120, pad = 6;
    var months = Math.max(1, Math.round(years * 12));
    var series = [];
    for (var m = 0; m <= months; m++) {
      series.push(F.savingsFutureValue(start, monthly, apy, m));
    }
    var max = Math.max.apply(null, series) || 1;
    var min = Math.min.apply(null, series);
    var span = (max - min) || 1;

    var x = function (i) { return pad + (i / months) * (W - pad * 2); };
    var y = function (v) { return H - pad - ((v - min) / span) * (H - pad * 2); };

    var d = series.map(function (v, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
    }).join(' ');

    if (line) line.setAttribute('d', d);
    if (area) area.setAttribute('d', d + ' L' + x(months).toFixed(1) + ' ' + (H - pad) + ' L' + pad + ' ' + (H - pad) + ' Z');
    if (dot) { dot.setAttribute('cx', x(months).toFixed(1)); dot.setAttribute('cy', y(series[months]).toFixed(1)); }

    var cap = el(root, 'data-out', 'chartCap');
    if (cap) cap.textContent = 'Projected balance after ' + years + ' year' + (years === 1 ? '' : 's');
  }

  /* --- engines ----------------------------------------------------------- */
  var ENGINES = {
    /** Home affordability: price, down payment, term, rate, taxes, insurance. */
    mortgage: function (root) {
      var taxRate = attrNum(root, 'data-tax-rate', 1.05);
      var insuranceYear = attrNum(root, 'data-insurance', 1800);
      var feePct = attrNum(root, 'data-fee-pct', 0.5);

      return function run() {
        var price = num(root, 'price', 450000);
        var downPct = num(root, 'down', 20);
        var months = segValue(root, 'term', 360);
        var rate = num(root, 'rate', 6.375);

        setOut(root, 'priceLabel', F.money(price));
        setOut(root, 'downLabel', downPct + '% · ' + F.money(price * downPct / 100));

        var h = F.housingPayment(price, downPct, rate, months, taxRate, insuranceYear);
        var interest = F.totalInterest(h.loan, rate, months);

        setOut(root, 'monthly', F.money(h.total));
        setOut(root, 'pi', F.money2(h.principalInterest));
        setOut(root, 'tax', F.money2(h.tax));
        setOut(root, 'insurance', F.money2(h.insurance));
        setOut(root, 'loan', F.money(h.loan));
        setOut(root, 'interest', F.money(interest));
        setOut(root, 'cost', F.money(h.loan + interest));
        setOut(root, 'apr', F.pctFixed(F.apr(h.loan, rate, months, h.loan * feePct / 100), 3));

        var total = h.total || 1;
        width(root, 'barPI', (h.principalInterest / total) * 100);
        width(root, 'barTax', (h.tax / total) * 100);
        width(root, 'barIns', (h.insurance / total) * 100);
      };
    },

    /** Generic instalment loan: auto, personal, or anything with a fixed APR. */
    loan: function (root) {
      var feePct = attrNum(root, 'data-fee-pct', 0);
      return function run() {
        var amount = num(root, 'amount', 25000);
        var months = segValue(root, 'term', 60);
        var rate = num(root, 'rate', 6.19);

        setOut(root, 'amountLabel', F.money(amount));

        var pmt = F.monthlyPayment(amount, rate, months);
        var interest = F.totalInterest(amount, rate, months);
        var totalCost = amount + interest;

        setOut(root, 'monthly', F.money(pmt));
        setOut(root, 'interest', F.money(interest));
        setOut(root, 'total', F.money(totalCost));
        setOut(root, 'apr', F.pctFixed(F.apr(amount, rate, months, amount * feePct / 100), 3));

        var denom = totalCost || 1;
        width(root, 'barPrincipal', (amount / denom) * 100);
        width(root, 'barInterest', (interest / denom) * 100);
      };
    },

    /** Savings growth: starting balance, monthly deposit, APY, horizon. */
    savings: function (root) {
      return function run() {
        var start = num(root, 'start', 2000);
        var monthly = num(root, 'monthly', 300);
        var years = segValue(root, 'years', 10);
        var apy = num(root, 'apy', 4.35);
        var months = years * 12;

        setOut(root, 'startLabel', F.money(start));
        setOut(root, 'monthlyLabel', F.money(monthly));

        var balance = F.savingsFutureValue(start, monthly, apy, months);
        var contributed = start + monthly * months;
        var earned = balance - contributed;

        setOut(root, 'balance', F.money(balance));
        setOut(root, 'contributed', F.money(contributed));
        setOut(root, 'earned', F.money(earned));

        var denom = balance || 1;
        width(root, 'barContributed', (contributed / denom) * 100);
        width(root, 'barEarned', (earned / denom) * 100);

        drawChart(root, start, monthly, apy, years);
      };
    },

    /** Term deposit at maturity. */
    cd: function (root) {
      return function run() {
        var amount = num(root, 'amount', 10000);
        var months = segValue(root, 'term', 12);
        var select = el(root, 'data-in', 'apy');

        // Keep the rate in step with the term: each option declares its term.
        if (select) {
          var match = null;
          $$('option', select).forEach(function (opt) {
            if (Number(opt.getAttribute('data-term')) === months) match = opt;
          });
          if (match && select.value !== match.value) select.value = match.value;
        }

        var apy = select ? Number(select.value) : 4.6;

        setOut(root, 'amountLabel', F.money(amount));
        setOut(root, 'apy', F.pctFixed(apy, 2));

        var maturity = F.termDeposit(amount, apy, months);
        setOut(root, 'maturity', F.money(maturity));
        setOut(root, 'interest', F.money(maturity - amount));
        setOut(root, 'perMonth', F.money2((maturity - amount) / months));
      };
    }
  };

  /* --- bootstrap --------------------------------------------------------- */
  $$('[data-calc]').forEach(function (root) {
    var make = ENGINES[root.getAttribute('data-calc')];
    if (!make) return;
    var run = make(root);

    // Segmented controls behave like radio groups.
    $$('.segctl', root).forEach(function (group) {
      $$('button', group).forEach(function (btn) {
        btn.addEventListener('click', function () {
          $$('button', group).forEach(function (other) {
            other.setAttribute('aria-pressed', String(other === btn));
          });
          run();
        });
      });
    });

    // Live inputs.
    $$('[data-in]', root).forEach(function (node) {
      if (node.classList.contains('segctl')) return;
      var handler = function () { paintRange(node); run(); };
      node.addEventListener('input', handler);
      node.addEventListener('change', handler);
      paintRange(node);
    });

    run();
  });

  // Expose for the screenshot harness / manual poking in the console.
  window.MeridianCalculators = { engines: Object.keys(ENGINES) };
})();

/* ==========================================================================
   Meridian Bank — finance math
   Pure functions only: no DOM, no globals beyond the UMD export below.
   Loaded as a plain script in the browser and `require`d by tests/finance.test.js,
   so every number the site shows can be checked from the command line.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MeridianFinance = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTHS = 12;

  function round(n, dp) {
    var f = Math.pow(10, dp == null ? 2 : dp);
    return Math.round((n + Number.EPSILON) * f) / f;
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  /**
   * Fixed-rate amortising payment (principal + interest) per month.
   * @param {number} principal  loan amount in dollars
   * @param {number} annualRate nominal annual rate, percent (6.375 = 6.375%)
   * @param {number} months     term in months
   */
  function monthlyPayment(principal, annualRate, months) {
    if (!(principal > 0) || !(months > 0)) return 0;
    var r = annualRate / 100 / MONTHS;
    if (r === 0) return principal / months;
    return principal * r / (1 - Math.pow(1 + r, -months));
  }

  /** Full amortisation schedule: one row per month. */
  function schedule(principal, annualRate, months) {
    var rows = [];
    if (!(principal > 0) || !(months > 0)) return rows;
    var r = annualRate / 100 / MONTHS;
    var pay = monthlyPayment(principal, annualRate, months);
    var balance = principal;
    for (var m = 1; m <= months; m++) {
      var interest = balance * r;
      var principalPart = pay - interest;
      if (m === months) { principalPart = balance; }
      balance = Math.max(0, balance - principalPart);
      rows.push({
        month: m,
        payment: round(principalPart + interest),
        interest: round(interest),
        principal: round(principalPart),
        balance: round(balance)
      });
    }
    return rows;
  }

  function totalInterest(principal, annualRate, months) {
    if (!(principal > 0) || !(months > 0)) return 0;
    if (annualRate === 0) return 0;
    return round(monthlyPayment(principal, annualRate, months) * months - principal);
  }

  /**
   * APR for a loan that carries upfront fees, solved by bisection on the
   * monthly rate so that the present value of payments equals cash advanced.
   */
  function apr(principal, annualRate, months, fees) {
    if (!(principal > 0) || !(months > 0)) return 0;
    var f = fees || 0;
    if (f <= 0 || annualRate === 0) return round(annualRate, 3);
    var pmt = monthlyPayment(principal, annualRate, months);
    var advanced = principal - f;
    var npv = function (i) {
      if (i === 0) return pmt * months - advanced;
      return pmt * (1 - Math.pow(1 + i, -months)) / i - advanced;
    };
    var lo = 0, hi = 1; // monthly rates: 0% .. 100%
    for (var k = 0; k < 80; k++) {
      var mid = (lo + hi) / 2;
      if (npv(mid) > 0) lo = mid; else hi = mid;
    }
    return round(((lo + hi) / 2) * MONTHS * 100, 3);
  }

  /** Future value with compounding `perYear` times. */
  function compound(principal, annualRate, years, perYear) {
    var n = perYear || MONTHS;
    var r = annualRate / 100;
    return round(principal * Math.pow(1 + r / n, n * years));
  }

  /** Future value of an annuity: deposits made at the end of each month. */
  function savingsFutureValue(start, monthly, annualRate, months) {
    var r = annualRate / 100 / MONTHS;
    var grown = r === 0 ? start : start * Math.pow(1 + r, months);
    var deposits = r === 0 ? monthly * months : monthly * (Math.pow(1 + r, months) - 1) / r;
    return round(grown + deposits);
  }

  /** Months needed to reach a target with a monthly deposit + APY. */
  function monthsToGoal(target, start, monthly, annualRate) {
    if (start >= target) return 0;
    if (!(monthly > 0)) return Infinity;
    var r = annualRate / 100 / MONTHS;
    var n = 0, balance = start;
    while (balance < target && n < 1200) {
      balance = balance * (1 + r) + monthly;
      n++;
    }
    return n >= 1200 ? Infinity : n;
  }

  /** Monthly payment including escrowed property tax and insurance. */
  function housingPayment(price, downPct, annualRate, months, taxRatePct, insuranceYear) {
    var loan = price * (1 - downPct / 100);
    var pi = monthlyPayment(loan, annualRate, months);
    var tax = price * (taxRatePct / 100) / 12;
    var ins = (insuranceYear || 0) / 12;
    return {
      loan: round(loan),
      principalInterest: round(pi),
      tax: round(tax),
      insurance: round(ins),
      total: round(pi + tax + ins)
    };
  }

  /** Value of a term deposit at maturity, compounding the quoted APY annually. */
  function termDeposit(principal, apy, months) {
    var years = months / 12;
    return round(principal * Math.pow(1 + apy / 100, years));
  }

  /** Effective APY from a nominal rate compounded monthly. */
  function apyFromNominal(nominal, perYear) {
    var n = perYear || MONTHS;
    return round((Math.pow(1 + (nominal / 100) / n, n) - 1) * 100, 3);
  }

  /* --- formatting ------------------------------------------------------- */
  function money(n, dp) {
    var v = Number(n) || 0;
    return '$' + v.toLocaleString('en-US', {
      minimumFractionDigits: dp == null ? 0 : dp,
      maximumFractionDigits: dp == null ? 0 : dp
    });
  }
  function money2(n) { return money(n, 2); }
  function pct(n, dp) {
    return (Number(n) || 0).toFixed(dp == null ? 3 : dp).replace(/\.?0+$/, '') + '%';
  }
  function pctFixed(n, dp) { return (Number(n) || 0).toFixed(dp == null ? 2 : dp) + '%'; }

  return {
    monthlyPayment: monthlyPayment,
    schedule: schedule,
    totalInterest: totalInterest,
    apr: apr,
    compound: compound,
    savingsFutureValue: savingsFutureValue,
    monthsToGoal: monthsToGoal,
    housingPayment: housingPayment,
    termDeposit: termDeposit,
    apyFromNominal: apyFromNominal,
    money: money,
    money2: money2,
    pct: pct,
    pctFixed: pctFixed,
    round: round,
    clamp: clamp
  };
}));

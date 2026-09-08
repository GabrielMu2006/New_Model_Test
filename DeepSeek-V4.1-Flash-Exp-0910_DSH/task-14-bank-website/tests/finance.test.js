#!/usr/bin/env node
/**
 * Unit tests for assets/js/finance.js — the module that produces every figure
 * shown by the mortgage, loan, savings and CD calculators on the site.
 *
 *   node tests/finance.test.js
 *
 * No dependencies: run it from the task folder.
 */
'use strict';

const F = require('../assets/js/finance.js');

let passed = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { passed++; return; }
  failures.push(name + (detail ? ` — ${detail}` : ''));
}

function near(name, actual, expected, tol) {
  const t = tol == null ? 0.01 : tol;
  ok(name, Math.abs(actual - expected) <= t, `expected ${expected}, got ${actual}`);
}

/* --- monthlyPayment ------------------------------------------------------ */
// Classic 30-year fixed: $300,000 at 6.375% is a well-known benchmark payment.
near('monthlyPayment: 300k @ 6.375% / 360', F.monthlyPayment(300000, 6.375, 360), 1871.61, 0.05);
near('monthlyPayment: zero-rate loan divides evenly', F.monthlyPayment(1200, 0, 12), 100, 1e-9);
near('monthlyPayment: 15-year is higher than 30-year',
  Math.sign(F.monthlyPayment(300000, 5.625, 180) - F.monthlyPayment(300000, 6.375, 360)), 1, 1e-9);
ok('monthlyPayment: no principal yields 0', F.monthlyPayment(0, 6, 360) === 0);
ok('monthlyPayment: no term yields 0', F.monthlyPayment(10000, 6, 0) === 0);
ok('monthlyPayment: negative input yields 0', F.monthlyPayment(-5000, 6, 12) === 0);

/* --- schedule ------------------------------------------------------------ */
const sched = F.schedule(300000, 6.375, 360);
ok('schedule: one row per month', sched.length === 360, `got ${sched.length}`);
near('schedule: final balance is zero', sched[sched.length - 1].balance, 0, 0.02);

const principalPaid = sched.reduce((a, r) => a + r.principal, 0);
const interestPaid = sched.reduce((a, r) => a + r.interest, 0);
near('schedule: principal repaid equals amount borrowed', principalPaid, 300000, 0.5);
near('schedule: interest total matches totalInterest()', interestPaid, F.totalInterest(300000, 6.375, 360), 0.5);
ok('schedule: early payments are mostly interest', sched[0].interest > sched[0].principal);
ok('schedule: late payments are mostly principal', sched[359].principal > sched[359].interest);
ok('schedule: balance decreases monotonically',
  sched.every((r, i) => i === 0 || r.balance <= sched[i - 1].balance + 0.01));
ok('schedule: zero-rate rows have no interest',
  F.schedule(1200, 0, 12).every((r) => r.interest === 0));
ok('schedule: invalid input yields no rows', F.schedule(0, 5, 12).length === 0);

/* --- totalInterest ------------------------------------------------------- */
near('totalInterest: zero rate is 0', F.totalInterest(5000, 0, 24), 0, 1e-9);
ok('totalInterest: 30-year costs more than 15-year',
  F.totalInterest(300000, 6.375, 360) > F.totalInterest(300000, 5.625, 180));

/* --- apr ----------------------------------------------------------------- */
near('apr: no fees equals the nominal rate', F.apr(20000, 7.5, 60, 0), 7.5, 1e-9);
const aprLow = F.apr(20000, 7.5, 60, 250);
const aprHigh = F.apr(20000, 7.5, 60, 900);
ok('apr: fees raise the effective rate', aprLow > 7.5, `got ${aprLow}`);
ok('apr: larger fees raise it further', aprHigh > aprLow, `${aprHigh} vs ${aprLow}`);
ok('apr: stays in a sane band', aprLow < 12 && aprHigh < 15, `${aprLow} / ${aprHigh}`);

/* --- compound / savings -------------------------------------------------- */
// A quoted APY already includes compounding, so annual compounding of an APY
// must return exactly principal x (1 + APY).
near('compound: 10k at a 4.35% APY for 1 year, compounded annually',
  F.compound(10000, 4.35, 1, 1), 10435, 0.01);
near('compound: 10k at 4.35% nominal compounded monthly',
  F.compound(10000, 4.35, 1, 12), 10443.78, 0.05);
near('compound: 10k at a 4.35% APY for 5 years',
  F.compound(10000, 4.35, 5, 1), 12372.64, 0.05);
near('savingsFutureValue: zero rate is deposits only', F.savingsFutureValue(0, 200, 0, 24), 4800, 0.01);
ok('savingsFutureValue: a rate beats no rate',
  F.savingsFutureValue(1000, 200, 4.35, 60) > F.savingsFutureValue(1000, 200, 0, 60));
near('savingsFutureValue: start only, no deposits', F.savingsFutureValue(5000, 0, 4.35, 12), 5221.9, 0.5);

/* --- monthsToGoal -------------------------------------------------------- */
near('monthsToGoal: 12k target from 0 at 1k/mo, no interest', F.monthsToGoal(12000, 0, 1000, 0), 12, 0);
ok('monthsToGoal: interest shortens the timeline',
  F.monthsToGoal(12200, 0, 1000, 4.35) < F.monthsToGoal(12200, 0, 1000, 0),
  `${F.monthsToGoal(12200, 0, 1000, 4.35)} vs ${F.monthsToGoal(12200, 0, 1000, 0)}`);
ok('monthsToGoal: already funded is 0', F.monthsToGoal(5000, 5000, 100, 4) === 0);
ok('monthsToGoal: no deposit and no growth is Infinity', F.monthsToGoal(1000, 0, 0, 0) === Infinity);

/* --- housingPayment ------------------------------------------------------ */
const hp = F.housingPayment(450000, 20, 6.375, 360, 1.05, 1800);
near('housingPayment: loan is price minus down payment', hp.loan, 360000, 0.01);
near('housingPayment: total is the sum of its parts',
  hp.total, hp.principalInterest + hp.tax + hp.insurance, 0.02);
near('housingPayment: taxes are one-twelfth of the annual bill', hp.tax, 393.75, 0.01);
near('housingPayment: insurance is one-twelfth of the annual bill', hp.insurance, 150, 0.01);
ok('housingPayment: a bigger down payment lowers the payment',
  F.housingPayment(450000, 35, 6.375, 360, 1.05, 1800).principalInterest < hp.principalInterest);

/* --- termDeposit / apyFromNominal --------------------------------------- */
near('termDeposit: 5k @ 4.6% for 12 months', F.termDeposit(5000, 4.6, 12), 5230, 0.5);
near('termDeposit: 5k @ 4.6% for 24 months', F.termDeposit(5000, 4.6, 24), 5470.58, 1);
near('apyFromNominal: 4.35% compounded monthly', F.apyFromNominal(4.35), 4.436, 0.002);
ok('apyFromNominal: effective rate exceeds nominal',
  F.apyFromNominal(4.35) > 4.35);

/* --- formatting ---------------------------------------------------------- */
ok('money: whole dollars', F.money(1234.56) === '$1,235', F.money(1234.56));
ok('money2: two decimals', F.money2(1234.5) === '$1,234.50', F.money2(1234.5));
ok('money: zero', F.money(0) === '$0', F.money(0));
ok('money: handles undefined as zero', F.money(undefined) === '$0', F.money(undefined));
ok('pct: trims trailing zeros', F.pct(4.0) === '4%', F.pct(4.0));
ok('pct: keeps significant decimals', F.pct(4.35) === '4.35%', F.pct(4.35));
ok('pctFixed: always two decimals', F.pctFixed(6.375) === '6.38%', F.pctFixed(6.375));
ok('round: two decimals by default', F.round(1.005) === 1.01, String(F.round(1.005)));
ok('clamp: bounds the value', F.clamp(12, 0, 10) === 10 && F.clamp(-3, 0, 10) === 0);

/* --- report -------------------------------------------------------------- */
console.log(`\n  finance.js — ${passed} assertions passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  console.log('');
  process.exit(1);
}
console.log('  ✓ all good\n');

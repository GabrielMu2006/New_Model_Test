#!/usr/bin/env node
/**
 * Behavioural tests for the Meridian Bank site.
 *
 *   node tools/interact.js
 *
 * Loads each page in the headless browser and drives the interactive pieces —
 * tabs, calculators, rate filters, the security checklist, form validation,
 * the sign-in flow and the application wizard — asserting on the resulting DOM.
 * Exits non-zero on any failure.
 */
'use strict';

const path = require('path');
const { ROOT, launch, newPage } = require('./cdp');

const PORT = 9500 + (process.pid % 300);
let passed = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { passed++; return; }
  failures.push(name + (detail ? ' — ' + detail : ''));
}

const q = (s) => JSON.stringify(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async function main() {
  const { cdp, cleanup } = await launch(PORT);

  async function open(file) {
    const page = await newPage(cdp, { width: 1440, height: 1000 });
    await page.goto('file://' + path.join(ROOT, file));
    return page;
  }

  const ev = (page, expr) => page.evaluate(expr);
  const click = (page, sel) => ev(page, `(function(){var el=document.querySelector(${q(sel)});if(!el)return 'missing';el.click();return 'clicked';})()`);
  const text = (page, sel) => ev(page, `(function(){var el=document.querySelector(${q(sel)});return el?el.textContent.trim():'__missing__';})()`);
  const shown = (page, sel) => ev(page, `(function(){
      var el=document.querySelector(${q(sel)});if(!el)return false;
      var cs=getComputedStyle(el);
      return cs.display!=='none' && cs.visibility!=='hidden' && el.getClientRects().length>0;})()`);
  const setVal = (page, sel, value) => ev(page, `(function(){
      var el=document.querySelector(${q(sel)});if(!el)return 'missing';
      el.value=${JSON.stringify(String(value))};
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return el.value;})()`);
  const count = (page, sel) => ev(page, `document.querySelectorAll(${q(sel)}).length`);

  /* ── Home: tabs + rotator ───────────────────────────────────────────── */
  {
    const p = await open('index.html');
    await click(p, '#tab-business');
    ok('home: business tab reveals its panel', await shown(p, '#panel-business'));
    ok('home: personal panel hides', !(await shown(p, '#panel-personal')));
    ok('home: tab is marked selected',
      (await ev(p, `document.querySelector('#tab-business').getAttribute('aria-selected')`)) === 'true');

    ok('home: first testimonial visible', await shown(p, '[data-slide]:nth-of-type(1)'));
    await click(p, '[data-dot]:nth-of-type(2)');
    ok('home: second testimonial shows after dot click', await shown(p, '[data-slide]:nth-of-type(2)'));
    ok('home: first testimonial hides', !(await shown(p, '[data-slide]:nth-of-type(1)')));
    ok('home: counter rendered a real number',
      /[\d,]/.test(await text(p, '.stats b')), await text(p, '.stats b'));
    await p.close();
  }

  /* ── Navigation: desktop dropdown + mobile drawer ───────────────────── */
  {
    const p = await open('index.html');
    ok('nav: menus start closed', !(await shown(p, '#menu-personal')));
    await click(p, '[data-menu="menu-personal"]');
    await wait(260);
    ok('nav: personal menu opens on click', await shown(p, '#menu-personal'));
    ok('nav: trigger reports expanded',
      (await ev(p, `document.querySelector('[data-menu="menu-personal"]').getAttribute('aria-expanded')`)) === 'true');
    await click(p, '.tabs__btn');
    await wait(260);
    ok('nav: clicking outside closes the menu', !(await shown(p, '#menu-personal')));
    await click(p, '[data-menu="menu-business"]');
    await wait(260);
    await ev(p, `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    await wait(260);
    ok('nav: Escape closes the menu', !(await shown(p, '#menu-business')));
    await p.close();
  }

  {
    const p = await newPage(cdp, { width: 390, height: 844, mobile: true });
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    ok('drawer: closed on load', !(await shown(p, '#drawer')));
    await click(p, '#burger');
    ok('drawer: opens from the hamburger', await shown(p, '#drawer'));
    ok('drawer: trigger reports expanded',
      (await ev(p, `document.querySelector('#burger').getAttribute('aria-expanded')`)) === 'true');
    ok('drawer: background scroll is locked',
      (await ev(p, `document.body.style.overflow`)) === 'hidden');
    await ev(p, `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    ok('drawer: Escape closes it', !(await shown(p, '#drawer')));
    ok('drawer: scroll lock released', (await ev(p, `document.body.style.overflow`)) === '');
    await p.close();
  }

  /* ── Personal: savings + CD calculators ─────────────────────────────── */
  {
    const p = await open('personal.html');
    const before = await text(p, '[data-calc="savings"] [data-out="balance"]');
    await setVal(p, '[data-calc="savings"] [data-in="monthly"]', 1000);
    const after = await text(p, '[data-calc="savings"] [data-out="balance"]');
    ok('personal: savings balance reacts to the deposit slider', before !== after, `${before} -> ${after}`);
    ok('personal: savings balance is a dollar figure', /^\$[\d,]+$/.test(after), after);
    ok('personal: chart path was drawn',
      (await ev(p, `(document.querySelector('[data-out="chartLine"]').getAttribute('d')||'').length`)) > 50);
    ok('personal: interest earned is non-zero',
      (await text(p, '[data-calc="savings"] [data-out="earned"]')) !== '$0');

    const cdBefore = await text(p, '[data-calc="cd"] [data-out="maturity"]');
    await click(p, '[data-calc="cd"] [data-in="term"] button[data-value="36"]');
    const cdAfter = await text(p, '[data-calc="cd"] [data-out="maturity"]');
    ok('personal: CD maturity changes with the term', cdBefore !== cdAfter, `${cdBefore} -> ${cdAfter}`);
    ok('personal: CD rate follows the term',
      (await ev(p, `document.querySelector('[data-calc="cd"] [data-in="apy"]').value`)) === '4.00');
    ok('personal: CD applied rate is displayed',
      (await text(p, '[data-calc="cd"] [data-out="apy"]')) === '4.00%');
    await p.close();
  }

  /* ── Loans: tabs + mortgage calculator ──────────────────────────────── */
  {
    const p = await open('loans.html');
    const before = await text(p, '[data-calc="mortgage"] [data-out="monthly"]');
    await setVal(p, '[data-calc="mortgage"] [data-in="down"]', 40);
    const after = await text(p, '[data-calc="mortgage"] [data-out="monthly"]');
    ok('loans: mortgage payment falls as the down payment rises',
      parseFloat(after.replace(/[^0-9.]/g, '')) < parseFloat(before.replace(/[^0-9.]/g, '')),
      `${before} -> ${after}`);
    ok('loans: mortgage shows an APR',
      /%/.test(await text(p, '[data-calc="mortgage"] [data-out="apr"]')));
    ok('loans: total interest is larger than zero',
      (await text(p, '[data-calc="mortgage"] [data-out="interest"]')) !== '$0');

    await click(p, '#tab-auto');
    ok('loans: auto tab reveals its panel', await shown(p, '#panel-auto'));
    const auto = await text(p, '[data-calc="loan"] [data-out="monthly"]');
    ok('loans: auto payment is a dollar figure', /^\$[\d,]+/.test(auto), auto);
    await p.close();
  }

  /* ── Rates: filter, search, sort ────────────────────────────────────── */
  {
    const p = await open('rates.html');
    const total = await count(p, 'tr[data-cat]');
    await click(p, '[data-filter="cd"]');
    const cdOnly = await ev(p, `Array.from(document.querySelectorAll('tr[data-cat]')).filter(r=>!r.hidden).length`);
    ok('rates: category filter narrows the table', cdOnly > 0 && cdOnly < total, `${cdOnly} of ${total}`);
    ok('rates: counter text updates',
      (await text(p, '[data-shown]')) === String(cdOnly), await text(p, '[data-shown]'));

    await click(p, '[data-filter="all"]');
    await setVal(p, '[data-search]', 'mortgage');
    const searched = await ev(p, `Array.from(document.querySelectorAll('tr[data-cat]')).filter(r=>!r.hidden).length`);
    ok('rates: search narrows the table', searched > 0 && searched < total, `${searched}`);

    await setVal(p, '[data-search]', 'zzzz-nothing');
    ok('rates: empty state appears', await shown(p, '[data-empty]'));
    await click(p, '[data-reset]');
    const restored = await ev(p, `Array.from(document.querySelectorAll('tr[data-cat]')).filter(r=>!r.hidden).length`);
    ok('rates: reset restores every row', restored === total, `${restored} vs ${total}`);

    await click(p, '[data-sort="rate"]');
    const first = await ev(p, `(function(){var r=Array.from(document.querySelectorAll('tr[data-cat]')).filter(x=>!x.hidden)[0];return r?r.getAttribute('data-rate'):'';})()`);
    const last = await ev(p, `(function(){var r=Array.from(document.querySelectorAll('tr[data-cat]')).filter(x=>!x.hidden);return r.length?r[r.length-1].getAttribute('data-rate'):'';})()`);
    ok('rates: sorting puts the highest rate first', parseFloat(first) >= parseFloat(last), `${first} … ${last}`);
    ok('rates: sort state is announced',
      (await ev(p, `document.querySelector('[data-sort="rate"]').getAttribute('aria-sort')`)) === 'descending');
    await p.close();
  }

  /* ── Security: checklist + validation ───────────────────────────────── */
  {
    const p = await open('security.html');
    ok('security: score starts at zero', (await text(p, '[data-score]')) === '0/8');
    await ev(p, `(function(){var b=document.querySelectorAll('[data-checklist] input');[0,1,2].forEach(function(i){b[i].click();});})()`);
    ok('security: score counts ticked items', (await text(p, '[data-score]')) === '3/8', await text(p, '[data-score]'));
    ok('security: progress bar reflects the score',
      (await ev(p, `document.querySelector('[data-score-bar]').style.width`)) === '38%');

    // Empty submit must be blocked and produce inline errors.
    await click(p, '#report form button[type="submit"]');
    ok('security: empty form is rejected', await shown(p, '[data-err-for="frName"]'));
    ok('security: success panel stays hidden', !(await shown(p, '#report [data-success]')));

    // Fill it in properly.
    await setVal(p, '#frName', 'Dana Morgan');
    await setVal(p, '#frEmail', 'not-an-email');
    await click(p, '#report form button[type="submit"]');
    ok('security: invalid email is rejected', await shown(p, '[data-err-for="frEmail"]'));

    await setVal(p, '#frEmail', 'dana@example.com');
    await setVal(p, '#frPhone', '5555550142');
    await setVal(p, '#frType', "Charge I don't recognise");
    await setVal(p, '#frDetail', 'There is a charge I do not recognise from a merchant I have never used before.');
    await ev(p, `document.querySelector('#report input[type="checkbox"]').click()`);
    await click(p, '#report form button[type="submit"]');
    ok('security: valid form shows the success panel', await shown(p, '#report [data-success]'));
    ok('security: success panel is personalised',
      (await text(p, '#report [data-fill="name"]')) === 'Dana Morgan');
    await p.close();
  }

  /* ── Login: wrong password, lockout, OTP ────────────────────────────── */
  {
    const p = await open('login.html');
    await setVal(p, '#lgUser', 'dana.morgan');
    await setVal(p, '#lgPass', 'wrong-password');
    await click(p, '[data-login-form] button[type="submit"]');
    ok('login: wrong password shows an error', await shown(p, '[data-login-error]'));
    ok('login: still on step 1', await shown(p, '[data-step="1"]'));

    await click(p, '[data-login-form] button[type="submit"]');
    await click(p, '[data-login-form] button[type="submit"]');
    ok('login: third failure locks the account', await shown(p, '[data-step="locked"]'));
    ok('login: lockout counts down', /^\d+s?$|^Try again/.test(await text(p, '[data-lock-timer]').catch(() => '')) ||
      /Try again/.test(await text(p, '[data-unlock]')));

    // Reload and use the demo credentials.
    const p2 = await open('login.html');
    await click(p2, '[data-fill-demo]');
    await click(p2, '[data-login-form] button[type="submit"]');
    ok('login: demo credentials advance to the passcode step', await shown(p2, '[data-step="2"]'));

    await setVal(p2, '#lgOtp', '000000');
    await click(p2, '[data-otp-form] button[type="submit"]');
    ok('login: wrong code is rejected', await shown(p2, '[data-otp-error]'));

    await setVal(p2, '#lgOtp', '123456');
    await click(p2, '[data-otp-form] button[type="submit"]');
    ok('login: correct code signs in', await shown(p2, '[data-step="done"]'));

    await click(p2, '[data-signout]');
    ok('login: sign out returns to step 1', await shown(p2, '[data-step="1"]'));

    await click(p2, '[data-forgot]');
    ok('login: forgot-password panel opens', await shown(p2, '[data-step="forgot"]'));
    await setVal(p2, '#lgReset', 'dana@example.com');
    await click(p2, '[data-forgot-form] button[type="submit"]');
    ok('login: reset confirmation appears', await shown(p2, '[data-reset-sent]'));

    await p.close();
    await p2.close();
  }

  /* ── Application wizard ─────────────────────────────────────────────── */
  {
    const p = await open('open-account.html');
    ok('apply: step 1 is visible', await shown(p, '[data-wpanel="1"]'));
    ok('apply: back button is hidden on step 1',
      await ev(p, `document.querySelector('[data-back]').hidden`));

    // Continue without choosing an account.
    await click(p, '[data-next]');
    ok('apply: cannot continue without choosing an account', await shown(p, '[data-wpanel="1"]'));
    ok('apply: an error message is shown', await shown(p, '[data-err-for="account"]'));

    await ev(p, `document.querySelector('input[value="Checking + Savings"]').click()`);
    await click(p, '[data-next]');
    ok('apply: advancing to step 2', await shown(p, '[data-wpanel="2"]'));
    ok('apply: progress bar advanced',
      (await ev(p, `document.querySelector('[data-progress]').style.width`)) === '50%');

    await setVal(p, '#apFirst', 'Dana');
    await setVal(p, '#apLast', 'Morgan');
    await setVal(p, '#apEmail', 'dana@example.com');
    await setVal(p, '#apPhone', '5555550142');
    await setVal(p, '#apDob', '1988-04-12');
    await setVal(p, '#apAddr', '400 Harbor Street');
    await setVal(p, '#apCity', 'Boston');
    await setVal(p, '#apState', 'MA');
    await setVal(p, '#apZip', '02210');
    await click(p, '[data-next]');
    ok('apply: advancing to step 3', await shown(p, '[data-wpanel="3"]'));

    await click(p, '[data-in="funding"] button[data-value="250"]');
    await setVal(p, '#apMethod', 'Transfer from another bank (ACH)');
    await click(p, '[data-next]');
    ok('apply: advancing to review', await shown(p, '[data-wpanel="4"]'));
    ok('apply: review lists the chosen account',
      (await text(p, '[data-summary]')).includes('Checking + Savings'));
    ok('apply: review lists the address',
      (await text(p, '[data-summary]')).includes('400 Harbor Street, Boston, MA, 02210'),
      await text(p, '[data-summary]'));
    ok('apply: review shows the opening deposit',
      (await text(p, '[data-summary]')).includes('$250'));

    await click(p, '[data-submit]');
    ok('apply: submit is blocked until the terms are accepted',
      await shown(p, '[data-wpanel="4"]'));

    await ev(p, `document.querySelector('[data-wizard] input[name="terms"]').click()`);
    await click(p, '[data-submit]');
    ok('apply: confirmation panel appears', await shown(p, '[data-success]'));
    ok('apply: confirmation uses the applicant name',
      (await text(p, '[data-success] [data-fill="first"]')) === 'Dana');
    ok('apply: confirmation shows a reference number',
      /^MB-\d{4}-\d{6}$/.test(await text(p, '[data-success] [data-fill="reference"]')),
      await text(p, '[data-success] [data-fill="reference"]'));
    await p.close();
  }

  /* ── Help: branch filter ────────────────────────────────────────────── */
  {
    const p = await open('help.html');
    const total = await count(p, '[data-filter-item]');
    await setVal(p, '#branchSearch', 'boston');
    const hits = await ev(p, `Array.from(document.querySelectorAll('[data-filter-item]')).filter(i=>!i.hidden).length`);
    ok('help: branch search narrows the list', hits > 0 && hits < total, `${hits} of ${total}`);
    ok('help: count output updates', (await text(p, '[data-filterlist-count]')) === String(hits));
    await setVal(p, '#branchSearch', 'nowhere-at-all');
    ok('help: empty state appears', await shown(p, '[data-filterlist-empty]'));
    await p.close();
  }

  cleanup();
  console.log(`\n  ${passed} assertions passed, ${failures.length} failed\n`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    console.log('');
    process.exit(1);
  }
  console.log('  ✓ every interaction behaves as expected\n');
})().catch((err) => {
  console.error('interaction tests failed:', err.stack || err.message);
  process.exit(2);
});

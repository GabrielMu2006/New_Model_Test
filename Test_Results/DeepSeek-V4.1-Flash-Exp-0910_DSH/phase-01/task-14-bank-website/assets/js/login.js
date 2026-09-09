/* ==========================================================================
   Meridian Bank — demo sign-in flow
   A three-state machine (credentials → one-time passcode → signed in) plus a
   password-reset branch and an attempt limiter that locks the profile. All of
   it is client-side theatre: nothing is transmitted anywhere.
   ========================================================================== */
(function () {
  'use strict';

  var DEMO_USER = 'dana.morgan';
  var DEMO_PASS = 'meridian-demo';
  var DEMO_OTP = '123456';
  var MAX_ATTEMPTS = 3;
  var LOCK_SECONDS = 60;

  var root = document.querySelector('.auth__card');
  if (!root) return;

  var $ = function (sel, r) { return (r || root).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || root).querySelectorAll(sel)); };

  var steps = $$('[data-step]');
  var attempts = 0;
  var lockTimer = null;

  var yearEl = document.getElementById('authYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function show(name) {
    steps.forEach(function (panel) {
      var active = panel.getAttribute('data-step') === name;
      panel.hidden = !active;
      if (active) {
        var heading = panel.querySelector('h2, h1');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
      }
    });
    var errors = $$('[data-login-error], [data-otp-error]');
    errors.forEach(function (e) { e.hidden = true; });
  }

  function showError(node, message) {
    if (!node) return;
    node.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg><span>' + message + '</span>';
    node.hidden = false;
  }

  /* --- 1. credentials ---------------------------------------------------- */
  var loginForm = $('[data-login-form]');
  var loginError = $('[data-login-error]');

  if (loginForm) {
    loginForm.addEventListener('meridian:submit', function (e) {
      var data = e.detail;
      if (data.username.trim().toLowerCase() !== DEMO_USER || data.password !== DEMO_PASS) {
        attempts++;
        var left = MAX_ATTEMPTS - attempts;
        if (attempts >= MAX_ATTEMPTS) {
          lock();
          return;
        }
        showError(loginError, 'That username or password doesn\u2019t match. ' +
          (left === 1 ? 'One more attempt before we lock the account.' : left + ' attempts left.'));
        var pass = $('#lgPass');
        if (pass) { pass.select(); }
        return;
      }
      attempts = 0;
      if (loginError) loginError.hidden = true;
      show('2');
      var otp = $('#lgOtp');
      if (otp) { otp.value = ''; otp.focus(); }
    });
  }

  /* --- 2. one-time passcode --------------------------------------------- */
  var otpForm = $('[data-otp-form]');
  var otpError = $('[data-otp-error]');

  if (otpForm) {
    otpForm.addEventListener('meridian:submit', function (e) {
      if (e.detail.otp !== DEMO_OTP) {
        showError(otpError, 'That code isn\u2019t right. Check the last message we sent and try again.');
        var otp = $('#lgOtp');
        if (otp) { otp.select(); }
        return;
      }
      show('done');
    });
  }

  /* --- 3. lockout -------------------------------------------------------- */
  var unlockBtn = $('[data-unlock]');

  function lock() {
    show('locked');
    var remaining = LOCK_SECONDS;
    if (unlockBtn) unlockBtn.disabled = true;

    var tick = function () {
      $$('[data-lock-timer]').forEach(function (el) { el.textContent = String(remaining); });
      if (unlockBtn) {
        unlockBtn.innerHTML = 'Try again in <span data-lock-timer>' + remaining + 's</span>';
      }
      if (remaining <= 0) {
        clearInterval(lockTimer);
        lockTimer = null;
        attempts = 0;
        if (unlockBtn) { unlockBtn.disabled = false; unlockBtn.textContent = 'Try again'; }
        return;
      }
      remaining--;
    };

    clearInterval(lockTimer);
    tick();
    lockTimer = setInterval(tick, 1000);
  }

  if (unlockBtn) {
    unlockBtn.addEventListener('click', function () {
      if (unlockBtn.disabled) return;
      show('1');
      var user = $('#lgUser');
      if (user) user.focus();
    });
  }

  /* --- helpers ----------------------------------------------------------- */
  var toggle = $('[data-toggle-pass]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var input = $('#lgPass');
      if (!input) return;
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus();
    });
  }

  var fillDemo = $('[data-fill-demo]');
  if (fillDemo) {
    fillDemo.addEventListener('click', function () {
      var user = $('#lgUser');
      var pass = $('#lgPass');
      if (user) user.value = DEMO_USER;
      if (pass) pass.value = DEMO_PASS;
      if (loginError) loginError.hidden = true;
      if (pass) pass.focus();
    });
  }

  $$('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', function () { show('1'); });
  });

  var resend = $('[data-resend]');
  if (resend) {
    resend.addEventListener('click', function () {
      resend.textContent = 'Code sent';
      resend.disabled = true;
      setTimeout(function () {
        resend.textContent = 'Resend code';
        resend.disabled = false;
      }, 5000);
    });
  }

  var forgot = $('[data-forgot]');
  if (forgot) forgot.addEventListener('click', function () { show('forgot'); });

  var forgotForm = $('[data-forgot-form]');
  if (forgotForm) {
    forgotForm.addEventListener('meridian:submit', function () {
      forgotForm.hidden = true;
      var sent = $('[data-reset-sent]');
      if (sent) {
        sent.hidden = false;
        sent.setAttribute('tabindex', '-1');
        sent.focus();
      }
    });
  }

  var signout = $('[data-signout]');
  if (signout) {
    signout.addEventListener('click', function () {
      var form = $('[data-login-form]');
      if (form) {
        form.reset();
        form.hidden = false;
      }
      var sent = $('[data-reset-sent]');
      if (sent) sent.hidden = true;
      show('1');
    });
  }

  show('1');
})();

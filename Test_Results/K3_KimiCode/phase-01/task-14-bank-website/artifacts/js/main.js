/* Meridian Bank — site behaviour. Vanilla JS, no dependencies.
   All data is fictional and lives only in the browser. */
(function () {
  "use strict";

  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
      }
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Toast helper ---------- */
  var toastEl = null;
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3600);
  }

  /* ---------- Savings calculator (home) ---------- */
  var savingsForm = document.getElementById("savings-calc");
  if (savingsForm) {
    var sInitial = document.getElementById("s-initial");
    var sMonthly = document.getElementById("s-monthly");
    var sApy = document.getElementById("s-apy");
    var sYears = document.getElementById("s-years");
    var sYearsOut = document.getElementById("s-years-out");
    var sTotal = document.getElementById("s-total");
    var sContrib = document.getElementById("s-contrib");
    var sInterest = document.getElementById("s-interest");
    var sBars = document.getElementById("s-bars");

    function renderSavings() {
      var initial = Math.max(0, Number(sInitial.value) || 0);
      var monthly = Math.max(0, Number(sMonthly.value) || 0);
      var apy = Math.max(0, Number(sApy.value) || 0) / 100;
      var years = Math.max(1, Number(sYears.value) || 1);
      sYearsOut.textContent = years + (years === 1 ? " year" : " years");

      // Monthly compounding at the stated APY.
      var rate = Math.pow(1 + apy, 1 / 12) - 1;
      var balance = initial;
      var yearly = [];
      for (var m = 1; m <= years * 12; m++) {
        balance = balance * (1 + rate) + monthly;
        if (m % 12 === 0) yearly.push(balance);
      }
      var contributed = initial + monthly * years * 12;
      var interest = balance - contributed;

      sTotal.textContent = money.format(balance);
      sContrib.textContent = money.format(contributed);
      sInterest.textContent = money.format(Math.max(0, interest));

      if (sBars) {
        sBars.innerHTML = "";
        var max = yearly[yearly.length - 1] || 1;
        yearly.forEach(function (value) {
          var bar = document.createElement("span");
          bar.style.height = Math.max(3, (value / max) * 100) + "%";
          bar.title = money.format(value);
          sBars.appendChild(bar);
        });
      }
    }

    ["input", "change"].forEach(function (evt) {
      savingsForm.addEventListener(evt, renderSavings);
    });
    renderSavings();
  }

  /* ---------- Loan calculator (loans page) ---------- */
  var loanForm = document.getElementById("loan-calc");
  if (loanForm) {
    var lAmount = document.getElementById("l-amount");
    var lApr = document.getElementById("l-apr");
    var lTerm = document.getElementById("l-term");
    var lTermOut = document.getElementById("l-term-out");
    var lPayment = document.getElementById("l-payment");
    var lInterest = document.getElementById("l-interest-total");
    var lCost = document.getElementById("l-cost-total");

    function renderLoan() {
      var principal = Math.max(0, Number(lAmount.value) || 0);
      var apr = Math.max(0, Number(lApr.value) || 0) / 100;
      var years = Math.max(1, Number(lTerm.value) || 1);
      var n = years * 12;
      lTermOut.textContent = years + (years === 1 ? " year" : " years");

      var r = apr / 12;
      var payment = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      var total = payment * n;
      var interest = total - principal;

      lPayment.textContent = money.format(payment || 0);
      lInterest.textContent = money.format(Math.max(0, interest));
      lCost.textContent = money.format(total || 0);
    }

    ["input", "change"].forEach(function (evt) {
      loanForm.addEventListener(evt, renderLoan);
    });
    renderLoan();
  }

  /* ---------- Field validation helper ---------- */
  function validateField(field) {
    var wrap = field.closest(".form-field");
    if (!wrap) return true;
    var value = field.value.trim();
    var ok = true;
    if (field.hasAttribute("required") && value === "") ok = false;
    if (ok && field.type === "email" && value !== "") {
      ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    }
    if (ok && field.dataset.minlength) {
      ok = value.length >= Number(field.dataset.minlength);
    }
    wrap.classList.toggle("invalid", !ok);
    return ok;
  }

  /* ---------- Contact form ---------- */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    var fields = contactForm.querySelectorAll("input, select, textarea");
    fields.forEach(function (field) {
      field.addEventListener("blur", function () { validateField(field); });
      field.addEventListener("input", function () {
        var wrap = field.closest(".form-field");
        if (wrap && wrap.classList.contains("invalid")) validateField(field);
      });
    });
    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var allOk = true;
      fields.forEach(function (field) {
        if (!validateField(field)) allOk = false;
      });
      if (!allOk) {
        var firstBad = contactForm.querySelector(".form-field.invalid input, .form-field.invalid select, .form-field.invalid textarea");
        if (firstBad) firstBad.focus();
        return;
      }
      contactForm.reset();
      contactForm.querySelectorAll(".form-field.invalid").forEach(function (el) { el.classList.remove("invalid"); });
      var success = document.getElementById("contact-success");
      if (success) {
        success.classList.add("show");
        success.focus();
      }
    });
  }

  /* ---------- Demo sign-in ---------- */
  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var user = document.getElementById("login-user").value.trim();
      var pass = document.getElementById("login-pass").value;
      var userOk = user.length >= 3;
      var passOk = pass.length >= 4;
      document.getElementById("login-user").closest(".form-field").classList.toggle("invalid", !userOk);
      document.getElementById("login-pass").closest(".form-field").classList.toggle("invalid", !passOk);
      if (!userOk || !passOk) return;
      sessionStorage.setItem("meridianDemoUser", user);
      window.location.href = "dashboard.html";
    });
  }

  /* ---------- Demo dashboard ---------- */
  var dash = document.getElementById("dashboard");
  if (dash) {
    var userName = sessionStorage.getItem("meridianDemoUser");
    if (!userName) {
      window.location.replace("login.html");
      return;
    }
    var hello = document.getElementById("dash-hello");
    if (hello) hello.textContent = "Welcome back, " + userName;

    var accounts = [
      { id: "chk", el: document.getElementById("bal-chk"), balance: 4280.55 },
      { id: "sav", el: document.getElementById("bal-sav"), balance: 18942.10 },
      { id: "crd", el: document.getElementById("bal-crd"), balance: -1203.44 }
    ];
    function renderBalances() {
      accounts.forEach(function (acct) {
        if (acct.el) acct.el.textContent = money.format(acct.balance);
      });
    }
    renderBalances();

    var txnBody = document.getElementById("txn-body");
    function addTxn(date, description, amount) {
      if (!txnBody) return;
      var row = document.createElement("tr");
      var d1 = document.createElement("td"); d1.textContent = date;
      var d2 = document.createElement("td"); d2.textContent = description;
      var d3 = document.createElement("td");
      d3.className = "num " + (amount >= 0 ? "pos" : "neg");
      d3.textContent = (amount >= 0 ? "+" : "−") + money.format(Math.abs(amount));
      row.appendChild(d1); row.appendChild(d2); row.appendChild(d3);
      txnBody.insertBefore(row, txnBody.firstChild);
    }

    var transferForm = document.getElementById("transfer-form");
    if (transferForm) {
      transferForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var fromId = document.getElementById("t-from").value;
        var toId = document.getElementById("t-to").value;
        var amountField = document.getElementById("t-amount");
        var amount = Math.round(Number(amountField.value) * 100) / 100;
        var wrap = amountField.closest(".form-field");
        var err = wrap.querySelector(".field-error");

        var from = accounts.find(function (a) { return a.id === fromId; });
        var to = accounts.find(function (a) { return a.id === toId; });
        var ok = true;
        if (!from || !to || from.id === to.id) {
          ok = false;
          err.textContent = "Choose two different accounts.";
        } else if (!(amount > 0)) {
          ok = false;
          err.textContent = "Enter an amount greater than $0.";
        } else if (amount > from.balance) {
          ok = false;
          err.textContent = "Amount exceeds the available balance of the source account.";
        }
        wrap.classList.toggle("invalid", !ok);
        if (!ok) return;

        from.balance -= amount;
        to.balance += amount;
        renderBalances();
        var today = new Date();
        var dateStr = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        addTxn(dateStr, "Demo transfer to " + to.id.toUpperCase(), -amount);
        wrap.classList.remove("invalid");
        transferForm.reset();
        toast("Demo transfer of " + money.format(amount) + " completed. No real money moved.");
      });
    }

    var logout = document.getElementById("logout-btn");
    if (logout) {
      logout.addEventListener("click", function () {
        sessionStorage.removeItem("meridianDemoUser");
        window.location.href = "login.html";
      });
    }
  }
})();

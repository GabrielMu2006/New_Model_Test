/*
 * Calculator core logic — pure state machine, no DOM access.
 * Works in the browser (window.CalculatorCore) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CalculatorCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_DIGITS = 12;

  function formatNumber(value) {
    if (!isFinite(value)) return "Error";
    if (value === 0) return "0";
    var abs = Math.abs(value);
    if (abs >= 1e12 || abs < 1e-9) {
      var exp = value.toExponential(7);
      // Trim trailing zeros in the mantissa: "1.2300000e+15" -> "1.23e+15"
      exp = exp.replace(/\.?0+e/, "e");
      return exp;
    }
    // Round to 10 significant decimals to hide float noise (0.1+0.2), then trim.
    var rounded = parseFloat(value.toPrecision(10));
    var str = String(rounded);
    if (str.length > 14) {
      str = String(parseFloat(rounded.toPrecision(10)));
    }
    return str;
  }

  function applyOperator(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷":
        if (b === 0) return NaN;
        return a / b;
      default: return b;
    }
  }

  function Calculator() {
    this.reset();
  }

  Calculator.prototype.reset = function () {
    this.display = "0";        // current entry shown on screen
    this.accumulator = null;   // stored left operand
    this.pendingOp = null;     // operator waiting for right operand
    this.waitingForOperand = false; // next digit starts a new entry
    this.lastOp = null;        // for repeated "="
    this.lastOperand = null;
    this.error = false;
  };

  Calculator.prototype._setError = function () {
    this.error = true;
    this.display = "Error";
    this.accumulator = null;
    this.pendingOp = null;
    this.waitingForOperand = true;
  };

  Calculator.prototype.inputDigit = function (d) {
    if (this.error) this.reset();
    if (this.waitingForOperand) {
      this.display = d;
      this.waitingForOperand = false;
      return;
    }
    var digitsOnly = this.display.replace(/[^0-9]/g, "");
    if (digitsOnly.length >= MAX_DIGITS) return;
    this.display = this.display === "0" ? d : this.display + d;
  };

  Calculator.prototype.inputDot = function () {
    if (this.error) this.reset();
    if (this.waitingForOperand) {
      this.display = "0.";
      this.waitingForOperand = false;
      return;
    }
    if (this.display.indexOf(".") === -1) {
      this.display += ".";
    }
  };

  Calculator.prototype.setOperator = function (op) {
    if (this.error) return;
    var current = parseFloat(this.display);

    if (this.pendingOp !== null && !this.waitingForOperand) {
      // Chain: resolve pending operation first (e.g. 2 + 3 + 4 -> shows 5)
      var result = applyOperator(this.accumulator, current, this.pendingOp);
      if (!isFinite(result) || isNaN(result)) {
        this._setError();
        return;
      }
      this.accumulator = result;
      this.display = formatNumber(result);
    } else if (this.accumulator === null || this.waitingForOperand === false) {
      this.accumulator = current;
    }
    // If waitingForOperand (user pressed two operators in a row), just swap op.

    this.pendingOp = op;
    this.waitingForOperand = true;
    this.lastOp = null;
    this.lastOperand = null;
  };

  Calculator.prototype.equals = function () {
    if (this.error) return;
    var current = parseFloat(this.display);

    if (this.pendingOp !== null) {
      var result = applyOperator(this.accumulator, current, this.pendingOp);
      this.lastOp = this.pendingOp;
      this.lastOperand = current;
      this.pendingOp = null;
      this.accumulator = null;
      if (!isFinite(result) || isNaN(result)) {
        this._setError();
        return;
      }
      this.display = formatNumber(result);
      this.waitingForOperand = true;
    } else if (this.lastOp !== null) {
      // Pressing "=" again repeats the last operation: 2 + 3 = = = -> 5, 8, 11
      var repeated = applyOperator(current, this.lastOperand, this.lastOp);
      if (!isFinite(repeated) || isNaN(repeated)) {
        this._setError();
        return;
      }
      this.display = formatNumber(repeated);
      this.waitingForOperand = true;
    }
  };

  Calculator.prototype.backspace = function () {
    if (this.error) {
      this.reset();
      return;
    }
    if (this.waitingForOperand) return;
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : "0";
    if (this.display === "-" || this.display === "") this.display = "0";
  };

  Calculator.prototype.toggleSign = function () {
    if (this.error || this.display === "0") return;
    this.display = this.display.charAt(0) === "-"
      ? this.display.slice(1)
      : "-" + this.display;
  };

  Calculator.prototype.percent = function () {
    if (this.error) return;
    var value = parseFloat(this.display) / 100;
    this.display = formatNumber(value);
  };

  Calculator.prototype.getDisplay = function () {
    return this.display;
  };

  // Exposed for tests
  Calculator.formatNumber = formatNumber;
  Calculator.applyOperator = applyOperator;

  return Calculator;
});

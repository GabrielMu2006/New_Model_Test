/* Browser wiring: buttons + keyboard -> CalculatorCore -> display. */
(function () {
  "use strict";

  var calc = new CalculatorCore();
  var displayEl = document.getElementById("display");

  function render() {
    var text = calc.getDisplay();
    displayEl.textContent = text;
    displayEl.classList.toggle("error", text === "Error");
  }

  function handle(action, value) {
    switch (action) {
      case "digit": calc.inputDigit(value); break;
      case "dot": calc.inputDot(); break;
      case "op": calc.setOperator(value); break;
      case "equals": calc.equals(); break;
      case "clear": calc.reset(); break;
      case "toggle-sign": calc.toggleSign(); break;
      case "percent": calc.percent(); break;
      case "backspace": calc.backspace(); break;
    }
    render();
  }

  document.querySelectorAll(".key").forEach(function (btn) {
    btn.addEventListener("click", function () {
      handle(btn.dataset.action, btn.dataset.value);
    });
  });

  var KEY_MAP = {
    "+": ["op", "+"],
    "-": ["op", "-"],
    "*": ["op", "×"],
    "x": ["op", "×"],
    "/": ["op", "÷"],
    "Enter": ["equals"],
    "=": ["equals"],
    "Backspace": ["backspace"],
    "Escape": ["clear"],
    "c": ["clear"],
    ".": ["dot"],
    "%": ["percent"]
  };

  document.addEventListener("keydown", function (e) {
    if (/^[0-9]$/.test(e.key)) {
      handle("digit", e.key);
      return;
    }
    var mapped = KEY_MAP[e.key];
    if (mapped) {
      e.preventDefault();
      handle(mapped[0], mapped[1]);
    }
  });

  render();
})();

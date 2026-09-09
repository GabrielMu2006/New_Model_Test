import { evaluateFormatted } from "./calculator.js";

const displayEl = document.getElementById("display");
const exprEl = document.getElementById("expression");
const historyEl = document.getElementById("history");

let expr = "";
let justEvaluated = false;

function render(error = "") {
  if (error) {
    displayEl.textContent = error;
    displayEl.classList.add("error");
  } else {
    displayEl.textContent = currentEntry() || "0";
    displayEl.classList.remove("error");
  }
  exprEl.textContent = expr;
}

function currentEntry() {
  // text after last operator/paren boundary for display purposes -> show full expr tail
  // Simpler: show last number being typed, else full expr, else 0
  if (justEvaluated) {
    // expr holds "a+b" after equals? No: after equals expr stays, display shows result.
    // We store lastResult separately via display text.
    return displayEl.classList.contains("error") ? "" : displayEl.textContent;
  }
  return expr || "";
}

function inputDigit(d) {
  if (justEvaluated) { expr = ""; justEvaluated = false; historyEl.textContent = ""; }
  displayEl.classList.remove("error");
  expr += d;
  render();
}

function inputOp(op) {
  // fresh start after an error (e.g. "1/0" -> Error): don't append to stale expr
  if (displayEl.classList.contains("error")) { expr = ""; justEvaluated = false; displayEl.classList.remove("error"); }
  else displayEl.classList.remove("error");
  if (justEvaluated) justEvaluated = false;
  if (expr === "" && (op === "-" || op === "(")) { expr += op; render(); return; }
  if (expr === "" && op !== "(") return; // ignore leading binary op
  // disallow binary operator directly after "(" (except unary minus / nested paren)
  if (expr.endsWith("(") && "+-*/^)".includes(op) && op !== "-") return;
  // replace trailing binary operator with new one (avoid "5++")
  if (/[+\-*/^(]$/.test(expr) && "+-*/^".includes(op)) {
    // allow "(-" sequence: don't replace '('
    if (!expr.endsWith("(")) expr = expr.slice(0, -1);
  }
  expr += op;
  render();
}

function inputDecimal() {
  if (displayEl.classList.contains("error") || justEvaluated) { expr = ""; justEvaluated = false; displayEl.classList.remove("error"); }
  const m = expr.match(/(\d*\.?\d*)$/);
  if (m && m[1].includes(".")) return; // current number already has dot
  expr += (m && /\d$/.test(expr)) ? "." : "0.";
  render();
}

function doEquals() {
  if (!expr) return;
  try {
    const result = evaluateFormatted(expr);
    historyEl.textContent = expr + " =";
    exprEl.textContent = expr + " =";
    displayEl.textContent = result;
    displayEl.classList.remove("error");
    expr = result; // allow chaining
    justEvaluated = true;
  } catch (e) {
    displayEl.textContent = e.message === "Division by zero" ? "Error: Division by zero" : "Error";
    displayEl.classList.add("error");
    justEvaluated = true;
  }
}

function clearAll() { expr = ""; historyEl.textContent = ""; displayEl.classList.remove("error"); justEvaluated = false; render(); }
function clearEntry() {
  displayEl.classList.remove("error");
  if (justEvaluated) { clearAll(); return; }
  const m = expr.match(/(.*?)([0-9.]+|\)?)$/);
  // remove trailing number
  const numMatch = expr.match(/[0-9.]+$/);
  if (numMatch) expr = expr.slice(0, -numMatch[0].length);
  else expr = expr.slice(0, -1);
  render();
}
function backspace() {
  if (justEvaluated) { clearAll(); return; }
  expr = expr.slice(0, -1);
  render();
}
function negate() {
  if (justEvaluated) {
    expr = displayEl.classList.contains("error") ? "" : displayEl.textContent;
    justEvaluated = false;
  }
  const m = expr.match(/(-?\d*\.?\d*)$/);
  if (m && m[1] !== "") {
    const n = m[1];
    expr = expr.slice(0, -n.length) + (n.startsWith("-") ? n.slice(1) : "-" + n);
  } else if (expr.endsWith(")")) {
    expr = "-(" + expr + ")"; // fallback, will still evaluate via unary minus? "-(" handled as u- then paren
    // Actually "-(...)" tokenizes as u- + paren, valid.
  } else {
    expr += "-";
  }
  render();
}
function percent() {
  if (displayEl.classList.contains("error")) return;
  const m = expr.match(/(\d*\.?\d*)$/);
  if (!m || m[1] === "") return;
  const v = parseFloat(m[1]) / 100;
  expr = expr.slice(0, -m[1].length) + String(v);
  render();
}

document.querySelectorAll("[data-digit]").forEach(b =>
  b.addEventListener("click", () => inputDigit(b.dataset.digit)));
document.querySelectorAll("[data-op]").forEach(b =>
  b.addEventListener("click", () => inputOp(b.dataset.op)));
document.querySelector('[data-action="decimal"]').addEventListener("click", inputDecimal);
document.querySelector('[data-action="equals"]').addEventListener("click", doEquals);
document.querySelector('[data-action="clear-all"]').addEventListener("click", clearAll);
document.querySelector('[data-action="clear-entry"]').addEventListener("click", clearEntry);
document.querySelector('[data-action="backspace"]').addEventListener("click", backspace);
document.querySelector('[data-action="negate"]').addEventListener("click", negate);
document.querySelector('[data-action="percent"]').addEventListener("click", percent);

document.addEventListener("keydown", (e) => {
  if (/^[0-9]$/.test(e.key)) inputDigit(e.key);
  else if (["+", "-", "*", "/", "^", "(", ")"].includes(e.key)) inputOp(e.key);
  else if (e.key === ".") inputDecimal();
  else if (e.key === "%") percent();
  else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); doEquals(); }
  else if (e.key === "Backspace") backspace();
  else if (e.key === "Escape") clearAll();
  else if (e.key.toLowerCase() === "c") clearEntry();
});

render();

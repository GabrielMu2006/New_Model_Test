/* Node test suite for the calculator. Run: node test.js */
"use strict";

const fs = require("fs");
const path = require("path");
const Calculator = require("./calculator.js");

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  PASS " + name);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log("  FAIL " + name + " — " + err.message);
  }
}

function assertEqual(actual, expected, what) {
  if (actual !== expected) {
    throw new Error((what || "value") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

// Helper: run a script of inputs like ["1","2","+","3","="] and return display.
function run(inputs) {
  const c = new Calculator();
  for (const token of inputs) {
    if (/^[0-9]$/.test(token)) c.inputDigit(token);
    else if (token === ".") c.inputDot();
    else if (["+", "-", "×", "÷"].includes(token)) c.setOperator(token);
    else if (token === "=") c.equals();
    else if (token === "C") c.reset();
    else if (token === "B") c.backspace();
    else if (token === "±") c.toggleSign();
    else if (token === "%") c.percent();
    else throw new Error("unknown token " + token);
  }
  return c.getDisplay();
}

console.log("\nCore arithmetic");
test("1 + 2 = 3", () => assertEqual(run(["1", "+", "2", "="]), "3"));
test("7 - 10 = -3", () => assertEqual(run(["7", "-", "1", "0", "="]), "-3"));
test("6 × 7 = 42", () => assertEqual(run(["6", "×", "7", "="]), "42"));
test("8 ÷ 2 = 4", () => assertEqual(run(["8", "÷", "2", "="]), "4"));
test("multi-digit entry 123 + 456 = 579", () =>
  assertEqual(run(["1", "2", "3", "+", "4", "5", "6", "="]), "579"));

console.log("\nDecimals and float noise");
test("0.1 + 0.2 = 0.3 (no 0.30000000000000004)", () =>
  assertEqual(run(["0", ".", "1", "+", "0", ".", "2", "="]), "0.3"));
test("1.5 × 2 = 3", () => assertEqual(run(["1", ".", "5", "×", "2", "="]), "3"));
test("dot on fresh operand yields 0.x", () => assertEqual(run([".", "5"]), "0.5"));
test("second dot ignored", () => assertEqual(run(["1", ".", "2", ".", "3"]), "1.23"));

console.log("\nChained operations");
test("2 + 3 + 4 = 9 (intermediate shows 5)", () => {
  const c = new Calculator();
  ["2", "+"].forEach((t) => (/^[0-9]$/.test(t) ? c.inputDigit(t) : c.setOperator(t)));
  c.inputDigit("3");
  c.setOperator("+");
  assertEqual(c.getDisplay(), "5", "intermediate");
  c.inputDigit("4");
  c.equals();
  assertEqual(c.getDisplay(), "9", "final");
});
test("2 + 3 × 4 = 20 (left-to-right, standard calculator)", () =>
  assertEqual(run(["2", "+", "3", "×", "4", "="]), "20"));
test("operator swap: 2 + - 3 = -1", () => assertEqual(run(["2", "+", "-", "3", "="]), "-1"));

console.log("\nEquals repeat");
test("2 + 3 = = = gives 5, 8, 11", () => {
  const c = new Calculator();
  c.inputDigit("2"); c.setOperator("+"); c.inputDigit("3");
  c.equals(); assertEqual(c.getDisplay(), "5");
  c.equals(); assertEqual(c.getDisplay(), "8");
  c.equals(); assertEqual(c.getDisplay(), "11");
});

console.log("\nError handling");
test("division by zero shows Error", () => assertEqual(run(["5", "÷", "0", "="]), "Error"));
test("0 ÷ 0 shows Error", () => assertEqual(run(["0", "÷", "0", "="]), "Error"));
test("digit after Error recovers", () => {
  const c = new Calculator();
  c.inputDigit("5"); c.setOperator("÷"); c.inputDigit("0"); c.equals();
  assertEqual(c.getDisplay(), "Error");
  c.inputDigit("7");
  assertEqual(c.getDisplay(), "7");
});
test("C clears after Error", () => {
  const c = new Calculator();
  c.inputDigit("5"); c.setOperator("÷"); c.inputDigit("0"); c.equals();
  c.reset();
  assertEqual(c.getDisplay(), "0");
});

console.log("\nEditing keys");
test("backspace 123 -> 12", () => assertEqual(run(["1", "2", "3", "B"]), "12"));
test("backspace to empty -> 0", () => assertEqual(run(["5", "B"]), "0"));
test("toggle sign 5 -> -5 -> 5", () => {
  assertEqual(run(["5", "±"]), "-5");
  assertEqual(run(["5", "±", "±"]), "5");
});
test("toggle sign on 0 stays 0", () => assertEqual(run(["0", "±"]), "0"));
test("percent 50% = 0.5", () => assertEqual(run(["5", "0", "%"]), "0.5"));
test("clear resets mid-calc", () => assertEqual(run(["9", "+", "9", "C", "2"]), "2"));

console.log("\nLimits and edge cases");
test("leading zero replaced", () => assertEqual(run(["0", "0", "5"]), "5"));
test("digit entry capped at 12 digits", () =>
  assertEqual(run(["1","1","1","1","1","1","1","1","1","1","1","1","1","1"]), "111111111111"));
test("large result uses exponent", () => {
  // 999999999999² = 9.99999999998e+23, which rounds to 1e+24 at 10 sig digits.
  const out = run(["9","9","9","9","9","9","9","9","9","9","9","9","×","9","9","9","9","9","9","9","9","9","9","9","9","="]);
  if (!/^\d(\.\d+)?e\+\d+$/.test(out)) throw new Error("expected exponent form, got " + out);
});
test("equals with no operation is a no-op", () => assertEqual(run(["5", "="]), "5"));
test("equals right after operator uses stored operand (5 + = -> 10)", () =>
  assertEqual(run(["5", "+", "="]), "10"));

console.log("\nHTML/app.js contract");
test("every button action in index.html is handled in app.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  const actions = new Set();
  for (const m of html.matchAll(/data-action="([^"]+)"/g)) actions.add(m[1]);
  if (actions.size === 0) throw new Error("no data-action attributes found in HTML");
  for (const action of actions) {
    if (!app.includes('"' + action + '"')) {
      throw new Error('action "' + action + '" has no handler in app.js');
    }
  }
});
test("index.html loads calculator.js before app.js and has #display", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  if (!html.includes('id="display"')) throw new Error("missing #display element");
  const coreIdx = html.indexOf('src="calculator.js"');
  const appIdx = html.indexOf('src="app.js"');
  if (coreIdx === -1 || appIdx === -1 || coreIdx > appIdx) {
    throw new Error("scripts missing or in wrong order");
  }
});
test("all digit buttons 0-9 present", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  for (let d = 0; d <= 9; d++) {
    if (!html.includes('data-action="digit" data-value="' + d + '"')) {
      throw new Error("missing digit button " + d);
    }
  }
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);

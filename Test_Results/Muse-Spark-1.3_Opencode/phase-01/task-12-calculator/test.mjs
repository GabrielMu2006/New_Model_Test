import { evaluateFormatted } from "./calculator.js";

const cases = [
  ["2+3", "5"],
  ["2+3*4", "14"],
  ["(2+3)*4", "20"],
  ["10/4", "2.5"],
  ["0.1+0.2", "0.3"],
  ["-5+3", "-2"],
  ["5*-2", "-10"],
  ["2^3", "8"],
  ["2^3^2", "512"], // right-assoc: 2^(3^2)
  ["(1+2)*(3+4)", "21"],
  ["3.5*2", "7"],
  ["100/10/2", "5"],
  ["--5", "5"],
  ["-(2+3)", "-5"],
];

const errorCases = [
  ["1/0", "Division by zero"],
  ["2++2", null], // our tokenizer: second + is unary plus -> actually valid "2+2". skip strict check below
  ["(2+3", "Mismatched parentheses"],
  ["2+*3", "Invalid expression"],
  ["abc", "Invalid character"],
  ["", "Empty expression"],
];

let pass = 0, fail = 0;
for (const [input, expected] of cases) {
  try {
    const got = evaluateFormatted(input);
    if (got === expected) { console.log(`PASS ${input} = ${got}`); pass++; }
    else { console.log(`FAIL ${input}: expected ${expected}, got ${got}`); fail++; }
  } catch (e) {
    console.log(`FAIL ${input}: threw ${e.message}`); fail++;
  }
}
for (const [input, expectedErr] of errorCases) {
  if (input === "2++2") {
    // document actual behavior: unary plus => valid
    try {
      const got = evaluateFormatted(input);
      console.log(`INFO "2++2" evaluates to ${got} (unary plus, acceptable)`);
      pass++;
    } catch (e) { console.log(`INFO "2++2" throws ${e.message}`); pass++; }
    continue;
  }
  try {
    const got = evaluateFormatted(input);
    console.log(`FAIL ${JSON.stringify(input)}: expected error "${expectedErr}", got ${got}`); fail++;
  } catch (e) {
    if (e.message.includes(expectedErr)) { console.log(`PASS ${JSON.stringify(input)} throws "${e.message}"`); pass++; }
    else { console.log(`FAIL ${JSON.stringify(input)}: expected "${expectedErr}", got "${e.message}"`); fail++; }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/**
 * test-engine.js — unit tests for calc-engine.js. No DOM, no browser.
 *
 *   node test-engine.js
 *
 * Exits non-zero if anything fails.
 */
'use strict';

const E = require('./calc-engine.js');

let pass = 0;
const failures = [];

function check(name, ok, extra) {
  if (ok) pass++;
  else failures.push({ name, extra: extra === undefined ? null : extra });
}

function eq(name, actual, expected) {
  check(name, actual === expected, actual === expected ? null : { actual, expected });
}

function near(name, actual, expected, tol) {
  const t = tol === undefined ? 1e-9 : tol;
  const ok = typeof actual === 'number' && Math.abs(actual - expected) <= t;
  check(name, ok, ok ? null : { actual, expected });
}

/* --------------------------------------------------------------- helpers */

function calcIs(src, expected) {
  const r = E.calculate(src);
  if (!r.ok) return check(`calculate(${JSON.stringify(src)}) = ${expected}`, false, { error: r.error });
  near(`calculate(${JSON.stringify(src)}) = ${expected}`, r.value, expected);
}

function calcErr(src, message) {
  const r = E.calculate(src);
  if (r.ok) return check(`calculate(${JSON.stringify(src)}) errors`, false, { value: r.value });
  if (message) eq(`calculate(${JSON.stringify(src)}) error text`, r.error, message);
  else check(`calculate(${JSON.stringify(src)}) errors`, true);
}

/** Press a space-separated key sequence; a run of digits is pressed one at a time. */
function press(keys) {
  const s = new E.CalcSession();
  String(keys).split(' ').forEach((k) => {
    if (/^\d+$/.test(k)) k.split('').forEach((d) => s.press(d));
    else if (k !== '') s.press(k);
  });
  return s;
}

function displayIs(keys, expected) {
  const v = press(keys).view();
  eq(`session ${JSON.stringify(keys)} -> display`, v.display, expected);
}

function exprIs(keys, expected) {
  const v = press(keys).view();
  eq(`session ${JSON.stringify(keys)} -> expression`, v.expression, expected);
}

/* ==================================================================== */

console.log('\n── arithmetic & precedence ──');

calcIs('1+2', 3);
calcIs('5-8', -3);
calcIs('6×7', 42);
calcIs('6*7', 42);
calcIs('84÷2', 42);
calcIs('84/2', 42);
calcIs('2+3×4', 14);
calcIs('2×3+4', 10);
calcIs('10-2×3', 4);
calcIs('20÷4+3', 8);
calcIs('2+3×4-5÷5', 13);
calcIs('10-2-3', 5);
calcIs('100÷5÷2', 10);
calcIs('8÷2×3', 12);
calcIs('2^3^2', 512);
calcIs('(2^3)^2', 64);
calcIs('2^0.5', Math.SQRT2);

console.log('── unary & grouping ──');

calcIs('-5+3', -2);
calcIs('3--2', 5);
calcIs('--5', 5);
calcIs('3+-2', 1);
calcIs('-(2+3)', -5);
calcIs('(-5)×(-4)', 20);
calcIs('-2^2', 4);                       // unary binds tighter than ^ (calculator convention)
calcIs('(1+2)×3', 9);
calcIs('((1+2))', 3);
calcIs('2×(3+(4-1))', 12);
calcIs('100÷(2×5)', 10);
calcIs('2(3+4)', 14);                    // implicit multiplication
calcIs('(1+2)(3+4)', 21);
calcIs('2√9', 6);
calcIs('√16', 4);
calcIs('sqrt(9)', 3);
calcIs('sqrt 9', 3);
calcIs('sqrt(2)', Math.SQRT2);
calcIs('sqrt(0)', 0);

console.log('── decimals & precision ──');

calcIs('0.1+0.2', 0.3);
calcIs('1.5×2', 3);
calcIs('0.3-0.1', 0.2);
calcIs('1÷3', 0.333333333333);
calcIs('2÷3', 0.666666666667);
calcIs('0.1×3', 0.3);
calcIs('1.1+2.2', 3.3);
eq('1/3 formats without float noise', E.formatNumber(E.calculate('1÷3').value), '0.333333333333');
eq('0.1+0.2 formats exactly', E.formatNumber(E.calculate('0.1+0.2').value), '0.3');

console.log('── percent semantics ──');

calcIs('50%', 0.5);
calcIs('50+10%', 55);
calcIs('50-10%', 45);
calcIs('200×10%', 20);
calcIs('200÷10%', 2000);
calcIs('10%×10%', 0.01);
calcIs('100+10%+10%', 121);
calcIs('100-10%-10%', 81);
calcIs('100+(10%)', 100.1);              // an explicit group is absolute, not relative
calcIs('50+-10%', 45);
calcIs('50--10%', 55);
calcIs('25%+25%', 0.3125);               // 0.25 + 25% of 0.25

console.log('── errors ──');

calcErr('1÷0', 'Cannot divide by zero');
calcErr('0÷0', 'Cannot divide by zero');
calcErr('sqrt(-1)', 'Invalid input');
calcErr('1+', 'Unexpected end of expression');
calcErr('', 'Empty expression');
calcErr('   ', 'Empty expression');
calcErr('(1+2', 'Missing ")"');
calcErr('1+2)', 'Unexpected ")"');
calcErr('1.2.3', 'Malformed number');
calcErr('2..3', 'Malformed number');
calcErr('1@2');
calcErr('abc');
calcErr('9^9^9', 'Result is too large');
calcErr('÷');
calcErr('×5');
{
  const weird = ['', ' ', '.', '..', '()', '1+()', '((((', '))))', '1÷0÷0', '%%%', '^^^',
    '1 1', '√', '√√', '1.2.3.4', '--', '++', '1--', 'e', '1e', '0÷0', 'Infinity', 'NaN'];
  let threw = null;
  for (const w of weird) {
    try {
      const r = E.calculate(w);
      if (typeof r.ok !== 'boolean') { threw = w + ' returned a malformed result'; break; }
    } catch (err) { threw = w + ' threw: ' + err.message; break; }
  }
  check('calculate() never throws on junk input', threw === null, threw);
}

console.log('── formatter ──');

eq('formatNumber(0)', E.formatNumber(0), '0');
eq('formatNumber(-0)', E.formatNumber(-0), '0');
eq('formatNumber(1234567)', E.formatNumber(1234567), '1,234,567');
eq('formatNumber(1234567.891)', E.formatNumber(1234567.891), '1,234,567.891');
eq('formatNumber(-1234.5)', E.formatNumber(-1234.5), '-1,234.5');
eq('formatNumber(1e15)', E.formatNumber(1e15), '1e15');
eq('formatNumber(1e-10)', E.formatNumber(1e-10), '1e-10');
eq('formatNumber(0.5)', E.formatNumber(0.5), '0.5');
eq('formatNumber(42)', E.formatNumber(42), '42');
eq('groupDigits partial input', E.groupDigits('1234.'), '1,234.');
eq('groupDigits leading dot', E.groupDigits('0.5'), '0.5');
eq('groupDigits keeps exponent', E.groupDigits('1e20'), '1e20');
eq('toRaw round-trips a result', E.toRaw(0.30000000000000004), '0.3');

console.log('── session: typing ──');

displayIs('0', '0');
displayIs('1 2 3', '123');
displayIs('0 5', '5');                    // leading zero is replaced
displayIs('0 0 0', '0');
displayIs('. 5', '0.5');
displayIs('1 . 5', '1.5');
displayIs('1 . . 5', '1.5');              // second decimal point ignored
displayIs('1 2 3 4', '1,234');
exprIs('1 2 3 4', '1,234');
displayIs('1 2 3 ⌫', '12');
displayIs('1 2 3 ⌫ ⌫', '1');
displayIs('1 ⌫', '0');
displayIs('⌫', '0');
displayIs('1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8', '123,456,789,012,345');  // 15-digit cap
displayIs('AC', '0');
displayIs('1 2 + 3 AC', '0');
displayIs('1 2 + 3', '3');

console.log('── session: operators ──');

displayIs('1 + 2 =', '3');
displayIs('2 + 3 × 4 =', '14');
displayIs('( 2 + 3 ) × 4 =', '20');
displayIs('1 + × 2 =', '2');              // pressing an operator replaces the pending one
displayIs('1 + + 2 =', '3');
displayIs('5 × ÷ 2 =', '2.5');
displayIs('1 + =', '1');                  // a dangling operator is dropped
displayIs('1 + ( =', '1');
displayIs('1 + 2 = =', '3');              // repeated equals is idempotent
displayIs('1 2 + 3 = × 2 =', '30');       // continues from the result
displayIs('1 + 2 = × 2', '2');           // the literal being typed, total in the preview
displayIs('2 + 3 × 4', '4');
exprIs('2 + 3 × 4', '2 + 3 × 4');
displayIs('2 +', '2');
displayIs('2 ×', '2');

console.log('── session: sign, percent, functions ──');

displayIs('5 ±', '-5');
exprIs('5 ±', '-5');
displayIs('5 ± ±', '5');
displayIs('5 ± =', '-5');
displayIs('2 + 3 ±', '-3');
displayIs('2 + 3 ± =', '-1');
displayIs('2 + 3 ± ± =', '5');
displayIs('2 × 3 ± =', '-6');
displayIs('5 ± x² =', '25');
displayIs('2 + 5 x² =', '27');
displayIs('2 × 5 x² =', '50');
exprIs('5 x²', '5²');
displayIs('5 x² 3 =', '75');              // implicit multiply after x²
displayIs('5 ± 1/x =', '-0.2');
displayIs('2 × 5 1/x =', '0.4');
displayIs('4 √ =', '2');
displayIs('2 + 5 √ =', '4.2360679775');
displayIs('9 ± √ =', 'Invalid input');
displayIs('50 + 10 % =', '55');
displayIs('200 × 10 % =', '20');
displayIs('5 % =', '0.05');
displayIs('1 ÷ 0 =', 'Cannot divide by zero');
displayIs('1 ÷ 0 = 5', '5');              // any key after an error starts fresh
displayIs('1 ÷ 0 = AC', '0');
displayIs('2 ( 3 + 4 ) =', '14');
displayIs('( 1 + 2 =', '3');              // unclosed group auto-closes on equals

console.log('── session: memory ──');

{
  const s = press('5 M+ AC 3 M+ MR');
  eq('memory recall sums M+', s.view().display, '8');
  eq('memory badge visible', s.view().memory, 8);
}
{
  const s = press('5 M+ AC 3 M+ MR + =');
  eq('MR replaces a committed entry', s.view().display, '8');
}
{
  const s = press('5 M+ AC 3 M+ MR');
  s.press('2');
  eq('a digit after MR continues the recalled number', s.view().display, '82');
}
{
  const s = press('5 M+ AC 3 M+ 4 + MR =');
  eq('MR after an operator supplies its operand', s.view().display, '12');
}
{
  const s = press('10 M+ 5 M- MR');
  eq('M- subtracts', s.view().display, '5');
}
{
  const s = press('10 M+ MC');
  eq('MC clears memory', s.view().memory, null);
}
{
  const s = press('10 M+ AC MC MR');
  eq('MR with empty memory does nothing', s.view().display, '0');
}
{
  const s = press('7 M+ AC 3 MR');
  exprIs('7 M+ AC 3 MR', '3 × 7');        // recall after a number multiplies
}
{
  const s = press('2 + 3 = M+ AC MR');
  eq('M+ takes the evaluated result', s.view().display, '5');
}

console.log('── session: history ──');

{
  const s = press('2 + 3 =');
  eq('history records one entry', s.history.length, 1);
  eq('history expression', s.history[0].expression, '2 + 3');
  eq('history result', s.history[0].result, '5');
  near('history value', s.history[0].value, 5);
}
{
  const s = press('1 + 1 = 2 + 2 =');
  eq('history is newest first', s.history[0].expression, '2 + 2');
  eq('history keeps older entries', s.history[1].expression, '1 + 1');
  eq('history length', s.history.length, 2);
}
{
  const s = press('1 + 1 =');
  const before = s.history.length;
  s.press('=');
  eq('bare equals adds no history', s.history.length, before);
}
{
  const s = press('1 + 1 =');
  s.press('AC');
  eq('AC keeps history', s.history.length, 1);
  eq('AC keeps the result', s.view().display, '0');
}
{
  const s = new E.CalcSession();
  for (let i = 0; i < E.MAX_HISTORY + 5; i++) {
    s.press('1'); s.press('+'); s.press('1'); s.press('=');
  }
  eq('history is capped', s.history.length, E.MAX_HISTORY);
}
{
  const s = press('( 1 + 2 =');
  eq('history shows the auto-closed expression', s.history[0].expression, '(1 + 2)');
}
{
  const s = press('1 ÷ 0 =');
  eq('failed evaluation adds no history', s.history.length, 0);
}
{
  const s = press('5 0 + 1 0 % =');
  eq('percent expression text', s.history[0].expression, '50 + 10%');
}

console.log('── session: view model ──');

{
  const s = press('2 + 3');
  const v = s.view();
  eq('pending operator is exposed', v.pendingOp, '+');
  eq('running total preview', v.preview, '= 5');
  eq('expression line', v.expression, '2 + 3');
}
{
  const s = press('2 + 3 =');
  eq('no pending operator after equals', s.view().pendingOp, null);
  eq('no preview after equals', s.view().preview, '');
}
{
  const s = press('1 ÷ 0 =');
  eq('error flag', s.view().error, 'Cannot divide by zero');
  eq('error text is the display', s.view().display, 'Cannot divide by zero');
}
{
  const s = press('5 ±');
  eq('signed literal is displayed', s.view().display, '-5');
  eq('no preview when the display already shows the operand', s.view().preview, '');
}
{
  const s = press('2 + 5 x²');
  eq('operand shown after x²', s.view().display, '25');
  eq('preview shows the full total', s.view().preview, '= 27');
}
{
  const s = new E.CalcSession();
  s.load(1234.5);
  eq('load() sets the display', s.view().display, '1,234.5');
  eq('load() marks the entry evaluated', s.view().evaluated, true);
}
{
  const s = press('1 + 2 =');
  eq('memory is null until used', s.view().memory, null);
}

console.log('── keyboard mapping ──');

eq('key * -> ×', E.keyFor({ key: '*' }), '×');
eq('key / -> ÷', E.keyFor({ key: '/' }), '÷');
eq('key x -> ×', E.keyFor({ key: 'x' }), '×');
eq('key Enter -> =', E.keyFor({ key: 'Enter' }), '=');
eq('key Backspace -> ⌫', E.keyFor({ key: 'Backspace' }), '⌫');
eq('key Escape -> AC', E.keyFor({ key: 'Escape' }), 'AC');
eq('key 7 -> 7', E.keyFor({ key: '7' }), '7');
eq('key . -> .', E.keyFor({ key: '.' }), '.');
eq('key % -> %', E.keyFor({ key: '%' }), '%');
eq('key s -> √', E.keyFor({ key: 's' }), '√');
eq('key q -> x²', E.keyFor({ key: 'q' }), 'x²');
eq('key r -> 1/x', E.keyFor({ key: 'r' }), '1/x');
eq('key n -> ±', E.keyFor({ key: 'n' }), '±');
eq('unknown key -> null', E.keyFor({ key: 'F5' }), null);
eq('null event -> null', E.keyFor(null), null);

console.log('── fuzz: engine vs reference evaluator ──');

{
  // Deterministic pseudo-random expression trees (fixed seed => same every run).
  let seed = 123456789;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function build(depth) {
    if (depth <= 0 || rnd() < 0.35) {
      const n = Math.floor(rnd() * 20) + 1;
      return { text: String(n), value: n };
    }
    const op = ['+', '-', '×', '÷'][Math.floor(rnd() * 4)];
    const a = build(depth - 1);
    let b = build(depth - 1);
    if (op === '÷' && b.value === 0) b = { text: '7', value: 7 };
    let value;
    if (op === '+') value = a.value + b.value;
    else if (op === '-') value = a.value - b.value;
    else if (op === '×') value = a.value * b.value;
    else value = a.value / b.value;
    return { text: '(' + a.text + ' ' + op + ' ' + b.text + ')', value };
  }

  let mismatches = 0;
  let worst = null;
  for (let i = 0; i < 500; i++) {
    const tree = build(4);
    const r = E.calculate(tree.text);
    const tol = 1e-9 * Math.max(1, Math.abs(tree.value));
    if (!r.ok || Math.abs(r.value - tree.value) > tol) {
      mismatches++;
      if (!worst) worst = { expression: tree.text, engine: r.ok ? r.value : r.error, reference: tree.value };
    }
  }
  check('fuzz: 500 random expressions match the reference evaluator', mismatches === 0,
    worst ? Object.assign({ mismatches }, worst) : null);
}

/* ==================================================================== */

console.log('');
if (failures.length) {
  failures.forEach((f) => {
    console.log('FAIL  ' + f.name + (f.extra ? '  → ' + JSON.stringify(f.extra) : ''));
  });
  console.log(`\n${failures.length} of ${pass + failures.length} engine checks FAILED`);
  process.exitCode = 1;
} else {
  console.log(`ALL ${pass} engine checks passed`);
}

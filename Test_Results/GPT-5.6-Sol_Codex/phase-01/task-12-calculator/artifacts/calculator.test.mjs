import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPercent, evaluate, formatNumber, toggleSign, tokenize } from './calculator.mjs';

test('tokenizes decimals and operators', () => {
  assert.deepEqual(tokenize('12.5×-2'), [12.5, '×', -2]);
});

test('respects multiplication and division precedence', () => {
  assert.equal(evaluate('2+3×4'), 14);
  assert.equal(evaluate('20÷5-2'), 2);
});

test('supports negative numbers and floating point correction', () => {
  assert.equal(evaluate('-5+2'), -3);
  assert.equal(evaluate('0.1+0.2'), 0.3);
});

test('rejects invalid expressions and division by zero', () => {
  assert.throws(() => evaluate('4÷0'), /divide by zero/);
  assert.throws(() => evaluate('2++3'), /Invalid/);
  assert.throws(() => evaluate('1.2.3'), /Invalid number/);
});

test('applies percent to the current operand', () => {
  assert.equal(applyPercent('50'), '0.5');
  assert.equal(applyPercent('100+25'), '100+0.25');
});

test('toggles the current operand sign', () => {
  assert.equal(toggleSign('42'), '-42');
  assert.equal(toggleSign('-42'), '42');
  assert.equal(toggleSign('10+4'), '10-4');
  assert.equal(toggleSign('10-4'), '10+4');
  assert.equal(toggleSign('10×4'), '10×-4');
  assert.equal(toggleSign('10×-4'), '10×4');
});

test('formats readable results', () => {
  assert.equal(formatNumber(1234567.89), '1,234,567.89');
  assert.equal(formatNumber(1 / 3), '0.3333333333');
});

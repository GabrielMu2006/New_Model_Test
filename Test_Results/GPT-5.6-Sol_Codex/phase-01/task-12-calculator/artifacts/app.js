import { applyPercent, evaluate, formatNumber, toggleSign } from './calculator.mjs';

const expressionEl = document.querySelector('#expression');
const resultEl = document.querySelector('#result');
const keys = document.querySelector('.keys');
const historyList = document.querySelector('#history-list');
const clearHistoryButton = document.querySelector('#clear-history');
let expression = '';
let justEvaluated = false;
let history = [];

function preview() {
  expressionEl.textContent = expression || 'Ready';
  if (!expression) {
    resultEl.textContent = '0';
    return;
  }
  try {
    resultEl.textContent = formatNumber(evaluate(expression));
    resultEl.classList.remove('error');
  } catch {
    resultEl.textContent = '—';
  }
}

function renderHistory() {
  historyList.innerHTML = '';
  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Your calculations will appear here.';
    historyList.append(empty);
    return;
  }
  for (const entry of history) {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.innerHTML = `<span>${entry.expression}</span><strong>${entry.result}</strong>`;
    button.addEventListener('click', () => {
      expression = entry.raw;
      justEvaluated = true;
      preview();
    });
    historyList.append(button);
  }
}

function append(value) {
  const isOperator = ['+', '-', '×', '÷'].includes(value);
  if (justEvaluated && !isOperator) expression = '';
  justEvaluated = false;
  if (isOperator) {
    if (!expression && value !== '-') return;
    if (/[+\-×÷]$/.test(expression)) expression = expression.slice(0, -1);
    expression += value;
  } else {
    const current = expression.split(/[+\-×÷]/).at(-1);
    if (value === '.' && current.includes('.')) return;
    if (value === '.' && (!current || /[+\-×÷]$/.test(expression))) expression += '0';
    if (value === '0' && current === '0') return;
    expression += value;
  }
  preview();
}

function equals() {
  if (!expression) return;
  try {
    const value = evaluate(expression);
    const formatted = formatNumber(value);
    history.unshift({ expression: `${expression} =`, result: formatted, raw: String(value) });
    history = history.slice(0, 6);
    expression = String(value);
    justEvaluated = true;
    resultEl.classList.remove('error');
    preview();
    renderHistory();
  } catch (error) {
    resultEl.textContent = error.message;
    resultEl.classList.add('error');
  }
}

function action(name) {
  if (name === 'clear') {
    expression = '';
    justEvaluated = false;
    resultEl.classList.remove('error');
    preview();
  } else if (name === 'backspace') {
    expression = expression.slice(0, -1);
    justEvaluated = false;
    preview();
  } else if (name === 'percent') {
    expression = applyPercent(expression);
    preview();
  } else if (name === 'sign') {
    expression = toggleSign(expression);
    preview();
  } else if (name === 'equals') equals();
}

keys.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.value) append(button.dataset.value);
  if (button.dataset.action) action(button.dataset.action);
});

document.addEventListener('keydown', (event) => {
  const map = { '*': '×', '/': '÷', Enter: 'equals', '=': 'equals', Escape: 'clear', Backspace: 'backspace', '%': 'percent' };
  const value = map[event.key] || event.key;
  if (/^[0-9.+\-×÷]$/.test(value)) append(value);
  else if (['equals', 'clear', 'backspace', 'percent'].includes(value)) action(value);
  else return;
  event.preventDefault();
});

clearHistoryButton.addEventListener('click', () => {
  history = [];
  renderHistory();
});

preview();
renderHistory();

const operators = {
  '+': { precedence: 1, apply: (a, b) => a + b },
  '-': { precedence: 1, apply: (a, b) => a - b },
  '×': { precedence: 2, apply: (a, b) => a * b },
  '÷': { precedence: 2, apply: (a, b) => a / b }
};

export function tokenize(expression) {
  const clean = expression.replace(/\s+/g, '');
  if (!clean) return [];
  const tokens = [];
  let number = '';

  const flushNumber = () => {
    if (!number) return;
    if (number === '.' || !Number.isFinite(Number(number))) throw new Error('Invalid number');
    tokens.push(Number(number));
    number = '';
  };

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (/\d|\./.test(char)) {
      if (char === '.' && number.includes('.')) throw new Error('Invalid number');
      number += char;
      continue;
    }
    flushNumber();
    if (!(char in operators)) throw new Error('Invalid expression');
    const previous = tokens.at(-1);
    const canBeNegative = char === '-' && (tokens.length === 0 || previous === '×' || previous === '÷');
    if (canBeNegative) {
      number = char;
      continue;
    }
    if (typeof previous !== 'number') throw new Error('Invalid expression');
    tokens.push(char);
  }
  flushNumber();
  if (typeof tokens.at(-1) === 'string') throw new Error('Incomplete expression');
  return tokens;
}

export function evaluate(expression) {
  const tokens = tokenize(expression);
  if (!tokens.length) return 0;
  const values = [];
  const ops = [];

  const calculate = () => {
    const operator = ops.pop();
    const b = values.pop();
    const a = values.pop();
    const result = operators[operator].apply(a, b);
    if (!Number.isFinite(result)) throw new Error('Cannot divide by zero');
    values.push(result);
  };

  for (const token of tokens) {
    if (typeof token === 'number') {
      values.push(token);
    } else {
      while (ops.length && operators[ops.at(-1)].precedence >= operators[token].precedence) calculate();
      ops.push(token);
    }
  }
  while (ops.length) calculate();
  if (values.length !== 1) throw new Error('Invalid expression');
  return Number.parseFloat(values[0].toPrecision(12));
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return 'Error';
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-8)) {
    return value.toExponential(8).replace(/\.?(0+)e/, 'e');
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(value);
}

export function applyPercent(expression) {
  return expression.replace(/(\d+\.?\d*|\.\d+)$/, (match) => String(Number(match) / 100));
}

export function toggleSign(expression) {
  const match = expression.match(/^(.*?)([+\-×÷]?)(\d+\.?\d*|\.\d+)$/);
  if (!match) return expression;
  const [, start, operator, number] = match;
  if (!operator) return `-${number}`;
  if (operator === '+') return `${start}-${number}`;
  if (operator === '-') {
    const replacement = !start || /[×÷]$/.test(start) ? '' : '+';
    return `${start}${replacement}${number}`;
  }
  return `${start}${operator}-${number}`;
}

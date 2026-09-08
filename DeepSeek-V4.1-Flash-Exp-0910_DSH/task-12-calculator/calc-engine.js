/**
 * calc-engine.js — the whole calculator brain, with no DOM and no eval().
 *
 *   1. lexer      raw text  -> tokens
 *   2. parser     tokens    -> AST   (recursive descent, real precedence)
 *   3. evaluator  AST       -> number
 *   4. formatter  number    -> display text (thousands separators, no float noise)
 *   5. CalcSession          the input state machine a keypad drives
 *
 * Loads both as a CommonJS module (Node tests) and as a browser global.
 *
 * Grammar (lowest -> highest precedence):
 *   expr    := term (('+' | '-') term)*        percent-aware addition
 *   term    := power (('×' | '÷') power)*      left associative
 *   power   := unary ('^' power)?              right associative
 *   unary   := ('-' | '+') unary | postfix
 *   postfix := primary '%'*
 *   primary := number | '(' expr ')' | func unary
 *
 * Notes:
 *   - unary binds tighter than '^', so -2^2 === 4 (calculator convention).
 *   - 'a + b%' is relative: a + a*b/100. 'a × b%' is absolute: a * b/100.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalcEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRECISION = 12;          // significant digits kept after evaluation
  var MAX_INPUT_DIGITS = 15;   // digits a user may type into one number
  var MAX_HISTORY = 60;
  var MAX_DEPTH = 64;          // recursion guard for nested parens

  /* ------------------------------------------------------------------ errors */

  function CalcError(message) {
    Error.call(this, message);
    this.name = 'CalcError';
    this.message = message;
  }
  CalcError.prototype = Object.create(Error.prototype);
  CalcError.prototype.constructor = CalcError;

  /* ------------------------------------------------------- number utilities */

  function roundToPrecision(value) {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    var r = parseFloat(value.toPrecision(PRECISION));
    return r === 0 ? 0 : r;                       // normalise -0
  }

  /** Unformatted, round-trippable literal (used to put a result back in the input). */
  function toRaw(value) {
    var v = roundToPrecision(value);
    if (v === 0) return '0';
    var abs = Math.abs(v);
    if (abs >= 1e15 || abs < 1e-9) return v.toExponential(9).replace(/\.?0+e/, 'e');
    return String(v);
  }

  /** Group the integer part in threes, leaving partial input like "1234." intact. */
  function groupDigits(text) {
    var s = String(text);
    if (s.indexOf('e') !== -1 || s.indexOf('E') !== -1) return s;
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var dot = s.indexOf('.');
    var int = dot === -1 ? s : s.slice(0, dot);
    var frac = dot === -1 ? null : s.slice(dot + 1);
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + int + (frac === null ? '' : '.' + frac);
  }

  /** Human display text for a finished number. */
  function formatNumber(value) {
    if (typeof value !== 'number' || !isFinite(value)) return String(value);
    var v = roundToPrecision(value);
    if (v === 0) return '0';
    var abs = Math.abs(v);
    if (abs >= 1e15 || abs < 1e-9) {
      return v.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e');
    }
    return groupDigits(String(v));
  }

  /* ------------------------------------------------------------------ lexer */

  var OP_CHARS = { '+': '+', '-': '-', '×': '×', '*': '×', '÷': '÷', '/': '÷', '^': '^' };

  function tokenize(src) {
    var text = String(src == null ? '' : src);
    var out = [];
    var i = 0;

    function prevKind() {
      return out.length ? out[out.length - 1].type : null;
    }

    while (i < text.length) {
      var ch = text.charAt(i);

      if (ch === ' ' || ch === '\t' || ch === ',' || ch === '_' || ch === '\u00a0') { i++; continue; }

      if (ch >= '0' && ch <= '9' || ch === '.') {
        if (ch === '.' && prevKind() === 'num') throw new CalcError('Malformed number');
        var j = i;
        var seenDot = false;
        while (j < text.length) {
          var c = text.charAt(j);
          if (c >= '0' && c <= '9') { j++; continue; }
          if (c === '.') {
            if (seenDot) break;
            seenDot = true; j++; continue;
          }
          break;
        }
        var lit = text.slice(i, j);
        if (lit === '.') throw new CalcError('Malformed number');
        var num = parseFloat(lit);
        if (!isFinite(num)) throw new CalcError('Malformed number');
        out.push({ type: 'num', value: num, text: lit });
        i = j;
        continue;
      }

      if (ch === '√') { out.push({ type: 'func', name: 'sqrt', text: ch }); i++; continue; }

      if (ch === '(') { out.push({ type: 'lp', text: ch }); i++; continue; }
      if (ch === ')') { out.push({ type: 'rp', text: ch }); i++; continue; }
      if (ch === '%') { out.push({ type: 'pct', text: ch }); i++; continue; }
      if (ch === '²') { out.push({ type: 'sq', text: ch }); i++; continue; }

      if (Object.prototype.hasOwnProperty.call(OP_CHARS, ch)) {
        out.push({ type: 'op', value: OP_CHARS[ch], text: ch });
        i++;
        continue;
      }

      if (/[A-Za-z]/.test(ch)) {
        var k = i;
        while (k < text.length && /[A-Za-z]/.test(text.charAt(k))) k++;
        var word = text.slice(i, k).toLowerCase();
        if (word === 'sqrt') { out.push({ type: 'func', name: 'sqrt', text: text.slice(i, k) }); i = k; continue; }
        throw new CalcError('Unexpected "' + text.slice(i, k) + '"');
      }

      throw new CalcError('Unexpected "' + ch + '"');
    }

    // Implicit multiplication: 2(3+4), 2√9, (1+2)(3+4), 5%3 ...
    var merged = [];
    for (var n = 0; n < out.length; n++) {
      var cur = out[n];
      var prev = merged.length ? merged[merged.length - 1] : null;
      var leftEnds = prev && (prev.type === 'num' || prev.type === 'rp' || prev.type === 'pct');
      var rightStarts = cur.type === 'num' || cur.type === 'lp' || cur.type === 'func';
      if (leftEnds && rightStarts) merged.push({ type: 'op', value: '×', text: '×' });
      merged.push(cur);
    }
    return merged;
  }

  /* ----------------------------------------------------------------- parser */

  function parse(tokens) {
    var pos = 0;
    var depth = 0;

    function peek() { return pos < tokens.length ? tokens[pos] : null; }

    function enter() {
      if (++depth > MAX_DEPTH) throw new CalcError('Expression is too complex');
    }
    function leave() { depth--; }

    function parseExpr() {
      enter();
      var left = parseTerm();
      for (;;) {
        var t = peek();
        if (!t || t.type !== 'op' || (t.value !== '+' && t.value !== '-')) break;
        pos++;
        var right = parseTerm();
        left = { type: 'binary', op: t.value, left: left, right: right };
      }
      leave();
      return left;
    }

    function parseTerm() {
      var left = parsePower();
      for (;;) {
        var t = peek();
        if (!t || t.type !== 'op' || (t.value !== '×' && t.value !== '÷')) break;
        pos++;
        left = { type: 'binary', op: t.value, left: left, right: parsePower() };
      }
      return left;
    }

    function parsePower() {
      var base = parseUnary();
      var t = peek();
      if (t && t.type === 'op' && t.value === '^') {
        pos++;
        enter();
        var exp = parsePower();          // right associative
        leave();
        return { type: 'binary', op: '^', left: base, right: exp };
      }
      return base;
    }

    function parseUnary() {
      var t = peek();
      if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
        pos++;
        enter();
        var arg = parseUnary();
        leave();
        return t.value === '-' ? { type: 'neg', arg: arg } : { type: 'pos', arg: arg };
      }
      return parsePostfix();
    }

    function parsePostfix() {
      var node = parsePrimary();
      for (;;) {
        var t = peek();
        if (t && t.type === 'pct') { pos++; node = { type: 'pct', arg: node }; }
        else if (t && t.type === 'sq') { pos++; node = { type: 'sq', arg: node }; }
        else break;
      }
      return node;
    }

    function parsePrimary() {
      var t = peek();
      if (!t) throw new CalcError('Unexpected end of expression');
      if (t.type === 'num') { pos++; return { type: 'num', value: t.value }; }
      if (t.type === 'lp') {
        pos++;
        enter();
        var inner = parseExpr();
        leave();
        var close = peek();
        if (!close || close.type !== 'rp') throw new CalcError('Missing ")"');
        pos++;
        return { type: 'group', arg: inner };
      }
      if (t.type === 'func') {
        pos++;
        enter();
        var arg = parseUnary();
        leave();
        return { type: 'func', name: t.name, arg: arg };
      }
      throw new CalcError('Unexpected "' + (t.text || t.value || '') + '"');
    }

    var ast = parseExpr();
    var rest = peek();
    if (rest) throw new CalcError('Unexpected "' + (rest.text || rest.value || '') + '"');
    return ast;
  }

  /* -------------------------------------------------------------- evaluator */

  var FUNCS = {
    sqrt: function (x) {
      if (x < 0) throw new CalcError('Invalid input');
      return Math.sqrt(x);
    }
  };

  function evaluate(node) {
    switch (node.type) {
      case 'num':
        return node.value;

      case 'group':
        return evaluate(node.arg);

      case 'pos':
        return evaluate(node.arg);

      case 'neg':
        return -evaluate(node.arg);

      case 'pct':
        return evaluate(node.arg) / 100;

      case 'sq': {
        var s = evaluate(node.arg);
        return s * s;
      }

      case 'func': {
        var fn = FUNCS[node.name];
        if (!fn) throw new CalcError('Unknown function "' + node.name + '"');
        return fn(evaluate(node.arg));
      }

      case 'binary': {
        // a ± b%  ->  relative to a (matches iOS/Windows behaviour)
        if (node.op === '+' || node.op === '-') {
          var pctNode = null;
          var sign = 1;
          if (node.right.type === 'pct') pctNode = node.right;
          else if (node.right.type === 'neg' && node.right.arg.type === 'pct') {
            pctNode = node.right.arg;
            sign = -1;
          }
          if (pctNode) {
            var base = evaluate(node.left);
            var delta = base * evaluate(pctNode.arg) / 100 * sign;
            return node.op === '+' ? base + delta : base - delta;
          }
        }
        var l = evaluate(node.left);
        var r = evaluate(node.right);
        switch (node.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '×': return l * r;
          case '÷':
            if (r === 0) throw new CalcError('Cannot divide by zero');
            return l / r;
          case '^': return Math.pow(l, r);
          default: throw new CalcError('Unknown operator "' + node.op + '"');
        }
      }

      default:
        throw new CalcError('Invalid expression');
    }
  }

  /* --------------------------------------------------------------- calculate */

  function calculate(src) {
    try {
      var tokens = tokenize(src);
      if (!tokens.length) return { ok: false, error: 'Empty expression' };
      var value = evaluate(parse(tokens));
      if (typeof value !== 'number' || value !== value) return { ok: false, error: 'Invalid input' };
      if (!isFinite(value)) return { ok: false, error: 'Result is too large' };
      return { ok: true, value: roundToPrecision(value) };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : 'Invalid expression' };
    }
  }

  /* ----------------------------------------------------------- input helpers */

  function num(v) { return { k: 'num', v: String(v) }; }
  function op(v) { return { k: 'op', v: v }; }
  function lp() { return { k: 'lp' }; }
  function rp() { return { k: 'rp' }; }
  function pct() { return { k: 'pct' }; }
  function sq() { return { k: 'sq' }; }
  function fn(name) { return { k: 'fn', v: name }; }

  function isUnaryAt(tokens, i) {
    if (i < 0 || i >= tokens.length) return false;
    if (tokens[i].k !== 'op') return false;
    if (i === 0) return true;
    var p = tokens[i - 1];
    return p.k === 'op' || p.k === 'lp' || p.k === 'fn';
  }

  /**
   * Index of the token starting the last complete operand.
   * With includeSign, a leading unary minus is part of the operand, so
   * functions apply to the value the user can actually see (-9 -> sqrt(-9)).
   * ± passes false, so it can toggle that minus instead.
   */
  function lastOperandStart(tokens, includeSign) {
    var s = baseOperandStart(tokens);
    if (s > 0 && includeSign) {
      var p = tokens[s - 1];
      if (p.k === 'op' && p.v === '-' && isUnaryAt(tokens, s - 1)) s--;
    }
    return s;
  }

  function baseOperandStart(tokens) {
    if (!tokens.length) return -1;
    var last = tokens[tokens.length - 1];
    if (last.k === 'num') return tokens.length - 1;
    if (last.k === 'pct' || last.k === 'sq') return baseOperandStart(tokens.slice(0, tokens.length - 1));
    if (last.k === 'rp') {
      var depth = 0;
      for (var i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].k === 'rp') depth++;
        else if (tokens[i].k === 'lp') {
          depth--;
          if (depth === 0) return (i > 0 && tokens[i - 1].k === 'fn') ? i - 1 : i;
        }
      }
    }
    return -1;
  }

  function countDigits(s) {
    var m = String(s).match(/\d/g);
    return m ? m.length : 0;
  }

  function unclosedParens(tokens) {
    var n = 0;
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].k === 'lp') n++;
      else if (tokens[i].k === 'rp') n--;
    }
    return n > 0 ? n : 0;
  }

  /** The last binary operator still awaiting its right-hand operand. */
  function lastBinaryOp(tokens) {
    for (var i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].k === 'op' && !isUnaryAt(tokens, i)) return tokens[i].v;
    }
    return null;
  }

  /* --------------------------------------------------------- keyboard mapping */

  var KEYBOARD = {
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    '.': '.', ',': '.',
    '+': '+', '-': '-', '*': '×', 'x': '×', 'X': '×', '/': '÷', ':': '÷',
    '(': '(', ')': ')', '%': '%',
    '=': '=', 'Enter': '=',
    'Backspace': '⌫', 'Delete': 'AC', 'Escape': 'AC', 'c': 'AC', 'C': 'AC',
    'r': '1/x', 'R': '1/x',
    'q': 'x²', 'Q': 'x²', '^': 'x²',
    's': '√', 'S': '√',
    'n': '±', 'N': '±', '!': '±'
  };

  function keyFor(event) {
    if (!event) return null;
    return Object.prototype.hasOwnProperty.call(KEYBOARD, event.key) ? KEYBOARD[event.key] : null;
  }

  /* ------------------------------------------------------------ CalcSession */

  function CalcSession() {
    this.history = [];
    this.memory = 0;
    this.memorySet = false;
    this.reset();
  }

  /** Clear the current entry; history and memory survive (this is AC). */
  CalcSession.prototype.reset = function () {
    this.tokens = [];
    this.result = null;
    this.error = null;
    this.evaluated = false;
    return this;
  };

  CalcSession.prototype.last = function () {
    return this.tokens.length ? this.tokens[this.tokens.length - 1] : null;
  };

  /** Raw, evaluatable text of a token list. */
  function sourceOf(tokens) {
    var s = '';
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.k === 'num' || t.k === 'op') s += t.v;
      else if (t.k === 'lp') s += '(';
      else if (t.k === 'rp') s += ')';
      else if (t.k === 'pct') s += '%';
      else if (t.k === 'sq') s += '^2';
      else if (t.k === 'fn') s += t.v;
    }
    return s;
  }

  /** Raw, evaluatable text of the current entry. */
  CalcSession.prototype.source = function () {
    return sourceOf(this.tokens);
  };

  /** Pretty, grouped text of the current entry. */
  CalcSession.prototype.pretty = function () {
    var out = '';
    for (var i = 0; i < this.tokens.length; i++) {
      var t = this.tokens[i];
      var piece = t.k === 'num' ? groupDigits(t.v)
        : t.k === 'lp' ? '('
          : t.k === 'rp' ? ')'
            : t.k === 'pct' ? '%'
              : t.k === 'sq' ? '²'
                : t.k === 'fn' ? '√'
                  : t.v;
      if (out === '') { out = piece; continue; }
      var prev = this.tokens[i - 1];
      var space = (t.k === 'op' && !isUnaryAt(this.tokens, i)) || (prev.k === 'op' && !isUnaryAt(this.tokens, i - 1));
      out += (space ? ' ' : '') + piece;
    }
    return out;
  };

  /** Drop trailing tokens that cannot end an expression ("1+", "2×("). */
  CalcSession.prototype.trimDangling = function () {
    var guard = 0;
    while (this.tokens.length && guard++ < MAX_DEPTH) {
      var last = this.last();
      if (last.k === 'op' || last.k === 'lp' || last.k === 'fn') this.tokens.pop();
      else break;
    }
    return this;
  };

  /** Evaluate the entry as it stands (unclosed groups auto-closed). */
  CalcSession.prototype.liveValue = function () {
    if (!this.tokens.length) return { ok: false, error: 'Empty expression' };
    var src = this.source() + new Array(unclosedParens(this.tokens) + 1).join(')');
    return calculate(src);
  };

  /** Numeric value the memory keys should act on. */
  CalcSession.prototype.currentValue = function () {
    if (this.error) return null;
    if (this.evaluated && this.result !== null) return this.result;
    if (!this.tokens.length) return this.result === null ? 0 : this.result;
    var live = this.liveValue();
    return live.ok ? live.value : null;
  };

  /** Value of the trailing operand — what x²/1/x/√ just acted on. */
  CalcSession.prototype.currentOperandValue = function () {
    var s = lastOperandStart(this.tokens);
    if (s < 0) return null;
    var r = calculate(sourceOf(this.tokens.slice(s)));
    return r.ok ? r.value : null;
  };

  /** Value of the entry with any half-typed trailing operator removed. */
  CalcSession.prototype.previewValue = function () {
    var tokens = this.tokens.slice();
    var guard = 0;
    while (tokens.length && guard++ < MAX_DEPTH) {
      var last = tokens[tokens.length - 1];
      if (last.k === 'op' || last.k === 'lp' || last.k === 'fn') tokens.pop();
      else break;
    }
    if (!tokens.length) return null;
    var r = calculate(sourceOf(tokens) + new Array(unclosedParens(tokens) + 1).join(')'));
    return r.ok ? r.value : null;
  };

  CalcSession.prototype.load = function (value) {
    this.error = null;
    this.result = roundToPrecision(value);
    this.tokens = [num(toRaw(this.result))];
    this.evaluated = true;
    return this;
  };

  /** Last numeric literal in the entry, sign included — display fallback. */
  CalcSession.prototype.lastLiteral = function () {
    for (var i = this.tokens.length - 1; i >= 0; i--) {
      if (this.tokens[i].k === 'num') {
        var negated = i > 0 && this.tokens[i - 1].k === 'op' && this.tokens[i - 1].v === '-' &&
          isUnaryAt(this.tokens, i - 1);
        var lit = this.tokens[i].v;
        return (negated && lit.charAt(0) !== '-' ? '-' : '') + groupDigits(lit);
      }
    }
    return null;
  };

  /* ------------------------------------------------------------ key handling */

  CalcSession.prototype.press = function (key) {
    var k = key == null ? '' : String(key);

    if (this.error && k !== 'AC' && k !== '=') this.reset();   // any key starts over after an error

    switch (k) {
      case 'AC': this.reset(); return this;
      case '⌫': return this.backspace();
      case '=': return this.equals();
      case '±': return this.negate();
      case '√': return this.sqrt();
      case 'x²': return this.square();
      case '1/x': return this.reciprocal();
      case 'MC': this.memory = 0; this.memorySet = false; return this;
      case 'MR': return this.memoryRecall();
      case 'M+': return this.memoryAdd(1);
      case 'M-': return this.memoryAdd(-1);
      case '(': return this.openParen();
      case ')': return this.closeParen();
      case '%': return this.percent();
      case '.': return this.dot();
      case '+': case '-': case '×': case '÷': return this.operator(k);
      default:
        if (/^[0-9]$/.test(k)) return this.digit(k);
        return this;                                     // unknown key: ignore
    }
  };

  CalcSession.prototype.startFreshIfDone = function () {
    if (this.evaluated) {
      this.tokens = [];
      this.result = null;
      this.evaluated = false;
    }
    return this;
  };

  CalcSession.prototype.digit = function (d) {
    this.startFreshIfDone();
    var last = this.last();
    if (last && last.k === 'num') {
      if (countDigits(last.v) >= MAX_INPUT_DIGITS) return this;
      if (last.v === '0') last.v = d;
      else if (last.v === '-0') last.v = '-' + d;
      else last.v += d;
      return this;
    }
    if (last && (last.k === 'rp' || last.k === 'pct' || last.k === 'sq')) this.tokens.push(op('×'));
    this.tokens.push(num(d));
    return this;
  };

  CalcSession.prototype.dot = function () {
    this.startFreshIfDone();
    var last = this.last();
    if (last && last.k === 'num') {
      if (last.v.indexOf('.') === -1) last.v += '.';
      return this;
    }
    if (last && (last.k === 'rp' || last.k === 'pct' || last.k === 'sq')) this.tokens.push(op('×'));
    this.tokens.push(num('0.'));
    return this;
  };

  CalcSession.prototype.operator = function (o) {
    if (this.evaluated) this.evaluated = false;          // continue from the stored result

    if (!this.tokens.length) {
      if (o === '-') this.tokens.push(op('-'));
      return this;
    }
    var last = this.last();
    if (last.k === 'op') {
      this.tokens.pop();
      var prev = this.last();
      if (prev && prev.k === 'op') this.tokens.pop();
      if (!this.tokens.length) {
        if (o === '-') this.tokens.push(op('-'));
        return this;
      }
      this.tokens.push(op(o));
      return this;
    }
    if (last.k === 'lp' || last.k === 'fn') {
      if (o === '-') this.tokens.push(op('-'));
      return this;
    }
    this.tokens.push(op(o));
    return this;
  };

  CalcSession.prototype.openParen = function () {
    this.startFreshIfDone();
    var last = this.last();
    if (last && (last.k === 'num' || last.k === 'rp' || last.k === 'pct' || last.k === 'sq')) this.tokens.push(op('×'));
    this.tokens.push(lp());
    return this;
  };

  CalcSession.prototype.closeParen = function () {
    if (unclosedParens(this.tokens) <= 0) return this;
    var last = this.last();
    if (last && (last.k === 'num' || last.k === 'rp' || last.k === 'pct' || last.k === 'sq')) this.tokens.push(rp());
    return this;
  };

  CalcSession.prototype.percent = function () {
    var last = this.last();
    if (last && (last.k === 'num' || last.k === 'rp')) this.tokens.push(pct());
    return this;
  };

  CalcSession.prototype.backspace = function () {
    if (this.evaluated) return this.reset();
    var last = this.last();
    if (!last) return this;
    if (last.k === 'num' && last.v.length > 1) {
      last.v = last.v.slice(0, -1);
      if (last.v === '' || last.v === '-') this.tokens.pop();
      return this;
    }
    this.tokens.pop();
    return this;
  };

  CalcSession.prototype.negate = function () {
    if (this.evaluated) {
      if (this.result === null) return this;
      this.load(-this.result);
      return this;
    }
    var s = lastOperandStart(this.tokens);
    if (s < 0) return this;
    if (s > 0 && this.tokens[s - 1].k === 'op' && this.tokens[s - 1].v === '-' && isUnaryAt(this.tokens, s - 1)) {
      this.tokens.splice(s - 1, 1);                     // undo a unary minus
      return this;
    }
    this.tokens.splice(s, 0, op('-'));
    return this;
  };

  CalcSession.prototype.sqrt = function () {
    if (this.evaluated) {
      return this.applyToResult(function (v) {
        if (v < 0) throw new CalcError('Invalid input');
        return Math.sqrt(v);
      });
    }
    var s = lastOperandStart(this.tokens, true);
    if (s < 0) { this.tokens.push(fn('sqrt'), lp()); return this; }
    var operand = this.tokens.slice(s);
    this.tokens = this.tokens.slice(0, s).concat([fn('sqrt'), lp()], operand, [rp()]);
    return this;
  };

  CalcSession.prototype.square = function () {
    if (this.evaluated) {
      return this.applyToResult(function (v) { return v * v; });
    }
    var s = lastOperandStart(this.tokens, true);
    if (s < 0) return this;
    if (this.tokens[s].k === 'op') {
      // a signed operand needs grouping, so that (-5)² is 25 and not -(5²)
      var operand = this.tokens.slice(s);
      this.tokens = this.tokens.slice(0, s).concat([lp()], operand, [rp(), sq()]);
    } else {
      this.tokens.push(sq());
    }
    return this;
  };

  CalcSession.prototype.reciprocal = function () {
    if (this.evaluated) {
      return this.applyToResult(function (v) {
        if (v === 0) throw new CalcError('Cannot divide by zero');
        return 1 / v;
      });
    }
    var s = lastOperandStart(this.tokens, true);
    if (s < 0) return this;
    var operand = this.tokens.slice(s);
    this.tokens = this.tokens.slice(0, s).concat([lp(), num('1'), op('÷'), lp()], operand, [rp(), rp()]);
    return this;
  };

  CalcSession.prototype.applyToResult = function (fn) {
    try {
      var v = fn(this.result === null ? 0 : this.result);
      if (typeof v !== 'number' || v !== v || !isFinite(v)) throw new CalcError('Invalid input');
      this.load(v);
    } catch (err) {
      this.error = err && err.message ? err.message : 'Invalid input';
    }
    return this;
  };

  CalcSession.prototype.equals = function () {
    if (!this.tokens.length) return this;
    if (this.evaluated && this.tokens.length === 1 && this.tokens[0].k === 'num') return this;

    this.trimDangling();
    if (!this.tokens.length) return this;

    var open = unclosedParens(this.tokens);
    var res = calculate(this.source() + new Array(open + 1).join(')'));
    if (!res.ok) { this.error = res.error; return this; }

    var expression = this.pretty() + new Array(open + 1).join(')');
    this.history.unshift({ expression: expression, result: formatNumber(res.value), value: res.value });
    if (this.history.length > MAX_HISTORY) this.history.length = MAX_HISTORY;

    this.load(res.value);
    return this;
  };

  CalcSession.prototype.memoryAdd = function (sign) {
    var v = this.currentValue();
    if (v === null) return this;
    this.memory = roundToPrecision(this.memory + sign * v);
    this.memorySet = true;
    // Commit the entry: it stays on screen, but the next digit starts a new
    // number instead of appending to the one just stored.
    this.result = v;
    this.tokens = [num(toRaw(v))];
    this.evaluated = true;
    return this;
  };

  CalcSession.prototype.memoryRecall = function () {
    if (!this.memorySet) return this;
    this.startFreshIfDone();
    var last = this.last();
    if (last && (last.k === 'num' || last.k === 'rp' || last.k === 'pct' || last.k === 'sq')) this.tokens.push(op('×'));
    this.tokens.push(num(toRaw(this.memory)));
    return this;
  };

  /* --------------------------------------------------------------- view model */

  CalcSession.prototype.view = function () {
    var expression = this.pretty();
    var display;
    var preview = '';

    if (this.error) {
      display = this.error;
    } else if (this.evaluated && this.result !== null) {
      display = formatNumber(this.result);
    } else if (this.tokens.length) {
      var last = this.last();
      if (last.k === 'num') {
        var literal = last.v;
        var negated = last.k === 'num' && this.tokens.length >= 2 &&
          this.tokens[this.tokens.length - 2].k === 'op' &&
          this.tokens[this.tokens.length - 2].v === '-' &&
          isUnaryAt(this.tokens, this.tokens.length - 2);
        display = (negated && literal.charAt(0) !== '-' ? '-' : '') + groupDigits(literal);
      } else {
        var live = this.liveValue();
        var operand = this.currentOperandValue();
        if (operand !== null && live.ok && Math.abs(operand - live.value) > 1e-12) {
          display = formatNumber(operand);                // e.g. after x² show 25, preview = 27
        } else if (live.ok) {
          display = formatNumber(live.value);
        } else {
          var prefix = this.previewValue();
          display = prefix === null
            ? (this.lastLiteral() === null ? '0' : this.lastLiteral())
            : formatNumber(prefix);
        }
      }
    } else {
      display = this.result === null ? '0' : formatNumber(this.result);
    }

    if (!this.error && !this.evaluated && this.tokens.length > 1) {
      var live2 = this.liveValue();
      if (live2.ok && formatNumber(live2.value) !== display) preview = '= ' + formatNumber(live2.value);
    }

    return {
      expression: expression,
      display: display,
      preview: preview,
      error: this.error,
      evaluated: this.evaluated,
      memory: this.memorySet ? this.memory : null,
      pendingOp: lastBinaryOp(this.tokens),
      history: this.history.slice(0)
    };
  };

  /* -------------------------------------------------------------------- exports */

  return {
    CalcError: CalcError,
    tokenize: tokenize,
    parse: parse,
    evaluate: evaluate,
    calculate: calculate,
    formatNumber: formatNumber,
    groupDigits: groupDigits,
    toRaw: toRaw,
    roundToPrecision: roundToPrecision,
    CalcSession: CalcSession,
    KEYBOARD: KEYBOARD,
    keyFor: keyFor,
    MAX_INPUT_DIGITS: MAX_INPUT_DIGITS,
    MAX_HISTORY: MAX_HISTORY
  };
}));

// Core calculator: tokenize -> shunting-yard -> RPN eval. No eval().
// Supports + - * / ^ ( ) unary minus, decimals.

export function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = String(expr).replace(/\s+/g, "");
  if (s === "") throw new Error("Empty expression");
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = "";
      let dots = 0;
      while (i < s.length && /[0-9.]/.test(s[i])) {
        if (s[i] === ".") {
          dots++;
          if (dots > 1) throw new Error("Invalid number");
        }
        num += s[i++];
      }
      if (num === "." || num === "") throw new Error("Invalid number");
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if ("+-*/^()".includes(c)) {
      // detect unary minus / unary plus: at start, after '(' or another operator
      if ((c === "-" || c === "+") &&
          (tokens.length === 0 ||
           (tokens[tokens.length - 1].type === "op") ||
           (tokens[tokens.length - 1].type === "paren" && tokens[tokens.length - 1].value === "("))) {
        if (c === "+") { i++; continue; } // unary plus: no-op
        tokens.push({ type: "op", value: "u-" });
        i++;
        continue;
      }
      if ("+-*/^".includes(c)) tokens.push({ type: "op", value: c });
      else tokens.push({ type: "paren", value: c });
      i++;
      continue;
    }
    throw new Error("Invalid character: " + c);
  }
  return tokens;
}

const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "u-": 4 };
const RIGHT_ASSOC = new Set(["^", "u-"]);

export function toRPN(tokens) {
  const out = [];
  const stack = [];
  for (const t of tokens) {
    if (t.type === "num") out.push(t);
    else if (t.type === "op") {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "op") break;
        const pTop = PRECEDENCE[top.value];
        const pCur = PRECEDENCE[t.value];
        if (pTop > pCur || (pTop === pCur && !RIGHT_ASSOC.has(t.value))) out.push(stack.pop());
        else break;
      }
      stack.push(t);
    } else if (t.value === "(") {
      stack.push(t);
    } else {
      // ")"
      let found = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === "paren" && top.value === "(") { found = true; break; }
        out.push(top);
      }
      if (!found) throw new Error("Mismatched parentheses");
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.type === "paren") throw new Error("Mismatched parentheses");
    out.push(top);
  }
  return out;
}

export function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (t.type === "num") { st.push(t.value); continue; }
    if (t.value === "u-") {
      if (st.length < 1) throw new Error("Invalid expression");
      st.push(-st.pop());
      continue;
    }
    if (st.length < 2) throw new Error("Invalid expression");
    const b = st.pop(), a = st.pop();
    let r;
    switch (t.value) {
      case "+": r = a + b; break;
      case "-": r = a - b; break;
      case "*": r = a * b; break;
      case "/":
        if (b === 0) throw new Error("Division by zero");
        r = a / b; break;
      case "^": r = Math.pow(a, b); break;
      default: throw new Error("Unknown operator");
    }
    if (!Number.isFinite(r)) throw new Error("Math error");
    st.push(r);
  }
  if (st.length !== 1) throw new Error("Invalid expression");
  return st[0];
}

export function evaluate(expr) {
  // allow UI symbols
  const normalized = String(expr).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  return evalRPN(toRPN(tokenize(normalized)));
}

export function formatResult(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error("Math error");
  // fix float noise: round to 12 significant digits
  let r = Number(n.toPrecision(12));
  if (Object.is(r, -0)) r = 0;
  let s = String(r);
  // avoid exponential for reasonable magnitudes; keep as-is otherwise
  if (s.includes("e") || s.includes("E")) return s;
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  if (s === "") s = "0";
  return s;
}

export function evaluateFormatted(expr) {
  return formatResult(evaluate(expr));
}

/**
 * Small vector / angle / linear-algebra helpers.
 *
 * Everything here is pure: no DOM, no global state. The module is shared by the
 * browser UI, the solver and the Node test-suite.
 *
 * Conventions
 *  - Points are plain objects `{ x, y }` in world units (millimetres).
 *  - World space is y-up; the renderer flips the axis when drawing.
 *  - Angles are radians, measured counter-clockwise from +x.
 */

export const TAU = Math.PI * 2;
export const EPS = 1e-12;

export function vec(x, y) {
  return { x, y };
}

export function clone(p) {
  return { x: p.x, y: p.y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(a, s) {
  return { x: a.x * s, y: a.y * s };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

/** 2-D scalar cross product (z component of the 3-D cross product). */
export function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

export function len(a) {
  return Math.hypot(a.x, a.y);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Unit vector; returns {x:0,y:0} for a degenerate input instead of NaN. */
export function normalize(a) {
  const l = Math.hypot(a.x, a.y);
  if (l < EPS) return { x: 0, y: 0 };
  return { x: a.x / l, y: a.y / l };
}

/** Rotate `p` around `origin` by `angle` radians. */
export function rotateAround(p, origin, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** Rotate a free vector by `angle` radians. */
export function rotate(a, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Left-hand normal of a direction vector (rotate +90 degrees). */
export function perp(a) {
  return { x: -a.y, y: a.x };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function angleOf(d) {
  return Math.atan2(d.y, d.x);
}

export function deg(rad) {
  return (rad * 180) / Math.PI;
}

export function rad(degrees) {
  return (degrees * Math.PI) / 180;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapPi(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  else if (r <= -Math.PI) r += TAU;
  return r;
}

/** Difference `a - b` wrapped into (-PI, PI]. */
export function angleDiff(a, b) {
  return wrapPi(a - b);
}

/** Closest point on the infinite line through `a` in direction `d`. */
export function projectOnLine(p, a, d) {
  const t = dot(sub(p, a), d);
  return { point: add(a, mul(d, t)), t };
}

/** Closest point on the segment ab (t clamped to [0,1]); also returns t. */
export function projectOnSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return { point: clone(a), t: 0 };
  const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return { point: add(a, mul(ab, t)), t };
}

export function distanceToSegment(p, a, b) {
  return dist(p, projectOnSegment(p, a, b).point);
}

/**
 * Solve the dense linear system `A x = b` by Gaussian elimination with partial
 * pivoting. `A` is an array of rows (each an array of numbers) and is modified
 * in place. Returns `null` when the matrix is numerically singular.
 */
export function solveLinearSystem(A, b) {
  const n = b.length;
  if (n === 0) return [];
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(A[row][col]);
      if (v > best) {
        best = v;
        pivot = row;
      }
    }
    if (!(best > 1e-14)) return null;
    if (pivot !== col) {
      const tmp = A[pivot];
      A[pivot] = A[col];
      A[col] = tmp;
      const tb = b[pivot];
      b[pivot] = b[col];
      b[col] = tb;
    }
    const diag = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / diag;
      if (factor === 0) continue;
      A[row][col] = 0;
      for (let k = col + 1; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= A[row][k] * x[k];
    x[row] = sum / A[row][row];
  }
  return x;
}

/**
 * Numerical rank of a dense matrix (array of rows) using row echelon form with
 * partial pivoting. Used for the mobility / degree-of-freedom analysis.
 */
export function matrixRank(rows, tol = 1e-8) {
  const m = rows.map((r) => r.slice());
  const rowCount = m.length;
  if (rowCount === 0) return 0;
  const colCount = m[0].length;
  let rank = 0;
  let lead = 0;
  for (let col = 0; col < colCount && rank < rowCount; col++) {
    let pivot = -1;
    let best = tol;
    for (let row = rank; row < rowCount; row++) {
      const v = Math.abs(m[row][col]);
      if (v > best) {
        best = v;
        pivot = row;
      }
    }
    if (pivot < 0) continue;
    const tmp = m[pivot];
    m[pivot] = m[rank];
    m[rank] = tmp;
    const d = m[rank][col];
    for (let k = col; k < colCount; k++) m[rank][k] /= d;
    for (let row = 0; row < rowCount; row++) {
      if (row === rank) continue;
      const f = m[row][col];
      if (f === 0) continue;
      for (let k = col; k < colCount; k++) m[row][k] -= f * m[rank][k];
    }
    rank++;
  }
  return rank;
}

/** Format a number for display with a fixed number of decimals, trimming -0. */
export function fmt(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  const v = Math.abs(value) < 5e-12 ? 0 : value;
  return v.toFixed(decimals);
}

let idCounter = 0;

/** Deterministic-ish unique id, prefixed for readability in saved files. */
export function makeId(prefix = 'id') {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

/** Reset the id counter (tests use it to keep snapshots stable). */
export function resetIdCounter() {
  idCounter = 0;
}

export function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

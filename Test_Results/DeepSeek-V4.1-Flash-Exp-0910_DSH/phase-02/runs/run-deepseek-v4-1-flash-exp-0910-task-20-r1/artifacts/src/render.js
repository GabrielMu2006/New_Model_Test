/**
 * Canvas renderer.
 *
 * `renderScene(ctx, state)` draws the whole editor: grid, rails, links, joints,
 * motors, motion traces, dimensions and selection feedback.
 *
 * It only uses the standard CanvasRenderingContext2D API, so it can be driven
 * by a mock context in the Node test-suite, and it never reads global state.
 */

import { fmt } from './math.js';
import { JOINT_FIXED, JOINT_REVOLUTE, JOINT_SLIDER } from './model.js';
import { screenToWorld, worldToScreen } from './view.js';

export const THEME = {
  background: '#0f1420',
  gridMinor: 'rgba(255,255,255,0.045)',
  gridMajor: 'rgba(255,255,255,0.095)',
  axis: 'rgba(120,200,255,0.35)',
  axisLabel: 'rgba(190,225,255,0.65)',
  link: '#8fa3bf',
  linkOutline: '#0b0f18',
  linkGround: '#5d6b80',
  linkSelected: '#ffd166',
  linkHover: '#bcd2f0',
  jointStroke: '#0b0f18',
  revolute: '#4fc3f7',
  fixed: '#ff8a65',
  slider: '#9ccc65',
  jointSelected: '#ffd166',
  motor: '#f06292',
  track: 'rgba(156,204,101,0.55)',
  trackFill: 'rgba(156,204,101,0.10)',
  trackStop: '#ff7043',
  trace: 'rgba(126,231,255,0.55)',
  label: '#dce7f7',
  labelMuted: 'rgba(220,231,247,0.62)',
  labelBg: 'rgba(15,20,32,0.78)',
  dimension: '#b9c8dd',
  dimensionBg: 'rgba(15,20,32,0.72)',
  warning: '#ff7043',
  handle: '#ffd166',
  ghost: 'rgba(255,209,102,0.75)',
  snap: '#ffd166',
};

const FONT = '11px "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const FONT_SMALL = '10px "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const FONT_BOLD = 'bold 11px "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

function textWidth(ctx, text) {
  if (typeof ctx.measureText === 'function') {
    try {
      return ctx.measureText(text).width;
    } catch {
      /* mock contexts may not implement it */
    }
  }
  return text.length * 6;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawLabel(ctx, text, x, y, options = {}) {
  const {
    font = FONT,
    color = THEME.label,
    background = null,
    align = 'center',
    baseline = 'middle',
    padding = 3,
  } = options;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (background) {
    const w = textWidth(ctx, text) + padding * 2;
    const h = parseInt(font, 10) + padding * 2;
    let bx = x - padding;
    if (align === 'center') bx = x - w / 2;
    else if (align === 'right') bx = x - w + padding;
    let by = y - h / 2;
    if (baseline === 'top') by = y - padding;
    else if (baseline === 'bottom') by = y - h + padding;
    ctx.fillStyle = background;
    roundRect(ctx, bx, by, w, h, 4);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* --------------------------------------------------------------------- grid */

function chooseGridStep(baseStep, scale) {
  let step = baseStep > 0 ? baseStep : 10;
  let guard = 0;
  while (step * scale < 9 && guard < 40) {
    step = step < 10 ? step * 5 : step * 2;
    guard++;
  }
  while (step * scale > 90 && guard < 80) {
    step /= 2;
    guard++;
  }
  return step;
}

export function drawGrid(ctx, camera, width, height, options = {}) {
  const { gridSize = 10, showLabels = true } = options;
  const step = chooseGridStep(gridSize, camera.scale);
  const topLeft = screenToWorld(camera, { x: 0, y: 0 });
  const bottomRight = screenToWorld(camera, { x: width, y: height });
  const minX = Math.floor(Math.min(topLeft.x, bottomRight.x) / step) * step;
  const maxX = Math.ceil(Math.max(topLeft.x, bottomRight.x) / step) * step;
  const minY = Math.floor(Math.min(topLeft.y, bottomRight.y) / step) * step;
  const maxY = Math.ceil(Math.max(topLeft.y, bottomRight.y) / step) * step;

  ctx.save();
  ctx.lineWidth = 1;
  const maxLines = 400;
  let count = 0;
  for (let x = minX; x <= maxX && count < maxLines; x += step, count++) {
    const sx = Math.round(worldToScreen(camera, { x, y: 0 }).x) + 0.5;
    const major = Math.abs(Math.round(x / step) % 5) === 0;
    ctx.strokeStyle = major ? THEME.gridMajor : THEME.gridMinor;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
  }
  count = 0;
  for (let y = minY; y <= maxY && count < maxLines; y += step, count++) {
    const sy = Math.round(worldToScreen(camera, { x: 0, y }).y) + 0.5;
    const major = Math.abs(Math.round(y / step) % 5) === 0;
    ctx.strokeStyle = major ? THEME.gridMajor : THEME.gridMinor;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
  }

  // Axes
  const origin = worldToScreen(camera, { x: 0, y: 0 });
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1.25;
  if (origin.y >= 0 && origin.y <= height) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(origin.y) + 0.5);
    ctx.lineTo(width, Math.round(origin.y) + 0.5);
    ctx.stroke();
  }
  if (origin.x >= 0 && origin.x <= width) {
    ctx.beginPath();
    ctx.moveTo(Math.round(origin.x) + 0.5, 0);
    ctx.lineTo(Math.round(origin.x) + 0.5, height);
    ctx.stroke();
  }

  if (showLabels) {
    ctx.font = FONT_SMALL;
    ctx.fillStyle = THEME.axisLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelY = origin.y > 12 && origin.y < height - 12 ? origin.y + 3 : 6;
    for (let x = minX; x <= maxX && count < maxLines; x += step) {
      if (Math.abs(x) < 1e-9) continue;
      if (Math.abs((x / step) % 5) > 0.001) continue;
      const sx = worldToScreen(camera, { x, y: 0 }).x;
      if (sx < 20 || sx > width - 20) continue;
      ctx.fillText(String(Math.round(x)), sx, labelY);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let y = minY; y <= maxY; y += step) {
      if (Math.abs(y) < 1e-9) continue;
      if (Math.abs((y / step) % 5) > 0.001) continue;
      const sy = worldToScreen(camera, { x: 0, y }).y;
      if (sy < 12 || sy > height - 12) continue;
      ctx.fillText(String(Math.round(y)), Math.min(Math.max(origin.x + 4, 4), width - 30), sy - 6);
    }
  }
  ctx.restore();

  // Scale bar (bottom-left)
  ctx.save();
  const barWorld = step * 5;
  const barPx = barWorld * camera.scale;
  if (barPx > 30 && barPx < width * 0.6) {
    const x0 = 16;
    const y0 = height - 18;
    ctx.strokeStyle = THEME.labelMuted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + barPx, y0);
    ctx.moveTo(x0, y0 - 4);
    ctx.lineTo(x0, y0 + 4);
    ctx.moveTo(x0 + barPx, y0 - 4);
    ctx.lineTo(x0 + barPx, y0 + 4);
    ctx.stroke();
    drawLabel(ctx, `${Math.round(barWorld)} mm`, x0 + barPx / 2, y0 - 12, {
      font: FONT_SMALL,
      color: THEME.labelMuted,
    });
  }
  ctx.restore();
}

/* ----------------------------------------------------------------- entities */

function linkScreenPoints(state, link) {
  const { mechanism, camera } = state;
  const ja = mechanism.joints.find((j) => j.id === link.a);
  const jb = mechanism.joints.find((j) => j.id === link.b);
  if (!ja || !jb) return null;
  return { a: worldToScreen(camera, ja), b: worldToScreen(camera, jb), ja, jb };
}

function drawTrack(ctx, state, track) {
  const { camera, selection, hover } = state;
  const a = worldToScreen(camera, track.a);
  const b = worldToScreen(camera, track.b);
  const selected = selection.has(track.id);
  const hovered = hover && hover.kind === 'track' && hover.id === track.id;
  const u = { x: b.x - a.x, y: b.y - a.y };
  const l = Math.hypot(u.x, u.y) || 1;
  const dir = { x: u.x / l, y: u.y / l };
  const n = { x: -dir.y, y: dir.x };

  ctx.save();
  // Rail band, drawn slightly beyond the segment so it reads as a guide line.
  const extend = 14;
  const p0 = { x: a.x - dir.x * extend, y: a.y - dir.y * extend };
  const p1 = { x: b.x + dir.x * extend, y: b.y + dir.y * extend };
  ctx.strokeStyle = selected || hovered ? THEME.jointSelected : THEME.track;
  ctx.lineWidth = selected ? 5 : 4;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();

  ctx.strokeStyle = THEME.trackFill;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p0.x - n.x * 9, p0.y - n.y * 9);
  ctx.lineTo(p1.x - n.x * 9, p1.y - n.y * 9);
  ctx.moveTo(p0.x + n.x * 9, p0.y + n.y * 9);
  ctx.lineTo(p1.x + n.x * 9, p1.y + n.y * 9);
  ctx.stroke();

  // End caps / travel stops
  for (const [point, outward] of [
    [a, -1],
    [b, 1],
  ]) {
    ctx.strokeStyle = THEME.track;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(point.x - n.x * 7, point.y - n.y * 7);
    ctx.lineTo(point.x + n.x * 7, point.y + n.y * 7);
    ctx.stroke();
    if (state.options.showDimensions !== false) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + dir.x * outward * 10, point.y + dir.y * outward * 10);
      ctx.stroke();
    }
  }

  // Limit markers
  if (track.limits && track.limits.enabled) {
    const scale = camera.scale;
    const base = { x: a.x, y: a.y };
    const unit = { x: dir.x, y: dir.y };
    for (const [value, key] of [
      [track.limits.min, 'min'],
      [track.limits.max, 'max'],
    ]) {
      if (!Number.isFinite(value)) continue;
      const px = base.x + unit.x * value * scale;
      const py = base.y + unit.y * value * scale;
      ctx.strokeStyle = THEME.trackStop;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px - n.x * 8, py - n.y * 8);
      ctx.lineTo(px + n.x * 8, py + n.y * 8);
      ctx.stroke();
      drawLabel(ctx, `${key} ${Math.round(value)}`, px, py + 16, {
        font: FONT_SMALL,
        color: THEME.trackStop,
      });
    }
  }

  if (state.options.showDimensions !== false) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = Math.hypot(track.b.x - track.a.x, track.b.y - track.a.y);
    drawLabel(ctx, `${track.name} · ${fmt(length, 1)} mm`, mid.x - n.x * 18, mid.y - n.y * 18, {
      font: FONT_SMALL,
      color: THEME.track,
      background: THEME.dimensionBg,
    });
  }

  if (selected) {
    for (const point of [a, b]) {
      ctx.fillStyle = THEME.handle;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = THEME.linkOutline;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLink(ctx, state, link) {
  const points = linkScreenPoints(state, link);
  if (!points) return;
  const { a, b, ja, jb } = points;
  const { selection, hover, mechanism } = state;
  const selected = selection.has(link.id);
  const hovered = hover && hover.kind === 'link' && hover.id === link.id;
  const isGround = link.kind === 'ground' || (ja.type === JOINT_FIXED && jb.type === JOINT_FIXED);

  ctx.save();
  ctx.lineCap = 'round';
  // Outline
  ctx.strokeStyle = THEME.linkOutline;
  ctx.lineWidth = selected ? 13 : 11;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // Body
  ctx.strokeStyle = selected
    ? THEME.linkSelected
    : hovered
      ? THEME.linkHover
      : isGround
        ? THEME.linkGround
        : THEME.link;
  ctx.lineWidth = selected ? 8 : 6.5;
  if (isGround) ctx.setLineDash([12, 6]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Centre line makes rotation visible
  ctx.strokeStyle = 'rgba(15,20,32,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  if (state.options.showDimensions !== false) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const measured = Math.hypot(ja.x - jb.x, ja.y - jb.y);
    const error = measured - link.length;
    const bad = Math.abs(error) > 1e-4;
    const label = `${link.name} ${fmt(link.length, 2)} mm${bad ? ` (${error > 0 ? '+' : ''}${fmt(error, 3)})` : ''}`;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    drawLabel(ctx, label, mid.x + nx * 15, mid.y + ny * 15, {
      font: bad ? FONT_BOLD : FONT_SMALL,
      color: bad ? THEME.warning : THEME.dimension,
      background: THEME.dimensionBg,
    });
  }
  void mechanism;
}

function drawFixedSymbol(ctx, screen, size = 13) {
  ctx.save();
  ctx.strokeStyle = THEME.fixed;
  ctx.fillStyle = 'rgba(255,138,101,0.20)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y);
  ctx.lineTo(screen.x - size, screen.y + size * 1.25);
  ctx.lineTo(screen.x + size, screen.y + size * 1.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Hatching under the triangle
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const y = screen.y + size * 1.25;
  for (let i = -2; i <= 1; i++) {
    const x0 = screen.x + i * (size / 2) + 2;
    ctx.moveTo(x0, y + 7);
    ctx.lineTo(x0 + 6, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSliderBlock(ctx, screen, state, joint) {
  const track = state.mechanism.tracks.find((t) => t.id === joint.trackId);
  let angle = 0;
  if (track) {
    const a = worldToScreen(state.camera, track.a);
    const b = worldToScreen(state.camera, track.b);
    angle = Math.atan2(b.y - a.y, b.x - a.x);
  }
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(156,204,101,0.20)';
  ctx.strokeStyle = THEME.slider;
  ctx.lineWidth = 2;
  roundRect(ctx, -15, -10, 30, 20, 5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawJoint(ctx, state, joint) {
  const { camera, selection, hover, options, mechanism } = state;
  const screen = worldToScreen(camera, joint);
  const selected = selection.has(joint.id);
  const hovered = hover && hover.kind === 'joint' && hover.id === joint.id;
  const motorHere = mechanism.motors.some((m) => m.jointId === joint.id);

  if (joint.type === JOINT_SLIDER) drawSliderBlock(ctx, screen, state, joint);
  if (joint.type === JOINT_FIXED) drawFixedSymbol(ctx, screen);

  const isSlider = joint.type === JOINT_SLIDER;
  const radius = isSlider ? 5.5 : joint.type === JOINT_FIXED ? 7 : 6.5;
  const color = selected
    ? THEME.jointSelected
    : hovered
      ? THEME.linkHover
      : joint.type === JOINT_FIXED
        ? THEME.fixed
        : joint.type === JOINT_SLIDER
          ? THEME.slider
          : THEME.revolute;

  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1420';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (selected) {
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,209,102,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  if (options.showLabels !== false) {
    const label = joint.name;
    drawLabel(ctx, label, screen.x, screen.y - 16, {
      font: FONT_BOLD,
      color,
      background: THEME.labelBg,
    });
  }
  if (options.showCoordinates !== false || selected || hovered) {
    drawLabel(ctx, `(${fmt(joint.x, 1)}, ${fmt(joint.y, 1)})`, screen.x, screen.y + 20, {
      font: FONT_SMALL,
      color: THEME.labelMuted,
      background: THEME.labelBg,
    });
  }
  if (motorHere && options.showLabels !== false) {
    drawLabel(ctx, 'DRIVE', screen.x, screen.y - 32, {
      font: FONT_SMALL,
      color: THEME.motor,
      background: THEME.labelBg,
    });
  }
}

function drawMotor(ctx, state, motor) {
  const { camera, mechanism } = state;
  const joint = mechanism.joints.find((j) => j.id === motor.jointId);
  const link = mechanism.links.find((l) => l.id === motor.linkId);
  if (!joint || !link) return;
  const screen = worldToScreen(camera, joint);
  const linkReady = link.a === joint.id ? link.b : link.a;
  const other = mechanism.joints.find((j) => j.id === linkReady);
  if (!other) return;
  const angle = Math.atan2(other.y - joint.y, other.x - joint.x);
  const radius = 26;
  const spin = motor.enabled ? (motor.omega >= 0 ? 1 : -1) : 0;

  ctx.save();
  ctx.strokeStyle = THEME.motor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const start = -angle - 0.15;
  ctx.arc(screen.x, screen.y, radius, start, start - 1.9, true);
  ctx.stroke();

  // Arrow head at the end of the driving arc
  const endAngle = start - 1.9;
  const tip = { x: screen.x + Math.cos(endAngle) * radius, y: screen.y + Math.sin(endAngle) * radius };
  const tangent = { x: Math.sin(endAngle) * spin, y: -Math.cos(endAngle) * spin };
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - tangent.x * 8 - Math.cos(endAngle) * 4, tip.y - tangent.y * 8 - Math.sin(endAngle) * 4);
  ctx.lineTo(tip.x - tangent.x * 8 + Math.cos(endAngle) * 4, tip.y - tangent.y * 8 + Math.sin(endAngle) * 4);
  ctx.closePath();
  ctx.fillStyle = THEME.motor;
  ctx.fill();

  // Rotation direction marker
  drawLabel(ctx, motor.enabled ? `${spin >= 0 ? 'CCW' : 'CW'}` : 'off', screen.x, screen.y + 40, {
    font: FONT_SMALL,
    color: THEME.motor,
    background: THEME.labelBg,
  });
  ctx.restore();
}

function drawTraces(ctx, state) {
  const { simulation, camera, mechanism } = state;
  if (!simulation || !state.options.showTraces) return;
  ctx.save();
  ctx.lineWidth = 1.4;
  let index = 0;
  for (const joint of mechanism.joints) {
    const trace = simulation.traces.get(joint.id);
    index++;
    if (!trace || trace.length < 2) continue;
    const hue = (index * 47) % 360;
    ctx.strokeStyle = `hsla(${hue}, 80%, 70%, 0.55)`;
    ctx.beginPath();
    trace.forEach((p, i) => {
      const s = worldToScreen(camera, p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

function drawPending(ctx, state) {
  const { camera, pending } = state;
  if (!pending) return;
  if (pending.kind === 'link' && pending.from && pending.to) {
    const a = worldToScreen(camera, pending.from);
    const b = worldToScreen(camera, pending.to);
    ctx.save();
    ctx.strokeStyle = THEME.ghost;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const length = Math.hypot(pending.to.x - pending.from.x, pending.to.y - pending.from.y);
    drawLabel(ctx, `${fmt(length, 2)} mm`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 14, {
      font: FONT_SMALL,
      color: THEME.ghost,
      background: THEME.labelBg,
    });
    ctx.restore();
  }
  if (pending.kind === 'track' && pending.from && pending.to) {
    const a = worldToScreen(camera, pending.from);
    const b = worldToScreen(camera, pending.to);
    ctx.save();
    ctx.strokeStyle = THEME.slider;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  if (state.snapPoint) {
    const s = worldToScreen(camera, state.snapPoint);
    ctx.save();
    ctx.strokeStyle = THEME.snap;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
    ctx.moveTo(s.x - 12, s.y);
    ctx.lineTo(s.x + 12, s.y);
    ctx.moveTo(s.x, s.y - 12);
    ctx.lineTo(s.x, s.y + 12);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBanner(ctx, state, width) {
  const { simulation } = state;
  if (!simulation || !simulation.blocked || !simulation.message) return;
  ctx.save();
  const text = simulation.message;
  ctx.font = FONT;
  const w = Math.min(textWidth(ctx, text) + 28, width - 40);
  const x = width / 2 - w / 2;
  const y = 18;
  ctx.fillStyle = 'rgba(255,112,67,0.16)';
  roundRect(ctx, x, y, w, 30, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,112,67,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  drawLabel(ctx, text, width / 2, y + 15, { font: FONT, color: THEME.warning });
}

/* -------------------------------------------------------------------- scene */

export function renderScene(ctx, state) {
  const { width, height, camera, mechanism } = state;
  ctx.save();
  ctx.fillStyle = THEME.background;
  ctx.fillRect(0, 0, width, height);

  if (state.options.showGrid !== false) {
    drawGrid(ctx, camera, width, height, {
      gridSize: state.options.gridSize,
      showLabels: true,
    });
  }

  drawTraces(ctx, state);
  for (const track of mechanism.tracks) drawTrack(ctx, state, track);
  for (const link of mechanism.links) drawLink(ctx, state, link);
  for (const motor of mechanism.motors) drawMotor(ctx, state, motor);
  for (const joint of mechanism.joints) drawJoint(ctx, state, joint);
  drawPending(ctx, state);
  drawBanner(ctx, state, width);

  if (state.options.showLegend !== false) {
    const items = [
      ['Fixed pivot', THEME.fixed],
      ['Rotating joint', THEME.revolute],
      ['Slider', THEME.slider],
      ['Motor', THEME.motor],
    ];
    ctx.save();
    ctx.font = FONT_SMALL;
    let y = 20;
    const x = width - 130;
    for (const [label, color] of items) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = THEME.labelMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 10, y);
      y += 16;
    }
    ctx.restore();
  }
  ctx.restore();
}

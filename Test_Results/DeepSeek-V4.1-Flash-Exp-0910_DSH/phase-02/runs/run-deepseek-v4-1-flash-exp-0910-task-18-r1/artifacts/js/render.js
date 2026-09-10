/* ==========================================================================
   render.js — canvas 2D renderer for the machine.
   Pure drawing: it reads the physics state and never writes to it.
   ========================================================================== */
'use strict';

var Renderer = (function () {

  var PALETTE = {
    bg0: '#0a0d16', bg1: '#141a2a',
    wood: '#c98b52', woodDark: '#6d431f', woodLight: '#e8b47a',
    steel: '#9fb3c8', steelDark: '#3f4c5c', steelLight: '#dbe6f2',
    copper: '#e08a4a', copperDark: '#7d431a', copperLight: '#ffc48a',
    rubber: '#4a4f63', rubberLight: '#6c7590',
    spiral: '#7c8bd4', spiralLight: '#b9c4ff',
    brass: '#e2b857', brassDark: '#8a6a20'
  };

  function Renderer(canvas, machine, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.m = machine;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = machine.worldSize.w;
    this.h = machine.worldSize.h;
    this.camX = 0; this.camY = 0; this.zoom = 1;
    this.time = 0;
    this.sparks = [];
    this.confetti = [];
    this.finaleT = -1;
    this.shake = 0;
    this.stageGlow = [];
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var cw = Math.max(320, rect.width), ch = Math.max(200, rect.height);
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.viewW = cw; this.viewH = ch;
    /* fit the whole machine, with a small margin */
    var s = Math.min(cw / (this.w + 40), ch / (this.h + 40));
    this.zoom = s;
    this.offX = (cw - this.w * s) / 2;
    this.offY = (ch - this.h * s) / 2;
  };

  Renderer.prototype.toWorld = function (cx, cy) {
    return { x: (cx - this.offX) / this.zoom, y: (cy - this.offY) / this.zoom };
  };

  Renderer.prototype.addImpact = function (ev) {
    var n = Math.min(8, 2 + Math.floor(ev.speed / 260));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * Math.min(360, ev.speed * 0.5);
      this.sparks.push({
        x: ev.x, y: ev.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.35 + Math.random() * 0.3, max: 0.65,
        r: 1 + Math.random() * 2.4
      });
    }
    if (ev.speed > 420) this.shake = Math.min(7, this.shake + ev.speed / 320);
  };

  Renderer.prototype.startFinale = function () {
    this.finaleT = 0;
    var cx = this.m.bell.x, cy = this.m.bell.y;
    for (var i = 0; i < 160; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
      var sp = 220 + Math.random() * 520;
      this.confetti.push({
        x: cx + (Math.random() - 0.5) * 90, y: cy - 20,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14,
        w: 5 + Math.random() * 7, h: 8 + Math.random() * 12,
        color: ['#ffd166', '#ff8fb1', '#63e0ff', '#7cf5a0', '#b28bff', '#ffffff'][i % 6],
        life: 2.4 + Math.random() * 1.6
      });
    }
  };

  Renderer.prototype.update = function (dt, impacts) {
    this.time += dt;
    if (impacts) for (var i = 0; i < impacts.length; i++) this.addImpact(impacts[i]);

    for (var s = this.sparks.length - 1; s >= 0; s--) {
      var p = this.sparks[s];
      p.life -= dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) this.sparks.splice(s, 1);
    }
    for (var c = this.confetti.length - 1; c >= 0; c--) {
      var f = this.confetti[c];
      f.life -= dt;
      f.vy += 520 * dt;
      f.vx *= 0.995;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.life <= 0) this.confetti.splice(c, 1);
    }
    if (this.finaleT >= 0) this.finaleT += dt;
    this.shake *= Math.pow(0.0025, dt);
  };

  /* -- helpers ------------------------------------------------------------ */

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function capsule(ctx, ax, ay, bx, by, w, fill, stroke) {
    var dx = bx - ax, dy = by - ay;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var r = w / 2;
    ctx.beginPath();
    ctx.moveTo(ax + nx * r, ay + ny * r);
    ctx.lineTo(bx + nx * r, by + ny * r);
    ctx.arc(bx, by, r, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
    ctx.lineTo(ax - nx * r, ay - ny * r);
    ctx.arc(ax, ay, r, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  function styleFor(style) {
    switch (style) {
      case 'wood': return { a: PALETTE.wood, b: PALETTE.woodDark, c: PALETTE.woodLight };
      case 'copper': return { a: PALETTE.copper, b: PALETTE.copperDark, c: PALETTE.copperLight };
      case 'rubber': return { a: PALETTE.rubber, b: '#2a2e3d', c: PALETTE.rubberLight };
      case 'spiral': return { a: PALETTE.spiral, b: '#39406b', c: PALETTE.spiralLight };
      default: return { a: PALETTE.steel, b: PALETTE.steelDark, c: PALETTE.steelLight };
    }
  }

  function segGradient(ctx, seg, colors) {
    var g = ctx.createLinearGradient(seg.ax, seg.ay, seg.bx, seg.by);
    g.addColorStop(0, colors.c);
    g.addColorStop(0.5, colors.a);
    g.addColorStop(1, colors.b);
    return g;
  }

  /* -- main draw ---------------------------------------------------------- */

  Renderer.prototype.draw = function (state) {
    var ctx = this.ctx;
    var m = this.m;
    var W = this.viewW, H = this.viewH;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* background */
    var bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, PALETTE.bg1);
    bg.addColorStop(0.55, PALETTE.bg0);
    bg.addColorStop(1, '#05070d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    var sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    var sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(this.offX + sx, this.offY + sy);
    ctx.scale(this.zoom, this.zoom);

    this.drawBackdrop(ctx);
    this.drawStatics(ctx);
    this.drawDecor(ctx);
    this.drawTrails(ctx);
    this.drawBodies(ctx);
    this.drawSparks(ctx);
    this.drawConfetti(ctx);
    this.drawStageGlow(ctx, state);

    ctx.restore();
    this.drawVignette(ctx, W, H);
  };

  Renderer.prototype.drawBackdrop = function (ctx) {
    var W = this.w, H = this.h;
    /* soft grid */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(120,160,255,0.055)';
    ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y <= H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    /* warm pools of light behind each station */
    var glows = [
      [300, 250, 260, 'rgba(255,200,120,0.055)'],
      [700, 470, 240, 'rgba(120,200,255,0.05)'],
      [950, 620, 260, 'rgba(160,140,255,0.05)'],
      [1040, 900, 300, 'rgba(120,255,190,0.045)'],
      [700, 1060, 320, 'rgba(120,190,255,0.05)']
    ];
    for (var i = 0; i < glows.length; i++) {
      var g = glows[i];
      var rg = ctx.createRadialGradient(g[0], g[1], 0, g[0], g[1], g[2]);
      rg.addColorStop(0, g[3]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(g[0] - g[2], g[1] - g[2], g[2] * 2, g[2] * 2);
    }
  };

  Renderer.prototype.drawStatics = function (ctx) {
    var st = this.m.statics;
    for (var i = 0; i < st.length; i++) {
      var s = st[i];
      if (s.kind === 'wall' || s.kind === 'rail' || s.kind === 'curve') {
        var seg = s.seg;
        var colors = styleFor(s.style);
        /* shadow */
        ctx.save();
        ctx.globalAlpha = 0.35;
        capsule(ctx, seg.ax + 2, seg.ay + 3, seg.bx + 2, seg.by + 3, s.w, 'rgba(0,0,0,0.75)', null);
        ctx.restore();
        /* body */
        capsule(ctx, seg.ax, seg.ay, seg.bx, seg.by, s.w, segGradient(ctx, seg, colors), 'rgba(0,0,0,0.45)');
        /* highlight */
        ctx.save();
        ctx.globalAlpha = 0.5;
        var dx = seg.bx - seg.ax, dy = seg.by - seg.ay;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var off = s.w * 0.26;
        ctx.strokeStyle = colors.c;
        ctx.lineWidth = Math.max(1, s.w * 0.16);
        ctx.beginPath();
        ctx.moveTo(seg.ax + nx * off, seg.ay + ny * off);
        ctx.lineTo(seg.bx + nx * off, seg.by + ny * off);
        ctx.stroke();
        ctx.restore();
      } else if (s.kind === 'pulley') {
        this.drawPulley(ctx, s.x, s.y, s.r, s.color);
      } else if (s.kind === 'bell') {
        this.drawBell(ctx, s.x, s.y, s.r);
      }
    }
  };

  Renderer.prototype.drawPulley = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.6, color || PALETTE.brass);
    g.addColorStop(1, PALETTE.brassDark);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, 6.2832);
    ctx.fillStyle = '#2a2415'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 6.2832);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawBell = function (ctx, x, y, r) {
    var t = this.finaleT >= 0 ? Math.min(1, this.finaleT * 1.4) : 0;
    ctx.save();
    ctx.translate(x, y);
    var g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.5, PALETTE.brass);
    g.addColorStop(1, '#6b4d12');
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.35);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.55, -r * 0.42, -r * 0.86);
    ctx.quadraticCurveTo(0, -r * 1.05, r * 0.42, -r * 0.86);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.55, r, r * 0.35);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.38, r * 0.98, r * 0.2, 0, 0, 6.2832);
    ctx.fillStyle = '#8a6a20'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r * 0.9, r * 0.14, 0, 6.2832);
    ctx.fillStyle = '#3a2c08'; ctx.fill();
    if (t > 0) {
      ctx.globalAlpha = 0.6 * (1 - t * 0.4);
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3;
      for (var i = 0; i < 3; i++) {
        var rr = r * (0.7 + i * 0.55 + t * 1.6);
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.2832); ctx.stroke();
      }
    }
    ctx.restore();
  };

  Renderer.prototype.drawDecor = function (ctx) {
    var d = this.m.decor || [];
    for (var i = 0; i < d.length; i++) {
      var it = d[i];
      if (it.kind === 'gear') this.drawGear(ctx, it);
      else if (it.kind === 'pipe') this.drawPipe(ctx, it);
    }
  };

  Renderer.prototype.drawGear = function (ctx, it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(this.time * it.speed);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = it.color;
    var teeth = it.teeth;
    ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) {
      var a = (i / (teeth * 2)) * Math.PI * 2;
      var rr = i % 2 ? it.r : it.r * 0.86;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, it.r * 0.42, 0, 6.2832);
    ctx.fillStyle = '#0b0f1a'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, it.r * 0.62, 0, 6.2832);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawPipe = function (ctx, it) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = PALETTE.steelDark;
    ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(it.pts[0][0], it.pts[0][1]);
    for (var i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i][0], it.pts[i][1]);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.steel; ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawTrails = function (ctx) {
    var ms = this.m.marbles;
    ctx.save();
    ctx.lineCap = 'round';
    for (var i = 0; i < ms.length; i++) {
      var b = ms[i], tr = b.trail;
      if (!tr || tr.length < 2) continue;
      for (var j = 1; j < tr.length; j++) {
        var a = j / tr.length;
        ctx.globalAlpha = a * 0.34;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.r * 1.5 * a;
        ctx.beginPath();
        ctx.moveTo(tr[j - 1].x, tr[j - 1].y);
        ctx.lineTo(tr[j].x, tr[j].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  Renderer.prototype.drawBodies = function (ctx) {
    var bs = this.m.bodies;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      switch (b.kind) {
        case 'ball': this.drawBall(ctx, b); break;
        case 'domino': this.drawDomino(ctx, b); break;
        case 'ram': this.drawRam(ctx, b); break;
        case 'spring': this.drawSpring(ctx, b); break;
        case 'pendulum': this.drawPendulum(ctx, b); break;
        case 'cradleBall': this.drawCradleBall(ctx, b); break;
        case 'bucket': this.drawBucket(ctx, b); break;
        case 'gate': this.drawGate(ctx, b); break;
        case 'rope': this.drawRope(ctx, b); break;
        default: break;
      }
    }
  };

  Renderer.prototype.drawBall = function (ctx, b) {
    var p = b.p;
    ctx.save();
    ctx.translate(p.x, p.y);
    /* glow */
    var gg = ctx.createRadialGradient(0, 0, b.r * 0.2, 0, 0, b.r * 2.6);
    gg.addColorStop(0, b.color);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, 0, b.r * 2.6, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.rotate(p.angle);
    var g = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.15, 0, 0, b.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, b.color);
    g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.2832);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    /* spin marker */
    ctx.beginPath();
    ctx.arc(b.r * 0.45, 0, b.r * 0.22, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.7, 0); ctx.lineTo(-b.r * 0.2, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(1, b.r * 0.16);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawDomino = function (ctx, b) {
    var a = b.points[0], c = b.points[b.points.length - 1];
    ctx.save();
    ctx.globalAlpha = 0.3;
    capsule(ctx, a.x + 2, a.y + 3, c.x + 2, c.y + 3, b.w, 'rgba(0,0,0,0.8)', null);
    ctx.restore();
    var g = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
    g.addColorStop(0, b.color);
    g.addColorStop(1, '#4a2d12');
    capsule(ctx, a.x, a.y, c.x, c.y, b.w, g, 'rgba(0,0,0,0.5)');
    /* pips */
    ctx.save();
    var dx = c.x - a.x, dy = c.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var i = 1; i <= 2; i++) {
      var t = i / 3;
      ctx.beginPath();
      ctx.arc(a.x + dx * t, a.y + dy * t, b.w * 0.13, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawRam = function (ctx, b) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    capsule(ctx, b.a.x + 2, b.a.y + 3, b.b.x + 2, b.b.y + 3, b.w, 'rgba(0,0,0,0.8)', null);
    ctx.restore();
    var g = ctx.createLinearGradient(b.a.x, b.a.y - b.w / 2, b.a.x, b.a.y + b.w / 2);
    g.addColorStop(0, PALETTE.steelLight);
    g.addColorStop(0.5, PALETTE.steel);
    g.addColorStop(1, PALETTE.steelDark);
    capsule(ctx, b.a.x, b.a.y, b.b.x, b.b.y, b.w, g, 'rgba(0,0,0,0.5)');
    /* face plate */
    ctx.beginPath();
    ctx.arc(b.b.x, b.b.y, b.w * 0.52, 0, 6.2832);
    ctx.fillStyle = '#c9d6e4'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  };

  Renderer.prototype.drawSpring = function (ctx, b) {
    var a = b.anchor, p = b.p;
    var dx = p.x - a.x, dy = p.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len;
    var nx = -uy, ny = ux;
    var coils = 9, amp = 9;
    ctx.save();
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (var i = 1; i <= coils * 2; i++) {
      var t = i / (coils * 2);
      var side = (i % 2 ? 1 : -1) * amp * (1 - Math.abs(t - 0.5) * 0.5);
      ctx.lineTo(a.x + ux * len * t + nx * side, a.y + uy * len * t + ny * side);
    }
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,190,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawPendulum = function (ctx, b) {
    var pv = b.pivot, bob = b.bob;
    ctx.save();
    /* rod */
    ctx.strokeStyle = PALETTE.steelDark;
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(bob.x, bob.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(bob.x, bob.y); ctx.stroke();
    /* pivot */
    ctx.beginPath(); ctx.arc(pv.x, pv.y, 7, 0, 6.2832);
    ctx.fillStyle = PALETTE.steelLight; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    /* bob */
    var g = ctx.createRadialGradient(bob.x - b.r * 0.35, bob.y - b.r * 0.4, b.r * 0.2, bob.x, bob.y, b.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#b9c8da');
    g.addColorStop(1, '#2c3644');
    ctx.beginPath(); ctx.arc(bob.x, bob.y, b.r, 0, 6.2832);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawCradleBall = function (ctx, b) {
    var pv = b.pivot, bob = b.bob;
    ctx.save();
    ctx.strokeStyle = 'rgba(160,180,210,0.55)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(bob.x, bob.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(pv.x, pv.y, 4.5, 0, 6.2832);
    ctx.fillStyle = PALETTE.steelDark; ctx.fill();
    var g = ctx.createRadialGradient(bob.x - b.r * 0.35, bob.y - b.r * 0.4, b.r * 0.2, bob.x, bob.y, b.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#aebdd0');
    g.addColorStop(1, '#242c38');
    ctx.beginPath(); ctx.arc(bob.x, bob.y, b.r, 0, 6.2832);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawBucket = function (ctx, b) {
    var p = b.points;
    ctx.save();
    ctx.strokeStyle = PALETTE.copper;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p[1].x, p[1].y);
    ctx.lineTo(p[3].x, p[3].y);
    ctx.lineTo(p[2].x, p[2].y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,150,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    /* rope stub */
    ctx.strokeStyle = '#d8c9a0';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo((p[1].x + p[2].x) / 2, (p[1].y + p[2].y) / 2); ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawGate = function (ctx, b) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    capsule(ctx, b.a.x + 2, b.a.y + 2, b.b.x + 2, b.b.y + 2, b.w, 'rgba(0,0,0,0.8)', null);
    ctx.restore();
    var g = ctx.createLinearGradient(b.a.x - b.w / 2, 0, b.a.x + b.w / 2, 0);
    g.addColorStop(0, PALETTE.copperDark);
    g.addColorStop(0.4, PALETTE.copperLight);
    g.addColorStop(1, PALETTE.copperDark);
    capsule(ctx, b.a.x, b.a.y, b.b.x, b.b.y, b.w, g, 'rgba(0,0,0,0.5)');
  };

  Renderer.prototype.drawRope = function (ctx, b) {
    var a = b.a, c = b.b, pl = b.pulley;
    var d1 = Math.hypot(a.x - pl.x, a.y - pl.y) || 1;
    var d2 = Math.hypot(c.x - pl.x, c.y - pl.y) || 1;
    var a1 = Math.atan2(a.y - pl.y, a.x - pl.x);
    var a2 = Math.atan2(c.y - pl.y, c.x - pl.x);
    ctx.save();
    ctx.strokeStyle = '#d8c9a0';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(pl.x + Math.cos(a1) * pl.r, pl.y + Math.sin(a1) * pl.r);
    ctx.arc(pl.x, pl.y, pl.r, a1, a2, true);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawSparks = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.sparks.length; i++) {
      var p = this.sparks[i];
      var a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = a > 0.6 ? '#fff6d0' : '#ffb347';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a + 0.6, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawConfetti = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.confetti.length; i++) {
      var f = this.confetti[i];
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.fillStyle = f.color;
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    }
    ctx.restore();
  };

  Renderer.prototype.drawStageGlow = function (ctx, state) {
    if (!state || !state.focus) return;
    var f = state.focus;
    var t = state.pulse || 0;
    var r = 120 + Math.sin(this.time * 3) * 8 + t * 40;
    var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, 'rgba(255,235,160,' + (0.16 + t * 0.14) + ')');
    g.addColorStop(1, 'rgba(255,235,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.2832); ctx.fill();
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 0.55, 0, 6.2832);
    ctx.strokeStyle = 'rgba(255,235,160,' + (0.18 + t * 0.2) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  Renderer.prototype.drawVignette = function (ctx, W, H) {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  return Renderer;
})();

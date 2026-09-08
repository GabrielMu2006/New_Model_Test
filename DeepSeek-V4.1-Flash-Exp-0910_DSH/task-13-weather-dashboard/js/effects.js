/* ==========================================================================
   effects.js — ambient canvas weather. Exposed as window.WXEffects.
   set(state) swaps the particle system; respects prefers-reduced-motion.
   ========================================================================== */
(function (global) {
  'use strict';

  var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Effects(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.w = 0; this.h = 0;
    this.state = 'clear-day';
    this.parts = [];
    this.bolts = [];
    this.raf = 0;
    this.last = 0;
    this.t = 0;
    this._onResize = this.resize.bind(this);
    this._loop = this.loop.bind(this);
    global.addEventListener('resize', this._onResize);
    this.resize();
  }

  Effects.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.seed();
  };

  Effects.prototype.set = function (state) {
    if (state === this.state) return;
    this.state = state;
    this.seed();
    this.start();
  };

  Effects.prototype.seed = function () {
    var s = this.state, w = this.w, h = this.h, out = [];
    this.bolts = [];
    var i, n;

    if (s === 'clear-night' || s === 'partly-night' || s === 'cloudy-night') {
      n = Math.round((w * h) / 9000);
      for (i = 0; i < n; i++) {
        out.push({
          x: Math.random() * w, y: Math.random() * h * 0.86,
          r: Math.random() * 1.15 + 0.35,
          a: Math.random() * 0.6 + 0.2,
          tw: Math.random() * 0.9 + 0.35,
          ph: Math.random() * Math.PI * 2
        });
      }
    } else if (s === 'rain' || s === 'storm') {
      n = Math.round(w / 3.4);
      for (i = 0; i < n; i++) {
        out.push({
          x: Math.random() * (w + 120) - 60,
          y: Math.random() * h,
          len: Math.random() * 16 + 9,
          vy: Math.random() * 380 + 340,
          vx: -(Math.random() * 40 + 18),
          a: Math.random() * 0.35 + 0.18,
          w: Math.random() < .25 ? 1.5 : 1
        });
      }
      if (s === 'storm') this.nextBolt = 1.4;
    } else if (s === 'snow') {
      n = Math.round(w / 11);
      for (i = 0; i < n; i++) {
        out.push({
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() * 2.2 + 0.9,
          vy: Math.random() * 34 + 16,
          sw: Math.random() * 1.6 + 0.5,
          ph: Math.random() * Math.PI * 2,
          a: Math.random() * 0.5 + 0.35
        });
      }
    } else if (s === 'fog') {
      n = 9;
      for (i = 0; i < n; i++) {
        out.push({
          x: Math.random() * w, y: h * (0.25 + Math.random() * 0.7),
          rx: Math.random() * 260 + 140, ry: Math.random() * 40 + 22,
          vx: (Math.random() * 14 + 4) * (Math.random() < .5 ? 1 : -1),
          a: Math.random() * 0.1 + 0.05
        });
      }
    } else {
      /* Day / cloudy: soft drifting puffs of light. */
      n = s === 'clear-day' ? 18 : 12;
      for (i = 0; i < n; i++) {
        out.push({
          x: Math.random() * w, y: Math.random() * h * 0.8,
          r: Math.random() * 70 + 40,
          vx: (Math.random() * 9 + 3) * (s === 'clear-day' ? 1 : 1),
          vy: (Math.random() - .5) * 4,
          a: Math.random() * 0.05 + 0.02,
          ph: Math.random() * Math.PI * 2
        });
      }
    }
    this.parts = out;
  };

  Effects.prototype.start = function () {
    if (this.raf) return;
    if (reduce) { this.frame(0); return; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._loop);
  };
  Effects.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  Effects.prototype.loop = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.frame(dt);
    this.raf = requestAnimationFrame(this._loop);
  };

  Effects.prototype.frame = function (dt) {
    var ctx = this.ctx, w = this.w, h = this.h, s = this.state, i, p;
    ctx.clearRect(0, 0, w, h);

    if (s === 'clear-night' || s === 'partly-night' || s === 'cloudy-night') {
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        var tw = 0.55 + 0.45 * Math.sin(this.t * p.tw + p.ph);
        ctx.globalAlpha = p.a * tw;
        ctx.fillStyle = '#eaf1ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (s === 'rain' || s === 'storm') {
      ctx.lineCap = 'round';
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        if (dt) {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          if (p.y > h + 10) { p.y = -20 - Math.random() * 60; p.x = Math.random() * (w + 120) - 60; }
          if (p.x < -80) p.x = w + 40;
        }
        ctx.globalAlpha = p.a;
        ctx.strokeStyle = s === 'storm' ? 'rgba(198,214,255,.9)' : 'rgba(178,216,255,.9)';
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (p.vx / p.vy) * p.len, p.y + p.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (s === 'storm') {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = 2.6 + Math.random() * 5;
          this.bolts.push({ life: 0.42, x: Math.random() * w });
        }
        for (i = this.bolts.length - 1; i >= 0; i--) {
          var b = this.bolts[i];
          b.life -= dt;
          if (b.life <= 0) { this.bolts.splice(i, 1); continue; }
          var k = b.life / 0.42;
          var a = Math.sin(k * Math.PI * 3) * 0.22 * k;
          if (a > 0) {
            var grd = ctx.createLinearGradient(b.x, 0, b.x, h);
            grd.addColorStop(0, 'rgba(214,222,255,' + a.toFixed(3) + ')');
            grd.addColorStop(1, 'rgba(214,222,255,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }
      return;
    }

    if (s === 'snow') {
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        if (dt) {
          p.y += p.vy * dt;
          p.x += Math.sin(this.t * p.sw + p.ph) * 12 * dt;
          if (p.y > h + 6) { p.y = -8; p.x = Math.random() * w; }
        }
        ctx.globalAlpha = p.a;
        ctx.fillStyle = '#f2f8ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (s === 'fog') {
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        if (dt) {
          p.x += p.vx * dt;
          if (p.x - p.rx > w) p.x = -p.rx;
          if (p.x + p.rx < 0) p.x = w + p.rx;
        }
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx);
        g.addColorStop(0, 'rgba(226,234,246,' + p.a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(226,234,246,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 6.2832);
        ctx.fill();
      }
      return;
    }

    /* Day / cloudy drifting light puffs */
    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i];
      if (dt) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x - p.r > w) { p.x = -p.r; p.y = Math.random() * h * 0.8; }
      }
      var g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g2.addColorStop(0, 'rgba(255,255,255,' + p.a.toFixed(3) + ')');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
  };

  Effects.prototype.destroy = function () {
    this.stop();
    global.removeEventListener('resize', this._onResize);
  };

  global.WXEffects = { create: function (canvas) { return new Effects(canvas); }, reduced: reduce };
})(typeof window !== 'undefined' ? window : globalThis);

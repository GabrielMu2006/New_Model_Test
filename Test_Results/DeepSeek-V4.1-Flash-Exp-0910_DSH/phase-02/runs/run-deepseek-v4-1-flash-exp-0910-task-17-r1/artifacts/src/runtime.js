/* ------------------------------------------------------------------------
 * runtime.js — browser side of the standalone SVG.
 *
 * Consumes the model above (same <script> block) and only does two things:
 *   1. keep every rotating group in sync with the single master phase Q
 *   2. drive Q from real time, the speed slider and the pause button
 * The static markup already shows the movement at Q = 0, so a viewer without
 * JavaScript still sees a complete (frozen) movement.
 * ---------------------------------------------------------------------- */
(function () {
  'use strict';
  var M = (typeof globalThis !== 'undefined' ? globalThis : window).WatchModel;
  if (!M || typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    rotors: {}, springs: {},
    clock: $('clock-text'), power: $('power-text'), speed: $('speed-text'),
    beat: $('beat-text'), state: $('state-text'),
    play: $('btn-play'), iconPlay: $('icon-play'), iconPause: $('icon-pause'),
    knob: $('slider-knob'), fill: $('slider-fill'), wind: $('wind-btn'),
    windFill: $('power-bar-fill'), note: $('js-note'), root: document.documentElement
  };
  M.ROTORS.forEach(function (r) { el.rotors[r.id] = $(r.id); });
  el.springs.main = $('spring-main');
  el.springs.hair = $('spring-hair');

  /* ---------------- state --------------------------------------------- */
  var Q = 0;              // master phase: beats elapsed
  var speed = 1;          // 1 = real time
  var playing = true;
  var woundAt = 0;        // Q at the last winding
  var last = 0;
  var dirty = true;       // force a full redraw
  var shownSecond = -1;
  var lastMainPhase = NaN;
  var lastHairPhase = NaN;

  function power() { return M.windAt(Q, woundAt); }

  /* ---------------- rendering ----------------------------------------- */
  function setRot(spec, deg) {
    var g = el.rotors[spec.id];
    if (!g) return;
    var a = M.mod(deg, 360);
    var prev = g.__a;
    if (prev !== undefined && Math.abs(a - prev) < 0.004) return;
    g.__a = a;
    var p = M.ARBOR[spec.arbor];
    g.setAttribute('transform', spec.local
      ? 'translate(' + M.n(p.x) + ' ' + M.n(p.y) + ') rotate(' + M.n(a) + ')'
      : 'rotate(' + M.n(a) + ' ' + M.n(p.x) + ' ' + M.n(p.y) + ')');
  }

  function render() {
    var st = M.state(Q);
    st.wind = power();
    var r;
    for (r = 0; r < M.ROTORS.length; r++) {
      setRot(M.ROTORS[r], st[M.ROTORS[r].key]);
    }
    /* mainspring: regenerate only when the coil picture actually changed */
    var mainPhase = st.wind * 40 + st.barrel / 360;
    if (dirty || !(Math.abs(mainPhase - lastMainPhase) < 0.0025)) {
      lastMainPhase = mainPhase;
      el.springs.main.setAttribute('d', M.mainspringPath(st, M.MAINSPRING_GEO));
    }
    /* hairspring: breathes with every balance swing */
    var hairPhase = st.balance;
    if (dirty || !(Math.abs(hairPhase - lastHairPhase) < 0.05)) {
      lastHairPhase = hairPhase;
      el.springs.hair.setAttribute('d', M.hairspringPath(st, M.HAIRSPRING_GEO));
    }

    var sec = Math.floor(st.elapsedSeconds);
    if (dirty || sec !== shownSecond) {
      shownSecond = sec;
      if (el.clock) el.clock.textContent = M.clockText(M.BASE_TIME + st.elapsedSeconds);
    }
    var pct = Math.round(power() * 100);
    if (el.power) el.power.textContent = pct + '%';
    if (el.windFill) el.windFill.setAttribute('width', M.n(244 * power()));
    if (el.state) {
      el.state.textContent = !playing ? 'paused'
        : (power() <= 0.0005 ? 'run down \u2014 press wind' : 'running');
    }
    if (dirty) {
      if (el.iconPlay) el.iconPlay.style.display = playing ? 'none' : '';
      if (el.iconPause) el.iconPause.style.display = playing ? '' : 'none';
      if (el.play) el.play.setAttribute('aria-label', playing ? 'Pause animation' : 'Resume animation');
      if (el.note) el.note.style.display = 'none';
    }
    dirty = false;
  }

  function syncSpeedUi() {
    var u = M.speedToSlider(speed);
    var UI = M.UI, s = UI.slider;
    var x = s.x0 + (s.x1 - s.x0) * u;
    if (el.knob) {
      el.knob.setAttribute('cx', M.n(x));
      el.knob.setAttribute('cy', M.n(s.y));
    }
    if (el.fill) {
      el.fill.setAttribute('x', M.n(s.x0));
      el.fill.setAttribute('width', M.n(Math.max(0, x - s.x0)));
    }
    if (el.speed) {
      el.speed.textContent = M.speedText(speed) + (Math.abs(speed - 1) < 0.005 ? ' real time' : '');
    }
    if (el.beat) {
      el.beat.textContent = M.BEATS_PER_SEC + ' beats/s \u00b7 2 Hz \u00b7 ' +
        '14,400 A/h';
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (b) {
      var on = Math.abs(parseFloat(b.getAttribute('data-speed')) - speed) < 1e-6;
      b.setAttribute('class', 'chip' + (on ? ' chip-on' : ''));
    });
  }

  /* ---------------- clock --------------------------------------------- */
  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  var lastFrameAt = 0;
  function frame(t) {
    if (!last) last = t;
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    lastFrameAt = t;
    if (playing && M.isRunning(Q, woundAt)) {
      var dq = dt * speed * M.BEATS_PER_SEC;
      Q += dq;
      if (Q > woundAt + M.FULL_WIND_BEATS) Q = woundAt + M.FULL_WIND_BEATS;
      dirty = true;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  /* watchdog: some hosts (throttled tabs, headless renderers, embedded
   * viewers) never deliver animation frames. Keep the movement alive by
   * stepping from a timer whenever rAF has gone quiet. */
  setInterval(function () {
    if (now() - lastFrameAt > 250) frame(now());
  }, 120);

  /* ---------------- controls ------------------------------------------ */
  function setPlaying(v) {
    playing = v;
    dirty = true;
    if (el.play) el.play.setAttribute('aria-pressed', String(!v));
  }
  function setSpeed(v) {
    speed = M.clamp(v, M.SPEED_MIN, M.SPEED_MAX);
    syncSpeedUi();
  }
  function wind() {
    woundAt = Q;
    dirty = true;
  }
  function bind(id, ev, fn) {
    var node = $(id);
    if (node) node.addEventListener(ev, fn, false);
    return node;
  }

  bind('btn-play', 'click', function () { setPlaying(!playing); });
  bind('btn-play', 'keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPlaying(!playing); }
  });
  bind('wind-btn', 'click', wind);
  bind('wind-btn', 'keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); wind(); }
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (b) {
    bind(b.id, 'click', function () { setSpeed(parseFloat(b.getAttribute('data-speed'))); });
  });

  /* slider: click + drag + keyboard */
  (function () {
    var UI = M.UI, s = UI.slider;
    var track = $('slider-hit');
    var dragging = false;
    function uFromEvent(e) {
      var box = el.root.getBoundingClientRect();
      var scale = box.width / UI.width;
      var x = (e.clientX - box.left) / (scale || 1);
      return M.clamp((x - s.x0) / (s.x1 - s.x0), 0, 1);
    }
    if (track) {
      track.addEventListener('pointerdown', function (e) {
        dragging = true;
        try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        setSpeed(M.sliderToSpeed(uFromEvent(e)));
        e.preventDefault();
      });
      track.addEventListener('pointermove', function (e) {
        if (dragging) setSpeed(M.sliderToSpeed(uFromEvent(e)));
      });
      track.addEventListener('pointerup', function (e) {
        dragging = false;
        try { track.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      track.addEventListener('pointercancel', function () { dragging = false; });
    }
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === ' ') { e.preventDefault(); setPlaying(!playing); }
      else if (k === 'ArrowRight' || k === 'ArrowUp') { e.preventDefault(); setSpeed(speed * 1.35); }
      else if (k === 'ArrowLeft' || k === 'ArrowDown') { e.preventDefault(); setSpeed(speed / 1.35); }
      else if (k === 'w' || k === 'W') { wind(); }
      else if (k === 'r' || k === 'R') { Q = 0; woundAt = 0; dirty = true; }
    });
  })();

  syncSpeedUi();
  dirty = true;
  render();
})();

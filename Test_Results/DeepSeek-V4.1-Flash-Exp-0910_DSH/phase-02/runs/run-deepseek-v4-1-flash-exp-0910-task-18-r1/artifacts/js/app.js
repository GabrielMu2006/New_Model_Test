/* ==========================================================================
   app.js — session shell: fixed-step loop, transport controls, HUD.
   --------------------------------------------------------------------------
   The simulation always advances in fixed 1/240 s steps, so the machine
   behaves identically at any frame rate and on every machine. What the
   controls change is only *how much* simulation time is fed in per frame:
       running : real time x timeScale (1x, or 0.25x in slow-mo)
       paused  : nothing, until Step is pressed
       stepping: a queued slice is consumed slowly so motion stays watchable
   ========================================================================== */
'use strict';

(function () {

  var DT = 1 / 240;             /* fixed simulation step, matches physics   */
  var STEP_SLICE = 1 / 12;      /* sim time advanced by one Step press      */
  var STEP_RATE = 0.35;         /* playback rate while that slice is spent  */

  var canvas = document.getElementById('stage');
  var machine = buildMachine();
  var renderer = new Renderer(canvas, machine);

  var state = {
    mode: 'idle',               /* idle | running | paused | complete */
    timeScale: 1,
    acc: 0,
    stepBudget: 0,
    elapsed: 0,
    stageIndex: 0,
    pulse: 0,
    lastT: performance.now()
  };

  /* ---------------------------------------------------------------- HUD */

  var elStageList = document.getElementById('stage-list');
  var elTimer = document.getElementById('timer');
  var elBanner = document.getElementById('banner');
  var elStageNow = document.getElementById('stage-now');
  var elProgress = document.getElementById('progress-bar');
  var btnStart = document.getElementById('btn-start');
  var btnPause = document.getElementById('btn-pause');
  var btnStep = document.getElementById('btn-step');
  var btnReset = document.getElementById('btn-reset');
  var btnSlow = document.getElementById('btn-slow');
  var btnSound = document.getElementById('btn-sound');

  function buildStageList() {
    elStageList.innerHTML = '';
    for (var i = 0; i < machine.stages.length; i++) {
      var st = machine.stages[i];
      var li = document.createElement('li');
      li.className = 'stage';
      li.dataset.index = String(i);
      li.innerHTML = '<span class="num">' + st.id + '</span>' +
        '<span class="txt"><b>' + st.title + '</b><i>' + st.blurb + '</i></span>';
      elStageList.appendChild(li);
    }
  }

  function refreshStageList() {
    var items = elStageList.children;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var idx = Number(it.dataset.index);
      it.classList.toggle('done', !!machine.stages[idx].done);
      it.classList.toggle('active',
        idx === state.stageIndex && state.mode !== 'idle' && state.mode !== 'complete');
    }
    var cur = machine.stages[Math.min(state.stageIndex, machine.stages.length - 1)];
    elStageNow.textContent = state.mode === 'idle' ? 'Ready' :
      (state.mode === 'complete' ? 'Complete' : (cur ? cur.title : ''));
    elProgress.style.width = (100 * state.stageIndex / machine.stages.length) + '%';
  }

  function setMode(m) {
    state.mode = m;
    document.body.dataset.mode = m;

    if (m === 'running') {
      btnStart.textContent = 'Running'; btnStart.disabled = true;
    } else if (m === 'paused') {
      btnStart.textContent = 'Resume'; btnStart.disabled = false;
    } else if (m === 'complete') {
      btnStart.textContent = 'Run again'; btnStart.disabled = false;
    } else {
      btnStart.textContent = 'Start'; btnStart.disabled = false;
    }
    btnPause.disabled = (m !== 'running');
    btnStep.disabled = (m === 'running');

    var show = (m === 'idle' || m === 'complete');
    elBanner.classList.toggle('show', show);
    elBanner.textContent = (m === 'complete')
      ? 'Machine complete — press Run again or Reset'
      : 'Press Start to release the spring';
    refreshStageList();
  }

  /* ------------------------------------------------------- stage tracking */

  var finaleFired = false;

  function fireFinale() {
    if (finaleFired) return;
    finaleFired = true;
    Audio2.chime(880);
    Audio2.fanfare();
    renderer.startFinale();
  }

  /* Stages are *observers*: each test only reports whether its own
     precondition has been reached. Nothing here drives the motion. */
  function checkStages() {
    while (state.stageIndex < machine.stages.length) {
      var st = machine.stages[state.stageIndex];
      if (!st.test()) break;
      st.done = true;
      state.pulse = 1;
      Audio2.tick();
      state.stageIndex++;
      if (state.stageIndex >= machine.stages.length) {
        fireFinale();
        setMode('complete');
      } else {
        refreshStageList();
      }
    }
  }

  /* ------------------------------------------------------------- the loop */

  var trailClock = 0;

  function stepWorld(n) {
    var w = machine.world;
    for (var i = 0; i < n; i++) {
      w.step();
      var ev = w.impactEvents;
      for (var k = 0; k < ev.length; k++) {
        var e = ev[k];
        if (e.speed > 240) Audio2.clack(e.speed, e.mass || 1);
        else if (e.speed > 130) Audio2.wood(e.speed);
      }
      renderer.update(DT, ev);
    }
    machine.time = w.time;
    checkStages();
  }

  function sampleTrails() {
    var ms = machine.marbles;
    for (var i = 0; i < ms.length; i++) {
      var b = ms[i];
      if (b.p.escaped) { b.trail.length = 0; continue; }
      var last = b.trail[b.trail.length - 1];
      if (last) {
        var dx = b.p.x - last.x, dy = b.p.y - last.y;
        if (dx * dx + dy * dy < 4) continue;
      }
      b.trail.push({ x: b.p.x, y: b.p.y });
      if (b.trail.length > 24) b.trail.shift();
    }
  }

  function frame(now) {
    var real = Math.min(0.05, (now - state.lastT) / 1000);
    state.lastT = now;

    var simTime = 0;
    if (state.mode === 'running') {
      simTime = real * state.timeScale;
    } else if (state.stepBudget > 0) {
      var take = Math.min(state.stepBudget, real * STEP_RATE);
      state.stepBudget -= take;
      simTime = take;
    }

    if (simTime > 0) {
      state.acc += simTime;
      var steps = Math.floor(state.acc / DT);
      if (steps > 0) {
        state.acc -= steps * DT;
        stepWorld(steps);
      }
    }

    trailClock += real;
    if (trailClock > 0.025) { trailClock = 0; sampleTrails(); }

    state.pulse *= Math.pow(0.05, real);
    state.elapsed = machine.world.time;
    elTimer.textContent = state.elapsed.toFixed(2) + ' s';

    var focus = machine.stages[Math.min(state.stageIndex, machine.stages.length - 1)];
    renderer.draw({ focus: focus ? focus.focus : null, pulse: state.pulse });

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- controls */

  function start() {
    Audio2.resume();
    if (state.mode === 'complete') reset();
    if (state.mode === 'idle') {
      machine.release();
      Audio2.whoosh();
    }
    state.lastT = performance.now();
    setMode('running');
  }

  function pause() {
    if (state.mode === 'running') { state.acc = 0; setMode('paused'); }
  }

  function stepOnce() {
    if (state.mode === 'running') return;
    Audio2.resume();
    if (state.mode === 'idle') { machine.release(); }
    if (state.mode === 'complete') reset();
    state.stepBudget += STEP_SLICE;
    state.lastT = performance.now();
    setMode('paused');
  }

  function reset() {
    machine.reset();
    finaleFired = false;
    state.stageIndex = 0;
    state.stepBudget = 0;
    state.acc = 0;
    state.pulse = 0;
    state.elapsed = 0;
    state.lastT = performance.now();
    renderer.sparks.length = 0;
    renderer.confetti.length = 0;
    renderer.finaleT = -1;
    renderer.shake = 0;
    setMode('idle');
  }

  function toggleSlow() {
    state.timeScale = (state.timeScale === 1) ? 0.25 : 1;
    btnSlow.classList.toggle('on', state.timeScale !== 1);
    btnSlow.textContent = (state.timeScale === 1) ? 'Slow-mo' : 'Slow-mo \u00d70.25';
  }

  function toggleSound() {
    Audio2.setEnabled(!Audio2.isEnabled());
    btnSound.classList.toggle('on', Audio2.isEnabled());
    btnSound.textContent = Audio2.isEnabled() ? 'Sound on' : 'Sound off';
  }

  btnStart.addEventListener('click', start);
  btnPause.addEventListener('click', pause);
  btnStep.addEventListener('click', stepOnce);
  btnReset.addEventListener('click', reset);
  btnSlow.addEventListener('click', toggleSlow);
  btnSound.addEventListener('click', toggleSound);

  window.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (state.mode === 'running') pause(); else start(); }
    else if (e.code === 'ArrowRight' || e.code === 'Period') { e.preventDefault(); stepOnce(); }
    else if (e.code === 'KeyR') { e.preventDefault(); reset(); }
    else if (e.code === 'KeyS') { e.preventDefault(); toggleSlow(); }
    else if (e.code === 'KeyM') { e.preventDefault(); toggleSound(); }
  });

  window.addEventListener('resize', function () { renderer.resize(); });

  /* -------------------------------------------------------------- startup */

  machine.settle(2.2);          /* let the stack come to rest, freeze it     */
  buildStageList();
  setMode('idle');
  btnSound.classList.add('on');

  requestAnimationFrame(frame);

  /* exposed for the headless harness and for debugging in the console */
  window.RGM = {
    machine: machine,
    state: state,
    renderer: renderer,
    stepWorld: stepWorld,
    start: start,
    pause: pause,
    stepOnce: stepOnce,
    reset: reset
  };
})();

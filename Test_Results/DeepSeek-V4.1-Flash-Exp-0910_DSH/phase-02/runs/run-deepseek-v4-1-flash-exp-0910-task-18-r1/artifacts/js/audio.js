/* ==========================================================================
   audio.js — tiny WebAudio synthesiser. No samples, no network.
   Clacks for impacts, a chime for the bell, a whoosh for launches.
   ========================================================================== */
'use strict';

var Audio2 = (function () {
  var ctx = null, master = null, enabled = true, noiseBuf = null;

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    var len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return true;
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.5 : 0;
  }

  function isEnabled() { return enabled; }

  function noise(dur, freq, q, gain, type) {
    if (!enabled || !ensure()) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  function tone(freq, dur, gain, type) {
    if (!enabled || !ensure()) return;
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    resume: resume,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    /* impact: pitch and weight from the mass and speed of the hit */
    clack: function (speed, mass) {
      var s = Math.min(1, speed / 900);
      var m = Math.min(1.6, mass / 3);
      noise(0.05 + 0.06 * m, 900 + 2400 * s, 1.1, 0.05 + 0.18 * s);
      tone(150 + 420 * s, 0.06 + 0.05 * m, 0.05 + 0.1 * s, 'triangle');
    },
    wood: function (speed) {
      var s = Math.min(1, speed / 700);
      noise(0.09, 420 + 500 * s, 1.6, 0.06 + 0.12 * s, 'bandpass');
      tone(120 + 180 * s, 0.09, 0.05 + 0.07 * s, 'square');
    },
    whoosh: function () { noise(0.35, 1400, 0.7, 0.05, 'highpass'); },
    chime: function (base) {
      var f = base || 880;
      tone(f, 1.6, 0.16, 'sine');
      tone(f * 1.5, 1.3, 0.08, 'sine');
      tone(f * 2.02, 1.0, 0.05, 'sine');
      setTimeout(function () { tone(f * 0.75, 1.9, 0.1, 'sine'); }, 140);
    },
    fanfare: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) {
        (function (n, i) {
          setTimeout(function () { tone(n, 0.9, 0.13, 'triangle'); }, i * 120);
        })(notes[i], i);
      }
      setTimeout(function () { tone(1046.5, 2.2, 0.12, 'sine'); }, 560);
    },
    tick: function () { noise(0.03, 2600, 2, 0.05); }
  };
})();

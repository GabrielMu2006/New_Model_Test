/* ==========================================================================
 * main.js — DOM shell: wiring, controls, inspector, keyboard.
 *
 * Deliberately thin. All simulation and interaction logic lives in ui.js and
 * below; this file only moves values between the DOM and the App, so the
 * behaviour under test cannot diverge from the behaviour on screen.
 * ========================================================================== */
(function (global) {
  'use strict';

  var APP = global.SolarApp;
  var PLANET_ORDER = ['sun', 'mercury', 'venus', 'earth', 'mars',
                      'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

  function $(sel) { return document.querySelector(sel); }

  var canvas = $('#sky');
  var app = new APP.App(canvas);
  global.__solarApp = app;   // handy for debugging and for the smoke test

  /* ------------------------------------------------------------- elements */
  var el = {
    clockDate: $('#clockDate'),
    clockDay: $('#clockDay'),
    clockRate: $('#clockRate'),
    btnPlay: $('#btnPlay'),
    btnPlayLabel: $('#btnPlay .label'),
    btnResetTime: $('#btnResetTime'),
    btnHelp: $('#btnHelp'),
    helpDialog: $('#helpDialog'),
    helpClose: $('#helpClose'),

    speedRange: $('#speedRange'),
    speedReadout: $('#speedReadout'),
    speedPresets: $('#speedPresets'),
    speedPrecision: $('#speedPrecision'),
    yearHint: $('#yearHint'),
    speedHint: $('#speedHint'),

    zoomRange: $('#zoomRange'),
    zoomReadout: $('#zoomReadout'),
    viewPresets: $('#viewPresets'),
    btnPlanetView: $('#btnPlanetView'),
    tiltRange: $('#tiltRange'),

    toggleOrbits: $('#toggleOrbits'),
    toggleTrails: $('#toggleTrails'),
    toggleLabels: $('#toggleLabels'),
    toggleTrueScale: $('#toggleTrueScale'),

    focusDot: $('#focusDot'),
    focusName: $('#focusName'),
    btnSystemView: $('#btnSystemView'),
    btnFollow: $('#btnFollow'),
    followLabel: $('#followLabel'),

    bodyList: $('#bodyList'),
    bodyCount: $('#bodyCount'),

    readoutView: $('#readoutView'),
    readoutScale: $('#readoutScale'),
    toast: $('#toast'),

    btnZoomIn: $('#btnZoomIn'),
    btnZoomOut: $('#btnZoomOut'),

    inspector: $('#inspector'),
    inspectorClose: $('#inspectorClose'),
    inspectorSwatch: $('#inspectorSwatch'),
    inspectorName: $('#inspectorName'),
    inspectorKind: $('#inspectorKind'),
    inspectorBlurb: $('#inspectorBlurb'),
    inspectorLive: $('#inspectorLive'),
    inspectorFacts: $('#inspectorFacts'),
    inspectorSiblings: $('#inspectorSiblings'),
    siblingParent: $('#siblingParent'),
    siblingList: $('#siblingList'),
    btnFocusSelected: $('#btnFocusSelected'),
    btnFollowSelected: $('#btnFollowSelected')
  };

  /* ---------------------------------------------------- logarithmic speed */
  /* slider 0..1  <->  0.01 .. 10000 days/second, plus reverse. */
  var SPEED_MIN = 0.01, SPEED_MAX = 10000;

  function sliderToSpeed(v) {
    // v in [-4, 4]; |v| maps 0..4 -> MIN..MAX (3 decades)
    if (v === 0) return 0;
    var sign = v < 0 ? -1 : 1;
    var a = Math.abs(v);
    var t = (a - 1) / 3;                       // 1..4 -> 0..1
    var days = SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, t);
    // The first notch down from 0 is 0 (a dead zone, so 0 is easy to hit).
    return sign * days;
  }

  function speedToSlider(speed) {
    if (speed === 0) return 0;
    var sign = speed < 0 ? -1 : 1;
    var a = Math.abs(speed);
    var t = Math.log(a / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN);
    return sign * (1 + t * 3);
  }

  /* ------------------------------------------------------------ body list */
  function buildBodyList() {
    var sim = app.sim;
    var frag = document.createDocumentFragment();
    var count = 0;

    function item(body, isMoon) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'body-item' + (isMoon ? ' is-moon' : '');
      b.dataset.id = body.id;
      b.setAttribute('aria-label', 'Inspect ' + body.name);

      var sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = body.color;
      sw.style.color = body.color;
      b.appendChild(sw);

      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = body.name;
      b.appendChild(nm);

      var per = document.createElement('span');
      per.className = 'per';
      per.textContent = body.kind === 'star'
        ? 'star'
        : APP.formatPeriod(body.period).replace(' ', '');
      b.appendChild(per);

      b.addEventListener('click', function () {
        app.select(body.id);
        app.focusOn(body.id);
        closeDrawerIfMobile();
      });
      frag.appendChild(b);
      count++;
    }

    PLANET_ORDER.forEach(function (id) {
      var b = sim.byId[id];
      if (!b) return;
      item(b, false);
      var moons = sim.moonsByParent[id];
      if (moons && moons.length) {
        moons.forEach(function (m) { item(m, true); });
      }
    });

    el.bodyList.textContent = '';
    el.bodyList.appendChild(frag);
    el.bodyCount.textContent = count + ' bodies';
  }

  function syncBodyListSelection() {
    var items = el.bodyList.querySelectorAll('.body-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-selected', items[i].dataset.id === app.selectedId);
    }
  }

  /* ------------------------------------------------------------ inspector */
  function kindLabel(body) {
    if (body.kind === 'star') return 'Star · centre of mass';
    if (body.kind === 'planet') return 'Planet · ' + body.a.toFixed(3) + ' AU from the Sun';
    if (body.kind === 'dwarf') return 'Dwarf planet · ' + body.a.toFixed(2) + ' AU from the Sun';
    var parent = app.sim.byId[body.parent];
    return 'Moon of ' + (parent ? parent.name : body.parent);
  }

  function addRow(dl, label, value, live) {
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    dd.textContent = value;
    if (live) dd.className = 'is-live';
    dl.appendChild(dt);
    dl.appendChild(dd);
    return dd;
  }

  function renderInspectorStatic(body) {
    el.inspectorSwatch.style.background = body.color;
    el.inspectorSwatch.style.color = body.color;
    el.inspectorName.textContent = body.name;
    el.inspectorKind.textContent = kindLabel(body);
    el.inspectorBlurb.textContent = body.blurb || '';

    el.inspectorFacts.textContent = '';
    var facts = body.facts || {};
    Object.keys(facts).forEach(function (k) {
      addRow(el.inspectorFacts, k, facts[k], false);
    });

    // Sibling moons, so the inspector doubles as navigation.
    var parentId = body.kind === 'moon' ? body.parent : body.id;
    var sibs = app.sim.moonsByParent[parentId] || [];
    if (sibs.length) {
      el.inspectorSiblings.hidden = false;
      var parent = app.sim.byId[parentId];
      el.siblingParent.textContent = parent ? parent.name : parentId;
      el.siblingList.textContent = '';
      sibs.forEach(function (m) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sibling' + (m.id === app.selectedId ? ' is-selected' : '');
        btn.dataset.id = m.id;
        var sw = document.createElement('span');
        sw.className = 'swatch';
        sw.style.background = m.color;
        btn.appendChild(sw);
        var nm = document.createElement('span');
        nm.textContent = m.name;
        btn.appendChild(nm);
        var per = document.createElement('span');
        per.className = 'per';
        per.textContent = APP.formatPeriod(m.period);
        btn.appendChild(per);
        btn.addEventListener('click', function () {
          app.select(m.id);
        });
        el.siblingList.appendChild(btn);
      });
    } else {
      el.inspectorSiblings.hidden = true;
    }
  }

  function renderInspectorLive(body, info) {
    if (!info) return;
    el.inspectorLive.textContent = '';
    if (body.kind === 'star') {
      addRow(el.inspectorLive, 'Radius', '696,340 km', false);
      addRow(el.inspectorLive, 'Rotation period', APP.formatPeriod(body.rotDays), false);
      addRow(el.inspectorLive, 'Bodies orbiting', String(app.sim.bodies.length - 1) + ' shown', false);
      return;
    }
    addRow(el.inspectorLive, 'Orbital period', APP.formatPeriod(body.period), false);
    addRow(el.inspectorLive, 'Angular speed',
      (360 / body.period).toFixed(360 / body.period < 1 ? 4 : 3) + '\u00b0 / day', false);
    addRow(el.inspectorLive, 'Orbital speed',
      info.velocityKms.toFixed(2) + ' km/s', false);

    if (body.kind === 'moon') {
      addRow(el.inspectorLive, 'Distance from Sun',
        APP.formatDistanceAU(info.distanceAU), true);
      addRow(el.inspectorLive, 'Distance from ' + app.sim.byId[body.parent].name,
        APP.formatDistanceAU(info.parentDistanceAU), true);
      addRow(el.inspectorLive, 'Orbital phase',
        info.phaseDeg.toFixed(1) + '\u00b0', true);
    } else {
      addRow(el.inspectorLive, 'Distance from Sun',
        APP.formatDistanceAU(info.distanceAU), true);
      addRow(el.inspectorLive, 'Ecliptic longitude',
        info.longitudeDeg.toFixed(1) + '\u00b0', true);
      addRow(el.inspectorLive, 'Eccentricity', body.e.toFixed(4), false);
      addRow(el.inspectorLive, 'Inclination', body.inc.toFixed(2) + '\u00b0', false);
    }
  }

  function showInspector(id) {
    var body = app.sim.byId[id];
    if (!body) { el.inspector.hidden = true; return; }
    renderInspectorStatic(body);
    renderInspectorLive(body, app.liveInfo(id));
    el.inspector.hidden = false;
    el.btnFollowSelected.setAttribute('aria-pressed', String(!!app.follow));
  }

  /* --------------------------------------------------------- DOM syncing */
  function syncClock() {
    el.clockDate.textContent = APP.formatSimDate(app.sim.time);
    el.clockDay.textContent = 'day ' + Math.round(app.sim.time).toLocaleString();
    el.clockRate.textContent = app.paused ? 'paused' : APP.formatSpeed(app.speed);
  }

  function syncSpeed() {
    var v = sliderToSpeed(parseFloat(el.speedRange.value));
    app.speed = app.paused ? app.speed : v;
    app._sliderSpeed = v;
    el.speedReadout.textContent = APP.formatSpeed(v === 0 ? 0 : v);
    var chips = el.speedPresets ? el.speedPresets.querySelectorAll('.chip') : [];
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('is-active',
        Math.abs(parseFloat(chips[i].dataset.speed) - v) < 1e-9);
    }
    el.yearHint.textContent = v === 0
      ? 'Paused — nothing advances.'
      : '1 year \u2248 ' + (365.256 / Math.abs(v)).toFixed(Math.abs(v) > 30 ? 0 : 1) + ' s at this speed';
  }

  function syncZoom() {
    var v = parseFloat(el.zoomRange.value);
    var zoom = Math.pow(10, v);
    if (Math.abs(Math.log(app.cam.zoom) - v * Math.LN10) > 1e-4) {
      app.setZoom(zoom);
    }
    el.zoomReadout.textContent = '\u00d7 ' + (zoom >= 100 ? zoom.toFixed(0)
      : zoom >= 10 ? zoom.toFixed(1) : zoom.toFixed(2));
    var btns = el.viewPresets.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var p = btns[i].dataset.preset;
      var match = false;
      if (p === 'full') match = Math.abs(v - Math.log10(APP.ZOOM_FULL)) < 0.02;
      else if (p === 'system') match = !app.focusId && Math.abs(v - Math.log10(APP.ZOOM_SYSTEM)) < 0.02;
      else if (p === 'inner') match = !app.focusId && Math.abs(v - Math.log10(APP.ZOOM_INNER)) < 0.02;
      else if (p === 'planet') match = !!app.focusId;
      btns[i].classList.toggle('is-active', match);
    }
    el.btnPlanetView.disabled = !app.selectedId;
  }

  function syncFocus() {
    var id = app.focusId;
    var body = id ? app.sim.byId[id] : null;
    el.focusName.textContent = body ? body.name : 'Whole system';
    el.focusDot.style.background = body ? body.color : 'var(--text-faint)';
    el.focusDot.style.color = body ? body.color : 'transparent';
    el.btnFollow.disabled = !body;
    el.btnFollow.setAttribute('aria-pressed', String(!!app.follow && !!body));
    el.followLabel.textContent = app.follow && body ? 'Following' : 'Follow';
  }

  function syncOverlay() {
    var deep = app.cam.zoom > 12;
    var body = app.focusId ? app.sim.byId[app.focusId] : null;
    el.readoutView.textContent = body
      ? (deep ? body.name + ' view' : 'Approaching ' + body.name)
      : 'Solar System view';

    var scale = app._scale;
    if (scale) {
      var pxPerAU = app.cam.zoom * scale.K;
      var txt = pxPerAU >= 40
        ? '1 AU \u2248 ' + pxPerAU.toFixed(0) + ' px'
        : '1 AU \u2248 ' + pxPerAU.toFixed(1) + ' px';
      // Honest reporting at extreme speeds, where the trail sampler is capped.
      if (app.trailLag) txt += ' \u00b7 trails catching up';
      el.readoutScale.textContent = txt;
    }
  }

  function syncToast() {
    var now = performance.now();
    if (app._toast && now < app._toastUntil) {
      if (el.toast.hidden || el.toast.textContent !== app._toast) {
        el.toast.textContent = app._toast;
        el.toast.hidden = false;
      }
    } else if (!el.toast.hidden) {
      el.toast.hidden = true;
    }
  }

  /* Frame hook: cheap DOM work, throttled. */
  var lastInspector = 0;
  app.onFrame = function (a, real) {
    syncClock();
    syncOverlay();
    syncToast();

    // Keep the zoom slider honest when the wheel or double-click changed it.
    var v = Math.log10(a.cam.zoom);
    if (Math.abs(parseFloat(el.zoomRange.value) - v) > 0.0008) {
      el.zoomRange.value = String(clampNum(v, parseFloat(el.zoomRange.min), parseFloat(el.zoomRange.max)));
      syncZoom();
    }
    el.tiltRange.value = String(a.cam.tilt);

    lastInspector += real;
    if (a.selectedId && lastInspector > 0.1) {
      lastInspector = 0;
      var body = a.sim.byId[a.selectedId];
      if (body) renderInspectorLive(body, a.liveInfo(a.selectedId));
    }
  };

  function clampNum(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  app.onSelect = function (id) {
    syncBodyListSelection();
    if (id) showInspector(id);
    else el.inspector.hidden = true;
    syncZoom();
  };

  app.onFocus = function () {
    syncFocus();
    syncZoom();
  };

  app._syncFollow = function () { syncFocus(); };

  /* ------------------------------------------------------------- controls */

  /**
   * Delegated click targets can be a text node's parent, or an SVG child that
   * has no closest() in very old engines. Guard once here rather than in every
   * handler, so a stray event can never take the whole page down.
   */
  function closestButton(ev) {
    var t = ev.target;
    return (t && typeof t.closest === 'function') ? t.closest('button') : null;
  }

  el.btnPlay.addEventListener('click', function () {
    var paused = app.togglePlay();
    if (!paused && app._sliderSpeed === 0) {
      el.speedRange.value = '1';
      syncSpeed();
      app.speed = sliderToSpeed(1);
    }
    el.btnPlay.setAttribute('aria-pressed', String(paused));
    el.btnPlayLabel.textContent = paused ? 'Resume' : 'Pause';
    app.toast(paused ? 'Paused' : 'Running at ' + APP.formatSpeed(app.speed));
  });

  el.btnResetTime.addEventListener('click', function () {
    app.resetTime();
    app.toast('Simulation time reset to J2000 (1 Jan 2000)');
  });

  el.speedRange.addEventListener('input', function () {
    syncSpeed();
    if (app.paused && app._sliderSpeed !== 0) {
      app.paused = false;
      el.btnPlay.setAttribute('aria-pressed', 'false');
      el.btnPlayLabel.textContent = 'Pause';
    }
  });

  Array.prototype.forEach.call(
    el.speedPresets ? el.speedPresets.querySelectorAll('.chip') : [],
    function (chip) {
      chip.addEventListener('click', function () {
        var s = parseFloat(chip.dataset.speed);
        el.speedRange.value = String(speedToSlider(s));
        syncSpeed();
        app.setSpeed(s);
        el.btnPlay.setAttribute('aria-pressed', String(app.paused));
        el.btnPlayLabel.textContent = app.paused ? 'Resume' : 'Pause';
      });
    });

  el.speedPrecision.addEventListener('click', function (ev) {
    var btn = closestButton(ev);
    if (!btn) return;
    var step = parseFloat(btn.dataset.step);
    Array.prototype.forEach.call(el.speedPrecision.children, function (c) {
      c.classList.toggle('is-active', c === btn);
    });
    // Re-quantise the current slider position to the new step.
    var cur = parseFloat(el.speedRange.value);
    el.speedRange.step = String(step);
    el.speedRange.value = String(Math.round(cur / step) * step);
    syncSpeed();
  });

  el.zoomRange.addEventListener('input', function () {
    app.setZoom(Math.pow(10, parseFloat(el.zoomRange.value)), true);
    syncZoom();
  });

  el.tiltRange.addEventListener('input', function () {
    app.cam.tilt = parseFloat(el.tiltRange.value);
  });

  el.viewPresets.addEventListener('click', function (ev) {
    var btn = closestButton(ev);
    if (!btn) return;
    var preset = btn.dataset.preset;
    if (preset === 'system') {
      app.fitSystem();
      app.toast('Solar System view');
    } else if (preset === 'full') {
      app.focusId = null;
      app.setZoom(APP.ZOOM_FULL);
      app.panTo(0, 0);
      app.toast('Whole system — out to Pluto');
    } else if (preset === 'inner') {
      app.focusId = null;
      app.setZoom(APP.ZOOM_INNER);
      app.panTo(0, 0);
      app.toast('Inner Solar System view');
    } else if (preset === 'planet') {
      if (!app.selectedId) return;
      app.focusOn(app.selectedId);
      app.toast('Focused on ' + app.sim.byId[app.selectedId].name);
    }
    syncFocus();
    syncZoom();
  });

  el.btnSystemView.addEventListener('click', function () {
    app.fitSystem();
    syncFocus();
    syncZoom();
    app.toast('Back to the Solar System view');
  });

  el.btnZoomIn.addEventListener('click', function () {
    var c = app._view;
    if (c) app.zoomAt(1.6, c.cx, c.cy);
  });
  el.btnZoomOut.addEventListener('click', function () {
    var c = app._view;
    if (c) app.zoomAt(1 / 1.6, c.cx, c.cy);
  });

  function bindToggle(input, key) {
    input.addEventListener('change', function () {
      app.setOption(key, input.checked);
    });
    app.setOption(key, input.checked);
  }
  bindToggle(el.toggleOrbits, 'orbits');
  bindToggle(el.toggleTrails, 'trails');
  bindToggle(el.toggleLabels, 'labels');
  bindToggle(el.toggleTrueScale, 'trueScale');

  el.btnFollow.addEventListener('click', function () {
    var on = app.setFollow(!app.follow);
    app.toast(on ? 'Following ' + app.sim.byId[app.focusId].name
                 : 'Follow off');
    syncFocus();
  });

  el.btnFocusSelected.addEventListener('click', function () {
    if (!app.selectedId) return;
    app.focusOn(app.selectedId);
    app.toast('Focused on ' + app.sim.byId[app.selectedId].name);
  });

  el.btnFollowSelected.addEventListener('click', function () {
    var on = app.setFollow(!app.follow);
    el.btnFollowSelected.setAttribute('aria-pressed', String(on));
    syncFocus();
  });

  el.inspectorClose.addEventListener('click', function () {
    app.select(null);
  });

  el.btnHelp.addEventListener('click', function () {
    if (el.helpDialog.showModal) el.helpDialog.showModal();
    else el.helpDialog.setAttribute('open', '');
  });
  el.helpClose.addEventListener('click', function () {
    if (el.helpDialog.close) el.helpDialog.close();
    else el.helpDialog.removeAttribute('open');
  });

  /* ------------------------------------------------------------ keyboard */
  var PLANET_KEYS = ['mercury', 'venus', 'earth', 'mars',
                     'jupiter', 'saturn', 'uranus', 'neptune'];

  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (t && typeof t.closest === 'function' && t.closest('input, textarea, select')) return;
    var k = ev.key;

    if (k === ' ') {
      ev.preventDefault();
      el.btnPlay.click();
      return;
    }
    if (k === 'Escape') {
      if (!el.inspector.hidden) { app.select(null); return; }
      app.fitSystem();
      return;
    }
    if (k === '+' || k === '=') {
      var v = app._view;
      if (v) app.zoomAt(1.35, v.cx, v.cy);
      return;
    }
    if (k === '-' || k === '_') {
      var v2 = app._view;
      if (v2) app.zoomAt(1 / 1.35, v2.cx, v2.cy);
      return;
    }
    if (k === '0') { app.fitSystem(); syncFocus(); syncZoom(); return; }
    if (k === 't' || k === 'T') {
      el.toggleTrails.checked = !el.toggleTrails.checked;
      el.toggleTrails.dispatchEvent(new Event('change'));
      return;
    }
    if (k === 'o' || k === 'O') {
      el.toggleOrbits.checked = !el.toggleOrbits.checked;
      el.toggleOrbits.dispatchEvent(new Event('change'));
      return;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      ev.preventDefault();
      var dir = k === 'ArrowRight' ? 1 : -1;
      var nv = clampNum(parseFloat(el.speedRange.value) + dir * app.speedPrecision * 10,
        parseFloat(el.speedRange.min), parseFloat(el.speedRange.max));
      el.speedRange.value = String(nv);
      syncSpeed();
      if (app.paused && app._sliderSpeed !== 0) el.btnPlay.click();
      return;
    }
    var n = parseInt(k, 10);
    if (n >= 1 && n <= 8) {
      var id = PLANET_KEYS[n - 1];
      app.select(id);
      app.focusOn(id);
      app.toast('Focused on ' + app.sim.byId[id].name);
      return;
    }
  });

  /* ---------------------------------------------------------- mobile nav */
  function closeDrawerIfMobile() {
    if (global.innerWidth <= 820) {
      // On narrow layouts the sidebar sits below the stage; scroll it into
      // view so the selection is visible without a separate drawer.
      document.getElementById('sidebar').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ------------------------------------------------------------- startup */
  function boot() {
    buildBodyList();
    app.attach();

    // Seed the controls from the app's real state, not the other way round.
    el.zoomRange.value = String(Math.log10(app.cam.zoom));
    el.zoomRange.min = String(Math.log10(APP.ZOOM_MIN || 0.32));
    app._sliderSpeed = 1;
    el.speedRange.value = String(speedToSlider(1));
    app.speed = 1;
    app.paused = true;
    el.btnPlay.setAttribute('aria-pressed', 'true');
    el.btnPlayLabel.textContent = 'Resume';
    syncSpeed();
    syncZoom();
    syncFocus();
    syncClock();

    // Start paused on the whole system, then begin running so the first thing
    // the user sees is motion.
    app.select('earth');
    app.toast('Click any body to inspect it · drag to pan · wheel to zoom', 4200);

    global.setTimeout(function () {
      if (app.paused) {
        app.paused = false;
        el.btnPlay.setAttribute('aria-pressed', 'false');
        el.btnPlayLabel.textContent = 'Pause';
      }
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);

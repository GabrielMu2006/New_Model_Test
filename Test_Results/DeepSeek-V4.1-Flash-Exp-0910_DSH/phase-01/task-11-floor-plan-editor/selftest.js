/**
 * selftest.js — runs inside a real browser (see run-tests.js) and drives the
 * editor through synthetic pointer events, exactly like a user would.
 *
 * Results are written into #out as JSON between ### markers so the Node
 * runner can parse them out of --dump-dom output.
 */
(function () {
  'use strict';

  var results = [];
  var pageErrors = [];

  function check(name, cond, extra) {
    results.push({ name: name, ok: !!cond, extra: extra === undefined ? null : extra });
  }

  function finish() {
    var payload = { results: results, pageErrors: pageErrors, failed: results.filter(function (r) { return !r.ok; }).length };
    document.getElementById('out').textContent = '###' + JSON.stringify(payload) + '###';
  }

  window.addEventListener('error', function (e) {
    pageErrors.push(String(e.message || e));
  });

  // Make sure the app starts from a clean slate (the iframe boots after this).
  try { localStorage.removeItem('floorplan-editor.v1'); } catch (err) { /* ignore */ }

  var frame = document.createElement('iframe');
  frame.id = 'frame';
  frame.src = 'index.html';
  document.body.appendChild(frame);

  var tries = 0;
  function waitForBoot() {
    var w;
    try { w = frame.contentWindow; } catch (err) { w = null; }
    if (w && w.FloorPlan && w.FloorPlan.state && w.FloorPlan.state.walls.length) return run(w);
    if (++tries > 120) {
      check('app booted', false, 'timed out waiting for FloorPlan hook');
      return finish();
    }
    setTimeout(waitForBoot, 50);
  }

  function run(w) {
    var F = w.FloorPlan;
    var doc = w.document;
    var cv = doc.getElementById('cv');

    function pe(type, x, y, opts) {
      var r = cv.getBoundingClientRect();
      var init = Object.assign({
        bubbles: true, cancelable: true,
        clientX: r.left + x, clientY: r.top + y,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        button: 0, buttons: type === 'pointerup' ? 0 : 1
      }, opts || {});
      cv.dispatchEvent(new w.PointerEvent(type, init));
    }
    function drag(x1, y1, x2, y2, opts) {
      pe('pointerdown', x1, y1, opts);
      pe('pointermove', (x1 + x2) / 2, (y1 + y2) / 2, opts);
      pe('pointermove', x2, y2, opts);
      pe('pointerup', x2, y2, opts);
    }
    function click(x, y) { pe('pointerdown', x, y); pe('pointerup', x, y); }
    function at(x, y) { return F.toScreen({ x: x, y: y }); }

    try {
      // ---------------- boot -------------------------------------------
      check('geometry module loaded', !!w.FloorPlanGeom);
      check('app booted with scripting hook', !!F);
      check('demo plan: 6 walls', F.state.walls.length === 6, F.state.walls.length);
      check('demo plan: 10 objects', F.state.objects.length === 10, F.state.objects.length);
      check('demo plan: 7 openings', F.state.openings.length === 7, F.state.openings.length);

      // ---------------- object shapes ----------------------------------
      var plant = F.state.objects.filter(function (o) { return o.kind === 'plant'; })[0];
      var bboxCorner = { x: plant.x + plant.w / 2 - 0.01, y: plant.y + plant.h / 2 - 0.01 };
      check('round presets stay round (ellipse, not rect)',
        plant.round === true && !w.FloorPlanGeom.pointInObject(bboxCorner, plant),
        { round: plant.round, cornerInside: w.FloorPlanGeom.pointInObject(bboxCorner, plant) });

      // ---------------- room detection ---------------------------------
      var rooms = F.rooms().map(function (r) {
        return [+r.width.toFixed(2), +r.height.toFixed(2), +r.area.toFixed(2)];
      });
      check('3 rooms detected from the wall graph', rooms.length === 3, rooms);
      check('room dimensions are correct (5×6 / 3×3.2 / 3×2.8)',
        JSON.stringify(rooms) === '[[5,6,30],[3,3.2,9.6],[3,2.8,8.4]]', rooms);

      // ---------------- draw walls with the wall tool -------------------
      F.setTool('wall');
      var a = at(10, 1), b = at(14, 1), c = at(14, 4), d = at(10, 4);
      drag(a.x, a.y, b.x, b.y);
      drag(b.x, b.y, c.x, c.y);
      drag(c.x, c.y, d.x, d.y);
      drag(d.x, d.y, a.x, a.y);
      check('dragging draws 4 walls (10 total)', F.state.walls.length === 10, F.state.walls.length);

      var endpoints = [];
      F.state.walls.slice(-4).forEach(function (wall) {
        endpoints.push(wall.ax + ',' + wall.ay, wall.bx + ',' + wall.by);
      });
      check('chained walls snap to shared endpoints',
        new Set(endpoints).size === 4 && endpoints.length === 8, endpoints);

      var rooms2 = F.rooms();
      check('the new closed loop becomes a 4th room', rooms2.length === 4, rooms2.length);
      var newRoom = rooms2.filter(function (r) { return r.width === 4 && r.height === 3; });
      check('new room measures 4 × 3 m = 12 m²',
        newRoom.length === 1 && Math.abs(newRoom[0].area - 12) < 1e-9,
        newRoom.map(function (r) { return r.area; }));

      // ---------------- undo / redo ------------------------------------
      F.undo(); F.undo();
      check('undo removes the last two walls', F.state.walls.length === 8, F.state.walls.length);
      F.redo(); F.redo();
      check('redo restores them', F.state.walls.length === 10, F.state.walls.length);

      // ---------------- doors ------------------------------------------
      F.setTool('door');
      var onWall = at(12, 1);
      click(onWall.x, onWall.y);
      check('clicking a wall adds a door (8 openings)', F.state.openings.length === 8, F.state.openings.length);
      var newDoor = F.state.openings[7];
      check('new opening is a door', newDoor && newDoor.kind === 'door', newDoor && newDoor.kind);
      check('default door width is 0.9 m', newDoor && Math.abs(newDoor.width - 0.9) < 1e-9, newDoor && newDoor.width);
      check('a door does not break room detection', F.rooms().length === 4, F.rooms().length);

      // ---------------- windows ----------------------------------------
      F.setTool('window');
      var onWall2 = at(14, 2.5);
      click(onWall2.x, onWall2.y);
      var lastOp = F.state.openings[F.state.openings.length - 1];
      check('clicking a wall adds a window', F.state.openings.length === 9 && lastOp.kind === 'window',
        { count: F.state.openings.length, kind: lastOp.kind });

      // ---------------- drag a door along its wall ---------------------
      F.setTool('select');
      var beforeT = F.state.openings[7].t;
      var p1 = at(12, 1), p2 = at(13, 1);
      drag(p1.x, p1.y, p2.x, p2.y);
      check('door slides along the wall when dragged', F.state.openings[7].t > beforeT,
        { before: beforeT, after: F.state.openings[7].t });

      // ---------------- drag furniture ---------------------------------
      var table = F.state.objects.filter(function (o) { return o.kind === 'table'; })[0];
      var from = { x: table.x, y: table.y };
      var s1 = F.toScreen(from), s2 = F.toScreen({ x: from.x + 0.7, y: from.y + 0.5 });
      drag(s1.x, s1.y, s2.x, s2.y);
      check('furniture drags to the new position',
        Math.abs(table.x - from.x - 0.7) < 0.06 && Math.abs(table.y - from.y - 0.5) < 0.06,
        { from: from, to: { x: table.x, y: table.y } });
      check('dragged object stays on the 0.1 m grid',
        Math.abs(table.x * 10 - Math.round(table.x * 10)) < 1e-6, table.x);

      // ---------------- click select + delete + undo -------------------
      var plant = F.state.objects.filter(function (o) { return o.kind === 'plant'; })[0];
      var pp = F.toScreen(plant);
      click(pp.x, pp.y);
      check('clicking selects exactly one object', F.state.sel.size === 1, F.state.sel.size);
      var propsText = doc.getElementById('props-body').textContent;
      check('properties panel shows the object', /Plant/.test(propsText) && /Rotation/.test(propsText),
        propsText.slice(0, 80));
      F.deleteSelection();
      check('Delete removes the selected object', F.state.objects.length === 9, F.state.objects.length);
      F.undo();
      check('undo restores it', F.state.objects.length === 10, F.state.objects.length);

      // ---------------- drag a wall endpoint ---------------------------
      var wall0 = F.state.walls[0];
      var beforeEnd = { x: wall0.bx, y: wall0.by };
      var sel = F.toScreen({ x: wall0.ax, y: wall0.ay });
      click(sel.x, sel.y);
      check('clicking a wall selects it', F.state.sel.size === 1, F.state.sel.size);
      var hnd = F.toScreen({ x: wall0.bx, y: wall0.by });
      var target = F.toScreen({ x: beforeEnd.x, y: beforeEnd.y + 0.5 });
      drag(hnd.x, hnd.y, target.x, target.y);
      check('wall endpoint handle drags the endpoint',
        Math.abs(wall0.by - beforeEnd.y - 0.5) < 0.06,
        { before: beforeEnd.y, after: wall0.by });
      F.undo();

      // ---------------- room label click shows dimensions --------------
      var r0 = F.rooms()[0];
      var rp = F.toScreen(r0.centroid);
      click(rp.x, rp.y);
      var roomProps = doc.getElementById('props-body').textContent;
      check('clicking a room label shows size and area',
        /5\.00 × 6\.00 m/.test(roomProps) && /30\.00 m²/.test(roomProps), roomProps.slice(0, 100));

      // ---------------- dimension lines for a selected room ------------
      // Regression: the dimension-line labels must render while a room is
      // selected (they previously referenced an out-of-scope view object).
      click(rp.x, rp.y);
      var dimErr = null;
      try { F.render(); } catch (err) { dimErr = String(err && err.message || err); }
      var gDim = cv.getContext('2d');
      var dprDim = w.devicePixelRatio || 1;
      function hasDimInk(worldPt) {
        var sp = F.toScreen(worldPt);
        var x = Math.round(sp.x * dprDim), y = Math.round(sp.y * dprDim);
        if (x < 3 || y < 3 || x > cv.width - 4 || y > cv.height - 4) return 'offscreen';
        var d = gDim.getImageData(x - 3, y - 3, 7, 7).data;
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 2] > 60 && d[i + 2] > d[i] + 6) return true; // slate-blue dimension ink
        }
        return false;
      }
      var b0 = F.rooms()[0].bounds;
      var inkH = hasDimInk({ x: b0.minX + 1, y: b0.minY - 0.45 });
      var inkV = hasDimInk({ x: b0.minX - 0.45, y: b0.minY + 1 });
      check('selected room renders dimension lines',
        dimErr === null && inkH === true && inkV === true,
        { error: dimErr, horizontal: inkH, vertical: inkV });

      // ---------------- remaining tool / panel paths --------------------
      var pathErr = null;
      function path(label, fn, verify) {
        var err = null;
        try { fn(); } catch (e) { err = String(e && e.message || e); }
        var ok = err === null;
        var detail = err;
        if (ok && verify) {
          var v = null;
          try { v = verify(); } catch (e2) { v = String(e2); }
          ok = v === true;
          detail = v;
        }
        check(label, ok, detail);
        if (err) pathErr = err;
      }
      function key(k, opts) {
        w.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, opts || {})));
      }
      function keyUp(k) { w.dispatchEvent(new w.KeyboardEvent('keyup', { key: k, bubbles: true })); }

      path('wheel zooms the view', function () {
        var before = F.state.scale;
        cv.dispatchEvent(new w.WheelEvent('wheel', { deltaY: -120, clientX: 400, clientY: 400, bubbles: true, cancelable: true }));
        if (!(F.state.scale > before)) throw new Error('scale did not change');
      });
      path('space + drag pans the view', function () {
        key(' ');
        var before = { x: F.state.panX, y: F.state.panY };
        var a = at(12, 5), b = at(12.5, 5.5);
        drag(a.x, a.y, b.x, b.y);
        keyUp(' ');
        if (F.state.panX === before.x && F.state.panY === before.y) throw new Error('view did not pan');
      });
      path('marquee drag selects a group', function () {
        F.setTool('select');
        F.fit(); // normalise the view after the zoom/pan checks above
        var p = at(9.5, 0.5), q = at(14.5, 4.5); // encloses the room drawn earlier
        drag(p.x, p.y, q.x, q.y);
        if (F.state.sel.size < 4) throw new Error('selected ' + F.state.sel.size + ' items');
      });
      path('Escape clears the selection', function () {
        key('Escape');
        if (F.state.sel.size !== 0) throw new Error('still selected');
      });
      path('R rotates the selected object', function () {
        var o = F.state.objects.filter(function (x) { return x.kind === 'chair'; })[0];
        var sp = F.toScreen(o);
        click(sp.x, sp.y);
        var before = o.rot;
        key('r');
        if (o.rot <= before) throw new Error('rotation unchanged');
      });
      path('Ctrl+D duplicates the selected object', function () {
        var before = F.state.objects.length;
        key('d', { ctrlKey: true });
        if (F.state.objects.length !== before + 1) throw new Error('count ' + F.state.objects.length);
      });
      path('Ctrl+Z undoes the duplicate', function () {
        key('z', { ctrlKey: true });
        if (F.state.objects.length !== 10) throw new Error('count ' + F.state.objects.length);
      });
      path('Shift+F flips a door swing', function () {
        F.setTool('select');
        var door = F.state.openings[0];
        var wl = F.state.walls.filter(function (x) { return x.id === door.wallId; })[0];
        var sp = F.toScreen({ x: wl.ax + (wl.bx - wl.ax) * door.t, y: wl.ay + (wl.by - wl.ay) * door.t });
        click(sp.x, sp.y);
        var before = !!door.flip;
        key('F', { shiftKey: true });
        if (door.flip === before) throw new Error('flip unchanged');
      });
      path('G toggles snapping', function () {
        var before = F.state.snap;
        key('g');
        if (F.state.snap === before) throw new Error('snap unchanged');
        key('g');
      });
      path('Dims button toggles room labels', function () {
        var btn = doc.getElementById('btn-dims');
        var before = btn.classList.contains('active');
        btn.click();
        if (btn.classList.contains('active') === before) throw new Error('no toggle');
        btn.click();
      });
      path('Fit button re-centres the view', function () { doc.getElementById('btn-fit').click(); });
      path('help panel toggles', function () {
        var btn = doc.getElementById('btn-help');
        btn.click();
        if (!doc.getElementById('help').classList.contains('open')) throw new Error('not open');
        btn.click();
        if (doc.getElementById('help').classList.contains('open')) throw new Error('not closed');
      });
      path('New plan is cancelled when the user declines', function () {
        var realConfirm = w.confirm;
        w.confirm = function () { return false; };
        doc.getElementById('btn-new').click();
        w.confirm = realConfirm;
        if (F.state.walls.length === 0) throw new Error('plan was wiped');
      });
      path('delete via the properties panel works', function () {
        var wall = F.state.walls[F.state.walls.length - 1];
        var sp = F.toScreen({ x: (wall.ax + wall.bx) / 2, y: (wall.ay + wall.by) / 2 });
        click(sp.x, sp.y);
        var before = F.state.walls.length;
        var btn = doc.getElementById('pp-del');
        if (!btn) throw new Error('no delete button in panel');
        btn.click();
        if (F.state.walls.length !== before - 1) throw new Error('wall not deleted');
        F.undo();
      });

      // ---------------- furniture palette ------------------------------
      var palette = doc.querySelectorAll('#palette button');
      check('furniture palette has 10 presets', palette.length === 10, palette.length);
      var before = F.state.objects.length;
      F.setTool('select');
      palette[2].click(); // Table
      var spot = at(12.5, 2.5);
      click(spot.x, spot.y);
      check('clicking the palette then the canvas places an object',
        F.state.objects.length === before + 1, { before: before, after: F.state.objects.length });

      // ---------------- canvas actually painted ------------------------
      F.render(); // force a paint: headless --dump-dom produces no frames
      var g = cv.getContext('2d');
      var data = g.getImageData(0, 0, cv.width, cv.height).data;
      var lit = 0;
      for (var i = 0; i < data.length; i += 4 * 97) {
        if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 40) lit++;
      }
      check('canvas is sized', cv.width > 200 && cv.height > 200,
        { bitmap: cv.width + 'x' + cv.height, css: cv.clientWidth + 'x' + cv.clientHeight });
      check('canvas has rendered content', lit > 50, lit);

      // ---------------- round objects paint as ellipses -----------------
      // Probe an object placed in empty space: sample a point on the shape's
      // horizontal axis (inside an ellipse) and a bbox corner (outside it).
      var probe = { id: 90001, kind: 'plant', x: -1.5, y: 3, w: 1, h: 1, rot: 0, label: '', round: true };
      F.state.objects.push(probe);
      F.render();
      var dpr = w.devicePixelRatio || 1;
      function sample(p) {
        var sp = F.toScreen(p);
        if (sp.x < 1 || sp.y < 1 || sp.x > cv.clientWidth - 2 || sp.y > cv.clientHeight - 2) return null;
        var d = g.getImageData(Math.round(sp.x * dpr), Math.round(sp.y * dpr), 1, 1).data;
        return [d[0], d[1], d[2]];
      }
      var onShape = sample({ x: probe.x + 0.4, y: probe.y });
      var bboxCorner = sample({ x: probe.x + 0.49, y: probe.y + 0.49 });
      check('round object paints an ellipse, not a rectangle',
        onShape && bboxCorner && onShape[1] > bboxCorner[1] + 25 &&
        onShape[1] > 120 && bboxCorner[1] < 120,
        { onShape: onShape, bboxCorner: bboxCorner,
          onScreen: F.toScreen({ x: probe.x + 0.4, y: probe.y }),
          cornerScreen: F.toScreen({ x: probe.x + 0.49, y: probe.y + 0.49 }),
          canvas: cv.clientWidth + 'x' + cv.clientHeight });
      F.state.objects.pop();
      F.render();

      check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3));
    } catch (err) {
      check('self test ran to completion', false, String(err && err.stack || err));
    }

    // The autosave is debounced (400 ms), so it is checked after timers run.
    setTimeout(function () {
      var saved = false;
      try {
        var raw = localStorage.getItem('floorplan-editor.v1');
        saved = !!raw && JSON.parse(raw).walls.length === F.state.walls.length &&
                JSON.parse(raw).objects.length === F.state.objects.length;
      } catch (err) { saved = 'unavailable'; }
      check('plan autosaves to localStorage', saved === true || saved === 'unavailable', saved);

      // ---------------- PNG export (separate light-theme render) --------
      var exportErr = null;
      try {
        var realCreate = w.URL.createObjectURL;
        var realClick = w.HTMLAnchorElement.prototype.click;
        w.URL.createObjectURL = function (blob) { w.__exportBlob = blob; return 'blob:stub'; };
        w.HTMLAnchorElement.prototype.click = function () {};
        F.exportPNG();
        setTimeout(function () {
          w.URL.createObjectURL = realCreate;
          w.HTMLAnchorElement.prototype.click = realClick;
          var blob = w.__exportBlob;
          check('PNG export renders without errors',
            !exportErr && !!blob && blob.size > 2000,
            exportErr || (blob ? blob.size + ' bytes, ' + blob.type : 'no blob'));
          finish();
        }, 1200);
      } catch (err) {
        check('PNG export renders without errors', false, String(err));
        finish();
      }
    }, 900);
  }

  waitForBoot();
})();

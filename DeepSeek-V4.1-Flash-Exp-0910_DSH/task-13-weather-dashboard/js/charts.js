/* ==========================================================================
   charts.js — hand-rolled SVG charts and gauges. Exposed as window.WXChart.
   Every builder returns the created element (or an update function).
   ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svg(attrs, children) {
    var s = el('svg', attrs);
    (children || []).forEach(function (c) { if (c) s.appendChild(c); });
    return s;
  }
  function text(str, attrs) {
    var t = el('text', attrs);
    t.textContent = str;
    return t;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* Catmull-Rom → cubic bezier for a smooth, non-overshooting curve. */
  function smoothPath(pts, tension) {
    if (!pts.length) return '';
    if (pts.length < 3) return 'M' + pts.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' L');
    var t = tension == null ? 0.5 : tension;
    var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1.x + ((p2.x - p0.x) / 6) * t * 2;
      var c1y = p1.y + ((p2.y - p0.y) / 6) * t * 2;
      var c2x = p2.x - ((p3.x - p1.x) / 6) * t * 2;
      var c2y = p2.y - ((p3.y - p1.y) / 6) * t * 2;
      d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ',' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
           ',' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }

  /* ── Hero spark: temperature curve + precipitation probability bars ── */
  /**
   * data: [{ x: label, temp: number|null, pop: number|null, isDay: bool, now: bool }]
   * opts: { unitLabel, tempFormat(t)->string, height }
   */
  function spark(container, data, opts) {
    opts = opts || {};
    var W = Math.max(240, container.clientWidth || 560);
    var H = opts.height || container.clientHeight || 176;
    var id = 'spk' + (++uid);

    var padL = 6, padR = 6, padT = 26, padB = 6;
    var labelY = H - padB;
    var bandH = 13;
    var bandBottom = labelY - 15;
    var plotTop = padT;
    var plotBottom = bandBottom - 10;
    var plotW = W - padL - padR;

    var temps = data.map(function (d) { return d.temp; }).filter(function (v) { return v != null; });
    if (!temps.length) { clear(container); return null; }
    var tMin = Math.min.apply(null, temps);
    var tMax = Math.max.apply(null, temps);
    if (tMax - tMin < 4) { var mid = (tMax + tMin) / 2; tMin = mid - 2; tMax = mid + 2; }
    var span = tMax - tMin;
    tMin -= span * 0.18; tMax += span * 0.18;
    span = tMax - tMin;

    function X(i) { return padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW); }
    function Y(v) { return plotBottom - ((v - tMin) / span) * (plotBottom - plotTop); }

    var pts = data.map(function (d, i) { return { x: X(i), y: Y(d.temp), i: i }; });
    var line = smoothPath(pts, .62);
    var area = line + 'L' + X(data.length - 1).toFixed(1) + ' ' + plotBottom + 'L' + X(0).toFixed(1) + ' ' + plotBottom + 'Z';

    var defs = el('defs');
    var lg = el('linearGradient', { id: id + '-line', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg.appendChild(el('stop', { offset: '0%', 'stop-color': '#7cc4ff' }));
    lg.appendChild(el('stop', { offset: '52%', 'stop-color': '#ffd166' }));
    lg.appendChild(el('stop', { offset: '100%', 'stop-color': '#ff9a6c' }));
    defs.appendChild(lg);
    var ag = el('linearGradient', { id: id + '-area', x1: '0', y1: '0', x2: '0', y2: '1' });
    ag.appendChild(el('stop', { offset: '0%', 'stop-color': '#ffd166', 'stop-opacity': '.30' }));
    ag.appendChild(el('stop', { offset: '65%', 'stop-color': '#7cc4ff', 'stop-opacity': '.10' }));
    ag.appendChild(el('stop', { offset: '100%', 'stop-color': '#7cc4ff', 'stop-opacity': '0' }));
    defs.appendChild(ag);

    var g = el('g');
    g.appendChild(defs);

    /* Night shading */
    var bands = [], start = null;
    data.forEach(function (d, i) {
      if (!d.isDay) { if (start === null) start = i; }
      else if (start !== null) { bands.push([start, i - 1]); start = null; }
    });
    if (start !== null) bands.push([start, data.length - 1]);
    bands.forEach(function (b) {
      if (b[1] < b[0]) return;
      var x0 = X(b[0]) - (plotW / data.length) / 2;
      var x1 = X(b[1]) + (plotW / data.length) / 2;
      g.appendChild(el('rect', {
        x: Math.max(padL, x0).toFixed(1), y: plotTop - 6,
        width: Math.max(0, Math.min(W - padR, x1) - Math.max(padL, x0)).toFixed(1),
        height: plotBottom - plotTop + 12, rx: 7, fill: 'rgba(90,120,200,.13)'
      }));
    });

    g.appendChild(el('path', { d: area, fill: 'url(#' + id + '-area)' }));
    g.appendChild(el('path', {
      d: line, fill: 'none', stroke: 'url(#' + id + '-line)',
      'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));

    /* Precipitation bars */
    var barW = Math.max(3, Math.min(9, plotW / data.length * .46));
    data.forEach(function (d, i) {
      var pop = d.pop;
      if (pop == null) return;
      var h = Math.max(1.5, (Math.min(100, pop) / 100) * bandH);
      g.appendChild(el('rect', {
        x: (X(i) - barW / 2).toFixed(1), y: (bandBottom - h).toFixed(1),
        width: barW.toFixed(1), height: h.toFixed(1), rx: Math.min(2.5, barW / 2),
        fill: pop >= 40 ? '#5fb3f0' : '#7cc4ff', opacity: pop >= 40 ? .95 : .4
      }));
    });

    /* Temperature dots (every 2nd hour to stay clean) */
    data.forEach(function (d, i) {
      if (i % 2 && !d.now) return;
      g.appendChild(el('circle', {
        cx: X(i).toFixed(1), cy: Y(d.temp).toFixed(1), r: d.now ? 4 : 2.6,
        fill: d.now ? '#fff' : 'rgba(255,255,255,.85)',
        stroke: d.now ? '#ffd166' : 'none', 'stroke-width': d.now ? 2.4 : 0
      }));
    });

    /* Annotate the warmest and coolest points — a compact alternative to a y-axis. */
    var maxI = 0, minI = 0;
    data.forEach(function (d, i) {
      if (d.temp > data[maxI].temp) maxI = i;
      if (d.temp < data[minI].temp) minI = i;
    });
    [{ i: maxI, up: true }, { i: minI, up: false }].forEach(function (a) {
      if (a.i === nowIdx) return;
      var vx = X(a.i), vy = Y(data[a.i].temp);
      var anchor = vx < 22 ? 'start' : vx > W - 22 ? 'end' : 'middle';
      var ty = a.up ? vy - 9 : vy + 15;
      if (ty < 10) ty = vy + 15;
      if (ty > bandBottom) ty = vy - 9;
      g.appendChild(text(opts.tempFormat(data[a.i].temp), {
        x: (vx + (anchor === 'start' ? 1 : anchor === 'end' ? -1 : 0)).toFixed(1), y: ty.toFixed(1),
        'text-anchor': anchor, fill: 'currentColor', opacity: '.72',
        'font-size': 11, 'font-weight': 650, 'font-family': 'inherit'
      }));
    });

    /* Hour labels */
    data.forEach(function (d, i) {
      if (i % 3) return;
      g.appendChild(text(d.x, {
        x: X(i).toFixed(1), y: labelY, 'text-anchor': 'middle',
        fill: 'currentColor', opacity: '.72', 'font-size': 10.5, 'font-weight': 600,
        'font-family': 'inherit'
      }));
    });

    /* Now marker */
    var nowIdx = data.findIndex(function (d) { return d.now; });
    if (nowIdx >= 0) {
      var nx = X(nowIdx);
      g.appendChild(el('line', {
        x1: nx.toFixed(1), y1: plotTop - 10, x2: nx.toFixed(1), y2: bandBottom,
        stroke: 'rgba(255,255,255,.32)', 'stroke-width': 1.4, 'stroke-dasharray': '3 4'
      }));
      var anchor = nx < 26 ? 'start' : nx > W - 26 ? 'end' : 'middle';
      g.appendChild(text('now', {
        x: (nx + (anchor === 'start' ? 2 : anchor === 'end' ? -2 : 0)).toFixed(1),
        y: plotTop - 14, 'text-anchor': anchor,
        fill: 'currentColor', opacity: '.7', 'font-size': 10, 'font-weight': 700,
        'letter-spacing': '.08em'
      }));
    }

    /* Hover layer */
    var hoverLine = el('line', {
      x1: 0, y1: plotTop - 6, x2: 0, y2: bandBottom,
      stroke: 'rgba(255,255,255,.5)', 'stroke-width': 1.2, opacity: 0
    });
    var hoverDot = el('circle', { cx: 0, cy: 0, r: 4.5, fill: '#fff', stroke: '#ffd166', 'stroke-width': 2.4, opacity: 0 });
    g.appendChild(hoverLine);
    g.appendChild(hoverDot);
    var hit = el('rect', { x: padL, y: plotTop - 12, width: plotW, height: bandBottom - plotTop + 12, fill: 'transparent', style: 'cursor:crosshair' });
    g.appendChild(hit);

    var out = svg({
      viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H,
      preserveAspectRatio: 'xMidYMid meet', class: 'spark__svg', role: 'img',
      'aria-label': 'Temperature for the next ' + data.length + ' hours with chance of rain'
    }, [g]);

    clear(container);
    var tip = document.createElement('div');
    tip.className = 'spark__tip';
    container.appendChild(out);
    container.appendChild(tip);

    function showAt(clientX) {
      var r = out.getBoundingClientRect();
      var scale = r.width / W;
      var px = (clientX - r.left) / scale;
      var idx = Math.round(((px - padL) / plotW) * (data.length - 1));
      idx = Math.max(0, Math.min(data.length - 1, idx));
      var d = data[idx];
      var x = X(idx), y = Y(d.temp);
      hoverLine.setAttribute('x1', x); hoverLine.setAttribute('x2', x);
      hoverLine.setAttribute('opacity', '1');
      hoverDot.setAttribute('cx', x); hoverDot.setAttribute('cy', y);
      hoverDot.setAttribute('opacity', '1');
      tip.innerHTML = '<b>' + opts.tempFormat(d.temp) + '</b><span>' + d.x + '</span>' +
        (d.pop != null ? '<i>' + Math.round(d.pop) + '% rain</i>' : '');
      tip.style.left = (x * scale) + 'px';
      tip.style.top = (y * scale) + 'px';
      tip.classList.add('is-on');
    }
    function hide() {
      hoverLine.setAttribute('opacity', '0');
      hoverDot.setAttribute('opacity', '0');
      tip.classList.remove('is-on');
    }
    hit.addEventListener('pointermove', function (e) { showAt(e.clientX); });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('pointerdown', function (e) { showAt(e.clientX); });

    return { svg: out, redraw: function () { spark(container, data, opts); } };
  }

  /* ── Wind compass ─────────────────────────────────────────────────── */
  function compass(container, deg, opts) {
    opts = opts || {};
    var S = opts.size || 108, c = S / 2, R = c - 6;
    var g = el('g');

    /* A darker dial gives the tiny cardinal letters a consistent base to sit on. */
    g.appendChild(el('circle', { cx: c, cy: c, r: R, fill: 'rgba(0,0,0,.22)', stroke: 'currentColor', 'stroke-opacity': '.16', 'stroke-width': 1 }));
    g.appendChild(el('circle', { cx: c, cy: c, r: R - 9, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.1', 'stroke-width': 1 }));

    ['N', 'E', 'S', 'W'].forEach(function (lbl, i) {
      var a = (i * 90 - 90) * Math.PI / 180;
      g.appendChild(text(lbl, {
        x: (c + Math.cos(a) * (R - 13.5)).toFixed(1), y: (c + Math.sin(a) * (R - 13.5) + 3.4).toFixed(1),
        'text-anchor': 'middle', fill: 'currentColor', opacity: lbl === 'N' ? '1' : '.72',
        'font-size': 10, 'font-weight': 700, 'font-family': 'inherit'
      }));
    });
    for (var i = 0; i < 16; i++) {
      var a2 = (i * 22.5 - 90) * Math.PI / 180;
      var long = i % 4 === 0;
      g.appendChild(el('line', {
        x1: (c + Math.cos(a2) * (R - 2.5)).toFixed(1), y1: (c + Math.sin(a2) * (R - 2.5)).toFixed(1),
        x2: (c + Math.cos(a2) * (R - (long ? 8 : 6))).toFixed(1), y2: (c + Math.sin(a2) * (R - (long ? 8 : 6))).toFixed(1),
        stroke: 'currentColor', opacity: '.34', 'stroke-width': long ? 1.4 : 1
      }));
    }

    /* The needle points at the compass bearing the wind blows FROM, so it always
       agrees with the "From N" label shown beside it. */
    var toDeg = deg == null ? 0 : deg;
    var needle = el('g');
    needle.appendChild(el('path', {
      d: 'M0 ' + (-R + 24) + ' L4.6 5 L0 ' + (-R + 32) + ' L-4.6 5 Z',
      transform: 'rotate(' + toDeg + ')',
      fill: 'url(#wxc-needle)'
    }));
    needle.appendChild(el('circle', { cx: 0, cy: 0, r: 3.2, fill: 'rgba(255,255,255,.9)' }));
    var dg = el('defs');
    var ng = el('linearGradient', { id: 'wxc-needle', x1: '0', y1: '0', x2: '0', y2: '1' });
    ng.appendChild(el('stop', { offset: '0%', 'stop-color': '#7cc4ff' }));
    ng.appendChild(el('stop', { offset: '100%', 'stop-color': '#ffd166' }));
    dg.appendChild(ng);
    needle.setAttribute('transform', 'translate(' + c + ' ' + c + ')');
    g.appendChild(dg);
    g.appendChild(needle);

    var out = svg({ viewBox: '0 0 ' + S + ' ' + S, width: S, height: S, role: 'img', 'aria-label': 'Wind direction ' + (opts.label || '') }, [g]);
    clear(container);
    container.appendChild(out);
    return out;
  }

  /* ── Arc gauge (UV, humidity, pressure, cloud cover) ──────────────── */
  function arcGauge(container, opts) {
    opts = opts || {};
    var S = opts.size || 104, c = S / 2, R = c - 9, sw = opts.stroke || 8;
    var pct = Math.max(0, Math.min(1, opts.value == null ? 0 : opts.value));
    var start = -215, end = 35;                       /* 250° sweep */
    var sweep = end - start;
    var id = 'ag' + (++uid);

    function pt(deg) {
      var a = deg * Math.PI / 180;
      return { x: c + Math.cos(a) * R, y: c + Math.sin(a) * R };
    }
    function arcPath(fromDeg, toDeg) {
      var a = pt(fromDeg), b = pt(toDeg);
      var large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
      return 'M' + a.x.toFixed(2) + ' ' + a.y.toFixed(2) + 'A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + b.x.toFixed(2) + ' ' + b.y.toFixed(2);
    }

    var g = el('g');
    var dg = el('defs');
    var lg = el('linearGradient', { id: id + '-g', x1: '0', y1: '0', x2: '1', y2: '1' });
    (opts.stops || [['#7cc4ff'], ['#ffd166'], ['#ff9a6c']]).forEach(function (s, i, arr) {
      lg.appendChild(el('stop', { offset: (i / (arr.length - 1) * 100) + '%', 'stop-color': s[0] }));
    });
    dg.appendChild(lg);
    g.appendChild(dg);

    g.appendChild(el('path', {
      d: arcPath(start, end), fill: 'none', stroke: 'rgba(255,255,255,.11)',
      'stroke-width': sw, 'stroke-linecap': 'round'
    }));
    if (pct > 0.005) {
      g.appendChild(el('path', {
        d: arcPath(start, start + sweep * pct), fill: 'none', stroke: 'url(#' + id + '-g)',
        'stroke-width': sw, 'stroke-linecap': 'round'
      }));
    }
    var tick = pt(start + sweep * pct);
    g.appendChild(el('circle', { cx: tick.x.toFixed(1), cy: tick.y.toFixed(1), r: sw / 2 + 1.6, fill: '#fff', opacity: pct > .005 ? 1 : 0 }));
    if (opts.center) {
      g.appendChild(text(opts.center, {
        x: c, y: c + 2, 'text-anchor': 'middle', fill: 'currentColor',
        'font-size': opts.centerSize || 20, 'font-weight': 400, 'font-family': 'inherit'
      }));
    }
    if (opts.caption) {
      g.appendChild(text(opts.caption, {
        x: c, y: c + 19, 'text-anchor': 'middle', fill: 'currentColor', opacity: '.68',
        'font-size': 10, 'font-weight': 700, 'letter-spacing': '.07em', 'font-family': 'inherit'
      }));
    }
    var out = svg({ viewBox: '0 0 ' + S + ' ' + S, width: S, height: S, role: 'img', 'aria-label': opts.aria || '' }, [g]);
    clear(container);
    container.appendChild(out);
    return out;
  }

  /* ── Ring gauge (AQI) ─────────────────────────────────────────────── */
  function ring(container, opts) {
    opts = opts || {};
    var S = opts.size || 104, c = S / 2, R = c - 9, sw = opts.stroke || 8;
    var pct = Math.max(0, Math.min(1, opts.value == null ? 0 : opts.value));
    var circ = 2 * Math.PI * R;

    var g = el('g');
    g.appendChild(el('circle', { cx: c, cy: c, r: R, fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': sw }));
    g.appendChild(el('circle', {
      cx: c, cy: c, r: R, fill: 'none', stroke: opts.color || '#4ade80',
      'stroke-width': sw, 'stroke-linecap': 'round',
      'stroke-dasharray': circ.toFixed(1), 'stroke-dashoffset': (circ * (1 - pct)).toFixed(1),
      transform: 'rotate(-90 ' + c + ' ' + c + ')',
      style: 'transition:stroke-dashoffset .8s cubic-bezier(.22,.61,.36,1),stroke .4s ease'
    }));
    if (opts.center) {
      g.appendChild(text(opts.center, {
        x: c, y: c + 3, 'text-anchor': 'middle', fill: 'currentColor',
        'font-size': opts.centerSize || 22, 'font-weight': 400, 'font-family': 'inherit'
      }));
    }
    if (opts.caption) {
      g.appendChild(text(opts.caption, {
        x: c, y: c + 20, 'text-anchor': 'middle', fill: 'currentColor', opacity: '.68',
        'font-size': 10, 'font-weight': 700, 'letter-spacing': '.07em', 'font-family': 'inherit'
      }));
    }
    var out = svg({ viewBox: '0 0 ' + S + ' ' + S, width: S, height: S, role: 'img', 'aria-label': opts.aria || '' }, [g]);
    clear(container);
    container.appendChild(out);
    return out;
  }

  /* ── Sun path arc ─────────────────────────────────────────────────── */
  function sunArc(container, opts) {
    opts = opts || {};
    var W = opts.width || 220, H = opts.height || 96;
    var pad = 16;
    var x0 = pad, x1 = W - pad, y0 = H - 20;
    var top = 14;
    var p = Math.max(0, Math.min(1, opts.progress == null ? 0 : opts.progress));

    function pointAt(t) {
      /* Quadratic arc: endpoints at the horizon, apex at the top. */
      var x = x0 + (x1 - x0) * t;
      var y = y0 - Math.sin(Math.PI * t) * (y0 - top);
      return { x: x, y: y };
    }
    var g = el('g');
    var d = '';
    for (var i = 0; i <= 40; i++) {
      var pt = pointAt(i / 40);
      d += (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1);
    }
    g.appendChild(el('path', { d: d, fill: 'none', stroke: 'rgba(255,255,255,.16)', 'stroke-width': 2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }));

    if (p > 0 && p < 1) {
      var d2 = '';
      for (var j = 0; j <= 40; j++) {
        var t2 = (j / 40) * p;
        var q = pointAt(t2);
        d2 += (j ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
      }
      g.appendChild(el('path', { d: d2, fill: 'none', stroke: 'url(#sunarc-g)', 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
    }
    var dg = el('defs');
    var lg = el('linearGradient', { id: 'sunarc-g', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg.appendChild(el('stop', { offset: '0%', 'stop-color': '#ffb03a' }));
    lg.appendChild(el('stop', { offset: '50%', 'stop-color': '#ffe08a' }));
    lg.appendChild(el('stop', { offset: '100%', 'stop-color': '#ff8a5c' }));
    dg.appendChild(lg);
    g.appendChild(dg);

    var sunPt = pointAt(p);
    var isDay = p > 0 && p < 1;
    if (isDay) {
      g.appendChild(el('circle', { cx: sunPt.x.toFixed(1), cy: sunPt.y.toFixed(1), r: 9, fill: '#ffd166', opacity: .22 }));
      g.appendChild(el('circle', { cx: sunPt.x.toFixed(1), cy: sunPt.y.toFixed(1), r: 5, fill: '#ffd166' }));
    } else {
      var mp = p >= 1 ? pointAt(1) : pointAt(0);
      g.appendChild(el('circle', { cx: mp.x.toFixed(1), cy: mp.y.toFixed(1), r: 4.4, fill: 'rgba(200,215,255,.85)' }));
    }

    g.appendChild(el('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: 'rgba(255,255,255,.2)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
    g.appendChild(text(opts.left || '', { x: x0, y: H - 4, fill: 'currentColor', opacity: '.55', 'font-size': 10.5, 'font-weight': 600, 'font-family': 'inherit' }));
    g.appendChild(text(opts.right || '', { x: x1, y: H - 4, 'text-anchor': 'end', fill: 'currentColor', opacity: '.55', 'font-size': 10.5, 'font-weight': 600, 'font-family': 'inherit' }));

    var out = svg({ viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': opts.aria || '' }, [g]);
    clear(container);
    container.appendChild(out);
    return out;
  }

  /* ── Sparkline (pressure trend) ───────────────────────────────────── */
  function sparkline(container, values, opts) {
    opts = opts || {};
    var W = opts.width || 96, H = opts.height || 34;
    var vals = values.filter(function (v) { return v != null; });
    if (vals.length < 2) { clear(container); return null; }
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 0.6) { max += .3; min -= .3; }
    var pad = 4;
    var pts = vals.map(function (v, i) {
      return { x: pad + (i / (vals.length - 1)) * (W - pad * 2), y: H - pad - ((v - min) / (max - min)) * (H - pad * 2) };
    });
    var d = smoothPath(pts, .5);
    var g = el('g');
    g.appendChild(el('path', {
      d: d + 'L' + pts[pts.length - 1].x.toFixed(1) + ' ' + H + 'L' + pts[0].x.toFixed(1) + ' ' + H + 'Z',
      fill: 'rgba(124,196,255,.16)'
    }));
    g.appendChild(el('path', { d: d, fill: 'none', stroke: '#7cc4ff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    var last = pts[pts.length - 1];
    g.appendChild(el('circle', { cx: last.x.toFixed(1), cy: last.y.toFixed(1), r: 2.6, fill: '#fff' }));
    var out = svg({ viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': opts.aria || 'trend' }, [g]);
    clear(container);
    container.appendChild(out);
    return out;
  }

  global.WXChart = {
    spark: spark, compass: compass, arcGauge: arcGauge, ring: ring,
    sunArc: sunArc, sparkline: sparkline, smoothPath: smoothPath
  };
})(typeof window !== 'undefined' ? window : globalThis);

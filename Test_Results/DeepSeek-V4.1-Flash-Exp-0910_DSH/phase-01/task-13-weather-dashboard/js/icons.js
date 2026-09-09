/* ==========================================================================
   icons.js — animated SVG weather glyphs. Exposed as window.WXIcon.
   make(kind, isDay, opts) -> SVGElement
   ========================================================================== */
(function (global) {
  'use strict';

  var uid = 0;
  var STYLE_ID = 'wx-icon-styles';

  var CSS = [
    '@keyframes wx-spin { to { transform: rotate(360deg); } }',
    '@keyframes wx-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }',
    '@keyframes wx-drift { 0%,100% { transform: translateX(0); } 50% { transform: translateX(2.2px); } }',
    '@keyframes wx-fall { 0% { transform: translateY(-2px); opacity: 0; } 25% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(6px); opacity: 0; } }',
    '@keyframes wx-flake { 0% { transform: translateY(-2px) rotate(0deg); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(6px) rotate(140deg); opacity: 0; } }',
    '@keyframes wx-flash { 0%, 54%, 100% { opacity: 1; } 60% { opacity: .2; } 68% { opacity: 1; } 76% { opacity: .35; } 84% { opacity: 1; }',
    '@keyframes wx-twinkle { 0%,100% { opacity: .25; } 50% { opacity: 1; } }',
    '@keyframes wx-fogdrift { 0%,100% { transform: translateX(-1.6px); opacity: .5; } 50% { transform: translateX(1.6px); opacity: .95; } }',
    '.wx-icon { overflow: visible; }',
    '.wx-sun-rays { transform-origin: 50% 50%; animation: wx-spin 26s linear infinite; }',
    '.wx-cloud-a { animation: wx-drift 6.5s ease-in-out infinite; }',
    '.wx-cloud-b { animation: wx-drift 8.5s ease-in-out infinite reverse; }',
    '.wx-drop { animation: wx-fall 1.5s linear infinite; }',
    '.wx-drop--2 { animation-delay: .5s; }',
    '.wx-drop--3 { animation-delay: 1s; }',
    '.wx-flake { animation: wx-flake 3.2s linear infinite; }',
    '.wx-flake--2 { animation-delay: 1.05s; }',
    '.wx-flake--3 { animation-delay: 2.1s; }',
    '.wx-bolt { animation: wx-flash 3.4s ease-in-out infinite; }',
    '.wx-star { animation: wx-twinkle 3s ease-in-out infinite; }',
    '.wx-star--2 { animation-delay: 1s; }',
    '.wx-star--3 { animation-delay: 2s; }',
    '.wx-fog-line { animation: wx-fogdrift 4.4s ease-in-out infinite; }',
    '.wx-fog-line--2 { animation-delay: 1.1s; }',
    '.wx-fog-line--3 { animation-delay: 2.2s; }',
    '@media (prefers-reduced-motion: reduce) { .wx-icon * { animation: none !important; } }'
  ].join('\n');

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    return node;
  }

  /* ── Reusable parts ───────────────────────────────────────────────── */
  function defs(id) {
    var d = el('defs');
    function grad(gid, from, to, x1, y1, x2, y2) {
      var g = el('linearGradient', { id: gid, x1: x1 || '0%', y1: y1 || '0%', x2: x2 || '0%', y2: y2 || '100%' });
      g.appendChild(el('stop', { offset: '0%', 'stop-color': from }));
      g.appendChild(el('stop', { offset: '100%', 'stop-color': to }));
      return g;
    }
    d.appendChild(grad(id + '-sun', '#fff0b8', '#ffb03a'));
    d.appendChild(grad(id + '-moon', '#ffffff', '#b8c8f0'));
    d.appendChild(grad(id + '-cloud', '#ffffff', '#c8d8ee'));
    d.appendChild(grad(id + '-cloud-dark', '#dbe5f4', '#9fb2cf'));
    d.appendChild(grad(id + '-rain', '#9fd4ff', '#4f9ee8'));
    d.appendChild(grad(id + '-bolt', '#fff3a8', '#ffb300'));
    return d;
  }

  /** Sun with slowly rotating rays. */
  function sun(id, cx, cy, r) {
    var g = el('g');
    var rays = el('g', { class: 'wx-sun-rays' });
    for (var i = 0; i < 8; i++) {
      var a = (i * Math.PI) / 4;
      var x1 = cx + Math.cos(a) * (r + 2.1), y1 = cy + Math.sin(a) * (r + 2.1);
      var x2 = cx + Math.cos(a) * (r + 4.6), y2 = cy + Math.sin(a) * (r + 4.6);
      rays.appendChild(el('line', {
        x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2),
        stroke: '#ffc247', 'stroke-width': 1.9, 'stroke-linecap': 'round'
      }));
    }
    g.appendChild(rays);
    g.appendChild(el('circle', { cx: cx, cy: cy, r: r, fill: 'url(#' + id + '-sun)' }));
    return g;
  }

  /** Crescent moon (masked, so it works on light and dark skies) plus stars. */
  function moon(id, cx, cy, r, withStars) {
    var g = el('g');
    var maskId = id + '-mm';
    var mask = el('mask', {
      id: maskId, maskUnits: 'userSpaceOnUse',
      x: (cx - r * 2).toFixed(1), y: (cy - r * 2).toFixed(1),
      width: (r * 4).toFixed(1), height: (r * 4).toFixed(1)
    });
    mask.appendChild(el('rect', {
      x: (cx - r * 2).toFixed(1), y: (cy - r * 2).toFixed(1),
      width: (r * 4).toFixed(1), height: (r * 4).toFixed(1), fill: '#000'
    }));
    mask.appendChild(el('circle', { cx: cx, cy: cy, r: r, fill: '#fff' }));
    mask.appendChild(el('circle', { cx: cx - r * 0.46, cy: cy - r * 0.4, r: r * 0.9, fill: '#000' }));
    var dg = el('defs');
    dg.appendChild(mask);
    g.appendChild(dg);
    g.appendChild(el('circle', {
      cx: cx, cy: cy, r: r, fill: 'url(#' + id + '-moon)', mask: 'url(#' + maskId + ')'
    }));
    if (withStars) {
      [[cx + r * 1.5, cy - r * 0.95, 1.15, ''], [cx + r * 1.05, cy + r * 0.95, .85, 'wx-star--2'], [cx - r * 1.25, cy + r * 0.6, .95, 'wx-star--3']]
        .forEach(function (s) {
          g.appendChild(el('circle', {
            cx: s[0], cy: s[1], r: s[2], fill: '#e8efff',
            class: 'wx-star ' + s[3], style: 'transform-origin:' + s[0] + 'px ' + s[1] + 'px'
          }));
        });
    }
    return g;
  }

  /** Fluffy cloud built from overlapping circles plus a flat base. */
  function cloud(id, opts) {
    opts = opts || {};
    var g = el('g', { class: opts.cls || 'wx-cloud-a' });
    var fill = 'url(#' + id + (opts.dark ? '-cloud-dark' : '-cloud') + ')';
    var s = opts.scale || 1;
    var dx = opts.x || 0, dy = opts.y || 0;
    g.setAttribute('transform', 'translate(' + dx + ' ' + dy + ') scale(' + s + ')');
    g.appendChild(el('circle', { cx: 9.4, cy: 14.4, r: 5.1, fill: fill }));
    g.appendChild(el('circle', { cx: 15.4, cy: 13.2, r: 6.1, fill: fill }));
    g.appendChild(el('circle', { cx: 20.4, cy: 15.4, r: 4.3, fill: fill }));
    g.appendChild(el('rect', { x: 4.6, y: 15.4, width: 19.4, height: 4.6, rx: 2.3, fill: fill }));
    if (opts.shade) {
      g.appendChild(el('path', {
        d: 'M5.2 19.2h18.4a2.3 2.3 0 0 0 0-1.4H5.6a2.3 2.3 0 0 0-.4 1.4Z',
        fill: 'rgba(120,150,200,.28)'
      }));
    }
    return g;
  }

  function drops(id, kind, xs) {
    var g = el('g');
    xs.forEach(function (x, i) {
      var cls = 'wx-drop' + (i === 1 ? ' wx-drop--2' : i === 2 ? ' wx-drop--3' : '');
      var node;
      if (kind === 'snow') {
        node = el('path', {
          d: 'M' + x + ' 19.4v3.4M' + (x - 1.5) + ' 20.4l3 1.4M' + (x + 1.5) + ' 20.4l-3 1.4',
          stroke: '#eaf4ff', 'stroke-width': 1.25, 'stroke-linecap': 'round', fill: 'none'
        });
        node.setAttribute('class', 'wx-flake' + (i === 1 ? ' wx-flake--2' : i === 2 ? ' wx-flake--3' : ''));
      } else {
        node = el('path', {
          d: 'M' + x + ' 19.2c0 0-1.55 2.15-1.55 3.35a1.55 1.55 0 0 0 3.1 0c0-1.2-1.55-3.35-1.55-3.35Z',
          fill: 'url(#' + id + '-rain)'
        });
        node.setAttribute('class', cls);
      }
      node.setAttribute('style', 'transform-origin:' + x + 'px 20px');
      g.appendChild(node);
    });
    return g;
  }

  /* ── Public factory ───────────────────────────────────────────────── */
  function make(kind, isDay, opts) {
    opts = opts || {};
    var doc = opts.document || global.document;
    ensureStyle(doc);
    var id = 'wxi' + (++uid);
    var svg = el('svg', {
      viewBox: '0 0 32 32', class: 'wx-icon', role: 'presentation', 'aria-hidden': 'true',
      focusable: 'false', width: opts.size || 32, height: opts.size || 32
    });
    svg.appendChild(defs(id));

    var night = isDay === 0 || isDay === false;

    switch (kind) {
      case 'clear':
        svg.appendChild(night ? moon(id, 16, 15, 8.2, true) : sun(id, 16, 16, 7.4));
        break;

      case 'mostly':
        if (night) { svg.appendChild(moon(id, 19, 12.5, 6.4, true)); }
        else { svg.appendChild(sun(id, 19.5, 12, 6.1)); }
        svg.appendChild(cloud(id, { scale: .78, x: -1.4, y: 5.2, cls: 'wx-cloud-a', shade: true }));
        break;

      case 'partly':
        if (night) { svg.appendChild(moon(id, 20, 11.6, 6, true)); }
        else { svg.appendChild(sun(id, 20.5, 11, 5.6)); }
        svg.appendChild(cloud(id, { scale: .92, x: -2.2, y: 3.4, cls: 'wx-cloud-a', shade: true }));
        svg.appendChild(cloud(id, { scale: .6, x: 11.5, y: 8.6, cls: 'wx-cloud-b', dark: true }));
        break;

      case 'cloudy':
        svg.appendChild(cloud(id, { scale: .72, x: 1.6, y: 1.8, cls: 'wx-cloud-b', dark: true }));
        svg.appendChild(cloud(id, { scale: 1, x: -2.4, y: 4.6, cls: 'wx-cloud-a', shade: true }));
        break;

      case 'fog':
        svg.appendChild(cloud(id, { scale: .96, x: -2, y: 1.6, cls: 'wx-cloud-a', shade: true }));
        [21.6, 24.6, 27.6].forEach(function (y, i) {
          svg.appendChild(el('line', {
            x1: 5.2, y1: y, x2: 26.8, y2: y,
            stroke: '#cfdcec', 'stroke-width': 2.1, 'stroke-linecap': 'round',
            class: 'wx-fog-line' + (i === 1 ? ' wx-fog-line--2' : i === 2 ? ' wx-fog-line--3' : ''),
            style: 'transform-origin:16px ' + y + 'px'
          }));
        });
        break;

      case 'drizzle':
      case 'rain':
      case 'showers':
        svg.appendChild(cloud(id, { scale: kind === 'drizzle' ? .9 : 1, x: -2.4, y: 1.4, cls: 'wx-cloud-a', shade: true }));
        svg.appendChild(drops(id, 'rain', kind === 'drizzle' ? [12, 17] : [10.5, 16, 21.5]));
        break;

      case 'sleet':
        svg.appendChild(cloud(id, { scale: 1, x: -2.4, y: 1.4, cls: 'wx-cloud-a', shade: true }));
        svg.appendChild(drops(id, 'rain', [11.5, 20.5]));
        svg.appendChild(drops(id, 'snow', [16]));
        break;

      case 'snow':
        svg.appendChild(cloud(id, { scale: 1, x: -2.4, y: 1.2, cls: 'wx-cloud-a', shade: true }));
        svg.appendChild(drops(id, 'snow', [10.5, 16, 21.5]));
        break;

      case 'storm':
        svg.appendChild(cloud(id, { scale: 1, x: -2.4, y: .6, cls: 'wx-cloud-a', dark: true, shade: true }));
        svg.appendChild(el('path', {
          d: 'M16.9 17.6 10.3 25.7h3.8L12.7 30.8 19.6 22h-3.9Z',
          fill: 'url(#' + id + '-bolt)', class: 'wx-bolt',
          stroke: 'rgba(255,255,255,.55)', 'stroke-width': .6, 'stroke-linejoin': 'round'
        }));
        svg.appendChild(drops(id, 'rain', [10, 23]));
        break;

      default:
        svg.appendChild(cloud(id, { scale: .96, x: -2, y: 3, shade: true }));
    }
    return svg;
  }

  global.WXIcon = { make: make, CSS: CSS };
})(typeof window !== 'undefined' ? window : globalThis);

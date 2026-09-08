#!/usr/bin/env node
/**
 * Static audit for every built page: layout overflow, clipped text, WCAG AA
 * colour contrast, tap-target size, duplicate ids, missing labels, broken
 * ARIA references, placeholder links, and empty calculator outputs.
 *
 *   node tools/audit.js                     # all pages, desktop
 *   node tools/audit.js index.html --mobile # one page, phone viewport
 *
 * Exits non-zero if anything is found, so it doubles as a regression gate.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, launch, newPage } = require('./cdp');

const PORT = 9700 + (process.pid % 200);
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? def : argv[i + 1];
};
const MOBILE = argv.includes('--mobile');
const WIDTH = Number(flag('width', MOBILE ? 390 : 1440));
const HEIGHT = Number(flag('height', MOBILE ? 844 : 900));
const ONLY = argv.filter((a) => a.endsWith('.html'));

/* --- the in-page battery -------------------------------------------------- */
const AUDIT_SCRIPT = `(function () {
  var issues = [];
  var seen = {};
  function sel(el) {
    if (!el) return '(none)';
    if (el === document.body) return 'body';
    if (el === document.documentElement) return 'html';
    var parts = [], node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      var s = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + node.id); break; }
      var cls = (node.getAttribute('class') || '').split(/\\s+/).filter(function (c) {
        return c && !/^(is-|reveal|js)/.test(c);
      }).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
      node = node.parentElement;
    }
    return parts.join('>');
  }
  function add(kind, el, detail) {
    var key = kind + '|' + sel(el) + '|' + (detail || '');
    if (seen[key]) return;
    seen[key] = 1;
    issues.push({ kind: kind, sel: sel(el), detail: detail || '' });
  }
  function visible(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  var all = Array.prototype.slice.call(document.querySelectorAll('*'));
  var vw = document.documentElement.clientWidth;

  /* 1. horizontal overflow of the document or of leaf text nodes */
  if (document.documentElement.scrollWidth > vw + 1) {
    add('overflow-x', document.documentElement, document.documentElement.scrollWidth + 'px > ' + vw + 'px');
  }
  all.forEach(function (el) {
    if (!visible(el) || getComputedStyle(el).position === 'fixed') return;
    if (el.children.length) return;
    if (!(el.textContent || '').trim()) return;
    // A horizontally scrollable ancestor (e.g. a wide data table) is by design.
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return;
    }
    var r = el.getBoundingClientRect();
    if (r.right > vw + 1) add('overflow-x', el, 'right edge ' + Math.round(r.right) + 'px');
    if (r.left < -1) add('overflow-x', el, 'left edge ' + Math.round(r.left) + 'px');
  });

  /* 2. text clipped by a scroll/overflow container */
  all.forEach(function (el) {
    if (!visible(el) || el.children.length) return;
    if (!(el.textContent || '').trim()) return;
    if (el.classList.contains('sr-only')) return; // deliberately clipped for screen readers
    var cs = getComputedStyle(el);
    if (cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis') return;
    if (el.scrollWidth > el.clientWidth + 1) {
      add('clipped', el, el.scrollWidth + 'px content in ' + el.clientWidth + 'px box');
    }
  });

  /* 2b. Content escaping a clipping ancestor (overflow: hidden) */
  all.forEach(function (el) {
    if (!visible(el)) return;
    if (el.closest('[aria-hidden="true"]')) return; // decorative layers may bleed
    var r = el.getBoundingClientRect();
    var node = el.parentElement;
    while (node && node !== document.body) {
      var cs = getComputedStyle(node);
      if (cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
        var pr = node.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1 ||
            r.bottom > pr.bottom + 1 || r.top < pr.top - 1) {
          add('overflow-clip', el,
            'escapes ' + sel(node) + ' by ' +
            Math.round(Math.max(r.right - pr.right, pr.left - r.left, 0)) + 'px');
          return;
        }
      }
      node = node.parentElement;
    }
  });

  /* 3. WCAG AA contrast, resolving the nearest solid background */
  function rgb(str) {
    var m = /rgba?\\(([^)]+)\\)/.exec(str || '');
    if (!m) return null;
    var p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
    return (l1 + 0.05) / (l2 + 0.05);
  }
  function bgOf(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      var c = rgb(cs.backgroundColor);
      if (c && c.a > 0.85) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  all.forEach(function (el) {
    if (!visible(el)) return;
    var hasText = false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) hasText = true;
    }
    if (!hasText) return;
    var cs = getComputedStyle(el);
    var fg = rgb(cs.color);
    if (!fg) return;
    var bg = bgOf(el);
    if (!bg) return;
    var size = parseFloat(cs.fontSize);
    var weight = parseInt(cs.fontWeight, 10) || 400;
    var large = size >= 24 || (size >= 18.66 && weight >= 700);
    var need = large ? 3 : 4.5;
    var got = ratio(fg, bg);
    if (got < need - 0.02) {
      add('contrast', el, got.toFixed(2) + ':1, need ' + need + ':1 (' + Math.round(size) + 'px, ' + cs.color + ' on rgb(' + bg.r + ',' + bg.g + ',' + bg.b + '))');
    }
  });

  /* 4. accessible names */
  all.forEach(function (el) {
    if (!visible(el)) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'a' && tag !== 'button') return;
    var name = (el.textContent || '').trim() || el.getAttribute('aria-label') ||
      (el.getAttribute('aria-labelledby') ? 'x' : '') || el.getAttribute('title') || '';
    if (!name) add('no-name', el, tag + ' has no accessible name');
  });

  /* 5. form controls need labels */
  all.forEach(function (el) {
    var tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return;
    if (el.type === 'hidden') return;
    var id = el.id;
    var hasLabel = (id && document.querySelector('label[for="' + id + '"]')) ||
      el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (!hasLabel) add('no-label', el, tag + (id ? '#' + id : '') + ' has no label');
  });

  /* 6. duplicate ids */
  var ids = {};
  all.forEach(function (el) {
    if (!el.id) return;
    if (ids[el.id]) add('dup-id', el, '#' + el.id + ' appears more than once');
    ids[el.id] = 1;
  });

  /* 7. ARIA references that point nowhere */
  ['aria-controls', 'aria-labelledby', 'aria-describedby'].forEach(function (attr) {
    all.forEach(function (el) {
      var v = el.getAttribute(attr);
      if (!v) return;
      v.split(/\\s+/).forEach(function (id) {
        if (!document.getElementById(id)) add('bad-aria', el, attr + '="' + id + '" has no target');
      });
    });
  });

  /* 8. placeholder links and empty calculator outputs */
  all.forEach(function (el) {
    if (el.tagName.toLowerCase() !== 'a') return;
    var href = el.getAttribute('href');
    if (href === '#' || href === '' || href == null) add('dead-link', el, 'href="' + href + '"');
  });
  var DECORATIVE = ['svg', 'path', 'circle', 'line', 'rect', 'i'];
  // A calculator output still reading zero almost always means the widget
  // never initialised (e.g. its script did not load).
  all.forEach(function (el) {
    if (!el.hasAttribute('data-out') || !el.closest('.calc')) return;
    if (DECORATIVE.indexOf(el.tagName.toLowerCase()) !== -1) return;
    if (/^\\$?0(\\.00)?%?$/.test((el.textContent || '').trim())) {
      add('stale-output', el, 'data-out="' + el.getAttribute('data-out') + '" still shows its zero state');
    }
  });
  all.forEach(function (el) {
    if (!el.hasAttribute('data-out')) return;
    if (DECORATIVE.indexOf(el.tagName.toLowerCase()) !== -1) return;
    if (!(el.textContent || '').trim()) add('empty-output', el, 'data-out="' + el.getAttribute('data-out') + '" rendered nothing');
  });

  /* 9. document basics */
  var h1s = document.querySelectorAll('h1');
  if (h1s.length !== 1) add('heading', document.body, 'expected exactly one h1, found ' + h1s.length);
  if (!document.title.trim()) add('meta', document.head, 'missing <title>');
  var desc = document.querySelector('meta[name="description"]');
  if (!desc || !desc.getAttribute('content').trim()) add('meta', document.head, 'missing meta description');
  document.querySelectorAll('img').forEach(function (img) {
    if (!img.hasAttribute('alt')) add('img-alt', img, 'image without alt attribute');
  });

  /* 10. nested interactive elements */
  all.forEach(function (el) {
    if (el.tagName.toLowerCase() !== 'a') return;
    if (el.querySelector('a[href], button')) add('nested-interactive', el, 'link contains another control');
  });

  /* 11. touch target size (mobile only) */
  var isNarrow = window.innerWidth <= 600;
  if (isNarrow) {
    all.forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      if (tag !== 'a' && tag !== 'button') return;
      if (!visible(el)) return;
      if (el.closest('.util') || el.closest('.crumbs') || el.closest('.dots')) return;
      // WCAG 2.5.8 exception: targets inline in a sentence are exempt.
      if (tag === 'a' && getComputedStyle(el).display === 'inline' &&
          el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length) return;
      var r = el.getBoundingClientRect();
      if (r.height < 24 || r.width < 24) {
        add('tap-target', el, Math.round(r.width) + 'x' + Math.round(r.height) + 'px');
      }
    });
  }

  return JSON.stringify(issues);
})()`;

(async function main() {
  const { cdp, cleanup } = await launch(PORT);
  const pages = ONLY.length
    ? ONLY
    : fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

  let total = 0;

  for (const file of pages) {
    const page = await newPage(cdp, { width: WIDTH, height: HEIGHT, mobile: MOBILE });
    await page.goto('file://' + path.join(ROOT, file));
    await page.settle();

    const raw = await page.evaluate(AUDIT_SCRIPT);
    const issues = JSON.parse(raw);
    const errors = page.messages.filter((m) => /EXCEPTION|^error|^LOG/.test(m));

    const byKind = {};
    issues.forEach((i) => { (byKind[i.kind] = byKind[i.kind] || []).push(i); });

    const count = issues.length + errors.length;
    total += count;
    console.log(`\n  ${count ? '✗' : '✓'} ${file}  ${count ? count + ' issue(s)' : 'clean'}  [${WIDTH}×${HEIGHT}]`);

    errors.forEach((m) => console.log(`      console  ${m}`));
    Object.keys(byKind).sort().forEach((kind) => {
      const list = byKind[kind];
      console.log(`      ${kind} (${list.length})`);
      list.slice(0, 12).forEach((i) => console.log(`        ${i.sel}  ${i.detail}`));
      if (list.length > 12) console.log(`        … ${list.length - 12} more`);
    });

    await page.close();
  }

  cleanup();
  console.log(`\n  ${pages.length} page(s) audited — ${total} issue(s) total\n`);
  process.exit(total ? 1 : 0);
})().catch((err) => {
  console.error('audit failed:', err.stack || err.message);
  process.exit(2);
});

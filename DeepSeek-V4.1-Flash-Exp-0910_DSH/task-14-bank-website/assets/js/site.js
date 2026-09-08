/* ==========================================================================
   Meridian Bank — shared site behaviour
   Vanilla JS, no dependencies. Every feature degrades gracefully: the markup
   works with JavaScript disabled, and the CSS only hides things once
   `html.js` is present (set by the inline script in the document head).
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var html = doc.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (sel, root) { return (root || doc).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };

  /* --- 1. Sticky header shadow ----------------------------------------- */
  var hdr = $('#hdr');
  if (hdr) {
    var onScroll = function () {
      hdr.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- 2. Desktop dropdown menus --------------------------------------- */
  var menuButtons = $$('.nav__link[data-menu]');
  var openMenu = null;

  function setMenu(btn, open) {
    var menu = doc.getElementById(btn.getAttribute('data-menu'));
    if (!menu) return;
    btn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    openMenu = open ? btn : (openMenu === btn ? null : openMenu);
  }

  function closeMenus(except) {
    menuButtons.forEach(function (btn) {
      if (btn !== except) setMenu(btn, false);
    });
    if (!except) openMenu = null;
  }

  menuButtons.forEach(function (btn) {
    var item = btn.closest('.nav__item');

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var willOpen = btn.getAttribute('aria-expanded') !== 'true';
      closeMenus(btn);
      setMenu(btn, willOpen);
    });

    // Pointer affordance: open on hover where a real pointer exists.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var timer;
      item.addEventListener('mouseenter', function () {
        clearTimeout(timer);
        closeMenus(btn);
        setMenu(btn, true);
      });
      item.addEventListener('mouseleave', function () {
        timer = setTimeout(function () { setMenu(btn, false); }, 140);
      });
    }

    // Keyboard: leave the menu group when focus moves outside it.
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) setMenu(btn, false);
    });
  });

  if (menuButtons.length) {
    doc.addEventListener('click', function (e) {
      if (!e.target.closest('.nav__item')) closeMenus();
    });
  }

  /* --- 3. Mobile drawer ------------------------------------------------ */
  var drawer = $('#drawer');
  var burger = $('#burger');
  var lastFocus = null;

  function drawerOpen() {
    if (!drawer) return;
    lastFocus = doc.activeElement;
    drawer.hidden = false;
    drawer.classList.add('is-open');
    doc.body.style.overflow = 'hidden';
    if (burger) burger.setAttribute('aria-expanded', 'true');
    var first = drawer.querySelector('button, a, summary, input');
    if (first) first.focus();
  }

  function drawerClose() {
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.hidden = true;
    doc.body.style.overflow = '';
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (burger) burger.addEventListener('click', drawerOpen);
  $$('[data-drawer-close]').forEach(function (el) {
    el.addEventListener('click', drawerClose);
  });
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') drawerClose();
    });
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), summary, input, select, textarea', drawer)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeMenus();
    drawerClose();
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 980) drawerClose();
  });

  /* --- 4. Tabs --------------------------------------------------------- */
  $$('[data-tabs]').forEach(function (group) {
    var tabs = $$('[role="tab"]', group);
    var panels = $$('[role="tabpanel"]', group);

    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = doc.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      panels.forEach(function (p) {
        if (p.id === tab.getAttribute('aria-controls')) p.hidden = false;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        next.focus();
        select(next);
      });
    });
  });

  /* --- 5. Animated counters -------------------------------------------- */
  var counters = $$('[data-count]');
  if (counters.length) {
    var runCount = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var fmt = function (n) {
        return prefix + n.toLocaleString('en-US', {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals
        }) + suffix;
      };
      if (reduced) { el.textContent = fmt(target); return; }
      var dur = 1100, start = null;
      var step = function (ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          runCount(en.target);
          cio.unobserve(en.target);
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
    } else {
      counters.forEach(runCount);
    }
  }

  /* --- 6. Scroll reveal ------------------------------------------------- */
  var reveals = $$('.reveal');
  if (reveals.length && !reduced && 'IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        rio.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { rio.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* --- 7. Copy-to-clipboard -------------------------------------------- */
  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        var old = btn.getAttribute('data-label') || btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
      } else {
        var ta = doc.createElement('textarea');
        ta.value = text;
        doc.body.appendChild(ta);
        ta.select();
        try { doc.execCommand('copy'); done(); } catch (err) { /* ignore */ }
        doc.body.removeChild(ta);
      }
    });
  });

  /* --- 8. Smooth in-page links (respect reduced motion) ---------------- */
  if (!reduced) {
    doc.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = doc.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', id);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* --- 9. Testimonials rotator ----------------------------------------- */
  var rotator = $('[data-rotator]');
  if (rotator) {
    var slides = $$('[data-slide]', rotator);
    var dots = $$('[data-dot]', rotator);
    var index = 0, timer = null;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.hidden = n !== index; });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === index)); });
    }
    function play() {
      if (reduced || slides.length < 2) return;
      timer = setInterval(function () { show(index + 1); }, 7000);
    }
    function stop() { clearInterval(timer); }

    dots.forEach(function (d, n) {
      d.addEventListener('click', function () { stop(); show(n); play(); });
    });
    rotator.addEventListener('mouseenter', stop);
    rotator.addEventListener('mouseleave', play);
    rotator.addEventListener('focusin', stop);
    rotator.addEventListener('focusout', play);
    show(0);
    play();
  }

  /* --- 10. Generic client-side list filter ------------------------------ */
  $$('[data-filterlist]').forEach(function (root) {
    var input = $('[data-filterlist-input]', root);
    var items = $$('[data-filter-item]', root);
    var empty = $('[data-filterlist-empty]', root);
    var count = $('[data-filterlist-count]', root);
    if (!input || !items.length) return;

    var run = function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var hit = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
        item.hidden = !hit;
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      if (count) count.textContent = String(shown);
    };

    input.addEventListener('input', run);
    run();
  });

  /* --- 11. Current-section highlighting in the drawer ------------------ */
  $$('.dgroup').forEach(function (group) {
    if (group.querySelector('a[aria-current="page"]')) group.open = true;
  });
})();

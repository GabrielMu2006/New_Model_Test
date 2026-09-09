/**
 * app.js — the UI layer for Shelf.
 *
 * Everything in here is presentation and wiring: DOM, events, rendering,
 * persistence. All book semantics (validation, status transitions, search,
 * sorting, statistics, import/export) live in book-engine.js.
 *
 * The app is exposed as `window.BookApp` so the browser self-test can drive the
 * real UI the way a user would.
 */
(function () {
  'use strict';

  var E = window.BookEngine;
  var STORAGE_KEY = 'book-tracker.v1';

  /* ==========================================================================
   * state
   * ======================================================================== */

  var state = {
    books: [],
    view: 'grid',
    sort: 'added',
    query: '',
    filters: { status: 'all', genre: '', tag: '', format: 'all', ratingMin: null, favorite: false },
    editingId: null,
    detailId: null,
    formStatus: 'want',
    formRating: 0,
    formStarted: '',
    formFinished: ''
  };

  var undo = { book: null, index: -1, timer: 0 };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ==========================================================================
   * persistence
   * ======================================================================== */

  function storageAvailable() {
    try {
      var probe = '__shelf_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  var canPersist = storageAvailable();

  function save() {
    if (!canPersist) return false;
    try {
      var payload = E.toLibrary(state.books, { now: Date.now() });
      payload.prefs = { view: state.view, sort: state.sort, filters: state.filters };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      return false;
    }
  }

  function load() {
    if (!canPersist) return false;
    var raw;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (err) { return false; }
    if (!raw) return false;

    var parsed = E.parseLibrary(raw, Date.now(), { allowEmpty: true });
    if (!parsed.ok) return false;
    state.books = parsed.books;

    try {
      var prefs = JSON.parse(raw).prefs;
      if (prefs && typeof prefs === 'object') {
        if (prefs.view === 'grid' || prefs.view === 'list') state.view = prefs.view;
        if (E.SORT_KEYS.indexOf(prefs.sort) >= 0) state.sort = prefs.sort;
        if (prefs.filters && typeof prefs.filters === 'object') {
          var f = prefs.filters;
          if (typeof f.status === 'string' && (f.status === 'all' || E.isStatus(f.status))) state.filters.status = f.status;
          if (typeof f.genre === 'string') state.filters.genre = f.genre;
          if (typeof f.tag === 'string') state.filters.tag = f.tag;
          if (E.FORMATS.indexOf(f.format) >= 0 || f.format === 'all') state.filters.format = f.format || 'all';
          if (typeof f.ratingMin === 'number') state.filters.ratingMin = f.ratingMin;
          if (f.favorite === true) state.filters.favorite = true;
        }
      }
    } catch (err) { /* prefs are optional */ }
    return true;
  }

  /* ==========================================================================
   * covers — deterministic, generated, no image assets
   * ======================================================================== */

  var COVER_GRADIENTS = [
    ['#3d3168', '#191433'], ['#1f4f57', '#0c2429'], ['#5c2f31', '#2a1315'],
    ['#2f4570', '#131d33'], ['#4d3c1e', '#241b0c'], ['#2b4c34', '#101f10'],
    ['#4b2c51', '#1e1123'], ['#573621', '#241407'], ['#22404f', '#0d1c24'],
    ['#3f4260', '#181a2c'], ['#31404a', '#131c22'], ['#46304a', '#1c1220']
  ];

  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function coverColors(book) {
    var key = (book.title || '') + '|' + (book.author || '');
    var pair = COVER_GRADIENTS[hashString(key) % COVER_GRADIENTS.length];
    return 'linear-gradient(155deg, ' + pair[0] + ' 0%, ' + pair[1] + ' 100%)';
  }

  function coverHTML(book, cls) {
    var pct = E.progressPercent(book);
    var badge = book.status === 'finished' ? '' :
      '<div class="cover-badge"><span style="width:' + pct + '%"></span></div>';
    return '<div class="cover ' + (cls || '') + '" style="background:' + coverColors(book) + '">' +
      (book.favorite ? '<div class="cover-fav" title="Favourite">♥</div>' : '') +
      '<div class="cover-title">' + esc(book.title || 'Untitled') + '</div>' +
      '<div class="cover-author">' + esc(book.author || 'Unknown author') + '</div>' +
      badge +
      '</div>';
  }

  function starsHTML(rating) {
    if (!rating) return '<span class="stars"><span class="off">☆☆☆☆☆</span></span>';
    var out = '<span class="stars" title="' + rating + ' out of 5">';
    for (var i = 1; i <= 5; i++) {
      if (rating >= i) out += '★';
      else if (rating >= i - 0.5) out += '⯨';
      else out += '<span class="off">★</span>';
    }
    return out + '</span>';
  }

  function statusPill(status) {
    return '<span class="pill pill-' + status + '">' + esc(E.STATUS_SHORT[status] || status) + '</span>';
  }

  function fmtDate(key) {
    if (!key) return '—';
    var d = E.dateKeyToDate(key);
    if (!d) return esc(key);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  }

  /* ==========================================================================
   * selection helpers
   * ======================================================================== */

  function visibleBooks() {
    var f = state.filters;
    return E.sortBooks(E.filterBooks(state.books, {
      query: state.query,
      status: f.status,
      genre: f.genre,
      tag: f.tag,
      format: f.format,
      ratingMin: f.ratingMin,
      favorite: f.favorite
    }), state.sort);
  }

  function filtersActive() {
    var f = state.filters;
    return !!(state.query || f.status !== 'all' || f.genre || f.tag ||
      f.format !== 'all' || f.ratingMin !== null || f.favorite);
  }

  /* ==========================================================================
   * rendering
   * ======================================================================== */

  function render() {
    renderStats();
    renderSidebar();
    renderToolbar();
    renderView();
  }

  function renderStats() {
    var s = E.computeStats(state.books, { now: Date.now() });
    var remaining = 0;
    state.books.forEach(function (b) { if (b.status === 'reading') remaining += E.pagesRemaining(b); });

    var cards = [
      { label: 'In your library', value: s.total, sub: plural(s.want, 'want to read', 'want to read') },
      { label: 'Finished', value: s.finished, sub: plural(s.finishedThisYear, 'this year', 'this year') },
      { label: 'Reading now', value: s.reading, sub: remaining ? plural(remaining, 'page left', 'pages left') : 'nothing on the go' },
      { label: 'Pages read', value: s.pagesRead.toLocaleString(), sub: s.totalLibraryPages.toLocaleString() + ' in the library' },
      { label: 'Average rating', value: s.avgRating ? s.avgRating.toFixed(2) : '—', sub: plural(s.ratedCount, 'book rated', 'books rated') },
      { label: 'Reading streak', value: s.streak, sub: 'longest ' + plural(s.bestStreak, 'day') }
    ];

    $('stats').innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="stat-label">' + esc(c.label) + '</div>' +
        '<div class="stat-value">' + esc(c.value) + '</div>' +
        '<div class="stat-sub">' + esc(c.sub) + '</div></div>';
    }).join('');
  }

  function renderSidebar() {
    var s = E.computeStats(state.books, { now: Date.now() });
    var rows = [{ id: 'all', label: 'All books', count: s.total, dot: '' }].concat(
      E.STATUSES.map(function (st) {
        return { id: st, label: E.STATUS_LABELS[st], count: s.byStatus[st] || 0, dot: 'dot-' + st };
      })
    );
    if (s.favoriteCount) {
      rows.push({ id: 'favorite', label: 'Favourites', count: s.favoriteCount, dot: '' });
    }

    $('status-nav').innerHTML = rows.map(function (r) {
      var active = r.id === 'favorite'
        ? state.filters.favorite
        : (!state.filters.favorite && state.filters.status === r.id);
      return '<button class="nav-item" data-nav="' + r.id + '" aria-current="' + (active ? 'true' : 'false') + '">' +
        '<span class="nav-dot ' + r.dot + '"></span>' +
        '<span class="nav-label">' + esc(r.label) + '</span>' +
        '<span class="nav-count">' + r.count + '</span></button>';
    }).join('');

    chipGroup('genre-filter', E.distinctValues(state.books, 'genre'), state.filters.genre, 'genre');
    chipGroup('tag-filter', E.distinctValues(state.books, 'tags'), state.filters.tag, 'tag');

    var formats = E.FORMATS.filter(function (f) {
      return state.books.some(function (b) { return b.format === f; });
    });
    $('format-filter').innerHTML = ['all'].concat(formats).map(function (f) {
      var label = f === 'all' ? 'Any' : E.FORMAT_LABELS[f];
      var on = state.filters.format === f;
      return '<button class="chip" data-format="' + f + '" aria-pressed="' + on + '">' + esc(label) + '</button>';
    }).join('');

    var ratings = [['', 'Any'], [4, '4★+'], [4.5, '4.5★+'], [5, '5★']];
    $('rating-filter').innerHTML = ratings.map(function (r) {
      var on = (r[0] === '' && state.filters.ratingMin === null) || state.filters.ratingMin === r[0];
      return '<button class="chip" data-rating="' + r[0] + '" aria-pressed="' + on + '">' + esc(r[1]) + '</button>';
    }).join('');

    $('sort-select').innerHTML = E.SORT_KEYS.map(function (k) {
      return '<option value="' + k + '"' + (k === state.sort ? ' selected' : '') + '>' + esc(E.SORT_LABELS[k]) + '</option>';
    }).join('');

    var genres = E.distinctValues(state.books, 'genre');
    $('genre-options').innerHTML = genres.map(function (g) {
      return '<option value="' + esc(g) + '"></option>';
    }).join('');
  }

  function chipGroup(id, values, current, attr) {
    var host = $(id);
    if (!values.length) {
      host.innerHTML = '<span class="hint" style="padding:0 2px">None yet</span>';
      return;
    }
    host.innerHTML = values.map(function (v) {
      var on = (current || '').toLowerCase() === v.toLowerCase();
      return '<button class="chip" data-' + attr + '="' + esc(v) + '" aria-pressed="' + on + '">' + esc(v) + '</button>';
    }).join('');
  }

  function renderToolbar() {
    var titles = {
      all: 'All books', want: 'Want to read', reading: 'Currently reading',
      paused: 'Paused', finished: 'Finished', abandoned: 'Abandoned'
    };
    var title = state.filters.favorite ? 'Favourites' : (titles[state.filters.status] || 'All books');
    if (state.query) title = 'Search results';

    var list = visibleBooks();
    $('view-title').textContent = title;
    $('view-count').textContent = filtersActive()
      ? plural(list.length, 'book') + ' of ' + state.books.length
      : plural(state.books.length, 'book');
    $('btn-clear-filters').hidden = !filtersActive();
    $('btn-view-grid').setAttribute('aria-pressed', String(state.view === 'grid'));
    $('btn-view-list').setAttribute('aria-pressed', String(state.view === 'list'));
    $('search').value = state.query;
    $('search-wrap').classList.toggle('has-value', !!state.query);
  }

  function renderView() {
    var host = $('view');
    var list = visibleBooks();

    if (!state.books.length) {
      host.innerHTML = emptyState(
        '📚',
        'Your shelf is empty',
        'Add the book on your nightstand, or load a small sample library to see how everything works.',
        '<button class="btn btn-primary" data-action="add">+ Add your first book</button>' +
        '<button class="btn" data-action="samples">Load a sample library</button>'
      );
      return;
    }

    if (!list.length) {
      host.innerHTML = emptyState(
        '🔍',
        'No books match',
        'Try a different search, or clear the filters to see your whole library.',
        '<button class="btn" data-action="clear-filters">Clear filters</button>'
      );
      return;
    }

    host.innerHTML = state.view === 'grid' ? gridHTML(list) : listHTML(list);
  }

  function emptyState(art, title, text, actions) {
    return '<div class="empty"><div class="empty-art">' + art + '</div>' +
      '<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
      '<div class="empty-actions">' + actions + '</div></div>';
  }

  function gridHTML(list) {
    return '<div class="grid" id="book-grid">' + list.map(function (b, i) {
      var pct = E.progressPercent(b);
      var showProgress = b.status === 'reading' || b.status === 'paused' || (b.pageCount && pct > 0 && pct < 100);
      return '<article class="card" role="button" tabindex="' + (i === 0 ? '0' : '-1') + '" data-id="' + esc(b.id) + '" data-index="' + i + '" aria-label="' + esc(b.title) + '">' +
        coverHTML(b) +
        '<div class="card-meta">' +
          '<div class="card-title">' + esc(b.title) + '</div>' +
          '<div class="card-author">' + esc(b.author || 'Unknown author') + '</div>' +
          '<div class="card-row">' + statusPill(b.status) +
            (b.rating ? starsHTML(b.rating) : '') +
          '</div>' +
          (showProgress
            ? '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
              '<div class="progress-label">' + (b.pageCount ? b.currentPage + ' / ' + b.pageCount + ' pages · ' + pct + '%' : pct + '%') + '</div>'
            : (b.pageCount ? '<div class="progress-label">' + plural(b.pageCount, 'page') + '</div>' : '')) +
        '</div></article>';
    }).join('') + '</div>';
  }

  function listHTML(list) {
    var cols = [
      ['title', 'Title'], ['author', 'Author'], ['status', 'Status'],
      ['pages', 'Pages'], ['progress', 'Progress'], ['rating', 'Rating'], ['finished', 'Finished']
    ];
    var head = cols.map(function (c) {
      return '<th data-sortable="' + c[0] + '"' + (state.sort === c[0] ? ' aria-sort="descending"' : '') + '>' + esc(c[1]) + '</th>';
    }).join('');

    var rows = list.map(function (b, i) {
      var pct = E.progressPercent(b);
      return '<tr data-id="' + esc(b.id) + '" data-index="' + i + '" tabindex="0">' +
        '<td><div class="cell-title">' + coverHTML(b, 'row-cover') +
          '<div><div class="t-title">' + esc(b.title) + (b.favorite ? ' ♥' : '') + '</div>' +
          '<div class="t-author">' + esc(b.author || 'Unknown author') + '</div></div></div></td>' +
        '<td class="t-author">' + esc(b.author || '—') + '</td>' +
        '<td>' + statusPill(b.status) + '</td>' +
        '<td class="num">' + (b.pageCount || '—') + '</td>' +
        '<td class="num">' + (b.pageCount ? pct + '%' : '—') + '</td>' +
        '<td>' + (b.rating ? starsHTML(b.rating) : '<span class="t-author">—</span>') + '</td>' +
        '<td class="t-author">' + (b.finishedAt ? esc(fmtDate(b.finishedAt)) : '—') + '</td>' +
        '</tr>';
    }).join('');

    return '<table class="table"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ==========================================================================
   * toasts
   * ======================================================================== */

  function toast(message, opts) {
    var o = opts || {};
    var host = $('toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (o.type ? ' toast-' + o.type : '');
    el.innerHTML = '<span class="msg">' + esc(message) + '</span>';
    if (o.action) {
      var btn = document.createElement('button');
      btn.textContent = o.action.label;
      btn.addEventListener('click', function () {
        dismiss();
        o.action.run();
      });
      el.appendChild(btn);
    }
    function dismiss() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    host.appendChild(el);
    var life = o.duration || (o.action ? 7000 : 3800);
    var timer = setTimeout(dismiss, life);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, 2000); });
    return el;
  }

  /* ==========================================================================
   * modals
   * ======================================================================== */

  var openStack = [];

  function openModal(id) {
    var el = $(id);
    if (!el) return;
    el.hidden = false;
    // Re-opening an already-open dialog (the detail view refreshes itself after
    // every action) must not grow the stack, or Escape would need five presses.
    if (openStack.indexOf(id) < 0) openStack.push(id);
    var focusable = el.querySelector('input:not([type=hidden]), textarea, select, button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 20);
  }

  function closeModal(id) {
    var el = $(id);
    if (!el) return;
    el.hidden = true;
    var at = openStack.lastIndexOf(id);
    if (at >= 0) openStack.splice(at, 1);
  }

  function closeTopModal() {
    if (!openStack.length) return false;
    closeModal(openStack[openStack.length - 1]);
    return true;
  }

  function closeAllModals() {
    while (openStack.length) closeModal(openStack.pop());
  }

  /* ==========================================================================
   * book form
   * ======================================================================== */

  function setFormStatus(status) {
    state.formStatus = status;
    $('f-status').value = status;
    Array.prototype.forEach.call($('status-input').querySelectorAll('button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.status === status));
    });
  }

  function setFormRating(rating) {
    state.formRating = E.normalizeRating(rating);
    $('f-rating').value = String(state.formRating);
    Array.prototype.forEach.call($('rating-input').querySelectorAll('[data-star]'), function (btn) {
      var n = Number(btn.dataset.star);
      btn.classList.toggle('on', state.formRating >= n - 0.5);
      btn.textContent = state.formRating >= n ? '★' : (state.formRating >= n - 0.5 ? '⯨' : '☆');
    });
  }

  function clearErrors() {
    ['title', 'author', 'isbn', 'pages', 'page', 'started', 'finished'].forEach(function (f) {
      var el = $('e-' + f);
      if (el) { el.textContent = ''; el.classList.remove('show'); }
    });
    ['f-title', 'f-isbn', 'f-pages', 'f-page', 'f-started', 'f-finished'].forEach(function (id) {
      var el = $(id);
      if (el) el.removeAttribute('aria-invalid');
    });
  }

  function showErrors(errors) {
    var map = { title: 'e-title', author: 'e-author', isbn: 'e-isbn', pageCount: 'e-pages', currentPage: 'e-page', startedAt: 'e-started', finishedAt: 'e-finished' };
    var first = null;
    Object.keys(errors).forEach(function (field) {
      var el = $(map[field]);
      if (el) { el.textContent = errors[field]; el.classList.add('show'); }
      var input = $({ pageCount: 'f-pages', currentPage: 'f-page', startedAt: 'f-started', finishedAt: 'f-finished' }[field] || 'f-' + field);
      if (input) input.setAttribute('aria-invalid', 'true');
      if (!first) first = input;
    });
    if (first) first.focus();
  }

  function readForm() {
    return {
      id: state.editingId || undefined,
      title: $('f-title').value,
      author: $('f-author').value,
      genre: $('f-genre').value,
      isbn: $('f-isbn').value,
      tags: $('f-tags').value,
      status: state.formStatus,
      pageCount: $('f-pages').value,
      currentPage: $('f-page').value,
      format: $('f-format').value,
      startedAt: $('f-started').value,
      finishedAt: $('f-finished').value,
      rating: state.formRating,
      notes: $('f-notes').value,
      favorite: $('f-favorite').checked
    };
  }

  function fillForm(book) {
    var b = book || E.emptyBook();
    $('f-title').value = b.title || '';
    $('f-author').value = b.author || '';
    $('f-genre').value = b.genre || '';
    $('f-isbn').value = b.isbn ? E.formatIsbn(b.isbn) : '';
    $('f-tags').value = (b.tags || []).join(', ');
    $('f-pages').value = b.pageCount || '';
    $('f-page').value = b.currentPage || '';
    $('f-format').value = b.format || 'print';
    $('f-started').value = b.startedAt || '';
    $('f-finished').value = b.finishedAt || '';
    $('f-notes').value = b.notes || '';
    $('f-favorite').checked = !!b.favorite;
    setFormStatus(b.status || 'want');
    setFormRating(b.rating || 0);
    clearErrors();
    updateDuplicateHint();
  }

  function updateDuplicateHint() {
    var hint = $('dup-hint');
    if (!hint) return;
    var title = $('f-title').value.trim();
    if (!title) { hint.textContent = ''; return; }
    var candidate = E.normalizeBook({
      id: state.editingId || 'new',
      title: title,
      author: $('f-author').value,
      isbn: $('f-isbn').value
    }, Date.now());
    var dup = E.findDuplicate(state.books, candidate);
    hint.textContent = dup
      ? '⚠ You already have "' + dup.title + '"' + (dup.author ? ' by ' + dup.author : '') + '.'
      : '';
    hint.className = dup ? 'warn' : 'hint';
  }

  function openEditor(id) {
    var book = id ? E.findBook(state.books, id) : null;
    state.editingId = book ? book.id : null;
    $('book-form-title').textContent = book ? 'Edit book' : 'Add a book';
    $('book-form-sub').textContent = book ? 'Changes are saved to this browser.' : 'Only the title is required.';
    $('btn-delete-book').hidden = !book;
    fillForm(book);
    openModal('modal-book');
  }

  function saveForm() {
    var input = readForm();
    var candidate = state.editingId
      ? E.normalizeBook(Object.assign({}, E.findBook(state.books, state.editingId), input), Date.now())
      : E.createBook(input, Date.now());

    var check = E.validateBook(candidate, Date.now());
    if (!check.ok) {
      showErrors(check.errors);
      toast('Please fix the highlighted fields.', { type: 'err' });
      return false;
    }

    clearErrors();
    var isNew = !state.editingId;
    state.books = E.upsertBook(state.books, candidate, Date.now());
    state.editingId = null;
    save();
    closeModal('modal-book');
    render();
    toast(isNew ? 'Added "' + candidate.title + '".' : 'Updated "' + candidate.title + '".', { type: 'ok' });
    return true;
  }

  /* ==========================================================================
   * actions
   * ======================================================================== */

  var actions = {
    addBook: function (input) {
      var book = E.createBook(input, Date.now());
      var check = E.validateBook(book, Date.now());
      if (!check.ok) return { ok: false, errors: check.errors };
      state.books = E.upsertBook(state.books, book, Date.now());
      save();
      render();
      return { ok: true, book: book };
    },

    updateBook: function (id, patch) {
      var existing = E.findBook(state.books, id);
      if (!existing) return { ok: false, errors: { id: 'Book not found.' } };
      var next = E.normalizeBook(Object.assign({}, existing, patch), Date.now());
      var check = E.validateBook(next, Date.now());
      if (!check.ok) return { ok: false, errors: check.errors };
      state.books = E.upsertBook(state.books, next, Date.now());
      save();
      render();
      return { ok: true, book: next };
    },

    deleteBook: function (id) {
      var index = state.books.findIndex(function (b) { return b.id === id; });
      if (index < 0) return false;
      var removed = state.books[index];
      state.books = E.removeBook(state.books, id);
      undo = { book: removed, index: index, timer: Date.now() };
      save();
      render();
      toast('Deleted "' + removed.title + '".', {
        type: 'err',
        action: {
          label: 'Undo',
          run: function () {
            var list = state.books.slice();
            list.splice(Math.min(undo.index, list.length), 0, undo.book);
            state.books = list;
            save();
            render();
            toast('Restored "' + undo.book.title + '".', { type: 'ok' });
          }
        }
      });
      return true;
    },

    setStatus: function (id, status) {
      var book = E.findBook(state.books, id);
      if (!book) return false;
      state.books = E.upsertBook(state.books, E.setStatus(book, status, Date.now()), Date.now());
      save();
      render();
      return true;
    },

    setProgress: function (id, page) {
      var book = E.findBook(state.books, id);
      if (!book) return false;
      state.books = E.upsertBook(state.books, E.setProgress(book, page, Date.now()), Date.now());
      save();
      render();
      return true;
    },

    addProgress: function (id, delta) {
      var book = E.findBook(state.books, id);
      if (!book) return false;
      state.books = E.upsertBook(state.books, E.addProgress(book, delta, Date.now()), Date.now());
      save();
      render();
      return true;
    },

    toggleFavorite: function (id) {
      var book = E.findBook(state.books, id);
      if (!book) return false;
      return actions.updateBook(id, { favorite: !book.favorite }).ok;
    },

    setFilter: function (patch) {
      var f = state.filters;
      if ('status' in patch) { f.status = patch.status; if (patch.status !== 'all') f.favorite = false; }
      if ('genre' in patch) f.genre = patch.genre;
      if ('tag' in patch) f.tag = patch.tag;
      if ('format' in patch) f.format = patch.format;
      if ('ratingMin' in patch) f.ratingMin = patch.ratingMin;
      if ('favorite' in patch) { f.favorite = !!patch.favorite; if (patch.favorite) f.status = 'all'; }
      save();
      render();
    },

    setQuery: function (q) {
      state.query = String(q === undefined || q === null ? '' : q);
      save();
      render();
    },

    setSort: function (key) {
      if (E.SORT_KEYS.indexOf(key) < 0) return false;
      state.sort = key;
      save();
      render();
      return true;
    },

    setView: function (view) {
      if (view !== 'grid' && view !== 'list') return false;
      state.view = view;
      save();
      render();
      return true;
    },

    clearFilters: function () {
      state.query = '';
      state.filters = { status: 'all', genre: '', tag: '', format: 'all', ratingMin: null, favorite: false };
      save();
      render();
    },

    loadSamples: function () {
      var samples = E.sampleBooks(Date.now());
      var merged = E.mergeLibraries(state.books, samples, { mode: 'skip', now: Date.now() });
      state.books = merged.books;
      save();
      render();
      return merged.added;
    },

    clearAll: function () {
      state.books = [];
      save();
      render();
    },

    importText: function (text, mode) {
      var kind = E.detectFormat(text);
      var parsed;
      if (kind === 'csv') parsed = E.importCSV(text, Date.now());
      else parsed = E.parseLibrary(text, Date.now());
      if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: parsed.warnings || [] };

      var result = E.mergeLibraries(state.books, parsed.books, { mode: mode || 'skip', now: Date.now() });
      state.books = result.books;
      save();
      render();
      return {
        ok: true,
        added: result.added,
        updated: result.updated,
        skipped: result.skipped,
        warnings: (parsed.warnings || []).concat(result.duplicates.map(function (d) {
          return 'Duplicate of "' + d.existing.title + '".';
        }))
      };
    },

    exportJSON: function () {
      return E.serializeLibrary(state.books, { now: Date.now() });
    },

    exportCSV: function () {
      return E.toCSV(E.sortBooks(state.books, 'title', 'asc'));
    }
  };

  /* ==========================================================================
   * detail modal
   * ======================================================================== */

  function openDetail(id) {
    var b = E.findBook(state.books, id);
    if (!b) return false;
    state.detailId = id;
    $('detail-title').textContent = b.title;
    $('detail-sub').textContent = b.author || 'Unknown author';
    $('detail-body').innerHTML = detailHTML(b);
    openModal('modal-detail');
    return true;
  }

  function detailHTML(b) {
    var pct = E.progressPercent(b);
    var pace = E.readingPace(b, Date.now());
    var eta = E.projectedFinish(b, Date.now());

    var facts = [
      ['Status', statusPill(b.status)],
      ['Rating', b.rating ? starsHTML(b.rating) : '<span class="t-author">Not rated</span>'],
      ['Progress', b.pageCount
        ? '<strong>' + b.currentPage + '</strong> of ' + b.pageCount + ' pages (' + pct + '%)'
        : '<span class="t-author">No page count</span>'],
      ['Format', esc(E.FORMAT_LABELS[b.format] || b.format)],
      ['Genre', b.genre ? esc(b.genre) : '—'],
      ['ISBN', b.isbn ? '<span style="font-family:var(--mono);font-size:12px">' + esc(E.formatIsbn(b.isbn)) + '</span>' : '—'],
      ['Added', fmtDate(b.addedAt)],
      ['Started', fmtDate(b.startedAt)],
      ['Finished', fmtDate(b.finishedAt)]
    ];
    if (pace > 0) facts.push(['Pace', pace.toFixed(1) + ' pages/day']);
    if (eta) facts.push(['On track for', fmtDate(eta)]);

    var statusButtons = E.STATUSES.map(function (s) {
      return '<button class="btn btn-sm" data-set-status="' + s + '"' +
        (s === b.status ? ' disabled' : '') + '>' + esc(E.STATUS_LABELS[s]) + '</button>';
    }).join('');

    var quick = b.pageCount ? (
      '<div class="progress-editor">' +
        '<input id="detail-page" type="number" min="0" max="' + b.pageCount + '" value="' + b.currentPage + '" aria-label="Current page">' +
        '<span class="t-author">of ' + b.pageCount + '</span>' +
        '<button class="btn btn-sm" data-progress-set="1">Save</button>' +
        '<button class="btn btn-sm" data-progress-add="10">+10</button>' +
        '<button class="btn btn-sm" data-progress-add="25">+25</button>' +
      '</div>'
    ) : '';

    return '<div class="detail-hero">' +
        '<div class="detail-cover">' + coverHTML(b) + '</div>' +
        '<div class="detail-meta">' +
          '<h3 class="detail-title">' + esc(b.title) + (b.favorite ? ' <span style="color:var(--accent)">♥</span>' : '') + '</h3>' +
          '<div class="detail-author">' + esc(b.author || 'Unknown author') + '</div>' +
          '<div class="card-row">' + statusPill(b.status) +
            (b.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
          '</div>' +
          (b.pageCount ? '<div class="progress" style="margin-top:12px"><i style="width:' + pct + '%"></i></div>' : '') +
          quick +
          '<dl class="kv">' + facts.map(function (f) {
            return '<dt>' + esc(f[0]) + '</dt><dd>' + f[1] + '</dd>';
          }).join('') + '</dl>' +
        '</div>' +
      '</div>' +
      (b.notes ? '<div class="section-title">Notes</div><div class="notes-box">' + esc(b.notes) + '</div>' : '') +
      '<div class="section-title">Move to</div>' +
      '<div class="seg-input">' + statusButtons + '</div>';
  }

  /* ==========================================================================
   * statistics modal
   * ======================================================================== */

  function openStats() {
    var s = E.computeStats(state.books, { now: Date.now() });
    $('stats-sub').textContent = state.books.length
      ? s.total + ' books · ' + s.finished + ' finished · ' + s.pagesRead.toLocaleString() + ' pages read'
      : 'Add a few books to see your reading profile.';

    var maxMonth = Math.max(1, Math.max.apply(null, s.monthlyFinishes.map(function (m) { return m.count; })));
    var monthBars = s.monthlyFinishes.map(function (m) {
      var h = Math.round((m.count / maxMonth) * 84);
      var label = new Date(m.month + '-01T12:00:00').toLocaleDateString(undefined, { month: 'short' });
      return '<div class="month-col" title="' + esc(m.month) + ': ' + m.count + '">' +
        '<div class="month-bar' + (m.count ? '' : ' zero') + '" style="height:' + Math.max(3, h) + 'px"></div>' +
        '<div class="month-label">' + esc(label) + '</div></div>';
    }).join('');

    var maxGenre = Math.max(1, s.genreCounts.length ? s.genreCounts[0][1] : 1);
    var genreBars = s.genreCounts.slice(0, 8).map(function (g) {
      return barRow(g[0], g[1], Math.round((g[1] / maxGenre) * 100));
    }).join('') || '<div class="hint">No genres recorded yet.</div>';

    var maxRating = Math.max(1, Math.max.apply(null, E.RATING_BINS.map(function (k) {
      return s.ratingHistogram[k] || 0;
    })));
    var ratingBars = E.RATING_BINS.map(function (k) {
      var v = s.ratingHistogram[k] || 0;
      return barRow(k + '★', v, Math.round((v / maxRating) * 100));
    }).join('');

    var authorBars = s.topAuthors.map(function (a) {
      return barRow(a[0], a[1], Math.round((a[1] / s.topAuthors[0][1]) * 100));
    }).join('') || '<div class="hint">No authors yet.</div>';

    $('stats-body').innerHTML =
      '<div class="stats" style="margin-bottom:18px">' +
        statCard('Books finished', s.finished, plural(s.finishedThisYear, 'this year', 'this year')) +
        statCard('Pages read', s.pagesRead.toLocaleString(), s.finishedPages.toLocaleString() + ' from finished books') +
        statCard('Average rating', s.avgRating ? s.avgRating.toFixed(2) + ' ★' : '—', plural(s.ratedCount, 'book rated', 'books rated')) +
        statCard('Completion rate', s.finishRate + '%', s.abandoned ? s.abandoned + ' abandoned' : 'nothing abandoned') +
        statCard('Current streak', plural(s.streak, 'day'), 'longest ' + plural(s.bestStreak, 'day')) +
        statCard('Average length', s.avgPages ? s.avgPages.toLocaleString() : '—', 'pages per book') +
      '</div>' +

      '<div class="section-title">Books finished per month</div>' +
      '<div class="month-chart">' + monthBars + '</div>' +

      '<div class="section-title">By genre</div>' +
      '<div class="chart">' + genreBars + '</div>' +

      '<div class="section-title">Rating distribution</div>' +
      '<div class="chart">' + ratingBars + '</div>' +

      '<div class="section-title">Most-read authors</div>' +
      '<div class="chart">' + authorBars + '</div>' +

      '<div class="section-title">Shelf facts</div>' +
      '<dl class="kv">' +
        kv('Longest book', s.longest ? esc(s.longest.title) + ' — ' + s.longest.pageCount + ' pages' : '—') +
        kv('Shortest book', s.shortest ? esc(s.shortest.title) + ' — ' + s.shortest.pageCount + ' pages' : '—') +
        kv('Reading now', plural(s.reading, 'book')) +
        kv('Waiting to be read', plural(s.want, 'book')) +
        kv('Favourites', plural(s.favoriteCount, 'book')) +
        kv('Days with reading logged', String(s.activeDays)) +
      '</dl>';

    openModal('modal-stats');
  }

  function statCard(label, value, sub) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div>' +
      '<div class="stat-value">' + esc(value) + '</div>' +
      '<div class="stat-sub">' + esc(sub) + '</div></div>';
  }

  function barRow(name, value, pct) {
    return '<div class="bar-row"><span class="name">' + esc(name) + '</span>' +
      '<span class="track"><i style="width:' + Math.max(2, pct) + '%"></i></span>' +
      '<span class="val">' + value + '</span></div>';
  }

  function kv(k, v) {
    return '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>';
  }

  /* ==========================================================================
   * import / export modal
   * ======================================================================== */

  function download(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (err) {
      return false;
    }
  }

  function previewImport(text) {
    var host = $('io-preview');
    if (!text || !text.trim()) { host.innerHTML = ''; return null; }
    var kind = E.detectFormat(text);
    var parsed = kind === 'csv' ? E.importCSV(text, Date.now()) : E.parseLibrary(text, Date.now());

    if (!parsed.ok) {
      host.innerHTML = '<div class="err show">' +
        esc((parsed.errors || ['Could not read that.']).join(' ')) + '</div>';
      return null;
    }

    var dupes = parsed.books.filter(function (b) { return !!E.findDuplicate(state.books, b); }).length;
    var warnings = (parsed.warnings || []).slice(0, 4);

    host.innerHTML = '<div class="warn" style="color:var(--ok)">✓ Found ' +
      plural(parsed.books.length, 'book') + ' (' + kind.toUpperCase() + ')' +
      (dupes ? ' · ' + dupes + ' already in your library' : '') + '</div>' +
      (warnings.length
        ? '<div class="hint">' + warnings.map(esc).join('<br>') + '</div>'
        : '') +
      '<div class="hint">' + parsed.books.slice(0, 3).map(function (b) {
        return esc(b.title) + (b.author ? ' — ' + esc(b.author) : '');
      }).join('<br>') + (parsed.books.length > 3 ? '<br>…' : '') + '</div>';
    return parsed;
  }

  /* ==========================================================================
   * events
   * ======================================================================== */

  function bind() {
    /* --- topbar --- */
    $('btn-add').addEventListener('click', function () { openEditor(null); });
    $('btn-stats').addEventListener('click', openStats);
    $('btn-io').addEventListener('click', function () { openModal('modal-io'); });
    $('btn-help').addEventListener('click', function () { openModal('modal-help'); });
    $('btn-sidebar').addEventListener('click', function () {
      $('sidebar').classList.toggle('open');
    });

    $('search').addEventListener('input', function (ev) {
      state.query = ev.target.value;
      $('search-wrap').classList.toggle('has-value', !!state.query);
      renderToolbar();
      renderView();
      save();
    });
    $('search-clear').addEventListener('click', function () {
      $('search').value = '';
      actions.setQuery('');
      $('search').focus();
    });

    /* --- sidebar --- */
    $('status-nav').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-nav]');
      if (!btn) return;
      var id = btn.dataset.nav;
      if (id === 'favorite') actions.setFilter({ favorite: true, status: 'all' });
      else actions.setFilter({ status: id, favorite: false });
    });

    $('genre-filter').addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-genre]');
      if (!chip) return;
      var v = chip.dataset.genre;
      actions.setFilter({ genre: state.filters.genre.toLowerCase() === v.toLowerCase() ? '' : v });
    });

    $('tag-filter').addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-tag]');
      if (!chip) return;
      var v = chip.dataset.tag;
      actions.setFilter({ tag: state.filters.tag.toLowerCase() === v.toLowerCase() ? '' : v });
    });

    $('format-filter').addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-format]');
      if (chip) actions.setFilter({ format: chip.dataset.format });
    });

    $('rating-filter').addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-rating]');
      if (!chip) return;
      var v = chip.dataset.rating === '' ? null : Number(chip.dataset.rating);
      actions.setFilter({ ratingMin: state.filters.ratingMin === v ? null : v });
    });

    $('sort-select').addEventListener('change', function (ev) { actions.setSort(ev.target.value); });

    /* --- toolbar --- */
    $('btn-view-grid').addEventListener('click', function () { actions.setView('grid'); });
    $('btn-view-list').addEventListener('click', function () { actions.setView('list'); });
    $('btn-clear-filters').addEventListener('click', function () { actions.clearFilters(); });

    $('btn-export-json').addEventListener('click', function () {
      download('shelf-library.json', actions.exportJSON(), 'application/json');
      toast('Exported your library as JSON.', { type: 'ok' });
    });
    $('btn-export-csv').addEventListener('click', function () {
      download('shelf-library.csv', actions.exportCSV(), 'text/csv');
      toast('Exported your library as CSV.', { type: 'ok' });
    });

    /* --- the book list --- */
    $('view').addEventListener('click', function (ev) {
      var actionEl = ev.target.closest('[data-action]');
      if (actionEl) {
        var a = actionEl.dataset.action;
        if (a === 'add') openEditor(null);
        else if (a === 'samples') {
          var n = actions.loadSamples();
          toast('Added ' + plural(n, 'sample book') + '.', { type: 'ok' });
        } else if (a === 'clear-filters') actions.clearFilters();
        return;
      }

      var sortHeader = ev.target.closest('th[data-sortable]');
      if (sortHeader) {
        var key = sortHeader.dataset.sortable;
        actions.setSort(state.sort === key ? key : key);
        return;
      }

      var row = ev.target.closest('[data-id]');
      if (row) openDetail(row.dataset.id);
    });

    $('view').addEventListener('keydown', function (ev) {
      var card = ev.target.closest('[data-id]');
      if (!card) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openDetail(card.dataset.id);
        return;
      }
      if (ev.key.indexOf('Arrow') !== 0) return;
      var cards = Array.prototype.slice.call($('view').querySelectorAll('[data-id]'));
      var at = cards.indexOf(card);
      var next = at;
      if (ev.key === 'ArrowRight') next = Math.min(cards.length - 1, at + 1);
      if (ev.key === 'ArrowLeft') next = Math.max(0, at - 1);
      if (ev.key === 'ArrowDown') next = Math.min(cards.length - 1, at + 4);
      if (ev.key === 'ArrowUp') next = Math.max(0, at - 4);
      if (next !== at && cards[next]) {
        ev.preventDefault();
        cards.forEach(function (c) { c.tabIndex = -1; });
        cards[next].tabIndex = 0;
        cards[next].focus();
      }
    });

    /* --- book form --- */
    $('status-input').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-status]');
      if (btn) setFormStatus(btn.dataset.status);
    });

    $('rating-input').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-star]');
      if (!btn) return;
      var n = Number(btn.dataset.star);
      var rect = btn.getBoundingClientRect();
      var leftHalf = (ev.clientX - rect.left) < rect.width / 2;
      setFormRating(leftHalf ? n - 0.5 : n);
    });
    $('rating-clear').addEventListener('click', function () { setFormRating(0); });

    ['f-title', 'f-author', 'f-isbn'].forEach(function (id) {
      $(id).addEventListener('input', updateDuplicateHint);
    });

    $('f-isbn').addEventListener('blur', function () {
      var v = $('f-isbn').value.trim();
      if (!v) { $('isbn-hint').textContent = 'ISBN-10 or ISBN-13 — checksum verified.'; return; }
      var kind = E.isbnKind(v);
      $('isbn-hint').textContent = kind === 'invalid'
        ? 'That checksum does not look right.'
        : (kind ? 'Valid ' + kind.toUpperCase() + '.' : 'ISBN-10 or ISBN-13 — checksum verified.');
    });

    $('btn-save-book').addEventListener('click', saveForm);
    $('book-form').addEventListener('submit', function (ev) { ev.preventDefault(); saveForm(); });

    $('btn-delete-book').addEventListener('click', function () {
      if (!state.editingId) return;
      var id = state.editingId;
      state.editingId = null;
      closeModal('modal-book');
      actions.deleteBook(id);
    });

    /* --- detail modal --- */
    $('detail-body').addEventListener('click', function (ev) {
      var id = state.detailId;
      if (!id) return;

      var setBtn = ev.target.closest('[data-set-status]');
      if (setBtn) {
        actions.setStatus(id, setBtn.dataset.setStatus);
        openDetail(id);
        toast('Moved to "' + E.STATUS_LABELS[setBtn.dataset.setStatus] + '".', { type: 'ok' });
        return;
      }

      var addBtn = ev.target.closest('[data-progress-add]');
      if (addBtn) {
        actions.addProgress(id, Number(addBtn.dataset.progressAdd));
        openDetail(id);
        return;
      }

      var setProg = ev.target.closest('[data-progress-set]');
      if (setProg) {
        var input = $('detail-page');
        if (input) {
          actions.setProgress(id, input.value);
          openDetail(id);
          toast('Progress updated.', { type: 'ok' });
        }
      }
    });

    $('detail-edit').addEventListener('click', function () {
      var id = state.detailId;
      closeModal('modal-detail');
      if (id) openEditor(id);
    });

    /* --- io modal --- */
    $('io-export-json').addEventListener('click', function () {
      download('shelf-library.json', actions.exportJSON(), 'application/json');
      toast('Downloaded shelf-library.json.', { type: 'ok' });
    });
    $('io-export-csv').addEventListener('click', function () {
      download('shelf-library.csv', actions.exportCSV(), 'text/csv');
      toast('Downloaded shelf-library.csv.', { type: 'ok' });
    });
    $('io-copy-json').addEventListener('click', function () {
      var text = actions.exportJSON();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast('Library JSON copied.', { type: 'ok' }); },
          function () { $('io-text').value = text; toast('Copy blocked — the JSON is in the text box.', { type: 'err' }); }
        );
      } else {
        $('io-text').value = text;
        toast('The JSON is in the text box below.', { type: 'ok' });
      }
    });

    $('io-text').addEventListener('input', function (ev) { previewImport(ev.target.value); });

    $('io-browse').addEventListener('click', function () { $('io-file').click(); });
    $('io-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        $('io-text').value = String(reader.result || '');
        previewImport($('io-text').value);
      };
      reader.readAsText(file);
    });

    var drop = $('io-drop');
    ['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (ev) {
        ev.preventDefault();
        drop.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      drop.addEventListener(type, function (ev) {
        ev.preventDefault();
        drop.classList.remove('drag');
      });
    });
    drop.addEventListener('drop', function (ev) {
      var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        $('io-text').value = String(reader.result || '');
        previewImport($('io-text').value);
      };
      reader.readAsText(file);
    });

    $('io-import').addEventListener('click', function () {
      var text = $('io-text').value;
      if (!text.trim()) { toast('Paste a file or choose one first.', { type: 'err' }); return; }
      var res = actions.importText(text, $('io-mode').value);
      if (!res.ok) {
        toast((res.errors || ['Import failed.'])[0], { type: 'err', duration: 6000 });
        return;
      }
      var bits = [];
      if (res.added) bits.push(plural(res.added, 'book') + ' added');
      if (res.updated) bits.push(plural(res.updated, 'book') + ' updated');
      if (res.skipped) bits.push(plural(res.skipped, 'book') + ' skipped');
      toast(bits.length ? bits.join(', ') + '.' : 'Nothing to import.', { type: 'ok' });
      $('io-text').value = '';
      $('io-preview').innerHTML = '';
      closeModal('modal-io');
    });

    /* --- overlays: click outside, close buttons, escape --- */
    ['modal-book', 'modal-detail', 'modal-stats', 'modal-io', 'modal-help'].forEach(function (id) {
      $(id).addEventListener('mousedown', function (ev) {
        if (ev.target === $(id)) closeModal(id);
      });
      Array.prototype.forEach.call($(id).querySelectorAll('[data-close]'), function (btn) {
        btn.addEventListener('click', function () { closeModal(id); });
      });
    });

    document.addEventListener('keydown', onKeydown);
  }

  function onKeydown(ev) {
    var tag = (ev.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable;

    if (ev.key === 'Escape') {
      if (closeTopModal()) { ev.preventDefault(); return; }
      if (state.query) { actions.setQuery(''); $('search').blur(); ev.preventDefault(); }
      return;
    }

    if (typing) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (openStack.length) return;

    switch (ev.key) {
      case '/':
        ev.preventDefault();
        $('search').focus();
        $('search').select();
        break;
      case 'n':
      case 'N':
        ev.preventDefault();
        openEditor(null);
        break;
      case 's':
      case 'S':
        ev.preventDefault();
        openStats();
        break;
      case 'v':
      case 'V':
        ev.preventDefault();
        actions.setView(state.view === 'grid' ? 'list' : 'grid');
        break;
      case 'f':
      case 'F':
        ev.preventDefault();
        actions.setFilter({ favorite: !state.filters.favorite, status: 'all' });
        break;
      case '?':
        ev.preventDefault();
        openModal('modal-help');
        break;
      case '0':
        ev.preventDefault();
        actions.setFilter({ status: 'all', favorite: false });
        break;
      case '1': case '2': case '3': case '4': case '5':
        ev.preventDefault();
        actions.setFilter({ status: E.STATUSES[Number(ev.key) - 1], favorite: false });
        break;
      default:
        break;
    }
  }

  /* ==========================================================================
   * boot
   * ======================================================================== */

  function boot() {
    // A duplicate hint slot that appears as soon as the title is typed.
    var hint = document.createElement('div');
    hint.id = 'dup-hint';
    hint.className = 'hint';
    var titleField = $('f-title').parentNode;
    titleField.appendChild(hint);

    load();
    bind();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ==========================================================================
   * test / automation surface
   * ======================================================================== */

  window.BookApp = {
    engine: E,
    state: state,
    actions: actions,
    render: render,
    openEditor: openEditor,
    openDetail: openDetail,
    openStats: openStats,
    closeModals: closeAllModals,
    isModalOpen: function (id) { return !!$(id) && !$(id).hidden; },
    openModalIds: function () { return openStack.slice(); },
    visibleBooks: visibleBooks,
    storageKey: STORAGE_KEY,
    toast: toast,
    save: save,
    load: load,
    boot: boot
  };
})();

/**
 * selftest.js — end-to-end test of the real UI in a real browser.
 *
 * Loads index.html in a same-origin iframe and drives it exactly like a user:
 * clicking buttons, typing into inputs, dispatching keyboard events, reloading
 * the page. Every assertion is reported, and the whole payload is written into
 * the DOM between ### markers so run-tests.js can read it from --dump-dom.
 *
 *   node run-tests.js      (or open selftest.html in a browser)
 */
(function () {
  'use strict';

  var results = [];
  var pageErrors = [];
  var currentSuite = '';

  /* ------------------------------------------------------------ reporting */

  function suite(name) { currentSuite = name; }

  function record(name, ok, extra) {
    results.push({ name: currentSuite + ' › ' + name, ok: !!ok, extra: extra === undefined ? null : extra });
  }

  function ok(value, name, extra) {
    if (!value) throw new Error((name || 'expected truthy') + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
    record(name, true);
  }

  function eq(actual, expected, name) {
    var pass = JSON.stringify(actual) === JSON.stringify(expected);
    if (!pass) {
      throw new Error((name || 'value mismatch') + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
    record(name, true);
  }

  function check(name, fn) {
    try {
      var out = fn();
      if (out === false) record(name, false, 'returned false');
      else if (out === undefined) record(name, true);
    } catch (err) {
      record(name, false, String(err && err.message ? err.message : err));
    }
  }

  function suiteDone() { /* placeholder for symmetry */ }

  /* ------------------------------------------------------------- the page */

  var frame = document.createElement('iframe');
  frame.id = 'app';
  frame.setAttribute('title', 'Shelf under test');
  document.body.appendChild(frame);

  function onError(ev) {
    pageErrors.push(String(ev.message || ev.error || 'unknown error') +
      (ev.filename ? ' @ ' + String(ev.filename).split('/').pop() + ':' + ev.lineno : ''));
  }

  // Attach before navigation so boot-time errors are captured too.
  try {
    frame.contentWindow.addEventListener('error', onError);
    frame.contentWindow.addEventListener('unhandledrejection', function (ev) {
      pageErrors.push('unhandled rejection: ' + String(ev.reason));
    });
  } catch (err) { /* ignore */ }

  var loaded = new Promise(function (resolve) {
    frame.addEventListener('load', function () {
      try { frame.contentWindow.addEventListener('error', onError); } catch (err) { /* ignore */ }
      resolve();
    });
  });

  frame.src = 'index.html';

  function win() { return frame.contentWindow; }
  function doc() { return frame.contentDocument; }
  function app() { return win().BookApp; }
  function E() { return win().BookEngine; }
  function q(sel, root) { return (root || doc()).querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(doc().querySelectorAll(sel)); }
  function txt(sel) { var el = q(sel); return el ? el.textContent.trim() : null; }
  function n(sel) { return qa(sel).length; }
  function cards() { return qa('#book-grid .card'); }
  function rows() { return qa('.table tbody tr'); }

  function type(sel, value) {
    var el = q(sel);
    el.value = value;
    el.dispatchEvent(new (win().Event)('input', { bubbles: true }));
    return el;
  }

  function change(sel, value) {
    var el = q(sel);
    el.value = value;
    el.dispatchEvent(new (win().Event)('change', { bubbles: true }));
    return el;
  }

  function click(sel) {
    var el = typeof sel === 'string' ? q(sel) : sel;
    if (!el) throw new Error('nothing to click: ' + sel);
    el.click();
    return el;
  }

  function key(k, target) {
    var el = target || doc().body;
    el.dispatchEvent(new (win().KeyboardEvent)('keydown', { key: k, bubbles: true }));
  }

  function clickStar(index, half) {
    var btn = qa('#rating-input [data-star]')[index - 1];
    var rect = btn.getBoundingClientRect();
    btn.dispatchEvent(new (win().MouseEvent)('click', {
      bubbles: true,
      clientX: rect.left + rect.width * (half ? 0.25 : 0.75),
      clientY: rect.top + rect.height / 2
    }));
  }

  function visible(sel) {
    var el = typeof sel === 'string' ? q(sel) : sel;
    if (!el) return false;
    var cs = win().getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  function waitFor(predicate, label, timeout) {
    var deadline = Date.now() + (timeout || 4000);
    return new Promise(function (resolve, reject) {
      (function poll() {
        var value;
        try { value = predicate(); } catch (err) { value = false; }
        if (value) return resolve(value);
        if (Date.now() > deadline) return reject(new Error('timed out waiting for ' + (label || 'condition')));
        setTimeout(poll, 25);
      })();
    });
  }

  function reload() {
    return new Promise(function (resolve) {
      frame.addEventListener('load', function handler() {
        frame.removeEventListener('load', handler);
        try { frame.contentWindow.addEventListener('error', onError); } catch (err) { /* ignore */ }
        setTimeout(resolve, 60);
      });
      frame.contentWindow.location.reload();
    });
  }

  /* =============================================================== tests === */

  async function run() {
    await loaded;
    await waitFor(function () { return app() && app().state; }, 'the app to boot');

    /* ------------------------------------------------------------- boot */
    suite('boot');
    check('the engine and app globals exist', function () {
      ok(typeof E().validateBook === 'function', 'BookEngine loaded');
      ok(typeof app().actions.addBook === 'function', 'BookApp actions exposed');
      ok(typeof app().storageKey === 'string', 'storage key exposed');
    });
    check('starts empty with a helpful empty state', function () {
      eq(app().state.books.length, 0, 'no books');
      eq(n('#book-grid .card'), 0, 'no cards');
      ok(/Your shelf is empty/.test(txt('#view .empty h2')), 'empty heading');
      eq(n('#view .empty-actions button'), 2, 'two calls to action');
    });
    check('controls that are not applicable stay invisible', function () {
      eq(q('#btn-clear-filters').hidden, true, 'clear-filters marked hidden');
      eq(visible('#btn-clear-filters'), false, 'and actually hidden');
      eq(q('#btn-delete-book').hidden, true, 'delete marked hidden');
      eq(visible('#btn-delete-book'), false, 'and actually hidden');
    });
    check('stat cards render for an empty library', function () {
      eq(n('#stats .stat'), 6, 'six stat cards');
      ok(txt('#stats').indexOf('In your library') >= 0, 'library card present');
    });
    check('sidebar shows every shelf, all zero', function () {
      eq(n('#status-nav .nav-item'), 6, 'all books + five statuses');
      eq(txt('[data-nav="all"] .nav-count'), '0', 'counts reset');
      eq(txt('[data-nav="finished"] .nav-count'), '0', 'finished count is zero');
    });

    /* ---------------------------------------------------------- samples */
    suite('sample library');
    check('the empty-state button loads a sample library', function () {
      click('#view [data-action="samples"]');
      eq(app().state.books.length, 8, 'eight sample books');
      eq(cards().length, 8, 'eight cards in the grid');
      ok(q('#toasts .toast'), 'a confirmation toast appears');
    });
    check('sidebar counts reflect the library', function () {
      eq(txt('[data-nav="all"] .nav-count'), '8', 'all-books count');
      eq(txt('[data-nav="finished"] .nav-count'), '4', 'finished count');
      eq(txt('[data-nav="reading"] .nav-count'), '1', 'reading count');
      eq(txt('[data-nav="want"] .nav-count'), '1', 'want-to-read count');
      eq(txt('[data-nav="paused"] .nav-count'), '1', 'paused count');
      eq(txt('[data-nav="abandoned"] .nav-count'), '1', 'abandoned count');
      eq(txt('[data-nav="favorite"] .nav-count'), '1', 'favourites row appears');
    });
    check('stats update from real data', function () {
      var stats = txt('#stats').replace(/\s+/g, ' ');
      ok(stats.indexOf('Pages read') >= 0, 'pages card');
      var s = E().computeStats(app().state.books, { now: Date.now() });
      ok(stats.indexOf(s.finishedThisYear + ' this year') >= 0, 'finished this year');
      ok(stats.indexOf(s.pagesRead.toLocaleString()) >= 0, 'pages read total');
      ok(s.avgRating > 4, 'average rating computed');
    });
    check('covers are generated and distinct', function () {
      var styles = cards().map(function (c) { return q('.cover', c).getAttribute('style'); });
      eq(new Set(styles).size > 1, true, 'more than one cover gradient');
      styles.forEach(function (s) { ok(/linear-gradient/.test(s), 'cover has a gradient'); });
    });
    check('a reading book shows a progress bar', function () {
      var dune = cards().find(function (c) { return /Dune/.test(c.textContent); });
      ok(dune, 'Dune card found');
      var bar = q('.progress > i', dune);
      ok(bar, 'progress bar present');
      ok(parseFloat(bar.style.width) > 0, 'progress width set');
    });

    /* ------------------------------------------------- search and filter */
    suite('search, filter and sort');
    check('search narrows the grid as you type', function () {
      type('#search', 'dune');
      eq(cards().length, 1, 'one match');
      ok(/Dune/.test(cards()[0].textContent), 'the right book');
      ok(/1 book of 8/.test(txt('#view-count')), 'count explains the filter');
    });
    check('search is case-insensitive and matches tags', function () {
      type('#search', 'SCI-FI');
      ok(cards().length >= 3, 'tag search matches several');
    });
    check('search with no matches shows an empty state', function () {
      type('#search', 'zzzzz');
      eq(cards().length, 0, 'no cards');
      ok(/No books match/.test(txt('#view .empty h2')), 'empty message');
      click('#view [data-action="clear-filters"]');
      eq(cards().length, 8, 'clearing restores the library');
    });
    check('status filter via the sidebar', function () {
      click('[data-nav="finished"]');
      eq(cards().length, 4, 'four finished');
      eq(txt('#view-title'), 'Finished', 'heading follows the filter');
      click('[data-nav="reading"]');
      eq(cards().length, 1, 'one reading');
      click('[data-nav="all"]');
      eq(cards().length, 8, 'back to all');
    });
    check('favourites filter', function () {
      click('[data-nav="favorite"]');
      eq(cards().length, 1, 'one favourite');
      ok(/Earthsea/.test(cards()[0].textContent), 'the favourite');
      click('[data-nav="all"]');
      eq(cards().length, 8, 'back to all');
    });
    check('genre chip toggles', function () {
      function fantasyChip() {
        return qa('#genre-filter .chip').find(function (c) { return c.textContent === 'Fantasy'; });
      }
      ok(fantasyChip(), 'fantasy chip exists');
      fantasyChip().click();
      eq(cards().length, 2, 'two fantasy books');
      eq(fantasyChip().getAttribute('aria-pressed'), 'true', 'chip marked pressed');
      fantasyChip().click();
      eq(cards().length, 8, 'toggling off clears it');
    });
    check('rating filter', function () {
      click('#rating-filter [data-rating="5"]');
      eq(cards().length, 1, 'one five-star book');
      click('#rating-filter [data-rating=""]');
      eq(cards().length, 8, 'any rating restores all');
    });
    check('format filter', function () {
      click('#format-filter [data-format="audiobook"]');
      eq(cards().length, 1, 'one audiobook');
      click('#format-filter [data-format="all"]');
      eq(cards().length, 8, 'any format restores all');
    });
    check('sorting by title, pages and rating', function () {
      change('#sort-select', 'title');
      eq(q('.card-title').textContent, 'A Wizard of Earthsea', 'A first alphabetically');
      change('#sort-select', 'pages');
      ok(/Anathem/.test(cards()[0].textContent), 'longest book first');
      change('#sort-select', 'rating');
      ok(/Project Hail Mary/.test(cards()[0].textContent), 'five stars first');
      change('#sort-select', 'added');
      ok(/Parable of the Sower/.test(cards()[0].textContent), 'newest addition first');
    });
    check('list view renders a table and toggles back', function () {
      click('#btn-view-list');
      eq(app().state.view, 'list', 'state switched to list');
      eq(n('.table tbody tr'), 8, 'eight rows');
      eq(q('#btn-view-list').getAttribute('aria-pressed'), 'true', 'list button pressed');
      eq(n('#book-grid .card'), 0, 'grid is gone');
      click('#btn-view-grid');
      eq(cards().length, 8, 'grid returns');
    });

    /* ------------------------------------------------------------ adding */
    suite('adding a book');
    check('the add dialog opens from the toolbar', function () {
      app().actions.clearFilters();
      click('#btn-add');
      ok(app().isModalOpen('modal-book'), 'dialog open');
      eq(q('#book-form-title').textContent, 'Add a book', 'title says add');
      eq(q('#btn-delete-book').hidden, true, 'no delete button for a new book');
      eq(visible('#btn-delete-book'), false, 'delete button really hidden');
    });
    check('an empty title is rejected with a visible error', function () {
      type('#f-title', '');
      click('#btn-save-book');
      ok(app().isModalOpen('modal-book'), 'dialog stays open');
      ok(/required/i.test(txt('#e-title')), 'error message shown');
      eq(q('#f-title').getAttribute('aria-invalid'), 'true', 'field marked invalid');
      eq(app().state.books.length, 8, 'nothing was added');
    });
    check('an invalid ISBN is rejected', function () {
      type('#f-title', 'Test Book');
      type('#f-isbn', '1234567890');
      click('#btn-save-book');
      ok(/valid ISBN/i.test(txt('#e-isbn')), 'ISBN error shown');
      eq(app().state.books.length, 8, 'still nothing added');
    });
    check('a duplicate title produces a live warning', function () {
      type('#f-isbn', '');
      type('#f-title', 'Dune');
      type('#f-author', 'Frank Herbert');
      ok(/already have/i.test(txt('#dup-hint')), 'duplicate hint visible');
    });
    check('a valid book saves and appears in the library', function () {
      type('#f-title', 'The Left Hand of Darkness');
      type('#f-author', 'Ursula K. Le Guin');
      type('#f-isbn', '978-0-441-47812-5');
      type('#f-genre', 'Science fiction');
      type('#f-tags', 'classics, hainish');
      type('#f-pages', '304');
      type('#f-page', '120');
      click('#status-input [data-status="reading"]');
      clickStar(4, true);
      type('#f-notes', 'Genly Ai and Estraven.');
      click('#btn-save-book');

      eq(app().isModalOpen('modal-book'), false, 'dialog closed');
      eq(app().state.books.length, 9, 'nine books now');
      var book = app().state.books.find(function (b) { return b.title === 'The Left Hand of Darkness'; });
      ok(book, 'book stored');
      eq(book.author, 'Ursula K. Le Guin', 'author stored');
      eq(book.isbn, '9780441478125', 'ISBN normalized');
      eq(book.pageCount, 304, 'page count stored');
      eq(book.currentPage, 120, 'current page stored');
      eq(book.status, 'reading', 'progress auto-started it');
      eq(book.rating, 3.5, 'half star from the left half of the 4th star');
      eq(book.tags, ['classics', 'hainish'], 'tags parsed');
      eq(book.notes, 'Genly Ai and Estraven.', 'notes stored');
      ok(/Left Hand/.test(txt('#view')), 'rendered in the grid');
    });
    check('the new book is persisted to localStorage', function () {
      var raw = win().localStorage.getItem(app().storageKey);
      ok(raw && raw.length > 100, 'storage written');
      var parsed = JSON.parse(raw);
      eq(parsed.app, 'book-tracker', 'app tag');
      eq(parsed.books.length, 9, 'all nine books stored');
      ok(parsed.prefs && parsed.prefs.view, 'preferences stored');
    });

    /* ----------------------------------------------------------- detail */
    suite('book detail');
    check('clicking a card opens the detail dialog', function () {
      var card = cards().find(function (c) { return /Left Hand/.test(c.textContent); });
      card.click();
      ok(app().isModalOpen('modal-detail'), 'detail open');
      eq(txt('#detail-title'), 'The Left Hand of Darkness', 'dialog title');
      ok(/120 of 304 pages/.test(txt('#detail-body')), 'progress shown');
      ok(/Ursula K. Le Guin/.test(txt('#detail-body')), 'author shown');
    });
    check('quick +10 pages updates the book and the view', function () {
      click('#detail-body [data-progress-add="10"]');
      var book = app().state.books.find(function (b) { return b.title === 'The Left Hand of Darkness'; });
      eq(book.currentPage, 130, 'page advanced');
      ok(/130 of 304 pages/.test(txt('#detail-body')), 'dialog refreshed');
    });
    check('setting an exact page works', function () {
      q('#detail-page').value = '200';
      click('#detail-body [data-progress-set="1"]');
      var book = app().state.books.find(function (b) { return b.title === 'The Left Hand of Darkness'; });
      eq(book.currentPage, 200, 'page set');
    });
    check('progress beyond the last page is clamped and finishes the book', function () {
      q('#detail-page').value = '9999';
      click('#detail-body [data-progress-set="1"]');
      var book = app().state.books.find(function (b) { return b.title === 'The Left Hand of Darkness'; });
      eq(book.currentPage, 304, 'clamped to the page count');
      eq(book.status, 'finished', 'auto-finished');
      ok(book.finishedAt, 'finish date recorded');
      ok(/Finished/.test(txt('#detail-body')), 'status pill updated');
    });
    check('status buttons move a book through the shelf', function () {
      click('#detail-body [data-set-status="reading"]');
      var book = app().state.books.find(function (b) { return b.title === 'The Left Hand of Darkness'; });
      eq(book.status, 'reading', 'back to reading');
      eq(book.finishedAt, '', 'finish date cleared');
      click('#detail-body [data-set-status="finished"]');
      eq(app().state.books.find(function (b) { return b.title === 'The Left Hand of Darkness'; }).status, 'finished', 'finished again');
    });
    check('the edit button opens the form pre-filled', function () {
      click('#detail-edit');
      ok(app().isModalOpen('modal-book'), 'form open');
      eq(q('#book-form-title').textContent, 'Edit book', 'title says edit');
      eq(q('#f-title').value, 'The Left Hand of Darkness', 'title prefilled');
      eq(q('#f-pages').value, '304', 'pages prefilled');
      eq(q('#f-isbn').value, '978-0-441-47812-5', 'ISBN formatted for display');
      eq(q('#btn-delete-book').hidden, false, 'delete available when editing');
      eq(visible('#btn-delete-book'), true, 'delete button really visible');
    });
    check('editing saves the change', function () {
      type('#f-title', 'The Left Hand of Darkness (reread)');
      click('#btn-save-book');
      eq(app().isModalOpen('modal-book'), false, 'form closed');
      ok(/reread/.test(txt('#view')), 'new title rendered');
    });
    check('closing dialogs with Escape works', function () {
      var card = cards().find(function (c) { return /reread/.test(c.textContent); });
      card.click();
      ok(app().isModalOpen('modal-detail'), 'open');
      key('Escape');
      eq(app().isModalOpen('modal-detail'), false, 'closed');
      eq(app().openModalIds().length, 0, 'nothing left open');
    });

    /* ----------------------------------------------------------- delete */
    suite('deleting and undoing');
    check('delete removes the book and offers an undo', function () {
      var before = app().state.books.length;
      var card = cards().find(function (c) { return /reread/.test(c.textContent); });
      card.click();
      click('#detail-edit');
      click('#btn-delete-book');
      eq(app().state.books.length, before - 1, 'one fewer book');
      ok(!/reread/.test(txt('#view')), 'gone from the view');
      var undoBtn = qa('#toasts .toast button').find(function (b) { return /Undo/i.test(b.textContent); });
      ok(undoBtn, 'undo offered');
      undoBtn.click();
      eq(app().state.books.length, before, 'restored');
      ok(/reread/.test(txt('#view')), 'visible again');
    });

    /* ------------------------------------------------------- shortcuts */
    suite('keyboard shortcuts');
    check('/ focuses the search box', function () {
      key('/');
      eq(doc().activeElement.id, 'search', 'search focused');
      key('Escape');
    });
    check('n opens the add dialog and Escape closes it', function () {
      key('n');
      ok(app().isModalOpen('modal-book'), 'dialog open');
      key('Escape');
      eq(app().isModalOpen('modal-book'), false, 'dialog closed');
    });
    check('v toggles the view', function () {
      var before = app().state.view;
      key('v');
      eq(app().state.view, before === 'grid' ? 'list' : 'grid', 'view flipped');
      key('v');
      eq(app().state.view, before, 'flipped back');
    });
    check('digit keys filter by status', function () {
      key('4');
      eq(app().state.filters.status, 'finished', 'fourth status is finished');
      eq(cards().length + rows().length, 5, 'five finished books');
      key('0');
      eq(app().state.filters.status, 'all', 'back to all');
    });
    check('s opens statistics and ? opens help', function () {
      key('s');
      ok(app().isModalOpen('modal-stats'), 'stats open');
      key('Escape');
      key('?');
      ok(app().isModalOpen('modal-help'), 'help open');
      key('Escape');
      eq(app().isModalOpen('modal-help'), false, 'help closed');
    });
    check('arrow keys move focus between cards', function () {
      click('#btn-view-grid');
      var first = cards()[0];
      first.focus();
      key('ArrowRight', first);
      var active = doc().activeElement;
      ok(active && active !== first, 'focus moved');
      eq(active.dataset.id, app().visibleBooks()[1].id, 'moved to the second card');
    });

    /* ----------------------------------------------------------- stats */
    suite('statistics dialog');
    check('the statistics dialog renders charts and facts', function () {
      click('#btn-stats');
      ok(app().isModalOpen('modal-stats'), 'open');
      eq(n('#stats-body .month-col'), 12, 'twelve months');
      ok(n('#stats-body .bar-row') >= 10, 'genre, rating and author bars');
      var body = txt('#stats-body');
      ok(/Books finished/.test(body), 'finished card');
      ok(/Completion rate/.test(body), 'completion rate card');
      ok(/Most-read authors/.test(body), 'authors section');
      ok(/Shelf facts/.test(body), 'facts section');
      var bins = qa('#stats-body .bar-row .name').map(function (el) { return parseFloat(el.textContent); })
        .filter(function (v) { return !isNaN(v); });
      var ratingBins = bins.slice(bins.length - 10);
      eq(ratingBins, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], 'rating histogram is in ascending order');
      ok(/Longest book/.test(body), 'longest book fact');
      click('#modal-stats [data-close]');
      eq(app().isModalOpen('modal-stats'), false, 'stats closed');
    });

    /* ---------------------------------------------------------- import */
    suite('import and export');
    check('JSON export round-trips through the importer', function () {
      var json = app().actions.exportJSON();
      var parsed = E().parseLibrary(json, Date.now());
      ok(parsed.ok, 'exported JSON parses');
      eq(parsed.books.length, app().state.books.length, 'every book survives');
    });
    check('CSV export has a header and one row per book', function () {
      var csv = app().actions.exportCSV();
      var lines = csv.trim().split('\r\n');
      eq(lines.length, app().state.books.length + 1, 'header plus rows');
      ok(/^Title,Author,ISBN/.test(lines[0]), 'header row');
    });
    check('pasting JSON into the dialog previews and imports', function () {
      var payload = E().serializeLibrary([
        E().createBook({ title: 'A Pasted Book', author: 'Paste Bot', pageCount: 200, status: 'finished' }, Date.now())
      ], { now: Date.now() });
      var before = app().state.books.length;
      click('#btn-io');
      type('#io-text', payload);
      ok(/Found 1 book/.test(txt('#io-preview')), 'preview shows the count');
      click('#io-import');
      eq(app().state.books.length, before + 1, 'book imported');
      ok(/A Pasted Book/.test(txt('#view')), 'visible in the library');
    });
    check('importing the same JSON again is skipped, not duplicated', function () {
      var payload = E().serializeLibrary([
        E().createBook({ title: 'A Pasted Book', author: 'Paste Bot', pageCount: 200, status: 'finished' }, Date.now())
      ], { now: Date.now() });
      var before = app().state.books.length;
      click('#btn-io');
      type('#io-text', payload);
      change('#io-mode', 'skip');
      click('#io-import');
      eq(app().state.books.length, before, 'nothing added');
    });
    check('a Goodreads-style CSV imports with the right shelves', function () {
      var csv = [
        'Title,Author,ISBN13,My Rating,Number of Pages,Exclusive Shelf,Date Read,Bookshelves',
        'The Dispossessed,Ursula K. Le Guin,9780061054884,5,341,read,2024-03-02,"sci-fi|classics"',
        'Solaris,Stanislaw Lem,9780156027601,0,204,to-read,,"sci-fi"'
      ].join('\n');
      var before = app().state.books.length;
      click('#btn-io');
      type('#io-text', csv);
      ok(/Found 2 books/.test(txt('#io-preview')), 'CSV previewed');
      click('#io-import');
      eq(app().state.books.length, before + 2, 'two books imported');
      var dispossessed = app().state.books.find(function (b) { return b.title === 'The Dispossessed'; });
      eq(dispossessed.status, 'finished', 'read shelf');
      eq(dispossessed.rating, 5, 'rating imported');
      eq(dispossessed.finishedAt, '2024-03-02', 'date read imported');
      eq(dispossessed.tags, ['sci-fi', 'classics'], 'shelves imported as tags');
      var solaris = app().state.books.find(function (b) { return b.title === 'Solaris'; });
      eq(solaris.status, 'want', 'to-read shelf');
    });
    check('a malformed paste is reported, not swallowed', function () {
      var before = app().state.books.length;
      click('#btn-io');
      type('#io-text', '{ this is not json');
      click('#io-import');
      eq(app().state.books.length, before, 'nothing imported');
      ok(q('#toasts .toast'), 'an error toast is shown');
      click('#modal-io [data-close]');
    });

    /* ---------------------------------------------------- persistence */
    suite('persistence');
    var beforeReload = app().state.books.length;
    var beforeSort = app().state.sort;
    var beforeView = app().state.view;
    await reload();
    await waitFor(function () { return app() && app().state && app().state.books.length; }, 'the reloaded app');

    suite('persistence');
    check('the reloaded page restores every book', function () {
      eq(app().state.books.length, beforeReload, 'same number of books');
      ok(/The Left Hand of Darkness/.test(txt('#view')), 'titles restored');
      ok(/Solaris/.test(txt('#view')), 'imported books restored');
    });
    check('the reloaded page restores preferences', function () {
      eq(app().state.view, beforeView, 'view restored');
      eq(app().state.sort, beforeSort, 'sort restored');
    });
    check('progress history survives the round trip', function () {
      var book = app().state.books.find(function (b) { return /Left Hand/.test(b.title); });
      ok(book, 'book found after reload');
      ok(book.progressLog.length > 0, 'progress log restored');
      eq(book.status, 'finished', 'status restored');
    });
    check('corrupt storage does not break the app', function () {
      win().localStorage.setItem(app().storageKey, '{{{not json');
      var recovered = app().load();
      eq(recovered, false, 'load reports failure instead of throwing');
      ok(app().state.books.length > 0, 'existing state left intact');
      win().localStorage.setItem(app().storageKey, '{"app":"book-tracker","version":2,"books":[]}');
      ok(app().load(), 'a valid empty library loads');
      eq(app().state.books.length, 0, 'empty library');
    });
    check('clearing everything returns to the empty state', function () {
      app().actions.clearAll();
      ok(/Your shelf is empty/.test(txt('#view .empty h2')), 'empty state back');
      eq(n('#book-grid .card'), 0, 'no cards');
      eq(txt('[data-nav="all"] .nav-count'), '0', 'sidebar counts reset');
    });

    /* ------------------------------------------------------- integrity */
    suite('integrity');
    check('no console errors or uncaught exceptions occurred', function () {
      eq(pageErrors, [], 'page errors');
    });
    check('every interactive control has an accessible name', function () {
      var unnamed = qa('button').filter(function (b) {
        var label = (b.textContent || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title');
        return !label;
      });
      eq(unnamed.length, 0, 'unnamed buttons');
      var searchLabel = doc().querySelector('label[for="search"]');
      ok(searchLabel, 'search input is labelled');
    });
    suiteDone();
  }

  /* ============================================================== driver === */

  run().then(function () {
    report();
  }).catch(function (err) {
    record('harness', false, String(err && err.stack ? err.stack : err));
    report();
  });

  function report() {
    var failed = results.filter(function (r) { return !r.ok; }).length;
    var payload = { results: results, failed: failed, pageErrors: pageErrors };

    var host = document.getElementById('report');
    host.innerHTML = results.map(function (r) {
      return '<div class="' + (r.ok ? 'pass' : 'fail') + '">' + (r.ok ? 'pass  ' : 'FAIL  ') +
        escapeHTML(r.name) + (r.ok || r.extra === null ? '' : '  → ' + escapeHTML(JSON.stringify(r.extra))) + '</div>';
    }).join('') +
      (pageErrors.length ? '<div class="fail">page errors: ' + escapeHTML(pageErrors.join(' | ')) + '</div>' : '') +
      '<div class="' + (failed ? 'fail' : 'pass') + '">' + (failed ? failed + ' FAILED' : 'ALL ' + results.length + ' browser checks passed') + '</div>';

    var out = document.createElement('pre');
    out.id = 'payload';
    out.textContent = '###' + JSON.stringify(payload) + '###';
    document.body.appendChild(out);
  }

  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();

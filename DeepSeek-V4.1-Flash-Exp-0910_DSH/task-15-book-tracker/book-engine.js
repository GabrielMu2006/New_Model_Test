/**
 * book-engine.js — the pure domain layer of the book tracker.
 *
 * No DOM, no storage, no framework, no dependencies. Every function here is
 * deterministic given its arguments (callers pass `now`/`today` when the answer
 * depends on the clock), which is what makes the whole thing unit-testable in
 * plain Node.
 *
 * Responsibilities:
 *   • the book record and its normalization / validation
 *   • ISBN-10 / ISBN-13 parsing and checksum verification
 *   • the reading-status state machine and progress bookkeeping
 *   • search, filter and sort
 *   • library statistics
 *   • persistence payloads: JSON round-trip with schema migration, CSV export,
 *     and a Goodreads-style CSV importer
 *
 * Works both as a Node module and as a plain browser global (`BookEngine`).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BookEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 2;
  var APP_TAG = 'book-tracker';

  /* ==========================================================================
   * constants
   * ======================================================================== */

  var STATUSES = ['want', 'reading', 'paused', 'finished', 'abandoned'];

  var STATUS_LABELS = {
    want: 'Want to read',
    reading: 'Reading',
    paused: 'Paused',
    finished: 'Finished',
    abandoned: 'Abandoned'
  };

  var STATUS_SHORT = {
    want: 'Want',
    reading: 'Reading',
    paused: 'Paused',
    finished: 'Finished',
    abandoned: 'Dropped'
  };

  var FORMATS = ['print', 'ebook', 'audiobook'];

  /** Rating axis in display order (0 means "not rated" and has no bin). */
  var RATING_BINS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  var FORMAT_LABELS = { print: 'Print', ebook: 'Ebook', audiobook: 'Audiobook' };

  /** Statuses that count as "actually read" for completion-rate purposes. */
  var ENGAGED_STATUSES = ['reading', 'paused', 'finished', 'abandoned'];

  var LIMITS = {
    title: 300,
    author: 200,
    genre: 60,
    notes: 4000,
    tag: 40,
    tags: 24,
    pageCount: 20000,
    progressLog: 400,
    importRows: 20000
  };

  var SORT_KEYS = [
    'added', 'title', 'author', 'rating', 'pages', 'progress',
    'finished', 'started', 'recent', 'status'
  ];

  var SORT_LABELS = {
    added: 'Recently added',
    title: 'Title (A–Z)',
    author: 'Author (A–Z)',
    rating: 'Rating (high → low)',
    pages: 'Page count (long → short)',
    progress: 'Progress (most → least)',
    finished: 'Recently finished',
    started: 'Recently started',
    recent: 'Recently read',
    status: 'Status'
  };

  /* ==========================================================================
   * small helpers
   * ======================================================================== */

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  /** Trim + collapse whitespace, drop control chars, hard-limit length. */
  function cleanText(value, max) {
    if (value === null || value === undefined) return '';
    var s = String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if (max && s.length > max) s = s.slice(0, max).trim();
    return s;
  }

  /** Like cleanText but keeps newlines (notes/reviews). */
  function cleanMultiline(value, max) {
    if (value === null || value === undefined) return '';
    var s = String(value)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (max && s.length > max) s = s.slice(0, max).trim();
    return s;
  }

  /** Parse a positive integer from "312", "312 pages", 312.7 — null if junk. */
  function toPositiveInt(value) {
    if (typeof value === 'number') {
      if (!isFinite(value)) return null;
      var r = Math.round(value);
      return r > 0 ? r : null;
    }
    if (typeof value !== 'string') return null;
    var m = value.replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    var n = Math.round(parseFloat(m[0]));
    return isFinite(n) && n > 0 ? n : null;
  }

  function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    var s = value.trim().replace(',', '.');
    if (!s) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  /** Ratings live on a half-star grid from 0 (unrated) to 5. */
  function normalizeRating(value) {
    var n = toNumber(value);
    if (n === null) return 0;
    if (n <= 0) return 0;
    n = clamp(n, 0.5, 5);
    return Math.round(n * 2) / 2;
  }

  function normalizeTags(list) {
    var out = [];
    var seen = Object.create(null);
    // Goodreads separates shelves with '|'; people also use commas and semicolons.
    var input = Array.isArray(list) ? list : typeof list === 'string' ? list.split(/[,;|]/) : [];
    for (var i = 0; i < input.length; i++) {
      var t = cleanText(input[i], LIMITS.tag).replace(/^#/, '');
      if (!t) continue;
      var key = t.toLowerCase();
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(t);
      if (out.length >= LIMITS.tags) break;
    }
    return out;
  }

  function normalizeFormat(value) {
    var f = cleanText(value).toLowerCase();
    if (f === 'e-book' || f === 'kindle' || f === 'digital' || f === 'epub' || f === 'pdf') f = 'ebook';
    if (f === 'audio' || f === 'audio-book' || f === 'audible') f = 'audiobook';
    if (f === 'paperback' || f === 'hardcover' || f === 'hardback' || f === 'physical') f = 'print';
    return FORMATS.indexOf(f) >= 0 ? f : 'print';
  }

  function normalizeStatus(value) {
    var s = cleanText(value).toLowerCase().replace(/[\s_-]+/g, '');
    var map = {
      want: 'want', wanttoread: 'want', wishlist: 'want', toread: 'want', tbr: 'want', unread: 'want',
      reading: 'reading', currentlyreading: 'reading', current: 'reading', started: 'reading',
      paused: 'paused', onhold: 'paused', hold: 'paused', stalled: 'paused',
      finished: 'finished', read: 'finished', complete: 'finished', completed: 'finished', done: 'finished',
      abandoned: 'abandoned', dropped: 'abandoned', dnf: 'abandoned', gaveup: 'abandoned'
    };
    return map[s] || 'want';
  }

  function isStatus(value) {
    return STATUSES.indexOf(value) >= 0;
  }

  /* ==========================================================================
   * dates — plain local-calendar 'YYYY-MM-DD' strings
   * ======================================================================== */

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** Local calendar date of a Date (or of "now") as 'YYYY-MM-DD'. */
  function dateKey(date) {
    var d = date instanceof Date ? date : new Date();
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayKey(now) {
    if (typeof now === 'string') return isDateKey(now) ? now : dateKey(new Date());
    if (now instanceof Date) return dateKey(now);
    if (typeof now === 'number') return dateKey(new Date(now));
    return dateKey(new Date());
  }

  function isDateKey(value) {
    if (typeof value !== 'string') return false;
    var m = DATE_RE.exec(value);
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    var probe = new Date(y, mo - 1, d);
    return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d;
  }

  /** Accept 'YYYY-MM-DD' or an ISO timestamp or a Date; return 'YYYY-MM-DD' or ''. */
  function normalizeDateKey(value) {
    if (value instanceof Date) return dateKey(value);
    if (typeof value !== 'string') return '';
    var s = value.trim();
    if (!s) return '';
    if (isDateKey(s)) return s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) {
      var key = m[1] + '-' + m[2] + '-' + m[3];
      // Looks like ISO: trust it or reject it — never let Date() roll 02-30 into March.
      return isDateKey(key) ? key : '';
    }
    // "12/31/2020", "31 December 2020", "Dec 31, 2020"
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return dateKey(parsed);
    return '';
  }

  function dateKeyToDate(key) {
    if (!isDateKey(key)) return null;
    var m = DATE_RE.exec(key);
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function addDays(key, n) {
    var d = dateKeyToDate(key);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  /** Whole days from `a` to `b` (positive when b is later). */
  function daysBetween(a, b) {
    var da = dateKeyToDate(a), db = dateKeyToDate(b);
    if (!da || !db) return NaN;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function monthKey(key) {
    return isDateKey(key) ? key.slice(0, 7) : '';
  }

  function compareDateKeys(a, b) {
    // Empty dates sort last in ascending order.
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /* ==========================================================================
   * ISBN
   * ======================================================================== */

  /** Strip separators; keep digits and a trailing X. Returns '' for junk. */
  function normalizeIsbn(value) {
    if (value === null || value === undefined) return '';
    var raw = String(value).trim();
    // Spreadsheets mangle ISBN-13 into scientific notation; expand it back.
    if (/^-?\d(\.\d+)?e\+?1[0-4]$/i.test(raw)) {
      var n = parseFloat(raw);
      if (isFinite(n) && n > 0) {
        var expanded = String(Math.round(n));
        if (expanded.length === 13) return expanded;
      }
    }
    var s = raw.toUpperCase().replace(/[^0-9X]/g, '');
    if (s.length === 10 && s.indexOf('X') === 9) return s;
    if (s.length === 10 && s.indexOf('X') === -1) return s;
    if (s.length === 13) return s;
    if (s.length === 9) return '0' + s; // old SBN
    return s;
  }

  function isValidIsbn10(isbn) {
    if (typeof isbn !== 'string' || isbn.length !== 10) return false;
    if (!/^\d{9}[\dX]$/.test(isbn)) return false;
    var sum = 0;
    for (var i = 0; i < 10; i++) {
      var c = isbn.charAt(i);
      var v = c === 'X' ? 10 : c.charCodeAt(0) - 48;
      sum += v * (10 - i);
    }
    return sum % 11 === 0;
  }

  function isValidIsbn13(isbn) {
    if (typeof isbn !== 'string' || isbn.length !== 13) return false;
    if (!/^\d{13}$/.test(isbn)) return false;
    var sum = 0;
    for (var i = 0; i < 13; i++) {
      sum += (isbn.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  }

  /** 'isbn10' | 'isbn13' | 'invalid' | '' (empty input). */
  function isbnKind(value) {
    var s = normalizeIsbn(value);
    if (!s) return cleanText(value) ? 'invalid' : '';
    if (s.length === 10) return isValidIsbn10(s) ? 'isbn10' : 'invalid';
    if (s.length === 13) return isValidIsbn13(s) ? 'isbn13' : 'invalid';
    return 'invalid';
  }

  function isValidIsbn(value) {
    var k = isbnKind(value);
    return k === 'isbn10' || k === 'isbn13';
  }

  /** Format for display: 978-0-306-40615-7 / 0-306-40615-2. */
  function formatIsbn(value) {
    var s = normalizeIsbn(value);
    if (s.length === 13 && isValidIsbn13(s)) {
      return s.slice(0, 3) + '-' + s.slice(3, 4) + '-' + s.slice(4, 7) + '-' + s.slice(7, 12) + '-' + s.slice(12);
    }
    if (s.length === 10 && isValidIsbn10(s)) {
      return s.slice(0, 1) + '-' + s.slice(1, 4) + '-' + s.slice(4, 9) + '-' + s.slice(9);
    }
    return s;
  }

  /* ==========================================================================
   * ids
   * ======================================================================== */

  var idCounter = 0;

  function makeId(prefix, seed) {
    idCounter = (idCounter + 1) % 100000;
    var rand = Math.floor(Math.random() * 1679616).toString(36);
    var base = (seed === undefined ? Date.now() : Number(seed) || 0).toString(36);
    return (prefix || 'b') + '_' + base + idCounter.toString(36) + rand;
  }

  /* ==========================================================================
   * book records
   * ======================================================================== */

  function emptyBook() {
    return {
      id: '',
      title: '',
      author: '',
      isbn: '',
      genre: '',
      tags: [],
      format: 'print',
      pageCount: 0,
      currentPage: 0,
      status: 'want',
      rating: 0,
      favorite: false,
      notes: '',
      addedAt: '',
      startedAt: '',
      finishedAt: '',
      updatedAt: '',
      progressLog: []
    };
  }

  /**
   * Coerce anything into a well-formed book record. Never throws, never drops
   * fields, and always returns a value the rest of the engine can trust.
   * `now` fixes the clock so callers (and tests) stay deterministic.
   */
  function normalizeBook(raw, now) {
    var src = isPlainObject(raw) ? raw : {};
    var today = todayKey(now);
    var book = emptyBook();

    book.id = cleanText(src.id, 64) || makeId('b');
    book.title = cleanText(src.title !== undefined ? src.title : src.name, LIMITS.title);
    book.author = cleanText(src.author !== undefined ? src.author : src.authors, LIMITS.author);
    book.isbn = normalizeIsbn(src.isbn !== undefined ? src.isbn : src.isbn13);
    book.genre = cleanText(src.genre !== undefined ? src.genre : src.category, LIMITS.genre);
    book.tags = normalizeTags(src.tags !== undefined ? src.tags : src.bookshelves);
    book.format = normalizeFormat(src.format);
    book.notes = cleanMultiline(src.notes !== undefined ? src.notes : src.review, LIMITS.notes);
    book.favorite = src.favorite === true || src.favorite === 'true' || src.favorite === 1;

    var pages = toPositiveInt(src.pageCount !== undefined ? src.pageCount : src.pages);
    book.pageCount = pages === null ? 0 : Math.min(pages, LIMITS.pageCount);

    book.status = normalizeStatus(src.status !== undefined ? src.status : src.shelf);
    book.rating = normalizeRating(src.rating);

    book.addedAt = normalizeDateKey(src.addedAt !== undefined ? src.addedAt : src.dateAdded) || today;
    book.startedAt = normalizeDateKey(src.startedAt !== undefined ? src.startedAt : src.dateStarted);
    book.finishedAt = normalizeDateKey(
      src.finishedAt !== undefined ? src.finishedAt
        : src.dateFinished !== undefined ? src.dateFinished : src.dateRead
    );

    var current = toPositiveInt(src.currentPage);
    if (src.currentPage === 0 || src.currentPage === '0') current = 0;
    book.currentPage = current === null ? 0 : current;
    if (book.pageCount > 0) book.currentPage = Math.min(book.currentPage, book.pageCount);

    book.progressLog = normalizeProgressLog(src.progressLog, now);

    // Status/date/page coherence — the importer and the UI both rely on this.
    if (book.status === 'finished') {
      if (!book.finishedAt) book.finishedAt = book.startedAt || book.addedAt || today;
      if (!book.startedAt) book.startedAt = book.finishedAt;
      if (book.pageCount > 0) book.currentPage = book.pageCount;
    } else if (book.status === 'want') {
      book.startedAt = '';
      book.finishedAt = '';
      book.currentPage = 0;
    } else if (book.status === 'reading' || book.status === 'paused' || book.status === 'abandoned') {
      book.finishedAt = '';
      if (book.status === 'reading' && !book.startedAt) book.startedAt = today;
    }

    book.updatedAt = normalizeDateKey(src.updatedAt) || book.addedAt;
    return book;
  }

  function normalizeProgressLog(list, now) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!isPlainObject(e)) continue;
      var d = normalizeDateKey(e.date);
      var p = toPositiveInt(e.page);
      if (e.page === 0 || e.page === '0') p = 0;
      if (!d || p === null) continue;
      out.push({ date: d, page: p });
    }
    out.sort(function (a, b) { return compareDateKeys(a.date, b.date) || a.page - b.page; });
    if (out.length > LIMITS.progressLog) out = out.slice(out.length - LIMITS.progressLog);
    void now;
    return out;
  }

  /** Build a brand-new book from user input (id and timestamps filled in). */
  function createBook(input, now) {
    var today = todayKey(now);
    var src = isPlainObject(input) ? input : {};
    var book = normalizeBook(src, now);
    if (!src.id) book.id = makeId('b');
    book.addedAt = today;
    book.updatedAt = today;
    if (book.status === 'reading' && !book.startedAt) book.startedAt = today;
    if (book.status === 'finished') {
      if (!book.finishedAt) book.finishedAt = today;
      if (!book.startedAt) book.startedAt = book.finishedAt;
      if (book.pageCount > 0) book.currentPage = book.pageCount;
    }
    return book;
  }

  /** Shallow, structural clone — safe to hand to the UI or to storage. */
  function cloneBook(book) {
    var out = emptyBook();
    for (var k in out) if (hasOwn(out, k)) out[k] = book && hasOwn(book, k) ? book[k] : out[k];
    out.tags = (book && Array.isArray(book.tags) ? book.tags : []).slice();
    out.progressLog = (book && Array.isArray(book.progressLog) ? book.progressLog : [])
      .map(function (e) { return { date: e.date, page: e.page }; });
    return out;
  }

  /**
   * Validate a book record.
   * @returns {{ok: boolean, errors: Object, warnings: Object}}
   */
  function validateBook(book, now) {
    var errors = {};
    var warnings = {};
    var b = isPlainObject(book) ? book : {};

    var title = cleanText(b.title, LIMITS.title);
    if (!title) errors.title = 'A title is required.';
    else if (String(b.title || '').length > LIMITS.title) {
      errors.title = 'Titles are limited to ' + LIMITS.title + ' characters.';
    }

    if (!cleanText(b.author, LIMITS.author)) warnings.author = 'No author recorded.';

    if (b.status !== undefined && !isStatus(b.status)) {
      errors.status = 'Unknown reading status.';
    }

    var isbn = normalizeIsbn(b.isbn);
    if (isbn && isbnKind(isbn) === 'invalid') {
      errors.isbn = 'That is not a valid ISBN-10 or ISBN-13.';
    }

    var pagesRaw = b.pageCount;
    if (pagesRaw !== undefined && pagesRaw !== null && pagesRaw !== '' && pagesRaw !== 0 && pagesRaw !== '0') {
      var pages = toPositiveInt(pagesRaw);
      if (pages === null) errors.pageCount = 'Page count must be a positive whole number.';
      else if (pages > LIMITS.pageCount) errors.pageCount = 'Page count looks implausible (max ' + LIMITS.pageCount + ').';
    }

    var current = toNumber(b.currentPage);
    if (current !== null && current !== 0) {
      if (current < 0) errors.currentPage = 'Page cannot be negative.';
      else if (!toPositiveInt(pagesRaw) && !toPositiveInt(b.pageCount)) {
        errors.currentPage = 'Set the page count before recording progress.';
      } else if (current > toPositiveInt(b.pageCount)) {
        errors.currentPage = 'Page ' + Math.round(current) + ' is past the last page (' + toPositiveInt(b.pageCount) + ').';
      }
    }

    var rating = toNumber(b.rating);
    if (rating !== null && rating !== 0 && (rating < 0.5 || rating > 5)) {
      errors.rating = 'Rating must be between 0.5 and 5 stars.';
    }

    if (b.format !== undefined && FORMATS.indexOf(b.format) < 0) {
      errors.format = 'Unknown format.';
    }

    var started = normalizeDateKey(b.startedAt);
    var finished = normalizeDateKey(b.finishedAt);
    var added = normalizeDateKey(b.addedAt);
    var today = todayKey(now);

    if (b.startedAt && !started) errors.startedAt = 'Start date is not a real date.';
    if (b.finishedAt && !finished) errors.finishedAt = 'Finish date is not a real date.';
    if (started && finished && daysBetween(started, finished) < 0) {
      errors.finishedAt = 'Finish date cannot be before the start date.';
    }
    if (started && daysBetween(started, today) < 0) {
      warnings.startedAt = 'Start date is in the future.';
    }
    if (finished && daysBetween(finished, today) < 0) {
      warnings.finishedAt = 'Finish date is in the future.';
    }
    if (added && started && daysBetween(added, started) > 0 && b.status === 'finished') {
      // not an error, just odd data
      warnings.addedAt = 'This book started before it was added.';
    }

    if (b.status === 'finished' && !finished) {
      warnings.finishedAt = 'Marked finished without a finish date.';
    }
    if (b.status === 'reading' && !started) {
      warnings.startedAt = 'Marked reading without a start date.';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  function isValidBook(book, now) {
    return validateBook(book, now).ok;
  }

  /* ==========================================================================
   * reading state machine
   * ======================================================================== */

  function progressPercent(book) {
    if (!book) return 0;
    if (book.status === 'finished') return 100;
    var total = toPositiveInt(book.pageCount);
    if (!total) return 0;
    var page = clamp(toNumber(book.currentPage) || 0, 0, total);
    return Math.round((page / total) * 100);
  }

  function pagesRemaining(book) {
    var total = toPositiveInt(book && book.pageCount);
    if (!total) return 0;
    return Math.max(0, total - (clamp(toNumber(book && book.currentPage) || 0, 0, total)));
  }

  /** Reading pace in pages/day based on the progress log; 0 when unknown. */
  function readingPace(book, now) {
    if (!book || !Array.isArray(book.progressLog) || book.progressLog.length === 0) return 0;
    var log = book.progressLog.slice().sort(function (a, b) { return compareDateKeys(a.date, b.date); });
    var first = log[0];
    var last = log[log.length - 1];
    var span = daysBetween(first.date, last.date);
    var pages = last.page - first.page;
    if (span <= 0 || pages <= 0) return 0;
    return pages / span;
  }

  /** Projected finish date ('YYYY-MM-DD') or '' when it cannot be estimated. */
  function projectedFinish(book, now) {
    var pace = readingPace(book, now);
    if (pace <= 0) return '';
    var left = pagesRemaining(book);
    if (left <= 0) return '';
    var days = Math.ceil(left / pace);
    var base = todayKey(now);
    var last = book.progressLog.length ? book.progressLog[book.progressLog.length - 1].date : base;
    if (compareDateKeys(last, base) > 0) base = last;
    return addDays(base, days);
  }

  function pushLog(book, date, page) {
    var log = Array.isArray(book.progressLog) ? book.progressLog.slice() : [];
    var d = normalizeDateKey(date);
    if (!d) return log;
    var p = clamp(toNumber(page) || 0, 0, Math.max(0, toPositiveInt(book.pageCount) || 0));
    var last = log[log.length - 1];
    if (last && last.date === d) {
      if (last.page === p) return log;
      log[log.length - 1] = { date: d, page: p };
    } else if (last && compareDateKeys(d, last.date) < 0) {
      log.push({ date: d, page: p });
      log.sort(function (a, b) { return compareDateKeys(a.date, b.date) || a.page - b.page; });
    } else {
      log.push({ date: d, page: p });
    }
    if (log.length > LIMITS.progressLog) log = log.slice(log.length - LIMITS.progressLog);
    return log;
  }

  /**
   * Move a book to a new status, applying the date/page side effects that make
   * the library coherent (e.g. finishing fills in the finish date and sets the
   * page to the last page).
   * @returns {Object} a new book record
   */
  function setStatus(book, status, now) {
    var next = cloneBook(normalizeBook(book, now));
    var today = todayKey(now);
    if (!isStatus(status)) return next;

    switch (status) {
      case 'want':
        next.status = 'want';
        next.startedAt = '';
        next.finishedAt = '';
        next.currentPage = 0;
        break;

      case 'reading':
        next.status = 'reading';
        next.finishedAt = '';
        if (!next.startedAt) next.startedAt = today;
        if (next.pageCount > 0 && next.currentPage >= next.pageCount) next.currentPage = 0;
        break;

      case 'paused':
        next.status = 'paused';
        next.finishedAt = '';
        if (!next.startedAt) next.startedAt = today;
        break;

      case 'abandoned':
        next.status = 'abandoned';
        next.finishedAt = '';
        if (!next.startedAt) next.startedAt = today;
        break;

      case 'finished':
        next.status = 'finished';
        if (!next.startedAt) next.startedAt = next.finishedAt || today;
        if (!next.finishedAt) next.finishedAt = today;
        if (next.pageCount > 0) {
          next.currentPage = next.pageCount;
          next.progressLog = pushLog(next, next.finishedAt, next.pageCount);
        }
        break;
    }

    next.updatedAt = today;
    return next;
  }

  /**
   * Record a new current page. Auto-finishes the book when the last page is
   * reached, and auto-starts it when it was still on the "want" shelf.
   * @returns {Object} new book record
   */
  function setProgress(book, page, now) {
    var next = cloneBook(normalizeBook(book, now));
    var today = todayKey(now);
    var total = toPositiveInt(next.pageCount);
    var target = toNumber(page);
    if (target === null || target < 0) return next;
    target = Math.round(target);
    if (total) target = clamp(target, 0, total);
    else target = Math.max(0, target);

    next.currentPage = target;
    if (next.status === 'want' && target > 0) {
      next.status = 'reading';
      if (!next.startedAt) next.startedAt = today;
    }
    if (next.status === 'paused' && target > 0) next.status = 'reading';
    next.progressLog = pushLog(next, today, target);
    if (total && target >= total) {
      next.status = 'finished';
      if (!next.startedAt) next.startedAt = today;
      if (!next.finishedAt) next.finishedAt = today;
    } else if (next.status === 'finished') {
      next.status = 'reading';
      next.finishedAt = '';
    }
    next.updatedAt = today;
    return next;
  }

  /** Apply a relative page delta (used by the "+10 pages" quick action). */
  function addProgress(book, delta, now) {
    var current = toNumber(book && book.currentPage) || 0;
    return setProgress(book, current + (toNumber(delta) || 0), now);
  }

  /* ==========================================================================
   * search / filter / sort
   * ======================================================================== */

  function foldCase(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase();
  }

  function bookHaystack(book) {
    return foldCase([
      book.title, book.author, book.genre, book.isbn,
      (book.tags || []).join(' '), book.notes
    ].join(' \u0000 '));
  }

  function matchesQuery(book, query) {
    var q = cleanText(query, 200);
    if (!q) return true;
    var hay = bookHaystack(book);
    // Every whitespace-separated term must appear (AND semantics).
    var terms = foldCase(q).split(/\s+/).filter(Boolean);
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /**
   * Filter a list of books.
   * @param {Array} books
   * @param {Object} [opts] {query, status, genre, tag, format, favorite, ratingMin, unrated}
   */
  function filterBooks(books, opts) {
    var o = isPlainObject(opts) ? opts : {};
    var list = Array.isArray(books) ? books : [];
    var status = o.status && o.status !== 'all' ? o.status : '';
    var genre = foldCase(cleanText(o.genre));
    var tag = foldCase(cleanText(o.tag));
    var format = o.format && o.format !== 'all' ? o.format : '';
    var ratingMin = toNumber(o.ratingMin);

    return list.filter(function (book) {
      if (!book) return false;
      if (status && book.status !== status) return false;
      if (format && book.format !== format) return false;
      if (o.favorite === true && !book.favorite) return false;
      if (genre && foldCase(book.genre) !== genre) return false;
      if (tag) {
        var tags = (book.tags || []).map(foldCase);
        if (tags.indexOf(tag) === -1) return false;
      }
      if (ratingMin !== null && ratingMin !== undefined) {
        if (o.unrated === true) { /* keep unrated eligible */ }
        else if (!(book.rating >= ratingMin)) return false;
      }
      if (!matchesQuery(book, o.query)) return false;
      return true;
    });
  }

  function statusRank(status) {
    var i = STATUSES.indexOf(status);
    return i < 0 ? STATUSES.length : i;
  }

  /** Which status wins when merging a duplicate: the one further along the journey. */
  function mergeRank(status) {
    var ranks = { want: 0, reading: 1, paused: 2, abandoned: 3, finished: 4 };
    return hasOwn(ranks, status) ? ranks[status] : 0;
  }

  var SORT_DEFAULT_DIR = {
    added: 'desc', title: 'asc', author: 'asc', rating: 'desc', pages: 'desc',
    progress: 'desc', finished: 'desc', started: 'desc', recent: 'desc', status: 'asc'
  };

  /**
   * Sort a list of books. Never mutates the input.
   * @param {Array} books
   * @param {string} key one of SORT_KEYS
   * @param {'asc'|'desc'} [dir] defaults per key (titles ascending, dates newest first)
   */
  function sortBooks(books, key, dir) {
    var list = (Array.isArray(books) ? books : []).slice();
    var k = SORT_KEYS.indexOf(key) >= 0 ? key : 'added';
    var direction = dir === 'asc' || dir === 'desc' ? dir : SORT_DEFAULT_DIR[k] || 'desc';
    var sign = direction === 'asc' ? 1 : -1;

    function cmpText(a, b) {
      var x = foldCase(a), y = foldCase(b);
      if (!x && !y) return 0;
      if (!x) return 1;   // blanks always last
      if (!y) return -1;
      return x < y ? -1 : x > y ? 1 : 0;
    }

    function cmpNum(a, b) {
      var x = toNumber(a) || 0, y = toNumber(b) || 0;
      return x === y ? 0 : x < y ? -1 : 1;
    }

    list.sort(function (a, b) {
      var r = 0;
      switch (k) {
        case 'title': r = cmpText(a.title, b.title); break;
        case 'author': r = cmpText(a.author, b.author) || cmpText(a.title, b.title); break;
        case 'rating': r = cmpNum(a.rating, b.rating) || cmpText(a.title, b.title); break;
        case 'pages': r = cmpNum(a.pageCount, b.pageCount) || cmpText(a.title, b.title); break;
        case 'progress': r = cmpNum(progressPercent(a), progressPercent(b)) || cmpText(a.title, b.title); break;
        case 'finished': r = compareDateKeys(a.finishedAt, b.finishedAt) || cmpText(a.title, b.title); break;
        case 'started': r = compareDateKeys(a.startedAt, b.startedAt) || cmpText(a.title, b.title); break;
        case 'recent': {
          var la = lastActivity(a), lb = lastActivity(b);
          r = compareDateKeys(la, lb) || cmpText(a.title, b.title);
          break;
        }
        case 'status': r = statusRank(a.status) - statusRank(b.status) || cmpText(a.title, b.title); break;
        case 'added':
        default:
          r = compareDateKeys(a.addedAt, b.addedAt) || cmpText(a.title, b.title);
          break;
      }
      if (r === 0 && k !== 'title') r = cmpText(a.title, b.title);
      return r * sign;
    });
    return list;
  }

  function lastActivity(book) {
    if (!book) return '';
    var best = book.updatedAt || book.addedAt || '';
    if (Array.isArray(book.progressLog) && book.progressLog.length) {
      var last = book.progressLog[book.progressLog.length - 1].date;
      if (compareDateKeys(last, best) > 0) best = last;
    }
    if (compareDateKeys(book.finishedAt, best) > 0) best = book.finishedAt;
    return best;
  }

  /** Distinct values, useful for populating filter dropdowns. */
  function distinctValues(books, field) {
    var seen = Object.create(null);
    var out = [];
    (Array.isArray(books) ? books : []).forEach(function (b) {
      if (!b) return;
      if (field === 'tags') {
        (b.tags || []).forEach(function (t) { add(t); });
      } else {
        add(b[field]);
      }
    });
    function add(v) {
      var s = cleanText(v);
      if (!s) return;
      var key = s.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push(s);
    }
    out.sort(function (a, b) { return foldCase(a) < foldCase(b) ? -1 : foldCase(a) > foldCase(b) ? 1 : 0; });
    return out;
  }

  /* ==========================================================================
   * statistics
   * ======================================================================== */

  function emptyStats() {
    return {
      total: 0,
      byStatus: { want: 0, reading: 0, paused: 0, finished: 0, abandoned: 0 },
      finished: 0,
      reading: 0,
      pagesRead: 0,
      finishedPages: 0,
      totalLibraryPages: 0,
      avgRating: 0,
      ratedCount: 0,
      ratingHistogram: (function () {
        var h = {};
        RATING_BINS.forEach(function (b) { h[b] = 0; });
        return h;
      }()),
      genreCounts: [],
      formatCounts: [],
      topAuthors: [],
      topTags: [],
      monthlyFinishes: [],
      finishedThisYear: 0,
      pagesThisYear: 0,
      finishRate: 0,
      avgPages: 0,
      longest: null,
      shortest: null,
      favoriteCount: 0,
      streak: 0,
      bestStreak: 0,
      pagesToday: 0,
      activeDays: 0,
      abandoned: 0,
      paused: 0,
      want: 0
    };
  }

  /**
   * Library statistics.
   * @param {Array} books
   * @param {Object} [opts] {now, months}
   */
  function computeStats(books, opts) {
    var o = isPlainObject(opts) ? opts : {};
    var list = (Array.isArray(books) ? books : []).filter(Boolean);
    var now = o.now;
    var today = todayKey(now);
    var thisYear = today.slice(0, 4);
    var months = toPositiveInt(o.months) || 12;
    var stats = emptyStats();

    stats.total = list.length;
    var ratingSum = 0;
    var pageSum = 0;
    var pagesWithCount = 0;
    var genreMap = Object.create(null);
    var formatMap = Object.create(null);
    var authorMap = Object.create(null);
    var tagMap = Object.create(null);
    var monthMap = Object.create(null);
    var activeDates = Object.create(null);

    list.forEach(function (b) {
      var st = isStatus(b.status) ? b.status : 'want';
      stats.byStatus[st] = (stats.byStatus[st] || 0) + 1;
      if (b.favorite) stats.favoriteCount++;

      var pct = progressPercent(b);
      var pages = toPositiveInt(b.pageCount) || 0;
      if (pages) {
        pageSum += pages;
        pagesWithCount++;
      }
      if (st === 'finished') {
        stats.finished++;
        stats.finishedPages += pages;
      }
      stats.pagesRead += st === 'finished' ? pages : clamp(toNumber(b.currentPage) || 0, 0, pages || Infinity);

      if (b.rating > 0) {
        ratingSum += b.rating;
        stats.ratedCount++;
        var bin = normalizeRating(b.rating);
        if (hasOwn(stats.ratingHistogram, bin)) stats.ratingHistogram[bin]++;
      }

      if (b.genre) bump(genreMap, b.genre);
      bump(formatMap, b.format || 'print');
      if (b.author) bump(authorMap, b.author);
      (b.tags || []).forEach(function (t) { bump(tagMap, t); });

      if (b.finishedAt && isDateKey(b.finishedAt)) {
        bump(monthMap, monthKey(b.finishedAt));
        if (b.finishedAt.slice(0, 4) === thisYear) {
          stats.finishedThisYear++;
          stats.pagesThisYear += pages;
        }
      }
      if (Array.isArray(b.progressLog)) {
        b.progressLog.forEach(function (e) { if (isDateKey(e.date)) activeDates[e.date] = 1; });
      }
      void pct;
    });

    stats.reading = stats.byStatus.reading;
    stats.paused = stats.byStatus.paused;
    stats.abandoned = stats.byStatus.abandoned;
    stats.want = stats.byStatus.want;
    stats.avgRating = stats.ratedCount ? Math.round((ratingSum / stats.ratedCount) * 100) / 100 : 0;
    stats.avgPages = pagesWithCount ? Math.round(pageSum / pagesWithCount) : 0;
    stats.totalLibraryPages = pageSum;

    var engaged = stats.byStatus.finished + stats.byStatus.reading + stats.byStatus.paused + stats.byStatus.abandoned;
    stats.finishRate = engaged ? Math.round((stats.byStatus.finished / engaged) * 100) : 0;

    stats.genreCounts = toPairs(genreMap);
    stats.formatCounts = FORMATS.map(function (f) {
      return [f, formatMap[f] || 0];
    }).filter(function (p) { return p[1] > 0; });
    stats.topAuthors = toPairs(authorMap).slice(0, 5);
    stats.topTags = toPairs(tagMap).slice(0, 12);
    stats.monthlyFinishes = monthSeries(monthMap, today, months);

    var withPages = list.filter(function (b) { return toPositiveInt(b.pageCount); });
    if (withPages.length) {
      var sorted = withPages.slice().sort(function (a, b) { return b.pageCount - a.pageCount; });
      stats.longest = sorted[0];
      stats.shortest = sorted[sorted.length - 1];
    }

    var dates = Object.keys(activeDates).sort();
    stats.activeDays = dates.length;
    stats.streak = currentStreak(activeDates, today);
    stats.bestStreak = bestStreak(dates);
    stats.pagesToday = pagesOn(activeDates, list, today);

    return stats;

    function bump(map, key) {
      var k = cleanText(key);
      if (!k) return;
      map[k] = (map[k] || 0) + 1;
    }

    function toPairs(map) {
      return Object.keys(map)
        .map(function (k) { return [k, map[k]]; })
        .sort(function (a, b) { return b[1] - a[1] || (foldCase(a[0]) < foldCase(b[0]) ? -1 : 1); });
    }
  }

  function pagesOn(activeDates, books, date) {
    if (!activeDates[date]) return 0;
    // Pages logged for the day = last page that day minus the previous known page, per book.
    var total = 0;
    books.forEach(function (b) {
      var log = (b.progressLog || []).slice().sort(function (a, c) { return compareDateKeys(a.date, c.date); });
      for (var i = 0; i < log.length; i++) {
        if (log[i].date !== date) continue;
        var prev = i > 0 ? log[i - 1].page : 0;
        total += Math.max(0, log[i].page - prev);
      }
    });
    return total;
  }

  function monthSeries(monthMap, today, months) {
    var out = [];
    var base = dateKeyToDate(today);
    if (!base) return out;
    var y = base.getFullYear(), m = base.getMonth();
    for (var i = months - 1; i >= 0; i--) {
      var d = new Date(y, m - i, 1);
      var key = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
      out.push({ month: key, count: monthMap[key] || 0 });
    }
    return out;
  }

  /** Consecutive active days ending today (or yesterday, so a streak survives a slow morning). */
  function currentStreak(activeDates, today) {
    if (!activeDates || !Object.keys(activeDates).length) return 0;
    var cursor = today;
    if (!activeDates[cursor]) {
      cursor = addDays(today, -1);
      if (!activeDates[cursor]) return 0;
    }
    var n = 0;
    while (activeDates[cursor]) {
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  }

  function bestStreak(sortedDates) {
    if (!sortedDates || !sortedDates.length) return 0;
    var best = 1, run = 1;
    for (var i = 1; i < sortedDates.length; i++) {
      if (daysBetween(sortedDates[i - 1], sortedDates[i]) === 1) run++;
      else run = 1;
      if (run > best) best = run;
    }
    return best;
  }

  /* ==========================================================================
   * library collection helpers
   * ======================================================================== */

  function upsertBook(books, book, now) {
    var list = (Array.isArray(books) ? books : []).slice();
    var rec = normalizeBook(book, now);
    rec.updatedAt = todayKey(now);
    var idx = list.findIndex(function (b) { return b && b.id === rec.id; });
    if (idx >= 0) list[idx] = rec;
    else list.unshift(rec);
    return list;
  }

  function removeBook(books, id) {
    return (Array.isArray(books) ? books : []).filter(function (b) { return b && b.id !== id; });
  }

  function findBook(books, id) {
    var list = Array.isArray(books) ? books : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }

  /** Stable identity for duplicate detection: ISBN first, then title+author. */
  function duplicateKey(book) {
    if (!book) return '';
    var isbn = normalizeIsbn(book.isbn);
    if (isbn) return 'isbn:' + isbn;
    var t = titleAuthorKey(book);
    return t;
  }

  /** Normalized "title|author" identity used when no ISBN is available. */
  function titleAuthorKey(book) {
    if (!book) return '';
    var t = foldCase(cleanText(book.title)).replace(/[^a-z0-9]+/g, '');
    var a = foldCase(cleanText(book.author)).replace(/[^a-z0-9]+/g, '');
    if (!t) return '';
    return 'ta:' + t + '|' + a;
  }

  /**
   * Are these two records the same book? ISBN wins when both have one; a record
   * without an ISBN still matches on title+author, which is what makes
   * importing a spreadsheet that omits ISBNs behave sanely.
   */
  function sameBook(a, b) {
    if (!a || !b) return false;
    var ia = normalizeIsbn(a.isbn), ib = normalizeIsbn(b.isbn);
    if (ia && ib) return ia === ib;
    var ka = titleAuthorKey(a), kb = titleAuthorKey(b);
    return !!ka && ka === kb;
  }

  function findDuplicate(books, book) {
    if (!book) return null;
    var list = Array.isArray(books) ? books : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id !== book.id && sameBook(list[i], book)) return list[i];
    }
    return null;
  }

  /**
   * Merge imported books into a library.
   * Matching uses ISBN when both records have one, otherwise title+author, so a
   * spreadsheet without ISBNs still merges into the right rows.
   * @param {Array} existing
   * @param {Array} incoming
   * @param {Object} [opts] {mode:'skip'|'replace'|'merge', now}
   * @returns {{books:Array, added:number, updated:number, skipped:number, duplicates:Array}}
   */
  function mergeLibraries(existing, incoming, opts) {
    var o = isPlainObject(opts) ? opts : {};
    var mode = o.mode === 'replace' || o.mode === 'merge' ? o.mode : 'skip';
    var now = o.now;
    var list = (Array.isArray(existing) ? existing : []).map(function (b) { return normalizeBook(b, now); });

    var byIsbn = Object.create(null);
    var byTitle = Object.create(null);

    function index(book) {
      var i = normalizeIsbn(book.isbn);
      if (i) byIsbn[i] = book;
      var t = titleAuthorKey(book);
      if (t) byTitle[t] = book;
    }

    function unindex(book) {
      var i = normalizeIsbn(book.isbn);
      if (i && byIsbn[i] === book) delete byIsbn[i];
      var t = titleAuthorKey(book);
      if (t && byTitle[t] === book) delete byTitle[t];
    }

    function lookup(book) {
      var i = normalizeIsbn(book.isbn);
      if (i && byIsbn[i]) return byIsbn[i];
      var t = titleAuthorKey(book);
      if (t && byTitle[t]) return byTitle[t];
      return null;
    }

    list.forEach(index);

    var added = 0, updated = 0, skipped = 0;
    var duplicates = [];

    (Array.isArray(incoming) ? incoming : []).forEach(function (raw) {
      var book = normalizeBook(raw, now);
      if (!book.title) { skipped++; return; }
      var hit = lookup(book);

      if (!hit) {
        if (!book.id) book.id = makeId('b');
        list.push(book);
        index(book);
        added++;
        return;
      }

      duplicates.push({ incoming: book, existing: hit });
      if (mode === 'skip') { skipped++; return; }

      var replacement;
      if (mode === 'replace') {
        replacement = cloneBook(book);
        replacement.id = hit.id;
        replacement.addedAt = hit.addedAt || book.addedAt;
        replacement.updatedAt = todayKey(now);
      } else {
        // merge: fill blanks, keep the richer record, never lose progress
        replacement = cloneBook(hit);
        ['title', 'author', 'genre', 'notes'].forEach(function (f) {
          if (!replacement[f] && book[f]) replacement[f] = book[f];
        });
        if (!replacement.isbn && book.isbn) replacement.isbn = book.isbn;
        if (!replacement.pageCount && book.pageCount) replacement.pageCount = book.pageCount;
        if (!replacement.rating && book.rating) replacement.rating = book.rating;
        if (book.favorite) replacement.favorite = true;
        replacement.tags = normalizeTags((replacement.tags || []).concat(book.tags || []));
        if (book.currentPage > replacement.currentPage) replacement.currentPage = book.currentPage;
        if (mergeRank(book.status) > mergeRank(replacement.status)) replacement.status = book.status;
        if (!replacement.startedAt && book.startedAt) replacement.startedAt = book.startedAt;
        if (!replacement.finishedAt && book.finishedAt) replacement.finishedAt = book.finishedAt;
        replacement.updatedAt = todayKey(now);
        replacement = normalizeBook(replacement, now);
      }

      var at = list.indexOf(hit);
      if (at >= 0) list[at] = replacement;
      unindex(hit);
      index(replacement);
      updated++;
    });

    return { books: list, added: added, updated: updated, skipped: skipped, duplicates: duplicates };
  }

  /* ==========================================================================
   * serialization
   * ======================================================================== */

  function toLibrary(books, opts) {
    var o = isPlainObject(opts) ? opts : {};
    return {
      app: APP_TAG,
      version: SCHEMA_VERSION,
      exportedAt: new Date(o.now === undefined ? Date.now() : o.now).toISOString(),
      count: (Array.isArray(books) ? books : []).length,
      books: (Array.isArray(books) ? books : []).map(cloneBook)
    };
  }

  function serializeLibrary(books, opts) {
    return JSON.stringify(toLibrary(books, opts), null, 2);
  }

  /**
   * Parse a stored/exported payload of any known shape.
   * Accepts: {app,version,books:[...]}, a bare array, or a single book object.
   * @returns {{ok:boolean, books:Array, version:number, migrated:boolean, errors:Array, warnings:Array}}
   */
  function parseLibrary(text, now, opts) {
    var allowEmpty = isPlainObject(opts) && opts.allowEmpty === true;
    var errors = [], warnings = [];
    var result = { ok: false, books: [], version: SCHEMA_VERSION, migrated: false, errors: errors, warnings: warnings };

    var data = text;
    if (typeof text === 'string') {
      var trimmed = text.trim();
      if (!trimmed) { errors.push('The file is empty.'); return result; }
      try { data = JSON.parse(trimmed); }
      catch (err) { errors.push('That file is not valid JSON.'); return result; }
    }
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (err2) { errors.push('That file is not valid JSON.'); return result; }
    }

    var rawBooks = null;
    var version = SCHEMA_VERSION;

    if (Array.isArray(data)) {
      rawBooks = data;
      version = 1;
      result.migrated = true;
      warnings.push('Imported a v1 array of books.');
    } else if (isPlainObject(data)) {
      version = toNumber(data.version) || (data.app === APP_TAG ? SCHEMA_VERSION : 1);
      if (data.app && data.app !== APP_TAG) warnings.push('This file came from a different app (' + cleanText(data.app, 40) + ').');
      if (Array.isArray(data.books)) rawBooks = data.books;
      else if (Array.isArray(data.items)) rawBooks = data.items;
      else if (Array.isArray(data.library)) rawBooks = data.library;
      else if (hasOwn(data, 'title')) { rawBooks = [data]; warnings.push('Imported a single book record.'); }
      if (version < SCHEMA_VERSION) result.migrated = true;
    }

    if (!rawBooks) { errors.push('No book list found in that file.'); return result; }
    if (rawBooks.length > LIMITS.importRows) {
      errors.push('That file has more than ' + LIMITS.importRows + ' rows.');
      return result;
    }

    var seenIds = Object.create(null);
    var seenBooks = Object.create(null);
    var books = [];
    for (var i = 0; i < rawBooks.length; i++) {
      var raw = rawBooks[i];
      if (!isPlainObject(raw)) { warnings.push('Skipped row ' + (i + 1) + ': not a record.'); continue; }
      var book = normalizeBook(migrateBook(raw, version), now);
      if (!book.title) { warnings.push('Skipped row ' + (i + 1) + ': no title.'); continue; }
      if (book.id && seenIds[book.id]) book.id = makeId('b');
      if (book.id) seenIds[book.id] = 1;
      var key = duplicateKey(book);
      if (key && seenBooks[key]) { warnings.push('Skipped a duplicate of "' + book.title + '".'); continue; }
      if (key) seenBooks[key] = 1;
      books.push(book);
    }

    result.books = books;
    result.version = version;
    // An explicitly empty library is a legitimate state (all books deleted);
    // for imports it is reported as nothing-to-do unless the caller opts in.
    result.ok = books.length > 0 || (allowEmpty && Array.isArray(rawBooks));
    if (!result.ok && !books.length) errors.push('No usable book records were found.');
    return result;
  }

  /** Bring an older record shape forward. */
  function migrateBook(raw, fromVersion) {
    var out = {};
    for (var k in raw) if (hasOwn(raw, k)) out[k] = raw[k];
    if (!fromVersion || fromVersion < 2) {
      if (out.rating !== undefined && out.rating !== null && out.rating !== '') {
        var r = toNumber(out.rating);
        // v1 / Goodreads use 0–5 integers; anything higher was a different scale.
        if (r !== null && r > 5) r = 5;
        out.rating = r;
      }
      if (out.shelf !== undefined && out.status === undefined) out.status = out.shelf;
      if (out.pages !== undefined && out.pageCount === undefined) out.pageCount = out.pages;
      if (out.review !== undefined && out.notes === undefined) out.notes = out.review;
      if (out.shelves !== undefined && out.tags === undefined) out.tags = out.shelves;
    }
    // Aliases used by older exports and by Goodreads-style spreadsheets.
    if (out.finishedAt === undefined && out.dateRead !== undefined) out.finishedAt = out.dateRead;
    if (out.addedAt === undefined && out.dateAdded !== undefined) out.addedAt = out.dateAdded;
    if (out.startedAt === undefined && out.dateStarted !== undefined) out.startedAt = out.dateStarted;
    return out;
  }

  /* --------------------------------------------------------------- CSV ---- */

  function csvCell(value) {
    var s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  var CSV_COLUMNS = [
    ['title', 'Title'],
    ['author', 'Author'],
    ['isbn', 'ISBN'],
    ['genre', 'Genre'],
    ['tags', 'Tags'],
    ['format', 'Format'],
    ['status', 'Status'],
    ['pageCount', 'Pages'],
    ['currentPage', 'Current page'],
    ['progress', 'Progress %'],
    ['rating', 'Rating'],
    ['favorite', 'Favorite'],
    ['addedAt', 'Added'],
    ['startedAt', 'Started'],
    ['finishedAt', 'Finished'],
    ['notes', 'Notes']
  ];

  function toCSV(books) {
    var list = Array.isArray(books) ? books : [];
    var lines = [CSV_COLUMNS.map(function (c) { return csvCell(c[1]); }).join(',')];
    list.forEach(function (b) {
      var row = CSV_COLUMNS.map(function (c) {
        if (c[0] === 'tags') return csvCell((b.tags || []).join(', '));
        if (c[0] === 'progress') return csvCell(progressPercent(b));
        if (c[0] === 'favorite') return csvCell(b.favorite ? 'yes' : 'no');
        if (c[0] === 'format') return csvCell(FORMAT_LABELS[b.format] || b.format);
        if (c[0] === 'status') return csvCell(STATUS_LABELS[b.status] || b.status);
        return csvCell(b[c[0]]);
      });
      lines.push(row.join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /** RFC4180-ish CSV parser: quotes, escaped quotes, CRLF, embedded newlines. */
  function parseCSV(text) {
    var rows = [];
    if (typeof text !== 'string' || !text) return rows;
    var row = [], field = '', inQuotes = false, i = 0;
    while (i < text.length) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { if (text.charAt(i + 1) === '\n') i++; row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
      if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || cleanText(r[0]) !== ''; });
  }

  var GOODREADS_MAP = {
    title: ['title'],
    author: ['author', 'author l-f', 'authors', 'primary author'],
    isbn: ['isbn13', 'isbn-13', 'isbn'],
    pageCount: ['number of pages', 'pages', 'page count'],
    rating: ['my rating', 'rating'],
    status: ['exclusive shelf', 'shelf', 'status', 'read status'],
    notes: ['my review', 'review', 'notes'],
    finishedAt: ['date read', 'date finished', 'finished'],
    startedAt: ['date started', 'started'],
    addedAt: ['date added', 'added'],
    tags: ['bookshelves', 'tags', 'shelves'],
    genre: ['genre', 'categories'],
    format: ['format', 'binding']
  };

  /**
   * Import a Goodreads-style CSV export (or anything with similar headers).
   * @returns {{ok:boolean, books:Array, skipped:number, warnings:Array, errors:Array, columns:Object}}
   */
  function importCSV(text, now) {
    var warnings = [], errors = [];
    var rows = parseCSV(text);
    var out = { ok: false, books: [], skipped: 0, warnings: warnings, errors: errors, columns: {} };
    if (!rows.length) { errors.push('The CSV is empty.'); return out; }

    var header = rows[0].map(function (h) { return foldCase(cleanText(h)); });
    var colIndex = Object.create(null);
    Object.keys(GOODREADS_MAP).forEach(function (field) {
      var aliases = GOODREADS_MAP[field];
      for (var i = 0; i < aliases.length; i++) {
        var at = header.indexOf(aliases[i]);
        if (at >= 0) { colIndex[field] = at; out.columns[field] = header[at]; break; }
      }
    });

    if (colIndex.title === undefined) {
      errors.push('No "Title" column found — expected a Goodreads-style export.');
      return out;
    }

    var body = rows.slice(1);
    if (body.length > LIMITS.importRows) {
      errors.push('That CSV has more than ' + LIMITS.importRows + ' rows.');
      return out;
    }

    for (var r = 0; r < body.length; r++) {
      var cells = body[r];
      var raw = {};
      Object.keys(colIndex).forEach(function (field) {
        var at = colIndex[field];
        raw[field] = at < cells.length ? cells[at] : '';
      });
      if (!cleanText(raw.title)) { out.skipped++; continue; }

      var shelf = foldCase(cleanText(raw.status));
      var status = 'want';
      if (/^read$|^finished$/.test(shelf)) status = 'finished';
      else if (/currently-?reading|reading/.test(shelf)) status = 'reading';
      else if (/to-?read|want/.test(shelf)) status = 'want';
      else if (/paused|on-?hold/.test(shelf)) status = 'paused';
      else if (/did-?not-?finish|abandon|dropped/.test(shelf)) status = 'abandoned';
      else if (cleanText(raw.finishedAt)) status = 'finished';

      var book = normalizeBook({
        title: raw.title,
        author: raw.author,
        isbn: raw.isbn,
        genre: raw.genre,
        tags: raw.tags,
        format: raw.format,
        pageCount: raw.pageCount,
        rating: raw.rating,
        notes: raw.notes,
        status: status,
        addedAt: raw.addedAt,
        startedAt: raw.startedAt,
        finishedAt: raw.finishedAt
      }, now);

      if (!book.pageCount && status === 'finished') {
        warnings.push('"' + book.title + '" has no page count.');
      }
      out.books.push(book);
    }

    out.ok = out.books.length > 0;
    if (!out.ok) errors.push('No book rows could be read.');
    return out;
  }

  /** Detect the payload kind of a pasted/uploaded file. */
  function detectFormat(text) {
    var s = typeof text === 'string' ? text.trim() : '';
    if (!s) return 'empty';
    if (s.charAt(0) === '{' || s.charAt(0) === '[') return 'json';
    if (/^"?title"?\s*,/i.test(s) || s.indexOf(',') >= 0) return 'csv';
    return 'unknown';
  }

  /* ==========================================================================
   * sample library — used for the first-run demo and the tests
   * ======================================================================== */

  function sampleBooks(now) {
    var today = todayKey(now);
    function back(n) { return addDays(today, -n); }
    return [
      normalizeBook({
        id: 'b_sample_dune', title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593',
        genre: 'Science fiction', tags: ['classics', 'sci-fi'], format: 'print', pageCount: 412,
        currentPage: 186, status: 'reading', rating: 0, addedAt: back(40), startedAt: back(9),
        notes: 'The desert ecology chapters are the best part.',
        progressLog: [
          { date: back(9), page: 40 }, { date: back(6), page: 96 },
          { date: back(3), page: 140 }, { date: back(1), page: 186 }
        ]
      }, now),
      normalizeBook({
        id: 'b_sample_piranesi', title: 'Piranesi', author: 'Susanna Clarke', isbn: '9781635575637',
        genre: 'Fantasy', tags: ['book club'], format: 'ebook', pageCount: 245, currentPage: 245,
        status: 'finished', rating: 4.5, addedAt: back(70), startedAt: back(35), finishedAt: back(28),
        notes: 'Quietly devastating. The tide sequence is perfect.',
        progressLog: [{ date: back(35), page: 20 }, { date: back(28), page: 245 }]
      }, now),
      normalizeBook({
        id: 'b_sample_klara', title: 'Klara and the Sun', author: 'Kazuo Ishiguro',
        isbn: '9780571364879', genre: 'Literary fiction', tags: ['book club'], format: 'print',
        pageCount: 303, currentPage: 303, status: 'finished', rating: 4, addedAt: back(120),
        startedAt: back(80), finishedAt: back(64),
        progressLog: [{ date: back(80), page: 15 }, { date: back(64), page: 303 }]
      }, now),
      normalizeBook({
        id: 'b_sample_project', title: 'Project Hail Mary', author: 'Andy Weir',
        isbn: '9780593135204', genre: 'Science fiction', tags: ['sci-fi'], format: 'audiobook',
        pageCount: 476, currentPage: 476, status: 'finished', rating: 5, addedAt: back(200),
        startedAt: back(180), finishedAt: back(158),
        progressLog: [{ date: back(180), page: 30 }, { date: back(158), page: 476 }]
      }, now),
      normalizeBook({
        id: 'b_sample_parable', title: 'Parable of the Sower', author: 'Octavia E. Butler',
        isbn: '9781538732199', genre: 'Science fiction', tags: ['classics', 'sci-fi'], format: 'print',
        pageCount: 345, currentPage: 0, status: 'want', rating: 0, addedAt: back(15)
      }, now),
      normalizeBook({
        id: 'b_sample_anathem', title: 'Anathem', author: 'Neal Stephenson',
        isbn: '9780061694943', genre: 'Science fiction', tags: ['long'], format: 'print',
        pageCount: 937, currentPage: 120, status: 'paused', rating: 0, addedAt: back(300),
        startedAt: back(150),
        progressLog: [{ date: back(150), page: 60 }, { date: back(120), page: 120 }]
      }, now),
      normalizeBook({
        id: 'b_sample_thinking', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman',
        isbn: '9780374533557', genre: 'Psychology', tags: ['nonfiction'], format: 'ebook',
        pageCount: 499, currentPage: 88, status: 'abandoned', rating: 3, addedAt: back(400),
        startedAt: back(365), progressLog: [{ date: back(365), page: 88 }]
      }, now),
      normalizeBook({
        id: 'b_sample_earthsea', title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin',
        isbn: '9780547773742', genre: 'Fantasy', tags: ['classics'], format: 'print',
        pageCount: 205, currentPage: 205, status: 'finished', rating: 4, favorite: true,
        addedAt: back(500), startedAt: back(450), finishedAt: back(440),
        progressLog: [{ date: back(450), page: 10 }, { date: back(440), page: 205 }]
      }, now)
    ];
  }

  /* ==========================================================================
   * exports
   * ======================================================================== */

  return {
    // constants
    SCHEMA_VERSION: SCHEMA_VERSION,
    APP_TAG: APP_TAG,
    STATUSES: STATUSES,
    STATUS_LABELS: STATUS_LABELS,
    STATUS_SHORT: STATUS_SHORT,
    FORMATS: FORMATS,
    FORMAT_LABELS: FORMAT_LABELS,
    RATING_BINS: RATING_BINS,
    ENGAGED_STATUSES: ENGAGED_STATUSES,
    LIMITS: LIMITS,
    SORT_KEYS: SORT_KEYS,
    SORT_LABELS: SORT_LABELS,
    CSV_COLUMNS: CSV_COLUMNS,

    // helpers
    cleanText: cleanText,
    cleanMultiline: cleanMultiline,
    clamp: clamp,
    toPositiveInt: toPositiveInt,
    toNumber: toNumber,
    normalizeRating: normalizeRating,
    normalizeTags: normalizeTags,
    normalizeFormat: normalizeFormat,
    normalizeStatus: normalizeStatus,
    isStatus: isStatus,
    isPlainObject: isPlainObject,

    // dates
    dateKey: dateKey,
    todayKey: todayKey,
    isDateKey: isDateKey,
    normalizeDateKey: normalizeDateKey,
    dateKeyToDate: dateKeyToDate,
    addDays: addDays,
    daysBetween: daysBetween,
    monthKey: monthKey,
    compareDateKeys: compareDateKeys,

    // isbn
    normalizeIsbn: normalizeIsbn,
    isValidIsbn10: isValidIsbn10,
    isValidIsbn13: isValidIsbn13,
    isbnKind: isbnKind,
    isValidIsbn: isValidIsbn,
    formatIsbn: formatIsbn,

    // records
    makeId: makeId,
    emptyBook: emptyBook,
    normalizeBook: normalizeBook,
    createBook: createBook,
    cloneBook: cloneBook,
    validateBook: validateBook,
    isValidBook: isValidBook,

    // reading state
    progressPercent: progressPercent,
    pagesRemaining: pagesRemaining,
    readingPace: readingPace,
    projectedFinish: projectedFinish,
    setStatus: setStatus,
    setProgress: setProgress,
    addProgress: addProgress,
    lastActivity: lastActivity,

    // collections
    matchesQuery: matchesQuery,
    filterBooks: filterBooks,
    sortBooks: sortBooks,
    distinctValues: distinctValues,
    upsertBook: upsertBook,
    removeBook: removeBook,
    findBook: findBook,
    duplicateKey: duplicateKey,
    titleAuthorKey: titleAuthorKey,
    sameBook: sameBook,
    findDuplicate: findDuplicate,
    mergeLibraries: mergeLibraries,

    // stats
    computeStats: computeStats,
    emptyStats: emptyStats,

    // serialization
    toLibrary: toLibrary,
    serializeLibrary: serializeLibrary,
    parseLibrary: parseLibrary,
    toCSV: toCSV,
    parseCSV: parseCSV,
    importCSV: importCSV,
    detectFormat: detectFormat,

    // demo data
    sampleBooks: sampleBooks
  };
});

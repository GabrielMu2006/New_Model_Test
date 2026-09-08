/**
 * test-engine.js — unit tests for book-engine.js under plain Node.
 *
 *   node test-engine.js
 *
 * Zero dependencies: a tiny assertion harness, then ~230 checks over the pure
 * domain layer. Exits non-zero on the first failing suite.
 */
'use strict';

const E = require('./book-engine.js');

/* ------------------------------------------------------------- harness --- */

let passed = 0;
const failures = [];
let current = '';

function suite(name, fn) {
  current = name;
  try {
    fn();
    process.stdout.write('  ✓ ' + name + '\n');
  } catch (err) {
    process.stdout.write('  ✗ ' + name + '\n      ' + (err && err.message ? err.message : String(err)) + '\n');
    failures.push(name + ': ' + (err && err.message ? err.message : String(err)));
  }
}

function fail(msg) { throw new Error(msg); }

function ok(value, msg) {
  if (!value) fail(msg || 'expected truthy, got ' + JSON.stringify(value));
  passed++;
}

function notOk(value, msg) {
  if (value) fail(msg || 'expected falsy, got ' + JSON.stringify(value));
  passed++;
}

function eq(actual, expected, msg) {
  if (!deepEqual(actual, expected)) {
    fail((msg ? msg + ' — ' : '') + 'expected ' + show(expected) + ', got ' + show(actual));
  }
  passed++;
}

function near(actual, expected, tol, msg) {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > (tol || 1e-9)) {
    fail((msg ? msg + ' — ' : '') + 'expected ~' + expected + ', got ' + show(actual));
  }
  passed++;
}

function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch (err) { threw = true; }
  if (!threw) fail(msg || 'expected a throw');
  passed++;
}

function show(v) {
  try { return JSON.stringify(v); } catch (err) { return String(v); }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/* A fixed clock so every date-dependent assertion is deterministic. */
const NOW = new Date(2025, 5, 15, 12, 0, 0); // 2025-06-15, local
const TODAY = '2025-06-15';

console.log('\n── book-engine unit tests ──\n');

/* =========================================================== constants === */

suite('constants and labels', () => {
  eq(E.STATUSES, ['want', 'reading', 'paused', 'finished', 'abandoned']);
  eq(E.SCHEMA_VERSION, 2);
  eq(E.STATUS_LABELS.reading, 'Reading');
  eq(E.STATUS_SHORT.abandoned, 'Dropped');
  eq(E.FORMATS, ['print', 'ebook', 'audiobook']);
  eq(E.RATING_BINS, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], 'rating axis is ordered');
  eq(Object.keys(E.computeStats([], { now: NOW }).ratingHistogram).map(Number).sort(function (a, b) { return a - b; }),
    E.RATING_BINS, 'histogram covers every bin on the axis');
  eq(E.SORT_KEYS.length, 10);
  ok(Object.keys(E.SORT_LABELS).length === E.SORT_KEYS.length, 'every sort key is labelled');
  E.STATUSES.forEach((s) => ok(E.isStatus(s), s + ' is a status'));
  notOk(E.isStatus('borrowed'));
});

/* ============================================================= helpers === */

suite('text helpers', () => {
  eq(E.cleanText('  Dune  '), 'Dune');
  eq(E.cleanText('Dune\t\n Herbert'), 'Dune Herbert');
  eq(E.cleanText('a\u0000b'), 'a b');
  eq(E.cleanText(null), '');
  eq(E.cleanText(undefined), '');
  eq(E.cleanText(42), '42');
  eq(E.cleanText('abcdef', 3), 'abc');
  eq(E.cleanMultiline('line1\n\n\n\n\nline2'), 'line1\n\nline2');
  eq(E.cleanMultiline('  a\r\nb  '), 'a\nb');
  eq(E.cleanMultiline('trail   \nnext'), 'trail\nnext');
});

suite('number helpers', () => {
  eq(E.toPositiveInt('312'), 312);
  eq(E.toPositiveInt('312 pages'), 312);
  eq(E.toPositiveInt('1,204'), 1204);
  eq(E.toPositiveInt(312.6), 313);
  eq(E.toPositiveInt('0'), null);
  eq(E.toPositiveInt('-5'), null);
  eq(E.toPositiveInt('nope'), null);
  eq(E.toPositiveInt(null), null);
  eq(E.toNumber('4.5'), 4.5);
  eq(E.toNumber('4,5'), 4.5);
  eq(E.toNumber(''), null);
  eq(E.toNumber('abc'), null);
  eq(E.clamp(12, 0, 10), 10);
  eq(E.clamp(-3, 0, 10), 0);
  eq(E.clamp(5, 0, 10), 5);
});

suite('rating normalization (half-star grid, 0 = unrated)', () => {
  eq(E.normalizeRating(4), 4);
  eq(E.normalizeRating(4.4), 4.5);
  eq(E.normalizeRating(4.2), 4);
  eq(E.normalizeRating(9), 5);
  eq(E.normalizeRating(-1), 0);
  eq(E.normalizeRating('3.5'), 3.5);
  eq(E.normalizeRating(''), 0);
  eq(E.normalizeRating(null), 0);
  eq(E.normalizeRating('abc'), 0);
});

suite('tags, format and status normalization', () => {
  eq(E.normalizeTags('a, b;c'), ['a', 'b', 'c']);
  eq(E.normalizeTags('sci-fi|classics'), ['sci-fi', 'classics'], 'Goodreads shelf separator');
  eq(E.normalizeTags(['#sci-fi', 'Sci-Fi', ' space ']), ['sci-fi', 'space']);
  eq(E.normalizeTags('x'.repeat(60))[0].length, E.LIMITS.tag);
  eq(E.normalizeTags(Array.from({ length: 40 }, (_, i) => 't' + i)).length, E.LIMITS.tags);
  eq(E.normalizeTags(null), []);

  eq(E.normalizeFormat('Kindle'), 'ebook');
  eq(E.normalizeFormat('audible'), 'audiobook');
  eq(E.normalizeFormat('Hardcover'), 'print');
  eq(E.normalizeFormat(''), 'print');
  eq(E.normalizeFormat('hologram'), 'print');

  eq(E.normalizeStatus('Currently Reading'), 'reading');
  eq(E.normalizeStatus('to-read'), 'want');
  eq(E.normalizeStatus('read'), 'finished');
  eq(E.normalizeStatus('DNF'), 'abandoned');
  eq(E.normalizeStatus('on hold'), 'paused');
  eq(E.normalizeStatus('nonsense'), 'want');
});

/* =============================================================== dates === */

suite('date keys', () => {
  eq(E.dateKey(NOW), '2025-06-15');
  eq(E.todayKey(NOW), TODAY);
  eq(E.todayKey('2025-01-02'), '2025-01-02');
  eq(E.todayKey(0), E.dateKey(new Date(0)));
  ok(E.isDateKey('2024-02-29'), 'leap day is valid');
  notOk(E.isDateKey('2023-02-29'), 'non-leap Feb 29 is invalid');
  notOk(E.isDateKey('2024-13-01'));
  notOk(E.isDateKey('2024-1-1'));
  notOk(E.isDateKey(''));
  notOk(E.isDateKey(null));
  notOk(E.isDateKey(20240101));

  eq(E.normalizeDateKey('2024-03-04'), '2024-03-04');
  eq(E.normalizeDateKey('2024-03-04T10:00:00Z'), '2024-03-04');
  eq(E.normalizeDateKey('2024-03-04T10:00:00'), '2024-03-04');
  eq(E.normalizeDateKey(new Date(2021, 11, 25)), '2021-12-25');
  eq(E.normalizeDateKey('2024-02-30'), '', 'impossible calendar date rejected');
  eq(E.normalizeDateKey('not a date'), '');
  eq(E.normalizeDateKey(''), '');
  eq(E.normalizeDateKey(null), '');

  eq(E.addDays('2024-02-28', 1), '2024-02-29');
  eq(E.addDays('2023-02-28', 1), '2023-03-01');
  eq(E.addDays('2024-12-31', 1), '2025-01-01');
  eq(E.addDays('2025-01-01', -1), '2024-12-31');
  eq(E.addDays('bad', 1), '');

  eq(E.daysBetween('2025-01-01', '2025-01-31'), 30);
  eq(E.daysBetween('2025-01-31', '2025-01-01'), -30);
  eq(E.daysBetween('2024-02-28', '2024-03-01'), 2, 'leap year');
  ok(Number.isNaN(E.daysBetween('', '2025-01-01')));

  eq(E.monthKey('2025-06-15'), '2025-06');
  eq(E.monthKey('bad'), '');
  ok(E.compareDateKeys('', '2025-01-01') > 0, 'blank sorts last');
  eq(E.compareDateKeys('2025-01-01', '2025-01-02'), -1);
  eq(E.compareDateKeys('2025-01-01', '2025-01-01'), 0);
});

/* ================================================================ isbn === */

suite('ISBN parsing and checksums', () => {
  eq(E.normalizeIsbn('978-0-441-01359-3'), '9780441013593');
  eq(E.normalizeIsbn('0 306 40615 2'), '0306406152');
  eq(E.normalizeIsbn('9780441013593'), '9780441013593');
  eq(E.normalizeIsbn('030640615x'), '030640615X');
  eq(E.normalizeIsbn(''), '');
  eq(E.normalizeIsbn(null), '');
  eq(E.normalizeIsbn('436709'), '436709', 'old SBN-ish junk is passed through, not invented');
  eq(E.normalizeIsbn('030640615'), '0030640615', '9-digit SBN gains a leading zero');
  eq(E.normalizeIsbn('9.78044101359e12'), '9780441013590', 'spreadsheet notation expanded');

  ok(E.isValidIsbn10('0306406152'), 'valid ISBN-10');
  ok(E.isValidIsbn10('097522980X'), 'valid ISBN-10 with X check digit');
  notOk(E.isValidIsbn10('0306406153'), 'bad check digit');
  notOk(E.isValidIsbn10('030640615'), 'too short');
  notOk(E.isValidIsbn10('03064061522'), 'too long');

  ok(E.isValidIsbn13('9780441013593'), 'valid ISBN-13');
  ok(E.isValidIsbn13('9780306406157'), 'valid ISBN-13');
  notOk(E.isValidIsbn13('9780441013594'), 'bad ISBN-13 check digit');
  notOk(E.isValidIsbn13('978044101359'), 'too short');

  eq(E.isbnKind('9780441013593'), 'isbn13');
  eq(E.isbnKind('0306406152'), 'isbn10');
  eq(E.isbnKind('1234567890'), 'invalid');
  eq(E.isbnKind(''), '');
  eq(E.isbnKind('nonsense'), 'invalid');
  ok(E.isValidIsbn('978-0-441-01359-3'));
  notOk(E.isValidIsbn('978-0-441-01359-4'));

  eq(E.formatIsbn('9780441013593'), '978-0-441-01359-3');
  eq(E.formatIsbn('0306406152'), '0-306-40615-2');
  eq(E.formatIsbn('junk'), '', 'unparseable input formats to nothing');
});

/* ============================================================ normalize === */

suite('normalizeBook coerces anything into a trustworthy record', () => {
  const b = E.normalizeBook({
    title: '  The   Hobbit ', authors: 'Tolkien', isbn13: '978-0-547-92822-7',
    category: 'Fantasy', bookshelves: 'classics, adventure', pages: '310 pp',
    shelf: 'read', rating: '5', review: 'Lovely.\n\n\n\nReread.', favorite: 'true',
    dateRead: '2020-01-05'
  }, NOW);

  eq(b.title, 'The Hobbit');
  eq(b.author, 'Tolkien');
  eq(b.isbn, '9780547928227');
  eq(b.genre, 'Fantasy');
  eq(b.tags, ['classics', 'adventure']);
  eq(b.pageCount, 310);
  eq(b.status, 'finished');
  eq(b.rating, 5);
  eq(b.notes, 'Lovely.\n\nReread.');
  eq(b.favorite, true);
  eq(b.finishedAt, '2020-01-05');
  ok(!!b.id, 'got an id');
  eq(b.addedAt, TODAY, 'addedAt defaults to today');

  const empty = E.normalizeBook(null, NOW);
  eq(empty.title, '');
  eq(empty.status, 'want');
  eq(empty.format, 'print');
  eq(empty.tags, []);
  eq(empty.rating, 0);
  eq(empty.progressLog, []);

  // Status/date/page coherence
  const want = E.normalizeBook({ title: 'X', status: 'want', startedAt: '2024-01-01', currentPage: 50, pageCount: 100 }, NOW);
  eq(want.startedAt, '');
  eq(want.currentPage, 0, '"want" clears progress');

  const fin = E.normalizeBook({ title: 'X', status: 'finished', pageCount: 100, currentPage: 20 }, NOW);
  eq(fin.currentPage, 100, 'finished books sit on the last page');
  eq(fin.finishedAt, TODAY, 'finish date filled in');

  const paused = E.normalizeBook({ title: 'X', status: 'paused', startedAt: '2024-01-01', finishedAt: '2024-02-01' }, NOW);
  eq(paused.finishedAt, '', 'paused clears the finish date');

  const read = E.normalizeBook({ title: 'X', status: 'reading' }, NOW);
  eq(read.startedAt, TODAY, 'reading starts today when no date is given');

  const over = E.normalizeBook({ title: 'X', pageCount: 100, currentPage: 500, status: 'reading' }, NOW);
  eq(over.currentPage, 100, 'progress is clamped to the page count');

  const log = E.normalizeBook({
    title: 'X', pageCount: 100,
    progressLog: [
      { date: '2024-01-03', page: 30 }, { date: 'bogus', page: 9 },
      { date: '2024-01-01', page: 10 }, 'nope', { date: '2024-01-02', page: '20' }
    ]
  }, NOW);
  eq(log.progressLog, [
    { date: '2024-01-01', page: 10 },
    { date: '2024-01-02', page: 20 },
    { date: '2024-01-03', page: 30 }
  ], 'progress log sorted, junk dropped');
});

suite('createBook stamps ids and dates', () => {
  const b = E.createBook({ title: 'New', status: 'reading' }, NOW);
  ok(/^b_/.test(b.id), 'id prefix');
  eq(b.addedAt, TODAY);
  eq(b.updatedAt, TODAY);
  eq(b.startedAt, TODAY);

  const fin = E.createBook({ title: 'Done', status: 'finished', pageCount: 200 }, NOW);
  eq(fin.finishedAt, TODAY);
  eq(fin.startedAt, TODAY);
  eq(fin.currentPage, 200);

  const kept = E.createBook({ title: 'Kept', id: 'custom-id' }, NOW);
  eq(kept.id, 'custom-id');

  const a = E.createBook({ title: 'A' }, NOW);
  const c = E.createBook({ title: 'B' }, NOW);
  notOk(a.id === c.id, 'ids are unique');

  const cloned = E.cloneBook(a);
  cloned.tags.push('mutated');
  eq(a.tags, [], 'clone is independent');
  notOk(cloned === a);
});

/* =========================================================== validation === */

suite('validateBook', () => {
  const good = E.createBook({ title: 'Dune', author: 'Frank Herbert', pageCount: 412, rating: 4.5 }, NOW);
  const v = E.validateBook(good, NOW);
  ok(v.ok, 'valid book passes');
  eq(Object.keys(v.errors), []);
  eq(Object.keys(v.warnings), []);

  const noTitle = E.validateBook({ title: '   ' }, NOW);
  notOk(noTitle.ok);
  ok(noTitle.errors.title, 'title required');

  const longTitle = E.validateBook({ title: 'x'.repeat(400) }, NOW);
  ok(longTitle.errors.title, 'title too long');

  const noAuthor = E.validateBook({ title: 'Anon' }, NOW);
  ok(noAuthor.ok, 'author is a warning, not an error');
  ok(noAuthor.warnings.author);

  const badStatus = E.validateBook({ title: 'X', status: 'someday' }, NOW);
  ok(badStatus.errors.status);

  const badIsbn = E.validateBook({ title: 'X', isbn: '1234567890' }, NOW);
  ok(badIsbn.errors.isbn, 'invalid checksum rejected');
  ok(E.validateBook({ title: 'X', isbn: '9780441013593' }, NOW).ok, 'valid isbn accepted');
  ok(E.validateBook({ title: 'X', isbn: '' }, NOW).ok, 'blank isbn accepted');

  ok(E.validateBook({ title: 'X', pageCount: 'abc' }, NOW).errors.pageCount);
  ok(E.validateBook({ title: 'X', pageCount: -5 }, NOW).errors.pageCount);
  ok(E.validateBook({ title: 'X', pageCount: 99999 }, NOW).errors.pageCount);
  ok(E.validateBook({ title: 'X', pageCount: 300, currentPage: 301 }, NOW).errors.currentPage);
  ok(E.validateBook({ title: 'X', currentPage: 10 }, NOW).errors.currentPage, 'progress without a page count');
  ok(E.validateBook({ title: 'X', pageCount: 300, currentPage: -1 }, NOW).errors.currentPage);

  ok(E.validateBook({ title: 'X', rating: 6 }, NOW).errors.rating);
  ok(E.validateBook({ title: 'X', rating: 0.2 }, NOW).errors.rating);
  ok(E.validateBook({ title: 'X', rating: 0 }, NOW).ok, 'unrated is fine');

  const backwards = E.validateBook({ title: 'X', startedAt: '2025-02-01', finishedAt: '2025-01-01' }, NOW);
  ok(backwards.errors.finishedAt, 'finish before start');

  const future = E.validateBook({ title: 'X', startedAt: '2025-07-01' }, NOW);
  ok(future.ok);
  ok(future.warnings.startedAt, 'future date warns');

  const badDate = E.validateBook({ title: 'X', startedAt: '2025-02-30' }, NOW);
  ok(badDate.errors.startedAt);

  const finNoDate = E.validateBook({ title: 'X', status: 'finished' }, NOW);
  ok(finNoDate.warnings.finishedAt);
});

/* ============================================================= progress === */

suite('progress maths', () => {
  const b = E.createBook({ title: 'X', pageCount: 400, currentPage: 100, status: 'reading' }, NOW);
  eq(E.progressPercent(b), 25);
  eq(E.pagesRemaining(b), 300);

  eq(E.progressPercent(E.createBook({ title: 'X', status: 'finished', pageCount: 400 }, NOW)), 100);
  eq(E.progressPercent(E.createBook({ title: 'X' }, NOW)), 0);
  eq(E.progressPercent(null), 0);
  eq(E.pagesRemaining({ pageCount: 0, currentPage: 0 }), 0);
  eq(E.pagesRemaining({ pageCount: 300, currentPage: 300 }), 0);
  eq(E.progressPercent({ pageCount: 300, currentPage: 150, status: 'reading' }), 50);
  eq(E.progressPercent({ pageCount: 300, currentPage: 999, status: 'reading' }), 100, 'over-read clamps');
});

suite('reading pace and projection', () => {
  const b = E.normalizeBook({
    title: 'X', pageCount: 300, currentPage: 120, status: 'reading', startedAt: '2025-06-01',
    progressLog: [
      { date: '2025-06-01', page: 20 }, { date: '2025-06-06', page: 70 },
      { date: '2025-06-11', page: 120 }
    ]
  }, NOW);
  eq(E.readingPace(b, NOW), 10, '100 pages over 10 days');
  eq(E.projectedFinish(b, NOW), '2025-07-03', '180 pages left at 10/day, projected from today');
  eq(E.readingPace(E.createBook({ title: 'Y' }, NOW), NOW), 0);
  eq(E.projectedFinish(E.createBook({ title: 'Y' }, NOW), NOW), '');
  eq(E.projectedFinish(E.createBook({ title: 'Z', status: 'finished', pageCount: 10 }, NOW), NOW), '');
});

suite('setStatus applies the right side effects', () => {
  const base = E.createBook({ title: 'X', pageCount: 300, currentPage: 90, status: 'reading', startedAt: '2025-06-01' }, NOW);

  const fin = E.setStatus(base, 'finished', NOW);
  eq(fin.status, 'finished');
  eq(fin.currentPage, 300);
  eq(fin.finishedAt, TODAY);
  eq(fin.startedAt, '2025-06-01');
  eq(fin.progressLog[fin.progressLog.length - 1], { date: TODAY, page: 300 });
  eq(base.status, 'reading', 'original untouched');

  const back = E.setStatus(fin, 'reading', NOW);
  eq(back.status, 'reading');
  eq(back.finishedAt, '');
  eq(back.currentPage, 0, 're-opening a finished book resets to the start');

  const paused = E.setStatus(base, 'paused', NOW);
  eq(paused.status, 'paused');
  eq(paused.currentPage, 90, 'pausing keeps your place');
  eq(paused.startedAt, '2025-06-01');

  const dropped = E.setStatus(base, 'abandoned', NOW);
  eq(dropped.status, 'abandoned');
  eq(dropped.currentPage, 90);
  eq(dropped.finishedAt, '');

  const want = E.setStatus(base, 'want', NOW);
  eq(want.currentPage, 0);
  eq(want.startedAt, '');
  eq(want.finishedAt, '');

  const read = E.setStatus(E.createBook({ title: 'Y' }, NOW), 'reading', NOW);
  eq(read.startedAt, TODAY, 'started date filled in');

  const invalid = E.setStatus(base, 'teleported', NOW);
  eq(invalid.status, 'reading', 'unknown status ignored');
});

suite('setProgress / addProgress', () => {
  const b = E.createBook({ title: 'X', pageCount: 100, status: 'want' }, NOW);

  const started = E.setProgress(b, 10, NOW);
  eq(started.status, 'reading', 'recording progress auto-starts the book');
  eq(started.currentPage, 10);
  eq(started.startedAt, TODAY);
  eq(started.progressLog, [{ date: TODAY, page: 10 }]);

  const sameDay = E.setProgress(started, 25, NOW);
  eq(sameDay.progressLog, [{ date: TODAY, page: 25 }], 'same-day entries collapse');

  const done = E.setProgress(started, 100, NOW);
  eq(done.status, 'finished');
  eq(done.finishedAt, TODAY);
  eq(done.currentPage, 100);

  const reopened = E.setProgress(done, 60, NOW);
  eq(reopened.status, 'reading', 'dropping below the last page re-opens the book');
  eq(reopened.finishedAt, '');

  const clamped = E.setProgress(started, 999, NOW);
  eq(clamped.currentPage, 100);
  eq(clamped.status, 'finished');

  const paused = E.setStatus(E.setProgress(b, 40, NOW), 'paused', NOW);
  const resumed = E.setProgress(paused, 50, NOW);
  eq(resumed.status, 'reading', 'progress on a paused book resumes it');

  eq(E.addProgress(started, 10, NOW).currentPage, 20);
  eq(E.addProgress(started, -5, NOW).currentPage, 5);
  eq(E.addProgress(started, 'nonsense', NOW).currentPage, 10);
  eq(E.setProgress(started, -3, NOW).currentPage, 10, 'negative page ignored');
  eq(E.setProgress(started, 'abc', NOW).currentPage, 10);
});

/* ====================================================== filter and sort === */

const LIB = E.sampleBooks(NOW);

suite('search', () => {
  const dune = LIB.find((b) => b.id === 'b_sample_dune');
  ok(E.matchesQuery(dune, ''), 'empty query matches');
  ok(E.matchesQuery(dune, 'dune'));
  ok(E.matchesQuery(dune, 'HERBERT'), 'case-insensitive');
  ok(E.matchesQuery(dune, 'dune herbert'), 'multiple terms AND');
  ok(E.matchesQuery(dune, '9780441013593'), 'isbn search');
  ok(E.matchesQuery(dune, 'sci-fi'), 'tag search');
  ok(E.matchesQuery(dune, 'desert'), 'notes search');
  notOk(E.matchesQuery(dune, 'dune tolkien'), 'all terms must match');
  notOk(E.matchesQuery(dune, 'zzz'));
});

suite('filters', () => {
  eq(E.filterBooks(LIB, {}).length, LIB.length);
  eq(E.filterBooks(LIB, { status: 'all' }).length, LIB.length);
  eq(E.filterBooks(LIB, { status: 'finished' }).length, 4);
  eq(E.filterBooks(LIB, { status: 'reading' }).length, 1);
  eq(E.filterBooks(LIB, { status: 'want' }).length, 1);
  eq(E.filterBooks(LIB, { status: 'paused' }).length, 1);
  eq(E.filterBooks(LIB, { status: 'abandoned' }).length, 1);
  eq(E.filterBooks(LIB, { genre: 'fantasy' }).length, 2, 'genre is case-insensitive');
  eq(E.filterBooks(LIB, { tag: 'book club' }).length, 2);
  eq(E.filterBooks(LIB, { format: 'audiobook' }).length, 1);
  eq(E.filterBooks(LIB, { favorite: true }).length, 1);
  eq(E.filterBooks(LIB, { ratingMin: 4 }).length, 4);
  eq(E.filterBooks(LIB, { ratingMin: 5 }).length, 1);
  eq(E.filterBooks(LIB, { status: 'finished', ratingMin: 5 }).length, 1);
  eq(E.filterBooks(LIB, { query: 'octavia' }).length, 1);
  eq(E.filterBooks(null, {}).length, 0);
  eq(E.filterBooks(LIB, { genre: 'nonexistent' }).length, 0);
});

suite('sorting', () => {
  const byTitle = E.sortBooks(LIB, 'title', 'asc');
  eq(byTitle[0].title, 'A Wizard of Earthsea');
  eq(byTitle[byTitle.length - 1].title, 'Thinking, Fast and Slow');

  const byRating = E.sortBooks(LIB, 'rating');
  eq(byRating[0].rating, 5);
  ok(byRating[0].rating >= byRating[byRating.length - 1].rating, 'ratings descend');

  const byPages = E.sortBooks(LIB, 'pages');
  ok(byPages[0].pageCount >= byPages[byPages.length - 1].pageCount);

  const byProgress = E.sortBooks(LIB, 'progress');
  ok(E.progressPercent(byProgress[0]) >= E.progressPercent(byProgress[byProgress.length - 1]));

  const byAdded = E.sortBooks(LIB, 'added');
  ok(E.compareDateKeys(byAdded[0].addedAt, byAdded[byAdded.length - 1].addedAt) >= 0, 'newest first by default');

  const byAuthor = E.sortBooks(LIB, 'author', 'asc');
  ok(byAuthor[0].author.toLowerCase() <= byAuthor[byAuthor.length - 1].author.toLowerCase());

  eq(E.sortBooks(LIB, 'nonsense')[0].id, E.sortBooks(LIB, 'added')[0].id, 'unknown key falls back to added');
  eq(LIB[0].id, 'b_sample_dune', 'input array is not mutated');
  eq(E.sortBooks([], 'title'), []);
  eq(E.sortBooks(null, 'title'), []);

  // Blanks sort last regardless of direction
  const blanks = E.sortBooks([
    { title: 'b', author: '', addedAt: '2025-01-01' },
    { title: 'a', author: 'Zed', addedAt: '2025-01-02' },
    { title: 'c', author: 'Ann', addedAt: '2025-01-03' }
  ], 'author', 'asc');
  eq(blanks.map((b) => b.title), ['c', 'a', 'b']);
});

suite('distinctValues', () => {
  eq(E.distinctValues(LIB, 'genre'), ['Fantasy', 'Literary fiction', 'Psychology', 'Science fiction']);
  eq(E.distinctValues(LIB, 'author').length, 8);
  eq(E.distinctValues(LIB, 'tags'), ['book club', 'classics', 'long', 'nonfiction', 'sci-fi']);
  eq(E.distinctValues([], 'genre'), []);
});

/* ================================================================ stats === */

suite('computeStats', () => {
  const s = E.computeStats(LIB, { now: NOW });
  eq(s.total, 8);
  eq(s.byStatus.finished, 4);
  eq(s.byStatus.reading, 1);
  eq(s.byStatus.want, 1);
  eq(s.byStatus.paused, 1);
  eq(s.byStatus.abandoned, 1);
  eq(s.ratedCount, 5);
  eq(s.avgRating, 4.1, 'mean of 4.5, 4, 5, 3, 4');
  eq(s.favoriteCount, 1);
  eq(s.ratingHistogram[4], 2);
  eq(s.ratingHistogram[4.5], 1);
  eq(s.ratingHistogram[5], 1);
  eq(s.ratingHistogram[3], 1);
  eq(s.ratingHistogram[1], 0);
  eq(s.finishedPages, 245 + 303 + 476 + 205);
  eq(s.pagesRead, 245 + 303 + 476 + 205 + 186 + 120 + 88);
  eq(s.avgPages, Math.round((412 + 245 + 303 + 476 + 345 + 937 + 499 + 205) / 8));
  eq(s.longest.title, 'Anathem');
  eq(s.shortest.title, 'A Wizard of Earthsea');
  eq(s.finishRate, Math.round((4 / 7) * 100));
  eq(s.genreCounts[0], ['Science fiction', 4]);
  eq(s.topAuthors.length, 5, 'top authors capped at five');
  eq(s.topAuthors[0], ['Andy Weir', 1], 'ties break alphabetically');
  ok(s.topAuthors.some((p) => p[0] === 'Frank Herbert' && p[1] === 1), 'Frank Herbert counted');
  eq(s.formatCounts.find((p) => p[0] === 'print')[1], 5);
  eq(s.monthlyFinishes.length, 12);
  eq(s.monthlyFinishes[s.monthlyFinishes.length - 1].month, '2025-06');
  ok(s.monthlyFinishes.reduce((n, m) => n + m.count, 0) >= 1, 'recent finishes appear in the series');
  eq(s.activeDays, 15);
  eq(s.streak, 1, 'only 2025-06-14 is contiguous with today');
  ok(s.bestStreak >= 1);
  ok(s.pagesToday >= 0);

  const empty = E.computeStats([], { now: NOW });
  eq(empty.total, 0);
  eq(empty.avgRating, 0);
  eq(empty.finishRate, 0);
  eq(empty.longest, null);
  eq(empty.monthlyFinishes.length, 12);

  eq(E.computeStats(LIB, { now: NOW, months: 3 }).monthlyFinishes.length, 3);
});

suite('streaks', () => {
  function libWithLogs(dates) {
    return [E.normalizeBook({
      title: 'S', pageCount: 500, status: 'reading',
      progressLog: dates.map((d, i) => ({ date: d, page: (i + 1) * 10 }))
    }, NOW)];
  }
  eq(E.computeStats(libWithLogs(['2025-06-15', '2025-06-14', '2025-06-13']), { now: NOW }).streak, 3);
  eq(E.computeStats(libWithLogs(['2025-06-14', '2025-06-13']), { now: NOW }).streak, 2, 'a streak survives an empty today');
  eq(E.computeStats(libWithLogs(['2025-06-12', '2025-06-13']), { now: NOW }).streak, 0, 'stale streak is over');
  eq(E.computeStats(libWithLogs(['2025-06-01', '2025-06-02', '2025-06-03', '2025-06-14', '2025-06-15']), { now: NOW }).bestStreak, 3);
  eq(E.computeStats([], { now: NOW }).streak, 0);
});

/* ============================================================ collection === */

suite('upsert / remove / find', () => {
  let lib = [];
  const a = E.createBook({ title: 'A' }, NOW);
  const b = E.createBook({ title: 'B' }, NOW);
  lib = E.upsertBook(lib, a, NOW);
  lib = E.upsertBook(lib, b, NOW);
  eq(lib.length, 2);
  eq(lib[0].title, 'B', 'newest first');

  const renamed = E.cloneBook(a);
  renamed.title = 'A2';
  lib = E.upsertBook(lib, renamed, NOW);
  eq(lib.length, 2, 'upsert replaces rather than appends');
  eq(E.findBook(lib, a.id).title, 'A2');
  eq(E.findBook(lib, 'nope'), null);

  lib = E.removeBook(lib, a.id);
  eq(lib.length, 1);
  eq(lib[0].title, 'B');
  eq(E.removeBook(lib, 'nope').length, 1);
});

suite('duplicate detection', () => {
  const a = E.createBook({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' }, NOW);
  eq(E.duplicateKey(a), 'isbn:9780441013593');
  const b = E.createBook({ title: 'Dune', author: 'Frank Herbert' }, NOW);
  const c = E.createBook({ title: 'dune!!', author: 'frank  herbert' }, NOW);
  eq(E.duplicateKey(b), E.duplicateKey(c), 'title+author normalizes punctuation and case');
  eq(E.duplicateKey(E.createBook({ title: 'X' }, NOW)), 'ta:x|');
  eq(E.duplicateKey(null), '');

  const lib = [a];
  eq(E.findDuplicate(lib, b).id, a.id, 'ISBN-less record still matches on title/author');
  eq(E.findDuplicate(lib, a), null, 'a book is not its own duplicate');
  ok(E.sameBook(a, b), 'same book across ISBN and title/author');
  notOk(E.sameBook(a, E.createBook({ title: 'Dune', author: 'Someone Else' }, NOW)));
  notOk(E.sameBook(null, a));
  const twoIsbns = [E.createBook({ title: 'T', isbn: '9780441013593' }, NOW)];
  notOk(E.sameBook(twoIsbns[0], E.createBook({ title: 'T', isbn: '9780547928227' }, NOW)),
    'conflicting ISBNs are different books');
});

suite('mergeLibraries', () => {
  const existing = [
    E.createBook({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', pageCount: 412, status: 'reading', currentPage: 100 }, NOW),
    E.createBook({ title: 'Piranesi', author: 'Susanna Clarke' }, NOW)
  ];
  const incoming = [
    E.createBook({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', pageCount: 412, status: 'finished', tags: ['sci-fi'], rating: 5 }, NOW),
    E.createBook({ title: 'New Book', author: 'Someone' }, NOW)
  ];

  const skip = E.mergeLibraries(existing, incoming, { mode: 'skip', now: NOW });
  eq(skip.books.length, 3);
  eq(skip.added, 1);
  eq(skip.skipped, 1);
  eq(skip.updated, 0);
  eq(skip.duplicates.length, 1);
  eq(E.findBook(skip.books, existing[0].id).status, 'reading', 'skipped duplicate left alone');

  const replace = E.mergeLibraries(existing, incoming, { mode: 'replace', now: NOW });
  eq(replace.books.length, 3);
  eq(replace.updated, 1);
  const replaced = E.findBook(replace.books, existing[0].id);
  eq(replaced.status, 'finished', 'replaced record wins');
  eq(replaced.id, existing[0].id, 'id preserved so the UI keeps its identity');
  eq(replaced.tags, ['sci-fi']);

  const merge = E.mergeLibraries(existing, incoming, { mode: 'merge', now: NOW });
  eq(merge.books.length, 3);
  const merged = E.findBook(merge.books, existing[0].id);
  eq(merged.status, 'finished', 'furthest-along status wins');
  eq(merged.rating, 5, 'rating filled in from the incoming record');
  eq(merged.tags, ['sci-fi']);
  eq(merged.pageCount, 412);
  eq(merged.author, 'Frank Herbert');

  const noTitle = E.mergeLibraries([], [{ author: 'ghost' }], { now: NOW });
  eq(noTitle.books.length, 0);
  eq(noTitle.skipped, 1);
});

/* ========================================================= serialization === */

suite('JSON round trip', () => {
  const json = E.serializeLibrary(LIB, { now: NOW.getTime() });
  const parsed = E.parseLibrary(json, NOW);
  ok(parsed.ok, 'parses');
  eq(parsed.errors, []);
  eq(parsed.books.length, LIB.length);
  eq(parsed.books[0].title, LIB[0].title);
  eq(parsed.books[0].tags, LIB[0].tags);
  eq(parsed.books[0].progressLog, LIB[0].progressLog);
  eq(parsed.books[0].status, LIB[0].status);
  eq(parsed.migrated, false, 'current schema needs no migration');

  const payload = E.toLibrary(LIB, { now: NOW.getTime() });
  eq(payload.app, 'book-tracker');
  eq(payload.version, 2);
  eq(payload.count, LIB.length);
  ok(/^\d{4}-\d{2}-\d{2}T/.test(payload.exportedAt));
});

suite('JSON import accepts legacy shapes', () => {
  const v1 = E.parseLibrary(JSON.stringify([
    { title: 'Old Book', shelf: 'read', pages: '250', rating: 9, review: 'fine', shelves: 'a,b', dateRead: '2020-05-05' }
  ]), NOW);
  ok(v1.ok);
  eq(v1.migrated, true);
  eq(v1.books.length, 1);
  eq(v1.books[0].title, 'Old Book');
  eq(v1.books[0].status, 'finished');
  eq(v1.books[0].pageCount, 250);
  eq(v1.books[0].rating, 5, 'out-of-range v1 rating clamps');
  eq(v1.books[0].tags, ['a', 'b']);
  eq(v1.books[0].finishedAt, '2020-05-05');

  const single = E.parseLibrary(JSON.stringify({ title: 'Solo' }), NOW);
  ok(single.ok);
  eq(single.books.length, 1);
  ok(single.warnings.length > 0, 'warned about the shape');

  const wrapped = E.parseLibrary(JSON.stringify({ books: [{ title: 'W' }] }), NOW);
  ok(wrapped.ok);
  eq(wrapped.books.length, 1);

  const items = E.parseLibrary(JSON.stringify({ items: [{ title: 'I' }] }), NOW);
  ok(items.ok);

  const otherApp = E.parseLibrary(JSON.stringify({ app: 'other-app', books: [{ title: 'O' }] }), NOW);
  ok(otherApp.ok, 'still imports, with a warning');
  ok(otherApp.warnings.some((w) => /different app/.test(w)));

  const bad = E.parseLibrary('{not json', NOW);
  notOk(bad.ok);
  ok(bad.errors.length);
  eq(E.parseLibrary('', NOW).ok, false);
  eq(E.parseLibrary('[]', NOW).ok, false);
  eq(E.parseLibrary('{}', NOW).ok, false);
  eq(E.parseLibrary(JSON.stringify([{ author: 'no title' }]), NOW).ok, false);

  const dupes = E.parseLibrary(JSON.stringify([
    { title: 'Same', author: 'A', isbn: '9780441013593' },
    { title: 'Same', author: 'A', isbn: '9780441013593' }
  ]), NOW);
  eq(dupes.books.length, 1, 'duplicates collapsed on import');
  ok(dupes.warnings.some((w) => /duplicate/.test(w)));
});

suite('CSV export', () => {
  const csv = E.toCSV([E.createBook({
    title: 'Quote, "Comma"', author: 'Ann', tags: ['a', 'b'], status: 'finished',
    pageCount: 100, rating: 4.5, notes: 'line1\nline2', favorite: true
  }, NOW)]);
  const rows = E.parseCSV(csv);
  eq(rows[0][0], 'Title');
  eq(rows[1][0], 'Quote, "Comma"', 'quotes survive');
  eq(rows[1][1], 'Ann');
  eq(rows[1][4], 'a, b');
  eq(rows[1][6], 'Finished');
  eq(rows[1][10], '4.5');
  eq(rows[1][11], 'yes');
  eq(rows[1][15], 'line1\nline2', 'embedded newline survives');
  eq(E.parseCSV('')[0], undefined);
  eq(E.parseCSV('a,b\r\nc,d'), [['a', 'b'], ['c', 'd']], 'CRLF handled');
  eq(E.parseCSV('"a""b",c'), [['a"b', 'c']], 'escaped quotes handled');
  eq(E.toCSV([]).split('\r\n').length, 2);
});

suite('Goodreads-style CSV import', () => {
  const csv = [
    'Book Id,Title,Author,Author l-f,ISBN,ISBN13,My Rating,Number of Pages,Exclusive Shelf,Date Read,Date Added,Bookshelves,My Review',
    '1,Dune,Frank Herbert,"Herbert, Frank","0441013597","9780441013593",5,412,read,2024-01-20,2023-12-01,sci-fi|classics,"Loved it, truly."',
    '2,Parable of the Sower,Octavia E. Butler,"Butler, Octavia E.","","9781538732199",0,345,to-read,,2024-02-02,afrofuturism,',
    '3,Anathem,Neal Stephenson,"Stephenson, Neal","","9780061694943",4,937,currently-reading,,2024-02-03,sci-fi,',
    '4,,,,,,,,read,,,,""'
  ].join('\r\n');

  const res = E.importCSV(csv, NOW);
  ok(res.ok, 'import succeeds');
  eq(res.errors, []);
  eq(res.books.length, 3, 'the title-less row is dropped');
  eq(res.skipped, 1);

  const dune = res.books[0];
  eq(dune.title, 'Dune');
  eq(dune.author, 'Frank Herbert');
  eq(dune.isbn, '9780441013593', 'ISBN13 preferred');
  eq(dune.status, 'finished');
  eq(dune.rating, 5);
  eq(dune.pageCount, 412);
  eq(dune.finishedAt, '2024-01-20');
  eq(dune.addedAt, '2023-12-01');
  eq(dune.tags, ['sci-fi', 'classics']);
  eq(dune.notes, 'Loved it, truly.');
  eq(dune.currentPage, 412);

  eq(res.books[1].status, 'want');
  eq(res.books[1].isbn, '9781538732199');
  eq(res.books[2].status, 'reading');

  const noTitle = E.importCSV('Author,Pages\nAnn,200', NOW);
  notOk(noTitle.ok);
  ok(noTitle.errors.some((e) => /Title/.test(e)));

  notOk(E.importCSV('', NOW).ok);

  eq(E.detectFormat('{"books":[]}'), 'json');
  eq(E.detectFormat('[{"title":"x"}]'), 'json');
  eq(E.detectFormat('Title,Author\nA,B'), 'csv');
  eq(E.detectFormat('   '), 'empty');
  eq(E.detectFormat('plain text'), 'unknown');
});

/* ============================================================== samples === */

suite('sample library is coherent', () => {
  const books = E.sampleBooks(NOW);
  eq(books.length, 8);
  books.forEach((b) => {
    ok(E.validateBook(b, NOW).ok, 'sample valid: ' + b.title);
    ok(!!b.id && !!b.title, 'id and title present');
  });
  eq(new Set(books.map((b) => b.id)).size, 8, 'unique ids');
  const dune = books.find((b) => b.title === 'Dune');
  eq(E.progressPercent(dune), Math.round((186 / 412) * 100));
  eq(E.computeStats(books, { now: NOW }).total, 8);
});

/* ================================================================= fuzz === */

suite('fuzz: normalizeBook is total and idempotent', () => {
  const statuses = E.STATUSES.concat(['', null, 'garbage', 42]);
  const junk = [null, undefined, '', 'text', 0, -1, 3.7, [], {}, NaN, Infinity, true];
  let seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  for (let i = 0; i < 400; i++) {
    const raw = {
      id: pick(junk), title: pick(junk), author: pick(junk), isbn: pick(junk),
      genre: pick(junk), tags: pick(junk), format: pick(junk), pageCount: pick(junk),
      currentPage: pick(junk), status: pick(statuses), rating: pick(junk),
      favorite: pick(junk), notes: pick(junk), addedAt: pick(junk), startedAt: pick(junk),
      finishedAt: pick(junk), progressLog: pick(junk)
    };
    const once = E.normalizeBook(raw, NOW);
    const twice = E.normalizeBook(once, NOW);
    eq(twice, once, 'normalization is idempotent (case ' + i + ')');
    ok(typeof once.title === 'string' && typeof once.notes === 'string', 'strings are strings');
    ok(once.pageCount >= 0 && once.currentPage >= 0, 'non-negative numbers');
    ok(E.isStatus(once.status), 'status is always valid');
    ok(Array.isArray(once.tags) && Array.isArray(once.progressLog), 'arrays are arrays');
    ok(once.rating === 0 || (once.rating >= 0.5 && once.rating <= 5), 'rating in range');
    ok(E.progressPercent(once) >= 0 && E.progressPercent(once) <= 100, 'progress in range');
    E.validateBook(once, NOW); // must not throw
  }
});

suite('fuzz: sort is a total order and never mutates', () => {
  let seed = 999;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (let round = 0; round < 20; round++) {
    const books = Array.from({ length: 25 }, (_, i) => E.normalizeBook({
      title: rnd() < 0.2 ? '' : 'Book ' + Math.floor(rnd() * 10),
      author: rnd() < 0.3 ? '' : 'Author ' + Math.floor(rnd() * 5),
      pageCount: Math.floor(rnd() * 900),
      rating: Math.floor(rnd() * 11) / 2,
      addedAt: '2025-0' + (1 + Math.floor(rnd() * 9)) + '-0' + (1 + Math.floor(rnd() * 9)),
      status: E.STATUSES[Math.floor(rnd() * 5)]
    }, NOW));
    const before = JSON.stringify(books);
    E.SORT_KEYS.forEach((key) => {
      const sorted = E.sortBooks(books, key);
      eq(sorted.length, books.length);
      eq(JSON.stringify(books), before, 'sort does not mutate for ' + key);
      const again = E.sortBooks(sorted, key);
      eq(again.map((b) => b.title + b.author), sorted.map((b) => b.title + b.author),
        'sort is stable-ish and idempotent for ' + key);
    });
  }
});

/* ================================================================ report === */

if (failures.length) {
  console.log('\n' + failures.length + ' suite(s) FAILED:\n');
  failures.forEach((f) => console.log('  ! ' + f));
  console.log('');
  process.exit(1);
}
console.log('\nALL ' + passed + ' engine assertions passed\n');

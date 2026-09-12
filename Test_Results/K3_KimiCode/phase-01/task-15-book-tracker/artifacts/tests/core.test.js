'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../core.js');

const NOW = '2026-09-12T10:00:00.000Z';

function makeBook(overrides) {
  const o = Object.assign({}, overrides);
  const id = o.id || 'book-fixed-id';
  delete o.id;
  return Core.createBook(
    Object.assign(
      { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', genre: 'Sci-Fi' },
      o
    ),
    { now: NOW, id }
  );
}

test('createBook builds a normalized book with defaults', () => {
  const b = makeBook();
  assert.equal(b.id, 'book-fixed-id');
  assert.equal(b.title, 'The Left Hand of Darkness');
  assert.equal(b.status, 'want-to-read');
  assert.equal(b.rating, null);
  assert.equal(b.addedAt, NOW);
  assert.equal(b.finishedAt, null);
});

test('createBook trims whitespace and requires a title', () => {
  const b = makeBook({ title: '  Dune  ', author: '  Herbert ' });
  assert.equal(b.title, 'Dune');
  assert.equal(b.author, 'Herbert');
  assert.throws(() => makeBook({ title: '   ' }), /Invalid book input/);
  assert.throws(() => makeBook({ title: '' }), /Invalid book input/);
});

test('validation rejects bad status and bad rating', () => {
  for (const bad of [
    { status: 'lost' },
    { rating: 0 },
    { rating: 6 },
    { rating: 2.5 },
    { rating: 'five' },
    { finishedAt: 'not-a-date', status: 'finished' },
  ]) {
    assert.throws(() => makeBook(bad), /Invalid book input/, JSON.stringify(bad));
  }
  const { valid, errors } = Core.validateBookInput({ title: '', rating: 9 });
  assert.equal(valid, false);
  assert.ok(errors.title);
  assert.ok(errors.rating);
});

test('want-to-read books never keep a rating', () => {
  const b = makeBook({ status: 'want-to-read', rating: 5 });
  assert.equal(b.rating, null);
});

test('finished books get a finish date (explicit or today)', () => {
  const explicit = makeBook({ status: 'finished', finishedAt: '2026-01-02', rating: 4 });
  assert.equal(explicit.finishedAt, '2026-01-02');
  const implied = makeBook({ status: 'finished' });
  assert.equal(implied.finishedAt, NOW.slice(0, 10));
});

test('updateBook merges patch and keeps id and addedAt', () => {
  const original = makeBook();
  const updated = Core.updateBook(original, { status: 'reading', rating: 3 });
  assert.equal(updated.id, original.id);
  assert.equal(updated.addedAt, original.addedAt);
  assert.equal(updated.status, 'reading');
  assert.equal(updated.rating, 3);
  assert.equal(updated.title, original.title);
});

test('updateBook clears finish date when leaving finished status', () => {
  const finished = makeBook({ status: 'finished', finishedAt: '2026-01-02' });
  const backToReading = Core.updateBook(finished, { status: 'reading' });
  assert.equal(backToReading.finishedAt, null);
});

test('updateBook rejects invalid patches', () => {
  const original = makeBook();
  assert.throws(() => Core.updateBook(original, { rating: 42 }), /Invalid book input/);
});

const LIBRARY = [
  makeBook({ title: 'Dune', author: 'Frank Herbert', status: 'finished', rating: 5, id: 'a' }),
  makeBook({ title: 'dune Messiah', author: 'Frank Herbert', status: 'reading', rating: 3, id: 'b' }),
  makeBook({ title: 'The Hobbit', author: 'J.R.R. Tolkien', status: 'want-to-read', id: 'c' }),
];

test('searchBooks matches title/author/genre case-insensitively', () => {
  assert.equal(Core.searchBooks(LIBRARY, 'dune').length, 2);
  assert.equal(Core.searchBooks(LIBRARY, 'TOLKIEN').length, 1);
  assert.equal(Core.searchBooks(LIBRARY, 'sci-fi').length, 3);
  assert.equal(Core.searchBooks(LIBRARY, '').length, 3);
  assert.equal(Core.searchBooks(LIBRARY, 'zzz').length, 0);
});

test('filterByStatus filters or returns all', () => {
  assert.equal(Core.filterByStatus(LIBRARY, 'all').length, 3);
  assert.equal(Core.filterByStatus(LIBRARY, 'reading').length, 1);
  assert.equal(Core.filterByStatus(LIBRARY, 'finished')[0].title, 'Dune');
});

test('sortBooks sorts by title, rating and addedAt without mutating input', () => {
  const before = LIBRARY.map((b) => b.id);
  const byTitle = Core.sortBooks(LIBRARY, 'title', 'asc');
  assert.deepEqual(byTitle.map((b) => b.id), ['a', 'b', 'c']);
  const byRatingDesc = Core.sortBooks(LIBRARY, 'rating', 'desc');
  assert.deepEqual(byRatingDesc.map((b) => b.id), ['a', 'b', 'c']); // unrated last
  const byRatingAsc = Core.sortBooks(LIBRARY, 'rating', 'asc');
  assert.equal(byRatingAsc[0].id, 'c'); // unrated first in ascending
  assert.deepEqual(LIBRARY.map((b) => b.id), before);
});

test('computeStats counts statuses and averages ratings', () => {
  const stats = Core.computeStats(LIBRARY);
  assert.equal(stats.total, 3);
  assert.deepEqual(stats.byStatus, { 'want-to-read': 1, reading: 1, finished: 1 });
  assert.equal(stats.ratedCount, 2);
  assert.equal(stats.averageRating, 4);
  assert.equal(Core.computeStats([]).averageRating, null);
});

test('serialize/parse round-trips a library', () => {
  const json = Core.serializeLibrary(LIBRARY);
  const back = Core.parseLibrary(json);
  assert.deepEqual(back, LIBRARY);
});

test('parseLibrary accepts a bare array and rejects garbage', () => {
  assert.equal(Core.parseLibrary(JSON.stringify(LIBRARY)).length, 3);
  assert.throws(() => Core.parseLibrary('not json'), /not valid JSON/);
  assert.throws(() => Core.parseLibrary('{"nope": 1}'), /no book list/);
  assert.throws(
    () => Core.parseLibrary(JSON.stringify([{ id: 'x', title: '', status: 'reading', rating: null, addedAt: NOW }])),
    /malformed/
  );
  assert.throws(
    () => Core.parseLibrary(JSON.stringify([{ id: 'x', title: 'T', status: 'weird', rating: null, addedAt: NOW }])),
    /malformed/
  );
});

test('generateId returns unique ids', () => {
  const ids = new Set(Array.from({ length: 200 }, () => Core.generateId()));
  assert.equal(ids.size, 200);
});

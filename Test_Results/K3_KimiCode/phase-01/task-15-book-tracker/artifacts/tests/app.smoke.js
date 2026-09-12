'use strict';
/*
 * Smoke test for app.js using a minimal fake DOM. Runs the real UI event
 * handlers (form submit, toolbar changes, list clicks, import/export) and
 * asserts on localStorage contents and rendered card counts.
 * Not a substitute for a real browser run; covers wiring and regressions.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function makeEl(tag) {
  const listeners = {};
  const el = {
    tag,
    children: [],
    listeners,
    dataset: {},
    style: {},
    textContent: '',
    value: '',
    hidden: false,
    disabled: false,
    files: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event || {});
    },
    setAttribute() {},
    removeAttribute() {},
    focus() {},
    reset() {},
    remove() {},
    click() {},
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    replaceChildren() {
      el.children = [];
    },
    querySelector() {
      return makeEl('span');
    },
    closest() {
      return null;
    },
    cloneNode() {
      return makeEl('li');
    },
    content: null,
  };
  // Only the real <template> needs content; build it lazily to avoid recursion.
  Object.defineProperty(el, 'content', {
    get() {
      if (!el._content) el._content = { firstElementChild: makeEl('li') };
      return el._content;
    },
  });
  return el;
}

const byId = new Map();
function el(id) {
  if (!byId.has(id)) byId.set(id, makeEl(`#${id}`));
  return byId.get(id);
}

const storage = new Map();
const alerts = [];
const downloads = [];

const sandbox = {
  console,
  crypto,
  Date,
  JSON,
  Number,
  String,
  Math,
  Set,
  Array,
  Object,
  RegExp,
  Error,
  Promise,
  Number,
  Intl,
  window: null,
  document: {
    getElementById: el,
    createElement: (tag) => makeEl(tag),
    body: makeEl('body'),
  },
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  confirm: () => true,
  alert: (msg) => alerts.push(String(msg)),
  Blob: class Blob {
    constructor(parts) {
      this.parts = parts;
    }
  },
  URL: {
    createObjectURL: (blob) => {
      downloads.push(blob.parts.join(''));
      return 'blob:fake';
    },
    revokeObjectURL() {},
  },
  FileReader: class FileReader {
    readAsText(file) {
      this.result = file.content;
      setTimeout(() => this.onload(), 0);
    }
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const STORAGE_KEY = 'book-tracker.library.v1';
const list = el('book-list');

async function main() {
  vm.runInContext(fs.readFileSync('core.js', 'utf8'), sandbox, { filename: 'core.js' });
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), sandbox, { filename: 'app.js' });

  // --- init on empty storage renders empty state, no cards
  assert.equal(list.children.length, 0, 'no cards on empty init');
  assert.equal(el('empty-state').hidden, false, 'empty state visible');

  // --- add a book through the real form submit handler
  el('f-title').value = '  The Dispossessed ';
  el('f-author').value = 'Ursula K. Le Guin';
  el('f-status').value = 'reading';
  el('f-rating').value = '4';
  el('f-notes').value = 'Ambiguous utopia.';
  el('book-form').dispatch('submit', { preventDefault() {} });

  let saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.length, 1, 'one book saved');
  assert.equal(saved[0].title, 'The Dispossessed', 'title trimmed on save');
  assert.equal(saved[0].status, 'reading');
  assert.equal(saved[0].rating, 4);
  assert.equal(list.children.length, 1, 'one card rendered');
  assert.equal(el('empty-state').hidden, true, 'empty state hidden after add');
  assert.equal(el('form-panel').hidden, true, 'form closed after save');

  // --- validation failure keeps the form open and saves nothing
  el('add-book').dispatch('click');
  assert.equal(el('form-panel').hidden, false, 'add-book opens the form');
  el('f-title').value = '   ';
  el('book-form').dispatch('submit', { preventDefault() {} });
  saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.length, 1, 'invalid submit rejected');
  assert.equal(el('form-panel').hidden, false, 'form stays open on error');
  assert.ok(el('e-title').textContent.length > 0, 'title error shown');

  // --- edit the existing book: prefill via the list edit handler, then submit
  const card = { dataset: { id: saved[0].id } };
  const editTarget = {
    closest: (sel) => (sel === '.book-card' ? card : sel === '.action-edit' ? {} : null),
  };
  list.dispatch('click', { target: editTarget });
  assert.equal(el('form-panel').hidden, false, 'edit opens form');
  assert.equal(el('f-title').value, 'The Dispossessed', 'edit prefills title');
  el('f-status').value = 'finished';
  el('f-rating').value = '5';
  el('f-finished-at').value = '2026-09-01';
  el('book-form').dispatch('submit', { preventDefault() {} });
  saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.length, 1, 'edit keeps one book');
  assert.equal(saved[0].status, 'finished');
  assert.equal(saved[0].rating, 5);
  assert.equal(saved[0].finishedAt, '2026-09-01');

  // --- search and filter affect rendered cards
  el('search').value = 'nonexistent';
  el('search').dispatch('input');
  assert.equal(list.children.length, 0, 'search hides non-matching');
  assert.equal(el('no-results').hidden, false, 'no-results hint shown');
  el('search').value = 'dispossessed';
  el('search').dispatch('input');
  assert.equal(list.children.length, 1, 'search finds by title');
  el('filter-status').value = 'want-to-read';
  el('filter-status').dispatch('change');
  assert.equal(list.children.length, 0, 'status filter excludes finished book');
  el('filter-status').value = 'all';
  el('filter-status').dispatch('change');
  assert.equal(list.children.length, 1);

  // --- delete via the list handler (confirm stubbed to true)
  const delTarget = {
    closest: (sel) => (sel === '.book-card' ? card : sel === '.action-delete' ? {} : null),
  };
  list.dispatch('click', { target: delTarget });
  saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.length, 0, 'delete removes the book');
  assert.equal(list.children.length, 0, 'list re-renders empty');

  // --- import merges books and de-duplicates ids
  const payload = JSON.stringify([
    { id: 'x1', title: 'A', author: '', genre: '', status: 'reading', rating: 2, notes: '', addedAt: '2026-01-01T00:00:00.000Z', finishedAt: null },
    { id: 'x1', title: 'B', author: '', genre: '', status: 'finished', rating: 5, notes: '', addedAt: '2026-01-02T00:00:00.000Z', finishedAt: '2026-02-01' },
  ]);
  const importInput = el('import-file');
  importInput.files = [{ content: payload }];
  importInput.dispatch('change');
  await new Promise((r) => setTimeout(r, 10));
  saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.length, 2, 'import adds both books');
  assert.notEqual(saved[0].id, saved[1].id, 'duplicate import id regenerated');
  assert.ok(alerts.some((a) => a.includes('Imported 2 books')), 'import alert shown');

  // --- malformed import is rejected with an alert, state untouched
  importInput.files = [{ content: '{"nope": true}' }];
  importInput.dispatch('change');
  await new Promise((r) => setTimeout(r, 10));
  saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.length, 2, 'bad import rejected');
  assert.ok(alerts.some((a) => a.includes('Import failed')), 'error alert shown');

  // --- export serializes the current library
  el('export').dispatch('click');
  assert.equal(downloads.length, 1, 'export produced a download');
  const exported = JSON.parse(downloads[0]);
  assert.equal(exported.books.length, 2, 'export contains both books');

  // --- reload from populated storage (fresh app run, same storage)
  const sandbox2 = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), sandbox2, { filename: 'app.js' });
  assert.equal(list.children.length, 2, 'reload renders saved books');

  console.log('SMOKE TEST PASSED');
}

main().catch((e) => {
  console.error('SMOKE TEST FAILED:', e);
  process.exit(1);
});

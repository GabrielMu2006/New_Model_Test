/* Book Tracker UI layer: rendering, events and localStorage persistence. */
(function () {
  'use strict';

  const Core = window.BookTrackerCore;

  const state = {
    books: [],
    search: '',
    filterStatus: 'all',
    sortKey: 'addedAt',
    sortDir: 'desc',
    editingId: null,
  };

  const els = {
    stats: {
      total: document.getElementById('stat-total'),
      want: document.getElementById('stat-want'),
      reading: document.getElementById('stat-reading'),
      finished: document.getElementById('stat-finished'),
      avg: document.getElementById('stat-avg'),
    },
    search: document.getElementById('search'),
    filterStatus: document.getElementById('filter-status'),
    sortKey: document.getElementById('sort-key'),
    sortDir: document.getElementById('sort-dir'),
    addBook: document.getElementById('add-book'),
    exportBtn: document.getElementById('export'),
    importFile: document.getElementById('import-file'),
    storageHint: document.getElementById('storage-hint'),
    formPanel: document.getElementById('form-panel'),
    formTitle: document.getElementById('form-title'),
    form: document.getElementById('book-form'),
    formCancel: document.getElementById('form-cancel'),
    fields: {
      id: document.getElementById('book-id'),
      title: document.getElementById('f-title'),
      author: document.getElementById('f-author'),
      genre: document.getElementById('f-genre'),
      status: document.getElementById('f-status'),
      rating: document.getElementById('f-rating'),
      finishedAt: document.getElementById('f-finished-at'),
      notes: document.getElementById('f-notes'),
    },
    finishedAtField: document.getElementById('finished-at-field'),
    errors: {
      title: document.getElementById('e-title'),
      author: document.getElementById('e-author'),
      genre: document.getElementById('e-genre'),
      status: document.getElementById('e-status'),
      rating: document.getElementById('e-rating'),
      finishedAt: document.getElementById('e-finishedAt'),
      notes: document.getElementById('e-notes'),
    },
    emptyState: document.getElementById('empty-state'),
    noResults: document.getElementById('no-results'),
    list: document.getElementById('book-list'),
    cardTemplate: document.getElementById('book-card-template'),
  };

  function loadBooks() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return [];
      return Core.parseLibrary(raw);
    } catch (e) {
      els.storageHint.textContent =
        'Saved library data could not be read and was ignored. Use Export to keep backups.';
      return [];
    }
  }

  function saveBooks() {
    try {
      window.localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(state.books));
      els.storageHint.textContent = '';
    } catch (e) {
      els.storageHint.textContent =
        'Could not save to localStorage — your changes may not persist. Use Export to back up.';
    }
  }

  function visibleBooks() {
    let books = Core.searchBooks(state.books, state.search);
    books = Core.filterByStatus(books, state.filterStatus);
    return Core.sortBooks(books, state.sortKey, state.sortDir);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function starsText(rating) {
    if (rating === null) return 'Not rated';
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  function renderStats() {
    const stats = Core.computeStats(state.books);
    els.stats.total.textContent = String(stats.total);
    els.stats.want.textContent = String(stats.byStatus['want-to-read']);
    els.stats.reading.textContent = String(stats.byStatus.reading);
    els.stats.finished.textContent = String(stats.byStatus.finished);
    els.stats.avg.textContent = stats.averageRating === null ? '—' : stats.averageRating.toFixed(1);
  }

  function renderList() {
    const books = visibleBooks();
    els.list.replaceChildren();

    els.emptyState.hidden = state.books.length !== 0;
    els.noResults.hidden = !(state.books.length > 0 && books.length === 0);

    for (const book of books) {
      const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.id = book.id;

      node.querySelector('.book-title').textContent = book.title;

      const meta = [book.author && `by ${book.author}`, book.genre].filter(Boolean).join(' · ');
      const metaEl = node.querySelector('.book-meta');
      metaEl.textContent = meta;
      metaEl.hidden = !meta;

      const notesEl = node.querySelector('.book-notes');
      notesEl.textContent = book.notes;
      notesEl.hidden = !book.notes;

      const badge = node.querySelector('.badge');
      badge.classList.add(book.status);
      badge.textContent = Core.STATUS_LABELS[book.status];

      const stars = node.querySelector('.stars');
      stars.textContent = starsText(book.rating);
      stars.setAttribute(
        'aria-label',
        book.rating === null ? 'Not rated' : `Rated ${book.rating} out of 5`
      );

      const dates = [`Added ${formatDate(book.addedAt)}`];
      if (book.finishedAt) dates.push(`Finished ${formatDate(book.finishedAt)}`);
      node.querySelector('.dates').textContent = dates.join(' · ');

      els.list.appendChild(node);
    }
  }

  function render() {
    renderStats();
    renderList();
  }

  function clearErrors() {
    for (const key of Object.keys(els.errors)) {
      els.errors[key].textContent = '';
    }
  }

  function showErrors(errors) {
    clearErrors();
    for (const key of Object.keys(errors)) {
      if (els.errors[key]) els.errors[key].textContent = errors[key];
    }
  }

  function syncFormForStatus() {
    const status = els.fields.status.value;
    els.finishedAtField.hidden = status !== 'finished';
    els.fields.rating.disabled = status === 'want-to-read';
    if (status === 'want-to-read') els.fields.rating.value = '';
  }

  function openForm(book) {
    state.editingId = book ? book.id : null;
    els.formTitle.textContent = book ? 'Edit book' : 'Add a book';
    els.fields.id.value = book ? book.id : '';
    els.fields.title.value = book ? book.title : '';
    els.fields.author.value = book ? book.author : '';
    els.fields.genre.value = book ? book.genre : '';
    els.fields.status.value = book ? book.status : 'want-to-read';
    els.fields.rating.value = book && book.rating !== null ? String(book.rating) : '';
    els.fields.finishedAt.value = book && book.finishedAt ? book.finishedAt : '';
    els.fields.notes.value = book ? book.notes : '';
    clearErrors();
    syncFormForStatus();
    els.formPanel.hidden = false;
    els.fields.title.focus();
  }

  function closeForm() {
    els.formPanel.hidden = true;
    els.form.reset();
    state.editingId = null;
    clearErrors();
  }

  function readFormInput() {
    return {
      title: els.fields.title.value,
      author: els.fields.author.value,
      genre: els.fields.genre.value,
      status: els.fields.status.value,
      rating: els.fields.rating.value === '' ? null : Number(els.fields.rating.value),
      notes: els.fields.notes.value,
      finishedAt: els.fields.finishedAt.value,
    };
  }

  function onFormSubmit(event) {
    event.preventDefault();
    const input = readFormInput();
    try {
      if (state.editingId) {
        const index = state.books.findIndex((b) => b.id === state.editingId);
        if (index === -1) throw new Error('Book not found');
        state.books[index] = Core.updateBook(state.books[index], input);
      } else {
        state.books.push(Core.createBook(input));
      }
      saveBooks();
      closeForm();
      render();
    } catch (e) {
      if (e.validationErrors) {
        showErrors(e.validationErrors);
      } else {
        showErrors({ title: e.message });
      }
    }
  }

  function onListClick(event) {
    const card = event.target.closest('.book-card');
    if (!card) return;
    const book = state.books.find((b) => b.id === card.dataset.id);
    if (!book) return;

    if (event.target.closest('.action-edit')) {
      openForm(book);
    } else if (event.target.closest('.action-delete')) {
      if (window.confirm(`Delete “${book.title}” from your library?`)) {
        state.books = state.books.filter((b) => b.id !== book.id);
        saveBooks();
        render();
      }
    }
  }

  function exportLibrary() {
    const blob = new Blob([Core.serializeLibrary(state.books)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'book-tracker-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importLibrary(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const incoming = Core.parseLibrary(String(reader.result));
        const existingIds = new Set(state.books.map((b) => b.id));
        let added = 0;
        for (const book of incoming) {
          const copy = Object.assign({}, book);
          if (existingIds.has(copy.id)) {
            copy.id = Core.generateId();
          }
          existingIds.add(copy.id);
          state.books.push(copy);
          added += 1;
        }
        saveBooks();
        render();
        window.alert(`Imported ${added} book${added === 1 ? '' : 's'}.`);
      } catch (e) {
        window.alert(e.message);
      }
    };
    reader.onerror = function () {
      window.alert('Import failed: could not read the file.');
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    els.search.addEventListener('input', function () {
      state.search = els.search.value;
      renderList();
    });
    els.filterStatus.addEventListener('change', function () {
      state.filterStatus = els.filterStatus.value;
      renderList();
    });
    els.sortKey.addEventListener('change', function () {
      state.sortKey = els.sortKey.value;
      renderList();
    });
    els.sortDir.addEventListener('click', function () {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      els.sortDir.textContent = state.sortDir === 'asc' ? '↑ Asc' : '↓ Desc';
      renderList();
    });
    els.addBook.addEventListener('click', function () {
      openForm(null);
    });
    els.form.addEventListener('submit', onFormSubmit);
    els.formCancel.addEventListener('click', closeForm);
    els.fields.status.addEventListener('change', syncFormForStatus);
    els.list.addEventListener('click', onListClick);
    els.exportBtn.addEventListener('click', exportLibrary);
    els.importFile.addEventListener('change', function () {
      if (els.importFile.files && els.importFile.files[0]) {
        importLibrary(els.importFile.files[0]);
      }
      els.importFile.value = '';
    });
  }

  function init() {
    state.books = loadBooks();
    bindEvents();
    render();
  }

  init();
})();

/*
 * BookTracker core: pure data-model logic, no DOM, no storage.
 * Loaded as a plain <script> in the browser (exposes window.BookTrackerCore)
 * and via require() in Node for tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BookTrackerCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATUSES = ['want-to-read', 'reading', 'finished'];
  const STATUS_LABELS = {
    'want-to-read': 'Want to read',
    reading: 'Reading',
    finished: 'Finished',
  };
  const SORT_KEYS = ['addedAt', 'title', 'author', 'rating'];
  const STORAGE_KEY = 'book-tracker.library.v1';
  const EXPORT_VERSION = 1;

  let idCounter = 0;

  function generateId() {
    idCounter += 1;
    const random =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return `book-${Date.now().toString(36)}-${idCounter.toString(36)}-${random}`;
  }

  function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeRating(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return NaN;
    return n;
  }

  function normalizeInput(input) {
    const src = input && typeof input === 'object' ? input : {};
    return {
      title: toTrimmedString(src.title),
      author: toTrimmedString(src.author),
      genre: toTrimmedString(src.genre),
      status: toTrimmedString(src.status) || 'want-to-read',
      rating: normalizeRating(src.rating),
      notes: toTrimmedString(src.notes),
      finishedAt: toTrimmedString(src.finishedAt),
    };
  }

  function validateBookInput(input) {
    const data = normalizeInput(input);
    const errors = {};

    if (!data.title) {
      errors.title = 'Title is required.';
    } else if (data.title.length > 300) {
      errors.title = 'Title must be 300 characters or fewer.';
    }
    if (data.author.length > 200) {
      errors.author = 'Author must be 200 characters or fewer.';
    }
    if (data.genre.length > 100) {
      errors.genre = 'Genre must be 100 characters or fewer.';
    }
    if (!STATUSES.includes(data.status)) {
      errors.status = `Status must be one of: ${STATUSES.join(', ')}.`;
    }
    if (data.rating !== null) {
      if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
        errors.rating = 'Rating must be a whole number between 1 and 5.';
      }
    }
    if (data.notes.length > 5000) {
      errors.notes = 'Notes must be 5000 characters or fewer.';
    }
    if (data.finishedAt) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.finishedAt) || Number.isNaN(Date.parse(data.finishedAt))) {
        errors.finishedAt = 'Finish date must be a valid date (YYYY-MM-DD).';
      }
    }
    if (data.status === 'finished' && data.rating === null) {
      // allowed, but no error: rating stays optional
    }

    return { valid: Object.keys(errors).length === 0, errors, data };
  }

  function createBook(input, options) {
    const opts = options || {};
    const now = opts.now || new Date().toISOString();
    const { valid, errors, data } = validateBookInput(input);
    if (!valid) {
      const err = new Error('Invalid book input');
      err.validationErrors = errors;
      throw err;
    }
    return {
      id: opts.id || generateId(),
      title: data.title,
      author: data.author,
      genre: data.genre,
      status: data.status,
      rating: data.status === 'want-to-read' ? null : data.rating,
      notes: data.notes,
      addedAt: now,
      finishedAt: data.status === 'finished' ? data.finishedAt || now.slice(0, 10) : null,
    };
  }

  function updateBook(book, patch) {
    const merged = Object.assign({}, book, patch, {
      id: book.id,
      addedAt: book.addedAt,
    });
    const { valid, errors, data } = validateBookInput(merged);
    if (!valid) {
      const err = new Error('Invalid book input');
      err.validationErrors = errors;
      throw err;
    }
    const updated = Object.assign({}, book, data, {
      rating: data.status === 'want-to-read' ? null : data.rating,
    });
    if (data.status === 'finished') {
      updated.finishedAt =
        data.finishedAt || book.finishedAt || new Date().toISOString().slice(0, 10);
    } else {
      updated.finishedAt = null;
    }
    return updated;
  }

  function searchBooks(books, query) {
    const q = toTrimmedString(query).toLowerCase();
    if (!q) return books.slice();
    return books.filter(function (b) {
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.genre.toLowerCase().includes(q)
      );
    });
  }

  function filterByStatus(books, status) {
    if (!status || status === 'all') return books.slice();
    return books.filter(function (b) {
      return b.status === status;
    });
  }

  function compareStrings(a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  }

  function sortBooks(books, key, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    const sorted = books.slice();
    sorted.sort(function (a, b) {
      let cmp = 0;
      switch (key) {
        case 'title':
          cmp = compareStrings(a.title, b.title);
          break;
        case 'author':
          cmp = compareStrings(a.author, b.author) || compareStrings(a.title, b.title);
          break;
        case 'rating': {
          const ra = a.rating === null ? -1 : a.rating;
          const rb = b.rating === null ? -1 : b.rating;
          cmp = ra - rb || compareStrings(a.title, b.title);
          break;
        }
        case 'addedAt':
        default:
          cmp = compareStrings(a.addedAt, b.addedAt);
          break;
      }
      return cmp * dir;
    });
    return sorted;
  }

  function computeStats(books) {
    const byStatus = { 'want-to-read': 0, reading: 0, finished: 0 };
    let ratingSum = 0;
    let ratingCount = 0;
    for (const b of books) {
      if (byStatus[b.status] !== undefined) byStatus[b.status] += 1;
      if (typeof b.rating === 'number' && b.rating >= 1 && b.rating <= 5) {
        ratingSum += b.rating;
        ratingCount += 1;
      }
    }
    return {
      total: books.length,
      byStatus,
      ratedCount: ratingCount,
      averageRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    };
  }

  function serializeLibrary(books) {
    return JSON.stringify(
      {
        app: 'book-tracker',
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        books,
      },
      null,
      2
    );
  }

  function isValidBookRecord(b) {
    if (!b || typeof b !== 'object') return false;
    if (typeof b.id !== 'string' || !b.id) return false;
    if (typeof b.title !== 'string' || !b.title.trim()) return false;
    if (!STATUSES.includes(b.status)) return false;
    if (b.rating !== null && (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5)) {
      return false;
    }
    if (typeof b.addedAt !== 'string' || Number.isNaN(Date.parse(b.addedAt))) return false;
    return true;
  }

  // Parses an export payload back into books. Throws on malformed input.
  function parseLibrary(json) {
    let payload;
    try {
      payload = JSON.parse(json);
    } catch (e) {
      throw new Error('Import failed: the file is not valid JSON.');
    }
    const books = Array.isArray(payload) ? payload : payload && payload.books;
    if (!Array.isArray(books)) {
      throw new Error('Import failed: no book list found in the file.');
    }
    for (const b of books) {
      if (!isValidBookRecord(b)) {
        throw new Error('Import failed: at least one book record is malformed.');
      }
    }
    return books.map(function (b) {
      return {
        id: b.id,
        title: b.title,
        author: typeof b.author === 'string' ? b.author : '',
        genre: typeof b.genre === 'string' ? b.genre : '',
        status: b.status,
        rating: b.rating === undefined ? null : b.rating,
        notes: typeof b.notes === 'string' ? b.notes : '',
        addedAt: b.addedAt,
        finishedAt: typeof b.finishedAt === 'string' ? b.finishedAt : null,
      };
    });
  }

  return {
    STATUSES,
    STATUS_LABELS,
    SORT_KEYS,
    STORAGE_KEY,
    generateId,
    validateBookInput,
    createBook,
    updateBook,
    searchBooks,
    filterByStatus,
    sortBooks,
    computeStats,
    serializeLibrary,
    parseLibrary,
  };
});

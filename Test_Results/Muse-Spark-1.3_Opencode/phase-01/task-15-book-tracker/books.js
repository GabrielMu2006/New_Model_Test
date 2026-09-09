// Core book-tracker logic: pure functions, no DOM. Testable with node.
// Book: { id, title, author, genre, year, totalPages, currentPage,
//         status: 'want'|'reading'|'finished', rating: 0-5, notes,
//         dateAdded: ISO string, dateFinished: ISO string|null }

export const STATUSES = ["want", "reading", "finished"];
export const STATUS_LABELS = { want: "Want to Read", reading: "Reading", finished: "Finished" };

export function uid() {
  return "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function toIntOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

export function validateBook(data) {
  const errors = {};
  const title = String(data.title ?? "").trim();
  const author = String(data.author ?? "").trim();
  if (!title) errors.title = "Title is required.";
  if (!author) errors.author = "Author is required.";
  if (title.length > 200) errors.title = "Title is too long (max 200).";
  if (author.length > 200) errors.author = "Author is too long (max 200).";

  const genre = String(data.genre ?? "").trim();
  if (genre.length > 60) errors.genre = "Genre is too long (max 60).";

  const year = toIntOrNull(data.year);
  if (data.year !== "" && data.year !== null && data.year !== undefined) {
    if (Number.isNaN(year)) errors.year = "Year must be a number.";
    else if (year < 0 || year > new Date().getFullYear() + 2) errors.year = "Year looks invalid.";
  }

  const totalPages = toIntOrNull(data.totalPages);
  if (data.totalPages !== "" && data.totalPages !== null && data.totalPages !== undefined) {
    if (Number.isNaN(totalPages)) errors.totalPages = "Total pages must be a number.";
    else if (totalPages < 0 || totalPages > 100000) errors.totalPages = "Total pages looks invalid.";
  }

  const currentPage = toIntOrNull(data.currentPage);
  if (data.currentPage !== "" && data.currentPage !== null && data.currentPage !== undefined) {
    if (Number.isNaN(currentPage)) errors.currentPage = "Current page must be a number.";
    else if (currentPage < 0) errors.currentPage = "Current page can't be negative.";
    else if (totalPages && currentPage > totalPages) errors.currentPage = "Current page exceeds total pages.";
  }

  const rating = Number(data.rating ?? 0);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(rating)) {
    errors.rating = "Rating must be an integer 0-5.";
  }

  const status = data.status ?? "want";
  if (!STATUSES.includes(status)) errors.status = "Invalid status.";

  const notes = String(data.notes ?? "");
  if (notes.length > 2000) errors.notes = "Notes too long (max 2000).";

  return errors;
}

export function normalizeBook(data) {
  const now = new Date().toISOString();
  const totalPages = toIntOrNull(data.totalPages) || 0;
  let currentPage = toIntOrNull(data.currentPage) || 0;
  if (currentPage < 0) currentPage = 0;
  if (totalPages > 0) currentPage = Math.min(currentPage, totalPages);
  const year = toIntOrNull(data.year);
  return {
    id: data.id || uid(),
    title: String(data.title ?? "").trim(),
    author: String(data.author ?? "").trim(),
    genre: String(data.genre ?? "").trim() || "Uncategorized",
    year: Number.isFinite(year) ? year : null,
    totalPages,
    currentPage,
    status: STATUSES.includes(data.status) ? data.status : "want",
    rating: Number.isInteger(Number(data.rating)) ? Math.min(5, Math.max(0, Number(data.rating))) : 0,
    notes: String(data.notes ?? "").trim(),
    dateAdded: data.dateAdded || now,
    dateFinished: data.dateFinished || null,
  };
}

export function createBook(data) {
  const errors = validateBook(data);
  if (Object.keys(errors).length) {
    const err = new Error("Invalid book");
    err.errors = errors;
    throw err;
  }
  return normalizeBook(data);
}

export function addBook(list, data) {
  const book = createBook(data);
  return [book, ...list];
}

export function updateBook(list, id, patch) {
  const idx = list.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("Book not found");
  const merged = { ...list[idx], ...patch, id: list[idx].id };
  // auto dateFinished bookkeeping
  if (patch.status === "finished" && !merged.dateFinished) {
    merged.dateFinished = new Date().toISOString();
  }
  if (patch.status && patch.status !== "finished") {
    merged.dateFinished = null;
  }
  const errors = validateBook(merged);
  if (Object.keys(errors).length) {
    const err = new Error("Invalid book");
    err.errors = errors;
    throw err;
  }
  const next = list.slice();
  next[idx] = normalizeBook(merged);
  return next;
}

export function deleteBook(list, id) {
  return list.filter((b) => b.id !== id);
}

export function setProgress(list, id, currentPage) {
  const n = Math.trunc(Number(currentPage));
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid page number");
  const book = list.find((b) => b.id === id);
  if (!book) throw new Error("Book not found");
  const clamped = book.totalPages > 0 ? Math.min(n, book.totalPages) : n;
  return updateBook(list, id, { currentPage: clamped });
}

export function setStatus(list, id, status) {
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  return updateBook(list, id, { status });
}

export function setRating(list, id, rating) {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 0 || r > 5) throw new Error("Invalid rating");
  return updateBook(list, id, { rating: r });
}

export function progressOf(book) {
  if (!book.totalPages || book.totalPages <= 0) return book.status === "finished" ? 100 : 0;
  return Math.round((Math.min(book.currentPage, book.totalPages) / book.totalPages) * 100);
}

export function filterBooks(list, opts = {}) {
  const q = String(opts.q ?? "").trim().toLowerCase();
  const status = opts.status ?? "all";
  const genre = opts.genre ?? "all";
  const minRating = Number(opts.minRating ?? 0);
  return list.filter((b) => {
    if (status !== "all" && b.status !== status) return false;
    if (genre !== "all" && b.genre !== genre) return false;
    if (minRating > 0 && (b.rating || 0) < minRating) return false;
    if (q) {
      const hay = `${b.title} ${b.author} ${b.genre} ${b.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortBooks(list, key = "dateAdded", dir = "desc") {
  const m = dir === "asc" ? 1 : -1;
  const arr = list.slice();
  const val = (b) => {
    switch (key) {
      case "title": return b.title.toLowerCase();
      case "author": return b.author.toLowerCase();
      case "rating": return b.rating;
      case "progress": return progressOf(b);
      case "year": return b.year ?? -1;
      case "dateAdded":
      default: return b.dateAdded;
    }
  };
  arr.sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va < vb) return -1 * m;
    if (va > vb) return 1 * m;
    return 0;
  });
  return arr;
}

export function getGenres(list) {
  const s = new Set(list.map((b) => b.genre).filter(Boolean));
  return [...s].sort((a, b) => a.localeCompare(b));
}

export function getStats(list) {
  const total = list.length;
  const byStatus = { want: 0, reading: 0, finished: 0 };
  let pagesRead = 0;
  let ratedSum = 0, ratedCount = 0;
  for (const b of list) {
    if (byStatus[b.status] !== undefined) byStatus[b.status]++;
    pagesRead += Math.min(b.currentPage || 0, b.totalPages || b.currentPage || 0);
    if (b.rating > 0) { ratedSum += b.rating; ratedCount++; }
  }
  return {
    total,
    want: byStatus.want,
    reading: byStatus.reading,
    finished: byStatus.finished,
    pagesRead,
    avgRating: ratedCount ? Math.round((ratedSum / ratedCount) * 10) / 10 : 0,
    ratedCount,
    completion: total ? Math.round((byStatus.finished / total) * 100) : 0,
  };
}

export function exportJSON(list) {
  return JSON.stringify(list, null, 2);
}

export function importJSON(text) {
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (!Array.isArray(arr)) throw new Error("JSON must be an array of books.");
  return arr.map((raw) => {
    const errors = validateBook({ ...raw });
    if (Object.keys(errors).length) {
      throw new Error(`Invalid book "${raw.title || "?"}": ${Object.values(errors).join(" ")}`);
    }
    return normalizeBook(raw);
  });
}

export function seedBooks() {
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const raw = [
    { title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fantasy", year: 1937, totalPages: 310, currentPage: 310, status: "finished", rating: 5, notes: "Cozy re-read. Gollum chapter still the best.", dateAdded: daysAgo(60), dateFinished: daysAgo(40) },
    { title: "Project Hail Mary", author: "Andy Weir", genre: "Sci-Fi", year: 2021, totalPages: 476, currentPage: 210, status: "reading", rating: 4, notes: "Halfway — Rocky is a delight.", dateAdded: daysAgo(20) },
    { title: "Atomic Habits", author: "James Clear", genre: "Nonfiction", year: 2018, totalPages: 320, currentPage: 0, status: "want", rating: 0, notes: "Recommended for systems over goals.", dateAdded: daysAgo(5) },
    { title: "Klara and the Sun", author: "Kazuo Ishiguro", genre: "Literary", year: 2021, totalPages: 303, currentPage: 303, status: "finished", rating: 4, notes: "Quiet and heartbreaking.", dateAdded: daysAgo(50), dateFinished: daysAgo(30) },
    { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", year: 1965, totalPages: 688, currentPage: 90, status: "reading", rating: 5, notes: "Slow burn, incredible worldbuilding.", dateAdded: daysAgo(10) },
  ];
  return raw.map(normalizeBook);
}

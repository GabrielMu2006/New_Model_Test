import {
  addBook, updateBook, deleteBook, setProgress, setRating, setStatus,
  filterBooks, sortBooks, getGenres, getStats, progressOf, exportJSON,
  importJSON, seedBooks, STATUS_LABELS, validateBook,
} from "./books.js";

const KEY = "book-tracker-v1";

const $ = (s) => document.querySelector(s);
const grid = $("#grid"), emptyEl = $("#empty"), statsEl = $("#stats");
const searchEl = $("#search"), sortEl = $("#sort"), genreEl = $("#genreFilter"), ratingEl = $("#ratingFilter");
const resultCount = $("#resultCount"), footInfo = $("#footInfo");
const overlay = $("#overlay"), form = $("#bookForm");

let books = load();
let ui = { q: "", status: "all", genre: "all", minRating: 0, sortKey: "dateAdded", sortDir: "desc" };
let editingId = null;
let formRating = 0;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seed = seedBooks();
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(books));
}

const COVERS = [
  "linear-gradient(135deg,#b3541e,#7a2f10)", "linear-gradient(135deg,#2e7d4f,#14432a)",
  "linear-gradient(135deg,#3b5bdb,#1e2f7a)", "linear-gradient(135deg,#8a4fb5,#4c2568)",
  "linear-gradient(135deg,#0e7c86,#083f45)", "linear-gradient(135deg,#a33,#5c1414)",
];
function coverStyle(title) {
  let h = 0;
  for (const c of String(title)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return COVERS[h % COVERS.length];
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function starsHTML(rating) {
  const full = "★".repeat(rating), empty = "☆".repeat(5 - rating);
  return `<span class="stars" title="${rating}/5">${full}${empty}</span>`;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

// ---------- render ----------
function render() {
  const stats = getStats(books);
  statsEl.innerHTML = `
    <div class="stat"><div class="n">${stats.total}</div><div class="l">Books</div></div>
    <div class="stat"><div class="n">${stats.reading}</div><div class="l">Reading</div></div>
    <div class="stat"><div class="n">${stats.finished}</div><div class="l">Finished</div></div>
    <div class="stat"><div class="n">${stats.pagesRead.toLocaleString()}</div><div class="l">Pages read</div></div>
    <div class="stat"><div class="n">${stats.avgRating || "—"}</div><div class="l">Avg rating (${stats.ratedCount})</div></div>`;

  // genre options (preserve selection)
  const genres = getGenres(books);
  const cur = ui.genre;
  genreEl.innerHTML = `<option value="all">All genres</option>` +
    genres.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  genreEl.value = genres.includes(cur) ? cur : "all";
  ui.genre = genreEl.value;
  $("#genreList").innerHTML = genres.map((g) => `<option value="${esc(g)}">`).join("");

  let list = filterBooks(books, { q: ui.q, status: ui.status, genre: ui.genre, minRating: ui.minRating });
  list = sortBooks(list, ui.sortKey, ui.sortDir);

  resultCount.textContent = list.length === books.length
    ? `${books.length} book${books.length === 1 ? "" : "s"} in your library`
    : `Showing ${list.length} of ${books.length} books`;
  footInfo.textContent = `${stats.completion}% complete · ${stats.want} want to read`;

  emptyEl.hidden = books.length !== 0;
  grid.innerHTML = list.map(cardHTML).join("");
}

function cardHTML(b) {
  const p = progressOf(b);
  const pages = b.totalPages > 0 ? `${b.currentPage}/${b.totalPages} · ${p}%` : `${b.currentPage} pages in`;
  return `
  <article class="card" data-id="${b.id}">
    <div class="cover" style="background:${coverStyle(b.title)}" aria-hidden="true">${esc((b.title || "?")[0].toUpperCase())}</div>
    <div class="card-body">
      <div class="card-top">
        <div><h3>${esc(b.title)}</h3><p class="author">by ${esc(b.author)}</p></div>
        <div>
          <button class="icon-btn" data-act="edit" title="Edit" aria-label="Edit ${esc(b.title)}">✎</button>
          <button class="icon-btn" data-act="del" title="Delete" aria-label="Delete ${esc(b.title)}">🗑</button>
        </div>
      </div>
      <div class="meta">
        <span class="pill status-${b.status}">${STATUS_LABELS[b.status]}</span>
        <span class="pill">${esc(b.genre)}</span>
        ${b.year ? `<span class="pill">${b.year}</span>` : ""}
      </div>
      <div data-act="rate">${starsHTML(b.rating)}</div>
      <div class="progress" aria-label="Reading progress ${p} percent"><div style="width:${p}%"></div></div>
      <div class="prow">
        <span>${esc(pages)}</span>
        <button class="mini" data-act="dec" type="button">−10</button>
        <button class="mini" data-act="inc" type="button">+10</button>
        ${b.status !== "finished" ? `<button class="mini" data-act="finish" type="button">Finish</button>` : ""}
      </div>
      <div class="prow" style="margin-top:6px">
        <label>Page <input type="number" min="0" ${b.totalPages ? `max="${b.totalPages}"` : ""} value="${b.currentPage}" data-page-input /></label>
        <select data-status-sel aria-label="Change status">
          ${["want", "reading", "finished"].map((s) => `<option value="${s}" ${s === b.status ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}
        </select>
      </div>
      ${b.notes ? `<p class="notes">${esc(b.notes)}</p>` : ""}
    </div>
  </article>`;
}

// ---------- modal ----------
function openModal(book = null) {
  editingId = book?.id ?? null;
  $("#modalTitle").textContent = book ? "Edit book" : "Add book";
  $("#fId").value = book?.id ?? "";
  $("#fTitle").value = book?.title ?? "";
  $("#fAuthor").value = book?.author ?? "";
  $("#fGenre").value = book?.genre === "Uncategorized" ? "" : (book?.genre ?? "");
  $("#fYear").value = book?.year ?? "";
  $("#fTotal").value = book?.totalPages || "";
  $("#fCurrent").value = book?.currentPage || "";
  $("#fStatus").value = book?.status ?? "want";
  $("#fNotes").value = book?.notes ?? "";
  formRating = book?.rating ?? 0;
  renderStarInput();
  clearErrors();
  overlay.hidden = false;
  $("#fTitle").focus();
}
function closeModal() { overlay.hidden = true; editingId = null; }
function clearErrors() { document.querySelectorAll(".err").forEach((e) => (e.textContent = "")); }
function showErrors(errors) {
  for (const [k, msg] of Object.entries(errors)) {
    const el = document.querySelector(`[data-err="${k}"]`);
    if (el) el.textContent = msg;
  }
}
function renderStarInput() {
  const wrap = $("#starInput");
  wrap.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = i <= formRating ? "★" : "☆";
    b.className = i <= formRating ? "on" : "";
    b.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
    b.addEventListener("click", () => {
      formRating = formRating === i ? 0 : i; // click same star to clear
      renderStarInput();
    });
    wrap.appendChild(b);
  }
}

// ---------- events ----------
$("#addBtn").addEventListener("click", () => openModal());
$("#emptyAddBtn").addEventListener("click", () => openModal());
$("#seedBtn").addEventListener("click", () => {
  books = seedBooks(); save(); render(); toast("Sample books loaded");
});
$("#closeModal").addEventListener("click", closeModal);
$("#cancelBtn").addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeModal(); });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    title: $("#fTitle").value.trim(),
    author: $("#fAuthor").value.trim(),
    genre: $("#fGenre").value.trim(),
    year: $("#fYear").value.trim(),
    totalPages: $("#fTotal").value.trim(),
    currentPage: $("#fCurrent").value.trim(),
    status: $("#fStatus").value,
    rating: formRating,
    notes: $("#fNotes").value.trim(),
  };
  // Convenience: finishing a book jumps to last page
  try {
    if (editingId) {
      const prev = books.find((b) => b.id === editingId);
      let patch = { ...data };
      if (data.status === "finished" && Number(data.totalPages) > 0) patch.currentPage = Number(data.totalPages);
      if (prev && data.status === prev.status && prev.status === "finished") { /* keep */ }
      books = updateBook(books, editingId, patch);
      toast("Book updated");
    } else {
      if (data.status === "finished" && Number(data.totalPages) > 0 && !data.currentPage) {
        data.currentPage = data.totalPages;
      }
      books = addBook(books, data);
      toast("Book added");
    }
    save(); render(); closeModal();
  } catch (err) {
    showErrors(err.errors || {});
    if (!err.errors) toast(err.message);
  }
});

searchEl.addEventListener("input", () => { ui.q = searchEl.value; render(); });
sortEl.addEventListener("change", () => {
  const [k, d] = sortEl.value.split("-");
  ui.sortKey = k; ui.sortDir = d; render();
});
genreEl.addEventListener("change", () => { ui.genre = genreEl.value; render(); });
ratingEl.addEventListener("change", () => { ui.minRating = Number(ratingEl.value); render(); });
$("#statusChips").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-status]");
  if (!btn) return;
  document.querySelectorAll("#statusChips .chip").forEach((c) => c.classList.remove("active"));
  btn.classList.add("active");
  ui.status = btn.dataset.status;
  render();
});

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id;
  const actBtn = e.target.closest("[data-act]");
  const act = actBtn?.dataset.act;
  try {
    if (act === "edit") {
      openModal(books.find((b) => b.id === id));
    } else if (act === "del") {
      const b = books.find((x) => x.id === id);
      if (confirm(`Remove "${b.title}" from your library?`)) {
        books = deleteBook(books, id); save(); render(); toast("Book removed");
      }
    } else if (act === "inc" || act === "dec") {
      const b = books.find((x) => x.id === id);
      const step = act === "inc" ? 10 : -10;
      const next = Math.max(0, b.currentPage + step);
      books = setProgress(books, id, b.totalPages > 0 ? Math.min(next, b.totalPages) : next);
      save(); render();
    } else if (act === "finish") {
      const b = books.find((x) => x.id === id);
      const patch = { status: "finished" };
      if (b.totalPages > 0) patch.currentPage = b.totalPages;
      books = updateBook(books, id, patch);
      save(); render(); toast("Finished — nice work!");
    }
  } catch (err) {
    toast(err.message);
  }
});

grid.addEventListener("change", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id;
  try {
    if (e.target.matches("[data-status-sel]")) {
      const b = books.find((x) => x.id === id);
      const patch = { status: e.target.value };
      if (e.target.value === "finished" && b.totalPages > 0) patch.currentPage = b.totalPages;
      books = updateBook(books, id, patch);
      save(); render(); toast(`Moved to “${STATUS_LABELS[e.target.value]}”`);
    } else if (e.target.matches("[data-page-input]")) {
      books = setProgress(books, id, e.target.value === "" ? 0 : Number(e.target.value));
      save(); render();
    }
  } catch (err) {
    toast(err.message); render();
  }
});

// click stars on card to rate (delegated: map click x within stars to 1-5)
grid.addEventListener("click", (e) => {
  const rateZone = e.target.closest('[data-act="rate"]');
  if (!rateZone || e.target.closest("button.mini")) return;
  // only handle direct clicks on the stars span (no inner buttons on card)
  const card = e.target.closest(".card");
  if (!card || e.target.closest("[data-act]") !== rateZone) return;
  const rect = rateZone.getBoundingClientRect();
  const ratio = ((e.clientX - rect.left) / Math.max(rect.width, 1));
  const rating = Math.min(5, Math.max(1, Math.ceil(ratio * 5)));
  try {
    books = setRating(books, card.dataset.id, rating);
    save(); render(); toast(`Rated ${rating}/5`);
  } catch (err) {
    toast(err.message);
  }
});

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([exportJSON(books)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "my-library.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    books = importJSON(await f.text());
    save(); render(); toast(`Imported ${books.length} books`);
  } catch (err) {
    toast(err.message);
  }
  e.target.value = "";
});
$("#clearBtn").addEventListener("click", () => {
  if (books.length && confirm("Remove ALL books from your library?")) {
    books = []; save(); render(); toast("Library cleared");
  }
});

// validate import of validateBook for tree-shake lint
void validateBook;
void setStatus;

render();

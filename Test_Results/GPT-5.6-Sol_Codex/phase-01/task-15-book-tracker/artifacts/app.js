const STORAGE_KEY = 'marginalia-books-v1';
const GOAL_KEY = 'marginalia-goal-v1';
const colors = ['#345c54', '#b95843', '#424c63', '#9d7136', '#6b4b5e', '#55633f', '#31556b', '#8c4c3e'];

const seedBooks = [
  { id: 'seed-1', title: 'The Overstory', author: 'Richard Powers', status: 'reading', genre: 'Literary fiction', pages: 502, current: 318, rating: 4, notes: 'Trees, time, and the smallness of a human life.', added: '2026-08-25', color: '#375d4b' },
  { id: 'seed-2', title: 'Sea of Tranquility', author: 'Emily St. John Mandel', status: 'reading', genre: 'Science fiction', pages: 255, current: 94, rating: 0, notes: '', added: '2026-09-04', color: '#345f74' },
  { id: 'seed-3', title: 'Piranesi', author: 'Susanna Clarke', status: 'finished', genre: 'Fantasy', pages: 272, current: 272, rating: 5, notes: 'Strange, tender, and utterly transporting.', added: '2026-07-10', color: '#a5683d' },
  { id: 'seed-4', title: 'Braiding Sweetgrass', author: 'Robin Wall Kimmerer', status: 'finished', genre: 'Nature', pages: 408, current: 408, rating: 5, notes: 'Return to the chapter on the gift economy.', added: '2026-06-18', color: '#62704a' },
  { id: 'seed-5', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', status: 'want', genre: 'Contemporary', pages: 401, current: 0, rating: 0, notes: '', added: '2026-09-06', color: '#a94f45' },
  { id: 'seed-6', title: 'A Gentleman in Moscow', author: 'Amor Towles', status: 'finished', genre: 'Historical fiction', pages: 462, current: 462, rating: 4, notes: '', added: '2026-04-15', color: '#4b5067' },
  { id: 'seed-7', title: 'The Dispossessed', author: 'Ursula K. Le Guin', status: 'want', genre: 'Science fiction', pages: 387, current: 0, rating: 0, notes: '', added: '2026-08-30', color: '#a07a38' },
  { id: 'seed-8', title: 'Small Things Like These', author: 'Claire Keegan', status: 'finished', genre: 'Literary fiction', pages: 128, current: 128, rating: 5, notes: 'Quiet and devastating.', added: '2026-02-01', color: '#765163' }
];

let books = loadBooks();
let activeFilter = 'all';
let searchQuery = '';

const grid = document.querySelector('#bookGrid');
const emptyState = document.querySelector('#emptyState');
const dialog = document.querySelector('#bookDialog');
const form = document.querySelector('#bookForm');
const goalDialog = document.querySelector('#goalDialog');
const goalForm = document.querySelector('#goalForm');

function loadBooks() {
  try { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(stored) ? stored : seedBooks; }
  catch { return seedBooks; }
}

function saveBooks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); }
function escapeHtml(value = '') { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
function statusLabel(status) { return ({ reading: 'Reading', want: 'Want to read', finished: 'Finished' })[status]; }

function render() {
  updateStats();
  let visible = books.filter(book => {
    const shelfMatches = activeFilter === 'all' || book.status === activeFilter;
    const haystack = `${book.title} ${book.author} ${book.genre}`.toLowerCase();
    return shelfMatches && haystack.includes(searchQuery);
  });
  const sort = document.querySelector('#sortSelect').value;
  visible.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'author' ? a.author.localeCompare(b.author) : sort === 'rating' ? b.rating - a.rating : b.added.localeCompare(a.added));
  grid.innerHTML = visible.map(bookCard).join('');
  emptyState.hidden = visible.length > 0;
  grid.hidden = visible.length === 0;
  grid.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => openForm(card.dataset.id));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openForm(card.dataset.id); } });
  });
}

function bookCard(book) {
  const percent = book.status === 'finished' ? 100 : Math.min(100, Math.round((book.current / book.pages) * 100) || 0);
  const stars = book.rating ? `${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}` : 'Not rated';
  return `<article class="book-card" tabindex="0" role="button" aria-label="Edit ${escapeHtml(book.title)}" data-id="${book.id}">
    <div class="cover" style="background:${book.color}">
      <span class="cover-ornament">${escapeHtml(book.title.charAt(0))}</span>
      <strong class="cover-title">${escapeHtml(book.title)}</strong>
      <span class="cover-author">${escapeHtml(book.author)}</span>
    </div>
    <div class="card-info">
      <div class="status-line"><span class="badge ${book.status}">${statusLabel(book.status)}</span><span class="rating" aria-label="${book.rating} out of 5 stars">${stars}</span></div>
      <h3 class="card-title">${escapeHtml(book.title)}</h3><p class="card-author">${escapeHtml(book.author)}</p>
      ${book.status === 'reading' ? `<div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="progress-copy"><span>Page ${book.current} of ${book.pages}</span><span>${percent}%</span></div>` : ''}
    </div>
  </article>`;
}

function updateStats() {
  const reading = books.filter(b => b.status === 'reading').length;
  const finished = books.filter(b => b.status === 'finished').length;
  const goal = Number(localStorage.getItem(GOAL_KEY)) || 24;
  const percent = Math.min(100, Math.round((finished / goal) * 100));
  document.querySelector('#statTotal').textContent = books.length;
  document.querySelector('#statReading').textContent = reading;
  document.querySelector('#statFinished').textContent = finished;
  document.querySelector('#countAll').textContent = books.length;
  document.querySelector('#countReading').textContent = reading;
  document.querySelector('#countWant').textContent = books.filter(b => b.status === 'want').length;
  document.querySelector('#countFinished').textContent = finished;
  document.querySelector('#goalCurrent').textContent = finished;
  document.querySelector('#goalTarget').textContent = goal;
  document.querySelector('#goalPercent').textContent = `${percent}%`;
  document.querySelector('#goalRing').style.background = `conic-gradient(var(--coral) ${percent}%, #ded8cd 0)`;
}

function openForm(id = '') {
  form.reset();
  document.querySelector('#bookId').value = id;
  document.querySelector('#deleteButton').hidden = !id;
  document.querySelector('#dialogTitle').textContent = id ? 'Edit book' : 'Add a new book';
  if (id) {
    const book = books.find(item => item.id === id);
    if (!book) return;
    document.querySelector('#titleInput').value = book.title;
    document.querySelector('#authorInput').value = book.author;
    document.querySelector('#statusInput').value = book.status;
    document.querySelector('#genreInput').value = book.genre;
    document.querySelector('#pagesInput').value = book.pages;
    document.querySelector('#currentInput').value = book.current;
    document.querySelector('#ratingInput').value = book.rating;
    document.querySelector('#notesInput').value = book.notes || '';
  }
  dialog.showModal();
  setTimeout(() => document.querySelector('#titleInput').focus(), 0);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const id = document.querySelector('#bookId').value;
  const status = document.querySelector('#statusInput').value;
  const pages = Number(document.querySelector('#pagesInput').value);
  let current = Number(document.querySelector('#currentInput').value);
  if (status === 'finished') current = pages;
  current = Math.min(current, pages);
  const previous = books.find(item => item.id === id);
  const book = {
    id: id || `book-${Date.now()}`,
    title: document.querySelector('#titleInput').value.trim(), author: document.querySelector('#authorInput').value.trim(), status,
    genre: document.querySelector('#genreInput').value.trim() || 'Uncategorized', pages, current,
    rating: Number(document.querySelector('#ratingInput').value), notes: document.querySelector('#notesInput').value.trim(),
    added: previous?.added || new Date().toISOString().slice(0, 10), color: previous?.color || colors[books.length % colors.length]
  };
  books = id ? books.map(item => item.id === id ? book : item) : [book, ...books];
  saveBooks(); dialog.close(); render(); showToast(id ? 'Book updated' : 'Book added to your library');
});

document.querySelector('#deleteButton').addEventListener('click', () => {
  const id = document.querySelector('#bookId').value;
  if (!id || !confirm('Remove this book from your library?')) return;
  books = books.filter(book => book.id !== id); saveBooks(); dialog.close(); render(); showToast('Book removed');
});

document.querySelectorAll('[data-open-form]').forEach(button => button.addEventListener('click', () => openForm()));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button)); render();
}));
document.querySelector('#searchInput').addEventListener('input', event => { searchQuery = event.target.value.trim().toLowerCase(); render(); });
document.querySelector('#sortSelect').addEventListener('change', render);

function openGoal() { document.querySelector('#goalInput').value = Number(localStorage.getItem(GOAL_KEY)) || 24; goalDialog.showModal(); }
document.querySelector('#navGoals').addEventListener('click', openGoal);
document.querySelector('#goalCard').addEventListener('click', openGoal);
document.querySelectorAll('[data-close-goal]').forEach(button => button.addEventListener('click', () => goalDialog.close()));
goalForm.addEventListener('submit', event => { event.preventDefault(); localStorage.setItem(GOAL_KEY, document.querySelector('#goalInput').value); goalDialog.close(); updateStats(); showToast('Reading goal updated'); });

function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200); }

const hour = new Date().getHours();
document.querySelector('#welcomeTitle').textContent = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, reader.`;
document.querySelector('#todayLabel').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
render();

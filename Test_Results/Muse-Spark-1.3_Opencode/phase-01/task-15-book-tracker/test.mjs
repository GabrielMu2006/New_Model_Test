import {
  addBook, updateBook, deleteBook, setProgress, setRating, setStatus,
  filterBooks, sortBooks, getStats, progressOf, importJSON, createBook,
} from "./books.js";

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}`); fail++; }
}

let list = [];
// create
try {
  list = addBook(list, { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", totalPages: 688, currentPage: 10, status: "reading", rating: 5 });
  ok(list.length === 1 && list[0].title === "Dune", "add valid book");
} catch (e) { ok(false, "add valid book: " + e.message); }

try { createBook({ title: "", author: "" }); ok(false, "reject empty title/author"); }
catch (e) { ok(e.errors?.title && e.errors?.author, "reject empty title/author"); }

try { createBook({ title: "X", author: "Y", rating: 6 }); ok(false, "reject rating 6"); }
catch (e) { ok(!!e.errors?.rating, "reject rating 6"); }

try { createBook({ title: "X", author: "Y", currentPage: 50, totalPages: 10 }); ok(false, "reject current > total"); }
catch (e) { ok(!!e.errors?.currentPage, "reject current > total"); }

// update / progress / status / rating
list = addBook(list, { title: "Klara", author: "Ishiguro", status: "want", rating: 0 });
const id = list[0].id;
list = setProgress(list, id, 42);
ok(list.find((b) => b.id === id).currentPage === 42, "set progress");
list = setRating(list, id, 4);
ok(list.find((b) => b.id === id).rating === 4, "set rating");
list = setStatus(list, id, "finished");
ok(list.find((b) => b.id === id).status === "finished", "set status");
try { setRating(list, id, 9); ok(false, "reject bad rating"); }
catch { ok(true, "reject bad rating"); }
list = updateBook(list, id, { title: "Klara and the Sun" });
ok(list.find((b) => b.id === id).title === "Klara and the Sun", "update title");

// progress calc
ok(progressOf({ totalPages: 200, currentPage: 50, status: "reading" }) === 25, "progress 25%");

// filter / sort / stats
const reading = filterBooks(list, { status: "reading" });
ok(reading.length === 1 && reading[0].title === "Dune", "filter by status");
ok(filterBooks(list, { q: "klara" }).length === 1, "search query");
ok(filterBooks(list, { minRating: 5 }).length === 1, "filter min rating");
const sorted = sortBooks(list, "title", "asc");
ok(sorted[0].title === "Dune", "sort by title asc");
const stats = getStats(list);
ok(stats.total === 2 && stats.finished === 1 && stats.reading === 1, "stats counts");

// import round-trip
const json = JSON.stringify(list);
const back = importJSON(json);
ok(back.length === 2, "import JSON");
try { importJSON("nope"); ok(false, "reject bad JSON"); } catch { ok(true, "reject bad JSON"); }

// delete
list = deleteBook(list, id);
ok(list.length === 1, "delete book");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

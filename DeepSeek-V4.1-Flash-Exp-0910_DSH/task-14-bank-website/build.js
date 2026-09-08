#!/usr/bin/env node
/**
 * Meridian Bank — tiny static site builder.
 *
 *   node build.js
 *
 * Reads src/pages/*.html (with a small YAML-ish front matter), wraps each page
 * in src/partials/base.html with the shared header/footer, and writes plain
 * static HTML to the project root. The output is committed, so the site also
 * works by simply opening index.html from disk — no build step required to use
 * it, only to regenerate it after editing src/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const PAGES_DIR = path.join(SRC, 'pages');

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

/** Split `--- key: value ---` front matter from the page body. */
function parsePage(raw) {
  const meta = {};
  let body = raw;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i < 1) continue;
      meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { meta, body };
}

/** Mark the current page's nav link so CSS/AT can style it. */
function applyActive(html, nav) {
  if (!nav) return html;
  const token = `data-navlink="${nav}"`;
  return html.split(token).join(`${token} aria-current="page"`);
}

/** Script dependencies: requesting one of these pulls in what it needs first. */
const SCRIPT_DEPS = {
  calculators: ['finance'],
  rates: ['finance'],
  login: ['forms'],
  apply: ['forms']
};

/** Build <script> tags for the page's `scripts:` list, resolving dependencies. */
function scriptTags(list) {
  const requested = ['site'].concat((list || '').split(',').map((s) => s.trim()).filter(Boolean));
  const names = [];
  for (const name of requested) {
    for (const dep of SCRIPT_DEPS[name] || []) {
      if (!names.includes(dep)) names.push(dep);
    }
    if (!names.includes(name)) names.push(name);
  }
  return [...new Set(names)]
    .filter((name) => exists(path.join(ROOT, 'assets', 'js', `${name}.js`)))
    .map((name) => `<script src="assets/js/${name}.js" defer></script>`)
    .join('\n');
}

function build() {
  const base = read(path.join(SRC, 'partials', 'base.html'));
  const header = read(path.join(SRC, 'partials', 'header.html'));
  const footer = read(path.join(SRC, 'partials', 'footer.html'));
  const year = String(new Date().getFullYear());

  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.html')).sort();
  const built = [];

  for (const file of files) {
    const { meta, body } = parsePage(read(path.join(PAGES_DIR, file)));

    // `chrome: none` produces a bare page (the focused auth screen).
    const noChrome = (meta.chrome || '').toLowerCase() === 'none';

    const html = base
      .replace('{{title}}', meta.title || 'Meridian Bank')
      .replace('{{description}}', meta.description || '')
      .replace('{{pageClass}}', meta.pageClass || '')
      .replace('{{header}}', noChrome ? '' : applyActive(header, meta.nav))
      .replace('{{footer}}', noChrome ? '' : footer.replace(/\{\{year\}\}/g, year))
      .replace('{{body}}', body.trim())
      .replace('{{scripts}}', scriptTags(meta.scripts))
      .replace(/\{\{year\}\}/g, year);

    const out = path.join(ROOT, file);
    fs.writeFileSync(out, html);
    built.push({ file, bytes: Buffer.byteLength(html) });
  }

  const width = Math.max(...built.map((b) => b.file.length));
  for (const b of built) {
    console.log(`  ${b.file.padEnd(width)}  ${(b.bytes / 1024).toFixed(1).padStart(6)} kB`);
  }
  console.log(`\n  ${built.length} pages built into ${path.relative(process.cwd(), ROOT) || '.'}`);
}

build();

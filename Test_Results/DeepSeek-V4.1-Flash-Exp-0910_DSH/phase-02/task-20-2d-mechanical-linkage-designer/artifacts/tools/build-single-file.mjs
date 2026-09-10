/**
 * Build the single-file distribution.
 *
 * `index.html` uses ES modules, which browsers refuse to load over `file://`.
 * This tool inlines the stylesheet and bundles every module in `src/` into one
 * classic `<script>` so the app also works by simply double-clicking
 * `dist/linkage-designer.html`.
 *
 * The bundler is deliberately tiny and only understands the module syntax used
 * in this project (named imports/exports, no default exports). It fails loudly
 * on anything it does not recognise rather than emitting broken output.
 *
 * Usage: node tools/build-single-file.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'src');

/* ------------------------------------------------------------ module graph */

function readModule(file) {
  return fs.readFileSync(file, 'utf8');
}

/** Resolve `./x.js` as written in a module to an absolute path. */
function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    throw new Error(`Only relative imports are supported (found "${specifier}" in ${fromFile})`);
  }
  return path.resolve(path.dirname(fromFile), specifier);
}

function collectGraph(entry) {
  const modules = new Map(); // absolute path -> source
  const order = [];
  const visiting = new Set();

  const visit = (file) => {
    if (modules.has(file)) return;
    if (visiting.has(file)) throw new Error(`Circular import detected at ${file}`);
    visiting.add(file);
    const source = readModule(file);
    for (const match of source.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"](.+?)['"];?[ \t]*$/gm)) {
      visit(resolveImport(file, match[2]));
    }
    visiting.delete(file);
    modules.set(file, source);
    order.push(file);
  };

  visit(entry);
  return { modules, order };
}

/* ----------------------------------------------------------- transpilation */

const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+['"](.+?)['"];?[ \t]*$/gm;

function transformModule(file, source, nameOf) {
  const exported = new Set();

  if (/^\s*export\s+default\b/m.test(source)) {
    throw new Error(`Default exports are not supported (${file})`);
  }

  let code = source.replace(IMPORT_RE, (whole, clause, specifier) => {
    const target = nameOf(resolveImport(file, specifier));
    const trimmed = clause.trim();
    if (trimmed.startsWith('*')) {
      throw new Error(`Namespace imports are not supported (${file})`);
    }
    if (!trimmed.startsWith('{')) {
      throw new Error(`Default imports are not supported (${file}: ${trimmed})`);
    }
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return `__require(${JSON.stringify(target)});`;
    const bindings = inner
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [from, to] = part.split(/\s+as\s+/).map((p) => p.trim());
        return to ? `${from}: ${to}` : from;
      });
    return `const { ${bindings.join(', ')} } = __require(${JSON.stringify(target)});`;
  });

  // export function name / export const name / export class Name
  code = code.replace(
    /^export\s+(async\s+)?function\s+([A-Za-z0-9_$]+)/gm,
    (whole, asyncKeyword, name) => {
      exported.add(name);
      return `${asyncKeyword || ''}function ${name}`;
    },
  );
  code = code.replace(/^export\s+class\s+([A-Za-z0-9_$]+)/gm, (whole, name) => {
    exported.add(name);
    return `class ${name}`;
  });
  code = code.replace(/^export\s+(const|let|var)\s+([A-Za-z0-9_$]+)/gm, (whole, kind, name) => {
    exported.add(name);
    return `${kind} ${name}`;
  });
  code = code.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (whole, list) => {
    for (const part of list.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [local, alias] = trimmed.split(/\s+as\s+/).map((p) => p.trim());
      exported.add(local);
      if (alias && alias !== local) {
        throw new Error(`Renamed exports are not supported (${file}: ${trimmed})`);
      }
    }
    return '';
  });

  if (/^\s*export\b/m.test(code)) {
    const line = code.split('\n').find((l) => /^\s*export\b/.test(l));
    throw new Error(`Unsupported export syntax in ${file}: ${line.trim()}`);
  }

  const exportLine = exported.size
    ? `\n__exports(${JSON.stringify([...exported])});\n`
    : '\n';
  return { code, exported: [...exported], exportLine };
}

/* -------------------------------------------------------------------- build */

export function buildBundle() {
  const entry = path.join(SRC, 'app.js');
  const { modules, order } = collectGraph(entry);
  const nameOf = (file) => path.relative(SRC, file).split(path.sep).join('/');

  const parts = [];
  for (const file of order) {
    const name = nameOf(file);
    const { code, exported } = transformModule(file, modules.get(file), nameOf);
    const returns = exported.length ? `return { ${exported.join(', ')} };\n` : 'return {};\n';
    parts.push(
      `__define(${JSON.stringify(name)}, function (__require) {\n'use strict';\n${code}\n${returns}});\n`,
    );
  }

  const runtime = `/* Linkage Designer — single-file build.
 * Generated by tools/build-single-file.mjs — do not edit by hand.
 * Bundles src/*.js (dependency order), styles.css and index.html.
 */
(function () {
'use strict';
var __defs = {};
var __cache = {};
function __define(name, factory) { __defs[name] = factory; }
function __require(name) {
  if (Object.prototype.hasOwnProperty.call(__cache, name)) return __cache[name];
  var factory = __defs[name];
  if (!factory) throw new Error('Module not found: ' + name);
  var exports = factory(__require);
  __cache[name] = exports;
  return exports;
}
`;

  const footer = `
var __api = { require: __require, modules: __defs };
if (typeof globalThis !== 'undefined') globalThis.__LINKAGE_BUNDLE__ = __api;
if (typeof window !== 'undefined') window.LinkageDesignerBundle = __api;
__require('app.js');
})();
`;

  return runtime + parts.join('\n') + footer;
}

export function buildHtml() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const script = buildBundle();

  let out = html.replace(
    /[ \t]*<link rel="stylesheet" href="\.\/styles\.css" \/>/,
    `    <style>\n${css}\n    </style>`,
  );
  out = out.replace(
    /[ \t]*<script type="module" src="\.\/src\/app\.js"><\/script>/,
    `    <script>\n${script}\n    </script>`,
  );
  if (out.includes('href="./styles.css"') || out.includes('src="./src/app.js"')) {
    throw new Error('index.html still references external assets after bundling');
  }
  out = out.replace(
    '<title>2D Linkage Designer',
    '<!-- Single-file build: open this file directly, no server required. -->\n    <title>2D Linkage Designer',
  );
  return out;
}

export function writeBundle(target = path.join(ROOT, 'dist', 'linkage-designer.html')) {
  const html = buildHtml();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  return { target, bytes: Buffer.byteLength(html) };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const { target, bytes } = writeBundle();
  process.stdout.write(`built ${path.relative(ROOT, target)} (${(bytes / 1024).toFixed(1)} kB)\n`);
}

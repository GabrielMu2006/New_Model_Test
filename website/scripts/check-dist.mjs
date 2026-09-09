import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const htmlFiles = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.html') && htmlFiles.push(path.join(dir, entry.name)));
walk(root);
const failures = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(https?:|#|mailto:|tel:|data:)/.test(url) || url.includes('${')) continue;
    const clean = url.split(/[?#]/)[0].replace(/^\/+/, '');
    let target = url.startsWith('/') ? path.join(root, clean) : path.resolve(path.dirname(file), clean);
    if (url.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) failures.push(`${path.relative(root, file)} -> ${url}`);
  }
}
if (failures.length) throw new Error(`Broken internal files:\n${failures.slice(0, 30).join('\n')}`);
const generatedPages = htmlFiles.filter((file) => !file.includes(`${path.sep}artifacts${path.sep}`));
if (generatedPages.length !== 78) throw new Error(`Expected 78 generated pages, found ${generatedPages.length}`);
console.log(`Static link check passed across ${generatedPages.length} generated pages and ${htmlFiles.length - generatedPages.length} HTML artifacts.`);

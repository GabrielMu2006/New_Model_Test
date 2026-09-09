import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(siteRoot, 'dist');
const catalog = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/catalog.json'), 'utf8'));
const locales = ['zh', 'en'];

const htmlFiles = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
  if (entry.isDirectory()) walk(path.join(dir, entry.name));
  else if (entry.name.endsWith('.html')) htmlFiles.push(path.join(dir, entry.name));
});
walk(root);

// ---- 内部链接检查 ----
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

// ---- 页面数量由实体推导（不再写死） ----
const generatedPages = htmlFiles.filter((file) => !file.includes(`${path.sep}artifacts${path.sep}`));
const fixedPerLocale = 6; // '', phases/, models/, tasks/, compare/, methodology/
const expectedPages = 2 // 根路径跳转页 + 404
  + locales.length * (fixedPerLocale + catalog.phases.length + catalog.models.length + catalog.tasks.length + catalog.runs.length);
if (generatedPages.length !== expectedPages) {
  throw new Error(`Expected ${expectedPages} generated pages from entities, found ${generatedPages.length}`);
}

// ---- 首批档案回归：DeepSeek 的 15 个运行页必须仍然存在 ----
const phase1RunPages = catalog.runs
  .filter((run) => run.modelId === 'deepseek-v4-1-flash-exp-0910')
  .flatMap((run) => locales.map((locale) => path.join(root, locale, 'runs', run.id, 'index.html')));
const missingPhase1 = phase1RunPages.filter((file) => !fs.existsSync(file));
if (missingPhase1.length) throw new Error(`Phase 1 regression: missing run pages ${missingPhase1.slice(0, 5).join(', ')}`);

console.log(
  `Static link check passed across ${generatedPages.length} generated pages (expected ${expectedPages}) `
  + `and ${htmlFiles.length - generatedPages.length} HTML artifacts.`,
);

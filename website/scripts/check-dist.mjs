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

// ---- 档案回归：按阶段收敛，断言已归档运行的页面必须仍然存在 ----
const phaseById = new Map(catalog.phases.map((phase) => [phase.id, phase]));
const phaseOfRun = (run) => catalog.tasks.find((task) => task.id === run.taskId)?.phaseId;
const regressionPhases = ['phase-01', 'phase-02'];
for (const phaseId of regressionPhases) {
  if (!phaseById.has(phaseId)) throw new Error(`Regression: phase ${phaseId} disappeared from the catalog`);
  const runs = catalog.runs.filter((run) => phaseOfRun(run) === phaseId);
  if (runs.length === 0) throw new Error(`Regression: no runs left for phase ${phaseId}`);
  const pages = runs.flatMap((run) => locales.map((locale) => path.join(root, locale, 'runs', run.id, 'index.html')));
  const missing = pages.filter((file) => !fs.existsSync(file));
  if (missing.length) throw new Error(`Regression: missing run pages for ${phaseId}: ${missing.slice(0, 5).join(', ')}`);
}
// 已归档运行的成果入口必须随构建发布
const artifactRoot = path.join(siteRoot, 'public/artifacts');
for (const phaseId of regressionPhases) {
  for (const run of catalog.runs.filter((item) => phaseOfRun(item) === phaseId)) {
    for (const file of run.artifact.files) {
      const published = path.join(artifactRoot, run.id, file);
      if (!fs.existsSync(published)) throw new Error(`Missing published artifact ${run.id}/${file}`);
    }
  }
}

console.log(
  `Static link check passed across ${generatedPages.length} generated pages (expected ${expectedPages}) `
  + `and ${htmlFiles.length - generatedPages.length} HTML artifacts.`,
);

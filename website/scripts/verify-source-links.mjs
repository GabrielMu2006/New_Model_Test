// 发布前校验：dist 里每个 GitHub 源码链接都必须在**它所固定的那个提交**里真实存在。
//
// 为什么需要它：归档是分批入库的，同一阶段的运行、评价、证据可能落在不同提交；
// 只要某处沿用了「整阶段一个提交」或「该模型第一条运行的提交」，就会生成一个
// 页面正常、点开 404 的链接。站内链接检查与 validate:data 都查不出这种错误
// （前者的目标在站点之外，后者只检查当前工作区里文件是否存在）。
// 要求：仓库需有完整历史（CI 用 actions/checkout 的 fetch-depth: 0）。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteRoot, '..');
const distRoot = path.join(siteRoot, 'dist');
const repository = 'https://github.com/GabrielMu2006/VibeTest';

const git = (args, options = {}) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: options.capture === false ? 'pipe' : ['ignore', 'pipe', 'pipe'], ...options });

const shallow = (() => {
  try { return git(['rev-parse', '--is-shallow-repository']).trim() === 'true'; } catch { return null; }
})();
if (shallow === null) {
  console.error('Source link check skipped: not a git checkout (no history to verify against).');
  process.exit(0);
}
if (shallow) {
  throw new Error('Source link check needs the full git history (shallow clone detected); use "git fetch --unshallow" or actions/checkout with fetch-depth: 0.');
}

const htmlFiles = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
  if (entry.isDirectory()) walk(path.join(dir, entry.name));
  else if (entry.name.endsWith('.html')) htmlFiles.push(path.join(dir, entry.name));
});
walk(distRoot);

const existsCache = new Map();
const objectExists = (commit, filePath) => {
  const key = `${commit}:${filePath}`;
  if (!existsCache.has(key)) {
    try { git(['cat-file', '-e', key]); existsCache.set(key, true); } catch { existsCache.set(key, false); }
  }
  return existsCache.get(key);
};

const broken = new Map();
let total = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(new RegExp(`href="${repository}/blob/([^"#]+)`, 'g'))) {
    total += 1;
    const [commit, ...rest] = match[1].split('/');
    const filePath = decodeURI(rest.join('/'));
    if (!/^[0-9a-f]{40}$/.test(commit) || objectExists(commit, filePath)) continue;
    const key = `${commit.slice(0, 7)} ${filePath}`;
    const entry = broken.get(key) ?? { count: 0, pages: new Set() };
    entry.count += 1;
    entry.pages.add(path.relative(distRoot, file));
    broken.set(key, entry);
  }
}

if (broken.size) {
  const lines = [...broken.entries()].sort((a, b) => b[1].count - a[1].count)
    .map(([key, entry]) => `  ${key}\n    ${entry.count}x, e.g. ${[...entry.pages][0]}`);
  throw new Error(`Source links point at commits where the file does not exist (${broken.size} distinct target(s)):\n${lines.join('\n')}`);
}

console.log(`Source link check passed: ${total} pinned GitHub blob links in ${htmlFiles.length} HTML files all exist at their commit.`);

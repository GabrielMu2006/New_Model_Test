// 为缺少截图的 HTML 成果生成封面（手动运行，不进入 CI 构建链）。
//
// 为什么可以执行成果 HTML：展示站本身就以 iframe 沙箱预览这些成果，e2e 也会加载它们；
// 本脚本只是把同样的加载结果截成静态图，用于卡片与预览占位。
// 运行：先 `npm run build`，再 `node scripts/capture-covers.mjs`（需要 Playwright 浏览器）。

import { chromium } from 'playwright';
import { preview } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/catalog.json'), 'utf8'));
const outputDir = path.join(siteRoot, 'public/covers');
fs.mkdirSync(outputDir, { recursive: true });

const targets = catalog.runs.filter((run) => run.artifact.type === 'html' && !run.artifact.cover);
if (!targets.length) {
  console.log('No HTML runs without a cover; nothing to capture.');
  process.exit(0);
}

const server = await preview({ root: siteRoot, server: { host: '127.0.0.1', port: 0, open: false } });
const base = `http://127.0.0.1:${server.port}`;
const browser = await chromium.launch({ headless: true });
let captured = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  for (const run of targets) {
    const file = path.join(outputDir, `${run.id}.png`);
    if (fs.existsSync(file)) continue;
    const url = `${base}/artifacts/${run.id}/${run.artifact.entry}`;
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(1200); // 等首屏绘制/字体/动画稳定
      await page.screenshot({ path: file });
      captured += 1;
      console.log(`  captured ${run.id}`);
    } catch (error) {
      console.warn(`  skipped ${run.id}: ${error.message.split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
  await server.stop();
}
console.log(`Captured ${captured} of ${targets.length} covers into website/public/covers/.`);

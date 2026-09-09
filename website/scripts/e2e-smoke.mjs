import { chromium, firefox, webkit } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const base = 'http://127.0.0.1:4322';
spawnSync('./node_modules/.bin/astro', ['preview', '--host', '127.0.0.1', '--port', '4322'], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${base}/zh/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
try {
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({ headless: true }); const page = await browser.newPage(); const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text())); page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/zh/tasks/`); await page.getByPlaceholder('搜索任务标题或 Prompt').fill('calculator');
    if (await page.locator('[data-task-card]:visible').count() !== 1) throw new Error(`${name}: search failed`);
    await page.goto(`${base}/en/tasks/task-06/`); if (!(await page.locator('h1').textContent())?.includes('Scissors')) throw new Error(`${name}: English route failed`);
    await page.goto(`${base}/zh/compare/?task=task-06&left=run-deepseek-v4-1-flash-exp-0910-task-06-r1`); if (await page.locator('[data-left-panel] img').count() !== 1) throw new Error(`${name}: compare restore failed`);
    await page.goto(`${base}/zh/tasks/task-08/`); await page.getByRole('button', { name: /加载交互预览/ }).click(); if (await page.locator('.preview-stage iframe').count() !== 1) throw new Error(`${name}: lazy preview failed`);
    for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/zh/`); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${name}: horizontal overflow at ${width}`); }
    if (errors.length) throw new Error(`${name}: console errors: ${errors.join('; ')}`); await browser.close();
  }
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${base}/artifacts/run-deepseek-v4-1-flash-exp-0910-task-08-r1/index.html`); await page.getByText('开始游戏', { exact: true }).click(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
  await page.goto(`${base}/artifacts/run-deepseek-v4-1-flash-exp-0910-task-10-r1/index.html`); const download = page.waitForEvent('download'); await page.getByText('导出 PNG', { exact: true }).click(); await download; await browser.close();
  for (const run of catalog.runs) { const url = `${base}/artifacts/${run.id}/${run.artifact.entry}`; const response = await fetch(url); if (!response.ok) throw new Error(`Artifact failed: ${url}`); }
  console.log('Browser flows passed in Chromium, Firefox, and WebKit; all 15 artifact entries loaded.');
} finally { spawnSync('./node_modules/.bin/astro', ['preview', 'stop'], { stdio: 'ignore' }); }

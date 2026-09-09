import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'astro';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
const base = `http://127.0.0.1:${server.port}`;
const browsers = [];
const deepseekRuns = catalog.runs.filter((run) => run.modelId === 'deepseek-v4-1-flash-exp-0910');
const museRuns = catalog.runs.filter((run) => run.modelId === 'muse-spark-1-3');
try {
  if (!(await fetch(`${base}/zh/`, { signal: AbortSignal.timeout(10000) })).ok) throw new Error('Preview failed to serve the build.');
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({ headless: true }); const page = await browser.newPage(); const errors = [];
    browsers.push(browser); page.setDefaultTimeout(15000);
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text())); page.on('pageerror', (error) => errors.push(error.message));

    // 任务列表：搜索命中两个模型的同题运行，模型筛选收敛到一条
    await page.goto(`${base}/zh/tasks/`);
    await page.getByPlaceholder('搜索任务标题、Prompt 或模型').fill('calculator');
    if (await page.locator('[data-task-card]:visible').count() !== 2) throw new Error(`${name}: search did not return both models`);
    await page.locator('select[data-model]').selectOption('muse-spark-1-3');
    if (await page.locator('[data-task-card]:visible').count() !== 1) throw new Error(`${name}: model filter failed`);

    // 英文详情直达 + 双语验收建议
    await page.goto(`${base}/en/tasks/task-06/`); if (!(await page.locator('h1').textContent())?.includes('Scissors')) throw new Error(`${name}: English route failed`);
    if (await page.locator('.prose-card ul li').count() < 4) throw new Error(`${name}: English verification list missing`);

    // 同题对比：DeepSeek 与 Muse 两条运行
    await page.goto(`${base}/zh/compare/?task=task-06&left=run-deepseek-v4-1-flash-exp-0910-task-06-r1&right=run-muse-spark-1-3-task-06-r1`);
    if (await page.locator('[data-left-panel] img').count() !== 1) throw new Error(`${name}: compare left panel failed`);
    if (await page.locator('[data-right-panel] img').count() !== 1) throw new Error(`${name}: compare right panel failed`);

    // 懒加载预览
    await page.goto(`${base}/zh/tasks/task-08/`); await page.getByRole('button', { name: /加载交互预览/ }).first().click(); if (await page.locator('.preview-stage iframe').count() !== 1) throw new Error(`${name}: lazy preview failed`);

    // Muse 运行页：两条评价 + 隔离/污染标注 + 逐字输入标注
    await page.goto(`${base}/zh/runs/run-muse-spark-1-3-task-06-r1/`);
    if (await page.locator('.review-card').count() !== 2) throw new Error(`${name}: Muse run page did not render two reviews`);
    const runText = await page.locator('.detail-page').textContent();
    if (!runText?.includes('workspace-only')) throw new Error(`${name}: isolation level missing`);
    if (!runText?.includes('事后补录')) throw new Error(`${name}: prompt provenance missing`);
    // 评价正文按 Markdown 渲染，且原始 HTML 必须被转义
    const aiCard = page.locator('.review-card.ai').first();
    if (await aiCard.locator('ul li').count() < 1) throw new Error(`${name}: AI review markdown list not rendered`);
    if (await aiCard.locator('code').count() < 1) throw new Error(`${name}: AI review inline code not rendered`);
    const aiHtml = await aiCard.innerHTML();
    if (aiHtml.includes('<title>') || aiHtml.includes('<desc>')) throw new Error(`${name}: raw HTML not escaped in review body`);

    for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/zh/`); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${name}: horizontal overflow at ${width}`); }
    if (errors.length) throw new Error(`${name}: console errors: ${errors.join('; ')}`); await browser.close();
  }

  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ acceptDownloads: true });
  browsers.push(browser); page.setDefaultTimeout(15000);
  await page.goto(`${base}/artifacts/run-deepseek-v4-1-flash-exp-0910-task-08-r1/index.html`); await page.getByText('开始游戏', { exact: true }).click(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
  await page.goto(`${base}/artifacts/run-deepseek-v4-1-flash-exp-0910-task-10-r1/index.html`); const download = page.waitForEvent('download'); await page.getByText('导出 PNG', { exact: true }).click(); await download;
  // Muse 计算器是 ES module：经 HTTP 服务时应可用（file:// 打开不可用，见 Reviews/复核说明-交付方式.md）
  await page.goto(`${base}/artifacts/run-muse-spark-1-3-task-12-r1/index.html`);
  for (const selector of ['[data-digit="1"]', '[data-op="+"]', '[data-digit="2"]', '[data-action="equals"]']) await page.locator(selector).first().click();
  if ((await page.locator('#display').first().textContent())?.trim() !== '3') throw new Error('Muse calculator did not compute over HTTP');
  await browser.close();

  for (const run of catalog.runs) { const url = `${base}/artifacts/${run.id}/${run.artifact.entry}`; const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`Artifact failed: ${url}`); }
  console.log(`Browser flows passed in Chromium, Firefox, and WebKit; all ${catalog.runs.length} artifact entries loaded (${deepseekRuns.length} DeepSeek + ${museRuns.length} Muse).`);
} finally {
  await Promise.allSettled(browsers.map((browser) => browser.close()));
  await server.stop();
}

import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'astro';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, open: false } });
const base = `http://127.0.0.1:${server.port}`;
const browsers = [];
// 本机沙箱下 Firefox 会 _crashed_（既有环境限制，见 docs/verification.md）；
// 可用 E2E_BROWSERS=chromium,webkit 只跑可用的浏览器，默认仍是三浏览器全套。
const launchers = { chromium, firefox, webkit };
const selected = (process.env.E2E_BROWSERS ?? 'chromium,firefox,webkit').split(',').map((item) => item.trim()).filter(Boolean);
for (const name of selected) if (!launchers[name]) throw new Error(`Unknown browser in E2E_BROWSERS: ${name}`);
const deepseekRuns = catalog.runs.filter((run) => run.modelId === 'deepseek-v4-1-flash-exp-0910');
const museRuns = catalog.runs.filter((run) => run.modelId === 'muse-spark-1-3');
try {
  if (!(await fetch(`${base}/zh/`, { signal: AbortSignal.timeout(10000) })).ok) throw new Error('Preview failed to serve the build.');
  for (const name of selected) { const launcher = launchers[name];
    // 浏览器起不来时要给出可执行的说明，而不是把 Playwright 的原始报错直接抛出去。
    let browser; let page;
    try {
      browser = await launcher.launch({ headless: true });
      page = await browser.newPage();
    } catch (error) {
      throw new Error(`${name} could not start in this environment (${error.message.split('\n')[0]}). `
        + 'Firefox is known to crash here (see docs/verification.md); run E2E_BROWSERS=chromium,webkit locally and let CI cover the full set.');
    }
    const errors = [];
    browsers.push(browser); page.setDefaultTimeout(15000);
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text())); page.on('pageerror', (error) => errors.push(error.message));

    // 任务列表：搜索命中两个模型的同题运行，模型筛选收敛到一条
    await page.goto(`${base}/zh/tasks/`);
    await page.getByPlaceholder('搜索任务标题、Prompt 或模型').fill('calculator');
    const expectedCards = new Set(catalog.runs.filter((run) => run.taskId === 'task-12').map((run) => run.modelId)).size;
    if (await page.locator('[data-task-card]:visible').count() !== expectedCards) throw new Error(`${name}: search did not return every model's run for task-12`);
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
    if (await page.locator('.review-card').count() !== 3) throw new Error(`${name}: Muse run page did not render human + two AI reviews`);
    const runText = await page.locator('.detail-page').textContent();
    if (!runText?.includes('workspace-only')) throw new Error(`${name}: isolation level missing`);
    if (!runText?.includes('事后补录')) throw new Error(`${name}: prompt provenance missing`);
    // 评价正文按 Markdown 渲染，且原始 HTML 必须被转义（维护 agent v1 的正文含列表与行内代码）
    const aiCard = page.locator('.review-card.ai').filter({ hasText: '维护 agent' }).first();
    if (await aiCard.locator('ul li').count() < 1) throw new Error(`${name}: AI review markdown list not rendered`);
    if (await aiCard.locator('code').count() < 1) throw new Error(`${name}: AI review inline code not rendered`);
    const aiHtml = await aiCard.innerHTML();
    if (aiHtml.includes('<title>') || aiHtml.includes('<desc>')) throw new Error(`${name}: raw HTML not escaped in review body`);

    // GPT-5.6 Sol：与第一阶段同题、单份 AI 评价；三模型同题可并排对比
    await page.goto(`${base}/zh/runs/run-gpt-5-6-sol-task-01-r1/`);
    const gptText = await page.locator('.detail-page').textContent();
    if (!gptText?.includes('90/100')) throw new Error(`${name}: GPT run page missing its review score`);
    if (!gptText?.includes('gpt-5.6-sol')) throw new Error(`${name}: GPT run page missing the harness-reported snapshot id`);
    if (await page.locator('.review-card').count() !== 1) throw new Error(`${name}: GPT run page must show exactly one review`);

    // 模型身份：一个模型两个快照 + 两个批次都在模型页列出（不能只显示第一个批次）
    await page.goto(`${base}/zh/models/deepseek-v4-1-flash-exp-0910/`);
    const modelPage = page.locator('section.page-block').first();
    const modelText = await modelPage.textContent();
    for (const expected of ['0910 实验版（即将退役）', '正式版（尚未运行）', 'Phase 2（Task 16–20，部分）']) {
      if (!modelText?.includes(expected)) throw new Error(`${name}: model page missing "${expected}"`);
    }
    if (await modelPage.locator('.metric-grid').count() !== 2) throw new Error(`${name}: model page must show both batches`);
    // 运行详情必须写明本次实际使用的快照
    await page.goto(`${base}/en/runs/run-deepseek-v4-1-flash-exp-0910-task-16-r1/`);
    if (!(await page.locator('.detail-page').textContent())?.includes('deepseek-v4.1-flash-expires-on-0910')) throw new Error(`${name}: run page missing the harness-reported snapshot id`);

    // 运行页里的 GitHub 源链接必须绑定该运行自己的归档提交（历史上曾回落到第一阶段提交而 404）
    await page.goto(`${base}/zh/runs/run-muse-spark-1-3-xhigh-task-20-r1/`);
    const archiveCommit = catalog.runs.find((run) => run.id === 'run-muse-spark-1-3-xhigh-task-20-r1').artifact.commit;
    for (const href of await page.locator('.preview-links a, .source-card a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))) {
      if (!href.includes('/blob/')) continue;
      if (!href.includes(archiveCommit)) throw new Error(`${name}: source link pinned to a foreign commit: ${href.slice(0, 120)}`);
    }

    // Muse 第二阶段：每题 1 份 AI 评价（本批尚无人工评价），且同题可与 DeepSeek 并排对比
    await page.goto(`${base}/zh/runs/run-muse-spark-1-3-xhigh-task-16-r1/`);
    if (await page.locator('.review-card').count() !== 1) throw new Error(`${name}: Muse phase-02 run page must show exactly one archived review`);
    if (!(await page.locator('.review-card').textContent())?.includes('85/100')) throw new Error(`${name}: Muse phase-02 review score missing`);
    await page.goto(`${base}/zh/compare/?task=task-16&left=run-deepseek-v4-1-flash-exp-0910-task-16-r1&right=run-muse-spark-1-3-xhigh-task-16-r1`);
    if (await page.locator('[data-left-panel] img').count() !== 1) throw new Error(`${name}: cross-model compare left panel failed`);
    if (await page.locator('[data-right-panel] img').count() !== 1) throw new Error(`${name}: cross-model compare right panel failed`);

    // 第二阶段（Task 16–20）：阶段页、越界标注、审查证据、补充轮逐字输入与「暂无评价」说明
    await page.goto(`${base}/zh/phases/phase-02/`);
    if (await page.locator('.run-tile').count() !== 5) throw new Error(`${name}: phase-02 page did not list the 5 archived tasks`);
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/`);
    const phase2Text = await page.locator('.detail-page').textContent();
    for (const expected of ['策略级（workspace-only）', '存在越界尝试，未取得内容 · 不影响成绩', '不要再读取chrome钥匙串了']) {
      if (!phase2Text?.includes(expected)) throw new Error(`${name}: phase-02 run page missing "${expected}"`);
    }
    // 该运行现在挂着 Muse Spark 1.3 拆出的逐题评价
    if (!phase2Text?.includes('94/100')) throw new Error(`${name}: phase-02 run page missing the muse-spark-v1 score`);
    if (await page.locator('.review-card').count() !== 1) throw new Error(`${name}: phase-02 run page must show exactly one review`);
    const auditHref = await page.locator('a[href*="task-17-mechanical-watch-movement/evidence/audit"]').first().getAttribute('href');
    if (!auditHref?.includes('/blob/9281576')) throw new Error(`${name}: audit evidence link is not bound to the archive commit`);
    // SVG 成果作为预览发布，且入口可用
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-16-r1/`);
    if (await page.locator('img[src$="pelican-bicycle.svg"]').count() !== 1) throw new Error(`${name}: phase-02 SVG artifact missing`);
    // 第二阶段 HTML 成果：懒加载预览
    await page.goto(`${base}/zh/tasks/task-19/`);
    await page.getByRole('button', { name: /加载交互预览/ }).first().click();
    if (await page.locator('.preview-stage iframe').count() !== 1) throw new Error(`${name}: phase-02 lazy preview failed`);

    for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/zh/`); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${name}: horizontal overflow at ${width}`); }

    // 语言切换：实体深链直达 + 对比页保留查询参数
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/zh/tasks/task-06/`);
    await page.locator('[data-language-switch]').click();
    if (!page.url().includes('/en/tasks/task-06/')) throw new Error(`${name}: language switch lost the entity path (${page.url()})`);
    if (!(await page.locator('h1').textContent())?.includes('Scissors')) throw new Error(`${name}: switched page is not the English task page`);
    await page.goto(`${base}/zh/compare/?task=task-16&left=run-deepseek-v4-1-flash-exp-0910-task-16-r1&right=run-muse-spark-1-3-xhigh-task-16-r1`);
    const switchHref = await page.locator('[data-language-switch]').getAttribute('href');
    if (!switchHref?.includes('task=task-16') || !switchHref.includes('right=run-muse-spark-1-3-xhigh-task-16-r1')) throw new Error(`${name}: language switch dropped the compare query (${switchHref})`);
    await page.locator('[data-language-switch]').click();
    if (await page.locator('[data-left-panel] img, [data-left-panel] iframe').count() !== 1) throw new Error(`${name}: compare selection not restored after switching language`);
    if (await page.locator('[data-right-panel] img, [data-right-panel] iframe').count() !== 1) throw new Error(`${name}: right compare selection not restored after switching language`);
    // 直接刷新必须恢复同一次对比
    await page.reload();
    if (await page.locator('[data-left-panel] img, [data-left-panel] iframe').count() !== 1) throw new Error(`${name}: compare left panel lost after refresh`);
    if (await page.locator('[data-right-panel] img, [data-right-panel] iframe').count() !== 1) throw new Error(`${name}: compare right panel lost after refresh`);

    // 筛选：按模型名搜索、按任务 ID 搜索、按类别筛选（此前模型名不可搜、下拉选项渲染成 [object Object]）
    await page.goto(`${base}/zh/tasks/`);
    const modelOptionLabels = await page.locator('select[data-model] option').evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    if (modelOptionLabels.some((label) => label.includes('[object'))) throw new Error(`${name}: model filter option rendered a non-string label`);
    await page.getByPlaceholder('搜索任务标题、Prompt 或模型').fill('Muse');
    const visibleModels = await page.locator('[data-task-card]:visible').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.model))]);
    if (visibleModels.join(',') !== 'muse-spark-1-3') throw new Error(`${name}: search by model name returned ${visibleModels.join(',') || 'nothing'}`);
    await page.fill('[data-search]', 'task-16');
    if (await page.locator('[data-task-card]:visible').count() === 0) throw new Error(`${name}: search by task id matched nothing`);
    await page.fill('[data-search]', '');
    await page.selectOption('[data-category]', 'svg-clock');
    const clockCards = catalog.runs.filter((run) => catalog.tasks.find((task) => task.id === run.taskId)?.category === 'svg-clock').length;
    if (await page.locator('[data-task-card]:visible').count() !== clockCards) throw new Error(`${name}: category filter failed`);

    // 未知路径必须落到 404 页面（用独立页面，避免这条预期内的 404 污染控制台断言）
    const notFoundPage = await browser.newPage();
    notFoundPage.setDefaultTimeout(15000);
    const notFound = await notFoundPage.goto(`${base}/zh/runs/run-does-not-exist/`);
    if (notFound.status() !== 404) throw new Error(`${name}: unknown run path returned ${notFound.status()}`);
    if (!(await notFoundPage.locator('h1').textContent())?.includes('未找到页面')) throw new Error(`${name}: 404 page content missing`);
    if (await notFoundPage.locator('a[href$="/zh/"]').count() === 0) throw new Error(`${name}: 404 page has no way back`);
    await notFoundPage.close();

    // 横向溢出：不只首页——对比页与含长源码路径的任务页此前都会溢出
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/zh/tasks/', '/zh/tasks/task-16/', '/en/tasks/task-16/', '/zh/compare/?task=task-16&left=run-deepseek-v4-1-flash-exp-0910-task-16-r1&right=run-muse-spark-1-3-xhigh-task-16-r1', '/zh/models/muse-spark-1-3/', '/en/methodology/']) {
        await page.goto(base + path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (overflow > 1) throw new Error(`${name}: horizontal overflow +${overflow}px at ${width} on ${path}`);
      }
    }

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
  console.log(`Browser flows passed in ${selected.join(', ')}; all ${catalog.runs.length} artifact entries loaded (${deepseekRuns.length} DeepSeek + ${museRuns.length} Muse).`);
} finally {
  await Promise.allSettled(browsers.map((browser) => browser.close()));
  await server.stop();
}

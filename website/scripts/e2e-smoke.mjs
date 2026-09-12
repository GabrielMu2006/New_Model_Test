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
// 覆盖率与 AI 均分都从数据推导，避免把数字写死在断言里。
const archivedTasks = catalog.tasks.filter((task) => catalog.runs.some((run) => run.taskId === task.id)).length;
const plannedTasks = catalog.phases.reduce((sum, phase) => sum + phase.plannedTasks, 0);
const aiAverage = (modelId) => {
  const scores = catalog.assessments.filter((assessment) => assessment.modelId === modelId && assessment.score != null).map((assessment) => assessment.score);
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : null;
};
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

    // 任务档案（规范第 22 节）：每个题目只出现一张作品卡，搜索 + Chip 筛选收敛
    await page.goto(`${base}/zh/tasks/`);
    if (await page.locator('[data-task-card]').count() !== catalog.tasks.length) throw new Error(`${name}: task archive must show exactly one card per task`);
    await page.getByPlaceholder('搜索任务标题、Prompt 或模型').fill('calculator');
    if (await page.locator('[data-task-card]:visible').count() !== 1) throw new Error(`${name}: searching "calculator" must leave one task card`);
    const museTasks = catalog.tasks.filter((task) => catalog.runs.some((run) => run.taskId === task.id && run.modelId === 'muse-spark-1-3')).length;
    await page.fill('[data-search]', '');
    await page.locator('[data-filter-model="muse-spark-1-3"]').click();
    if (await page.locator('[data-task-card]:visible').count() !== museTasks) throw new Error(`${name}: model chip filter failed`);
    if (await page.locator('[data-filter-model][aria-pressed="true"]').count() !== 1) throw new Error(`${name}: chip group must keep exactly one selection`);
    await page.locator('[data-filter-model=""]').click();
    // 类型 Chip：收敛到该类型下的任务数（从数据推导）
    const svgTasks = catalog.tasks.filter((task) => {
      const run = catalog.runs.find((item) => item.taskId === task.id);
      return run && run.artifact.type === 'svg';
    }).length;
    await page.locator('[data-filter-type="svg"]').click();
    if (await page.locator('[data-task-card]:visible').count() !== svgTasks) throw new Error(`${name}: type chip filter failed`);
    await page.locator('[data-filter-type=""]').click();
    // 阶段 Chip
    const phase2Tasks = catalog.tasks.filter((task) => task.phaseId === 'phase-02').length;
    await page.locator('[data-filter-phase="phase-02"]').click();
    if (await page.locator('[data-task-card]:visible').count() !== phase2Tasks) throw new Error(`${name}: phase chip filter failed`);
    await page.locator('[data-filter-phase=""]').click();

    // 命令面板（规范第 47、48 节）：页头搜索打开、按关键词过滤、Esc 关闭
    await page.locator('[data-palette-open]').click();
    await page.locator('[data-palette-input]').fill('aevum');
    if (await page.locator('[data-palette-item]').count() < 2) throw new Error(`${name}: command palette did not return task + run hits`);
    const paletteKinds = await page.locator('[data-palette-item] i').allTextContents();
    if (!paletteKinds.includes('任务') || !paletteKinds.includes('运行')) throw new Error(`${name}: command palette groups are missing`);
    await page.keyboard.press('Escape');
    if (await page.locator('[data-palette]').isVisible()) throw new Error(`${name}: Escape must close the command palette`);
    await page.keyboard.press('/');
    if (!(await page.locator('[data-palette]').isVisible())) throw new Error(`${name}: "/" must open the command palette`);
    await page.keyboard.press('Escape');

    // 首页：品牌主标题 + 数字条 + 档案进度 + 精选作品展墙
    await page.goto(`${base}/zh/`);
    if ((await page.locator('.hero h1').textContent())?.trim() !== 'VibeTest') throw new Error(`${name}: hero h1 must be the brand name`);
    const statText = await page.locator('.stats').textContent();
    for (const expected of [String(catalog.models.length), String(catalog.phases.length), String(catalog.runs.length), `${archivedTasks} / ${plannedTasks}`]) {
      if (!statText?.includes(expected)) throw new Error(`${name}: home stats missing ${expected}`);
    }
    if (await page.locator('.stats > div').count() !== 4) throw new Error(`${name}: home stats strip must have four figures`);
    if ((await page.locator('.gallery--wall .artwork-card').count()) !== 4) throw new Error(`${name}: featured wall must show four works`);
    const progressLabel = await page.locator('.signal-card > i').getAttribute('aria-label');
    if (!progressLabel?.includes(`${archivedTasks} / ${plannedTasks}`)) throw new Error(`${name}: archive progress bar is missing its accessible label`);

    // 任务详情：三种解释等宽 + 未归档模型占位（规范第 24、67 节）
    await page.goto(`${base}/zh/tasks/task-16/`);
    if (await page.locator('.interpretation').count() !== catalog.models.length) throw new Error(`${name}: task page must render one interpretation per model`);
    if (await page.locator('.interpretation .interpretation-missing').count() < 1) throw new Error(`${name}: a model without a run must show the "not archived yet" panel, not a zero`);
    const widths = await page.locator('.interpretation').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
    if (new Set(widths).size !== 1) throw new Error(`${name}: interpretations must have equal width (${widths.join('/')})`);
    const missingText = (await page.locator('.interpretation-missing').first().textContent()) ?? '';
    if (missingText.includes('N/A') || missingText.includes('0/100') || missingText.includes('未记录')) throw new Error(`${name}: missing interpretation must say "not archived yet" instead of N/A, 0 or a placeholder metric`);
    // 「展开完整需求」
    const promptToggle = page.locator('[data-prompt-toggle]');
    await promptToggle.click();
    if ((await promptToggle.getAttribute('aria-expanded')) !== 'true') throw new Error(`${name}: show-full-prompt toggle failed`);

    // 运行档案：档案记录、技术记录折叠、右侧本节导航
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/`);
    const recordText = await page.locator('#record').textContent();
    for (const expected of ['RUN ID', '归档提交', 'run-deepseek-v4-1-flash-exp-0910-task-01-r1']) {
      if (!recordText?.includes(expected)) throw new Error(`${name}: archive record missing ${expected}`);
    }
    // 第一阶段没有 startedAt/endedAt：归档时间必须显示「未记录」，不能猜
    if (!recordText?.includes('未记录')) throw new Error(`${name}: unknown archive date must render as 未记录`);
    const tech = page.locator('.tech-record');
    if (await tech.getAttribute('open') !== null) throw new Error(`${name}: technical record must start collapsed`);
    await tech.locator('summary').click();
    if (await tech.locator('.config-line').count() < 3) throw new Error(`${name}: technical record did not expand`);
    if (await page.locator('.rail-nav a[href="#human"]').count() !== 1) throw new Error(`${name}: run rail must link to the human review section`);
    if (await page.locator('#ai .review-card.ai').count() < 1) throw new Error(`${name}: AI review section missing`);
    if (await page.locator('.evidence-list a').count() < 3) throw new Error(`${name}: source evidence list missing`);

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
    await page.goto(`${base}/zh/models/gpt-5-6-sol/`);
    const gptModelText = await page.locator('section.page-block').first().textContent();
    if (!gptModelText?.includes('maintenance-agent-v3')) throw new Error(`${name}: GPT model page missing the phase assessment`);
    if (!gptModelText?.includes('82.9')) throw new Error(`${name}: GPT model page missing the review average`);

    // K3：第四模型、同题、单份 AI 评价（maintenance-agent-v4），模型页显示该阶段评估
    await page.goto(`${base}/zh/runs/run-k3-task-01-r1/`);
    const k3Text = await page.locator('.detail-page').textContent();
    if (!k3Text?.includes('98/100')) throw new Error(`${name}: K3 run page missing its review score`);
    if (!k3Text?.includes('维护 agent v4')) throw new Error(`${name}: K3 run page missing the review author`);
    if (await page.locator('.review-card').count() !== 1) throw new Error(`${name}: K3 run page must show exactly one review`);
    await page.goto(`${base}/zh/models/k3/`);
    const k3ModelText = await page.locator('section.page-block').first().textContent();
    if (!k3ModelText?.includes('maintenance-agent-v4')) throw new Error(`${name}: K3 model page missing the phase assessment`);
    if (!k3ModelText?.includes('93.3')) throw new Error(`${name}: K3 model page missing the review average`);

    // 模型身份：一个模型两个快照 + 两个批次都在模型页列出（不能只显示第一个批次）
    await page.goto(`${base}/zh/models/deepseek-v4-1-flash-exp-0910/`);
    const modelPage = page.locator('section.page-block').first();
    const modelText = await modelPage.textContent();
    for (const expected of ['0910 实验版（即将退役）', '正式版（尚未运行）', 'Phase 2（Task 16–20，部分）']) {
      if (!modelText?.includes(expected)) throw new Error(`${name}: model page missing "${expected}"`);
    }
    const deepseekBatches = catalog.batches.filter((batch) => batch.modelId === 'deepseek-v4-1-flash-exp-0910').length;
    if (await modelPage.locator('.metric-grid').count() !== deepseekBatches) throw new Error(`${name}: model page must show every batch's metrics (${deepseekBatches})`);
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
    for (const expected of ['策略级（workspace-only）', '不要再读取chrome钥匙串了']) {
      if (!phase2Text?.includes(expected)) throw new Error(`${name}: phase-02 run page missing "${expected}"`);
    }
    // 2026-09-10 组织者决定：越界尝试只记入审计档案，运行页的「越界判定」行不得出现。
    // 注意：评价正文里出现该状态属于归档原文（逐字保留），不在断言范围内，因此按配置行判定而不是全文搜词。
    for (const [path, label] of [
      ['/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/', '越界判定'],
      ['/en/runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/', 'Boundary check'],
    ]) {
      await page.goto(base + path);
      if (await page.locator('.config-line').filter({ hasText: label }).count() !== 0) {
        throw new Error(`${name}: ${path} must not annotate a boundary attempt`);
      }
    }
    const suspectedRun = catalog.runs.find((run) => run.id === 'run-deepseek-v4-1-flash-exp-0910-task-17-r1');
    if (suspectedRun.contamination.status !== 'suspected') throw new Error(`${name}: the archive must still record the boundary attempt`);
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/`);
    // 该运行现在挂着 Muse Spark 1.3 拆出的逐题评价
    if (!phase2Text?.includes('94/100')) throw new Error(`${name}: phase-02 run page missing the muse-spark-v1 score`);
    if (await page.locator('.review-card').count() !== 1) throw new Error(`${name}: phase-02 run page must show exactly one review`);
    const auditHref = await page.locator('a[href*="task-17-mechanical-watch-movement/evidence/audit"]').first().getAttribute('href');
    if (!auditHref?.includes('/blob/9281576')) throw new Error(`${name}: audit evidence link is not bound to the archive commit`);
    // SVG 成果作为预览发布，且入口可用
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-16-r1/`);
    // 预览舞台里必须挂上归档的 SVG 成果本身（右侧作品缩略图也会引用同一文件，因此按舞台限定）
    if (await page.locator('.preview-stage img[src$="pelican-bicycle.svg"]').count() !== 1) throw new Error(`${name}: phase-02 SVG artifact missing from the preview stage`);
    // 第二阶段 HTML 成果：懒加载预览
    await page.goto(`${base}/zh/tasks/task-19/`);
    await page.getByRole('button', { name: /加载交互预览/ }).first().click();
    if (await page.locator('.preview-stage iframe').count() !== 1) throw new Error(`${name}: phase-02 lazy preview failed`);

    for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/zh/`); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${name}: horizontal overflow at ${width}`); }

    // 移动端（规范第 63、64、65 节）：精选作品横向展墙、三种解释改为 Tab、作品排在档案之前
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${base}/zh/`);
    const wallScroll = await page.locator('.gallery--wall').evaluate((node) => node.scrollWidth - node.clientWidth);
    if (wallScroll <= 0) throw new Error(`${name}: mobile featured works must scroll horizontally`);
    await page.goto(`${base}/zh/tasks/task-01/`);
    if ((await page.locator('[data-interpretations]').getAttribute('data-tabs-ready')) !== 'true') throw new Error(`${name}: mobile interpretations must switch to tabs`);
    if (await page.locator('.interpretation:visible').count() !== 1) throw new Error(`${name}: mobile tabs must show exactly one interpretation`);
    await page.locator('[data-interp-tab]').nth(1).click();
    if (await page.locator('.interpretation:visible').count() !== 1) throw new Error(`${name}: switching interpretation tabs failed`);
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/`);
    const order = await page.evaluate(() => {
      const preview = document.querySelector('#artwork');
      const rail = document.querySelector('.run-rail');
      return preview && rail ? preview.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
    });
    if (!order) throw new Error(`${name}: mobile run page must show the artwork before the archive rail`);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 语言切换：实体深链直达 + 对比页保留查询参数
    // 注意：点击后必须等到导航完成、面板脚本跑完再断言——`count()` 不会自动等待，
    // 否则会变成「谁渲染快谁通过」的竞态（Firefox 首跑就是这样挂的）。
    const comparePanels = (side) => page.locator(`[data-${side}-panel] img, [data-${side}-panel] iframe`).first();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/zh/tasks/task-06/`);
    await Promise.all([page.waitForURL(/\/en\/tasks\/task-06\//), page.locator('[data-language-switch]').click()]);
    if (!(await page.locator('h1').textContent())?.includes('Scissors')) throw new Error(`${name}: switched page is not the English task page`);
    await page.goto(`${base}/zh/compare/?task=task-16&left=run-deepseek-v4-1-flash-exp-0910-task-16-r1&right=run-muse-spark-1-3-xhigh-task-16-r1`);
    const switchHref = await page.locator('[data-language-switch]').getAttribute('href');
    if (!switchHref?.includes('task=task-16') || !switchHref.includes('right=run-muse-spark-1-3-xhigh-task-16-r1')) throw new Error(`${name}: language switch dropped the compare query (${switchHref})`);
    await Promise.all([page.waitForURL(/\/en\/compare\//), page.locator('[data-language-switch]').click()]);
    await comparePanels('left').waitFor({ timeout: 15000 });
    if (await page.locator('[data-left-panel] img, [data-left-panel] iframe').count() !== 1) throw new Error(`${name}: compare selection not restored after switching language`);
    if (await page.locator('[data-right-panel] img, [data-right-panel] iframe').count() !== 1) throw new Error(`${name}: right compare selection not restored after switching language`);
    // 直接刷新必须恢复同一次对比
    await page.reload();
    await comparePanels('left').waitFor({ timeout: 15000 });
    if (await page.locator('[data-left-panel] img, [data-left-panel] iframe').count() !== 1) throw new Error(`${name}: compare left panel lost after refresh`);
    if (await page.locator('[data-right-panel] img, [data-right-panel] iframe').count() !== 1) throw new Error(`${name}: compare right panel lost after refresh`);

    // 筛选：按模型名搜索、按任务 ID 搜索、Chip 筛选（此前模型名不可搜、选项文本渲染成 [object Object]）
    await page.goto(`${base}/zh/tasks/`);
    const chipLabels = await page.locator('[data-filter-model]').allTextContents();
    if (chipLabels.some((label) => label.includes('[object'))) throw new Error(`${name}: model chip rendered a non-string label`);
    // Chip 用紧凑短名（去掉括号补充说明）；完整名称在模型页标题与运行环境里保留
    const shortName = (model) => model.name.zh.replace(/[（(][^）)]*[）)]\s*$/, '').trim() || model.name.zh;
    for (const model of catalog.models) {
      if (!chipLabels.some((label) => label.includes(shortName(model)))) throw new Error(`${name}: model chip missing ${model.id}`);
    }
    await page.getByPlaceholder('搜索任务标题、Prompt 或模型').fill('Muse');
    // 一张卡代表一道题：搜索模型名应命中该模型跑过的全部题目，且每张卡都标注了这个模型
    const museCardCount = await page.locator('[data-task-card]:visible').count();
    if (museCardCount !== museTasks) throw new Error(`${name}: search by model name returned ${museCardCount} tasks, expected ${museTasks}`);
    const visibleModels = await page.locator('[data-task-card]:visible').evaluateAll((nodes) => [...new Set(nodes.flatMap((node) => (node.dataset.models ?? '').split(/\s+/)))]);
    if (!visibleModels.includes('muse-spark-1-3')) throw new Error(`${name}: search by model name did not surface the model (${visibleModels.join(',') || 'nothing'})`);
    await page.fill('[data-search]', 'task-16');
    if (await page.locator('[data-task-card]:visible').count() === 0) throw new Error(`${name}: search by task id matched nothing`);
    await page.fill('[data-search]', '');
    await page.locator('[data-filter-type="svg"]').click();
    const svgArtifacts = catalog.runs.filter((run) => run.artifact.type === 'svg').length;
    const svgLabel = await page.locator('[data-filter-type="svg"]').textContent();
    if (!svgLabel?.includes(String(svgTasks))) throw new Error(`${name}: type chip count does not match the archive (${svgArtifacts} runs, ${svgTasks} tasks)`);
    await page.locator('[data-filter-type=""]').click();

    // 时长写法统一（2026-09-10）：展示一律 `M:SS` / `H:MM:SS`，归档的「4分51秒」不再混入页面
    await page.goto(`${base}/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/`);
    // 运行页的运行时长行标签是「运行时间」；「累计用时」用于会话/批次累计值。
    const durationCell = await page.locator('.metric-grid > div').filter({ hasText: '运行时间' }).locator('strong').first().textContent();
    if (!/^(\d+:\d\d|\d+:\d\d:\d\d)$/.test((durationCell ?? '').trim())) throw new Error(`${name}: run duration must render as M:SS or H:MM:SS, got "${durationCell}"`);
    if (/\d+分\d+秒/.test((await page.locator('.detail-page').textContent()) ?? '')) throw new Error(`${name}: archived duration label leaked into the run page`);

    // 覆盖率、AI 均分与时长格式（都从数据推导）
    await page.goto(`${base}/zh/`);
    const homeText = await page.locator('.signal-card').textContent();
    if (!homeText?.includes(`${archivedTasks} / ${plannedTasks}`)) throw new Error(`${name}: archive coverage card must show ${archivedTasks} / ${plannedTasks}`);
    // 时长写法统一（2026-09-10）：≥1 小时用 H:MM:SS。批次累计时长现在只出现在模型页 / 方法页。
    await page.goto(`${base}/zh/models/deepseek-v4-1-flash-exp-0910/`);
    const batchDurations = (await page.locator('.metric-grid > div').filter({ hasText: '累计用时' }).locator('strong').allTextContents()).map((text) => text.trim());
    if (batchDurations.length === 0) throw new Error(`${name}: batch metric grid has no duration row`);
    if (batchDurations.some((text) => /^\d{3,}:[0-5]\d$/.test(text))) throw new Error(`${name}: batch duration still uses "minutes:seconds" beyond 59 minutes: ${batchDurations.join(' | ')}`);
    if (!batchDurations.some((text) => /^\d+:\d\d:\d\d$/.test(text))) throw new Error(`${name}: long batch duration is not rendered as H:MM:SS: ${batchDurations.join(' | ')}`);
    await page.goto(`${base}/zh/models/`);
    const modelIndex = await page.locator('.model-list').textContent();
    for (const model of catalog.models) {
      const average = aiAverage(model.id);
      if (average == null) { if (!modelIndex?.includes('暂无阶段评估')) throw new Error(`${name}: ${model.id}: missing "no phase assessment" placeholder`); continue; }
      if (!modelIndex?.includes(`AI 均分 ${average}/100`)) throw new Error(`${name}: ${model.id}: model index must show the AI average ${average}`);
    }
    // 每个 AI 评委的逐份评分在模型页并列保留
    await page.goto(`${base}/zh/models/muse-spark-1-3/`);
    const musePage = await page.locator('section.page-block').first().textContent();
    for (const assessment of catalog.assessments.filter((item) => item.modelId === 'muse-spark-1-3')) {
      if (!musePage?.includes(`${assessment.score}/100`)) throw new Error(`${name}: ${assessment.id}: per-reviewer score missing on the model page`);
    }
    if (!musePage?.includes('均分')) throw new Error(`${name}: model page must explain what the average means`);
    // 预览说明在中文页中文优先（双语说明不得回落到英文原文）
    await page.goto(`${base}/zh/runs/run-muse-spark-1-3-task-13-r1/`);
    const noteText = await page.locator('.preview-note').textContent();
    if (!noteText?.includes('Open-Meteo')) throw new Error(`${name}: Chinese preview note missing`);
    if (noteText.includes('falls back to offline demo data')) throw new Error(`${name}: Chinese page fell back to the English preview note`);
    // 阶段页显示「已归档 / 计划」
    const phase2 = catalog.phases.find((phase) => phase.id === 'phase-02');
    await page.goto(`${base}/zh/phases/phase-02/`);
    const phaseText = await page.locator('.timeline').textContent();
    if (!phaseText?.includes(`${phase2.taskVersions.length} / ${phase2.plannedTasks}`)) throw new Error(`${name}: phase page must show archived/planned tasks`);

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
      for (const path of ['/zh/tasks/', '/zh/tasks/task-01/', '/zh/tasks/task-16/', '/en/tasks/task-16/', '/zh/compare/?task=task-16&left=run-deepseek-v4-1-flash-exp-0910-task-16-r1&right=run-muse-spark-1-3-xhigh-task-16-r1', '/zh/models/muse-spark-1-3/', '/zh/phases/phase-02/', '/en/methodology/']) {
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
  const perModel = catalog.models
    .map((model) => `${model.id} ${catalog.runs.filter((run) => run.modelId === model.id).length}`)
    .join(' + ');
  console.log(`Browser flows passed in ${selected.join(', ')}; all ${catalog.runs.length} artifact entries loaded (${perModel}).`);
} finally {
  await Promise.allSettled(browsers.map((browser) => browser.close()));
  await server.stop();
}

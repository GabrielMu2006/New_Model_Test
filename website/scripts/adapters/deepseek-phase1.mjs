// 批次适配器：DeepSeek-V4.1-Flash-Exp-0910 / Phase 1（第一阶段，扁平 task-* 布局）。
// 来源：PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md + 该阶段 Reviews 三份报告。
// 本适配器是历史兼容适配器：解析逻辑保持与首版导入器一致，输出结构改为交给编排器合并。

import path from 'node:path';
import {
  lineRange, subsection, stripFence, bilingualParagraph, bilingualList, durationToSeconds,
} from '../lib/markdown.mjs';

export const id = 'deepseek-v4-1-flash-exp-0910-phase1';

const archiveRoot = 'Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01';
const archiveCommit = '5776d3a1d94dc4b04d83fa94d482e04478fd4076';
const promptPath = 'PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md';
const metricsPath = `${archiveRoot}/Reviews/DeepSeek-V4.1-Flash-Exp-0910-任务评测复盘.md`;
const humanPath = `${archiveRoot}/Reviews/Personal_Review.md`;
const aiPath = `${archiveRoot}/Reviews/15-任务完成质量评估.md`;

const categories = ['website', 'svg-illustration', 'svg-clock', 'svg-clock', 'svg-illustration', 'svg-illustration', 'svg-illustration', 'game', 'game', 'creative-tool', 'productivity-tool', 'utility', 'data-dashboard', 'website', 'productivity-tool'];
const sessionIds = ['89716f93', '0e1e035d', '17e6215c', '17e6215c', '4a0d64ce', '4a0d64ce', '4a0d64ce', '2579bde9', '28e77186', 'da8df324', '2d2be5e2', 'f87c54e3', '31de8e10', '214420b0', 'b25a11c4'];
const continuationTurns = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0];
const folders = [
  'task-01-aevum-luxury-watch-landing-page', 'task-02-pelican-on-bicycle', 'task-03-analog-clock-6-25',
  'task-04-analog-clock-11-52-30', 'task-05-bicycle-rider', 'task-06-scissors-cutting-paper',
  'task-07-pushing-wheelbarrow', 'task-08-breakout-game', 'task-09-topdown-farming-game',
  'task-10-pixel-art-editor', 'task-11-floor-plan-editor', 'task-12-calculator',
  'task-13-weather-dashboard', 'task-14-bank-website', 'task-15-book-tracker',
];
const artifactFiles = [
  ['index.html'], ['pelican-on-bicycle.svg'], ['clock-625.svg'], ['clock-11-52-30.svg'], ['bicycle_rider.svg'],
  ['scissors_cutting_paper.svg'], ['pushing_wheelbarrow.svg'], ['index.html'], ['index.html'], ['index.html'],
  ['index.html', 'app.js', 'geometry.js', 'screenshot.png'],
  ['index.html', 'styles.css', 'app.js', 'calc-engine.js', 'screenshot.png'],
  ['index.html', 'styles.css', 'js/api.js', 'js/app.js', 'js/charts.js', 'js/effects.js', 'js/icons.js', 'js/weather.js', 'screenshot.png'],
  ['index.html', 'personal.html', 'business.html', 'loans.html', 'rates.html', 'security.html', 'help.html', 'login.html', 'open-account.html', 'robots.txt', 'site.webmanifest', 'assets/css/site.css', 'assets/favicon.svg', 'assets/js/site.js', 'assets/js/finance.js', 'assets/js/calculators.js', 'assets/js/forms.js', 'assets/js/rates.js', 'assets/js/login.js', 'assets/js/apply.js'],
  ['index.html', 'styles.css', 'app.js', 'book-engine.js', 'screenshot.png'],
];
const entries = ['index.html', 'pelican-on-bicycle.svg', 'clock-625.svg', 'clock-11-52-30.svg', 'bicycle_rider.svg', 'scissors_cutting_paper.svg', 'pushing_wheelbarrow.svg', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html'];
const humanTranslations = [
  'Overall it fits a premium luxury brand site. Some watch details need work, but the customization feature is impressive and the overall finish is very high.',
  'Basically fine, although this version appears to be static rather than animated.', 'No issues.', 'No issues.',
  'No issues, except there is an unexplained “7” in the image.', 'The scissors and hand both look strange.',
  'It clearly feels like pushing, but the person and cart structures look strange, and the wheel is misplaced.',
  'The core functionality is fully implemented.', 'All functionality is implemented. The UI could improve, but the overall result is good.',
  'The basic functionality is implemented, but there is a bug if the canvas size is not selected on the first use.',
  'The basic functionality is implemented; the UI is unattractive.', 'The functionality is implemented; the UI is unattractive.',
  'The result is very good, but the light theme looks poor. The dark theme is attractive and the functionality is complete.',
  'The core functionality is complete and the UI style is good.', 'The functionality is complete and the UI style is good.',
];

export function load({ read, siteRoot }) {
  const promptsText = read(promptPath);
  const metricsText = read(metricsPath);
  const humanText = read(humanPath);
  const aiText = read(aiPath);

  const taskSections = [...promptsText.matchAll(/^## Task (\d{2}) · (.*?) \/ (.*?)\n([\s\S]*?)(?=^## Task|^## 总体|(?![\s\S]))/gm)];
  if (taskSections.length !== 15) throw new Error(`[deepseek-phase1] expected 15 prompt sections, found ${taskSections.length}`);

  const metricRows = new Map();
  for (const row of metricsText.split('\n').filter((line) => /^\| task-\d{2} \|/.test(line))) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.replaceAll('**', '').trim());
    if (cells.length !== 12) continue;
    const number = (index) => Number(cells[index].replaceAll(',', ''));
    metricRows.set(cells[0], {
      durationLabel: cells[4],
      durationSeconds: durationToSeconds(cells[4]),
      apiCalls: number(5), toolCalls: number(6), failures: number(7),
      inputTokens: number(8), outputTokens: number(9), cacheReadTokens: number(10), totalTokens: number(11),
    });
  }

  const humanDetails = new Map();
  for (const match of humanText.matchAll(/^### T(\d+) ·[^\n]*\n\n> ([^\n]+)/gm)) humanDetails.set(`task-${match[1].padStart(2, '0')}`, match[2].trim());

  // 只解析「一、评价总览」四列表；后文的「共性反馈」两列表不得覆盖结论。
  const humanSummary = new Map();
  const overviewStart = humanText.indexOf('## 一、评价总览');
  const overviewEnd = overviewStart >= 0 ? humanText.indexOf('\n## ', overviewStart + 1) : -1;
  const overviewBlock = overviewStart >= 0 ? humanText.slice(overviewStart, overviewEnd > 0 ? overviewEnd : undefined) : humanText;
  for (const row of overviewBlock.split('\n').filter((line) => /^\| T\d+ \|/.test(line))) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4 || !cells[3]) continue;
    humanSummary.set(`task-${cells[0].slice(1).padStart(2, '0')}`, cells[3]);
  }

  const aiSections = new Map();
  for (const match of aiText.matchAll(/^### Task (\d{2}) · (.*?) — (\d+) \/ 100\n\n\*\*结论：([^*]+)。\*\*\n\n([\s\S]*?)(?=^### Task|^## 五)/gm)) {
    aiSections.set(`task-${match[1]}`, { title: match[2], score: Number(match[3]), verdict: match[4].trim(), body: match[5].trim() });
  }

  const tasks = [];
  const runs = [];
  const reviews = [];
  for (const [index, match] of taskSections.entries()) {
    const number = match[1];
    const id = `task-${number}`;
    const section = match[0];
    const promptOriginal = stripFence(subsection(section, '### 原始 Prompt / Original Prompt', '### 中文译文 / Chinese Translation'));
    const promptTranslation = stripFence(subsection(section, '### 中文译文 / Chinese Translation', '### 理论成果 / Expected Outcome'));
    const expectedOutcome = bilingualParagraph(subsection(section, '### 理论成果 / Expected Outcome', '### 检验内容 / Verification'));
    const verification = bilingualList(subsection(section, '### 检验内容 / Verification'));
    const sourcePath = `${archiveRoot}/${folders[index]}`;
    const metrics = metricRows.get(id);
    if (!metrics) throw new Error(`[deepseek-phase1] missing metrics for ${id}`);
    const artifactType = index >= 1 && index <= 6 ? 'svg' : 'html';
    const runId = `run-deepseek-v4-1-flash-exp-0910-${id}-r1`;
    const cover = artifactType === 'html' ? (artifactFiles[index].includes('screenshot.png') ? `artifacts/${runId}/screenshot.png` : `covers/${runId}.png`) : null;

    tasks.push({
      id, version: 1, phaseId: 'phase-01',
      title: { zh: match[2].trim(), en: match[3].trim() },
      category: categories[index], promptOriginal, promptTranslation, expectedOutcome, verification,
      source: { path: promptPath, lines: lineRange(promptsText, `## Task ${number} ·`, section) },
    });

    runs.push({
      id: runId, modelId: 'deepseek-v4-1-flash-exp-0910', taskId: id, taskVersion: 1,
      status: 'completed',
      environment: { harness: 'DSH', sessionId: sessionIds[index], continuationTurns: continuationTurns[index] },
      isolation: { level: 'unknown', note: '第一阶段历史运行未记录隔离配置；见 docs/verification.md。' },
      contamination: { status: 'unknown', note: '第一阶段历史运行未执行新的污染判定流程。' },
      metrics,
      artifact: {
        type: artifactType, entry: entries[index], files: artifactFiles[index], sourcePath,
        commit: archiveCommit, cover,
        preview: {
          lazy: artifactType === 'html',
          sandbox: artifactType === 'html' ? 'allow-scripts allow-downloads allow-forms' : null,
          note: id === 'task-13'
            ? 'Live weather requests may be unavailable; the artifact includes cached and offline fallbacks.'
            : artifactType === 'html'
              ? 'Embedded storage and downloads can be restricted by browser sandboxing; use the standalone view for full behavior.'
              : null,
        },
      },
      source: { path: metricsPath, lines: '54-70' },
    });

    reviews.push({
      id: `review-human-${id}-r1`, runId, type: 'human', authorLabel: 'Personal Review', date: null,
      conclusion: { zh: humanSummary.get(id) ?? '', en: humanTranslations[index] },
      body: { zh: humanDetails.get(id) ?? '', en: humanTranslations[index] },
      translated: true, score: null,
      source: { path: humanPath, lines: lineRange(humanText, `### T${index + 1} ·`, `### T${index + 1} ·`) },
    });

    const ai = aiSections.get(id);
    if (!ai) throw new Error(`[deepseek-phase1] missing AI assessment for ${id}`);
    reviews.push({
      id: `review-ai-${id}-r1`, runId, type: 'ai', authorLabel: '15-task completion quality assessment', date: '2026-09-09',
      conclusion: { zh: ai.verdict, en: `Original Chinese verdict (not translated): ${ai.verdict}` },
      body: { zh: ai.body, en: 'This historical AI assessment was written in Chinese. The original text is shown on the Chinese page and at the source link; no English translation is provided.' },
      translated: false, score: ai.score,
      scoreMethod: 'Weighted rubric defined in the cited historical AI report; not an independent score produced by this website.',
      source: { path: aiPath, lines: lineRange(aiText, `### Task ${number} ·`, `### Task ${number} ·`) },
    });
  }

  const model = JSON.parse(read('website/data/models/deepseek-v4-1-flash-exp-0910.json'));

  return {
    id,
    model,
    tasks,
    runs,
    reviews,
    batches: [{
      id: 'batch-deepseek-v4-1-flash-exp-0910-phase-01',
      modelId: model.id, phaseId: 'phase-01',
      label: { zh: 'DeepSeek V4.1 Flash Exp 0910 · Phase 1', en: 'DeepSeek V4.1 Flash Exp 0910 · Phase 1' },
      metrics: {
        totalTasks: 15, sessions: 12, durationSeconds: 8282, apiCalls: 693, toolCalls: 735, failures: 42,
        inputTokens: 334670, outputTokens: 1072534, cacheReadTokens: 63042176, totalTokens: 64449380,
        costCny: 9.3, costUsd: null,
      },
      source: { path: metricsPath, lines: '10-25' },
    }],
    assessments: [{
      id: 'assessment-deepseek-v4-1-flash-exp-0910-phase-01',
      modelId: model.id, phaseId: 'phase-01', scope: 'phase',
      score: 93.6, coreSummary: '15/15',
      label: { zh: '历史 AI 报告结论（引用）', en: 'Quoted historical AI report conclusion' },
      source: { path: aiPath, lines: '7-16,209-211' },
      disclaimer: 'Quoted from the historical AI assessment; not independently proven or recomputed by this website.',
    }],
    sourcePathMappings: [
      { commit: archiveCommit, current: `${archiveRoot}/`, archived: 'DeepSeek-V4.1-Flash-Exp-0910_DSH/' },
      { commit: archiveCommit, current: promptPath, archived: '15_TEST_PROMPTS_BILINGUAL.md' },
    ],
  };
}

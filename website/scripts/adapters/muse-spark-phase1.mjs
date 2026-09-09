// 批次适配器：Muse Spark 1.3 / Phase 1（扁平 task-* 布局，与第一阶段一致）。
// 来源：Test_Results/Muse-Spark-1.3_Opencode/phase-01 下的交付物、逐字 prompt、
//       Reviews/Personal_Review.md（人工）、Reviews/Muse-Spark-1.3-任务评测复盘.md（指标）、
//       Reviews/ai/maintenance-agent-v1/（AI 评价 v1，每题一条 + 阶段总评）。
// 同一 phase-01 的 Task 实体由第一阶段适配器提供；本适配器只贡献模型、运行、评价与批次统计。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { lineRange, tableCells, durationToSeconds } from '../lib/markdown.mjs';

export const id = 'muse-spark-1-3-phase1';

const archiveRoot = 'Test_Results/Muse-Spark-1.3_Opencode/phase-01';
const archiveCommit = 'b8d0235e89ac803dc62948b8e3b20f81983922d2';
const metricsPath = `${archiveRoot}/Reviews/Muse-Spark-1.3-任务评测复盘.md`;
const humanPath = `${archiveRoot}/Reviews/Personal_Review.md`;
const aiDir = `${archiveRoot}/Reviews/ai/maintenance-agent-v1`;

// 交付物清单：只包含模型产出，不含 prompt.txt / README / 评价等档案材料。
const artifacts = {
  'task-01': { files: ['index.html', 'app.js', 'style.css'], entry: 'index.html', type: 'html' },
  'task-02': { files: ['pelican-bicycle.svg'], entry: 'pelican-bicycle.svg', type: 'svg' },
  'task-03': { files: ['analog-clock-6-25.svg'], entry: 'analog-clock-6-25.svg', type: 'svg' },
  'task-04': { files: ['clock.svg'], entry: 'clock.svg', type: 'svg' },
  'task-05': { files: ['bicycle-rider.svg'], entry: 'bicycle-rider.svg', type: 'svg' },
  'task-06': { files: ['hand-cutting-paper.svg'], entry: 'hand-cutting-paper.svg', type: 'svg' },
  'task-07': { files: ['pushing-wheelbarrow.svg'], entry: 'pushing-wheelbarrow.svg', type: 'svg' },
  'task-08': { files: ['index.html'], entry: 'index.html', type: 'html' },
  'task-09': { files: ['index.html'], entry: 'index.html', type: 'html' },
  'task-10': { files: ['index.html'], entry: 'index.html', type: 'html' },
  'task-11': { files: ['index.html'], entry: 'index.html', type: 'html' },
  'task-12': { files: ['index.html', 'app.js', 'calculator.js', 'style.css'], entry: 'index.html', type: 'html' },
  'task-13': { files: ['index.html'], entry: 'index.html', type: 'html' },
  'task-14': { files: ['index.html', 'app.js', 'styles.css'], entry: 'index.html', type: 'html' },
  'task-15': { files: ['index.html', 'app.js', 'books.js', 'style.css'], entry: 'index.html', type: 'html' },
};

const previewNotes = {
  'task-12': 'The artifact uses ES modules, so it must be served over HTTP; opening the file directly fails under CORS. This preview is served over HTTP.',
  'task-15': 'The artifact uses ES modules, so it must be served over HTTP; opening the file directly fails under CORS. This preview is served over HTTP.',
  'task-13': 'Live weather requests go to Open-Meteo and may be unavailable; the artifact falls back to offline demo data.',
  'task-14': 'The page links Google Fonts; offline rendering falls back to system fonts.',
};

// 人工评语英文译文（原评为中文，译文在此显式提供并标记 translated）。
const humanEn = {
  'task-01': 'Solid completion, but the product samples shown could be more detailed.',
  'task-02': 'High completion; the pelican reads clearly as riding a bicycle.',
  'task-03': 'The hour hand is roughly in the right place, but not precise on close inspection.',
  'task-04': 'Basically complete.',
  'task-05': 'Basically complete, but the body pose is unnatural.',
  'task-06': 'The hand only has four fingers.',
  'task-07': 'The body structure looks a bit odd, but the task is basically done.',
  'task-08': 'The game is functionally complete, but part of the page does not display.',
  'task-09': 'Core functionality is complete, though the UI has room to improve.',
  'task-10': 'Fully functional.',
  'task-11': 'Functionally implemented, but it lacks the characteristics of this kind of software.',
  'task-12': 'The calculator is unusable.',
  'task-13': 'Very high completion, and the UI feels comfortable.',
  'task-14': 'Basically complete.',
  'task-15': 'Books cannot be added, and the UI design is poor.',
};
const humanVerdictEn = {
  'task-01': 'Pass · details could improve', 'task-02': 'Pass', 'task-03': 'Pass · accuracy could improve',
  'task-04': 'Pass', 'task-05': 'Pass · with flaws', 'task-06': 'Needs improvement', 'task-07': 'Pass · with flaws',
  'task-08': 'Pass · display issue', 'task-09': 'Pass · UI could improve', 'task-10': 'Pass',
  'task-11': 'Pass · lacks domain-specific features', 'task-12': 'Fail', 'task-13': 'Pass · excellent',
  'task-14': 'Pass', 'task-15': 'Fail',
};

// AI 评价结论英文译文（原结论为中文）。
const aiConclusionEn = {
  'task-01': 'Structurally complete, real interactions, no external dependencies.',
  'task-02': 'Rich elements and gradients with accessibility markup; recognizability needs human review.',
  'task-03': 'Hand angles exact; human perception differs from this assessment.',
  'task-04': 'Angles exact, plus a digital label and aria-label.',
  'task-05': 'Pose requirements explicitly modeled; body appearance needs human review.',
  'task-06': 'The hand has only 4 digits (1 thumb + 3 fingers), conflicting with an ordinary hand.',
  'task-07': 'Push direction correct and self-documented; body structure needs human review.',
  'task-08': 'Score, lives, levels and pause all present; the reported display issue needs reproduction.',
  'task-09': 'Planting, watering, harvest, day-night and save present; UI could improve.',
  'task-10': 'All seven required features present (PNG export, undo/redo, zoom).',
  'task-11': 'Walls, doors, windows, drag and dimensions present; lacks professional features.',
  'task-12': 'Engine is well layered and tested; ES modules make file:// unusable.',
  'task-13': 'Live APIs plus skeleton and offline fallback; no caching strategy.',
  'task-14': 'Single page with 12 sections and disclaimers; no security section, pulls Google Fonts.',
  'task-15': 'Domain engine with 18 exports and tests; ES modules make file:// unusable.',
};

export function load({ read, repoRoot, siteRoot }) {
  const metricsText = read(metricsPath);
  const humanText = read(humanPath);
  const aiIndexText = read(`${aiDir}/README.md`);

  // 逐题指标表（复盘报告第 84 行起）。
  const perTask = new Map();
  for (const row of metricsText.split('\n').filter((line) => /^\| task-\d{2} \|/.test(line))) {
    const cells = tableCells(row, { stripBold: true });
    if (cells.length !== 12) continue;
    const number = (index) => Number(cells[index].replaceAll(',', ''));
    perTask.set(cells[0], {
      durationLabel: cells[4],
      durationSeconds: durationToSeconds(cells[4]),
      apiCalls: number(5), toolCalls: number(6), failures: number(7),
      inputTokens: number(8), outputTokens: number(9), cacheReadTokens: number(10), totalTokens: number(11),
      sessionId: cells[1],
    });
  }

  // 人工评价：总览表（结论）+ 逐条小节（原文）。
  const humanSummary = new Map();
  const humanBody = new Map();
  const overviewStart = humanText.indexOf('## 一、评价总览');
  const overviewEnd = overviewStart >= 0 ? humanText.indexOf('\n## ', overviewStart + 1) : -1;
  const overviewBlock = overviewStart >= 0 ? humanText.slice(overviewStart, overviewEnd > 0 ? overviewEnd : undefined) : humanText;
  for (const row of overviewBlock.split('\n').filter((line) => /^\| T\d+ \|/.test(line))) {
    const cells = tableCells(row);
    if (cells.length < 4 || !cells[3]) continue;
    humanSummary.set(`task-${cells[0].slice(1).padStart(2, '0')}`, cells[3]);
  }
  for (const match of humanText.matchAll(/^### T(\d+) ·[^\n]*\n\n> ([^\n]+)/gm)) {
    humanBody.set(`task-${match[1].padStart(2, '0')}`, match[2].trim());
  }

  // AI 评价：README 总览表（分数 + 结论），逐题文件正文。
  const aiSummary = new Map();
  for (const row of aiIndexText.split('\n').filter((line) => /^\| \d{2} \|/.test(line))) {
    const cells = tableCells(row, { stripBold: true });
    if (cells.length < 9) continue;
    const taskId = `task-${cells[0]}`;
    aiSummary.set(taskId, { score: Number(cells[7]), conclusion: cells[8] });
  }

  const tasks = [];
  const runs = [];
  const reviews = [];
  for (const [taskId, artifact] of Object.entries(artifacts)) {
    const number = taskId.slice(5);
    const metrics = perTask.get(taskId);
    if (!metrics) throw new Error(`[muse-spark-phase1] missing metrics for ${taskId}`);
    const human = humanSummary.get(taskId);
    if (!human) throw new Error(`[muse-spark-phase1] missing human verdict for ${taskId}`);
    const ai = aiSummary.get(taskId);
    if (!ai) throw new Error(`[muse-spark-phase1] missing AI verdict for ${taskId}`);

    const { sessionId, ...runMetrics } = metrics;
    const runId = `run-muse-spark-1-3-${taskId}-r1`;
    const folder = fs.readdirSync(path.join(repoRoot, archiveRoot)).find((name) => name.startsWith(`${taskId}-`));
    if (!folder) throw new Error(`[muse-spark-phase1] missing task folder for ${taskId}`);
    const sourcePath = `${archiveRoot}/${folder}`;

    const promptText = fs.readFileSync(path.join(repoRoot, sourcePath, 'prompt.txt'), 'utf8');
    const promptSha256 = crypto.createHash('sha256').update(Buffer.from(promptText)).digest('hex');

    const aiBody = fs.readFileSync(path.join(repoRoot, aiDir, `${taskId}.md`), 'utf8');
    const aiBodyZh = aiBody.slice(aiBody.indexOf('---\n\n') + 5).trim();

    runs.push({
      id: runId, modelId: 'muse-spark-1-3', taskId, taskVersion: 1,
      status: 'completed',
      prompt: {
        path: `${sourcePath}/prompt.txt`,
        sha256: promptSha256,
        provenance: 'post-hoc-reconstruction',
        note: '组织者确认与该阶段题目一致；入库时按题目文档回填，非当时封存的输入副本。',
      },
      environment: {
        harness: 'opencode', harnessVersion: '1.18.29', surface: 'tui',
        sessionId, reasoningEffort: 'xhigh', continuationTurns: 0,
        startedAt: null, endedAt: null, timezone: 'Asia/Shanghai',
      },
      isolation: {
        level: 'workspace-only',
        note: '配置 + 提示词约束（opencode permission.external_directory=deny + AGENTS.md），15 题共用工作区；非强制隔离。',
        evidencePaths: [`${archiveRoot}/evidence/isolation-rules.md`, `${archiveRoot}/evidence/tool-config.json`],
      },
      contamination: {
        status: 'clean',
        scope: 'organizer-verdict',
        note: '组织者判定本次通过，范围仅限已声明的 workspace-only 控制措施；判定所依据的原始日志未随档案封存，无法在档案内独立复核。',
      },
      metrics: runMetrics,
      artifact: {
        type: artifact.type, entry: artifact.entry, files: artifact.files, sourcePath,
        commit: archiveCommit, cover: artifact.type === 'html' ? `covers/${runId}.png` : null,
        preview: {
          lazy: artifact.type === 'html',
          sandbox: artifact.type === 'html' ? 'allow-scripts allow-downloads allow-forms' : null,
          note: previewNotes[taskId] ?? (artifact.type === 'html'
            ? 'Embedded storage and downloads can be restricted by browser sandboxing; use the standalone view for full behavior.'
            : null),
        },
      },
      source: { path: metricsPath, lines: lineRange(metricsText, `| ${taskId} |`, `| ${taskId} |`) },
    });

    reviews.push({
      id: `review-human-muse-${taskId}-r1`, runId, type: 'human', authorLabel: 'Personal Review', date: null,
      conclusion: { zh: human, en: humanVerdictEn[taskId] },
      body: { zh: humanBody.get(taskId) ?? '', en: humanEn[taskId] },
      translated: true, score: null,
      source: { path: humanPath, lines: lineRange(humanText, `### T${Number(number)} ·`, `### T${Number(number)} ·`) },
    });

    reviews.push({
      id: `review-ai-muse-${taskId}-r1-maintenance-agent-v1`, runId, type: 'ai',
      authorLabel: 'maintenance-agent-v1 (non-blind)', date: '2026-09-09',
      conclusion: { zh: ai.conclusion, en: aiConclusionEn[taskId] },
      body: { zh: aiBodyZh, en: 'This review was written in Chinese; the original text is shown on the Chinese page and at the source link. No English translation is provided.' },
      translated: false, score: ai.score,
      scoreMethod: 'Self-defined rubric (requirements 40 / completeness 20 / correctness 20 / visual 10 / engineering 10), scored by the maintenance agent; non-blind and not comparable to the Phase 1 DeepSeek AI report.',
      source: { path: `${aiDir}/${taskId}.md`, lines: '1' },
    });
  }

  const model = JSON.parse(read('website/data/models/muse-spark-1-3.json'));

  return {
    id,
    model,
    tasks: [],
    runs,
    reviews,
    batches: [{
      id: 'batch-muse-spark-1-3-phase-01',
      modelId: model.id, phaseId: 'phase-01',
      label: { zh: 'Muse Spark 1.3 · Phase 1', en: 'Muse Spark 1.3 · Phase 1' },
      metrics: {
        totalTasks: 15, sessions: 15, durationSeconds: 1545, apiCalls: 181, toolCalls: 178, failures: 8,
        inputTokens: 384338, outputTokens: 154563, cacheReadTokens: 3130484, totalTokens: 3669385,
        costCny: 0, costUsd: 0,
      },
      source: { path: metricsPath, lines: '37-50' },
    }],
    assessments: [{
      id: 'assessment-muse-spark-1-3-phase-01-maintenance-agent-v1',
      modelId: model.id, phaseId: 'phase-01', scope: 'phase',
      score: 84.9, coreSummary: '15/15 delivered, 2 flagged as delivery-method issues',
      label: { zh: '维护 agent AI 评价 v1（非盲评）', en: 'Maintenance-agent AI review v1 (non-blind)' },
      source: { path: `${aiDir}/phase-summary.md`, lines: '1' },
      disclaimer: 'Produced by the maintenance agent, not blind, and not comparable to the Phase 1 DeepSeek AI report; no independent blind review exists yet.',
    }],
    sourcePathMappings: [],
  };
}

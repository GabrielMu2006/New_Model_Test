// 批次适配器：K3 / Phase 1（扁平 `task-NN-<slug>/` 布局，Task 01–15）。
//
// 来源：Test_Results/K3_KimiCode/phase-01/（逐题 submission.json、成果、审查证据）
//      + 该阶段 Reviews/ai/maintenance-agent-v4/（逐题 AI 评价）。
//
// 与其它批次的两点差异：
//   1. **不产出 task 实体**：这 15 道题与第一阶段 DeepSeek / Muse / GPT 是同一批（task-01…15@1），
//      已由 `deepseek-phase1.mjs` 定义；重复定义会在编排器里被判为冲突。
//   2. 该批 `submission.json` 的隔离/污染字段更完整（`isolation.level`、`contamination.telemetry`、
//      `contamination.events`），逐条透传到运行页；取证文件名为 `audit-2026-09-12.*`。

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const id = 'k3-phase1';

const archiveRoot = 'Test_Results/K3_KimiCode/phase-01';
const reviewDir = `${archiveRoot}/Reviews/ai/maintenance-agent-v4`;

// 成果与评价发布所在提交：本批次归档入库的提交。
const archiveCommit = '1afdc8cacbb8651cd2aa3939aab2be66a77030ba';

const taskDirs = [
  'task-01-aevum-luxury-watch-landing-page', 'task-02-pelican-on-bicycle', 'task-03-analog-clock-6-25',
  'task-04-analog-clock-11-52-30', 'task-05-bicycle-rider', 'task-06-scissors-cutting-paper',
  'task-07-pushing-wheelbarrow', 'task-08-breakout-game', 'task-09-topdown-farming-game',
  'task-10-pixel-art-editor', 'task-11-floor-plan-editor', 'task-12-calculator',
  'task-13-weather-dashboard', 'task-14-bank-website', 'task-15-book-tracker',
];

const modelId = 'k3';
const numericMetrics = [
  'durationSeconds', 'apiCalls', 'toolCalls', 'failures',
  'inputTokens', 'outputTokens', 'cacheReadTokens', 'totalTokens',
];

/**
 * 归档 `submission.json` 的预览说明是英文原文。展示时提供中文，中文页优先显示中文、
 * 英文页显示归档原文（`en` 一律是归档原样文本，`zh` 是本站为中文页面补的说明）。
 */
const previewNoteZh = {
  'HTML output; internal relative files are listed explicitly': 'HTML 成果；引用的内部相对文件已逐项列出',
  'SVG output; opens standalone': 'SVG 成果；可独立打开查看',
};

const bilingualPreview = (preview) => {
  if (!preview) return preview;
  const note = preview.note;
  if (typeof note !== 'string' || !note) return preview;
  const zh = previewNoteZh[note];
  return zh ? { ...preview, note: { zh, en: note } } : preview;
};

const readJson = (repoRoot, relative) => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

function pickMetrics(metrics) {
  const picked = {};
  for (const key of numericMetrics) {
    const value = metrics[key];
    picked[key] = value === undefined ? null : value;
  }
  return picked;
}

/** `| 本题得分 | **98/100** |` 之类的单元格 → 数值。 */
function parseScore(value) {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)\s*\/\s*100/) ?? String(value ?? '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function metaRow(text, label) {
  const match = text.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, 'm'));
  return match ? match[1].replaceAll('**', '').replaceAll('`', '').trim() : null;
}

function reviewBody(text) {
  const cut = text.indexOf('\n---\n');
  return (cut >= 0 ? text.slice(cut + 5) : text).trim();
}

export function load({ read, repoRoot }) {
  const runs = [];
  const reviews = [];

  for (const dir of taskDirs) {
    const runRoot = `${archiveRoot}/${dir}`;
    const submission = readJson(repoRoot, `${runRoot}/submission.json`);
    if (submission.phaseId !== 'phase-01') throw new Error(`[${id}] ${dir}: unexpected phaseId ${submission.phaseId}`);
    if (submission.model?.id !== 'k3') throw new Error(`[${id}] ${dir}: unexpected model ${submission.model?.id}`);

    const promptFile = `${runRoot}/prompt.txt`;
    const promptFileAbs = path.join(repoRoot, promptFile);
    if (!fs.existsSync(promptFileAbs)) throw new Error(`[${id}] ${dir}: missing prompt.txt`);
    const digest = createHash('sha256').update(fs.readFileSync(promptFileAbs)).digest('hex');
    if (digest !== submission.prompt.sha256) {
      throw new Error(`[${id}] ${dir}: prompt.txt hash ${digest} does not match archived ${submission.prompt.sha256}`);
    }

    const artifact = submission.artifacts;
    if (!artifact.files.includes(artifact.entry)) throw new Error(`[${id}] ${dir}: entry not in artifact files`);

    runs.push({
      id: submission.runId, modelId, taskId: submission.taskId, taskVersion: submission.taskVersion,
      status: submission.status,
      prompt: {
        path: promptFile,
        sha256: submission.prompt.sha256,
        version: submission.prompt.version,
        provenance: 'verbatim-verified',
        note: '题目由组织者粘贴进对话；本文件为逐字存档，导入时与归档声明的 SHA-256 校验一致。',
      },
      environment: {
        harness: submission.environment.harness,
        harnessVersion: submission.environment.harnessVersion,
        surface: submission.environment.surface,
        os: submission.environment.os,
        runtime: submission.environment.runtime,
        sessionId: submission.environment.sessionId,
        sharedContext: submission.environment.sharedContext,
        continuationTurns: submission.environment.continuationTurns,
        // K3 归档用 `sampling.thinkingEffort`（而非 GPT/Codex 的 `effort`）。
        reasoningEffort: submission.environment.sampling?.thinkingEffort ?? submission.environment.sampling?.effort ?? null,
        permissionMode: submission.environment.permissionMode ?? null,
        startedAt: submission.environment.startedAt,
        endedAt: submission.environment.endedAt,
        timezone: submission.environment.timezone,
        reportedModelId: submission.environment.reportedModelId ?? submission.model?.id ?? null,
      },
      isolation: {
        level: submission.isolation.level,
        note: '策略级约束（AGENTS.md 两条绝对规则）+ 事后日志审查；不是强制隔离，不表示「无污染」。',
      },
      contamination: {
        status: submission.contamination.status,
        telemetry: submission.contamination.telemetry ?? null,
        scoringEffect: submission.contamination.scoringEffect ?? 'none',
        confirmedExternalAnswers: submission.contamination.confirmedExternalAnswers === true,
        note: submission.contamination.note ?? '收尾审查结论见运行目录的 evidence/audit-2026-09-12.md。',
      },
      metrics: pickMetrics(submission.metrics),
      artifact: {
        type: artifact.type, entry: artifact.entry, files: artifact.files,
        sourcePath: artifact.sourcePath,
        commit: archiveCommit,
        // 归档未自带截图时，回落到 `npm run capture:covers` 产出的封面（与 phase-01 适配器同一口径）：
        // 封面是展示层指针，不写回 submission.json，也不影响任何指标。
        cover: artifact.cover ?? (artifact.type === 'html' ? `covers/${submission.runId}.png` : null),
        preview: bilingualPreview(artifact.preview),
      },
      source: { path: `${runRoot}/README.md`, lines: null },
      directory: runRoot,
      evidence: {
        audit: `${runRoot}/evidence/audit-2026-09-12.md`,
        auditJson: `${runRoot}/evidence/audit-2026-09-12.json`,
        isolationRules: `${runRoot}/evidence/isolation-rules.md`,
        sessionLogSha256: `${runRoot}/evidence/session-log.sha256.txt`,
        evaluation: `${reviewDir}/${submission.taskId}.md`,
      },
      followups: submission.prompt.followups ?? [],
    });

    const reviewPath = `${reviewDir}/${submission.taskId}.md`;
    if (!fs.existsSync(path.join(repoRoot, reviewPath))) throw new Error(`[${id}] ${dir}: missing review ${reviewPath}`);
    const text = read(reviewPath);
    const score = parseScore(metaRow(text, '本题得分'));
    const conclusionZh = metaRow(text, '结论（中）');
    const conclusionEn = metaRow(text, 'Conclusion \\(EN\\)');
    if (!conclusionZh || !conclusionEn) throw new Error(`[${id}] ${reviewPath}: missing bilingual conclusion`);
    if (score == null) throw new Error(`[${id}] ${reviewPath}: missing score`);
    reviews.push({
      id: metaRow(text, 'reviewId') ?? `review-maint-agent-v4-${submission.taskId}`,
      runId: submission.runId, type: 'ai',
      authorLabel: '维护 agent v4（AI，非盲评）', date: metaRow(text, '评价日期'),
      conclusion: { zh: conclusionZh, en: conclusionEn },
      body: {
        zh: reviewBody(text),
        en: 'This review was written in Chinese; the original text is shown on the Chinese page and at the source link. No English translation is provided.',
      },
      translated: false, score,
      scoreMethod: '需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10；自定口径，不可与其他模型或阶段比较',
      commit: archiveCommit,
      source: { path: reviewPath, lines: `1-${text.split('\n').length}` },
    });
  }

  const model = JSON.parse(read(`website/data/models/${modelId}.json`));
  // 批次汇总只对「全部逐题值都存在」的指标求和：任一题缺失时该项记 null，不按 0 补齐。
  const sumKeys = ['durationSeconds', 'apiCalls', 'toolCalls', 'failures', 'inputTokens', 'outputTokens', 'cacheReadTokens'];
  const totals = {};
  for (const key of sumKeys) {
    totals[key] = runs.every((run) => run.metrics[key] != null)
      ? runs.reduce((sum, run) => sum + run.metrics[key], 0)
      : null;
  }
  totals.totalTokens = runs.every((run) => run.metrics.totalTokens != null)
    ? runs.reduce((sum, run) => sum + run.metrics.totalTokens, 0)
    : null;

  const reviewAverage = Number((reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(1));

  return {
    id,
    model,
    tasks: [], // 与第一阶段同题，任务实体由 deepseek-phase1.mjs 定义
    runs,
    reviews,
    batches: [{
      id: 'batch-k3-phase-01',
      modelId: model.id, phaseId: 'phase-01',
      label: { zh: 'K3 · Phase 1', en: 'K3 · Phase 1' },
      metrics: {
        totalTasks: runs.length,
        sessions: runs.length,
        durationSeconds: totals.durationSeconds,
        apiCalls: totals.apiCalls,
        toolCalls: totals.toolCalls,
        failures: totals.failures,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: totals.cacheReadTokens,
        totalTokens: totals.totalTokens,
        costCny: null, costUsd: null,
      },
      source: { path: `${archiveRoot}/README.md`, lines: '1-40' },
      commit: archiveCommit,
      note: '由 15 个 run 的逐题指标求和；每题一个独立单轮会话；任一题缺失的指标记 null，不按 0 补齐。',
    }],
    assessments: [{
      id: 'assessment-k3-phase-01-maintenance-agent-v4',
      modelId: model.id, phaseId: 'phase-01', scope: 'phase',
      score: reviewAverage,
      coreSummary: 'AI 评价，非盲评（维护 agent 的 Codex 桌面会话；评委后端快照未提供，故不猜测）',
      label: { zh: 'AI 评价 maintenance-agent-v4（非盲评）', en: 'AI review maintenance-agent-v4 (non-blind)' },
      source: { path: `${reviewDir}/phase-summary.md`, lines: '1' },
      commit: archiveCommit,
      disclaimer: {
        zh: '维护 agent v4——非盲评、自定五维口径；不可与其他评委、模型或阶段比较，也不合成排名。',
        en: 'Maintenance agent v4 — non-blind, own five-dimension rubric; not comparable to other reviewers, models or phases, and never combined into a ranking.',
      },
    }],
    sourcePathMappings: [],
  };
}

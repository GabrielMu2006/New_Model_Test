// 批次适配器：GPT-5.6 Sol / Phase 1（扁平 `task-NN-<slug>/` 布局，Task 01–15）。
//
// 来源：Test_Results/GPT-5.6-Sol_Codex/phase-01/（逐题 submission.json、成果、审查证据）
//      + 该阶段 Reviews/ai/maintenance-agent-v3/（逐题 AI 评价）。
//
// 与其它批次的两点差异：
//   1. **不产出 task 实体**：这 15 道题与第一阶段 DeepSeek / Muse 是同一批（task-01…15@1），
//      已由 `deepseek-phase1.mjs` 定义；重复定义会在编排器里被判为冲突。
//   2. 题型与题目文档同上，故答案可直接与另两个模型并排对比。

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const id = 'gpt-5-6-sol-phase1';

const archiveRoot = 'Test_Results/GPT-5.6-Sol_Codex/phase-01';
const reviewDir = `${archiveRoot}/Reviews/ai/maintenance-agent-v3`;

// 成果发布所在提交：本批次归档入库的提交。
const archiveCommit = 'a5b0c7ea1ea8f2dfc3dd093524ca1dc24773703d';

const taskDirs = [
  'task-01-aevum-luxury-watch-landing-page', 'task-02-pelican-on-bicycle', 'task-03-analog-clock-6-25',
  'task-04-analog-clock-11-52-30', 'task-05-bicycle-rider', 'task-06-scissors-cutting-paper',
  'task-07-pushing-wheelbarrow', 'task-08-breakout-game', 'task-09-topdown-farming-game',
  'task-10-pixel-art-editor', 'task-11-floor-plan-editor', 'task-12-calculator',
  'task-13-weather-dashboard', 'task-14-bank-website', 'task-15-book-tracker',
];

const modelId = 'gpt-5-6-sol';
const numericMetrics = [
  'durationSeconds', 'apiCalls', 'toolCalls', 'failures',
  'inputTokens', 'outputTokens', 'cacheReadTokens', 'totalTokens',
];

const readJson = (repoRoot, relative) => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

function pickMetrics(metrics) {
  const picked = {};
  for (const key of numericMetrics) {
    const value = metrics[key];
    picked[key] = value === undefined ? null : value;
  }
  return picked;
}

/** `| 本题得分 | **90/100** |` 之类的单元格 → 数值。 */
function parseScore(value) {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)\s*\/\s*100/) ?? String(value ?? '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function metaRow(text, label) {
  const match = text.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, 'm'));
  return match ? match[1].replaceAll('**', '').trim() : null;
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
    // 实体 id 用连字符（gpt-5-6-sol），harness 报告的快照 id 用点号（gpt-5.6-sol）。
    if (submission.model?.id !== 'gpt-5-6-sol') throw new Error(`[${id}] ${dir}: unexpected model ${submission.model?.id}`);

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
        reasoningEffort: submission.environment.sampling?.effort ?? null,
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
        note: submission.contamination.status === 'clean'
          ? '收尾审查未发现越界；审计只覆盖声明的渠道，不代表「无污染」。详见运行目录的 evidence/audit-2026-09-10.md。'
          : (submission.contamination.note ?? '收尾审查结论见运行目录的 evidence/audit-2026-09-10.md。'),
      },
      metrics: pickMetrics(submission.metrics),
      artifact: {
        type: artifact.type, entry: artifact.entry, files: artifact.files,
        sourcePath: artifact.sourcePath,
        commit: archiveCommit,
        cover: artifact.cover,
        preview: artifact.preview,
      },
      source: { path: `${runRoot}/README.md`, lines: null },
      directory: runRoot,
      evidence: {
        audit: `${runRoot}/evidence/audit-2026-09-10.md`,
        auditJson: `${runRoot}/evidence/audit-2026-09-10.json`,
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
      id: metaRow(text, 'reviewId') ?? `review-maint-agent-v3-${submission.taskId}`,
      runId: submission.runId, type: 'ai',
      authorLabel: '维护 agent v3（AI，非盲评）', date: metaRow(text, '评价日期'),
      conclusion: { zh: conclusionZh, en: conclusionEn },
      body: {
        zh: reviewBody(text),
        en: 'This review was written in Chinese; the original text is shown on the Chinese page and at the source link. No English translation is provided.',
      },
      translated: false, score,
      scoreMethod: '需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10；自定口径，不可与其他模型或阶段比较',
      source: { path: reviewPath, lines: `1-${text.split('\n').length}` },
    });
  }

  const model = JSON.parse(read(`website/data/models/${modelId}.json`));
  const totals = runs.reduce((sum, run) => {
    for (const key of ['durationSeconds', 'apiCalls', 'toolCalls', 'failures', 'inputTokens', 'outputTokens', 'cacheReadTokens']) {
      sum[key] += run.metrics[key] ?? 0;
    }
    return sum;
  }, { durationSeconds: 0, apiCalls: 0, toolCalls: 0, failures: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });

  return {
    id,
    model,
    tasks: [], // 与第一阶段同题，任务实体由 deepseek-phase1.mjs 定义
    runs,
    reviews,
    batches: [{
      id: 'batch-gpt-5-6-sol-phase-01',
      modelId: model.id, phaseId: 'phase-01',
      label: { zh: 'GPT-5.6 Sol · Phase 1', en: 'GPT-5.6 Sol · Phase 1' },
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
        totalTokens: null,
        costCny: null, costUsd: null,
      },
      source: { path: `${archiveRoot}/README.md`, lines: '1-40' },
      note: '由 15 个 run 的逐题指标求和；每题一个独立会话。',
    }],
    assessments: [],
  };
}

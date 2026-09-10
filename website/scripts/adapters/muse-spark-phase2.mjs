// 批次适配器：Muse Spark 1.3 / Phase 2（`runs/<run-id>/` 布局，本批次为 Task 16–20）。
//
// 来源：PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md（题目与理论成果，与 DeepSeek 同题）
//      + Test_Results/Muse-Spark-1.3_Opencode/phase-02/runs/<run-id>/（逐题交接元数据、成果与评价）。
//
// 设计要点（与 deepseek-phase2 保持一致）：
//   1. 不扫描任意目录：只读取本批次已归档、且带 submission.json 的 run 目录；
//   2. 结果元数据以 submission.json 为唯一来源，不在导入层重算或补造指标；
//   3. 导入时交叉校验 prompt.txt 的 SHA-256 是否与归档声明一致；
//   4. 评价正文从 `reviews/` 下的评价文件解析（沿用维护 agent v1 的表格约定），不在导入层改写分数。

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  lineRange, subsection, stripFence, bilingualParagraph, bilingualList,
} from '../lib/markdown.mjs';

export const id = 'muse-spark-1-3-phase2';

const archiveRoot = 'Test_Results/Muse-Spark-1.3_Opencode/phase-02';
const promptPath = 'PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md';

// 成果发布所在提交：本批次（含评价与取证）归档入库的提交。
const archiveCommit = '66aa028b58f17505426a6f4217b0dbf787a72218';

const taskPlan = [
  { dir: 'run-muse-spark-1-3-xhigh-task-16-r1', taskId: 'task-16', category: 'svg-illustration' },
  { dir: 'run-muse-spark-1-3-xhigh-task-17-r1', taskId: 'task-17', category: 'svg-illustration' },
  { dir: 'run-muse-spark-1-3-xhigh-task-18-r1', taskId: 'task-18', category: 'simulation' },
  { dir: 'run-muse-spark-1-3-xhigh-task-19-r1', taskId: 'task-19', category: 'simulation' },
  { dir: 'run-muse-spark-1-3-xhigh-task-20-r1', taskId: 'task-20', category: 'engineering-tool' },
];

const modelId = 'muse-spark-1-3';
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

/** `| 本题得分 | **85/100** |` 之类的单元格 → 数值。 */
function parseScore(value) {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)\s*\/\s*100/) ?? String(value ?? '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** 从评价 Markdown 的元信息表里取某一行的值。 */
function metaRow(text, label) {
  const match = text.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, 'm'));
  return match ? match[1].replaceAll('**', '').trim() : null;
}

/** 评价正文 = 元信息表之后的内容（去掉一级标题）。 */
function reviewBody(text) {
  const cut = text.indexOf('\n---\n');
  return (cut >= 0 ? text.slice(cut + 5) : text).trim();
}

export function load({ read, repoRoot }) {
  const promptsText = read(promptPath);
  const sections = new Map();
  for (const match of promptsText.matchAll(/^## Task (\d{2}) · (.*?) \/ (.*?)\n([\s\S]*?)(?=^## Task|^## 总体|(?![\s\S]))/gm)) {
    sections.set(`task-${match[1]}`, { titleZh: match[2].trim(), titleEn: match[3].trim(), section: match[0] });
  }

  const tasks = [];
  const runs = [];
  const reviews = [];
  for (const plan of taskPlan) {
    const section = sections.get(plan.taskId);
    if (!section) throw new Error(`[${id}] prompt document has no section for ${plan.taskId}`);
    const number = plan.taskId.slice(5);

    const runRoot = `${archiveRoot}/runs/${plan.dir}`;
    const submission = readJson(repoRoot, `${runRoot}/submission.json`);
    if (submission.runId !== plan.dir) throw new Error(`[${id}] ${plan.dir}: runId mismatch (${submission.runId})`);
    if (submission.taskId !== plan.taskId) throw new Error(`[${id}] ${plan.dir}: taskId mismatch (${submission.taskId})`);
    if (submission.phaseId !== 'phase-02') throw new Error(`[${id}] ${plan.dir}: unexpected phaseId ${submission.phaseId}`);

    const promptFile = `${runRoot}/prompt.txt`;
    const promptFileAbs = path.join(repoRoot, promptFile);
    if (!fs.existsSync(promptFileAbs)) throw new Error(`[${id}] ${plan.dir}: missing prompt.txt`);
    const digest = createHash('sha256').update(fs.readFileSync(promptFileAbs)).digest('hex');
    if (digest !== submission.prompt.sha256) {
      throw new Error(`[${id}] ${plan.dir}: prompt.txt hash ${digest} does not match archived ${submission.prompt.sha256}`);
    }

    const artifact = submission.artifacts;
    if (!artifact.files.includes(artifact.entry)) throw new Error(`[${id}] ${plan.dir}: entry not in artifact files`);

    tasks.push({
      id: plan.taskId, version: submission.taskVersion, phaseId: 'phase-02',
      title: { zh: section.titleZh, en: section.titleEn },
      category: plan.category,
      promptOriginal: stripFence(subsection(section.section, '### 原始 Prompt / Original Prompt', '### 中文译文 / Chinese Translation')),
      promptTranslation: stripFence(subsection(section.section, '### 中文译文 / Chinese Translation', '### 理论成果 / Expected Outcome')),
      expectedOutcome: bilingualParagraph(subsection(section.section, '### 理论成果 / Expected Outcome', '### 检验内容 / Verification')),
      verification: bilingualList(subsection(section.section, '### 检验内容 / Verification')),
      source: { path: promptPath, lines: lineRange(promptsText, `## Task ${number} ·`, section.section) },
    });

    runs.push({
      id: submission.runId, modelId, taskId: plan.taskId, taskVersion: submission.taskVersion,
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
        startedAt: submission.environment.startedAt,
        endedAt: submission.environment.endedAt,
        timezone: submission.environment.timezone,
        reportedModelId: submission.model?.id ?? null,
      },
      isolation: {
        level: submission.isolation.level,
        note: '策略级约束（AGENTS.md 两条绝对规则）+ 事后日志审查；不是强制隔离，不表示「无污染」。',
      },
      contamination: {
        status: submission.contamination.status,
        scoringEffect: submission.contamination.scoringEffect ?? 'none',
        confirmedExternalAnswers: submission.contamination.confirmedExternalAnswers === true,
        note: '收尾审查未发现越界；审计只覆盖声明的渠道，不代表「无污染」。详见运行目录的 evidence/review.json。',
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
      evidence: {
        // Muse 本批的逐题审查记录为 `review.json`（含统计与审查结论），审计报告在组织者工作区。
        audit: `${runRoot}/evidence/review.json`,
        isolationRules: `${runRoot}/evidence/isolation-rules.md`,
        phaseSummary: `${archiveRoot}/Reviews/ai/maintenance-agent-v2/phase-summary.md`,
        evaluation: `${archiveRoot}/evidence/evaluation-2026-09-10/checks.json`,
      },
      followups: submission.prompt.followups ?? [],
    });

    for (const reference of submission.reviews ?? []) {
      const reviewPath = `${runRoot}/${reference.path}`;
      const text = read(reviewPath);
      const score = reference.score ?? parseScore(metaRow(text, '本题得分'));
      const conclusionZh = reference.conclusion?.zh ?? metaRow(text, '结论（中）');
      const conclusionEn = reference.conclusion?.en ?? metaRow(text, 'Conclusion \\(EN\\)');
      if (!conclusionZh || !conclusionEn) throw new Error(`[${id}] ${plan.dir}: review ${reviewPath} missing bilingual conclusion`);
      if (score == null) throw new Error(`[${id}] ${plan.dir}: review ${reviewPath} missing score`);
      reviews.push({
        id: reference.id, runId: submission.runId, type: reference.type ?? 'ai',
        authorLabel: reference.authorLabel, date: reference.date,
        conclusion: { zh: conclusionZh, en: conclusionEn },
        body: {
          zh: reviewBody(text),
          en: 'This review was written in Chinese; the original text is shown on the Chinese page and at the source link. No English translation is provided.',
        },
        translated: false, score,
        scoreMethod: reference.scoreMethod,
        source: { path: reviewPath, lines: `1-${text.split('\n').length}` },
      });
    }
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
    tasks,
    runs,
    reviews,
    batches: [{
      id: 'batch-muse-spark-1-3-phase-02-partial',
      modelId: model.id, phaseId: 'phase-02',
      label: {
        zh: 'Muse Spark 1.3 · Phase 2（Task 16–20，部分）',
        en: 'Muse Spark 1.3 · Phase 2 (Task 16–20, partial)',
      },
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
      source: { path: `${archiveRoot}/README.md`, lines: '1-24' },
      note: '本批次为部分汇总：由已归档的 5 个 run 的逐题指标求和，不代表整个 phase-02（Task 16–45）。',
    }],
    assessments: [],
  };
}

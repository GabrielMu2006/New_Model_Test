// 批次适配器：DeepSeek-V4.1-Flash-Exp-0910 / Phase 2（扁平 `task-NN-<slug>/` 布局，本批次为 Task 16–20）。
//
// 来源：PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md（题目与理论成果）
//      + Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/runs/<run-id>/（逐题交接元数据与证据）。
//
// 设计要点：
//   1. 不扫描任意目录：只读取本批次已归档、且带 submission.json 的 run 目录；
//   2. 结果元数据以 submission.json 为唯一来源，不在导入层重算或补造指标；
//   3. 导入时交叉校验 prompt.txt 的 SHA-256 与归档声明一致，题目被改动直接失败；
//   4. 越界状态原样带入，不在导入层改写（处置口径见 docs/audit-method.md 第 5 节）。

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  lineRange, subsection, stripFence, bilingualParagraph, bilingualList,
} from '../lib/markdown.mjs';

export const id = 'deepseek-v4-1-flash-exp-0910-phase2';

const archiveRoot = 'Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02';
const promptPath = 'PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md';

// 成果发布所在提交：本批次归档入库的提交（历史目录迁移与逐批提交相互独立）。
const archiveCommit = 'a9925d853af078d931e96ee769aa119e2f0bd997';

// 目录名 → (taskId, 类别)。扁平 `task-NN-<slug>/` 布局（与 phase-01 一致）；同一题重复运行才进 `runs/<run-id>/`。
const taskPlan = [
  { dir: 'task-16-animated-pelican-bicycle', taskId: 'task-16', category: 'svg-illustration' },
  { dir: 'task-17-mechanical-watch-movement', taskId: 'task-17', category: 'svg-illustration' },
  { dir: 'task-18-rube-goldberg-machine', taskId: 'task-18', category: 'simulation' },
  { dir: 'task-19-interactive-solar-system', taskId: 'task-19', category: 'simulation' },
  { dir: 'task-20-2d-mechanical-linkage-designer', taskId: 'task-20', category: 'engineering-tool' },
];

const modelId = 'deepseek-v4-1-flash-exp-0910';
const numericMetrics = [
  'durationSeconds', 'apiCalls', 'toolCalls', 'failures',
  'inputTokens', 'outputTokens', 'cacheReadTokens', 'totalTokens',
];

const readJson = (repoRoot, relative) => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

/** 只保留数值指标；口径说明（durationBasis / note）不进指标表，缺失记 null。 */
function pickMetrics(metrics) {
  const picked = {};
  for (const key of numericMetrics) {
    const value = metrics[key];
    picked[key] = value === undefined ? null : value;
  }
  return picked;
}

export function load({ read, repoRoot }) {
  const promptsText = read(promptPath);
  const sections = new Map();
  for (const match of promptsText.matchAll(/^## Task (\d{2}) · (.*?) \/ (.*?)\n([\s\S]*?)(?=^## Task|^## 总体|(?![\s\S]))/gm)) {
    sections.set(`task-${match[1]}`, { titleZh: match[2].trim(), titleEn: match[3].trim(), section: match[0] });
  }

  const tasks = [];
  const runs = [];
  for (const plan of taskPlan) {
    const section = sections.get(plan.taskId);
    if (!section) throw new Error(`[${id}] prompt document has no section for ${plan.taskId}`);
    const number = plan.taskId.slice(5);

    const promptOriginal = stripFence(subsection(section.section, '### 原始 Prompt / Original Prompt', '### 中文译文 / Chinese Translation'));
    const promptTranslation = stripFence(subsection(section.section, '### 中文译文 / Chinese Translation', '### 理论成果 / Expected Outcome'));
    const expectedOutcome = bilingualParagraph(subsection(section.section, '### 理论成果 / Expected Outcome', '### 检验内容 / Verification'));
    const verification = bilingualList(subsection(section.section, '### 检验内容 / Verification'));

    const runRoot = `${archiveRoot}/${plan.dir}`;
    const submission = readJson(repoRoot, `${runRoot}/submission.json`);
    if (submission.taskId !== plan.taskId) throw new Error(`[${id}] ${plan.dir}: taskId mismatch (${submission.taskId})`);
    if (!/\.html$/.test(submission.artifacts.entry) && !/\.svg$/.test(submission.artifacts.entry)) throw new Error(`[${id}] ${plan.dir}: unexpected artifact entry`);
    if (submission.phaseId !== 'phase-02') throw new Error(`[${id}] ${plan.dir}: unexpected phaseId ${submission.phaseId}`);

    // 题目完整性：逐字输入文件必须与归档声明的哈希一致。
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
      promptOriginal, promptTranslation, expectedOutcome, verification,
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
        // harness 报告的模型 id = 本次运行实际使用的快照（同模型不同快照必须能区分）。
        reportedModelId: submission.model?.id ?? null,
        sharedContext: submission.environment.sharedContext,
        continuationTurns: submission.environment.continuationTurns,
        startedAt: submission.environment.startedAt,
        endedAt: submission.environment.endedAt,
        timezone: submission.environment.timezone,
      },
      isolation: {
        level: submission.isolation.level,
        note: '策略级约束（AGENTS.md 两条绝对规则）+ 事后日志审查；不是强制隔离，不表示「无污染」。',
      },
      contamination: {
        status: submission.contamination.status,
        scoringEffect: submission.contamination.scoringEffect ?? 'none',
        confirmedExternalAnswers: submission.contamination.confirmedExternalAnswers === true,
        note: submission.contamination.status === 'suspected'
          ? '越界尝试，未取得内容：只记入审计档案，不作外显标注、不排除、不影响成绩。详见 evidence/audit-2026-09-10.md。'
          : '收尾审查未发现越界；审计只覆盖声明的渠道，不代表「无污染」。详见 evidence/audit-2026-09-10.md。',
      },
      metrics: pickMetrics(submission.metrics),
      artifact: {
        type: artifact.type, entry: artifact.entry, files: artifact.files,
        sourcePath: artifact.sourcePath,
        commit: archiveCommit,
        cover: artifact.cover,
        preview: artifact.preview,
        fileSha256: artifact.fileSha256,
      },
      source: { path: `${runRoot}/README.md`, lines: null },
      directory: `${archiveRoot}/${plan.dir}`,
      evidence: {
        audit: `${runRoot}/evidence/audit-2026-09-10.md`,
        auditJson: `${runRoot}/evidence/audit-2026-09-10.json`,
        isolationRules: `${runRoot}/evidence/isolation-rules.md`,
        sessionLogSha256: `${runRoot}/evidence/session-log.sha256.txt`,
      },
      followups: submission.prompt.followups ?? [],
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
    tasks,
    runs,
    reviews: [],
    batches: [{
      id: 'batch-deepseek-v4-1-flash-exp-0910-phase-02-partial',
      modelId: model.id, phaseId: 'phase-02',
      label: {
        zh: 'DeepSeek V4.1 Flash Exp 0910 · Phase 2（Task 16–20，部分）',
        en: 'DeepSeek V4.1 Flash Exp 0910 · Phase 2 (Task 16–20, partial)',
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
      source: { path: `${archiveRoot}/README.md`, lines: '1-20' },
      note: '本批次为部分汇总：由已归档的 5 个 run 的逐题指标求和，不代表整个 phase-02（Task 16–45）。',
    }],
    assessments: [],
  };
}

// 归档 → 展示站数据索引（catalog.json）的编排器。
//
// 职责边界：
//   1. 读取 phases/ 与各批次适配器（显式注册，不扫描任意目录、不执行档案内脚本）；
//   2. 确定性合并实体，拒绝重复主键与冲突定义；
//   3. 写出 schemaVersion 2 的 catalog。
// 每个适配器只负责自己那一批的解析；解析规则放在 scripts/adapters/ 下，逐批次演进。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as deepseekPhase1 from './adapters/deepseek-phase1.mjs';
import * as museSparkPhase1 from './adapters/muse-spark-phase1.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, '..');
const repoRoot = path.resolve(siteRoot, '..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const adapters = [deepseekPhase1, museSparkPhase1];
const ctx = { read, repoRoot, siteRoot };

const loaded = adapters.map((adapter) => {
  const result = adapter.load(ctx);
  if (!result?.model) throw new Error(`[${adapter.id}] adapter returned no model`);
  return { adapterId: adapter.id, ...result };
});

const phases = fs
  .readdirSync(path.join(siteRoot, 'data/phases'))
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/phases', file), 'utf8')));

const models = [];
const tasks = [];
const runs = [];
const reviews = [];
const batches = [];
const assessments = [];
const sourcePathMappings = [];

const pushUnique = (list, entity, label) => {
  const index = list.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    if (JSON.stringify(list[index]) !== JSON.stringify(entity)) {
      throw new Error(`${label}: conflicting definition for id ${entity.id}`);
    }
    return;
  }
  list.push(entity);
};

for (const entry of loaded) {
  pushUnique(models, entry.model, 'model');
  for (const task of entry.tasks) pushUnique(tasks, task, 'task');
  for (const run of entry.runs) pushUnique(runs, run, 'run');
  for (const review of entry.reviews) pushUnique(reviews, review, 'review');
  for (const batch of entry.batches ?? []) pushUnique(batches, batch, 'batch');
  for (const assessment of entry.assessments ?? []) pushUnique(assessments, assessment, 'assessment');
  sourcePathMappings.push(...(entry.sourcePathMappings ?? []));
}

// 关联校验：任何悬空引用都在导入阶段失败，而不是留到页面上。
const ids = {
  phase: new Set(phases.map((item) => item.id)),
  model: new Set(models.map((item) => item.id)),
  task: new Set(tasks.map((item) => item.id)),
  run: new Set(runs.map((item) => item.id)),
};
for (const task of tasks) {
  if (!ids.phase.has(task.phaseId)) throw new Error(`task ${task.id}: unknown phase ${task.phaseId}`);
}
for (const run of runs) {
  if (!ids.model.has(run.modelId)) throw new Error(`run ${run.id}: unknown model ${run.modelId}`);
  if (!ids.task.has(run.taskId)) throw new Error(`run ${run.id}: unknown task ${run.taskId}`);
  const task = tasks.find((item) => item.id === run.taskId);
  if (task.version !== run.taskVersion) throw new Error(`run ${run.id}: taskVersion ${run.taskVersion} does not match task ${task.id}@${task.version}`);
}
for (const review of reviews) {
  if (!ids.run.has(review.runId)) throw new Error(`review ${review.id}: unknown run ${review.runId}`);
}
for (const batch of batches) {
  if (!ids.model.has(batch.modelId)) throw new Error(`batch ${batch.id}: unknown model ${batch.modelId}`);
}
for (const assessment of assessments) {
  if (!ids.model.has(assessment.modelId)) throw new Error(`assessment ${assessment.id}: unknown model ${assessment.modelId}`);
}

const catalog = {
  schemaVersion: 2,
  generatedAt: null,
  archiveCommit: deepseekPhase1.load(ctx).runs[0].artifact.commit,
  sourcePathMappings,
  repository: 'https://github.com/GabrielMu2006/New_Model_Test',
  phases, models, tasks, runs, reviews, batches, assessments,
};

fs.writeFileSync(path.join(siteRoot, 'data/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(
  `Imported ${models.length} models, ${phases.length} phases, ${tasks.length} tasks, ${runs.length} runs, `
  + `${reviews.length} reviews, ${batches.length} batches via ${loaded.length} adapter(s): ${loaded.map((item) => item.adapterId).join(', ')}.`,
);

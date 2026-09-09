import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteRoot, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/catalog.json'), 'utf8'));
const fail = (message) => { throw new Error(message); };

/** 校验 id 唯一性并返回 id 集合。 */
const unique = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    if (!item.id) fail(`${label}: missing id`);
    if (seen.has(item.id)) fail(`${label}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
  return seen;
};

const phaseIds = unique(catalog.phases, 'phase');
const taskIds = unique(catalog.tasks, 'task');
const modelIds = unique(catalog.models, 'model');
const runIds = unique(catalog.runs, 'run');
unique(catalog.reviews, 'review');
unique(catalog.batches, 'batch');
unique(catalog.assessments, 'assessment');

// ---- 实体级通用校验（不写死具体数量，由数据推导） ----
const phaseById = new Map(catalog.phases.map((phase) => [phase.id, phase]));
const taskById = new Map(catalog.tasks.map((task) => [task.id, task]));

for (const phase of catalog.phases) {
  if (!Number.isInteger(phase.number) || phase.number < 1) fail(`phase ${phase.id}: invalid number`);
  if (!phase.name?.zh || !phase.name?.en) fail(`phase ${phase.id}: name must be bilingual`);
  if (!Array.isArray(phase.taskVersions) || phase.taskVersions.length === 0) fail(`phase ${phase.id}: taskVersions must be a non-empty array`);
  for (const ref of phase.taskVersions) {
    const [taskId, version] = String(ref).split('@');
    const task = taskById.get(taskId);
    if (!task) fail(`phase ${phase.id}: unknown task ${taskId}`);
    if (String(task.version) !== String(version)) fail(`phase ${phase.id}: task ${ref} version mismatch (catalog has ${task.version})`);
  }
}

for (const task of catalog.tasks) {
  if (!phaseIds.has(task.phaseId)) fail(`${task.id}: missing phase ${task.phaseId}`);
  if (!task.promptOriginal || !task.promptTranslation) fail(`${task.id}: prompt or translation is empty`);
  if (!Number.isInteger(task.version) || task.version < 1) fail(`${task.id}: invalid version`);
  if (!task.expectedOutcome?.zh || !task.expectedOutcome?.en) fail(`${task.id}: expected outcome must be bilingual and non-empty`);
  const zhVerification = task.verification?.zh ?? [];
  const enVerification = task.verification?.en ?? [];
  if (!zhVerification.length) fail(`${task.id}: verification list is empty`);
  if (zhVerification.length !== enVerification.length) fail(`${task.id}: verification zh/en length mismatch (${zhVerification.length} vs ${enVerification.length})`);
}

const isolationLevels = new Set(['container', 'os-user-isolation', 'workspace-only', 'unknown']);
const contaminationStatuses = new Set(['clean', 'suspected', 'contaminated', 'unknown']);
for (const run of catalog.runs) {
  if (!modelIds.has(run.modelId) || !taskIds.has(run.taskId)) fail(`${run.id}: broken relationship`);
  const task = taskById.get(run.taskId);
  if (task.version !== run.taskVersion) fail(`${run.id}: taskVersion ${run.taskVersion} does not match task ${run.taskId}@${task.version}`);
  if (!['svg', 'html'].includes(run.artifact.type)) fail(`${run.id}: invalid artifact type`);
  if (!run.artifact.files.includes(run.artifact.entry)) fail(`${run.id}: entry ${run.artifact.entry} is not in the artifact file list`);
  if (!run.artifact.commit || !/^[0-9a-f]{40}$/.test(run.artifact.commit)) fail(`${run.id}: artifact.commit must be a full SHA`);
  for (const file of run.artifact.files) {
    if (path.isAbsolute(file) || file.split('/').includes('..')) fail(`${run.id}: unsafe file path ${file}`);
    const source = path.resolve(repoRoot, run.artifact.sourcePath, file);
    if (!source.startsWith(path.resolve(repoRoot, run.artifact.sourcePath) + path.sep)) fail(`${run.id}: path escaped archive`);
    if (!fs.existsSync(source)) fail(`${run.id}: missing file ${file}`);
  }
  if (run.prompt) {
    if (!/^[0-9a-f]{64}$/.test(run.prompt.sha256 ?? '')) fail(`${run.id}: prompt.sha256 must be a 64-char hex digest`);
    if (!fs.existsSync(path.resolve(repoRoot, run.prompt.path))) fail(`${run.id}: missing prompt file ${run.prompt.path}`);
  }
  if (run.isolation && !isolationLevels.has(run.isolation.level)) fail(`${run.id}: invalid isolation level ${run.isolation.level}`);
  if (run.contamination && !contaminationStatuses.has(run.contamination.status)) fail(`${run.id}: invalid contamination status ${run.contamination.status}`);
  for (const [key, value] of Object.entries(run.metrics)) {
    if (key === 'durationLabel') continue;
    if (value !== null && (!Number.isFinite(value) || value < 0)) fail(`${run.id}: invalid metric ${key}=${value}`);
  }
}

for (const review of catalog.reviews) {
  if (!runIds.has(review.runId)) fail(`${review.id}: missing run ${review.runId}`);
  if (!['human', 'ai'].includes(review.type)) fail(`${review.id}: invalid review type ${review.type}`);
  if (!review.conclusion?.zh || !review.conclusion?.en) fail(`${review.id}: conclusion must be non-empty in both locales`);
  if (!review.body?.zh || !review.body?.en) fail(`${review.id}: body must be non-empty in both locales`);
  if (review.type === 'ai' && (review.score == null || !review.scoreMethod)) fail(`${review.id}: AI review needs a score and a score method`);
  if (!review.source?.path) fail(`${review.id}: missing source path`);
}

for (const batch of catalog.batches) {
  if (!modelIds.has(batch.modelId)) fail(`batch ${batch.id}: unknown model ${batch.modelId}`);
  if (!phaseIds.has(batch.phaseId)) fail(`batch ${batch.id}: unknown phase ${batch.phaseId}`);
  for (const [key, value] of Object.entries(batch.metrics)) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) fail(`batch ${batch.id}: invalid metric ${key}=${value}`);
  }
  if (!batch.source?.path) fail(`batch ${batch.id}: missing source`);
}

for (const assessment of catalog.assessments) {
  if (!modelIds.has(assessment.modelId)) fail(`assessment ${assessment.id}: unknown model ${assessment.modelId}`);
  if (!phaseIds.has(assessment.phaseId)) fail(`assessment ${assessment.id}: unknown phase ${assessment.phaseId}`);
  if (assessment.score !== null && (!Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > 100)) fail(`assessment ${assessment.id}: invalid score`);
  if (!assessment.source?.path) fail(`assessment ${assessment.id}: missing source`);
}

// ---- 首批档案回归基线（独立于上面的通用校验，防止接入新数据时被悄悄改动） ----
const deepseekRuns = catalog.runs.filter((run) => run.modelId === 'deepseek-v4-1-flash-exp-0910');
const deepseekReviews = catalog.reviews.filter((review) => deepseekRuns.some((run) => run.id === review.runId));
if (catalog.tasks.length !== 15) fail(`Phase 1 regression: expected 15 tasks, found ${catalog.tasks.length}`);
if (deepseekRuns.length !== 15) fail(`Phase 1 regression: expected 15 DeepSeek runs, found ${deepseekRuns.length}`);
if (deepseekReviews.length !== 30) fail(`Phase 1 regression: expected 30 DeepSeek reviews, found ${deepseekReviews.length}`);
const museRuns = catalog.runs.filter((run) => run.modelId === 'muse-spark-1-3');
if (museRuns.length !== 15) fail(`Muse regression: expected 15 Muse runs, found ${museRuns.length}`);
const museReviews = catalog.reviews.filter((review) => museRuns.some((run) => run.id === review.runId));
if (museReviews.length !== 45) fail(`Muse regression: expected 45 Muse reviews (1 human + 2 AI per run), found ${museReviews.length}`);
// 每个 Muse 运行必须同时挂人工评价与每一份已归档的 AI 评价
const aiEvaluations = new Set(museReviews.filter((review) => review.type === 'ai').map((review) => review.id.split('-r1-').slice(1).join('-r1-')));
for (const run of museRuns) {
  const reviews = museReviews.filter((review) => review.runId === run.id);
  if (reviews.filter((review) => review.type === 'human').length !== 1) fail(`${run.id}: expected exactly one human review`);
  const aiIds = new Set(reviews.filter((review) => review.type === 'ai').map((review) => review.id.split('-r1-').slice(1).join('-r1-')));
  for (const evaluator of aiEvaluations) {
    if (!aiIds.has(evaluator)) fail(`${run.id}: missing AI review from ${evaluator}`);
  }
}

console.log(
  `Data validation passed: ${catalog.models.length} models, ${catalog.tasks.length} tasks, ${catalog.runs.length} runs, `
  + `${catalog.reviews.length} reviews, ${catalog.batches.length} batches, ${catalog.assessments.length} assessments.`,
);

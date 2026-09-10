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
const modelById = new Map(catalog.models.map((model) => [model.id, model]));

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

for (const phase of catalog.phases) {
  const owned = catalog.tasks
    .filter((task) => task.phaseId === phase.id)
    .map((task) => `${task.id}@${task.version}`)
    .sort();
  const declared = [...phase.taskVersions].map(String).sort();
  if (JSON.stringify(owned) !== JSON.stringify(declared)) {
    fail(`phase ${phase.id}: taskVersions ${JSON.stringify(declared)} do not match catalog tasks ${JSON.stringify(owned)}`);
  }
}

// ---- 模型身份：显示名双语；同模型多快照必须显式声明，且逐运行可追溯 ----
const snapshotStatuses = new Set(['current', 'retired', 'unknown']);
for (const model of catalog.models) {
  if (!model.name?.zh || !model.name?.en) fail(`model ${model.id}: name must be bilingual`);
  if (model.snapshots == null) continue;
  if (!Array.isArray(model.snapshots) || model.snapshots.length === 0) fail(`model ${model.id}: snapshots must be a non-empty array when present`);
  const seen = new Set();
  for (const snapshot of model.snapshots) {
    if (!snapshot.label?.zh || !snapshot.label?.en) fail(`model ${model.id}: snapshot label must be bilingual`);
    if (!snapshot.evidence?.zh || !snapshot.evidence?.en) fail(`model ${model.id}: snapshot ${snapshot.id ?? '(pending)'} needs bilingual evidence`);
    if (!snapshotStatuses.has(snapshot.status)) fail(`model ${model.id}: invalid snapshot status ${snapshot.status}`);
    if (snapshot.id === null) continue;
    if (seen.has(snapshot.id)) fail(`model ${model.id}: duplicate snapshot id ${snapshot.id}`);
    seen.add(snapshot.id);
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
const telemetryVisibilities = new Set(['visible', 'partial', 'hidden']);
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
  // 归档目录（扁平 task-NN-<slug>/；重复运行为 runs/<run-id>/）必须真实存在
  if (run.directory) {
    if (!/^Test_Results\/[\w.-]+\/phase-\d{2}\/(task-\d+-[a-z0-9-]+|runs\/[\w.-]+)$/.test(run.directory)) fail(`${run.id}: unexpected archive directory ${run.directory}`);
    if (!fs.existsSync(path.resolve(repoRoot, run.directory))) fail(`${run.id}: missing archive directory ${run.directory}`);
  }
  if (run.prompt) {
    if (!/^[0-9a-f]{64}$/.test(run.prompt.sha256 ?? '')) fail(`${run.id}: prompt.sha256 must be a 64-char hex digest`);
    if (!fs.existsSync(path.resolve(repoRoot, run.prompt.path))) fail(`${run.id}: missing prompt file ${run.prompt.path}`);
  }
  const reportedModelId = run.environment?.reportedModelId ?? null;
  if (reportedModelId) {
    const declared = modelById.get(run.modelId)?.snapshots ?? [];
    if (!declared.some((snapshot) => snapshot.id === reportedModelId)) {
      fail(`${run.id}: reported model id ${reportedModelId} is not declared as a snapshot of ${run.modelId}`);
    }
  }
  if (run.isolation && !isolationLevels.has(run.isolation.level)) fail(`${run.id}: invalid isolation level ${run.isolation.level}`);
  if (run.contamination && !contaminationStatuses.has(run.contamination.status)) fail(`${run.id}: invalid contamination status ${run.contamination.status}`);
  if (run.contamination?.telemetry != null) {
    if (!telemetryVisibilities.has(run.contamination.telemetry)) fail(`${run.id}: invalid contamination telemetry ${run.contamination.telemetry}`);
    // 无工具遥测的运行必须写明「默认视为遵守规则」，不能被写成已审查结论
    if (run.contamination.telemetry === 'hidden' && !/默认视为遵守规则/.test(run.contamination.note ?? '')) {
      fail(`${run.id}: hidden tool-call telemetry must state the assumed-compliant rule in contamination.note`);
    }
  }
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
  // 评价文件可能与运行不在同一提交入库；必须自报所在提交，否则源码链接会指向 404。
  if (!/^[0-9a-f]{40}$/.test(review.commit ?? '')) fail(`${review.id}: review.commit must be the full SHA the review file was archived in`);
}

for (const batch of catalog.batches) {
  if (!modelIds.has(batch.modelId)) fail(`batch ${batch.id}: unknown model ${batch.modelId}`);
  if (!phaseIds.has(batch.phaseId)) fail(`batch ${batch.id}: unknown phase ${batch.phaseId}`);
  for (const [key, value] of Object.entries(batch.metrics)) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) fail(`batch ${batch.id}: invalid metric ${key}=${value}`);
  }
  if (!batch.source?.path) fail(`batch ${batch.id}: missing source`);
  if (!/^[0-9a-f]{40}$/.test(batch.commit ?? '')) fail(`batch ${batch.id}: batch.commit must be the full SHA the batch source was archived in`);
}

for (const assessment of catalog.assessments) {
  if (!modelIds.has(assessment.modelId)) fail(`assessment ${assessment.id}: unknown model ${assessment.modelId}`);
  if (!phaseIds.has(assessment.phaseId)) fail(`assessment ${assessment.id}: unknown phase ${assessment.phaseId}`);
  if (assessment.score !== null && (!Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > 100)) fail(`assessment ${assessment.id}: invalid score`);
  if (!assessment.source?.path) fail(`assessment ${assessment.id}: missing source`);
  if (!/^[0-9a-f]{40}$/.test(assessment.commit ?? '')) fail(`assessment ${assessment.id}: assessment.commit must be the full SHA the report was archived in`);
  // 免责声明必须双语：中文页此前显示英文段落。
  if (!assessment.disclaimer?.zh || !assessment.disclaimer?.en) fail(`assessment ${assessment.id}: disclaimer must be bilingual`);
}

// ---- 首批档案回归基线（独立于上面的通用校验，防止接入新数据时被悄悄改动） ----
const phaseOfRun = (run) => taskById.get(run.taskId)?.phaseId;
const phase1Tasks = catalog.tasks.filter((task) => task.phaseId === 'phase-01');
if (phase1Tasks.length !== 15) fail(`Phase 1 regression: expected 15 phase-01 tasks, found ${phase1Tasks.length}`);
const deepseekRuns = catalog.runs.filter((run) => run.modelId === 'deepseek-v4-1-flash-exp-0910' && phaseOfRun(run) === 'phase-01');
const deepseekReviews = catalog.reviews.filter((review) => deepseekRuns.some((run) => run.id === review.runId));
if (deepseekRuns.length !== 15) fail(`Phase 1 regression: expected 15 phase-01 DeepSeek runs, found ${deepseekRuns.length}`);
if (deepseekReviews.length !== 30) fail(`Phase 1 regression: expected 30 phase-01 DeepSeek reviews, found ${deepseekReviews.length}`);
const museRuns = catalog.runs.filter((run) => run.modelId === 'muse-spark-1-3' && phaseOfRun(run) === 'phase-01');
if (museRuns.length !== 15) fail(`Muse regression: expected 15 phase-01 Muse runs, found ${museRuns.length}`);
const museReviews = catalog.reviews.filter((review) => museRuns.some((run) => run.id === review.runId));
if (museReviews.length !== 45) fail(`Muse regression: expected 45 phase-01 Muse reviews (1 human + 2 AI per run), found ${museReviews.length}`);
// GPT-5.6 Sol 第一阶段：15 题与另两个模型同题（task-01…15@1），每题 1 份 AI 评价（maintenance-agent-v3）
const gptRuns = catalog.runs.filter((run) => run.modelId === 'gpt-5-6-sol');
if (gptRuns.length === 0) fail('GPT regression: no archived GPT-5.6 Sol runs');
for (const run of gptRuns) {
  const task = taskById.get(run.taskId);
  if (task.phaseId !== 'phase-01') fail(`${run.id}: GPT runs must attach to phase-01 tasks (shared task set)`);
  if (run.environment?.reportedModelId !== 'gpt-5.6-sol') fail(`${run.id}: missing harness-reported snapshot id`);
  const reviews = catalog.reviews.filter((review) => review.runId === run.id);
  if (reviews.length !== 1) fail(`${run.id}: expected exactly one archived review, found ${reviews.length}`);
  const [review] = reviews;
  if (review.type !== 'ai') fail(`${run.id}: the archived review must be an AI review`);
  if (review.score == null || !review.scoreMethod) fail(`${run.id}: AI review needs a score and a score method`);
  if (!review.conclusion?.zh || !review.conclusion?.en) fail(`${run.id}: review conclusion must be bilingual`);
  if (run.contamination?.telemetry === 'hidden') fail(`${run.id}: Codex CLI records tool calls, telemetry must not be marked hidden`);
}

// Muse 第二阶段：每运行恰好 1 份 AI 评价（maintenance-agent-v2），本批尚未产出人工评价
const musePhase2Runs = catalog.runs.filter((run) => run.modelId === 'muse-spark-1-3' && phaseOfRun(run) === 'phase-02');
if (musePhase2Runs.length === 0) fail('Muse phase-2 regression: no archived Muse phase-02 runs');
for (const run of musePhase2Runs) {
  const reviews = catalog.reviews.filter((review) => review.runId === run.id);
  if (reviews.length !== 1) fail(`${run.id}: expected exactly one archived review, found ${reviews.length}`);
  const [review] = reviews;
  if (review.type !== 'ai') fail(`${run.id}: the archived review must be an AI review (no human review yet)`);
  if (review.score == null || !review.scoreMethod) fail(`${run.id}: AI review needs a score and a score method`);
  if (!review.conclusion?.zh || !review.conclusion?.en) fail(`${run.id}: review conclusion must be bilingual`);
  if (run.isolation?.level !== 'workspace-only') fail(`${run.id}: Muse phase-02 runs must record isolation.level=workspace-only`);
}

// ---- 第二阶段（Task 16–20）：已归档运行必须仍在；新增题目只增不改 ----
const phase2Tasks = catalog.tasks.filter((task) => task.phaseId === 'phase-02');
if (phase2Tasks.length === 0) fail('Phase 2 regression: no phase-02 tasks in catalog');
const phase2Runs = catalog.runs.filter((run) => phaseOfRun(run) === 'phase-02');
for (const id of [
  'run-deepseek-v4-1-flash-exp-0910-task-16-r1', 'run-deepseek-v4-1-flash-exp-0910-task-17-r1',
  'run-deepseek-v4-1-flash-exp-0910-task-18-r1', 'run-deepseek-v4-1-flash-exp-0910-task-19-r1',
  'run-deepseek-v4-1-flash-exp-0910-task-20-r1',
]) {
  if (!phase2Runs.some((run) => run.id === id)) fail(`Phase 2 regression: missing archived run ${id}`);
}
for (const run of phase2Runs) {
  if (run.isolation?.level !== 'workspace-only') fail(`${run.id}: phase-02 runs must record isolation.level=workspace-only`);
  if (!run.prompt?.sha256) fail(`${run.id}: phase-02 runs must record the verbatim prompt hash`);
  if (!run.evidence?.audit) fail(`${run.id}: phase-02 runs must link the boundary audit evidence`);
  if (!run.environment?.reportedModelId) fail(`${run.id}: phase-02 runs must record the harness-reported model id (snapshot)`);
}

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

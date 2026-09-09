import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteRoot, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/catalog.json'), 'utf8'));
const fail = (message) => { throw new Error(message); };
const unique = (items, label) => {
  const seen = new Set();
  for (const item of items) { if (!item.id) fail(`${label}: missing id`); if (seen.has(item.id)) fail(`${label}: duplicate id ${item.id}`); seen.add(item.id); }
  return seen;
};
const phaseIds = unique(catalog.phases, 'phase');
const taskIds = unique(catalog.tasks, 'task');
const modelIds = unique(catalog.models, 'model');
const runIds = unique(catalog.runs, 'run');
unique(catalog.reviews, 'review');
if (catalog.tasks.length !== 15 || catalog.runs.length !== 15) fail('Production catalog must contain exactly 15 archived tasks and runs.');
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
for (const run of catalog.runs) {
  if (!modelIds.has(run.modelId) || !taskIds.has(run.taskId)) fail(`${run.id}: broken relationship`);
  if (!['svg', 'html'].includes(run.artifact.type)) fail(`${run.id}: invalid artifact type`);
  for (const file of run.artifact.files) {
    if (path.isAbsolute(file) || file.split('/').includes('..')) fail(`${run.id}: unsafe file path ${file}`);
    const source = path.resolve(repoRoot, run.artifact.sourcePath, file);
    if (!source.startsWith(path.resolve(repoRoot, run.artifact.sourcePath) + path.sep)) fail(`${run.id}: path escaped archive`);
    if (!fs.existsSync(source)) fail(`${run.id}: missing file ${file}`);
  }
  for (const [key, value] of Object.entries(run.metrics)) if (key !== 'durationLabel' && (!Number.isFinite(value) || value < 0)) fail(`${run.id}: invalid metric ${key}`);
}
for (const review of catalog.reviews) {
  if (!runIds.has(review.runId)) fail(`${review.id}: missing run ${review.runId}`);
  if (!review.conclusion?.zh || !review.conclusion?.en) fail(`${review.id}: conclusion must be non-empty in both locales`);
  if (review.type === 'ai' && (review.score == null || !review.scoreMethod)) fail(`${review.id}: AI review needs a score and a score method`);
}
console.log('Data validation passed: 15 tasks, 15 runs, 30 independent reviews.');

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/extension-catalog.json', import.meta.url)));

const runsOf = (modelId) => catalog.runs.filter((run) => run.modelId === modelId);
const reviewsOf = (runs) => catalog.reviews.filter((review) => runs.some((run) => run.id === review.runId));

test('production data keeps the Phase 1 regression baseline', () => {
  const deepseek = runsOf('deepseek-v4-1-flash-exp-0910');
  assert.equal(catalog.tasks.length, 15);
  assert.equal(new Set(catalog.tasks.map((task) => task.id)).size, 15);
  assert.equal(deepseek.length, 15, 'DeepSeek Phase 1 runs');
  assert.equal(reviewsOf(deepseek).length, 30, 'DeepSeek Phase 1 reviews');
  assert.equal(catalog.tasks[0].promptOriginal, 'Build a beautiful landing page for a fictional luxury watch brand called "Aevum".\nUse only HTML, CSS and JavaScript.\nDo not use external images or libraries.\nMake it feel like a real premium product website.');
  assert.deepEqual(catalog.reviews.filter((review) => review.runId.includes('deepseek') && review.runId.includes('task-06')).map((review) => review.type).sort(), ['ai', 'human']);
});

test('Muse Spark Phase 1 is imported with prompts, isolation and every archived AI review', () => {
  const muse = runsOf('muse-spark-1-3');
  assert.equal(muse.length, 15);
  assert.equal(reviewsOf(muse).length, 45, '1 human + 2 AI reviews per run');
  for (const run of muse) {
    assert.equal(run.taskVersion, 1);
    assert.equal(run.prompt?.provenance, 'post-hoc-reconstruction');
    assert.match(run.prompt.sha256, /^[0-9a-f]{64}$/);
    assert.equal(run.isolation.level, 'workspace-only');
    assert.equal(run.contamination.status, 'clean');
    const reviews = catalog.reviews.filter((review) => review.runId === run.id);
    assert.equal(reviews.length, 3, `${run.id}: expected human + two AI reviews`);
    assert.deepEqual(reviews.map((review) => review.type).sort(), ['ai', 'ai', 'human']);
    assert.deepEqual(
      [...new Set(reviews.filter((review) => review.type === 'ai').map((review) => review.id.split('-r1-').slice(1).join('-r1-')))].sort(),
      ['codex-v1', 'maintenance-agent-v1'],
      `${run.id}: both AI evaluators must be present`,
    );
  }
});

test('every task keeps a bilingual verification list and every review keeps both conclusions', () => {
  for (const task of catalog.tasks) {
    assert.ok(task.verification.zh.length > 0, `${task.id}: empty zh verification`);
    assert.equal(task.verification.en.length, task.verification.zh.length, `${task.id}: verification zh/en length mismatch`);
    assert.ok(task.expectedOutcome.zh && task.expectedOutcome.en, `${task.id}: expected outcome not bilingual`);
  }
  for (const review of catalog.reviews) {
    assert.ok(review.conclusion.zh, `${review.id}: empty zh conclusion`);
    assert.ok(review.conclusion.en, `${review.id}: empty en conclusion`);
    assert.ok(review.body.zh && review.body.en, `${review.id}: empty body`);
  }
});

test('every run keeps its own archive commit and no cross-version run sneaks in', () => {
  for (const run of catalog.runs) {
    assert.match(run.artifact.commit, /^[0-9a-f]{40}$/, `${run.id}: commit`);
    const task = catalog.tasks.find((item) => item.id === run.taskId);
    assert.equal(task.version, run.taskVersion, `${run.id}: task version mismatch`);
  }
  const commits = new Set(catalog.runs.map((run) => run.artifact.commit));
  assert.equal(commits.size, 2, 'each batch binds its own archive commit');
});

test('fixture-only phase, model and repeat run expand without component changes', () => {
  const expanded = { phases: [...catalog.phases, ...fixture.phases], models: [...catalog.models, ...fixture.models], tasks: [...catalog.tasks, ...fixture.tasks], runs: [...catalog.runs, ...fixture.runs] };
  assert.equal(expanded.phases.length, catalog.phases.length + 1);
  assert.equal(expanded.models.length, catalog.models.length + 1);
  assert.equal(expanded.tasks.length, catalog.tasks.length + 1);
  assert.equal(expanded.runs.filter((run) => run.taskId === 'task-01').length, runsOf('deepseek-v4-1-flash-exp-0910').filter((run) => run.taskId === 'task-01').length + runsOf('muse-spark-1-3').filter((run) => run.taskId === 'task-01').length + 1);
  assert.equal(catalog.models.length, 2);
});

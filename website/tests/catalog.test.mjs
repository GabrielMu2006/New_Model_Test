import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/extension-catalog.json', import.meta.url)));

const phaseOf = (run) => catalog.tasks.find((task) => task.id === run.taskId)?.phaseId;
const runsOf = (modelId, phaseId) => catalog.runs.filter((run) => run.modelId === modelId && (!phaseId || phaseOf(run) === phaseId));
const reviewsOf = (runs) => catalog.reviews.filter((review) => runs.some((run) => run.id === review.runId));

test('production data keeps the Phase 1 regression baseline', () => {
  const phase1Tasks = catalog.tasks.filter((task) => task.phaseId === 'phase-01');
  const deepseek = runsOf('deepseek-v4-1-flash-exp-0910', 'phase-01');
  assert.equal(phase1Tasks.length, 15);
  assert.equal(new Set(phase1Tasks.map((task) => task.id)).size, 15);
  assert.equal(deepseek.length, 15, 'DeepSeek Phase 1 runs');
  assert.equal(reviewsOf(deepseek).length, 30, 'DeepSeek Phase 1 reviews');
  assert.equal(phase1Tasks[0].promptOriginal, 'Build a beautiful landing page for a fictional luxury watch brand called "Aevum".\nUse only HTML, CSS and JavaScript.\nDo not use external images or libraries.\nMake it feel like a real premium product website.');
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
  // 每个批次（模型 + 阶段）绑定自己的归档提交，不同批次不共用提交
  const byBatch = new Map();
  for (const run of catalog.runs) {
    const key = `${run.modelId}|${phaseOf(run)}`;
    const commits = byBatch.get(key) ?? new Set();
    commits.add(run.artifact.commit);
    byBatch.set(key, commits);
  }
  const used = new Set();
  for (const [key, commits] of byBatch) {
    assert.equal(commits.size, 1, `${key}: runs of one batch must share one archive commit`);
    used.add([...commits][0]);
  }
  assert.equal(used.size, byBatch.size, 'each batch binds its own archive commit');
});

test('Phase 2 runs are imported with verbatim prompts, audit evidence and unchanged scoring', () => {
  const phase2Runs = catalog.runs.filter((run) => phaseOf(run) === 'phase-02');
  assert.ok(phase2Runs.length >= 5, 'Task 16-20 must be imported');
  for (const run of phase2Runs) {
    assert.equal(run.taskVersion, 1);
    assert.equal(run.status, 'completed');
    assert.equal(run.isolation.level, 'workspace-only');
    assert.match(run.prompt.sha256, /^[0-9a-f]{64}$/, `${run.id}: prompt hash`);
    assert.ok(run.artifact.files.includes(run.artifact.entry), `${run.id}: entry not published`);
    assert.ok(run.evidence?.audit?.endsWith('.md'), `${run.id}: boundary audit must be linked`);
    assert.ok(['unknown', 'suspected', 'contaminated'].includes(run.contamination.status));
    assert.ok(catalog.tasks.some((task) => task.id === run.taskId && task.phaseId === 'phase-02'));
  }
  // 边界尝试只记入档案，不排除运行、不改分
  const suspected = phase2Runs.filter((run) => run.contamination.status === 'suspected');
  assert.deepEqual(suspected.map((run) => run.taskId).sort(), ['task-17', 'task-20']);
  for (const run of suspected) {
    assert.equal(run.contamination.confirmedExternalAnswers, false, `${run.id}: not a confirmed cheat`);
    assert.ok(String(run.contamination.scoringEffect).startsWith('none'), `${run.id}: scoring is unaffected`);
    assert.ok(run.contamination.note.includes('不影响成绩'));
  }
  for (const run of phase2Runs) {
    assert.equal(run.contamination.confirmedExternalAnswers, false, `${run.id}: nothing flagged as confirmed cheating`);
  }
  // 组织者的补充轮输入逐字保留
  const followups = phase2Runs.flatMap((run) => run.followups ?? []);
  assert.equal(followups.length, 1);
  assert.equal(followups[0].verbatim, '不要再读取chrome钥匙串了');
});

test('fixture-only phase, model and repeat run expand without component changes', () => {
  const expanded = { phases: [...catalog.phases, ...fixture.phases], models: [...catalog.models, ...fixture.models], tasks: [...catalog.tasks, ...fixture.tasks], runs: [...catalog.runs, ...fixture.runs] };
  assert.equal(expanded.phases.length, catalog.phases.length + 1);
  assert.equal(expanded.models.length, catalog.models.length + 1);
  assert.equal(expanded.tasks.length, catalog.tasks.length + 1);
  assert.equal(expanded.runs.filter((run) => run.taskId === 'task-01').length, runsOf('deepseek-v4-1-flash-exp-0910').filter((run) => run.taskId === 'task-01').length + runsOf('muse-spark-1-3').filter((run) => run.taskId === 'task-01').length + 1);
  assert.equal(catalog.models.length, 2);
});

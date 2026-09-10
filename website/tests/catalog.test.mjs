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

test('Muse phase-02 runs carry exactly one independent AI review and no fabricated human review', () => {
  const musePhase2 = catalog.runs.filter((run) => run.modelId === 'muse-spark-1-3' && phaseOf(run) === 'phase-02');
  assert.ok(musePhase2.length >= 5, 'Muse Task 16-20 must be imported');
  const scores = [];
  for (const run of musePhase2) {
    const reviews = catalog.reviews.filter((review) => review.runId === run.id);
    assert.equal(reviews.length, 1, `${run.id}: exactly one archived review`);
    assert.equal(reviews[0].type, 'ai');
    assert.equal(reviews[0].authorLabel, '维护 agent v2（AI，非盲评）');
    assert.ok(reviews[0].score > 0 && reviews[0].score <= 100);
    assert.ok(reviews[0].scoreMethod, `${run.id}: score method must be recorded`);
    assert.ok(reviews[0].conclusion.zh && reviews[0].conclusion.en);
    // 评价放阶段级 Reviews/（不是任务目录内），逐题文件命名 task-NN.md
    assert.match(reviews[0].source.path, /^Test_Results\/Muse-Spark-1\.3_Opencode\/phase-02\/Reviews\/ai\/maintenance-agent-v2\/task-\d\d\.md$/);
    assert.equal(run.environment.reportedModelId, 'muse-spark-1.3-contributor-free');
    scores.push(reviews[0].score);
  }
  assert.equal(scores.reduce((sum, value) => sum + value, 0) / scores.length, 88.2, 'phase average stays 88.2');
  // 同题对比的基础：DeepSeek 与 Muse 在 task-16 上都有 phase-02 运行
  for (const taskId of ['task-16', 'task-17', 'task-18', 'task-19', 'task-20']) {
    const models = new Set(catalog.runs.filter((run) => run.taskId === taskId).map((run) => run.modelId));
    assert.deepEqual([...models].sort(), ['deepseek-v4-1-flash-exp-0910', 'muse-spark-1-3'], `${taskId}: both models must be comparable`);
  }
});

test('model identity is bilingual and snapshots stay traceable per run', () => {
  for (const model of catalog.models) {
    assert.ok(model.name.zh && model.name.en, `${model.id}: model name must be bilingual`);
  }
  const deepseek = catalog.models.find((model) => model.id === 'deepseek-v4-1-flash-exp-0910');
  const snapshotIds = (deepseek.snapshots ?? []).map((snapshot) => snapshot.id);
  assert.ok(snapshotIds.includes('deepseek-v4.1-flash-expires-on-0910'), 'the retired preview snapshot must be declared');
  assert.ok(snapshotIds.includes(null), 'the GA snapshot stays pending until a run reports its id');
  for (const run of catalog.runs) {
    const model = catalog.models.find((item) => item.id === run.modelId);
    const reported = run.environment?.reportedModelId ?? null;
    if (reported === null) continue;
    assert.ok((model.snapshots ?? []).some((snapshot) => snapshot.id === reported), `${run.id}: undeclared snapshot ${reported}`);
  }
  for (const run of runsOf('deepseek-v4-1-flash-exp-0910', 'phase-02')) {
    assert.equal(run.environment.reportedModelId, 'deepseek-v4.1-flash-expires-on-0910');
  }
  for (const run of runsOf('deepseek-v4-1-flash-exp-0910', 'phase-01')) assert.equal(run.environment.reportedModelId, null);
  // 同模型多批次必须全部保留（曾只取第一个批次，导致模型页统计停留在 Phase 1）
  assert.equal(catalog.batches.filter((batch) => batch.modelId === 'deepseek-v4-1-flash-exp-0910').length, 2);
});

test('Muse Spark Phase 1 is imported with prompts, isolation and every archived AI review', () => {
  const muse = runsOf('muse-spark-1-3', 'phase-01');
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
    // 扁平布局：目录名是 task-NN-<slug>，runId 只在 submission.json 里
    assert.match(run.directory, /\/phase-02\/task-\d\d-[a-z0-9-]+$/, `${run.id}: flat task directory expected`);
    assert.ok(!run.directory.includes(run.id), `${run.id}: the runId must not be the directory name`);
    assert.equal(fs.existsSync(new URL(`../../${run.directory}`, import.meta.url)), true, `${run.id}: archive directory missing`);
    assert.equal(run.taskVersion, 1);
    assert.equal(run.status, 'completed');
    assert.equal(run.isolation.level, 'workspace-only');
    assert.match(run.prompt.sha256, /^[0-9a-f]{64}$/, `${run.id}: prompt hash`);
    assert.ok(run.artifact.files.includes(run.artifact.entry), `${run.id}: entry not published`);
    assert.match(run.evidence?.audit ?? '', /\.(md|json)$/, `${run.id}: boundary audit evidence must be linked`);
    assert.ok(['clean', 'unknown', 'suspected', 'contaminated'].includes(run.contamination.status));
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

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

test('GPT-5.6 Sol runs share the phase-1 task set and carry one independent AI review', () => {
  const gpt = catalog.runs.filter((run) => run.modelId === 'gpt-5-6-sol');
  assert.equal(gpt.length, 15);
  const gptScores = [];
  for (const run of gpt) {
    const task = catalog.tasks.find((item) => item.id === run.taskId);
    assert.equal(task.phaseId, 'phase-01', `${run.id}: GPT must reuse the shared phase-1 tasks`);
    assert.equal(run.taskVersion, 1);
    assert.equal(run.environment.reportedModelId, 'gpt-5.6-sol');
    assert.equal(run.isolation.level, 'workspace-only');
    assert.match(run.prompt.sha256, /^[0-9a-f]{64}$/);
    const reviews = catalog.reviews.filter((review) => review.runId === run.id);
    assert.equal(reviews.length, 1, `${run.id}: one AI review expected`);
    assert.equal(reviews[0].type, 'ai');
    assert.equal(reviews[0].authorLabel, '维护 agent v3（AI，非盲评）');
    assert.ok(reviews[0].score > 0 && reviews[0].score <= 100);
    assert.match(reviews[0].source.path, /^Test_Results\/GPT-5\.6-Sol_Codex\/phase-01\/Reviews\/ai\/maintenance-agent-v3\/task-\d\d\.md$/);
    gptScores.push(reviews[0].score);
  }
  // 阶段评估：由逐题评价求平均（82.9），模型索引页据此显示 AI 均分
  const gptAssessment = catalog.assessments.find((item) => item.id === 'assessment-gpt-5-6-sol-phase-01-maintenance-agent-v3');
  assert.ok(gptAssessment, 'the maintenance-agent-v3 phase assessment must exist');
  assert.equal(gptAssessment.score, 82.9);
  assert.equal(Number((gptScores.reduce((sum, value) => sum + value, 0) / gptScores.length).toFixed(1)), gptAssessment.score);
  assert.match(gptAssessment.source.path, /^Test_Results\/GPT-5\.6-Sol_Codex\/phase-01\/Reviews\/ai\/maintenance-agent-v3\/phase-summary\.md$/);
  assert.equal(gptAssessment.commit, '92815760057a3b1de14b7f5a3f050e7345936e57');
  // 第一阶段同题现在有四个模型，可直接并排对比
  for (const taskId of ['task-01', 'task-12', 'task-15']) {
    const models = new Set(catalog.runs.filter((run) => run.taskId === taskId).map((run) => run.modelId));
    assert.deepEqual([...models].sort(), ['deepseek-v4-1-flash-exp-0910', 'gpt-5-6-sol', 'k3', 'muse-spark-1-3'], `${taskId}: four models must be comparable`);
  }
});

test('K3 runs share the phase-1 task set and carry one independent AI review', () => {
  const k3 = runsOf('k3', 'phase-01');
  assert.equal(k3.length, 15);
  const scores = [];
  for (const run of k3) {
    const task = catalog.tasks.find((item) => item.id === run.taskId);
    assert.equal(task.phaseId, 'phase-01', `${run.id}: K3 must reuse the shared phase-1 tasks`);
    assert.equal(run.taskVersion, 1);
    assert.equal(run.environment.harness, 'Kimi Code CLI');
    assert.equal(run.environment.reasoningEffort, 'max');
    assert.equal(run.environment.reportedModelId, 'k3');
    assert.equal(run.isolation.level, 'workspace-only');
    assert.equal(run.contamination.telemetry, 'visible');
    assert.match(run.prompt.sha256, /^[0-9a-f]{64}$/);
    const reviews = catalog.reviews.filter((review) => review.runId === run.id);
    assert.equal(reviews.length, 1, `${run.id}: one AI review expected`);
    assert.equal(reviews[0].type, 'ai');
    assert.equal(reviews[0].authorLabel, '维护 agent v4（AI，非盲评）');
    assert.ok(reviews[0].score > 0 && reviews[0].score <= 100);
    assert.match(reviews[0].source.path, /^Test_Results\/K3_KimiCode\/phase-01\/Reviews\/ai\/maintenance-agent-v4\/task-\d\d\.md$/);
    assert.equal(reviews[0].commit, '1afdc8cacbb8651cd2aa3939aab2be66a77030ba');
    scores.push(reviews[0].score);
  }
  assert.equal(Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1)), 93.3, 'phase average stays 93.3');
  // 归档未自带截图的 HTML 运行按约定回落到 capture:covers 产出的封面
  for (const run of k3) {
    if (run.artifact.type === 'html') assert.equal(run.artifact.cover, `covers/${run.id}.png`);
    else assert.equal(run.artifact.cover, null);
  }
});

test('DeepSeek phase-2 runs carry the split muse-spark-v1 review', () => {
  const runs = runsOf('deepseek-v4-1-flash-exp-0910', 'phase-02');
  assert.equal(runs.length, 5);
  const scores = [];
  for (const run of runs) {
    const reviews = catalog.reviews.filter((review) => review.runId === run.id);
    assert.equal(reviews.length, 1, `${run.id}: exactly one AI review expected`);
    assert.equal(reviews[0].authorLabel, 'Muse Spark 1.3（AI，非盲评）');
    assert.match(reviews[0].source.path, /\/Reviews\/ai\/muse-spark-v1\/task-\d\d\.md$/);
    assert.ok(reviews[0].scoreMethod);
    scores.push(reviews[0].score);
  }
  assert.equal(scores.reduce((sum, value) => sum + value, 0) / scores.length, 91);
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
  // 每个批次内部必须只绑定一个提交；同一次提交可以同时承载多个批次
  // （2026-09-10 两个 phase-02 批次就是在同一次提交里改为扁平布局的）。
  assert.ok(used.size >= 1 && used.size <= byBatch.size, `distinct archive commits ${used.size} exceed batches ${byBatch.size}`);
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

test('every source link can be pinned to the commit the file was archived in', () => {
  // 归档分批入库：评价 / 批次 / 阶段报告可能与运行不在同一提交。
  // 自报提交 + 逐文件核对，避免生成「页面正常、点开 404」的源码链接。
  for (const review of catalog.reviews) {
    assert.match(review.commit, /^[0-9a-f]{40}$/, `${review.id}: review.commit`);
  }
  for (const batch of catalog.batches) {
    assert.match(batch.commit, /^[0-9a-f]{40}$/, `${batch.id}: batch.commit`);
  }
  for (const assessment of catalog.assessments) {
    assert.match(assessment.commit, /^[0-9a-f]{40}$/, `${assessment.id}: assessment.commit`);
  }
  // codex-v1 是本阶段之后才归档的：它必须绑定自己的提交，不能沿用阶段提交。
  const codexReviews = catalog.reviews.filter((review) => review.id.includes('codex-v1'));
  assert.equal(codexReviews.length, 15);
  for (const review of codexReviews) {
    assert.equal(review.commit, 'cf9382fc1b51a614c1d632e4f300af7cf03de88c', `${review.id}: must use the commit that added codex-v1`);
    assert.notEqual(review.commit, catalog.runs.find((run) => run.id === review.runId).artifact.commit);
  }
  const museCodexAssessment = catalog.assessments.find((assessment) => assessment.id.endsWith('codex-v1'));
  assert.equal(museCodexAssessment.commit, 'cf9382fc1b51a614c1d632e4f300af7cf03de88c');
  // 阶段报告与批次源文件同样按自己所在的提交绑定（此前沿用阶段内第一条运行的提交 → 404）。
  for (const batch of catalog.batches) {
    const firstRunOfModel = catalog.runs.find((run) => run.modelId === batch.modelId);
    if (batch.phaseId === 'phase-02') assert.notEqual(batch.commit, firstRunOfModel.artifact.commit, `${batch.id}: phase-02 batch must not reuse the phase-01 run commit`);
  }
});

test('batch aggregates never turn a missing per-task value into zero', () => {
  // opencode 日志不记 API 调用数 → Muse phase-02 每题 apiCalls 都是 null；
  // 求和不做 null 判定就会把「未记录」写成 0。
  const musePhase2 = catalog.batches.find((batch) => batch.id === 'batch-muse-spark-1-3-phase-02-partial');
  assert.equal(musePhase2.metrics.apiCalls, null, 'unknown API counts must stay null, not 0');
  const sumKeys = ['durationSeconds', 'apiCalls', 'toolCalls', 'failures', 'inputTokens', 'outputTokens', 'cacheReadTokens'];
  for (const batch of catalog.batches) {
    const runs = catalog.runs.filter((run) => run.modelId === batch.modelId && phaseOf(run) === batch.phaseId);
    assert.ok(runs.length, `${batch.id}: batch must own at least one run`);
    for (const key of sumKeys) {
      if (runs.some((run) => run.metrics[key] == null)) {
        assert.equal(batch.metrics[key], null, `${batch.id}: ${key} must stay null when a per-task value is missing`);
      } else {
        assert.equal(batch.metrics[key], runs.reduce((sum, run) => sum + run.metrics[key], 0), `${batch.id}: ${key} must sum every per-task value`);
      }
    }
  }
});

test('fixture-only phase, model and repeat run expand without component changes', () => {
  const expanded = { phases: [...catalog.phases, ...fixture.phases], models: [...catalog.models, ...fixture.models], tasks: [...catalog.tasks, ...fixture.tasks], runs: [...catalog.runs, ...fixture.runs] };
  assert.equal(expanded.phases.length, catalog.phases.length + 1);
  assert.equal(expanded.models.length, catalog.models.length + 1);
  assert.equal(expanded.tasks.length, catalog.tasks.length + 1);
  // 同题重复运行只增加一条，不影响其它模型（模型数由实体推导，不写死）
  assert.equal(
    expanded.runs.filter((run) => run.taskId === 'task-01').length,
    catalog.runs.filter((run) => run.taskId === 'task-01').length + 1,
  );
  assert.ok(catalog.models.length >= 3, 'each archived model must be in the catalog');
});

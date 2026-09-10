import catalogData from '../../data/catalog.json';

export const catalog = catalogData;
export type Locale = 'zh' | 'en';
export type Task = (typeof catalog.tasks)[number];
export type Run = (typeof catalog.runs)[number];
export type Review = (typeof catalog.reviews)[number];
export type Model = (typeof catalog.models)[number];
export type Batch = (typeof catalog.batches)[number];
export type Assessment = (typeof catalog.assessments)[number];

export const locales: Locale[] = ['zh', 'en'];
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (locale: Locale, path = '') => `${base}/${locale}/${path}`.replace(/(?<!:)\/+/g, '/');
export const asset = (path: string) => `${base}/${path}`.replace(/(?<!:)\/+/g, '/');

/**
 * 生成固定版本的源码链接。每个来源绑定自己的提交：默认使用全局 archiveCommit，
 * 调用方应传入 run.artifact.commit / run.prompt 所在批次的提交。
 * 仅当提交与映射条目一致时才套用历史路径映射（第一阶段目录迁移）。
 */
export const sourceUrl = (path: string, lines?: string | null, commit?: string) => {
  const anchor = lines ? `#L${lines.split(/[-,]/)[0]}` : '';
  const target = commit ?? catalog.archiveCommit;
  const mapping = catalog.sourcePathMappings.find(
    (entry) => entry.commit === target
      && (entry.current.endsWith('/') ? path.startsWith(entry.current) : path === entry.current),
  );
  const archivedPath = mapping ? mapping.archived + path.slice(mapping.current.length) : path;
  return `${catalog.repository}/blob/${target}/${encodeURI(archivedPath)}${anchor}`;
};

export const taskById = (id?: string) => catalog.tasks.find((task) => task.id === id);
export const runById = (id?: string) => catalog.runs.find((run) => run.id === id);
export const modelById = (id?: string) => catalog.models.find((model) => model.id === id);
/**
 * 源码链接必须绑定「该文件所在的提交」。归档是分批入库的：同一阶段的评价、
 * 证据或 README 可能晚于运行本身归档，直接用运行的提交会生成 404 链接。
 * 实体自带 commit 时以它为准，否则回落到调用方给的提交（通常是运行/批次自己的）。
 */
export const entityCommit = (entity: { commit?: string | null } | null | undefined, fallback?: string | null) =>
  entity?.commit ?? fallback ?? catalog.archiveCommit;
export const reviewsFor = (runId: string) => catalog.reviews.filter((review) => review.runId === runId);
export const runsForTask = (taskId: string, taskVersion?: number) => catalog.runs.filter(
  (run) => run.taskId === taskId && (taskVersion === undefined || run.taskVersion === taskVersion),
);
export const runsForModel = (modelId: string) => catalog.runs.filter((run) => run.modelId === modelId);
export const batchForModel = (modelId: string) => catalog.batches.find((batch) => batch.modelId === modelId);
/** 同一模型可能有多个批次（多阶段 / 多快照），展示时必须全部列出，不能只取第一个。 */
export const batchesForModel = (modelId: string) => catalog.batches.filter((batch) => batch.modelId === modelId);
/** 模型声明的快照（harness 报告的 model id）；未声明时返回空数组。 */
export const snapshotsForModel = (modelId: string) => modelById(modelId)?.snapshots ?? [];
export const assessmentsForModel = (modelId: string) => catalog.assessments.filter((assessment) => assessment.modelId === modelId);
/**
 * 模型索引页用的 AI 阶段评估概览。
 * 2026-09-10 组织者决定：索引页显示该模型 AI 阶段评估的**简单均分**，点进模型页可看到各评委的逐份评分。
 * 均分只作概览——各评委口径不同，不得据此排序或做跨模型排行榜。
 */
export const assessmentSummary = (modelId: string) => {
  const list = assessmentsForModel(modelId);
  const scored = list.filter((assessment) => assessment.score != null);
  const average = scored.length
    ? Math.round(scored.reduce((sum, assessment) => sum + assessment.score, 0) / scored.length * 10) / 10
    : null;
  return { count: list.length, scored: scored.length, average };
};
export const tasksForModel = (modelId: string) => {
  const ids = new Set(runsForModel(modelId).map((run) => run.taskId));
  return catalog.tasks.filter((task) => ids.has(task.id));
};
/** 每个任务 × 每个模型的运行卡片（同题对比的入口）。 */
export const runCards = () => catalog.tasks.flatMap((task) => catalog.models.flatMap((model) => {
  const run = catalog.runs.find((item) => item.taskId === task.id && item.modelId === model.id);
  return run ? [{ task, run, model }] : [];
}));
// 数值/时长格式化搬到 ./format.ts（可在 Node 原生测试里直接导入）。
export { compact, number, duration, type Locale as FormatLocale } from './format';

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
export const sourceUrl = (path: string, lines?: string, commit?: string) => {
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
export const reviewsFor = (runId: string) => catalog.reviews.filter((review) => review.runId === runId);
export const runsForTask = (taskId: string, taskVersion?: number) => catalog.runs.filter(
  (run) => run.taskId === taskId && (taskVersion === undefined || run.taskVersion === taskVersion),
);
export const runsForModel = (modelId: string) => catalog.runs.filter((run) => run.modelId === modelId);
export const batchForModel = (modelId: string) => catalog.batches.find((batch) => batch.modelId === modelId);
export const assessmentsForModel = (modelId: string) => catalog.assessments.filter((assessment) => assessment.modelId === modelId);
export const tasksForModel = (modelId: string) => {
  const ids = new Set(runsForModel(modelId).map((run) => run.taskId));
  return catalog.tasks.filter((task) => ids.has(task.id));
};
/** 每个任务 × 每个模型的运行卡片（同题对比的入口）。 */
export const runCards = () => catalog.tasks.flatMap((task) => catalog.models.flatMap((model) => {
  const run = catalog.runs.find((item) => item.taskId === task.id && item.modelId === model.id);
  return run ? [{ task, run, model }] : [];
}));
export const compact = (value: number | null, locale: Locale) => value == null ? (locale === 'zh' ? '未记录' : 'Not recorded') : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const number = (value: number | null, locale: Locale) => value == null ? (locale === 'zh' ? '未记录' : 'Not recorded') : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(value);
export const duration = (seconds: number | null, locale: Locale) => {
  if (seconds == null) return locale === 'zh' ? '未记录' : 'Not recorded';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

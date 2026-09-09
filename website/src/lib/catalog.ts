import catalogData from '../../data/catalog.json';

export const catalog = catalogData;
export type Locale = 'zh' | 'en';
export type Task = (typeof catalog.tasks)[number];
export type Run = (typeof catalog.runs)[number];
export type Review = (typeof catalog.reviews)[number];

export const locales: Locale[] = ['zh', 'en'];
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (locale: Locale, path = '') => `${base}/${locale}/${path}`.replace(/(?<!:)\/+/g, '/');
export const asset = (path: string) => `${base}/${path}`.replace(/(?<!:)\/+/g, '/');
export const sourceUrl = (path: string, lines?: string) => {
  const anchor = lines ? `#L${lines.split(/[-,]/)[0]}` : '';
  // Working-tree paths moved; the immutable archive commit still uses its original paths.
  const mapping = catalog.sourcePathMappings.find((entry) =>
    entry.current.endsWith('/') ? path.startsWith(entry.current) : path === entry.current);
  const archivedPath = mapping ? mapping.archived + path.slice(mapping.current.length) : path;
  return `${catalog.repository}/blob/${catalog.archiveCommit}/${encodeURI(archivedPath)}${anchor}`;
};
export const taskById = (id?: string) => catalog.tasks.find((task) => task.id === id);
export const runById = (id?: string) => catalog.runs.find((run) => run.id === id);
export const modelById = (id?: string) => catalog.models.find((model) => model.id === id);
export const reviewsFor = (runId: string) => catalog.reviews.filter((review) => review.runId === runId);
export const runForTask = (taskId: string) => catalog.runs.find((run) => run.taskId === taskId);
export const compact = (value: number | null, locale: Locale) => value == null ? (locale === 'zh' ? '未记录' : 'Not recorded') : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const number = (value: number | null, locale: Locale) => value == null ? (locale === 'zh' ? '未记录' : 'Not recorded') : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(value);

// 展示层数值格式化（纯函数，无 Astro / 环境依赖，便于单元测试）。
//
// 统一约定：缺失值一律返回「未记录」/「Not recorded」，绝不返回 0 或空串——
// 空单元格会被读成「这项是 0 或没问题」。

export type Locale = 'zh' | 'en';

const notRecorded = (locale: Locale) => (locale === 'zh' ? '未记录' : 'Not recorded');

const intlLocale = (locale: Locale) => (locale === 'zh' ? 'zh-CN' : 'en-US');

export const compact = (value: number | null, locale: Locale) => value == null
  ? notRecorded(locale)
  : new Intl.NumberFormat(intlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const number = (value: number | null, locale: Locale) => value == null
  ? notRecorded(locale)
  : new Intl.NumberFormat(intlLocale(locale)).format(value);

/**
 * 秒 → 时长文本。不足 1 小时用 `M:SS`，达到 1 小时改用 `H:MM:SS`。
 * 此前始终输出 `分:秒`，批次/模型的累计时长会变成 `324:18`、`138:02` 这种
 * 「分钟大于 59」的读法，容易被误读。
 */
export const duration = (seconds: number | null, locale: Locale) => {
  if (seconds == null) return notRecorded(locale);
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(rest).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
};

/**
 * 运行时长：展示层**一律**用 `durationSeconds` 格式化，写法统一。
 * 归档自带的 `durationLabel`（如「4分51秒」）只作为数据保留（来源可追溯），不再参与渲染——
 * 此前两种写法会在同一页并存。仅当归档只有文本、没有秒数时才回落到该文本，避免丢值。
 */
export const runDuration = (metrics: { durationSeconds: number | null; durationLabel?: string | null }, locale: Locale) =>
  metrics.durationSeconds != null ? duration(metrics.durationSeconds, locale) : (metrics.durationLabel ?? notRecorded(locale));

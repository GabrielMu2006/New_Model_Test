// 全站统一编号与作品标识（UI 设计规范第 18、51、52 节）。
//
// 编号全部由既有档案数据推导，不新增、不推测数据字段：
//   ARCHIVE 001 / 2026 · PHASE 01 · TASK 01 · WORK A/B/C · RUN 01.A.02 · MODEL M01
// 其中 WORK 字母 = 同一题目下按 catalog.models 顺序排列的模型位次；RUN 段号 = 同一
// 题目同一模型的第几次运行（取自 runId 的 `-rN`）。没有 `-rN` 时按顺序号推算，
// 因此将来新增重复运行时编号仍是稳定的。
import { catalog, modelById, type Model, type Run } from './catalog';

export const pad = (value: number, width = 2) => String(value).padStart(width, '0');

export const phaseCode = (phaseNumber: number) => `PHASE ${pad(phaseNumber)}`;

/** `task-01` → `01`。任务 ID 是归档稳定标识，题号只用于展示。 */
export const taskNumber = (taskId: string) => {
  const match = taskId.match(/(\d+)/);
  return match ? pad(Number(match[1])) : taskId;
};

export const taskCode = (taskId: string) => `TASK ${taskNumber(taskId)}`;

/** 模型位次：M01 / M02 / M03，按 catalog.models 顺序。 */
export const modelCode = (modelId: string) => {
  const index = catalog.models.findIndex((model) => model.id === modelId);
  return `M${pad(index >= 0 ? index + 1 : catalog.models.length + 1)}`;
};

/** 作品位次：同一题目下按模型顺序的 A / B / C；未知模型追加在末尾。 */
export const workLetter = (taskId: string, modelId: string) => {
  const modelIds = catalog.models
    .filter((model) => catalog.runs.some((run) => run.taskId === taskId && run.modelId === model.id))
    .map((model) => model.id);
  if (!modelIds.includes(modelId)) modelIds.push(modelId);
  const index = modelIds.indexOf(modelId);
  return String.fromCharCode(65 + Math.max(0, index));
};

/** 运行段号：取 runId 末尾的 `-rN`，否则用同题同模型的位次，从 01 开始。 */
export const runSegment = (run: Run) => {
  const match = run.id.match(/-r(\d+)$/);
  if (match) return pad(Number(match[1]));
  const siblings = catalog.runs.filter((item) => item.taskId === run.taskId && item.modelId === run.modelId);
  return pad(siblings.findIndex((item) => item.id === run.id) + 1);
};

/** 运行编号，例如 `01.A.02`（设计规范第 51 节的 RUN 01.A.03 写法）。 */
export const runCode = (run: Run) => `${taskNumber(run.taskId)}.${workLetter(run.taskId, run.modelId)}.${runSegment(run)}`;

/** 作品编号，例如 `WORK A`。 */
export const workCode = (taskId: string, modelId: string) => `WORK ${workLetter(taskId, modelId)}`;

/** 模型识别色只用于小圆点与极细的顶部描边，不整卡填充品牌色。 */
const accents = ['var(--archive-blue)', 'var(--muse-pink)', 'var(--gpt-green)', 'var(--museum-red)'];

export const modelAccent = (modelId: string) => {
  const index = catalog.models.findIndex((model) => model.id === modelId);
  return accents[index >= 0 ? index % accents.length : accents.length - 1];
};

export const modelLabel = (model: Model | undefined, locale: 'zh' | 'en') => model?.name[locale] ?? '';

/** 作品的显示比例：同一任务的不同模型必须一致，比例按任务类别固定。 */
/** 作品类型标签：HTML / SVG / Other（设计规范第 21 节筛选器分组）。 */
export const artifactGroup = (type: string) => (type === 'html' ? 'html' : type === 'svg' ? 'svg' : 'other');

/** 归档状态：统一的状态语汇（设计规范第 49、50 节），颜色只作用于小圆点。 */
export type StatusKey = 'archived' | 'verified' | 'partial' | 'pending' | 'failed';

export const runStatus = (run: Run): StatusKey => {
  if (run.status === 'completed') return 'archived';
  if (run.status === 'failed' || run.status === 'error') return 'failed';
  if (run.status === 'partial' || run.status === 'incomplete') return 'partial';
  return 'pending';
};

export const statusLabel = (key: StatusKey, locale: 'zh' | 'en') => {
  const copy: Record<StatusKey, { zh: string; en: string }> = {
    archived: { zh: '已归档', en: 'Archived' },
    verified: { zh: '已验证', en: 'Verified' },
    partial: { zh: '部分完成', en: 'Partial' },
    pending: { zh: '待归档', en: 'Pending' },
    failed: { zh: '失败', en: 'Failed' },
  };
  return copy[key][locale];
};

/** 状态符号：颜色之外必须同时有形状与文字（设计规范第 66 节）。 */
export const statusGlyph: Record<StatusKey, string> = {
  archived: '●', verified: '●', partial: '◐', pending: '○', failed: '×',
};

/** 首页/列表页的作品缩略图：SVG 直接用成果文件，HTML 用归档封面。 */
export const artworkThumb = (run: Run) => (run.artifact.type === 'svg'
  ? `artifacts/${run.id}/${run.artifact.entry}`
  : run.artifact.cover);

/** 同一题目已归档的模型（用于作品卡的模型圆点与「尚未归档」占位）。 */
export const taskModelRuns = (taskId: string) => catalog.models
  .map((model) => ({ model, run: catalog.runs.find((run) => run.taskId === taskId && run.modelId === model.id) }))
  .filter((entry): entry is { model: Model; run: Run } => Boolean(entry.run));

export const modelName = (modelId: string, locale: 'zh' | 'en') => modelById(modelId)?.name[locale] ?? modelId;

/**
 * 紧凑位置（模型圆点、筛选 Chip、作品卡）使用的短名：去掉括号里的补充说明。
 * 这是排版缩写，不改变档案数据——完整名称仍在模型页、运行页与页脚来源中保留。
 */
export const modelShortName = (model: Model | undefined, locale: 'zh' | 'en') => {
  const full = model?.name[locale] ?? '';
  return full.replace(/[（(][^）)]*[）)]\s*$/, '').trim() || full;
};

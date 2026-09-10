// 站点身份与展览元信息（纯展示层常量，不参与档案数据）。
//
// 说明：ARCHIVE 编号是「展览标签」，用于让公开页面形成长期可引用的档案序列
// （见 UI 设计规范第 12、51 节），它不是 Test_Results 里的数据字段，也不改变任何
// 归档 ID / runId / 目录结构。新增一期评测时递增这个编号即可。
export const site = {
  name: 'VibeTest',
  archiveNumber: '001',
  archiveYear: '2026',
  /** 页头与页脚统一使用的档案编号，例如 ARCHIVE 001 / 2026。 */
  archiveLabel: `ARCHIVE 001 / 2026`,
  brandSubtitle: { zh: '模型评测档案', en: 'Model Evaluation Archive' },
  /** 品牌核心语句（设计规范第 3 节）：两行，中英各自一句。 */
  statement: {
    en: 'An archive of things\nAI models actually made.',
    zh: '记录模型真正创造出来的东西。',
  },
  /** 辅助说明：相同题目 · 真实输出 · 独立评价 · 可验证记录。 */
  pillars: {
    en: ['Same prompts', 'Real outputs', 'Independent reviews', 'Verifiable evidence'],
    zh: ['相同题目', '真实输出', '独立评价', '可验证记录'],
  },
  contactEmail: 'limuzhi2006@stu.pku.edu.cn',
  personalSite: 'https://gabrielmu2006.cn/',
} as const;

export const navItems = [
  { key: 'home', path: '', label: { zh: '概览', en: 'Overview' } },
  { key: 'phases', path: 'phases/', label: { zh: '阶段', en: 'Phases' } },
  { key: 'models', path: 'models/', label: { zh: '模型', en: 'Models' } },
  { key: 'tasks', path: 'tasks/', label: { zh: '任务', en: 'Tasks' } },
  { key: 'compare', path: 'compare/', label: { zh: '对比', en: 'Compare' } },
  { key: 'methodology', path: 'methodology/', label: { zh: '方法', en: 'Methodology' } },
] as const;

export type NavKey = (typeof navItems)[number]['key'];

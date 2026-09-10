// 越界状态的展示口径（纯函数，无 Astro / 环境依赖，便于单元测试）。
//
// 2026-09-10 组织者决定：
//   ① 越界判定只影响标注，不影响成绩录入；
//   ② 有的模型 / harness 不展示中间工具调用（例如只回最终答案的 API）——这类运行
//      **默认视为遵守规则**，标注「工具调用不可见 · 默认视为遵守规则」，不得写成「未发现越界」。
//   ③ 「越界尝试但未取得内容」（`suspected`）**不作外显标注**：只记入审计档案，
//      运行页不显示该状态（此前把「存在越界尝试，未取得内容」当标签展示，与 ②/官方口径冲突）。
// 判定方法见 docs/audit-method.md 4.0 与第 5 节。

export type TelemetryVisibility = 'visible' | 'partial' | 'hidden';

/** 运行页该显示什么：无记录 / 默认遵守 / 不外显（suspected）/ 具体状态。 */
export type ContaminationDisplay = 'none' | 'assumed-compliant' | 'withheld' | 'status';

interface RunLike {
  contamination?: {
    status?: string | null;
    telemetry?: string | null;
  } | null;
}

/** 遥测可见性；未声明按 `visible` 处理（不能因为缺字段就默认「不可见=遵守」）。 */
export const telemetryOf = (run: RunLike): TelemetryVisibility => {
  const value = run?.contamination?.telemetry;
  return value === 'hidden' || value === 'partial' ? value : 'visible';
};

/** 工具调用不可见、且没有被确认作弊 → 按既定规则默认视为遵守规则。 */
export const isAssumedCompliant = (run: RunLike): boolean =>
  telemetryOf(run) === 'hidden' && run?.contamination?.status !== 'contaminated';

/** 越界尝试但未取得内容：记入档案，不在展示层外显（确认作弊 `contaminated` 仍须标注）。 */
export const isWithheld = (run: RunLike): boolean => run?.contamination?.status === 'suspected';

export const contaminationDisplay = (run: RunLike): ContaminationDisplay => {
  if (!run?.contamination) return 'none';
  // 顺序有意义：`suspected` 优先于「遥测不可见」——已经知道存在越界尝试时，
  // 再显示「工具调用不可见 · 默认视为遵守规则」会与档案状态矛盾。
  if (isWithheld(run)) return 'withheld';
  if (isAssumedCompliant(run)) return 'assumed-compliant';
  return 'status';
};

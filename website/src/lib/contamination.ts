// 越界状态的展示口径（纯函数，无 Astro / 环境依赖，便于单元测试）。
//
// 2026-09-10 组织者决定：
//   ① 越界判定只影响标注，不影响成绩录入；
//   ② 有的模型 / harness 不展示中间工具调用（例如只回最终答案的 API）——这类运行
//      **默认视为遵守规则**，标注「工具调用不可见 · 默认视为遵守规则」，不得写成「未发现越界」。
// 判定方法见 docs/audit-method.md 4.0 与第 5 节。

export type TelemetryVisibility = 'visible' | 'partial' | 'hidden';

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

/** 运行页该显示什么：无记录 / 默认遵守 / 具体状态。 */
export const contaminationDisplay = (run: RunLike): 'none' | 'assumed-compliant' | 'status' => {
  if (!run?.contamination) return 'none';
  return isAssumedCompliant(run) ? 'assumed-compliant' : 'status';
};

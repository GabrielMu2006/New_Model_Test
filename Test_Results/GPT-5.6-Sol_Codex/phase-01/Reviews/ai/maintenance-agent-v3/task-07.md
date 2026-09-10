# task-07 · 推独轮车的人 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-07` |
| runId | `run-gpt-5-6-sol-task-07-r1` |
| 本题得分 | **92/100** |
| 结论（中） | "推而非拉"这一方向敏感判定在强制二选一中稳定判为"推"，人物位于把手后方、双臂前伸握把、独轮车结构完整，且该题由模型自行渲染并查看过。 |
| Conclusion (EN) | The direction-sensitive push-vs-pull judgement resolved stably to "pushing": the person stands behind the handles, both arms reach forward to grip them, and the wheelbarrow is structurally complete — and this was one of the deliverables the model rendered and inspected itself. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照（逐条）**：单人推独轮车（非拉）✅；人物位于把手后方 ✅；身体朝向行进方向 ✅；双手向前握把 ✅；独轮车具备单前轮、车斗、支撑腿、两根把手 ✅；独立 SVG ✅（1200×800）；无外部依赖 ✅。

- **强制二选一取证**：视觉桥接模型被要求只在"推/拉"中选一个，结果为——"人物在把手后方、身体前倾、双臂前伸握住把手；独轮车有单前轮、橙色车斗、两根木把手、两条支撑腿；**判为"推"**"。题目点名的"拉"的视觉信号（人在车前、面向车后、把手拖在身后）均未出现。

- **过程证据（真实自检）**：该题模型先用 `qlmanage -t -s 1200` 生成缩略图、再用 `sips` 转 PNG，并 **2 次 `view_image` 查看自己的渲染结果**；`xmllint --noout` 通过；归档中保留了自渲染的 `person-pushing-wheelbarrow.svg.png`（已包含在 `artifacts.files` 内）。该题有 1 次工具失败，审计确认是自身脚本包装的 JavaScript 语法错误（`Unexpected token '??'`），**未取到任何外部内容**，之后模型改用 `sips` 完成渲染。

- **扣分**：
  - 需求符合度 −1：题目要求"双手与把手接触"；盲看描述为"双臂前伸握把"，但未做逐点接触测量。
  - 正确性 −2：方向判定依赖单帧盲看与模型自述；未做镜像反例对照。
  - 视觉与产品感 −2：画面完整（装土与幼苗、丘陵背景、前倾步态），但仅单尺寸查看。

- **亮点**：本阶段自检最完整的两题之一（另一为 task-03）；`<desc>` 准确写明"behind a loaded wheelbarrow … pushing it toward the right"，与盲看结论一致。

- **局限**：视觉结论来自视觉桥接模型；"推/拉"判定只有一次独立读（未做多次重复或多评审交叉）；未做接触点坐标测量。

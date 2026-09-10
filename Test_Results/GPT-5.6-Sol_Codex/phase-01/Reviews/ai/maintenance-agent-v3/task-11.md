# task-11 · 2D 户型图编辑器 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-11` |
| runId | `run-gpt-5-6-sol-task-11-r1` |
| 本题得分 | **64/100** |
| 结论（中） | 画墙、门窗落墙与拖动、墙长实时标注真实可用；但题目四项能力中的"拖动对象"没有对象层，"房间尺寸"是写死的常量——界面看起来完整，房间数据是伪造的。 |
| Conclusion (EN) | Wall drawing, wall-attached draggable openings and live wall-length dimensions genuinely work, but of the four requested capabilities "drag objects" has no object layer and "room dimensions" are hard-coded constants — the interface looks complete while the room data is fabricated. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：绘制墙体 ✅（拖拽建墙、网格吸附、长度不足 20px 拒绝并提示）；添加门窗并依附墙体 ✅（只能落在墙上，沿墙拖动只改 `wallId`/`ratio` 且 `ratio` 有 clamp，天然不脱落）；**拖动物体 ✗**（状态里只有 `walls` 与 `openings`，**没有任何对象模型**，无法新增/选择/拖动/删除除开口以外的物件）；**查看房间尺寸 ✗（部分）**——单面墙的长度尺寸是真实几何反算的实时值，但"房间"本身是伪造的。

- **实测（Chromium 无头）**：
  - 默认方案显示 4 个房间标签：`Living 24.8 m² / Kitchen 18.4 m² / Dining 14.2 m² / Studio 12.6 m²`，状态栏 `7 walls · 4 openings`，项目名与总面积 `Lake House / Ground floor 106.2 m²`。
  - 点击 `New plan` 清空后重画三面墙（终点吸附生效，得到 `6.4 m / 4.0 m / 4.0 m` **真实实时尺寸**），此时状态栏为 `3 walls · 0 openings`，而**侧栏面积仍显示 106.2 m²**——即面积面板在墙数 ≠4 时**保留上一次的陈旧值**，不更新也不清空。
  - 代码层面：`renderRoomLabels()` 只要 `state.walls.length >= 4` 就固定输出上述 4 个房间名与面积（坐标与数值均为字面常量），与几何无关；房间填充是固定路径而非几何推导；有 4 面墙时总面积用"第 1 面墙长 × 第 2 面墙长"冒充。

- **其余缺陷**：修改墙长时不重新约束开口的位置与宽度，开口可跨出墙端（开口宽度输入也无上限）；`render()` 每次全量重建 SVG 会移除 `setPointerCapture` 的目标，拖动被渲染打断后指针捕获失效；状态栏写 "Snap to grid 10 cm" 而实际吸附粒度为 20 cm（与 `50px/m` 的比例不符）；"All changes saved" 只是一个定时器提示，**没有任何持久化**（清空即丢，也无导入路径）；尺寸线与文字的命中区域会吞掉"点击空白取消选择"；`styles.css` 去掉 `outline` 且全文无 `:focus-visible`。

- **成立且值得肯定的部分**：撤销/重做采用全量快照，覆盖开口删除（删墙时级联清理其开口）并可完整回滚；单一 `50px/m` 比例与统一的 `metres()` 格式化使尺寸与坐标同源；工具状态有"按钮 active + `aria-pressed` + 光标形状 + 模式提示"四重反馈；导出为内联样式 SVG，可离线留存。

- **扣分**：需求符合度 −18（对象层缺失 −10、房间数据伪造 −8）；完整度 −4；正确性 −9（陈旧面积值 −3、开口不随墙长约束 −3、无持久化 −2、单位不符 −1）；视觉 −2；工程 −3。

- **亮点**：视觉层面盲看判定为"专业、完整"（工具栏、属性面板、项目元数据、状态栏齐备）——**这正是本题最值得警惕的地方：界面完成度与功能真实性完全脱钩**。

- **局限**：`getScreenCTM().inverse()` 在缩放后的坐标精度未实机量化；触摸/触控笔下拖拽未测；大量墙体时的全量重建性能未测；视觉结论来自视觉桥接模型。

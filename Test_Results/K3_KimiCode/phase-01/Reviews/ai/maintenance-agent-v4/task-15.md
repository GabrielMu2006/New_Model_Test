# task-15 · 图书追踪应用 —— AI 评价（maintenance-agent-v4）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（Codex），非盲评 |
| 评价版本 | v4 |
| 评价日期 | 2026-09-12 |
| reviewId | `review-maint-agent-v4-task-15` |
| runId | `run-k3-task-15-r1` |
| 本题得分 | **90/100** |
| 结论（中） | 空库起步的 CRUD、搜索筛选排序、统计、完成日期、评分、持久化与 JSON 导入导出都真实可用；三态模型和重复导入策略限制了更完整的阅读进度管理。 |
| Conclusion (EN) | Empty-library CRUD, search/filter/sort, statistics, finish dates, ratings, persistence, and JSON import/export genuinely work; the three-state model and duplicate-import policy limit fuller reading-progress management. |
| 评分口径 | 需求符合 35 / 完整度 19 / 正确性 18 / 视觉 9 / 工程 9 |

- 浏览器从空库新增 `Dune / Frank Herbert / finished / 5 stars` 后，总数、Finished、标题和无障碍评分文本同步正确；390px 布局清楚。损坏 localStorage 会显示明确警告并回到空库，不会静默播种示例数据。
- 本轮核心测试 15/15，加 UI 冒烟测试通过；覆盖规范化、验证、完成日期、离开 finished 清日期、搜索/筛选/排序、统计、序列化、损坏导入、唯一 id，以及真实 UI 事件链。
- 扣分：只有 want-to-read/reading/finished，没有 paused/abandoned、页数与开始日期；`Date.parse()` 会接受部分会自动归一化的非法日期；重复导入同一文件时只为冲突 id 生成新 id，语义相同的书仍会再次合并，不能真正避免重复。


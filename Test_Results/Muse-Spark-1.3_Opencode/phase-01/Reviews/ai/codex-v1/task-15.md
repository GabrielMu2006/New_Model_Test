# task-15 · 图书追踪 —— AI 评价（codex-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | Codex Desktop 0.153.4 / GPT-5，**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-09 |
| 本题得分 | **80/100** |
| 结论（中） | 基本通过，交付缺陷 |
| Conclusion (EN) | Pass with a delivery defect |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 人工评价 | [../../Personal_Review.md](../../Personal_Review.md) |

---

**结论：功能实现较完整，但受交付缺陷影响，用户直接打开时核心功能不可用。**

通过 HTTP 访问时，应用能正常渲染样例书库，支持新增、编辑、删除、进度、状态、评分、搜索、筛选、排序、统计、JSON 导入导出和本地持久化。本次实测在新增对话框输入书名 `Review Probe`和作者 `Evaluator`，保存后书籍数从 5 变为 6，证明“新增书籍”功能本身有效。`node test.mjs` 结果为 **18 passed, 0 failed**。390 px 下的卡片、统计和筛选布局也比人工短评所述更完整。

但它与 task-12 有相同的 `file://` ES module CORS 问题。双击 `index.html` 时 `app.js` 不会运行，样例书籍不会渲染，“Add book”也没有事件处理；目录中同样没有运行说明。因此人工评价“无法增加书籍”不是误判，而是在交付物默认打开路径下真实发生的失败。

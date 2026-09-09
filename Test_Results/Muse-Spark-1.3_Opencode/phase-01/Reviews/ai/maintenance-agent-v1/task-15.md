# task-15 · 图书追踪 —— AI 评价（maintenance-agent-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-09 |
| 本题得分 | **78/100** |
| 结论（中） | 领域引擎 18 个导出函数 + 测试；**ES module 导致 file:// 不可用** |
| Conclusion (EN) | Domain engine with 18 exports and tests; ES modules make file:// unusable. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 人工评价 | [../../Personal_Review.md](../../Personal_Review.md) |
| 交付方式复核 | [../../复核说明-交付方式.md](../../复核说明-交付方式.md)（仅 task-12 / task-15） |

---

- **需求对照**：书籍追踪应用 ✅；领域层完整。
- **客观**：`books.js` 导出 18 个函数（增删改、进度、状态、评分、筛选、排序、统计、导入导出、种子数据、校验），`test.mjs` 66 行；`app.js` 341 行 + `style.css` 129 行。
- **交付方式问题（已复现）**：与 task-12 相同——`<script type="module">` + 相对 `import`，`file://` 打开时模块被 CORS 拦截，表现为"无法增加书籍"（HTTP 下初始 5 本、新增后 6 本，无错误）。详见 `Reviews/复核说明-交付方式.md`。
- **扣分**：交付形态需要 HTTP 服务且未注明（−8）；UI 设计人工评价为"不好"（−4）；无 README/运行说明（−2）。

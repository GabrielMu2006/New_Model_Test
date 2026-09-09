# task-12 · 计算器 —— AI 评价（maintenance-agent-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-09 |
| 本题得分 | **80/100** |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 人工评价 | [../../Personal_Review.md](../../Personal_Review.md) |
| 交付方式复核 | [../../复核说明-交付方式.md](../../复核说明-交付方式.md)（仅 task-12 / task-15） |

---

- **需求对照**：可工作的计算器 ✅（引擎层）；"Run it / Test it" 的验证要求 → 交付物提供了 `test.mjs`（58 行），但**未随交付物给出运行方式说明**。
- **客观**：`calculator.js` 分层清晰（`tokenize` → `toRPN` → `evalRPN` → `evaluate` → `formatResult`/`evaluateFormatted`），含括号、幂、负数、除零与错误处理。
- **交付方式问题（已复现）**：`index.html` 使用 `<script type="module" src="app.js">` 且 `app.js` 相对 `import` `calculator.js`；**以 `file://` 直接打开时浏览器按 CORS 阻止模块脚本，界面完全无响应**；经 HTTP 提供服务时功能正常（1 + 2 = 3，无控制台错误）。详见 `Reviews/复核说明-交付方式.md`。人工评语"计算器无法使用"由此得到解释。
- **扣分**：交付形态需要 HTTP 服务且未注明（−8）；无 README/运行说明（−2）。

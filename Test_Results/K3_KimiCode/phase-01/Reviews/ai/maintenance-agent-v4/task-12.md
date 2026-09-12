# task-12 · 计算器应用 —— AI 评价（maintenance-agent-v4）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（Codex），非盲评 |
| 评价版本 | v4 |
| 评价日期 | 2026-09-12 |
| reviewId | `review-maint-agent-v4-task-12` |
| runId | `run-k3-task-12-r1` |
| 本题得分 | **89/100** |
| 结论（中） | 经典四则状态机、键盘、退格、正负号、百分比、重复等号与错误恢复均可用，31 项测试全过；主要不足是成果内缺正式运行/测试说明。 |
| Conclusion (EN) | The four-operation state machine, keyboard input, backspace, sign, percent, repeated equals, and error recovery all work, with 31 tests passing; the main gap is missing formal run/test documentation inside the artifact. |
| 评分口径 | 需求符合 35 / 完整度 19 / 正确性 18 / 视觉 8 / 工程 9 |

- HTTP 与 `file://` 都能直接运行。浏览器实测 `0.1+0.2` 得 `0.3`，`5÷0` 得 `Error`，随后输入 `7` 正常恢复；桌面和 390px 布局清楚。
- 本轮运行 `node test.js` 得 31/31，通过基础四则、小数噪声、链式左到右、连续运算符、重复等号、错误恢复、退格、正负号、百分比、超长输入和 HTML/JS 契约。
- 扣分：`artifacts/` 没有 README，测试命令只写在 `test.js` 注释里，修复前后证据没有单独说明；百分比是简单除以 100，而非上下文百分比（如 `200 + 10%`）；设计可靠但非常基础。


# task-12 · 计算器 —— AI 评价（codex-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | Codex Desktop 0.153.4 / GPT-5，**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-09 |
| 本题得分 | **78/100** |
| 结论（中） | 基本通过，交付缺陷 |
| Conclusion (EN) | Pass with a delivery defect |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 人工评价 | [../../Personal_Review.md](../../Personal_Review.md) |

---

**结论：实现本身基本通过，但交付方式造成用户可见的功能失败。**

计算核心未使用 `eval`，支持四则、小数、括号、乘方、百分比、正负号、清除、退格和键盘。复制到临时评测目录后运行 `node test.mjs`，结果为 **20 passed, 0 failed**；经 HTTP 服务打开后，按钮输入 `1 + 2 =` 正确得到 `3`。

然而 `index.html` 以 `type="module"` 引入 `app.js`。直接通过 `file://` 打开时，Chrome 明确报告本地 module 被 CORS 拦截，所有按钮因此没有事件处理。交付目录也没有 README、`package.json` 或启动脚本告知用户需通过 HTTP 服务访问。因此，人工评价的“计算器无法使用”是真实且可复现的交付体验，不应被核心单测的通过掩盖。

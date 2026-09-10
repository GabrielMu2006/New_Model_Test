# task-12 · 计算器应用 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-12` |
| runId | `run-gpt-5-6-sol-task-12-r1` |
| 本题得分 | **78/100** |
| 结论（中） | 核心算术真实可用且有真实执行过的测试（0.1+0.2 得 0.3、除零有明确提示），但入口是 ES module 导致 `file://` 打不开，且 UI 状态机存在三处可达缺陷（大/极小结果无法继续运算、前导运算符、超 12 位有效数字被静默改写）。 |
| Conclusion (EN) | The calculation core genuinely works and was really exercised by a test run (0.1+0.2 gives 0.3, division by zero is reported clearly), but the ES-module entry point cannot be opened via file://, and the UI state machine has three reachable defects (very large/tiny results cannot be chained, leading operators, and silent rounding of inputs beyond 12 significant digits). |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：可工作的计算器 ✅（见实测）；技术自选 ✅（原生 ES module + 零依赖 `package.json` + 内置 `server.mjs`）；**运行它 ✅**（审计记录 `node --test` 两次、`node server.mjs` 一次的真实执行）；**测试它 ✅**（8 条断言的 `calculator.test.mjs`，逐条手工复算成立）；**修复发现的问题 ✅**（`calculator.mjs` 中的负操作数守卫 `[×÷]$`、双层输入校验、`toPrecision(12)` 收敛，均为"出过问题才会写"的护栏）。

- **实测（Chromium 无头，双通道加载）**：
  - **`file://` 通道**：**失败**。控制台报 `Access to script … blocked by CORS policy` 与 `net::ERR_FAILED`；显示区停在 "Ready"，按下数字键 7 无任何反应 → **双击打开白屏/不可用**。
  - **HTTP 通道**：控制台错误 0；`0.1 + 0.2 =` → **0.3** ✅（浮点噪声被真正修掉）；`4 ÷ 0 =` → `Cannot divide by zero` ✅；`7 + 5 =` → 12，再按 `=` 仍为 12 ✅（幂等）；键盘输入 `55*2` + Enter → 110 ✅。

- **可达缺陷（均在实测中复现）**：
  1. **结果无法链式运算**：`=` 之后表达式被写成 `String(value)`，当 |结果| ≥ 1e21 或 < 1e-6 时产生 `1e-11` 这类文本，而核心解析器拒绝 `e`。实测 `1 ÷ 100000000000 =` 显示 `—`，再按 `+`、`5`、`=` 得到 `Invalid expression`，**只能按 AC 重来**。
  2. **前导运算符**：先按 `-` 再按其他运算符会把表达式折叠成前导 `+`；实测显示为 `+`（结果 `—`），接 `5 =` 得到 `Invalid expression`。
  3. **长输入被静默改写**：`toPrecision(12)` 对超过 12 位有效数字的输入直接截断；实测 `123456789012345 =` 显示 `1.23456789e+14`，与真实值相差 12345，且**没有任何提示**。
  4. 溢出、`NaN`（如 `0÷0`）与除零共用同一条 "Cannot divide by zero" 文案，超出与除零被混为一谈。

- **其余问题**：`artifacts/` 内**没有 README**，运行方式只能从 `package.json` 的 `start`/`test` 脚本反推（题目要求交付"运行方式、测试方法与修复证据"，本次仅以脚本形式隐含提供）；测试套件完全不覆盖 UI 层（0 条 DOM/状态机测试）；`calculator.mjs` 中 `'Error'` 分支不可达（死代码）；`styles.css` 首行 `@import url('data:text/css,')` 为空导入（该模型另有 2 题出现同一写法）；`.keys` 的 `aria-label` 挂在无 `role` 的 `div` 上，AC/% 无描述标签；≤900px 时历史面板整块隐藏。

- **扣分**：需求符合度 −10（`file://` 不可用 −6、无交付说明 −4）；完整度 −2；正确性 −6；视觉 9/10；工程 −3。

- **亮点**：这是本阶段**唯一有真实测试执行记录的 Web 应用**；把计算核心抽成独立模块并由 `node --test` 驱动，是 15 题里工程分层最清晰的一次；`server.mjs` 带路径穿越校验。

- **局限**：`node --test` 的实际输出未归档（只有命令记录），本文的"8 条断言成立"来自逐条手工复算而非执行结果；模型是否在浏览器里点测过 UI 无法从归档判定（无截图、无自动化）；`apply_patch=3` 具体改了什么无 diff 存档。

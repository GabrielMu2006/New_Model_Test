# task-09 · 单文件俯视角农场游戏 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-09` |
| runId | `run-gpt-5-6-sol-task-09-r1` |
| 本题得分 | **82/100** |
| 结论（中） | 单文件零依赖，整地—播种—浇水—生长—收获循环真实接通、经济与存档自洽；但触屏/窄屏下"收获"与"次日"两个工具槽被媒体查询隐藏且无替代入口，核心循环在触屏设备上无法完成。 |
| Conclusion (EN) | A genuinely self-contained single file whose till–plant–water–grow–harvest loop, economy and save/load are wired end to end; however a media query hides the harvest and next-day tool slots on coarse-pointer or narrow viewports with no alternative entry point, making the core loop impossible to complete on touch devices. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：单个自包含 HTML 文件 ✅（21.3 KB，唯一 `<script>` 与唯一 `<style>`，**全文 0 个 `http(s)://`、`src=`、`href=`、`url(`、`@import`、`fetch`、`import`**）；俯视角、可操作角色 ✅；至少"整地—播种—照料—生长—收获"循环 ✅；明确输入与状态反馈 ✅；资源/时间变化 ✅；持续目标（每日请求 + 商店 + 金币）✅。

- **核心循环（代码走查，逐环节接通）**：锄头整地 → 种子工具播种（扣种子）→ 水壶浇水（扣水量，需已整地）→ **跨天时仅当 `p.watered` 为真才 `p.age++`，随后清除 `watered`**（浇水是生长的真实前提而非装饰）→ 篮子收获结算金币、累计收获数、地块复位为已整地。雨天自动浇灌全部地块、池塘免费补水、商店在临近时开启；63 个地块全部可达（含四角，已逐点核对碰撞盒与朝向偏移 `target()`）；不存在作物卡死（有作物时拒绝锄地、占用时拒绝再播，唯一清除途径是收获且必定成功）；`dt` 有 0.05 s 上限，地块键限定在网格内（最多 63 条），不存在无界增长；`load()` 有 `catch` 兜底、状态为纯可序列化对象，存档往返无损。

- **高危缺陷（实测确认）**：`@media (max-width:680px),(pointer:coarse)` 隐藏第 6、7 个工具槽（`Harvest` 收获、`Next day` 次日），而选择工具槽只有"点击槽位"与"数字键 1–7"两条路径，`#act` 只对**当前选中**的工具调用 `useTool()`。**实测**：390×844 + `hasTouch` 下 7 个工具槽的 `display` 依次为 `block×5, none, none`——**触屏设备上无法收获、无法过夜，核心循环不可完成**。这是"单文件可玩"要求下最实质的一处失败。

- **其余缺陷**：任务进度条在完成后的 1.8 秒窗口内仍用旧任务对象计算，进度可超过 100%；开始覆盖层未禁用指针穿透，点击覆盖层空白仍会落到画布并触发放置/使用提示；弹窗缺 `role="dialog"`、`aria-modal` 与焦点陷阱；每帧重建工具栏 `innerHTML`（`renderToolbar`）；`save()` 无 `try/catch`，在被禁用存储的 iframe 中会抛错。

- **实测（Chromium 无头）**：控制台错误 0、页面异常 0、请求失败 0、外部请求 0；开始后 HUD 显示 `Day 1 / 7:00 / 25`、每日请求与工具栏正常；窄屏无横向溢出。

- **扣分**：需求符合度 −8（触屏关键路径缺失）；完整度 −1；正确性 −3；视觉 −3（盲看指出 `TODAY'S REQUEST` 面板与市场摊位顶棚有轻微重叠、部分元素间距不均）；工程 −3（可达性收口与每帧 DOM 重建）。

- **亮点**：交互网格与绘制网格由同一个 `plotKey`/`Math.floor` 推导，天然对齐；清晨清除 `watered` 使浇水成为**承重机制**；雨天改变当日决策；触屏方向键与 1.8 格点击复用同一 `useTool()` 核心，没有平行实现。

- **局限**：帧率与长时间随机输入下的性能未测量；真机触屏手势冲突未验证；"地块全部可达""无卡死作物"来自代码走查而非长时间实机对局；视觉结论来自视觉桥接模型。

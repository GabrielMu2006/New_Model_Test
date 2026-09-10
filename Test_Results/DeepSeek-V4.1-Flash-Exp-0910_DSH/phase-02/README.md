# phase-02 归档 / Phase 2 archive（部分：Task 16 – 20）

> 状态：**部分归档**。本目录当前只包含 **Task 16 – 20（5 题）** 的运行；Task 21–45 尚未测试。
> 交接契约：`docs/result-interface.md`；接入流程：`docs/adding-results.md`。

## 1. 运行清单

| taskId | runId | 交付类型 | 入口 | 状态 | 越界判定 | 时长 / 工具调用 |
| --- | --- | --- | --- | --- | --- | --- |
| `task-16` | `run-deepseek-v4-1-flash-exp-0910-task-16-r1` | `svg` | `pelican-bicycle.svg` | `completed` | `unknown`（未发现越界） | 1769 s / 137 |
| `task-17` | `run-deepseek-v4-1-flash-exp-0910-task-17-r1` | `svg` | `mechanical-watch-movement.svg` | `completed` | `suspected`（越界尝试，未取得内容） | 2397 s / 117 |
| `task-18` | `run-deepseek-v4-1-flash-exp-0910-task-18-r1` | `html` | `index.html` | `completed` | `unknown`（未发现越界） | 3553 s / 401 |
| `task-19` | `run-deepseek-v4-1-flash-exp-0910-task-19-r1` | `html` | `index.html` | `completed` | `unknown`（未发现越界） | 1729 s / 160 |
| `task-20` | `run-deepseek-v4-1-flash-exp-0910-task-20-r1` | `html` | `index.html` | `completed` | `suspected`（越界尝试，未取得内容） | 1728 s / 125 |

合计：5 题、11176 秒（186.3 分钟）、apiCalls 927、toolCalls 940、failures 0、inputTokens 457656、outputTokens 1475485、cacheReadTokens 234301952。逐题口径见各 `submission.json`。

## 2. 输入与题目版本

- 题目文档：`PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md`，本批次取 Task 16–20，统一 `taskVersion = 1`（即该文档 `### 原始 Prompt / Original Prompt` 代码块的逐字内容）。
- 每题逐字输入：`task-NN-<slug>/prompt.txt`，SHA-256 记录在同目录 `submission.json`。题目由组织者粘贴进对话，`prompt.txt` 为逐字存档。
- 题目 Task 16–45 已在公开仓库发布（提交 `0540edf`，见 `docs/known-issues.md` 4.0）：本阶段成绩须同时标注该暴露。

## 3. 环境与预算（开测前固定）

| 字段 | 值 |
| --- | --- |
| 模型 | DeepSeek-V4.1-Flash-Exp-0910（harness 报告 id `deepseek-v4.1-flash-expires-on-0910`，供应商 `deepseek-official`；未获供应商侧确认） |
| harness | DSH 2.0.5（桌面 GUI 会话，每题一个独立新会话） |
| 预算 | 单题墙钟 120 分钟；token 与工具调用不设硬上限、如实记录；重试 0；补充轮 0（`task-17` 的 1 次机主介入见第 5 节） |
| 网络 | 规则级关闭（无白名单域名；未在网络上强制） |
| 会话上下文 | 每题独立新会话，不共享上下文、不 fork |

## 4. 隔离与越界处置

- 隔离等级 **`workspace-only`**：`AGENTS.md` 两条绝对规则（不得读取当前目录以外的内容、不得查询任何仓库）+ 收尾工具调用与统计审查。这是**策略级约束 + 事后审查**，能防手滑、能被审计，但挡不住有意读取；**不得**表述为「强制隔离」或「无污染」。
- 越界处置按组织者 2026-09-10 决定：**判定只影响标注，不影响成绩录入**——任何 run 都不被排除、作废、重测或改写分数。越界尝试与嫌疑只记入审计档案（各题 `evidence/audit-2026-09-10.*`），不作外显标注；只有确认作弊成功（实际读到他人答案/成果，或从仓库、网络取到题目相关内容）才标注「已确认获取外部答案」。**本批次 5 个 run 均未被确认获取外部答案。**
- 逐题审查结论、覆盖维度（含同题并行副本）与未覆盖渠道见各 `task-NN-<slug>/evidence/audit-2026-09-10.md`；原始会话日志未随公开档案入库，其路径、大小与 SHA-256 记录在同目录 `evidence/session-log.sha256.txt`。

## 5. 补充轮

`task-17` 有 **1 次**组织者（机主）补充轮，逐字记录见 `runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/followups.json`：
「不要再读取chrome钥匙串了」。该轮由运行中观察到浏览器默认 profile / 钥匙串活动触发，**未提供任何题目提示、答案或评分信息**；模型随后把浏览器步骤改为 opt-in 并加隔离参数。其余 4 题无补充轮。

## 6. 尚未完成的项

- Task 21–45（25 题）尚未测试；
- 独立评价（人工 / AI）尚未产出，因此阶段级 `Reviews/` 目录尚不存在（**评价放阶段级 `Reviews/`，不放任务目录**）；展示站对应运行页因此没有评价卡片；
- 成果内的测试结果均为**作者自述**（各 `artifacts/README.md`），本次未在隔离环境复跑；
- 隔离是策略级约束，未做环境级强制；训练数据是否包含本题答案无法用日志判定。

## 7. 逐题详情

入口、逐字输入、指标、审查结论与限制见各 `task-NN-<slug>/README.md`；交付物运行方式与逐条需求对照见各 `task-NN-<slug>/artifacts/README.md`。

# phase-01 测试计划 / Test plan

> 由 `test-workspace-2/_templates/PLAN.template.md` 生成。组织者填写，维护 agent 维护，测试期间不得随意改动。
> 规范依据：`docs/testing-protocol.md`、`docs/result-interface.md`。

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| phaseId | `phase-01` |
| 被测模型（显示名） | K3 |
| 模型实际版本 / 供应商 | 版本 `null`（未提供，不猜）/ 供应商：Moonshot AI（Kimi 官方） |
| harness / 版本 | Kimi Code CLI / `0.42.0` |
| harness 运行方式 | 桌面交互式 CLI |
| 采样 / 思考强度 | 思考强度 `max`（记入各题 `submission.json` 的 `environment.sampling`） |
| 题目文档 | `PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md` |
| 题目范围 | `Task 01 – 15`，共 `15` 题 |
| 每题是否单轮 | 是（无补充轮） |
| 开测时间 / 时区 | 2026-09-12 / `Asia/Shanghai`（逐题实际起止时间记入各 `submission.json`） |
| 组织者 | 用户（组织 agent：Kimi Code CLI 组织会话，仅组织 / 审查 / 归档，不参与答题） |

## 2. 预算与终止条件（开测前固定）

| 项目 | 上限 |
| --- | --- |
| 单题墙钟时间 | 不设硬上限（`null`） |
| 单题 token（输入 / 输出） | 不设硬上限（`null`） |
| 工具调用次数 | 不设硬上限（`null`） |
| 重试次数 | `0` |
| 补充轮次数 | `0` |
| 超时判定 | 无硬性超时；若 harness 或会话自身中断，按失败如实记录，不重跑覆盖 |

## 3. 隔离与网络

| 字段 | 值 |
| --- | --- |
| 隔离等级 | `workspace-only`（固定，不讨论升级） |
| 实际执行环境 | 本机同用户 |
| 任务目录位置 | `test-workspace-2/phase-01/task-NN-<slug>/` |
| 只读输入清单 | `prompt.txt`（无 `assets/`） |
| 网络策略 | 关闭（规则级，无白名单；不在网络层强制） |
| 仓库访问规则 | 被测规则禁止一切仓库查询（`AGENTS.md` 第 2 节）；本栏只记录该规则要求 |
| 会话是否共享上下文 | 否（每题一个全新会话） |

> 本方案是**策略级约束 + 收尾审查**：报告与展示必须标注「策略级约束 + 事后审查」，不得写「强制隔离」「无污染」。
> 方案已定，**不要向用户征询是否升级隔离**（独立用户 / 容器 / 断网）。

## 4. 任务清单

| # | taskId | 目录 | runId | 轮次 | 允许素材 | 允许域名 | 状态 |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 1 | `task-01` | `task-01-aevum-luxury-watch-landing-page/` | `run-k3-task-01-r1` | 1 | 无 | 无 | 待测 |
| 2 | `task-02` | `task-02-pelican-on-bicycle/` | `run-k3-task-02-r1` | 1 | 无 | 无 | 待测 |
| 3 | `task-03` | `task-03-analog-clock-6-25/` | `run-k3-task-03-r1` | 1 | 无 | 无 | 待测 |
| 4 | `task-04` | `task-04-analog-clock-11-52-30/` | `run-k3-task-04-r1` | 1 | 无 | 无 | 待测 |
| 5 | `task-05` | `task-05-bicycle-rider/` | `run-k3-task-05-r1` | 1 | 无 | 无 | 待测 |
| 6 | `task-06` | `task-06-scissors-cutting-paper/` | `run-k3-task-06-r1` | 1 | 无 | 无 | 待测 |
| 7 | `task-07` | `task-07-pushing-wheelbarrow/` | `run-k3-task-07-r1` | 1 | 无 | 无 | 待测 |
| 8 | `task-08` | `task-08-breakout-game/` | `run-k3-task-08-r1` | 1 | 无 | 无 | 待测 |
| 9 | `task-09` | `task-09-topdown-farming-game/` | `run-k3-task-09-r1` | 1 | 无 | 无 | 待测 |
| 10 | `task-10` | `task-10-pixel-art-editor/` | `run-k3-task-10-r1` | 1 | 无 | 无 | 待测 |
| 11 | `task-11` | `task-11-floor-plan-editor/` | `run-k3-task-11-r1` | 1 | 无 | 无 | 待测 |
| 12 | `task-12` | `task-12-calculator/` | `run-k3-task-12-r1` | 1 | 无 | 无 | 待测 |
| 13 | `task-13` | `task-13-weather-dashboard/` | `run-k3-task-13-r1` | 1 | 无 | 无 | 待测 |
| 14 | `task-14` | `task-14-bank-website/` | `run-k3-task-14-r1` | 1 | 无 | 无 | 待测 |
| 15 | `task-15` | `task-15-book-tracker/` | `run-k3-task-15-r1` | 1 | 无 | 无 | 待测 |

> 目录 slug 沿用既有 Phase 1 归档（DeepSeek / GPT-5.6）的规范 slug，同题同名便于并排对照。各题 `prompt.txt` 的 SHA-256 已与既有归档逐题比对一致。

## 5. 追加指令（仅多轮任务）

无。本次 15 题全部为单轮任务，无补充轮。

## 6. 评分与评价规则（运行前固定）

- 人工评价：由组织者在测试结束后逐题评价成果，非盲评（组织者已知模型身份），存档于 `phase-01/Reviews/Personal_Review.md`；
- AI 评价：允许；评委工具与 Prompt 版本记录在该评价目录的 `README.md`（`Reviews/ai/<评委>-vN/`），同一运行可挂多份 AI 评价；
- 评分方法留档；不同评委、不同口径的分数不得合成为排行榜或排序，展示时并列呈现。

## 7. 已知风险

- 训练数据可能包含公开题目/答案（无法验证，记为风险）；
- 隔离为策略级约束，挡不住有意读取；结论以收尾审查为准，措辞用「未发现越界」，不写「无污染」；
- 本机可能同时存在其他 `test-workspace*` 副本在测同题/同阶段，收尾审查必须检查跨副本访问；
- 本机环境（浏览器、网络关闭仅靠规则约束）对任务完成度与复验方式的影响；
- Kimi Code 会话日志为本机记录，token / 耗时统计以 harness 日志为准。

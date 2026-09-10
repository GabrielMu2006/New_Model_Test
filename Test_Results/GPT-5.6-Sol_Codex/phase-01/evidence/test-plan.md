# phase-01 测试计划 / Test plan

> 由 `test-workspace-2/_templates/PLAN.template.md` 生成。组织者填写，维护 agent 维护，测试期间不得随意改动。
> 规范依据：`docs/testing-protocol.md`、`docs/result-interface.md`。

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| phaseId | `phase-01` |
| 被测模型（显示名） | GPT-5.6 Sol |
| 模型 slug | `gpt-5-6-sol` |
| 模型实际版本 / 供应商 | `null` / OpenAI |
| 思考强度 | medium |
| harness / 版本 | Codex / `null` |
| harness 运行方式 | desktop |
| 题目文档 | `PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md` |
| 题目范围 | `Task 01 – 15`，共 `15` 题 |
| 每题是否单轮 | 是 |
| 开测时间 / 时区 | 待用户手工启动 / Asia/Shanghai |
| 组织者 | 用户手工启动任务；Codex 组织会话生成脚手架 |

## 2. 预算与终止条件（开测前固定）

| 项目 | 上限 |
| --- | --- |
| 单题墙钟时间 | 无额外限制 |
| 单题 token（输入 / 输出） | 无额外限制 |
| 工具调用次数 | 无额外限制 |
| 重试次数 | 0 |
| 补充轮次数 | 0 |
| 超时判定 | 仅受 Codex 平台本身限制；不安排重试 |

## 3. 隔离与网络

| 字段 | 值 |
| --- | --- |
| 隔离等级 | `workspace-only`（固定） |
| 实际执行环境 | 本机同用户 |
| 任务目录位置 | `test-workspace-2/phase-01/task-NN-<slug>/` |
| 只读输入清单 | `prompt.txt`；无 `assets/` |
| 网络策略 | 关闭 |
| 仓库访问规则 | 被测规则禁止一切仓库查询（每题 `AGENTS.md` 第 2 节） |
| 会话是否共享上下文 | 否；每题由用户在对应目录手工开启全新会话 |

> 本方案是**策略级约束 + 收尾审查**：报告与展示必须标注「策略级约束 + 事后审查」，不得写「强制隔离」「无污染」。

## 4. 任务清单

| # | taskId | 目录 | runId | 轮次 | 允许素材 | 允许域名 | 状态 |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 1 | `task-01` | `task-01-aevum-luxury-watch/` | `run-gpt-5-6-sol-task-01-r1` | 1 | 无 | 无 | 待测 |
| 2 | `task-02` | `task-02-pelican-riding-bicycle/` | `run-gpt-5-6-sol-task-02-r1` | 1 | 无 | 无 | 待测 |
| 3 | `task-03` | `task-03-analog-clock-6-25/` | `run-gpt-5-6-sol-task-03-r1` | 1 | 无 | 无 | 待测 |
| 4 | `task-04` | `task-04-analog-clock-11-52-30/` | `run-gpt-5-6-sol-task-04-r1` | 1 | 无 | 无 | 待测 |
| 5 | `task-05` | `task-05-side-view-bicycle-rider/` | `run-gpt-5-6-sol-task-05-r1` | 1 | 无 | 无 | 待测 |
| 6 | `task-06` | `task-06-hand-cutting-paper/` | `run-gpt-5-6-sol-task-06-r1` | 1 | 无 | 无 | 待测 |
| 7 | `task-07` | `task-07-person-pushing-wheelbarrow/` | `run-gpt-5-6-sol-task-07-r1` | 1 | 无 | 无 | 待测 |
| 8 | `task-08` | `task-08-single-file-breakout/` | `run-gpt-5-6-sol-task-08-r1` | 1 | 无 | 无 | 待测 |
| 9 | `task-09` | `task-09-top-down-farming-game/` | `run-gpt-5-6-sol-task-09-r1` | 1 | 无 | 无 | 待测 |
| 10 | `task-10` | `task-10-pixel-art-editor/` | `run-gpt-5-6-sol-task-10-r1` | 1 | 无 | 无 | 待测 |
| 11 | `task-11` | `task-11-floor-plan-editor/` | `run-gpt-5-6-sol-task-11-r1` | 1 | 无 | 无 | 待测 |
| 12 | `task-12` | `task-12-calculator-app/` | `run-gpt-5-6-sol-task-12-r1` | 1 | 无 | 无 | 待测 |
| 13 | `task-13` | `task-13-weather-dashboard/` | `run-gpt-5-6-sol-task-13-r1` | 1 | 无 | 无 | 待测 |
| 14 | `task-14` | `task-14-bank-website/` | `run-gpt-5-6-sol-task-14-r1` | 1 | 无 | 无 | 待测 |
| 15 | `task-15` | `task-15-book-tracking-app/` | `run-gpt-5-6-sol-task-15-r1` | 1 | 无 | 无 | 待测 |

## 5. 追加指令（仅多轮任务）

不适用：本阶段每题补充轮次数为 0。

## 6. 评分与评价规则（运行前固定）

- 本文件不向被测会话提供理论成果、检验内容、参考答案或历史评价。
- 评分与评价由组织者在测试完成后按项目维护流程独立执行并留档。
- 不同评价来源分别标注，不合成为未经定义的排行榜分数。

## 7. 已知风险

- 隔离依赖目录规则与事后工具调用审查，属于策略级约束，并非强制文件系统隔离。
- 用户需确保每题从对应 task 目录手工开启全新 Codex 会话，并选择 GPT-5.6 Sol、medium。
- 模型实际版本与 Codex harness 版本当前未知，记为 `null`，不得猜测补齐。
- 训练数据可能包含公开题目或答案，无法验证，记为风险。

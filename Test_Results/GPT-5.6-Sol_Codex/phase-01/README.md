# GPT-5.6 Sol / Phase 1

GPT-5.6 Sol（medium）在 Phase 1 Task 01–15 的原始成果、逐字 Prompt、运行元数据与收尾审查归档。

| 统计 | 值 |
| --- | --- |
| 模型 | `gpt-5.6-sol`（OpenAI；provider-side snapshot 未独立确认） |
| Harness | Codex CLI 0.147.0（session source=cli） |
| 会话 | 15 个任务 / 15 个独立会话 |
| 累计用时 | 76 分 46 秒（各 session 的 task_complete.duration_ms 求和） |
| API / 工具调用 / 失败 | 120 / 76 / 1 |
| Token | total 4316152；input 4187022（含 cache read 3650560）+ output 129130 |
| 隔离 | `workspace-only`，策略级约束 + 事后审查 |
| 审计 | 15/15 未发现越界；Task 07/08 存在本地 prompt 重读流程偏差 |
| 评价 | 暂无独立人工或 AI 评价 |

## 任务一览

| # | runId | 成果 | 秒 | 工具 | 失败 | total tokens | 审计 |
| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| 01 | `run-gpt-5-6-sol-task-01-r1` | HTML · `index.html` | 366 | 3 | 0 | 134487 | 未发现越界 |
| 02 | `run-gpt-5-6-sol-task-02-r1` | SVG · `pelican-riding-bicycle.svg` | 126 | 2 | 0 | 87610 | 未发现越界 |
| 03 | `run-gpt-5-6-sol-task-03-r1` | SVG · `analog-clock.svg` | 135 | 6 | 0 | 198609 | 未发现越界 |
| 04 | `run-gpt-5-6-sol-task-04-r1` | SVG · `clock.svg` | 122 | 2 | 0 | 86018 | 未发现越界 |
| 05 | `run-gpt-5-6-sol-task-05-r1` | SVG · `bicycle-rider.svg` | 139 | 3 | 0 | 113249 | 未发现越界 |
| 06 | `run-gpt-5-6-sol-task-06-r1` | SVG · `hand-cutting-paper.svg` | 142 | 3 | 0 | 114844 | 未发现越界 |
| 07 | `run-gpt-5-6-sol-task-07-r1` | SVG · `person-pushing-wheelbarrow.svg` | 189 | 11 | 1 | 363409 | 未发现越界；本地 prompt 重读 |
| 08 | `run-gpt-5-6-sol-task-08-r1` | HTML · `index.html` | 423 | 6 | 0 | 546195 | 未发现越界；本地 prompt 重读 |
| 09 | `run-gpt-5-6-sol-task-09-r1` | HTML · `index.html` | 310 | 3 | 0 | 129866 | 未发现越界 |
| 10 | `run-gpt-5-6-sol-task-10-r1` | HTML · `index.html` | 374 | 6 | 0 | 220558 | 未发现越界 |
| 11 | `run-gpt-5-6-sol-task-11-r1` | HTML · `index.html` | 544 | 7 | 0 | 1031685 | 未发现越界 |
| 12 | `run-gpt-5-6-sol-task-12-r1` | HTML · `index.html` | 364 | 8 | 0 | 609284 | 未发现越界 |
| 13 | `run-gpt-5-6-sol-task-13-r1` | HTML · `index.html` | 389 | 5 | 0 | 190378 | 未发现越界 |
| 14 | `run-gpt-5-6-sol-task-14-r1` | HTML · `index.html` | 571 | 5 | 0 | 216296 | 未发现越界 |
| 15 | `run-gpt-5-6-sol-task-15-r1` | HTML · `index.html` | 412 | 6 | 0 | 273664 | 未发现越界 |

## 归档与证据

每题采用首次运行的扁平 `task-NN-<canonical-slug>/` 布局，包含 `prompt.txt`、`followups.json`、`artifacts/`、`evidence/`、`submission.json` 和入口 `README.md`。归档 slug 与既有 Phase 1 同题目录保持一致；工作区原目录名保留在 `prompt.localScaffoldPath`。

原始 Codex JSONL 未公开复制，避免发布完整私人会话与系统配置；每题保存原始日志位置的脱敏表示、SHA-256、记录数和审计报告。阶段级 [审计脚本](evidence/audit-codex-sessions.mjs) 与 [测试计划](evidence/test-plan.md) 一并归档。

## 已知限制

1. Codex JSONL 的 reasoning 仅有 `encrypted_content`，无法检查明文推理；工具调用、工具结果、用户输入和环境元数据已检查。
2. 隔离是策略级 `workspace-only`，读取与联网并非环境层强制不可达；未运行探针。
3. Task 07 与 Task 08 在已收到逐字题目后又读取本地 `prompt.txt`；内容与原题一致，无外部答案，但属于执行流程偏差。
4. 本次归档未在独立评测环境复跑成果，也未生成评价或分数。
5. 训练数据、harness 未记录的渠道、外部工具/连接器/缓存无法由本日志审计排除。

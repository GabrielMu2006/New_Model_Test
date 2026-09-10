# run-deepseek-v4-1-flash-exp-0910-task-20-r1

| 字段 | 值 |
| --- | --- |
| phaseId / taskId / taskVersion | `phase-02` / `task-20` / `1` |
| 模型 | DeepSeek-V4.1-Flash-Exp-0910（harness 报告 id `deepseek-v4.1-flash-expires-on-0910`，供应商 `deepseek-official`；未获供应商侧确认） |
| harness | DSH 2.0.5（桌面 GUI 会话，单题独立会话） |
| sessionId | `session-b84d3d60-6b52-4dda-b136-f0833e04cc89` |
| 起止 / 时长 | 2026-09-10T02:38:36.963Z → 2026-09-10T03:07:24.903Z（1728 秒） |
| 结束原因 | `completed` |
| 轮次 | 单轮，无补充轮 |
| 步骤 / 工具调用 | 123 / 125 |
| token（input / output / cacheRead） | 60712 / 225326 / 19783936 |
| 隔离 / 污染 | `workspace-only`（策略级约束 + 事后审查） / `suspected` |

## 入口与运行

- 入口：`artifacts/index.html`
- 归档文件清单（`artifacts/files`）：19 个，见 `submission.json`
- 运行方式与逐条需求对照：见 `artifacts/README.md`（模型自述）

## 收尾审查

- 审查已完成；完整结论、覆盖维度与未覆盖渠道见 `evidence/audit-2026-09-10.md`（人类可读）与 `evidence/audit-2026-09-10.json`（机器可读）
- 按 2026-09-10 规则：越界尝试与嫌疑只记入审计档案，**不作外显标注**；本 run **不被排除、不作废、不改分**，照常计入本阶段成绩
- 覆盖维度：会话与策略、工具清单、路径、命令、仓库查询、网络、读禁止内容、写越界、委派、推理文本、同题副本
- 原始会话日志未随公开档案入库，封存在原机：`evidence/session-log.sha256.txt` 记录路径、大小与 SHA-256

## 已知限制

- 隔离是**策略级约束**（`AGENTS.md` 两条绝对规则 + 事后审查），不是强制隔离；不得表述为「强制隔离」或「无污染」
- 题目 Task 16–45 已在公开仓库发布（提交 `0540edf`，见 `docs/known-issues.md` 4.0），本阶段成绩须同时标注这一点
- 成果内的测试结果均为**作者自述**，本次未在隔离环境复跑
- 训练数据是否包含本题答案无法用日志判定

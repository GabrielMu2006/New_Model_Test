# run-deepseek-v4-1-flash-exp-0910-task-17-r1

| 字段 | 值 |
| --- | --- |
| phaseId / taskId / taskVersion | `phase-02` / `task-17` / `1` |
| 模型 | DeepSeek-V4.1-Flash-Exp-0910（harness 报告 id `deepseek-v4.1-flash-expires-on-0910`，供应商 `deepseek-official`；未获供应商侧确认） |
| harness | DSH 2.0.5（桌面 GUI 会话，单题独立会话） |
| sessionId | `session-f4bf2a9f-9ea2-4642-b2e7-59de1ab1013b` |
| 起止 / 时长 | 2026-09-09T15:49:25.507Z → 2026-09-09T16:29:22.236Z（2397 秒） |
| 结束原因 | `completed` |
| 轮次 | 单轮（含 1 次补充轮，见 followups.json） |
| 步骤 / 工具调用 | 117 / 117 |
| token（input / output / cacheRead） | 51361 / 237863 / 24286080 |
| 隔离 / 污染 | `workspace-only`（策略级约束 + 事后审查） / `suspected` |

## 入口与运行

- 入口：`artifacts/mechanical-watch-movement.svg`
- 归档文件清单（`artifacts/files`）：9 个，见 `submission.json`
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

## 补充轮

- 第 2 轮（2026-09-09T16:27:55+08:00，organizer (human)）：「不要再读取chrome钥匙串了」——运行中观察到 Chrome 启动触碰钥匙串/默认 profile 活动，机主中途介入要求停止；影响：模型随后为浏览器启动加上 --use-mock-keychain --password-store=basic --disable-sync，并把浏览器步骤改为 opt-in；该轮输入未提供任何题目提示或答案

# 模型测试成果

目录按 **模型 → 阶段** 组织。

- [DeepSeek-V4.1-Flash / Phase 1](DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/README.md)：保留 15 个任务的原始成果、截图、测试脚本和 Reviews。目录名 `DeepSeek-V4.1-Flash-Exp-0910_DSH` 是**历史兼容名称**，不再随显示名改动；_DSH 是 harness 标记，实际模型与 harness 在元数据中分列。
- [Muse-Spark-1.3 / Phase 1](Muse-Spark-1.3_Opencode/phase-01/README.md)：Muse Spark 1.3（opencode harness）的 15 项交付物、逐字 prompt（事后补录）、人工评价、执行复盘与 AI 评价 v1。_Opencode 为历史文件夹名称。
- [GPT-5.6 Sol / Phase 1](GPT-5.6-Sol_Codex/phase-01/README.md)：GPT-5.6 Sol（Codex CLI 0.147.0，medium）的 15 次独立运行、逐字 prompt、原始成果、逐题元数据与收尾审查；逐题 AI 评价 maintenance-agent-v3（非盲评，平均 82.9/100），人工评价待产出。
- [DeepSeek-V4.1-Flash / Phase 2](DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/README.md)：Task 16–20（5/30 题，部分归档）按扁平 `task-NN-<slug>/` 布局保存逐字 prompt、成果、收尾审查报告与任务 README；含 1 份/题的 AI 评价（[muse-spark-v1](DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/Reviews/ai/muse-spark-v1/README.md)，评价者 Muse Spark 1.3，非盲评，平均 91.0/100）；人工评价待产出。
- [Muse-Spark-1.3 / Phase 2](Muse-Spark-1.3_Opencode/phase-02/README.md)：同题 Task 16–20 的 5 次运行，含 1 份/题的 AI 评价（[maintenance-agent-v2](Muse-Spark-1.3_Opencode/phase-02/Reviews/ai/maintenance-agent-v2/README.md)，非盲评，平均 88.2/100）、可复现取证脚本与截图；人工评价待产出。
- [GPT-5.6 Sol / Phase 1](GPT-5.6-Sol_Codex/phase-01/README.md)：**第三个模型**，与另三个模型同跑第一阶段 15 题（Codex CLI 0.147.0，medium effort，每题独立会话），含逐题 AI 评价 maintenance-agent-v3（非盲评，平均 82.9/100）与审查证据；人工评价待产出。
- [K3 / Phase 1](K3_KimiCode/phase-01/README.md)：**第四个模型**，与另三个模型同跑第一阶段 15 题（Kimi Code CLI 0.42.0，thinkingEffort max，每题独立单轮会话），含逐题元数据与审查证据；逐题 AI 评价 maintenance-agent-v4（非盲评，平均 93.3/100），人工评价待产出。本批归档提交 `1afdc8c`（2026-09-12）。

> 第一阶段的**四个**模型目录均采用扁平 `task-*/` + 阶段级 `Reviews/` 布局，便于同题对照；后续评价按 `Reviews/ai/<评价者>-vN/` 接口追加，不覆盖既有内容。
> 0910 实验版与随后发布的正式版 `DeepSeek-V4.1-Flash` 视为**同一个模型**（2026-09-10 组织者决定），成绩同表记录；每条运行用 `environment.reportedModelId` 标明实际使用的快照，归档目录名保持不变。
> **Phase 2 沿用与第一阶段相同的扁平 `task-NN-<slug>/` 布局**（2026-09-10 组织者决定）：每题一个目录，`runId` 记录在目录内的 `submission.json`；两个模型同题同名 slug，便于并排对照。同一题的重复运行（r2 及以后）才放该阶段的 `runs/<新run-id>/`。评价一律放阶段级 `Reviews/`。

后续运行目录和字段见 `../docs/result-interface.md`，接入网站步骤见 `../docs/adding-results.md`，隔离/防作弊方案见 `../docs/testing-protocol.md`。

本目录是测试结束后的归档，**不得挂载到被测模型的运行环境**。第一阶段移动只改变位置，不修改文件内容；报告中出现的旧根路径是历史记录，当前路径以本索引为准。

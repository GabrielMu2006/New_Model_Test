# 模型测试成果

目录按 **模型 → 阶段** 组织。

- [DeepSeek-V4.1-Flash / Phase 1](DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/README.md)：保留 15 个任务的原始成果、截图、测试脚本和 Reviews。目录名 `DeepSeek-V4.1-Flash-Exp-0910_DSH` 是**历史兼容名称**，不再随显示名改动；_DSH 是 harness 标记，实际模型与 harness 在元数据中分列。
- [Muse-Spark-1.3 / Phase 1](Muse-Spark-1.3_Opencode/phase-01/README.md)：Muse Spark 1.3（opencode harness）的 15 项交付物、逐字 prompt（事后补录）、人工评价、执行复盘与 AI 评价 v1。_Opencode 为历史文件夹名称。
- [DeepSeek-V4.1-Flash / Phase 2](DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/README.md)：Task 16–20（5/30 题，部分归档）按 `runs/<run-id>/` 契约保存逐字 prompt、成果、收尾审查报告与运行 README；尚无独立评价。
- [Muse-Spark-1.3 / Phase 2](Muse-Spark-1.3_Opencode/phase-02/README.md)：同题 Task 16–20 的 5 次运行，含 1 份/题的 AI 评价（maintenance-agent-v2，平均 88.2/100）、可复现取证脚本与截图；人工评价待产出。

> 第一阶段的两个目录布局一致（扁平 `task-*/` + `Reviews/`），便于同题对照；Muse 档案的 AI 评价按 `Reviews/ai/<评价者>-vN/` 接口组织，可继续追加其他评价。
> 0910 实验版与随后发布的正式版 `DeepSeek-V4.1-Flash` 视为**同一个模型**（2026-09-10 组织者决定），成绩同表记录；每条运行用 `environment.reportedModelId` 标明实际使用的快照，归档目录名保持不变。
> Phase 2 起改用 `runs/<run-id>/` 布局：每题的逐字输入、成果清单（`submission.json`）与审查证据各自封存在自己的运行目录内。

后续运行目录和字段见 `../docs/result-interface.md`，接入网站步骤见 `../docs/adding-results.md`，隔离/防作弊方案见 `../docs/testing-protocol.md`。

本目录是测试结束后的归档，**不得挂载到被测模型的运行环境**。第一阶段移动只改变位置，不修改文件内容；报告中出现的旧根路径是历史记录，当前路径以本索引为准。

# phase-02 · Muse Spark 1.3 xhigh（opencode）

> 模型目录：`Test_Results/Muse-Spark-1.3_Opencode/phase-02/`（扁平 `task-NN-<slug>/` 布局，与第一阶段一致；两个模型同题同名 slug）。
> 状态：部分归档 —— 5/30（Task 16–20），Task 21–45 待测。**AI 评价已产出（1 份/题，maintenance-agent-v2，平均 88.2/100）；人工评价尚未产出，因此本阶段不给综合结论分。**

## 运行

| taskId | runId | 成果 | 状态 | AI 评价 |
| --- | --- | --- | --- | ---: |
| task-16 | `run-muse-spark-1-3-xhigh-task-16-r1` | `pelican-bicycle.svg` | completed | 85/100 |
| task-17 | `run-muse-spark-1-3-xhigh-task-17-r1` | `index.html` + `watch-movement.svg` | completed | 88/100 |
| task-18 | `run-muse-spark-1-3-xhigh-task-18-r1` | `index.html` | completed | 88/100 |
| task-19 | `run-muse-spark-1-3-xhigh-task-19-r1` | `index.html` | completed | 88/100 |
| task-20 | `run-muse-spark-1-3-xhigh-task-20-r1` | `index.html` + `app.js` + `solver.js` + `style.css` + `run_tests.js` | completed | 92/100 |

每个 `task-NN-<slug>/` 含：`prompt.txt`（逐字）、`artifacts/`、`evidence/isolation-rules.md` + `evidence/review.json`（含统计与审查结论）、`submission.json`、`README.md`。`runId` 记录在 `submission.json` 内，不作目录名；同一题的重复运行才放 `runs/<新run-id>/`。

## 评价

| 项 | 值 |
| --- | --- |
| AI 评价 | **1 份/题**，`maintenance-agent-v2`（维护 agent，DeepSeek Harness），**非盲评**，日期 2026-09-10 |
| 阶段总评 | [`Reviews/ai/maintenance-agent-v2/phase-summary.md`](Reviews/ai/maintenance-agent-v2/phase-summary.md)（含方法与边界、证据清单、逐题分析） |
| 逐题评价 | `Reviews/ai/maintenance-agent-v2/task-16.md` … `task-20.md`（**评价放阶段级 `Reviews/`，不放任务目录**） |
| 取证 | [`evidence/evaluation-2026-09-10/`](evidence/evaluation-2026-09-10/)（4 个可复现脚本、4 份 checks JSON、17 张截图） |
| 平均分 | **88.2/100**（自定口径，**不可与第一阶段 84.9 或 DeepSeek 93.6 直接比较**：题目集、harness、预算均不同） |
| 人工评价 | **尚未产出**（本目录下暂无人工评价文件） |

评价方法（v2 相对 v1 的升级）：在组织者自建的静态服务下用 Chromium 无头渲染并驱动交互，做 canvas 级像素比对、应用读数（`#hudTime` / `#sim-date`）、逐元素旋转角度差与**关节坐标复算连杆长度**；视觉维度由视觉桥接模型描述截图。**未运行成果自带脚本**。

## 审查与限制

- 隔离 `workspace-only`（策略级约束 + 事后审查）；审查结论：**未发现越界**（详见工作区 `test-workspace-3/phase-02/SUMMARY-tasks-16-20.md`，程序性备注记入各 `review.json` 审计档案，不作外显标注）。
- 各题最后回答的明确 limit 已原样记入上述 SUMMARY 第 4 节。
- task-20 自带测试套件经组织者独立复跑：20/20 pass（属该次复跑的证据，不是本次 AI 评价的结论）。
- 题目 Task 16–45 已在公开仓库发布（提交 `0540edf`），成绩须同时标注该暴露；训练数据是否包含本题答案无法用日志判定。
- 网站导入已完成：展示站收录这 5 条运行，与 DeepSeek 同题可并排对比（**跨模型比较须注明 harness、预算与隔离差异**）。

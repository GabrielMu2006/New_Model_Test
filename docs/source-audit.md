# M0 来源审计 / Source audit

2026-09-09 目录迁移：当前题目位于 PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md，成果位于 Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/。下方基线提交中的旧路径保留；通过 sourcePathMappings 生成历史源码链接。迁移不更改原始题目或成果文件内容。

审计基线提交：`5776d3a1d94dc4b04d83fa94d482e04478fd4076`。15 条任务均从 `15_TEST_PROMPTS_BILINGUAL.md` 映射；会话与指标从评测复盘第 29–70 行映射；人工评价来自 `Personal_Review.md`；AI 评价来自 `15-任务完成质量评估.md`——**该报告由 Codex Desktop 0.153.4 / GPT-5 于 2026-09-09 撰写**，与 Muse phase-01 的 `Reviews/ai/codex-v1/` 是**同一评价者**（组织者 2026-09-12 确认署名；此前档案未记作者，展示站曾以文件名代称）。该报告只评 DeepSeek 的交付物，未见跨模型引用，故不据此标注盲评状态。

## 映射

| 任务 | 会话 | 成果 | 类型 |
|---|---|---|---|
| 01 | 89716f93 | Aevum `index.html` | HTML |
| 02 | 0e1e035d | `pelican-on-bicycle.svg` | SVG |
| 03–04 | 17e6215c | 两个时钟 SVG | SVG |
| 05–07 | 4a0d64ce | 三个动作 SVG | SVG |
| 08 | 2579bde9 | Breakout `index.html` | HTML |
| 09 | 28e77186 | Farming `index.html` | HTML |
| 10 | da8df324 | Pixel editor `index.html` | HTML |
| 11 | 2d2be5e2 | Floor plan app | HTML |
| 12 | f87c54e3 | Calculator app | HTML |
| 13 | 31de8e10 | Weather dashboard | HTML |
| 14 | 214420b0 | 9-page bank site | HTML |
| 15 | b25a11c4 | Book tracker | HTML |

## Phase 2（Task 16–20，2026-09-10 接入）

来源：`PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md` 的 Task 16–20（`taskVersion = 1`）与 `Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/task-NN-<slug>/`（扁平布局）。
成果与运行页源码链接固定到本批次的归档提交 `a9925d853af078d931e96ee769aa119e2f0bd997`（不再是第一阶段基线提交）；历史路径映射只对第一阶段提交生效，不会套用到新目录。

| 任务 | 会话 | 成果 | 类型 | 越界判定 |
|---|---|---|---|---|
| 16 | `session-3e6b3dce` | `pelican-bicycle.svg` | SVG | `unknown`（未发现越界） |
| 17 | `session-f4bf2a9f` | `mechanical-watch-movement.svg` + 构建/验证脚本 | SVG | `suspected`（越界尝试，未取得内容；另有 1 次组织者补充轮） |
| 18 | `session-f220eec5` | Rube Goldberg 多文件应用 | HTML | `unknown`（未发现越界） |
| 19 | `session-34287563` | 交互式太阳系模拟 | HTML | `unknown`（未发现越界） |
| 20 | `session-b84d3d60` | 二维连杆设计器 | HTML | `suspected`（越界尝试，未取得内容） |

口径：`prompt.txt` 为**逐字存档**（组织者粘贴进对话，导入时与归档声明的 SHA-256 校验一致），不是事后补录；独立评价尚未产出，因此本批次不计综合分。

模型身份：实体 `deepseek-v4-1-flash-exp-0910` 在展示站显示为 `DeepSeek-V4.1-Flash（0910 实验版 + 正式版）`（2026-09-10 组织者决定，两个发布版本视为同一模型）。本批次 5 条运行的 `environment.reportedModelId` 均为 `deepseek-v4.1-flash-expires-on-0910`；phase-01 的 15 条运行归档未记录 model id，记 `null`。实体 id 与全部运行 URL 未改动。

## Phase 2 Muse Spark 批次（Task 16–20，2026-09-10 归档）

来源：`PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md` 的 Task 16–20（`taskVersion = 1`）与 `Test_Results/Muse-Spark-1.3_Opencode/phase-02/runs/<run-id>/`。模型 `muse-spark-1.3-contributor-free`（显示名 Muse Spark 1.3 xhigh），harness opencode `1.18.30` desktop，预算重试 0、补充轮 0。

| 任务 | 会话（opencode） | runId | 成果 | 类型 | 越界判定 |
|---|---|---|---|---|---|
| 16 | `ses_f76be500` | `run-muse-spark-1-3-xhigh-task-16-r1` | `pelican-bicycle.svg` | SVG | 未发现越界 |
| 17 | `ses_f76adeb6` | `run-muse-spark-1-3-xhigh-task-17-r1` | `index.html` + `watch-movement.svg` | HTML | 未发现越界 |
| 18 | `ses_f76a6487` | `run-muse-spark-1-3-xhigh-task-18-r1` | `index.html` | HTML | 未发现越界 |
| 19 | `ses_f767c729` | `run-muse-spark-1-3-xhigh-task-19-r1` | `index.html` | HTML | 未发现越界 |
| 20 | `ses_f7678f4f` | `run-muse-spark-1-3-xhigh-task-20-r1` | 连杆设计器 5 文件 | HTML | 未发现越界 |

口径：`prompt.txt` 为**逐字存档**（首轮输入与归档逐字一致，已程序化比对；SHA-256 见 `PLAN.md` 与各 `submission.json`）；工作区 `test-workspace-3/phase-02/SUMMARY-tasks-16-20.md` 记录统计、审查结论与各题最后回答的明确 limit；task-20 套件经组织者独立复跑 20/20。程序性备注（`ls /Applications` 环境探测、`/tmp` 自写校验脚本）记入各 `evidence/review.json`，无外部内容流入，按三档处置口径不作外显标注、不影响成绩。独立评价尚未产出，不计综合分；Task 21–45 待测。

## Muse Spark 1.3 · Phase 2（Task 16–20，2026-09-10 接入）

来源：同题 `PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md`（`taskVersion = 1`）与 `Test_Results/Muse-Spark-1.3_Opencode/phase-02/task-NN-<slug>/`（扁平布局）；成果与评价链接固定到本批次归档提交 `66aa028b58f17505426a6f4217b0dbf787a72218`。

| 任务 | runId | 成果 | 隔离/越界 | AI 评价 |
|---|---|---|---|---|
| 16 | `run-muse-spark-1-3-xhigh-task-16-r1` | `pelican-bicycle.svg` | `workspace-only` / 未发现越界 | maintenance-agent-v2 v2 · **85** |
| 17 | `run-muse-spark-1-3-xhigh-task-17-r1` | `index.html` + `watch-movement.svg` | 同上 | **88** |
| 18 | `run-muse-spark-1-3-xhigh-task-18-r1` | `index.html` | 同上 | **88** |
| 19 | `run-muse-spark-1-3-xhigh-task-19-r1` | `index.html` | 同上 | **88** |
| 20 | `run-muse-spark-1-3-xhigh-task-20-r1` | `index.html` + 4 个源文件 | 同上 | **92** |

评价来源：`Reviews/ai/maintenance-agent-v2/task-NN.md` 与同目录 `README.md`/`phase-summary.md`；取证脚本与读数在 `evidence/evaluation-2026-09-10/`。**非盲评 AI 评价，无人工评价**；与 DeepSeek 同题分数不可比较（harness、预算、深度不同）。

## GPT-5.6 Sol · Phase 1（15 题，2026-09-10 接入）

来源：与另两个模型同一份 `PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md`（`taskVersion = 1`）与 `Test_Results/GPT-5.6-Sol_Codex/phase-01/task-NN-<slug>/`；成果与评价链接固定到该批次归档提交 `a5b0c7ea1ea8f2dfc3dd093524ca1dc24773703d`。
执行：Codex CLI 0.147.0（medium effort），每题一个独立会话，共 15 个；`environment.reportedModelId = gpt-5.6-sol`（harness 报告值，供应商侧快照未独立确认）。
评价来源：`Reviews/ai/maintenance-agent-v3/task-01.md … task-15.md`（维护 agent v3，非盲评，平均 82.9/100）；该批评价文件在本次接入时尚未提交，随接入一并入库。
任务实体不重复定义：这 15 题已由第一阶段适配器定义，GPT 批次只新增运行、评价与批次实体。

## K3 · Phase 1（15 题，2026-09-12 归档，待接入）

来源：与既有三个模型同一份 `PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md`（`taskVersion = 1`）与 `Test_Results/K3_KimiCode/phase-01/task-NN-<slug>/`（扁平布局，slug 与既有同题目录同名）。本批由组织 agent 在本地工作区完成归档，**尚未提交**；`source.commit` 与固定版本链接待维护者入库后回填。
执行：Kimi Code CLI 0.42.0（`kimi-code/k3`，thinkingEffort `max`），每题一个全新独立单轮会话，共 15 个；`environment.reportedModelId = k3`（harness 报告值，供应商侧快照未独立确认）。
口径：`prompt.txt` 为逐字存档（15/15 与既有归档 SHA-256 逐题一致；会话 `turn.prompt` 输入再与 `prompt.txt` 哈希比对一致）；统计以 Kimi Code 会话日志（wire.jsonl）为准。
审查：遥测 `visible`（完整工具调用记录，推理为明文），15/15 未发现越界；程序性备注（`/tmp` 自写临时文件、`ls /Applications`、`ls ~/.cache/ms-playwright`、`npm ls -g` 环境探测）记入各题 `evidence/audit-2026-09-12.{json,md}` 与 `contamination.events`，无外部内容流入，按三档处置口径不作外显标注、不影响成绩。
评价：人工与 AI 评价均未产出（`reviews: []`），按接口后续追加。Task 13 的 `.chrome-profile/`（浏览器状态目录）按规则不入公开归档，仅留工作区。

## 保留的分歧与边界

- Task 06：人工评价认为手和剪刀“很奇怪”，历史 AI 报告给 92/100 并认为关系明确。
- Task 07：人工评价指出人体、车体和轮位问题，历史 AI 报告给 95/100 并认为推动关系明确。
- `93.6/100`、`15/15` 仅引用历史 AI 报告，不作为展示站独立证明。
- 截图和报告可能晚于初始生成；源码链接固定到上述归档提交，不声称所有文件等同于生成瞬间版本。
- ¥9.30 只有批次口径；不导出单题费用。

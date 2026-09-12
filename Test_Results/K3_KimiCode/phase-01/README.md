# K3 / Phase 1

K3（Kimi Code CLI，thinkingEffort `max`）在 Phase 1 Task 01–15 的原始成果、逐字 Prompt、运行元数据与收尾审查归档。

| 统计 | 值 |
| --- | --- |
| 模型 | `k3`（harness 报告 id，alias `kimi-code/k3`；供应商 Moonshot AI / Kimi 官方，provider-side 快照未独立确认） |
| Harness | Kimi Code CLI 0.42.0（surface=cli，Node 24.19.0，macOS 26.6.2 arm64） |
| 采样 | thinkingEffort `max` |
| 会话 | 15 个任务 / 15 个独立会话 / 全部单轮、无补充轮 |
| 累计用时 | 196 分 10 秒（各会话 wire.jsonl `turn.ended` durationMs 求和） |
| API / 工具调用 / 失败 | 250 / 259 / 12（失败 = 2 次 harness 自动重试的 API 连接错误 + 10 次自测迭代的工具错误返回） |
| Token | total 14290988；input 521100 + output 370144 + cache read 13399744 |
| 隔离 | `workspace-only`，策略级约束 + 事后审查 |
| 审计 | 15/15 未发现越界（no-violation-observed）；5 题有程序性备注（`/tmp` 临时文件、`/Applications` 与 `~/.cache` 环境探测），均无外部内容流入，按三档处置口径不作外显标注、不影响成绩 |
| 评价 | AI 评价 1 份/题：`Reviews/ai/maintenance-agent-v4/`（维护 agent v4，非盲评，平均 **93.3/100**）；人工评价暂无 |

## 任务一览

| # | runId | 成果 | 秒 | 工具 | 失败 | total tokens | 审计 |
| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| 01 | `run-k3-task-01-r1` | HTML · `index.html`（+2） | 1988 | 22 | 1 | 1111270 | 未发现越界；`/tmp` 临时渲染文件 |
| 02 | `run-k3-task-02-r1` | SVG · `pelican-on-bicycle.svg`（+1） | 415 | 12 | 0 | 453050 | 未发现越界 |
| 03 | `run-k3-task-03-r1` | SVG · `analog-clock-6-25.svg`（+1） | 136 | 4 | 0 | 143381 | 未发现越界 |
| 04 | `run-k3-task-04-r1` | SVG · `clock.svg`（+1） | 269 | 4 | 0 | 172455 | 未发现越界；`/Applications` 环境探测 |
| 05 | `run-k3-task-05-r1` | SVG · `bicycle-rider.svg`（+1） | 716 | 17 | 0 | 959230 | 未发现越界 |
| 06 | `run-k3-task-06-r1` | SVG · `scissors-cutting-paper.svg`（+1） | 714 | 4 | 0 | 234730 | 未发现越界 |
| 07 | `run-k3-task-07-r1` | SVG · `wheelbarrow.svg`（+1） | 259 | 4 | 0 | 163465 | 未发现越界 |
| 08 | `run-k3-task-08-r1` | HTML · `index.html` | 173 | 4 | 0 | 160690 | 未发现越界；`/tmp` 临时校验脚本 |
| 09 | `run-k3-task-09-r1` | HTML · `index.html`（+2） | 661 | 14 | 2 | 699726 | 未发现越界 |
| 10 | `run-k3-task-10-r1` | HTML · `index.html`（+3） | 383 | 8 | 1 | 336652 | 未发现越界 |
| 11 | `run-k3-task-11-r1` | HTML · `index.html`（+4） | 1134 | 18 | 2 | 1174387 | 未发现越界 |
| 12 | `run-k3-task-12-r1` | HTML · `index.html`（+4） | 245 | 11 | 1 | 382537 | 未发现越界 |
| 13 | `run-k3-task-13-r1` | HTML · `index.html`（+15） | 3083 | 81 | 1 | 5674847 | 未发现越界；`/Applications` 探测 + `/tmp` DOM 转储 |
| 14 | `run-k3-task-14-r1` | HTML · `index.html`（+11） | 1048 | 29 | 1 | 1489730 | 未发现越界 |
| 15 | `run-k3-task-15-r1` | HTML · `index.html`（+6） | 546 | 27 | 3 | 1134838 | 未发现越界；`~/.cache` 环境探测 |

> 「（+N）」为随入口文件一并归档的模型产出文件数（样式、脚本、自测、SVG 预览渲染、截图等），完整清单见各 `submission.json` 的 `artifacts.files`。

## 归档与证据

每题采用首次运行的扁平 `task-NN-<canonical-slug>/` 布局，包含 `prompt.txt`、`followups.json`（均为 `[]`）、`artifacts/`、`evidence/`、`submission.json` 和入口 `README.md`。归档 slug 与既有 Phase 1 同题目录保持一致；工作区原目录名保留在 `prompt.localScaffoldPath`。

原始会话日志（`~/.kimi-code/sessions/wd_task-*/session_*/`）未公开复制，避免发布完整私人会话与系统配置；每题保存原始日志位置的脱敏表示、wire.jsonl / kimi-code.log / state.json 的 SHA-256、记录数和审计报告（`evidence/audit-2026-09-12.{json,md}`）。阶段级 [审计脚本](evidence/k3-audit.py) 与 [测试计划](evidence/test-plan.md) 一并归档。

Task 13 的 headless-Chrome 配置目录（`.chrome-profile/`，约 11 MB 浏览器生成状态）按仓库规则不入公开归档，仅保留在工作区；模型自截的 12 张验证截图保留在 `artifacts/shots/`。

本批归档提交：`1afdc8cacbb8651cd2aa3939aab2be66a77030ba`（2026-09-12）。15 份 `submission.json` 的 `source.commit` / `source.path` 已回填该提交；逐题 AI 评价见 [`Reviews/ai/maintenance-agent-v4/`](Reviews/ai/maintenance-agent-v4/README.md)。

## 已知限制

1. 隔离是策略级 `workspace-only`，读取与联网并非环境层强制不可达；未运行探针。
2. 审计结论措辞为「未发现越界」，仅覆盖日志已记录渠道；训练数据、harness 未记录的渠道、外部工具/连接器/缓存无法由日志审计排除。
3. 5 题存在轻微程序性偏差（向 `/tmp` 写自生成的临时文件；`ls /Applications`、`ls ~/.cache/ms-playwright`、`npm ls -g` 等机器环境探测），均未获取题目相关外部内容，记入各题 `evidence/audit-2026-09-12.*` 与 `submission.json` 的 `contamination.events`，不作外显标注、不影响成绩。
4. 各题 HTTP 访问仅限会话自起的 127.0.0.1 loopback 预览服务（task-12、13 等），无外部请求；判为合规本地自测。
5. 本次归档未在独立评测环境复跑成果；token / 耗时统计以 Kimi Code 会话日志为准。评价方面：AI 评价 1 份/题（[`Reviews/ai/maintenance-agent-v4/`](Reviews/ai/maintenance-agent-v4/README.md)，非盲评，平均 **93.3/100**），人工评价尚无。
6. Kimi Code 不施加文件系统/网络沙箱；审批模式由用户在会话中设定（多为 manual → auto），属组织者侧配置，已记录于审计 JSON。

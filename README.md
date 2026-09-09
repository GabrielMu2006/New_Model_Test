# New Model Test · 新模型测试

> A growing, evidence-oriented benchmark archive for evaluating new AI models through visual generation, interactive applications, implementation quality, and reproducible testing.  
> 一个持续扩展、重视证据的模型评测档案，通过视觉生成、交互应用、工程实现与可复现测试来观察新模型的能力。

[中文](#中文说明) · [English](#english)

**公开展示站 / Public showcase:** https://vibetest.gabrielmu2006.cn/

浏览双语任务、真实成果预览、运行指标、独立评价来源与同题对比。Browse bilingual tasks, live artifacts, run metrics, independent reviews, and same-task comparisons.

## 中文说明

### 项目简介

本仓库用于公开记录和展示新模型测试。每个阶段保存当期使用的原始 prompt、模型交付物、运行或测试方法、视觉证据以及复盘报告。目标不是只展示“最好看的结果”，而是尽量保留从任务输入到成果、验证和问题分析的完整链路。

当前内容为 **第一阶段（Phase 1）**：使用 15 个任务评估 `DeepSeek-V4.1-Flash-Exp-0910` 在以下能力上的表现：

- SVG 视觉生成与精确约束遵循；
- 单文件网页、游戏和创作工具；
- 复杂交互式 Web 应用；
- 几何、计算、数据状态与错误处理；
- 响应式设计、可访问性、视觉完成度和自动化测试。

仓库将保留后续阶段扩展能力。未来可在 Test_Results/ 下增加模型文件夹，并在模型目录中增加阶段文件夹，并继续沿用“任务 → 原始 prompt → 成果 → 测试 → 评估”的归档方式。

### 当前阶段

| 阶段 | 被测模型 | 任务数 | 核心完成率 | 内部综合评估 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| Phase 1 | DeepSeek-V4.1-Flash-Exp-0910 | 15 | 15/15 | 93.6/100 | 已完成 |

> 综合分数来自仓库内的阶段性人工与自动化评估，用于总结本次测试，不应被视为跨模型通用排行榜分数。

### 第一阶段任务

| # | 任务 | 类型 | 主要交付物 |
| ---: | --- | --- | --- |
| 01 | Aevum 奢侈腕表落地页 | 单文件网页 | `index.html` |
| 02 | 骑自行车的鹈鹕 | SVG 视觉生成 | `pelican-on-bicycle.svg` |
| 03 | 模拟时钟 6:25 | SVG 精确约束 | `clock-625.svg` |
| 04 | 模拟时钟 11:52:30 | SVG 精确约束 | `clock-11-52-30.svg` |
| 05 | 侧面骑自行车的人 | SVG 姿态约束 | `bicycle_rider.svg` |
| 06 | 手持剪刀剪纸 | SVG 动作表达 | `scissors_cutting_paper.svg` |
| 07 | 推独轮车的人 | SVG 方向与动作约束 | `pushing_wheelbarrow.svg` |
| 08 | 霓虹打砖块 | 单文件游戏 | `index.html` |
| 09 | 山谷农场 | 单文件游戏 | `index.html` |
| 10 | 像素画编辑器 | 单文件创作工具 | `index.html` |
| 11 | 2D 户型图编辑器 | 交互式 Web 应用 | 编辑器、几何引擎与测试 |
| 12 | 计算器 | 交互式 Web 应用 | 计算引擎、UI 与测试 |
| 13 | Skylight 天气仪表盘 | 数据型 Web 应用 | 仪表盘、离线模型与审计工具 |
| 14 | Meridian Bank 银行网站 | 多页网站 | 9 个页面、计算器与审计工具 |
| 15 | Shelf 读书追踪 | 数据型 Web 应用 | 领域引擎、UI 与测试 |

### 仓库结构

```text
New_Model_Test/
├── README.md
├── AGENTS.md
├── PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md
├── Test_Results/
│   └── DeepSeek-V4.1-Flash-Exp-0910_DSH/
│       └── phase-01/
│           ├── README.md
│           ├── Reviews/
│           └── task-01-.../ ... task-15-.../
├── test-workspace/            # 后续阶段测试脚手架（隔离规则、启动方案、模板）
├── website/
├── docs/
└── .github/workflows/
```

后续结果按 Test_Results/模型/阶段/ 加入；根 README 维护索引。接入步骤见 docs/adding-results.md。

### 关键文档

- [Agent 协作规范](AGENTS.md)
- [结果交接接口](docs/result-interface.md)与[接入操作步骤](docs/adding-results.md)
- [测试隔离与防答案污染](docs/testing-protocol.md)
- [测试工作区启动方案](test-workspace/README.md)：按阶段建任务目录、逐题隔离测试、汇总归档。
- [网站维护、发布及回退](docs/deployment.md)

- [15 条原始 Prompt、双语理论成果与验收内容](PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md)
- [第一阶段项目索引与运行说明](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/README.md)
- [15 项任务完成质量评估](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/15-任务完成质量评估.md)
- [任务执行统计与评测复盘](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/DeepSeek-V4.1-Flash-Exp-0910-任务评测复盘.md)
- [人工评价汇总](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/Personal_Review.md)

### 查看与运行

任务 01–10 的主要成果可以直接打开，无需安装依赖：

```bash
open Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-01-aevum-luxury-watch-landing-page/index.html
open Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-03-analog-clock-6-25/clock-625.svg
open Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-08-breakout-game/index.html
```

任务 11–15 带有项目内测试。多数项目无需 `npm install`，Node.js 主要用于执行测试：

```bash
cd Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-12-calculator
npm test

cd ../task-15-book-tracker
npm test
```

完整命令和已知限制请阅读各任务的 `README.md`。特别说明：task-13 的部分浏览器验证脚本仍包含原评测机器上的 Playwright 缓存路径；其逻辑单元测试可直接运行，但跨机器执行浏览器审计前需要调整 Playwright 路径或通过 `PW` 环境变量提供模块位置。

### 第一阶段结果摘要

- 15 个任务均满足原始 prompt 的核心要求；
- task-11：21 项几何测试与 52 项浏览器检查通过；
- task-12：198 项引擎检查与 69 项浏览器检查通过；
- task-13：112 项逻辑断言通过；应用通过 4 个视口 × 2 个主题的渲染检查，但统一验证命令仍有服务编排问题；
- task-14：49 项金融断言、73 项交互断言，以及 9 页桌面/移动审计通过；
- task-15：3,861 项引擎断言与 244 项浏览器检查通过。

更完整的扣分理由、风险和改进优先级见[质量评估报告](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/15-任务完成质量评估.md)。

### 后续阶段约定

新增阶段时建议：

1. 创建新的阶段或模型目录，不覆盖已有结果；
2. 保存原始 prompt，并记录任何补充轮次；
3. 每个任务使用独立目录，包含成果和任务 README；
4. 将可复现测试保存在仓库内，不只引用临时脚本；
5. 同时记录通过项、失败项、重试、已知限制和人工观察；
6. 在根 README 的阶段表中追加结果，以便长期比较。

### 说明

本仓库中的品牌、银行、账户、利率、人物和产品均为测试或演示内容。Meridian Bank 是虚构机构，不提供真实金融服务；请勿向任何演示表单输入真实个人或财务信息。测试结果仅描述当前归档中的模型、任务、环境和评估方法。

---

## English

### About

This repository publicly documents and showcases new-model evaluations. Each phase preserves the original prompts, model-produced artifacts, run or test instructions, visual evidence, and retrospective reports. The goal is not to present only the most attractive outputs, but to keep a traceable path from task input to result, verification, and issue analysis.

The current archive is **Phase 1**, consisting of 15 tasks completed with `DeepSeek-V4.1-Flash-Exp-0910`. The suite examines:

- SVG generation and compliance with exact visual constraints;
- self-contained web pages, games, and creative tools;
- complex interactive web applications;
- geometry, arithmetic, data state, and error handling;
- responsive design, accessibility, visual finish, and automated testing.

The repository is designed to grow. Future results can be added under Test_Results/<model-folder>/phase-NN/ while retaining the same “task → original prompt → artifact → test → evaluation” archive pattern.

### Current phase

| Phase | Model under test | Tasks | Core completion | Internal evaluation | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Phase 1 | DeepSeek-V4.1-Flash-Exp-0910 | 15 | 15/15 | 93.6/100 | Complete |

> The aggregate score comes from the human and automated evaluation stored in this repository. It summarizes this phase and is not intended as a universal cross-model leaderboard score.

### Phase 1 tasks

| # | Task | Category | Primary artifact |
| ---: | --- | --- | --- |
| 01 | Aevum luxury-watch landing page | Single-file website | `index.html` |
| 02 | Pelican riding a bicycle | SVG generation | `pelican-on-bicycle.svg` |
| 03 | Analog clock at 6:25 | Exact SVG constraint | `clock-625.svg` |
| 04 | Analog clock at 11:52:30 | Exact SVG constraint | `clock-11-52-30.svg` |
| 05 | Side-view bicycle rider | SVG pose constraint | `bicycle_rider.svg` |
| 06 | Hand cutting paper with scissors | SVG action depiction | `scissors_cutting_paper.svg` |
| 07 | Person pushing a wheelbarrow | SVG direction/action constraint | `pushing_wheelbarrow.svg` |
| 08 | Neon Breakout | Single-file game | `index.html` |
| 09 | Harvest Hollow | Single-file game | `index.html` |
| 10 | Pixel-art editor | Single-file creative tool | `index.html` |
| 11 | 2D floor-plan editor | Interactive web app | Editor, geometry engine, and tests |
| 12 | Calculator | Interactive web app | Arithmetic engine, UI, and tests |
| 13 | Skylight weather dashboard | Data-driven web app | Dashboard, offline model, and audit tools |
| 14 | Meridian Bank website | Multi-page website | 9 pages, calculators, and audit tools |
| 15 | Shelf book tracker | Data-driven web app | Domain engine, UI, and tests |

### Repository layout

```text
New_Model_Test/
├── README.md
├── AGENTS.md
├── PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md
├── Test_Results/
│   └── DeepSeek-V4.1-Flash-Exp-0910_DSH/
│       └── phase-01/
│           ├── README.md
│           ├── Reviews/
│           └── task-01-.../ ... task-15-.../
├── test-workspace/            # Test scaffolding for later phases (isolation rules, runbook, templates)
├── website/
├── docs/
└── .github/workflows/
```

Future phases live inside each model folder under Test_Results/. The root README maintains the index; see docs/adding-results.md for integration requirements.

### Key documents

- [Agent instructions](AGENTS.md)
- [Result interface](docs/result-interface.md) and [integration workflow](docs/adding-results.md)
- [Test isolation and anti-contamination protocol](docs/testing-protocol.md)
- [Test workspace runbook](test-workspace/README.md): phase scaffolding, per-task isolation, summary and archiving.
- [Deployment and rollback](docs/deployment.md)

- [15 original prompts with bilingual expected outcomes and acceptance checks](PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md)
- [Phase 1 index and run instructions](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/README.md)
- [Quality evaluation of all 15 completed tasks](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/15-任务完成质量评估.md)
- [Execution metrics and evaluation retrospective](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/DeepSeek-V4.1-Flash-Exp-0910-任务评测复盘.md)
- [Human-review summary](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/Personal_Review.md)

### View and run

The primary artifacts for tasks 01–10 open directly without installing dependencies:

```bash
open Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-01-aevum-luxury-watch-landing-page/index.html
open Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-03-analog-clock-6-25/clock-625.svg
open Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-08-breakout-game/index.html
```

Tasks 11–15 include in-project tests. Most do not require `npm install`; Node.js is primarily used as the test runner:

```bash
cd Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/task-12-calculator
npm test

cd ../task-15-book-tracker
npm test
```

See each task's `README.md` for full commands and known limitations. In particular, some task-13 browser tools still contain the original evaluation machine's Playwright cache path. Its logic tests run directly, but browser audits on another machine require adjusting that path or providing the Playwright module through the `PW` environment variable.

### Phase 1 result summary

- All 15 tasks satisfy the core requirements of their original prompts.
- Task 11: 21 geometry tests and 52 browser checks passed.
- Task 12: 198 engine checks and 69 browser checks passed.
- Task 13: 112 logic assertions passed; the app passed 4 viewports × 2 themes in the render audit, although the aggregate verification command still has a server-orchestration issue.
- Task 14: 49 finance assertions, 73 interaction assertions, and desktop/mobile audits across all 9 pages passed.
- Task 15: 3,861 engine assertions and 244 browser checks passed.

See the [quality evaluation report](Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/Reviews/15-任务完成质量评估.md) for detailed deductions, risks, and prioritized improvements.

### Convention for future phases

When adding another phase:

1. Create a new phase or model directory; do not overwrite previous results.
2. Preserve original prompts and record any follow-up turns.
3. Keep every task in its own directory with its artifact and task README.
4. Store reproducible tests in the repository instead of referring only to temporary scripts.
5. Record passes, failures, retries, known limitations, and human observations.
6. Append the result to the phase table in this root README for longitudinal comparison.

### Disclaimer

Brands, banks, accounts, rates, people, and products in this repository are test or demonstration content. Meridian Bank is fictional and provides no financial services; never enter real personal or financial information into any demo form. Results describe only the archived model, task set, environment, and evaluation method.

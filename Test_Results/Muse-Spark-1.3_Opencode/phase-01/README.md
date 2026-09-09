# Muse-Spark-1.3 / Phase 1

Muse Spark 1.3 在 **Phase 1 十五道题**上的交付物、运行记录与评价归档。

| 统计 | 值 |
| --- | --- |
| 模型 | `muse-spark-1.3-contributor-free`（providerID=opencode，variant=xhigh） |
| Harness | opencode 1.18.29（`agent=build`） |
| 会话 | 15 个任务 / 15 个会话（严格一对一） |
| 交付物 | 15 个任务目录；本档案共 66 个文件（含逐字 prompt、证据与评价） |
| 累计用时 | 25 分 45 秒 |
| 工具调用 / 失败 | 178 / 8 |
| Token 过路量 | 3,669,385（输入 384,338 + 输出 154,563 + 缓存读 3,130,484） |
| 费用 | ¥0 / $0（contributor-free 档，日志 `cost` 全为 0） |
| 隔离等级 | `workspace-only`（配置/提示词约束，15 题共用工作区） |
| 污染状态 | `clean（组织者判定）`，范围仅限已声明的 `workspace-only` 控制措施；判定依据的原始日志未随档案封存（见"已知限制"第 2 条），不可解释为"训练数据无污染" |

---

## 一、任务一览

| # | 目录 | 交付物 | 运行方式 | AI v1 | 人工评价 |
| ---: | --- | --- | --- | ---: | --- |
| 01 | `task-01-aevum-luxury-watch-landing-page/` | index.html + app.js + style.css | 直接打开 | **91** | 通过 · 细节待提升 |
| 02 | `task-02-pelican-on-bicycle/` | pelican-bicycle.svg | 直接打开 | **88** | 通过 |
| 03 | `task-03-analog-clock-6-25/` | analog-clock-6-25.svg | 直接打开 | **88** | 通过 · 精度欠佳 |
| 04 | `task-04-analog-clock-11-52-30/` | clock.svg | 直接打开 | **92** | 通过 |
| 05 | `task-05-bicycle-rider/` | bicycle-rider.svg | 直接打开 | **85** | 通过 · 有瑕疵 |
| 06 | `task-06-scissors-cutting-paper/` | hand-cutting-paper.svg | 直接打开 | **73** | 需改进 |
| 07 | `task-07-pushing-wheelbarrow/` | pushing-wheelbarrow.svg | 直接打开 | **83** | 通过 · 有瑕疵 |
| 08 | `task-08-breakout-game/` | index.html | 直接打开 | **88** | 通过 · 有显示问题 |
| 09 | `task-09-topdown-farming-game/` | index.html | 直接打开 | **84** | 通过 · UI 可提升 |
| 10 | `task-10-pixel-art-editor/` | index.html | 直接打开 | **89** | 通过 |
| 11 | `task-11-floor-plan-editor/` | index.html | 直接打开 | **86** | 通过 · 缺专业特性 |
| 12 | `task-12-calculator/` | index.html + app.js + calculator.js + style.css + test.mjs | **需 HTTP 服务**（ES module） | **80** | 未通过 |
| 13 | `task-13-weather-dashboard/` | index.html | 直接打开（联网取 Open-Meteo） | **88** | 通过 · 表现优秀 |
| 14 | `task-14-bank-website/` | index.html + app.js + styles.css | 直接打开（引 Google Fonts） | **80** | 通过 |
| 15 | `task-15-book-tracker/` | index.html + app.js + books.js + style.css + test.mjs | **需 HTTP 服务**（ES module） | **78** | 未通过 |

> **AI v1** 为维护 agent 评价（非盲评，2026-09-09），口径见 `Reviews/ai/maintenance-agent-v1/README.md`；**不可与第一阶段 DeepSeek 的 93.6/100 直接比较**。
> **task-12 / task-15** 的"未通过"已复核为**交付方式问题**：交付物使用 ES module，`file://` 直接打开时被浏览器按 CORS 拦截，经 HTTP 提供服务则功能正常（证据见 `Reviews/复核说明-交付方式.md`）。

---

## 二、评价与记录（`Reviews/`）

| 文件 | 内容 |
| --- | --- |
| `Personal_Review` | 人工评价原始纯文本（T1–T15） |
| `Personal_Review.md` | 人工评价 Markdown 整理版（总览表 + 逐条原文 + 共性反馈） |
| `Muse-Spark-1.3-任务评测复盘.md` | 执行复盘：会话映射、逐题用时/token/API/工具调用、失败、作弊嫌疑专项、金额 |
| `复核说明-交付方式.md` | task-12 / task-15 的交付方式复核（含 http/file:// 实测证据） |
| `ai/maintenance-agent-v1/` | AI 评价 v1：`README.md`（元信息+总览）、`phase-summary.md`（总评）、`task-01…15.md`（每题一条） |

**后续新增 AI 评价的接口**：新建同级目录 `Reviews/ai/<评价者标识>-v<N>/`，按同一结构存放，不覆盖既有评价。

---

## 三、逐字 Prompt（事后补录）

组织者确认：档案中 15 题与实际使用题目一致。因档案未保存当时发出的逐字输入，入库时按 `PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md` 的「原始 Prompt」回填到各任务目录的 `prompt.txt`。

> ⚠️ **这是事后补录，不是当时封存的输入副本**。回填只取「原始 Prompt」代码块，不含译文、理论成果与检验内容；15 个文件已与题目文档逐字比对一致（2026-09-09）。

| taskId | 文件 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| task-01 | `task-01-aevum-luxury-watch-landing-page/prompt.txt` | 208 | `20aaba85e5b252f2912a417840b546411adb43d66f4a70a5b3a117692db44ae9` |
| task-02 | `task-02-pelican-on-bicycle/prompt.txt` | 47 | `a38b878c5626238ac711ad0f38929304c5356fc962e2b893bf7c93eaf4b93187` |
| task-03 | `task-03-analog-clock-6-25/prompt.txt` | 93 | `b7b7f981e6b8d72e8cc7679ecc00e32268c296dc91dfaa25fa9ca2051183335f` |
| task-04 | `task-04-analog-clock-11-52-30/prompt.txt` | 45 | `6810781239a5abf4d0bd6e4883a741359a90646955581459a8885108fc33a1f0` |
| task-05 | `task-05-bicycle-rider/prompt.txt` | 190 | `736e71c9d430159b0db9a912f79cad8ed9d827a054debf15b1408b3b10ebf941` |
| task-06 | `task-06-scissors-cutting-paper/prompt.txt` | 62 | `ea28c2b4a04b6d033ab2068b79dfb64aa7d95fc0785c7f78a6a28950af9bee25` |
| task-07 | `task-07-pushing-wheelbarrow/prompt.txt` | 61 | `c94e36e8fc420f782485dd9733acf3097d07022391a77f3be0849b7992b0b7aa` |
| task-08 | `task-08-breakout-game/prompt.txt` | 65 | `c6e283f9b419499277bf74dab9201c68d051993faee24ba819854f09fed5eb51` |
| task-09 | `task-09-topdown-farming-game/prompt.txt` | 63 | `cae6723ab80e29eec25b5b2bcebc7a69f2fa02019bc2fa58be7adf18ddb6b207` |
| task-10 | `task-10-pixel-art-editor/prompt.txt` | 148 | `b2c5639f49d534c5675cac5d3bc8e7d3db2d838b9de1bb4ed51d82c4c304bfaf` |
| task-11 | `task-11-floor-plan-editor/prompt.txt` | 122 | `b4c65fbc69eb4f56ede8383de44a27781857f43cd257e9da6e0735372741f604` |
| task-12 | `task-12-calculator/prompt.txt` | 165 | `6067f883282710324a29490bb869adfc974340a626c751b2fc2999a0a9e77fe6` |
| task-13 | `task-13-weather-dashboard/prompt.txt` | 238 | `e6bbd33a57230bcd1a43d9b81e5d6b3d968356e9c0d8d1529a1834c52b2e432e` |
| task-14 | `task-14-bank-website/prompt.txt` | 30 | `58eef25acfaf82e9b1093693ed9fcf90266d757f178a040b1f705213ac804ba5` |
| task-15 | `task-15-book-tracker/prompt.txt` | 41 | `26537263f1b65e75a2db33832d772a8d14b06d7416983db0495e1d4e53eec7b7` |

---

## 四、证据与隔离（`evidence/`）

| 文件 | 说明 |
| --- | --- |
| `isolation-rules.md` | 原 `phase-01/AGENTS.md`：测试期由 opencode 自动加载的隔离提示；入库改名以免被后续会话自动加载为仓库指令（正文未改动，仅加归档说明） |
| `tool-config.json` | 原 `phase-01/opencode.json`：测试期工具配置（`permission.external_directory: deny`） |

**隔离效力**：以上两项构成**策略级约束**（提示词 + 工具目录拒绝），不是强制隔离；本次运行的 `isolation.level = "workspace-only"`，成绩不得表述为"强制隔离/无污染"。详见 `docs/testing-protocol.md` 第 8 节。

---

## 五、已知限制

1. **逐字 prompt 为事后补录**（见第三节），非当时封存。
2. **隔离与作弊检查的证据未随档案封存**：复盘报告的结论基于宿主 `~/.local/share/opencode/opencode.db` 与 `/tmp` 临时脚本；原始日志、探针结果不在本档案内，无法独立复核。
3. **无独立盲评**：现有 AI 评价由维护 agent 出具（非盲评），独立 AI 评价仍待补。
4. **外部依赖**：task-13 使用 Open-Meteo 四个接口（联网）；task-14 引用 Google Fonts（`fonts.googleapis.com`、`fonts.gstatic.com`）。
5. **未在维护宿主执行成果**：视觉与运行期行为未复验；task-08 人工反馈的显示问题待浏览器复现。
6. **task-12 / task-15 需 HTTP 服务运行**，直接双击打开不可用。

---

## 六、归档说明

- 目录结构沿用第一阶段 DeepSeek 档案的扁平 `task-*/` 布局（组织者 2026-09-09 决定），便于同题对照；新阶段仍按 `docs/result-interface.md` 的 `runs/<run-id>/` 契约组织。
- 原始交付物、人工评价、执行复盘内容均未改动；本次仅新增 `prompt.txt`、`README.md`、`evidence/` 与 `Reviews/ai/`。
- 未接入网站：网站导入器目前只解析第一阶段，接入需按 `docs/adding-results.md` 单独适配。

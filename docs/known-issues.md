# 已知问题与待办 / Known issues and backlog

> 本文件记录**已确认**的展示站缺陷、后续接入缺口与组织者决定。修复时按小节逐项处理，完成后更新 `verification.md` 并勾掉本文件对应条目。
> 记录时间：2026-09-09（维护 agent 只读复核产出）。
> **状态（2026-09-09 更新）**：第 1 节的 1.1–1.4 已全部修复并发布，记录保留用于追溯；第 2、3 节仍未处理。

## 1. 展示站数据缺陷（DeepSeek Phase 1）——✅ 已修复

### 1.1 英文任务页「Additional verification guidance」列表为空（15/15）

**状态：✅ 已修复（2026-09-09）** —— `bilingualList()` 改为同时接受 `：` 与 `:`；15 个英文页各显示 4 条，新增门禁断言。

| 项目 | 内容 |
| --- | --- |
| 现象 | `/en/tasks/task-*/` 的验收建议列表渲染为 `<ul></ul>`；`/zh/tasks/task-*/` 正常显示每题 4 条 |
| 根因 | `website/scripts/import-data.mjs` 的 `bilingualList()` 正则 `^- \*\*(中文\|English)：?\*\*` 只接受全角冒号；题目文档英文行使用半角 `**English:**`，因此 `verification.en` 恒为 `[]` |
| 证据 | `website/data/catalog.json` 中 15 个任务的 `verification.en` 全为 `[]`；线上 `/en/tasks/task-01/` 实测输出 `<ul></ul>` |
| 影响 | 英文页缺失一整个板块（不影响成果预览与数字） |
| 修复方向 | 正则同时接受 `：` 与 `:`；或改为分别匹配 `- **中文**：` 与 `- **English:**` 两种前缀 |
| 验收标准 | 15 个英文任务页各显示 4 条；新增断言：`verification.zh.length === verification.en.length` 且均非空 |

### 1.2 4 个人工评价的中文结论为空（task-01 / 02 / 05 / 10）

**状态：✅ 已修复（2026-09-09）** —— 导入器改为只在「一、评价总览」小节内解析，且要求该行 ≥ 4 列；15 条人工评价中文结论全部非空。

| 项目 | 内容 |
| --- | --- |
| 现象 | `/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-0{1,2,5}-r1/`、`...-task-10-r1/` 人工评价卡片标题为空 |
| 根因 | `.../phase-01/Reviews/Personal_Review.md` 中「一、评价总览」四列表（第 13–27 行）与「其他具体问题」两列表（第 112–115 行）都匹配 `^\| T\d+ \|`；后者 `cells[3]` 为 `undefined`，覆盖了先解析到的结论 |
| 证据 | `catalog.json` 中 `review-human-task-01/02/05/10-r1` 的 `conclusion.zh` 为空字符串，其余 11 条正常 |
| 修复方向 | 只在「一、评价总览」小节范围内解析；或要求该行单元格数 ≥ 4 才写入 |
| 验收标准 | 15 条人工评价 `conclusion.zh` 全部非空 |

### 1.3 门禁未覆盖上述两类缺陷

**状态：✅ 已修复（2026-09-09）** —— `validate-data.mjs` 与 `catalog.test.mjs` 新增双语验收建议非空/长度一致、双语 expectedOutcome、评价结论双语非空、AI 评价需评分与评分方法等断言；15/15/30 基线保留。

- 现状：`website/scripts/validate-data.mjs` 只校验数量、ID 关联、数字有限性、路径边界与文件存在；`website/tests/catalog.test.mjs` 只断言 15 tasks / 15 runs / 30 reviews、task-01 原始 prompt、评价类型分离与 fixture 数组扩展。
- 后果：1.1、1.2 两个缺陷可通过全部门禁上线。
- 修复方向：新增「双语字段非空且长度一致」「评价结论非空」「AI 评价中英分离」断言；保留首批 15/15/30 基线回归，不删除既有断言。

### 1.4 英文页的历史 AI 评价未翻译

**状态：✅ 已处理（2026-09-09）** —— 英文页不再伪装成译文，改为明确标注 `Original Chinese verdict (not translated): …`，正文说明原文为中文且不提供英译（不臆造翻译）。

- 现象：`/en/runs/*` 显示 `AI assessment: 直接通过 (translated label).`，正文为固定占位句。
- 说明：属展示文案问题，不影响数据真实性；与 1.1/1.2 一并处理更经济。

## 2. Muse Spark 档案（`Test_Results/Muse-Spark-1.3_Opencode/`）——✅ 已入库（2026-09-09）

入库形态（组织者决定）：沿用第一阶段 DeepSeek 的**扁平 `task-*/` 布局**，不改为 `runs/<run-id>/`；新增 `README.md`、每题 `prompt.txt`、`evidence/` 与 `Reviews/ai/<评价者>-vN/` 接口。阶段索引见 `Test_Results/Muse-Spark-1.3_Opencode/phase-01/README.md`。

### 2.1 本次判定（组织者决定）

- **原始 Prompt**：组织者确认档案中 15 题与实际使用题目一致；入库时按题目文档**事后补录** `prompt.txt`（已逐字比对 15/15，标注为补录而非当时封存）。
- **隔离与作弊检查**：本次判定通过，按现有材料接受；后续运行必须按 `docs/testing-protocol.md` 执行并封存证据。
- **AI 评价**：已有两份并存——`phase-01/Reviews/ai/maintenance-agent-v1/`（维护 agent，非盲评，84.9/100，静态分析）与 `phase-01/Reviews/ai/codex-v1/`（Codex Desktop / GPT-5，非盲评，88.1/100，含 Chromium 实际渲染复验）。两份口径不同，**不得平均或排名**；均为非盲评，独立盲评仍待补。网站已支持一个运行挂多份 AI 评价（见 3.1）。
- **task-12 计算器 / task-15 图书追踪**：标记为**交付方式问题**，不是功能逻辑缺陷。复核证据见 `phase-01/Reviews/复核说明-交付方式.md`（原始人工判定原文保留，不改写）。
- **测试期配置**：原 `phase-01/AGENTS.md` 与 `opencode.json` 已改名为 `evidence/isolation-rules.md` 与 `evidence/tool-config.json`，避免被后续会话自动加载为仓库指令；正文未改动。

### 2.2 入库后仍缺的材料

- **隔离/作弊检查证据未封存**：组织者已判定本次通过（见 2.1），档案中 `contamination.status` 记为 **`clean（组织者判定）`**，范围仅限已声明的 `workspace-only` 控制措施（配置 + 提示词约束 + 复盘四维检查）。**判定所依据的原始证据未随档案封存**（宿主 `~/.local/share/opencode/opencode.db` 与 `/tmp` 临时脚本），因此该 `clean` 无法在档案内独立复核，也不能解释为"训练数据无污染"；如需可复现证据，应补封存或重跑。
- **独立盲评**：现有 AI 评价为维护 agent 出具（非盲评），独立 AI 评价待补；新增评价按 `Reviews/ai/<评价者>-vN/` 接口存放。
- ~~网站接入未做~~ → **已完成（2026-09-09）**：导入器改为编排器 + 批次适配器，新增 `batches`/`assessments` 实体，页面/路由/查询/校验全部按实体生成，Muse 的 15 个运行与 30 条评价已上线。仍缺：通用批次扫描器、新阶段 `runs/<run-id>/` 导入适配器。

## 3. 网站能力待办

### 3.0 第二阶段接入（Task 16–20）——✅ 已接入（2026-09-10）

- 新增 `website/scripts/adapters/deepseek-phase2.mjs`：读取 `task-NN-<slug>/submission.json` 作为唯一元数据来源，导入时校验 `prompt.txt` 的 SHA-256 与归档声明一致；成果、隔离与越界状态原样带入，不在导入层改写。
- 通用层补强：阶段的 `taskVersions` 必须与目录中任务一一对应（不变量），第一阶段 15 题/15 运行/30 评价的回归改为**按阶段收敛**，`check-dist.mjs` 新增「已归档成果必须随构建发布」检查。
- 页面补强：运行详情新增收尾审查证据链接（绑定该批次归档提交）与补充轮逐字输入；无评价时显式显示「本运行暂无独立评价」，不再留空白；首页计数与任务类别文案不再写死第一阶段。
- 后续（2026-09-10）：Muse Spark 1.3 的 phase-02 五题按同一契约接入，并带上 1 份/题的 AI 评价（maintenance-agent-v2，平均 88.2/100，非盲评）与可复现取证（`evidence/evaluation-2026-09-10/`）。展示站现在支持 task-16…20 的 DeepSeek ↔ Muse 同题并排对比。
- 仍缺：Task 21–45 未测试；**DeepSeek 的 phase-02 五题尚无独立评价**（页面显式显示「本运行暂无独立评价」）；两批都**没有人工评价**；一个运行挂多份 AI 评价的展示仍按 3.1 处理。

### 3.1 支持一个运行挂多份 AI 评价

- 现状：每个 run 固定 1 条人工 + 1 条 AI，共 30 条；`reviewsFor(runId)` 已能返回全部，但导入层与校验层按 30 条硬编码。
- 要求：同一 `runId` 允许多条 `type: "ai"`（不同评委、不同时间、不同评分口径），各自保留 `reviewId`、作者、日期、评分方法与来源定位。
- 约束：不同标准的分数不得合成为排行榜；页面需并列展示，不互相覆盖。

### 3.2 多阶段 / 多模型接入

- **多模型（同阶段）已完成**：`website/scripts/import-data.mjs` 为编排器，`scripts/adapters/deepseek-phase1.mjs` 与 `scripts/adapters/muse-spark-phase1.mjs` 分别适配；Muse 适配器按 `Reviews/ai/<评委>-vN/` **通用加载任意多份 AI 评价**。页面计数、批次统计、路由、`runsForTask()`、`validate-data.mjs`、`check-dist.mjs` 均按实体推导（当前 2 模型 / 2 阶段 / 20 任务 / 35 运行 / 75 评价 / 3 阶段评估 / 132 页）。
- **多阶段部分完成（2026-09-10）**：DeepSeek 与 Muse 的 phase-02（Task 16–20）已按扁平 `task-NN-<slug>/` 布局接入，见 3.0；其余阶段仍需要新增对应适配器，通用目录扫描器不存在，也不会自动接入。当前生产索引为 2 模型 / 2 阶段 / 20 任务 / 40 运行 / 80 评价 / 4 批次 / 3 阶段评估 / 142 页。

## 4. 已定方案（非缺陷，供后续遵循）

### 4.0 Phase 2 题目已公开（2026-09-09，组织者决定保留）

- **事实**：`PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md`（Task 16–45，30 题）由另一 agent（Codex）在提交 `0540edf` 中推送至公开仓库 `main`，README 与 `PROMPT/README.md` 已加入链接。此前组织者要求"先不要上传"，该提交在其后发生。
- **决定（组织者）**：**保留现状**，不删除、不回退、不改写历史。
- **后果（必须遵守）**：
  1. 这 30 道题**已不再是非公开题目**。今后任何"干净测试"的声明都必须注明"题目在本仓库公开"；不得声称被测模型无法获得题目。
  2. 若仍要用 Task 16–45 测模型：要么接受并如实标注污染风险，要么**实质修改题干并递增题目版本**（新增 `taskVersion`，旧版本保留），否则成绩不得计入清洁统计。
  3. 不得依赖"删掉文件/force-push"来恢复清洁状态：仓库为公开仓库，历史、缓存、fork 与爬取副本均不受控，且本仓库禁止 force-push。
  4. 该暴露是**题目层面的**，与具体模型、harness 无关；所有后续阶段运行共用同一结论。

### 4.1 后续阶段测试的隔离方案（2026-09-09 决定）

- **采用**：`test-workspace/AGENTS.md` 两条绝对规则（不读当前目录以外的内容、不查询任何仓库）+ 收尾审查工具调用与统计；隔离等级统一记为 `workspace-only`。
- **不跑探针、不另建独立用户或容器**；组织 agent 不得就隔离方案向用户征询意见（用户主动要求时除外）。
- **标注要求**：每个 run 记录 `isolation.level`、网络策略与 `contamination.status`；展示时附「策略级约束 + 事后审查」，不得写成「强制隔离」或「无污染」。
- **统计要求**：审查覆盖「越界读取 + 仓库查询 + 时间/token/工具调用核对」的运行可计入汇总；**越界判定只影响标注、不影响成绩录入**（2026-09-10 组织者决定）——越界尝试与嫌疑记入档案即可，只有确认作弊成功才标注「已确认获取外部答案」。
- **诚实边界**：该方案挡手滑、可取证，挡不住有意读取；DSH 沙箱只限制写、不限制读（详见 `docs/testing-protocol.md` 第 8 节）。
- **操作手册**：`test-workspace/README.md`。

### 4.3 模型身份合并与快照（2026-09-10 决定，非缺陷）

- 背景：0910 实验版 `DeepSeek-V4.1-Flash-Exp-0910` 即将退役，随后发布的正式版 `DeepSeek-V4.1-Flash` 与其视为**同一个模型**。
- 做法：模型实体 id（`deepseek-v4-1-flash-exp-0910`）与全部 runId、URL **保持稳定**；显示名改为双语 `DeepSeek-V4.1-Flash（0910 实验版 + 正式版）` / `DeepSeek-V4.1-Flash (0910 preview + GA release)`；模型实体新增 `snapshots`（0910 实验版=已退役、正式版=待回填），每条运行记录 `environment.reportedModelId`。
- 影响面：`docs/result-interface.md` 已写明该口径；后续正式版运行使用 `run-deepseek-v4-1-flash-task-NN-rN`，仍归档在同一模型目录下，**跨快照比较必须标明**。
- 顺带修复：模型页此前只显示第一个批次（`batchForModel` 用 `find`），20 条运行却显示 Phase 1 的 15 题统计；现改为列出该模型全部批次与全部快照。

### 4.4 无工具遥测的模型默认视为遵守规则（2026-09-10 决定，非缺陷）

- 背景：有的模型 / harness 不展示中间工具调用（例如 GPT 类 API 只返回最终答案），收尾审查的路径、命令、仓库查询、网络、读写越界等维度无从检查。
- 做法：这类运行记 `contamination.telemetry = hidden`，**默认视为遵守规则**，照常计入成绩；报告与展示标注「工具调用不可见 · 默认视为遵守规则」，并列出**未覆盖维度**与**本次仍做过的检查**（题目 SHA-256 是否一致、成果是否内嵌外部资源或外链、最终回答是否暴露外部来源等）。
- 边界：这是**默认规则、不是审查结论**，不得写成「未发现越界」「已审计」；`docs/audit-method.md` 4.0 与第 5 节、根 `AGENTS.md`、`docs/testing-protocol.md` 第 8 节均已写明。
- 展示与校验支持：`website/src/lib/contamination.ts` 提供判定纯函数（含单元测试），运行页在 `telemetry: hidden` 且未被确认作弊时显示该标注；`validate-data.mjs` 校验 `telemetry` 枚举，并要求 `hidden` 的运行在 `contamination.note` 里写明这条默认规则。

### 4.2 被测会话规则文件的写法

- 给被测会话的文件只写**绝对规则**，不得包含「这是策略级约束」「技术上你其实能读到」「去探测边界」等表述；
- 隔离效力与收尾审查的说明只写在组织者文件中（`test-workspace/README.md`、`docs/testing-protocol.md`、`PLAN.md`）。
- 被测规则必须显式禁止**查询任何仓库**（本地其他仓库、远端仓库、代码托管平台、代码搜索与包管理器源码拉取），审计也必须把「仓库查询」列为必查维度。

## 5. 相关记录

- `docs/verification.md`：门禁与公网验证记录（修复后在此追加）。
- `docs/source-audit.md`：来源映射与保留的分歧。
- `docs/result-interface.md`、`docs/adding-results.md`：后续接入字段与步骤。
- `test-workspace/README.md`：测试工作区标准流程（建脚手架 → 逐题测试 → 收尾审查与归档）。

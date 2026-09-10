# M5/M7 验证记录 / Verification record

## 2026-09-10 评价并接入 Muse Spark phase-02 前五题（Task 16–20）

- 需求：评价 Results 中 Muse 模型最新五项任务（Task 16–20）并上传到展示站。
- 评价（AI，**非盲评**，1 份/题）：`maintenance-agent-v2`（维护 agent，DeepSeek Harness），沿用 v1 的评分口径（需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10）：task-16 **85**、task-17 **88**、task-18 **88**、task-19 **88**、task-20 **92**，平均 **88.2/100**。归档：各 `runs/<run-id>/reviews/ai-maintenance-agent-v2.md`（逐题）+ `Reviews/ai/maintenance-agent-v2/{README,phase-summary}.md`（阶段总评）。
- 方法升级（v2 相对 v1）：组织者自建静态服务 + Chromium 无头渲染并驱动交互，做 canvas 级像素比对、读取应用自身读数、逐元素旋转角度差、并用关节坐标**复算连杆长度**；视觉维度由视觉桥接模型描述截图。**未运行成果自带脚本**；评价者本人不具备图像输入能力。
- 关键独立证据：task-17 在 1.5 s 内 29 个旋转元素中 14 顺 / 15 逆、角速度跨度 −179.3°/1.5 s 至 2.1°/1.5 s；task-18 暂停时 `#hudTime` 与 canvas 同时冻结、Step 0.5 s 恰好 +0.500 s、Reset 归零、8 阶段依次推进；task-19 暂停冻结模拟时钟（Day 38.7 → 38.7）而画布仍有约 0.3% 残余重绘、调速 20 → 300 天/秒不重置位置；task-20 22 次采样复算刚性连杆长度极差 **0.096–0.167 px**、暂停零变化、单步生效、Store → New → Recall 逐像素还原。5 题控制台错误均为 0、均无外部依赖。
- 取证归档：`Test_Results/Muse-Spark-1.3_Opencode/phase-02/evidence/evaluation-2026-09-10/`（4 个可复现脚本、4 份 checks JSON、17 张截图）。
- 接入：新增 `website/scripts/adapters/muse-spark-phase2.mjs` 并注册（共四个适配器）；以 `submission.json` 为唯一元数据来源、导入时校验 `prompt.txt` 的 SHA-256、从 `runs/<run-id>/reviews/` 解析逐题评价；Muse 模型实体补充快照声明 `muse-spark-1.3-contributor-free`。索引变为 2 模型 / 2 阶段 / 20 任务 / **40 运行** / **80 评价** / 4 批次 / **142 页**（34 个 HTML 成果），task-16…20 现在两模型同题可并排对比。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（**12/12**）、`build`（142 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，**40 个成果入口全部加载**。
- 发布与公网核验：归档提交 `66aa028`、接入提交 `825f896` 推送 `main`；回退标签 `website-rollback-20260910-a255ed9`。Actions run `34438311121` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/muse-spark-1-3/`、`/zh/runs/run-muse-spark-1-3-xhigh-task-20-r1/`、task-16 的 DeepSeek↔Muse 对比深链与 Muse 的 SVG 成果入口均返回 HTTP 200；线上运行页实测显示「92/100」「维护 agent v2」「运行快照：muse-spark-1.3-contributor-free」且恰好 1 张评价卡片，模型页同时显示快照与两个批次。
- 必须标注的限制：评价由 AI 产出且**非盲评**，不构成网站独立证明；视觉维度依赖视觉桥接模型描述；未运行成果自带脚本，未做跨浏览器 / 跨视口 / 性能 / 长时间稳定性测量；隔离为策略级约束 + 事后审查；题目 Task 16–45 已公开；**人工评价仍未产出**。
- 并发说明：本次接入期间另有会话在评价 **DeepSeek** 的 phase-02 五题（`Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/Reviews/任务完成质量评估-muse-spark-v1.md`，截至本次提交仍未提交）；本次提交未包含该在途文件。下方「审查归档 Muse Spark phase-02 前五题」条目由该并发会话写入，随本次提交一并入库。

## 2026-09-10 审查归档 Muse Spark phase-02 前五题（Task 16–20）

- 范围：`test-workspace-3/phase-02/` 中 Task 16–20 五个被测会话（opencode，`muse-spark-1.3-contributor-free` / xhigh），首轮输入五题均与 `prompt.txt` 逐字一致。
- 审查：全量 238 次工具调用——全部读写路径在各自任务目录内，无 `..` 穿越、无跨任务/跨副本/`Test_Results`/`PROMPT`/`docs` 访问，无仓库查询、无对外网络；结论**未发现越界**（程序性备注记入审计档案：task-16 `ls /Applications` 环境探测、task-17/18/19 `/tmp` 自写校验脚本，均无外部内容流入）。
- 统计：时长 353/409/1433/134/373s；工具调用 20/32/145/7/34；工具级可恢复错误 0/1/3/0/0；任务失败 0。
- 校验：成果物零外部引用（SVG 命名空间除外）、SVG XML 解析通过；task-20 `node run_tests.js` 组织者独立复跑 **20/20 pass**；归档前后逐文件 SHA-256 全对。
- 归档：`Test_Results/Muse-Spark-1.3_Opencode/phase-02/runs/<run-id>/`（`prompt.txt`、`artifacts/`、`evidence/`、`submission.json`）+ 阶段 README；工作区 `SUMMARY-tasks-16-20.md` 原样记录各题最后回答的明确 limit；`docs/source-audit.md` 新增 Muse Spark 批次小节。
- 未完成：Task 21–45 待测；网站导入、人工/AI 评价未做；`SUMMARY.md` 全量版待 30 题齐后写。

## 2026-09-10 模型身份合并：0910 实验版与正式版视为同一模型

- 决定（组织者 2026-09-10）：即将退役的 0910 实验版 `DeepSeek-V4.1-Flash-Exp-0910` 与随后发布的正式版 `DeepSeek-V4.1-Flash` 视为**同一个模型**，成绩同表记录。
- **稳定标识不动**：模型实体 id `deepseek-v4-1-flash-exp-0910`、全部 runId（`run-deepseek-v4-1-flash-exp-0910-task-NN-r1`）、模型页与运行页 URL、归档目录 `Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/`、以及历史档案正文（含 harness 报告的 model id）全部保持原样。
- 显示名改双语：`DeepSeek-V4.1-Flash（0910 实验版 + 正式版）` / `DeepSeek-V4.1-Flash (0910 preview + GA release)`。`name` 由字符串改为 `{zh, en}`，路由、首页卡片、任务卡片、运行页眉、模型页、对比下拉与对比面板均按 locale 取值（`AppPage.astro`、`RunRow.astro`、`catalog.ts`）。
- 新增**快照**维度：模型实体 `snapshots` 声明（0910 实验版=已退役，附 harness 报告值来源；正式版=id 待首次运行回填，不据品牌名推断）；`version` 置 `null` 并加 `versionNote`，不再用单一版本号把两个快照合并成一个未经验证的值。
- 逐运行记录快照：`run.environment.reportedModelId`——phase-02 的 5 条带入 `submission.json` 的 `deepseek-v4.1-flash-expires-on-0910`；phase-01 的 15 条归档未记录 model id，记 `null`，页面显示「未记录」。运行详情新增「运行快照」一行。
- 校验与测试：`validate-data.mjs` 新增模型名双语、快照声明（label/evidence 双语、status 枚举、id 去重）与「非空 `reportedModelId` 必须是该模型声明的快照」校验，并把「phase-02 必须记录快照」并入阶段回归；`catalog.test.mjs` 新增快照用例（11/11）；`e2e-smoke.mjs` 断言模型页列出两个快照与两个批次、运行页显示快照 id。
- **顺带修复缺陷**：`batchForModel()` 用 `find()` 只取第一个批次，导致该模型已有 20 条运行、模型页却只显示 Phase 1 的 15 题统计（线上可复现）。现改为 `batchesForModel()` 全部列出，模型卡片时长按全部批次求和。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（11/11）、`build`（132 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，35 个成果入口全部加载。
- 发布与公网核验：提交 `f3aef2c` 推送 `main`；回退标签 `website-rollback-20260910-e256f21` 指向上一已成功部署且公网验证通过的提交。Actions run `34435104348` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/`、`/zh/models/deepseek-v4-1-flash-exp-0910/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-16-r1/`、`/en/phases/phase-02/` 均返回 HTTP 200；线上模型页实测显示双语显示名、两个快照（`deepseek-v4.1-flash-expires-on-0910` 与「正式版（尚未运行）」）与两个批次块，运行页显示「运行快照：deepseek-v4.1-flash-expires-on-0910」。
- 后续约定：正式版运行采用 `run-deepseek-v4-1-flash-task-NN-rN`（runId slug 不必等于实体 id），归档仍在同一模型目录下；正式版首次运行后回填快照 id；**跨快照比较必须标明差异**。

## 2026-09-10 接入第二阶段 Task 16–20 到展示站

- 需求：把已归档的 5 个 Phase 2 项目（Task 16–20）上传到展示站。按 `docs/adding-results.md` 走完整接入流程，不以「文件已上传」代替验收。
- 归档首次入库（提交 `a9925d8`）：`Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/`，含 5 个 `runs/<run-id>/`、逐字 `prompt.txt`、`submission.json`、`evidence/`（收尾审查报告、隔离规则、会话日志 SHA-256）与阶段 README。接入前独立核对 **48 个成果文件与 5 个 `prompt.txt` 的 SHA-256**，与 `submission.json` 声明全部一致（不一致 0）。
- 导入层：新增 `website/scripts/adapters/deepseek-phase2.mjs` 并在编排器注册；以 `submission.json` 为唯一元数据来源，导入时交叉校验 `prompt.txt` 的 SHA-256（不一致即失败，题目不可被替换）；成果、隔离与越界状态原样带入，不在导入层改写。新增 `website/data/phases/phase-02.json`。
- 通用校验补强：阶段的 `taskVersions` 必须与目录中任务一一对应（新增不变量）；第一阶段 15 题 / 15 运行 / 30 评价的回归改为**按阶段收敛**（不再依赖 catalog 总量）；新增第二阶段单调回归（5 个已归档运行必须仍在，且必须记录 `isolation.level=workspace-only`、逐字 prompt 哈希与审查证据链接）。
- 页面补强：运行详情新增收尾审查证据链接（绑定该批次归档提交 `a9925d8…`）与补充轮逐字输入；无评价时显式显示「本运行暂无独立评价」，不留空白；越界尝试显示为「存在越界尝试，未取得内容 · 不影响成绩」；首页计数与任务类别文案不再写死第一阶段。
- 构建数据：2 模型 / 2 阶段 / 20 任务 / 35 运行 / 75 评价 / 3 批次 / 3 阶段评估，**132 个生成页**（由实体推导，原 110）与 30 个 HTML 成果；DeepSeek 模型页列出 20 条运行。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（10/10）、`build`（132 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，**35 个成果入口全部加载**。本机 Firefox 在 Playwright 下 `browser.newPage: Target crashed`（既有环境限制，非本次改动）；e2e 新增 `E2E_BROWSERS` 开关，便于本地只跑可用浏览器，默认仍是三浏览器全套。
- 发布与公网核验：提交 `a88b331` 推送 `main`；回退标签 `website-rollback-20260910-78dcdf6` 指向上一已成功部署且公网验证通过的提交 `78dcdf6`。Actions run `34434388799` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/phases/phase-02/`、`/zh/tasks/task-16/`、`/zh/tasks/task-19/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/`、`/en/runs/run-deepseek-v4-1-flash-exp-0910-task-20-r1/` 与两个成果入口（`pelican-bicycle.svg`、`index.html`）均返回 HTTP 200；线上运行页实测显示「越界判定：存在越界尝试，未取得内容 · 不影响成绩」「补充轮输入（逐字）：「不要再读取chrome钥匙串了」」「本运行暂无独立评价」，首页显示 `2 MODELS · 2 PHASES`。
- 必须随成绩一起标注的限制：隔离是**策略级约束 + 事后审查**，不是强制隔离、不表示「无污染」；题目 Task 16–45 已在公开仓库发布（`0540edf`）；第二阶段**尚无人工 / AI 评价，因此展示站不给分**；成果内测试结果均为作者自述，本次未在隔离环境复跑。
- 未完成项：Task 21–45 尚未测试；第二阶段评价待产出；同一运行挂多份 AI 评价的展示仍按 `docs/known-issues.md` 3.1 处理。

## 2026-09-10 越界处置口径：只标注，不排除成绩

- 组织者决定（2026-09-10）：**越界判定只影响标注，不影响成绩录入**。任何 run 都不因越界判定被排除、作废、重测或改写分数。
- 三档处置：① 未发现越界 → 无标注；② **越界尝试 / 有嫌疑**（有越界动作但 `tool/result` 未返回外部内容，或只有嫌疑、无证据）→ 只记入审计档案（`contamination.events`，状态可记 `suspected`），**不作外显标注、不排除、不改分**；③ **确认作弊成功**（实际读到他人答案 / 成果，或从仓库、网络取到题目相关内容）→ `status = contaminated`，**必须标注**「已确认获取外部答案」，且标注与成绩同处显示。
- 依据（组织者）：只有确实作弊成功才影响成绩的可信度；未遂与嫌疑属于过程事实，记在档案里即可，不改变成绩口径。
- 落点：`docs/audit-method.md` 第 5 节（新增三档处置表）与 4.11、`AGENTS.md`（「禁止作弊与隔离要求」「后续阶段与结果接入」两处）、`docs/testing-protocol.md` 第 8 节统计口径、`docs/known-issues.md`、`docs/result-interface.md` 污染行、`test-workspace/README.md` 第 4 节。原文中「排除出汇总」「建议作废该 run」的表述已全部清除。
- 既有档案同步：`test-workspace/phase-02/SUMMARY.md` 第 2 节改为「5 个 run 全部计入；排除数量 0 / 5；标注数量 0 / 5」——`task-17`、`task-20` 的「越界尝试，未取得内容」保留为上表与 `evidence/audit-2026-09-10.*` 的档案层记录，不再排除出汇总；`phase-02/PLAN.md` 第 7 节同步。这两份文件位于 `.gitignore` 覆盖的脚手架目录，随该阶段归档一并提交。
- 展示站对齐：run 页不再显示裸 `suspected` / `contaminated`——`suspected` 显示为「存在越界尝试，未取得内容 · 不影响成绩」，`contaminated` 显示为「已确认获取外部答案（标注）」，`unknown` 显示为「未判定」，字段名由「污染状态」改为「越界判定」（英文 `Boundary check`）。
- 门禁：`npm run import:data`、`validate:data`、`check`、`npm test`、`build` 全部通过（110 个生成页 / 26 个 HTML 成果，静态链接检查通过）。本次仅改文案与文档，未触及路由、交互、预览与比较，按 AGENTS.md 未跑 `test:e2e`。
- 发布记录：提交 `0f65778` 推送 `main`；回退标签 `website-rollback-20260910-453b6d3` 指向上一已成功部署且公网验证通过的提交 `453b6d3`。Actions run `34433597168` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/`、`/zh/tasks/task-01/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/` 均返回 HTTP 200，运行页实测渲染「越界判定：未判定」。

## 2026-09-10 建立并行测试副本（同时测多个模型）

- 需求：在不改动正在运行的 `test-workspace/`（其中 task-16～19 已有成果）的前提下，复制出两份工作区，用于同时测试多个模型。
- 产物：`test-workspace-2/`、`test-workspace-3/`（各 **5 个文件**）。每份只有**框架**：`AGENTS.md`（被测规则）、`README.md`（组织手册）、`_templates/`（`PLAN.template.md`、`task-AGENTS.md`、`submission.template.json`）。
- **不预置内容**：两个副本**没有** `phase-NN/` 目录、没有题目、没有 `prompt.txt`、没有模型、没有成果。测哪个阶段、哪些题、哪个模型，由组织 agent 在步骤 0 询问用户后按 `_templates/` **现场生成**，避免把不相干的题带进工作区（用户 2026-09-10 指出）。
- 修正记录：初版复制曾一并带入 `phase-02/` 的 30 个任务目录（`AGENTS.md` + `prompt.txt`）与 `_tools/set-model.mjs`，假定副本用于第二阶段；该假设不成立，已删除并重建为纯框架（`phase-02/`、`_tools/` 均已移除）。提交 `642525b`、`2c3d730` 记录的是初版状态，本条为修正后的实际状态。
- 规则可比性：副本 `AGENTS.md` 的第 1–8 节与 `test-workspace/AGENTS.md` **逐字相同**（`sed -n '/^## 1\./,$p'` 后 `cmp` 通过），只替换了路径头部（`test-workspace-2/README.md` 等）。三个工作区的规则文本一致，便于成绩横向比较。
- 生成方式：副本 `README.md` 的步骤 0 写明「询问用户 phase / 题目范围 / 模型标识 / harness / 预算（**不问隔离方案**）」，步骤 1 用 `_templates/` 生成 `phase-NN/task-NN-<slug>/` 与 `PLAN.md`，`runId` 直接用确认后的模型 slug 写入，不留占位符。
- 审计补强：`docs/audit-method.md` 新增 **4.11 同题并行副本（多副本并行时必查项）**（`checkedDimensions` 增加 `"siblingWorkspaces"`），`docs/testing-protocol.md` 第 8 节新增并行副本小节。理由是副本让同阶段成果可能就在隔壁，读取其他副本即记越界。
- `.gitignore` 增加 `test-workspace-*/`：副本整份不入库，成果仍须归档到 `Test_Results/` 后提交。`test-workspace/` 未做任何改动（只读复制）。
- 发布记录：提交 `642525b`（副本 + 文档）、`2c3d730`（验证记录）推送 `main`；发布前创建并推送不可变回退标签 `website-rollback-20260910-400c3cf`，指向上一已成功部署且公网验证通过的提交 `400c3cf`（本次为纯文档 + `.gitignore` 变更，站点内容无变化）。
- 门禁与公网核验：本次为纯文档变更，按 AGENTS.md 只检查目录、链接与命令——`docs/audit-method.md`、`docs/testing-protocol.md` 相对链接 2 条全部存在。Actions run `34429384337` 与 `34429518862` 构建与 Pages 部署均成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/`、`/zh/phases/phase-01/`、`/zh/tasks/task-01/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/`、`/en/compare/?runs=…task-01-r1` 均返回 HTTP 200，模型页仍显示 DeepSeek-V4.1-Flash-Exp-0910 与 Muse Spark 1.3 两个模型。

## 2026-09-09 归档 Codex 的 Muse 评价并接入网站（第二份 AI 评价）

- 来源：Codex Desktop 0.153.4 / GPT-5 于 2026-09-09 写出的 `Reviews/15-任务完成质量评估.md`（综合 88.1/100，含 Chromium 实际渲染复验）。内容未改动，按既定接口归档为 `Reviews/ai/codex-v1/`（阶段总评 + 每题一条），并补齐 `README.md` 元信息。
- 接口通用化：Muse 适配器改为遍历 `Reviews/ai/<评委>-vN/`，从每个评委目录的 README 与逐题文件解析元信息、分数与双语结论；两份评价（维护 agent v1 84.9、codex-v1 88.1）作为**并列的 AI 评价**挂在同一个运行上，不做平均或排名。`maintenance-agent-v1` 的逐题文件补上 `结论（中）` 与 `Conclusion (EN)` 行以统一接口。
- 数据结果：2 模型 / 15 任务 / 30 运行 / **75 评价**（DeepSeek 30 + Muse 45：每题 1 人工 + 2 AI）/ 2 批次 / **3 阶段评估**；页面仍为 110。
- 门禁：import、validate（含 Muse「每运行 1 人工 + 每个已归档 AI 评委各一条」校验）、check（0 errors）、`npm test`（9/9）、build 全部通过；e2e 在 Chromium 与 WebKit 通过，Muse 运行页断言改为「3 条评价」并针对维护 agent 卡片校验 Markdown 列表/行内代码渲染与 HTML 转义。
- 分数解析修正：`82/100` 这类文本此前被拼成 `82100`，已改为只取分子；模型页现显示两份阶段评估（88.1 / 84.9）。
- 发布与公网核验：见下条「Codex 评价接入发布记录」。

## 2026-09-09 Muse Spark 网站接入（多模型 / 同阶段）

- 导入层重构：`scripts/import-data.mjs` 改为编排器 + 两个显式注册的批次适配器（`adapters/deepseek-phase1.mjs`、`adapters/muse-spark-phase1.mjs`）；新增 `batches`、`assessments` 实体；catalog `schemaVersion` 升到 2。DeepSeek 实体逐字段回归比对：**0 处语义差异**。
- 数据结果：2 模型 / 1 阶段 / 15 任务 / 30 运行 / 60 评价（每个运行 1 人工 + 1 AI）/ 2 批次 / 2 阶段评估；页面 110 个（由实体推导，原 78）。
- 页面与查询：首页计数与批次统计、模型列表/详情、阶段详情、任务详情（列出全部运行）、运行详情（逐字输入 + 隔离/污染 + 多条评价）、对比页（同题两模型并排）、方法页（两批批次表 + 两份评估并列）全部按数据生成。
- 历史层：每条运行绑定自己的 `artifact.commit`；`sourcePathMappings` 增加 commit 维度，仅第一阶段迁移路径套用映射。
- 门禁：`import:data`、`validate:data`（2 模型/15 任务/30 运行/60 评价/2 批次/2 评估，含首批 15/15/30 回归）、`check`（0 errors / 0 warnings / 1 hint）、`npm test`（5/5）、`build`（110 页 + 26 个 HTML 成果，静态链接检查通过）全部通过。
- 浏览器验证：`test:e2e` 在 Chromium 与 WebKit 通过——任务搜索命中两模型、模型筛选收敛、英文详情直达、双语验收建议、同题双运行对比恢复、懒加载预览、Muse 运行页两条评价 + 隔离/污染/事后补录标注、390/768/1440 无横向溢出、30/30 成果入口加载；Muse 计算器（ES module）经 HTTP 服务计算 1+2=3 正确。本机 Firefox 仍因沙箱 `Target crashed` 未纳入，需 CI 或容器复跑。
- 封面：新增 `scripts/capture-covers.mjs`（手动运行，不入 CI），为 9 个 Muse HTML 成果生成封面图并入库；SVG 成果直接渲染，无需封面。
- 评价正文改为 Markdown 渲染：新增 `src/lib/markdown.ts`（先转义再解析，不引入新依赖），支持段落/列表/粗体/斜体/行内代码/链接/引用/标题；链接仅允许 http(s)、mailto 与相对路径。单元测试覆盖渲染、HTML 转义与链接白名单（`tests/markdown.test.mjs`，Node 原生类型剥离直接导入 .ts），e2e 增加「AI 评价列表与行内代码已渲染、原始 HTML 未被注入」断言。
- 发布记录：提交 `28c4af8` 已推送 `main`；Actions run `34338087847` 构建与 Pages 部署成功。发布前创建并推送回退标签 `website-rollback-20260909-405a957`（指向上一成功部署提交 `405a957`，run 34337020609）。
- 公网核验（2026-09-09，匿名 HTTPS）：`/zh/`、`/en/`、`/zh/models/`、`/zh/models/muse-spark-1-3/`、`/zh/runs/run-muse-spark-1-3-task-06-r1/`、`/zh/compare/?task=task-06&left=<DeepSeek>&right=<Muse>`、`/zh/methodology/`、`/artifacts/run-muse-spark-1-3-task-12-r1/index.html` 及第一阶段运行页均返回 200。首页含两个模型与 `2 MODELS`、`12 SVG / 18 HTML`；Muse 运行页含「事后补录」「workspace-only」「73/100」与两类评价。

## 2026-09-09 展示站数据缺陷修复（known-issues 1.1–1.4）

- 修复 `website/scripts/import-data.mjs`：`bilingualList()` 同时接受全角 `：` 与半角 `:`（英文验收建议由 0 条恢复为每题 4 条）；人工评价结论只在「一、评价总览」小节内解析且要求 ≥ 4 列（task-01/02/05/10 的中文结论恢复）；英文页历史 AI 评价改为明确标注 `Original Chinese verdict (not translated)`，不臆造英译。
- 新增门禁断言：`validate-data.mjs` 校验双语验收建议非空且长度一致、`expectedOutcome` 双语非空、评价结论双语非空、AI 评价必须带评分与评分方法；`tests/catalog.test.mjs` 新增同款用例，保留 15 tasks / 15 runs / 30 reviews 基线。
- 门禁实测：`import:data`、`validate:data`、`check`（0 errors / 0 warnings / 3 既有 hints）、`npm test`（3/3）、`build`（78 个生成页 + 17 个 HTML 成果，静态链接检查通过）全部通过。
- 浏览器验证：`test:e2e` 在 Chromium 与 WebKit 下全流程通过（搜索、英文详情直达、对比深链恢复、懒加载预览、390/768/1440 无横向溢出、Breakout 交互、PNG 下载、15/15 成果入口）。本机 Firefox 在 Playwright 下 `browser.newPage: Target crashed`（沙箱环境限制，非代码问题），三浏览器全套待 CI 或容器复跑。
- 产物核对（dist 实测）：`/en/tasks/task-01|06|15/` 验收建议各 4 条；`/zh/runs/…task-01|02|05|10-r1/` 人工评价标题分别为「通过 · 细节待改进 / 通过 · 存在疑点 / 通过 · 有瑕疵 / 通过 · 有 BUG」；`/en/runs/…task-01-r1/` AI 评价显示「Original Chinese verdict (not translated): 直接通过」。
- 发布记录：提交 `51f497c`（缺陷修复）与 `6446a98`（测试脚手架与隔离文档）已推送 `main`；Actions run `34335478066` 构建与 Pages 部署成功。发布前创建并推送回退标签 `website-rollback-20260909-dba1c39`，指向上一成功部署提交 `dba1c39`（Actions run 34321767657）。
- 公网核验（2026-09-09，匿名 HTTPS，带缓存绕过）：`/en/tasks/task-01|06|15/` 验收建议各 4 条（修复前为空）；`/zh/runs/…task-01|02|05|10-r1/` 人工评价标题分别为「通过 · 细节待改进 / 通过 · 存在疑点 / 通过 · 有瑕疵 / 通过 · 有 BUG」（修复前为空）；`/en/runs/…task-01-r1/` AI 评价显示「Original Chinese verdict (not translated): 直接通过」。均返回 HTTP 200。

## 2026-09-09 目录与维护规范整理

- 相对整理前提交 `09b10d475acb0cd2a656e28841361ff3f536d904`，逐文件 SHA-256 对照通过：198 个成果/报告 + 1 份原始题目均未改变内容。成果移入 `Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/`；第一阶段题目沿用并行整理后的 `PROMPT/Phase1_TEST_PROMPTS_BILINGUAL.md` 文件名。
- import:data、validate:data、check（0 errors，3 个既有 hints）、npm test、build 通过；仍是 15 tasks/15 runs/30 reviews，78 个展示页、17 个 HTML 成果。未接入第二阶段真实结果。
- Chromium、Firefox、WebKit 关键浏览器流程及 15/15 成果入口通过；E2E 改用自身 Astro preview 实例、临时端口、请求超时和 finally 清理，避免依赖固定端口旧服务。
- 生成页面中 34 个唯一固定版本源码/报告目标逐项通过 Git 对象存在性核验；维护文档 40 个相对链接通过文件存在性检查。
- 远端回退标签 `website-rollback-20260909-09b10d4` 指向整理前已成功部署版本；从该 SHA 导出干净临时副本、安装锁定依赖并重新构建通过。此次未切换线上网站进行真实回退演练。
- 防作弊、隔离、后续接口是新增执行规范，尚未实现容器调度或通用多阶段导入系统；不追认第一阶段历史运行满足新隔离标准。

## 首版历史验证

执行日期：2026-09-09（Asia/Shanghai）；Node 24.19.0，npm 11.17.0，Astro 7.3.2，Playwright 1.63.0。

| 门禁 | 结果 | 覆盖 |
|---|---|---|
| `npm run validate:data` | 通过 | 15 tasks、15 runs、30 reviews；ID、关联、数字、路径边界与文件存在性 |
| `npm run check` | 通过 | Astro/TypeScript；0 errors |
| `npm test` | 通过 | 原始 Prompt 对照、评价分离、fixture 扩展演练 |
| `npm run build` | 通过 | 78 个双语/详情静态页面，17 个 HTML 成果；内部链接与显式资产 |
| `npm run test:e2e` | 通过 | Chromium、Firefox、WebKit：搜索、英文详情直达、对比深链恢复、懒加载预览、390/768/1440 横向溢出；15/15 成果入口 HTTP 加载 |
| 成果专项 | 通过 | Breakout 开始、空格发球与方向键；像素编辑器 PNG 下载事件；银行多页相对资源 |
| 原始成果 SHA-256 | 通过 | 198 个实施前文件逐一核对，内容未变 |

根路径会跳转中文首页；`/New_Model_Test/` base 下的语言页、任务/运行深链均为独立静态文件。语言切换保留当前实体与查询参数。无效实体显示归档内 404 状态，GitHub Pages 的未知物理路径使用静态 404 页面。

已知限制：iframe 使用 `allow-scripts allow-downloads allow-forms`，刻意不授予 `allow-same-origin`、弹窗或顶层导航；浏览器可能限制嵌入态存储/下载，页面提供独立打开。天气成果依赖 Open-Meteo，网络不可用时使用其自身缓存/离线模型。此次“15/15 加载”验证成果入口与关键代表交互，不等同于重跑原成果各自 README 声称的全部历史断言。

扩展示例使用 `website/tests/fixtures/extension-catalog.json`，第二模型、重复运行、新任务和第二阶段均未进入生产 `catalog.json` 或 `dist`。2026-09-09 维护复核：现有测试只在内存合并数组并核对长度，并未经过真实导入、页面和路由验证；不能据此宣称多阶段自动接入完成。实际接入要求见 adding-results.md。

远端 Actions run `34300161938` 首次部署成功；匿名访问根路径、中文/英文首页、task-06 详情、对比查询和 task-14 多页资源均返回 HTTP 200。GitHub Pages 返回的实际公网地址为 `https://gabrielmu2006.cn/New_Model_Test/`。

2026-09-09 域名迁移：Actions run `34302084919` 将展示站部署到独立子域名 `https://vibetest.gabrielmu2006.cn/`。公共 DNS CNAME 指向 `gabrielmu2006.github.io`；GitHub Pages 证书状态为 approved 并强制 HTTPS。匿名公网复验根路径、中英文首页、task-06 详情、对比查询、task-14 多页资源和 task-08 iframe 交互预览均通过，浏览器控制台无错误；旧项目路径返回 301 至新域名，主站 `https://gabrielmu2006.cn/` 保持 HTTP 200。

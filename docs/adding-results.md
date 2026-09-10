# Agent 接入后续结果操作步骤

先读根目录 `AGENTS.md`、`result-interface.md`；发起测试时还须读 `testing-protocol.md`。用户要求只制定扩展规范，当前未实现通用批次扫描器。以下是未来 agent 收到真实接入任务后的工作流程。

## 1. 接收与归档

1. 确认实际模型、phaseId、原始题目/版本、运行与成果对应关系，以及重复执行、追加提示或污染情况。必要输入不明先问；可选实测指标未知用 null。
2. 原始测试提示词放 `PROMPT/`，保留逐字原文及明确标注的译文/补充说明。
3. 结果放 `Test_Results/<model-folder>/phase-NN/task-NN-<slug>/`（扁平布局，与第一阶段一致，两个模型同题同名 slug）；同一题的重复运行才放 `runs/<新run-id>/`。保留原结果与内部相对资源结构，记录哈希。评价放阶段级 `Reviews/`，见 `result-interface.md` 的「评价目录约定」。
4. 阶段 README 写明入口、实际输入、harness、配置、预算、追加轮、隔离/污染状态、已执行测试、失败和限制。人工与 AI 评价各自保存。
5. 检查公开清单和敏感信息，封存原始证据，脱敏副本明确标注。不要在维护宿主运行成果脚本。

## 2. 适配网站，而非仅复制模板

导入器已改为「编排器 + 显式注册的批次适配器」：`scripts/import-data.mjs` 只做加载、合并、关联校验与写出，具体解析在 `scripts/adapters/<批次>.mjs`。当前已注册五个适配器——第一阶段 DeepSeek、Muse Spark phase-01、**GPT-5.6 Sol phase-01**、**DeepSeek phase-02** 与 **Muse Spark phase-02**；Muse 批次另从 `runs/<run-id>/reviews/` 解析逐题 AI 评价（沿用维护 agent v1 的表格约定）。仍然**没有通用目录扫描器**：新批次必须新增一个适配器文件并在编排器里注册，不会自动接入；仅手改 catalog.json 会被下次 check/test/build 覆盖。

Muse Spark 接入时已逐项完成的适配（可作为后续批次的参照）；`deepseek-phase2.mjs` 与 `muse-spark-phase2.mjs` 复用同一套结构，实践了扁平 `task-NN-<slug>/` 布局与「以 `submission.json` 为唯一元数据来源」的写法：

- 导入层：两个适配器返回同构实体，编排器按 id 确定性合并并拒绝冲突定义；新增 `batches`（批次指标）与 `assessments`（阶段评估）实体。
- 关联层：Phase↔Task 版本、Model/Run/Task、Review/Run、Batch/Assessment→Model 全部在导入阶段校验。
- 历史层：每条运行绑定自己的 `artifact.commit`；`sourcePathMappings` 增加 commit 维度，只有匹配该提交时才套用历史路径映射。
- 路由层：阶段页、模型页、任务页、运行页全部由实体生成（`phases/<id>/`、`models/<id>/`、`tasks/<id>/`、`runs/<id>/`）。
- 页面层：首页计数、批次统计、成果类型计数、模型列表与详情均由数据推导；模型详情只展示该模型的运行。
- 查询层：`runsForTask()` 返回该任务的全部运行并在任务详情列出；对比页按 taskId + taskVersion 取运行，同题两模型可直接并排。
- 统计层：批次指标分开展示（不合成排名），运行详情展示 `isolation.level` 与 `contamination.status`，缺失值显示“未记录”。
- 测试层：`validate-data.mjs` 的通用校验由实体推导，同时保留首批 15 tasks/15 runs/30 reviews 的独立回归；`check-dist.mjs` 的页面总数由实体推导并保留第一阶段运行页存在性检查。

**Phase 2（Task 16–20）接入时已补齐**：扁平布局适配器（读 `submission.json`，导入时校验 `prompt.txt` 的 SHA-256 与归档声明一致，拒绝题目被改动；Muse 批次另从阶段级 `Reviews/ai/<评委>-vN/task-NN.md` 解析评价）；`validate-data.mjs` 新增「阶段 `taskVersions` 必须与目录中任务一一对应」的通用不变量，第一阶段计数改为按阶段收敛；`check-dist.mjs` 的回归按阶段推导并新增「已归档成果必须随构建发布」检查；网站运行页新展示收尾审查证据链接与补充轮逐字输入，无评价时显式说明而不是留空白；`e2e-smoke.mjs` 覆盖第二阶段阶段页、越界标注、审查链接、SVG 成果与懒加载预览，并支持 `E2E_BROWSERS` 选择浏览器。

仍然未实现的部分（后续接入新阶段时仍需处理）：通用批次扫描器、按运行挂多份 AI 评价的网站展示（数据层已支持一个运行多条评价，页面按运行渲染全部评价）、以及第二阶段其余 25 题的评价接入（当前 `reviews/` 为空，运行页会显式显示「暂无独立评价」）。

## 3. 验证、发布与交付

在 website/ 运行 `npm run import:data && npm run validate:data && npm run check && npm test && npm run build`，构建后运行 `npm run test:e2e`。临时 fixture 必须经过真实导入、校验、构建和页面行为，覆盖新增阶段、模型、重复运行；完成后确保 fixture 未混入正式 catalog、dist 或发布包。

检查新数据的中英文详情、直接刷新、模型/阶段过滤、正确版本 Prompt、两个运行的比较、评价独立性、成果入口、来源提交链接和移动布局。复验原第一阶段和页脚联系链接。

最后更新根 README 索引、来源审计和验证记录；保留最近成功版本的远端回退标签。通过后自动推送 main，等待 Actions 和公网核验；流程及回退命令见 deployment.md。不能以“文件已上传”代替网站已接入的验收。

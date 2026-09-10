# 后续测试结果交接接口

这是组织者向收集/维护 agent 的文件交接规范，不是已经实现的 HTTP API 或自动上传服务。目前不会扫描任意目录自动接入新阶段。agent 接到“上传/接入后续结果”任务时，按 `adding-results.md` 盘点、归档、适配网站、测试并发布。

## 目录约定

```text
PROMPT/
  Phase1_TEST_PROMPTS_BILINGUAL.md
  <phase-prefixed-prompt-document>.md
Test_Results/
  <model-folder>/
    phase-NN/
      README.md
      Reviews/                         # 阶段级评价（人工 + 各 AI 评委），见下方「评价目录约定」
      task-NN-<slug>/                  # 每个任务一个目录（首次运行 r1）；两个模型同题同名
        submission.json                # 交接元数据：runId、指标、成果清单、隔离/越界、评价索引
        prompt.txt                     # 实际逐字输入
        followups.json                 # 按顺序记录补充指令；没有则 []
        artifacts/                     # 封存模型输出，保持相对目录结构
        evidence/                      # 可公开测试证据/脱敏日志/审查记录
        README.md                      # 入口、运行方法、限制和摘要
      runs/<新run-id>/                 # 仅用于同一题的**重复运行**（r2 及以后）
```

**扁平布局是默认**（2026-09-10 组织者决定，与第一阶段一致）：`runId` 记录在 `submission.json` 里，**不**用作目录名；`task-NN-<slug>` 的 slug 取自题目名，两个模型同题时同名，便于并排对照。只有同一题的第二次及以后运行才放进 `runs/<新run-id>/`，`submission.json` 用 `runRelation.parentRunId` 关联首次运行。

同一阶段内，每个 run 只对应一题的一次执行；多题同会话通过 sessionId / 共享上下文标记关联。历史上曾把 r1 放进 `runs/<run-id>/`（2026-09-10 已改回扁平），历史提交里的旧路径保持不变，不需要也无法重写。

Muse-Spark 的 `prompt.txt` 为**事后补录**并在阶段 README 中标注；其余阶段的 `prompt.txt` 为逐字存档（导入时与归档声明的 SHA-256 校验）。

新 model-folder 使用稳定文件名，显示名称、供应商、实际模型版本和 harness 在元数据中分列。同一模型不同阶段并列，不能把阶段放到模型目录之上。

**模型身份与快照（2026-09-10 组织者决定）**：同一模型的不同发布版本（如 `DeepSeek-V4.1-Flash` 的 0910 实验版与随后发布的正式版）视为**同一个模型实体**，成绩同表记录。实体 `id` 一旦公开即固定：改名只改显示名（`name` 为双语 `{zh, en}`），**不重命名目录、不重命名既有 runId、不改既有 URL**。

- 每个运行必须记录 `environment.reportedModelId`：**harness 报告的模型 id，即本次运行实际使用的快照**。归档中没有该记录的运行（如第一阶段）记 `null` 并注明原因，不得据品牌名反推。
- 模型实体用 `snapshots` 声明该模型有哪些快照：`{ id, label: {zh, en}, status: current|retired|unknown, evidence: {zh, en} }`；`id` 尚未知时写 `null` 并注明「待第一次运行后回填」。
- **跨快照比较必须标明**：同模型的不同快照不是同一配置。展示层要在运行详情显示快照 id，在模型页列出全部快照与全部批次。
- runId 的模型 slug 只需**全局唯一且稳定**，不要求等于模型实体 id：后续正式版运行采用 `run-deepseek-v4-1-flash-task-NN-rN`，既有的 `run-deepseek-v4-1-flash-exp-0910-task-NN-rN` 保持不变。

## 评价目录约定（2026-09-10 组织者决定）

评价**一律放阶段层**，不放进任务目录：

```text
phase-NN/Reviews/
├── Personal_Review.md                 # 人工评价（一名评审一份；多名时用 Reviews/<评审>.md）
└── ai/
    ├── maintenance-agent-v2/          # AI 评价：一个评委一个目录，版本号递增
    │   ├── README.md                  # 必备：评价元信息 + 总览表 + 文件索引
    │   ├── phase-summary.md           # 必备：阶段总评（方法、边界、逐题要点、限制）
    │   └── task-16.md … task-20.md    # 推荐：逐题评价
    └── codex-v1/
```

逐题评价文件的元信息表必须包含 `本题得分`、`结论（中）`、`Conclusion (EN)`（导入器按这几行解析），并写明评价者与是否盲评、日期、证据与局限。

**后续添加评价**：新建 `Reviews/ai/<新评委>-v1/`，或对同一评委递增版本号（`-v2`）；**不得覆盖、改写或删除既有评价**。同一运行可以挂多份人工与 AI 评价，各自独立记录；不同评委、不同口径的分数**不得合成排行榜或排序**，展示时并列呈现。模型索引页可显示同一模型 AI 阶段评估的简单均分（2026-09-10 组织者决定），须标注份数与口径差异，逐份评分在模型页并列保留。

## 必须交接的信息

下列为字段契约；submission.json 可按字段组组织，但不是当前 catalog 的直接替代。可选实测值缺失用 null，确实无项的列表用 []，不能以空字符串/0 伪造已知值。

| 字段组 | 字段与要求 |
|---|---|
| 标识 | schemaVersion: 1、runId、phaseId、taskId、正整数 taskVersion、modelId；runId 全局唯一 |
| 身份 | model.name、实际版本/供应商（未知 null），不得仅据品牌名称推断实际运行模型 |
| 输入 | prompt.path（仓库相对路径）、prompt.sha256、prompt.version、本次逐字输入路径、按顺序排列的追加指令及资源 SHA-256 |
| 环境 | harness/版本、**harness 报告的 model id（`reportedModelId`，即快照）**、OS/runtime、工具版本、sessionId、上下文是否复用、补充轮数、采样设置、开始/结束时间和时区（若已知） |
| 预算 | 开测前固定的时间/token/工具调用/重试/补充轮上限、超时条件、联网和资源规则 |
| 指标 | durationSeconds 及口径、apiCalls、toolCalls、failures、inputTokens、outputTokens、cacheReadTokens、totalTokens；非负有限数或 null |
| 费用 | 金额、币种、任务或批次范围及来源；批次金额不能均分填到每题 |
| 成果 | 类型 html/svg、入口、运行所需显式 files、仓库相对 sourcePath、文件 SHA-256、封面来源及 preview 能力 |
| 版本证据 | source.commit + 该提交内 source.path；本地尚未提交可暂 null，但不可把不存在的 SHA/path 当作已验证公开链接 |
| 运行关系 | parentRunId、重试/修复原因；没有则 null；不可覆写父运行 |
| 状态 | completed/partial/failed/timeout/infrastructure-error，含失败和未完成输出 |
| 隔离 | isolation.level、实际执行环境、只读输入清单、网络规则、共享上下文情况 |
| 污染 | contamination.status 为 clean/suspected/contaminated/unknown，事件和证据来源；clean 只针对声明的本轮控制措施。**该状态只影响标注，不影响成绩录入**：只有 `contaminated`（确认作弊成功）需要在展示中标注「已确认获取外部答案」，`suspected` 只记入档案。另记 `contamination.telemetry`：`visible` / `partial` / `hidden`——`hidden` 表示该模型 / harness 不提供中间工具调用记录，按 `docs/audit-method.md` 4.0 **默认视为遵守规则**并在展示中标注 |
| 测试证据 | command、cwd（不泄露私有宿主路径）、环境、日期、通过/失败/跳过、证据路径和限制；历史自述另列 |
| 评价 | 独立 reviewId、runId、human/ai、作者、日期、双语结论/原文、评分及 scoreMethod、证据位置；译文显式标记。**每个评价必须自报其归档提交 `commit`**：评价常晚于运行入库，沿用运行的提交会生成 404 源码链接 |
| 来源提交 | Review / Batch / Assessment 一律带 `commit`（该文件被入库的那个 40 位 SHA），展示时逐来源绑定；`website/scripts/verify-source-links.mjs` 在构建后逐个校验 |

公开说明不得包含凭据、私人浏览器状态或未经同意的完整私有会话。完整证据封存与公开脱敏副本都计算哈希，公开副本说明删改范围，不能把脱敏误称为原始全文。

## 转换到网站实体

已有参考模板在 `website/data/templates/`，仅作字段参考，不能把空模板复制进生产。现有模板不含所有本协议字段，接入时扩展必要字段和类型并保留证据。

- Phase：id、number、双语 name/description、taskVersions: ["task-id@version"]。
- Task：id、version、phaseId、双语 title、category、promptOriginal、标注的 promptTranslation、expectedOutcome、verification、source。
- Model：id、name、version、provider、notes；执行配置写到 Run，不能写成全模型恒定属性。
- Run：id、modelId、taskId、taskVersion、environment、metrics、artifact、source。后续适配保留隔离/污染/重试元数据，至少在运行详情展示状态和证据。
- Artifact：entry 必须在 files 内，文件实际存在且位于允许的 sourcePath 内；拒绝绝对路径、..、symlink 逃逸。按 artifacts/<runId>/ 发布，不改变内部相对路径。
- Review：绑定确切 runId，各评委独立记录。未知评分为 null，评分须有方法和来源，不把不同标准分数合成排行榜（模型索引页的 AI 均分只作概览，见上）。

任务版本是复合键 (taskId, version)。现有网站只存每题一个版本，未来接入第二个版本时须先改查找、校验及路由：保留已有 /{locale}/tasks/{id}/，为历史版本提供稳定地址或版本选择；run.taskVersion 始终定位正确原题。不能直接在只按 id 去重的 catalog 中塞入重复 ID。

当前全局 archiveCommit 与 sourcePathMappings 仅服务于第一阶段目录迁移。未来每批不同提交要使用逐来源/逐成果的 commit 与历史路径，不能把新目录链接拼接到第一阶段旧 SHA。固定版本文件链接必须可访问。

**批次汇总额外规则（2026-09-10 修复后）**：批次指标是对逐题值的求和，**任一题缺该项时该批次项必须为 null**，不得用 `?? 0` 把未知当 0（实例：opencode 日志不记 API 调用数，Muse phase-02 的逐题 `apiCalls` 全为 null，此前批次显示「API 0」）。断言见 `website/tests/catalog.test.mjs`。

## 接收与验收判定

- 已确认身份、原题版本、成果对应关系和可读取文件后才能正式接入；无法确认则询问并保留待核实记录。
- 指标或评分缺失可以接入，页面显示未记录；不以补全表格为理由编造数字。
- 污染/失败结果保留并明确标识，不能计入清洁运行的成功统计。若网站尚不能显示该状态，应先补最小展示能力，不能当作普通成功运行发布。
- 源文件入库不等于已上线。以真实导入、构建、页面显示、源码链接和公网核验共同作为完成标准。

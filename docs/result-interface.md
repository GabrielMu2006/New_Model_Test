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
      Reviews/                         # 阶段/批次总结，分作者和来源
      runs/
        <run-id>/
          submission.json              # 交接元数据，目前不被自动扫描
          prompt.txt                   # 实际逐字输入
          followups.json               # 按顺序记录补充指令；没有则 []
          artifacts/                   # 封存模型输出，保持相对目录结构
          evidence/                    # 可公开测试证据/脱敏日志
          reviews/                     # 针对该运行的独立评价
          README.md                    # 入口、运行方法、限制和摘要
```

第一阶段兼容例外：`Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/` 内保留原来的 15 个 `task-*` 目录、README 和 Reviews，不为套用新模板而重写历史资料。其 r1 对应关系以现有导入器为准；重复运行放入该阶段的 `runs/<新run-id>/`。同一个 run 只对应一题的一次执行，多题同会话通过 sessionId/共享上下文标记关联。

Muse-Spark 例外（组织者 2026-09-09 决定）：`Test_Results/Muse-Spark-1.3_Opencode/phase-01/` 同样沿用扁平 `task-*/` 布局，便于与第一阶段同题对照；其逐字 `prompt.txt` 为**事后补录**并已在阶段 README 中标注，AI 评价按 `Reviews/ai/<评价者标识>-vN/` 目录接口组织（同一运行可挂多份评价，互不覆盖）。**后续新阶段仍按上方 `runs/<run-id>/` 契约执行**，不再扩大扁平布局的适用范围。

新 model-folder 使用稳定文件名，显示名称、供应商、实际模型版本和 harness 在元数据中分列。同一模型不同阶段并列，不能把阶段放到模型目录之上。

**模型身份与快照（2026-09-10 组织者决定）**：同一模型的不同发布版本（如 `DeepSeek-V4.1-Flash` 的 0910 实验版与随后发布的正式版）视为**同一个模型实体**，成绩同表记录。实体 `id` 一旦公开即固定：改名只改显示名（`name` 为双语 `{zh, en}`），**不重命名目录、不重命名既有 runId、不改既有 URL**。

- 每个运行必须记录 `environment.reportedModelId`：**harness 报告的模型 id，即本次运行实际使用的快照**。归档中没有该记录的运行（如第一阶段）记 `null` 并注明原因，不得据品牌名反推。
- 模型实体用 `snapshots` 声明该模型有哪些快照：`{ id, label: {zh, en}, status: current|retired|unknown, evidence: {zh, en} }`；`id` 尚未知时写 `null` 并注明「待第一次运行后回填」。
- **跨快照比较必须标明**：同模型的不同快照不是同一配置。展示层要在运行详情显示快照 id，在模型页列出全部快照与全部批次。
- runId 的模型 slug 只需**全局唯一且稳定**，不要求等于模型实体 id：后续正式版运行采用 `run-deepseek-v4-1-flash-task-NN-rN`，既有的 `run-deepseek-v4-1-flash-exp-0910-task-NN-rN` 保持不变。

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
| 污染 | contamination.status 为 clean/suspected/contaminated/unknown，事件和证据来源；clean 只针对声明的本轮控制措施。**该状态只影响标注，不影响成绩录入**：只有 `contaminated`（确认作弊成功）需要在展示中标注「已确认获取外部答案」，`suspected` 只记入档案 |
| 测试证据 | command、cwd（不泄露私有宿主路径）、环境、日期、通过/失败/跳过、证据路径和限制；历史自述另列 |
| 评价 | 独立 reviewId、runId、human/ai、作者、日期、双语结论/原文、评分及 scoreMethod、证据位置；译文显式标记 |

公开说明不得包含凭据、私人浏览器状态或未经同意的完整私有会话。完整证据封存与公开脱敏副本都计算哈希，公开副本说明删改范围，不能把脱敏误称为原始全文。

## 转换到网站实体

已有参考模板在 `website/data/templates/`，仅作字段参考，不能把空模板复制进生产。现有模板不含所有本协议字段，接入时扩展必要字段和类型并保留证据。

- Phase：id、number、双语 name/description、taskVersions: ["task-id@version"]。
- Task：id、version、phaseId、双语 title、category、promptOriginal、标注的 promptTranslation、expectedOutcome、verification、source。
- Model：id、name、version、provider、notes；执行配置写到 Run，不能写成全模型恒定属性。
- Run：id、modelId、taskId、taskVersion、environment、metrics、artifact、source。后续适配保留隔离/污染/重试元数据，至少在运行详情展示状态和证据。
- Artifact：entry 必须在 files 内，文件实际存在且位于允许的 sourcePath 内；拒绝绝对路径、..、symlink 逃逸。按 artifacts/<runId>/ 发布，不改变内部相对路径。
- Review：绑定确切 runId，各评委独立记录。未知评分为 null，评分须有方法和来源，不把不同标准分数合成排行榜。

任务版本是复合键 (taskId, version)。现有网站只存每题一个版本，未来接入第二个版本时须先改查找、校验及路由：保留已有 /{locale}/tasks/{id}/，为历史版本提供稳定地址或版本选择；run.taskVersion 始终定位正确原题。不能直接在只按 id 去重的 catalog 中塞入重复 ID。

当前全局 archiveCommit 与 sourcePathMappings 仅服务于第一阶段目录迁移。未来每批不同提交要使用逐来源/逐成果的 commit 与历史路径，不能把新目录链接拼接到第一阶段旧 SHA。固定版本文件链接必须可访问。

## 接收与验收判定

- 已确认身份、原题版本、成果对应关系和可读取文件后才能正式接入；无法确认则询问并保留待核实记录。
- 指标或评分缺失可以接入，页面显示未记录；不以补全表格为理由编造数字。
- 污染/失败结果保留并明确标识，不能计入清洁运行的成功统计。若网站尚不能显示该状态，应先补最小展示能力，不能当作普通成功运行发布。
- 源文件入库不等于已上线。以真实导入、构建、页面显示、源码链接和公网核验共同作为完成标准。

# 展示站数据模型 / Website data model

生产索引由 `website/scripts/import-data.mjs` 从归档来源确定性生成到 `website/data/catalog.json`。导入采用「编排器 + 显式注册的批次适配器」：编排器负责加载、合并、关联校验与写出，解析规则在 `website/scripts/adapters/<批次>.mjs`。稳定实体为 Phase、Task、Model、Run、Artifact、Review，另有批次指标 Batch 与阶段评估 Assessment；任务需求变更时递增 `version`，同题重复执行新增 Run，不覆盖旧记录。

- Phase 引用 `taskId@version`；Task 保留逐字原始 Prompt、译文、理论成果、后补验收建议及来源行。同一 phase 的 Task 被多个模型复用（同题不同模型 = 多条 Run）。
- Model 只记录来源可确认的身份；未知值用 `null`。
- Run 把模型身份与实际 harness、会话、补充轮及指标分离；另带 `prompt`（路径、SHA-256、是否事后补录）、`isolation.level`、`contamination.status` 与 `status`。`metrics.durationSeconds` 是唯一用于展示的时长来源（`format.ts` 的 `runDuration()`；≥1 小时 `H:MM:SS`），`metrics.durationLabel` 是归档原文（如「4分51秒」），只作来源保留、不再渲染。
- Artifact 使用显式文件清单、入口、预览权限和**自己的**归档提交（`artifact.commit`）；构建不会递归发布整个任务目录。
- `artifact.preview.note` 可能是**双语对象** `{ zh, en }` 或**归档原样的字符串**：本站撰写的提示提供双语（中文页优先），来自归档 `submission.json` 的英文说明保留原文、并在中文页配中文说明（`en` 始终是归档原样文本）。校验要求双语对象两项都非空。
- `phase.plannedTasks` 是该阶段**计划**的题目数（phase-01 = 15，phase-02 = 30，来源见同文件的 `plannedTasksNote`），用于首页与阶段页的「已测试 / 计划」覆盖率；必须是不小于该阶段已归档题数的正整数。
- Review 按 human / ai 独立记录，评分方法和原始报告定位不合并；同一 Run 允许挂多份 AI 评价，`translated` 标明结论是否为他语译文。
- Batch 记录该模型在该阶段的批次指标（用时/token/API/工具/失败/费用）与来源，页面分开展示，不合成跨批次排名。
- Assessment 记录阶段级评估（评分、口径、来源、免责声明）；不同评委的分数并列保留，不互相覆盖。

缺失值必须为 `null`，不能用 0 代替。token 输入、输出、缓存读取分列；批次费用不拆分为单题费用。

`catalog.schemaVersion` 当前为 2。模板和 fixture 仅作字段参考；后续字段契约见 [result-interface.md](result-interface.md)，接入清单与已完成的适配见 [adding-results.md](adding-results.md)。

来源链接：`catalog.sourcePathMappings` 带 `commit` 维度——只有路径与该提交匹配时才套用历史路径映射。第一阶段目录迁移后的当前路径（`PROMPT/`、`Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-01/`）映射回 `archiveCommit` 内的原路径；Muse Spark 批次没有迁移，直接用其归档提交与当前路径。每个批次的运行必须绑定自己的提交，不能把新目录拼到旧 SHA 上。

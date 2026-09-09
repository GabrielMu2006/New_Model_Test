# 展示站数据模型 / Website data model

生产索引由 `website/scripts/import-data.mjs` 从归档来源确定性生成到 `website/data/catalog.json`。稳定实体为 Phase、Task、Model、Run、Artifact、Review；任务需求变更时递增 `version`，同题重复执行新增 Run，不覆盖旧记录。

- Phase 引用 `taskId@version`；Task 保留逐字原始 Prompt、译文、理论成果、后补验收建议及来源行。
- Model 只记录来源可确认的身份；未知值用 `null`。
- Run 把模型身份与实际 harness、会话、补充轮及指标分离。
- Artifact 使用显式文件清单、入口、预览权限和归档提交；构建不会递归发布整个任务目录。
- Review 按 human / ai 独立记录，评分方法和原始报告定位不合并。

缺失值必须为 `null`，不能用 0 代替。token 输入、输出、缓存读取分列；批次费用不拆分为单题费用。

当前实现限制：导入器和部分页面只支持第一阶段固定记录；模板和 fixture 不代表通用多阶段接入已完成。后续字段契约见 [result-interface.md](result-interface.md)，必要适配见 [adding-results.md](adding-results.md)。

目录迁移后 source.path/artifact.sourcePath 采用当前仓库位置（PROMPT/ 和 Test_Results/模型/phase-01/），catalog.sourcePathMappings 将其映射回 archiveCommit 内的原路径生成固定版本链接。该映射仅用于首批档案；后续批次须逐来源绑定自己的 commit/path。

# 展示站数据模型 / Website data model

生产索引由 `website/scripts/import-data.mjs` 从归档来源确定性生成到 `website/data/catalog.json`。稳定实体为 Phase、Task、Model、Run、Artifact、Review；任务需求变更时递增 `version`，同题重复执行新增 Run，不覆盖旧记录。

- Phase 引用 `taskId@version`；Task 保留逐字原始 Prompt、译文、理论成果、后补验收建议及来源行。
- Model 只记录来源可确认的身份；未知值用 `null`。
- Run 把模型身份与实际 harness、会话、补充轮及指标分离。
- Artifact 使用显式文件清单、入口、预览权限和归档提交；构建不会递归发布整个任务目录。
- Review 按 human / ai 独立记录，评分方法和原始报告定位不合并。

缺失值必须为 `null`，不能用 0 代替。token 输入、输出、缓存读取分列；批次费用不拆分为单题费用。

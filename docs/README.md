# 项目文档

- [根目录 AGENTS.md](../AGENTS.md)：协作入口、维护边界、测试门禁和自动发布。
- [结果交接接口](result-interface.md)：模型→阶段目录、任务版本、运行字段和来源契约。
- [Agent 接入结果步骤](adding-results.md)：当前能力、实际扩展所需改造和上线验收。
- [隔离与防答案污染](testing-protocol.md)：禁止偷看、会话/文件/网络隔离、证据和污染处置。
- 测试工作区启动方案（`test-workspace/README.md`，**本地目录，不入库、不推送**）：按 phase 建任务目录、逐题隔离测试、汇总归档的操作手册。
- [会话日志审计方法](audit-method.md)：解压 DSH 多帧 zstd 日志、逐维度审计、判定与归档格式。
- [数据模型](data-model.md)、[来源审计](source-audit.md)、[验证记录](verification.md)。
- [已知问题与待办](known-issues.md)：待修复的展示站缺陷、后续接入缺口与组织者决定。
- [发布及回退](deployment.md)：自动发布、保留上一版本及紧急恢复。
- [历史网站实施计划](WEBSITE_IMPLEMENTATION_PLAN.md)、[网站启动提示词](WEBSITE_START_PROMPT.md)。

网站已在 https://vibetest.gabrielmu2006.cn/ 公开部署，当前域名、目录和流程以维护文档及 AGENTS.md 为准。模型原始测试 Prompt 位于 `../PROMPT/`。

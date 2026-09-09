# 新增结果 / Adding results

模板位于 `website/data/templates/`。新增真实数据后执行 `npm run import:data && npm run validate:data && npm test && npm run build`。

1. 新模型：复制 `model.template.json` 到 `website/data/models/`，使用稳定小写 ID，未知字段保留 `null`。
2. 新任务：在来源 Prompt 文档加入版本化需求，再按 `task.template.json` 建模；不可把后补验收项写成原始硬约束。
3. 新运行：按 `run.template.json` 新建唯一 Run，保持 task/version 关联，列出公开所需的最小资源清单。
4. 新阶段：按 `phase.template.json` 新增 Phase，并列出 `taskId@version`。
5. 新评价：按 `review.template.json` 分来源添加，不覆盖或合并已有评价。

`tests/fixtures/extension-catalog.json` 已演练第二模型、第二阶段、新任务与 task-01 重复运行；测试确认计数和同题多运行选择由数据扩展，fixture 不被导入生产 `catalog.json` 或 `dist/`。

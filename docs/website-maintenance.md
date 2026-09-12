# 网站内容维护手册 / Website content maintenance runbook

面向收到「改展示站内容」任务的维护 agent。回答两个问题：**改什么该动哪个文件**，以及**改完要过哪些门禁**。
前置阅读：根 `AGENTS.md`（维护边界）、`docs/data-model.md`（实体与字段）、`docs/result-interface.md`（交接契约）。
接入新阶段/新模型请走 `docs/adding-results.md`；发布与回退见 `docs/deployment.md`；发布记录见 `docs/verification.md`。

## 0. 一句话前提

`website/data/catalog.json` 是**生成物**。页面、路由、计数、比较、预览全部由它推导；
一切内容改动都应落在**来源**（归档、适配器、`data/` 下的 JSON、`src/lib` 文案）上，再重新生成。
直接手改 `catalog.json` 会在下一次 `import:data`（`check` / `test` / `build` 的 pre 钩子都会触发）被覆盖。

## 1. 「改什么 → 动哪里」索引

| 要改的东西 | 真正的来源 | 生成/受影响 | 必须同步的断言 |
| --- | --- | --- | --- |
| 题目正文、译文、验收建议 | `PROMPT/` 的题目文档 + 批次适配器里的 `tasks` | `catalog.tasks` | `validate-data.mjs`：prompt/译文非空、`verification` 中英等长 |
| 题目版本 | 适配器 `taskVersion`（复合键 `taskId@version`） | 阶段 `taskVersions` | 阶段与目录必须一一对应 |
| 某次运行的成果文件清单 | 归档 `submission.json` 的 `artifacts.files` / `entry` | `catalog.runs[].artifact` | `entry ∈ files`；文件必须存在；`copy-artifacts.mjs` 只复制**显式清单** |
| 运行指标（时长/token/调用/失败） | 归档 `submission.json` 的 `metrics` | 运行页 + 批次求和 | 非负有限数或 `null`；**批次任一题缺该项则批次该项为 `null`**，不得 `?? 0` |
| 模型身份、显示名、快照 | `website/data/models/<model-id>.json` | 模型页、运行页快照行 | 名字双语；`reportedModelId` 必须在该模型的 `snapshots` 里声明 |
| 阶段名称/描述/计划题数 | `website/data/phases/phase-NN.json` | 首页覆盖率、阶段页 | `plannedTasks` 为正整数且 ≥ 已归档题数；`plannedTasksNote` 双语 |
| 评价内容与分数 | 归档 `Reviews/`（阶段级，**不放进任务目录**） | 运行页评价卡、模型页阶段评估 | `conclusion`/`body` 双语非空；AI 评价必须有 score + scoreMethod；`review.commit` 必须是该文件入库的那个 SHA |
| 批次指标与阶段评估 | 适配器返回的 `batches` / `assessments` | 模型页、模型索引均分 | `batch.commit`/`assessment.commit` 为 40 位 SHA；评估 `disclaimer` 双语 |
| 界面文案（中英） | `src/lib/labels.ts` | 全站 | 两个语种字典必须同时改，类型是 `Labels`，漏改会编译失败 |
| 编号体系（ARCHIVE/PHASE/TASK/RUN/MODEL） | `src/lib/naming.ts` | 全站编号 | 编号只由档案数据推导，不新增数据字段 |
| 展览标签与品牌语句 | `src/lib/site.ts` | 页头/页脚/首页 | 纯展示常量，不参与档案数据 |
| 字段缺失时的显示 | `src/lib/format.ts` | 全站 | 缺失一律「未记录」/「Not recorded」，**绝不显示 0 或空单元格** |
| 越界/污染标注口径 | `src/lib/contamination.ts` + `docs/audit-method.md` §5 | 运行页技术记录 | `suspected` 不外显；`telemetry: hidden` 显示「默认视为遵守规则」 |
| 配色/字体/间距等视觉 | `src/styles/global.css`（设计令牌） + `VibeTest Digital Museum UI Design Specification.md` | 全站 | 改 UI 须同时维护令牌、编号与双语文案；不得改回深色数据看板风格 |
| HTML 成果封面 | `website/public/covers/<runId>.png`（或归档自带截图 + `artifacts.cover`） | 卡片、预览占位、构建 | **缺封面会让 `npm run build` 静态链接检查直接失败** |
| 回退点与发布记录 | `docs/deployment.md`、`docs/verification.md` | — | 每次发布前滚动更新；标签只追加不覆盖 |

## 2. 内容是怎么进到页面里的

```text
PROMPT/ + Test_Results/           归档（原始、只增不改）
        └─ website/scripts/adapters/<批次>.mjs      解析规则（新批次必须新增并注册）
                └─ scripts/import-data.mjs          编排：合并 + 关联校验 + 写出
                        └─ data/catalog.json        生成物（schemaVersion 2）
                                ├─ src/lib/catalog.ts       查询与链接辅助
                                ├─ src/pages/[locale]/[...path].astro  getStaticPaths 由实体生成路由
                                ├─ src/components/pages/*   各页面
                                └─ scripts/copy-artifacts.mjs  按显式清单复制成果
```

要点：

- **路由不需要手改**。`getStaticPaths()` 从 `catalog.phases/models/tasks/runs` 直接铺路径；新增结果不改路由。
- **适配器契约**：每个适配器导出 `id` 与 `load(ctx)`，返回 `{ model, tasks, runs, reviews, batches?, assessments?, sourcePathMappings? }`。编排器按 `id` 去重，**同 id 但定义不同直接报错**；同题任务实体只定义一次（后续批次返回空 `tasks`）。
- **导入期就报错，不留给页面**：task→phase、run→model/task、review→run、batch/assessment→model 的悬空引用都会让 `import:data` 失败。
- `data/phases/*.json` 由目录读取，新增阶段只要放文件，无需改导入器。

## 3. 默认工作流

```bash
cd website
npm ci                                  # 干净环境；Node 24
npm run import:data && npm run validate:data
npm run check                           # astro check：0 errors / 0 warnings / 0 hints
npm test                                # Node 原生单测
npm run build                           # astro build + check-dist + verify-source-links
npm run test:e2e                        # 涉及路由/交互/预览/比较/接入时必须跑
```

- 首次安装浏览器：`npx playwright install chromium firefox webkit`（Linux CI 加 `--with-deps`）。
- 本机 Firefox 会 `Target crashed`（既有环境限制，见 `docs/verification.md`）：本机用 `E2E_BROWSERS=chromium,webkit npm run test:e2e`，让 CI 覆盖三浏览器全套。
- **纯文档改动**按 `AGENTS.md` 只需检查目录、链接与命令；涉及导入、文件迁移或发布配置必须跑全部门禁。
- 判断改动是否「纯文档」：`git status` 里是否出现 `website/**`。只改 `docs/`、`README.md`、`PROMPT/**` 时站点产物不变，可用 `catalog.json` 导入前后逐字节一致来证明。

### 各门禁实际在防什么

| 门禁 | 防的失败 |
| --- | --- |
| `import:data` | 悬空引用、同一实体两种定义、题面被改动（`prompt.txt` SHA-256 与归档声明不符） |
| `validate:data` | 双语缺失、版本错配、`entry` 不在清单内、路径逃逸/文件不存在、非法枚举、指标为负或 NaN、AI 评价缺评分口径、Review/Batch/Assessment 缺 `commit`、历史分批回归 |
| `check` | Astro/TS 类型与模板错误 |
| `test` | 空值被渲染成 0、时长格式、Markdown 转义与链接白名单、JSON 数据岛转义、污染展示口径、fixture 能扩展而不改组件 |
| `build` → `check-dist` | 站内死链、页面总数与实体不一致、已归档运行页/成果缺失 |
| `build` → `verify-source-links` | **页面正常但点开源码链接 404**：每个 GitHub 链接必须在它所固定的那个提交里真实存在（归档分批入库，同一阶段的运行/评价/证据常落在不同提交） |
| `test:e2e` | 语言切换、直接刷新、筛选与搜索、对比 URL 恢复、懒加载预览、390/768/1440 无横向溢出、404、成果入口可达 |

## 4. 改完之后：发布与回退

按 `docs/deployment.md` 执行，摘要：

1. 发布前找到**最近一次已成功部署且公网验证通过**的源码提交，为它创建远端不可变标签 `website-rollback-YYYYMMDD-短SHA`（只追加，不覆盖、不删唯一回退点）。
2. 只提交本次相关文件 → 推送 `main` → 等对应提交的 `website-deploy.yml` 成功。
3. **匿名 HTTPS 复核**：根页、中英文、任务/对比深链、代表性成果、页脚邮箱与主站链接、本次新增内容。推送成功不等于上线成功，不能只看旧缓存的 HTTP 200。
4. 把版本、Actions run、回退标签、公网核验证据写进 `docs/verification.md` 与 `docs/deployment.md`。
5. 出现阻断回归时用 `source_ref` 重建上一可用提交；不 `reset`/force-push，回退后仍须修复或 `git revert`。

## 5. 维护时的硬约束（违反会被门禁或审查挡住）

- 归档（`PROMPT/`、`Test_Results/`）**只增不改**：不覆盖旧成果、不润色历史评价、不替模型改答案。
- 缺失值为 `null`，**不用 0、空串或臆造值补齐**；页面显示「未记录」。
- 不同评委、不同口径的分数**不得合成排行榜或排序**；模型索引页的 AI 简单均分只是概览，必须同时标注份数与口径差异。
- 评价一律放阶段级 `Reviews/`，新增评委用 `Reviews/ai/<评委>-vN/`，**不覆盖既有评价**。
- 每条 Review / Batch / Assessment 自报其**归档提交** `commit`；源码链接逐来源绑定，不把新目录拼到旧 SHA 上。
- 成果只发布 `artifact.files` 的显式清单，保留内部相对结构；**不递归发布整个成果根目录**。
- HTML 预览按需加载；同源 iframe 不同时授予 `allow-scripts` 与 `allow-same-origin`；外链 `rel="noopener"`。
- 不把依赖目录、凭据、浏览器配置、私有会话日志或临时缓存提交到公开仓库。
- 隔离只能表述为「策略级约束 + 事后审查」；**不得**写「强制隔离」「无污染」「已审计」。

## 6. 手工触点（自动化之外必须记住的三处）

1. **封面**：HTML 成果没有归档截图时必须跑
   `npm run build && npm run capture:covers`，把生成的 `public/covers/<runId>.png` 一起提交。
   该脚本需要 Playwright 且**未接 CI**；缺封面会让 `npm run build` 失败。SVG 成果用文件本身作缩略图，不需要封面。
2. **写死的回归基线**：`scripts/validate-data.mjs` 末尾仍保留首批 15 题/15 运行/30 评价以及 GPT、K3、两批 phase-02 的专项断言；`scripts/check-dist.mjs` 的 `regressionPhases` 数组列了要检查的运行阶段；`tests/catalog.test.mjs`、`scripts/e2e-smoke.mjs` 里也有按 runId / 分数的具体断言。
   接入新批次时**通用校验和页面总数由实体推导**，不能靠删除基线放行；新增批次应**追加**自己的断言，并把「三模型同题」这类过时描述改成实际数量。
3. **没有通用批次扫描器**：导入器只加载显式注册的适配器（当前 6 个），不扫描任意目录、不执行档案内脚本。新阶段/新模型必须新增 `scripts/adapters/<批次>.mjs` 并在 `scripts/import-data.mjs` 的 `adapters` 数组里注册。

## 7. 自检清单

改完内容后逐条确认：

- [ ] `catalog.json` 是重新生成的，没有手工编辑的痕迹
- [ ] 涉及的所有中英文都在两个语种里改了（文案在 `labels.ts`，数据在实体字段）
- [ ] 新批次：`data/models/<id>.json` 已建、适配器已注册、`plannedTasks`/`plannedTasksNote` 已写
- [ ] HTML 运行都有封面，`build` 的静态链接检查通过
- [ ] 门禁按第 3 节跑完，命令、环境、通过/失败/跳过、覆盖范围与限制都如实记录
- [ ] `docs/verification.md` 加了本轮条目，`docs/deployment.md` 的回退点已滚动更新
- [ ] 发布后做了匿名 HTTPS 复核，而不是只看 Actions 绿灯

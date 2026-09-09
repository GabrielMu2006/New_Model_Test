# M5/M7 验证记录 / Verification record

## 2026-09-09 展示站数据缺陷修复（known-issues 1.1–1.4）

- 修复 `website/scripts/import-data.mjs`：`bilingualList()` 同时接受全角 `：` 与半角 `:`（英文验收建议由 0 条恢复为每题 4 条）；人工评价结论只在「一、评价总览」小节内解析且要求 ≥ 4 列（task-01/02/05/10 的中文结论恢复）；英文页历史 AI 评价改为明确标注 `Original Chinese verdict (not translated)`，不臆造英译。
- 新增门禁断言：`validate-data.mjs` 校验双语验收建议非空且长度一致、`expectedOutcome` 双语非空、评价结论双语非空、AI 评价必须带评分与评分方法；`tests/catalog.test.mjs` 新增同款用例，保留 15 tasks / 15 runs / 30 reviews 基线。
- 门禁实测：`import:data`、`validate:data`、`check`（0 errors / 0 warnings / 3 既有 hints）、`npm test`（3/3）、`build`（78 个生成页 + 17 个 HTML 成果，静态链接检查通过）全部通过。
- 浏览器验证：`test:e2e` 在 Chromium 与 WebKit 下全流程通过（搜索、英文详情直达、对比深链恢复、懒加载预览、390/768/1440 无横向溢出、Breakout 交互、PNG 下载、15/15 成果入口）。本机 Firefox 在 Playwright 下 `browser.newPage: Target crashed`（沙箱环境限制，非代码问题），三浏览器全套待 CI 或容器复跑。
- 产物核对（dist 实测）：`/en/tasks/task-01|06|15/` 验收建议各 4 条；`/zh/runs/…task-01|02|05|10-r1/` 人工评价标题分别为「通过 · 细节待改进 / 通过 · 存在疑点 / 通过 · 有瑕疵 / 通过 · 有 BUG」；`/en/runs/…task-01-r1/` AI 评价显示「Original Chinese verdict (not translated): 直接通过」。
- 发布状态：**未推送**。本次执行环境无法访问 `github.com`（`api.github.com` 可达、`github.com` 连接超时，`git push`/`git ls-remote` 均挂起），因此提交、回退标签与线上核验待网络可达后执行。本地已创建回退标签 `website-rollback-20260909-dba1c39`（指向上一成功部署 `dba1c39`，Actions run 34321767657）。

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

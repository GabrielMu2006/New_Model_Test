# M5/M7 验证记录 / Verification record

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

扩展演练使用 `website/tests/fixtures/extension-catalog.json`，第二模型、重复运行、新任务和第二阶段均未进入生产 `catalog.json` 或 `dist`。

远端 Actions run `34300161938` 首次部署成功；匿名访问根路径、中文/英文首页、task-06 详情、对比查询和 task-14 多页资源均返回 HTTP 200。GitHub Pages 返回的实际公网地址为 `https://gabrielmu2006.cn/New_Model_Test/`。

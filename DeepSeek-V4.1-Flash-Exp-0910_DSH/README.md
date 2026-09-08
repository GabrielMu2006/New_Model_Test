# DeepSeek-V4.1-Flash-Exp-0910_DSH

DeepSeek-V4.1-Flash-Exp-0910 模型评测任务归档，共 **15 个项目 / 193 个项目文件**，
另含 `Reviews/` 评测复盘报告。每个 `task-NN-*` 子目录都是一个独立、自包含的交付物，
目录内 `README.md` 为该项目的详细说明。

| 统计 | 值 |
| --- | --- |
| 项目数 | 15（task-01 … task-15，序号连续无重号） |
| 项目文件数 | 193（另有本索引 `README.md` 与 `Reviews/` 报告） |
| 总大小 | 约 36 MB |
| 外部依赖 | 全部为零依赖（无 npm 包、无 CDN、无外部图片/字体） |

---

## 目录一览

| # | 目录 | 项目 | 交付物 | 打开 / 运行 |
| --- | --- | --- | --- | --- |
| 01 | `task-01-aevum-luxury-watch-landing-page` | Aevum 奢侈腕表品牌落地页 | `index.html` | 双击 `index.html` |
| 02 | `task-02-pelican-on-bicycle` | 骑自行车的鹈鹕 | `pelican-on-bicycle.svg` | 双击 SVG |
| 03 | `task-03-analog-clock-6-25` | 模拟时钟 6:25 | `clock-625.svg` | 双击 SVG |
| 04 | `task-04-analog-clock-11-52-30` | 模拟时钟 11:52:30 | `clock-11-52-30.svg` | 双击 SVG |
| 05 | `task-05-bicycle-rider` | 骑车的人 | `bicycle_rider.svg` | 双击 SVG |
| 06 | `task-06-scissors-cutting-paper` | 剪刀剪纸 | `scissors_cutting_paper.svg` | 双击 SVG |
| 07 | `task-07-pushing-wheelbarrow` | 推独轮车 | `pushing_wheelbarrow.svg` | 双击 SVG |
| 08 | `task-08-breakout-game` | 霓虹打砖块（Breakout） | `index.html` | 双击 `index.html` |
| 09 | `task-09-topdown-farming-game` | 山谷农场（Harvest Hollow） | `index.html` | 双击 `index.html` |
| 10 | `task-10-pixel-art-editor` | 像素画编辑器 | `index.html` | 双击 `index.html` |
| 11 | `task-11-floor-plan-editor` | 2D 户型图编辑器 | `index.html` | 双击 `index.html`；`npm test` |
| 12 | `task-12-calculator` | 计算器（引擎 + UI） | `index.html` | 双击 `index.html`；`npm start` / `npm test` |
| 13 | `task-13-weather-dashboard` | Skylight 天气仪表盘 | `index.html` | 双击 `index.html`；`npm start` / `npm test` |
| 14 | `task-14-bank-website` | Meridian Bank 多页银行网站 | 9 个 HTML 页面 | 双击 `index.html`；`npm run verify` |
| 15 | `task-15-book-tracker` | Shelf 读书追踪 | `index.html` | 双击 `index.html`；`npm start` / `npm test` |

---

## 评测复盘（`Reviews/`）

| 文件 | 内容 |
| --- | --- |
| `Reviews/DeepSeek-V4.1-Flash-Exp-0910-任务评测复盘.md` | 15 项任务逐项统计：输入 prompt 原文、完成时长、token 用量（输入 / 输出 / 缓存读）、API 调用次数、**工具调用次数与工具构成**、失败重试、任务↔会话映射及总数对账；含金额开销 |
| `Reviews/Personal_Review.md` | 15 项任务的**人工评价**汇总（总览表 + 逐条原文 + 共性反馈），由纯文本记录 `Personal_Review` 整理而来 |

数据来源为 DSH 会话日志（`~/.dsh/sessions/`，只读提取，未修改任何会话文件），
统计口径详见报告内「六、统计口径」章节。

---

## 分组说明

**纯 SVG 图形（02–07）** — 每个目录一个 `.svg`，零依赖，双击即看。

**单文件网页应用（01、08–10）** — 一个 `index.html` 承载全部 HTML/CSS/JS，
Canvas 2D + WebAudio 实现游戏与编辑器，双击即可运行。

**带测试的完整应用（11–15）** — 引擎与 UI 分层，含 Node 单元测试与真实浏览器
端到端测试：

| 目录 | 测试命令 | 说明 |
| --- | --- | --- |
| `task-11-floor-plan-editor` | `npm test` | 几何计算单元测试 |
| `task-12-calculator` | `npm test` / `npm run test:engine` | 198 条引擎断言 + 浏览器 E2E |
| `task-13-weather-dashboard` | `npm test` / `npm run verify` | 单元测试 + 截图 + 对比度 + 交互校验 |
| `task-14-bank-website` | `npm run verify` | 构建 + 49 条财务断言 + 73 项交互 + 审计 |
| `task-15-book-tracker` | `npm test` / `npm run test:engine` | 3,861 条引擎断言 + 浏览器 E2E |

以上项目均无需 `npm install`：没有依赖，Node 仅用于跑测试。

---

## 关于本次整理

1. **序号重排**：原目录存在重号 `task-12`（`calculator` 与 `weather-dashboard`）。
   现按交付顺序重排为连续的 01–15：

   | 原目录 | 现目录 |
   | --- | --- |
   | `task-12-weather-dashboard` | `task-13-weather-dashboard` |
   | `task-13-bank-website` | `task-14-bank-website` |
   | `task-14-book-tracker` | `task-15-book-tracker` |

   `task-12-calculator` 及 task-01–11 名称未变。

2. **路径检查**：所有脚本均使用 `__dirname` 或项目内相对路径，唯一的外部引用
   （`task-13-weather-dashboard/tools/*.js` 指向本机 npx 缓存中的 Playwright）
   与项目位置无关，因此整体移动不影响任何项目运行。已同步更新 README 中 3 处
   旧目录名引用。

3. **清理**：已删除根目录下 33 MB 的 `.chrome-probe`（Chrome 调试缓存，无项目
   引用）；同时修正了 task-01–07 README 中关于「根目录占位文件」的过时说明。

---

## 整理后回归验证

整理完成后已在新路径下实际跑通各项目测试，确认移动与重命名未破坏任何项目：

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| `task-11-floor-plan-editor` | `node run-tests.js` | 52 项浏览器检查通过，截图重新生成到新路径 |
| `task-12-calculator` | `node test-engine.js` | 198 项引擎断言通过 |
| `task-13-weather-dashboard` | `node run-tests.js` | 112 项断言通过 |
| `task-14-bank-website` | `node tests/finance.test.js` + `node build.js` | 49 项断言通过，9 个页面成功重建 |
| `task-15-book-tracker` | `node test-engine.js` | 3,861 项引擎断言通过 |

---

## 快速开始

```bash
cd DeepSeek-V4.1-Flash-Exp-0910_DSH

# 看一个单文件应用
open task-08-breakout-game/index.html

# 跑一个带测试的项目
cd task-12-calculator && npm test
```

# M5/M7 验证记录 / Verification record

## 2026-09-10 UI 改版：Digital Museum / 编辑出版物风格（设计规范落地）

- **触发与依据**：组织者给出设计稿与 `website/VibeTest Digital Museum UI Design Specification.md`（80 节），要求把展示站从深色「数据看板」改为「数字美术馆 + 编辑出版物 + 实验档案馆」。设计稿中的四个界面（首页、任务档案、运行档案、设计系统页）是视觉基准；本文只记录落地与验证，不改档案数据与评分口径。
- **设计令牌**：`website/src/styles/global.css` 全量重写。色板 Museum Canvas `#F1EFE9` / Paper `#FAF9F6` / Ink `#161616` / Muted Ink `#686661` / Hairline `#D8D5CE`，强调色 Museum Red `#E64132`、Archive Blue `#3454D1`、Muse Pink `#D55C88`、GPT Green `#2E7D5B`；圆角 4 / 6 / 8px；默认 `box-shadow: none`、Hover 仅 `0 8px 24px rgba(0,0,0,.05)`；动效 180–300ms ease-out；分隔线（1px hairline）取代大面积卡片容器。原来深色主题的发光渐变、玻璃拟态与霓虹强调色全部移除。
- **字体自托管**：Playfair Display（标题与数字，衬线）、Inter（界面）、JetBrains Mono（档案元信息）三个 latin 子集可变字体落在 `website/public/fonts/`（4 个 woff2，合计 162.4 KB），`src/styles/fonts.css` 提供 4 条 `@font-face`，SIL OFL 授权随文件保存为 `public/fonts/OFL.txt`。运行时不依赖任何第三方字体 CDN；中文按 `unicode-range` 回落到系统宋体/黑体（有意为之，不引入 CJK 子集）。
- **代码结构**：`AppPage.astro` 由 389 行单文件拆为路由 + `src/components/pages/` 十个页面组件（Home / TasksIndex / TaskDetail / RunDetail / ModelsIndex / ModelDetail / PhasesIndex / PhaseDetail / Compare / Methodology / NotFound）；新增 `src/lib/site.ts`（展览身份：ARCHIVE 001 / 2026、品牌语句、导航）、`src/lib/naming.ts`（统一编号 PHASE 01 · TASK 01 · WORK A · RUN 01.A.01 · MODEL M01，全部由既有数据推导）、`src/lib/labels.ts`（265 条双语展示文案）；新增组件 `ArtworkCard`、`ArtworkImage`、`ModelDots`，重写 `ArtifactPreview`、`RunRow`。
- **页面改版要点**（对应设计稿）：
  - **首页** = 展览入口页：品牌主标题 + 两行品牌核心语句 + 数字条（03 模型 / 02 阶段 / 55 运行 / 20-45 任务）+ 档案进度（含分母来源说明）+ 4 列精选作品展墙 + 当前展览 + 档案中的模型 + 最新归档 + 方法简介。精选作品由「归档顺序中每类任务的首件」推导，是排版选择而非排名。
  - **任务档案** = 藏品索引：**每道题只出现一张作品卡**（设计规范第 22 节，此前同题按模型重复三张），类型 / 模型 / 阶段三行极简 Chip（含计数、组内单选、组间 AND），下方为档案进度。
  - **任务详情** = 原始需求（默认收起、可展开全文）+ 三种解释（等宽等高、同一预览比例、缺模型的题目显示「尚未归档」而不是 N/A 或 0）+ 执行对比表（时长 / API / 工具 / 重试 / token / AI 评价，数字右对齐）+ 运行档案 + 相关任务。
  - **运行档案** = Museum Object Record：首屏作品预览与预览控件，下方依次为档案记录（RUN ID / 归档时间 / 运行时间 / 调用 / 重试 / tokens / harness / 归档提交）、人工评价、AI 评价（大号衬线分数）、默认折叠的技术记录、编号来源证据清单；右侧为档案摘要、本节导航与同题三作缩略图。
  - **模型 / 阶段 / 对比 / 方法**：模型页为艺术家档案（精选作品 → 档案统计 → 批次指标 → 阶段进度 → 快照 → 全部作品 → 运行历史表）；阶段页为展览季（进度条 + 作品墙 + 逐题记录）；对比页为并排作品 + 执行/评价对比表；方法页为图录论文版式（620–760px 阅读宽度、五条编号原则）。
  - **全站搜索**：页头改为 `⌕` 图标 + 命令面板（`/` 或 ⌘K 打开、Esc 关闭、↑↓ 选择、Enter 打开），索引在构建期生成（20 任务 + 3 模型 + 55 运行），无脚本时其余页面不受影响。
  - **移动端**：精选作品改横向展墙（80% 宽露出下一件）、三种解释改 Tab、运行页保持「标题 → 作品 → 模型 → 评价 → 元信息」顺序、页头 ☰ 折叠导航。
- **改版中发现并修复的三个展示层缺陷**：① `[hidden]` 被组件自身 `display`（`.artwork-card{display:flex}`）压过，导致任务筛选「隐藏」不生效——补 `[hidden]{display:none!important}`；② WebKit 为 `<option>` 生成比 `<select>` 更宽的内部盒，对比页 390px 溢出 +153px——按既有做法在 `.compare-controls` 上裁剪；③ 归档未生成封面的 HTML 运行此前会渲染裂图——改为档案标签占位（题号 + 类型），不再引出不存在的图片。
- **保留的既有约束（逐条复验）**：缺失值仍显示「未记录」（新增断言：第一阶段运行无 `startedAt/endedAt` 时归档时间显示未记录）；`suspected` 仍不外显；AI 均分仍只作概览且逐评委并列；时长仍 `M:SS` / `H:MM:SS`；`taskId@version` 才可比较；对比页 URL 契约（`?task=&left=&right=`）与语言切换保留查询参数不变；来源链接逐条绑定各自归档提交（1266/1266 通过）；成果仍按 `artifact.files` 显式清单发布；HTML 预览仍懒加载 + 沙箱 + 独立打开。
- **门禁实测（本机，Node 24.19.0）**：`import:data`、`validate:data`、`astro check`（**0 errors / 0 warnings / 0 hints**）、`npm test`（**26/26**）、`npm run build`（**174 页** + 43 个 HTML 成果；静态链接检查通过；源码链接 **1266/1266** 存在于其固定提交）、`E2E_BROWSERS=chromium,webkit npm run test:e2e` **通过**（55/55 成果入口）。本机 Firefox 仍按既有环境限制崩溃（`docs/known-issues.md`），由 CI 三浏览器覆盖。
- **新增 e2e 断言**（在原有覆盖之上）：一题一卡的展墙、三行 Chip 过滤与「选中唯一」、命令面板开关/分组/Esc、首页品牌标题与数字条与进度条无障碍名、三种解释等宽与「尚未归档」占位（且不含 N/A / 0）、展开完整需求、档案记录字段与归档时间「未记录」、技术记录默认折叠、来源证据清单、移动端横向展墙与 Tab 切换、移动端运行页「作品先于档案」的文档顺序。语言切换、对比恢复、404、溢出（390/768/1440）等原有断言全部保留。
- **视觉复核**：以 Chromium 截取 14 个视图状态（首页、任务档案、任务详情、运行档案、模型索引与模型页、阶段索引与阶段页、对比、方法、英文首页、390px 首页与运行页、768px 任务档案）逐张核对版式，控制台 **0 error**。
- **发布与公网核验**：见下方「本次改版发布记录」小节。

## 2026-09-10 收尾裁定：统一时长写法 + 关闭三项不再需要的待办

- **时长写法统一**（组织者要求）：展示层一律由 `metrics.durationSeconds` 格式化——≥1 小时 `H:MM:SS`，不足 1 小时 `M:SS`；归档自带的 `durationLabel`（「4分51秒」）**只作数据保留、不再参与渲染**，此前两种写法会在同一页内外并存。落点：`src/lib/format.ts` 新增 `runDuration()`，`AppPage.astro`（运行指标格、模型页运行格、阶段页逐题格、对比页数据岛）与 `RunRow.astro` 全部改用它；`tests/format.test.mjs` 新增用例（含「只有文本、没有秒数」时回落到原文不丢值），e2e 新增断言「运行页时长必须是 `M:SS`/`H:MM:SS`」且「页面不得出现 `N分N秒`」。实测：`dist/zh` 下 0 个页面仍渲染归档时长文本；`/zh/tasks/task-01/` 三个运行的累计用时为 `4:51` / `2:13` / `6:06`。
- **三项待办按组织者裁定关闭**（记入 `known-issues.md` 2.2 与 3.0）：
  1. **隔离/作弊检查证据未封存** —— 不再要求更严格的封存；档案仍如实记 `clean（组织者判定）`，且**诚实边界不变**：只能读作「在声明的渠道里没看到越界」，不得写成「无污染」「证明未作弊」。
  2. **独立盲评** —— 本项目不需要：本站是评测管理与公开展示环境，不以盲评为接入前提；现有评价一律标注作者与非盲评属性，并列展示、不合成排名。
  3. **GPT 批次的取证脚本** —— 组织者确认当时误删、不再追补。（该批即 GPT-5.6 Sol 在第一阶段 15 题上的运行；审查报告 `evidence/audit-2026-09-10.md` 本身仍随运行归档，页面照常链接，站内无缺口。）
- **明确不改的三项**：运行页证据只显示两条链接（`auditJson` / `isolationRules` / `evaluation` 有数据但不展示——不是展示重点）、对比页维持两条并排、对比页继续用 `replaceState` 写地址。
- 门禁实测（本机，Node 24.19.0）：`import:data`、`validate:data`、`check`（0 errors / 0 warnings / 1 hint）、`npm test`（**26/26**）、`build`（174 页 + 43 个 HTML 成果；静态链接检查与源码链接 **796/796** 全部通过）、`test:e2e` 在 Chromium + WebKit 通过（55/55 成果入口）。

## 2026-09-10 组织者对 7 项待定口径的裁定与实现（含 E2E 接入 CI）

- 组织者裁定（同日落实，`known-issues.md` 第 6 节逐条记录）：
  1. **`suspected` 不作外显标注**：运行页不再渲染「越界判定」行（状态只留在归档数据与审计报告），`contaminated` 仍标注；`docs/audit-method.md` 第 5 节的矛盾措辞删去并写明裁定；实现为 `contamination.ts` 的 `isWithheld` / `contaminationDisplay === 'withheld'`（`suspected` 优先于「遥测不可见」，避免与档案状态矛盾）。
  2. **模型索引页显示该模型 AI 阶段评估的简单均分**（并标注份数），模型页保留各评委逐份评分、口径与双语免责声明；均分只作概览、不得排序或做跨模型排名。`AGENTS.md` 与 `docs/result-interface.md` 的「不得合成排行榜」条款已同步为该例外。当前显示：DeepSeek `93.6/100（1）`、Muse `86.5/100（2）`、GPT `暂无阶段评估`。
  3. **首页信号卡改为真实覆盖率**：分子为已归档且有运行的任务数、分母为各阶段 `plannedTasks` 之和（`15 + 30 = 45`），当前 **20 / 45**；阶段列表与阶段页同样显示「已归档 / 计划」（phase-01 `15 / 15`、phase-02 `5 / 30`），`plannedTasksNote` 双语写明计划题数来源并由 `validate-data.mjs` 强制校验。
  4. **时长 ≥ 1 小时改用 `H:MM:SS`**（`2:18:02`、`5:24:18`），不足 1 小时仍为 `M:SS`；归档自带的 `durationLabel`（「4分51秒」）逐字保留；格式化函数移到可单测的 `src/lib/format.ts`，`tests/format.test.mjs` 覆盖 0/51/291/3540/3600/8282/11176/19458 秒与缺失值。
  5. **预览说明优先中文**：本站撰写的提示改为双语对象；归档 `submission.json` 的英文说明（GPT 批）在中文页配中文说明、英文页保留归档原文。当前 33 条双语 + 5 条归档中文，中文页无纯英文说明。
  6. **r2 结案**（组织者确认不再有重复运行）；**封面口径**写入 `docs/adding-results.md`（归档必须自带截图，或本地 `npm run capture:covers` 后提交，否则构建的静态链接检查会失败）。
  7. **E2E 接入 CI**：`website-check.yml` 与 `website-deploy.yml` 在 build 后 `npx playwright install --with-deps chromium firefox webkit` 并运行 `npm run test:e2e`（发布由浏览器流程把关）；带 `source_ref` 的回退路径跳过 e2e，避免紧急回退被测试挡住。E2E 新增断言：覆盖率、AI 均分、`H:MM:SS`、中文预览说明、运行页无「越界判定」行、阶段页覆盖率，并把阶段页纳入溢出面。
- **门禁在发布前的两次真实拦截**：① 首跑 `34457975259` 在 **Firefox** 上失败于我新加的断言——点击语言切换后立即读面板数量，没有等导航提交与数据岛脚本执行；**部署被跳过，线上未受影响**，随后改为 `waitForURL` + 面板 `waitFor`（提交 `a636a0f`）。② 发布前本机扫描发现新增的阶段页 `plannedTasksNote` 内嵌长路径导致 390px 溢出 +88px，补 `.page-heading small{overflow-wrap:anywhere}` 并把阶段页加入 e2e 溢出面。
- 门禁实测（本机，Node 24.19.0）：`import:data`（确定性，重跑与现有 `catalog.json` 一致）、`validate:data`（新增 `plannedTasks`/`plannedTasksNote`/双语 preview note 校验）、`check`（0 errors / 0 warnings / 1 hint）、`npm test`（**25/25**，新增 `format.test.mjs` 3 例与 `suspected` 不外显用例）、`build`（174 页 + 43 个 HTML 成果；静态链接检查通过；源码链接 **796/796** 存在于其固定提交）；全站溢出扫描 60 个「页面 × 宽度」× Chromium/WebKit **0 溢出**。
- 发布记录：提交 `6a72ba4`（裁定实现）与 `a636a0f`（E2E 断言竞态修复）推送 `main`；发布前创建不可变回退标签 `website-rollback-20260910-3a09830`（指向上一已成功部署且公网验证通过的提交 `3a09830`，Actions run `34455509095`）。Actions run `34458276965` 构建与 Pages 部署成功，**CI 内 e2e 在 chromium、firefox、webkit 三套浏览器全部通过**（首次留下 Firefox 的 CI 记录，「本机 Firefox 崩、待 CI 复跑」的旧缺口就此关闭）。
- 公网核验（2026-09-10，匿名 HTTPS）：`zh/index`、`zh/models/index`、`zh/phases/phase-02`、`zh/runs/…task-17-r1`、`zh/runs/run-gpt-5-6-sol-task-01-r1` 与本次构建产物**逐字节一致**；首页信号卡显示 `20 / 45`；模型索引显示 `AI 均分 93.6/100（1）`、`AI 均分 86.5/100（2）`、`暂无阶段评估`；`task-17` 运行页「越界判定」出现 **0** 次（归档数据仍记录 `suspected`，由单测与 e2e 断言守住）；首页批次时长显示 `2:18:02` / `3:06:16` / `1:16:46`，不足 1 小时的仍为 `25:45` / `45:02`。Chromium + WebKit 直连线上复核：Muse 模型页显示均分说明与两份逐评委评分、中文页预览说明为中文、对比页仍正确渲染且缺失值显示「未记录」、阶段页 390px 无溢出。

## 2026-09-10 全站缺陷排查与一轮修复（无争议项）

- 触发：用户要求「详细检查项目网页，找出 bug，先只汇报」。只读排查结论（全部在线上复现，线上与本地构建逐字节一致）：
  1. **36 个 GitHub 源码链接 404**（18 个不同目标）：`codex-v1` 的 15 份逐题评价 + 其阶段报告（页面固定在阶段提交 `b8d0235`，而该目录是后续提交 `cf9382f` 才入库的）、两批 phase-02 的 `README.md`（批次来源沿用了该模型**第一条运行**的提交，即 phase-01 的 `5776d3a`/`b8d0235`）。用 `git cat-file` 逐个核验 796 个 blob 链接得出；真实 GitHub 复核 `codex-v1/task-01.md@b8d0235` → 404，对照 `phase-01/README.md@b8d0235` → 200。
  2. **搜索/筛选失效**：任务列表 `data-search` 把模型名对象拼成 `[object object]`（`gpt`/`Muse`/`DeepSeek`/`task-12` 均 0 命中，占位文案却承诺可按模型搜索）；模型筛选下拉的每个选项同样渲染成 `[object Object]`。
  3. **「未记录」被写成 0 或留空**：对比页 `new Intl.NumberFormat().format(null)` → `0`（DeepSeek phase-02 的 `totalTokens: null` 显示「Token 过路量 0」）；对比页/任务页运行行/阶段页对缺失时长与 API 显示空白单元格（同卡片其它缺失值却显示「未记录」）；批次求和 `?? 0` 把 Muse phase-02 的 `apiCalls: null` 汇总成「API 0」。
  4. **页面标题**：110 个运行页 + 2 个首页标题为「模型评测档案 · 模型评测档案」（英文同理），6 个阶段页共用「阶段详情」。
  5. **横向溢出**：对比页在 390/768/1440 全部溢出（+206/+437/+145px，`<select>` 的 min-content 撑到 586px）；phase-02 的 5 个任务页在 390 溢出 +81px（长源码路径不可断行）。原 E2E 的溢出断言只跑 `/zh/` 首页，故长期漏检。
  6. **双语混排**：中文页显示英文指标名（`Duration`/`Input tokens` 等）、英文预览说明与英文评估免责声明；英文页专属的「原文为中文，未提供英译」出现在 **55 个中文页面**。
  7. 其余：首页批次卡片两行同名无法区分阶段；阶段页把未跑该阶段的模型计入模型数（phase-02 显示 3，实际 2）；对比页默认状态错误显示「当前任务只有一条真实运行记录」（实际 3 条），无效参数静默丢弃、`invalid` 文案从未渲染，切换任务会沿用陈旧 URL 参数；JSON 数据岛未转义（`</script>` 可截断，当前数据未触发）；`lineRange()` 找不到锚点文本时静默回落到文件末尾；人工评价 T 编号被假设等于题号（忽略总览表已有的 `task-NN` 列）；Muse phase-02 污染说明固定写「未发现越界」；404 页面无 favicon/导航；剪贴板失败无处理。
- 本轮修复（用户指示「先解决没有争议的问题」）：
  - **逐来源绑定提交**：新增 `review.commit` / `batch.commit` / `assessment.commit` 字段与 `entityCommit()` 解析；Muse phase-01 为每个评委目录登记归档提交（未登记即导入失败）；两批 phase-02 与 phase-01 的批次/评估各自绑定；`validate-data.mjs` 强制三者必须为 40 位 SHA。
  - **新增门禁 `npm run verify:sources`**（`scripts/verify-source-links.mjs`，接入 `build`）：解析 `dist` 里全部固定 GitHub blob 链接，逐个用 `git cat-file -e <commit>:<path>` 校验；浅克隆直接报错提示 `fetch-depth: 0`。两个 workflow 已改为 `fetch-depth: 0`。
  - **缺失值不再变成 0/空白**：批次求和改为「任一题缺失即 null」（muse-phase2/deepseek-phase2/gpt 三个适配器）；对比页数据岛改为构建期生成展示串（`未记录` 直接来自 `number()/duration()`），同时把数据岛从 155KB 缩到 22KB；`RunRow` 与阶段页时长补齐 `未记录` 兜底。
  - **展示与文案**：标题按「任务 → 模型 → 运行所属任务 → 阶段」解析，`SiteLayout` 不再重复品牌；中文页指标名/批次表/运行行/评估免责声明本地化；`translationNote` 仅英文页显示；首页批次卡片改用 `batch.label`；阶段页模型数按实际有运行的模型统计；对比页新增「请选择右侧运行」占位与无效参数提示，切换任务重读参数；404 页补 favicon 与入口；剪贴板失败退回显示链接。
  - **健壮性**：`jsonIsland()` 转义 `< > &` 与行分隔符（新增 `tests/serialize.test.mjs` 两个用例断言转义无损）；`lineRange()` 找不到锚点即抛错；人工评价的 T 编号→题号改为读取总览表权威列（两个 phase-01 适配器）；Muse phase-02 污染说明按 status 分支。
  - **E2E 覆盖补强**：新增语言切换（实体深链 + 对比页保留查询参数）、对比页刷新恢复、按模型名/任务 ID 搜索、类别筛选、404 页面，以及 6 类页面 × 390/768/1440 的溢出断言（原断言仅首页）。
- 门禁实测（Node 24.19.0，本机）：`import:data`（确定性，重跑与现有 `catalog.json` 一致）、`validate:data`、`check`（0 errors / 0 warnings / 1 hint）、`npm test`（**21/21**，新增 4 个用例）、`build`（174 页 + 43 个 HTML 成果，静态链接检查通过，**源码链接检查 796/796 全部存在于其固定提交**）、`test:e2e` 在 Chromium 与 WebKit 通过（55/55 成果入口）。本机 Firefox 仍为 `browser.newPage: Target crashed`（既有环境限制，待 CI 复跑）。
- 交叉核验：全站溢出扫描 132 个「页面 × 宽度」组合 **0 溢出**（修复前对比页任何宽度都溢出）；155 个页面控制台与失败请求 **0 错误**；线上站点与修复前构建逐字节一致，故上述缺陷均已存在于生产。
- 未处理项（需组织者决定，已记入 `known-issues.md` 第 6 节）：`suspected` 是否外显、模型列表显示哪个阶段评分、首页信号卡分母口径、时长格式、归档预览说明能否补译文、重复运行在任务网格的呈现、封面脚本接入方式。
- 发布记录：修复提交 `8a9feb4` 推送 `main`；发布前创建不可变回退标签 `website-rollback-20260910-e699c95`，指向最近一次已成功部署且公网验证通过的提交 `e699c95`（Actions run `34449096652`）。本次 Actions run `34455303339` 构建与 Pages 部署成功（CI 内跑通 `npm run build`，含新增的源码链接提交级校验——浅克隆会在该步报错，两个 workflow 已设 `fetch-depth: 0`）。
- 公网核验（2026-09-10，匿名 HTTPS）：`/`、`/zh/`、`/en/`、`/zh/tasks/`、`/zh/tasks/task-16/`、对比深链、`/zh/runs/run-muse-spark-1-3-task-06-r1/`、`/en/runs/run-gpt-5-6-sol-task-01-r1/`、`/zh/phases/phase-02/`、`/zh/models/muse-spark-1-3/`、`/zh/methodology/`、成果入口均 200；未知运行路径返回 404 并显示新的 404 页（含入口链接）。线上 `zh/compare`、`zh/tasks/task-16`、`zh/runs/…task-06-r1`、`zh/models/muse-spark-1-3`、`zh/index` 与本次构建产物**逐字节一致**。
- 公网行为复核（Chromium + WebKit 直连线上）：对比页在 390/768/1440 **无横向溢出**且显示「Token 过路量 未记录」（修复前为 0）、默认右侧面板显示「请选择右侧运行以开始对比」；任务列表按「Muse」搜索命中且仅命中 `muse-spark-1-3`；模型下拉显示三个模型名（修复前为 `[object Object]`）；中文运行页不再出现英文专属的「原文为中文，未提供英译」。修复前 404 的三个源码链接（`codex-v1` 逐题评价、两批 phase-02 的 `README.md`）在 github.com 实测返回 **200**。

## 2026-09-10 测试工作区规则：禁止提交与网站改动

- 组织者要求：在测试工作区的规则文件里提醒**不要进行提交与网站修改**。
- 落点：`test-workspace/AGENTS.md` 新增**第 9 节「不要提交、不要动网站」**并在头部加一行特别提醒；`test-workspace/README.md` 的**第 7 节禁止事项**新增两条（禁止提交/推送/发布/重跑 Actions/改 DNS·Pages·CNAME·CI；禁止修改 `website/` 与手工编辑 `website/data/catalog.json`），第 0 节步骤 3 补「**不提交、不改网站**，交给维护者」，第 8 节快速检查清单补一条「未提交、未推送、未改网站」。
- 分工（避免与既有流程矛盾）：**被测会话**当前目录之外一律不可读写（第 1–2 节已覆盖，第 9.2 节再次点明）；**组织会话**仍可按 README 第 3 步归档到 `Test_Results/<模型>/phase-NN/task-NN-<slug>/`、写 `SUMMARY.md`、更新阶段 README 与 `docs/source-audit.md`、`docs/verification.md`，但提交、推送、网站接入与发布一律交给维护者。
- 同步：`test-workspace-2/`、`test-workspace-3/`（均在 `.gitignore` 内）同步为同一文本；顺手把这两份手册里落后的 5 处**扁平布局**与**无遥测规则**文本补齐（第 4/5/8 节；`AGENTS.md` 第 1–9 节与 README 第 5、7、8 节三份已用 `cmp` 校验一致）。
- 发布：`test-workspace/**` 不在 `website-deploy.yml` 的触发路径内，本次改动不触发网站部署；提交后未产生新的 Actions 运行。

## 2026-09-10 接入全部现有结果与评价（GPT-5.6 Sol 第一阶段 + DeepSeek phase-02 评价）

- 需求：把现有全部结果及其评价上传展示站。
- 盘点的差额：① **GPT-5.6 Sol 第一阶段 15 题**（第三个模型，归档已由另一会话提交 `a339d61`/`a5b0c7e`，但未接入网站）；② **DeepSeek phase-02 五题的评价**（评价者 Muse Spark 1.3，单文件汇总）；③ **GPT 的 AI 评价** `maintenance-agent-v3`（15 个逐题文件，当时未提交）。核查结果：`Test_Results/**/Reviews/` 下其余全部评价（DeepSeek phase-01 人工 + AI、Muse phase-01 人工 + 2 AI、Muse phase-02 AI）此前已上线。
- 评价拆分（组织者要求）：`muse-spark-v1` 原为 101 行单文件汇总，按新约定拆成 `Reviews/ai/muse-spark-v1/{README.md, phase-summary.md, task-16..20.md}`；**逐题正文逐字取自原稿、分数与结论未改写**，仅补齐 `reviewId`/`runId`/`本题得分`/`结论（中）`/`Conclusion (EN)` 元信息行；原稿逐字保留为 `source-summary.md`。原稿为中文，`Conclusion (EN)` 按仓库既有做法记「Original Chinese conclusion (not translated)」+ 原文，未臆造英译。分数：16=92、17=94、18=83、19=90、20=96，平均 **91.0/100**。
- GPT 接入：新增模型实体 `gpt-5-6-sol`（快照 `gpt-5.6-sol`，Codex CLI 0.147.0 / medium effort）与适配器 `gpt-5-6-sol-phase1.mjs`；该批**不产出 task 实体**（与另两个模型共用 `task-01…15@1`，重复定义会被编排器判为冲突），因此第一阶段同题现在**三模型可并排对比**。其 15 份 AI 评价（`maintenance-agent-v3`，平均 82.9/100，非盲评）随本次接入一并归档（原为未提交状态）。
- 校验/测试：新增 GPT 回归（15 run、必须挂在 phase-01 同题、`reportedModelId=gpt-5.6-sol`、恰好 1 份 AI 评价、有完整工具遥测故 `telemetry` 不得标 `hidden`）与 DeepSeek phase-02 拆分评价用例（评价者、路径、均值 91.0）；`fixture` 用例与 e2e 搜索卡片数改为**由实体推导**（不再写死 2 模型）。
- 数据：**3 模型 / 2 阶段 / 20 任务 / 55 运行 / 100 评价 / 5 批次 / 3 阶段评估**，**174 个生成页**（原 142）与 43 个 HTML 成果。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（**17/17**）、`build`（174 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，**55 个成果入口全部加载**。
- 发布与公网核验：提交 `9281576`（接入与评价归档）、`a9f43cb`（把 GPT 与 DeepSeek phase-02 的源链接重绑到承载其评价文件的提交）推送 `main`；回退标签 `website-rollback-20260910-f010c37`。Actions run `34448498115` 构建与 Pages 部署成功；匿名 HTTPS 复核首页、中英文、模型索引、`/zh/models/gpt-5-6-sol/`、GPT 与 DeepSeek phase-02 运行页、成果入口均返回 HTTP 200；线上实测 GPT 运行页显示「90/100」「维护 agent v3」「运行快照：gpt-5.6-sol」且恰好 1 张评价卡片，DeepSeek task-17 显示「94/100」「Muse Spark 1.3」；抽查 GitHub 源链接（GPT 评价、拆分后的 muse-spark-v1 评价、GPT 成果）均 200。
- 仍缺：Task 21–45 未测试；两批 phase-02 均**无人工评价**。（GPT 批次的取证脚本为临时件、已删除 —— 2026-09-10 组织者确认不再追补；该批的审查报告 `evidence/audit-2026-09-10.md` 仍随运行归档、页面照常链接。）

## 2026-09-10 无工具遥测的模型：默认视为遵守规则

- 决定（组织者 2026-09-10）：有的模型 / harness **不展示中间工具调用**（例如只回最终答案的 API）。这类运行，收尾审查的路径、命令、仓库查询、网络、读写越界、委派等维度**无从检查**，因此**默认视为遵守规则**，照常计入成绩。
- 边界（写死在文档里）：这是**默认规则、不是审查结论**——不得写成「未发现越界」「已审计」「clean」，只能写「工具调用不可见 · 默认视为遵守规则」；报告必须同时列出**未覆盖维度**与**本次仍做过的检查**（题目 SHA-256 是否一致、成果是否内嵌外部资源或外链、最终回答是否暴露外部来源）。
- 落点：`docs/audit-method.md` 新增 **4.0 遥测可见性**判定表（`visible` / `partial` / `hidden` / 「本应存在却缺失」四种，后者仍判证据不完整）与第 5 节新增「默认视为遵守规则」档；§1 输入物区分「本应存在却缺失」与「本来就没有遥测」；§6 JSON 增加 `telemetry` 与 `uncheckedDimensions`；§8 已知局限同步。根 `AGENTS.md`、`docs/testing-protocol.md` 第 8 节统计口径、`docs/result-interface.md` 污染字段、`test-workspace/README.md` 第 4 节、`docs/known-issues.md` 4.4 同步。
- 展示与校验：新增 `website/src/lib/contamination.ts`（纯函数 `telemetryOf` / `isAssumedCompliant` / `contaminationDisplay`，无 Astro 依赖，便于单测）；运行页在 `telemetry: hidden` 且未被确认作弊时显示「工具调用不可见 · 默认视为遵守规则」+ 说明，中文与英文各一套文案；`validate-data.mjs` 校验 `telemetry` 枚举，并要求 `hidden` 的运行在 `contamination.note` 中写明该规则。已确认作弊（`contaminated`）即使遥测不可见**仍然标注**。
- 测试：新增 `website/tests/contamination.test.mjs` 3 个用例（未声明按 visible、hidden 默认遵守且不写成审查结论、contaminated 不被默认豁免）。`npm test` **15/15** 通过。
- 现有数据不受影响：当前 40 条运行全部有完整会话日志（`telemetry` 缺省 = `visible`），线上抽查仍显示「未发现越界（已声明范围内通过检查）」（Muse phase-02）与「存在越界尝试，未取得内容 · 不影响成绩」（DeepSeek task-17）。
- 门禁与发布：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（15/15）、`build`（142 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，40 个成果入口全部加载。提交 `…` 推送 `main`；回退标签 `website-rollback-20260910-f352a55`；Actions run `34444220484` 构建与 Pages 部署成功，匿名 HTTPS 复核首页与中英文运行页均返回 HTTP 200。
- 未覆盖：本次没有任何 `telemetry: hidden` 的真实运行，因此该展示分支只有单元测试覆盖，未在真实数据上验证；首个此类模型接入时须按 4.0 记录未覆盖维度。

## 2026-09-10 归档布局改为扁平 task-NN-<slug>/，并明确评价目录接口

- 组织者决定：`Test_Results/<模型>/phase-NN/` 下不再套 `runs/<run-id>/`，改用与第一阶段一致的扁平 `task-NN-<slug>/`（两个模型同题同名 slug）；`runId` 保留在 `submission.json` 内，**不再作目录名**。同一题的重复运行（r2 及以后）才放 `runs/<新run-id>/`，用 `runRelation.parentRunId` 关联首次运行。
- 迁移：DeepSeek 与 Muse 的 phase-02 各 5 个运行目录用 `git mv` 平移到 `task-16-animated-pelican-bicycle/` … `task-20-2d-mechanical-linkage-designer/`（提交 `6c089e5`，git 识别为 rename，历史保留）；Muse 的 5 份逐题评价从 `runs/<run-id>/reviews/` 移到阶段级 `Reviews/ai/maintenance-agent-v2/task-NN.md`。
- **评价接口写入规则文件**：根 `AGENTS.md` 新增「归档布局与评价接口」小节；`docs/result-interface.md` 目录约定改为「扁平为默认」并新增「评价目录约定」——人工评价 `Reviews/Personal_Review.md`；AI 评价 `Reviews/ai/<评委>-v<N>/`（必备 `README.md` + `phase-summary.md`，推荐逐题 `task-NN.md`）；**新增评价只新建目录或递增版本号，不得覆盖既有评价，不同口径分数不得合成排行榜**。同步更新 `docs/adding-results.md`、`docs/audit-method.md`、`test-workspace/README.md` 第 5 节与 PLAN 模板、两个阶段 README、`Test_Results/README.md`、根 README 中英目录树。
- 补齐缺口：Muse 的 5 个任务目录此前没有 `README.md`，运行页「来源 ↗」链接指向不存在的文件；本次按 phase-01 约定补齐（含入口、指标、审查与评价链接、已知限制）。
- 修缺陷：`ArtifactPreview.astro` 调用 `sourceUrl()` 时未传 commit，回落到全局 `archiveCommit`（第一阶段提交），phase-02 运行的成果源链接实测 404。已改为传入该运行自己的 `artifact.commit`，并在 e2e 增加「运行页所有 GitHub 源码链接必须绑定自身归档提交」断言。
- 校验：`validate-data.mjs` 新增 `run.directory` 校验（必须形如 `Test_Results/<模型>/phase-NN/task-NN-<slug>` 或 `.../runs/<run-id>` 且真实存在）；`catalog.test.mjs` 断言 phase-02 目录为扁平命名且**不含 runId**；批次提交断言改为「批内唯一、批间可共享」（两个 phase-02 批次同在 `6c089e5`）。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（**12/12**）、`build`（142 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，**40 个成果入口全部加载**。
- 发布与公网核验：提交 `6c089e5`（布局迁移）、`ea99120`（源链接绑定新提交）、`f352a55`（成果源链接修复）推送 `main`；回退标签 `website-rollback-20260910-825f896`。Actions run `34439074086`、`34439221582` 构建与 Pages 部署成功；匿名 HTTPS 复核首页、中英文、模型页、阶段页、phase-02 双语运行页与成果入口均返回 HTTP 200。线上抽查 4 个运行页，源链接分别绑定 `6c089e5`（phase-02 两模型）、`b8d0235`（Muse phase-01）、`5776d3a`（DeepSeek phase-01，套用历史路径映射），**此前 404 的成果链接恢复 200**。
- 未变：runId 与既有公开 URL 不变；历史提交里的旧 `runs/<run-id>/` 路径保持原样（不可变提交下的历史路径不重写）。

## 2026-09-10 评价并接入 Muse Spark phase-02 前五题（Task 16–20）

- 需求：评价 Results 中 Muse 模型最新五项任务（Task 16–20）并上传到展示站。
- 评价（AI，**非盲评**，1 份/题）：`maintenance-agent-v2`（维护 agent，DeepSeek Harness），沿用 v1 的评分口径（需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10）：task-16 **85**、task-17 **88**、task-18 **88**、task-19 **88**、task-20 **92**，平均 **88.2/100**。归档：`Reviews/ai/maintenance-agent-v2/{README,phase-summary}.md` + `task-16.md` … `task-20.md`（**阶段级 Reviews，逐题文件命名 `task-NN.md`**）。
- 方法升级（v2 相对 v1）：组织者自建静态服务 + Chromium 无头渲染并驱动交互，做 canvas 级像素比对、读取应用自身读数、逐元素旋转角度差、并用关节坐标**复算连杆长度**；视觉维度由视觉桥接模型描述截图。**未运行成果自带脚本**；评价者本人不具备图像输入能力。
- 关键独立证据：task-17 在 1.5 s 内 29 个旋转元素中 14 顺 / 15 逆、角速度跨度 −179.3°/1.5 s 至 2.1°/1.5 s；task-18 暂停时 `#hudTime` 与 canvas 同时冻结、Step 0.5 s 恰好 +0.500 s、Reset 归零、8 阶段依次推进；task-19 暂停冻结模拟时钟（Day 38.7 → 38.7）而画布仍有约 0.3% 残余重绘、调速 20 → 300 天/秒不重置位置；task-20 22 次采样复算刚性连杆长度极差 **0.096–0.167 px**、暂停零变化、单步生效、Store → New → Recall 逐像素还原。5 题控制台错误均为 0、均无外部依赖。
- 取证归档：`Test_Results/Muse-Spark-1.3_Opencode/phase-02/evidence/evaluation-2026-09-10/`（4 个可复现脚本、4 份 checks JSON、17 张截图）。
- 接入：新增 `website/scripts/adapters/muse-spark-phase2.mjs` 并注册（共四个适配器）；以 `submission.json` 为唯一元数据来源、导入时校验 `prompt.txt` 的 SHA-256、从阶段级 `Reviews/ai/<评委>-vN/task-NN.md` 解析逐题评价；Muse 模型实体补充快照声明 `muse-spark-1.3-contributor-free`。索引变为 2 模型 / 2 阶段 / 20 任务 / **40 运行** / **80 评价** / 4 批次 / **142 页**（34 个 HTML 成果），task-16…20 现在两模型同题可并排对比。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（**12/12**）、`build`（142 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，**40 个成果入口全部加载**。
- 发布与公网核验：归档提交 `66aa028`、接入提交 `825f896` 推送 `main`；回退标签 `website-rollback-20260910-a255ed9`。Actions run `34438311121` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/muse-spark-1-3/`、`/zh/runs/run-muse-spark-1-3-xhigh-task-20-r1/`、task-16 的 DeepSeek↔Muse 对比深链与 Muse 的 SVG 成果入口均返回 HTTP 200；线上运行页实测显示「92/100」「维护 agent v2」「运行快照：muse-spark-1.3-contributor-free」且恰好 1 张评价卡片，模型页同时显示快照与两个批次。
- 必须标注的限制：评价由 AI 产出且**非盲评**，不构成网站独立证明；视觉维度依赖视觉桥接模型描述；未运行成果自带脚本，未做跨浏览器 / 跨视口 / 性能 / 长时间稳定性测量；隔离为策略级约束 + 事后审查；题目 Task 16–45 已公开；**人工评价仍未产出**。
- 并发说明：本次接入期间另有会话在评价 **DeepSeek** 的 phase-02 五题（`Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/Reviews/任务完成质量评估-muse-spark-v1.md`，截至本次提交仍未提交）；本次提交未包含该在途文件。下方「审查归档 Muse Spark phase-02 前五题」条目由该并发会话写入，随本次提交一并入库。

## 2026-09-10 审查归档 Muse Spark phase-02 前五题（Task 16–20）

- 范围：`test-workspace-3/phase-02/` 中 Task 16–20 五个被测会话（opencode，`muse-spark-1.3-contributor-free` / xhigh），首轮输入五题均与 `prompt.txt` 逐字一致。
- 审查：全量 238 次工具调用——全部读写路径在各自任务目录内，无 `..` 穿越、无跨任务/跨副本/`Test_Results`/`PROMPT`/`docs` 访问，无仓库查询、无对外网络；结论**未发现越界**（程序性备注记入审计档案：task-16 `ls /Applications` 环境探测、task-17/18/19 `/tmp` 自写校验脚本，均无外部内容流入）。
- 统计：时长 353/409/1433/134/373s；工具调用 20/32/145/7/34；工具级可恢复错误 0/1/3/0/0；任务失败 0。
- 校验：成果物零外部引用（SVG 命名空间除外）、SVG XML 解析通过；task-20 `node run_tests.js` 组织者独立复跑 **20/20 pass**；归档前后逐文件 SHA-256 全对。
- 归档：`Test_Results/Muse-Spark-1.3_Opencode/phase-02/`（`prompt.txt`、`artifacts/`、`evidence/`、`submission.json`）+ 阶段 README；当时放在 `runs/<run-id>/` 下，2026-09-10 已改为扁平 `task-NN-<slug>/`；工作区 `SUMMARY-tasks-16-20.md` 原样记录各题最后回答的明确 limit；`docs/source-audit.md` 新增 Muse Spark 批次小节。
- 未完成：Task 21–45 待测；网站导入、人工/AI 评价未做；`SUMMARY.md` 全量版待 30 题齐后写。

## 2026-09-10 模型身份合并：0910 实验版与正式版视为同一模型

- 决定（组织者 2026-09-10）：即将退役的 0910 实验版 `DeepSeek-V4.1-Flash-Exp-0910` 与随后发布的正式版 `DeepSeek-V4.1-Flash` 视为**同一个模型**，成绩同表记录。
- **稳定标识不动**：模型实体 id `deepseek-v4-1-flash-exp-0910`、全部 runId（`run-deepseek-v4-1-flash-exp-0910-task-NN-r1`）、模型页与运行页 URL、归档目录 `Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/`、以及历史档案正文（含 harness 报告的 model id）全部保持原样。
- 显示名改双语：`DeepSeek-V4.1-Flash（0910 实验版 + 正式版）` / `DeepSeek-V4.1-Flash (0910 preview + GA release)`。`name` 由字符串改为 `{zh, en}`，路由、首页卡片、任务卡片、运行页眉、模型页、对比下拉与对比面板均按 locale 取值（`AppPage.astro`、`RunRow.astro`、`catalog.ts`）。
- 新增**快照**维度：模型实体 `snapshots` 声明（0910 实验版=已退役，附 harness 报告值来源；正式版=id 待首次运行回填，不据品牌名推断）；`version` 置 `null` 并加 `versionNote`，不再用单一版本号把两个快照合并成一个未经验证的值。
- 逐运行记录快照：`run.environment.reportedModelId`——phase-02 的 5 条带入 `submission.json` 的 `deepseek-v4.1-flash-expires-on-0910`；phase-01 的 15 条归档未记录 model id，记 `null`，页面显示「未记录」。运行详情新增「运行快照」一行。
- 校验与测试：`validate-data.mjs` 新增模型名双语、快照声明（label/evidence 双语、status 枚举、id 去重）与「非空 `reportedModelId` 必须是该模型声明的快照」校验，并把「phase-02 必须记录快照」并入阶段回归；`catalog.test.mjs` 新增快照用例（11/11）；`e2e-smoke.mjs` 断言模型页列出两个快照与两个批次、运行页显示快照 id。
- **顺带修复缺陷**：`batchForModel()` 用 `find()` 只取第一个批次，导致该模型已有 20 条运行、模型页却只显示 Phase 1 的 15 题统计（线上可复现）。现改为 `batchesForModel()` 全部列出，模型卡片时长按全部批次求和。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（11/11）、`build`（132 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，35 个成果入口全部加载。
- 发布与公网核验：提交 `f3aef2c` 推送 `main`；回退标签 `website-rollback-20260910-e256f21` 指向上一已成功部署且公网验证通过的提交。Actions run `34435104348` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/`、`/zh/models/deepseek-v4-1-flash-exp-0910/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-16-r1/`、`/en/phases/phase-02/` 均返回 HTTP 200；线上模型页实测显示双语显示名、两个快照（`deepseek-v4.1-flash-expires-on-0910` 与「正式版（尚未运行）」）与两个批次块，运行页显示「运行快照：deepseek-v4.1-flash-expires-on-0910」。
- 后续约定：正式版运行采用 `run-deepseek-v4-1-flash-task-NN-rN`（runId slug 不必等于实体 id），归档仍在同一模型目录下；正式版首次运行后回填快照 id；**跨快照比较必须标明差异**。

## 2026-09-10 接入第二阶段 Task 16–20 到展示站

- 需求：把已归档的 5 个 Phase 2 项目（Task 16–20）上传到展示站。按 `docs/adding-results.md` 走完整接入流程，不以「文件已上传」代替验收。
- 归档首次入库（提交 `a9925d8`）：`Test_Results/DeepSeek-V4.1-Flash-Exp-0910_DSH/phase-02/`，含 5 个运行目录（当时为 `runs/<run-id>/`，2026-09-10 改为扁平 `task-NN-<slug>/`）、逐字 `prompt.txt`、`submission.json`、`evidence/`（收尾审查报告、隔离规则、会话日志 SHA-256）与阶段 README。接入前独立核对 **48 个成果文件与 5 个 `prompt.txt` 的 SHA-256**，与 `submission.json` 声明全部一致（不一致 0）。
- 导入层：新增 `website/scripts/adapters/deepseek-phase2.mjs` 并在编排器注册；以 `submission.json` 为唯一元数据来源，导入时交叉校验 `prompt.txt` 的 SHA-256（不一致即失败，题目不可被替换）；成果、隔离与越界状态原样带入，不在导入层改写。新增 `website/data/phases/phase-02.json`。
- 通用校验补强：阶段的 `taskVersions` 必须与目录中任务一一对应（新增不变量）；第一阶段 15 题 / 15 运行 / 30 评价的回归改为**按阶段收敛**（不再依赖 catalog 总量）；新增第二阶段单调回归（5 个已归档运行必须仍在，且必须记录 `isolation.level=workspace-only`、逐字 prompt 哈希与审查证据链接）。
- 页面补强：运行详情新增收尾审查证据链接（绑定该批次归档提交 `a9925d8…`）与补充轮逐字输入；无评价时显式显示「本运行暂无独立评价」，不留空白；越界尝试显示为「存在越界尝试，未取得内容 · 不影响成绩」；首页计数与任务类别文案不再写死第一阶段。
- 构建数据：2 模型 / 2 阶段 / 20 任务 / 35 运行 / 75 评价 / 3 批次 / 3 阶段评估，**132 个生成页**（由实体推导，原 110）与 30 个 HTML 成果；DeepSeek 模型页列出 20 条运行。
- 门禁：`import:data`、`validate:data`、`check`（0 errors）、`npm test`（10/10）、`build`（132 页，静态链接检查通过）全部通过；`test:e2e` 在 Chromium + WebKit 通过，**35 个成果入口全部加载**。本机 Firefox 在 Playwright 下 `browser.newPage: Target crashed`（既有环境限制，非本次改动）；e2e 新增 `E2E_BROWSERS` 开关，便于本地只跑可用浏览器，默认仍是三浏览器全套。
- 发布与公网核验：提交 `a88b331` 推送 `main`；回退标签 `website-rollback-20260910-78dcdf6` 指向上一已成功部署且公网验证通过的提交 `78dcdf6`。Actions run `34434388799` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/phases/phase-02/`、`/zh/tasks/task-16/`、`/zh/tasks/task-19/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-17-r1/`、`/en/runs/run-deepseek-v4-1-flash-exp-0910-task-20-r1/` 与两个成果入口（`pelican-bicycle.svg`、`index.html`）均返回 HTTP 200；线上运行页实测显示「越界判定：存在越界尝试，未取得内容 · 不影响成绩」「补充轮输入（逐字）：「不要再读取chrome钥匙串了」」「本运行暂无独立评价」，首页显示 `2 MODELS · 2 PHASES`。
- 必须随成绩一起标注的限制：隔离是**策略级约束 + 事后审查**，不是强制隔离、不表示「无污染」；题目 Task 16–45 已在公开仓库发布（`0540edf`）；第二阶段**尚无人工 / AI 评价，因此展示站不给分**；成果内测试结果均为作者自述，本次未在隔离环境复跑。
- 未完成项：Task 21–45 尚未测试；第二阶段评价待产出；同一运行挂多份 AI 评价的展示仍按 `docs/known-issues.md` 3.1 处理。

## 2026-09-10 越界处置口径：只标注，不排除成绩

- 组织者决定（2026-09-10）：**越界判定只影响标注，不影响成绩录入**。任何 run 都不因越界判定被排除、作废、重测或改写分数。
- 三档处置：① 未发现越界 → 无标注；② **越界尝试 / 有嫌疑**（有越界动作但 `tool/result` 未返回外部内容，或只有嫌疑、无证据）→ 只记入审计档案（`contamination.events`，状态可记 `suspected`），**不作外显标注、不排除、不改分**；③ **确认作弊成功**（实际读到他人答案 / 成果，或从仓库、网络取到题目相关内容）→ `status = contaminated`，**必须标注**「已确认获取外部答案」，且标注与成绩同处显示。
- 依据（组织者）：只有确实作弊成功才影响成绩的可信度；未遂与嫌疑属于过程事实，记在档案里即可，不改变成绩口径。
- 落点：`docs/audit-method.md` 第 5 节（新增三档处置表）与 4.11、`AGENTS.md`（「禁止作弊与隔离要求」「后续阶段与结果接入」两处）、`docs/testing-protocol.md` 第 8 节统计口径、`docs/known-issues.md`、`docs/result-interface.md` 污染行、`test-workspace/README.md` 第 4 节。原文中「排除出汇总」「建议作废该 run」的表述已全部清除。
- 既有档案同步：`test-workspace/phase-02/SUMMARY.md` 第 2 节改为「5 个 run 全部计入；排除数量 0 / 5；标注数量 0 / 5」——`task-17`、`task-20` 的「越界尝试，未取得内容」保留为上表与 `evidence/audit-2026-09-10.*` 的档案层记录，不再排除出汇总；`phase-02/PLAN.md` 第 7 节同步。这两份文件位于 `.gitignore` 覆盖的脚手架目录，随该阶段归档一并提交。
- 展示站对齐：run 页不再显示裸 `suspected` / `contaminated`——`suspected` 显示为「存在越界尝试，未取得内容 · 不影响成绩」，`contaminated` 显示为「已确认获取外部答案（标注）」，`unknown` 显示为「未判定」，字段名由「污染状态」改为「越界判定」（英文 `Boundary check`）。
- 门禁：`npm run import:data`、`validate:data`、`check`、`npm test`、`build` 全部通过（110 个生成页 / 26 个 HTML 成果，静态链接检查通过）。本次仅改文案与文档，未触及路由、交互、预览与比较，按 AGENTS.md 未跑 `test:e2e`。
- 发布记录：提交 `0f65778` 推送 `main`；回退标签 `website-rollback-20260910-453b6d3` 指向上一已成功部署且公网验证通过的提交 `453b6d3`。Actions run `34433597168` 构建与 Pages 部署成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/`、`/zh/tasks/task-01/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/` 均返回 HTTP 200，运行页实测渲染「越界判定：未判定」。

## 2026-09-10 建立并行测试副本（同时测多个模型）

- 需求：在不改动正在运行的 `test-workspace/`（其中 task-16～19 已有成果）的前提下，复制出两份工作区，用于同时测试多个模型。
- 产物：`test-workspace-2/`、`test-workspace-3/`（各 **5 个文件**）。每份只有**框架**：`AGENTS.md`（被测规则）、`README.md`（组织手册）、`_templates/`（`PLAN.template.md`、`task-AGENTS.md`、`submission.template.json`）。
- **不预置内容**：两个副本**没有** `phase-NN/` 目录、没有题目、没有 `prompt.txt`、没有模型、没有成果。测哪个阶段、哪些题、哪个模型，由组织 agent 在步骤 0 询问用户后按 `_templates/` **现场生成**，避免把不相干的题带进工作区（用户 2026-09-10 指出）。
- 修正记录：初版复制曾一并带入 `phase-02/` 的 30 个任务目录（`AGENTS.md` + `prompt.txt`）与 `_tools/set-model.mjs`，假定副本用于第二阶段；该假设不成立，已删除并重建为纯框架（`phase-02/`、`_tools/` 均已移除）。提交 `642525b`、`2c3d730` 记录的是初版状态，本条为修正后的实际状态。
- 规则可比性：副本 `AGENTS.md` 的第 1–8 节与 `test-workspace/AGENTS.md` **逐字相同**（`sed -n '/^## 1\./,$p'` 后 `cmp` 通过），只替换了路径头部（`test-workspace-2/README.md` 等）。三个工作区的规则文本一致，便于成绩横向比较。
- 生成方式：副本 `README.md` 的步骤 0 写明「询问用户 phase / 题目范围 / 模型标识 / harness / 预算（**不问隔离方案**）」，步骤 1 用 `_templates/` 生成 `phase-NN/task-NN-<slug>/` 与 `PLAN.md`，`runId` 直接用确认后的模型 slug 写入，不留占位符。
- 审计补强：`docs/audit-method.md` 新增 **4.11 同题并行副本（多副本并行时必查项）**（`checkedDimensions` 增加 `"siblingWorkspaces"`），`docs/testing-protocol.md` 第 8 节新增并行副本小节。理由是副本让同阶段成果可能就在隔壁，读取其他副本即记越界。
- `.gitignore` 增加 `test-workspace-*/`：副本整份不入库，成果仍须归档到 `Test_Results/` 后提交。`test-workspace/` 未做任何改动（只读复制）。
- 发布记录：提交 `642525b`（副本 + 文档）、`2c3d730`（验证记录）推送 `main`；发布前创建并推送不可变回退标签 `website-rollback-20260910-400c3cf`，指向上一已成功部署且公网验证通过的提交 `400c3cf`（本次为纯文档 + `.gitignore` 变更，站点内容无变化）。
- 门禁与公网核验：本次为纯文档变更，按 AGENTS.md 只检查目录、链接与命令——`docs/audit-method.md`、`docs/testing-protocol.md` 相对链接 2 条全部存在。Actions run `34429384337` 与 `34429518862` 构建与 Pages 部署均成功；匿名 HTTPS 复核 `/`、`/en/`、`/zh/models/`、`/zh/phases/phase-01/`、`/zh/tasks/task-01/`、`/zh/runs/run-deepseek-v4-1-flash-exp-0910-task-01-r1/`、`/en/compare/?runs=…task-01-r1` 均返回 HTTP 200，模型页仍显示 DeepSeek-V4.1-Flash-Exp-0910 与 Muse Spark 1.3 两个模型。

## 2026-09-09 归档 Codex 的 Muse 评价并接入网站（第二份 AI 评价）

- 来源：Codex Desktop 0.153.4 / GPT-5 于 2026-09-09 写出的 `Reviews/15-任务完成质量评估.md`（综合 88.1/100，含 Chromium 实际渲染复验）。内容未改动，按既定接口归档为 `Reviews/ai/codex-v1/`（阶段总评 + 每题一条），并补齐 `README.md` 元信息。
- 接口通用化：Muse 适配器改为遍历 `Reviews/ai/<评委>-vN/`，从每个评委目录的 README 与逐题文件解析元信息、分数与双语结论；两份评价（维护 agent v1 84.9、codex-v1 88.1）作为**并列的 AI 评价**挂在同一个运行上，不做平均或排名。`maintenance-agent-v1` 的逐题文件补上 `结论（中）` 与 `Conclusion (EN)` 行以统一接口。
- 数据结果：2 模型 / 15 任务 / 30 运行 / **75 评价**（DeepSeek 30 + Muse 45：每题 1 人工 + 2 AI）/ 2 批次 / **3 阶段评估**；页面仍为 110。
- 门禁：import、validate（含 Muse「每运行 1 人工 + 每个已归档 AI 评委各一条」校验）、check（0 errors）、`npm test`（9/9）、build 全部通过；e2e 在 Chromium 与 WebKit 通过，Muse 运行页断言改为「3 条评价」并针对维护 agent 卡片校验 Markdown 列表/行内代码渲染与 HTML 转义。
- 分数解析修正：`82/100` 这类文本此前被拼成 `82100`，已改为只取分子；模型页现显示两份阶段评估（88.1 / 84.9）。
- 发布与公网核验：见下条「Codex 评价接入发布记录」。

## 2026-09-09 Muse Spark 网站接入（多模型 / 同阶段）

- 导入层重构：`scripts/import-data.mjs` 改为编排器 + 两个显式注册的批次适配器（`adapters/deepseek-phase1.mjs`、`adapters/muse-spark-phase1.mjs`）；新增 `batches`、`assessments` 实体；catalog `schemaVersion` 升到 2。DeepSeek 实体逐字段回归比对：**0 处语义差异**。
- 数据结果：2 模型 / 1 阶段 / 15 任务 / 30 运行 / 60 评价（每个运行 1 人工 + 1 AI）/ 2 批次 / 2 阶段评估；页面 110 个（由实体推导，原 78）。
- 页面与查询：首页计数与批次统计、模型列表/详情、阶段详情、任务详情（列出全部运行）、运行详情（逐字输入 + 隔离/污染 + 多条评价）、对比页（同题两模型并排）、方法页（两批批次表 + 两份评估并列）全部按数据生成。
- 历史层：每条运行绑定自己的 `artifact.commit`；`sourcePathMappings` 增加 commit 维度，仅第一阶段迁移路径套用映射。
- 门禁：`import:data`、`validate:data`（2 模型/15 任务/30 运行/60 评价/2 批次/2 评估，含首批 15/15/30 回归）、`check`（0 errors / 0 warnings / 1 hint）、`npm test`（5/5）、`build`（110 页 + 26 个 HTML 成果，静态链接检查通过）全部通过。
- 浏览器验证：`test:e2e` 在 Chromium 与 WebKit 通过——任务搜索命中两模型、模型筛选收敛、英文详情直达、双语验收建议、同题双运行对比恢复、懒加载预览、Muse 运行页两条评价 + 隔离/污染/事后补录标注、390/768/1440 无横向溢出、30/30 成果入口加载；Muse 计算器（ES module）经 HTTP 服务计算 1+2=3 正确。本机 Firefox 仍因沙箱 `Target crashed` 未纳入，需 CI 或容器复跑。
- 封面：新增 `scripts/capture-covers.mjs`（手动运行，不入 CI），为 9 个 Muse HTML 成果生成封面图并入库；SVG 成果直接渲染，无需封面。
- 评价正文改为 Markdown 渲染：新增 `src/lib/markdown.ts`（先转义再解析，不引入新依赖），支持段落/列表/粗体/斜体/行内代码/链接/引用/标题；链接仅允许 http(s)、mailto 与相对路径。单元测试覆盖渲染、HTML 转义与链接白名单（`tests/markdown.test.mjs`，Node 原生类型剥离直接导入 .ts），e2e 增加「AI 评价列表与行内代码已渲染、原始 HTML 未被注入」断言。
- 发布记录：提交 `28c4af8` 已推送 `main`；Actions run `34338087847` 构建与 Pages 部署成功。发布前创建并推送回退标签 `website-rollback-20260909-405a957`（指向上一成功部署提交 `405a957`，run 34337020609）。
- 公网核验（2026-09-09，匿名 HTTPS）：`/zh/`、`/en/`、`/zh/models/`、`/zh/models/muse-spark-1-3/`、`/zh/runs/run-muse-spark-1-3-task-06-r1/`、`/zh/compare/?task=task-06&left=<DeepSeek>&right=<Muse>`、`/zh/methodology/`、`/artifacts/run-muse-spark-1-3-task-12-r1/index.html` 及第一阶段运行页均返回 200。首页含两个模型与 `2 MODELS`、`12 SVG / 18 HTML`；Muse 运行页含「事后补录」「workspace-only」「73/100」与两类评价。

## 2026-09-09 展示站数据缺陷修复（known-issues 1.1–1.4）

- 修复 `website/scripts/import-data.mjs`：`bilingualList()` 同时接受全角 `：` 与半角 `:`（英文验收建议由 0 条恢复为每题 4 条）；人工评价结论只在「一、评价总览」小节内解析且要求 ≥ 4 列（task-01/02/05/10 的中文结论恢复）；英文页历史 AI 评价改为明确标注 `Original Chinese verdict (not translated)`，不臆造英译。
- 新增门禁断言：`validate-data.mjs` 校验双语验收建议非空且长度一致、`expectedOutcome` 双语非空、评价结论双语非空、AI 评价必须带评分与评分方法；`tests/catalog.test.mjs` 新增同款用例，保留 15 tasks / 15 runs / 30 reviews 基线。
- 门禁实测：`import:data`、`validate:data`、`check`（0 errors / 0 warnings / 3 既有 hints）、`npm test`（3/3）、`build`（78 个生成页 + 17 个 HTML 成果，静态链接检查通过）全部通过。
- 浏览器验证：`test:e2e` 在 Chromium 与 WebKit 下全流程通过（搜索、英文详情直达、对比深链恢复、懒加载预览、390/768/1440 无横向溢出、Breakout 交互、PNG 下载、15/15 成果入口）。本机 Firefox 在 Playwright 下 `browser.newPage: Target crashed`（沙箱环境限制，非代码问题），三浏览器全套待 CI 或容器复跑。
- 产物核对（dist 实测）：`/en/tasks/task-01|06|15/` 验收建议各 4 条；`/zh/runs/…task-01|02|05|10-r1/` 人工评价标题分别为「通过 · 细节待改进 / 通过 · 存在疑点 / 通过 · 有瑕疵 / 通过 · 有 BUG」；`/en/runs/…task-01-r1/` AI 评价显示「Original Chinese verdict (not translated): 直接通过」。
- 发布记录：提交 `51f497c`（缺陷修复）与 `6446a98`（测试脚手架与隔离文档）已推送 `main`；Actions run `34335478066` 构建与 Pages 部署成功。发布前创建并推送回退标签 `website-rollback-20260909-dba1c39`，指向上一成功部署提交 `dba1c39`（Actions run 34321767657）。
- 公网核验（2026-09-09，匿名 HTTPS，带缓存绕过）：`/en/tasks/task-01|06|15/` 验收建议各 4 条（修复前为空）；`/zh/runs/…task-01|02|05|10-r1/` 人工评价标题分别为「通过 · 细节待改进 / 通过 · 存在疑点 / 通过 · 有瑕疵 / 通过 · 有 BUG」（修复前为空）；`/en/runs/…task-01-r1/` AI 评价显示「Original Chinese verdict (not translated): 直接通过」。均返回 HTTP 200。

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

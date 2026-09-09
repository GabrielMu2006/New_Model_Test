# Muse-Spark-1.3 · 15 项任务评测复盘

> **数据来源**：opencode 会话日志（`~/.local/share/opencode/opencode.db`，SQLite，只读查询，未修改任何会话文件）
> **提取方式**：按 `session.directory` 定位 phase-01 的 15 个任务会话，`session` 表取起止时间与 token，`part` 表（`type='tool'`）取工具调用构成与失败数，`message` 表（`role='assistant'`）计 API 调用
> **覆盖范围**：15 个评测任务 / 15 个执行会话（严格一对一，无多任务会话）
> **统计口径**：整会话即整任务（任务会话内无收尾追问轮）；prompt 原文按要求省略不收录
> **模型**：`muse-spark-1.3-contributor-free`（`providerID=opencode`，`variant=xhigh`），15 个任务会话模型一致

---

## 零、模型与框架介绍

### 模型：Muse Spark 1.3（本次为 contributor-free 档）

- **归属与发布**：Meta Superintelligence Labs（MSL）旗下的 Muse 系列主力模型，1.3 版于 2026-09-02 发布（1.1 于 7 月、1.2 于 8 月，约月更一次）。
- **定位**：长程 agentic + coding 模型，强调复杂指令遵循、多工作流并行、长线程协作与缺口自纠；官方称相对 1.2“必要时更少 turns、更少废话、代码风格更干净”，内部口径约省 20% 工具调用 / 25% token（第三方实测因负载而异，仅供参考）。
- **上下文与模态**：1M token 上下文；输入支持文本 / 图像 / 视频（AI Gateway、LiteLLM 同时标称支持 PDF 输入）。
- **推理档位**：`minimal / low / medium / high / xhigh`，再往上的 `max` 当时仅限合作伙伴预览（待补安全测试）；本次 15 个会话统一为 `xhigh`，即公开发布时的最高可用档。
- **跑分参考**（Artificial Analysis Intelligence Index）：1.3（xhigh）61 分，与 GPT-5.6 Sol（max）、Grok 4.6（high）持平；1.3（max）62 分，仅次于 Claude Fable 5.1 / Opus 5。`max` 在 Tau3-Bench Banking、GDPval-AA v2 上更高，但本次不可用。
- **价格**：标准档 $1.25 / $4.25 每百万输入 / 输出 token（缓存命中 $0.15），与 1.2 持平；Contributor 档 $0.10 / $0.20（缓存 $0.002），代价是输入输出可被 Meta 用于训练。本次走 opencode 的 `muse-spark-1.3-contributor-free`（`providerID=opencode`，`variant=xhigh`），日志 `cost` 全为 0，第八节金额记 ¥0 / $0。
- **本次标识**：`{"id":"muse-spark-1.3-contributor-free","providerID":"opencode","variant":"xhigh"}`，15 个任务会话完全一致，无混用模型。

### 框架：opencode

- **是什么**：开源 AI 编程 agent（`anomalyco/opencode`），以终端 TUI 为主，也可跑桌面 App / IDE 插件；通过接不同 LLM provider 来干活，本次 provider 即 opencode 自带的 Muse Spark 通道。
- **本次版本与运行方式**：`session.version = 1.18.29`；每个任务开一个独立会话，工作目录均为 `…/Muse-Spark-1.3_Opencode/phase-01`（`session.directory`），`agent=build`；`phase-01/opencode.json` 设 `permission.external_directory: deny`，客观上锁死跨目录读取。
- **会话日志**：全量存在 `~/.local/share/opencode/opencode.db`（SQLite）：`session` 表存起止时间与 token/`cost`，`message` 表（`role='assistant'`）计 API 调用，`part` 表（`type='tool'`，`tool/state.status`）计工具调用与失败。本报告即只读查询这三张表得出，不涉及 prompt 原文收录。
- **工具集**：本次实际命中的只有 `read / write / edit / bash / todowrite / glob / vision / ocr` 8 种；`bash` 承担本地校验（`node --check`、XML/HTML 解析、`http.server + curl localhost`、Chrome headless 截自己的图），`vision/ocr` 为截图自检通道（本次 8 次失败均出自该通道，见第四节）。

---

## 一、总览

| 指标 | 数值 |
| --- | --- |
| 任务数 | 15 |
| 执行会话数 | 15（严格一对一） |
| 思考强度 | **xhigh**（公开发布时的最高可用档，`max` 当时仅限预览；15 个会话一致） |
| 累计用时 | **25 分 45 秒**（1,545.3 秒，墙钟 `time_updated − time_created` 累加） |
| API 调用 | **181** 次（`message.role='assistant'` 计数） |
| 工具调用 | **178** 次（`part.type='tool'` 计数） |
| 工具失败 | 8 次（均被后续步骤修复，见第四节） |
| 输入 token（非缓存） | 384,338 |
| 输出 token | 154,563 |
| 推理 token | 33,526（`session.tokens_reasoning` 累加，仅供参考，不计入过路量） |
| 缓存读 token | 3,130,484 |
| 缓存写 token | 0 |
| **总 token 过路量** | **3,669,385**（输入 + 输出 + 缓存读） |
| **金额开销** | **¥0 / $0**（免费模型，`session.cost` 全为 0） |

---

## 二、任务 ↔ 会话映射

15 个任务与 15 个会话严格一对一，无 DSH 那样的多任务会话，可直接按标题对应。
时间均为北京时间（UTC+8，`datetime(time/1000,'unixepoch','+8 hours')`），日期均为 2026-09-09。

| 会话（后 8 位） | 产出任务 | 会话标题 | 说明 |
| --- | --- | --- | --- |
| `3uXlEgk8` | task-01 | Luxury Aevum watch landing page | 一对一 |
| `xUz2opyf` | task-02 | Pelican riding bicycle SVG | 一对一 |
| `huNWUldQ` | task-03 | Analog clock showing 6:25 SVG | 一对一 |
| `F7nkyHKb` | task-04 | SVG analog clock showing 11:52:30 | 一对一 |
| `2L3UntnA` | task-05 | Bicycle rider side view SVG | 一对一 |
| `PqP2rfzs` | task-06 | SVG hand cutting paper with scissors | 一对一 |
| `Ty1BuVsG` | task-07 | Pushing wheelbarrow SVG illustration | 一对一 |
| `5OLo5o3j` | task-08 | Polished Breakout game in single HTML file | 一对一 |
| `G6dJ2eNT` | task-09 | Playable top-down farming game in single HTML file | 一对一 |
| `1yDBtsPS` | task-10 | Pixel-art editor with PNG export | 一对一 |
| `Hd3bMfix` | task-11 | Building 2D floor-plan editor | 一对一 |
| `4yTgKqr2` | task-12 | Building working calculator app | 一对一 |
| `oKXEHK28` | task-13 | Polished weather dashboard build | 一对一 |
| `oNbsNrbm` | task-14 | Bank website creation | 一对一 |
| `YY1wmwpb` | task-15 | Building book tracking app | 一对一 |

另有 3 个同目录非任务会话，不计入本报告统计：`3uXlEgk8` 之前的 `模型身份与多模态能力询问`（11:31–11:37）、`检查首个任务抄袭嫌疑`（11:41–11:45），以及本复盘整理会话本身。

---

## 三、逐任务明细

`用时 = session.time_updated − session.time_created`；`总 tok = 输入 + 输出 + 缓存读`。

| 任务 | 会话 | 开始 | 完成 | 用时 | API | **工具调用** | 失败 | 输入 tok | 输出 tok | 缓存读 tok | 总 tok |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| task-01 | 3uXlEgk8 | 11:38:28 | 11:40:41 | 2分13秒 | 10 | **9** | 0 | 32,583 | 21,073 | 180,586 | 234,242 |
| task-02 | xUz2opyf | 11:46:12 | 11:47:02 | 50秒 | 5 | **4** | 0 | 16,196 | 4,511 | 44,469 | 65,176 |
| task-03 | huNWUldQ | 11:47:10 | 11:47:49 | 39秒 | 8 | **8** | 0 | 16,659 | 4,299 | 85,384 | 106,342 |
| task-04 | F7nkyHKb | 11:47:56 | 11:48:31 | 36秒 | 6 | **5** | 0 | 15,376 | 3,680 | 55,462 | 74,518 |
| task-05 | 2L3UntnA | 11:48:55 | 11:51:46 | 2分51秒 | 18 | **18** | 3 | 35,350 | 7,577 | 423,026 | 465,953 |
| task-06 | PqP2rfzs | 11:52:02 | 11:54:09 | 2分07秒 | 15 | **13** | 3 | 24,075 | 5,324 | 211,374 | 240,773 |
| task-07 | Ty1BuVsG | 11:54:13 | 11:54:53 | 40秒 | 7 | **7** | 0 | 19,191 | 4,034 | 72,983 | 96,208 |
| task-08 | 5OLo5o3j | 11:55:00 | 11:56:18 | 1分18秒 | 6 | **5** | 0 | 21,842 | 11,864 | 60,326 | 94,032 |
| task-09 | G6dJ2eNT | 11:56:42 | 11:58:23 | 1分41秒 | 7 | **6** | 0 | 25,178 | 13,509 | 74,391 | 113,078 |
| task-10 | 1yDBtsPS | 11:58:32 | 11:59:18 | 46秒 | 7 | **6** | 0 | 16,554 | 6,290 | 70,935 | 93,779 |
| task-11 | Hd3bMfix | 11:59:28 | 12:01:10 | 1分43秒 | 12 | **12** | 0 | 32,471 | 14,141 | 217,548 | 264,160 |
| task-12 | 4yTgKqr2 | 12:01:19 | 12:03:19 | 2分00秒 | 18 | **21** | 0 | 23,463 | 8,053 | 284,530 | 316,046 |
| task-13 | oKXEHK28 | 12:03:58 | 12:08:45 | 4分46秒 | 30 | **31** | 2 | 42,896 | 17,913 | 779,454 | 840,263 |
| task-14 | oNbsNrbm | 12:09:01 | 12:11:01 | 2分00秒 | 13 | **12** | 0 | 29,931 | 17,896 | 205,117 | 252,944 |
| task-15 | YY1wmwpb | 12:13:28 | 12:15:03 | 1分35秒 | 19 | **21** | 0 | 32,573 | 14,399 | 364,899 | 411,871 |
| **合计** | — | — | — | **25分45秒** | **181** | **178** | **8** | **384,338** | **154,563** | **3,130,484** | **3,669,385** |

### 关键观察

- **最耗时**：task-13（4分46秒）、task-05（2分51秒）、task-01（2分13秒）。
- **最省时**：task-04（36秒）、task-03（39秒）、task-07（40秒）——均为单文件 SVG。
- **token 消耗前三**：task-13（84.0 万）、task-05（46.6 万）、task-15（41.2 万）。
- **工具密度最高**：task-13（31 次）、task-12 / task-15（各 21 次）。
- **缓存读占比约 85.3%**，长上下文复用明显；实际新增输入仅 38.4 万 token。
- 与 DSH（138 分钟 / 6445 万过路量 / 735 工具调用）相比，本次体量小一个数量级，主因是单任务单会话、少折腾、视觉自检少。

---

## 四、工具使用分布

### 全局分布（178 次）

| 工具 | 次数 | 占比 |
| --- | --- | --- |
| `read` | 56 | 31.5% |
| `bash` | 47 | 26.4% |
| `write` | 27 | 15.2% |
| `todowrite` | 26 | 14.6% |
| `edit` | 14 | 7.9% |
| `vision` | 5 | 2.8% |
| `ocr` | 2 | 1.1% |
| `glob` | 1 | 0.6% |

去向说明：`read` 几乎全是读 phase-01 内目录与刚写出的交付物；`bash` 全是本地校验（`node --check`、SVG XML 解析、HTML 解析、`python3 -m http.server` + `curl localhost`、Chrome headless 截自己的图）；无 `webfetch` / `websearch` / `skill` 类工具。

### 各任务工具明细

| 任务 | 工具调用构成 |
| --- | --- |
| task-01 | `write`×3, `read`×2, `todowrite`×2, `bash`×2 |
| task-02 | `read`×2, `write`×1, `bash`×1 |
| task-03 | `read`×4, `write`×1, `bash`×2, `edit`×1 |
| task-04 | `read`×2, `bash`×2, `write`×1 |
| task-05 | `bash`×7, `read`×5, `vision`×2, `glob`×1, `write`×1, `ocr`×1, `edit`×1 |
| task-06 | `bash`×5, `read`×3, `vision`×2, `write`×1, `edit`×1, `ocr`×1 |
| task-07 | `read`×5, `write`×1, `bash`×1 |
| task-08 | `read`×2, `bash`×2, `write`×1 |
| task-09 | `read`×3, `bash`×2, `write`×1 |
| task-10 | `read`×2, `todowrite`×2, `write`×1, `bash`×1 |
| task-11 | `read`×5, `todowrite`×4, `write`×1, `bash`×2 |
| task-12 | `bash`×6, `write`×5, `todowrite`×4, `read`×3, `edit`×3 |
| task-13 | `bash`×11, `edit`×8, `read`×7, `todowrite`×3, `write`×1, `vision`×1 |
| task-14 | `todowrite`×5, `read`×3, `write`×3, `bash`×1 |
| task-15 | `read`×8, `todowrite`×6, `write`×5, `bash`×2 |

> 注：`vision` / `ocr` 只出现在 task-05、task-06、task-13（共 7 次调用），均为本地截图自检管线；其余 12 个任务零视觉工具。

### 工具失败（8 次，均已恢复）

| 任务 | 失败 | 原因与后续 |
| --- | --- | --- |
| task-05 | `vision`×2 + `ocr`×1 | 截图已生成但视觉模型调用报错（空输出）；改用 Chrome 不同参数重截 + 继续手工修 SVG，不影响交付 |
| task-06 | `vision`×2 + `ocr`×1 | 同上（`/tmp/hand-preview*.png` 管线报错）；改用 Chrome 重截后继续迭代，交付正常 |
| task-13 | `vision`×1 + `read`×1 | 首次截图 `/tmp/atmos1.png` 的视觉描述与直接 `read` 该图失败；改用 `--dump-dom` + `?selftest=1` 做 DOM 自检，恢复 |

其余 12 个任务零失败。

---

## 五、作弊嫌疑专项

### 5.1 全局结论

**15 个任务均无作弊嫌疑。**

四条独立证据相互印证：工具面、文件面、网络面、配置面均干净。

### 5.2 检查维度与证据

| 维度 | 检查方法 | 结果 |
| --- | --- | --- |
| 工具面 | 15 会话 `part.tool` 去重 | 仅 `read/write/edit/bash/todowrite/glob/vision/ocr` 8 种；**无 `webfetch`、`websearch`、`skill`、浏览器远程操作类工具** |
| 文件面 | `read/write/edit` 的 `filePath` 全量审计 | 全部落在 `…/Muse-Spark-1.3_Opencode/phase-01/` 内；唯一例外是读自己刚截的图（`/tmp/atmos1.png`、`/var/folders/…/T/opencode/rider*.png`）；**零次读取 `DeepSeek-*`、`PROMPT/`、`docs/`、`website/`、展示站或 GitHub 相关路径** |
| 网络面 | 47 条 `bash.command` 全文审计（含 URL 正则） | 仅 `http://localhost:XXXX` 本地验证与 `http://www.w3.org/2000/svg` SVG 命名空间；**无 `curl/wget` 外网、无 `git clone`、无 npm 外部模板拉取**；`pip3 install cairosvg` 一次（task-05 本地渲染依赖，属正常工具链，非答案来源） |
| 配置面 | `phase-01/opencode.json` | `permission.external_directory: deny`，模型客观上无法读工作区外文件 |
| 内容面 | `part.data LIKE '%vibetest%/%github%/%dsh%'` 全库检索 | 命中均为推理加密 blob 内的随机子串误报，无真实引用 |

### 5.3 逐任务说明

| 任务 | 是否涉外读/网 | 说明 |
| --- | --- | --- |
| task-01 | 否 | 仅读写本任务 3 文件 + `curl localhost:8931` 自验 + 外链断言（`http` 仅允许 w3.org） |
| task-02 | 否 | 仅 XML 解析自验 |
| task-03 | 否 | 读了 task-01/02 目录（同工作区风格参考）+ 角度数学验算；无外部答案 |
| task-04 | 否 | 仅本目录读写 + 角度验算 |
| task-05 | 否 | 读 task-02/03 的 SVG 做风格对齐 + Chrome 截自己的图自检；`pip install cairosvg` 系渲染依赖 |
| task-06 | 否 | 仅本目录 + Chrome 截自己的图；失败的 vision/ocr 均为空输出，无外部信息流入 |
| task-07 | 否 | 读 task-02/05 的 SVG 做风格对齐；单次 XML 自验 |
| task-08 | 否 | 翻了 task-01/02 目录确认命名 + `node vm` 语法自检 |
| task-09 | 否 | 读 task-08 的 `index.html` 前 30 行（单文件游戏结构参考）；其余为本地 HTML 解析 |
| task-10 | 否 | 仅本目录 + 关键字自检（`toBlob/undoStack/setZoom`） |
| task-11 | 否 | 读 task-10 目录/`index.html` 与 `opencode.json`（确认单文件约束）；`node --check` 自验 |
| task-12 | 否 | 全本地：`node test.mjs`、`node --check`、ID 接线断言、`http.server` + `curl localhost:8137` |
| task-13 | 否 | 全本地：Playwright/Chrome `--dump-dom ?selftest=1`、双分辨率自检、`node --check`；失败的 vision/read 均系读自己截图失败 |
| task-14 | 否 | 读 `opencode.json` 确认约束 + `node --check`；单文件多页手写 |
| task-15 | 否 | 读 task-12 的引擎/测试做分层参考（`calculator.js/test.mjs`），属同工作区复用自研代码，非外部抄袭；`node test.mjs` 自验 |

### 5.4 需说明的非作弊行为（预先澄清）

1. **跨任务读同工作区文件**（task-03→01/02、task-05→02/03、task-07→02/05、task-09→08、task-11→10、task-15→12）：均为读**本次自己已完成的交付物**做风格/结构对齐，未触碰任何外部历史答案，不构成作弊。
2. **`pip3 install cairosvg`**（task-05）：SVG→PNG 本地渲染依赖，安装后仍因缺系统库而改用 Chrome 截图；无答案信息流入。
3. **8 次工具失败**：全部是本地视觉管线空输出报错，无外部内容返回，更无“失败后改抄”的痕迹。

---

## 六、统计口径

| 项目 | 口径 |
| --- | --- |
| **完成时长** | `session.time_updated − session.time_created`（整会话墙钟；本报告任务会话均无收尾追问轮，故等于任务用时） |
| **API 调用** | `message` 表中 `role='assistant'` 的记录数（每次模型请求一条） |
| **工具调用** | `part` 表中 `type='tool'` 的记录数，按 `session_id` 归属到任务 |
| **失败** | `part` 中 `tool.state.status='error'` 的数量 |
| **输入 token** | `session.tokens_input`（非缓存输入） |
| **输出 token** | `session.tokens_output` |
| **推理 token** | `session.tokens_reasoning`（单独列出，不计入过路量） |
| **缓存读 token** | `session.tokens_cache_read`；缓存写全为 0 |
| **总 token** | 输入 + 输出 + 缓存读 |
| **prompt** | 按用户要求省略原文；任务↔会话已按标题一对一对齐，无需语义对齐 |

---

## 七、对账与注意事项

**对账**：15 任务会话 `tokens_input` 求和 384,338、`tokens_output` 求和 154,563、`cache_read` 求和 3,130,484，与逐任务明细合计完全一致；`assistant` 消息 181 = `step-start` 181（task-06 有 1 条无 step 的文本消息，差 1 属正常波动，已按 message 口径统一）；工具 178 与分任务构成之和一致。

**注意事项**：

1. **严格一对一**：与 DSH 的多任务会话不同，本次 15 任务对应 15 会话，无需按轮次切分，不存在归属歧义。
2. **时长口径**：本报告用会话墙钟；若按模型 `time.completed − time.created` 累加会略小（不含工具执行耗时），本报告取大口径。
3. **vision/ocr 失败**：task-05/06/13 共 8 次，均为视觉管线空输出，已用 Chrome 重截 / DOM 自检恢复，交付物不受影响。
4. **本报告为只读提取产物**，未修改任何会话日志或任务交付物；`check_cheat.py` 等临时脚本放在系统临时目录，不在交付区。

---

## 八、金额开销

| 项目 | 金额 |
| --- | --- |
| Muse-Spark-1.3（contributor-free） | **¥0 / $0**（`session.cost` 15 个会话全为 0） |

> opencode 日志无计费字段，本金额即日志 `cost` 字段实测值；与 token 量无关，无需换算。
> 参考：单任务平均过路量约 24.5 万 token，平均用时约 1 分 43 秒，平均工具调用约 11.9 次。

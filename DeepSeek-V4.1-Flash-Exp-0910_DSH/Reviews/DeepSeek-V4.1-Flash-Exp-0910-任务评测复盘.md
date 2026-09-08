# DeepSeek-V4.1-Flash-Exp-0910 · 15 项任务评测复盘

> **数据来源**：DSH 会话日志（`~/.dsh/sessions/--Users-gabrielmu-Documents-New_Model_Test--/`）
> **提取方式**：只读解析 `session.jsonl.zstd`（多帧 zstd 压缩 JSONL），未修改任何会话文件
> **覆盖范围**：15 个评测任务 / 12 个执行会话
> **统计口径**：仅计入任务执行轮次，不含收尾追问轮

---

## 一、总览

| 指标 | 数值 |
| --- | --- |
| 任务数 | 15 |
| 执行会话数 | 12（15 个任务由 12 个会话产出） |
| 累计用时 | **138 分 2 秒**（8,282 秒） |
| API 调用 | **693** 次 |
| 工具调用 | **735** 次 |
| 工具失败 | 42 次（含重试，均被后续步骤修复） |
| 输入 token（非缓存） | 334,670 |
| 输出 token | 1,072,534 |
| 缓存读 token | 63,042,176 |
| **总 token 过路量** | **64,449,380** |
| 输入 prompt 条数 | 20（15 条任务 + 5 条「继续」/补充） |
| **金额开销** | **¥9.30**（梁文谷，即 DS 低价时段） |

---

## 二、任务 ↔ 会话映射

**重要**：15 个任务并非一一对应 15 个会话。3 个任务来自 2 个多任务会话；且这些文件最初写在**工作区根目录**，`task-NN-*` 目录是后续重命名才建立的，因此**不能靠目录名反推归属**，本报告采用「写入路径 + prompt 语义 + 时间戳」三重对齐。

| 会话 | 产出任务 | 说明 |
| --- | --- | --- |
| `89716f93` | task-01 | 一对一 |
| `0e1e035d` | task-02 | 一对一 |
| **`17e6215c`** | **task-03 + task-04** | 同一会话先后完成两个时钟 |
| **`4a0d64ce`** | **task-05 + task-06 + task-07** | 同一会话连做 3 个 SVG |
| `2579bde9` | task-08 | 一对一 |
| `28e77186` | task-09 | 一对一 |
| `da8df324` | task-10 | 一对一 |
| `2d2be5e2` | task-11 | 一对一 |
| `f87c54e3` | task-12 | 一对一 |
| `31de8e10` | task-13 | 一对一 |
| `214420b0` | task-14 | 一对一 |
| `b25a11c4` | task-15 | 一对一 |

另有 4 个会话不属于评测任务：`5d957dd2`（配置 4.1 测试版）、`a6a6ebc8`（JSON 结构化输出）、`da8bab8b`（四句英文约束）、`c8451e66`（目录整理会话）。

---

## 三、逐任务明细

| 任务 | 会话 | 开始 | 完成 | 用时 | API | **工具调用** | 失败 | 输入 tok | 输出 tok | 缓存读 tok | 总 tok |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| task-01 | 89716f93 | 22:00:49 | 22:05:44 | 4分51秒 | 24 | **22** | 4 | 18,812 | 79,314 | 1,888,256 | 1,986,382 |
| task-02 | 0e1e035d | 21:21:05 | 21:35:43 | 14分38秒 | 48 | **47** | 3 | 30,423 | 26,707 | 1,300,992 | 1,358,122 |
| task-03 | 17e6215c | 21:46:01 | 21:47:53 | 51秒 | 6 | **4** | 1 | 27,115 | 9,719 | 110,080 | 146,914 |
| task-04 | 17e6215c | 21:49:02 | 21:49:20 | 18秒 | 2 | **1** | 0 | 3,328 | 4,946 | 69,248 | 77,522 |
| task-05 | 4a0d64ce | 21:54:30 | 21:56:49 | 1分20秒 | 6 | **4** | 1 | 5,991 | 25,584 | 188,544 | 220,119 |
| task-06 | 4a0d64ce | 21:57:13 | 21:58:24 | 1分11秒 | 3 | **2** | 0 | 2,610 | 16,812 | 173,568 | 192,990 |
| task-07 | 4a0d64ce | 21:58:31 | 21:59:20 | 48秒 | 3 | **2** | 0 | 2,647 | 15,704 | 230,528 | 248,879 |
| task-08 | 2579bde9 | 22:17:11 | 22:29:08 | 11分57秒 | 46 | **54** | 2 | 16,817 | 66,542 | 2,910,592 | 2,993,951 |
| task-09 | 28e77186 | 22:30:19 | 22:41:54 | 11分34秒 | 42 | **41** | 2 | 18,291 | 94,946 | 3,526,912 | 3,640,149 |
| task-10 | da8df324 | 22:52:04 | 22:59:22 | 7分17秒 | 34 | **40** | 2 | 13,517 | 52,144 | 1,728,512 | 1,794,173 |
| task-11 | 2d2be5e2 | 23:00:03 | 23:12:13 | 12分10秒 | 81 | **80** | 4 | 27,635 | 125,649 | 7,634,432 | 7,787,716 |
| task-12 | f87c54e3 | 23:12:09 | 23:18:29 | 6分20秒 | 89 | **90** | 6 | 32,431 | 94,869 | 7,376,128 | 7,503,428 |
| task-13 | 31de8e10 | 23:12:42 | 23:39:59 | 27分17秒 | 111 | **137** | 9 | 48,805 | 142,513 | 12,535,680 | 12,726,998 |
| task-14 | 214420b0 | 23:15:26 | 23:38:30 | 23分4秒 | 123 | **137** | 4 | 49,198 | 192,140 | 16,419,584 | 16,660,922 |
| task-15 | b25a11c4 | 23:20:36 | 23:35:01 | 14分26秒 | 75 | **74** | 4 | 37,050 | 124,945 | 6,949,120 | 7,111,115 |
| **合计** | — | — | — | **138分2秒** | **693** | **735** | **42** | **334,670** | **1,072,534** | **63,042,176** | **64,449,380** |

### 关键观察

- **最耗时**：task-13（27分17秒）、task-14（23分4秒）、task-02（14分38秒）—— 均为多文件、多轮自检型任务。
- **最省时**：task-04（18秒）、task-07（48秒）、task-03（51秒）—— 单文件 SVG 输出。
- **token 消耗前三**：task-14（1,666 万）、task-13（1,273 万）、task-11（779 万）。
- **工具密度最高**：task-13 / task-14（均 137 次），其次是 task-12（90 次）。
- **缓存读占比 97.8%**，说明长上下文复用充分；实际新增输入仅 33.5 万 token。

---

## 四、工具使用分布

### 全局分布（735 次）

| 工具 | 次数 | 占比 |
| --- | --- | --- |
| `bash` | 359 | 48.8% |
| `edit` | 120 | 16.3% |
| `write` | 93 | 12.7% |
| `modlens_read_image` | 75 | 10.2% |
| `run_code` | 29 | 3.9% |
| `read` | 21 | 2.9% |
| `todo_write` | 17 | 2.3% |
| `read_image` | 10 | 1.4% |
| `describe_image` | 8 | 1.1% |
| `job_output` | 2 | 0.3% |
| `glob` | 1 | 0.1% |

### 各任务工具明细

| 任务 | 工具调用构成 |
| --- | --- |
| task-01 | `run_code`×22 |
| task-02 | `bash`×29, `modlens_read_image`×10, `edit`×5, `write`×1, `read_image`×1, `describe_image`×1 |
| task-03 | `run_code`×4 |
| task-04 | `run_code`×1 |
| task-05 | `run_code`×2, `write`×1, `read`×1 |
| task-06 | `write`×1, `read`×1 |
| task-07 | `write`×1, `read`×1 |
| task-08 | `bash`×23, `edit`×16, `modlens_read_image`×8, `write`×3, `read`×2, `read_image`×1, `job_output`×1 |
| task-09 | `bash`×32, `write`×3, `edit`×3, `read_image`×1, `describe_image`×1, `modlens_read_image`×1 |
| task-10 | `bash`×19, `edit`×8, `todo_write`×3, `write`×3, `modlens_read_image`×3, `read`×2, `read_image`×1, `describe_image`×1 |
| task-11 | `bash`×57, `write`×9, `edit`×6, `todo_write`×3, `modlens_read_image`×3, `read_image`×1, `describe_image`×1 |
| task-12 | `edit`×31, `bash`×29, `write`×12, `read`×11, `todo_write`×3, `read_image`×1, `describe_image`×1, `modlens_read_image`×1, `job_output`×1 |
| task-13 | `bash`×62, `modlens_read_image`×32, `edit`×23, `write`×16, `todo_write`×2, `read_image`×1, `describe_image`×1 |
| task-14 | `bash`×69, `write`×32, `edit`×16, `modlens_read_image`×10, `read`×3, `todo_write`×3, `read_image`×2, `glob`×1, `describe_image`×1 |
| task-15 | `bash`×39, `edit`×12, `write`×11, `modlens_read_image`×7, `todo_write`×3, `read_image`×1, `describe_image`×1 |

> 注：task-01～07 集中在早期会话，`run_code` 是当时的主执行通道；task-08 之后转为 `bash` + `write`/`edit` 组合，并大量使用视觉工具做自我检查（`modlens_read_image` 共 75 次）。

---

## 五、输入 Prompt 原文

### task-01 · Aevum 奢侈腕表落地页（会话 89716f93）
```
Build a beautiful landing page for a fictional luxury watch brand called "Aevum".
Use only HTML, CSS and JavaScript.
Do not use external images or libraries.
Make it feel like a real premium product website.
```
补充轮：`继续`

### task-02 · 骑自行车的鹈鹕（会话 0e1e035d）
```
Generate an SVG of a pelican riding a bicycle.
```

### task-03 · 模拟时钟 6:25（会话 17e6215c）
```
Create an SVG of an analog clock showing exactly 6:25.
Include hour markers and three hands.
```
补充轮：`继续`

### task-04 · 模拟时钟 11:52:30（会话 17e6215c）
```
Create an SVG analog clock showing 11:52:30.
```

### task-05 · 骑车的人（会话 4a0d64ce）
```
Generate an SVG of a person riding a bicycle viewed from the side.
The left foot must be on the lower pedal and the right foot on the upper pedal.
Both hands must be holding the handlebars.
```
补充轮：`继续`

### task-06 · 剪刀剪纸（会话 4a0d64ce）
```
Draw an SVG of a hand using scissors to cut a sheet of paper.
```

### task-07 · 推独轮车（会话 4a0d64ce）
```
Draw an SVG of a person pushing, not pulling, a wheelbarrow.
```

### task-08 · 霓虹打砖块（会话 2579bde9）
```
Create a polished, playable Breakout game in a single HTML file.
```

### task-09 · 山谷农场（会话 28e77186）
```
Create a playable top-down farming game in a single HTML file.
```

### task-10 · 像素画编辑器（会话 da8df324）
```
Build a small pixel-art editor.
It should support:
drawing,
erasing,
color selection,
brush size,
undo/redo,
zoom,
and exporting the result as PNG.
```

### task-11 · 户型图编辑器（会话 2d2be5e2）
```
Build a simple 2D floor-plan editor where I can draw walls, add doors and windows, drag objects, and see room dimensions.
```

### task-12 · 计算器（会话 f87c54e3）
```
Create a working calculator app.
Choose the technology yourself.
Run it.
Test it.
Fix any issues you find.
Do not ask me questions unless you are genuinely blocked.
```

### task-13 · 天气仪表盘（会话 31de8e10）
```
Build a polished weather dashboard.

After implementing it:
1. Run the application.
2. Open it in the browser.
3. Inspect the rendered result yourself.
4. Fix any visual or functional issues you notice.
5. Repeat until you are satisfied.
```

### task-14 · 银行网站（会话 214420b0）
```
Make me a website for a bank.
```

### task-15 · 读书追踪（会话 b25a11c4）
```
Build an app for keeping track of books.
```

---

## 六、统计口径

| 项目 | 口径 |
| --- | --- |
| **完成时长** | 累加任务执行轮次的 `turn/end.time − turn/start.time`，含模型思考与工具执行的真实墙钟时间；不含收尾追问轮 |
| **API 调用** | `assistant/chunk` 中 `chunk.type === "usage"` 的记录数（每次模型请求一条） |
| **工具调用** | `tool/call` 记录数，按 `data.turn` 归属到任务 |
| **失败** | `tool/result` 中 `message.content[].isError === true` 的数量，含被重试覆盖的失败 |
| **输入 token** | 非缓存输入（`inputTokens`）累加 |
| **输出 token** | `outputTokens` 累加 |
| **缓存读 token** | `cacheReadTokens` 累加 |
| **总 token** | 输入 + 输出 + 缓存读 |
| **prompt** | 仅取 `user/message` 中 `source.kind === "user"` 的真实输入，已排除系统注入的运行时上下文 |

---

## 七、对账与注意事项

**对账**：16 个会话共 817 次 API 调用 = **693**（15 个任务执行）+ **93**（4 个非任务会话）+ **31**（任务会话内的收尾追问轮，如 task-01 会话的「按照任务重命名一下」「为什么不能删除」、task-08 会话的「根目录 index 可不可以不保留」）。数字完全闭合。

**注意事项**：

1. **多任务会话**：task-03/04 共用会话 `17e6215c`，task-05/06/07 共用会话 `4a0d64ce`。报告已按轮次切分 token 与时长；「继续」轮归入前一个任务。
2. **无关指令**：会话 `28e77186` 中混入一条「不要再尝试恢复钥匙串了」，被 spliced 进同一轮，**不属于 task-09 的任务输入**，已在 prompt 附录中剔除。
3. **时长口径可选**：若按会话墙钟（含收尾追问）计算，task-01 为 15 分 03 秒、task-08 为 12 分 56 秒。
4. **早期会话无视觉工具**：task-01～07 未使用 `modlens_read_image` 等视觉自检工具，与后期任务的工具构成差异明显。
5. **本报告为只读提取产物**，未修改任何会话日志或任务交付物。

---

## 八、金额开销

| 项目 | 金额 |
| --- | --- |
| 梁文谷（即 DS 低价时段） | **¥9.30** |

> 「梁文谷」指 **DS（DeepSeek）低价时段**（错峰优惠时段）；该金额为在此低价时段产生的费用，由用户提供。DSH 会话日志只记录 token 用量、不含计费字段，因此本金额与前述 token 统计相互独立，未做换算。

**单位成本参考**（按上述金额与 token 量粗算，仅供对照）：

| 口径 | 数值 |
| --- | --- |
| 单任务平均 | 约 ¥0.62 |
| 每百万 token 过路量 | 约 ¥0.14 |
| 每百万输出 token | 约 ¥8.67 |

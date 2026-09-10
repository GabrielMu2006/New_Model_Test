# task-15 · 读书追踪应用 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-15` |
| runId | `run-gpt-5-6-sol-task-15-r1` |
| 本题得分 | **79/100** |
| 结论（中） | 增删改查、搜索、筛选、排序、统计与本地持久化真实可用且界面精致；但完全没有日期字段（因此"完结写完成日期、重开清理冲突"无法成立）、只有三种阅读状态，且存储损坏时会静默用 8 本示例书覆盖用户数据。 |
| Conclusion (EN) | Add/view/edit/delete, search, filtering, sorting, statistics and local persistence genuinely work in a polished UI; however there are no date fields at all (so the finish-date and conflict-resolution rules cannot hold), only three reading states exist, and corrupted storage is silently replaced by eight sample books. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：可运行的书籍追踪应用 ✅；至少 新增/查看/编辑/删除 且记录书名、作者、阅读状态 ✅；更完整实现：页数进度 ✅、评分 ✅、类型标签 ✅、收藏/目标 ✅、搜索 ✅、筛选 ✅、排序 ✅、统计 ✅、本地持久化 ✅；**开始/完成日期 ✗（完全没有日期字段）**；导入导出 ✗；空库/无结果/无效输入/损坏存储的反馈 **部分**。

- **实测（Chromium 无头）**：
  - 首屏**渲染 8 张书籍卡片**（首次访问被播种 `seedBooks`），统计区显示 `8 books / 2 reading / 4 finished / 目标 4-24`；`#statusInput` 的选项实测只有 `reading`/`want`/`finished` **三项**；**页面内不存在任何 `input[type="date"]` 或 `#finishInput`**（实测 `hasFinishDateField = false`）。
  - **损坏存储**：把 `localStorage` 键值改成 `'{'` 后刷新 → 页面**无提示、无控制台错误**地重新显示 8 本示例书（`JSON.parse` 失败即静默回退到 `seedBooks`），用户原数据在下一次保存时被无声覆盖。

- **一致性要求为何无法满足**：理论成果点名的"完成时设置完成日期与最终进度、重新阅读时合理清理冲突字段"是**结构性不可达**——应用里根本没有开始/完成日期字段，唯一的时间戳是新增时间 `added`。实测的相关缺口是：把已读完的书（进度 = 总页数）改回"在读"后，进度仍为 100%，没有任何字段被清理。

- **其余缺陷**：状态机缺少 `paused`/`abandoned`（理论成果列出的五种状态只有三种）；空库状态只有在把 8 本示例书全部删光后才可达，全新用户看不到（实测首屏即 8 张卡片）；删除只有 `confirm()` 确认、**没有撤销**；ID 用 `Date.now()`，同毫秒两次新增会得到相同 ID（编辑/删除会命中两条）；页数只做上界 `Math.min` 夹取，无下界/整数校验；评分字段缺失时排序产生 `NaN`（静默失效）；"Finished this year" 实际上是**全部已读完数量**，不按年份过滤（因为没有日期）；搜索框的可访问名称被 `aria-hidden` 吃掉，只能靠 placeholder。

- **成立且值得肯定的部分**：所有用户文本经 `escapeHtml`，未发现注入点；编辑表单用 `form.reset()` + 逐字段回填，切换编辑对象不残留上一本数据；搜索对大小写与首尾空格容错；**搜索 + 筛选 + 排序三者叠加逻辑一致**，计数与列表一致；删除有确认；无任何外部依赖，可 `file://` 直接打开；`<dialog>` + `showModal()` 自带 Esc 与焦点约束；`:focus-visible`、`prefers-reduced-motion`、三档响应式断点齐备；视觉维度盲看给 9/10。

- **扣分**：需求符合度 −10（无日期字段 −5、状态不全 −3、空库不可达 −2）；完整度 −2；正确性 −6（损坏存储静默覆盖 −3、ID 碰撞 −1、页数下界 −1、年份统计口径 −1）；视觉 −1；工程 −2。

- **局限**：多标签页并发写入 `localStorage` 的覆盖时序未测；iOS 无痕模式下存储抛错的真实表现未测；导入导出因不存在而无从复核；视觉结论来自视觉桥接模型。

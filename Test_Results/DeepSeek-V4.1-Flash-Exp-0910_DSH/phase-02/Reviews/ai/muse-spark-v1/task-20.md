# task-20 二维机械连杆设计器 · AI 评价（muse-spark-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | Muse Spark 1.3（AI），**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-10（UTC） |
| reviewId | `review-muse-spark-v1-task-20` |
| runId | `run-deepseek-v4-1-flash-exp-0910-task-20-r1` |
| 本题得分 | **96/100**（39/40＋24/25＋18/20＋15/15） |
| 结论（中） | **直接通过（本批最高）**——固定铰/转动副/精确连杆/滑块/电机/读数/保存齐，四杆＋滑块双预设，残差 2.8e-14mm；模块入口需服务、单文件可直开 |
| Conclusion (EN) | Original Chinese conclusion (not translated): 直接通过（本批最高） — 固定铰/转动副/精确连杆/滑块/电机/读数/保存齐，四杆＋滑块双预设，残差 2.8e-14mm；模块入口需服务、单文件可直开 |
| 评分口径 | 原始需求符合度 40 / 功能与正确性 25 / 视觉与易用性 20 / 稳健性与可验证性 15；沿用 phase-01《15-任务完成质量评估》四维度 |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 原始汇总文件 | [source-summary.md](source-summary.md)（评价者原稿，逐字保留） |

---

12 动作＋双机构＋刚性保持全中：工具 1–8（选择/固定铰/转动副/精确连杆＋use value/轨道/滑块/电机/删除）、Transport＋±2°＋scrub＋0.05×–4×、Joints/Links/Motors＋状态栏（`link error 0.0e+0`＋mobility 秩揭示）、命名槽＋JSON 导入导出＋Autosave＋损坏降级、5 预设（四杆 Grashof、直列滑块行程＝2r、偏置、双摇杆卡死、滑块＋限位）、LM＋解析 Jacobian＋线搜过死点＋去电机恢复＋ramp 跟分支＋jam 二分＋拖拽软行（240Hz 即收敛）。
`submission` 19 文件与磁盘一致；自述 `npm test 66/66`（含 40 随机四杆＋25 随机滑块逐检查长）＋`browser-check 65/65×2 构建`（无错、真绘制、三宽无溢出、四杆 worst 2.8e-14mm、滑块 145 角＝2r 至 1e-6mm、空鼠标全流程建滑块、半成品四态不抛），`e2e-screenshot` 在 evidence；4 个真实修 bug 史（组装序、死点、`[hidden]` 被盖、指针捕获）可追溯。
扣分：`entry=index.html` 为模块（`type=module`）需服务，`file://` 不可用，但 `dist/linkage-designer.html`（约 207KB，可再生＋stale 保护）可直开且 README 首节即给双入口，故仅 -1（优于 phase-01 T12/T15 无替代）；轨道地面固定/单关节单电机/无动力学/分支跟随均为声明裁剪；他浏览器未验。

---

> 本节内容**逐字取自评价者原始汇总文件**的「三、逐项评估 · Task 20」小节（`source-summary.md`），分数与结论未改写；本次仅按 2026-09-10 组织者的归档要求拆分为逐题独立评价文件。

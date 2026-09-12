# task-09 · 单文件俯视角农场游戏 —— AI 评价（maintenance-agent-v4）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（Codex），非盲评 |
| 评价版本 | v4 |
| 评价日期 | 2026-09-12 |
| reviewId | `review-maint-agent-v4-task-09` |
| runId | `run-k3-task-09-r1` |
| 本题得分 | **93/100** |
| 结论（中） | 耕地、播种、浇水、隔日生长、收获、销售、购买和存档构成真实闭环，27 项自带冒烟测试全部通过。 |
| Conclusion (EN) | Tilling, planting, watering, overnight growth, harvesting, selling, buying, and saving form a real loop, with all 27 bundled smoke checks passing. |
| 评分口径 | 需求符合 38 / 完整度 19 / 正确性 18 / 视觉 9 / 工程 9 |

- 入口 HTML 完全自包含；额外 `check.js` 与 `smoke-test.js` 是测试副本，不是运行依赖。角色、20×13 地图、工具、作物阶段、钱、天数、商店、存档和音效均有实现。
- 本轮实际运行成果自带测试，覆盖胡萝卜两日生长、未浇水不生长、收获、售出 24g、购买种子、面向目标、存取档、事件路径和循环帧，27 项全部通过。
- 390px 下全部四个工具仍可见，核心循环没有被隐藏。扣分：未做长时随机输入、真机触摸或边界碰撞压力测试；画面偏功能型像素示意，地图环境变化有限。


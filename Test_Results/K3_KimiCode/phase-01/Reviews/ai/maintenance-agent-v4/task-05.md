# task-05 · 侧面骑自行车的人 —— AI 评价（maintenance-agent-v4）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（Codex），非盲评 |
| 评价版本 | v4 |
| 评价日期 | 2026-09-12 |
| reviewId | `review-maint-agent-v4-task-05` |
| runId | `run-k3-task-05-r1` |
| 本题得分 | **95/100** |
| 结论（中） | 严格侧视、左脚下踏板、右脚上踏板和双手握把四项约束均清楚成立，左右还用 L/R 显式消歧。 |
| Conclusion (EN) | The strict side view, left foot on the lower pedal, right foot on the upper pedal, and both hands on the handlebar all hold clearly, with L/R labels removing ambiguity. |
| 评分口径 | 需求符合 39 / 完整度 19 / 正确性 19 / 视觉 9 / 工程 9 |

- 自行车结构完整，两轮为侧视圆形；左腿垂直延伸到下踏板并标 L，弯曲右腿接上踏板并标 R。
- 两条手臂分别延伸到车把区域，双手接触点可辨；关节、重心和遮挡顺序总体可信。
- 扣分：姿态略偏示意图，手部与车把的两个接触点很接近，缩小后会弱化“双手分别握持”的辨识度。


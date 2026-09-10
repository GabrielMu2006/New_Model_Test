# task-19 交互式太阳系模拟 · AI 评价（maintenance-agent-v2）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v2 |
| 评价日期 | 2026-09-10 |
| 本题得分 | **88/100** |
| 结论（中） | 八大行星、月球与伽利略卫星、调速连续性、暂停冻结时钟全部成立；暂停时画布仍有小幅重绘，选择天体未逐项验证。 |
| Conclusion (EN) | Eight planets, the Moon and the Galilean moons, continuous speed changes and a frozen clock while paused all hold; the canvas keeps a small residual repaint when paused, and body selection was not verified item by item. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 取证 | [../../../evidence/evaluation-2026-09-10/checks.json](../../../evidence/evaluation-2026-09-10/checks.json)（脚本 `evaluate*.mjs` 同目录） |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：太阳 + 8 颗行星 + 地球月球 + Io/Europa/Ganymede/Callisto ✅；相对轨道速度、层级卫星、拖尾、缩放/平移、视图切换、天体选择面板齐全 ✅。
- **实测·暂停（独立测量）**：暂停后模拟时间读数冻结（Day 38.7 → 38.7）✅；画布变化像素比例由运行时的 1.41% 降到 0.32%（暂停 2.5 s 后仍为 0.31%）→ **模拟时间停止**，残余变化为背景星野重绘，画布未完全静止。
- **实测·调速连续性（独立测量）**：默认 20.0 days/sec 与最大 300 days/sec 两档下日期都连续推进（约 20 / 约 300 天每秒）；界面明示「Changing speed never resets positions」✅。
- **实测·运行**：未暂停时画布持续变化；控制台无错误 ✅。
- **未独立验证**：① 点击画布/列表选择天体与 Focus planet 的实际效果（探测时始终为 `Nothing selected`）；② 月球与伽利略卫星「绕运动中的母星公转」的长期轨道正确性；③ 8 行星+拖尾的性能（仅单机单视口）。
- **扣分**：暂停时画布仍有残余重绘（−3）；天体选择与聚焦视图未逐项验证（−4）；性能未测（−3）；仅 2D 俯视、无轨道倾角/偏心率（模型自述）（−2）。

- **方法**：静态结构分析 + 组织者自建静态服务下的 Chromium 无头渲染与交互探针（`evidence/evaluation-2026-09-10/`），**未运行成果自带脚本**；视觉维度由视觉桥接模型描述，评价者本人不具备图像输入能力。
- **评分不可跨模型比较**：与第一阶段 DeepSeek 的历史分数口径、harness 与预算均不同。

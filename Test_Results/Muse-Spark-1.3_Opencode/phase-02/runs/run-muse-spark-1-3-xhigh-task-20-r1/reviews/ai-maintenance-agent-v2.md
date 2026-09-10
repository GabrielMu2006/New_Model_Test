# task-20 · AI 评价（maintenance-agent-v2）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v2 |
| 评价日期 | 2026-09-10 |
| 本题得分 | **92/100** |
| 结论（中） | 连杆长度在运动全程经独立复算保持恒定（极差 ≤0.17 px），暂停/单步/存取往返均成立；单步与连续模拟的等状态一致性未逐点比对。 |
| Conclusion (EN) | Rigid link lengths stay constant across the whole motion cycle under independent recomputation (range ≤ 0.17 px), and pause, stepping and save/recall round-trips all hold; step-versus-continuous equivalence was not compared point by point. |
| 阶段总评 | [../../../Reviews/ai/maintenance-agent-v2/phase-summary.md](../../../Reviews/ai/maintenance-agent-v2/phase-summary.md) |
| 取证 | [../../../evidence/evaluation-2026-09-10/checks.json](../../../evidence/evaluation-2026-09-10/checks.json)（脚本 `evaluate*.mjs` 同目录） |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：四杆与曲柄滑块示例、关节/连杆/滑块/轨道编辑工具、电机设置、关节表、存取、JSON 导入导出、轨迹、视图选项齐全 ✅。
- **实测·连杆长度（**独立复算**）**：以应用自身的关节坐标读数采样 22 次（四杆一次运行 + 曲柄滑块一次运行），复算关节间距离：Rocker P1-B 180.0（极差 **0.096 px**）、Coupler A-B 260.0（**0.140**）、ArmA A-C 141.2（**0.125**）、ArmB B-C 141.2（**0.167**）→ 刚性连杆长度在运动全程恒定 ✅。应用自报 `max link error ≤ 2.8e-14`、`max slider off-track 0.0e+0`，与复算一致。
- **实测·暂停与单步（独立测量）**：暂停后画布变化像素比例为 **0**、单步后几何改变且随后保持稳定 ✅。
- **实测·存取往返（独立测量）**：Store → New（画布确实改变）→ Recall：画布与存档前**逐像素相同** ✅。另有 Save file / Load file、Export JSON ↓ / Import JSON ↑。
- **实测·两种机构**：四杆与曲柄滑块在 Play 下均在运动；页脚实时显示关节数/连杆数/最大误差 ✅。
- **未独立验证**：① 「单步结果与连续模拟在等状态一致」只验证了单步会产生改变且随后稳定，未逐点比对；② 退化轨道/长度导入的自动修复与告警（模型自述）；③ 拖动关节时临时释放电机 pin 的近似（模型自述，应用内已注明）。
- **扣分**：等状态一致性未逐点比对（−3）；退化输入修复未测（−3）；拖动时释放电机 pin 属近似（−2）。

- **方法**：静态结构分析 + 组织者自建静态服务下的 Chromium 无头渲染与交互探针（`evidence/evaluation-2026-09-10/`），**未运行成果自带脚本**；视觉维度由视觉桥接模型描述，评价者本人不具备图像输入能力。
- **评分不可跨模型比较**：与第一阶段 DeepSeek 的历史分数口径、harness 与预算均不同。

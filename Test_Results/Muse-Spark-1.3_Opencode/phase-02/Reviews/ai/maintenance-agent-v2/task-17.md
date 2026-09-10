# task-17 机械腕表机芯动画 · AI 评价（maintenance-agent-v2）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v2 |
| 评价日期 | 2026-09-10 |
| 本题得分 | **88/100** |
| 结论（中） | 齿轮反向啮合与转速差异经独立测量成立，暂停/调速不破坏相位；摆轮摆幅与齿面接触只有间接证据。 |
| Conclusion (EN) | Opposite rotation of meshing gears and clearly different gear speeds are independently measured, and pause/speed changes do not corrupt phase; balance-wheel amplitude and tooth contact rest on indirect evidence only. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 取证 | [../../../evidence/evaluation-2026-09-10/checks.json](../../../evidence/evaluation-2026-09-10/checks.json)（脚本 `evaluate*.mjs` 同目录） |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：指针/齿轮/擒纵/摆轮/发条均存在且有文字标注 ✅（BARREL · MAINSPRING、ESCAPE、PALLET、BALANCE、THIRD、FOURTH、SQUELETTE、18000 VPH）；暂停/继续与速度滑块 ✅。
- **实测·啮合方向（独立测量）**：1.5 s 内共 **29 个**带 `rotate()` 的元素发生转动，其中 **14 个顺时针、15 个逆时针** → 存在反向转动对，符合啮合齿轮的反向关系 ✅。
- **实测·转速差异（独立测量）**：角速度跨度极大：最快 −179.3°/1.5 s，最慢约 2.1°/1.5 s → 不存在「所有元素同一速度」的错误 ✅。小幅净位移元素（约 ±2°/1.5 s）与摆轮往复运动一致（**未测摆幅**）。
- **实测·控制**：暂停后画面冻结、恢复后继续；速度滑块由 1 调到 2.5 后画面仍连续变化；控制台无错误 ✅。
- **未独立验证**：① 齿面是否真正互相啮合（只有视觉桥接描述为分层示意图，可见约 7 个齿轮体）；② 摆轮摆动幅度与擒纵节拍相位；③ 冲量瞬间的齿面滑动（模型自述被时间平均平滑掉）。
- **扣分**：摆轮/擒纵相位未逐帧测量（−5）；齿面接触仅间接证据（−4）；轮系为时间平均的平滑运动（模型自述）（−3）。

- **方法**：静态结构分析 + 组织者自建静态服务下的 Chromium 无头渲染与交互探针（`evidence/evaluation-2026-09-10/`），**未运行成果自带脚本**；视觉维度由视觉桥接模型描述，评价者本人不具备图像输入能力。
- **评分不可跨模型比较**：与第一阶段 DeepSeek 的历史分数口径、harness 与预算均不同。

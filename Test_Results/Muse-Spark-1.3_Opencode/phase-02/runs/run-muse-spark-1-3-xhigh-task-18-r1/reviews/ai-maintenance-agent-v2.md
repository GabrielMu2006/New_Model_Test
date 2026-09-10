# task-18 · AI 评价（maintenance-agent-v2）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v2 |
| 评价日期 | 2026-09-10 |
| 本题得分 | **88/100** |
| 结论（中） | 8 阶段链条、暂停冻结、步进精度与重置都经实测成立；重复性与跨视口/帧率鲁棒性样本不足。 |
| Conclusion (EN) | The 8-stage chain, pause freezing, exact stepping and reset are all measured; repeatability and viewport/frame-rate robustness are only lightly sampled. |
| 阶段总评 | [../../../Reviews/ai/maintenance-agent-v2/phase-summary.md](../../../Reviews/ai/maintenance-agent-v2/phase-summary.md) |
| 取证 | [../../../evidence/evaluation-2026-09-10/checks.json](../../../evidence/evaluation-2026-09-10/checks.json)（脚本 `evaluate*.mjs` 同目录） |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：画布上标注 S1 RELEASE → S8 FINISH 共 **8 个阶段**，文字明确「Nothing advances on a timer — every stage is triggered by contact / position / momentum」；含 Start/Pause/Resume/Reset/Step 1 frame/Step 0.5 s/速度滑块/声音 ✅。
- **实测·暂停（独立测量）**：点击 `#btnPause` 后应用自报时间 `#hudTime` 由 1.62 s 保持 1.62 s 不变，**canvas 元素截图逐像素不变** ✅（HUD 文案变为 `Paused — Step to inspect handoffs`）。
- **实测·步进精度（独立测量）**：Step 1 frame → 时间 +0.01 s（60 fps 一帧）；Step 0.5 s → 恰好 **+0.500 s** ✅。
- **实测·阶段推进与重置**：一次连续运行观测到 `1/8 → 2/8 → 6/8 → 7/8 → 🎉 Complete! t=11.2s`；Reset 后时间回到 **0.00 s**、HUD 回到 `Ready — press Start` ✅。
- **未独立验证**：① 只完整跑通 1 次、重置 1 次，重复性与「无残留状态/无永久死锁」样本不足；② 跨视口与跨帧率鲁棒性（仅 1280×800 单帧率）；③ 8 个阶段之间的接触触发关系未逐帧核验（依据画布标注与 HUD 状态）。
- **扣分**：重复性样本不足（−4）；跨视口/帧率未测（−5）；因果衔接未逐帧核验（−3）。

- **方法**：静态结构分析 + 组织者自建静态服务下的 Chromium 无头渲染与交互探针（`evidence/evaluation-2026-09-10/`），**未运行成果自带脚本**；视觉维度由视觉桥接模型描述，评价者本人不具备图像输入能力。
- **评分不可跨模型比较**：与第一阶段 DeepSeek 的历史分数口径、harness 与预算均不同。

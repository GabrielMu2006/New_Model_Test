# task-16 鹈鹕骑车动画 SVG · AI 评价（maintenance-agent-v2）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v2 |
| 评价日期 | 2026-09-10 |
| 本题得分 | **85/100** |
| 结论（中） | 单文件零依赖的动画 SVG 成立，暂停/继续实测能整体冻结与恢复；但最关键的「脚始终踩在踏板」只有模型自述与单帧视觉支持，未独立逐帧测量。 |
| Conclusion (EN) | A self-contained animated SVG that really freezes and resumes; however the key requirement (feet staying on the pedals) rests on the model's self-report plus one visual frame, not on independent frame-by-frame measurement. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 取证 | [../../../evidence/evaluation-2026-09-10/checks.json](../../../evidence/evaluation-2026-09-10/checks.json)（脚本 `evaluate*.mjs` 同目录） |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：动画 SVG ✅；单文件、零外部依赖 ✅（全文件唯一的 `http://` 是 SVG 命名空间声明）；车轮/曲柄/脚踏转动 ✅；背景滚动 ✅；暂停与继续控件 ✅。
- **实测（Chromium 无头，组织者自建服务）**：42 个 SMIL 动画元素；未暂停时画面持续变化；点击 `#pauseBtn` 后间隔 800 ms 的两次截图**逐像素相同**、状态文本变为 `paused`；点击 `#playBtn` 后恢复变化 ✅。控制台无错误。
- **结构**：`viewBox="0 0 800 450"`、`<title>`、`<desc>`、`role="img"`、`aria-label` 齐全；按钮与状态文本内建在 SVG 内。
- **未独立验证**：① 脚踝与踏板的逐帧偏差（模型自述用两段 IK 烘焙、弦误差 <0.1 px，属自述）；② 「无倒滑/无滑动」；③ 动画平滑度。
- **已知限制（模型自述，原样记录）**：以 `<img>` 嵌入时内联脚本不执行、暂停按钮无效；需以文档方式打开 SVG。
- **扣分**：脚部约束未独立验证（−6）；无倒滑要求未测量（−4）；暂停控件依赖打开方式（−3）；视觉维度由视觉桥接模型描述而非评价者直读图像（−2）。

- **方法**：静态结构分析 + 组织者自建静态服务下的 Chromium 无头渲染与交互探针（`evidence/evaluation-2026-09-10/`），**未运行成果自带脚本**；视觉维度由视觉桥接模型描述，评价者本人不具备图像输入能力。
- **评分不可跨模型比较**：与第一阶段 DeepSeek 的历史分数口径、harness 与预算均不同。

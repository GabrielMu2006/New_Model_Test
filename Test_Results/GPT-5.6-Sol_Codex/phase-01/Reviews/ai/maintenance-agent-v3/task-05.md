# task-05 · 侧面骑自行车的人 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-05` |
| runId | `run-gpt-5-6-sol-task-05-r1` |
| 本题得分 | **89/100** |
| 结论（中） | 题目三条不可协商约束（左脚在下踏板、右脚在上踏板、双手握把）在独立盲看中全部成立，自行车结构完整；扣分主要来自纯侧视下左右身份无法由评价者独立判定，且根元素未给尺寸。 |
| Conclusion (EN) | All three non-negotiable constraints — left foot on the lower pedal, right foot on the upper pedal, both hands on the handlebars — held up in an independent read, with a structurally complete bicycle; the deductions come from an inability to independently verify left/right identity in a pure side view and from a root element without explicit dimensions. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照（逐条）**：侧面观察的人骑车 ✅（严格侧视）；**左脚在下踏板** ✅；**右脚在上踏板** ✅；**双手均握住车把** ✅；可独立打开的 SVG ✅（`viewBox="0 0 1200 760"`）；无外部依赖 ✅。

- **独立盲看取证**：视觉桥接模型在不看题目的情况下报告——"侧视红色公路车，骑者戴红头盔，**双手都握在黑色弯把上**，**左脚在下踏板（约 6 点方向）、右脚在上踏板（约 12 点方向）**，两轮为完整圆形并带辐条，车架、曲柄、踏板齐全，**没有被裁切、悬浮或结构断裂的元素**，姿态与向前踩踏一致"。题目点名的三类失败模式（脚悬空、踏板反转、单手接触/仅靠近车把）均未出现。

- **实测（Chromium 无头）**：控制台错误 0、请求失败 0、外部请求 0；`<title>` / `<desc>` / `role="img"` / `aria-labelledby` 齐全。

- **扣分**：
  - 需求符合度 −2：理论成果特别强调"左右身份不能因画面镜像而含糊"。在纯侧视图中，**评价者无法独立判定哪条腿是解剖学左腿**——现有结论依赖模型自己在 `<desc>` 中的断言与桥接模型对该断言的复述；这正是本题最容易被"看起来对"掩盖的一条。
  - 正确性 −2：未做关节/接触点的坐标级测量（如输出脚踝与踏板的坐标距离）。
  - 视觉与产品感 −2：扁平风格配色统一，但只有单尺寸查看。
  - 工程组织 −3：根元素**只有 `viewBox` 而没有 `width`/`height`**，嵌入到某些宿主时尺寸由宿主决定；本题未做任何渲染自检（2 次 `exec_command`，无 `view_image` 记录）。
  - 亮点补偿 +1（计入视觉维度）：画面完整度高于题目下限（头盔、太阳、地面、完整的轮辐）。

- **局限**：左右腿身份的判定是本题最关键的验收点，而本次只有**单帧视觉 + 模型自述**两项间接证据；未做骨骼坐标复算，也未做镜像反例对照。

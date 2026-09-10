# task-08 · 单文件打砖块游戏 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-08` |
| runId | `run-gpt-5-6-sol-task-08-r1` |
| 本题得分 | **83/100** |
| 结论（中） | 真单文件零依赖、可玩且观感精致，启动/计分/暂停经实测成立；但过关后球不自动发射而唯一的发射入口是画布点击，`Space` 仅绑暂停——纯键盘玩家从第 2 关起无法继续，且全程无音效。 |
| Conclusion (EN) | A genuinely self-contained, playable and visually polished game whose launch, scoring and pause were verified at runtime; however after a level clear the ball never re-launches and the only launch entry point is a canvas click while Space is bound to pause — so a keyboard-only player is stuck from level 2 onward, and there is no audio at all. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**：单 HTML 文件 ✅（唯一产物 25.9 KB，样式与脚本全部内联）；无需构建、无需服务器、可离线打开 ✅；挡板/球/砖块/碰撞/得分/生命/关卡 ✅；开始/暂停/继续/失败/重开/通关状态 ✅；"精致" → HUD、统一美术风格、动效齐备 ✅，**音效缺失 ✗**。

- **实测（Chromium 无头，组织者自建静态服务）**：控制台错误 0、页面异常 0、请求失败 0、**外部请求 0**（全文件唯一的 `url()` 是内联 `data:` SVG）；点击 `LAUNCH BALL` 后 2.5 秒得分由 `000000` → `000105`，球确实在运动并击砖；按 `Space` 正确进入 `SYSTEM HOLD PAUSED` 覆盖层。

- **代码级核验（成立项）**：碰撞使用按速度自适应的子步细分（子步步长 `≤ r*1.2`），从机制上抑制高速穿透；打板出射角被封顶在 60°（`|vy| ≥ 0.497·speed`），**从机制上排除了水平死循环**；`visibilitychange` 自动暂停；`prefers-reduced-motion`、`:focus-visible`、画布与状态区的 ARIA 标签齐备。

- **高危缺陷（源码可判定，未做端到端通关复现）**：`levelClear()` 在通过第 N 关后把 `state` 置为 `paused` 并 `resetBoard()`，此时球为 `stuck`；"Continue" 按钮只调用 `pauseToggle()`（不发射），而**唯一的发射入口**是画布 `pointerdown` 分支中的 `state==='playing' && ball.stuck` 判断；`Space` 只绑 `pauseToggle`，但界面提示却写着 "Space launch / pause"。对比：掉球后代码有 650 ms 自动发射（`loseLife`），过关后**没有**对应逻辑——因此**纯键盘玩家从第 2 关起无法发球**（鼠标/触屏用户可点画布补救）。

- **其余缺陷**：全程无 `AudioContext` 或任何音频（题目"精致"与本项目理论成果的"适度音效"均未覆盖）；画布坐标空间被强制 ≥280×320 而 CSS 盒高由网格剩余空间决定，视口高度不足时位图被**非等比拉伸**（球成椭圆）且 `body{overflow:hidden}` 无滚动兜底；`moveBall` 的子步循环内 `return` 只跳出一步，同帧可二次扣命（生命可显示为负）；`slow` 道具只改速度分量不改 `ball.speed`，下一次打板即还原；暂停/结束覆盖层空白处无点击处理，与触屏提示 "Tap to launch / pause" 不符；`ctx.roundRect` 无回退。

- **扣分**：需求符合度 −8（键盘主流程断裂 −5、无音效 −3）；完整度 −1；正确性 −5；工程组织 −2。视觉维度 9/10（盲看判定为刻意的霓虹复古风格、HUD 清晰）。

- **亮点**：出射角封顶与自适应子步是两处"结构性正确"的设计，而非靠调参掩盖问题；状态机完整含胜利与自动暂停。

- **局限**：过关后卡死的结论来自**代码走查**（已定位到具体分支与绑定），未做端到端通关复现；音效缺失来自全文检索（`AudioContext`/`audio` 命中 0）；视觉结论来自视觉桥接模型。

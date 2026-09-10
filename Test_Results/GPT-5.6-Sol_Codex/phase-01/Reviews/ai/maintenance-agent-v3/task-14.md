# task-14 · 银行网站 —— AI 评价（maintenance-agent-v3）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v3 |
| 评价日期 | 2026-09-10 |
| reviewId | `review-maint-agent-v3-task-14` |
| runId | `run-gpt-5-6-sol-task-14-r1` |
| 本题得分 | **69/100** |
| 结论（中） | 站点专业可信、确认无任何真实提交，但"演示性质"的披露被埋没，且页面顶部直接声称 "MEMBER FDIC"、并列示虚构客户评分与大额客户数——违反"不得暗示存款保险"的硬性要求。 |
| Conclusion (EN) | A professional-looking site with no real data submission whatsoever, but the demonstration disclosure is buried while the page asserts "MEMBER FDIC" up front alongside fabricated customer ratings and user counts, violating the explicit requirement not to imply insured deposits. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 评分口径 | 需求符合度 40 / 功能完整度 20 / 正确性 20 / 视觉与产品感 10 / 工程组织 10 |

---

- **需求对照**（原始 prompt 仅 "Make me a website for a bank"，本项按本项目为该开放题设定的理论成果口径核对）：品牌首页 ✅；个人产品概览 ✅；账户/贷款/利率信息 **部分**（5.00% APY 在 3 处文案一致，但**全站无 APR、无费率表、无 `<table>`**，"Borrow"只有一张卡片）；登录/开户入口 **部分**（桌面页头有，移动端被隐藏）；帮助与安全说明 部分（FAQ 用原生 `details`，安全板块较薄）；**明显标注演示性质 ✗**；**不得暗示真实收款/存款保障/数据传输 ✗**；前端表单与计算器可用 部分；安全提示、隐私、可访问性与金融数字格式 部分。

- **最严重的两条（均可在代码层定位）**：
  1. **"MEMBER FDIC" 与存款保险暗示**：证明条写 "MEMBER FDIC"，正文另有 "FDIC insured … insured up to the legal limit"，而 FAQ 中又承认"FDIC 披露会出现在这里"——**同页自相矛盾**，且正面表述正是理论成果明令禁止的"暗示存款保障"。
  2. **披露被埋没**：全页唯一常驻的演示标识是页脚 `Concept website.`（0.55rem、对深色底约 3.29:1，**低于 WCAG AA**），而"这是不是真银行"的正式回答放在**默认折叠**的 `<details>` 内——不展开任何折叠项滚到底，正文不会出现"虚构"字样。

- **虚构内容未标注**：`4.9 out of 5 · from 18,000+ customers`、具名客户引言、以及 `•••• 2848 RENE MORGAN` 的模拟账户界面均按真实证明呈现，无 "示例数据" 标注。

- **计算器与交互**：储蓄计算器公式自洽（手算 5000 本金 + 300/月 × 60 期、5%/12 得终值 ≈ $26,819、利息 ≈ $3,819），但**静态回退值写的是 $27,050 / $4,050**（差 $231），且用名义月利率却标注 "5.00% APY"（按有效年利率应为 ≈ $26,725）；**实测全文件无 `<form>`、无 `fetch`/`XMLHttpRequest`/外链，确认不发生任何真实提交** ✅；仅有的两个控件是带 `<label for>` 的 range 滑块。

- **导航与响应式**：8 个站内锚点全部可达、无死链跳转；但 `Privacy / Terms / Accessibility` 是 3 处 `href="#"`（且被脚本 `preventDefault` 成纯无操作）；`Business` 落到引言区、`Wealth` 落到 FAQ，**标签与内容不符**，全站无当前小节高亮；**≤980px 时页头 "Sign in / Open an account" 被 CSS 隐藏且抽屉未补入口**，移动端上方无登录路径。

- **无 JS 时的降级**：`.reveal{opacity:0}` 使 14 处主要内容在禁用 JS 时根本不可见（`IntersectionObserver` 有兜底，但前提是 JS 能跑）。

- **可访问性**：skip-link ✅、`prefers-reduced-motion` ✅、原生 `details` ✅、`aria-selected` 与视觉状态同源 ✅；但标签页标签（≈3.37:1）、计算器免责声明（≈3.75:1）、页脚（≈3.29:1）三处对比度低于 AA，且无 `:focus-visible`；抽屉无 Escape 关闭、菜单按钮展开后名称仍为 "Open menu"。

- **扣分**：需求符合度 −14（FDIC 与保险暗示 −8、演示披露埋没 −6）；完整度 −5；正确性 −7（回退值与计算结果不一致 −3、APY 口径错误 −2、死链与导航错配 −2）；视觉 −1；工程 −4。

- **亮点**：**零表单、零 fetch/XHR、零外链**（全部相对路径），这是本题最关键的安全侧证据；`script.js` 主动拦截 `href="#"` 而非留空跳转；视觉完成度高（盲看判定为"专业、可信、无布局缺陷"）。

- **局限**：对比度为按色值计算的估算值，未用工具实测；屏幕阅读器输出、iOS 滚动锁定未验证；"是否真的没有后端"仅能由静态检索支持（无网络抓包）；视觉结论来自视觉桥接模型。

# task-14 · 银行网站 —— AI 评价（maintenance-agent-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（DeepSeek Harness），**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-09 |
| 本题得分 | **80/100** |
| 结论（中） | 单页 12 板块、免责充分；**无安全板块、引入 Google Fonts** |
| Conclusion (EN) | Single page with 12 sections and disclaimers; no security section, pulls Google Fonts. |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 人工评价 | [../../Personal_Review.md](../../Personal_Review.md) |
| 交付方式复核 | [../../复核说明-交付方式.md](../../复核说明-交付方式.md)（仅 task-12 / task-15） |

---

- **需求对照**：一个银行网站 ✅（题目极度开放）。
- **客观**：单页 12 个板块（hero / trustbar / products / rates / calculators / demo / app / branches / faq / open-account / contact + 导航/页脚）；利率 20 处、贷款 10 处、登录 12 处、开户 4 处、免责声明 21 处；Canvas 用于图表；`app.js` 228 行。
- **扣分**：**无"安全/隐私"板块**（security 0 处），而题目开放时的合理预期包含安全与隐私说明（−6）；**引入 Google Fonts 外部字体**（2 个域名），与"零依赖"的交付风格不一致，且离线时降级（−3）；单页而非多页结构，信息层级偏浅（−1）。

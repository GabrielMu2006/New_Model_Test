# task-14 · 银行网站 —— AI 评价（codex-v1）

| 项 | 值 |
| --- | --- |
| 评价者 | Codex Desktop 0.153.4 / GPT-5，**非盲评** |
| 评价版本 | v1 |
| 评价日期 | 2026-09-09 |
| 本题得分 | **88/100** |
| 结论（中） | 直接通过 |
| Conclusion (EN) | Pass |
| 阶段总评 | [phase-summary.md](phase-summary.md) |
| 人工评价 | [../../Personal_Review.md](../../Personal_Review.md) |

---

**结论：直接通过，完成度远超一般展示页，但有合规表达风险。**

网站包含账户产品、利率表、储蓄/贷款计算器、转账演示、交易记录、分行、FAQ、开户流程和联系表单。桌面和 390 px 移动端的主内容均可用，且有跳转主内容、语义标签和可发现的表单提示。

风险在于首页高显著位置使用 `Member FDIC`、`Equal Housing Lender`、虚构路由号、资产量和客户数，而“Demo site — not a real bank”只以较小文字出现在首屏下方与页脚。用户在看到声明前可能误认为真实机构。此外，页面从 Google Fonts 加载两个外部字体资源；断网时仍能用系统字体降级，但并非完全自包含。

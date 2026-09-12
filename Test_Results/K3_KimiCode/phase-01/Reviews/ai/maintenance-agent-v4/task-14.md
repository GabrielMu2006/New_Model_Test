# task-14 · 银行网站 —— AI 评价（maintenance-agent-v4）

| 项 | 值 |
| --- | --- |
| 评价者 | 维护 agent（Codex），非盲评 |
| 评价版本 | v4 |
| 评价日期 | 2026-09-12 |
| reviewId | `review-maint-agent-v4-task-14` |
| runId | `run-k3-task-14-r1` |
| 本题得分 | **91/100** |
| 结论（中） | 八页银行站、储蓄/贷款计算器、表单、演示登录与转账形成完整产品；演示声明充分，但首屏存款保护数字仍可能先被误认为真实承诺。 |
| Conclusion (EN) | An eight-page bank site with savings/loan calculators, forms, demo login, and transfers forms a complete product; disclaimers are substantial, but the hero-area deposit-protection number can still be mistaken for a real promise before its footnote is seen. |
| 评分口径 | 需求符合 35 / 完整度 19 / 正确性 18 / 视觉 10 / 工程 9 |

- 首页、Personal、Business、Loans、About、Contact、Login、Dashboard 共八页，导航和移动菜单完整；视觉专业且一致，390px 首页无溢出。
- 储蓄样例（$5,000 初始、$300/月、5 年、4.60% APY）实测输出 `$26,407.40`；演示账号登录可进入 dashboard，转账只修改内存余额。表单统一 `preventDefault()`，无 `fetch`/XHR，明确提示不要输入真实凭据。
- 免责声明总体比同类产物严谨：首页后段写明所有利率、余额、保护声明和证言均为 illustrative，每页页脚写“fictional demo”。但首屏 trust bar 仍先展示“Deposits protected up to $250,000*”，与理论口径“不得暗示存款保障”存在张力；首页 92,000+ 成员等虚构社会证明也需要用户滚动到后文才确认性质。


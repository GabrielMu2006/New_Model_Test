# M0 来源审计 / Source audit

审计基线提交：`5776d3a1d94dc4b04d83fa94d482e04478fd4076`。15 条任务均从 `15_TEST_PROMPTS_BILINGUAL.md` 映射；会话与指标从评测复盘第 29–70 行映射；人工评价与 AI 评价分别来自 `Personal_Review.md` 和 `15-任务完成质量评估.md`。

## 映射

| 任务 | 会话 | 成果 | 类型 |
|---|---|---|---|
| 01 | 89716f93 | Aevum `index.html` | HTML |
| 02 | 0e1e035d | `pelican-on-bicycle.svg` | SVG |
| 03–04 | 17e6215c | 两个时钟 SVG | SVG |
| 05–07 | 4a0d64ce | 三个动作 SVG | SVG |
| 08 | 2579bde9 | Breakout `index.html` | HTML |
| 09 | 28e77186 | Farming `index.html` | HTML |
| 10 | da8df324 | Pixel editor `index.html` | HTML |
| 11 | 2d2be5e2 | Floor plan app | HTML |
| 12 | f87c54e3 | Calculator app | HTML |
| 13 | 31de8e10 | Weather dashboard | HTML |
| 14 | 214420b0 | 9-page bank site | HTML |
| 15 | b25a11c4 | Book tracker | HTML |

## 保留的分歧与边界

- Task 06：人工评价认为手和剪刀“很奇怪”，历史 AI 报告给 92/100 并认为关系明确。
- Task 07：人工评价指出人体、车体和轮位问题，历史 AI 报告给 95/100 并认为推动关系明确。
- `93.6/100`、`15/15` 仅引用历史 AI 报告，不作为展示站独立证明。
- 截图和报告可能晚于初始生成；源码链接固定到上述归档提交，不声称所有文件等同于生成瞬间版本。
- ¥9.30 只有批次口径；不导出单题费用。

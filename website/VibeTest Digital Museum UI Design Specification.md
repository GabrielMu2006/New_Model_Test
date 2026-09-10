# VibeTest Digital Museum UI Design Specification

## 1. Design Direction

VibeTest 的整体 UI 采用：

**Digital Museum / AI Works Exhibition**

核心不是传统的 AI Benchmark、Leaderboard 或 SaaS Dashboard，而是把每一次模型生成结果理解为：

- 一件作品
- 一个实验样本
- 一份可追溯档案
- 一次模型对相同任务的“创作解释”

网站的视觉目标不是强调“谁排名第一”，而是让用户能够自然地观察：

1. 不同模型实际生成了什么
2. 同一任务下不同模型的视觉与交互差异
3. 每个结果对应怎样的运行过程
4. 人工评价和 AI 评价分别如何判断
5. 每个结果是否具备完整、可信、可验证的来源记录

因此，整体设计应该更接近：

**数字美术馆 + 编辑出版物 + 实验档案馆**

而不是：

**排行榜 + 数据大屏 + 管理后台**

---

# 2. Core Design Principles

## 2.1 Artwork First

页面中最重要的内容始终是：

**模型真正生成出来的作品。**

用户进入网站后，应该首先看到作品，而不是：

- Token 数
- API Calls
- Benchmark Score
- 模型参数
- 排行名次

这些信息属于第二层。

设计优先级：

```text
Artwork
↓
Task
↓
Model
↓
Evaluation
↓
Execution Metadata
↓
Evidence
```

---

## 2.2 Archive Instead of Ranking

VibeTest 不应该形成传统排行榜视觉。

避免以下设计：

- 巨大的 No.1 / No.2 / No.3
- 金银铜色
- 大面积分数圆环
- Overall Score 排名表
- Trophy 图标
- Winner 标签

改为：

```text
ARCHIVE 001

TASK 01
WORK A
RUN 03

DeepSeek V4.1 Flash

Archived
Verified
```

强调：

**记录，而不是排名。**

---

# 3. Brand Concept

品牌核心语句：

```text
VibeTest

An archive of things
AI models actually made.

记录模型真正创造出来的东西。
```

辅助说明可以采用：

```text
Same prompts.
Real outputs.
Independent reviews.
Verifiable evidence.
```

中文：

```text
相同题目
真实输出
独立评价
可验证记录
```

---

# 4. Overall Visual Style

整体视觉关键词：

```text
Museum
Editorial
Archive
Minimal
Warm
Quiet
Precise
Crafted
```

不要采用明显 Cyberpunk / Neon / AI Gradient 风格。

避免：

```text
紫蓝渐变
玻璃拟态
大面积发光
彩色 Dashboard
过度圆角
科技粒子背景
```

VibeTest 应该给人的感觉是：

> 一个真正认真保存 AI 作品与实验记录的数字档案馆。

---

# 5. Color System

## Primary Background

```text
Museum Canvas
#F1EFE9
```

作为整个网站主背景。

略带暖色，而不是纯白。

---

## Paper Surface

```text
Paper
#FAF9F6
```

用于：

- 卡片
- 内容区域
- 弹窗
- Preview Container

---

## Main Text

```text
Ink
#161616
```

不要使用纯黑：

```text
#000000
```

以减少数字屏幕上的强烈对比。

---

## Secondary Text

```text
Muted Ink
#686661
```

用于：

- Metadata
- 描述
- 时间
- 标签
- 辅助说明

---

## Border

```text
Hairline
#D8D5CE
```

所有 Border 尽量保持：

```text
1px
```

---

# 6. Accent Colors

色彩使用必须极度克制。

## Museum Red

```text
#E64132
```

用于：

- 当前导航
- Task 编号
- Highlight
- Failed
- Important Marker

---

## Archive Blue

```text
#3454D1
```

可以作为 DeepSeek 等某个模型的识别色。

---

## Muse Pink

```text
#D55C88
```

---

## GPT Green

```text
#2E7D5B
```

---

模型颜色只用于：

```text
● DeepSeek
● Muse
● GPT
```

或者非常细的：

```text
3px top border
```

不要整张卡填充模型品牌色。

---

# 7. Typography

整个 UI 建议采用三套字体逻辑。

---

## 7.1 Display Typography

用于：

- VibeTest
- Hero
- Task Name
- Exhibition Title
- 数字

风格：

```text
High Contrast Serif
```

推荐：

```text
Instrument Serif
Playfair Display
Cormorant Garamond
DM Serif Display
```

如果中文使用衬线字体：

```text
思源宋体
Source Han Serif
```

---

## 7.2 Interface Typography

用于：

- 导航
- 正文
- 按钮
- Filter
- Card

推荐：

```text
Inter
Geist
Source Han Sans
Noto Sans SC
```

---

## 7.3 Archive Metadata

用于：

- Run ID
- Commit
- Task ID
- Token
- Timestamp
- Snapshot
- Harness
- Session

使用：

```text
IBM Plex Mono
JetBrains Mono
SF Mono
```

---

# 8. Typography Scale

Desktop：

```text
Hero Title
72–96px

Page Title
52–64px

Task Title
42–56px

Section Title
28–32px

Card Title
18–22px

Body
15–17px

Small Text
13–14px

Metadata
11–12px
```

Hero 行高：

```text
0.95–1.05
```

正文行高：

```text
1.6–1.8
```

---

# 9. Layout Grid

Desktop：

```text
Max Width
1440px

Content Width
1280px

Grid
12 columns

Gap
24px

Page Padding
40–64px
```

Tablet：

```text
24–32px padding
```

Mobile：

```text
16–20px padding
```

---

# 10. Border Radius

整体不要太圆。

建议：

```text
Small Component
4px

Card
6px

Preview
6px

Large Panel
8px
```

不要：

```text
16px
24px
32px
```

否则会失去 Museum / Editorial 气质。

---

# 11. Header

顶部 Header 应该保持很薄。

Desktop：

```text
Height
64–72px
```

结构：

```text
VIBETEST

Overview
Phases
Models
Tasks
Compare
Methodology

Search
中文 / EN
GitHub
```

VibeTest 下方可以小字显示：

```text
MODEL EVALUATION ARCHIVE
```

---

## Active Navigation

不要做传统 Pill。

采用：

```text
Tasks
──────
```

或者：

```text
● Tasks
```

Underline 推荐：

```text
1px / 2px
```

---

# 12. Archive Number

网站应该建立统一档案编号。

Header 可显示：

```text
ARCHIVE 001 / 2026
```

未来如果有新的 Benchmark：

```text
ARCHIVE 002
ARCHIVE 003
```

这样可以形成长期品牌资产。

---

# 13. Homepage

首页不是 Dashboard。

首页应该更像：

**Exhibition Landing Page**

---

# 14. Homepage Hero

Desktop 使用：

```text
6 columns text
6 columns artwork / exhibition visual
```

左：

```text
ARCHIVE 001 / 2026

VibeTest

An archive of things
AI models actually made.

记录模型真正创造出来的东西。

在相同的题目下，
比较不同模型的真实作品、
运行证据与独立评价。

[ 浏览任务 → ]

[ 对比作品 → ]
```

---

右侧可以使用：

- 精选作品截图
- 非对称作品拼贴
- Museum Wall Visual

但尽量不要使用普通 Hero Illustration。

---

# 15. Homepage Statistics

不要使用普通 SaaS 卡片。

使用横向数字 Strip：

```text
03
MODELS

02
PHASES

55
RUNS

20 / 45
TASKS
```

中间用：

```text
1px divider
```

数字使用 Serif。

---

# 16. Archive Progress

首页可以显示：

```text
ARCHIVE PROGRESS

20 / 45

████████████████░░░░░░░░░░░░

44.4%
```

但 UI 要非常轻。

不要使用彩色大进度条。

---

# 17. Featured Works

首页的最重要区域。

标题：

```text
精选作品
FEATURED WORKS
```

使用 Gallery / Museum Wall。

Desktop 可以 4 columns。

例如：

```text
01
Aevum

[ large image ]

Luxury Watch Landing Page

HTML

● DeepSeek
● Muse
● GPT
```

---

# 18. Artwork Card

Artwork Card 是整个网站最重要的组件。

结构：

```text
01
Aevum

────────────────

[ Artwork Preview ]

────────────────

Luxury Watch Landing Page

HTML

3 archived runs

● DeepSeek ● Muse ● GPT

                       →
```

---

## Image Ratio

建议支持：

```text
4:3
3:2
1:1
```

不要强制所有任务使用完全相同截图比例。

但同一 Task 的不同模型必须保持一致比例。

---

# 19. Hover Interaction

Artwork Hover：

```text
Image scale
1 → 1.02

Duration
200–300ms
```

同时出现：

```text
View Task →
```

不要：

- 大阴影
- 旋转
- 强烈弹跳

---

# 20. Tasks Page

Tasks 页面应该从：

**Runs List**

重新定义为：

**Collection / Exhibition Index**

---

## Header

```text
TASK ARCHIVE

20 / 45 Tasks
55 Archived Runs
```

搜索框：

```text
Search task / prompt / model...
```

---

# 21. Task Filters

使用极简 Chip：

```text
All
HTML
SVG
Other
```

第二行：

```text
All Models
DeepSeek
Muse
GPT
```

第三行：

```text
All Phases
Phase 01
Phase 02
```

Selected：

```text
black background
white text
```

Unselected：

```text
transparent
1px border
```

---

# 22. Task Gallery

推荐：

```text
4 columns desktop
2 columns tablet
1 column mobile
```

每个 Task 只显示一次。

不要：

```text
Task 01 DeepSeek
Task 01 Muse
Task 01 GPT
```

重复三张。

而应该：

```text
Task 01

Aevum

[ Preview ]

3 Runs

DeepSeek · Muse · GPT
```

---

# 23. Task Detail Page

这是整个网站最重要的页面之一。

顶部：

```text
TASK 01 / HTML

Aevum

Luxury Watch Landing Page
```

下方：

```text
Original Prompt
```

默认展示前几行。

支持：

```text
Show full prompt
```

---

# 24. Three Interpretations

Task 页面核心 Section：

```text
THREE INTERPRETATIONS
同一题目的三种模型解释
```

Desktop：

```text
DeepSeek      Muse        GPT
```

三个结果必须：

- 同样宽度
- 同样高度
- 同样 Preview 比例

禁止突出“最佳模型”。

---

# 25. Task Comparison Cards

每个模型：

```text
MODEL 01

DeepSeek V4.1 Flash

[ Large Screenshot ]

04:51

24 API Calls
22 Tool Calls

96 / 100 AI Review

View Archive Record →
```

---

# 26. Compare Mode

用户点击：

```text
Compare
```

可以进入专门比较界面。

结构：

```text
TASK 01

[ DeepSeek ]   [ Muse ]   [ GPT ]

┌────────┬────────┬────────┐
│Preview │Preview │Preview │
└────────┴────────┴────────┘
```

---

# 27. Comparison Metrics

Preview 下：

```text
Runtime

04:51
03:22
05:08


API Calls

24
19
27


Tools

22
18
24


AI Review

96
91
94
```

数字左右对齐。

---

# 28. Model Page

不要做 Leaderboard Profile。

模型页面应该像：

**Artist Archive / Collection Profile**

---

# 29. Model Hero

```text
MODEL 01

DeepSeek V4.1 Flash

20 Archived Works

Phase 01
Phase 02
```

旁边可以展示：

```text
● Archive Active
```

---

# 30. Model Selected Works

标题：

```text
SELECTED WORKS
精选作品
```

使用 4 column Gallery。

用户第一眼看到：

> DeepSeek 到底做出了哪些东西。

而不是 Token 数据。

---

# 31. Model Archive Statistics

第二屏之后：

```text
ARCHIVE STATISTICS

20
Runs

05:24:18
Runtime

1,620
API Calls

xxx
Tool Calls
```

再显示 Token。

---

# 32. Phase Progress

```text
PHASE 01

15 / 15
Complete

━━━━━━━━━━━━━━━━━━━━


PHASE 02

5 / 30
In Progress

━━━━━━░░░░░░░░░░░
```

---

# 33. Run Detail Page

Run 页面重新定义为：

**Museum Object Record**

即：

> 一个单独 AI 作品的完整档案。

---

# 34. Run Hero

顶部：

```text
01 / 20

TASK 01

Aevum

Luxury Watch Landing Page

DeepSeek V4.1 Flash
```

模型名称旁：

```text
● DeepSeek
```

---

# 35. Live Preview

首屏核心必须是 Preview。

建议：

```text
Desktop Width
70–80vw

Min Height
650px
```

对于网页任务：

直接 iframe。

对于 SVG：

居中展示 SVG。

---

# 36. Preview Controls

Preview 下方：

```text
Open Fullscreen ↗

Open Independent Copy ↗

Reload
```

不要使用大量大按钮。

优先 Text Button。

---

# 37. Run Archive Record

作品之后：

```text
ARCHIVE RECORD
```

2–4 column Grid。

例如：

```text
RUN ID
run_deepseek_v41_task01_r1

RECORDED
2026.09.10

RUNTIME
00:04:51

API CALLS
24

TOOL CALLS
22

RETRIES
04

TOKENS
1.98M

HARNESS
DSH
```

Label：

```text
11px
uppercase
mono
```

Value：

```text
15–18px
```

---

# 38. Technical Metadata

详细字段折叠到：

```text
Technical Record
```

点击展开：

```text
Session
Commit
Snapshot
Isolation
Environment
Model Endpoint
Harness Version
```

不要一进入页面就全部展示。

---

# 39. Evaluation Section

重新命名：

```text
CRITICAL NOTES

Independent Evaluations
```

然后严格分成：

```text
01
HUMAN REVIEW

02
AI REVIEW
```

不要混合。

---

# 40. Human Evaluation

示例：

```text
01 / HUMAN REVIEW

PASS

Details need improvement

整体符合任务要求，
视觉完成度较高……

Source ↗
```

PASS 采用非常轻的：

```text
green dot
```

而不是巨大绿色标签。

---

# 41. AI Evaluation

```text
02 / AI REVIEW

96 / 100

DIRECT PASS

实际打开页面后……
```

96 可以使用：

```text
48px Serif
```

但不要使用：

- Radial Gauge
- Progress Circle
- 霓虹颜色

---

# 42. Source Evidence

页面最后：

```text
SOURCE EVIDENCE
```

采用类似档案索引：

```text
01
AI Evaluation
GitHub ↗

02
Human Evaluation
GitHub ↗

03
Run Metadata
JSON ↗

04
Generated Artifact
Archive ↗
```

---

# 43. Phases Page

Phase 页面应该像：

**Exhibition Season**

而不是普通版本列表。

---

## Example

```text
PHASE 01

FOUNDATION

15 Tasks
3 Models
45 Runs

Completed
```

下面：

```text
Selected Works
```

然后作品墙。

---

# 44. Phase Timeline

首页或者 Phase 页面：

```text
2026

PHASE 01
──────────────
15 Tasks
Completed


PHASE 02
──────────────
30 Tasks
In Progress
```

---

# 45. Methodology Page

Methodology 应该更像：

**Exhibition Catalogue Essay**

左侧：

```text
METHOD
```

正文保持非常大的可读宽度：

```text
620–760px
```

不要做成文档后台。

---

# 46. Method Principles

可以用编号：

```text
01
Same Prompts

02
Real Outputs

03
Independent Reviews

04
No Aggregate Ranking

05
Provenance First
```

每一条下面正文说明。

---

# 47. Search

Search 不要一直占用大量空间。

Header 只显示：

```text
⌕
```

点击打开 Command Palette。

---

# 48. Global Search Modal

```text
Search VibeTest

> Aevum
```

Results：

```text
TASK
01 Aevum

MODEL
DeepSeek

RUN
run-deepseek...
```

---

# 49. Status System

全站统一：

```text
● Archived
● Verified
◐ Partial
○ Pending
△ Warning
× Failed
```

---

# 50. Status Color

```text
Archived
Green

Verified
Blue

Partial
Amber

Pending
Gray

Failed
Red
```

颜色只作用于小圆点。

---

# 51. Numbering System

推荐全站统一编号体系。

```text
ARCHIVE 001

PHASE 01

TASK 01

WORK A

RUN 01.A.03

MODEL M01
```

---

# 52. Example Hierarchy

例如：

```text
ARCHIVE 001

TASK 01

AEVUM

WORK A

DeepSeek V4.1 Flash

RUN 01.A.01
```

另一个：

```text
WORK B
Muse

RUN 01.B.01
```

---

# 53. Card System

全站只使用三类主要卡片。

---

## Artwork Card

用于：

- 首页
- Tasks
- Model
- Phase

重点：

```text
Image 80%
Text 20%
```

---

## Archive Card

用于：

- Metadata
- Run Data
- Sources

重点：

```text
Data First
Mono Typography
```

---

## Curatorial Card

用于：

- Review
- Methodology
- Long Text
- Notes

重点：

```text
Readable Text
Large White Space
```

---

# 54. Buttons

Primary：

```text
Browse Tasks →
```

样式：

```text
background #161616
color white
radius 4px
```

---

Secondary：

```text
Compare Works →
```

样式：

```text
transparent
1px border
```

---

Text Button：

```text
View Record →
```

尽量大量使用 Text Button。

---

# 55. Icons

使用：

```text
Lucide
Phosphor
SF Symbols
```

统一：

```text
1.5px stroke
```

不要：

- Emoji
- 彩色图标
- 3D 图标

---

# 56. Shadows

Museum 风格不要依赖阴影。

默认：

```text
box-shadow: none
```

只有 Hover：

```text
0 8px 24px rgba(0,0,0,0.05)
```

非常轻。

---

# 57. Dividers

Divider 是整个设计的重要视觉语言。

大量使用：

```text
1px solid #D8D5CE
```

替代大面积 Card Container。

---

# 58. Whitespace

Section 间距：

```text
Desktop
120–160px

Tablet
80–120px

Mobile
64–80px
```

Card Gap：

```text
20–28px
```

---

# 59. Animation

所有动画保持极度安静。

建议：

```text
180–300ms
ease-out
```

允许：

```text
Fade
Small translate
Small scale
Underline animation
```

禁止：

```text
Bounce
Spring
Large zoom
Glow
3D rotate
```

---

# 60. Page Transition

进入 Task：

```text
Artwork image
→ smooth fade
→ Task Hero
```

不要复杂 shared-element animation。

---

# 61. Mobile Homepage

Mobile Header：

```text
VibeTest
           ☰
```

下面：

```text
ARCHIVE 001

VibeTest

An archive of things
AI models actually made.

记录模型真正创造出来的东西。
```

---

# 62. Mobile Stats

改为：

```text
03       02

Models   Phases


55       20/45

Runs     Tasks
```

2 × 2。

---

# 63. Mobile Featured Works

不要直接做纵向无限列表。

推荐横向：

```text
← swipe →
```

每张作品约：

```text
80vw
```

让用户有浏览展览的感觉。

---

# 64. Mobile Task Page

Desktop 三栏模型比较：

```text
DeepSeek
Muse
GPT
```

Mobile 改为 Tab：

```text
DeepSeek | Muse | GPT
```

下面只显示一个作品。

支持 Swipe。

---

# 65. Mobile Run Page

顺序：

```text
Title
↓
Preview
↓
Model
↓
Evaluation
↓
Metadata
↓
Evidence
```

不要把 Metadata 提到 Preview 之前。

---

# 66. Accessibility

正文至少：

```text
15px
```

对比度满足 WCAG AA。

任何状态不要只使用颜色。

例如：

```text
● Archived
```

而不是只显示绿色点。

---

# 67. Empty State

例如未来某 Task 只有 DeepSeek：

```text
Muse

Not archived yet.

This model has not completed
this task in Archive 001.
```

绝对不要自动填：

```text
N/A
0
```

因为“缺失即缺失”也是档案设计的一部分。

---

# 68. Loading

Loading 推荐 Skeleton。

作品：

```text
[ gray paper block ]
```

不要使用巨大的 Spinner。

---

# 69. Error State

例如 Preview 加载失败：

```text
Artwork unavailable

The archived artifact could not
be loaded.

View source →
```

---

# 70. Home Information Architecture

首页结构最终建议：

```text
HEADER

↓

HERO

↓

ARCHIVE STATISTICS

↓

FEATURED WORKS

↓

CURRENT EXHIBITION / PHASE

↓

MODELS IN ARCHIVE

↓

RECENTLY ARCHIVED

↓

METHODOLOGY INTRO

↓

FOOTER
```

---

# 71. Tasks Information Architecture

```text
HEADER

↓

TASK ARCHIVE HERO

↓

SEARCH + FILTERS

↓

TASK GALLERY

↓

ARCHIVE PROGRESS

↓

FOOTER
```

---

# 72. Task Detail Information Architecture

```text
TASK HERO

↓

ORIGINAL PROMPT

↓

MODEL INTERPRETATIONS

↓

COMPARISON METRICS

↓

RUN RECORD LINKS

↓

RELATED TASKS
```

---

# 73. Run Information Architecture

```text
RUN TITLE

↓

LIVE ARTWORK

↓

PREVIEW CONTROLS

↓

ARCHIVE RECORD

↓

HUMAN REVIEW

↓

AI REVIEW

↓

TECHNICAL RECORD

↓

SOURCE EVIDENCE
```

---

# 74. Model Information Architecture

```text
MODEL HERO

↓

SELECTED WORKS

↓

ARCHIVE STATISTICS

↓

PHASE PROGRESS

↓

ALL WORKS

↓

RUN HISTORY
```

---

# 75. Compare Information Architecture

```text
TASK SELECTOR

↓

MODEL SELECTORS

↓

SIDE-BY-SIDE ARTWORK

↓

EXECUTION COMPARISON

↓

EVALUATION COMPARISON

↓

OPEN RUN RECORD
```

---

# 76. Footer

极简：

```text
VibeTest

MODEL EVALUATION ARCHIVE

Archive 001 / 2026

GitHub
Methodology
Data

Same prompts.
Real outputs.
Independent reviews.
```

---

# 77. Avoid These UI Patterns

VibeTest 不应该出现：

```text
Leaderboard
Trophy
Winner
Glassmorphism
Neon Gradient
Huge colorful graphs
Too many rounded cards
Marketing SaaS Hero
AI robot illustration
Particle background
Cyberpunk terminal
```

---

# 78. Desired Emotional Result

当用户打开网站时，应该首先产生：

```text
“这个网站很像一个线上 AI 作品展。”
```

然后：

```text
“原来不同模型做同一道题差别这么大。”
```

接着：

```text
“这里不仅展示截图，
还保留完整运行记录。”
```

最后：

```text
“这些结果是可以追溯和验证的。”
```

---

# 79. Core Product Experience

最终体验应该形成：

```text
SEE
看作品

↓

COMPARE
比较模型

↓

INSPECT
查看 Run

↓

VERIFY
检查来源
```

这是整个 UI 设计最重要的四步。

---

# 80. Final Visual Identity

VibeTest 应该最终呈现为：

> 一个以数字美术馆形式展示 AI 模型真实生成结果的公开实验档案。

它拥有美术馆的视觉克制，
出版物的排版秩序，
Benchmark 的严谨，
以及软件实验的可验证性。

视觉上：

**作品第一，数据第二。**

信息上：

**比较第一，排名缺席。**

方法上：

**结果公开，来源独立，记录可追溯。**

品牌上：

**VibeTest 不只是测试模型，而是在保存 AI 创作能力发展的历史切片。**
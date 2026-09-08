# 15 个测试 Prompt 与双语理论成果、检验内容

> 来源：`DeepSeek-V4.1-Flash-Exp-0910_DSH/Reviews/DeepSeek-V4.1-Flash-Exp-0910-任务评测复盘.md` 的“输入 Prompt 原文”。  
> 口径：本文收录 15 条正式任务 prompt；日志中的 5 条“继续/补充”消息不作为独立任务。  
> 说明：“理论成果”描述理想情况下应交付的结果；“检验内容”是建议的验收标准，不等同于对当前目录内成果的实测结论。

## Task 01 · Aevum 奢侈腕表落地页 / Aevum Luxury Watch Landing Page

### 原始 Prompt / Original Prompt

```text
Build a beautiful landing page for a fictional luxury watch brand called "Aevum".
Use only HTML, CSS and JavaScript.
Do not use external images or libraries.
Make it feel like a real premium product website.
```

### 中文译文 / Chinese Translation

为名为“Aevum”的虚构奢侈腕表品牌制作一个精美的落地页。只使用 HTML、CSS 和 JavaScript，不使用外部图片或第三方库，并使页面具备真实高端产品官网的质感。

### 理论成果 / Expected Outcome

**中文：** 应交付一个可直接在现代浏览器中打开的完整品牌落地页。页面需建立一致的高端视觉语言，包括品牌标识、主视觉、产品故事、腕表系列或核心卖点、工艺与材质说明、明确的行动入口以及完整页脚。所有视觉资源应由 HTML、CSS、内联 SVG、Canvas 或程序化图形生成，不依赖外部图片、字体、框架或组件库。成品应兼具品牌叙事、信息层级、交互反馈、响应式布局与可访问性，使其看起来像可公开发布的真实奢侈品网站，而不是简单原型。

**English:** The deliverable should be a complete landing page that opens directly in a modern browser. It should establish a coherent premium visual language through branding, a strong hero, product storytelling, collections or key selling points, craftsmanship and material details, clear calls to action, and a finished footer. All visuals should be produced with HTML, CSS, inline SVG, Canvas, or procedural graphics, with no external imagery, fonts, frameworks, or component libraries. The result should combine narrative, hierarchy, responsive behavior, interaction feedback, and accessibility so it feels publishable rather than like a basic prototype.

### 检验内容 / Verification

- **中文：** 断网打开页面，确认无外部网络请求、资源缺失或控制台错误；检查仅使用 HTML/CSS/JavaScript，且所有图片效果均为本地或内联生成。
- **English:** Open the page offline and confirm there are no external requests, missing assets, or console errors; verify that only HTML/CSS/JavaScript is used and all imagery is local or generated inline.
- **中文：** 在桌面、平板和手机视口检查导航、主视觉、内容区、表单或 CTA，无横向溢出、遮挡、错位和不可读文本。
- **English:** Test desktop, tablet, and mobile viewports for navigation, hero, content, forms, and CTAs, with no overflow, clipping, overlap, or unreadable text.
- **中文：** 检查品牌一致性、视觉层级、排版、留白、色彩、动效节制及高端产品氛围；验证按钮、菜单、配置或表单等交互均有正确状态反馈。
- **English:** Review brand consistency, hierarchy, typography, spacing, color, restrained motion, and premium feel; verify correct feedback for buttons, menus, configurators, or forms.
- **中文：** 使用键盘完成主要操作，检查语义标题、表单标签、焦点可见性、合理对比度以及减少动态效果偏好。
- **English:** Complete primary flows by keyboard and check semantic headings, form labels, visible focus, sufficient contrast, and reduced-motion support.

## Task 02 · 骑自行车的鹈鹕 / Pelican Riding a Bicycle

### 原始 Prompt / Original Prompt

```text
Generate an SVG of a pelican riding a bicycle.
```

### 中文译文 / Chinese Translation

生成一幅鹈鹕骑自行车的 SVG 图像。

### 理论成果 / Expected Outcome

**中文：** 应交付一个有效、可独立打开的 SVG 文件，清楚表现“鹈鹕正在骑自行车”这一动作。画面中需能辨认鹈鹕的典型特征，例如长喙、喉囊、翅膀与鸟类体态；自行车应具有车轮、车架、车把、座椅和踏板等关键结构。鹈鹕与自行车之间的姿态关系应合理，能传达骑乘而非站在、飞过或靠近自行车。构图应完整、比例协调，缩放后仍保持清晰。

**English:** The deliverable should be a valid, standalone SVG that clearly depicts a pelican riding a bicycle. The pelican should be recognizable through characteristic features such as its long bill, throat pouch, wings, and avian body shape, while the bicycle should include essential structures such as wheels, frame, handlebars, saddle, and pedals. Their pose and contact points should communicate riding rather than merely standing near or flying over the bicycle. The composition should be complete, balanced, and crisp at different scales.

### 检验内容 / Verification

- **中文：** 在浏览器和 SVG 查看器中打开文件，确认 XML/SVG 语法有效、无缺失引用，并可无损缩放。
- **English:** Open the file in a browser and SVG viewer to confirm valid XML/SVG syntax, no broken references, and lossless scaling.
- **中文：** 由人工盲看确认主体首先被识别为鹈鹕，其次能明确理解为正在骑自行车。
- **English:** Use a blind visual review to confirm the subject is first identifiable as a pelican and the action is clearly understood as bicycle riding.
- **中文：** 检查自行车关键结构和鹈鹕接触关系，确保身体位于车座区域、翼或脚与操控和踩踏动作形成可信联系。
- **English:** Inspect bicycle anatomy and contact relationships so the body sits near the saddle and wings or feet credibly connect to steering and pedaling.
- **中文：** 在缩略图和放大视图下检查轮廓、层级、颜色对比及元素是否被画布裁切。
- **English:** Check silhouette, layering, contrast, and canvas clipping at both thumbnail and enlarged sizes.

## Task 03 · 模拟时钟 6:25 / Analog Clock at 6:25

### 原始 Prompt / Original Prompt

```text
Create an SVG of an analog clock showing exactly 6:25.
Include hour markers and three hands.
```

### 中文译文 / Chinese Translation

创建一个准确显示 6:25 的模拟时钟 SVG，并包含小时刻度和三根指针。

### 理论成果 / Expected Outcome

**中文：** 应交付一个独立 SVG 时钟图。表盘应包含清晰、均匀分布的小时刻度，以及时针、分针、秒针三根可区分的指针。分针应指向第 25 分钟，即数字 5 的方向；时针不应仍正对 6，而应从 6 向 7 移动约十二分之五的小时跨度；秒针可采用明确且不与“6:25”冲突的约定位置。整体应以共同中心点旋转，表盘几何准确且易读。

**English:** The deliverable should be a standalone SVG clock face with clear, evenly spaced hour markers and three distinguishable hands. The minute hand should point to minute 25, toward the numeral 5. The hour hand should not remain exactly on 6; it should be advanced roughly five-twelfths of the way toward 7. The second hand may use a clearly defined conventional position that does not undermine the stated 6:25 reading. All hands should rotate around a shared center, and the face should be geometrically accurate and legible.

### 检验内容 / Verification

- **中文：** 核对 12 个小时刻度是否按 30° 等距排列，中心点与表盘同心。
- **English:** Verify that the 12 hour markers are spaced at 30-degree intervals and share the face center.
- **中文：** 核对分针角度为 150°（从 12 点顺时针），时针约为 192.5°；三根指针长度和样式可区分。
- **English:** Verify a 150-degree minute-hand angle and approximately 192.5 degrees for the hour hand; ensure all three hands differ visibly in length or style.
- **中文：** 检查 SVG 可独立打开、缩放无锯齿、无裁切、无外部依赖。
- **English:** Confirm the SVG opens independently, scales cleanly, is not clipped, and has no external dependencies.
- **中文：** 让观察者读表，确认多数人能在不看文件名的情况下判断为 6:25。
- **English:** Ask reviewers to read the clock without seeing the filename and confirm that most identify 6:25.

## Task 04 · 模拟时钟 11:52:30 / Analog Clock at 11:52:30

### 原始 Prompt / Original Prompt

```text
Create an SVG analog clock showing 11:52:30.
```

### 中文译文 / Chinese Translation

创建一个显示 11:52:30 的模拟时钟 SVG。

### 理论成果 / Expected Outcome

**中文：** 应交付一个可独立显示的模拟时钟 SVG，准确编码 11 时 52 分 30 秒。秒针应位于 6 点方向；分针应位于 52 分并因 30 秒继续前进半分钟；时针应位于 11 与 12 之间、非常接近 12，但仍保持可辨识。表盘、刻度、中心轴和三根指针应构成完整且易读的时钟，而不是仅用文字标注时间。

**English:** The deliverable should be a standalone analog-clock SVG that accurately encodes 11:52:30. The second hand should point to 6. The minute hand should show 52 minutes with an additional half-minute advance, and the hour hand should sit between 11 and 12, close to but clearly before 12. The face, markers, center pin, and three hands should form a complete and readable clock rather than merely displaying the time as text.

### 检验内容 / Verification

- **中文：** 按连续走时公式核对角度：秒针 180°、分针约 315°、时针约 356.25°（均从 12 点顺时针）。
- **English:** Check continuous-motion angles: 180 degrees for seconds, about 315 degrees for minutes, and about 356.25 degrees for hours, clockwise from 12.
- **中文：** 检查时针没有错误地直接指向 11，分针没有简单对齐整数 52 分而忽略 30 秒。
- **English:** Ensure the hour hand does not point directly at 11 and the minute hand does not ignore the 30-second fractional advance.
- **中文：** 验证表盘元素同心、刻度均匀、指针前后层级合理，缩放及不同浏览器显示正常。
- **English:** Verify concentric geometry, even markers, sensible hand layering, and correct rendering across scales and browsers.
- **中文：** 进行不带提示的人工读表，确认时间可被稳定识别为 11:52:30。
- **English:** Conduct an unprompted visual reading test and confirm consistent recognition of 11:52:30.

## Task 05 · 侧面骑自行车的人 / Side-View Bicycle Rider

### 原始 Prompt / Original Prompt

```text
Generate an SVG of a person riding a bicycle viewed from the side.
The left foot must be on the lower pedal and the right foot on the upper pedal.
Both hands must be holding the handlebars.
```

### 中文译文 / Chinese Translation

生成一幅从侧面观察的人骑自行车的 SVG。左脚必须踩在下方踏板上，右脚必须踩在上方踏板上，并且双手都必须握住车把。

### 理论成果 / Expected Outcome

**中文：** 应交付一幅可独立打开的侧视 SVG，完整表现骑手、自行车和规定姿态。自行车的两个车轮应呈侧视圆形，车架、曲柄、上下踏板、车座和车把关系清楚。骑手左腿应延伸至下方踏板，右腿应屈曲并连接上方踏板，且左右身份不能因画面镜像而含糊；双臂应分别延伸到车把，两只手都形成明确接触。整体人体关节、重心和遮挡顺序应使动作可信。

**English:** The deliverable should be a standalone side-view SVG showing the rider, bicycle, and all required pose constraints. Both wheels should appear as side-view circles, and the frame, crank, upper and lower pedals, saddle, and handlebars should relate clearly. The rider's left leg must extend to the lower pedal, while the right leg bends to the upper pedal; left/right identity should remain unambiguous despite the side view. Both arms should reach the handlebars with visible hand contact. Joint placement, balance, and occlusion should make the action believable.

### 检验内容 / Verification

- **中文：** 标注或追踪左右肢体，确认左脚连接下踏板、右脚连接上踏板，且不存在脚悬空或踏板位置反转。
- **English:** Trace the left and right limbs to confirm the left foot contacts the lower pedal and the right foot contacts the upper pedal, with no floating foot or reversed pedal assignment.
- **中文：** 确认两只手各自与车把接触，不把单手接触、手臂交叉或仅靠近车把误判为满足条件。
- **English:** Confirm that each hand contacts the handlebars; one-handed contact, crossed ambiguity, or mere proximity should not pass.
- **中文：** 检查严格侧视构图、自行车结构完整性、人物比例、关节连贯和层级遮挡。
- **English:** Inspect the strict side-view composition, bicycle completeness, human proportions, joint continuity, and visual layering.
- **中文：** 验证 SVG 语法、画布边界、缩放清晰度和离线独立性。
- **English:** Validate SVG syntax, canvas bounds, scaling clarity, and offline independence.

## Task 06 · 手持剪刀剪纸 / Hand Cutting Paper with Scissors

### 原始 Prompt / Original Prompt

```text
Draw an SVG of a hand using scissors to cut a sheet of paper.
```

### 中文译文 / Chinese Translation

绘制一幅手拿剪刀剪开一张纸的 SVG。

### 理论成果 / Expected Outcome

**中文：** 应交付一个独立 SVG，画面同时包含手、剪刀和纸张，并通过接触点与动作线索明确表达“正在剪”。手指应合理握住剪刀环，剪刀双刃应在转轴处连接并夹住纸张边缘；纸上宜出现切口、分离边缘或剪切路径，以区别于手仅拿着剪刀悬停在纸旁。构图应使关键动作区域清晰，不被手或其他元素完全遮挡。

**English:** The deliverable should be a standalone SVG containing a hand, scissors, and a sheet of paper, with contact and action cues that clearly communicate active cutting. Fingers should plausibly occupy the scissor loops, the two blades should meet at a pivot and engage the paper edge, and the paper should show a slit, separated edge, or cut path. This must read differently from a hand merely holding scissors beside a sheet. The composition should keep the action area visible rather than obscured.

### 检验内容 / Verification

- **中文：** 检查三类主体均可辨认，并确认手—剪刀—纸形成连续的物理接触链。
- **English:** Confirm all three subjects are recognizable and form a continuous physical contact chain from hand to scissors to paper.
- **中文：** 检查刀刃与纸张在切口处相交，纸张存在已经剪开或正在分离的视觉证据。
- **English:** Verify that the blades intersect the paper at the cut and that the sheet visibly shows an opened or separating cut.
- **中文：** 检查手部握姿、剪刀转轴和刀刃方向是否合理，避免穿模和错误层叠。
- **English:** Review grip, pivot geometry, blade direction, intersections, and layer order for plausibility.
- **中文：** 验证 SVG 可离线打开、缩放清晰，且所有元素位于 viewBox 内。
- **English:** Confirm offline rendering, clean scaling, and that all elements remain inside the viewBox.

## Task 07 · 推独轮车的人 / Person Pushing a Wheelbarrow

### 原始 Prompt / Original Prompt

```text
Draw an SVG of a person pushing, not pulling, a wheelbarrow.
```

### 中文译文 / Chinese Translation

绘制一幅一个人正在推、而不是拉独轮车的 SVG。

### 理论成果 / Expected Outcome

**中文：** 应交付一个可独立打开的 SVG，明确显示人物位于独轮车把手后方，身体朝向独轮车前进方向，双手向前握住车把，从而表达“推”。独轮车应具有单个前轮、承载斗、支架和两根把手等可识别结构。人物姿态可通过前倾躯干、前后分开的步态或受力关系增强推进感，并应避免人物位于车前、面向车后或将把手拖在身后等“拉”的视觉信号。

**English:** The deliverable should be a standalone SVG that clearly places the person behind the wheelbarrow handles, facing the direction of travel and gripping forward to communicate pushing. The wheelbarrow should be recognizable through a single front wheel, tray, supports, and two handles. A leaning torso, walking stride, or force relationship may reinforce forward motion. The composition must avoid pulling cues such as placing the person in front, facing backward, or dragging the handles behind them.

### 检验内容 / Verification

- **中文：** 判断前进方向，并确认独轮车前轮在前、人物在把手后方，人物施力方向朝向车体。
- **English:** Establish the travel direction and verify that the front wheel leads, the person stands behind the handles, and the applied force points toward the barrow.
- **中文：** 检查独轮车单轮、车斗、支架和把手是否结构完整，人物双手与把手接触。
- **English:** Check the single wheel, tray, supports, and handles for completeness and verify both-hand contact with the handles.
- **中文：** 让观察者在“推/拉”二选一中判断，结果应稳定为“推”。
- **English:** Ask reviewers to choose between “pushing” and “pulling”; the result should consistently be “pushing.”
- **中文：** 验证 SVG 语法、缩放、层级关系和画布裁切情况。
- **English:** Validate SVG syntax, scaling, layering, and canvas clipping.

## Task 08 · 单文件打砖块游戏 / Single-File Breakout Game

### 原始 Prompt / Original Prompt

```text
Create a polished, playable Breakout game in a single HTML file.
```

### 中文译文 / Chinese Translation

在单个 HTML 文件中创建一个精致且可玩的打砖块游戏。

### 理论成果 / Expected Outcome

**中文：** 应交付一个无需构建即可运行的单一 HTML 文件，内含所有结构、样式、脚本和必要资源。游戏应具备挡板、球、砖块、碰撞、得分、生命或失败条件、开始/暂停/重开流程，并形成可以真正完成或失败的闭环。操作应响应及时，物理反馈一致，高速情况下不应频繁穿透砖块或挡板。所谓“精致”还应体现为清楚的 HUD、统一视觉风格、适度动画与音效、明确状态提示、响应式布局及基本可访问输入支持。

**English:** The deliverable should be one self-contained HTML file containing all markup, styles, scripts, and required assets, runnable without a build step. The game should include a paddle, ball, bricks, collision handling, scoring, lives or a loss condition, and coherent start, pause, restart, win, and fail states. Controls should feel responsive, physics should be consistent, and fast motion should not routinely tunnel through bricks or the paddle. “Polished” should also mean a clear HUD, cohesive art direction, restrained animation and sound, explicit state messaging, responsive layout, and basic accessible input support.

### 检验内容 / Verification

- **中文：** 断网直接打开单文件，确认无缺失依赖、控制台异常或必须通过服务器才能运行的问题。
- **English:** Open the single file offline and confirm there are no missing dependencies, console exceptions, or server-only requirements.
- **中文：** 完整执行开始、发球、移动、击砖、得分、丢球、暂停、继续、失败、重开和通关流程。
- **English:** Exercise start, launch, movement, brick hits, scoring, ball loss, pause, resume, game over, restart, and victory flows end to end.
- **中文：** 在不同帧率与球速下检查墙面、挡板和砖块碰撞，确认不会卡死、无限水平运动或明显穿模。
- **English:** Test wall, paddle, and brick collisions across frame rates and ball speeds, checking for stalls, endless horizontal paths, or obvious tunneling.
- **中文：** 使用键盘、鼠标和触摸（若支持）操作，并在窄屏与宽屏验证画面完整、HUD 可读。
- **English:** Test keyboard, mouse, and touch where supported, and verify a complete playfield and readable HUD on narrow and wide screens.

## Task 09 · 单文件俯视角农场游戏 / Single-File Top-Down Farming Game

### 原始 Prompt / Original Prompt

```text
Create a playable top-down farming game in a single HTML file.
```

### 中文译文 / Chinese Translation

在单个 HTML 文件中创建一个可玩的俯视角农场游戏。

### 理论成果 / Expected Outcome

**中文：** 应交付一个完全自包含的 HTML 文件，以俯视视角提供可操作角色和可辨识农场空间，并至少形成“准备土地—播种—照料—生长—收获”的核心循环。游戏需要有明确的输入方式、状态反馈、资源或时间变化，以及可持续进行的目标或进度。地图、角色、作物阶段和可交互区域应视觉可辨；碰撞、边界和操作距离应一致。若包含金钱、商店、天气、体力或存档，它们应服务于核心循环且状态一致。

**English:** The deliverable should be one fully self-contained HTML file with a controllable character and a recognizable farm presented from a top-down view. It should provide at least a complete loop of preparing soil, planting, tending, growth, and harvesting. The game needs clear controls, state feedback, changing resources or time, and a goal or progression that can be sustained over multiple cycles. The map, avatar, crop stages, and interactive areas should be visually distinguishable, while collisions, boundaries, and interaction distance remain consistent. Optional money, shops, weather, stamina, or saving systems should support the core loop and maintain coherent state.

### 检验内容 / Verification

- **中文：** 断网直接打开文件并从新游戏完成一次完整种植到收获循环，确认每一步都有可见状态变化。
- **English:** Open the file offline and complete a full planting-to-harvest cycle from a new game, confirming visible state changes at every step.
- **中文：** 检查移动、地图边界、障碍碰撞、工具切换、交互距离、资源扣除和不足资源时的反馈。
- **English:** Verify movement, map boundaries, obstacle collision, tool switching, interaction range, resource deductions, and insufficient-resource feedback.
- **中文：** 检验作物阶段、日期或时间推进、浇水等生长条件，以及收获后库存或货币的正确更新。
- **English:** Test crop stages, day or time progression, growth conditions such as watering, and correct inventory or currency updates after harvest.
- **中文：** 连续随机输入和长时间运行，确认无死循环、状态损坏、严重性能下降或控制台错误；在不同视口检查可玩性。
- **English:** Run prolonged and randomized input to detect loops, state corruption, major performance degradation, or console errors; verify playability across viewports.

## Task 10 · 像素画编辑器 / Pixel-Art Editor

### 原始 Prompt / Original Prompt

```text
Build a small pixel-art editor.
It should support:
drawing,
erasing,
color selection,
brush size,
undo/redo,
zoom,
and exporting the result as PNG.
```

### 中文译文 / Chinese Translation

构建一个小型像素画编辑器。它应支持绘制、擦除、颜色选择、画笔大小、撤销/重做、缩放以及将结果导出为 PNG。

### 理论成果 / Expected Outcome

**中文：** 应交付一个轻量但完整可用的像素画编辑器。编辑区应基于离散像素网格，绘制和擦除精确作用于逻辑像素；用户可选择颜色与画笔大小，连续拖动不应产生非预期断点。撤销和重做应按操作恢复完整画布状态，并正确处理新分支操作。缩放必须保持最近邻硬边效果，不改变底层作品数据。PNG 导出应生成有效文件，尺寸和透明通道符合界面设定，且导出的图像不包含编辑网格或光标叠加层。

**English:** The deliverable should be a lightweight but complete pixel-art editor. Its workspace should use a discrete pixel grid, with drawing and erasing operating precisely on logical pixels and continuous strokes avoiding unintended gaps. Users should be able to choose color and brush size. Undo and redo must restore complete canvas states and correctly handle a new edit branch. Zooming should preserve nearest-neighbor hard edges without changing artwork data. PNG export should produce a valid file with the configured dimensions and transparency, excluding editor grids and cursor overlays.

### 检验内容 / Verification

- **中文：** 逐像素核对单击、慢速拖动、快速拖动、不同笔刷尺寸及边界处绘制的颜色和覆盖范围。
- **English:** Verify pixel data for clicks, slow and fast drags, multiple brush sizes, and strokes at canvas boundaries.
- **中文：** 检查擦除结果为透明像素而非白色；切换颜色后只影响后续笔画，不回溯修改已有像素。
- **English:** Confirm erasing creates transparent rather than white pixels and that color changes affect only future strokes.
- **中文：** 执行多步绘制—撤销—重做—撤销后新绘制，确认历史顺序正确且新分支会清空重做栈。
- **English:** Perform a multi-step edit, undo, redo, undo, and new edit; confirm correct history order and redo-branch invalidation.
- **中文：** 多级缩放后检查边缘无平滑模糊、画布数据不变；导出 PNG 并核对签名、宽高、像素颜色、alpha 和放大规则。
- **English:** Check that multiple zoom levels remain crisp and data-invariant; export PNG and verify signature, dimensions, pixel colors, alpha, and scale behavior.

## Task 11 · 2D 户型图编辑器 / 2D Floor-Plan Editor

### 原始 Prompt / Original Prompt

```text
Build a simple 2D floor-plan editor where I can draw walls, add doors and windows, drag objects, and see room dimensions.
```

### 中文译文 / Chinese Translation

构建一个简单的 2D 户型图编辑器，让我可以绘制墙体、添加门窗、拖动物体并查看房间尺寸。

### 理论成果 / Expected Outcome

**中文：** 应交付一个可交互的二维户型编辑器，至少包含墙体绘制、门窗依附墙体放置、对象添加与拖拽、房间尺寸显示四项核心能力。坐标、比例和吸附规则应一致；墙体端点连接后应形成可识别的封闭房间，门窗移动时保持在所属墙体上。对象拖拽需保留选择状态与位置精度。尺寸应明确单位和测量口径，并随几何修改实时更新。界面需提供可发现的工具状态、选择反馈及误操作恢复能力。

**English:** The deliverable should be an interactive 2D floor-plan editor with at least four core capabilities: wall drawing, doors and windows attached to walls, object placement and dragging, and room-dimension display. Coordinates, scale, and snapping should be consistent. Connected wall endpoints should form recognizable enclosed rooms, and openings should remain attached to their wall when moved. Object dragging should preserve selection and positional accuracy. Dimensions should state their units and measurement convention and update live when geometry changes. The UI should make tools and selection states discoverable and provide recovery from mistakes.

### 检验内容 / Verification

- **中文：** 绘制矩形和包含 T 形连接的多房间平面，确认端点吸附、闭环识别、房间数量、宽高和面积正确。
- **English:** Draw a rectangle and a multi-room plan with T-junctions; verify endpoint snapping, closed-loop detection, room count, width, height, and area.
- **中文：** 在不同墙段添加门窗并沿墙拖动，确认其不会脱离墙体、越过端点或在调整墙长后产生无效位置。
- **English:** Add doors and windows to different walls and drag them; ensure they do not detach, cross endpoints, or become invalid after wall resizing.
- **中文：** 添加、选择、拖动和删除对象，检查命中测试、层级、坐标、吸附以及撤销/重做后的完整状态恢复。
- **English:** Add, select, drag, and delete objects; verify hit testing, layering, coordinates, snapping, and full state restoration through undo/redo.
- **中文：** 缩放和平移后重复编辑，确认屏幕坐标到世界坐标转换正确；验证尺寸单位、实时更新、保存/载入及异常数据处理。
- **English:** Repeat edits after zooming and panning to validate screen-to-world conversion; check units, live dimension updates, save/load, and malformed-data handling.

## Task 12 · 计算器应用 / Calculator App

### 原始 Prompt / Original Prompt

```text
Create a working calculator app.
Choose the technology yourself.
Run it.
Test it.
Fix any issues you find.
Do not ask me questions unless you are genuinely blocked.
```

### 中文译文 / Chinese Translation

创建一个可工作的计算器应用。技术由你自行选择。运行它、测试它，并修复发现的所有问题。除非确实受阻，否则不要向我提问。

### 理论成果 / Expected Outcome

**中文：** 应交付一个能够实际运行、已经过测试和问题修复的计算器应用，并由实现者自行选择适合的技术栈。最小能力包括数字输入、小数、基本四则运算、清除、退格、正负号与等号；理想实现还应处理运算优先级、连续计算、键盘输入、错误状态和数值格式。计算核心应具备确定性，除零、非法表达式、溢出及浮点显示误差应以可理解方式处理，不能使界面崩溃。交付内容应包含运行方式、测试方法和修复后的验证证据。

**English:** The deliverable should be a calculator application that actually runs and has been tested and repaired, using a technology stack chosen by the implementer. Minimum capabilities include digit and decimal entry, the four basic operations, clear, backspace, sign toggle, and equals. A strong implementation should also handle precedence, chained calculations, keyboard input, error states, and number formatting. The calculation core should be deterministic; division by zero, malformed expressions, overflow, and floating-point display noise should be handled intelligibly without crashing the UI. The handoff should include run instructions, a test method, and evidence that discovered defects were fixed.

### 检验内容 / Verification

- **中文：** 运行实际应用并通过按钮和键盘完成基础、连续、带小数、带负数和优先级运算，比较已知正确结果。
- **English:** Run the real app and use both buttons and keyboard for basic, chained, decimal, negative, and precedence-sensitive calculations against known results.
- **中文：** 覆盖 `0.1 + 0.2`、除以零、重复小数点、前导运算符、超长输入、溢出、清错后继续输入等边界情形。
- **English:** Cover cases such as `0.1 + 0.2`, division by zero, repeated decimal points, leading operators, long input, overflow, and recovery after an error.
- **中文：** 检查清除、退格、正负号、连续按等号或连续运算符时的状态机一致性，并确认无控制台异常。
- **English:** Check state-machine consistency for clear, backspace, sign toggle, repeated equals, and consecutive operators, with no console exceptions.
- **中文：** 在桌面和窄屏检查按键布局、焦点、可读性和触控目标；运行自动化测试并在修复后完整回归。
- **English:** Review keypad layout, focus, readability, and touch targets on desktop and narrow screens; run automated tests and a full regression after fixes.

## Task 13 · 天气仪表盘 / Weather Dashboard

### 原始 Prompt / Original Prompt

```text
Build a polished weather dashboard.

After implementing it:
1. Run the application.
2. Open it in the browser.
3. Inspect the rendered result yourself.
4. Fix any visual or functional issues you notice.
5. Repeat until you are satisfied.
```

### 中文译文 / Chinese Translation

构建一个精致的天气仪表盘。实现后：1）运行应用；2）在浏览器中打开；3）自行检查渲染结果；4）修复发现的视觉或功能问题；5）重复上述过程，直到满意为止。

### 理论成果 / Expected Outcome

**中文：** 应交付一个在浏览器中实际运行并经过多轮视觉与功能自检的天气仪表盘。页面应清晰呈现地点、当前天气、温度、体感、关键气象指标以及逐小时或多日预报，并对加载、失败、空数据和刷新状态提供反馈。若使用实时 API，应妥善处理时区、单位、网络超时和缺失字段；若无网络，应提供明确降级状态。所谓“精致”应体现在一致的视觉系统、数据层级、天气状态表达、响应式布局、交互细节、可访问性和无明显渲染缺陷。实现者应亲自在浏览器中反复检查并修复，而非仅完成代码。

**English:** The deliverable should be a browser-run weather dashboard that has undergone repeated visual and functional self-review. It should clearly present location, current conditions, temperature, feels-like values, key metrics, and hourly or multi-day forecasts, with feedback for loading, failure, empty data, and refresh states. If live APIs are used, time zones, units, network timeouts, and missing fields must be handled correctly; offline behavior should be explicitly communicated. “Polished” should appear in the visual system, data hierarchy, weather-state presentation, responsive layout, interaction detail, accessibility, and absence of obvious rendering defects. The implementer is expected to inspect and repair the rendered app iteratively, not merely write code.

### 检验内容 / Verification

- **中文：** 在真实浏览器加载成功、加载中、网络失败、无结果和缓存/离线等状态，确认页面始终有清楚且不误导的反馈。
- **English:** Exercise successful load, loading, network failure, no-result, and cached/offline states in a real browser, ensuring clear and non-misleading feedback.
- **中文：** 用不同时区、跨午夜、摄氏/华氏、不同风速和降水单位的数据，核对当前、逐小时和每日预报的一致性。
- **English:** Test multiple time zones, midnight boundaries, Celsius/Fahrenheit, and wind and precipitation units for consistency across current, hourly, and daily views.
- **中文：** 在手机、平板、桌面、浅色/深色及多种天气状态下截图检查溢出、遮挡、对比度、图标含义和图表尺寸。
- **English:** Review screenshots across phone, tablet, desktop, light/dark themes, and varied weather states for overflow, overlap, contrast, icon meaning, and chart sizing.
- **中文：** 操作搜索、定位、单位切换、主题、刷新和预报详情；检查键盘访问、焦点、ARIA 状态、减少动态效果和控制台错误。
- **English:** Exercise search, geolocation, unit switching, theme, refresh, and forecast details; check keyboard access, focus, ARIA state, reduced motion, and console errors.

## Task 14 · 银行网站 / Bank Website

### 原始 Prompt / Original Prompt

```text
Make me a website for a bank.
```

### 中文译文 / Chinese Translation

为我制作一个银行网站。

### 理论成果 / Expected Outcome

**中文：** 由于原 prompt 非常开放，合理的理论成果应是一套可信、专业且明确标注演示性质的银行网站。至少应包含品牌首页、个人或企业产品概览、账户/贷款/利率等核心信息、登录或开户入口、帮助与安全说明。页面应建立清晰导航、稳健视觉语言、准确的信息层级和响应式体验。任何利率、费用、身份验证或申请流程若为模拟内容，都必须明确免责声明，不能暗示真实收款、存款保障或数据传输。表单、计算器和流程应在前端正确工作，并重视安全提示、隐私、可访问性和金融数字格式。

**English:** Because the original prompt is highly open-ended, a reasonable expected outcome is a credible, professional bank website that is clearly identified as a demonstration. It should include at least a branded home page, personal or business product overviews, core account, loan, or rate information, sign-in or account-opening entry points, and help and security guidance. The site should provide clear navigation, a trustworthy visual language, accurate information hierarchy, and responsive behavior. Any fictional rates, fees, authentication, or application flows must carry explicit disclaimers and must not imply real payments, insured deposits, or data transmission. Forms, calculators, and flows should function correctly on the front end, with attention to security messaging, privacy, accessibility, and financial formatting.

### 检验内容 / Verification

- **中文：** 从首页完成主要导航路径，检查所有链接、菜单、移动抽屉、面包屑或当前页状态，无死链和不可返回流程。
- **English:** Traverse primary navigation from the home page and verify links, menus, mobile drawers, breadcrumbs or current-page states, with no dead ends or broken links.
- **中文：** 检查产品、利率、费用、CTA、登录/开户和帮助内容是否完整、层级清楚；所有虚构信息和无后端表单均有醒目说明。
- **English:** Review products, rates, fees, CTAs, sign-in/application, and help content for completeness and hierarchy; clearly disclose all fictional information and non-submitting forms.
- **中文：** 对贷款、储蓄或其他金融计算器使用已知样例和边界值验算，核对货币、百分比、期限、舍入和无效输入处理。
- **English:** Validate loan, savings, or other financial calculators using known examples and boundary values, checking currency, percentages, terms, rounding, and invalid input.
- **中文：** 在桌面和手机检查表格、表单、导航、对比度、键盘焦点、标签、错误提示和敏感信息警告；确认无真实网络提交。
- **English:** On desktop and mobile, inspect tables, forms, navigation, contrast, keyboard focus, labels, validation errors, and sensitive-data warnings; confirm no real submission occurs.

## Task 15 · 读书追踪应用 / Book-Tracking App

### 原始 Prompt / Original Prompt

```text
Build an app for keeping track of books.
```

### 中文译文 / Chinese Translation

构建一个用于追踪书籍的应用。

### 理论成果 / Expected Outcome

**中文：** 由于 prompt 未限定平台和范围，合理的理论成果应是一个可运行的个人书库与阅读进度应用。用户至少可以新增、查看、编辑和删除书籍，并记录书名、作者及阅读状态；更完整的实现可支持页数进度、开始/完成日期、评分、标签、收藏、搜索、筛选、排序、统计和本地持久化。状态转换应保持数据一致，例如完成时设置完成日期与最终进度，重新阅读时合理清理冲突字段。数据导入导出若存在，应可往返恢复且避免静默重复。界面应对空书库、无搜索结果、无效输入和损坏存储提供明确反馈。

**English:** Since the prompt does not constrain platform or scope, a reasonable expected outcome is a working personal-library and reading-progress application. At minimum, users should be able to add, view, edit, and delete books and record title, author, and reading status. A fuller implementation may include page progress, start and finish dates, ratings, tags, favorites, search, filters, sorting, statistics, and local persistence. Status transitions must keep data coherent—for example, finishing should set the finish date and final progress, while reopening should resolve conflicting fields. If import/export exists, data should round-trip and avoid silent duplication. The UI should clearly handle an empty library, zero search results, invalid input, and corrupt storage.

### 检验内容 / Verification

- **中文：** 完成新增、查看、编辑、删除、撤销（若有）和刷新恢复流程，确认书籍字段、列表顺序及持久化状态一致。
- **English:** Complete add, view, edit, delete, undo where available, and reload-recovery flows, confirming field values, list order, and persisted state.
- **中文：** 覆盖“想读、在读、暂停、读完、弃读”等状态转换，核对当前页、总页数、开始/完成日期和进度日志的一致性。
- **English:** Exercise transitions among want-to-read, reading, paused, finished, and abandoned states, checking current page, total pages, start/finish dates, and progress-log coherence.
- **中文：** 组合搜索、筛选和排序，使用大小写、空格、标签和无结果输入，确认计数与结果稳定且不丢数据。
- **English:** Combine search, filtering, and sorting with case, whitespace, tags, and no-result queries, confirming stable counts and no data loss.
- **中文：** 检查评分范围、日期合法性、页数边界、重复书籍、损坏存储及导入导出往返；在键盘和窄屏环境验证可用性。
- **English:** Validate rating ranges, dates, page bounds, duplicates, corrupt storage, and import/export round trips; verify keyboard and narrow-screen usability.

---

## 总体验收建议 / Overall Evaluation Guidance

**中文：** 评测时建议将“是否满足原始 prompt”与“实现是否超出 prompt”分开打分。首先检查不可协商的显式约束，例如单文件、SVG、具体时间、肢体位置、禁止外部资源或必须运行测试；然后再评估完成度、视觉质量、鲁棒性、可访问性和工程质量。附加功能只有在不破坏核心要求时才应加分。

**English:** During evaluation, score “satisfies the original prompt” separately from “goes beyond the prompt.” First verify non-negotiable explicit constraints such as single-file delivery, SVG format, exact clock time, required limb positions, no external resources, or the instruction to run and test. Then assess completeness, visual quality, robustness, accessibility, and engineering quality. Extra features should add value only when they do not compromise the core requirements.

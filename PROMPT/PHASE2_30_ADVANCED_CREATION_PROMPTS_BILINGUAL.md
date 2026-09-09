# Phase 2 · 30 个高级纯创造测试 Prompt 与双语理论成果、检验内容

> 来源：基于 Phase 1 的 15 个测试 Prompt 继续扩展，Phase 2 专注于 **Advanced Zero-to-One Creation**。  
> 口径：本文收录 30 条正式任务 Prompt，编号连续为 Task 16–45。  
> 说明：“理论成果”描述理想情况下应交付的结果；“检验内容”是建议的验收标准，不等同于对任何模型或 Harness 的实际测试结论。  
> 原则：Phase 2 不使用已有代码库作为起点，默认从空目录或空白环境开始；除非 Prompt 明确限制格式或依赖，否则允许模型自行选择合理技术栈与项目结构。  
> 目标：相较 Phase 1，Phase 2 更强调复杂系统内部的一致性、可验证性、确定性、状态管理、算法正确性与工具级完成度，而不只是“能否生成一个看起来不错的作品”。

---

## Task 16 · 骑自行车鹈鹕动画 / Animated Pelican Bicycle

### 原始 Prompt / Original Prompt

```text
Create a standalone animated SVG of a pelican riding a bicycle from left to right.

Requirements:
- both bicycle wheels must rotate naturally
- the pedals and crank must rotate
- the pelican's feet must remain connected to the pedals throughout the cycle
- its legs should move naturally with the pedals
- the body should subtly respond to the pedaling motion
- the background should scroll to communicate forward movement
- include controls to pause and resume the animation

The final deliverable must be a single SVG file with no external dependencies.
```

### 中文译文 / Chinese Translation

创建一个独立可运行的动画 SVG，表现一只鹈鹕从左向右骑自行车。两个车轮必须自然旋转，踏板和曲柄同步转动，鹈鹕双脚在整个运动周期中都保持与踏板连接，腿部随踏板自然运动，身体也应对踩踏产生轻微响应。背景需要滚动以传达前进感，并提供暂停与继续控制。最终成果必须是单一 SVG 文件，不依赖外部资源。

### 理论成果 / Expected Outcome

**中文：** 应交付一个可独立打开的动画 SVG，清楚表现鹈鹕骑车前进的连续运动。自行车的车轮、曲柄和踏板应构成统一运动系统，鹈鹕双脚始终与踏板保持可信接触，腿部关节随踩踏周期自然变化，身体存在适度上下起伏或姿态响应。背景滚动速度与车辆前进感一致，暂停/继续功能能够冻结并恢复整个动画系统，而不是只暂停部分元素。

**English:** The deliverable should be a standalone animated SVG that clearly communicates a pelican riding a bicycle forward. Wheels, crank, pedals, feet, legs, and body motion should form one coherent motion system. Background scrolling should reinforce forward travel, while pause/resume controls preserve the full animation state rather than restarting or pausing only selected parts.

### 检验内容 / Verification

- **中文：** 连续运行多个踩踏周期，检查车轮、曲柄、踏板、双脚和腿部是否相位一致，不出现脚离开踏板、曲柄逆跳或腿部瞬移。
- **English:** Run multiple pedaling cycles and verify phase consistency among the wheels, crank, pedals, feet, and legs, with no detached feet, crank jumps, or limb teleportation.
- **中文：** 暂停动画并确认所有动态元素同时冻结，继续后应从原状态平滑恢复而不是重置。
- **English:** Pause the animation and confirm all moving elements freeze together; resuming should continue smoothly from the paused state rather than restart.
- **中文：** 检查背景滚动方向、速度与车辆姿态是否共同表达从左向右前进，不产生视觉倒退或打滑感。
- **English:** Check that background direction, speed, and bicycle motion consistently communicate left-to-right travel without apparent backward motion or sliding.
- **中文：** 验证 SVG 可离线打开、无外部资源、缩放无损且所有元素位于 viewBox 内。
- **English:** Confirm the SVG opens offline, has no external dependencies, scales cleanly, and keeps all content inside the viewBox.

---

## Task 17 · 机械腕表机芯动画 / Mechanical Watch Movement

### 原始 Prompt / Original Prompt

```text
Create a standalone animated SVG showing a transparent mechanical wristwatch movement.

It should include:
- hour, minute, and second hands
- multiple interlocking gears
- an escapement mechanism
- an oscillating balance wheel
- a mainspring or power source
- realistic relative rotation directions between connected gears
- different gear rotation speeds
- pause/resume controls
- a speed control

The mechanisms must behave as a coherent system rather than as unrelated decorative animations.

Do not use external assets.
```

### 中文译文 / Chinese Translation

创建一个独立的动画 SVG，以透明机械腕表机芯为主题。它应包含时针、分针、秒针，多组相互啮合的齿轮，擒纵机构，往复摆动的摆轮，以及发条或其他动力来源。相互连接的齿轮应具有合理的相对旋转方向和不同转速，并提供暂停/继续与速度控制。机械机构必须作为统一系统运行，而不是彼此无关的装饰动画。不得使用外部资源。

### 理论成果 / Expected Outcome

**中文：** 应交付一个高完成度的机械腕表 SVG 动画。直接啮合的齿轮应以相反方向旋转，并通过尺寸或传动关系体现不同角速度；时针、分针、秒针的速度比例合理。摆轮应往复振荡而非持续单向旋转，擒纵机构与摆轮运动形成可理解的机械联系。速度控制应统一影响整个机芯模拟，暂停与继续应保持系统相位。

**English:** The deliverable should be a polished mechanical-watch SVG animation with coherent transmission behavior. Meshing gears should rotate in opposite directions at sensible relative speeds, the three hands should maintain realistic speed ratios, and the balance wheel plus escapement should visibly behave as linked mechanisms. Pause/resume and speed control should preserve the mechanism's phase.

### 检验内容 / Verification

- **中文：** 检查所有直接啮合齿轮的旋转方向是否相反，且不存在明显相互穿透、脱离或独立乱转。
- **English:** Verify that directly meshing gears rotate in opposite directions and do not visibly intersect, detach, or spin independently.
- **中文：** 比较秒针、分针、时针和不同齿轮的相对转速，确认不存在全部同速等明显错误。
- **English:** Compare relative speeds of hands and gears and confirm there are no obvious errors such as all elements rotating at the same rate.
- **中文：** 检查摆轮是否往复振荡，擒纵动作是否与其节奏存在可见关联；暂停、继续和速度变化不得破坏相位。
- **English:** Confirm that the balance wheel oscillates, the escapement visibly relates to that rhythm, and pause/resume or speed changes do not corrupt phase.
- **中文：** 验证离线打开、SVG 语法、缩放清晰度、控制交互和整体技术插画质感。
- **English:** Validate offline operation, SVG syntax, crisp scaling, controls, and overall technical-illustration quality.

---

## Task 18 · 鲁布·戈德堡连锁机关 / Rube Goldberg Machine

### 原始 Prompt / Original Prompt

```text
Create an animated interactive Rube Goldberg machine in the browser.

The machine must contain at least eight distinct stages forming one continuous causal chain.

The user should be able to:
- start the machine
- pause it
- resume it
- reset it
- step through the simulation slowly

Each stage must visibly cause the next stage rather than merely playing on a fixed independent timer.

Make the result visually polished and satisfying to watch.
```

### 中文译文 / Chinese Translation

在浏览器中创建一个可交互的鲁布·戈德堡连锁机关。整个装置至少包含八个彼此不同的阶段，并形成一条连续的因果链。用户应能够启动、暂停、继续、重置，并以慢速或逐步方式观察模拟。每个阶段必须由前一阶段的实际状态触发，而不是依靠相互独立的固定时间定时器播放。整体视觉应精致，并具有令人满意的连续运动感。

### 理论成果 / Expected Outcome

**中文：** 应交付一个真正基于状态、碰撞或事件触发的连锁机关模拟，而不是按时间轴顺序播放八段动画。每个阶段都应存在可识别的因果关系，例如球撞击杠杆、杠杆释放骨牌、骨牌触发滑轮。暂停和单步功能应作用于统一模拟时钟，重置后系统完整恢复初始状态。

**English:** The deliverable should be a state- or event-driven chain-reaction simulation rather than a sequence of unrelated timed animations. Each stage should visibly trigger the next through a causal transition. Pause and step controls should operate on one coherent simulation clock, and reset should fully restore the initial state.

### 检验内容 / Verification

- **中文：** 暂停在任意阶段并确认后续阶段不会继续自行播放；只有前一阶段满足触发条件后，下一阶段才启动。
- **English:** Pause at arbitrary stages and confirm later stages do not continue independently; each stage should start only after its preceding trigger condition is satisfied.
- **中文：** 使用单步或慢速模式逐段观察因果链，检查至少八个阶段均存在可辨识触发关系。
- **English:** Use step or slow-motion mode to inspect the chain and verify at least eight distinct, visibly causal stages.
- **中文：** 重置多次并重复运行，确认结果可重复、无遗留状态、无阶段提前触发或永久卡死。
- **English:** Reset and rerun multiple times to confirm repeatability, no stale state, no premature triggers, and no permanent deadlocks.
- **中文：** 检查不同窗口尺寸和帧率下机关仍保持可用、完整和同步。
- **English:** Verify that the machine remains usable, complete, and synchronized across different viewport sizes and frame rates.

---

## Task 19 · 交互式太阳系模拟 / Interactive Solar System

### 原始 Prompt / Original Prompt

```text
Build an interactive animated Solar System visualization.

Include:
- the Sun
- all eight planets
- planetary orbits
- Earth's Moon
- several major moons of Jupiter
- relative orbital speeds
- orbital trails
- pause/resume
- adjustable simulation speed
- zoom and pan
- clicking a planet to inspect it
- switching between a Solar System view and a selected-planet view

Moons must continue orbiting their parent planet correctly while the planet itself moves around the Sun.

Changing simulation speed must not cause objects to jump or lose orbital state.
```

### 中文译文 / Chinese Translation

构建一个交互式太阳系动画可视化。包含太阳、八大行星、行星轨道、地球月球、木星若干主要卫星、相对轨道速度和轨迹显示。支持暂停/继续、调整模拟速度、缩放和平移、点击行星查看信息，以及在太阳系视图和选中行星视图之间切换。卫星必须在母行星绕太阳运动的同时继续正确围绕母行星运行；改变模拟速度时，各天体不得瞬移或丢失轨道状态。

### 理论成果 / Expected Outcome

**中文：** 应交付一个具有层级坐标和统一时间系统的太阳系模拟。卫星位置应由“母行星位置 + 局部卫星轨道”共同决定，而不是围绕固定屏幕坐标旋转。暂停、速度调整和视角切换不能重置轨道相位。视觉比例可为可读性进行非真实缩放，但结构和运动关系应保持一致。

**English:** The deliverable should use hierarchical coordinates and one coherent simulation clock. Moon positions should derive from a moving parent planet plus local satellite orbits. Pause, speed changes, and camera-mode switching must not reset orbital phase. Visual scale may be non-physical for readability, but structural and motion relationships should remain coherent.

### 检验内容 / Verification

- **中文：** 长时间观察地球月球和木星卫星，确认它们围绕移动中的母行星运行。
- **English:** Observe Earth's Moon and Jupiter's moons over time and verify they orbit moving parent planets.
- **中文：** 在运行中多次切换模拟速度，确认天体位置连续、相位不重置、轨道不跳变。
- **English:** Change simulation speed repeatedly during motion and confirm continuous positions, preserved phase, and no orbital jumps.
- **中文：** 测试暂停、继续、缩放、平移、行星点击和视图切换，确认交互不会破坏模拟状态。
- **English:** Test pause/resume, zoom, pan, planet selection, and view switching and confirm interactions do not corrupt simulation state.
- **中文：** 检查八大行星、轨道、标签和轨迹在不同视口下保持可辨识，性能可接受。
- **English:** Verify that all eight planets, orbits, labels, and trails remain legible across viewports with acceptable performance.

---

## Task 20 · 二维机械连杆设计器 / 2D Mechanical Linkage Designer

### 原始 Prompt / Original Prompt

```text
Build an interactive 2D mechanical linkage designer.

Users should be able to:
- create fixed pivots
- create rotating joints
- create rigid links with exact lengths
- create sliders constrained to tracks
- connect components into mechanisms
- choose a driving joint or motor
- play, pause, reset, and step the simulation
- display joint coordinates and link lengths
- save and reload mechanisms

Support at least:
- a four-bar linkage
- a crank-slider mechanism

Rigid links must preserve their lengths throughout the simulation, and constrained joints must remain attached.
```

### 中文译文 / Chinese Translation

构建一个交互式二维机械连杆设计器。用户可以创建固定转轴、旋转关节、具有精确长度的刚性杆件、受轨道约束的滑块，并将它们连接为机械机构；可选择驱动关节或电机，支持播放、暂停、重置、单步，显示关节坐标与杆长，并保存/加载机构。至少应支持四连杆机构和曲柄滑块机构。整个模拟过程中刚性杆长度必须保持不变，受约束关节不能脱离连接。

### 理论成果 / Expected Outcome

**中文：** 应交付一个基于几何约束而非逐帧手工动画的二维机构模拟器。杆件长度、转轴连接和滑块轨道应形成持续有效的约束关系；驱动一个关节时，其余关节位置通过机构约束求解。四连杆与曲柄滑块应能稳定连续运动，并允许用户观察关键尺寸和关节轨迹。

**English:** The deliverable should be a geometric-constraint-based mechanism simulator rather than a frame-by-frame decorative animation. Link lengths, pivots, and slider tracks should remain continuously constrained while a driven joint causes the rest of the mechanism to solve accordingly. Four-bar and crank-slider mechanisms should move stably and expose useful measurements and joint trajectories.

### 检验内容 / Verification

- **中文：** 在整个运动周期内采样各刚性杆长度，确认误差始终处于合理容差范围内。
- **English:** Sample rigid-link lengths throughout the motion cycle and confirm errors remain within a reasonable tolerance.
- **中文：** 运行四连杆和曲柄滑块机构，检查关节不脱离、滑块始终位于轨道上。
- **English:** Run four-bar and crank-slider mechanisms and verify that joints remain attached and sliders stay on their tracks.
- **中文：** 暂停后逐步推进，确认单步结果与连续运行到相同状态时一致。
- **English:** Pause and step the mechanism, confirming step results match continuous simulation at equivalent states.
- **中文：** 保存并重新加载机构，确认几何、连接、驱动设置和尺寸完整恢复。
- **English:** Save and reload mechanisms and verify geometry, connections, drive settings, and dimensions restore completely.

---

## Task 21 · 参数化 2D CAD 草图工具 / Parametric 2D CAD Sketcher

### 原始 Prompt / Original Prompt

```text
Build a lightweight parametric 2D CAD sketcher.

Users should be able to:
- create points, lines, rectangles, and circles
- select and drag geometry
- snap to grid, endpoints, midpoints, and intersections
- apply horizontal and vertical constraints
- enter exact distances and dimensions
- display dimensions on the canvas
- zoom and pan
- undo and redo
- save and reload sketches
- export the result as SVG

Changing a dimension must update the geometry while preserving applicable constraints.
```

### 中文译文 / Chinese Translation

构建一个轻量级参数化 2D CAD 草图工具。用户应能够创建点、线、矩形和圆，选择并拖动几何体，吸附到网格、端点、中点和交点，施加水平与垂直约束，输入精确距离和尺寸，在画布上显示尺寸标注，并支持缩放、平移、撤销/重做、保存/重新加载和导出 SVG。修改尺寸时，几何体应随之更新，并继续保持适用约束。

### 理论成果 / Expected Outcome

**中文：** 应交付一个真正基于几何实体和约束关系的数据模型。水平、垂直、尺寸等约束在编辑后应持续成立；修改参数时受约束实体协调更新。吸附逻辑应在不同缩放级别下保持一致，尺寸显示基于世界坐标。Undo/Redo、保存/载入和 SVG 导出应保持实体、约束和几何参数一致。

**English:** The deliverable should use a real model of geometric entities and constraints. Horizontal, vertical, and dimensional constraints should remain valid after edits, parameter changes should propagate coherently, snapping should behave consistently across zoom levels, and undo/redo, persistence, and SVG export should preserve geometric state.

### 检验内容 / Verification

- **中文：** 创建带水平、垂直和尺寸约束的矩形，修改宽高后确认几何关系、约束和尺寸标注仍正确。
- **English:** Create a rectangle with horizontal, vertical, and dimensional constraints, then change width and height and verify geometry, constraints, and labels remain correct.
- **中文：** 在不同缩放级别测试网格、端点、中点和交点吸附。
- **English:** Test grid, endpoint, midpoint, and intersection snapping across zoom levels.
- **中文：** 执行连续编辑、撤销、重做、保存、重新加载，检查约束和实体身份是否完整恢复。
- **English:** Perform multiple edits, undo/redo, save, reload, and confirm that constraints and entity identities restore completely.
- **中文：** 导出 SVG 并与编辑器中的几何结果比较。
- **English:** Export SVG and compare it with the editor scene for matching dimensions, positions, and shapes.

---

## Task 22 · 关键帧动画编辑器 / Keyframe Animation Editor

### 原始 Prompt / Original Prompt

```text
Build a keyframe animation editor.

The application should include:
- an editable scene canvas
- multiple objects
- a timeline
- multiple animation tracks
- draggable keyframes
- position, rotation, scale, and opacity keyframes
- linear interpolation
- ease-in/ease-out interpolation
- play, pause, looping, frame stepping, and timeline scrubbing
- undo and redo
- JSON save/load

Dragging the playhead to any point in time must reconstruct the correct scene state.

Changing an earlier keyframe must correctly update interpolation without corrupting later keyframes.
```

### 中文译文 / Chinese Translation

构建一个关键帧动画编辑器。应用应包含可编辑场景画布、多对象、时间轴、多条动画轨道、可拖动关键帧，以及位置、旋转、缩放和透明度关键帧。支持线性插值和缓入缓出插值，并提供播放、暂停、循环、逐帧步进、时间轴拖动、撤销/重做和 JSON 保存/载入。将播放头拖到任意时间点时，都必须正确重建场景状态；修改较早的关键帧后，后续插值应正确更新，且不能破坏更晚的关键帧。

### 理论成果 / Expected Outcome

**中文：** 应交付一个拥有明确 Scene、Track、Keyframe 和 Playback 模型的动画编辑器。任意时间点的场景状态应由关键帧和插值函数确定性重建，而不是依赖此前播放路径。位置、旋转、缩放和透明度可以分别或组合插值，保存与载入完整恢复时间轴、对象和关键帧数据。

**English:** The deliverable should have explicit Scene, Track, Keyframe, and Playback models. Scene state at any time should be deterministically reconstructible from keyframes and interpolation functions rather than previous playback history. Save/load must fully restore objects, tracks, keyframes, and easing behavior.

### 检验内容 / Verification

- **中文：** 在同一时间点通过正常播放、直接拖动播放头和逐帧到达，比较场景结果是否一致。
- **English:** Reach the same timestamp through playback, direct scrubbing, and frame stepping and compare scene states.
- **中文：** 修改早期关键帧后检查中间插值和后续关键帧，确认后者值不被意外覆盖。
- **English:** Modify an early keyframe and verify updated interpolation while ensuring later keyframe values are not overwritten.
- **中文：** 测试线性与缓入缓出插值、循环边界、暂停继续和拖动关键帧时的时间一致性。
- **English:** Test linear and eased interpolation, loop boundaries, pause/resume, and draggable keyframes for consistent timing.
- **中文：** 保存 JSON、刷新应用、重新载入，并确认对象、轨道、关键帧和插值类型完整恢复。
- **English:** Save JSON, reload the application, and verify complete restoration of objects, tracks, keyframes, and easing types.

---

## Task 23 · 浏览器 3D 房间规划工具 / Browser-Based 3D Room Planner

### 原始 Prompt / Original Prompt

```text
Build a browser-based 3D room planner.

Users should be able to:
- create a rectangular room
- edit room width, length, and height
- add doors and windows
- add primitive furniture such as beds, tables, shelves, sofas, and cabinets
- select, move, rotate, and resize objects in 3D
- snap furniture to the floor and optionally to walls
- orbit, pan, and zoom the camera
- switch between perspective and top-down views
- display object dimensions
- undo and redo
- save and reload the entire scene as JSON

Objects must preserve their transforms when switching camera modes.
```

### 中文译文 / Chinese Translation

构建一个浏览器端 3D 房间规划工具。用户应能够创建矩形房间并修改宽、长、高，添加门窗和床、桌子、书架、沙发、柜子等基础家具，在 3D 场景中选择、移动、旋转和缩放对象，将家具吸附到地面并可选吸附到墙体。支持相机环绕、平移、缩放，以及透视视图和俯视视图切换；显示对象尺寸，支持撤销/重做，并将整个场景保存和重新载入为 JSON。切换相机模式时，对象的位置、旋转和缩放必须保持不变。

### 理论成果 / Expected Outcome

**中文：** 应交付一个具有真实三维场景图和稳定坐标系统的房间规划器。家具对象应以世界坐标或场景坐标存储，视图切换只改变相机而不改动场景对象。选择、拖动、旋转和缩放应具有稳定交互，保存与载入完整恢复房间、门窗、家具和变换。

**English:** The deliverable should provide a genuine 3D scene graph with a stable coordinate system. Furniture transforms should be stored independently of camera state, and switching between top-down and perspective views should not mutate objects. Editing and save/load behavior should preserve room geometry, openings, furniture, and transforms.

### 检验内容 / Verification

- **中文：** 在透视视图中放置并调整多个家具，切换到俯视再切回，确认所有对象变换完全保持。
- **English:** Place and transform multiple furniture items in perspective view, switch to top-down and back, and confirm transforms remain unchanged.
- **中文：** 测试家具地面吸附、墙体吸附、移动、旋转和缩放，检查无异常跳跃、穿模或比例突变。
- **English:** Test floor and wall snapping, movement, rotation, and resizing for unexpected jumps, intersections, or scale changes.
- **中文：** 保存场景、刷新应用并重新加载，核对房间、门窗、家具、尺寸和对象变换。
- **English:** Save the scene, reload the application, and verify room geometry, openings, furniture, dimensions, and transforms.
- **中文：** 检查相机操作、选择命中、性能和不同视口下的 UI 可用性。
- **English:** Verify camera controls, picking, performance, and UI usability across viewports.

---

## Task 24 · 程序化地形生成器 / Procedural Terrain Generator

### 原始 Prompt / Original Prompt

```text
Build an interactive procedural terrain generator.

Include:
- a numeric seed
- terrain roughness
- elevation scale
- water level
- terrain regeneration
- real-time preview
- a 3D terrain view
- a contour-map view
- orbit, zoom, and pan controls
- heightmap PNG export
- terrain parameter JSON export/import

Using exactly the same seed and parameters must reproduce exactly the same terrain.

Changing only the water level must not regenerate the underlying terrain.
```

### 中文译文 / Chinese Translation

构建一个交互式程序化地形生成器。包含数值种子、地形粗糙度、高程比例、水位、重新生成、实时预览、3D 地形视图、等高线视图、相机环绕/缩放/平移、Heightmap PNG 导出以及地形参数 JSON 导入导出。使用完全相同的种子和参数时必须生成完全相同的地形；仅改变水位时不得重新生成底层地形。

### 理论成果 / Expected Outcome

**中文：** 应交付一个确定性的程序化地形系统。底层高度数据由 Seed 和地形参数决定，水位等展示参数与高度生成逻辑分离。3D 视图、等高线视图和导出的高度图都来自同一底层数据。参数 JSON 导入后能够精确复现原始结果。

**English:** The deliverable should provide a deterministic procedural terrain system. Base height data should be determined by the seed and generation parameters, while display-layer settings such as water level remain separate. The 3D view, contour view, and exported heightmap should derive from the same data, and imported parameter JSON should reproduce the same terrain.

### 检验内容 / Verification

- **中文：** 使用同一组 Seed 和参数多次生成并比较高度图数据或导出 PNG，确认结果一致。
- **English:** Generate multiple times with identical seed and parameters and compare height data or exported PNGs for reproducibility.
- **中文：** 只调整水位，确认底层高度图和等高线几何不变，仅水体展示发生变化。
- **English:** Change only water level and verify that base heights and contour geometry remain unchanged.
- **中文：** 比较 3D 视图、等高线视图和高度图，确认三者反映同一地形结构。
- **English:** Compare the 3D view, contour view, and heightmap and verify they represent the same terrain structure.
- **中文：** 导出参数 JSON、重置应用后重新导入，确认复现相同地形。
- **English:** Export parameter JSON, reset the application, re-import it, and verify reproduction of the same terrain.

---

## Task 25 · 小型电子表格应用 / Mini Spreadsheet

### 原始 Prompt / Original Prompt

```text
Build a small spreadsheet application.

Support:
- editable cells
- text and numbers
- formulas
- cell references and ranges
- SUM, AVERAGE, MIN, MAX, and IF
- copying and pasting cells
- dragging formulas
- inserting and deleting rows
- sorting
- basic formatting
- CSV import/export
- undo and redo

Formula dependencies must update automatically.

Detect circular references and display a useful error instead of hanging.

Copied formulas must use relative references correctly.
```

### 中文译文 / Chinese Translation

构建一个小型电子表格应用。支持可编辑单元格、文本、数字、公式、单元格引用、范围引用、SUM、AVERAGE、MIN、MAX、IF，以及单元格复制粘贴、拖动公式、插入和删除行、排序、基础格式化、CSV 导入/导出和撤销/重做。公式依赖必须自动更新。系统必须检测循环引用并显示可理解的错误，不能卡死；复制公式时必须正确处理相对引用。

### 理论成果 / Expected Outcome

**中文：** 应交付一个具有公式解析器、依赖图和重新计算机制的电子表格。依赖单元格变化后所有下游公式按正确顺序重算；复制或拖动公式时，相对引用根据偏移更新。循环引用必须被安全检测。插入/删除行和排序后，数据与公式引用应保持一致或按照明确规则更新。

**English:** The deliverable should include a formula parser, dependency graph, and recalculation engine. Downstream formulas should update in dependency order, relative references should shift correctly when formulas are copied, circular references should be safely detected, and structural edits such as row insertion or sorting should preserve coherent data relationships.

### 检验内容 / Verification

- **中文：** 构建多层公式依赖链，修改最上游单元格，确认所有下游结果按正确顺序更新。
- **English:** Build multi-level dependency chains, modify an upstream cell, and verify all downstream results recalculate correctly.
- **中文：** 复制和拖动包含相对引用的公式，检查地址偏移是否符合常见电子表格行为。
- **English:** Copy and drag formulas containing relative references and verify address offsets match conventional spreadsheet behavior.
- **中文：** 构造直接和间接循环引用，确认应用显示可理解错误且界面保持响应。
- **English:** Create direct and indirect circular references and confirm useful errors while the interface remains responsive.
- **中文：** 测试 CSV 导入导出、插入删除行、排序、撤销重做以及公式与数据的一致性。
- **English:** Test CSV import/export, row insertion/deletion, sorting, undo/redo, and consistency between data and formulas.

---

## Task 26 · 数字逻辑电路编辑与模拟器 / Digital Logic Circuit Editor and Simulator

### 原始 Prompt / Original Prompt

```text
Build an interactive digital logic circuit editor and simulator.

Provide:
- switches
- push buttons
- AND, OR, XOR, NOT, and NAND gates
- LEDs
- clocks

Users must be able to:
- place and move components
- connect and disconnect ports using wires
- delete components
- zoom and pan
- undo and redo
- save and reload circuits

Wires must remain connected when components move.

The circuit must evaluate live when inputs change.

Detect and handle invalid connections and feedback loops without freezing the application.
```

### 中文译文 / Chinese Translation

构建一个交互式数字逻辑电路编辑器和模拟器。提供开关、按钮、AND、OR、XOR、NOT、NAND 门、LED 和时钟信号源。用户可以放置和移动元件，用导线连接或断开端口，删除元件、缩放和平移、撤销/重做并保存/重新加载电路。移动元件时导线必须保持连接；输入变化后电路应实时重新计算。系统还必须检测并处理非法连接和反馈环路，不能导致应用冻结。

### 理论成果 / Expected Outcome

**中文：** 应交付一个同时包含可视化节点编辑器和逻辑求值引擎的电路模拟器。组件具有明确输入/输出端口，导线连接形成图结构。无环组合逻辑根据输入变化实时传播；反馈环路、多个驱动源或类型不兼容连接被识别并给出明确反馈，而不是进入无限计算。

**English:** The deliverable should combine a visual node editor with a real logic-evaluation engine. Components should expose explicit ports and wires should form graph relationships. Acyclic logic should propagate live, while feedback loops, multiple drivers, or incompatible connections should be handled safely rather than causing infinite evaluation.

### 检验内容 / Verification

- **中文：** 构建多个已知真值表电路并枚举输入组合，核对 LED 输出与理论结果一致。
- **English:** Build circuits with known truth tables, enumerate input combinations, and verify LED outputs against expected results.
- **中文：** 移动已连接元件、缩放和平移画布，确认导线端点仍准确绑定端口。
- **English:** Move connected components and zoom/pan the canvas, confirming wire endpoints remain bound to the correct ports.
- **中文：** 创建反馈环路、非法端口连接和重复驱动等情况，确认应用给出错误或稳定状态而不冻结。
- **English:** Create feedback loops, invalid connections, and multiple-driver cases and confirm stable handling without freezing.
- **中文：** 测试撤销/重做、保存/加载后图结构、组件位置和逻辑状态是否完整恢复。
- **English:** Verify that undo/redo and save/load fully restore graph structure, component positions, and logic state.

---

## Task 27 · 节点式图像合成器 / Node-Based Image Compositor

### 原始 Prompt / Original Prompt

```text
Build a node-based image compositor.

Users should be able to create nodes for:
- solid color
- gradient
- image input
- blur
- brightness/contrast
- color adjustment
- blend
- transform
- output

Nodes should have typed input and output ports and be connectable with wires.

Support node dragging, reconnecting wires, deleting nodes, zoom/pan, live preview, undo/redo, and saving/loading the graph.

Changing an upstream node must automatically update all affected downstream nodes.

Unrelated branches of the graph should not be recomputed unnecessarily.
```

### 中文译文 / Chinese Translation

构建一个节点式图像合成器。用户能够创建纯色、渐变、图像输入、模糊、亮度/对比度、颜色调整、混合、变换和输出节点。节点应具有带类型的输入输出端口，并可通过连线连接。支持拖动节点、重新连接导线、删除节点、缩放和平移、实时预览、撤销/重做以及保存/加载节点图。修改上游节点后，所有受影响的下游节点必须自动更新；与其无关的图分支不应被无必要地重复计算。

### 理论成果 / Expected Outcome

**中文：** 应交付一个基于有向图进行图像计算的节点系统。节点类型、端口兼容关系和依赖关系明确。修改上游参数时，所有可达下游节点重新计算并刷新输出，而无关分支通过缓存、脏标记或依赖分析避免不必要计算。系统安全处理非法类型连接和潜在环路。

**English:** The deliverable should use a directed graph for image computation. Node types, port compatibility, and dependencies should be explicit. Upstream changes should invalidate only affected downstream nodes, while unrelated branches should avoid unnecessary recomputation through caching or dependency analysis.

### 检验内容 / Verification

- **中文：** 构建含多分支和合流的节点图，修改不同上游节点，确认只影响正确的下游结果。
- **English:** Build branching and merging node graphs, modify different upstream nodes, and verify only correct downstream results change.
- **中文：** 测试非法端口类型连接、断开连接、重新连接和删除节点，确认图状态稳定且无崩溃。
- **English:** Test incompatible port connections, disconnection, reconnection, and node deletion and verify graph stability.
- **中文：** 通过调试信息、计数器或其他证据检查无关分支不会在每次更新时全部重新计算。
- **English:** Use debug evidence, counters, or another method to confirm unrelated branches are not recomputed on every update.
- **中文：** 保存节点图、重新加载，并确认节点参数、位置、连接和输出结果完整恢复。
- **English:** Save and reload the graph and verify restoration of node parameters, positions, connections, and output.

---

## Task 28 · 项目排程与关键路径工具 / Project Scheduling and Critical Path Tool

### 原始 Prompt / Original Prompt

```text
Build an interactive project scheduling application.

Users should be able to create tasks with:
- duration
- dependencies
- assigned resources
- earliest-start constraints

The application should:
- visualize dependencies
- calculate the critical path
- calculate earliest and latest start times
- highlight scheduling conflicts
- detect dependency cycles
- generate a Gantt chart
- support drag-and-drop rescheduling

A single resource must not be scheduled for two tasks at the same time.

Changing one task must automatically propagate schedule changes to dependent tasks.
```

### 中文译文 / Chinese Translation

构建一个交互式项目排程应用。用户可以为任务设置工期、依赖关系、分配资源和最早开始时间。系统应可视化依赖关系，计算关键路径、最早与最晚开始时间，标记排程冲突，检测依赖环，生成甘特图，并支持拖拽调整排程。同一资源不能同时执行两个任务；修改一个任务后，相关依赖任务的排程必须自动传播更新。

### 理论成果 / Expected Outcome

**中文：** 应交付一个基于依赖图和资源约束进行排程计算的工具。无资源约束时应正确计算关键路径和时间窗口；加入资源后必须检测或解决重叠冲突。任务工期或依赖变化应触发下游排程更新，依赖环应被明确拒绝或标记。

**English:** The deliverable should use dependency-graph and resource constraints to compute schedules. It should correctly calculate critical paths and timing windows, detect or resolve resource conflicts, propagate changes through dependent tasks, and safely reject dependency cycles.

### 检验内容 / Verification

- **中文：** 使用人工可算的小型 DAG 核对关键路径、最早/最晚开始时间和总工期。
- **English:** Use a small hand-verifiable DAG to check critical path, earliest/latest starts, and total duration.
- **中文：** 为同一资源安排重叠任务，确认系统能够检测或重新排程冲突。
- **English:** Assign overlapping tasks to one resource and confirm the system detects or reschedules the conflict.
- **中文：** 修改关键任务工期，确认所有相关下游任务和甘特图自动更新。
- **English:** Change the duration of a critical task and verify dependent tasks and the Gantt chart update automatically.
- **中文：** 构造依赖环并确认应用给出明确错误且不生成无效排程。
- **English:** Create a dependency cycle and confirm a clear error without producing an invalid schedule.

---

## Task 29 · 正则表达式与有限自动机实验室 / Regex and Finite Automata Laboratory

### 原始 Prompt / Original Prompt

```text
Build an interactive regular-expression and finite-automata laboratory.

Users should be able to:
- enter a regular expression
- parse it and visualize the syntax tree
- convert it to an NFA
- convert the NFA to a DFA
- minimize the DFA
- visualize every automaton
- enter test strings
- animate how the automaton processes each character

The application must show each transformation step.

Equivalent representations must accept and reject the same language.
```

### 中文译文 / Chinese Translation

构建一个交互式正则表达式与有限自动机实验室。用户能够输入正则表达式，解析并显示语法树，将其转换为 NFA，再转换为 DFA，并最小化 DFA；每个自动机都需要可视化。用户可以输入测试字符串，并逐字符动画演示自动机如何处理输入。应用必须展示各阶段转换过程，并保证等价表示接受和拒绝相同的语言。

### 理论成果 / Expected Outcome

**中文：** 应交付一个真正实现 Regex 解析、AST、NFA 构造、子集构造法生成 DFA 和 DFA 最小化的实验工具。各转换阶段应保持语言等价，并能通过字符串测试验证。错误正则应给出明确解析反馈。

**English:** The deliverable should genuinely implement regex parsing, AST construction, NFA generation, subset construction to DFA, and DFA minimization. Each transformation should preserve language equivalence and be verifiable through test strings, with clear handling of invalid expressions.

### 检验内容 / Verification

- **中文：** 对已知正则表达式生成 NFA、DFA 和最小 DFA，并使用大量字符串比较各阶段接受结果。
- **English:** Generate NFA, DFA, and minimized DFA for known regexes and compare acceptance across many strings.
- **中文：** 检查最小 DFA 是否不存在可进一步合并的等价状态。
- **English:** Check that the minimized DFA contains no remaining equivalent states that can be merged.
- **中文：** 逐字符运行测试字符串，确认动画中的状态转移与最终接受结果一致。
- **English:** Run test strings character by character and confirm animated transitions match final acceptance.
- **中文：** 输入非法正则，检查错误位置和信息是否可理解且应用不崩溃。
- **English:** Enter invalid regexes and verify understandable error locations and stable behavior.

---

## Task 30 · 数据压缩实验室 / Data Compression Laboratory

### 原始 Prompt / Original Prompt

```text
Build an interactive data-compression laboratory.

Implement:
- Huffman coding
- one LZ-family compression algorithm of your choice

The application should show:
- source data
- symbol frequencies or dictionary state
- encoding tree or token sequence
- encoded output
- compressed size
- compression ratio
- decompression result

Users should be able to enter text and binary-like sample data.

For every valid input, decompress(compress(input)) must reproduce the original input exactly.
```

### 中文译文 / Chinese Translation

构建一个交互式数据压缩实验室。实现 Huffman 编码和一种自选的 LZ 系列压缩算法。应用应展示原始数据、符号频率或字典状态、编码树或 Token 序列、编码结果、压缩后大小、压缩率和解压结果。用户可以输入文本及类似二进制的样例数据。对所有合法输入，都必须满足 `decompress(compress(input))` 精确还原原始数据。

### 理论成果 / Expected Outcome

**中文：** 应交付两个真实可工作的压缩/解压管线，并能够解释中间状态。Huffman 树、码字和频率关系应一致；LZ 算法的 Token 或字典状态应可追踪。压缩率计算基于实际编码大小而非简单字符数估计，所有合法输入支持无损往返。

**English:** The deliverable should provide two real compression/decompression pipelines with inspectable intermediate state. Huffman trees and codes should match symbol frequencies, LZ tokens or dictionary state should be traceable, compression ratios should use actual encoded size, and all valid inputs should round-trip losslessly.

### 检验内容 / Verification

- **中文：** 对空输入、单一字符、重复文本、随机文本和二进制样例执行压缩→解压，逐字节比较结果。
- **English:** Run compression→decompression on empty, single-symbol, repetitive, random, and binary-like data and compare results byte-for-byte.
- **中文：** 核对 Huffman 码是否满足前缀码性质，频率更高符号通常获得不更长的码。
- **English:** Verify Huffman codes satisfy the prefix-code property and are consistent with symbol frequencies.
- **中文：** 检查 LZ Token 或字典引用在解压过程中均可合法解析。
- **English:** Check that every LZ token or dictionary reference can be validly resolved during decompression.
- **中文：** 比较压缩后实际位数/字节数与界面显示的压缩率。
- **English:** Compare actual encoded bit/byte size with the compression ratio reported by the UI.

---

## Task 31 · 约束谜题工作台 / Constraint Puzzle Workbench

### 原始 Prompt / Original Prompt

```text
Build an interactive constraint-puzzle workbench.

Support:
- Sudoku
- Latin squares
- custom grid-based constraint puzzles

Users should be able to:
- create a puzzle
- validate constraints
- solve it automatically
- step through the solving process
- see candidate values
- detect contradictions
- verify whether the puzzle has zero, one, or multiple solutions
- save and reload puzzles

The solver should use real constraint propagation and search rather than hard-coded solutions.
```

### 中文译文 / Chinese Translation

构建一个交互式约束谜题工作台。支持 Sudoku、Latin Square 和自定义网格约束题。用户应能够创建题目、验证约束、自动求解、逐步观察求解过程、查看候选值、检测矛盾、判断题目是无解、唯一解还是多解，并保存/加载题目。求解器必须真正使用约束传播和搜索，而不是硬编码答案。

### 理论成果 / Expected Outcome

**中文：** 应交付一个基于约束状态、候选集合和搜索树的通用求解系统。对于标准 Sudoku 和 Latin Square，应能够正确传播约束、回溯搜索并检测解的数量。逐步模式应展示真实的候选变化和决策，而不是事后编造解释。

**English:** The deliverable should use explicit constraint state, candidate sets, and search. It should correctly propagate constraints, backtrack when necessary, and determine whether puzzles have zero, one, or multiple solutions. Step mode should reflect actual solver state rather than post-hoc narration.

### 检验内容 / Verification

- **中文：** 使用已知唯一解、无解和多解题目验证求解器分类是否正确。
- **English:** Use known unique-solution, unsatisfiable, and multi-solution puzzles to verify solver classification.
- **中文：** 核对自动求得的 Sudoku/Latin Square 是否满足所有行、列和区域约束。
- **English:** Check solved Sudoku/Latin-square grids against all row, column, and region constraints.
- **中文：** 逐步模式中观察候选值只在合法约束下删除，回溯时能够恢复状态。
- **English:** In step mode, verify candidate elimination follows legal constraints and backtracking restores state.
- **中文：** 保存并重新加载自定义题目后，约束、初始值和求解状态保持一致。
- **English:** Save and reload custom puzzles and confirm constraints, givens, and solver state remain consistent.

---

## Task 32 · Tiny Programming Language IDE / Tiny Programming Language IDE

### 原始 Prompt / Original Prompt

```text
Build a browser-based IDE for a small programming language of your own design.

The language must support:
- numbers, strings, and booleans
- variables
- arithmetic and comparison operators
- if/else
- while loops
- functions
- function arguments and return values
- lexical scope

The application should include:
- a code editor
- Run and Stop controls
- syntax errors with line and column information
- runtime errors
- console output
- an AST viewer
- a step-by-step debugger
- breakpoints
- inspection of local variables

Implement a real lexer, parser, AST, and interpreter.

Do not translate the language into JavaScript and use eval().
```

### 中文译文 / Chinese Translation

构建一个浏览器端的小型编程语言 IDE，并自行设计该语言。语言必须支持数字、字符串、布尔值、变量、算术和比较运算、if/else、while、函数、参数、返回值和词法作用域。应用应包含代码编辑器、运行/停止、带行列信息的语法错误、运行时错误、控制台输出、AST 查看器、逐步调试器、断点和局部变量查看。必须真正实现 Lexer、Parser、AST 和 Interpreter，禁止把代码翻译成 JavaScript 后调用 `eval()`。

### 理论成果 / Expected Outcome

**中文：** 应交付一条完整的源码→词法分析→语法分析→AST→解释执行→调试链路。作用域、函数调用、循环和控制流语义应稳定一致；语法错误能定位行列，运行时错误不会使 IDE 崩溃。调试器中的语句位置、调用栈或局部变量应与实际解释器状态一致。

**English:** The deliverable should provide a complete source→lexer→parser→AST→interpreter→debugger pipeline. Scope, function calls, loops, and control flow should behave consistently; syntax errors should include useful locations, runtime errors should be contained, and debugger state should reflect the real interpreter.

### 检验内容 / Verification

- **中文：** 使用包含嵌套作用域、函数、循环和返回值的程序核对执行结果。
- **English:** Run programs containing nested scope, functions, loops, and returns and verify outputs.
- **中文：** 输入语法错误，检查错误行列是否准确且 AST 不被错误生成。
- **English:** Enter syntax errors and verify accurate line/column reporting without invalid AST generation.
- **中文：** 设置断点并逐步执行，比较局部变量和程序计数位置与实际语义。
- **English:** Set breakpoints and step execution, comparing local variables and execution position with expected semantics.
- **中文：** 检查实现中不存在将整段源代码直接交给 JavaScript eval/new Function 的绕过方式。
- **English:** Verify the implementation does not bypass interpretation by passing the source directly to JavaScript eval/new Function.

---

## Task 33 · Git 可视化模拟器 / Interactive Git Simulator

### 原始 Prompt / Original Prompt

```text
Build an interactive visual Git simulator.

Users should be able to:
- modify files
- stage changes
- create commits
- create and switch branches
- merge branches
- create and resolve merge conflicts
- reset
- revert
- cherry-pick commits

Visualize the commit history as a graph with branches and merges.

The working tree, staging area, branches, HEAD, and commit graph must remain internally consistent.

Include an interactive tutorial demonstrating divergence, conflict, resolution, and merge.
```

### 中文译文 / Chinese Translation

构建一个交互式 Git 可视化模拟器。用户可以修改文件、暂存变更、创建提交、创建和切换分支、合并分支、制造并解决冲突、执行 reset、revert 和 cherry-pick。提交历史需以带分支和合并的图形式可视化。Working Tree、Staging Area、Branch、HEAD 和 Commit Graph 必须始终保持内部一致，并提供一个演示分叉、冲突、解决和合并的交互教程。

### 理论成果 / Expected Outcome

**中文：** 应交付一个具备真实版本控制状态模型的 Git 模拟器，而不是只展示提交节点。Working Tree、Index 和 HEAD 应彼此区分；分支只是对提交的引用；Merge 创建双亲提交或产生冲突；Revert 产生新提交而不是移动历史；Reset 根据模式改变引用与工作区状态。所有操作后提交 DAG 保持一致。

**English:** The deliverable should model real version-control state rather than merely drawing commits. Working tree, index, HEAD, branch refs, and commit DAG should be distinct and consistent. Merge, conflict resolution, revert, reset, and cherry-pick should have semantically correct effects on history and state.

### 检验内容 / Verification

- **中文：** 构造两个分支独立提交后合并，检查提交 DAG、HEAD 和分支引用是否正确。
- **English:** Create divergent branch commits and merge them, checking the commit DAG, HEAD, and branch refs.
- **中文：** 制造同一行冲突，解决后确认合并结果和双亲关系正确。
- **English:** Create a same-line conflict, resolve it, and verify the merge result and parent relationships.
- **中文：** 比较 revert 与 reset 的历史效果，确认前者新增提交、后者移动引用。
- **English:** Compare revert and reset and confirm revert creates history while reset moves references.
- **中文：** 执行 cherry-pick 后确认产生新提交且内容来自目标提交。
- **English:** Cherry-pick a commit and verify a new commit with the expected content is created.

---

## Task 34 · Mini OS 模拟器 / Mini Operating System Simulator

### 原始 Prompt / Original Prompt

```text
Build an interactive operating-system simulator.

Simulate:
- processes
- CPU scheduling
- process states
- memory allocation
- virtual memory
- page faults
- mutexes
- semaphores
- deadlocks

Provide visualizations for:
- CPU timeline
- ready queue
- process states
- memory pages
- resource allocation graph

Allow switching between:
- FCFS
- Round Robin
- Shortest Job First
- Priority Scheduling

Users should be able to step the simulation one tick at a time.

Detect and visualize deadlocks.
```

### 中文译文 / Chinese Translation

构建一个交互式操作系统模拟器。模拟进程、CPU 调度、进程状态、内存分配、虚拟内存、缺页、互斥锁、信号量和死锁。可视化 CPU 时间线、就绪队列、进程状态、内存页和资源分配图。支持 FCFS、Round Robin、Shortest Job First、Priority Scheduling，并允许逐 Tick 推进模拟。系统应能够检测和可视化死锁。

### 理论成果 / Expected Outcome

**中文：** 应交付一个统一的离散时间模拟系统。CPU 调度、进程状态转换和内存事件由同一 Tick 驱动；不同调度算法应产生可预测的时间线差异。页访问会触发合理的 Page Fault 与替换行为，Mutex/Semaphore 状态与阻塞队列一致，资源分配图能够识别死锁环。

**English:** The deliverable should use one coherent discrete-time simulation. Scheduling, process-state transitions, memory events, synchronization, and resource allocation should advance on the same tick model. Different schedulers should produce predictable timelines, virtual-memory events should be meaningful, and deadlocks should be detectable from resource state.

### 检验内容 / Verification

- **中文：** 使用已知进程到达时间和 CPU Burst，核对各调度算法的执行顺序与等待时间。
- **English:** Use known arrival and CPU-burst data to verify execution order and waiting times for each scheduler.
- **中文：** 构造页面访问序列，检查 Page Fault 次数和内存页状态是否符合实现规则。
- **English:** Use a defined page-reference string and verify page faults and memory state according to the implemented policy.
- **中文：** 创建经典双锁死锁，确认资源分配图识别出环并将进程标记为死锁。
- **English:** Create a classic two-lock deadlock and verify cycle detection and deadlocked-process status.
- **中文：** 逐 Tick 执行并与连续运行相同 Tick 数的状态比较。
- **English:** Step tick-by-tick and compare with continuous execution for the same number of ticks.

---

## Task 35 · Mini Shell + 虚拟文件系统 / Mini Shell + Virtual File System

### 原始 Prompt / Original Prompt

```text
Build an interactive shell with a virtual file system.

Support commands such as:
- pwd
- cd
- ls
- mkdir
- touch
- cat
- echo
- cp
- mv
- rm
- find
- grep
- head
- tail
- wc

Support:
- absolute and relative paths
- . and ..
- quoted strings
- >
- >>
- |
- &&
- ;
- command history
- tab completion
- clear
- exit status
- save/load of the virtual file system

Pipelines and redirection must pass real command output between commands rather than using hard-coded special cases.
```

### 中文译文 / Chinese Translation

构建一个带虚拟文件系统的交互式 Shell。支持 `pwd`、`cd`、`ls`、`mkdir`、`touch`、`cat`、`echo`、`cp`、`mv`、`rm`、`find`、`grep`、`head`、`tail`、`wc` 等命令；支持绝对/相对路径、`.`、`..`、带引号字符串、`>`、`>>`、`|`、`&&`、`;`、命令历史、Tab 补全、clear、退出状态以及虚拟文件系统保存/加载。管道和重定向必须真正传递命令输出，不能为特定组合硬编码。

### 理论成果 / Expected Outcome

**中文：** 应交付一个具有 Shell Parser、命令执行模型和虚拟文件系统状态的终端环境。路径解析应统一处理绝对路径、相对路径、`.` 与 `..`；重定向和管道应基于标准输入/输出流组合命令；`&&` 根据退出状态决定后续执行。文件操作必须维护目录树一致性和当前工作目录。

**English:** The deliverable should provide a shell parser, command-execution model, and persistent virtual filesystem. Path resolution should consistently handle absolute/relative paths and dot segments, while pipelines and redirection should compose command I/O generically. Conditional execution should respect exit status, and filesystem operations should preserve tree integrity.

### 检验内容 / Verification

- **中文：** 执行多层目录创建和 `cd`，使用绝对/相对路径、`.`、`..` 核对 `pwd` 和文件定位。
- **English:** Create nested directories and use absolute/relative paths plus dot segments to verify pwd and file resolution.
- **中文：** 运行 `cat file | grep ERROR | wc -l` 等组合，核对中间输出真实经过管道传递。
- **English:** Run pipelines such as `cat file | grep ERROR | wc -l` and verify real output flows through each stage.
- **中文：** 测试 `>` 与 `>>` 的覆盖和追加语义，以及 `&&` 对失败命令的短路行为。
- **English:** Test overwrite/append redirection semantics and short-circuit behavior of `&&` after failures.
- **中文：** 保存虚拟文件系统、重启应用并重新载入，确认目录、文件内容和元数据恢复。
- **English:** Save the virtual filesystem, restart, reload, and verify directories, file contents, and metadata.

---

## Task 36 · Mini 关系数据库 / Mini Relational Database

### 原始 Prompt / Original Prompt

```text
Build a small relational database workbench.

Users should be able to:
- define tables and column types
- define primary keys and foreign keys
- insert, update, and delete rows
- write SQL queries

Support at least:
- SELECT
- WHERE
- ORDER BY
- GROUP BY
- COUNT
- SUM
- INNER JOIN
- LEFT JOIN

Include:
- a schema diagram
- a query editor
- query results
- an EXPLAIN-style query plan
- transactions with commit and rollback

Implement the core query behavior yourself rather than sending queries to an existing SQL database engine.
```

### 中文译文 / Chinese Translation

构建一个小型关系数据库工作台。用户能够定义表、列类型、主键和外键，插入、更新和删除行，并编写 SQL 查询。至少支持 SELECT、WHERE、ORDER BY、GROUP BY、COUNT、SUM、INNER JOIN 和 LEFT JOIN。包含 Schema Diagram、查询编辑器、查询结果、类似 EXPLAIN 的查询计划，以及带 Commit/Rollback 的事务。核心查询行为必须自行实现，不能直接把 SQL 交给现成数据库引擎执行。

### 理论成果 / Expected Outcome

**中文：** 应交付一个小型但真实的关系数据模型、SQL Parser/执行器和事务状态。查询应按照关系语义执行过滤、排序、聚合和连接；主外键约束应得到验证；事务修改在 Commit 前与持久状态分离，Rollback 能恢复。EXPLAIN 应反映实际执行步骤而非固定模板。

**English:** The deliverable should implement a real relational data model, SQL parsing/execution, constraints, and transaction state. Filtering, sorting, aggregation, and joins should follow relational semantics; commit and rollback should affect visibility correctly; and EXPLAIN-style plans should reflect actual execution steps.

### 检验内容 / Verification

- **中文：** 使用小型人工数据集核对 WHERE、ORDER BY、GROUP BY、COUNT、SUM 和 JOIN 结果。
- **English:** Use small hand-verifiable datasets to check WHERE, ORDER BY, GROUP BY, aggregates, and joins.
- **中文：** 测试主键重复、非法外键和 LEFT JOIN 缺失匹配行的行为。
- **English:** Test duplicate primary keys, invalid foreign keys, and LEFT JOIN rows without matches.
- **中文：** 在事务中修改数据后 Rollback，确认数据恢复；Commit 后确认修改持久。
- **English:** Modify data in a transaction, rollback and verify restoration; then commit and verify persistence.
- **中文：** 比较 EXPLAIN 计划与查询实际执行结构，确认不是固定占位输出。
- **English:** Compare EXPLAIN plans with actual query structure to confirm they are not static placeholders.

---

## Task 37 · 2D 刚体物理沙盒 / 2D Rigid-Body Physics Sandbox

### 原始 Prompt / Original Prompt

```text
Build an interactive 2D rigid-body physics sandbox.

Users should be able to:
- create circles and rectangles
- drag objects
- change mass, friction, and restitution
- enable or disable gravity
- connect objects with springs
- connect objects with hinge joints
- pause, resume, and advance exactly one simulation step
- delete objects
- reset the world
- save and reload scenes

Objects should collide consistently and remain stable during prolonged simulation.

Changing visual frame rate must not substantially change the physical behavior.
```

### 中文译文 / Chinese Translation

构建一个交互式 2D 刚体物理沙盒。用户可以创建圆形和矩形，拖动物体，调整质量、摩擦和恢复系数，开启或关闭重力，用弹簧和铰链连接对象，暂停、继续并精确推进一个模拟步长，删除对象、重置世界，并保存和重新载入场景。物体应稳定碰撞，长时间运行不会明显失控；视觉帧率变化不应显著改变物理行为。

### 理论成果 / Expected Outcome

**中文：** 应交付一个物理更新与渲染更新相互解耦的刚体模拟。质量、摩擦和恢复系数产生一致且可辨识的行为差异；碰撞避免明显穿透和能量爆炸；弹簧和铰链真实约束对象。暂停和单步基于固定或可控物理步长。

**English:** The deliverable should separate physics updates from rendering. Mass, friction, and restitution should produce consistent behavior, collisions should remain stable, springs and hinges should constrain bodies meaningfully, and pause/single-step should operate on a controlled timestep independent of rendering rate.

### 检验内容 / Verification

- **中文：** 使用相同初始场景在不同显示帧率下运行，比较主要运动结果是否基本一致。
- **English:** Run identical initial scenes under different rendering frame rates and compare major physical outcomes.
- **中文：** 测试高/低弹性、高/低摩擦及不同质量组合，确认参数产生合理差异。
- **English:** Test high/low restitution, friction, and mass combinations and verify plausible differences.
- **中文：** 创建弹簧和铰链组合，长时间运行检查稳定性、穿透、数值爆炸和抖动。
- **English:** Create spring and hinge systems and run them for extended periods, checking stability, penetration, explosions, and jitter.
- **中文：** 暂停后执行单步，确认每次只推进一个模拟步；保存/载入后状态恢复。
- **English:** Pause and single-step to confirm one simulation increment per action; verify save/load restores state.

---

## Task 38 · 城市交通模拟器 / City Traffic Simulator

### 原始 Prompt / Original Prompt

```text
Build an interactive city traffic simulator.

Include:
- a road network
- intersections
- traffic lights
- cars with destinations
- route planning
- congestion
- adjustable traffic demand
- adjustable traffic-light timing
- emergency vehicles
- simulation speed controls

Vehicles must choose valid routes through the road network.

Congestion should influence travel time, and changing traffic-light timing should visibly affect traffic flow.

Provide statistics including average travel time, average waiting time, throughput, and congestion by road segment.
```

### 中文译文 / Chinese Translation

构建一个交互式城市交通模拟器。包含道路网络、路口、红绿灯、带目的地的车辆、路径规划、拥堵、可调交通需求、可调信号灯配时、应急车辆和模拟速度控制。车辆必须通过道路网络选择合法路线。拥堵应影响旅行时间，调整红绿灯配时应明显影响交通流。系统提供平均旅行时间、平均等待时间、吞吐量和道路分段拥堵等统计。

### 理论成果 / Expected Outcome

**中文：** 应交付一个基于道路图和多车辆状态的离散交通模拟。车辆只能沿道路拓扑移动，并根据目的地规划路线；路口和信号灯对通行形成真实约束；交通密度提高应影响速度与排队。统计指标应从真实车辆状态计算，而非固定生成。

**English:** The deliverable should simulate traffic over a real road graph with many vehicle states. Cars should route only along valid roads, signals should constrain movement, congestion should alter speed or queuing, and reported statistics should derive from actual simulation state.

### 检验内容 / Verification

- **中文：** 给定简单路网和起终点，检查车辆路线是否为合法路径。
- **English:** Use a simple road graph with known origins/destinations and verify vehicles follow valid routes.
- **中文：** 提高交通需求后比较平均等待时间和拥堵指标是否合理上升。
- **English:** Increase traffic demand and compare waiting-time and congestion metrics for plausible changes.
- **中文：** 调整单一路口绿灯时长，观察对应方向吞吐量和排队长度变化。
- **English:** Change one intersection's signal timing and observe corresponding throughput and queue changes.
- **中文：** 暂停/单步/变速后确认车辆状态连续，不出现瞬移或丢车。
- **English:** Pause, step, and change speed while confirming continuous vehicle state without teleportation or loss.

---

## Task 39 · 进化生态系统 / Evolutionary Ecosystem Simulator

### 原始 Prompt / Original Prompt

```text
Build an interactive evolutionary ecosystem simulator.

Organisms should have inheritable traits such as:
- speed
- size
- vision range
- energy efficiency

Organisms must:
- search for food
- consume energy
- reproduce
- pass traits to offspring with mutation
- die when energy reaches zero

Include predators and prey, population graphs, trait-distribution graphs, adjustable mutation rate, adjustable food availability, simulation speed, pause/step controls, and deterministic seeded runs.

Using the same seed and parameters must reproduce the same simulation.
```

### 中文译文 / Chinese Translation

构建一个交互式进化生态系统模拟器。生物具有速度、体型、视野范围、能量效率等可遗传属性；必须寻找食物、消耗能量、繁殖、通过突变把性状传给后代，并在能量归零时死亡。包含捕食者与猎物、种群图、性状分布图、可调突变率、可调食物供给、模拟速度、暂停/单步和确定性 Seed。使用相同 Seed 和参数时必须复现相同模拟。

### 理论成果 / Expected Outcome

**中文：** 应交付一个真正由个体状态、遗传和环境资源驱动的生态模拟，而非随机动画。个体性状影响移动、觅食或能耗；繁殖复制并突变性状；死亡和捕食改变种群。所有随机决策由 Seed 驱动，使相同输入可重放。

**English:** The deliverable should be a genuine individual-based ecosystem driven by traits, inheritance, resources, and seeded randomness rather than random visual motion. Traits should influence behavior or energy, reproduction should inherit with mutation, and identical seeds plus inputs should reproduce the same run.

### 检验内容 / Verification

- **中文：** 相同 Seed 和参数运行两次，比较关键事件序列、种群曲线或最终状态是否一致。
- **English:** Run twice with the same seed and parameters and compare key events, population curves, or final state.
- **中文：** 设置突变率为 0，确认后代性状不会无故变化；提高突变率后出现可测分布变化。
- **English:** Set mutation rate to zero and confirm traits remain inherited exactly; raise it and observe measurable distribution changes.
- **中文：** 减少食物供给或提高捕食压力，检查种群变化是否符合机制。
- **English:** Reduce food or increase predation and verify population changes reflect the implemented mechanisms.
- **中文：** 逐步推进模拟，检查能量消耗、繁殖和死亡事件与个体状态一致。
- **English:** Step the simulation and verify energy use, reproduction, and death events match organism state.

---

## Task 40 · 机械臂逆运动学实验室 / Robot Arm Inverse Kinematics Laboratory

### 原始 Prompt / Original Prompt

```text
Build an interactive inverse-kinematics laboratory for a multi-joint robot arm.

Users should be able to:
- choose the number of joints
- set link lengths
- set joint-angle limits
- drag the end-effector target
- solve joint angles automatically
- switch between at least two IK solving methods
- visualize reachable and unreachable targets
- display joint angles and end-effector error
- animate the arm moving toward the solution
- save and reload configurations

The solver must respect link lengths and joint limits.
```

### 中文译文 / Chinese Translation

构建一个多关节机械臂逆运动学实验室。用户可以选择关节数量、设置连杆长度和关节角限制，拖动末端目标点并自动求解关节角；至少支持两种 IK 求解方法，可视化可达/不可达目标，显示关节角和末端误差，动画展示机械臂向解移动，并保存/加载配置。求解器必须严格遵守杆长和关节限制。

### 理论成果 / Expected Outcome

**中文：** 应交付一个真实的多关节运动学系统。正向运动学用于从关节角计算末端位置，逆运动学通过迭代或解析方法逼近目标。所有连杆长度保持恒定，关节角不越界；不可达目标应得到稳定的最接近结果或明确提示。

**English:** The deliverable should provide real forward and inverse kinematics. Link lengths must remain constant, joint limits must be respected, and the solver should converge toward reachable targets while handling unreachable targets gracefully. At least two solving methods should be meaningfully distinct.

### 检验内容 / Verification

- **中文：** 对可达目标计算末端位置误差，确认低于合理阈值。
- **English:** For reachable targets, compute end-effector error and verify it falls below a reasonable tolerance.
- **中文：** 在整个求解和动画过程中采样连杆长度，确认恒定。
- **English:** Sample link lengths throughout solving and animation and confirm they remain constant.
- **中文：** 设置严格关节角限制，确认求解结果不会超界。
- **English:** Set strict joint-angle limits and verify solutions never exceed them.
- **中文：** 对不可达目标检查应用是否稳定收敛到边界解或明确提示，而不是振荡或崩溃。
- **English:** Test unreachable targets and confirm stable boundary behavior or clear feedback rather than divergence or crashes.

---

## Task 41 · PID 控制系统实验室 / PID Control Systems Laboratory

### 原始 Prompt / Original Prompt

```text
Build an interactive PID control laboratory.

Include at least two simulated plants, such as:
- a temperature system
- a motor or cart position system

Users should be able to:
- set a target value
- adjust P, I, and D gains
- apply a disturbance
- start, pause, reset, and step the simulation
- view setpoint, process value, control output, and error over time

Calculate and display:
- overshoot
- settling time
- steady-state error

Changing PID parameters should visibly affect the response according to the simulated dynamics.
```

### 中文译文 / Chinese Translation

构建一个交互式 PID 控制实验室。至少包含两种被控对象，例如温控系统和电机/小车位置系统。用户可以设置目标值、调整 P/I/D 增益、施加扰动，并启动、暂停、重置和单步模拟；同时查看设定值、过程值、控制输出和误差随时间变化。系统应计算超调量、稳定时间和稳态误差。改变 PID 参数时，应按照模拟动力学产生可观察的响应变化。

### 理论成果 / Expected Outcome

**中文：** 应交付一个基于数值积分或离散动力学的控制模拟，而不是预制曲线。PID 输出由当前误差、积分项和微分项计算；被控对象根据自身动态更新状态。统计指标应从实际响应曲线计算。

**English:** The deliverable should simulate plant dynamics numerically rather than display pre-baked response curves. PID output should derive from proportional, integral, and derivative terms, plant state should update from its dynamics, and performance metrics should be computed from the actual response.

### 检验内容 / Verification

- **中文：** 设置 I=D=0 仅改变 P，观察响应变化是否符合比例控制的一般趋势。
- **English:** Set I=D=0 and vary P, checking response changes consistent with proportional control.
- **中文：** 加入积分项并比较稳态误差，检查统计值来自实际曲线。
- **English:** Add integral action and compare steady-state error, verifying metrics derive from the actual response.
- **中文：** 施加扰动后检查控制器恢复过程和误差曲线。
- **English:** Apply a disturbance and inspect controller recovery and error curves.
- **中文：** 暂停后逐步推进，确认每步状态与连续模拟的同时间结果一致。
- **English:** Pause and step the simulation, comparing with continuous simulation at equivalent times.

---

## Task 42 · Sokoban Studio 推箱子工作室 / Sokoban Studio

### 原始 Prompt / Original Prompt

```text
Build a complete Sokoban game and level editor.

Include:
- player movement
- box pushing
- goals
- restart
- undo and redo
- level editing
- level import/export
- an automatic solver
- solution replay
- deadlock detection for obvious unsolvable states such as boxes trapped in non-goal corners

The solver must produce a move sequence that can be replayed in the actual game to solve the level.
```

### 中文译文 / Chinese Translation

构建一个完整的推箱子游戏与关卡编辑器。包含玩家移动、推动箱子、目标点、重开、撤销/重做、关卡编辑、关卡导入导出、自动求解器、解法回放，以及对箱子被推入非目标死角等明显无解状态的死锁检测。求解器输出的移动序列必须能够在真实游戏中回放并完成关卡。

### 理论成果 / Expected Outcome

**中文：** 应交付一个规则正确的推箱子状态机、编辑器和求解器。玩家不能拉箱子或穿墙，箱子移动遵循合法推动规则。求解器基于游戏真实状态搜索，并输出可以逐步回放的有效解。明显死锁应在搜索或交互中被识别。

**English:** The deliverable should combine a correct Sokoban state machine, editor, and solver. Movement and pushing rules must be exact, the solver should search real game states and output a replayable solution, and obvious deadlocks should be detected rather than explored indefinitely.

### 检验内容 / Verification

- **中文：** 对多个已知小关卡运行求解器，将输出动作逐步回放，确认最终所有箱子位于目标。
- **English:** Run the solver on known small levels and replay its moves step-by-step, confirming all boxes reach goals.
- **中文：** 测试玩家不能拉箱子、不能推两个连续箱子、不能穿墙。
- **English:** Verify the player cannot pull boxes, push two boxes at once, or pass through walls.
- **中文：** 将箱子推入非目标角落，确认死锁检测能够识别。
- **English:** Push a box into a non-goal corner and verify deadlock detection.
- **中文：** 编辑关卡后导出再导入，确认地图和目标状态完整往返。
- **English:** Export and re-import edited levels and verify map and goal state round-trip correctly.

---

## Task 43 · 确定性塔防游戏 / Deterministic Tower Defense

### 原始 Prompt / Original Prompt

```text
Build a polished tower-defense game with a level editor.

Include:
- multiple tower types
- tower range and targeting
- tower upgrades
- enemies with different properties
- multiple waves
- currency
- win and loss states
- a map editor
- seeded randomness
- input recording
- deterministic replay

Given the same seed and exactly the same player input sequence, the replay must produce the same game outcome.
```

### 中文译文 / Chinese Translation

构建一个精致的塔防游戏和地图编辑器。包含多种防御塔、攻击范围和目标选择、塔升级、不同属性敌人、多波次、货币系统、胜负状态和地图编辑器；所有随机过程由 Seed 控制，并支持记录玩家输入和确定性回放。相同 Seed 与完全相同的玩家输入序列必须产生相同的游戏结果。

### 理论成果 / Expected Outcome

**中文：** 应交付一个完整可玩的塔防核心循环，并使用确定性模拟或受控随机源保证可重放性。敌人路径、塔攻击、伤害、经济和波次状态应由统一模拟状态驱动。回放文件只需记录 Seed 与玩家输入，即可重建相同结果。

**English:** The deliverable should provide a complete tower-defense loop with controlled randomness and deterministic simulation. Enemy paths, targeting, damage, economy, and waves should derive from a unified state model, allowing seed plus recorded player inputs to reproduce the same outcome.

### 检验内容 / Verification

- **中文：** 使用同一 Seed 和输入日志运行两次，比较敌人死亡时刻、金钱、生命和最终胜负是否一致。
- **English:** Replay the same seed and input log twice and compare enemy deaths, currency, lives, and final outcome.
- **中文：** 检查敌人始终沿合法路径移动，地图编辑后不可达路径得到明确处理。
- **English:** Verify enemies follow valid paths and edited maps with no route are handled clearly.
- **中文：** 测试塔升级、攻击范围、目标选择和伤害计算是否与 UI 数值一致。
- **English:** Test tower upgrades, range, targeting, and damage against displayed values.
- **中文：** 保存自定义地图后重新加载并完成一局，确认地图与游戏状态正确。
- **English:** Save a custom map, reload it, and complete a game to verify map and gameplay consistency.

---

## Task 44 · 浏览器音乐步进音序器 / Browser Music Sequencer

### 原始 Prompt / Original Prompt

```text
Build a browser-based music sequencer using the Web Audio API.

Include:
- at least four tracks
- a step sequencer
- BPM control
- play and stop
- looping
- per-track volume
- mute and solo
- adjustable note pitch
- swing
- multiple patterns
- a simple song arrangement view

Playback must remain synchronized when BPM changes during playback.

Muting, soloing, and editing patterns must not reset the global play position.
```

### 中文译文 / Chinese Translation

使用 Web Audio API 构建一个浏览器端音乐音序器。至少包含四条轨道、步进音序、BPM 控制、播放和停止、循环、每轨音量、静音、独奏、音高调整、Swing、多 Pattern 和简单歌曲编排视图。播放过程中改变 BPM 时必须保持同步；静音、独奏或编辑 Pattern 时不得重置全局播放位置。

### 理论成果 / Expected Outcome

**中文：** 应交付一个使用统一高精度音频时钟调度事件的音乐音序器，而不是依赖普通 UI 定时器粗略播放。BPM 改变后后续节拍间隔平滑更新，不产生多轨漂移或重置。Mute、Solo 和 Pattern 编辑只影响声音内容或未来调度，不破坏全局播放位置。

**English:** The deliverable should schedule musical events against a coherent high-precision audio clock. BPM changes should alter future timing without drift or reset, while mute, solo, and pattern edits should affect audio content without losing the global play position.

### 检验内容 / Verification

- **中文：** 长时间播放多轨 Pattern，检查不同轨道是否保持同步，无明显逐渐漂移。
- **English:** Run multi-track patterns for an extended period and verify no noticeable drift between tracks.
- **中文：** 在播放中多次改变 BPM 和 Swing，确认节拍连续且全局位置不重置。
- **English:** Change BPM and swing repeatedly during playback and confirm continuous timing without resetting global position.
- **中文：** 播放中执行 mute、solo 和 Pattern 编辑，确认只有目标声音或未来内容变化。
- **English:** Mute, solo, and edit patterns during playback and verify only intended audio or future content changes.
- **中文：** 测试多 Pattern 编排、循环边界和停止后重新播放的状态一致性。
- **English:** Verify arrangement, loop boundaries, and state consistency after stopping and restarting playback.

---

## Task 45 · 字幕时间轴编辑器 / Subtitle Timeline Editor

### 原始 Prompt / Original Prompt

```text
Build a browser-based subtitle timeline editor.

Support:
- importing SRT and VTT
- creating, editing, deleting, splitting, and merging subtitle cues
- dragging cue start and end times on a timeline
- synchronized playback with an audio or video file
- keyboard shortcuts
- zooming the timeline
- searching subtitle text
- exporting SRT and VTT
- undo and redo

Subtitle cues must never have negative duration or invalid time ordering.

Importing, editing, exporting, and re-importing should preserve timing and text as faithfully as possible.
```

### 中文译文 / Chinese Translation

构建一个浏览器端字幕时间轴编辑器。支持导入 SRT 和 VTT，创建、编辑、删除、拆分和合并字幕段，在时间轴上拖动字幕开始/结束时间，与音频或视频同步播放，提供快捷键、时间轴缩放、字幕文本搜索、SRT/VTT 导出和撤销/重做。字幕段不得出现负时长或非法时间顺序；导入、编辑、导出并再次导入后，应尽可能保持时间和文本一致。

### 理论成果 / Expected Outcome

**中文：** 应交付一个以明确 Cue 数据模型和媒体时间轴为核心的字幕编辑器。拖动、拆分、合并和文本编辑应保持时间合法性；播放头、媒体时间和字幕激活状态同步。SRT/VTT Parser 与 Serializer 应实现稳定往返，避免静默丢失文本或显著漂移时间。

**English:** The deliverable should use an explicit cue model synchronized to media time. Editing, splitting, merging, and dragging should preserve valid cue timing, while playback state should stay aligned with the active subtitle. SRT/VTT parsing and serialization should support stable round trips without silent text loss or major timing drift.

### 检验内容 / Verification

- **中文：** 导入包含多段字幕的 SRT/VTT，核对时间、文本和排序是否正确。
- **English:** Import multi-cue SRT/VTT files and verify timing, text, and ordering.
- **中文：** 拖动、拆分和合并字幕，确认不存在负时长、开始晚于结束或非法重叠状态。
- **English:** Drag, split, and merge cues and confirm no negative duration or invalid time ordering.
- **中文：** 播放媒体并跳转时间轴，检查当前字幕与播放头同步。
- **English:** Play media and seek the timeline, verifying active subtitles stay synchronized with the playhead.
- **中文：** 执行导入→编辑→导出→重新导入，比较时间和文本往返一致性。
- **English:** Perform import→edit→export→re-import and compare timing and text for round-trip consistency.

---

## 总体验收建议 / Overall Evaluation Guidance

**中文：** Phase 2 应继续将“是否满足原始 Prompt”与“实现是否超出 Prompt”分开评分。首先检查不可协商的显式约束，例如单一 SVG、运动关系、机械或轨道层级、参数保持、暂停/继续、依赖更新、确定性、约束求解、回放一致性、公式循环检测、数据库事务语义、Git 状态一致性等；然后再评估系统一致性、功能完整度、视觉质量、鲁棒性、可访问性、性能和工程组织。

与 Phase 1 相比，Phase 2 的重点不再只是“有没有做出来”，而是复杂子系统是否共享一个统一、稳定且可验证的内部状态模型。建议尤其关注以下维度：

- **核心约束满足度 / Core Constraint Satisfaction**：Prompt 中不可协商的要求是否全部完成。
- **系统一致性 / System Coherence**：动画、几何、场景、时间轴、依赖图、物理状态、文件系统或数据库状态是否共享统一模型。
- **功能完整度 / Functional Completeness**：主要工作流能否从开始到结束实际完成。
- **算法正确性 / Algorithmic Correctness**：可机械验证的算法结果是否正确，例如真值表、关键路径、自动机等价性、压缩往返、IK 误差、Solver 回放等。
- **确定性 / Determinism**：要求 Seed 或 Replay 的任务能否在相同输入下复现相同结果。
- **交互正确性 / Interaction Correctness**：拖动、缩放、撤销/重做、保存/载入、暂停/继续等操作是否保持状态一致。
- **鲁棒性 / Robustness**：非法输入、循环依赖、死锁、边界情况或长时间运行是否导致崩溃、冻结或状态损坏。
- **视觉与产品质量 / Visual & Product Quality**：信息层级、视觉统一、交互反馈和整体完成度是否达到实际可用程度。
- **技术选择与工程组织 / Technology Choice & Engineering Organization**：在未限定技术栈时，模型是否选择合理工具并组织出清晰项目结构。
- **验证行为 / Verification Behavior**：Harness 是否主动运行、测试、打开、检查并修复成品，而不是只生成代码后宣布完成。
- **稳定性 / Stability**：同一 Prompt 多次运行时，核心能力和完成度是否具有可接受的一致性。

对于“复杂但容易验证”的任务，建议优先使用机械化验收。例如：

- 连杆长度在整个运动周期内保持恒定；
- Spreadsheet 公式依赖与循环引用结果正确；
- 逻辑电路输出符合真值表；
- Regex → NFA → DFA → 最小 DFA 在大量测试字符串上语言等价；
- `decompress(compress(x)) == x`；
- Git 操作后的 HEAD、分支和 Commit DAG 状态正确；
- OS 调度时间线和死锁检测符合输入；
- Shell 管道与重定向产生可预测输出；
- Database 查询、事务和约束结果可用小型数据集手工核对；
- IK 末端误差低于阈值且关节限制不被违反；
- Sokoban 求解器输出能够在真实游戏中逐步回放通关；
- 塔防在相同 Seed 与输入日志下能够确定性重放。

**English:** Phase 2 should continue scoring “satisfies the original prompt” separately from “goes beyond the prompt.” First verify non-negotiable explicit constraints, then assess coherence, completeness, algorithmic correctness, determinism, robustness, visual quality, engineering organization, verification behavior, and stability.

Compared with Phase 1, Phase 2 should focus less on whether something merely exists and more on whether interacting subsystems share one coherent, stable, and verifiable internal model. Whenever possible, use mechanical verification rather than purely subjective visual judgment: compare exact state transitions, replay logs, formula outputs, truth tables, graph results, solver outputs, round trips, timing relationships, and numerical tolerances.

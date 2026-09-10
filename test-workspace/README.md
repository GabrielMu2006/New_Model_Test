# test-workspace · 模型测试工作区

> 这个目录是**测试脚手架**，不是成果归档。成果最终移到 `Test_Results/`。
> 本文件写给**组织 agent / 维护 agent**；写给被测会话的约束在 `AGENTS.md` 与各任务目录内的 `AGENTS.md`。

---

## 0. 标准流程（照做即可，不要向用户征询方案）

**隔离方案已经定了，不再讨论、不再升级、不要再问用户"要不要用独立用户/容器/断网"。** 就三步：

| 步骤 | 谁做 | 做什么 | 产物 |
|---|---|---|---|
| 1. 建脚手架 | 组织 agent（在 `test-workspace/` 打开） | 按题目数量建 `phase-NN/task-NN-<slug>/`，每题写 `prompt.txt`（逐字原题）与 `AGENTS.md`（两条限制：**不得读取当前目录以外的信息**、**不得查询任何仓库**） | 任务目录 |
| 2. 逐题测试 | 组织者 | 每题在对应目录开一个**全新会话**，**把原题粘贴进去** | 该目录下的成果 |
| 3. 收尾审查 + 归档 | 组织 agent | 审查工具调用、统计时间/token/工具调用次数，确认没有越界（读外部信息、查询仓库），写 `SUMMARY.md`，转入 `Test_Results/` | `SUMMARY.md` + 归档目录 |

就这些。不需要开测前探针、不需要另建用户或容器、不需要额外审批。

---

## 1. 角色

| 角色 | 可以做什么 | 不可以做什么 |
|---|---|---|
| 组织者 | 决定 phase、模型、题目版本、预算；打开测试会话；审查结果 | 把参考答案、旧评语、隐藏测试提前塞进题目 |
| 组织 agent（在 `test-workspace/` 运行） | 生成脚手架、审查统计、汇总、归档、写文档 | 参与被测任务本身；替被测模型答题 |
| 被测会话（在 `task-*` 目录运行） | 只读 `prompt.txt`、只写当前目录 | 读当前目录以外的任何内容；查询任何仓库；预读后续题 |

⚠️ 组织 agent 如果读过本仓库的答案，**不得再以被测身份提交同题成绩**。

---

## 2. 目录约定

```text
test-workspace/
├── AGENTS.md                 # 被测会话的规则（总则）
├── README.md                 # 本文件
├── _templates/
│   ├── PLAN.template.md      # 阶段计划模板
│   ├── task-AGENTS.md        # 每题规则模板
│   └── submission.template.json
└── phase-NN/                 # 由组织 agent 按题目数量生成
    ├── PLAN.md               # 阶段计划：模型、harness、题目版本、预算、runId 命名
    └── task-16-<slug>/
        ├── AGENTS.md         # 从模板生成，含本题元信息（两条限制）
        ├── prompt.txt        # 逐字原题（唯一输入）
        ├── assets/           # 可选：预先批准的只读素材
        └── （模型成果：index.html / *.svg / 子目录 …）
```

命名规则：

- 阶段目录：`phase-NN`（两位数）
- 任务目录：`task-NN-<短横线小写英文>`（例如 `task-16-animated-pelican-bicycle`）
- runId：`run-<模型slug>-task-NN-rN`

> `test-workspace/phase-*/` 已加入 `.gitignore`：测试期间的中间产物不会被误提交，只有归档到 `Test_Results/` 后才入库。

---

## 3. 三步流程

### 步骤 1 · 组织 agent 建脚手架

在 `test-workspace/` 打开组织会话，说明「本次是 phase-NN，模型 X」，然后按题目数量建目录，每题包含：

1. `prompt.txt` —— **只复制该题的 `原始 Prompt`**，逐字，不加译文、不加「理论成果/检验内容」；
2. `AGENTS.md` —— 从 `_templates/task-AGENTS.md` 生成，填好第 0 节（taskId、runId、允许素材、允许域名、预算）；
3. `assets/` —— 有预先批准素材才建；
4. `phase-NN/PLAN.md` —— 从 `_templates/PLAN.template.md` 生成。

生成后自检：

- [ ] 每个 `prompt.txt` 与题面逐字一致（记录 SHA-256）；
- [ ] 没有把「理论成果 / 检验内容 / 中文译文」写进 `prompt.txt`；
- [ ] 任务目录数量与计划一致；
- [ ] 每个目录都有 `AGENTS.md`，taskId/runId 已填对。

### 步骤 2 · 组织者逐题测试

- 在对应任务目录打开一个**全新会话**（每题一个，不共享上下文）；
- **由组织者把该题的 `prompt.txt` 内容原样粘贴进对话**作为本轮输入——不要让被测会话自己去读 `prompt.txt`，避免同一题目被重复输入；
- `prompt.txt` 只作为**逐字存档与哈希依据**留在目录里（归档时进入 `runs/<run-id>/prompt.txt`）；
- 一次只测一题。

### 步骤 3 · 收尾审查 + 汇总归档

测试结束后，回到 `test-workspace/` 打开组织会话，说「本次测试结束，请审查并归档」。组织 agent 执行：

1. **审查工具调用**（见第 4 节）：有没有读当前目录以外的内容、有没有查询仓库；
2. **统计**：每题耗时、token、工具调用次数、失败次数；
3. 写 `phase-NN/SUMMARY.md`：每题 runId、状态、统计值、审查结论、已知限制；
4. 按第 5 节转入 `Test_Results/<模型>/phase-NN/`；
5. 更新阶段 README、`docs/source-audit.md`、`docs/verification.md`。

---

## 4. 收尾审查（唯一的质量检查）

数据来源是 harness 会话日志（DSH 为 `~/.dsh/sessions/<workspace>/session-<id>/session.jsonl.zstd`）。方法见 [`docs/audit-method.md`](../docs/audit-method.md)。审查三件事：

| 检查 | 判据 |
|---|---|
| **越界读取** | 工具调用里有没有访问当前任务目录以外的路径（`..`、绝对路径、其他模型目录、`~/.dsh` 等） |
| **仓库查询** | 有没有 `git clone/fetch/pull/ls-remote/remote`、`gh`、代码托管平台域名、工作区外 `.git` 目录、通过 curl/包管理器拉仓库 |
| **统计核对** | 每题的时间、token、工具调用次数与失败数是否与报告一致 |

结论措辞：**「未发现越界」**（列出检查覆盖范围与未覆盖渠道）；不得写「无污染」。

**越界处置（2026-09-10 组织者决定：标注不影响成绩录入）**：越界判定**只影响标注，不影响成绩录入**——任何 run 都不因越界判定被排除、作废、重测或改写分数。

| 档位 | 触发条件 | 记录位置 | 外显标注 | 成绩 |
|---|---|---|---|---|
| 未发现越界 | 各维度无命中 | `contamination.status` 保持 `clean` / `unknown` | 无 | 照常录入 |
| 越界尝试 / 有嫌疑 | 有越界动作但未返回外部内容；或只有嫌疑、无证据 | 审计报告 + `contamination.events`（可记 `suspected`） | **不标注** | 照常录入 |
| 确认作弊成功 | 实际读到他人答案/成果，或从仓库、网络取到题目相关内容 | 审计报告 + `events` + `evidencePaths`（`contaminated`） | **必须标注**「已确认获取外部答案」 | 照常录入，标注与成绩同处显示 |


---

## 5. 归档转换

按 `docs/result-interface.md` 的目录契约转换：

| 工作区 | 归档位置 |
|---|---|
| `task-NN-<slug>/prompt.txt` | `runs/<run-id>/prompt.txt` |
| 模型成果 | `runs/<run-id>/artifacts/`（保持相对结构） |
| 会话日志哈希、审查结论 | `runs/<run-id>/evidence/` |
| `AGENTS.md`（脚手架） | `runs/<run-id>/evidence/isolation-rules.md` |
| `PLAN.md`、`SUMMARY.md` | `phase-NN/README.md` 或 `Reviews/` |
| 人工 / AI 评价 | `runs/<run-id>/reviews/` 或 `phase-NN/Reviews/` |

> 新阶段按 `runs/<run-id>/` 组织；第一阶段与 Muse Spark 的扁平 `task-*` 布局是历史兼容例外。
> 移动后逐文件核对 SHA-256。

---

## 6. 隔离方案（已定，不再讨论）

**采用的方案**：`AGENTS.md` 两条绝对规则（不读当前目录以外的内容、不查询任何仓库）+ 收尾审查工具调用。隔离等级记为 `workspace-only`。

- 这是**策略级**约束：能防手滑、能被审查，但挡不住有意读取。
- 因此展示与报告里必须标注「策略级约束 + 事后审查」，**不得**写成「强制隔离」「无污染」。
- **不要**因此向用户提议升级到独立用户 / 容器 / 断网——方案已定，用户需要时会自己说。

---

## 7. 禁止事项

- ❌ 在 `prompt.txt` 里夹带答案提示、理论成果、评分标准；
- ❌ 用同一会话连续做多题；
- ❌ 把 `Test_Results/` 的历史答案放进被测会话可见的目录；
- ❌ 修改或美化被测模型的原始输出；
- ❌ 发现污染后删除记录、只留成功运行；
- ❌ 在没有日志证据的情况下写「无污染」；
- ❌ 就隔离方案、探针、容器升级向用户征询意见。

---

## 8. 快速检查清单

```text
[ ] PLAN.md 已写：模型 / harness / 题目版本 / 任务数 / 预算 / runId 命名
[ ] 每题 prompt.txt 只含原始 Prompt，SHA-256 已记录
[ ] 每题目录都有 AGENTS.md（两条限制），taskId / runId 正确
[ ] 测试会话逐题独立，未共享上下文
[ ] 收尾审查已覆盖：越界读取 + 仓库查询 + 统计核对
[ ] SUMMARY.md 已写：状态 / 统计 / 审查结论 / 限制
[ ] 归档到 runs/<run-id>/，逐文件哈希核对
[ ] docs/source-audit.md、docs/verification.md 已更新
```

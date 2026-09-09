# test-workspace · 模型测试启动方案

> 这个目录是**测试脚手架**，不是成果归档。成果最终要移到 `Test_Results/`。
> 本文件写给**组织者/维护 agent**；写给被测会话的约束在 `AGENTS.md` 与各任务目录内的 `AGENTS.md`。

---

## 0. 它解决什么问题

一次模型测试要同时满足三件事：**题目只给一次**、**模型看不到答案**、**过程有证据**。本目录把这三件事拆成固定动作：

| 动作 | 谁做 | 产物 |
|---|---|---|
| 搭脚手架（按题数建目录、放原题、放隔离规则） | 维护 agent | `test-workspace/phase-NN/task-XX-*/` |
| 逐题测试 | 组织者（每题目开一个会话） | 该目录下的成果 + `_probe.txt` |
| 汇总与归档 | 维护 agent | `SUMMARY.md` + `Test_Results/…/runs/<run-id>/` |

---

## 1. 角色与权限

| 角色 | 可以做什么 | 不可以做什么 |
|---|---|---|
| 组织者 | 决定 phase、模型、题目版本、预算、隔离方式；打开测试会话；判定污染 | 把参考答案、旧评语、隐藏测试提前塞进题目 |
| 维护 agent（在仓库根目录运行） | 生成脚手架、汇总、归档、写文档、审计日志 | 参与被测任务本身；替被测模型答题 |
| 被测会话（在 `task-*` 目录运行） | 只读 `prompt.txt`、只写当前目录 | 读工作区外任何内容；联网；预读后续题 |

⚠️ 维护 agent 如果读过本仓库的答案，**不得再以被测身份提交同题成绩**。

---

## 2. 目录约定

```text
test-workspace/
├── AGENTS.md                 # 被测会话的隔离规则（模板来源）
├── README.md                 # 本文件
├── _templates/
│   ├── PLAN.template.md      # 阶段计划模板
│   ├── task-AGENTS.md        # 每题隔离规则模板
│   └── submission.template.json
└── phase-NN/                 # 由维护 agent 按题目数量生成
    ├── PLAN.md               # 本阶段：模型、harness、题目版本、预算、隔离等级、runId 命名
    └── task-16-<slug>/
        ├── AGENTS.md         # 从模板生成，含本题元信息
        ├── prompt.txt        # 逐字原题（唯一输入）
        ├── assets/           # 可选：预先批准的只读素材
        ├── _probe.txt        # 组织者写：开测前探针输出
        └── （模型成果：index.html / *.svg / 子目录 …）
```

命名规则：

- 阶段目录：`phase-NN`（与 `Test_Results` 一致，两位数）
- 任务目录：`task-NN-<短横线小写英文>`（例如 `task-16-animated-pelican-bicycle`）
- runId：`run-<模型slug>-task-NN-rN`（与现有 `run-deepseek-v4-1-flash-exp-0910-task-01-r1` 保持一致）

> `test-workspace/phase-*/` 已加入 `.gitignore`：测试期间的中间产物不会被误提交，只有归档到 `Test_Results/` 后才入库。

---

## 3. 一次测试的完整流程

### 步骤 1 · 组织者下达指令

一句话即可，例如：

> 本次测试 **phase-02**，模型 **DeepSeek-V4.1-Flash-Exp-0910**，harness **DSH**，题目来自 `PROMPT/PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md`（Task 16–45）。

维护 agent 需要确认（缺失就问，不猜）：题目版本、任务数量、每题是否单轮、预算（时间/token/工具调用/重试）、允许联网的域名白名单、隔离方式。

### 步骤 2 · 维护 agent 生成脚手架

**由在 `test-workspace/` 打开的维护会话执行**（不是仓库根会话预先建好，也不是被测会话自己建）。组织者说「本次是 phase-NN」之后，该会话按题目数量建立目录，每题包含：

1. `prompt.txt` —— **只复制该题的 `原始 Prompt`**，逐字，不加译文、不加「理论成果/检验内容」；
2. `AGENTS.md` —— 从 `_templates/task-AGENTS.md` 生成，填入本题的 taskId、runId、允许资源、允许域名、预算；
3. `assets/` —— 有预先批准素材才建；
4. `phase-NN/PLAN.md` —— 从 `_templates/PLAN.template.md` 生成。

> 分工原则：**建目录的是维护会话，答题的是被测会话，两者不得是同一个会话**。维护会话可以读写仓库；被测会话只能看自己那个 `task-*/`。

生成后自检：

- [ ] 每个 `prompt.txt` 与题面逐字一致（`shasum -a 256` 记录）；
- [ ] 没有把「理论成果 / 检验内容 / 中文译文」写进 `prompt.txt`；
- [ ] 任务目录数量与计划一致；
- [ ] 每个目录都有 `AGENTS.md`，且 taskId/runId 已填对。

### 步骤 3 · 组织者逐题测试

**3.1 开测前：由组织者本人跑探针（不要让被测会话跑）**

在测试会话将要使用的同一个环境里执行，把输出存为该任务目录的 `_probe.txt`：

```bash
pwd
ls /Users 2>&1 | head -5
ls .. 2>&1 | head -5
head -1 prompt.txt
echo probe >> prompt.txt 2>&1 || echo "prompt.txt 不可写（符合预期）"
curl -sS --max-time 5 https://github.com >/dev/null 2>&1; echo "network_exit=$?"
git ls-remote https://github.com/GabrielMu2006/New_Model_Test 2>&1 | head -1; echo "git_exit=$?"
git -C / rev-parse --is-inside-work-tree 2>&1 | head -1
find / -maxdepth 4 -name .git -type d 2>/dev/null | head -3
```

判读：

| 检查 | 期望 |
| --- | --- |
| `ls /Users` / `ls ..` | 失败，或看不到仓库与其他任务 |
| `prompt.txt` 可写性 | 不可写 |
| `network_exit` | 非 0（已断网） |
| `git_exit` | 非 0（无法访问代码托管平台） |
| 仓库可见性 | 工作区之外看不到任何 `.git` 目录 |

任一项不符合 → 本次只能记为 `workspace-only`（或先修好环境再测）。

> ⚠️ 探针**不要写进被测会话的指令**：让模型自己去试探边界，等于教它越界，而且 `ls ..` 的输出会被它看见。探针属于组织者动作。

**3.2 开始测试**

- 在**对应任务目录**打开一个**全新会话**；
- 建议把该任务目录复制到**仓库外**（例如 `~/vibetest-runs/phase-02/task-16/`）或使用**独立标准用户/容器**再测——理由见第 6 节；
- 把 `prompt.txt` 的内容作为本轮输入（或让被测会话直接读 `prompt.txt`）；
- 一次只测一题，不同题之间不共享会话。

### 步骤 4 · 每题收尾

- 核对 `_probe.txt`（**由组织者写入**）；若发现边界泄漏，该 run 记为 `suspected`，不要继续；
- 导出会话日志：`~/.dsh/sessions/<workspace>/session-<id>/session.jsonl.zstd` → 复制到任务目录外的证据目录，计算 SHA-256；
- 成果保持原样，不修补、不重命名。

### 步骤 5 · 回工作区根目录汇总 + 归档

在仓库根目录（或 `test-workspace/`）打开维护会话，说：

> 本次测试结束，请汇总并归档。

维护 agent 执行：

1. 逐任务核对：成果文件、`_probe.txt`、日志哈希、是否有越界；
2. 生成 `test-workspace/phase-NN/SUMMARY.md`：每题的 runId、状态、用时/token（若可提取）、隔离等级、污染状态、已知限制；
3. 按第 5 节规则转换为 `Test_Results/<模型目录>/phase-NN/runs/<run-id>/`；
4. 更新阶段 README、`docs/source-audit.md`、`docs/verification.md`；
5. 如需上线，再走 `docs/adding-results.md` 的网站接入流程。

> **文件分工原则（重要）**：给被测会话的文件（`AGENTS.md`、`_templates/task-AGENTS.md`）**只写绝对规则**，不写「这是策略级约束」「技术上你其实能读到」这类免责说明——那等于提示模型可以尝试越界。所有关于隔离效力、探针、审计的实话，只写在**组织者文件**里：本文件、`docs/testing-protocol.md`、`PLAN.md`。

---

## 4. 题目输入纪律

- `prompt.txt` 必须与原始题面**逐字一致**，只含 `原始 Prompt` 代码块内容；
- 「中文译文」「理论成果」「检验内容」**不得**出现在 `prompt.txt`；
- 若题目需要补充指令（多轮），必须在 `PLAN.md` 里提前声明轮次与内容，并把每次追加输入单独存档，不能临时加料；
- 题目需求发生变化时**递增版本**，不覆盖原题。

---

## 5. 归档转换（test-workspace → Test_Results）

按 `docs/result-interface.md` 的目录契约转换：

| test-workspace | 归档位置 | 说明 |
|---|---|---|
| `task-16-<slug>/prompt.txt` | `runs/<run-id>/prompt.txt` | 逐字输入 |
| `task-16-<slug>/` 里的模型成果 | `runs/<run-id>/artifacts/` | 保持相对结构 |
| `_probe.txt`、日志哈希、审计结果 | `runs/<run-id>/evidence/` | 公开前脱敏 |
| `AGENTS.md`（脚手架） | `runs/<run-id>/evidence/isolation-rules.md` | 保留为隔离声明证据 |
| `PLAN.md`、`SUMMARY.md` | `phase-NN/README.md` 或 `Reviews/` | 阶段级说明 |
| 人工/AI 评价 | `runs/<run-id>/reviews/` 或 `phase-NN/Reviews/` | 分作者、分来源 |

> 第一阶段的 `task-*` 扁平结构是历史兼容例外；新阶段按 `runs/<run-id>/` 组织。
> 移动后逐文件核对 SHA-256，确认没有内容被改动。

---

## 6. 隔离方案：当前采用 AGENTS.md 约束 + 事后审计

**已定方案（2026-09-09）**：后续阶段测试统一采用「`test-workspace/AGENTS.md` 绝对规则 + 组织者探针 + 事后日志审计」，隔离等级记为 `workspace-only`。不再要求每次另建独立用户或容器；环境级隔离保留为可选升级路径。

| 等级 | 做法 | 能挡住读仓库吗 | 结论可写到 | 是否当前默认 |
|---|---|---|---|---|
| `workspace-only` | 同一用户 + 仓库内目录 + AGENTS.md 约束 + 审计 | ❌ | 「策略级约束 + 事后审计」 | ✅ **是** |
| `os-user-isolation` | 独立标准用户 + 任务目录在仓库外 | ✅（文件层面） | 文件隔离 | 可选升级 |
| `container` | 容器/虚拟机，只挂题目目录 | ✅ | 容器隔离 | 可选升级 |

**标注与统计要求**：

- 每个 run 在 `PLAN.md` 与档案中写明 `isolation.level`（默认 `workspace-only`）、网络策略、探针结果、`contamination.status`；
- `workspace-only` 的运行**可以**计入本阶段汇总，但每处展示都必须附带「策略级约束 + 事后审计」标注，**不得**表述为「强制隔离」「无污染」；
- 事后审计结果必须与该 run 一起归档（见第 7 节），没有审计结果的 `workspace-only` 运行不得计入汇总；
- 一旦某个 run 的审计发现越界，该 run 记 `suspected` 或 `contaminated`，排除出汇总并说明数量。

> 诚实说明：`workspace-only` 能防手滑、能被审计，但**挡不住有意读取**。凡对外发布或跨模型对比的结论，必须同时公布这一限制；需要更强结论时再升级到独立用户/容器。

---

## 7. 事后审计（低成本取证）

**完整方法见 [`docs/audit-method.md`](../docs/audit-method.md)**（含 DSH 多帧 zstd 日志的解压坑、日志字段表、11 项检查维度、判定措辞与归档格式）。审计脚本由**独立审计会话**自行编写，不预先实现。

要点：

- 审计对象是 harness 会话日志（DSH 为 `session.jsonl.zstd`；实测单次会话含 2000+ 压缩帧、3000+ 条记录，Node 的解压 API 只解第一帧，必须逐帧解压）；
- 必须覆盖 PTC 模式下 `run_code` 内嵌的 `tools.*` 调用，否则会漏检；
- **必须专查「仓库查询」**：`git clone/fetch/pull/ls-remote`、`gh`、代码托管平台域名、工作区外的 `.git` 目录、通过 curl/包管理器拉取仓库源码（判定标准见 `docs/audit-method.md` 4.5）；
- 审计会话**不得是被测会话本身**；
- 结论只能写「**未发现越界**」，并注明覆盖范围与未覆盖渠道（如训练数据、外部搜索无法验证）；
- 报告与脚本的哈希随 run 一起归档到 `runs/<run-id>/evidence/`。

---

## 8. 禁止事项

- ❌ 在 `prompt.txt` 里夹带答案提示、理论成果、评分标准；
- ❌ 用同一会话连续做多题；
- ❌ 把 `Test_Results/` 的历史答案放进被测会话可见的目录；
- ❌ 修改或美化被测模型的原始输出；
- ❌ 发现污染后删除记录、只留成功运行；
- ❌ 在没有日志证据的情况下写「无污染」。

---

## 9. 快速检查清单

```text
[ ] PLAN.md 已写：模型 / harness / 题目版本 / 任务数 / 预算 / 隔离等级 / 网络策略
[ ] 每题 prompt.txt 只含原始 Prompt，SHA-256 已记录
[ ] 每题目录都有 AGENTS.md，taskId / runId 正确
[ ] 测试会话逐题独立，未共享上下文
[ ] 每题 _probe.txt 已生成并核对
[ ] 会话日志已导出 + 哈希，未篡改
[ ] SUMMARY.md 已写：状态 / 隔离等级 / 污染状态 / 限制
[ ] 归档到 runs/<run-id>/，逐文件哈希核对
[ ] docs/source-audit.md、docs/verification.md 已更新
```

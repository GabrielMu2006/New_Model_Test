# 会话日志审计方法 / Session-log audit method

> **读者**：执行审计的 **独立审计会话**（在仓库根或 `test-workspace/` 打开，**不得**是被测会话本身）。
> **目标**：判定某次运行是否**越界**（读了工作区外的内容、**查询/克隆了任何仓库**、联网、被代答），产出可归档的审计报告。
> **边界**：审计只回答「有没有越界」，不回答「有没有作弊」。结论只能写「**未发现越界**」，不能写「无污染」。
> **依据**：`docs/testing-protocol.md` 第 8 节；操作流程见 `test-workspace/README.md` 第 7 节。
>
> 本文件只规定**方法**；审计脚本由审计会话自行编写，写完后把脚本与报告一并归档。

---

## 1. 输入物

| 输入 | 来源 | 必需 |
| --- | --- | --- |
| `session.jsonl.zstd`（每个 run 一个） | `~/.dsh/sessions/<workspace>/session-<id>/` | ✅ |
| `prompt.txt` 及其 SHA-256 | 任务目录 | ✅ |
| `PLAN.md`（隔离等级、网络策略、允许域名、预算） | `test-workspace/phase-NN/` | ✅ |
| 本副本身份（副本名、模型 slug、runId） | 该副本的 `phase-NN/PLAN.md` | 多副本并行时 ✅ |
| 同时存在的其他副本路径清单 | 组织者给出（如 `test-workspace/`、`test-workspace-2/`、`test-workspace-3/`） | 多副本并行时 ✅ |
| 任务目录白名单（允许访问的路径） | 由组织者给出 | ✅ |
| 工具白名单（本次允许调用的工具名） | 由组织者在 `PLAN.md` 声明 | 建议 |

**先核对完整性**：会话数量应等于 run 数量；**本应存在却缺失**的会话判定为「证据不完整」，不得用其他会话替代。

**先判定遥测可见性（见 4.0）**：若该模型 / harness 本身不提供中间工具调用记录（例如只返回最终回答、API 不回传 tool 调用），则不是「证据丢失」，而是**没有可审计的遥测**——按下述默认规则处理，不要判成证据不完整。

---

## 2. 解压：DSH 日志是多帧 zstd（关键坑）

实测（Phase 1 task-01 会话）：文件 1.37 MB，`zlib.zstdDecompressSync()` 只返回 **205 字节**（第一帧 = session 头）。

**原因**：文件由成千上万个 zstd 帧**拼接**而成；Node 的 `zstdDecompressSync` 与 `createZstdDecompress()` 流都只解第一帧。

**正确做法**：扫描帧魔数 `28 B5 2F FD`，逐帧解压再拼接。参考实现（审计脚本可据此改写）：

```js
import fs from 'node:fs';
import zlib from 'node:zlib';

function decodeSessionLog(file) {
  const buf = fs.readFileSync(file);
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const offsets = [];
  for (let i = 0; i <= buf.length - 4; i += 1) {
    if (buf.compare(magic, 0, 4, i, i + 4) === 0) offsets.push(i);
  }
  let text = '';
  for (let k = 0; k < offsets.length; k += 1) {
    const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length;
    try { text += zlib.zstdDecompressSync(buf.subarray(offsets[k], end)).toString('utf8'); } catch { /* 跳过损坏帧并记录 */ }
  }
  return { frames: offsets.length, text, records: text.split('\n').filter(Boolean).map((line) => JSON.parse(line)) };
}
```

自检：记录解压后的**帧数、字节数、记录条数**，与报告一起归档；任一异常都要写明。

---

## 3. 日志结构（实测字段）

| 记录类型 | 审计用途 |
| --- | --- |
| `session` | 会话头：`id`、`cwd`、`createdAt`、`agentPreset` —— 核对工作区是否正确 |
| `permission/preset`、`sandbox/mode`、`approval/policy` | 核对本次**实际生效**的沙箱模式与审批策略是否与 `PLAN.md` 一致 |
| `user/message` | 本轮逐字输入 —— 与 `prompt.txt` 哈希比对，确认题目未被换掉 |
| `assistant/message`、`text-chunks` | 模型可见输出 |
| `reasoning-chunks` | **推理文本（DSH 实测为明文 token 数组）** —— 扫禁止路径/文件名/站点 |
| `tool/call` | `data.name` + `data.arguments`：工具名与参数（含路径、命令） |
| `tool/result` | `data.message.content[].content[].text`：工具**返回内容** —— 判断是否真的读到了东西 |
| `tool/code-dispatch` / `tool/code-dispatch-start` | PTC 模式下的内部调用链 |
| `turn/start`、`step/start`、`step/end`、`turn/end` | 轮次与结束原因 |
| `todo/write`、`llm/retry`、`llm/retry-started` | 计划与重试记录 |

**PTC 模式必读**：实测 Phase 1 会话里模型并不直接调 `read`/`bash`，而是调 `run_code`，真实调用藏在代码字符串里：

```
name: "run_code"
arguments: {"code": "try { const a = await tools.bash({ command: 'pwd' }) ..."}
```

**只按工具名做白名单会漏检**：必须把 `run_code` 的 `code` 文本当代码扫描（提取 `tools.*(...)`、路径字面量、命令字符串）。

---

## 4. 审计维度（逐项检查）

### 4.0 遥测可见性（先做这一步）

逐维度的检查都需要工具调用记录（`tool/call`、`tool/result`）。若拿不到，先判定属于哪一种：

| 情况 | 判定 | 处理 |
| --- | --- | --- |
| 有完整 `tool/call` 记录 | `telemetry: visible` | 逐维度检查（4.1–4.11） |
| 只有部分记录（如只有最终回答、或部分工具被 harness 折叠） | `telemetry: partial` | 能查的维度照查，逐条写明**哪些维度不可见** |
| **该模型 / harness 不展示中间工具调用**（如 GPT 类 API 调用、只回最终答案的产品） | `telemetry: hidden` | **按组织者 2026-09-10 规则默认视为遵守规则**：照常计入成绩，标注「工具调用不可见 · 默认视为遵守规则」 |
| 同一 harness 其他运行有日志、本次可读却缺失 | 证据不完整 | 不得计入汇总，先找日志或说明丢失原因 |

**默认遵守的边界（必须写进报告，不得省略）**：

- 这是**默认规则**，不是审查结论：不得写成「未发现越界」「已审计」「clean」，只能写「工具调用不可见，按既定规则默认视为遵守规则」。
- 报告必须列出**未覆盖的维度**（至少：路径、命令、仓库查询、网络、读禁止内容、写越界、委派）与**本次仍然做过的检查**（题目 SHA-256 是否一致、成果是否内嵌外部资源或外链、最终回答是否暴露外部来源等）。
- 该默认不改变成绩录入：与 2026-09-10 的越界处置一致，判定只影响标注。

### 4.1 会话与策略
- 会话 `cwd` 是否就是该任务目录；
- `sandbox/mode`、`approval/policy`、`permission/preset` 是否与 `PLAN.md` 声明一致；
- 会话数是否等于 run 数。

### 4.2 工具清单
- 列出所有出现过的工具名及次数；
- 与工具白名单比对；标记白名单外工具（尤其 `subagent`、网络类、`ssh`、`skill`、MCP 类）。

### 4.3 路径
- 提取全部绝对路径、`..`、`~`、相对路径；
- 标记**工作区外**的路径（允许集合 = 任务目录 + `PLAN.md` 声明的只读素材 + 平台临时目录）；
- 检查符号链接目标是否逃出任务目录。

### 4.4 命令
- 扫 `bash` 与 `run_code` 内的命令文本，关注：`cat`/`ls`/`find`/`grep`/`head`/`tail`/`git`/`gh`/`node -e`/`python -c`/`base64`/`curl`/`wget`/`ssh`/`scp`/`docker`；
- 标记任何指向工作区外的命令。

### 4.5 仓库查询（**必查项**）
"查询仓库"包括本机与远端的一切仓库访问，命中即记越界（无论是否成功取得内容）：

- **命令**：`git clone` / `fetch` / `pull` / `ls-remote` / `remote` / `submodule` / `archive`、`gh repo|api|clone`、`hub`、`glab`；以及包管理器拉取源码（`npm install <repo>`、`pip install git+…`、`go get`、`cargo add --git`）；
- **地址**：任何 `github.com` / `gitlab.com` / `gitee.com` / `bitbucket.org` / 自建 Git 服务域名，以及 `git@…:…` 形式的仓库地址；镜像、fork、代理站、代码搜索（grep.app、sourcegraph 等）同样计入；
- **本地**：工作区之外任何 `.git` 目录、裸仓库、`git -C <path>` 指向的其他仓库、`~/.gitconfig` 中的 `insteadOf` 改写；
- **间接**：通过 `curl`/`wget` 下载仓库压缩包或 raw 文件、通过 `gh api` 读仓库内容、通过已登录凭据访问私有仓库、通过 subagent/子会话代查。

判定证据：
1. 命令或 URL 命中 → 记「仓库查询尝试」；
2. `tool/result` 返回了仓库内容（文件列表、源码、commit、README）→ 记「已获取仓库内容」；
3. 只有命令命中但报错/超时 → 记「尝试未成功」，仍属越界。

### 4.6 网络
- 提取 URL、域名、`Host`、代理设置、DNS 查询、下载/克隆行为；
- 与 `PLAN.md` 的允许域名比对；命中禁止域名、代码托管平台或展示站一律记为越界。

### 4.7 读禁止内容
两条证据合并判断：
1. **路径命中**：读取目标在工作区外；
2. **内容特征**：`tool/result` 返回文本里出现禁止内容的特征（其他模型名、仓库文件名、评分报告标题等）。
只有路径命中、但结果为空或报错 → 记「尝试越界」；路径命中且结果含内容 → 记「越界且已获取」。

### 4.8 写越界
- 写入目标是否在任务目录内；
- 是否修改了 `prompt.txt` / `AGENTS.md`；
- 是否删除/重命名/压缩日志或证据文件。

### 4.9 委派
- 是否调用 `subagent` 类工具；若有，其子会话日志是否同样审计。

### 4.10 推理文本
- 扫 `reasoning-chunks` 的 `texts` 拼接文本，查找禁止路径、文件名、站点域名；
- 注意：推理中出现路径**不等于**实际访问，需与 `tool/call` 交叉确认。

### 4.11 同题并行副本（多模型同时测时**必查项**）

自 2026-09-10 起，本机可同时存在多份工作区：`test-workspace/`、`test-workspace-2/`、`test-workspace-3/`（每个副本测一个模型）。副本初始只有框架（规则 + 手册 + `_templates/`），phase、题目与 runId 由组织 agent 在开测前按用户确认的参数现场生成，随后累积该模型的成果；因此**副本之间经常是同题**。副本之间互为「当前目录以外的内容」，**读取任一其他副本的成果即记越界**——同题答案、`_build/`、`.tmp/`、`screenshots/`、他人 `prompt.txt` 之外的一切都算。

检查项：

1. 从被测会话的 `session.cwd` 确认它属于哪个副本，并从该副本的 `phase-NN/PLAN.md` 记录模型 slug 与 runId；
2. 扫全部工具参数、命令文本、推理文本，查找**本副本以外**的副本路径片段：`test-workspace/`、`test-workspace-2/`、`test-workspace-3/`、`test-workspace-9/` 等（含绝对路径、`../test-workspace*`、通过环境变量或短路径间接到达的写法）；
3. 命中且 `tool/result` 返回同题内容 → 记「越界且已获取」，按第 5 节**标注**为「已确认获取外部答案」；仅命中未取到内容 → 记「越界尝试，未取得内容」，只记入档案，**不标注、不影响成绩**；
4. 归档时核对：本副本所有 runId 的模型 slug 与该副本 `PLAN.md` 一致，且**与其他副本不重复**。

> 副本让「读取他人答案」变得更容易（同题成果就在隔壁），因此这一维度在多副本并行期间**不得跳过**，并在审计报告中写明已检查的副本清单。

---

## 5. 判定与措辞

**越界处置（2026-09-10 组织者决定：标注不影响成绩录入）**

越界判定**只影响标注，不影响成绩录入**。任何 run 都不因越界判定被排除、作废、重测或改写分数。

| 档位 | 触发条件 | 记录位置 | 外显标注 | 成绩 |
| --- | --- | --- | --- | --- |
| 未发现越界 | 各维度无命中 | `contamination.status` 保持 `clean` / `unknown` | 无 | 照常录入 |
| 越界尝试 / 有嫌疑 | 出现越界动作但 `tool/result` 未返回外部内容；或只有嫌疑、无证据 | 审计报告 + `contamination.events`（`status` 可记 `suspected`） | **不标注** | 照常录入 |
| 确认作弊成功 | 实际读到了他人答案 / 成果，或从仓库、网络取到了题目相关内容 | 审计报告 + `events` + `evidencePaths`，`status = contaminated` | **必须标注**「已确认获取外部答案」 | 照常录入，标注与成绩同处显示 |

理由（组织者）：只有**确实作弊成功**才影响成绩的可信度；未遂与嫌疑属于过程事实，记在档案里即可，不改变成绩口径。标注必须与成绩一并呈现，不得只记录不显示。

| 情况 | `contamination.status` | 措辞 |
| --- | --- | --- |
| **工具调用不可见**（`telemetry: hidden`） | 保持 `unknown`（或按组织者裁定） | 「**工具调用不可见，按既定规则默认视为遵守规则**」+ 未覆盖维度清单 + 仍做过的检查 |
| --- | --- | --- |
| 全部维度未命中 | 保持 `unknown`（或按组织者裁定） | 「**未发现越界**」+ 覆盖范围 + 未覆盖渠道 |
| 有越界尝试但未取得内容 | `suspected` | 「存在越界尝试，未取得内容」（不标注、不影响成绩） |
| 确认作弊成功（取得外部答案/成果） | `contaminated` | 「已确认获取外部答案」+ 必须标注 |
| 证据缺失/日志不完整 | `unknown` | 「证据不完整，无法判定」 |

**禁止**写「clean」「无污染」「证明未作弊」——审计只能证明"在这些渠道里没看到越界"。

---

## 6. 输出与归档

审计产出两份文件，放 `Test_Results/<模型>/phase-NN/task-NN-<slug>/evidence/`（重复运行则在其 `runs/<run-id>/evidence/`）：

1. `audit-<YYYYMMDD>.md`：人类可读报告；
2. `audit-<YYYYMMDD>.json`：机器可读结论。

JSON 至少包含：

```json
{
  "runId": "run-…",
  "sessionId": "…",
  "logPath": "…",
  "logSha256": "…",
  "frames": 0,
  "records": 0,
  "telemetry": "visible | partial | hidden",
  "checkedDimensions": ["policy", "tools", "paths", "commands", "repositories", "network", "reads", "writes", "delegation", "reasoning", "siblingWorkspaces"],
  "uncheckedDimensions": [],
  "findings": [],
  "verdict": "no-violation-observed",
  "limitations": ["训练数据不可审计", "…"],
  "auditedAt": "2026-09-09T00:00:00+08:00",
  "auditor": "<审计会话标识>"
}
```

报告需附：原始日志的 SHA-256、解压统计、脚本路径与哈希。

---

## 7. 禁止事项

- ❌ 由被测会话自己审计自己；
- ❌ 修改、截断、重排原始日志；
- ❌ 只审部分会话就下结论；
- ❌ 把「没查到」写成「没发生」；
- ❌ 在没有环境级证据时把结论升级为「强制隔离」。

---

## 8. 已知局限（必须写进报告）

- **训练数据**：模型是否在训练时见过公开题目/答案，无法用日志审计；
- **日志盲区**：harness 未记录的渠道（外部工具、连接器、缓存）；
- **推理可见性**：本次实测 DSH 的推理是明文 token 数组；若换 harness 后为加密或截断，必须注明；
- **PTC 包装**：未解析 `run_code` 内嵌调用会导致漏检；
- **路径≠访问**：推理或参数里出现路径不等于真的读了内容，判定要以 `tool/result` 为准；
- **仓库可达性不做环境探测**：本流程不跑探针，只按日志判定有没有实际发起仓库查询。
- **无工具遥测的模型**：`telemetry: hidden` 的运行无法逐维度检查，按 4.0 的默认规则处理；报告必须写明「默认遵守」并列出未覆盖维度，不得据此声称未发现越界。

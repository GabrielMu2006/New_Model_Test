> **归档说明（2026-09-09，维护 agent）**
> 本文件原为 `phase-01/AGENTS.md`，是**测试期**由 opencode 自动加载给被测会话的隔离提示，属于**被测环境配置/测试数据**，不是本仓库的维护规范。
> 入库时改名为 `evidence/isolation-rules.md`，避免后续在本目录打开会话时被 harness 自动加载成仓库指令（本仓库已实测到该现象）。**下文原文未改动**，仅在文件顶部追加本说明。
> 隔离效力评估：该文件与 `tool-config.json` 构成的是**策略级约束**（提示词 + 工具目录拒绝），不是强制隔离；本次运行的隔离等级记为 `workspace-only`。详见 `docs/testing-protocol.md` 第 8 节。

---

# Phase-01 测试隔离规则（任务阶段强制执行）

> 生效范围：`Test_Results/Muse-Spark-1.3_Opencode/phase-01/` 启动的每个新 session。
> 解除条件：用户明确说“任务结束/开始总结”之前，一直有效。

## 1. 工作区锁定
- 只允许在当前工作目录 `phase-01/` 及其子目录 `task-XX-*/` 内进行 `read / glob / grep / edit / write / bash`。
- 禁止读取、列目录、搜索以下位置（包括但不限于）：
  - `New_Model_Test/` 下的其他任何目录：`DeepSeek-*/`、`PROMPT/`、`docs/`、`website/`、根 `README.md`、`15_TEST_PROMPTS_BILINGUAL.md`
  - 用户主目录其他位置、`~/.dsh/`、`~/.config/opencode/`（除非用户解除隔离）
  - 公开展示站 `vibetest.gabrielmu2006.cn` 及 GitHub 上的历史答案（防止抄旧交付物）
- 每个任务只做用户在本轮对话中当场给出的那一题，不预读、不猜测后续题。

## 2. 例外
- 无例外。如需引用目录外文件，必须先停下并向用户请求授权，用户同意后才可读。

## 3. 启动要求
- 用户每次重开 session 时，请先 `cd` 到本目录再启动 `opencode`，本文件会被自动加载。

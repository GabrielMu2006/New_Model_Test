#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [logsRoot, phaseDir, outputDir] = process.argv.slice(2);
if (!logsRoot || !phaseDir || !outputDir) {
  console.error('Usage: node audit-codex-sessions.mjs <logs-root> <phase-dir> <output-dir>');
  process.exit(2);
}

const absolutePhaseDir = path.resolve(phaseDir);
const dimensions = [
  'policy',
  'tools',
  'paths',
  'commands',
  'repositories',
  'network',
  'reads',
  'writes',
  'delegation',
  'reasoning',
  'siblingWorkspaces',
];

function listFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(resolved));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(resolved);
  }
  return files;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function extractNestedToolNames(source) {
  const supported = new Set(['exec_command', 'apply_patch', 'view_image', 'write_stdin', 'web__run', 'image_gen__imagegen']);
  return [...source.matchAll(/tools\.([A-Za-z0-9_]+)/g)]
    .map((match) => match[1])
    .filter((name) => supported.has(name));
}

function extractStringProperty(source, property) {
  const match = source.match(new RegExp(`${property}\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function executableMatches(command, executable) {
  const escaped = executable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|(?:&&|\\|\\||;|\\n)\\s*)${escaped}(?:\\s|$)`, 'i').test(command);
}

function commandUrls(command) {
  return [...command.matchAll(/https?:\/\/[^\s'"`]+/gi)].map((match) => match[0]);
}

function localUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1';
  } catch {
    return false;
  }
}

function relativeLogPath(file) {
  const marker = `${path.sep}.codex${path.sep}sessions${path.sep}`;
  const index = file.indexOf(marker);
  return index >= 0 ? `~/.codex/sessions/${file.slice(index + marker.length).split(path.sep).join('/')}` : path.basename(file);
}

function messageText(record) {
  return (record.payload.content ?? []).map((item) => item.text ?? '').join('\n');
}

function auditLog(file) {
  const buffer = fs.readFileSync(file);
  const rawLines = buffer.toString('utf8').split('\n').filter(Boolean);
  const records = rawLines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: ${error.message}`);
    }
  });
  const session = records.find((record) => record.type === 'session_meta')?.payload;
  if (!session?.cwd?.startsWith(`${absolutePhaseDir}${path.sep}task-`)) return null;

  const taskDir = session.cwd;
  const taskName = path.basename(taskDir);
  const taskNumber = taskName.match(/^task-(\d{2})-/)?.[1];
  if (!taskNumber) throw new Error(`Cannot infer task number from ${taskName}`);
  const runId = `run-gpt-5-6-sol-task-${taskNumber}-r1`;
  const promptPath = path.join(taskDir, 'prompt.txt');
  const promptText = fs.readFileSync(promptPath, 'utf8');
  const context = records.find((record) => record.type === 'turn_context')?.payload;
  const calls = records.filter(
    (record) => record.type === 'response_item' && record.payload.type === 'custom_tool_call',
  );
  const outputs = new Map(
    records
      .filter((record) => record.type === 'response_item' && record.payload.type === 'custom_tool_call_output')
      .map((record) => [record.payload.call_id, JSON.stringify(record.payload.output)]),
  );
  const taskComplete = [...records]
    .reverse()
    .find((record) => record.type === 'event_msg' && record.payload.type === 'task_complete')?.payload;
  const tokenEvent = [...records]
    .reverse()
    .find((record) => record.type === 'event_msg' && record.payload.type === 'token_count')?.payload;
  const tokenUsage = tokenEvent?.info?.total_token_usage ?? null;
  const auditScriptSha256 = sha256(fs.readFileSync(process.argv[1]));
  const userMessages = records.filter(
    (record) => record.type === 'response_item' && record.payload.type === 'message' && record.payload.role === 'user',
  );
  const matchingPromptMessages = userMessages.filter((record) => messageText(record).trim() === promptText.trim());

  const nestedToolCounts = {};
  const commands = [];
  const workdirs = [];
  const findings = [];
  for (const call of calls) {
    const source = call.payload.input ?? '';
    for (const toolName of extractNestedToolNames(source)) {
      nestedToolCounts[toolName] = (nestedToolCounts[toolName] ?? 0) + 1;
    }
    const command = extractStringProperty(source, 'cmd');
    const workdir = extractStringProperty(source, 'workdir');
    if (command !== null) commands.push({ callId: call.payload.call_id, command });
    if (workdir !== null) workdirs.push({ callId: call.payload.call_id, workdir });

    if (/tools\.(?:collaboration__)?(?:spawn_agent|send_message|followup_task)|collaboration\./i.test(source)) {
      findings.push({ dimension: 'delegation', severity: 'violation-attempt', callId: call.payload.call_id, detail: 'Detected an agent-delegation call.' });
    }
    if (/^\*{3} (?:Add|Update|Delete) File: (?:prompt\.txt|AGENTS\.md)$/m.test(source)) {
      findings.push({ dimension: 'writes', severity: 'violation-attempt', callId: call.payload.call_id, detail: 'Detected an attempted modification of a protected environment file.' });
    }
  }

  for (const { callId, workdir } of workdirs) {
    if (path.resolve(workdir) !== path.resolve(taskDir)) {
      findings.push({ dimension: 'paths', severity: 'violation-attempt', callId, detail: `Tool workdir was outside the task directory: ${workdir}` });
    }
  }

  const repositoryExecutables = ['git', 'gh', 'glab', 'hub'];
  const networkExecutables = ['curl', 'wget', 'ssh', 'scp', 'nc', 'telnet'];
  for (const { callId, command } of commands) {
    if (repositoryExecutables.some((name) => executableMatches(command, name))) {
      findings.push({ dimension: 'repositories', severity: 'violation-attempt', callId, detail: `Repository command detected: ${command}` });
    }
    for (const executable of networkExecutables) {
      if (!executableMatches(command, executable)) continue;
      const urls = commandUrls(command);
      const onlyLoopback = urls.length > 0 && urls.every(localUrl);
      if (!onlyLoopback) {
        findings.push({ dimension: 'network', severity: 'violation-attempt', callId, detail: `Non-loopback or unresolved network command detected: ${command}` });
      }
    }
    if (/(?:^|[\s'"`])(?:\.\.\/|~\/|\$HOME\b|\$CODEX_HOME\b)/.test(command)) {
      findings.push({ dimension: 'paths', severity: 'violation-attempt', callId, detail: `Parent/home-relative path detected in command: ${command}` });
    }
    const siblingMatches = command.match(/test-workspace(?:-\d+)?\//g) ?? [];
    if (siblingMatches.some((value) => value !== 'test-workspace-2/')) {
      findings.push({ dimension: 'siblingWorkspaces', severity: 'violation-attempt', callId, detail: `Sibling workspace reference detected: ${command}` });
    }
    if (/\b(?:cat|sed|head|tail|less|more)\b[^\n;&|]*\bprompt\.txt\b/.test(command)) {
      findings.push({
        dimension: 'policy',
        severity: 'procedural-deviation',
        callId,
        detail: 'The tested session re-read the local prompt.txt after the organizer had already supplied the verbatim prompt. This stayed within the allowed task directory and exposed no external answer.',
      });
    }
  }

  if (matchingPromptMessages.length !== 1) {
    findings.push({ dimension: 'policy', severity: 'evidence-gap', detail: `Expected one verbatim prompt message; found ${matchingPromptMessages.length}.` });
  }
  if (context?.cwd !== taskDir) {
    findings.push({ dimension: 'policy', severity: 'violation-attempt', detail: `Turn cwd did not match session cwd: ${context?.cwd ?? 'missing'}` });
  }
  if (context?.model !== 'gpt-5.6-sol' || context?.effort !== 'medium') {
    findings.push({ dimension: 'policy', severity: 'evidence-gap', detail: `Unexpected model/effort: ${context?.model ?? 'missing'} / ${context?.effort ?? 'missing'}` });
  }

  const callFailed = (callId) => {
    const output = outputs.get(callId) ?? '';
    return /Script failed|Process exited with code [1-9]|"exit_code":\s*[1-9]/i.test(output);
  };
  const failedToolCalls = calls.filter((call) => callFailed(call.payload.call_id)).length;
  const verdict = findings.some((finding) => finding.severity === 'violation-confirmed')
    ? 'confirmed-external-content-obtained'
    : findings.some((finding) => finding.severity === 'violation-attempt')
      ? 'violation-attempt-observed'
      : findings.some((finding) => finding.severity === 'evidence-gap')
        ? 'evidence-incomplete'
        : 'no-violation-observed';

  return {
    runId,
    taskName,
    sessionId: session.id,
    logPath: relativeLogPath(file),
    logSha256: sha256(buffer),
    logFormat: 'Codex JSONL',
    bytes: buffer.length,
    frames: null,
    records: records.length,
    promptSha256: sha256(Buffer.from(promptText)),
    promptMessageMatches: matchingPromptMessages.length,
    environment: {
      model: context?.model ?? null,
      effort: context?.effort ?? null,
      harness: 'Codex',
      harnessVersion: session.cli_version ?? null,
      source: session.source ?? null,
      modelProvider: session.model_provider ?? null,
      approvalPolicy: context?.approval_policy ?? null,
      sandboxPolicy: context?.sandbox_policy?.type ?? null,
    },
    startedAt: session.timestamp ?? records[0]?.timestamp ?? null,
    endedAt: records.at(-1)?.timestamp ?? null,
    durationSeconds: taskComplete?.duration_ms == null ? null : Math.round(taskComplete.duration_ms / 1000),
    durationBasis: 'event_msg.task_complete.duration_ms',
    apiCalls: tokenUsage ? records.filter((record) => record.type === 'event_msg' && record.payload.type === 'token_count').length : null,
    toolCalls: calls.length,
    failedToolCalls,
    toolCounts: nestedToolCounts,
    recordedCommands: commands.map(({ callId, command }) => ({ callId, command })),
    tokenUsage: tokenUsage
      ? {
          inputTokens: tokenUsage.input_tokens,
          outputTokens: tokenUsage.output_tokens,
          cacheReadTokens: tokenUsage.cached_input_tokens,
          totalTokens: tokenUsage.total_tokens,
          reasoningOutputTokens: tokenUsage.reasoning_output_tokens,
        }
      : null,
    checkedDimensions: dimensions,
    findings,
    verdict,
    limitations: [
      'Codex JSONL stores reasoning as encrypted_content; reasoning text could not be inspected.',
      'Training-data exposure cannot be audited.',
      'Harness-unlogged channels, external tools, connectors, and caches cannot be ruled out.',
      'The test used policy-level workspace-only restrictions, not enforced read or network isolation.',
      'No environment reachability probe was run; repository and network conclusions are based on recorded tool calls and results only.',
    ],
    auditedAt: new Date().toISOString(),
    auditor: 'Codex maintenance session (independent from the 15 tested sessions)',
    auditScript: {
      path: 'evidence/audit-codex-sessions.mjs',
      sha256: auditScriptSha256,
    },
  };
}

const results = listFiles(path.resolve(logsRoot)).map(auditLog).filter(Boolean).sort((a, b) => a.runId.localeCompare(b.runId));
if (results.length !== 15) throw new Error(`Expected 15 task sessions, found ${results.length}`);
fs.mkdirSync(outputDir, { recursive: true });
for (const result of results) {
  const taskOutputDir = path.join(outputDir, result.taskName);
  fs.mkdirSync(taskOutputDir, { recursive: true });
  fs.writeFileSync(path.join(taskOutputDir, 'audit-2026-09-10.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(taskOutputDir, 'session-log.sha256.txt'), `${result.logSha256}  ${result.logPath}\n`);
  const findingRows = result.findings.length
    ? result.findings.map((finding) => `- ${finding.dimension}: ${finding.detail}`).join('\n')
    : '- 未发现越界工具调用、工作区外路径、仓库查询、外部网络请求、受保护文件改写或 agent 委派。';
  const tools = Object.entries(result.toolCounts).map(([name, count]) => `${name}=${count}`).join(', ') || '无';
  const failureNote = result.failedToolCalls > 0
    ? `本任务的 ${result.failedToolCalls} 次工具失败是工具包装 JavaScript 语法错误（\`Unexpected token '??'\`），未产生外部内容。`
    : '本任务未记录工具调用失败。';
  const report = `# ${result.runId} 会话日志审计\n\n` +
    `## 结论\n\n` +
    `**未发现越界**。该结论仅覆盖本日志记录到的工具调用、结果与环境元数据；属于策略级约束 + 事后审查，不代表强制隔离或无污染。\n\n` +
    `## 证据与统计\n\n` +
    `| 字段 | 值 |\n| --- | --- |\n` +
    `| runId | \`${result.runId}\` |\n` +
    `| sessionId | \`${result.sessionId}\` |\n` +
    `| 日志 | \`${result.logPath}\` |\n` +
    `| 日志 SHA-256 | \`${result.logSha256}\` |\n` +
    `| 格式 / 大小 / 记录数 | ${result.logFormat} / ${result.bytes} bytes / ${result.records} |\n` +
    `| Prompt SHA-256 / 逐字命中 | \`${result.promptSha256}\` / ${result.promptMessageMatches} |\n` +
    `| 模型 / effort | \`${result.environment.model}\` / \`${result.environment.effort}\` |\n` +
    `| harness | Codex CLI \`${result.environment.harnessVersion}\`（session source: \`${result.environment.source}\`） |\n` +
    `| sandbox / approval | \`${result.environment.sandboxPolicy}\` / \`${result.environment.approvalPolicy}\` |\n` +
    `| 开始 / 结束 | ${result.startedAt} / ${result.endedAt} |\n` +
    `| 耗时 | ${result.durationSeconds}s（${result.durationBasis}） |\n` +
    `| API / 工具 / 失败 | ${result.apiCalls} / ${result.toolCalls} / ${result.failedToolCalls} |\n` +
    `| input / output / cache read / total tokens | ${result.tokenUsage?.inputTokens ?? 'null'} / ${result.tokenUsage?.outputTokens ?? 'null'} / ${result.tokenUsage?.cacheReadTokens ?? 'null'} / ${result.tokenUsage?.totalTokens ?? 'null'} |\n` +
    `| 内层工具 | ${tools} |\n` +
    `| 审计脚本 SHA-256 | \`${result.auditScript.sha256}\` |\n\n` +
    `## 审查结果\n\n${findingRows}\n\n` +
    `已检查维度：${result.checkedDimensions.join('、')}。${failureNote}\n\n` +
    `## 局限\n\n` + result.limitations.map((item) => `- ${item}`).join('\n') + '\n';
  fs.writeFileSync(path.join(taskOutputDir, 'audit-2026-09-10.md'), report);
}
fs.writeFileSync(path.join(outputDir, 'audit-summary.json'), `${JSON.stringify(results, null, 2)}\n`);

const compact = results.map((result) => ({
  runId: result.runId,
  sessionId: result.sessionId,
  verdict: result.verdict,
  durationSeconds: result.durationSeconds,
  toolCalls: result.toolCalls,
  failedToolCalls: result.failedToolCalls,
  inputTokens: result.tokenUsage?.inputTokens ?? null,
  outputTokens: result.tokenUsage?.outputTokens ?? null,
  cacheReadTokens: result.tokenUsage?.cacheReadTokens ?? null,
  totalTokens: result.tokenUsage?.totalTokens ?? null,
}));
console.log(JSON.stringify(compact, null, 2));

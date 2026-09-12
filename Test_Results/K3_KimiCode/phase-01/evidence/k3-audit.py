import json, os, re, glob, sys

BASE = os.path.expanduser('~/.kimi-code/sessions')
WS = '/Users/gabrielmu/Documents/New_Model_Test/test-workspace-2/phase-01'

tasks = {}
for wd in sorted(glob.glob(f'{BASE}/wd_task-*')):
    m = re.search(r'wd_(task-\d+-[a-z0-9-]+)_', wd)
    if not m: continue
    slug = m.group(1)
    taskdir = f'{WS}/{slug}'
    sessions = glob.glob(f'{wd}/session_*')
    tasks[slug] = {'wd': wd, 'sessions': sessions, 'taskdir': taskdir}

BASH_FORBIDDEN = [
    (r'\bgit\s+(clone|fetch|pull|ls-remote|remote|log|status|diff|show|add|commit|push|tag|checkout|stash|merge|rebase|reset)\b', 'git 仓库操作'),
    (r'\bgh\b', 'gh CLI'),
    (r'\b(curl|wget|ping|ssh|scp|rsync|ftp)\b', '网络命令'),
    (r'https?://', 'URL 访问'),
    (r'\b(npm|pnpm|yarn|pip|pip3|brew|cargo|gem)\s+(install|add|search|view|info)\b', '包管理器拉取'),
    (r'\.\./|\.\.\\', '父目录引用'),
    (r'(~\/\.kimi-code|~\/\.dsh|\.kimi-code\/|\.dsh\/)', 'harness 配置/日志目录'),
    (r'(Test_Results|/PROMPT/|/docs/|/website/|test-workspace(?!-2)|test-workspace-3|_templates)', '工作区外项目内容'),
    (r'/Users/[^\s"\']+', '绝对路径(需逐一判定)'),
    (r'\b(open|start)\b.*https?://', '打开外部 URL'),
]

def resolve(p, cwd):
    if not p:
        return None
    p = os.path.expanduser(p)
    if not p.startswith('/'):
        p = os.path.normpath(os.path.join(cwd, p))
    return os.path.realpath(p)

report = {}
for slug, info in sorted(tasks.items()):
    taskdir = os.path.realpath(info['taskdir'])
    r = {'sessions': len(info['sessions']), 'tools': {}, 'oob': [], 'bash_flags': [],
         'web_tools': 0, 'agent_tool': 0, 'turns': set(), 'retries': 0,
         'usage': {'inputOther':0,'output':0,'inputCacheRead':0,'inputCacheCreation':0},
         'durationMs': None, 'apiFailures': 0, 'toolErrors': 0, 'approvals': 0,
         'promptAccepted': 0, 'firstTs': None, 'lastTs': None}
    for sess in info['sessions']:
        wire = f'{sess}/agents/main/wire.jsonl'
        log = f'{sess}/logs/kimi-code.log'
        r['sessionId'] = os.path.basename(sess).replace('session_','')
        if os.path.exists(log):
            txt = open(log, errors='replace').read()
            r['apiCalls'] = txt.count('llm request ')
            r['apiFailures'] += txt.count('llm request failed')
            ts = re.findall(r'^(\S+T\S+)Z', txt, re.M)
            if ts: r['logFirst'], r['logLast'] = ts[0]+'Z', ts[-1]+'Z'
        with open(wire) as f:
            for line in f:
                try: e = json.loads(line)
                except: continue
                t = e.get('type')
                tm = e.get('time') or e.get('created_at')
                if tm:
                    r['firstTs'] = tm if r['firstTs'] is None else min(r['firstTs'], tm)
                    r['lastTs'] = tm if r['lastTs'] is None else max(r['lastTs'], tm)
                if t == 'prompt.accepted': r['promptAccepted'] += 1
                elif t == 'turn.step.retrying': r['retries'] += 1
                elif t == 'approval': r['approvals'] += 1
                elif t == 'usage.record' and e.get('usageScope') == 'turn':
                    for k in r['usage']: r['usage'][k] += e['usage'].get(k, 0)
                elif t == 'turn.ended':
                    r['durationMs'] = (r['durationMs'] or 0) + (e.get('durationMs') or 0)
                elif t == 'turn.prompt':
                    r['turns'].add(str(e.get('turnId', '?')))
                elif t == 'context.append_loop_event':
                    le = e['event']; lt = le.get('type')
                    if lt == 'tool.call':
                        name = le.get('name'); args = le.get('args') or {}
                        r['tools'][name] = r['tools'].get(name, 0) + 1
                        disp = ((le.get('display') or {}).get('path'))
                        if name in ('Read','Write','Edit','Glob','Grep','ReadMediaFile','NotebookEdit'):
                            p = disp or args.get('path')
                            rp = resolve(p, taskdir)
                            if rp and not (rp == taskdir or rp.startswith(taskdir + os.sep)):
                                r['oob'].append(f'{name}: {args.get("path")} -> {rp}')
                        elif name == 'Bash':
                            cmd = (args.get('command') or '')
                            cwd = resolve(args.get('cwd'), taskdir) or taskdir
                            if cwd != taskdir and not cwd.startswith(taskdir + os.sep):
                                r['oob'].append(f'Bash cwd 越界: {args.get("cwd")} -> {cwd}')
                            for pat, label in BASH_FORBIDDEN:
                                for mm in re.finditer(pat, cmd):
                                    snip = cmd[max(0,mm.start()-60):mm.end()+60].replace('\n',' ⏎ ')
                                    r['bash_flags'].append({'label': label, 'pat': pat, 'snip': snip})
                        elif name in ('WebSearch','FetchURL','WebFetch'):
                            r['web_tools'] += 1
                            r['oob'].append(f'{name}: {json.dumps(args, ensure_ascii=False)[:120]}')
                        elif name in ('Agent','AgentSwarm'):
                            r['agent_tool'] += 1
                            r['oob'].append(f'Agent 委派: {json.dumps(args, ensure_ascii=False)[:120]}')
                    elif lt == 'tool.result':
                        res = le.get('result') or {}
                        if le.get('isError') or res.get('isError') or (isinstance(res, dict) and res.get('error')):
                            r['toolErrors'] += 1
    r['turnCount'] = len(r['turns'])
    r['turns'] = sorted(r['turns'])
    r['toolCalls'] = sum(r['tools'].values())
    u = r['usage']
    r['inputTokens'] = u['inputOther'] + u['inputCacheCreation']
    r['outputTokens'] = u['output']
    r['cacheReadTokens'] = u['inputCacheRead']
    r['totalTokens'] = u['inputOther'] + u['output'] + u['inputCacheRead'] + u['inputCacheCreation']
    report[slug] = r

json.dump(report, open('/tmp/k3_audit.json','w'), ensure_ascii=False, indent=1)
for slug, r in sorted(report.items()):
    print(f"{slug}: sessions={r['sessions']} turns={r['turnCount']} tools={r['toolCalls']} {r['tools']} retries={r['retries']} apiFail={r['apiFailures']} toolErr={r['toolErrors']} oob={len(r['oob'])} bashFlags={len(r['bash_flags'])} web={r['web_tools']} agent={r['agent_tool']} dur={(r['durationMs'] or 0)//1000}s in={r['inputTokens']} out={r['outputTokens']} cacheRead={r['cacheReadTokens']}")

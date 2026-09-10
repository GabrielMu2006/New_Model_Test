import test from 'node:test';
import assert from 'node:assert/strict';
import { compact, duration, number, runDuration } from '../src/lib/format.ts';

test('duration switches to H:MM:SS once it reaches an hour', () => {
  // 不足 1 小时保持 M:SS（读起来更短）
  assert.equal(duration(0, 'zh'), '0:00');
  assert.equal(duration(51, 'zh'), '0:51');
  assert.equal(duration(291, 'zh'), '4:51');
  assert.equal(duration(3540, 'zh'), '59:00');
  // 达到 1 小时必须带小时位：此前输出 138:02 / 324:18 这类「分钟 > 59」的读法
  assert.equal(duration(3600, 'zh'), '1:00:00');
  assert.equal(duration(8282, 'zh'), '2:18:02');
  assert.equal(duration(11176, 'zh'), '3:06:16');
  assert.equal(duration(19458, 'zh'), '5:24:18');
  assert.equal(duration(4606, 'en'), '1:16:46');
  assert.equal(duration(138.6, 'zh'), '2:19', 'rounds to the nearest second');
});

test('a missing duration is never rendered as zero', () => {
  assert.equal(duration(null, 'zh'), '未记录');
  assert.equal(duration(null, 'en'), 'Not recorded');
  assert.equal(number(null, 'zh'), '未记录');
  assert.equal(compact(null, 'en'), 'Not recorded');
  assert.equal(number(0, 'zh'), '0', 'a real zero is still a zero');
});

test('runs are always shown in the unified format, not the archived label', () => {
  // 归档标签（「4分51秒」）与计算写法此前在同一页并存；展示统一走 durationSeconds。
  assert.equal(runDuration({ durationSeconds: 291, durationLabel: '4分51秒' }, 'zh'), '4:51');
  assert.equal(runDuration({ durationSeconds: 8282, durationLabel: '138分2秒' }, 'zh'), '2:18:02');
  assert.equal(runDuration({ durationSeconds: 51, durationLabel: '51秒' }, 'en'), '0:51');
  // 极端情况（归档只有文本、没有秒数）宁可显示原文也不显示「未记录」，避免丢值
  assert.equal(runDuration({ durationSeconds: null, durationLabel: '4分51秒' }, 'zh'), '4分51秒');
  assert.equal(runDuration({ durationSeconds: null, durationLabel: null }, 'zh'), '未记录');
});

test('token counts are grouped and compacted per locale', () => {
  assert.equal(number(134487, 'en'), '134,487');
  assert.equal(compact(1986382, 'zh'), '198.6万');
});

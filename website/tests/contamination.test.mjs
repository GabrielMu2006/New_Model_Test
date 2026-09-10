import test from 'node:test';
import assert from 'node:assert/strict';
import { telemetryOf, isAssumedCompliant, contaminationDisplay } from '../src/lib/contamination.ts';

// 2026-09-10 规则：没有工具调用遥测的模型默认视为遵守规则；越界判定只影响标注、不影响成绩。

test('telemetry visibility defaults to visible when undeclared', () => {
  assert.equal(telemetryOf({ contamination: { status: 'clean' } }), 'visible');
  assert.equal(telemetryOf({ contamination: { status: 'unknown', telemetry: null } }), 'visible');
  assert.equal(telemetryOf({}), 'visible');
  assert.equal(telemetryOf({ contamination: { telemetry: 'partial' } }), 'partial');
  assert.equal(telemetryOf({ contamination: { telemetry: 'hidden' } }), 'hidden');
});

test('hidden telemetry is assumed compliant and never rendered as an audit conclusion', () => {
  const hidden = { contamination: { status: 'unknown', telemetry: 'hidden' } };
  assert.equal(isAssumedCompliant(hidden), true);
  assert.equal(contaminationDisplay(hidden), 'assumed-compliant');
  // 可见遥测的运行不受影响
  assert.equal(contaminationDisplay({ contamination: { status: 'unknown' } }), 'status');
  assert.equal(contaminationDisplay({ contamination: { status: 'suspected' } }), 'status');
  assert.equal(contaminationDisplay({}), 'none');
});

test('a confirmed cheat is still flagged even when tool calls are hidden', () => {
  const flagged = { contamination: { status: 'contaminated', telemetry: 'hidden' } };
  assert.equal(isAssumedCompliant(flagged), false);
  assert.equal(contaminationDisplay(flagged), 'status');
});

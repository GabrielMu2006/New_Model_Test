import test from 'node:test';
import assert from 'node:assert/strict';
import { telemetryOf, isAssumedCompliant, isWithheld, contaminationDisplay } from '../src/lib/contamination.ts';

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
  assert.equal(contaminationDisplay({}), 'none');
});

test('a boundary attempt that obtained nothing is recorded but never annotated', () => {
  // 2026-09-10 组织者决定：越界尝试只记入审计档案，展示层不外显。
  const suspected = { contamination: { status: 'suspected' } };
  assert.equal(isWithheld(suspected), true);
  assert.equal(contaminationDisplay(suspected), 'withheld');
  // 即使同时没有工具调用遥测，也不应退化成「默认视为遵守规则」的标注
  assert.equal(contaminationDisplay({ contamination: { status: 'suspected', telemetry: 'hidden' } }), 'withheld');
  assert.equal(isAssumedCompliant(suspected), false);
});

test('a confirmed cheat is still flagged even when tool calls are hidden', () => {
  const flagged = { contamination: { status: 'contaminated', telemetry: 'hidden' } };
  assert.equal(isAssumedCompliant(flagged), false);
  assert.equal(isWithheld(flagged), false);
  assert.equal(contaminationDisplay(flagged), 'status');
});

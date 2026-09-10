import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonIsland } from '../src/lib/serialize.ts';

test('escapes the characters that would break out of a JSON script island', () => {
  const dangerous = { prompt: 'draw this </script><img src=x onerror=alert(1)> & <!-- -->' };
  const serialized = jsonIsland(dangerous);
  assert.ok(!serialized.includes('</script'), 'raw </script must not survive serialization');
  assert.ok(!serialized.includes('<'), 'no raw < may survive serialization');
  // 转义必须无损：JSON.parse 后与原文完全一致
  assert.deepEqual(JSON.parse(serialized), dangerous);
});

test('escapes line separators and keeps ordinary JSON intact', () => {
  const value = { text: 'a\u2028b\u2029c', nested: { list: [1, null, '未记录'] } };
  const serialized = jsonIsland(value);
  assert.ok(!serialized.includes('\u2028') && !serialized.includes('\u2029'));
  assert.deepEqual(JSON.parse(serialized), value);
  assert.equal(jsonIsland({ a: 1, b: null }), '{"a":1,"b":null}');
});

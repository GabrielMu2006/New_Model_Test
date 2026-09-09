import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/markdown.ts';

test('renders the review-body subset', () => {
  const html = renderMarkdown('- **需求对照**：无外部库 ✅\n- 结构：`index.html`(378)');
  assert.match(html, /<ul>/);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.match(html, /<strong>需求对照<\/strong>/);
  assert.match(html, /<code>index\.html<\/code>/);
});

test('keeps paragraphs and blank-line separation', () => {
  const html = renderMarkdown('第一段。\n\n第二段。');
  assert.equal((html.match(/<p>/g) ?? []).length, 2);
});

test('escapes raw HTML from the archive', () => {
  const html = renderMarkdown('缺 `<desc>`，且 <script>alert(1)</script>');
  assert.match(html, /&lt;desc&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('only allows safe link schemes', () => {
  const safe = renderMarkdown('[source](https://example.com/a)');
  assert.match(safe, /<a href="https:\/\/example\.com\/a" target="_blank" rel="noopener">source<\/a>/);
  const unsafe = renderMarkdown('[x](javascript:alert(1))');
  assert.doesNotMatch(unsafe, /href=/);
});

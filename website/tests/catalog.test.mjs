import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/extension-catalog.json', import.meta.url)));
test('production data is source-faithful and complete', () => {
  assert.equal(catalog.tasks.length, 15); assert.equal(catalog.runs.length, 15); assert.equal(catalog.reviews.length, 30);
  assert.equal(new Set(catalog.tasks.map((task) => task.id)).size, 15);
  assert.equal(catalog.tasks[0].promptOriginal, 'Build a beautiful landing page for a fictional luxury watch brand called "Aevum".\nUse only HTML, CSS and JavaScript.\nDo not use external images or libraries.\nMake it feel like a real premium product website.');
  assert.deepEqual(catalog.reviews.filter((review) => review.runId.includes('task-06')).map((review) => review.type).sort(), ['ai', 'human']);
});
test('fixture-only phase, model and repeat run expand without component changes', () => {
  const expanded = { phases: [...catalog.phases, ...fixture.phases], models: [...catalog.models, ...fixture.models], tasks: [...catalog.tasks, ...fixture.tasks], runs: [...catalog.runs, ...fixture.runs] };
  assert.equal(expanded.phases.length, 2); assert.equal(expanded.models.length, 2); assert.equal(expanded.tasks.length, 16);
  assert.equal(expanded.runs.filter((run) => run.taskId === 'task-01').length, 2);
  assert.equal(catalog.phases.length, 1); assert.equal(catalog.models.length, 1);
});

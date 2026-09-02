import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, GROUP_A, GROUP_B, SchellingModel } from '../js/model.js';

test('same seed creates the same initial board', () => {
  const a = new SchellingModel({ size: 12, seed: 'abc' });
  const b = new SchellingModel({ size: 12, seed: 'abc' });
  assert.deepEqual([...a.board], [...b.board]);
});

test('population counts are preserved after steps', () => {
  const model = new SchellingModel({ size: 16, seed: 'counts', threshold: 0.55 });
  const before = model.metrics();
  for (let i = 0; i < 8; i += 1) model.step();
  const after = model.metrics();
  assert.equal(after.groupA, before.groupA);
  assert.equal(after.groupB, before.groupB);
  assert.equal(after.empty, before.empty);
});

test('neighbor similarity ignores empty cells in denominator', () => {
  const model = new SchellingModel({ size: 8, seed: 'manual' });
  model.board.fill(EMPTY);
  const center = model.index(3, 3);
  model.board[center] = GROUP_A;
  model.board[model.index(3, 2)] = GROUP_A;
  model.board[model.index(4, 3)] = GROUP_B;
  const stats = model.neighborStats(center, GROUP_A);
  assert.equal(stats.same, 1);
  assert.equal(stats.other, 1);
  assert.equal(stats.similarity, 0.5);
});

test('an isolated resident is treated as satisfied', () => {
  const model = new SchellingModel({ size: 8, seed: 'isolated', threshold: 1 });
  model.board.fill(EMPTY);
  const center = model.index(3, 3);
  model.board[center] = GROUP_A;
  assert.equal(model.isSatisfied(center), true);
});

test('von Neumann uses at most four neighbors', () => {
  const model = new SchellingModel({ size: 8, seed: 'vn', neighborhood: 'vonNeumann' });
  const center = model.index(3, 3);
  assert.equal(model.neighborIndices(center).length, 4);
});

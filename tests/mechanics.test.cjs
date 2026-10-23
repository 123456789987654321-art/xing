const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/board.js');

test('wildcard joins one color without bridging different ordinary colors', () => {
  const b = new Board(5);
  const row = [0, 1, 2, 3].map(j => b.id(0, 1, j));
  [0, 6, 1, 1].forEach((c, i) => { b.color[row[i]] = c; });
  assert.deepEqual(b.groupOf(row[0]).sort((a,b)=>a-b), row.slice(0, 2));
  assert.deepEqual(b.groupOf(row[1]).sort((a,b)=>a-b), row.slice(1));
  assert.equal(b.hasMoves(), true);
});

test('black question-mark coating blocks matching until the block above is removed', () => {
  const b = new Board(5), hidden = b.id(0, 1, 2), above = b.id(0, 0, 2), beside = b.id(0, 1, 3);
  b.color[hidden] = b.color[beside] = 0;
  b.color[above] = 1;
  b.coat([hidden]);
  assert.equal(b.covered[hidden], 1);
  assert.deepEqual(b.groupOf(hidden), []);
  assert.equal(b.hasMoves(), false);
  b.remove([above]);
  b.revealExposed();
  assert.equal(b.covered[hidden], 0);
  assert.equal(b.groupOf(hidden).length, 2);
  b.color[above] = 1;
  b.revealExposed();
  assert.equal(b.covered[hidden], 0, 'revealed films do not reappear');
});

test('coating belongs to the piece and travels with it under gravity', () => {
  const b = new Board(5), hidden = b.id(0, 1, 2), above = b.id(0, 0, 2), bottom = b.id(0, 2, 2);
  b.color[hidden] = 0; b.color[above] = 1;
  b.coat([hidden]);
  b.applyGravity();
  assert.equal(b.color[bottom], 0);
  assert.equal(b.covered[bottom], 1);
  assert.equal(b.covered[hidden], 0);
  b.remove([hidden]); b.revealExposed();
  assert.equal(b.covered[bottom], 0);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup() {
  const el = { textContent: '', classList: { remove() {} }, setAttribute() {} };
  const ctx = vm.createContext({ document: { readyState: 'loading', addEventListener() {}, getElementById: () => el } });
  ctx.window = ctx;
  for (const file of ['mathx', 'board', 'app']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), ctx);
  const a = ctx.App;
  a.board = new ctx.Board(5);
  const ids = [a.board.id(0, 1, 1), a.board.id(0, 1, 2)];
  ids.forEach(id => { a.board.color[id] = 2; });
  a.board.color[a.board.id(2, 1, 1)] = 3;
  a.scene = { eye: [0, 0, 7], yaw: 0, pitch: 0, project: () => null };
  a.state = 'play';
  a.spawnTilesInstant();
  return { a, ids };
}
test('hint marks a legal same-color group without consuming blocks or points', () => {
  const { a, ids } = setup();
  const before = Array.from(a.board.color);
  a.score = 120;
  a.showHint();
  assert.deepEqual(Array.from(a.hintIds).sort((x,y)=>x-y), ids);
  a.updateHint(0.2);
  ids.forEach(id => {
    assert.ok(a.tiles[id].hintGlow > 0);
    assert.ok(a.tiles[id].hintLift > 0);
  });
  a.clearHover();
  assert.equal(a.hintIds.length, 2, 'moving off the button must not erase the hint');
  assert.deepEqual(Array.from(a.board.color), before);
  assert.equal(a.score, 120);
  a.updateHint(4);
  assert.equal(a.hintIds, null);
  ids.forEach(id => { assert.equal(a.tiles[id].hintGlow, 0); assert.equal(a.tiles[id].hintLift, 0); });
});
test('hint does not run during animations and handles a board with no legal group', () => {
  const { a, ids } = setup();
  a.state = 'busy';
  a.showHint();
  assert.equal(a.hintIds, null);
  a.state = 'play';
  a.board.remove([ids[0]]);
  a.showHint();
  assert.equal(a.hintIds, null);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = vm.createContext({ document: { readyState: 'loading', addEventListener() {} } });
ctx.window = ctx;
for (const file of ['mathx', 'board', 'mechanics', 'app']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), ctx);
test('定位键将六个面的箭头分别转向屏幕下方，保留缩放', () => {
  const a = ctx.App; a.board = new ctx.Board(5); a.zoom = 0.7;
  for (const f of a.board.faces) {
    a.scene = { orbit: { back: f.n.slice(), up: f.r.slice() }, dist: 6 };
    a.alignCurrentFace();
    assert.deepEqual(Array.from(a.scene.orbit.back), Array.from(f.n));
    assert.equal(a.scene.orbit.up.reduce((s, v, i) => s + v * f.d[i], 0), -1);
    assert.equal(a.zoom, 0.7); assert.equal(a.scene.dist, 6);
  }
});
test('关卡依次为普通、方板、通道，目标分递增', () => {
  assert.deepEqual([1,2,3,4].map(n => ctx.LevelProfile(n).kind), ['normal','rotor','perspective','normal']);
  for (let n = 1; n <= 4; n++) {
    assert.equal(ctx.LevelProfile(n).size, 5);
    assert.ok(ctx.App.targetFor(n + 1, 98) > ctx.App.targetFor(n, 98));
  }
});

test('independent tests use 7x7 while normal progression remains 5x5', () => {
  for (const level of [1,2,3]) {
    assert.equal(ctx.App.cubeSizeFor('test',level),7);
    assert.equal(ctx.App.cubeSizeFor('normal',level),5);
    assert.equal(ctx.App.cubeSizeFor('challenge',level),7);
  }
});

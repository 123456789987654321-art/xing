const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/mathx.js');
require('../js/scene.js');

test('vertical orbit crosses both poles with a continuous upright camera basis', () => {
  const scene = Object.create(globalThis.Scene.prototype);
  Object.assign(scene, { time: 0, shakeT: 0, dist: 7, yaw: 0.62, target: [0, 0, 0] });
  let previousUp;
  for (let i = 0; i <= 360; i++) {
    scene.pitch = i * Math.PI / 180;
    scene.updateCamera(0);
    assert.ok(scene.up, 'camera must have an up direction that can cross the poles');
    assert.ok(scene.eye.every(Number.isFinite));
    assert.ok(Math.abs(globalThis.MX.v3.dot(scene.eye, scene.up)) < 1e-8);
    assert.ok(Math.abs(Math.hypot(...scene.up) - 1) < 1e-8);
    if (previousUp) assert.ok(globalThis.MX.v3.dot(previousUp, scene.up) > 0.99);
    previousUp = scene.up;
    const view = globalThis.MX.m4.create();
    globalThis.MX.m4.lookAt(view, scene.eye, scene.target, scene.up);
    assert.ok(Array.from(view).every(Number.isFinite));
  }
});

for (const pitch of [0, Math.PI / 2, -Math.PI / 2, Math.PI, 1.55]) {
  for (const [dx, dy] of [[60, 0], [0, 60]]) {
    test(`drag ${dx},${dy} changes viewing direction at pitch ${pitch}`, () => {
      const scene = Object.create(globalThis.Scene.prototype);
      Object.assign(scene, { time: 0, shakeT: 0, dist: 7, yaw: 0.62, pitch, target: [0, 0, 0] });
      scene.updateCamera(0);
      const before = scene.eye.slice();
      scene.rotateOrbit(dx, dy);
      scene.updateCamera(0);
      assert.ok(Math.hypot(...scene.eye.map((v, a) => v - before[a])) > 2, 'drag must reveal another face, not merely spin the current face');
      assert.ok(Math.abs(Math.hypot(...scene.eye) - 7) < 1e-8);
      assert.ok(Math.abs(globalThis.MX.v3.dot(scene.eye, scene.up)) < 1e-8);
      scene.rotateOrbit(-dx, -dy);
      scene.updateCamera(0);
      assert.ok(Math.hypot(...scene.eye.map((v, a) => v - before[a])) < 1e-8);
    });
  }
}

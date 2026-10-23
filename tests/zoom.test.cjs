const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function app() {
  const slider = { value: '0', setAttribute() {} };
  const ctx = vm.createContext({ document: { readyState: 'loading', addEventListener() {}, getElementById: () => slider } });
  ctx.window = ctx;
  for (const name of ['mathx', 'app']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), ctx);
  ctx.App.scene = { fitDist: 8, dist: 10, yaw: 2, pitch: -1 };
  return { app: ctx.App, slider };
}
test('slider starts at the smallest size and smoothly magnifies to 1.6 times', () => {
  const { app: a, slider } = app();
  a.setZoom(0);
  assert.equal(a.scene.dist, 10);
  assert.equal(Number(slider.value), 0);
  a.setZoom(0.5);
  assert.ok(Math.abs(a.scene.dist - 10 / 1.3) < 1e-9);
  a.setZoom(1);
  assert.equal(a.scene.dist, 6.25);
  a.setZoom(2);
  assert.equal(a.scene.dist, 6.25);
  a.setZoom(-1);
  assert.equal(a.scene.dist, 10);
});
test('wheel/pinch distance updates the slider, resizing preserves magnification, reset restores view', () => {
  const { app: a, slider } = app();
  a.setZoomFromDistance(10 / 1.3);
  assert.ok(Math.abs(Number(slider.value) - 50) < 1e-8);
  a.scene.fitDist = 16;
  a.setZoom(a.zoom);
  assert.ok(Math.abs(a.scene.dist - 20 / 1.3) < 1e-8);
  a.resetView();
  assert.equal(a.zoom, 0);
  assert.equal(Number(slider.value), 0);
  assert.equal(a.scene.dist, 20);
  assert.equal(a.scene.yaw, 0.62);
  assert.equal(a.scene.pitch, 0.42);
});

test('wheel and pinch use the effective range rather than a hidden clamped distance',()=>{
 const {app:a,slider}=app();a.scene.zoomRange={far:20,near:12};let previous=Infinity;
 for(let step=0;step<=100;step++){a.setZoom(step/100);assert.ok(a.scene.dist<previous);previous=a.scene.dist;}
 assert.equal(a.scene.dist,12);a.setZoomFromDistance(15);assert.ok(Math.abs(a.scene.dist-15)<1e-10);assert.ok(Math.abs(Number(slider.value)-50)<1e-8);
 a.setZoomFromDistance(2);assert.equal(a.scene.dist,12);assert.equal(Number(slider.value),100);
 a.setZoomFromDistance(40);assert.equal(a.scene.dist,20);assert.equal(Number(slider.value),0);
 a.scene.zoomRange={far:40,near:24};a.setZoom(.5);assert.equal(a.scene.dist,30);assert.equal(Number(slider.value),50);
});

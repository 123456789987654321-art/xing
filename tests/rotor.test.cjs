const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/board.js');
require('../js/mechanics.js');

test('normal campaign has five sizes with three mechanics per size',()=>{
  const kinds=['normal','rotor','perspective'];
  for(let level=1;level<=15;level++) {
    const profile=LevelProfile(level,'normal');
    assert.equal(profile.size,5+Math.floor((level-1)/3));
    assert.equal(profile.kind,kinds[(level-1)%3]);
  }
  assert.equal(LevelProfile(4,'challenge').size,7);
  assert.equal(LevelProfile(4,'challenge').kind,'challenge');
});
test('2x3 rotor stays outside the shell and contacts only while its blade reaches the side', () => {
  const b = new Board(5); b.color.fill(0);
  const rotor = new Rotor(b, () => 0);
  assert.equal(rotor.colors.length, 6);
  assert.ok(rotor.contacts().length > 0);
  for (let i = 0; i < 6; i++) assert.ok(rotor.center(i)[0] - b.pitch / 2 >= 1 - 1e-8);
  rotor.angle = Math.PI;
  assert.ok(rotor.contacts().length > 0);
  assert.equal(rotor.remaining(), 6, 'rotation does not automatically eliminate blocks');
});
test('the complete rotating panel stays within the host face at every angle',()=>{
  for(const n of [5,7]) {
    const b=new Board(n),r=new Rotor(b);b.color.fill(0);
    for(let step=0;step<72;step++) {
      r.angle=step*Math.PI/36;
      const extent=b.pitch/2*(Math.abs(Math.cos(r.angle))+Math.abs(Math.sin(r.angle)));
      for(let i=0;i<6;i++) {
        const p=r.center(i);
        assert.ok(Math.abs(p[1])+extent<=b.h+1e-8);
        assert.ok(Math.abs(p[2])+extent<=b.h+1e-8);
      }
      assert.equal(new Set(r.contacts().map(p=>p[1])).size,6);
    }
  }
});

test('all six rotor cubes contact the shell at a resting position', () => {
  for (const size of [5,7]) {
    const b = new Board(size); b.color.fill(0);
    const r = new Rotor(b, () => 0);
    assert.equal(new Set(r.contacts().map(pair => pair[1])).size, 6);
    for (const [main, external] of r.contacts()) assert.ok(Math.abs(r.center(external-b.size)[0]-b.cellCenter(main)[0]-b.pitch)<1e-8);
  }
});

test('rotor holds for 2.4 seconds then turns a quarter turn over 0.8 seconds', () => {
  const r = new Rotor(new Board(5));
  r.update(2); assert.equal(r.angle, 0);
  r.update(0.8); assert.ok(Math.abs(r.angle - Math.PI / 4) < 1e-8);
  r.update(0.4); assert.ok(Math.abs(r.angle - Math.PI / 2) < 1e-8);
  r.update(2); assert.ok(Math.abs(r.angle - Math.PI / 2) < 1e-8);
});

test('panel rests flush with top right bottom left edges clockwise as seen from outside +X',()=>{
  for(const size of [5,6,7,8,9]) {
    const b=new Board(size),r=new Rotor(b);
    for(let step=0;step<4;step++) {
      r.angle=step*Math.PI/2;
      const points=Array.from({length:6},(_,i)=>r.center(i));
      const axis=step%2===0?1:2,sign=[1,-1,-1,1][step];
      const outer=Math.max(...points.map(p=>sign*p[axis]))+b.pitch/2;
      assert.ok(Math.abs(outer-b.h)<1e-8,'panel outer edge must be flush at stop '+step);
      const mean=points.reduce((sum,p)=>sum+sign*p[axis],0)/6;
      assert.ok(mean>0,'panel orbits to the requested edge instead of spinning centrally');
    }
  }
});

test('every stopped panel cube aligns with exactly one host grid cell',()=>{
  for(const size of [5,6,7,8,9]) {
    const b=new Board(size),r=new Rotor(b);b.color.fill(0);
    for(let step=0;step<4;step++) {
      r.angle=step*Math.PI/2;
      const contacts=r.contacts();
      assert.equal(contacts.length,6,'six panel cubes must contact six host cubes, without half-cell overlaps');
      for(const [id,external] of contacts) {
        const a=r.center(external-b.size),c=b.cellCenter(id);
        assert.ok(Math.abs(a[1]-c[1])<1e-8&&Math.abs(a[2]-c[2])<1e-8);
      }
    }
  }
});

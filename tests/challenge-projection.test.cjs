const test=require('node:test');
const assert=require('node:assert/strict');
require('../js/mathx.js');require('../js/scene.js');
try {require('../js/challenge-projection.js');} catch(e) {if(e.code!=='MODULE_NOT_FOUND')throw e;}
const basis=[1,0,0,0,1,0,0,0,1];
function face(id,points,z=0,color=0){return {id,color,center:[0,0,z],basis,size:[1,1,1],poly:{vertices:points.map(p=>[...p,0]),faces:[points.map((_,i)=>i)]}};}
const rect=(id,x,y,w,h,z=0,color=0)=>face(id,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],z,color);
function scene(){
  const s=Object.create(Scene.prototype);s.eye=[0,0,10];s.w=800;s.h=800;s.dpr=1;
  const p=MX.m4.create(),v=MX.m4.create();s.vp=MX.m4.create();s.invVP=MX.m4.create();
  MX.m4.perspective(p,Math.PI/4,1,.3,60);MX.m4.lookAt(v,s.eye,[0,0,0],[0,1,0]);
  MX.m4.multiply(s.vp,p,v);MX.m4.invert(s.invVP,s.vp);return s;
}
function links(tiles){assert.ok(globalThis.ChallengeProjection,'projection helper exists');return ChallengeProjection.links(scene(),tiles);}
test('adjacent polygon faces link once, excluding different and neutral colors',()=>{
  assert.deepEqual(links([rect(1,-1,0,1,1),rect(2,0,0,1,1)]),[[1,2]]);
  assert.deepEqual(links([rect(1,-1,0,1,1),rect(2,0,0,1,1,0,2)]),[]);
  assert.deepEqual(links([rect(1,-1,0,1,1,0,6),rect(2,0,0,1,1,0,6)]),[]);
});
test('corners and visible gaps never create seams',()=>{
  assert.deepEqual(links([rect(1,-1,-1,1,1),rect(2,0,0,1,1)]),[]);
  assert.deepEqual(links([rect(1,-1,0,1,1),rect(2,.004,0,1,1)]),[]);
});
test('partial occlusion creates a seam but complete occlusion hides the rear cell',()=>{
  assert.deepEqual(links([rect(1,-1,-1,2,2),rect(2,0,-1,1,2,1)]),[[1,2]]);
  assert.deepEqual(links([rect(1,-1,-1,2,2),rect(2,-2,-2,4,4,1)]),[]);
});
test('actual triangular boundaries do not invent box seams',()=>{
  assert.deepEqual(links([face(1,[[0,0],[1,0],[0,1]]),rect(2,.75,.75,.25,.25)]),[]);
  assert.deepEqual(links([face(1,[[0,0],[1,0],[0,1]]),face(2,[[1,0],[1,1],[0,1]])]),[[1,2]]);
});
test('world vertices apply scale, column-major rotation, and render center',()=>{
  assert.ok(globalThis.ChallengeProjection,'projection helper exists');
  const t=face(1,[[1,0],[0,1],[0,0]]);t.size=[2,3,1];t.basis=[0,1,0,-1,0,0,0,0,1];t.renderCenter=[5,6,7];
  assert.deepEqual(ChallengeProjection.worldVertices(t),[[5,8,7],[2,6,7],[5,6,7]]);
});
test('a cell seen through a ring hole cannot join across empty space',()=>{
  const ring=[rect(1,-2,-2,4,1),rect(2,-2,1,4,1),rect(3,-2,-1,1,2),rect(4,1,-1,1,2)];
  const result=links([...ring,rect(9,-.2,-.2,.4,.4,-1)]);
  assert.ok(result.length>0);
  assert.ok(result.every(pair=>!pair.includes(9)));
});
test('subpixel thin triangle can connect along its real long edge',()=>{
  assert.deepEqual(links([face(1,[[0,0],[.003,0],[0,1]]),rect(2,-1,0,1,1)]),[[1,2]]);
});
test('neutral opaque cells still occlude colored seams',()=>{
  assert.deepEqual(links([rect(1,-1,-1,1,2),rect(2,0,-1,1,2),rect(3,-2,-2,4,4,1,6)]),[]);
});

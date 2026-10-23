const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
test('frustum uses complete broad quad blocks and fills its exact tapered volume',()=>{
 const cells=ChallengeGeometry.make('frustum',{size:2,resolution:7,smooth:true,quadFaces:true});
 let total=0;
 for(const c of cells){
  assert.equal(c.poly.vertices.length,8);assert.equal(c.poly.faces.length,6);
  const p=c.poly.vertices.map(v=>v.map((x,i)=>x+c.center[i]));
  assert.ok(p.every(v=>Math.abs(v[0])<=1.48-.26*v[1]+1e-8&&Math.abs(v[2])<=1.48-.26*v[1]+1e-8));
  let volume=0;
  for(const f of c.poly.faces){
   assert.equal(f.length,4,'no clipped triangular blocks');
   const lengths=f.map((a,i)=>Math.hypot(...sub(p[a],p[f[(i+1)%4]])));
   assert.ok(Math.min(...lengths)>.25,'no thin horizontal strips');
   assert.ok(Math.max(...lengths)/Math.min(...lengths)<2.3);
   const normal=cross(sub(p[f[1]],p[f[0]]),sub(p[f[2]],p[f[0]]));
   assert.ok(f.every(i=>Math.abs(dot(normal,sub(p[i],p[f[0]])))<1e-8),'planar quadrilateral face');
   for(let i=1;i<f.length-1;i++)volume+=dot(p[f[0]],cross(p[f[i]],p[f[i+1]]))/6;
  }
  assert.ok(volume>0);total+=volume;
 }
 assert.ok(Math.abs(total-64/3*(1+.48+.48**2))<1e-8,'no missing wedges or double-filled volume');
});

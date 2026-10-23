const test=require('node:test');
const assert=require('node:assert/strict');
require('../js/challenge-geometry.js');
const points=c=>c.poly.vertices.map(p=>p.map((v,i)=>v+c.center[i]));
const key=p=>p.map(v=>v.toFixed(7)).join(',');
const faceKey=p=>p.map(key).sort().join(';');

test('equal crossing bands have smooth quad surfaces and exact solid junctions',()=>{
 const first=ChallengeGeometry.make('torus',{size:2.4,joinedRing:'full'});
 const second=ChallengeGeometry.make('torus',{size:2.4,joinedRing:'cross'});
 const a=first.map(points),b=second.map(c=>points(c).map(([x,y,z])=>[x,-z,y]));
 for(const cells of [first,second])for(const c of cells){
  assert.equal(c.poly.vertices.length,8);
  assert.equal(c.poly.faces.length,6);
  assert.ok(c.poly.faces.every(f=>f.length===4),'no triangular surface slivers');
 }
 const span=(all,axis)=>Math.max(...all.flat().map(p=>p[axis]))-Math.min(...all.flat().map(p=>p[axis]));
 assert.ok(Math.abs(span(a,0)-span(b,0))<1e-8,'equal diameters at their shared axis');
 assert.ok(Math.abs(span(a,2)-4.8)<1e-8);
 assert.ok(Math.abs(span(b,1)-4.8)<1e-8,'second ring extends to the same radius');
 for(const cells of [first,second])for(const c of cells)for(const p of points(c)){
  const radius=Math.hypot(p[0],p[2]);
  assert.ok(radius>=1.77&&radius<=2.40000001,'round outer silhouette and open center');
 }
 for(const aa of a)for(const bb of b){
  assert.ok([0,1,2].some(axis=>Math.min(Math.max(...aa.map(p=>p[axis])),Math.max(...bb.map(p=>p[axis])))-Math.max(Math.min(...aa.map(p=>p[axis])),Math.min(...bb.map(p=>p[axis])))<1e-8),'no intersecting ring volume');
 }
 const faces=new Set(first.flatMap((c,i)=>c.poly.faces.map(f=>faceKey(f.map(j=>a[i][j])))));
 let contacts=0;
 second.forEach((c,i)=>c.poly.faces.forEach(f=>{if(faces.has(faceKey(f.map(j=>b[i][j]))))contacts++;}));
 assert.ok(contacts>=8,'complete rectangular contact faces join both sides');
});

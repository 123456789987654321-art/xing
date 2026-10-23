const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');
test('clipping does not create independently colored slivers',()=>{
 for(const name of ['tetrahedron','sphere','frustum','torus']){
  const cells=ChallengeGeometry.make(name,{smooth:true});
  for(const c of cells){
   let volume=0;
   for(const f of c.poly.faces){const a=c.poly.vertices[f[0]];for(let i=1;i<f.length-1;i++){
    const b=c.poly.vertices[f[i]],d=c.poly.vertices[f[i+1]];
    volume+=(a[0]*(b[1]*d[2]-b[2]*d[1])+a[1]*(b[2]*d[0]-b[0]*d[2])+a[2]*(b[0]*d[1]-b[1]*d[0]))/6;
   }}
   assert.ok(volume>=c.gridStep**3*.15-1e-8,name+' has a tiny independent fragment');
  }
 }
});
test('clipped boundary cells fill continuous shape planes while retaining solid interiors',()=>{
 for(const name of ['tetrahedron','cylinder','sphere','prism','frustum','torus']){
  const cells=ChallengeGeometry.make(name,{smooth:true});
  assert.ok(cells.some(c=>c.clipped),name+' needs cut boundary blocks');
  assert.ok(cells.some(c=>!c.clipped),name+' retains full internal blocks');
  for(const c of cells){
   for(const part of c.poly.parts||[c.poly])for(const f of part.faces){
    const [a,b,d]=f.map(i=>part.vertices[i]),u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(part.vertices.every(p=>n.reduce((s,v,i)=>s+v*(p[i]-a[i]),0)<1e-7),name+' constituent solid is convex');
   }
   const edges=new Map();let volume=0;
   for(const f of c.poly.faces){
    const [a,b,d]=f.map(i=>c.poly.vertices[i]);
    const u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(Math.hypot(...n)>1e-10,name+' nondegenerate faces');
    if(!c.poly.parts)assert.ok(c.poly.vertices.every(p=>n.reduce((s,v,i)=>s+v*(p[i]-a[i]),0)<1e-7),name+' convex');
    f.forEach((a,i)=>{const key=[a,f[(i+1)%f.length]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);});
    for(let i=1;i<f.length-1;i++){const b=c.poly.vertices[f[i]],d=c.poly.vertices[f[i+1]];volume+=(a[0]*(b[1]*d[2]-b[2]*d[1])+a[1]*(b[2]*d[0]-b[0]*d[2])+a[2]*(b[0]*d[1]-b[1]*d[0]))/6;}
   }
   assert.ok(volume>1e-9,name+' solid volume');assert.ok([...edges.values()].every(n=>n===2),name+' closed');
  }
 }
});

test('cut cells exactly fill planar bodies, including tips and sloping perimeter',()=>{
 const volume=c=>c.poly.faces.reduce((sum,f)=>{
  const a=c.poly.vertices[f[0]];
  for(let i=1;i<f.length-1;i++){const b=c.poly.vertices[f[i]],d=c.poly.vertices[f[i+1]];sum+=(a[0]*(b[1]*d[2]-b[2]*d[1])+a[1]*(b[2]*d[0]-b[0]*d[2])+a[2]*(b[0]*d[1]-b[1]*d[0]))/6;}
  return sum;
 },0);
 for(const [name,expected] of [['tetrahedron',1.7*4*4/3],['prism',32],['frustum',4*4*4/3*(1+.48+.48**2)]]){
  const cells=ChallengeGeometry.make(name,{smooth:true});
  assert.ok(Math.abs(cells.reduce((sum,c)=>sum+volume(c),0)-expected)<1e-7,name+' no missing stair-step wedges');
 }
});

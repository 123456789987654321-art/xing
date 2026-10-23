const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const key=p=>p.map(v=>(Math.abs(v)<1e-8?0:v).toFixed(7)).join(',');

test('sphere surface consists of broad quad color patches with a closed solid interior',()=>{
 const cells=ChallengeGeometry.make('sphere',{size:2,resolution:7,smooth:true,quadFaces:true});
 const outerEdges=new Map(),internalFaces=new Map();let totalVolume=0;
 assert.ok(cells.length>100);
 for(const c of cells){
  const vertices=c.poly.vertices.map(p=>p.map((v,i)=>v+c.center[i]));
  const surface=c.poly.faces.filter(f=>f.every(i=>Math.abs(Math.hypot(...vertices[i])-2)<1e-8));
  assert.equal(surface.length,1,'one independently colored exterior patch per cell');
  assert.equal(surface[0].length,4,'no triangular colored fragments');
  const edgeLengths=surface[0].map((v,i)=>Math.hypot(...sub(vertices[v],vertices[surface[0][(i+1)%4]])));
  assert.ok(Math.min(...edgeLengths)>.2,'no narrow strips');
  assert.ok(Math.max(...edgeLengths)/Math.min(...edgeLengths)<1.8,'patch proportions stay broad at cube seams');
  const localEdges=new Map();let volume=0;
  for(const f of c.poly.faces){
   for(let i=1;i<f.length-1;i++)volume+=dot(vertices[f[0]],cross(vertices[f[i]],vertices[f[i+1]]))/6;
   for(let i=0;i<f.length;i++){
    const e=[f[i],f[(i+1)%f.length]].sort().join(',');localEdges.set(e,(localEdges.get(e)||0)+1);
   }
   if(f===surface[0])for(let i=0;i<4;i++){
    const e=[key(vertices[f[i]]),key(vertices[f[(i+1)%4]])].sort().join(';');outerEdges.set(e,(outerEdges.get(e)||0)+1);
   }else{
    const face=f.map(i=>key(vertices[i])).sort().join(';');internalFaces.set(face,(internalFaces.get(face)||0)+1);
   }
  }
  assert.ok(volume>0);totalVolume+=volume;
  assert.ok([...localEdges.values()].every(n=>n===2),'each block is closed');
 }
 assert.ok([...outerEdges.values()].every(n=>n===2),'outer patches tile a closed sphere without cracks');
 assert.ok([...internalFaces.values()].every(n=>n===2),'every internal face has exactly one solid neighbor');
 assert.ok(totalVolume>32.5&&totalVolume<4*Math.PI*8/3,'polygonal sphere retains its full round volume');
});

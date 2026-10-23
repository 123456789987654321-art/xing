const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/mathx.js');
require('../js/scene.js');
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
test('all eight shells have unique closed outward nonzero cells and ordered tracks',()=>{
  require('../js/challenge-geometry.js');
  for(const name of ['tetrahedron','cylinder','sphere','prism','frustum','torus','gear','box']){
    const cells=ChallengeGeometry.make(name,{resolution:4});
    assert.ok(cells.length>30,name);
    const centers=new Set(),slots=new Set();
    for(const c of cells){
      const key=c.center.map(v=>v.toFixed(7)).join(',');
      assert.ok(!centers.has(key),name+' unique center');centers.add(key);
      const slot=c.track+':'+c.order;assert.ok(!slots.has(slot));slots.add(slot);
      const edges=new Map();let volume=0;
      for(const f of c.poly.faces){
        const vs=f.map(i=>c.poly.vertices[i]);
        const n=cross(sub(vs[1],vs[0]),sub(vs[2],vs[0]));
        assert.ok(dot(n,vs[0])>1e-10,name+' outward winding');
        assert.ok(vs.every(p=>Math.abs(dot(n,sub(p,vs[0])))<1e-8),name+' planar faces');
        assert.ok(c.poly.vertices.every(p=>dot(n,sub(p,vs[0]))<1e-8),name+' convex cells');
        for(let i=1;i<vs.length-1;i++)volume+=dot(vs[0],cross(vs[i],vs[i+1]))/6;
        f.forEach((a,i)=>{const b=f[(i+1)%f.length],e=[a,b].sort((a,b)=>a-b).join(',');edges.set(e,(edges.get(e)||0)+1);});
      }
      assert.ok(volume>1e-8,name+' volume');
      assert.ok([...edges.values()].every(n=>n===2),name+' closed manifold');
    }
  }
});
test('holes remain empty in torus and gear while body is pickable',()=>{
  require('../js/challenge-geometry.js');
  const scene=Object.create(Scene.prototype);scene._ray=()=>({o:[0,5,0],d:[0,-1,0]});
  for(const name of ['torus','gear']){
    const cells=ChallengeGeometry.make(name).map((c,id)=>({...c,id}));
    assert.equal(scene.pick(0,0,cells),-1,name+' center hole');
    scene._ray=()=>({o:[1.6,5,0.01],d:[0,-1,0]});
    assert.notEqual(scene.pick(0,0,cells),-1,name+' body');
    scene._ray=()=>({o:[0,5,0],d:[0,-1,0]});
  }
});
test('poly picking rejects triangle bounding box false positive and keeps box picking',()=>{
  const poly={vertices:[[0,0,0],[1,0,0],[0,1,0]],faces:[[0,1,2]]};
  assert.equal(Scene.rayPoly([.8,.8,2],[0,0,-1],poly),Infinity);
  assert.equal(Scene.rayPoly([.2,.2,2],[0,0,-1],poly),2);
  const scene=Object.create(Scene.prototype);scene._ray=()=>({o:[0,0,5],d:[0,0,-1]});
  assert.equal(scene.pick(0,0,[{id:42,center:[0,0,0],basis:[1,0,0,0,1,0,0,0,1],size:[1,1,1]}]),42);
});
test('poly GPU buffers are cached and legacy box attributes are restored after each draw',()=>{
  let allocations=0,restores=0,draws=0;
  const gl={createBuffer:()=>++allocations,bindBuffer(){},bufferData(){},enableVertexAttribArray(){},vertexAttribPointer(){},uniformMatrix4fv(){},uniform3fv(){},uniform2f(){},uniform1f(){},depthMask(){},drawElements(){draws++;}};
  const scene=Object.create(Scene.prototype);scene.gl=gl;
  scene.tileLoc={aPos:0,aNormal:1,aUV:2,aOut:3};scene._bindBox=()=>restores++;
  const poly=ChallengeGeometry.make('tetrahedron',{resolution:2})[0].poly;
  scene.drawPoly([],poly,[.6,.6,.6]);scene.drawPoly([],poly,[.6,.6,.6]);
  assert.equal(allocations,5);assert.equal(restores,2);assert.equal(draws,2);
});
test('cube face tracks use downward sides and forward top/bottom lanes',()=>{
  const cells=ChallengeGeometry.make('box'),tracks=new Map();
  for(const c of cells){if(!tracks.has(c.track))tracks.set(c.track,[]);tracks.get(c.track).push(c);}
  for(const face of ['+x','-x','+y','-y','+z','-z']){
    const lanes=[...tracks].filter(([key,cs])=>key.startsWith('face'+face+':')&&cs.length>1);
    assert.ok(lanes.length>0,face+' has actual multi-cell tracks');
    const axis=face.endsWith('y')?2:1,sign=axis===2?-1:1;
    for(const [,cs] of lanes){
      cs.sort((a,b)=>a.order-b.order);
      for(let i=1;i<cs.length;i++){
        assert.ok(Math.abs(sign*(cs[i].center[axis]-cs[i-1].center[axis])-4/7)<1e-8);
        for(let k=0;k<3;k++)if(k!==axis)assert.equal(cs[i].center[k],cs[i-1].center[k]);
      }
    }
  }
});
test('hull helper repairs edited wedges with outward supporting faces',()=>{
  const vertices=[[-1,-1,-1],[1,-1,-1],[0,1,-1],[-.7,-.7,1],[.7,-.7,.8],[0,.7,1]];
  const faces=ChallengeGeometry.hull(vertices);assert.ok(faces.length>=5);
  for(const f of faces){const a=vertices[f[0]],n=cross(sub(vertices[f[1]],a),sub(vertices[f[2]],a));assert.ok(vertices.every(v=>dot(n,sub(v,a))<1e-8));}
});
test('actual plate gears advance one full plate spacing between stops',()=>{
  require('../js/challenge-world.js');
  const w=new ChallengeWorld(9,()=>.1),initial=w.cells[0].center.slice();
  w.update(3.2);
  assert.ok(Math.abs(w.gears.angle-Math.PI*2/5)<1e-8);
  assert.equal(w.gears.moving,false);
  assert.ok(Math.hypot(...w.cells[0].center.map((v,i)=>v-initial[i]))>.5);
  assert.ok(w.contacts().some(([a,b])=>w.cells[a].component!==w.cells[b].component));
});

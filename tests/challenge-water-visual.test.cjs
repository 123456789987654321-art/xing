const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('water visual module exists',()=>assert.ok(fs.existsSync(require('node:path').join(__dirname,'../js/challenge-water-visual.js'))));
test('water scene has an open continuous round pipe and separate animated tank/flames',()=>{
  require('../js/challenge-water-visual.js');
  const world={decorations:[],water:{amount:100,capacity:100,progress:0,flowing:false,leaking:false},time:0};
  ChallengeWaterVisual.create(world);
  const visual=world.waterVisuals;
  assert.ok(visual.waterVolume.alpha>=.25,'water body must remain visible against dark background');
  assert.ok(visual.waterSurface.alpha>=.6,'waterline must be clearly visible');
  assert.ok(visual.ripples.length>=3,'surface highlights make water readable from oblique views');
  assert.ok(visual.pipe.poly.vertices.length>200);
  assert.ok(visual.pipe.alpha<.35);
  assert.ok(visual.flames.length>=5);
  const pipe=visual.pipe.poly,edges=new Map();
  for(const f of pipe.faces)f.forEach((v,i)=>{const key=[v,f[(i+1)%f.length]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);});
  assert.equal([...edges.values()].filter(n=>n===1).length,64,'exactly two open 32-sided circular ends');
  const level=visual.waterSurface.center[1];
  world.water.amount=35;world.water.progress=.75;world.water.flowing=true;world.time=2;
  ChallengeWaterVisual.update(world,.1);
  assert.ok(visual.waterSurface.center[1]<level);
  assert.ok(visual.jet.alpha>0);
  assert.ok(visual.flames.every(f=>f.size[1]<f.baseSize[1]));
  world.water.progress=1;world.water.flowing=false;
  ChallengeWaterVisual.update(world,.1);
  assert.ok(visual.flames.every(f=>f.alpha===0));
  assert.equal(visual.jet.alpha,0);
  for(const d of world.decorations){
    assert.ok(d.poly);assert.ok(d.poly.vertices.flat().every(Number.isFinite));
    for(const f of d.poly.faces){
      const [a,b,c]=f.slice(0,3).map(i=>d.poly.vertices[i]);
      const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
      assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-12,'non-degenerate renderer face');
    }
  }
});

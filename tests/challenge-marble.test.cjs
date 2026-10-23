const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');const World=require('../js/challenge-world.js');
const fresh=()=>new World(12,()=>.42);
test('aim preview uses real collision physics without changing the live game',()=>{
 const w=fresh();w.action('marble-aim',.35);const before=JSON.stringify([w.marble,w.score,w.cells,w.result]);
 const path=w.marblePreview();assert.ok(path.length>2);assert.equal(JSON.stringify([w.marble,w.score,w.cells,w.result]),before);
 w.action('release');let last=w.marble.position.slice();
 for(let i=1;i<path.length;i++){w._marbleUpdate(.006);last=w.marble.position.slice();}
 assert.deepEqual(last,path.at(-1));assert.ok(w.marble.collisionCount>0||w.marble.bin!==null||Math.abs(last[0])>2.6);
});
test('long marble board uses closed triangular solids and only shared edges connect',()=>{
 const w=fresh();assert.ok(w.cells.length>=60);assert.ok(w.cells.every(c=>c.poly.vertices.length===6));
 const ys=w.cells.map(c=>c.center[1]);assert.ok(Math.max(...ys)-Math.min(...ys)>7);
 const edges=w.contacts();assert.ok(edges.some(([a,b])=>a===0&&b===1));
 const a=w.cells[0],b=w.cells.find(c=>c.grid[0]===1&&c.grid[1]===1&&c.grid[2]===0);
 assert.ok(!edges.some(e=>e.includes(a.id)&&e.includes(b.id)));
});
test('three random colored drops award the displayed bin scores independently of color',()=>{
 const w=fresh();w.cells.forEach(c=>c.color=-1);w.score=250;
 for(let i=0;i<3;i++){
  const m=w.marble;assert.equal(m.drops,i);assert.ok(w.bins.includes(m.color));assert.equal(m.released,false);
  w.action('release');m.position=[(i===1?0:m.color-2)*1.08,-5.1,0];
  if(i===1)m.position[0]=((m.color+1)%5-2)*1.08;
  w.update(.01);assert.equal(m.drops,i+1);assert.equal(w.score,[750,1050,1550][i]);
  if(i<2)assert.equal(w.result,null);
 }
 assert.equal(w.result,'win');assert.equal(w.phase,'finished');assert.equal(w.target,1500);
 assert.deepEqual(w.binScores,[100,300,500,300,100]);
 assert.deepEqual(w.binPositions.map(b=>b.text),['100','300','500','300','100']);
});
test('triangle edge and corner impacts score once until the ball separates',()=>{
 const w=fresh(),c=w.cells[0];w.cells=[c];c.color=0;
 const points=w._vertices(c).slice(0,3),a=points[0],b=points[1];
 const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),n=[dy/len,-dx/len];
 w.action('release');const m=w.marble;
 m.position=[mid[0]+n[0]*.125,mid[1]+n[1]*.125,0];m.velocity=[-n[0],-n[1],0];w.update(.001);
 assert.equal(w.score,100);assert.equal(m.collisionCount,1);
 for(let i=0;i<10;i++){m.position=[mid[0]+n[0]*.125,mid[1]+n[1]*.125,0];m.velocity=[-n[0],-n[1],0];w.update(.001);}
 assert.equal(w.score,100);
 m.position=[0,6,0];m.velocity=[0,0,0];w.update(.001);
 const center=c.center,nx=a[0]-center[0],ny=a[1]-center[1],norm=Math.hypot(nx,ny);
 m.position=[a[0]+nx/norm*.125,a[1]+ny/norm*.125,0];m.velocity=[-nx/norm,-ny/norm,0];w.update(.001);
 assert.equal(w.score,200);assert.equal(m.collisionCount,2);
});
test('upward obstacle pairs have sloped roofs, matching partners, varied colors and open gaps',()=>{
 const w=fresh(),edges=w.contacts();assert.ok(new Set(w.cells.map(c=>c.color)).size>=4);
 for(let i=0;i<w.cells.length;i+=2){const pair=w.cells.slice(i,i+2),points=pair.flatMap(c=>w._vertices(c).slice(0,3)),top=Math.max(...points.map(p=>p[1]));
  assert.equal(new Set(points.filter(p=>Math.abs(p[1]-top)<1e-8).map(p=>p[0].toFixed(8))).size,1);
  assert.equal(pair[0].color,pair[1].color);assert.ok(edges.some(e=>e.includes(pair[0].id)&&e.includes(pair[1].id)));
 }
});
test('launcher angle changes ball direction and is locked during flight',()=>{
 for(const direction of [-1,1]){const w=fresh(),m=w.marble;w.cells.forEach(c=>c.color=-1);assert.equal(w.action('marble-aim',direction*.6),true);assert.equal(m.aimAngle,direction*.6);const x=m.position[0];w.action('release');assert.ok(m.velocity[0]*direction>0);assert.ok(m.velocity[1]<0);assert.equal(w.action('marble-aim',0),false);w.update(.1);assert.ok((m.position[0]-x)*direction>0);}
 const w=fresh(),m=w.marble;assert.equal(m.launcher.length,4);w.action('marble-aim',10);assert.equal(m.aimAngle,m.maxAimAngle);assert.ok(m.launcher.some(p=>Math.abs(p.basis[1])>.5));assert.deepEqual(w.ballVisual[0].center,m.position);assert.equal(w.action('marble-aim',NaN),false);
});
test('intact gate requires clearing, resting cannot farm points, and removing in flight opens the route',()=>{
 for(const angle of [-.6,0,.6]){const w=fresh();w.action('marble-aim',angle);w.action('release');for(let i=0;i<1500;i++)w.update(.01);
  assert.equal(w.marble.drops,0);assert.ok(w.marble.position[1]>3.5);const score=w.score;for(let i=0;i<500;i++)w.update(.01);assert.equal(w.score,score);
  assert.equal(w.canRemove(),true);w.remove(w.cells.filter(c=>c.gate===0).map(c=>c.id));for(let i=0;i<1000;i++)w.update(.01);assert.ok(w.marble.position[1]<3.5);
 }
});
test('an isolated pointed guide cannot trap a ball on its apex',()=>{
 const w=fresh();w.cells=w.cells.filter(c=>c.role==='guide').slice(0,2);const points=w.cells.flatMap(c=>w._vertices(c).slice(0,3)),apex=points.reduce((a,b)=>a[1]>b[1]?a:b);w.action('release');w.marble.position=[apex[0],apex[1]+.5,0];w.marble.velocity=[0,-1,0];for(let i=0;i<2000&&w.marble.released;i++)w.update(.01);assert.equal(w.marble.drops,1);
});
test('choosing which side to clear changes the actual landing bin at identical launch angle',()=>{
 const bins=[];
 for(const col of [2,3]){const w=fresh();w.remove(w.cells.filter(c=>c.gate!==0||c.grid[0]===col).map(c=>c.id));w.action('release');for(let i=0;i<2000&&w.marble.released;i++)w.update(.01);assert.equal(w.marble.drops,1);bins.push(w.marble.lastBin);}
 assert.deepEqual(bins,[1,3]);
});

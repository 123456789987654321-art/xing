const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');
const World=require('../js/challenge-world.js');
function fresh(){return new World(4,()=>.2);}
function remove(w,ids){return w.remove(ids);}
function force(w,ids){for(const id of ids)w.cells.find(c=>c.id===id).color=-1;ChallengeTower.afterRemove(w,ids);}
function advance(w,s,dt=1/60){for(let n=0;n<s-1e-9;n+=dt)ChallengeTower.update(w,Math.min(dt,s-n));}
const cell=(w,id)=>w.cells.find(c=>c.id===id);

test('pillar colors differ from every floor cell touching either end',()=>{
 const w=fresh(),columns=w.cells.filter(c=>c.towerRole==='column'&&!c.immutable),floors=w.cells.filter(c=>c.towerRole.startsWith('floor-'));
 let top=0,bottom=0;
 for(const c of columns)for(const f of floors){
  const gap=f.center[1]-c.center[1],height=c.towerHalf[1]+f.towerHalf[1];
  if(Math.abs(Math.abs(gap)-height)>1e-7||[0,2].some(i=>Math.abs(c.center[i]-f.center[i])>=c.towerHalf[i]+f.towerHalf[i]-1e-7))continue;
  assert.notEqual(c.color,f.color,'pillar '+c.id+' meets same-color floor '+f.id);
  if(gap>0)top++;else bottom++;
 }
 assert.ok(top>100&&bottom>100);
});

test('removable pillars contain multiple colors with face-connected matching pairs',()=>{
 const w=fresh();for(const ids of w.tower.floorSupports.flat()){
  const cubes=ids.map(id=>cell(w,id));if(cubes[0].immutable){assert.ok(cubes.every(c=>c.immutable));continue;}
  assert.ok(new Set(cubes.map(c=>c.color)).size>=3);
  assert.ok(cubes.every(c=>cubes.some(o=>o!==c&&o.color===c.color&&Math.abs(Math.hypot(...c.center.map((v,i)=>v-o.center[i]))-.24)<1e-7)));
 }
});

test('person tilts around the feet with the supporting floor and stands upright after landing',()=>{
 const w=fresh(),l=w.tower.levels[5],p=w.tower.person;
 force(w,l.columnIds.slice(0,2).flat().filter(id=>cell(w,id).towerRow===3));advance(w,.6);
 const support=cell(w,p.supportId);assert.ok(Math.abs(support.basis[3])>.01);
 for(const d of w.tower.personVisuals){assert.deepEqual(d.basis,support.basis);const o=d.towerOffset,b=support.basis;
  const expected=[p.x+b[0]*o[0]+b[3]*o[1]+b[6]*o[2],p.y+b[1]*o[0]+b[4]*o[1]+b[7]*o[2],p.z+b[2]*o[0]+b[5]*o[1]+b[8]*o[2]];
  assert.ok(d.center.every((v,i)=>Math.abs(v-expected[i])<1e-8));
 }
 remove(w,w.tower.floors[5]);advance(w,1.5);assert.equal(p.alive,true);
 for(const d of w.tower.personVisuals)assert.deepEqual(d.basis,[1,0,0,0,1,0,0,0,1]);
});
test('six floors have one complete plate, two removable 8 by 9 layers and four 3 by 3 by 4 pillars',()=>{
 const w=fresh();assert.equal(w.tower.floors.length,6);
 for(const [i,ids] of w.tower.floors.entries()){assert.equal(ids.length,145);assert.equal(w.tower.levels[i].upperIds.length,144);assert.equal(w.tower.floorSupports[i].length,4);for(const col of w.tower.floorSupports[i])assert.equal(col.length,36);}
 const fixed=w.cells.filter(c=>c.immutable);assert.ok(fixed.length>1);assert.deepEqual(remove(w,fixed.map(c=>c.id)),[]);
 assert.equal(w.cells.filter(c=>c.towerRole==='roof').length,0);
});
test('one missing corner or one missing corner top contact does not tilt; diagonal loss stays level',()=>{
 for(const mode of ['corner','top','diagonal']){const w=fresh(),l=w.tower.levels[5],b=cell(w,l.baseId),y=b.center[1];const ids=mode==='top'?l.columnIds[0].filter(id=>cell(w,id).towerRow===3):mode==='diagonal'?[...l.columnIds[0],...l.columnIds[3]]:l.columnIds[0];force(w,ids);advance(w,.6);assert.ok(Math.abs(l.angle)<1e-8);assert.ok(Math.abs(b.center[1]-y)<1e-7);}
});
test('two adjacent missing corner contacts tilt a plate and rotate its upper cubes',()=>{
 const w=fresh(),l=w.tower.levels[5];force(w,[...l.columnIds[0],...l.columnIds[1]].filter(id=>cell(w,id).towerRow===3));advance(w,.6);assert.ok(Math.abs(l.angle)>.01);assert.ok(Math.abs(cell(w,l.baseId).basis[1])+Math.abs(cell(w,l.baseId).basis[7])>.01);assert.deepEqual(cell(w,l.upperIds[0]).basis,cell(w,l.baseId).basis);
 const before=l.angle;advance(w,1);assert.ok(Math.abs(l.angle-before)<1e-7,'remaining stumps stop rotation');
 for(const ids of l.columnIds)for(const id of ids){const c=cell(w,id);if(c.color<0)continue;const b=cell(w,l.baseId),n=[b.basis[3],b.basis[4],b.basis[5]],h=b.towerHalf[1];for(const x of [-.12,.12])for(const z of [-.12,.12]){const bottom=b.center[1]+(-h-n[0]*(c.center[0]+x-b.center[0])-n[2]*(c.center[2]+z-b.center[2]))/n[1];assert.ok(c.center[1]+.12<=bottom+1e-6,'plate must not penetrate its pillar stumps');}}
});
test('all pillars removed drops the flat plate onto the lower floor',()=>{
 const w=fresh(),l=w.tower.levels[5],b=cell(w,l.baseId),y=b.center[1];force(w,l.columnIds.flat());advance(w,1.4);assert.ok(b.center[1]<y-.8);assert.equal(l.angle,0);const lower=cell(w,w.tower.levels[4].baseId);assert.ok(Math.abs(b.center[1]-.12-(lower.center[1]+.6))<1e-6);assert.notEqual(w.result,'lose');
});
test('deleting only the base makes the upper cubes and person fall on the next fixed step',()=>{
 const w=fresh(),l=w.tower.levels[5],p=w.tower.person,py=p.y,c=cell(w,l.upperIds[31]),cy=c.center[1];remove(w,[l.baseId]);ChallengeTower.update(w,1/60);assert.ok(c.center[1]<cy);assert.ok(p.y<py);assert.equal(p.alive,true);
});
test('floor by floor rescue awards 500 while clearing all floors is fatal',()=>{
 const w=fresh();for(const ids of [...w.tower.floors].reverse()){remove(w,ids);advance(w,1.5);assert.notEqual(w.result,'lose');}assert.equal(w.result,'win');assert.ok(w.score>=500);
 const fatal=fresh();remove(fatal,fatal.tower.floors.flat());advance(fatal,4);assert.equal(fatal.tower.failure,'fall');
});
test('fixed step trajectory is invariant to render interval',()=>{
 const a=fresh(),b=fresh();remove(a,[a.tower.levels[5].baseId]);remove(b,[b.tower.levels[5].baseId]);advance(a,.4,1/20);advance(b,.4,1/120);assert.ok(Math.abs(a.tower.person.y-b.tower.person.y)<1e-8);
});
test('a cube loses support when the lower cube is removed even with an intact base',()=>{
 const w=fresh(),l=w.tower.levels[5],upper=cell(w,l.upperIds[72+31]),y=upper.center[1];remove(w,[l.upperIds[31]]);advance(w,.1);assert.ok(upper.center[1]<y-.01);
});
test('three missing corner pillars tilt instead of balancing on a lone corner',()=>{
 const w=fresh(),l=w.tower.levels[5];force(w,l.columnIds.slice(0,3).flat());advance(w,.4);assert.ok(l.angle>.01);
});
test('a falling floor crushes a person standing on the floor below',()=>{
 const w=fresh(),l=w.tower.levels[5],below=w.tower.levels[4],p=w.tower.person;p.y=below.originalY+.6;p.fallStart=p.y;p.supportId=below.upperIds[72+31];force(w,l.columnIds.flat());advance(w,1.5);assert.equal(w.tower.failure,'crush');
});
function overlaps(a,b){
 const axes=[];for(let i=0;i<3;i++){axes.push(a.basis.slice(i*3,i*3+3));axes.push(b.basis.slice(i*3,i*3+3));}for(let i=0;i<3;i++)for(let j=0;j<3;j++){const u=a.basis.slice(i*3,i*3+3),v=b.basis.slice(j*3,j*3+3);axes.push([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);}
 for(const n of axes){if(n.every(v=>Math.abs(v)<1e-7))continue;let r=0;for(const c of [a,b])for(let i=0;i<3;i++)r+=c.towerHalf[i]*Math.abs(n.reduce((s,v,j)=>s+v*c.basis[i*3+j],0));if(Math.abs(n.reduce((s,v,i)=>s+v*(a.center[i]-b.center[i]),0))>=r-1e-6)return false;}return true;
}
test('tilting a middle storey never intersects the pillars on the storey above',()=>{
 const w=fresh(),l=w.tower.levels[3],above=w.tower.levels[4];force(w,l.columnIds.slice(0,2).flat());
 for(let step=0;step<60;step++){ChallengeTower.update(w,1/120);for(const id of above.columnIds.flat().filter(id=>cell(w,id).towerRow===0))for(const uid of l.upperIds.slice(72)){const a=cell(w,id),b=cell(w,uid);assert.ok(!overlaps(a,b),'pillar '+id+' intersects tilted cube '+uid);}}
});
test('gravity accumulates a half frame until the fixed 60 Hz tick',()=>{
 const w=fresh(),l=w.tower.levels[5],p=w.tower.person,y=p.y;remove(w,[l.baseId]);ChallengeTower.update(w,1/120);assert.equal(p.y,y);ChallengeTower.update(w,1/120);assert.ok(p.y<y);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const ctx=vm.createContext({console,innerWidth:800,innerHeight:800});ctx.window=ctx;
 for(const n of ['mathx','scene','challenge-geometry','challenge-world','challenge-throw'])vm.runInContext(fs.readFileSync('js/'+n+'.js','utf8'),ctx);
 const world=new ctx.ChallengeWorld(10,()=>.2),scene=Object.create(ctx.Scene.prototype),m=ctx.MX.m4;
 Object.assign(scene,{eye:[0,0,8],target:[0,0,0],up:[0,1,0],w:800,h:800,dpr:1});
 const p=m.create(),v=m.create();m.perspective(p,Math.PI/4,1,.3,60);m.lookAt(v,scene.eye,scene.target,scene.up);scene.vp=m.create();scene.invVP=m.create();m.multiply(scene.vp,p,v);m.invert(scene.invVP,scene.vp);
 const game={world,app:{scene,state:'play'},intro:0},thrower=new ctx.ChallengeThrow(game);
 const point=scene.project(world.sling?.anchor||[0,-1.7,2.4]),e={clientX:point[0],clientY:point[1],pointerId:1,button:0};
 return {world,game,thrower,e,scene};
}
test('drag starts only on loaded sling cube and backward pull launches the exact ballistic preview once',()=>{
 const {world:w,thrower:t,e}=fixture();assert.equal(t.pointerDown({...e,clientX:50,clientY:50}),false);
 assert.equal(t.pointerDown(e),true);const drag={...e,clientX:e.clientX+70,clientY:e.clientY+90};t.pointerMove(drag);
 assert.ok(w.aim.x<0);assert.ok(w.aim.y>-1.7);assert.ok(t.power>0);
 const power=t.power,preview=JSON.stringify(w.trajectory);t.frame(20);assert.equal(t.power,power);assert.equal(JSON.stringify(w.trajectory),preview);
 assert.equal(w.ammo.length,10);t.pointerUp(drag);assert.equal(w.ammo.length,9);assert.equal(JSON.stringify(w.projectile.path),preview);
 const p=w.projectile;w.update(.37);const expected=p.start.map((v,i)=>v+p.velocity[i]*.37-(i===1?.5*p.gravity*.37**2:0));
 w.shotVisual.center.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-8));t.pointerUp(drag);assert.equal(w.ammo.length,9);
});
test('pause, cancellation, secondary pointer and a tap never spend ammunition',()=>{
 for(const mode of ['pause','cancel','multi','tap']){
  const {world:w,game,thrower:t,e}=fixture();assert.equal(t.pointerDown({...e,button:2}),false);t.pointerDown(e);
  if(mode!=='tap')t.pointerMove({...e,clientY:e.clientY+90});
  if(mode==='pause'){game.app.state='paused';t.frame(.1);}if(mode==='cancel')t.cancel();if(mode==='multi')t.pointerDown({...e,pointerId:2});
  t.pointerUp(e);assert.equal(w.ammo.length,10);assert.equal(t.charging,false);
 }
});
test('each target has exactly five separated missing cubes and ten shots lead to elimination phase',()=>{
 const {world:w}=fixture();for(const target of [0,1])assert.equal(w.cells.filter(c=>c.targetIndex===target&&c.hole).length,5);
 for(let i=0;i<10;i++){w.action('aim',{x:0,y:0});w.action('shoot');w.update(2);}assert.equal(w.phase,'play');assert.equal(w.ammo.length,0);
});

test('rotated camera maps a screen pull to the opposite screen launch direction',()=>{
 const {world:w,game,thrower:t,scene}=fixture(),m=game.app.scene;
 m.eye=[4,2,7];m.target=[0,0,0];
 const source=fs.readFileSync('js/mathx.js','utf8'),ctx={};ctx.window=ctx;vm.runInNewContext(source,ctx);const math=ctx.MX.m4,p=math.create(),v=math.create();
 math.perspective(p,Math.PI/4,1,.3,60);math.lookAt(v,m.eye,m.target,m.up);math.multiply(m.vp,p,v);math.invert(m.invVP,m.vp);
 const screen=m.project(w.sling.anchor),e={clientX:screen[0],clientY:screen[1],pointerId:3,button:0,pointerType:'touch'};
 const baseline=m.project([0,-1.7,.09]);assert.equal(t.pointerDown(e),true);
 const drag={...e,clientX:e.clientX+55,clientY:e.clientY+65};t.pointerMove(drag);
 const aim=m.project([w.aim.x,w.aim.y,.09]);assert.ok(aim[0]<baseline[0]);assert.ok(aim[1]<baseline[1]);
 const held=m.project(w.sling.loaded.center);assert.ok(Math.hypot(held[0]-drag.clientX,held[1]-drag.clientY)<.01,'drawing toward the rotated camera preserves the pointer position');
 assert.ok(w.sling.loaded.center[2]-.14>2.5,'rotated view pull remains clear of the wooden frame');
 assert.deepEqual(Array.from(w.launch.start),Array.from(w.sling.loaded.center));
 t.pointerUp(drag);assert.equal(w.ammo.length,9);assert.ok(w.projectile);
});
test('all ten missing cubes can be filled and then participate in elimination',()=>{
 const {world:w}=fixture(),holes=w.cells.filter(c=>c.hole);assert.equal(holes.length,10);
 for(const hole of holes){w.action('aim',{x:hole.center[0],y:hole.center[1]});assert.equal(w.previewHit.id,hole.id);w.action('shoot');w.update(2);assert.equal(hole.hole,false);assert.ok(hole.color>=0);}
 assert.equal(w.phase,'play');assert.equal(w.cells.filter(c=>c.hole).length,0);assert.equal(w.canRemove(),true);
});

test('pull moves held cube in front of the fork and bands join the pouch edges',()=>{
 const {world:w,thrower:t,e}=fixture();t.pointerDown(e);t.pointerMove({...e,clientY:e.clientY+90});
 const s=w.sling,p=s.loaded.center;assert.ok(p[2]>s.anchor[2]+.1,'drag draws toward the viewer');
 assert.ok(p[2]-.14>2.5,'cube stays ahead of the wooden handle');
 assert.deepEqual(Array.from(w.launch.start),Array.from(p));assert.deepEqual(Array.from(w.trajectory[0]),Array.from(p));
 assert.ok(s.pouch,'visible pouch supports the held cube');
 for(let i=0;i<2;i++){
  const band=s.bands[i],vertices=w._vertices(band),ends=[-1,1].map(sign=>band.center.map((v,k)=>v+sign*band.basis[3+k]*Math.hypot(...band.end.map((n,j)=>n-band.start[j]))/2));
  assert.ok(ends[0].every((v,k)=>Math.abs(v-band.start[k])<1e-8));assert.ok(ends[1].every((v,k)=>Math.abs(v-band.end[k])<1e-8));
  assert.ok(Math.abs(band.end[0]-s.pouch.center[0])>.14);assert.ok(Math.abs(band.end[2]-s.pouch.center[2])<1e-8);assert.ok(vertices.length===8);
 }
 const held=Array.from(p),preview=JSON.stringify(w.trajectory);t.pointerUp({...e,clientY:e.clientY+90});assert.deepEqual(Array.from(w.projectile.start),held);assert.equal(JSON.stringify(w.projectile.path),preview);
});

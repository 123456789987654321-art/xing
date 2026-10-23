const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const ctx=vm.createContext({console,document:{getElementById:()=>null}});ctx.window=ctx;
  vm.runInContext(fs.readFileSync('js/challenge-game.js','utf8'),ctx);
  const game=Object.create(ctx.ChallengeGame.prototype);
  game.world={cells:[{id:0,color:2},{id:1,color:2},{id:2,color:2},{id:3,color:4}],contacts:()=>[[0,1]],canRemove:()=>true};
  game.viewLinks=[[1,2],[2,1],[2,3]];game.viewEnabled=true;
  return {game,ctx};
}
test('challenge groups require a visible seam even when hidden faces physically touch',()=>{
  const {game}=fixture();assert.deepEqual(Array.from(game.group(0)),[0]);
  game.viewLinks=[[0,1],[1,2],[2,1],[2,3]];
  assert.deepEqual(Array.from(game.group(0)).sort(),[0,1,2]);
  game.world.cells[1].color=-1;assert.deepEqual(Array.from(game.group(0)),[0]);
});
test('neutral assembly blocks and moving mechanisms cannot be eliminated',()=>{
  const {game}=fixture();game.world.cells[0].color=6;assert.equal(game.group(0).length,0);
  game.world.cells[0].color=2;game.world.canRemove=()=>false;assert.equal(game.group(0).length,0);
});
test('entry blocks fall along the owning surface direction',()=>{
  const {game}=fixture();game.intro=1.25;game.slides=new Map();
  const side=game.makeTile({id:0,center:[0,0,0],track:'0:face+x:depth0'});
  const top=game.makeTile({id:0,center:[0,0,0],track:'0:face+y:depth0'});
  assert.deepEqual(Array.from(side.center),[0,6,0]);
  assert.deepEqual(Array.from(top.center),[0,0,-6]);
});
test('paused challenge frame freezes model and introduction',()=>{
  const {game}=fixture();let updates=0;game.world.update=()=>updates++;
  game.app={state:'paused',scene:{updateCamera(){},particles:{update(){}}}};
  game.intro=1;game.render=game.syncHud=game.checkResult=()=>{};
  game.frame(.05);assert.equal(updates,0);assert.equal(game.intro,1);
});

// Browser boundaries only: DOM nodes and drawing calls are inert; scene matrices,
// ray picks, projection, world rules, ChallengeGame and App run their real code.
function integrated(level=1,acknowledge=true){
  const nodes=new Map();
  const node=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},innerHTML:'',textContent:'',setAttribute(){},addEventListener(){},appendChild(){},remove(){}});
  const document={readyState:'loading',addEventListener(){},body:node(),createElement:node,getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}};
  const ctx=vm.createContext({console,document,innerWidth:800,innerHeight:800,performance:{now:()=>0},setTimeout(){},localStorage:{getItem(){return null;},setItem(){}}});ctx.window=ctx;
  for(const file of ['mathx','board','mechanics','scene','challenge-geometry','challenge-tower','challenge-rubik','challenge-world','challenge-projection','challenge-thumbnails','challenge-rubik-controls','challenge-throw','challenge-game','app'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),ctx);
  ctx.Sfx={start(){},pop(){},invalid(){},levelClear(){},gameOver(){}};
  const app=ctx.App,scene=Object.create(ctx.Scene.prototype);
  Object.assign(scene,{w:800,h:800,dpr:1,fov:Math.PI/4,aspect:1,time:0,shakeT:0,target:[0,0,0],vp:ctx.MX.m4.create(),invVP:ctx.MX.m4.create(),particles:{clear(){},update(){},burst(){}},drawPoly(){},drawBox(){},drawParticles(){}});
  scene.beginFrame=function(){const p=ctx.MX.m4.create(),v=ctx.MX.m4.create();ctx.MX.m4.perspective(p,this.fov,this.aspect,.3,60);ctx.MX.m4.lookAt(v,this.eye,this.target,this.up);ctx.MX.m4.multiply(this.vp,p,v);ctx.MX.m4.invert(this.invVP,this.vp);};
  app.scene=scene;app.reduceMotion=true;app.last=0;
  app.startSelectedLevel('challenge',level);
  if(acknowledge)app.resume();
  return {app,game:app.challenge,scene,ctx,nodes};
}
test('every challenge opens a paused instruction dialog and help can reopen it',()=>{
  for(let level=1;level<=11;level++){
    const {app,game,nodes}=integrated(level,false);
    assert.equal(app.state,'paused');assert.match(nodes.get('ovCard').innerHTML,/我知道了/);
    const time=game.world.time;game.frame(.05);assert.equal(game.world.time,time);
    assert.doesNotMatch(nodes.get('challengeControls').innerHTML,/data-challenge="view"/);
    if(![8,10,11,12].includes(level))assert.equal(nodes.get('challengeControls').innerHTML,'');
    app.resume();assert.equal(app.state,'play');app.showMechanicIntro();assert.equal(app.state,'paused');
  }
});
test('removed marble level cannot be selected and level eleven has no next button',()=>{
 const {app,game,nodes,ctx}=integrated(11);app.startSelectedLevel('challenge',12);assert.equal(app.challenge,game);assert.equal(app.level,11);
 game.world.score=game.world.target;game.world.result='win';game.checkResult();assert.doesNotMatch(nodes.get('ovCard').innerHTML,/data-act="next"/);
 app.progressCache={};ctx.localStorage.getItem=()=>JSON.stringify({next:13,score:0,cleared:{11:0,12:0},best:{11:300,12:900}});
 const p=app.progressFor('challenge');assert.equal(p.best[11],300);assert.equal(p.best[12],undefined);assert.equal(p.cleared[12],undefined);
 app.showLevelSelect('challenge');assert.doesNotMatch(nodes.get('ovCard').innerHTML,/data-level="12"|data-act="continueLevels"/);
});
function seamFixture(){
  const f=integrated(),w=f.game.world;
  const face=(id,x,z)=>({id,component:id,color:2,center:[x,0,z],basis:[1,0,0,0,1,0,0,0,1],track:'fixed',volume:1,poly:{vertices:[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],faces:[[0,1,2,3]]}});
  w.cells=[face(0,0,0),face(1,1,1)];w.revision++;w._contactCache=null;
  f.scene.yaw=0;f.scene.pitch=0;f.scene.dist=10;f.game.focus=null;
  f.game.frame(.01);f.game.frame(.13);
  assert.deepEqual(JSON.parse(JSON.stringify(f.game.viewLinks)),[[0,1]],'fixture has a real depth-visible seam');
  return f;
}

test('tower rescue and slingshot targets stay independent and tower only wins on safe descent',()=>{
 const tower=integrated(4),w=tower.game.world;
 assert.ok(w.tower);assert.equal(w.water,undefined);assert.equal(w.ammo,undefined);
 assert.equal(tower.game.thrower,null);assert.match(tower.nodes.get('hudMode').textContent,/高楼/);
 w.score=9999;assert.equal(w.finish(),null);
 const initial=w.tower.person.y;tower.app.state='paused';tower.game.frame(1);assert.equal(w.tower.person.y,initial);
 tower.app.state='play';for(const ids of w.tower.floors.slice().reverse()){w.remove(ids);for(let i=0;i<20;i++)tower.game.frame(.1);}
 assert.equal(w.result,'win');assert.equal(tower.app.state,'clear');
 const target=integrated(10);assert.ok(target.game.thrower);assert.equal(target.game.world.tower,undefined);
 for(const side of [0,1])assert.equal(target.game.world.cells.filter(c=>c.targetIndex===side&&c.hole).length,5);
 assert.equal(target.game.world.ammo.length,10);
});
test('camera movement immediately removes old projected links and rebuilds after settling',()=>{
  const {game,scene}=seamFixture();game.hover=[0,1];game.hint=[0,1];
  scene.yaw=.12;game.frame(.01);
  assert.equal(game.viewLinks.length,0);assert.equal(game.hover.length,0);assert.equal(game.hint.length,0);
  assert.deepEqual(Array.from(game.group(0)),[0]);
  game.frame(.13);assert.equal(game.viewLinks.length,1);
});

test('moving mechanisms refresh visible matches on interaction without locking the whole scene',()=>{
 for(const mechanism of ['water','seesaw','gears']){
  const {game}=seamFixture();game.world[mechanism]={moving:mechanism!=='gears'};
  game.world.cells[1].center[0]+=.01;game.frame(.01);
  assert.deepEqual(Array.from(game.group(0)).sort(),[0,1],mechanism+' retains a current visible match');
 }
});
test('geometry position and basis changes invalidate projected links before another click',()=>{
  const {game}=seamFixture();game.world.cells[1].center[0]=5;game.frame(.01);
  assert.equal(game.viewLinks.length,0);game.frame(.13);assert.equal(game.viewLinks.length,0);
  game.world.cells[1].center[0]=1;game.frame(.01);game.frame(.13);assert.equal(game.viewLinks.length,1);
  game.world.cells[1].basis=[0,1,0,-1,0,0,0,0,1];game.frame(.01);
  assert.equal(game.viewLinks.length,0);
});
test('slides suppress view matching and rebuild using settled rendered geometry',()=>{
  const {game}=seamFixture();game.slides.set(1,{from:[5,0,1],time:0});
  game.frame(.1);assert.equal(game.viewLinks.length,0);
  game.frame(.1);assert.equal(game.viewLinks.length,0);
  game.frame(.09);game.frame(.13);
  assert.equal(game.slides.size,0);assert.equal(game.viewLinks.length,1);
  assert.deepEqual(Array.from(game.tiles.find(t=>t.id===1).renderCenter),[1,0,1]);
});
test('aim sliders preserve aim while paused or introducing and update during play',()=>{
  const {app,game,nodes}=integrated(10),panel=nodes.get('challengePanel');
  const input={target:{dataset:{aim:'x'},value:'2.5'}},initial=game.world.aim.x;
  app.state='paused';panel.oninput(input);assert.equal(game.world.aim.x,initial);
  app.state='play';game.intro=.5;panel.oninput(input);assert.equal(game.world.aim.x,initial);
  game.intro=0;panel.oninput(input);assert.equal(game.world.aim.x,2.5);
});



test('App starts a real challenge, advances its frame and removes the clicked projected group',()=>{
  const {app,game,scene,ctx}=seamFixture();
  assert.ok(game instanceof ctx.ChallengeGame);assert.ok(game.world instanceof ctx.ChallengeWorld);
  const before=game.world.time;app.last=0;app.frame(50);assert.ok(game.world.time>before);
  const p=scene.project([-.5,0,0]);app.click({clientX:p[0],clientY:p[1]});
  assert.equal(game.world.remaining(),0);assert.equal(app.score,20);assert.equal(game.world.score,20);
});

test('an emptied challenge automatically settles after its last move',()=>{
  const {app,game}=integrated(1);
  game.world.remove(game.world.cells.map(c=>c.id));
  for(let i=0;i<30;i++)game.frame(.05);
  assert.equal(game.world.result,'win');assert.equal(app.state,'clear');
});
test('all eleven challenge profiles settle after physics with no eligible pair',()=>{
 for(let level=1;level<=11;level++){
  const {game,app}=integrated(level);const w=game.world;
  w.cells.forEach(c=>c.color=-1);w.phase='play';w.update=()=>{};if(w.gears)w.gears.moving=false;
  for(let i=0;i<30;i++)game.frame(.05);
  assert.equal(w.result,'win','level '+level);assert.equal(app.state,'clear');assert.equal(w.levelScoreBonus,2000);
 }
});
test('future-view and mechanism pairs stay playable; stationary seesaw dead pairs settle',()=>{
 for(const level of [1,8,9,10,11]){
  const {game}=integrated(level),w=game.world;w.phase='play';w.cells.forEach(c=>c.color=-1);
  const a=w.cells[0],b=level===11?w.cells.find(c=>c.side==='right'):w.cells.at(-1);a.color=b.color=0;
  game.geometryQuiet=1;game.viewLinks=[];if(w.gears)w.gears.moving=false;
  assert.equal(game.hasPotentialMoves(),level!==11,'level '+level);
  a.immutable=true;assert.equal(game.hasPotentialMoves(),false,'immutable does not form a move');
 }
 const {game}=integrated(10);assert.equal(game.hasPotentialMoves(),true,'shooting phase must finish first');
});

test('Rubik scene has no tray and turn completion starts falling animations before input unlocks',()=>{
 const {game,app,nodes}=integrated(8);
 assert.equal(game.assembly,null);assert.ok(game.rubikControls);assert.equal(nodes.get('challengeControls').innerHTML,'');
 const w=game.world,cell=w.cells.find(c=>c.rubikRow===14);cell.color=-1;w.revision++;
 game.action('turn',{axis:0,layer:0,direction:1});assert.ok(w.rubik.turn);
 const time=w.rubik.turn.time;app.state='paused';game.frame(.1);assert.equal(w.rubik.turn.time,time);
 app.state='play';game.frame(.6);assert.equal(w.rubik.turn,null);assert.ok(game.slides.size>0);assert.equal(w.score,0);
 game.action('turn',{axis:1,layer:0,direction:1});assert.equal(w.rubik.turn,null,'settling blocks another turn');
 game.frame(.3);game.action('turn',{axis:1,layer:0,direction:1});assert.ok(w.rubik.turn);
});

test('returning to level selection keeps the current mode and earned progress from play or pause',()=>{
  for(const mode of ['normal','challenge'])for(const state of ['play','paused']){
    const {app,nodes}=integrated(11);
    if(mode==='normal')app.startSelectedLevel('normal',1);
    const progress=app.progressFor(mode);Object.assign(progress,{next:3,score:1200,cleared:{1:0,2:500}});
    const saved=JSON.stringify(progress);app.state=state;app.timer={t:.1,fn(){throw Error('stale gameplay timer');}};
    app.returnToLevelSelect();
    assert.equal(app.selectMode,mode);assert.equal(app.state,'menu');assert.equal(app.challenge,null);
    assert.equal(app.timer,null);assert.equal(JSON.stringify(app.progressFor(mode)),saved);
    assert.match(nodes.get('ovCard').innerHTML,mode==='normal'?/普通模式 · 选关/:/挑战模式 · 选关/);
  }
});

test('seesaw fits actual geometry centrally at portrait and desktop sizes',()=>{
  for(const [width,height] of [[390,844],[1440,900]]){
    const {game,scene,ctx}=integrated(11);
    Object.assign(scene,{w:width,h:height,aspect:width/height});game.zoom(0);game.frame(0);
    const points=[...game.world.cells,...game.world.decorations].flatMap(c=>ctx.ChallengeProjection.worldVertices({...c,size:[1,1,1]})).map(p=>scene.project(p));
    const xs=points.map(p=>p[0]/width),ys=points.map(p=>p[1]/height);
    assert.ok(Math.min(...xs)>.08&&Math.max(...xs)<.92,'geometry stays inside horizontal controls margin');
    assert.ok(Math.min(...ys)>.19&&Math.max(...ys)<.81,'geometry stays clear of HUD and bottom controls');
    assert.ok(Math.max(...xs)-Math.min(...xs)>.62,'seesaw uses the available width');
    assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-.5)<.02,'centered horizontally');
  }
});

test('seesaw pans without camera roll, preserves real tilt, and recenters on reset',()=>{
 const {game,scene,nodes}=integrated(11);game.frame(0);
 assert.equal(nodes.get('challengeControls').innerHTML,'');assert.equal(game.hasControls,false);
 const beam=[[-2,0,0],[2,0,0]],level=()=>Math.abs(scene.project(beam[0])[1]-scene.project(beam[1])[1])<1e-5;
 assert.ok(level());const initial=scene.project([0,0,0]);
 assert.equal(game.pan(80,0),true);game.frame(0);assert.ok(level());assert.ok(scene.project([0,0,0])[0]>initial[0]);
 game.pan(0,60);game.frame(0);assert.ok(level());assert.ok(scene.project([0,0,0])[1]>initial[1]);
 const angle=.2,ends=beam.map(p=>[p[0]*Math.cos(angle),p[0]*Math.sin(angle),0]);assert.ok(Math.abs(scene.project(ends[0])[1]-scene.project(ends[1])[1])>10);
 const offset=game.panOffset.slice();Object.assign(scene,{w:390,h:844,aspect:390/844});game.zoom(game.app.zoom);game.frame(0);assert.deepEqual(game.panOffset,offset);assert.ok(level());assert.equal(scene.orbit,null);
 game.align();game.frame(0);assert.deepEqual(Array.from(game.panOffset),[0,0,0]);assert.ok(level());
 const other=integrated(1);assert.equal(other.game.pan(50,20),false);other.scene.rotateOrbit(50,20);assert.ok(other.scene.orbit);
});

test('Rubik body blocks rear picking and projected matches through a front hole',()=>{
 const {game,scene,ctx}=integrated(8),w=game.world;
 for(const c of w.cells)c.color=-1;
 const rear=w.cells.filter(c=>c.rubikFace===2&&c.rubikRow===7&&[7,8].includes(c.rubikCol));for(const c of rear)c.color=2;
 scene.yaw=0;scene.pitch=0;game.frame(0);
 const p=scene.project(rear[0].center);
 assert.ok(scene.pick(p[0]/800*2-1,1-p[1]/800*2,game.tiles)>=0,'rear blocks intersect the hole ray');
 assert.ok(game.pick({clientX:p[0],clientY:p[1]})<0,'opaque body stops elimination ray');
 assert.equal(ctx.ChallengeProjection.links(scene,game.tiles).length,1,'rear pair would match without body');
 assert.equal(ctx.ChallengeProjection.links(scene,game.interactionTiles()).length,0,'body hides rear matches');
});


test('challenge picker saves only completed high scores, not failed attempts',()=>{
  const {app,game,nodes}=integrated(10);
  const normal=JSON.stringify(app.progressFor('normal'));
  game.world.score=480;game.world.result='win';game.checkResult();
  app.returnToLevelSelect();assert.match(nodes.get('ovCard').innerHTML,/历史最高分：480/);
  app.startSelectedLevel('challenge',10);assert.equal(app.score,0);assert.equal(app.challenge.world.score,0);
  app.challenge.world.score=220;app.challenge.world.result='win';app.challenge.checkResult();
  assert.equal(app.progressFor('challenge').best[10],480);
  app.restart();assert.equal(app.score,0);assert.equal(app.challenge.world.score,0);
  app.challenge.world.score=900;app.challenge.world.result='lose';app.challenge.checkResult();
  assert.equal(app.progressFor('challenge').best[10],480);
  app.restart();app.challenge.world.score=600;app.challenge.world.result='win';app.challenge.checkResult();
  assert.equal(app.progressFor('challenge').best[10],600);
  assert.equal(app.progressFor('challenge').score,0);assert.equal(app.progressFor('challenge').cleared[10],0);
  assert.equal(JSON.stringify(app.progressFor('normal')),normal);
});
test('leaving during the completion animation discards the new record',()=>{
 const {app,game}=integrated(1);app.reduceMotion=false;
 game.world.score=12345;game.world.finish();game.checkResult();
 assert.equal(app.state,'settling');game.frame(.1);
 app.returnToLevelSelect();assert.equal(app.progressFor('challenge').best[1],undefined);
 app.startSelectedLevel('challenge',1);assert.equal(app.challenge.world.score,0);
});

test('challenge exit and restart discard unfinished high scores',()=>{
 const {app,game,nodes}=integrated(1);game.world.score=20;game.syncHud();app.returnToLevelSelect();
 assert.equal(app.progressFor('challenge').best[1],undefined);assert.match(nodes.get('ovCard').innerHTML,/历史最高分：0/);
 app.startSelectedLevel('challenge',1);app.resume();app.challenge.world.finish();app.challenge.checkResult();
 assert.equal(app.challenge.world.result,'win');assert.doesNotMatch(nodes.get('ovCard').innerHTML,/本关目标|分数不足/);
});
test('challenge bursts sequentially up to thirteen and saves only after animation completion',()=>{
 for(const remain of [0,1,2,12,13,14]){
  const {app,game}=integrated(1);app.reduceMotion=false;game.intro=0;
  game.world.cells.forEach((c,i)=>c.color=i<remain?i%6:-1);game.world.score=10;
  game.world.finish();game.checkResult();assert.equal(app.state,'settling');assert.equal(app.progressFor('challenge').best[1],undefined);
  assert.equal(new Set(game.ending.items.map(i=>i.delay)).size,remain>13?1:remain);
  const expected=remain===0?2000:remain<=13?(13-remain)*100:0;
  assert.equal(game.world.score,10+expected);game.frame(3);assert.equal(app.progressFor('challenge').best[1],10+expected);
  game.world.finish();game.checkResult();assert.equal(game.world.score,10+expected);
 }
});

test('help return closes menu help and resumes gameplay without choosing a level',()=>{
  const {app,nodes}=integrated(1);
  app.toMenu();app.showHelp(true);assert.equal(nodes.get('btnDialogBack').hidden,false);
  app.backFromHelp();assert.equal(app.state,'menu');assert.equal(nodes.get('btnDialogBack').hidden,true);
  app.startSelectedLevel('challenge',1);app.resume();app.showHelp();app.backFromHelp();assert.equal(app.state,'play');
});



test('challenge zoom moves across the whole slider and wheel follows the effective range after resize',()=>{
 for(const level of [8,11]){
  const {game,scene,app,nodes}=integrated(level);game.frame(0);
  for(const [width,height] of [[1440,900],[390,844]]){
   Object.assign(scene,{w:width,h:height,aspect:width/height});game.zoom(0);game.frame(0);let previous=Infinity;
   for(let step=0;step<=10;step++){game.zoom(step/10);game.frame(0);assert.ok(scene.dist<previous,`level ${level} step ${step}`);previous=scene.dist;}
   const range=scene.zoomRange,middle=1/(.5/range.far+.5/range.near);app.setZoomFromDistance(middle);game.frame(0);
   assert.ok(Math.abs(app.zoom-.5)<1e-6);assert.ok(Math.abs(Number(nodes.get('zoomSlider').value)-50)<1e-4);assert.ok(Math.abs(scene.dist-middle)<1e-4);
  }
 }
});

test('resting fit keeps the camera stable so visible matches settle',()=>{
 const {game,scene}=integrated(1);game.zoom(.7);game.frame(0);const first=Array.from(scene.vp),distance=scene.dist;
 for(let i=0;i<20;i++)game.frame(.016);
 assert.deepEqual(Array.from(scene.vp),first,`camera changed at rest: ${distance} -> ${scene.dist}`);
 assert.ok(game.linkTime>.12);assert.ok(game.viewLinks.length>0);
});

test('a held slingshot keeps its camera and releases the displayed preview exactly',()=>{
 const {game,scene}=integrated(10);game.frame(0);const t=game.thrower,p=scene.project(game.world.sling.anchor),down={clientX:p[0],clientY:p[1],pointerId:1,button:0};
 assert.ok(t.pointerDown(down));const drag={...down,clientX:p[0]-40,clientY:p[1]+60};t.pointerMove(drag);
 const preview=JSON.stringify(game.world.trajectory),distance=scene.dist,camera=Array.from(scene.vp);
 for(let i=0;i<20;i++)game.frame(.016);
 assert.equal(scene.dist,distance);assert.deepEqual(Array.from(scene.vp),camera);
 t.pointerUp(drag);assert.equal(JSON.stringify(game.world.projectile.path),preview);
});

test('Rubik arrows stay inside phone and desktop views with separate touch areas',()=>{
 const {game,scene}=integrated(8);
 for(const [width,height] of [[390,844],[1440,900]])for(const zoom of [0,1])for(const yaw of [0,.58,1.5,2.4]){
  Object.assign(scene,{w:width,h:height,aspect:width/height,yaw,pitch:.34});game.zoom(zoom);game.frame(0);
  const targets=game.rubikControls.targets;assert.equal(targets.length,12);
  for(const t of targets){assert.ok(t.x>=22&&t.x<=width-22&&t.y>=22&&t.y<=height-22,'inside viewport');}
  for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++)assert.ok(Math.abs(targets[i].x-targets[j].x)>=44||Math.abs(targets[i].y-targets[j].y)>=44,'nonoverlapping targets');
 }
});

test('legacy challenge saves show unknown best as zero and new best persists across reload',()=>{
  const {app,ctx,nodes}=integrated(1);
  let stored=JSON.stringify({next:2,score:0,cleared:{1:0},best:{2:'999',3:-10}});
  ctx.localStorage.getItem=()=>stored;ctx.localStorage.setItem=(key,value)=>{stored=value;};
  delete app.progressCache.challenge;app.returnToLevelSelect();
  assert.match(nodes.get('ovCard').innerHTML,/历史最高分：0/);assert.deepEqual(Object.keys(app.progressFor('challenge').best),[]);
  app.startSelectedLevel('challenge',1);app.challenge.world.score=350;app.challenge.world.result='win';app.challenge.checkResult();
  delete app.progressCache.challenge;assert.equal(app.progressFor('challenge').best[1],350);
});

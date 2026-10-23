const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture() {
  const ctx = vm.createContext({document:{readyState:'loading',addEventListener(){},getElementById(){return {classList:{remove(){}},textContent:''};}}});
  ctx.window=ctx;
  for(const file of ['mathx','board','mechanics','app']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),ctx);
  const a=ctx.App; a.board=new ctx.Board(5); a.board.color.fill(-1);
  a.scene={up:[1,0,0],addShake(){},particles:{burst(){}}};
  a.trackBest=a.updateHud=a.toast=()=>{};
  ctx.Sfx={pop(){}};
  return {a,ctx};
}
test('contact group removes both rotor and shell blocks only after player pop',()=>{
  const {a,ctx}=fixture();a.board.color.fill(1);a.rotor=new ctx.Rotor(a.board,()=>0);
  const [main,external]=a.rotor.contacts()[0];
  a.board.color.fill(-1);a.board.color[main]=0;
  a.rotor.colors.fill(-1);a.rotor.colors[external-a.board.size]=0;
  a.spawnTilesInstant();
  const tile=a.makeTile(main,0);tile.id=external;tile.external=true;tile.center=a.rotor.center(external-a.board.size);a.tiles[external]=tile;
  a.state='play';a.score=0;
  const group=a.groupAt(main);assert.equal(group.length,2);
  assert.equal(a.remainingCount(),2);
  a.pop(group);
  assert.equal(a.remainingCount(),0);assert.equal(a.score,20);assert.equal(a.dying.length,2);
  a.rotor.angle=Math.PI;assert.equal(a.rotor.contacts().length,0);
});
test('a perspective seam removes same-colored shell and fixed panel blocks only on click',()=>{
  const {a,ctx}=fixture();a.rotor=new ctx.PerspectivePanel(a.board,()=>0);
  a.board.color[0]=2;a.rotor.colors.fill(-1);a.rotor.colors[0]=2;
  a.spawnTilesInstant();const external=a.board.size;
  const tile=a.makeTile(0,2);tile.id=external;tile.external=true;tile.center=a.rotor.center(0);a.tiles[external]=tile;
  a.state='play';a.score=0;
  assert.equal(a.groupAt(0).length,1);
  assert.equal(a.hasPotentialMoves(),true,'another viewpoint can create a match');
  a.rotor.links=[[0,external]];
  assert.equal(a.groupAt(0).length,2);assert.equal(a.remainingCount(),2);assert.equal(a.score,0);
  a.pop(a.groupAt(0));assert.equal(a.remainingCount(),0);assert.equal(a.score,20);
});
for(const color of [0,2,5]) test(`partial perspective seam joins all three blocks of color ${color}`,()=>{
  const {a,ctx}=fixture();a.rotor=new ctx.PerspectivePanel(a.board,()=>0);
  a.board.color[0]=color;a.rotor.colors.fill(-1);a.rotor.colors[0]=a.rotor.colors[1]=color;
  a.spawnTilesInstant();
  for(let i=0;i<2;i++) { const t=a.makeTile(0,color);t.id=a.board.size+i;t.external=true;t.center=a.rotor.center(i);a.tiles[t.id]=t; }
  a.rotor.links=[[0,a.board.size]];a.state='play';a.score=0;
  const expected=[0,a.board.size,a.board.size+1];
  for(const id of expected)assert.deepEqual(Array.from(a.groupAt(id)).sort((x,y)=>x-y),expected);
  assert.equal(a.remainingCount(),3);
  a.pop(a.groupAt(a.board.size+1));assert.equal(a.remainingCount(),0);assert.equal(a.score,45);
});
test('seam visibility cache updates as disappearing cubes move and vanish',()=>{
  const {a,ctx}=fixture();a.rotor=new ctx.PerspectivePanel(a.board);a.state='play';
  a.scene.vp=[1];a.scene.w=100;a.scene.h=100;a.dying=[];
  let calls=0;a.rotor.updateProjection=()=>{calls++;};
  a.updatePerspectiveContacts();a.updatePerspectiveContacts();assert.equal(calls,1);
  a.dying.push({id:0,center:[0,0,0],scaleMul:1});a.updatePerspectiveContacts();assert.equal(calls,2);
  a.dying[0].center[0]=1;a.updatePerspectiveContacts();assert.equal(calls,3);
  a.dying=[];a.updatePerspectiveContacts();assert.equal(calls,4);
});
test('perspective levels join main-body view links with physical groups and preserve unique block counts',()=>{
  const {a,ctx}=fixture();a.rotor=new ctx.PerspectivePanel(a.board);a.rotor.colors.fill(-1);a.viewLinks=[];
  const first=0,second=a.board.size-1,third=a.board.neighbors(second)[0];
  a.board.color[first]=a.board.color[second]=a.board.color[third]=2;
  a.spawnTilesInstant();a.state='play';a.score=0;
  assert.equal(a.groupAt(first).length,1);
  a.viewLinks=[[first,second],[second,first],[first,second]];
  assert.equal(a.groupAt(first).length,3);
  a.pop(a.groupAt(first));assert.equal(a.remainingCount(),0);assert.equal(a.score,45);
});
test('only perspective levels retain separated same colors as future view pairs',()=>{
  const {a,ctx}=fixture();a.rotor=null;a.viewLinks=[];
  a.board.color[0]=a.board.color[a.board.size-1]=2;
  assert.equal(a.hasPotentialMoves(),false);
  a.rotor=new ctx.PerspectivePanel(a.board);a.rotor.colors.fill(-1);
  assert.equal(a.board.hasMoves(),false);assert.equal(a.hasPotentialMoves(),true);
  a.board.color[a.board.size-1]=3;assert.equal(a.hasPotentialMoves(),false);
});

test('ordinary elimination ignores stale projected links and clears projection state',()=>{
  const {a}=fixture();a.rotor=null;a.state='play';a.viewLinks=[[0,a.board.size-1]];
  a.board.color[0]=a.board.color[a.board.size-1]=2;
  assert.equal(a.groupAt(0).length,1);
  a.updatePerspectiveContacts();assert.equal(a.viewLinks.length,0);assert.equal(a.mainMatcher,null);
});

test('rotating levels disable view seams and do not retain separated body colors as potential matches',()=>{
  const {a,ctx}=fixture();a.state='play';a.rotor=new ctx.Rotor(a.board);
  a.mainMatcher=new ctx.PerspectivePanel(a.board);a.mainMatcher.colors.fill(-1);
  a.scene.vp=[1];a.scene.w=a.scene.h=100;a.scene.dpr=1;
  const panelTile={id:a.board.size};a.renderList=[{id:0},panelTile];
  a.scene.pick=(x,y,tiles)=>tiles.includes(panelTile)?panelTile.id:0;
  a.mainMatcher.updateProjection=()=>assert.fail('rotor levels must not scan projected seams');
  a.viewLinks=[[0,a.board.size-1]];
  a.updatePerspectiveContacts();
  assert.equal(a.viewLinks.length,0);
  a.rotor.colors.fill(-1);a.board.color[0]=a.board.color[a.board.size-1]=2;
  assert.equal(a.groupAt(0).length,1);assert.equal(a.hasPotentialMoves(),false);
});

test('level selection persists separate completed levels and restores entry scores',()=>{
  const {a,ctx}=fixture();const saved=new Map();
  ctx.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
  a.startLevel=()=>{};
  a.startGame('normal',3);assert.equal(a.level,1,'locked level cannot be entered directly');
  a.score=900;a.target=500;a.recordClear();
  assert.equal(a.progressFor('normal').cleared[1],0);
  assert.equal(Object.keys(a.progressFor('challenge').cleared).length,0);
  a.startSelectedLevel('normal',2,true);assert.equal(a.level,2);assert.equal(a.score,900);
  a.score=1800;a.target=1400;a.recordClear();
  a.startSelectedLevel('normal',2);assert.equal(a.level,2);assert.equal(a.score,900);
  a.startGame('test',3);a.score=99999;a.target=0;a.recordClear();
  assert.equal(a.progressFor('normal').next,3);assert.equal(a.progressFor('challenge').next,1);
});

for(const mode of ['normal'])test(`${mode}: first and next available level are selectable without completing them first`,()=>{
  const {a}=fixture();let html='',starts=0;
  a.overlay=s=>html=s;a.startLevel=()=>starts++;
  a.showLevelSelect(mode);
  assert.match(html,/data-level="1"/);assert.doesNotMatch(html,/data-level="2"/);
  a.startSelectedLevel(mode,1);assert.equal(starts,1);assert.equal(a.score,0);
  a.score=900;a.target=500;a.recordClear();a.showLevelSelect(mode);
  assert.match(html,/data-level="2"/);assert.doesNotMatch(html,/data-level="3"/);
  a.startSelectedLevel(mode,2);assert.equal(starts,2);assert.equal(a.score,900);
  a.startSelectedLevel(mode,3);assert.equal(starts,2);
});

test('challenge exposes only eleven levels and rejects the removed twelfth level',()=>{
  const {a}=fixture();let html='',starts=0;
  a.overlay=s=>html=s;a.startLevel=()=>starts++;
  a.showLevelSelect('challenge');
  assert.equal((html.match(/class="level-choice /g)||[]).length,11);
  for(let level=1;level<=11;level++) {
    assert.ok(html.includes(`data-level="${level}"`));
    a.startSelectedLevel('challenge',level);
    assert.equal(starts,level);assert.equal(a.level,level);assert.ok(Number.isFinite(a.score));
  }
  a.startSelectedLevel('challenge',12);assert.equal(starts,11);
  a.progressCache.challenge={next:20,score:90000,cleared:{3:1200}};
  a.showLevelSelect('challenge');assert.doesNotMatch(html,/data-act="continueLevels"/);
  a.startSelectedLevel('challenge',3);assert.equal(a.score,0);
  a.mode='challenge';a.level=11;a.target=0;a.showClearPanel();
  assert.doesNotMatch(html,/data-act="next"/);
});

test('challenge ignores legacy accumulated scores when continuing and saving clears',()=>{
  const {a,ctx}=fixture();const saved=new Map();
  ctx.localStorage={setItem:(k,v)=>saved.set(k,v)};
  a.progressCache={challenge:{next:4,score:9000,cleared:{3:1200}}};
  a.startLevel=()=>{};a.startSelectedLevel('challenge',4,true);
  assert.equal(a.score,0);assert.equal(a.entryScore,0);
  a.score=800;a.target=500;a.recordClear();
  const record=JSON.parse(saved.get('popstar3d.progress.challenge'));
  assert.equal(record.score,0);assert.equal(record.cleared[4],0);
});

test('challenge next-level initialization and restart reset score and use a local target',()=>{
  const {a,ctx}=fixture();
  ctx.document.getElementById=()=>({classList:{add(){},remove(){},toggle(){}}});
  for(const method of ['clearHint','clearHover','spawnTilesFalling','hideOverlay','setZoom','showBanner'])a[method]=()=>{};
  a.scene.particles.clear=()=>{};
  a.mode='challenge';a.level=11;a.score=9000;a.entryScore=4000;
  a.startLevel(false);assert.equal(a.score,0);assert.equal(a.entryScore,0);assert.equal(a.target,1100);
  a.score=300;a.entryScore=4000;a.restart();assert.equal(a.score,0);assert.equal(a.entryScore,0);
  a.mode='normal';assert.equal(a.targetFor(12,98),36100);
});

test('normal campaign stops at 15 and keeps completed levels replayable',()=>{
  const {a}=fixture();let html='';a.overlay=s=>html=s;
  a.progressCache={normal:{next:16,score:90000,cleared:{15:80000}}};
  a.showLevelSelect('normal');assert.equal((html.match(/class="level-choice /g)||[]).length,15);
  assert.doesNotMatch(html,/data-act="continueLevels"/);
  a.startLevel=()=>assert.fail('level 16 must not start');a.startSelectedLevel('normal',16,true);
  a.mode='normal';a.level=15;a.score=90000;a.target=85000;a.showClearPanel();
  assert.doesNotMatch(html,/data-act="next"/);
});

test('mechanic introduction only appears in normal 5x5 levels 2 and 3 and pauses until dismissed',()=>{
  const {a,ctx}=fixture();ctx.performance={now:()=>0};let html='';a.overlay=s=>html=s;
  a.board.color[0]=a.board.color[a.board.neighbors(0)[0]]=0;
  a.mode='normal';
  for(let level=1;level<=15;level++) {a.level=level;assert.equal(a.hasMechanicIntro(),level===2||level===3);}
  a.level=2;a.state='intro';a.introLeft=0;a.introDone=false;
  a.updateTimers(0.1);assert.equal(a.state,'paused');assert.match(html,/我知道了/);assert.match(html,/顺时针/);
  a.hideOverlay=()=>{};a.resume();assert.equal(a.state,'play');
  a.showMechanicIntro();assert.equal(a.state,'paused');
  a.state='play';a.level=3;a.showMechanicIntro();assert.match(html,/转动视角/);
  a.state='busy';html='';a.showMechanicIntro();assert.equal(html,'');
  a.mode='test';assert.equal(a.hasMechanicIntro(),false);
});

test('fifth rotor can join and remove a host block with correct IDs, count and score',()=>{
  const {a,ctx}=fixture();a.board=new ctx.Board(9);a.board.color.fill(1);
  a.rotor=new ctx.Rotor(a.board,()=>0,5);
  const [main,external]=a.rotor.contacts().find(([m,e])=>m<a.board.size&&e>=a.board.size+24);
  a.board.color.fill(-1);a.board.color[main]=2;a.rotor.colors.fill(-1);a.rotor.colors[external-a.board.size]=2;
  a.spawnTilesInstant();const tile=a.makeTile(main,2);tile.id=external;tile.external=true;tile.center=a.rotor.center(external-a.board.size);a.tiles[external]=tile;
  assert.equal(a.tilesAll,a.board.size+30);assert.equal(a.remainingCount(),2);
  assert.equal(a.groupAt(main).length,2);assert.equal(a.hasPotentialMoves(),true);
  a.score=0;a.state='play';a.pop(a.groupAt(external));
  assert.equal(a.remainingCount(),0);assert.equal(a.score,20);assert.equal(a.rotor.colors[external-a.board.size],-1);
});
test('late fixed panels retain future moves and do not share local grid neighbors',()=>{
  const {a,ctx}=fixture();a.board=new ctx.Board(9);a.board.color.fill(-1);
  a.rotor=new ctx.PerspectivePanel(a.board,()=>0,5);a.rotor.colors.fill(-1);
  a.rotor.colors[18]=a.rotor.colors[24]=2;
  assert.equal(a.hasPotentialMoves(),true);assert.equal(a.groupAt(a.board.size+18).length,1);
  a.rotor.links=[[a.board.size+18,a.board.size+24]];
  assert.equal(a.groupAt(a.board.size+24).length,2);
  a.rotor.links=[];a.rotor.colors.fill(-1);a.rotor.colors[24]=a.rotor.colors[29]=2;
  assert.equal(a.hasPotentialMoves(),false,'isolated nonadjacent pieces on the same fixed plate cannot pair through a view');
});

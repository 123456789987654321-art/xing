const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const node=()=>({style:{},dataset:{},setAttribute(){},appendChild(){},remove(){},addEventListener(){}});
  const ctx=vm.createContext({document:{createElement:node,body:node()},innerWidth:800,innerHeight:800});ctx.window=ctx;
  vm.runInContext(fs.readFileSync('js/challenge-rubik-controls.js','utf8'),ctx);
  const actions=[],game={world:{rubik:{pitch:1.12,surface:1.76,halfExtent:1.86,turn:null,faces:[{n:[0,0,1],d:[0,-1,0],r:[1,0,0]},{n:[0,0,-1],d:[0,-1,0],r:[-1,0,0]}]}},app:{state:'play',scene:{eye:[0,0,10],project:p=>[400+p[0]*70,400-p[1]*70]}},intro:0,slides:new Map(),action:(...args)=>actions.push(args)};
  return {controls:new ctx.ChallengeRubikControls(game),game,actions};
}
test('only front face exposes its twelve macro slice controls and gravity',()=>{
 const {controls}=fixture();controls.render();assert.equal(controls.targets.length,12);assert.equal(controls.gravity.filter(g=>!g.node.hidden).length,1);
 const turns=controls.targets.map(t=>t.turn);assert.deepEqual([...new Set(turns.map(t=>t.axis))].sort(),[0,1]);
 for(const axis of [0,1])for(const layer of [-1,0,1])assert.deepEqual(Array.from(turns.filter(t=>t.axis===axis&&t.layer===layer),t=>t.direction).sort(),[-1,1]);
});
test('slice pointers consume gestures and cannot turn during pause intro animation or settling',()=>{
 const {controls,game,actions}=fixture();controls.render();const t=controls.targets[0],e={clientX:t.x,clientY:t.y,pointerId:1,button:0};
 assert.equal(controls.pointerDown(e),true);assert.equal(actions.length,1);assert.equal(controls.pointerMove(e),true);assert.equal(controls.pointerUp(e),true);
 for(const block of ['pause','intro','turn','slides']){
 game.app.state=block==='pause'?'paused':'play';game.intro=block==='intro'?1:0;game.world.rubik.turn=block==='turn'?{}:null;game.slides=block==='slides'?new Map([[1,{}]]):new Map();
 controls.pointerDown(e);controls.pointerUp(e);assert.equal(actions.length,1,block);
 }
 assert.equal(controls.pointerDown({clientX:0,clientY:0}),false);
});

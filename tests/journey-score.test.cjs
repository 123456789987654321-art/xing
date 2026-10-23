const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const S=require('../js/journey-state.js');
function fixture(){
 const elements=new Map();
 const document={addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{style:{},classList:{add(){},remove(){}}});return elements.get(id);}};
 const ctx=vm.createContext({document});ctx.window=ctx;ctx.ChallengeGame=function(){};
 for(const name of ['mathx','board','mechanics','app','journey-data','journey-state','journey'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
 return {a:ctx.App,j:ctx.Journey,elements};
}
test('every main level enforces its own score boundary without losing saved progress',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(_,value)=>{saved=value;}};
 let c=new S.Campaign(storage);c.acknowledge('opening');
 for(let level=1;level<=15;level++){
  const goal=S.target(level),before=JSON.stringify(c.state);
  assert.equal(c.complete('normal',level,goal-1),false);
  assert.equal(JSON.stringify(c.state),before,'failure must not update records or unlock story');
  assert.equal(c.complete('normal',level,goal),true);
  c=new S.Campaign(storage);assert.equal(c.state.main,level);assert.equal(c.state.best.normal[level],goal);
  while(c.state.pending.length)c.acknowledge(c.state.pending[0]);
 }
});
test('HUD and settlement stars use the current level, with first star exactly at its goal',()=>{
 const {a,elements}=fixture();a.mode='normal';a.board={aliveCount:()=>10};
 for(let level=1;level<=15;level++){
  a.level=level;a.N=S.profile(level).size;a.target=a.targetFor(level,0);
  const steps=Array.from(a.starSteps());assert.equal(steps.length,5);
  assert.equal(steps[0],S.target(level),'first star must match this level, not level 1');
  assert.ok(steps.every((n,i)=>Number.isFinite(n)&&n%50===0&&(!i||n>steps[i-1])));
  a.score=steps[0]-1;a.updateHud();assert.equal((elements.get('hudStars').innerHTML.match(/class="on"/g)||[]).length,0);
  a.score=steps[0];a.updateHud();assert.equal((elements.get('hudStars').innerHTML.match(/class="on"/g)||[]).length,1);
  assert.equal(String(elements.get('hudTarget').textContent),String(S.target(level)));
  for(let i=0;i<steps.length;i++){
   a.score=steps[i]-1;assert.equal((a.starDots().match(/class="on"/g)||[]).length,i);
   a.score=steps[i];assert.equal((a.starDots().match(/class="on"/g)||[]).length,i+1);
  }
 }
});
test('score rebalance retains already unlocked low-score saves',()=>{
 const saved={version:1,main:15,creative:0,ending:'stay',ifLine:false,pending:[],seen:['opening'],best:{normal:{1:500,15:1900},challenge:{}}};
 const c=new S.Campaign({getItem:()=>JSON.stringify(saved),setItem(){}});
 assert.equal(c.state.main,15);assert.equal(c.canEnter('normal',15),true);assert.equal(c.canEnter('challenge',1),true);
 assert.equal(c.state.best.normal[1],500);assert.equal(c.state.best.normal[15],1900);
});

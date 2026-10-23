const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Campaign:BaseCampaign,profile,target}=require('../js/journey-state.js');
// Keep coverage of the optional sequential mode while the shipped game is fully open.
class Campaign extends BaseCampaign{constructor(storage){super(storage,{allUnlocked:false});}}
const memory=()=>{let value=null;return {getItem:()=>value,setItem:(_,v)=>{value=v;}};};
function ready(){const storage=memory(),c=new Campaign(storage);c.acknowledge('opening');return {c,storage};}
function drain(c){while(c.state.pending.length)c.acknowledge(c.state.pending[0]);}
test('new campaign only allows first main level after introduction',()=>{
 const c=new Campaign(memory());assert.equal(c.canEnter('normal',1),false);c.acknowledge('opening');
 assert.equal(c.canEnter('normal',1),true);assert.equal(c.canEnter('normal',2),false);assert.equal(c.canEnter('challenge',1),false);
 for(const n of [0,16,NaN,1.2])assert.equal(c.canEnter('normal',n),false);
});
test('chapters reuse increasing sizes and fixed mechanics without cumulative targets',()=>{
 assert.deepEqual([1,5,6,10,11,15].map(n=>[profile(n).size,profile(n).kind]),[[5,'normal'],[9,'normal'],[5,'rotor'],[9,'rotor'],[5,'perspective'],[9,'perspective']]);
 for(let level=1;level<=15;level++){
  assert.ok(Number.isFinite(target(level))&&target(level)>0);
  if(level%5!==1)assert.ok(target(level)>target(level-1));
  if(level<=10)assert.ok(target(level+5)>target(level),'same-size later chapters include extra mechanics');
 }
});
test('failed or locked clears do not unlock; pending story survives reload and advances once',()=>{
 const {c,storage}=ready();assert.equal(c.complete('normal',1,0),false);assert.equal(c.complete('normal',2,99999),false);
 assert.equal(c.complete('normal',1,5000),true);assert.equal(c.canEnter('normal',2),false);
 const restored=new Campaign(storage);assert.deepEqual(restored.state.pending,['main-01']);
 assert.equal(restored.acknowledge('main-02'),false);restored.acknowledge('main-01');assert.equal(restored.canEnter('normal',2),true);
 restored.complete('normal',1,6000);assert.equal(restored.state.main,1);assert.equal(restored.state.pending.length,0);
 assert.equal(restored.state.best.normal[1],6000);
});
test('chapter travel persists and finale gates ending and IF branch',()=>{
 const {c,storage}=ready();
 for(let n=1;n<=15;n++){assert.equal(c.complete('normal',n,99999),true);if(n===5)assert.deepEqual(c.state.pending,['main-05','travel-01']);drain(c);}
 assert.equal(c.canEnter('challenge',1),false);assert.equal(c.choose('leave'),true);drain(c);
 const restored=new Campaign(storage);assert.equal(restored.state.ending,'leave');assert.equal(restored.canEnter('challenge',1),true);
 assert.equal(restored.enterIf(),true);assert.equal(restored.state.ending,'leave');drain(restored);assert.equal(restored.canEnter('challenge',1),true);
 assert.equal(restored.canEnter('challenge',2),false);restored.complete('challenge',1,0);drain(restored);assert.equal(restored.canEnter('challenge',2),true);
});
test('stay unlocks creative only after its story; all eleven creative chapters finish',()=>{
 const {c}=ready();for(let i=1;i<=15;i++){c.complete('normal',i,99999);drain(c);}c.choose('stay');assert.equal(c.canEnter('challenge',1),false);drain(c);
 for(let i=1;i<=11;i++){assert.equal(c.complete('challenge',i,0),true);drain(c);}assert.equal(c.state.creative,11);assert.equal(c.canEnter('challenge',12),false);
});
test('malformed saves reset safely and unavailable storage stays playable',()=>{
 const c=new Campaign({getItem:()=>'{bad',setItem:()=>{throw Error('quota');}});c.acknowledge('opening');assert.equal(c.canEnter('normal',1),true);assert.equal(c.storageAvailable,false);
 const d=new Campaign({getItem:()=>JSON.stringify({version:1,main:900,pending:[]}),setItem(){}});assert.equal(d.state.main,0);assert.deepEqual(d.state.pending,['opening']);
});
test('every unlocked story has valid cast, production asset and readable panel counts',()=>{
 const D=require('../js/journey-data.js'),assets=new Set();
 const c=new Campaign(memory()),ids=new Set(c.state.pending);drain(c);
 for(let i=1;i<=15;i++){c.complete('normal',i,99999);c.state.pending.forEach(id=>ids.add(id));drain(c);}
 c.choose('leave');c.state.pending.forEach(id=>ids.add(id));drain(c);c.enterIf();c.state.pending.forEach(id=>ids.add(id));drain(c);
 for(let i=1;i<=11;i++){c.complete('challenge',i,0);c.state.pending.forEach(id=>ids.add(id));drain(c);}ids.add('stay');
 for(const id of ids){const story=D.stories[id];assert.ok(story,id);assert.ok(story.panels.length>=(story.long?6:3)&&story.panels.length<=(story.long?8:5));
  for(const p of story.panels){assert.ok(p.shot&&p.text&&p.speaker);p.cast.forEach(c=>assert.ok(D.characters[c],c));assert.equal(assets.has(p.asset),false);assets.add(p.asset);}
 }
});

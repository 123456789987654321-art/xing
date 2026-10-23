const {test}=require('node:test'),assert=require('node:assert/strict');
const {Campaign}=require('../js/journey-state.js');
const D=require('../js/journey-data.js');
const memory=()=>{let value=null;return {getItem:()=>value,setItem:(_,v)=>{value=v;}};};
test('IF cannot discard an unread home reward',()=>{
 const c=new Campaign(memory());c.choose('leave');c.acknowledge('leave');
 c.complete('challenge',1,0);assert.equal(c.enterIf(),false);
 assert.deepEqual(c.state.pending,['home-01']);assert.equal(c.state.ifLine,false);
 c.acknowledge('home-01');assert.equal(c.enterIf(),true);
});
test('leaving queues the home comic for each challenge and restores unread stories',()=>{
 const storage=memory();let c=new Campaign(storage);
 c.choose('leave');c.acknowledge('leave');
 for(let level=1;level<=11;level++){
  assert.equal(c.complete('challenge',level,0),true);
  const id='home-'+String(level).padStart(2,'0');
  assert.deepEqual(c.state.pending,[id]);
  c=new Campaign(storage);assert.deepEqual(c.state.pending,[id]);
  assert.ok(D.stories[id].pages.length);assert.equal(c.acknowledge(id),true);
  c.complete('challenge',level,10);assert.deepEqual(c.state.pending,[]);
 }
 assert.equal(c.state.creative,11);assert.equal(c.state.seen.length,12);
});
test('switching from stay to home then IF preserves both memories and challenge records',()=>{
 const c=new Campaign(memory());c.choose('stay');c.acknowledge('stay');
 c.complete('challenge',1,100);c.acknowledge('life-01');
 c.choose('leave');c.acknowledge('leave');c.complete('challenge',1,50);
 assert.deepEqual(c.state.pending,['home-01']);c.acknowledge('home-01');
 assert.equal(c.state.best.challenge[1],100);
 c.enterIf();c.acknowledge('if-life');c.complete('challenge',2,0);
 assert.deepEqual(c.state.pending,['life-02']);
 assert.ok(c.state.seen.includes('home-01'));assert.ok(c.state.seen.includes('life-01'));
 assert.equal(c.state.ending,'leave');assert.equal(c.state.ifLine,true);
});
test('IF can replay an already cleared home challenge to earn the distinct stay story',()=>{
 const c=new Campaign(memory());c.choose('leave');c.acknowledge('leave');
 c.complete('challenge',1,42);c.acknowledge('home-01');
 c.enterIf();c.acknowledge('if-life');c.complete('challenge',1,0);
 assert.deepEqual(c.state.pending,['life-01']);
 assert.equal(c.state.best.challenge[1],42);
});
test('sequential campaign opens home challenges only after reading the departure',()=>{
 const c=new Campaign(memory(),{allUnlocked:false});c.acknowledge('opening');
 for(let i=1;i<=15;i++){c.complete('normal',i,99999);while(c.state.pending.length)c.acknowledge(c.state.pending[0]);}
 c.choose('leave');assert.equal(c.canEnter('challenge',1),false);
 c.acknowledge('leave');assert.equal(c.canEnter('challenge',1),true);
 c.complete('challenge',1,0);assert.deepEqual(c.state.pending,['home-01']);
 assert.equal(c.canEnter('challenge',2),false);
 c.acknowledge('home-01');assert.equal(c.canEnter('challenge',2),true);
});

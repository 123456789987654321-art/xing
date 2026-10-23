const {test}=require('node:test'),assert=require('node:assert/strict');
const {Campaign,KEY}=require('../js/journey-state.js');
test('damaged slots cannot replace active progress',()=>{
 const store=memory(),c=new Campaign(store);c.complete('normal',1,2000);
 store.setItem(KEY,JSON.stringify({...c.state,slots:[{savedAt:new Date().toISOString(),state:{version:1}}]}));
 const reload=new Campaign(store);assert.equal(reload.slots[0],null);assert.equal(reload.loadSlot(0),false);assert.equal(reload.state.main,1);
});
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
test('restart saves progress and restores only through explicit load',()=>{
 const store=memory(),c=new Campaign(store);c.complete('normal',1,2000);
 assert.equal(c.saveSlot(0,true),true);assert.equal(c.state.main,0);
 const reload=new Campaign(store);assert.equal(reload.state.main,0);assert.equal(reload.slots[0].state.main,1);
 assert.equal(reload.loadSlot(0),true);assert.equal(reload.state.best.normal[1],2000);
 assert.equal(new Campaign(store).state.main,1);
});
test('three slots are independent and a selected slot alone is replaced',()=>{
 const c=new Campaign(memory());for(let i=0;i<3;i++){c.state.best.normal[1]=1000+i;c.saveSlot(i,false);}
 assert.equal(c.saveSlot(3,true),false);assert.equal(c.slots.length,3);
 c.state.best.normal[1]=5000;c.saveSlot(1,true);
 assert.equal(c.slots[0].state.best.normal[1],1000);assert.equal(c.slots[1].state.best.normal[1],5000);assert.equal(c.slots[2].state.best.normal[1],1002);
 assert.equal(c.state.main,0);assert.deepEqual(c.state.best.normal,{});
});
test('failed storage write never clears progress or overwrites a slot',()=>{
 const store=memory(),c=new Campaign(store);c.complete('normal',1,2000);c.saveSlot(0,false);
 const before=JSON.stringify(c.state),slots=JSON.stringify(c.slots),disk=store.getItem(KEY);
 store.setItem=()=>{throw Error('quota');};
 assert.equal(c.saveSlot(0,true),false);assert.equal(JSON.stringify(c.state),before);assert.equal(JSON.stringify(c.slots),slots);assert.equal(store.getItem(KEY),disk);
 assert.equal(c.loadSlot(0),false);assert.equal(JSON.stringify(c.state),before);
});
test('legacy progress survives migration and normal saves retain slots',()=>{
 const store=memory(),c=new Campaign(store);c.complete('normal',1,2000);store.setItem(KEY,JSON.stringify(c.state));
 const migrated=new Campaign(store);assert.equal(migrated.state.main,1);migrated.saveSlot(0,false);migrated.complete('normal',2,3000);
 const reload=new Campaign(store);assert.equal(reload.state.main,2);assert.equal(reload.slots[0].state.main,1);assert.equal(reload.loadSlot(2),false);
});

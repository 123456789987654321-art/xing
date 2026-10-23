const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');require('../js/challenge-world.js');
const world=()=>new ChallengeWorld(11,()=>.1);
test('twelve-block difference balances; thirteen lowers the heavier side',()=>{
  const w=world(),left=w.cells.filter(c=>c.side==='left');
  w.remove(left.slice(0,12).map(c=>c.id));w.update(.1);
  assert.equal(w.seesaw.balanced,true);assert.equal(w.seesaw.angle,0);
  w.remove(w.cells.filter(c=>c.side==='left'&&c.color>=0).slice(0,1).map(c=>c.id));w.update(.1);
  assert.equal(w.seesaw.balanced,false);assert.ok(w.seesaw.angle<0);assert.equal(w.canRemove(),true);
});
test('removal multiplier uses the balance before removal',()=>{
  const w=world();w.remove(w.cells.filter(c=>c.side==='left').slice(0,13).map(c=>c.id));
  assert.equal(w.score,Math.round(5*13*13*1.2));assert.equal(w.lastMultiplier,1.2);
  const before=w.score;w.remove(w.cells.filter(c=>c.side==='right').slice(0,2).map(c=>c.id));
  assert.equal(w.score-before,20);assert.equal(w.lastMultiplier,1);assert.equal(w.seesaw.balanced,true);
});
test('both assemblies slide downhill, stay on board, and earn .8 only after prolonged imbalance',()=>{
  const w=world();w.remove(w.cells.filter(c=>c.side==='right').slice(0,20).map(c=>c.id));
  for(let i=0;i<1000;i++)w.update(.05);
  const s=w.seesaw;
  assert.ok(s.groupPositions.left<0&&s.groupPositions.right<0);
  assert.ok(s.groupPositions.left>=-3.09-1e-8);
  assert.ok(s.groupPositions.right-s.groupPositions.left>=1.1-1e-8);
  assert.equal(s.rightCount,0);assert.equal(s.leftCount,w.remaining());
  assert.ok(s.imbalanceTime>=5);assert.equal(s.multiplier,.8);
  const before=w.score;w.remove(w.cells.filter(c=>c.color>=0).slice(0,2).map(c=>c.id));
  assert.equal(w.score-before,16);assert.equal(w.lastMultiplier,.8);
  assert.ok(w.barriers.every(b=>b.alpha===1));
});
test('five seconds alone does not reduce score while assemblies remain on different sides',()=>{
  const w=world();w.remove(w.cells.filter(c=>c.side==='right').slice(0,20).map(c=>c.id));
  w.update(5);
  assert.equal(w.seesaw.multiplier,1);
});
test('same-side score penalty starts exactly at five seconds and balance resets it',()=>{
  const w=world();w.action('shift',{side:'left',delta:-100});w.action('shift',{side:'right',delta:-100});
  assert.equal(w.seesaw.rightCount,0);assert.equal(w.seesaw.multiplier,1);
  w.update(4.99);assert.equal(w.seesaw.multiplier,1);
  w.update(.01);assert.equal(w.seesaw.multiplier,.8);
  w.action('shift',{side:'right',delta:100});
  assert.equal(w.seesaw.balanced,true);assert.equal(w.seesaw.imbalanceTime,0);assert.equal(w.seesaw.angle,0);assert.equal(w.seesaw.multiplier,1.2);
});

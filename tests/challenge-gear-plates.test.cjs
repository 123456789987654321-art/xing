const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');require('../js/challenge-world.js');
test('each gear is five solid six by five cube plates',()=>{
  const w=new ChallengeWorld(9,()=>.1);
  assert.equal(w.cells.length,300);
  for(const component of w.components){
    const cells=w.cells.filter(c=>c.component===component.id);
    assert.equal(cells.length,150);
    for(let plate=0;plate<5;plate++){
      const group=cells.filter(c=>c.plateIndex===plate);assert.equal(group.length,30);
      assert.equal(new Set(group.map(c=>c.plateRow)).size,6);assert.equal(new Set(group.map(c=>c.plateColumn)).size,5);
      assert.ok(group.every(c=>c.poly.vertices.length===8&&c.poly.faces.every(f=>f.length===4)));
    }
  }
  assert.ok(w.contacts().some(([a,b])=>w.cells[a].component!==w.cells[b].component));
});
test('gear plates stay separated throughout rotation and join again at every stop',()=>{
  const w=new ChallengeWorld(9,()=>.1);
  for(let i=0;i<=64;i++){
    w.time=2.4+i/64*.8-1e-8;w.update(1e-8);
    const x=w.components.map(comp=>w.cells.filter(c=>c.component===comp.id).flatMap(c=>w._vertices(c).map(v=>v[0])));
    assert.ok(Math.max(...x[0])-Math.min(...x[1])<1e-8,'no cross-unit penetration at sample '+i);
    if(i>0&&i<64){assert.equal(w.canRemove(),false);assert.ok(Math.min(...x[1])-Math.max(...x[0])>1e-6);}
  }
  for(let turn=0;turn<5;turn++){
    w.time=turn*3.2+.1-1e-8;w.update(1e-8);
    assert.equal(w.canRemove(),true);
    assert.ok(w.contacts().some(([a,b])=>w.cells[a].component!==w.cells[b].component),'plate end contact on stop '+turn);
  }
});
test('the five paddles in each unit do not overlap one another',()=>{
  const w=new ChallengeWorld(9,()=>.1);
  const plates=Array.from({length:5},(_,p)=>w.cells.filter(c=>c.component===0&&c.plateIndex===p).flatMap(c=>w._vertices(c)));
  for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){
    const axes=[a,b].flatMap(p=>{const t=p*Math.PI*2/5;return [[Math.cos(t),Math.sin(t)],[-Math.sin(t),Math.cos(t)]];});
    assert.ok(axes.some(axis=>{
      const ranges=[plates[a],plates[b]].map(points=>{const values=points.map(v=>v[0]*axis[0]+v[1]*axis[1]);return [Math.min(...values),Math.max(...values)];});
      return Math.min(ranges[0][1],ranges[1][1])-Math.max(ranges[0][0],ranges[1][0])<=1e-8;
    }),'plate '+a+' and '+b+' remain separate');
  }
});

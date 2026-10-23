const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/board.js');require('../js/mechanics.js');
test('projected edges join only when aligned, not overlapping or far apart',()=>{
  const square=(x,y)=>[[x,y],[x+10,y],[x+10,y+10],[x,y+10]];
  assert.equal(PerspectivePanel.edgesJoin(square(0,0),square(10,0)),true);
  assert.equal(PerspectivePanel.edgesJoin(square(0,0),square(5,0)),false);
  assert.equal(PerspectivePanel.edgesJoin(square(0,0),square(15,0)),false);
  assert.equal(PerspectivePanel.edgesJoin(square(0,0),square(10,9)),false);
});
test('shallow overlap and a visible gap are not perspective seams',()=>{
  const square=x=>[[x,0],[x+100,0],[x+100,100],[x,100]];
  assert.equal(PerspectivePanel.edgesJoin(square(0),square(90)),false);
  assert.equal(PerspectivePanel.edgesJoin(square(0),square(110)),false);
  assert.equal(PerspectivePanel.edgesJoin(square(0),square(99.5)),false);
});
test('panel is fixed, physically separated and has six cubes at either board size',()=>{
  for(const n of [5,7]) {
    const b=new Board(n),panel=new PerspectivePanel(b,()=>0);
    const positions=Array.from({length:6},(_,i)=>panel.center(i));
    panel.update(100);
    assert.deepEqual(Array.from({length:6},(_,i)=>panel.center(i)),positions);
    assert.equal(panel.remaining(),6);
    assert.ok(positions.every(p=>p[0]-b.pitch/2>1));
  }
});

test('projection joins visible aligned blocks, rejects occluded blocks and changes with view',()=>{
  const b=new Board(5);b.color.fill(-1);
  const target=b.cells.findIndex((_,id)=>{const p=b.cellCenter(id);return Math.abs(p[0]-.8)<1e-8&&Math.abs(p[1]-.4)<1e-8&&Math.abs(p[2]-.8)<1e-8;});
  b.color[target]=0;const panel=new PerspectivePanel(b,()=>0);
  // Orthographic view chosen so the physically separate cubes share one projected edge.
  const k=0.6,project=p=>[(p[0]+k*p[2])*100,-p[1]*100];
  panel.updateProjection(project,()=>true);
  assert.ok(panel.contacts().length>0);
  panel.updateProjection(project,()=>false);assert.equal(panel.contacts().length,0);
  panel.updateProjection(p=>[p[0]*100,-p[1]*100],()=>true);assert.equal(panel.contacts().length,0);
});

test('a visible seam counts even when the cube centre is occluded',()=>{
  const b=new Board(5);b.color.fill(-1);
  const target=b.cells.findIndex((_,id)=>{const p=b.cellCenter(id);return Math.abs(p[0]-.8)<1e-8&&Math.abs(p[1]-.4)<1e-8&&Math.abs(p[2]-.8)<1e-8;});
  b.color[target]=0;const panel=new PerspectivePanel(b,()=>0);
  panel.updateProjection(p=>[(p[0]+0.6*p[2])*100,-p[1]*100],(id,centre,seamPoint)=>!!seamPoint);
  assert.ok(panel.contacts().some(pair=>pair[0]===target));
});

test('partial side-by-side edges are connections; a corner alone is not',()=>{
  const square=(x,y)=>[[x,y],[x+100,y],[x+100,y+100],[x,y+100]];
  assert.equal(PerspectivePanel.edgesJoin(square(0,0),square(100,60)),true);
  assert.equal(PerspectivePanel.edgesJoin(square(0,0),square(100,100)),false);
});

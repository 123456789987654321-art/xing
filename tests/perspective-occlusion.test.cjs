const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/mathx.js');require('../js/board.js');require('../js/scene.js');require('../js/mechanics.js');
function fixture(yaw,pitch,n=7,count=1) {
  const board=new Board(n);board.color.fill(0);
  const panel=new PerspectivePanel(board,()=>0,count),scene=Object.create(Scene.prototype);
  const cp=Math.cos(pitch),sp=Math.sin(pitch),distance=8;
  scene.eye=[distance*cp*Math.sin(yaw),distance*sp,distance*cp*Math.cos(yaw)];
  scene.up=[-sp*Math.sin(yaw),cp,-sp*Math.cos(yaw)];scene.w=1100;scene.h=850;scene.dpr=1;
  const proj=MX.m4.create(),view=MX.m4.create();scene.vp=MX.m4.create();scene.invVP=MX.m4.create();
  MX.m4.perspective(proj,Math.PI/4,1100/850,0.3,60);MX.m4.lookAt(view,scene.eye,[0,0,0],scene.up);
  MX.m4.multiply(scene.vp,proj,view);MX.m4.invert(scene.invVP,scene.vp);
  const tiles=board.cells.map((_,id)=>({id,center:board.cellCenter(id),basis:[1,0,0,0,1,0,0,0,1],size:[board.pitch,board.pitch,board.pitch]}));
  for(let i=0;i<panel.colors.length;i++)tiles.push({id:board.size+i,center:panel.center(i),basis:panel.basis(i),size:[board.pitch,board.pitch,board.pitch]});
  const project=p=>scene.project(p);
  const pick=(p,candidates)=>scene.pick(p[0]/550-1,1-p[1]/425,tiles.filter(t=>(!candidates||candidates.includes(t.id))&&(t.id<board.size?board.color[t.id]>=0:panel.colors[t.id-board.size]>=0)));
  const visible=(id,center,point)=>pick(point||project(center))===id;
  return {board,panel,scene,project,pick,visible};
}
test('oblique partial occlusion creates a visible cross-board seam',()=>{
  const f=fixture(-1.4,0.65);
  f.panel.updateProjection(f.project,f.visible,f.scene.eye,f.pick);
  assert.ok(f.panel.contacts().length>0);
});
test('an actual visible gap does not join the detached panel',()=>{
  const f=fixture(0.4,0.3);
  f.panel.updateProjection(f.project,f.visible,f.scene.eye,f.pick);
  assert.equal(f.panel.contacts().length,0);
});
test('a fully hidden panel is not a visible connection',()=>{
  const f=fixture(-Math.PI/2,0);
  f.panel.updateProjection(f.project,f.visible,f.scene.eye,f.pick);
  assert.equal(f.panel.contacts().length,0);
});
test('main-body surfaces can join through a projected hole without an external panel',()=>{
  const f=fixture(0.3,0.3);f.panel.colors.fill(-1);
  f.board.cells.forEach((_,id)=>{const p=f.board.cellCenter(id);if(p[2]>0.5&&Math.abs(p[0])<0.6&&Math.abs(p[1])<0.6)f.board.color[id]=-1;});
  f.panel.updateProjection(f.project,f.visible,f.scene.eye,f.pick,true);
  const virtual=f.panel.contacts().filter(([a,b])=>a<f.board.size&&b<f.board.size&&!f.board.neighbors(a).includes(b));
  assert.ok(virtual.length>0);
  assert.ok(virtual.every(([a,b])=>a!==b&&f.board.color[a]>=0&&f.board.color[b]>=0));
});

test('all five fixed panels can form depth-visible seams at suitable viewpoints',()=>{
  const found=new Set();
  for(const pitch of [.65,-.65,1.1,-1.1])for(let step=0;step<16;step++) {
    const f=fixture(step*Math.PI/8,pitch,9,5);
    f.panel.updateProjection(f.project,f.visible,f.scene.eye,f.pick);
    for(const [a,b] of f.panel.contacts())if(a<f.board.size&&b>=f.board.size)found.add(Math.floor((b-f.board.size)/6));
    if(found.size===5)break;
  }
  assert.deepEqual([...found].sort(),[0,1,2,3,4]);
});

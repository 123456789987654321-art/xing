const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/board.js');require('../js/mechanics.js');
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function penetrates(a,A,b,B,p) {
  const axes=m=>[m.slice(0,3),m.slice(3,6),m.slice(6,9)],aa=axes(A),bb=axes(B),delta=a.map((v,i)=>v-b[i]);
  return [...aa,...bb,...aa.flatMap(u=>bb.map(v=>cross(u,v)))].filter(v=>Math.hypot(...v)>1e-8).every(v=>{
    const radius=p/2*[...aa,...bb].reduce((s,u)=>s+Math.abs(dot(u,v)),0);
    return Math.abs(dot(delta,v))<radius-1e-7;
  });
}
for(const n of [5,6,7,8,9])test(`${n}x${n} rotors have distinct grids and no intersecting cubes throughout orbit`,()=>{
  const b=new Board(n);b.color.fill(0);const r=new Rotor(b,()=>0,n-4),p=b.pitch;
  assert.equal(r.colors.length,6*(n-4));
  for(let step=0;step<48;step++) {
    r.angle=step*Math.PI/24;
    const boxes=Array.from(r.colors,(_,i)=>({c:r.center(i),m:r.basis(i)}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
      assert.equal(penetrates(boxes[i].c,boxes[i].m,boxes[j].c,boxes[j].m,p),false,`intersect ${i},${j} at step ${step}`);
    }
    if(step%12===0) {
      const contacts=r.contacts().filter(pair=>pair[0]<b.size);assert.equal(contacts.length,r.colors.length,'one host block per panel block');
      assert.equal(new Set(contacts.map(pair=>pair[0])).size,r.colors.length,'host cells must not be shared');
    }
  }
  for(let i=0;i<r.colors.length;i++)assert.ok(r.neighbors(i).every(j=>Math.floor(j/6)===Math.floor(i/6)));
});
test('fifth rotor visits +Y -Z -Y +Z faces and remains outside body during turns',()=>{
  const b=new Board(9),r=new Rotor(b,()=>0,5);b.color.fill(0);
  const expected=[[1,1],[2,-1],[1,-1],[2,1]],identity=[1,0,0,0,1,0,0,0,1];
  for(let step=0;step<48;step++) {
    r.angle=step*Math.PI/24;
    for(let i=24;i<30;i++) {
      if(step%12===0) {const [axis,sign]=expected[step/12];assert.ok(Math.abs(sign*r.center(i)[axis]-(b.h+b.pitch/2))<1e-8);}
      for(let id=0;id<b.size;id++)assert.equal(penetrates(r.center(i),r.basis(i),b.cellCenter(id),identity,b.pitch),false);
    }
  }
  r.angle=Math.PI/4;
  assert.equal(r.contacts().filter(([a,e])=>a<b.size&&e>=b.size+24).length,0,'a body edge against a plate face is not a shared face');
});
test('perspective panels are fixed and occupy distinct outside faces',()=>{
  for(const n of [5,6,7,8,9]) {
    const b=new Board(n),r=new PerspectivePanel(b,()=>0,n-4);
    assert.equal(r.colors.length,(n-4)*6);
    const sides=new Set();
    for(let k=0;k<n-4;k++) {
      const points=Array.from({length:6},(_,j)=>r.center(k*6+j));
      const center=[0,1,2].map(a=>points.reduce((s,p)=>s+p[a]/6,0));
      const axis=center.map(Math.abs).indexOf(Math.max(...center.map(Math.abs)));
      sides.add(axis+':'+Math.sign(center[axis]));
      assert.ok(points.every(p=>Math.abs(p[axis])-b.pitch/2>b.h));
    }
    assert.equal(sides.size,n-4);
    const before=Array.from(r.colors,(_,i)=>r.center(i));r.update(20);
    assert.deepEqual(Array.from(r.colors,(_,i)=>r.center(i)),before);
  }
});

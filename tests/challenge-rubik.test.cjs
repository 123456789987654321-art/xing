const test=require('node:test'),assert=require('node:assert/strict');
require('../js/challenge-geometry.js');
const W=require('../js/challenge-world.js');
const world=()=>new W(8,()=>.4);
test('Rubik has 1350 solid slots and 27 dark bodies',()=>{const w=world();assert.equal(w.cells.length,1350);assert.equal(w.decorations.length,27);assert.equal(w.phase,'play');assert.equal(w.rubik.faces.length,6);});
test('all slices rotate geometry, preserve identities, and invert without reroll',()=>{
 for(let axis=0;axis<3;axis++)for(let layer=-1;layer<=1;layer++){
  const w=world();w.cells.forEach((c,i)=>c.color=i%6);const before=w.cells.map(c=>c.color),homes=w.cells.map(c=>c.center.slice()),ids=w.cells.map(c=>c.id);
  assert.equal(w.action('turn',{axis,layer,direction:1}),true);assert.equal(w.canRemove(),false);assert.equal(w.action('turn',{axis,layer,direction:1}),false);
  w.update(.2);assert.ok(w.cells.some((c,i)=>c.center.some((v,k)=>Math.abs(v-homes[i][k])>1e-5)));assert.equal(w.score,0);assert.equal(w.remaining(),1350);
  w.update(1);assert.equal(w.rubik.turn,null);w.action('turn',{axis,layer,direction:-1});w.update(1);assert.deepEqual(w.cells.map(c=>c.color),before);assert.deepEqual(w.cells.map(c=>c.id),ids);assert.deepEqual(w.cells.map(c=>c.center),homes);
 }
});
test('gravity crosses macro seams but stops at face boundaries',()=>{const w=world();w.cells.forEach(c=>c.color=-1);const at=(f,r,c)=>w.cells.find(x=>x.rubikFace===f&&x.rubikRow===r&&x.rubikCol===c);at(0,2,3).color=1;at(0,6,3).color=2;globalThis.ChallengeRubik.settle(w);assert.equal(at(0,13,3).color,1);assert.equal(at(0,14,3).color,2);assert.equal(w.remaining(),2);assert.equal(w.moves.length,2);assert.ok(w.cells.filter(c=>c.color>=0).every(c=>c.rubikFace===0));});
test('legacy assembly actions cannot mutate Rubik',()=>{const w=world(),colors=w.cells.map(c=>c.color);for(const name of ['add','complete','undo','snap'])assert.equal(w.action(name,'box'),false);assert.deepEqual(w.cells.map(c=>c.color),colors);});
test('exact color and hole permutations followed by face gravity for every signed slice',()=>{
 const rotate=(p,a,s)=>a===0?[p[0],-s*p[2],s*p[1]]:a===1?[s*p[2],p[1],-s*p[0]]:[-s*p[1],s*p[0],p[2]];
 const key=p=>p.map(v=>Math.round(v*10000)).join(',');
 for(let axis=0;axis<3;axis++)for(let layer=-1;layer<=1;layer++)for(const direction of [-1,1]){
  let randomCalls=0;const w=new W(8,()=>{randomCalls++;return .4;});
  w.cells.forEach((c,i)=>c.color=i%11===0?-1:(i*17+Math.floor(i/7))%6);
  const before=w.cells.map(c=>c.color),expected=before.slice(),lookup=new Map(w.cells.map((c,i)=>[key(c.center),i]));
  for(const c of w.cells)if(c.cubie[axis]===layer)expected[lookup.get(key(rotate(c.center,axis,direction)))]=c.color;
  for(let f=0;f<6;f++)for(let col=0;col<15;col++){
   const values=[];for(let row=0;row<15;row++){const id=f*225+row*15+col;if(expected[id]>=0)values.push(expected[id]);expected[id]=-1;}
   values.forEach((color,i)=>expected[f*225+(15-values.length+i)*15+col]=color);
  }
  const count=w.remaining();w.action('turn',{axis,layer,direction});assert.equal(w.finish(),null);w.update(0);assert.equal(w.rubik.turn.elapsed,0);w.update(1);
  assert.deepEqual(w.cells.map(c=>c.color),expected);assert.equal(w.remaining(),count);assert.equal(w.score,0);assert.equal(randomCalls,1350);assert.equal(w.result,null);
 }
});
test('four turns restore full patterns on every slice and body geometry also moves',()=>{
 for(let axis=0;axis<3;axis++)for(let layer=-1;layer<=1;layer++){
  const w=world();w.cells.forEach((c,i)=>c.color=(i*17+Math.floor(i/7))%6);const before=w.cells.map(c=>c.color);
  for(let n=0;n<4;n++){w.action('turn',{axis,layer,direction:1});w.update(.2);assert.ok(w.decorations.filter(d=>d.cubie[axis]===layer).some(d=>d.basis.some((v,k)=>Math.abs(v-d.homeBasis[k])>1e-4)));w.update(1);}
  assert.deepEqual(w.cells.map(c=>c.color),before);assert.ok(w.decorations.every(d=>d.center.every((v,k)=>v===d.homeCenter[k])));
 }
});
test('matching contacts stop at grooves, while panel interior cubes share faces',()=>{
 const w=world(),pairs=w.contacts(),has=(a,b)=>pairs.some(p=>p.includes(a)&&p.includes(b));
 assert.equal(has(0,1),true);assert.equal(has(0,15),true);assert.equal(has(4,5),false);assert.equal(has(60,75),false);
 w.action('turn',{axis:1,layer:0,direction:1});assert.deepEqual(w.contacts(),[]);
});

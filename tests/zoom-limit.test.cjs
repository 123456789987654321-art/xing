const test=require('node:test'),assert=require('node:assert/strict');
require('../js/mathx.js');require('../js/scene.js');require('../js/challenge-geometry.js');require('../js/challenge-projection.js');require('../js/challenge-world.js');
test('maximum camera zoom keeps every challenge inside desktop and phone views after rotation',()=>{
 for(const aspect of [16/9,390/844])for(let level=1;level<=12;level++){
  const w=new ChallengeWorld(level,()=>.2);
  const cells=w.cells.concat(w.decorations),points=cells.flatMap(c=>ChallengeProjection.worldVertices(c));
  const lo=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),focus=lo.map((v,i)=>(v+hi[i])/2);
  for(const yaw of [0,.8,2.4]){
   const sc=Object.create(Scene.prototype);Object.assign(sc,{aspect,fov:Math.PI/4,dist:1,yaw,pitch:.4,time:0,shakeT:0});sc.updateCamera(0);
   sc.eye=sc.eye.map((v,i)=>v+focus[i]);sc.target=focus.map((v,i)=>v-sc.up[i]*.6);
   sc.constrainZoom(cells,focus);
   const back=MX.v3.norm(MX.v3.sub(sc.eye,sc.target)),right=MX.v3.norm(MX.v3.cross(sc.up,back)),up=MX.v3.cross(back,right);
   for(const p of points){const q=MX.v3.sub(p,sc.eye),depth=-MX.v3.dot(q,back);assert.ok(depth>.3);assert.ok(Math.abs(MX.v3.dot(q,right))/(depth*Math.tan(sc.fov/2)*aspect)<=.92001,`level${level} width`);assert.ok(Math.abs(MX.v3.dot(q,up))/(depth*Math.tan(sc.fov/2))<=.92001,`level${level} height`);}
  }
 }
});
test('normal box geometry shares the limit and already-safe distance is unchanged',()=>{
 const sc=Object.create(Scene.prototype);Object.assign(sc,{aspect:.5,fov:Math.PI/4,dist:1,yaw:.6,pitch:.4,time:0,shakeT:0,target:[0,0,0]});sc.updateCamera(0);
 const tiles=[{center:[0,0,0],basis:[1,0,0,0,1,0,0,0,1],size:[3,3,3]}];
 sc.constrainZoom(tiles);assert.ok(sc.dist>8);const distance=sc.dist;sc.constrainZoom(tiles);assert.equal(sc.dist,distance);
});

test('the complete slider range changes distance while preserving the safe closest view',()=>{
 for(const aspect of [.46,1.6])for(const yaw of [0,.8]){
 const sc=Object.create(Scene.prototype);Object.assign(sc,{aspect,fov:Math.PI/4,dist:20,yaw,pitch:.4,time:0,shakeT:0,target:[0,0,0]});sc.updateCamera(0);
 const tiles=[{center:[0,0,0],size:[4,4,4]}];let previous=Infinity;
 for(let step=0;step<=20;step++){sc.applyZoom(tiles,[0,0,0],.96,8,step/20);assert.ok(sc.dist<previous,`step ${step}`);previous=sc.dist;}
 const closest=sc.dist;sc.constrainZoom(tiles);assert.ok(Math.abs(sc.dist-closest)<.0001,'max slider already fits');
 }
});

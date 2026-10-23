/* Fixed surface slots: turns permute colors and holes, never regenerate them. */
(function(root){
 'use strict';
 const I=[1,0,0,0,1,0,0,0,1],STEP=.2,PITCH=1.12,SURFACE=1.76;
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const key=(n,p)=>n.concat(p).map(x=>Math.round(x*10000)).join(',');
 const rotate=(p,axis,angle)=>{const q=p.slice(),a=(axis+1)%3,b=(axis+2)%3,c=Math.cos(angle),s=Math.sin(angle);q[a]=p[a]*c-p[b]*s;q[b]=p[a]*s+p[b]*c;return q;};
 const cube=h=>({vertices:[[-h,-h,-h],[h,-h,-h],[h,h,-h],[-h,h,-h],[-h,-h,h],[h,-h,h],[h,h,h],[-h,h,h]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]});
 function build(w){
  const faces=[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0],[0,1,0],[0,-1,0]].map(n=>{const d=n[1]?[0,0,1]:[0,-1,0];return {n,d,r:cross(n,d),center:n.map(x=>x*SURFACE)};});
  const t=w.rubik={faces,size:15,step:STEP,pitch:PITCH,panelSize:1,surface:SURFACE,halfExtent:SURFACE+STEP/2,turn:null,slots:new Map(),grids:[],bodies:[]};
  w.phase='play';w.bounds=3.3;w.components.push({id:0,name:'魔方'});
  const coordinate=i=>(Math.floor(i/5)-1)*PITCH+(i%5-2)*STEP;
  for(let f=0;f<6;f++){
   const face=faces[f],grid=[];t.grids.push(grid);
   for(let row=0;row<15;row++)for(let col=0;col<15;col++){
    const center=face.n.map((v,k)=>v*SURFACE+face.d[k]*coordinate(row)+face.r[k]*coordinate(col));
    const cubie=face.n.map((v,k)=>v+face.d[k]*(Math.floor(row/5)-1)+face.r[k]*(Math.floor(col/5)-1));
    const c=w._cell(center,cube(STEP/2),0,{rubikFace:f,rubikRow:row,rubikCol:col,cubie,homeCenter:center.slice(),homeBasis:I.slice(),track:'fixed'});
    grid.push(c);t.slots.set(key(face.n,center),c);
   }
  }
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   const cubie=[x,y,z],center=cubie.map(v=>v*PITCH),d=w._box(center,[.54,.54,.54],[.035,.045,.065]);
   Object.assign(d,{cubie,homeCenter:center.slice(),homeBasis:I.slice()});t.bodies.push(d);
  }
 }
 function settle(w){
  w.moves=[];
  for(const grid of w.rubik.grids)for(let col=0;col<15;col++){
   let write=14;
   for(let row=14;row>=0;row--){const c=grid[row*15+col];if(c.color<0)continue;const dest=grid[write*15+col];
    if(dest!==c){dest.color=c.color;c.color=-1;w.moves.push({id:dest.id,from:c.homeCenter.slice(),to:dest.homeCenter.slice()});}write--;
   }
  }
  w.revision++;w._contactCache=null;return w.moves;
 }
 function turn(w,request){
  const {axis,layer,direction}=request||{},t=w.rubik;
  if(!t||t.turn||w.phase!=='play'||w.result||![0,1,2].includes(axis)||![-1,0,1].includes(layer)||![-1,1].includes(direction))return false;
  const cells=w.cells.filter(c=>c.cubie[axis]===layer),bodies=t.bodies.filter(c=>c.cubie[axis]===layer);
  const permutation=cells.map(c=>({source:c,dest:t.slots.get(key(rotate(t.faces[c.rubikFace].n,axis,direction*Math.PI/2),rotate(c.homeCenter,axis,direction*Math.PI/2))),color:c.color}));
  t.turn={axis,layer,direction,elapsed:0,duration:.48,cells,bodies,permutation};w.moves=[];return true;
 }
 function update(w,dt){
  const t=w.rubik.turn;if(!t||!(dt>0))return;
  t.elapsed=Math.min(t.duration,t.elapsed+dt);const progress=t.elapsed/t.duration,angle=t.direction*Math.PI/2*(progress*progress*(3-2*progress));
  for(const c of t.cells.concat(t.bodies)){c.center=rotate(c.homeCenter,t.axis,angle);c.basis=[0,1,2].flatMap(i=>rotate(I.slice(i*3,i*3+3),t.axis,angle));}
  w.revision++;w._contactCache=null;
  if(progress===1){
   for(const c of t.cells.concat(t.bodies)){c.center=c.homeCenter.slice();c.basis=c.homeBasis.slice();}
   for(const p of t.permutation)p.dest.color=p.color;
   w.rubik.turn=null;settle(w);
  }
 }
 function contacts(w){
  if(w.rubik.turn)return [];
  const pairs=[];
  for(const grid of w.rubik.grids)for(const c of grid){if(c.color<0)continue;const row=c.rubikRow,col=c.rubikCol;
   if(row%5<4){const other=grid[(row+1)*15+col];if(other.color>=0)pairs.push([c.id,other.id]);}
   if(col%5<4){const other=grid[row*15+col+1];if(other.color>=0)pairs.push([c.id,other.id]);}
  }return pairs;
 }
 function info(w){return w.rubik.turn?'魔方转动中，请稍候':'点击白色箭头转动整行或整列；小方块沿各面箭头下落，可跨越沟槽，在面边缘停止。';}
 const api={build,update,turn,settle,info,contacts};root.ChallengeRubik=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

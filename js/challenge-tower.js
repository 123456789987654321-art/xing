/* Level four: fixed-step, spatially indexed tower structure and rescue. */
(function(root){
 'use strict';
 const STEP=1/60,G=8,E=1e-7,S=.24,H=S/2,I=[1,0,0,0,1,0,0,0,1];
 const cube=h=>({vertices:[[-h[0],-h[1],-h[2]],[h[0],-h[1],-h[2]],[h[0],h[1],-h[2]],[-h[0],h[1],-h[2]],[-h[0],-h[1],h[2]],[h[0],-h[1],h[2]],[h[0],h[1],h[2]],[-h[0],h[1],h[2]]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]});
 const mul=(m,p)=>[m[0]*p[0]+m[3]*p[1]+m[6]*p[2],m[1]*p[0]+m[4]*p[1]+m[7]*p[2],m[2]*p[0]+m[5]*p[1]+m[8]*p[2]];
 const alive=c=>c&&c.color>=0;
 function bounds(c){const b=c.basis,h=c.towerHalf;const e=[0,1,2].map(i=>Math.abs(b[i])*h[0]+Math.abs(b[i+3])*h[1]+Math.abs(b[i+6])*h[2]);return {x:c.center[0],y:c.center[1],z:c.center[2],hx:e[0],hy:e[1],hz:e[2]};}
 // Each bucket is a vertical stack. Only intersecting X/Z buckets are queried.
 class Grid{
  constructor(){this.bins=new Map();}
  keys(b){const keys=[];for(let x=Math.floor((b.x-b.hx+E)/S);x<=Math.floor((b.x+b.hx-E)/S);x++)for(let z=Math.floor((b.z-b.hz+E)/S);z<=Math.floor((b.z+b.hz-E)/S);z++)keys.push(x+','+z);return keys;}
  add(c,reuse=false){if(!reuse||!c.towerBounds){c.towerBounds=bounds(c);c.towerBucketKeys=this.keys(c.towerBounds);}for(const k of c.towerBucketKeys){if(!this.bins.has(k))this.bins.set(k,[]);this.bins.get(k).push(c);}}
  query(b){const out=new Set();for(const k of this.keys(b))for(const c of this.bins.get(k)||[])out.add(c);return out;}
 }
 function surface(c,x,z){const b=c.basis,h=c.towerHalf,dx=x-c.center[0],dz=z-c.center[2],ny=b[4];if(ny<E)return null;const dy=(h[1]-b[3]*dx-b[5]*dz)/ny;const lx=b[0]*dx+b[1]*dy+b[2]*dz,lz=b[6]*dx+b[7]*dy+b[8]*dz;return Math.abs(lx)<=h[0]+E&&Math.abs(lz)<=h[2]+E?c.center[1]+dy:null;}
 function build(w){
  w.bounds=6;w.phase='play';w.target=500;
  const t=w.tower={groundY:-4.8,safeDrop:1.8,step:S,floors:[],floorSupports:[],levels:[],roofSupports:[],bodies:[],personVisuals:[],accumulator:0,settled:0,failure:null,structureDirty:true,dirtyLevel:6,grid:null};
  w.components.push({id:0,name:'高楼结构'});
  const block=(center,half,color,role,extra={})=>w._cell(center,cube(half),0,{color,immutable:color===6,track:'fixed',towerHalf:half.slice(),towerRole:role,towerVelocity:0,...extra});
  const floorColor=(level,row,x,z)=>(level+row+Math.floor(x/2)+Math.floor(z/3))%6;
  const ground=block([0,t.groundY-.18,0],[1.55,.18,1.65],6,'ground',{towerLevel:-1});t.groundId=ground.id;
  for(let k=0;k<6;k++){
   const bottom=t.groundY+k*7*S,baseY=bottom+4*S+H;
   const l={index:k,baseId:null,upperIds:[],columnIds:[],angle:0,axis:null,direction:0,velocity:0,originalY:baseY};
   for(let corner=0;corner<4;corner++){
    const ids=[],cx=(corner<2?-1:1)*2.5*S,cz=(corner%2?-1:1)*3*S;
    for(let row=0;row<4;row++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
      const below=k?floorColor(k-1,1,(corner<2?1:6)+x,(corner%2?1:7)+z):6;
      // Keep matching vertical pairs, but exclude both adjoining floor colors.
      const palette=[0,1,2,3,4,5].filter(color=>color!==k%6&&color!==below);
      const color=k%2===0&&corner===(k/2)%4?6:palette[(k+corner+Math.floor(row/2)+x+z+2)%palette.length];
      ids.push(block([cx+x*S,bottom+(row+.5)*S,cz+z*S],[H,H,H],color,'column',{towerLevel:k,towerCorner:corner,towerRow:row}).id);
    }
    l.columnIds.push(ids);
   }
   const base=block([0,baseY,0],[4*S,H,4.5*S],k%6,'floor-base',{towerLevel:k});l.baseId=base.id;
   for(let row=0;row<2;row++)for(let x=0;x<8;x++)for(let z=0;z<9;z++){
    const local=[(x-3.5)*S,(row+1)*S,(z-4)*S];l.upperIds.push(block([local[0],baseY+local[1],local[2]],[H,H,H],floorColor(k,row,x,z),'floor-cube',{towerLevel:k,towerLocal:local,towerAttached:true}).id);
   }
   t.levels.push(l);t.floors.push([l.baseId,...l.upperIds]);t.floorSupports.push(l.columnIds);
  }
  const top=t.levels[5],y=top.originalY+2.5*S;
  t.person={x:0,y,z:0,radius:.1,height:.86,velocity:0,fallStart:y,supportId:top.upperIds[72+3*9+4],alive:true};
  const part=(offset,half,rgb)=>{const before=w.decorations.length;w._box([offset[0],y+offset[1],offset[2]],half,rgb,1);const d=w.decorations[before];d.towerOffset=offset;t.personVisuals.push(d);};
  part([0,.43,0],[.14,.18,.1],[1,.7,.08]);part([0,.69,0],[.13,.11,.12],[1,.83,.65]);part([0,.82,0],[.15,.04,.14],[1,.93,.2]);
  for(const x of [-.085,.085])part([x,.125,0],[.055,.125,.08],[.18,.3,.45]);for(const x of [-.19,.19])part([x,.42,0],[.045,.16,.06],[1,.83,.65]);for(const x of [-.045,.045])part([x,.71,.125],[.015,.018,.01],[.08,.1,.15]);
  w.status='逐层拆除，让小人安全回到地面；同侧两根柱失去支撑会使楼板倾斜。';
 }
 function finish(w,why){if(w.result)return;const t=w.tower;t.failure=why;t.person.alive=!why;w.result=why?'lose':'win';w.phase='finished';if(!why)w.score+=500;w.status=why==='crush'?'坠落构件砸中了小人，请重试':why==='fall'?'落差太高，小人摔伤了，请逐层下降':'小人安全抵达地面！';}
 function land(w){const p=w.tower.person;if(p.fallStart-p.y>w.tower.safeDrop+E)finish(w,'fall');p.velocity=0;p.fallStart=p.y;}
 // Continuous separating-axis test for a vertical sweep between two oriented boxes.
 function sweep(a,b,delta,separate=false){
  const axes=[];for(let i=0;i<3;i++){axes.push(a.basis.slice(i*3,i*3+3));axes.push(b.basis.slice(i*3,i*3+3));}
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const u=a.basis.slice(i*3,i*3+3),v=b.basis.slice(j*3,j*3+3);axes.push([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);}
  let enter=0,exit=1;
  for(const n of axes){if(n.every(v=>Math.abs(v)<E))continue;let radius=0;for(const c of [a,b])for(let j=0;j<3;j++)radius+=c.towerHalf[j]*Math.abs(n[0]*c.basis[j*3]+n[1]*c.basis[j*3+1]+n[2]*c.basis[j*3+2]);
   const d=n.reduce((s,v,i)=>s+v*(a.center[i]-b.center[i]),0),v=delta*n[1];
   if(Math.abs(v)<E){if(Math.abs(d)>=radius-E)return null;continue;}
   const t1=(-radius-d)/v,t2=(radius-d)/v;enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));if(enter>exit+E)return null;
  }
  if(separate)return enter<E&&exit>E?exit:null;
  return enter<=1&&exit>=0?Math.max(0,enter):null;
 }
 function dropCube(c,grid){
  let b=bounds(c);const nearby=grid.query(b);
  // A rotating floor can lift its outer edge into the next storey's pillar.
  // Resolve that moving contact upwards before applying the downward sweep.
  for(const o of nearby){const q=o.towerBounds;
   if((c.basis[4]===1&&o.basis[4]===1)||o.center[1]>=c.center[1]||Math.abs(q.x-b.x)>=q.hx+b.hx-E||Math.abs(q.z-b.z)>=q.hz+b.hz-E||Math.abs(q.y-b.y)>=q.hy+b.hy-E)continue;
   const lift=sweep(c,o,1,true);if(lift!==null){c.center[1]+=lift;b=bounds(c);c.towerVelocity=0;}
  }
  c.towerVelocity-=G*STEP;const wanted=c.towerVelocity*STEP;let delta=wanted;
  for(const o of nearby){const q=o.towerBounds;if(Math.abs(q.x-b.x)>=q.hx+b.hx-E||Math.abs(q.z-b.z)>=q.hz+b.hz-E||q.y-q.hy>b.y+b.hy+E||q.y+q.hy<b.y-b.hy+wanted-E)continue;
   if(c.basis[4]===1&&o.basis[4]===1){const top=q.y+q.hy;if(top<=b.y-b.hy+E)delta=Math.max(delta,top-(b.y-b.hy));}
   else{const hit=sweep(c,o,wanted);if(hit!==null)delta=Math.max(delta,wanted*hit);}
  }
  c.center[1]+=delta;if(delta>wanted+E)c.towerVelocity=0;grid.add(c);
 }
 function basisFor(l,angle){const c=Math.cos(angle),s=Math.sin(angle)*l.direction;return l.axis==='x'?[c,s,0,-s,c,0,0,0,1]:[1,0,0,0,c,-s,0,s,c];}
 // Lowest non-penetrating center for a slab, considering the full footprint of each contact.
 function plateHeight(base,basis,grid){
  const trial={...base,basis},b=bounds(trial),nx=basis[3],ny=basis[4],nz=basis[5];let y=-Infinity;
  for(const o of grid.query(b)){const q=o.towerBounds,loX=Math.max(b.x-b.hx,q.x-q.hx),hiX=Math.min(b.x+b.hx,q.x+q.hx),loZ=Math.max(b.z-b.hz,q.z-q.hz),hiZ=Math.min(b.z+b.hz,q.z+q.hz);if(hiX-loX<E||hiZ-loZ<E)continue;
   // All inserted objects are lower-storey solids or this storey's columns.
   const x=nx>0?hiX:loX,z=nz>0?hiZ:loZ;
   y=Math.max(y,q.y+q.hy+(base.towerHalf[1]+nx*(x-base.center[0])+nz*(z-base.center[2]))/ny);
  }
  return y;
 }
 function step(w){
  const t=w.tower,p=t.person,byId=t.byId||(t.byId=new Map(w.cells.map(c=>[c.id,c]))),grid=t.structureDirty||!t.grid?new Grid():t.grid;
  const oldY=p.y,oldHead=p.y+p.height,oldSupport=byId.get(p.supportId),oldSurface=alive(oldSupport)?surface(oldSupport,p.x,p.z):null;
  const oldBottom=new Map();if(t.structureDirty)for(const c of w.cells)if(alive(c)&&c.towerLevel>=(t.dirtyLevel||0)){const b=c.towerBounds||bounds(c);oldBottom.set(c.id,b.y-b.hy);}
  let moved=false;if(t.structureDirty){grid.add(byId.get(t.groundId));
  for(const l of t.levels){
   const base=byId.get(l.baseId);
   if(l.index<(t.dirtyLevel||0)){
    for(const id of [...l.columnIds.flat(),l.baseId,...l.upperIds]){const c=byId.get(id);if(alive(c))grid.add(c,true);}
    continue;
   }
   // A broken vertical stack settles from its lowest cube upwards, including gray pieces.
   const columns=l.columnIds.flat().map(id=>byId.get(id)).filter(alive).sort((a,b)=>a.center[1]-b.center[1]);
   for(const c of columns){const y=c.center[1];dropCube(c,grid);if(Math.abs(y-c.center[1])>E)moved=true;}
   if(alive(base)){
    const old=base.center[1],previousAngle=l.angle;
    if(!columns.length){l.axis=null;l.angle=0;base.basis=I.slice();}
    if(!l.axis){const contacts=l.columnIds.map(ids=>ids.some(id=>{const c=byId.get(id);return alive(c)&&Math.abs(c.center[1]+H-(old-H))<.002;}));const lost=contacts.map((v,i)=>v?-1:i).filter(i=>i>=0);
     const pair=lost.flatMap((a,i)=>lost.slice(i+1).map(b=>[a,b])).find(([a,b])=>(a<2)===(b<2)||a%2===b%2);
     if(pair&&lost.length<4){l.axis=(pair[0]<2)===(pair[1]<2)?'x':'z';l.direction=l.axis==='x'?(pair[0]<2?1:-1):(pair[0]%2?-1:1);}
    }
    if(l.axis){const candidate=Math.min(.48,l.angle+.8*STEP),basis=basisFor(l,candidate),required=plateHeight(base,basis,grid),currentRequired=plateHeight(base,base.basis,grid);
     // Rotate around the surviving edge until another stump or floor arrests descent.
     if(required<=currentRequired+E){l.angle=candidate;base.basis=basis;}
    }
    const floor=plateHeight(base,base.basis,grid);l.velocity-=G*STEP;const wanted=old+l.velocity*STEP;base.center[1]=Math.max(wanted,floor);if(base.center[1]>wanted+E)l.velocity=0;
    base.towerVelocity=l.velocity;if(Math.abs(old-base.center[1])>E||l.angle!==previousAngle)moved=true;grid.add(base);
    for(let i=0;i<l.upperIds.length;i++){const c=byId.get(l.upperIds[i]);if(!alive(c))continue;
     if(i>=72&&!alive(byId.get(l.upperIds[i-72])))c.towerAttached=false;
     if(c.towerAttached){const d=mul(base.basis,c.towerLocal);c.center=d.map((v,j)=>v+base.center[j]);c.basis=base.basis.slice();c.towerVelocity=l.velocity;grid.add(c);}
     else{const y=c.center[1];dropCube(c,grid);if(Math.abs(c.center[1]-y)>E)moved=true;}
    }
   }else{
    const free=l.upperIds.map(id=>byId.get(id)).filter(alive).sort((a,b)=>a.center[1]-b.center[1]);
    for(const c of free){c.towerAttached=false;const y=c.center[1];dropCube(c,grid);if(Math.abs(y-c.center[1])>E)moved=true;}
   }
  }
  t.grid=grid;t.structureDirty=moved;} let carried=false;
  if(alive(oldSupport)&&oldSurface!==null&&Math.abs(oldSurface-oldY)<1e-5){const y=surface(oldSupport,p.x,p.z);if(y!==null){p.y=y;p.velocity=(y-oldY)/STEP;p.supportId=oldSupport.id;carried=true;if(Math.abs(p.velocity)<E)land(w);}}
  if(!carried){p.supportId=null;p.velocity-=G*STEP;let next=p.y+p.velocity*STEP,landing=null;for(const c of grid.query({x:p.x,z:p.z,hx:p.radius,hz:p.radius})){const y=surface(c,p.x,p.z);if(y!==null&&y<=oldY+E&&y>=next-E){next=y;landing=c;}}p.y=next;if(landing){p.supportId=landing.id;land(w);}}
  for(const c of grid.query({x:p.x,z:p.z,hx:p.radius,hz:p.radius})){if(c.id===p.supportId)continue;const b=c.towerBounds;if(oldBottom.get(c.id)>=oldHead-E&&b.y-b.hy<p.y+p.height-E&&b.y-b.hy<oldBottom.get(c.id)-E){finish(w,'crush');break;}}
  if(p.y<t.groundY-E)finish(w,'fall');
  if(!w.result&&Math.abs(p.y-t.groundY)<E){t.settled+=STEP;if(t.settled>=.2)finish(w,null);}else t.settled=0;
  if(moved){w.revision++;w._contactCache=null;}
  // Rotate the whole figure around its feet, using the surface it stands on.
  const support=byId.get(p.supportId),pose=alive(support)?support.basis:I;
  for(const d of t.personVisuals){const offset=mul(pose,d.towerOffset);d.basis=pose.slice();d.center=[p.x+offset[0],p.y+offset[1],p.z+offset[2]];}
  if(!w.result)w.status='距地面 '+Math.max(0,p.y-t.groundY).toFixed(1)+' 米 · 单次安全落差 ≤ '+t.safeDrop+' 米';
 }
 function update(w,dt){if(!w.tower||w.result||!(dt>0))return;w.tower.accumulator+=dt;while(w.tower.accumulator>=STEP-1e-10&&!w.result){w.tower.accumulator-=STEP;step(w);}}
 function afterRemove(w,ids){if(!ids.length||!w.tower||w.result)return;const t=w.tower,level=Math.min(...ids.map(id=>w.cells.find(c=>c.id===id)?.towerLevel??0));t.dirtyLevel=t.structureDirty?Math.min(t.dirtyLevel??0,level):level;t.settled=0;t.structureDirty=true;w.status='支撑已改变，注意楼板倾斜、小人的落点与头顶构件';}
 function info(){return '六层高楼，每层上方两层小方块可分别拆除，底部整块楼板为单色承重板。每层四角各有 3×3×4 方柱，灰柱不能拆。同侧两角失去支撑时楼板倾斜；一角失去支撑仍保持水平。拆除整块底板会让上方方块和小人立即下落。逐层救援，安全到达地面获得 500 分。';}
 root.ChallengeTower={build,update,afterRemove,info};if(typeof module!=='undefined'&&module.exports)module.exports=root.ChallengeTower;
})(typeof globalThis!=='undefined'?globalThis:this);

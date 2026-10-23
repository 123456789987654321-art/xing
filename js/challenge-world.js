/* Independent untimed challenge rules. Cell centers are world-space; vertices are local. */
(function(root){
  'use strict';
  if(typeof module!=='undefined'&&module.exports&&!root.ChallengeTower)require('./challenge-tower.js');
  if(typeof module!=='undefined'&&module.exports&&!root.ChallengeRubik)require('./challenge-rubik.js');
  const PALETTE=[[.97,.24,.32],[.64,.34,.99],[.20,.85,.50],[.22,.58,1],[1,.80,.22],[1,.44,.79]];
  const I=[1,0,0,0,1,0,0,0,1], shapes=['tetrahedron','cylinder','sphere','prism','frustum','torus'];
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const mul=(m,p)=>[m[0]*p[0]+m[3]*p[1]+m[6]*p[2],m[1]*p[0]+m[4]*p[1]+m[7]*p[2],m[2]*p[0]+m[5]*p[1]+m[8]*p[2]];
  function rotation(axis,a){
    const c=Math.cos(a),s=Math.sin(a);
    return axis==='x'?[1,0,0,0,c,s,0,-s,c]:axis==='y'?[c,0,-s,0,1,0,s,0,c]:[c,s,0,-s,c,0,0,0,1];
  }
  function cube(x,y,z){
    return {
      vertices:[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
    };
  }
  class ChallengeWorld{
    constructor(level,rng=Math.random){
      this.level=Math.max(1,Math.min(12,level));
      this.rng=rng;
      this.cells=[];
      this.decorations=[];
      this.components=[];
      this.moves=[];
      this.phase='play';
      this.score=0;
      this.result=null;
      this.status='';
      this.bounds=3;
      this.time=0;
      this.nextId=0;
      this.revision=0;
      this.aimPlaneZ=.1;
      this.aim={
        x:-1.4,y:0
      };
      this.trajectory=[];
      this.history=[];
      this._build();
      this.target=level===12?1500:null;
    }
    _cell(center,poly,component,extra={
    }){
      const c={
        id:this.nextId++,center:center.slice(),poly,basis:I.slice(),color:this.phase==='assemble'?6:Math.floor(this.rng()*6),component,track:'fixed',order:0,...extra
      };
      c.volume=Math.abs(poly.faces.reduce((sum,f)=>{
        const a=poly.vertices[f[0]];
        for(let i=1; i<f.length-1; i++){
          const b=poly.vertices[f[i]],d=poly.vertices[f[i+1]];
          sum+=(a[0]*(b[1]*d[2]-b[2]*d[1])+a[1]*(b[2]*d[0]-b[0]*d[2])+a[2]*(b[0]*d[1]-b[1]*d[0]))/6;
        }
        return sum;
      },0));
      this.cells.push(c);
      return c;
    }
    _shape(name,size=2,position=[0,0,0],basis=I,extra={
    }){
      const id=this.components.length?Math.max(...this.components.map(c=>c.id))+1:0;
      const component={
        id,name,position:position.slice(),basis:basis.slice()
      };
      this.components.push(component);
      const G=root.ChallengeGeometry;
      for(const slot of G.make(name,{
        size,resolution:[8,9,11].includes(this.level)?4:7,smooth:this.level<=8,quadFaces:[1,3,6].includes(this.level),joinedRing:extra.joinedRing
      })){
        const c=this._cell(add(position,mul(basis,slot.center)),slot.poly,id,{
          ...slot,...extra
        });
        c.center=add(position,mul(basis,slot.center));
        c.local=slot.center.slice();
        c.basis=basis.slice();
        c.track=id+':'+slot.track;
      }
      return id;
    }
    _box(center,half,rgb,alpha=1){
      const d={
        center:center.slice(),poly:cube(...half),basis:I.slice(),rgb,alpha
      };
      this.decorations.push(d);
      return d;
    }
    _decoShape(name,size,position,rgb,alpha=1){
      const out=[];
      for(const c of root.ChallengeGeometry.make(name,{
        size,resolution:2
      })){
        const d={
          center:add(position,c.center),local:c.center.slice(),poly:c.poly,basis:I.slice(),rgb,alpha
        };
        this.decorations.push(d);
        out.push(d);
      }
      return out;
    }
    _build(){
      const n=this.level;
      if([1,2,3,5,6].includes(n)){
        this._shape(({
          1:'tetrahedron',2:'cylinder',3:'sphere',5:'prism',6:'frustum'
        })[n]);
      }
      if(n===7){
        this._shape('torus',2.4,[0,0,0],I,{joinedRing:'full'});
        this._shape('torus',2.4,[0,0,0],rotation('x',Math.PI/2),{joinedRing:'cross'});
        this.bounds=3.1;
      }
      if(n===8){
        root.ChallengeRubik.build(this);
      }
      if(n===4)root.ChallengeTower.build(this);
      if(n===9)this._gearsBuild();
      if(n===10)this._targetBuild();
      if(n===11){
        this.seesaw={
          angle:0,left:3.09,right:3.09,groupPositions:{left:-3.09,right:3.09},leftCount:0,rightCount:0,balanced:true,multiplier:1.2,imbalanceTime:0,moving:false
        };
        for(const side of ['left','right'])for(let j=0; j<3; j++)this._shape(['box','cylinder','prism'][j],.55,[this.seesaw.groupPositions[side],j*1.1+.55,0],I,{
          side
        });
        this.beam=this._box([0,-.12,0],[3.8,.12,.8],[.38,.48,.58]);
        this._box([0,-.65,0],[.25,.4,.5],[.38,.48,.58]);
        this.barriers=[this._box([-3.72,.175,0],[.08,.175,.8],[.46,.59,.71]),this._box([3.72,.175,0],[.08,.175,.8],[.46,.59,.71])];
        this.bounds=4.6;
        this._seesawState(0);
      }
      if(n===12)this._marbleBuild();
    }
    remaining(){
      return this.cells.reduce((n,c)=>n+(c.color>=0&&c.color<6),0);
    }
    canRemove(){
      return this.phase==='play'&&!this.result&&!(this.gears&&this.gears.moving)&&!(this.rubik&&this.rubik.turn);
    }
    canRemoveCell(id){
      const c=this.cells.find(c=>c.id===id);
      return !!c&&!c.immutable&&this.canRemove();
    }
    remove(ids){
      this.moves=[];
      if(!this.canRemove())return [];
      if(this.seesaw)this._seesawState(0);
      const scoreMultiplier=this.seesaw?this.seesaw.multiplier:1;
      const removed=[];
      for(const id of new Set(ids)){
        const c=this.cells.find(c=>c.id===id);
        if(c&&c.color>=0&&c.color<6&&this.canRemoveCell(id)){
          c.color=-1;
          removed.push(id);
        }
      }
      if(!removed.length)return removed;
      this.score+=Math.round(5*removed.length*removed.length*scoreMultiplier);
      if(this.seesaw)this.lastMultiplier=scoreMultiplier;
      if(this.rubik)root.ChallengeRubik.settle(this);
      if(this.level!==12&&this.level!==4&&!this.rubik){
        const tracks=new Map();
        for(const c of this.cells){
          if(c.track==='fixed')continue;
          if(!tracks.has(c.track))tracks.set(c.track,[]);
          tracks.get(c.track).push(c);
        }
        for(const track of tracks.values()){
          track.sort((a,b)=>a.order-b.order);
          const live=track.filter(c=>c.color>=0).map(c=>({
            color:c.color,center:c.center.slice(),id:c.id
          }));
          track.forEach(c=>c.color=-1);
          live.forEach((v,i)=>{
            track[i].color=v.color;
            if(v.id!==track[i].id)this.moves.push({
              id:track[i].id,from:v.center,to:track[i].center.slice()
            });
          });
        }
      }
      this.revision++;
      this._contactCache=null;
      if(this.level===4)root.ChallengeTower.afterRemove(this,removed);
      if(this.seesaw)this._seesawUpdate(0);
      return removed;
    }
    _vertices(c){
      return c.poly.vertices.map(v=>add(c.center,mul(c.basis||I,v)));
    }
    contacts(){
      if(this.rubik&&this.cells.length===1350&&this.cells[0].rubikFace===0)return root.ChallengeRubik.contacts(this);
      if(this._contactCache&&this._contactRevision===this.revision)return this._contactCache;
      const vertices=new Map(),pairs=new Map();
      for(const c of this.cells){
        if(c.color<0)continue;
        for(const v of this._vertices(c)){
          const key=v.map(x=>Math.round(x*10000)).join(',');
          const entries=vertices.get(key)||[];
          for(const id of entries){
            if(id===c.id)continue;
            const k=id<c.id?id+':'+c.id:c.id+':'+id;
            const shared=pairs.get(k)||[];
            if(!shared.some(p=>p.every((x,i)=>Math.abs(x-v[i])<1e-6)))shared.push(v);
            pairs.set(k,shared);
          }
          entries.push(c.id);
          vertices.set(key,entries);
        }
      }
      // A corner on the visible shell can extend into a whole internal edge.
      // Require an area, rather than counting that edge as a neighboring tile.
      this._contactCache=[...pairs].filter(([,points])=>points.length>=3&&points.slice(2).some(p=>{
        const a=points[1].map((v,i)=>v-points[0][i]),b=p.map((v,i)=>v-points[0][i]);
        return Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])>1e-8;
      })).map(p=>p[0].split(':').map(Number));
      const keys=new Set(this._contactCache.map(p=>p.join(':')));
      for(const pair of this._faceContacts()){
        const key=pair.join(':');
        if(!keys.has(key)){
          this._contactCache.push(pair);
          keys.add(key);
        }
      }
      this._contactRevision=this.revision;
      return this._contactCache;
    }
    _faceContacts(){
      const bucket=new Map(),data=new Map(),candidates=new Set(),result=[];
      for(const c of this.cells){
        if(c.color<0)continue;
        const v=this._vertices(c),lo=[0,1,2].map(i=>Math.min(...v.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...v.map(p=>p[i])));
        data.set(c.id,{
          c,v,lo,hi
        });
        for(let x=Math.floor((lo[0]-.001)/.5); x<=Math.floor((hi[0]+.001)/.5); x++)for(let y=Math.floor((lo[1]-.001)/.5); y<=Math.floor((hi[1]+.001)/.5); y++)for(let z=Math.floor((lo[2]-.001)/.5); z<=Math.floor((hi[2]+.001)/.5); z++){
          const key=[x,y,z].join(','),list=bucket.get(key)||[];
          for(const id of list)if(data.get(id).c.component!==c.component||this.level===12||c.clipped||data.get(id).c.clipped||c.attached||data.get(id).c.attached)candidates.add(id+':'+c.id);
          list.push(c.id);
          bucket.set(key,list);
        }
      }
      const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const faceData=d=>d.faces||(d.faces=d.c.poly.faces.map(f=>{
        const p=f.map(i=>d.v[i]);
        let n=cross(sub(p[1],p[0]),sub(p[2],p[0])),len=Math.hypot(...n);
        if(len<1e-10)return null;
        n=n.map(v=>v/len);
        return {
          p,n
        };
      }).filter(Boolean));
      const overlap=(a,b,n)=>{
        const drop=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),axes=[0,1,2].filter(i=>i!==drop),A=a.map(p=>axes.map(i=>p[i])),B=b.map(p=>axes.map(i=>p[i]));
        for(const poly of [A,B])for(let i=0; i<poly.length; i++){
          const p=poly[i],q=poly[(i+1)%poly.length],axis=[p[1]-q[1],q[0]-p[0]],len=Math.hypot(...axis);
          if(len<1e-9)continue;
          const pa=A.map(p=>dot(p,axis)),pb=B.map(p=>dot(p,axis));
          if(Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb))<1e-7*len)return false;
        }
        return true;
      };
      for(const key of candidates){
        const [i,j]=key.split(':').map(Number),a=data.get(i),b=data.get(j);
        if([0,1,2].some(k=>a.hi[k]<b.lo[k]-1e-6||b.hi[k]<a.lo[k]-1e-6))continue;
        let touching=false;
        for(const f of faceData(a)){
          for(const g of faceData(b)){
            if(dot(f.n,g.n)>-.99999||Math.abs(dot(f.n,sub(g.p[0],f.p[0])))>1e-5)continue;
            if(overlap(f.p,g.p,f.n)){
              touching=true;
              break;
            }
          }
          if(touching)break;
        }
        // Only meshing gear teeth use edge-to-flank contact. Cube blocks,
        // including separate assembled parts, must share a face area.
        if(!touching&&this.level===9){
          for(const [source,dest] of [[a,b],[b,a]]){
            for(const f of faceData(source)){
              for(let k=0; k<f.p.length; k++){
                const p=f.p[k],q=f.p[(k+1)%f.p.length];
                if(Math.hypot(...sub(p,q))<1e-5)continue;
                for(const g of faceData(dest)){
                  if(Math.abs(dot(g.n,sub(p,g.p[0])))>1e-6||Math.abs(dot(g.n,sub(q,g.p[0])))>1e-6)continue;
                  const midpoint=p.map((v,k)=>(v+q[k])/2);
                  const inside=point=>g.p.every((v,k)=>dot(cross(sub(g.p[(k+1)%g.p.length],v),sub(point,v)),g.n)>=-1e-7);
                  if(inside(midpoint)&& (inside(p)||inside(q))){
                    touching=true;
                    break;
                  }
                }
                if(touching)break;
              }
              if(touching)break;
            }
            if(touching)break;
          }
        }
        if(touching)result.push([i,j]);
      }
      return result;
    }
    _transform(comp,position,basis){
      if(comp.position&&comp.basis&&position.every((v,i)=>Math.abs(v-comp.position[i])<1e-8)&&basis.every((v,i)=>Math.abs(v-comp.basis[i])<1e-8))return;
      comp.position=position.slice();
      comp.basis=basis.slice();
      for(const c of this.cells.filter(c=>c.component===comp.id)){
        c.center=add(position,mul(basis,c.local));
        c.basis=basis.slice();
      }
      this.revision++;
    }
    _snapshot(){
      this.history.push({
        assemblyPending:!!this.assemblyPending,selected:this.selected,
        components:this.components.map(c=>({
          ...c,position:c.position.slice(),basis:c.basis.slice()
        })),cells:this.cells.map(c=>({
          ...c,center:c.center.slice(),basis:c.basis.slice()
        }))
      });
    }
    action(name,value){
      if(this.result)return '本关已结束';
      if(this.level===8)return name==='turn'?root.ChallengeRubik.turn(this,value):false;
      if((name==='aim'||name==='throw-aim')&&this.level===10&&this.phase==='aim'){
        const x=Number(value.x)||0,y=Number(value.y)||0;
        if(name==='throw-aim'){
          const pull=(value.pull||[0,0,0]).map(v=>Number(v)||0),length=Math.hypot(...pull);
          this.throwPower=Math.min(1,length/1.05);
          this.aim={x:-pull[0]*4,y:-1.7-pull[1]*4};
          const view=value.view||[0,0,1],viewLength=Math.hypot(...view)||1,forward=view.map(v=>v/viewLength);
          // Keep aiming in the drag plane, but draw the pouch toward the eye.
          // The ray to the eye preserves its screen position under perspective.
          let depth=.8*length;
          if(forward[2]>.2)depth=Math.max(depth,-pull[2]/forward[2]);
          this.sling.pull=pull.map((v,i)=>v+forward[i]*depth);
        }else {this.sling.pull=[0,0,0];this.aim={x,y};}
        this._preview();
        return '已更新落点';
      }
      if(name==='shoot'&&this.phase==='aim'&&!this.projectile&&this.ammo.length){
        const color=this.ammo.shift();
        this.projectile={
          time:0,color,start:this.launch.start.slice(),velocity:this.launch.velocity.slice(),gravity:this.launch.gravity,path:this.trajectory.map(p=>p.slice()),hit:{
            ...this.previewHit
          }
        };
        this.sling.pull=[0,0,0];this._slingVisual();
        return '投射中';
      }
      if(name==='shift'&&this.level===11){
        const side=value.side==='right'?'right':'left';
        const positions=this.seesaw.groupPositions,delta=Number(value.delta)||0;
        positions[side]=side==='left'?Math.max(-3.09,Math.min(positions.right-1.1,positions.left+delta)):Math.min(3.09,Math.max(positions.left+1.1,positions.right+delta));
        this._seesawUpdate(0);
        return '已移动集合体';
      }
      if(name==='marble-aim'&&this.level===12){
        if(this.marble.released||!Number.isFinite(value))return false;
        this.marble.aimAngle=Math.max(-this.marble.maxAimAngle,Math.min(this.marble.maxAimAngle,value));
        this._marbleLauncher();return true;
      }
      if(name==='release'&&this.level===12&&!this.marble.released&&this.marble.drops<this.marble.totalDrops){
        this.marble.released=true;
        this.marble.velocity=[Math.sin(this.marble.aimAngle)*3,-Math.cos(this.marble.aimAngle)*3,0];
        return '弹珠已释放';
      }
      return '当前阶段无法执行';
    }
    _assembly(name,value){
      if(name==='add'){
        const shape=typeof value==='string'?value:value.shape;
        if(!shapes.includes(shape)&&shape!=='box')return '未知零件';
        if(this.components.some(c=>c.name===shape)&&shape!=='box')return '每种零件限用一个';
        this._snapshot();
        let x=0;
        if(this.components.length){
          const vs=this.cells.flatMap(c=>this._vertices(c));
          x=Math.max(...vs.map(v=>v[0]))+1;
        }
        this.selected=this._shape(shape,1,[x,0,0]);
        if(this.components.length>1){
          const comp=this.components.find(c=>c.id===this.selected),own=this.cells.filter(c=>c.component===comp.id).flatMap(c=>this._vertices(c)),previous=this.cells.filter(c=>c.component!==comp.id).flatMap(c=>this._vertices(c));
          const shift=Math.max(...previous.map(v=>v[0]))-Math.min(...own.map(v=>v[0]));
          this._transform(comp,[comp.position[0]+shift,0,0],comp.basis);
          this._snap(comp,this.components[this.components.length-2]);
        }
        this.bounds=Math.max(4,x+2);
        return '已添加零件，可移动旋转';
      }
      if(name==='select'){
        this.selected=Number(value);
        return '已选择零件';
      }
      if(name==='reset'){
        this._snapshot();
        this.cells=[];
        this.components=[];
        this.selected=null;this.assemblyPending=false;this.revision++;this._contactCache=null;
        return '已重置';
      }
      if(name==='undo'){
        const old=this.history.pop();
        if(!old)return '没有可撤销操作';
        this.cells=old.cells;
        this.components=old.components;
        this.selected=old.selected;this.assemblyPending=!!old.assemblyPending;
        this.revision++;this._contactCache=null;
        for(const c of this.components)this._transform(c,c.position,c.basis);
        return '已撤销';
      }
      const comp=this.components.find(c=>c.id===this.selected);
      if(name==='snap'&&comp){
        const target=this.components.find(c=>c.id!==comp.id&&(value===undefined||c.id===Number(value)))||this.components.find(c=>c.id!==comp.id);
        if(!target)return '请先添加另一个零件';
        this._snapshot();
        this._snap(comp,target);
        return '已吸附至相邻零件';
      }
      if(name==='remove-component'&&comp){
        this._snapshot();
        this.cells=this.cells.filter(c=>c.component!==comp.id);
        this.components=this.components.filter(c=>c!==comp);
        this.selected=this.components.at(-1)?.id??null;
        this.revision++;this._contactCache=null;
        return '已移除零件';
      }
      if((name==='translate'||name==='rotate')&&comp){
        this._snapshot();
        const axis=value.axis||'x';
        if(name==='translate'){
          const pos=comp.position.slice();
          pos['xyz'.indexOf(axis)]+=Number(value.delta)||0;
          this._transform(comp,pos,comp.basis);
        }
        else{
          const r=rotation(axis,Number(value.angle)||0),b=[];
          for(let i=0; i<3; i++)b.push(...mul(r,comp.basis.slice(i*3,i*3+3)));
          this._transform(comp,comp.position,b);
        }
        return '已调整零件';
      }
      if(name==='complete'){
        if(this.assemblyPending)return '请先确认当前零件的摆放';
        if(this.components.length<2)return '至少添加两个零件';
        const validity=this._assemblyValid();
        if(validity)return validity;
        const byId=new Map(this.cells.map(c=>[c.id,c.component])),linked=new Map(this.components.map(c=>[c.id,[]]));
        for(const [a,b] of this.contacts()){
          const first=byId.get(a),second=byId.get(b);
          if(first===second)continue;
          linked.get(first).push(second);linked.get(second).push(first);
        }
        const connected=new Set(),queue=[this.components[0].id];
        for(let i=0;i<queue.length;i++){
          const id=queue[i];if(connected.has(id))continue;
          connected.add(id);queue.push(...linked.get(id).filter(next=>!connected.has(next)));
        }
        if(connected.size!==this.components.length)return '零件必须以实际接触面连成整体，不能只碰到边角';
        for(const c of this.cells)c.color=Math.floor(this.rng()*6);
        this.phase='play';
        this.target=Math.max(100,Math.round(this.cells.length*3/50)*50);
        this.revision++;
        return '拼接完成，开始消除';
      }
      return '选择零件后操作';
    }
    _snap(comp,target){
      // Adding an already-aligned part can leave its transform unchanged, but
      // still changes the set of contact candidates.
      this.revision++;this._contactCache=null;
      const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const supports=component=>{
        const cells=this.cells.filter(c=>c.component===component.id),vertices=cells.flatMap(c=>this._vertices(c)),faces=[];
        for(const cell of cells){const verts=this._vertices(cell);
          for(const face of cell.poly.faces){
            const points=face.map(i=>verts[i]),raw=cross(sub(points[1],points[0]),sub(points[2],points[0])),length=Math.hypot(...raw);
            if(length<1e-8)continue;
            const normal=raw.map(v=>v/length),d=dot(normal,points[0]);
            if(vertices.some(v=>dot(normal,v)>d+1e-7))continue;
            const center=[0,1,2].map(axis=>points.reduce((n,v)=>n+v[axis],0)/points.length);
            faces.push({normal,center,area:length});
          }
        }
        return faces;
      };
      const sourceFaces=supports(comp).sort((a,b)=>b.area-a.area),destinationFaces=supports(target).sort((a,b)=>b.normal[0]-a.normal[0]||b.area-a.area);
      const startPosition=comp.position.slice(),startBasis=comp.basis.slice();
      for(const b of destinationFaces)for(const a of sourceFaces){
        const to=b.normal.map(v=>-v),axis=cross(a.normal,to),cos=Math.max(-1,Math.min(1,dot(a.normal,to))),sin=Math.hypot(...axis);
        let rotate;
        if(sin>1e-8){const n=axis.map(v=>v/sin);rotate=v=>add(add(v.map(x=>x*cos),cross(n,v).map(x=>x*sin)),n.map(x=>x*dot(n,v)*(1-cos)));}
        else if(cos>0)rotate=v=>v.slice();
        else {let n=cross(a.normal,Math.abs(a.normal[0])<.8?[1,0,0]:[0,1,0]);const length=Math.hypot(...n);n=n.map(v=>v/length);rotate=v=>n.map((x,i)=>2*x*dot(n,v)-v[i]);}
        const nextBasis=[0,3,6].flatMap(i=>rotate(startBasis.slice(i,i+3))),offset=rotate(sub(a.center,startPosition));
        this._transform(comp,sub(b.center,offset),nextBasis);
        if(!this._assemblyValid().includes('穿透'))return;
      }
      this._transform(comp,startPosition,startBasis);
      const all=this.components;
      const own=this.cells.filter(c=>c.component===comp.id).flatMap(c=>this._vertices(c)),other=this.cells.filter(c=>c.component===target.id).flatMap(c=>this._vertices(c));
      const ownMin=Math.min(...own.map(v=>v[0])),otherMax=Math.max(...other.map(v=>v[0]));
      // Axis-aligned support faces can meet exactly in one translation. Align
      // actual face centers, since a stepped outline's extreme face need not
      // lie at its component center (a center-only snap can touch just a corner).
      const support=(component,x)=>{
        const faces=[];
        for(const c of this.cells)if(c.component===component.id){
          const vertices=this._vertices(c);
          for(const face of c.poly.faces){
            const points=face.map(i=>vertices[i]);
            if(!points.every(p=>Math.abs(p[0]-x)<1e-7))continue;
            const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[1]*q[2]-q[1]*p[2];},0))/2;
            if(area>1e-8)faces.push([x,points.reduce((n,p)=>n+p[1],0)/points.length,points.reduce((n,p)=>n+p[2],0)/points.length]);
          }
        }
        return faces;
      };
      const ownFaces=support(comp,ownMin),targetFaces=support(target,otherMax);
      let best=null,distance=Infinity;
      for(const a of ownFaces)for(const b of targetFaces){
        const d=(a[1]-b[1])**2+(a[2]-b[2])**2;
        if(d<distance){distance=d;best=[otherMax-ownMin,b[1]-a[1],b[2]-a[2]];}
      }
      if(best){
        const position=comp.position.slice(),basis=comp.basis.slice();
        this._transform(comp,add(position,best),basis);
        // Other existing parts must remain disjoint, not only this target.
        if(!this._assemblyValid().includes('穿透'))return;
        this._transform(comp,position,basis);
      }
      let low=target.position[0],high=Math.max(...other.map(v=>v[0]))+Math.max(...own.map(v=>Math.abs(v[0]-comp.position[0])))+1;
      this.components=[target,comp];
      try{
        for(let i=0; i<28; i++){
          const mid=(low+high)/2;
          this._transform(comp,[mid,target.position[1],target.position[2]],comp.basis);
          if(this._assemblyValid().includes('穿透'))low=mid;
          else high=mid;
        }
        this._transform(comp,[high,target.position[1],target.position[2]],comp.basis);
      }
      finally{
        this.components=all;
      }
    }
    _assemblyValid(){
      const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const models=this.components.map(comp=>{
        const cells=this.cells.filter(c=>c.component===comp.id),verts=[],axes=new Map(),edges=new Map();
        const save=(map,v)=>{
          const len=Math.hypot(...v);
          if(len<1e-8)return;
          v=v.map(n=>n/len);
          if(v.find(n=>Math.abs(n)>1e-6)<0)v=v.map(n=>-n);
          map.set(v.map(n=>n.toFixed(5)).join(','),v);
        };
        for(const c of cells){
          const v=this._vertices(c);
          verts.push(...v);
          for(const face of c.poly.faces){
            save(axes,cross(sub(v[face[1]],v[face[0]]),sub(v[face[2]],v[face[0]])));
            for(let k=0;k<face.length;k++)save(edges,sub(v[face[(k+1)%face.length]],v[face[k]]));
          }
        }
        return {
          comp,verts,axes:[...axes.values()],edges:[...edges.values()]
        };
      });
      const linked=new Map(models.map(m=>[m.comp.id,[]]));
      for(let i=0; i<models.length; i++)for(let j=i+1; j<models.length; j++){
        const a=models[i],b=models[j],axes=a.axes.concat(b.axes);
        if(a.edges.length*b.edges.length<1000)for(const e of a.edges)for(const f of b.edges){
          let n=cross(e,f),len=Math.hypot(...n);
          if(len>1e-8)axes.push(n.map(v=>v/len));
        }
        let penetration=Infinity;
        for(const axis of axes){
          const A=a.verts.map(v=>dot(v,axis)),B=b.verts.map(v=>dot(v,axis)),overlap=Math.min(Math.max(...A),Math.max(...B))-Math.max(Math.min(...A),Math.min(...B));
          penetration=Math.min(penetration,overlap);
          if(penetration<-.0001)break;
        }
        if(penetration>.0001)return '零件相互穿透，请移开后拼接';
        if(penetration>=-.0001){
          linked.get(a.comp.id).push(b.comp.id);
          linked.get(b.comp.id).push(a.comp.id);
        }
      }
      const seen=new Set(),queue=[models[0].comp.id];
      for(let i=0; i<queue.length; i++){
        const id=queue[i];
        if(seen.has(id))continue;
        seen.add(id);
        queue.push(...linked.get(id).filter(n=>!seen.has(n)));
      }
      return seen.size===models.length?'':'零件尚未连接，请使用吸附';
    }
    _targetBuild(){
      this.phase='aim';
      this.bounds=4;
      this.ammo=[];
      this.throwPower=0;
      this.sling={anchor:[0,-1.7,2.76],pull:[0,0,0],bands:[],forks:[[-.34,-1.56,2.47],[.34,-1.56,2.47]]};
      this.targetRadius=1.25;
      this.targetCenters=[[-1.6,0,0],[1.6,0,0]];
      this.targetLabels=this.targetCenters.flatMap((c,target)=>Array.from({
        length:10
      },(_,i)=>({
        target,ring:10-i,score:(10-i)*10,center:[c[0],(i+.5)*.125,.12]
      })));
      // Interior cubes and clipped boundary blocks form a smooth disk.
      // Keep the front at .09 so aiming and attached shots share the same plane.
      const step=.18,half=step/2;
      for(let target=0; target<2; target++){
        let segment=0;
        for(let y=-7; y<=7; y++)for(let x=-7; x<=7; x++){
          const radius=Math.hypot(x*step,y*step);
          let poly=cube(half,half,half);
          for(let side=0;side<96&&poly;side++){
            const angle=(side+.5)*Math.PI*2/96,normal=[Math.cos(angle),Math.sin(angle),0];
            poly=root.ChallengeGeometry.clip(poly,normal,this.targetRadius*Math.cos(Math.PI/96)-normal[0]*x*step-normal[1]*y*step);
          }
          if(!poly)continue;
          const ring=10-Math.min(9,Math.floor(radius/.125));
          const shift=[0,1,2].map(axis=>poly.vertices.reduce((sum,v)=>sum+v[axis],0)/poly.vertices.length);
          const center=[this.targetCenters[target][0]+x*step+shift[0],y*step+shift[1],shift[2]];
          poly={vertices:poly.vertices.map(v=>v.map((n,i)=>n-shift[i])),faces:poly.faces};
          const c=this._cell(center,poly,target,{clipped:true,
            targetIndex:target,ring,segment:segment++,grid:[x,y,0],track:'target:'+target+':'+x,order:y
          });
          if([[0,0],[-3,3],[3,3],[-3,-3],[3,-3]].some(p=>p[0]===x&&p[1]===y)){
            c.color=-1;
            c.hole=true;
            this.ammo.push(Math.floor(this.rng()*6));
          }
        }
      }
      this._box([0,-2.46,2.4],[.10,.30,.10],[.43,.25,.12]);
      this._box([0,-2.16,2.4],[.34,.065,.065],[.43,.25,.12]);
      for(const x of [-.34,.34])this._box([x,-1.88,2.4],[.065,.32,.065],[.51,.31,.15]);
      this.sling.bands=[-1,1].map(()=>this._box([0,0,0],[.025,.5,.025],[.24,.12,.06]));
      this.sling.pouch=this._box(this.sling.anchor,[.19,.12,.025],[.26,.13,.07]);
      this.sling.loaded=this._box(this.sling.anchor,[.14,.14,.14],PALETTE[this.ammo[0]]);
      this._preview();
    }
    _slingVisual(){
      const s=this.sling,p=s.anchor.map((v,i)=>v+s.pull[i]);
      s.loaded.center=p;s.loaded.rgb=PALETTE[this.ammo[0]]||PALETTE[0];s.loaded.alpha=this.ammo.length&&!this.projectile?1:0;
      s.pouch.center=[p[0],p[1],p[2]-.165];
      s.bands.forEach((band,i)=>{
        const a=s.forks[i],end=s.pouch.center.map((v,k)=>v+(k===0?(i?.19:-.19):0)),d=end.map((v,j)=>v-a[j]),length=Math.hypot(...d),y=d.map(v=>v/length);
        const xl=Math.hypot(y[0],y[1])||1,x=[y[1]/xl,-y[0]/xl,0],z=[x[1]*y[2],-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
        band.start=a.slice();band.end=end;band.center=a.map((v,j)=>(v+end[j])/2);band.poly=cube(.025,length/2,.025);band.basis=[...x,...y,...z];
      });
    }
    _preview(){
      this._slingVisual();
      const start=this.sling.anchor.map((v,i)=>v+this.sling.pull[i]),end=[this.aim.x,this.aim.y,.09];
      const duration=1.2,gravity=6/(duration*duration);
      this.launch={start,gravity,velocity:end.map((v,i)=>(v-start[i])/duration+(i===1?gravity*duration/2:0))};
      this.aimPlaneZ=.09;
      const point=t=>[start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t+3*t*(1-t),start[2]+(end[2]-start[2])*t];
      let hit=null,stop=1,normal=[0,0,1];
      for(const c of this.cells){
        if(c.color<0&&!c.hole)continue;
        const verts=this._vertices(c);
        // Attached cubes can be entered from a side on an oblique throw.
        // Intersect the analytic parabola with all six axis-aligned faces.
        if(c.attached){
          const lo=[0,1,2].map(a=>Math.min(...verts.map(v=>v[a]))),hi=[0,1,2].map(a=>Math.max(...verts.map(v=>v[a])));
          for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
            const plane=sign<0?lo[axis]:hi[axis],a=axis===1?-3:0,b=end[axis]-start[axis]+(axis===1?3:0),d=start[axis]-plane;
            const discriminant=b*b-4*a*d;
            const roots=a?(discriminant>=0?[(-b-Math.sqrt(discriminant))/(2*a),(-b+Math.sqrt(discriminant))/(2*a)]:[]):Math.abs(b)>1e-10?[-d/b]:[];
            for(const t of roots){
              if(t<0||t>stop+1e-8||sign*(2*a*t+b)>=0)continue;
              const p=point(t);
              if(p.some((v,j)=>j!==axis&&(v<lo[j]-1e-8||v>hi[j]+1e-8)))continue;
              hit=c;stop=t;normal=[0,0,0];normal[axis]=sign;
            }
          }
          continue;
        }
        const front=Math.max(...verts.map(v=>v[2])),t=(start[2]-front)/(start[2]-end[2]);
        if(t<0||t>stop+1e-8)continue;
        const p=point(t),frontFace=c.poly.faces.find(f=>f.every(i=>Math.abs(verts[i][2]-front)<1e-6)),face=frontFace?frontFace.map(i=>verts[i]):[];
        let sign=0,inside=true;
        for(let i=0; i<face.length; i++){
          const a=face[i],b=face[(i+1)%face.length],cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
          if(Math.abs(cross)<1e-8)continue;
          if(sign&&Math.sign(cross)!==sign){
            inside=false;
            break;
          }
          sign=Math.sign(cross);
        }
        if(inside&&face.length>=3){
          hit=c;
          stop=t;
          normal=[0,0,1];
        }
      }
      this.trajectory=[];
      for(let i=0; i<=60; i++)this.trajectory.push(point(stop*i/60));
      let ring=0;
      if(hit){
        const center=this.targetCenters[hit.targetIndex],impact=point(stop);
        // The thrown cube has a .1 half-width: touching a ring boundary earns
        // the higher ring. Use impact coordinates, including stacked blocks.
        const radius=Math.max(0,Math.hypot(impact[0]-center[0],impact[1]-center[1])-.1);
        ring=Math.max(1,Math.min(10,10-Math.floor((radius-1e-9)/.125)));
      }
      this.previewHit={
        id:hit?hit.id:null,ring,duration:1.2*stop,normal
      };
    }
    _shotUpdate(dt){
      const p=this.projectile;
      if(!p)return;
      p.time+=dt;
      const i=Math.min(60,Math.floor(p.time/p.hit.duration*60));
      if(!this.shotVisual)this.shotVisual=this._box(p.path[i],[.1,.1,.1],PALETTE[p.color]);
      const elapsed=Math.min(p.time,p.hit.duration);
      this.shotVisual.center=p.start.map((v,axis)=>v+p.velocity[axis]*elapsed-(axis===1?.5*p.gravity*elapsed*elapsed:0));
      if(p.time>=p.hit.duration){
        this.lastImpact=p.path[60].slice();
        const c=this.cells.find(c=>c.id===p.hit.id);
        if(c){
          if(c.color<0){
            c.color=p.color;
            c.hole=false;
          }
          else{
            this.score+=p.hit.ring*10;
            this._cell(this.lastImpact.map((v,i)=>v+p.hit.normal[i]*.1),cube(.1,.1,.1),c.component,{
              color:p.color,ring:p.hit.ring,targetIndex:c.targetIndex,attached:true
            });
          }
        }
        this.decorations=this.decorations.filter(d=>d!==this.shotVisual);
        this.shotVisual=null;
        this.projectile=null;
        this.revision++;
        this._preview();
        if(!this.ammo.length)this.phase='play';
      }
    }
    _gearsBuild(){
      const step=.24,inner=1.1,outer=inner+6*step,base=cube(step/2,step/2,step/2);
      this.gears={moving:false,angle:0,outer,step,corners:[],hubs:[]};
      this.bounds=5.7;
      for(let unit=0;unit<2;unit++){
        const component={id:unit,name:'gear-plates',position:[(unit?1:-1)*outer,0,0],basis:rotation('z',unit?Math.PI:0)};
        this.components.push(component);
        for(let plate=0;plate<5;plate++){
          const plateBasis=rotation('z',plate*Math.PI*2/5),poly={vertices:base.vertices.map(v=>mul(plateBasis,v)),faces:base.faces};
          for(let row=0;row<6;row++)for(let column=0;column<5;column++){
            const local=mul(plateBasis,[inner+(row+.5)*step,(column-2)*step,0]);
            this._cell(add(component.position,mul(component.basis,local)),poly,unit,{local,basis:component.basis.slice(),plateIndex:plate,plateRow:row,plateColumn:column,track:unit+':plate:'+plate+':column:'+column,order:row});
          }
          if(!unit)for(const x of [inner,outer])for(const y of [-2.5*step,2.5*step])this.gears.corners.push(mul(plateBasis,[x,y,0]));
        }
        const vertices=[];
        for(const z of [-.16,-.10])for(let i=0;i<5;i++){
          const a=(i+.5)*Math.PI*2/5,r=inner/Math.cos(Math.PI/5);
          vertices.push([Math.cos(a)*r,Math.sin(a)*r,z]);
        }
        const hub={center:component.position.slice(),basis:component.basis.slice(),poly:{vertices,faces:root.ChallengeGeometry.hull(vertices)},rgb:[.24,.34,.47],alpha:1};
        this.decorations.push(hub);this.gears.hubs.push(hub);
      }
    }
    _gearsUpdate(){
      const cycle=Math.floor((this.time+1e-9)/3.2),part=Math.max(0,this.time-cycle*3.2);
      this.gears.moving=part>=2.4;
      const progress=this.gears.moving?Math.min(1,(part-2.4)/.8):0;
      const eased=progress*progress*(3-2*progress);
      this.gears.angle=(cycle+eased)*Math.PI*2/5;
      const bases=[rotation('z',this.gears.angle),rotation('z',Math.PI-this.gears.angle)];
      // Open a small working clearance while turning. Exact support extents
      // keep even the outer square corners on their own side of the gap.
      const extent=Math.max(...this.gears.corners.map(p=>mul(bases[0],p)[0]));
      const distance=Math.max(this.gears.outer,extent)+.12*Math.sin(Math.PI*progress);
      for(let unit=0;unit<2;unit++){
        const position=[(unit?1:-1)*distance,0,0];
        this._transform(this.components[unit],position,bases[unit]);
        this.gears.hubs[unit].center=position.slice();this.gears.hubs[unit].basis=bases[unit].slice();
      }
    }
    _seesawState(dt){
      const s=this.seesaw;
      s.leftCount=0;s.rightCount=0;
      for(const c of this.cells)if(c.color>=0&&c.color<6){
        const x=s.groupPositions[c.side];
        if(x<0||(x===0&&c.side==='left'))s.leftCount++;else s.rightCount++;
      }
      s.balanced=Math.abs(s.leftCount-s.rightCount)<=12;
      s.imbalanceTime=s.balanced?0:s.imbalanceTime+Math.max(0,dt);
      const sameSide=s.groupPositions.left*s.groupPositions.right>0;
      s.multiplier=s.balanced?1.2:(s.imbalanceTime>=5-1e-9&&sameSide?.8:1);
      s.left=Math.abs(s.groupPositions.left);s.right=Math.abs(s.groupPositions.right);
    }
    _seesawUpdate(dt){
      const s=this.seesaw,steps=Math.max(1,Math.ceil(dt/.05)),h=Math.max(0,dt)/steps;
      for(let i=0;i<steps;i++){
        this._seesawState(h);
        const target=s.balanced?0:Math.sign(s.leftCount-s.rightCount)*.32;
        if(s.balanced)s.angle=0;
        else s.angle+=(target-s.angle)*(1-Math.exp(-h*6));
        s.moving=Math.abs(target-s.angle)>.0001;
        if(!s.moving)s.angle=target;
        // Positive tilt lowers the left end. Both assemblies travel along the
        // board, including across its pivot, and queue against the solid stops.
        const shift=-.36*Math.sin(s.angle)/Math.sin(.32)*h,p=s.groupPositions;
        if(shift<0){p.left=Math.max(-3.09,p.left+shift);p.right=Math.max(p.left+1.1,p.right+shift);}
        else if(shift>0){p.right=Math.min(3.09,p.right+shift);p.left=Math.min(p.right-1.1,p.left+shift);}
        this._seesawState(0);
      }
      const basis=rotation('z',s.angle);
      for(const comp of this.components){
        const side=this.cells.find(c=>c.component===comp.id).side;
        const baseY=(comp.id%3)*1.1+.55;
        this._transform(comp,mul(basis,[s.groupPositions[side],baseY,0]),basis);
      }
      this.beam.center=mul(basis,[0,-.12,0]);this.beam.basis=basis;
      for(let i=0; i<2; i++){
        this.barriers[i].center=mul(basis,[i?3.72:-3.72,.175,0]);
        this.barriers[i].basis=basis;
      }
    }
    _marbleBuild(){
      this.bounds=6.3;
      // Five sealed sawtooth gates: clearing a shared-edge pair opens a real route.
      // Sparse wedges between gates can be kept to steer or removed to drop straight.
      const wedge=(middle,bottom,width,height,x,y,gate,role)=>{
       const color=(Math.floor(this.rng()*6)+x+2*y)%6;
       for(let t=0;t<2;t++){
        const points=t===0?[[middle-width/2,bottom],[middle,bottom],[middle,bottom+height]]:[[middle,bottom],[middle+width/2,bottom],[middle,bottom+height]];
        const center=[points.reduce((n,p)=>n+p[0],0)/3,points.reduce((n,p)=>n+p[1],0)/3,0];
        const vertices=[-.1,.1].flatMap(z=>points.map(p=>[p[0]-center[0],p[1]-center[1],z]));
        this._cell(center,{vertices,faces:[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]},0,{grid:[x,y,t],color,gate,role});
       }
      };
      for(let y=0;y<5;y++)for(let x=0;x<6;x++)wedge((x-2.5)*.9,3.65-y*1.85,.9,.6,x,y,y,'gate');
      for(let y=0;y<4;y++)for(const x of [0,5])wedge((y%2?1:-1)*(x===0?.85:1.95),2.55-y*1.85,.85,.55,x,y,-1,'guide');
      this.marble={position:[0,5.08,0],velocity:[0,0,0],released:false,bin:null,lastBin:null,drops:0,totalDrops:3,color:0,collisionCount:0,contacts:new Set(),aimAngle:0,maxAimAngle:Math.PI*50/180,launcherPivot:[0,5.3,0],launcher:[]};
      // Subdivide a round octahedron independently of the voxel scenery.
      const vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      let faces=[[0,2,4],[4,2,1],[1,2,5],[5,2,0],[0,4,3],[4,1,3],[1,5,3],[5,0,3]];
      for(let pass=0;pass<2;pass++){
        const mid=new Map(),next=[];
        const midpoint=(a,b)=>{const key=[a,b].sort((x,y)=>x-y).join(':');if(!mid.has(key)){let p=vertices[a].map((v,i)=>(v+vertices[b][i])/2),len=Math.hypot(...p);p=p.map(v=>v/len);mid.set(key,vertices.length);vertices.push(p);}return mid.get(key);};
        for(const [a,b,c] of faces){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);}faces=next;
      }
      this.ballVisual=[{center:[0,5.25,0],local:[0,0,0],poly:{vertices:vertices.map(v=>v.map(n=>n*.13)),faces},basis:I.slice(),rgb:PALETTE[0],alpha:1}];
      this.decorations.push(...this.ballVisual);
      for(const [local,half] of [[[-.2,-.06,0],[.035,.3,.16]],[[.2,-.06,0],[.035,.3,.16]],[[0,.24,0],[.235,.055,.16]],[[0,-.1,-.18],[.23,.28,.025]]]){
        const part=this._box(add(this.marble.launcherPivot,local),half,[.26,.42,.56]);part.launcherLocal=local;this.marble.launcher.push(part);
      }
      for(const x of [-2.8,2.8])this._box([x,.1,0],[.12,5.8,.30],[.5,.7,.8],.92);
      this._box([0,5.85,0],[2.92,.12,.30],[.5,.7,.8],.92);
      this.bins=[0,1,2,3,4];
      this.binScores=[100,300,500,300,100];
      this.binPositions=this.bins.map((color,i)=>({text:String(this.binScores[i]),color,center:[(i-2)*1.08,-5.65,0]}));
      for(let i=0;i<5;i++){
        this._box([(i-2)*1.08,-5.4,0],[.51,.10,.28],PALETTE[i]);
        this._box([(i-2)*1.08-.54,-5.13,0],[.025,.23,.25],PALETTE[i]);
      }
      this._marblePrepare();
    }
    _marblePrepare(){
      const m=this.marble;
      m.position=[0,5.25,0];m.velocity=[0,0,0];m.released=false;m.bin=null;m.contacts.clear();m.stillTime=0;
      m.color=Math.max(0,Math.min(4,Math.floor(this.rng()*5)));
      for(const d of this.ballVisual){d.center=m.position.slice();d.rgb=PALETTE[m.color];}
      this._marbleLauncher();
    }
    _marbleLauncher(){
      const m=this.marble,basis=rotation('z',m.aimAngle);
      for(const part of m.launcher){part.center=add(m.launcherPivot,mul(basis,part.launcherLocal));part.basis=basis.slice();}
      if(!m.released){m.position=add(m.launcherPivot,mul(basis,[0,-.22,0]));for(const d of this.ballVisual)d.center=add(m.position,d.local);}
    }
    marblePreview(){
      const m=this.marble;if(!m||m.released||m.drops>=m.totalDrops)return [];
      // Run the same integrator on isolated state, stopping at the first impact.
      const sim=Object.create(this);sim.marble={...m,position:m.position.slice(),velocity:[Math.sin(m.aimAngle)*3,-Math.cos(m.aimAngle)*3,0],contacts:new Set(),released:true};
      sim.ballVisual=[];sim._marblePrepare=()=>{};
      const path=[sim.marble.position.slice()],hits=m.collisionCount;
      for(let i=0;i<800;i++){
        sim._marbleUpdate(.006);path.push(sim.marble.position.slice());
        if(sim.marble.collisionCount>hits||sim.marble.bin!==null||Math.abs(sim.marble.position[0])>=2.61)break;
      }
      return path;
    }
    _marbleUpdate(dt){
      const m=this.marble;if(!m.released||m.bin!==null)return;
      const start=m.position.slice();
      const radius=.13,steps=Math.max(1,Math.ceil(dt/.006));
      for(let s=0;s<steps;s++){
        const h=dt/steps;
        m.velocity[1]=Math.max(-12,m.velocity[1]-7*h);
        m.position[0]+=m.velocity[0]*h;m.position[1]+=m.velocity[1]*h;
        const near=new Set();
        for(const c of this.cells){
          if(c.color<0)continue;
          if(Math.abs(m.position[0]-c.center[0])>.9||Math.abs(m.position[1]-c.center[1])>.9)continue;
          const points=c.poly.vertices.slice(0,3).map(v=>[c.center[0]+v[0],c.center[1]+v[1]]);
          let inside=true,distance=Infinity,nearest=null,outward=null;
          for(let i=0;i<3;i++){
            const a=points[i],b=points[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],px=m.position[0]-a[0],py=m.position[1]-a[1],len2=dx*dx+dy*dy;
            if(dx*py-dy*px<0)inside=false;
            const t=Math.max(0,Math.min(1,(px*dx+py*dy)/len2)),q=[a[0]+t*dx,a[1]+t*dy],dist=Math.hypot(m.position[0]-q[0],m.position[1]-q[1]);
            if(dist<distance){distance=dist;nearest=q;const len=Math.sqrt(len2);outward=[dy/len,-dx/len];}
          }
          if(m.contacts.has(c.id)&&(inside||distance<radius+.04))near.add(c.id);
          if(!inside&&distance>=radius)continue;
          near.add(c.id);
          let nx=inside||distance<1e-10?outward[0]:(m.position[0]-nearest[0])/distance;
          let ny=inside||distance<1e-10?outward[1]:(m.position[1]-nearest[1])/distance;
          // A perfectly centered point contact is an unstable equilibrium.
          // A tiny deterministic normal perturbation lets gravity tip it off the apex.
          if(Math.abs(nx)<1e-5&&ny>.999&&Math.abs(nearest[1]-Math.max(...points.map(p=>p[1])))<1e-6){nx=(c.grid[0]%2?1:-1)*.06;ny=Math.sqrt(1-nx*nx);}
          const overlap=inside?radius+distance:radius-distance;
          m.position[0]+=nx*(overlap+1e-6);m.position[1]+=ny*(overlap+1e-6);
          const speed=m.velocity[0]*nx+m.velocity[1]*ny;
          if(speed<0){
            if(!m.contacts.has(c.id)&&speed<-.1){this.score+=100;m.collisionCount++;}
            const bounce=speed<-.65?.40:0;
            m.velocity[0]-=(1+bounce)*speed*nx;m.velocity[1]-=(1+bounce)*speed*ny;
          }
        }
        // Hysteresis keeps resting contact from awarding points every substep.
        m.contacts=near;
        if(Math.abs(m.position[0])>2.61){m.position[0]=Math.sign(m.position[0])*2.61;m.velocity[0]*=-.65;}
        if(m.position[1]<-5.05){
          m.bin=Math.max(0,Math.min(4,Math.floor((m.position[0]+2.7)/1.08)));
          m.lastBin=m.bin;
          this.score+=this.binScores[m.bin];
          m.drops++;m.released=false;
          if(m.drops===m.totalDrops){this.result=this.score>=this.target?'win':'lose';this.phase='finished';this.status='三次弹珠已结束；碰撞 '+m.collisionCount+' 次';}
          else {this.status='已完成 '+m.drops+' / '+m.totalDrops+' 次，准备下一颗弹珠';this._marblePrepare();}
          break;
        }
      }
      for(const d of this.ballVisual)d.center=add(m.position,d.local);
      m.stillTime=m.released&&Math.hypot(m.position[0]-start[0],m.position[1]-start[1])<.002?(m.stillTime||0)+dt:0;
    }
    update(dt){
      if(this.result||!(dt>0))return;
      dt=Math.min(dt,5);
      this.time+=dt;
      if(this.level===4)root.ChallengeTower.update(this,dt);
      if(this.level===8)root.ChallengeRubik.update(this,dt);
      if(this.level===9)this._gearsUpdate();
      if(this.level===10)this._shotUpdate(dt);
      if(this.level===11)this._seesawUpdate(dt);
      if(this.level===12)this._marbleUpdate(dt);
    }
    awardRemainder(){
      if(this.remainderAwarded)return this.levelScoreBonus;
      this.remainderAwarded=true;this.levelRemain=this.remaining();
      this.levelScoreBonus=this.levelRemain===0?2000:this.levelRemain<=13?(13-this.levelRemain)*100:0;
      this.score+=this.levelScoreBonus;return this.levelScoreBonus;
    }
    finish(reason){
      if(this.result)return this.result;
      if(this.rubik&&this.rubik.turn)return null;
      if(this.phase==='assemble'||this.phase==='aim')return null;
      if(this.level===4&&reason!=='no-moves')return null;
      if(this.level===12){
        if(this.marble.drops<this.marble.totalDrops)return null;
        this.result=this.score>=this.target?'win':'lose';this.phase='finished';return this.result;
      }
      this.awardRemainder();
      this.result='win';
      this.phase='finished';
      return this.result;
    }
    info(){
      if(this.level===8)return root.ChallengeRubik.info(this);
      if(this.level===4)return root.ChallengeTower.info(this);
      if(this.phase==='assemble')return '从模型托盘选取至少两个零件，横向滑动可查看全部模型。点击场景中的零件后移动摆放，贴合面出现白光；电脑再次点击确认，触屏拖动后松手确认。最后点击“完成拼接”，再随机配色开始消除。';
      if(this.phase==='aim')return '拖住弹弓方块向后拉，调整方向与拉力，松手发射。左右靶各补5块；剩余 '+this.ammo.length+' 发';
      if(this.level===9)return this.gears.moving?'齿轮转动中，请等待停靠':'齿轮停靠，可跨接触面消除';
      if(this.level===11)return '左侧 '+this.seesaw.leftCount+' 块 · 右侧 '+this.seesaw.rightCount+' 块 · 分差不超过12保持平衡；当前消除 ×'+this.seesaw.multiplier;
      if(this.level===12)return '消除开路，弹珠得分：五段障碍墙需要消除同色共边块才能打开通路，墙间的斜块可以保留用于反弹导向。发射前可以规划路线，发射后仍能随时消除，球被挡住时继续开路。三颗球共用棋盘，已打开的缺口不会恢复。按住顶部发射器左右拖动调角，白色箭头预览首次碰撞，固定力度，点击按钮发射。消除照常得分，每次碰撞加100分，落槽加100、300或500分，三次结束达到1500分过关。提示会定位并以白光跳动标出组合。';
      return '消除相邻同色块；可旋转视角寻找可见接缝';
    }
  }
  root.ChallengeWorld=ChallengeWorld;
  if(typeof module!=='undefined'&&module.exports)module.exports=ChallengeWorld;
})(typeof globalThis!=='undefined'?globalThis:this);

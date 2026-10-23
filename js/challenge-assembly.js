/* Provisional assembly placement and depth-tested contact outlines. */
(function(g){
  'use strict';
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]);
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/(n||1));};
  class ChallengeAssembly{
    constructor(game){this.game=game;this.active=null;this.seams=[];this.revision=-1;this.pendingSnapshot=false;this.snapCache=new Map();}
    get world(){return this.game.world;}
    enabled(){return this.world.phase==='assemble'&&this.game.app.state==='play'&&!this.game.intro;}
    notify(text){this.game.message=text;this.game.messageUntil=(this.game.elapsed||0)+4;}
    refresh(){this.game.controlsKey='';this.game.controls?.();this.game.syncHud?.();}
    ray(e){
      const sc=this.game.app.scene,canvas=sc.canvas||sc.gl?.canvas,rect=canvas?.getBoundingClientRect?.();
      const width=rect?.width||g.innerWidth||sc.w,height=rect?.height||g.innerHeight||sc.h;
      return sc._ray((e.clientX-(rect?.left||0))/width*2-1,1-(e.clientY-(rect?.top||0))/height*2);
    }
    plane(e,point,normal){const r=this.ray(e),d=dot(r.d,normal);if(Math.abs(d)<1e-8)return null;const t=dot(sub(point,r.o),normal)/d;return add(r.o,r.d.map(v=>v*t));}
    pointerDown(e){
      if(!this.enabled()||(e.button!==undefined&&e.button!==0))return false;
      if(this.active){if(this.active.touch)return true;this.consumeUp=true;this.confirm();return true;}
      const sc=this.game.app.scene,r=this.ray(e);
      // Scene.pick uses the same screen coordinates and real polyhedra as rendering.
      const canvas=sc.canvas||sc.gl?.canvas,rect=canvas?.getBoundingClientRect?.();
      const id=sc.pick((e.clientX-(rect?.left||0))/(rect?.width||g.innerWidth||sc.w)*2-1,1-(e.clientY-(rect?.top||0))/(rect?.height||g.innerHeight||sc.h)*2,this.world.cells.map(c=>({...c,size:[1,1,1]})));
      const cell=this.world.cells.find(c=>c.id===id),comp=cell&&this.world.components.find(c=>c.id===cell.component);
      if(!comp)return false;
      const normal=norm(sub(sc.target||[0,0,0],sc.eye||r.o)),point=this.plane(e,comp.position,normal);
      if(!point)return false;
      if(!this.pendingSnapshot)this.world._snapshot();
      this.active={id:comp.id,position:comp.position.slice(),basis:comp.basis.slice(),point,normal,pending:!!this.world.assemblyPending,touch:e.pointerType==='touch'||e.pointerType==='pen',pointerId:e.pointerId};
      this.world.selected=comp.id;this.world.assemblyPending=true;
      this.notify(this.active.touch?'拖动零件，贴合后松手确认':'移动鼠标摆放零件，再次点击确认');this.refresh();return true;
    }
    pointerMove(e){
      if(!this.active||!this.enabled())return false;
      if(this.active.touch&&e.pointerId!==undefined&&e.pointerId!==this.active.pointerId)return true;
      const a=this.active,comp=this.world.components.find(c=>c.id===a.id),p=this.plane(e,a.position,a.normal);
      if(!comp||!p)return true;
      this.world._transform(comp,add(a.position,sub(p,a.point)),comp.basis);
      this.nearSnap(comp);this.updateSeams();return true;
    }
    pointerUp(e){
      if(this.consumeUp){this.consumeUp=false;return true;}
      if(!this.active)return false;
      if(this.active.touch){if(e.pointerId!==undefined&&e.pointerId!==this.active.pointerId)return true;if(!this.confirm())this.cancel();}
      return true;
    }
    nearSnap(comp){
      const bounds=c=>{const vs=this.world.cells.filter(v=>v.component===c.id).flatMap(v=>this.world._vertices(v));return [0,1,2].map(i=>[Math.min(...vs.map(v=>v[i])),Math.max(...vs.map(v=>v[i]))]);};
      const own=bounds(comp);
      const candidates=this.world.components.filter(c=>c!==comp).map(c=>{const b=bounds(c);return {c,d:Math.hypot(...own.map((a,i)=>Math.max(0,a[0]-b[i][1],b[i][0]-a[1])))};}).sort((a,b)=>a.d-b.d);
      if(!candidates.length||candidates[0].d>.25)return;
      const position=comp.position.slice(),basis=comp.basis.slice();
      const target=candidates[0].c,key=[comp.id,...basis,target.id,...target.position,...target.basis].join(','),cached=this.snapCache.get(key);
      if(cached){if(Math.hypot(...sub(position,cached))<=.26)this.world._transform(comp,cached.slice(),basis);return;}
      this.world._snap(comp,candidates[0].c);
      this.snapCache.set(key,comp.position.slice());
      // The legacy snap approaches along X; reject any distant relocation.
      if(Math.hypot(...sub(comp.position,position))>.26)this.world._transform(comp,position,basis);
    }
    valid(){
      if(this.world.components.length<2)return true;
      if(this.world._assemblyValid())return false;
      this.updateSeams();
      const linked=new Set([this.world.components[0].id]);
      for(let pass=0;pass<this.world.components.length;pass++)for(const seam of this.seams){if(linked.has(seam.components[0]))linked.add(seam.components[1]);if(linked.has(seam.components[1]))linked.add(seam.components[0]);}
      return linked.size===this.world.components.length;
    }
    confirm(){
      if(!this.valid()){this.notify('零件必须贴合并且不能重叠，请继续调整');return false;}
      this.active=null;this.pendingSnapshot=false;this.world.assemblyPending=false;
      this.notify('摆放已确认，可继续添加零件或完成拼接');this.game.refit?.();this.refresh();return true;
    }
    cancel(){
      if(!this.active)return false;
      const a=this.active,comp=this.world.components.find(c=>c.id===a.id);
      if(comp)this.world._transform(comp,a.position,a.basis);
      this.world.assemblyPending=a.pending;this.active=null;this.revision=-1;this.refresh();return true;
    }
    afterAction(name){
      if(name==='select'&&this.active)this.cancel();
      if(['undo','reset','remove-component'].includes(name)||(name==='complete'&&this.world.phase!=='assemble')){
        this.active=null;this.pendingSnapshot=false;
        if(name!=='undo')this.world.assemblyPending=false;
      }else if(['add','translate','rotate','snap'].includes(name)){
        this.active=null;this.world.assemblyPending=this.world.components.length>1;this.pendingSnapshot=true;
        if(this.world.assemblyPending)this.notify('零件尚未确认：桌面点击选中后再次点击确认，触屏拖动后松手确认');
      }
      this.revision=-1;this.updateSeams();
      if(['undo','remove-component'].includes(name)&&this.world.components.length>1&&!this.valid())this.world.assemblyPending=true;
      // Reuse the already-snapped add position instead of invoking the legacy
      // iterative snap again on each mouse move near the same contact.
      if(name==='add'){
        const comp=this.world.components.find(c=>c.id===this.world.selected);
        for(const seam of this.seams)if(seam.components.includes(comp?.id)){
          const target=this.world.components.find(c=>c.id!==comp.id&&seam.components.includes(c.id));
          const key=[comp.id,...comp.basis,target.id,...target.position,...target.basis].join(',');
          this.snapCache.set(key,comp.position.slice());
        }
      }
    }
    updateSeams(){
      const w=this.world;if(this.revision===w.revision)return;
      this.revision=w.revision;this.seams=[];
      if(w.phase!=='assemble')return;
      // Interpenetrating voxel interiors can contain coincident internal faces;
      // those are not placement contacts and must never emit a confirmation glow.
      if(w.components.length>1&&w._assemblyValid().includes('穿透'))return;
      const cells=new Map(w.cells.map(c=>[c.id,c])),faces=new Map();
      const data=c=>{if(!faces.has(c.id)){const v=w._vertices(c);faces.set(c.id,c.poly.faces.map(f=>{const p=f.map(i=>v[i]);return {p,n:norm(cross(sub(p[1],p[0]),sub(p[2],p[0])))};}));}return faces.get(c.id);};
      for(const [i,j] of w.contacts()){
        const a=cells.get(i),b=cells.get(j);if(!a||!b||a.component===b.component)continue;
        for(const f of data(a))for(const h of data(b)){
          if(dot(f.n,h.n)>-.99999||Math.abs(dot(f.n,sub(h.p[0],f.p[0])))>1e-5)continue;
          // Clip opposing convex faces in their common plane, retaining only
          // positive-area shared surface; edge/corner contacts never glow.
          let polygon=f.p.slice();
          for(let k=0;k<h.p.length&&polygon.length;k++){
            const origin=h.p[k],edge=sub(h.p[(k+1)%h.p.length],origin),inside=p=>dot(cross(edge,sub(p,origin)),h.n),next=[];
            for(let l=0;l<polygon.length;l++){
              const p=polygon[l],q=polygon[(l+1)%polygon.length],dp=inside(p),dq=inside(q);
              if(dp>=-1e-8)next.push(p);
              if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push(p.map((v,axis)=>v+(q[axis]-v)*t));}
            }
            polygon=next;
          }
          const area=polygon.length<3?0:polygon.slice(1,-1).reduce((sum,p,k)=>sum+Math.hypot(...cross(sub(p,polygon[0]),sub(polygon[k+2],polygon[0])))/2,0);
          if(area>1e-7)this.seams.push({components:[a.component,b.component],points:polygon,normal:f.n,area});
        }
      }
    }
    render(){
      this.updateSeams();if(this.world.phase!=='assemble')return;
      const sc=this.game.app.scene,m4=g.MX.m4;
      for(const seam of this.seams)for(let i=0;i<seam.points.length;i++){
        const a=seam.points[i],b=seam.points[(i+1)%seam.points.length],edge=sub(b,a),length=Math.hypot(...edge);if(length<1e-7)continue;
        const x=norm(edge),z=seam.normal,y=norm(cross(z,x)),basis=[...x,...y,...z],center=a.map((v,k)=>(v+b[k])/2);
        // Tiny world-space prisms straddle only the shared face perimeter.
        // Normal depth testing hides internal edges behind the actual geometry.
        for(const [thickness,alpha] of [[.035,.38],[.014,1]]){
          const model=m4.create();m4.fromBasisScale(model,basis,center,[length/2,thickness,thickness]);sc.drawBox(model,[1,1,1],[0,0],0,alpha,1);
        }
      }
    }
  }
  g.ChallengeAssembly=ChallengeAssembly;
})(typeof window!=='undefined'?window:globalThis);

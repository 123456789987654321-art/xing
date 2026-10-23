/* Drag the loaded cube backwards; release commits the ballistic preview. */
(function(g){
 'use strict';
 class ChallengeThrow{
  constructor(game){this.game=game;this.charging=false;this.power=0;this.pointerId=null;}
  get world(){return this.game.world;}
  enabled(){return this.world.phase==='aim'&&this.game.app.state==='play'&&!this.game.intro&&!this.world.result;}
  ray(e){const sc=this.game.app.scene,rect=(sc.canvas||sc.gl?.canvas)?.getBoundingClientRect?.();return sc._ray((e.clientX-(rect?.left||0))/(rect?.width||g.innerWidth||sc.w)*2-1,1-(e.clientY-(rect?.top||0))/(rect?.height||g.innerHeight||sc.h)*2);}
  planePoint(e){const ray=this.ray(e),a=this.world.sling.anchor,n=this.planeNormal,den=ray.d.reduce((s,v,i)=>s+v*n[i],0);if(Math.abs(den)<1e-7)return null;const t=a.reduce((s,v,i)=>s+(v-ray.o[i])*n[i],0)/den;return t>0?ray.o.map((v,i)=>v+ray.d[i]*t):null;}
  aim(e){const p=this.planePoint(e);if(!p)return;let pull=p.map((v,i)=>v-this.grab[i]),length=Math.hypot(...pull);if(length>1.05)pull=pull.map(v=>v*1.05/length);this.power=Math.min(1,length/1.05);const view=this.game.app.scene.eye.map((v,i)=>v-this.world.sling.anchor[i]-pull[i]);this.world.action('throw-aim',{pull,view});}
  pointerDown(e){
   if(!this.enabled()||(e.button!==undefined&&e.button!==0))return false;
   if(this.charging){if(e.pointerId!==this.pointerId){this.cancel();return false;}return true;}
   if(this.world.projectile||!this.world.ammo.length)return false;
   const sc=this.game.app.scene,p=sc.project(this.world.sling.anchor);if(!p)return false;
   const rect=(sc.canvas||sc.gl?.canvas)?.getBoundingClientRect?.(),x=e.clientX-(rect?.left||0),y=e.clientY-(rect?.top||0);
   const edge=sc.project(this.world.sling.anchor.map((v,i)=>v+(i===0?.18:0))),radius=Math.max(24,edge?Math.hypot(edge[0]-p[0],edge[1]-p[1]):24);
   if(Math.hypot(x-p[0],y-p[1])>radius)return false;
   const n=sc.eye.map((v,i)=>v-sc.target[i]),len=Math.hypot(...n);this.planeNormal=n.map(v=>v/len);this.grab=this.planePoint(e);if(!this.grab)return false;
   this.pointerId=e.pointerId;this.charging=true;this.power=0;this.world.action('throw-aim',{pull:[0,0,0]});return true;
  }
  pointerMove(e){if(!this.enabled()||!this.charging||(e.buttons&2)||e.pointerId!==undefined&&e.pointerId!==this.pointerId)return false;this.aim(e);return true;}
  pointerUp(e){if(e.button!==undefined&&e.button!==0||!this.charging||e.pointerId!==undefined&&e.pointerId!==this.pointerId)return false;if(!this.enabled()){this.cancel();return true;}this.aim(e);const fire=this.power>.035;this.charging=false;this.pointerId=null;if(fire)this.world.action('shoot');else this.cancel();return true;}
  frame(){if(!this.enabled()&&this.charging)this.cancel();}
  cancel(){const consumed=this.charging;this.charging=false;this.pointerId=null;this.power=0;this.world.action('throw-aim',{pull:[0,0,0]});return consumed;}
 }
 g.ChallengeThrow=ChallengeThrow;
 class ChallengeMarbleAim{
  constructor(game){this.game=game;this.pointerId=null;this.path=[];}
  enabled(){const g=this.game,m=g.world.marble;return g.app.state==='play'&&!g.intro&&!g.world.result&&!m.released&&m.drops<m.totalDrops;}
  pointerDown(e){
   if(!this.enabled()||this.pointerId!==null||(e.button!==undefined&&e.button!==0))return false;
   const sc=this.game.app.scene,p=sc.project(this.game.world.marble.launcherPivot),rect=sc.canvas?.getBoundingClientRect?.();
   if(!p||Math.hypot(e.clientX-(rect?.left||0)-p[0],e.clientY-(rect?.top||0)-p[1])>32)return false;
   this.pointerId=e.pointerId;this.startX=e.clientX;this.startAngle=this.game.world.marble.aimAngle;this.updatePreview();return true;
  }
  pointerMove(e){
   if(this.pointerId===null||e.pointerId!==this.pointerId)return false;
   if(!this.enabled()){this.cancel();return true;}
   this.game.world.action('marble-aim',this.startAngle+(e.clientX-this.startX)*Math.PI/240);this.updatePreview();return true;
  }
  pointerUp(e){if(this.pointerId===null||e.pointerId!==this.pointerId)return false;this.pointerId=null;return true;}
  cancel(){this.pointerId=null;this.path=[];this.key='';}
  updatePreview(){
   const w=this.game.world,key=w.marble.aimAngle+'|'+w.cells.map(c=>c.color).join(',');
   if(key!==this.key){this.key=key;this.path=w.marblePreview();}
  }
  render(){
   if(!this.enabled()){this.cancel();return;}
   if(!this.key)return;this.updatePreview();
   const sc=this.game.app.scene,m4=g.MX.m4,I=[1,0,0,0,1,0,0,0,1],draw=(p,size)=>{const model=m4.create();m4.fromBasisScale(model,I,[p[0],p[1],.22],size);sc.drawBox(model,[1,1,1],[0,0],0,.95);};
   for(let i=0;i<this.path.length;i+=4)draw(this.path[i],[.035,.035,.035]);
   const end=this.path.at(-1),prev=this.path.at(-3);if(!end||!prev)return;
   let dx=end[0]-prev[0],dy=end[1]-prev[1],len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
   const model=m4.create();m4.fromBasisScale(model,I,[end[0],end[1],.23],[1,1,1]);
   sc.drawPoly(model,{vertices:[[0,0,0],[-dx*.2-dy*.10,-dy*.2+dx*.10,0],[-dx*.2+dy*.10,-dy*.2-dx*.10,0]],faces:[[0,1,2],[2,1,0]]},[1,1,1],0,1,1);
  }
 }
 g.ChallengeMarbleAim=ChallengeMarbleAim;
})(typeof window!=='undefined'?window:globalThis);

/* 挑战模式的界面、相机、可见接缝与场景生命周期。 */
(function(g){
  'use strict';
  const IDENTITY=[1,0,0,0,1,0,0,0,1];
  const COLORS=[[.91,.37,.29],[.57,.38,.76],[.27,.65,.43],[.25,.56,.79],[.94,.72,.24],[.86,.45,.67],[.55,.63,.65]];
  const NAMES=['三棱锥','圆柱体','球体','高楼营救','三棱柱','棱台','十字双环','魔方消除','啮合齿轮','投射补靶','平衡跷跷板'];
  const SHAPES=[['tetrahedron','三棱锥'],['cylinder','圆柱'],['sphere','球体'],['prism','三棱柱'],['frustum','棱台'],['torus','圆环']];
  const $=id=>document.getElementById(id);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,label,extra='')=>`<button type="button" data-challenge="${action}" ${extra}>${label}</button>`;
  class ChallengeGame {
    constructor(app,level){
      this.app=app;this.world=new g.ChallengeWorld(level);this.level=level;
      this.viewLinks=[];this.hover=[];this.hint=[];this.tiles=[];this.drawList=[];
      this.intro=app.reduceMotion?0:1.25;this.elapsed=0;this.linkTime=0;this.lastProjection='';this.pendingProjection='';this.controlsKey='';this.resultShown=false;
      this.slides=new Map();this.popEffects=[];
      this.panOffset=[0,0,0];
      this.assembly=null;
      this.rubikControls=level===8&&g.ChallengeRubikControls?new g.ChallengeRubikControls(this):null;
      this.thrower=level===10&&g.ChallengeThrow?new g.ChallengeThrow(this):null;
      this.marbleAim=level===12&&g.ChallengeMarbleAim?new g.ChallengeMarbleAim(this):null;
      app.score=0;app.entryScore=0;app.newRecord=false;app.target=this.world.target;
      app.state='play';app.introDone=true;app.timer=null;app.rotor=null;app.mainMatcher=null;
      app.viewLinks=[];app.dying=[];app.hoverIds=null;app.hintIds=null;app.tiles=[];app.renderList=[];
      app.scene.particles.clear();app.scene.orbit=null;app.scene.yaw=[4,10,11,12].includes(level)?0:.58;
      app.scene.pitch=[4,10,11,12].includes(level)?.08:.34;app.scene.target=[0,0,0];
      if(level===7)app.scene.pitch=.9;
      if(level===4){app.scene.yaw=.26;app.scene.pitch=.08;}
      if(level===9){app.scene.yaw=0;app.scene.pitch=.15;}
      app.hideOverlay();app.hideTip();$('toasts').innerHTML='';$('menu').classList.add('hidden');$('hud').classList.remove('hidden');
      $('hudTimerBox').classList.add('hidden');$('btnMechanicInfo').classList.remove('hidden');
      $('challengePanel').classList.remove('hidden');document.body.classList.add('in-challenge');
      $('challengePanel').classList.toggle('marble-panel',level===12);
      this.focus=level===4?[0,.3,0]:level===11?[0,1,0]:[0,0,0];this.zoom(0);this.bindControls();this.controls();this.syncHud();
      $('banner').classList.remove('show');
      g.Sfx.start();this.help(true);
    }
    dispose(){
      this.rubikControls?.dispose();
      $('challengePanel')?.classList.add('hidden');document.body.classList.remove('in-challenge');
      $('waterGauge')?.classList.add('hidden');
      $('towerStatus')?.classList.add('hidden');
      $('throwGauge')?.classList.add('hidden');$('seesawCounts')?.classList.add('hidden');
      if($('challengeLabels'))$('challengeLabels').innerHTML='';
      this.app.scene.target=[0,0,0];this.app.hideTip();
    }
    zoom(value){
      this.hintFocus=null;this.hint=[];this.hintZoom=null;
      const sc=this.app.scene;this.app.zoom=Math.max(0,Math.min(1,value));
      const radius=Math.max(1.7,Number(this.world.bounds)||3);
      const angle=Math.min(sc.fov/2,Math.atan(Math.tan(sc.fov/2)*sc.aspect));
      this.fit=radius/Math.sin(angle)*(this.level===4?.85:[8,11].includes(this.level)?1.0:this.level===12?1.55:1.3);
      if([4,10,11,12].includes(this.level)){
        const points=[...this.world.cells,...this.world.decorations].flatMap(c=>g.ChallengeProjection.worldVertices({...c,size:[1,1,1]}));
        const min=[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),max=[0,1,2].map(a=>Math.max(...points.map(p=>p[a])));
        this.focus=min.map((v,a)=>(v+max[a])/2);
        const sy=Math.sin(sc.yaw),cy=Math.cos(sc.yaw),sp=Math.sin(sc.pitch),cp=Math.cos(sc.pitch);
        const right=[cy,0,-sy],up=[-sp*sy,cp,-sp*cy],back=[cp*sy,sp,cp*cy];
        const dot=(p,v)=>p.reduce((sum,n,i)=>sum+n*v[i],0),tan=Math.tan(sc.fov/2);
        this.fit=Math.max(...points.map(point=>{
          const p=point.map((v,i)=>v-this.focus[i]);
          return dot(p,back)+Math.max(Math.abs(dot(p,right))/(tan*sc.aspect*.82),Math.abs(dot(p,up))/(tan*([4,10].includes(this.level)?.72:.60)));
        }))+.1;
      }
      const range=sc.zoomRange;
      sc.dist=range?1/((1-this.app.zoom)/range.far+this.app.zoom/range.near):this.fit/(1+this.app.zoom*1.5);
      const slider=$('zoomSlider');slider.value=this.app.zoom*100;slider.setAttribute('aria-valuetext',Math.round(100*(range?range.far/sc.dist:1+1.5*this.app.zoom))+'%');
      this.lastProjection='';
    }
    refit(){
      if(this.level===8&&this.world.cells.length){
        const vertices=this.world.cells.flatMap(c=>g.ChallengeProjection.worldVertices({...c,size:[1,1,1]}));
        const min=[0,1,2].map(a=>Math.min(...vertices.map(p=>p[a]))),max=[0,1,2].map(a=>Math.max(...vertices.map(p=>p[a])));
        this.focus=min.map((v,a)=>(v+max[a])/2);this.world.bounds=Math.max(2,Math.hypot(...max.map((v,a)=>(v-min[a])/2)));
      }
      this.zoom(this.app.zoom);
    }
    clearHintView(){if(this.hintFocus){this.hintFocus=null;this.hint=[];if(this.hintZoom!==null)this.app.zoom=this.hintZoom;this.hintZoom=null;const slider=$('zoomSlider');if(slider)slider.value=this.app.zoom*100;}}
    align(){this.clearHintView();this.panOffset=[0,0,0];this.app.scene.orbit=null;this.app.scene.yaw=0;this.app.scene.pitch=this.level===11?.08:0;this.lastProjection='';}
    pan(dx,dy){
      if(this.level!==11)return false;
      if(this.app.state!=='play'||this.intro)return true;
      const sc=this.app.scene,scale=2*sc.dist*Math.tan(sc.fov/2)/(sc.h/sc.dpr),limit=Math.max(1,Number(this.world.bounds)||3)*.6;
      this.panOffset[0]=Math.max(-limit,Math.min(limit,this.panOffset[0]-dx*scale));
      const vertical=Math.max(-limit,Math.min(limit,this.panOffset[1]/Math.cos(.08)+dy*scale));
      this.panOffset[1]=vertical*Math.cos(.08);this.panOffset[2]=-vertical*Math.sin(.08);
      this.lastProjection='';return true;
    }
    frame(dt){
      const app=this.app,sc=app.scene;
      if(this.ending&&app.state==='settling'){
        this.ending.time+=dt;this.elapsed+=dt;
        for(const item of this.ending.items)if(!item.popped&&this.ending.time>=item.delay){
          item.popped=true;this.endHidden.add(item.tile.id);
          sc.particles.burst(item.tile.center,COLORS[item.tile.color],18,{speed:2.4,size:.065,life:.6,gravity:2});
          this.popEffects.push({tile:item.tile,time:0});
        }
        this.popEffects=this.popEffects.filter(p=>(p.time+=dt)<.32);sc.particles.update(dt);
        if(this.ending.time>=this.ending.duration)this.checkResult();
      }
      this.thrower?.frame(dt);
      if(app.state==='play'){
        this.elapsed+=dt;this.intro=Math.max(0,this.intro-dt);
        if(!this.intro)this.world.update(dt);
        for(const [id,move] of this.slides){move.time+=dt;if(move.time>=.28)this.slides.delete(id);}
        this.readMoves();
        this.popEffects=this.popEffects.filter(p=>(p.time+=dt)<.32);
        sc.particles.update(dt);
      }
      if(this.level===11){sc.orbit=null;sc.yaw=0;sc.pitch=.08;sc.shakeT=0;}
      sc.updateCamera(dt);
      if(this.focus){const radius=Math.max(1.7,Number(this.world.bounds)||3);sc.eye=sc.eye.map((v,i)=>v+this.focus[i]);sc.target=this.focus.map((v,i)=>v-sc.up[i]*radius*(this.hasControls&&![11,12].includes(this.level)?.38:0));}
      if(this.level===11){sc.up=[0,1,0];sc.eye=sc.eye.map((v,i)=>v+this.panOffset[i]);sc.target=sc.target.map((v,i)=>v+this.panOffset[i]);}
      if(this.hintFocus){const shift=this.hintFocus.map((v,i)=>v-sc.target[i]);sc.eye=sc.eye.map((v,i)=>v+shift[i]);sc.target=this.hintFocus.slice();}
      this.render();
      if(app.state==='play'&&!this.intro){
        const cameraKey=Array.from(sc.vp).map(n=>Math.abs(n)<.00005?'0.0000':n.toFixed(4)).join(',');
        this.cameraQuiet=cameraKey===this.cameraKey?(this.cameraQuiet||0)+dt:0;this.cameraKey=cameraKey;
        const key=cameraKey+'|'+this.world.cells.map(c=>c.color+':'+c.center.map(n=>n.toFixed(3)).join(',')+':'+(c.basis||IDENTITY).map(n=>n.toFixed(3)).join(',')).join(';');
        const geometryKey=key.slice(cameraKey.length)+(this.world.tower?':'+this.world.tower.person.y.toFixed(4):'');
        this.geometryQuiet=geometryKey===this.geometryKey?(this.geometryQuiet||0)+dt:0;this.geometryKey=geometryKey;
        if(key!==this.pendingProjection){this.pendingProjection=key;this.linkTime=0;this.viewLinks=[];this.hover=[];if(!this.hintFocus)this.hint=[];app.hideTip();}
        else this.linkTime+=dt;
        if(this.slides.size||this.world.rubik?.turn){this.viewLinks=[];this.lastProjection='';this.linkTime=0;}
        if(this.world.canRemove()&&!this.slides.size&&this.linkTime>.12&&key!==this.lastProjection){
          this.viewLinks=g.ChallengeProjection.links(sc,this.interactionTiles());this.lastProjection=key;
        }
        if(this.level!==12&&this.geometryQuiet>.6&&this.cameraQuiet>.3&&!this.hintFocus&&!this.hasPotentialMoves())this.world.finish('no-moves');
        this.checkResult();
      }
      this.syncHud();
    }
    makeTile(cell,decor=false){
      const center=cell.center.slice();
      if(!decor&&this.intro){
        const delay=(cell.id%17)/17*.3,progress=Math.max(0,Math.min(1,(1.25-this.intro-delay)/.85));
        const amount=(1-progress)*(1-progress)*6,basis=cell.basis||IDENTITY;
        const horizontal=/face[+-]y:/.test(cell.track||'');
        for(let axis=0;axis<3;axis++)center[axis]+=amount*(horizontal?-basis[axis+6]:basis[axis+3]);
      }
      const slide=this.slides.get(cell.id);
      if(!decor&&slide){const t=Math.min(1,slide.time/.28),e=t*t*(3-2*t);for(let a=0;a<3;a++)center[a]=slide.from[a]+(center[a]-slide.from[a])*e;}
      return {...cell,center,renderCenter:center,basis:cell.basis||IDENTITY,size:cell.size||[1,1,1],alpha:cell.alpha??1,pickThrough:decor};
    }
    render(){
      const sc=this.app.scene,m4=g.MX.m4;
      const panel=$('challengePanel'),rect=this.hasControls?panel?.getBoundingClientRect?.():null;
      const bottom=rect&&rect.top>0?Math.min(.96,rect.top/(sc.h/sc.dpr)-.02):.96;
      let fitCells=this.world.cells.concat(this.world.decorations||[]);
      if(this.world.sling){
        const sling=this.world.sling,moving=new Set([...sling.bands,sling.pouch,sling.loaded]);
        // Reserve room for a full pull before aiming starts, so the ray under
        // a held pointer never moves in response to the pouch or rubber bands.
        fitCells=fitCells.filter(c=>!moving.has(c)).concat({center:sling.anchor,size:[4.2,4.2,4.2]});
      }
      if(this.hintFocus)fitCells=this.world.cells.filter(c=>this.hint.includes(c.id)).concat({center:this.hintFocus,size:[2.6,2.6,2.6]});
      if(sc.applyZoom)sc.applyZoom(fitCells,this.hintFocus||(this.level===11?sc.target:this.focus||[0,0,0]),bottom,this.fit,this.app.zoom,this.level===8?44:0);
      else sc.constrainZoom?.(this.world.cells.concat(this.world.decorations||[]),this.level===11?sc.target:this.focus||[0,0,0],bottom);
      if(sc.zoomRange)$('zoomSlider')?.setAttribute('aria-valuetext',Math.round(100*sc.zoomRange.far/sc.dist)+'%');
      sc.beginFrame();
      this.tiles=this.world.cells.filter(c=>c.color>=0&&!this.endHidden?.has(c.id)).map(c=>this.makeTile(c));
      const decor=(this.world.decorations||[]).map(c=>this.makeTile(c,true));
      this.drawList=this.tiles.concat(decor);
      const draw=t=>{
        const model=m4.create(),bounce=!t.pickThrough&&this.hint.includes(t.id)&&!this.app.reduceMotion?Math.abs(Math.sin(this.elapsed*7))*.05:0;
        m4.fromBasisScale(model,t.basis,t.center.map((v,i)=>v+(sc.up?.[i]||0)*bounce),t.size);
        const selected=this.world.phase==='assemble'&&t.component===this.world.selected;
        const high=!t.pickThrough&&(this.hover.includes(t.id)||selected)?.32:0;
        const hint=!t.pickThrough&&this.hint.includes(t.id)?(.5+.3*Math.sin(this.elapsed*7)):0;
        if(t.poly)sc.drawPoly(model,t.poly,t.rgb||COLORS[t.color]||COLORS[6],high,t.alpha,hint);
        else sc.drawBox(model,t.rgb||COLORS[6],[.7,0],high,t.alpha,hint);
      };
      for(const t of this.drawList)if(t.alpha>.985)draw(t);
      const translucent=this.drawList.filter(t=>t.alpha<=.985).sort((a,b)=>Math.hypot(...b.center.map((x,i)=>x-sc.eye[i]))-Math.hypot(...a.center.map((x,i)=>x-sc.eye[i])));
      translucent.forEach(draw);
      if(this.world.phase==='assemble')this.assembly?.render();
      for(const effect of this.popEffects){const t={...effect.tile,alpha:1-effect.time/.32,size:effect.tile.size.map(s=>s*(1+effect.time))};draw(t);}
      if(this.world.trajectory&&this.world.phase==='aim'&&this.thrower?.charging){
        for(let i=0;i<this.world.trajectory.length;i+=2){const p=this.world.trajectory[i];const model=m4.create();m4.fromBasisScale(model,IDENTITY,p,[.035,.035,.035]);sc.drawBox(model,[1,1,1],[0,0],0,.9);}
        const end=this.world.trajectory.at(-1);
        if(end){const model=m4.create();m4.fromBasisScale(model,IDENTITY,end,[.14,.14,.035]);sc.drawBox(model,[1,1,1],[0,0],0,.9);}
      }
      // A high-contrast joint makes the two independently removable halves readable.
      if(this.level===12)for(let i=0;i<this.world.cells.length;i+=2){
        const a=this.world.cells[i],b=this.world.cells[i+1];if(a.color<0||!b||b.color<0)continue;
        const points=a.poly.vertices.slice(0,3).map(v=>v.map((n,k)=>n+a.center[k])),x=Math.max(...points.map(p=>p[0])),lo=Math.min(...points.map(p=>p[1])),hi=Math.max(...points.map(p=>p[1]));
        for(const z of [-.102,.102]){const model=m4.create();m4.fromBasisScale(model,IDENTITY,[x,(lo+hi)/2,z],[.012,hi-lo,.003]);sc.drawBox(model,[.85,.9,1],[0,0],0,.85);}
      }
      this.marbleAim?.render();
      sc.drawParticles();this.app.renderList=this.tiles;
      this.drawLabels();this.rubikControls?.render();
    }
    drawLabels(){
      const holder=$('challengeLabels');if(!holder)return;
      const labels=this.world.binPositions||this.world.targetLabels||this.world.waterLabels||[];
      holder.innerHTML=labels.map(label=>{const p=this.app.scene.project(label.center);return p?`<span style="left:${p[0]}px;top:${p[1]}px">${escape(label.text??label.score)}</span>`:'';}).join('');
    }
    group(id){
      const w=this.world,start=w.cells.find(c=>c.id===id);
      if(!start||start.color<0||start.color>5||!w.canRemove()||(w.canRemoveCell&&!w.canRemoveCell(id)))return [];
      if((w.tower||w.water||w.seesaw||w.gears||w.rubik)&&this.cameraQuiet>.12&&!this.slides.size&&this.pendingProjection!==this.lastProjection){
        this.viewLinks=g.ChallengeProjection.links(this.app.scene,this.interactionTiles());this.lastProjection=this.pendingProjection;
      }
      const stamp=w.revision??w.cells.map(c=>c.color).join(',');
      if(!this.graph||this.graph.stamp!==stamp||this.graph.links!==this.viewLinks){
        const cells=new Map(w.cells.map(c=>[c.id,c])),neighbors=new Map();
        // Hidden face contacts must not bridge blocks that only meet at a
        // visible corner. Projection links require a depth-visible edge run.
        const edges=this.viewLinks;
        for(const [a,b] of edges){if(!neighbors.has(a))neighbors.set(a,[]);if(!neighbors.has(b))neighbors.set(b,[]);neighbors.get(a).push(b);neighbors.get(b).push(a);}
        this.graph={stamp,links:this.viewLinks,cells,neighbors};
      }
      const {cells,neighbors}=this.graph;
      const seen=new Set([id]),stack=[id];
      while(stack.length){for(const next of neighbors.get(stack.pop())||[]){const cell=cells.get(next);if(!seen.has(next)&&cell&&cell.color===start.color&&(!w.canRemoveCell||w.canRemoveCell(next))){seen.add(next);stack.push(next);}}}
      return Array.from(seen);
    }
    interactionTiles(){
      if(!this.world.rubik)return this.tiles;
      // Dark cubies are opaque but never playable. Negative IDs let the shared
      // picker stop at their surfaces without creating elimination links.
      return this.tiles.concat(this.world.rubik.bodies.map((body,index)=>({...this.makeTile(body,true),id:-1-index,color:6,pickThrough:false})));
    }
    pick(e){return this.app.scene.pick(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2,this.interactionTiles());}
    setHover(e){
      if(this.intro||this.app.state!=='play'||this.world.rubik?.turn||this.slides.size)return;
      const id=this.pick(e);this.hover=this.group(id);
      if(this.hover.length>1)this.app.showTip(e.clientX,e.clientY,this.hover.length);else this.app.hideTip();
    }
    clearHover(){this.hover=[];this.app.hideTip();}
    click(e){
      if(this.app.state!=='play'||this.intro||this.slides.size||this.world.rubik?.turn)return;
      if(this.world.phase==='aim')return;
      const id=this.pick(e);if(id<0)return;
      if(this.world.phase==='assemble'){const c=this.world.cells.find(c=>c.id===id);this.action('select',c.component);return;}
      const ids=this.group(id);if(ids.length<2){g.Sfx.invalid();return;}
      const oldScore=this.world.score,tiles=this.tiles.filter(t=>ids.includes(t.id));
      const removed=this.world.remove(ids);
      if(!removed.length)return;
      for(const t of tiles){this.popEffects.push({tile:t,time:0});this.app.scene.particles.burst(t.center,COLORS[t.color],Math.min(10,60/tiles.length),{speed:1.8,size:.045,life:.5});}
      this.clearHintView();this.readMoves();this.hint=[];this.hover=[];this.viewLinks=[];this.lastProjection='';this.app.hideTip();
      g.Sfx.pop(removed.length);this.app.toast(tiles[0].center,'+'+(this.world.score-oldScore));
      this.syncHud();this.checkResult();
    }
    readMoves(){
      for(const move of this.world.moves||[]){const id=move.toId??move.id??move.to;if(typeof id==='number'&&Array.isArray(move.from))this.slides.set(id,{from:move.from.slice(),time:0});}
      this.world.moves=[];
    }
    hintGroup(){
      if(this.app.state!=='play'||this.intro)return;
      if(this.hintFocus&&this.hint.length&&this.cameraQuiet<.12)return;
      let best=[],bestRank=-Infinity;const seen=new Set(),ball=this.world.marble?.position;
      for(const c of this.world.cells){
        if(c.color<0||seen.has(c.id))continue;const group=this.group(c.id);group.forEach(id=>seen.add(id));if(group.length<2)continue;
        const rank=ball?(c.center[1]>ball[1]+.3?-100:0)-Math.hypot(c.center[0]-ball[0],c.center[1]-ball[1]):group.length;
        if(rank>bestRank){best=group;bestRank=rank;}
      }
      this.hint=best.length>1?best:[];
      if(this.hint.length){
        if(!this.hintFocus)this.hintZoom=this.app.zoom;
        const cells=this.world.cells.filter(c=>this.hint.includes(c.id));
        this.hintFocus=[0,1,2].map(axis=>cells.reduce((sum,c)=>sum+c.center[axis],0)/cells.length);
        this.app.zoom=1;const slider=$('zoomSlider');if(slider)slider.value=100;
      }
      else this.clearHintView();
      this.message=this.hint.length?'已标出 '+this.hint.length+' 块，点击消除。':'暂无同色组合。可转动视角拼接，或操作本关机关。';
      $('hintStatus').textContent=this.message;this.syncHud();
    }
    action(name,value){
      if(this.app.state!=='play'||this.intro||this.world.rubik?.turn||(name==='turn'&&this.slides.size))return;
      this.clearHintView();
      if(name==='finish'){if(this.geometryQuiet<.6||this.hasPotentialMoves())return;this.world.finish('no-moves');}
      else if(name==='retry'){this.app.restart();return;}
      else {const result=this.world.action(name,value);if(typeof result==='string'){this.message=result;this.messageUntil=this.elapsed+2;this.app.toast(this.focus,result);}}
      this.assembly?.afterAction(name);
      if(this.level===8&&['add','remove-component','reset','undo','translate','rotate','snap','complete'].includes(name))this.refit();
      this.hover=[];this.hint=[];this.lastProjection='';this.controlsKey='';this.readMoves();this.controls();this.syncHud();this.checkResult();
    }
    hasPotentialMoves(){
      const w=this.world;
      if(!w.canRemove()||this.slides.size||w.rubik?.turn||w.projectile)return true;
      const cells=w.cells.filter(c=>c.color>=0&&c.color<6&&!c.immutable),colors=new Set();let duplicate=false;
      for(const c of cells){if(colors.has(c.color))duplicate=true;colors.add(c.color);}
      if(!duplicate)return false;
      // Rotation and mechanism controls can still bring like colors together.
      // A fixed-view seesaw has no such rotation: test its settled contacts instead.
      if(!w.seesaw)return true;
      if(this.geometryQuiet<.6||w.seesaw.moving)return true;
      const eligible=new Map(cells.map(c=>[c.id,c]));
      return w.contacts().concat(this.viewLinks).some(([a,b])=>eligible.has(a)&&eligible.has(b)&&eligible.get(a).color===eligible.get(b).color);
    }
    saveBest(){
      if(!this.resultShown||this.world.result!=='win')return;
      const score=this.world.score;if(!Number.isFinite(score)||score<=0)return;
      const p=this.app.progressFor('challenge');p.best=p.best||{};
      if(score<=(Number(p.best[this.level])||0))return;
      p.best[this.level]=score;
      try{g.localStorage.setItem((this.app.storagePrefix||'popstar3d')+'.progress.challenge.v2',JSON.stringify(p));}catch(e){}
    }
    checkResult(){
      if(this.resultShown||!this.world.result)return;
      if(!this.ending){
        if(this.world.result==='win')this.world.awardRemainder();
        this.clearHintView();this.endHidden=new Set();
        const tiles=this.world.cells.filter(c=>c.color>=0&&c.color<6).map(c=>this.makeTile(c));
        const items=tiles.map((tile,i)=>({tile,delay:tiles.length<=13?i*.12:0,popped:false}));
        this.ending={time:0,items,duration:this.app.reduceMotion?0:(tiles.length<=13?Math.max(0,tiles.length-1)*.12:0)+.65};
        if(this.ending.duration){this.app.state='settling';return;}
      }
      if(this.ending.time<this.ending.duration)return;
      this.resultShown=true;const won=this.world.result==='win';this.app.state=won?'clear':'over';
      this.app.score=this.world.score;this.app.target=this.world.target;this.app.hideTip();
      this.saveBest();
      if(won){
        const p=this.app.progressFor('challenge');p.cleared[this.level]=0;p.next=Math.min(12,Math.max(p.next,this.level+1));p.score=0;
        p.best=p.best||{};
        p.best[this.level]=Math.max(Number(p.best[this.level])||0,this.world.score);
        try{g.localStorage.setItem((this.app.storagePrefix||'popstar3d')+'.progress.challenge.v2',JSON.stringify(p));}catch(e){}
        g.Sfx.levelClear();
      }else g.Sfx.gameOver();
      this.app.overlay(`<h2 class="ov-title ${won?'win':'lose'}">本关结束</h2><p class="ov-sub">第 ${this.level} 关 · ${NAMES[this.level-1]}</p><div class="ov-rows"><div class="ov-row big"><span>本关得分</span><b>${this.world.score}</b></div></div><p class="ov-sub">${escape(this.world.status)}</p><div class="ov-actions">${this.level<11?'<button class="ov-btn" data-act="next">下一关 · 从 0 分开始</button>':''}<button class="ov-btn plain" data-act="restart">重玩本关</button><button class="ov-btn plain" data-act="challengeSelect">返回挑战选关</button></div>`);
    }
    help(entry=false){
      if(this.app.state!=='play')return;
      this.app.rememberHelpReturn();
      this.app.state='paused';
      const viewHelp=this.level===11?'拖动可左右、上下平移视角，正面方向固定；滚轮、双指或左侧滑杆缩放。横梁的倾斜表示真实的失衡。':'拖动旋转，滚轮或左侧滑杆缩放。视角拼接始终开启，也可转动视角让可见边缘相接。';
      const rubikHelp=this.level===8?'白色箭头转动正对你的面上的行或列；拖动魔方查看其他面的箭头。金色箭头表示重力方向。':'';
      this.app.overlay(`<h2 class="ov-title">${NAMES[this.level-1]}</h2><div class="ov-help"><p>${escape(this.world.info())}</p><p>${viewHelp}${rubikHelp}至少两个同色块共面接触时可消除，只碰角或棱不算实体相邻。</p><p>不限时，每关从0分开始；完成本关后保存最高分，中途退出不保存。无后续配对机会时自动结算：剩13块奖励0分，12至1块奖励100至1200分，清空奖励2000分。</p><p>点击“！”可重新查看说明，说明打开期间场景暂停。</p></div><div class="ov-actions"><button class="ov-btn" data-act="resume">我知道了</button></div>`);
    }
    bindControls(){
      const panel=$('challengePanel');
      panel.onclick=e=>{const btn=e.target.closest('[data-challenge]');if(!btn)return;const action=btn.dataset.challenge;
        let value=btn.dataset.value;
        if(action==='translate')value={axis:btn.dataset.axis,delta:Number(btn.dataset.delta)};
        if(action==='rotate')value={axis:btn.dataset.axis,angle:Math.PI/6};
        if(action==='shift')value={side:btn.dataset.side,delta:Number(btn.dataset.delta)};
        this.action(action,value);
      };
      panel.oninput=e=>{
        if(e.target.dataset.aim&&this.app.state==='play'&&!this.intro){const aim={...this.world.aim};aim[e.target.dataset.aim]=Number(e.target.value);this.world.action('aim',aim);this.syncHud();}
      };
      panel.onchange=e=>{if(e.target.id==='challengeComponent')this.action('select',Number(e.target.value));};
    }
    controls(){
      const w=this.world;
      const key=w.phase+'|'+w.cells.length+'|'+w.selected+'|'+Boolean(w.assemblyPending)+'|'+w.marble?.released+'|'+w.marble?.drops;
      if(key===this.controlsKey)return;this.controlsKey=key;
      let html='';
      if(w.phase==='assemble'&&this.level!==8){
        const used=new Set((w.components||[]).map(c=>c.name||c.shape));
        html=`<div class="challenge-parts" aria-label="几何体模型托盘">${SHAPES.map(([shape,label])=>button('add',`${g.ChallengeThumbnail?g.ChallengeThumbnail(shape):''}<span>${label}</span>`,`class="challenge-part" aria-label="添加${label}" data-value="${shape}" ${used.has(shape)?'disabled':''}`)).join('')}</div>`;
        const comps=w.components||[];
        html+=`<div class="challenge-tools"><label>当前零件 <select id="challengeComponent">${comps.map(c=>`<option value="${c.id}" ${c.id===w.selected?'selected':''}>${escape(SHAPES.find(s=>s[0]===(c.name||c.shape))?.[1]||c.name||'零件')} ${c.id+1}</option>`).join('')}</select></label>${button('undo','撤销')}${button('snap','吸附拼接')}${button('remove-component','移除')}${button('complete','完成拼接','class="primary"')}</div><details class="challenge-adjust"><summary>移动与旋转零件</summary><div class="challenge-tools">${['x','y','z'].map((axis,i)=>button('translate',['左','下','后'][i],`data-axis="${axis}" data-delta="-.25"`)+button('translate',['右','上','前'][i],`data-axis="${axis}" data-delta=".25"`)+button('rotate','旋转 '+axis.toUpperCase(),`data-axis="${axis}"`)).join('')}${button('reset','重置拼接')}</div></details>`;
      }else if(this.level===12){
        html=`<div class="challenge-tools"><span>拖动顶部发射器调角度 · 白箭头预览碰撞</span>${button('release','发射弹珠',`class="primary" ${w.marble.released||w.marble.drops>=3?'disabled':''}`)}<span id="marbleStatus"></span></div>`;
      }
      $('challengeControls').innerHTML=html;
      this.hasControls=Boolean(html);$('challengePanel').classList.toggle('hidden',!this.hasControls);
    }
    syncHud(){
      const w=this.world,a=this.app;a.score=w.score;a.target=w.target;
      $('hudMode').textContent='挑战 · '+NAMES[this.level-1];$('hudLevel').textContent=this.level;
      $('hudScore').textContent=w.score;$('hudTarget').textContent='';$('hudRemain').textContent=w.phase==='assemble'?w.cells.length:w.remaining();
      $('hudTimerBox').classList.add('hidden');$('progFill').style.width='0%';
      $('hudStars').innerHTML='';
      if(this.messageUntil&&this.elapsed>this.messageUntil)this.message='';
      $('hintStatus').textContent=this.message||w.status||'';
      if($('throwGauge')){
        $('throwGauge').classList.toggle('hidden',this.level!==10||w.phase!=='aim');
        const power=Math.round(100*(this.thrower?.power||0));
        $('throwGaugeValue').textContent=power+'%';$('throwGaugeFill').style.width=power+'%';$('throwGaugeTrack').setAttribute('aria-valuenow',power);
      }
      if($('seesawCounts')){
        $('seesawCounts').classList.toggle('hidden',this.level!==11);
        if(w.seesaw){
          $('seesawLeftCount').textContent='左侧 '+(w.seesaw.leftCount??0)+' 块';$('seesawRightCount').textContent='右侧 '+(w.seesaw.rightCount??0)+' 块';
          $('seesawMultiplier').textContent=(w.seesaw.balanced?'平衡':'倾斜')+' ×'+(w.seesaw.multiplier??1);
        }
      }
      if(this.level===12&&$('marbleStatus')){
        const m=w.marble,c=COLORS[m.color];
        const route=m.released?(m.stillTime>.7?'前路受阻，消除附近同色块开路':'弹珠行进中，可继续消除开路'):'先消除开口，保留斜面引导反弹';
        $('marbleStatus').innerHTML='<i class="ammo-color" style="background:rgb('+c.map(v=>Math.round(v*255)).join(',')+')"></i>'+Math.min(3,m.drops+1)+' / 3 次 · '+route;
      }
      $('waterGauge')?.classList.add('hidden');
      const towerStatus=$('towerStatus');
      if(towerStatus){towerStatus.classList.toggle('hidden',this.level!==4);if(w.tower)towerStatus.textContent=w.status;}
      const ammo=$('challengeAmmo');if(ammo){const next=w.ammo?.[0],color=COLORS[next];ammo.innerHTML=(color?'<i class="ammo-color" style="background:rgb('+color.map(c=>Math.round(c*255)).join(',')+')"></i>':'')+'剩余 '+(Array.isArray(w.ammo)?w.ammo.length:0)+' 块';}
      this.controls();
    }
  }
  g.ChallengeGame=ChallengeGame;g.ChallengeNames=NAMES;
})(typeof window!=='undefined'?window:globalThis);

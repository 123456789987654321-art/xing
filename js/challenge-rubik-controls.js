/* Face-fixed, projected controls for quarter turns and gravity. */
(function(g){
  'use strict';
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const point=(n,d,r,z,y,x)=>n.map((v,i)=>v*z+d[i]*y+r[i]*x);
  class ChallengeRubikControls{
    constructor(game){
      this.game=game;this.targets=[];this.active=new Set();this.items=[];this.gravity=[];
      this.holder=document.createElement('div');this.holder.className='rubik-controls';this.holder.setAttribute('aria-label','魔方转动');document.body.appendChild(this.holder);
      const names=['前','右','后','左','上','下'];
      game.world.rubik.faces.forEach((face,index)=>{
        for(const row of [true,false])for(const layer of [-1,0,1])for(const side of [-1,1]){
          const tangent=row?face.r:face.d,axisVector=row?face.d:face.r;
          const axis=axisVector.findIndex(v=>Math.abs(v)>.5),direction=Math.sign(dot(cross(axisVector,face.n),tangent)*side*axisVector[axis]);
          const item={face,row,layer,side,turn:{axis,layer:layer*axisVector[axis],direction}};
          const node=document.createElement('button');node.type='button';node.className='rubik-turn';
          node.dataset.axis=axis;node.dataset.layer=item.turn.layer;node.dataset.direction=direction;
          node.setAttribute('aria-label',`${names[index]}面第${layer+2}${row?'行':'列'}${side<0?'反向':'正向'}转动`);
          node.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
          node.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
          node.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(this.enabled())game.action('turn',item.turn);});
          item.node=node;this.items.push(item);this.holder.appendChild(node);
        }
        const node=document.createElement('span');node.className='rubik-gravity';node.innerHTML='<span>↓</span><small>重力</small>';node.setAttribute('aria-label',names[index]+'面重力方向');this.holder.appendChild(node);this.gravity.push({face,node});
      });
    }
    enabled(){const g=this.game;return g.app.state==='play'&&!g.intro&&!g.world.rubik.turn&&!g.slides.size;}
    visible(face){const eye=this.game.app.scene.eye;return dot(face.n,eye)-this.game.world.rubik.surface>.08;}
    render(){
      const g=this.game,sc=g.app.scene,rubik=g.world.rubik,enabled=this.enabled();this.targets=[];
      const dominant=rubik.faces.filter(face=>this.visible(face)).sort((a,b)=>dot(b.n,sc.eye)-dot(a.n,sc.eye))[0];
      const width=sc.w/sc.dpr||window.innerWidth,height=sc.h/sc.dpr||window.innerHeight;
      const clampPoint=(x,y)=>[Math.max(24,Math.min(width-24,x)),Math.max(24,Math.min(height-24,y))];
      const free=(x,y)=>this.targets.every(t=>Math.abs(t.x-x)>=44||Math.abs(t.y-y)>=44);
      for(const item of this.items){
        const {face,row,layer,side,node}=item;node.hidden=face!==dominant||!!g.intro;node.disabled=!enabled;if(node.hidden)continue;
        const center=sc.project(point(face.n,face.d,face.r,rubik.halfExtent,row?layer*rubik.pitch:0,row?0:layer*rubik.pitch));
        const edge=sc.project(point(face.n,face.d,face.r,rubik.halfExtent,row?layer*rubik.pitch:side*rubik.halfExtent,row?side*rubik.halfExtent:layer*rubik.pitch));
        if(!center||!edge){node.hidden=true;continue;}
        const dx=edge[0]-center[0],dy=edge[1]-center[1],length=Math.hypot(dx,dy);if(length<4){node.hidden=true;continue;}
        const desired=clampPoint(edge[0]+dx/length*25,edge[1]+dy/length*25);let [x,y]=desired;
        // Keep each touch area inside the viewport and separate near foreshortened edges.
        if(!free(x,y)){
          search:for(let radius=8;radius<=200;radius+=8)for(let step=0;step<16;step++){
            const angle=Math.atan2(dy,dx)+(step%2?1:-1)*Math.ceil(step/2)*Math.PI/8;
            const candidate=clampPoint(desired[0]+Math.cos(angle)*radius,desired[1]+Math.sin(angle)*radius);
            if(free(...candidate)){[x,y]=candidate;break search;}
          }
        }
        node.style.left=x+'px';node.style.top=y+'px';node.style.setProperty?.('--arrow-angle',Math.atan2(dy,dx)+'rad');
        this.targets.push({...item,x,y});
      }
      for(const {face,node} of this.gravity){
        node.hidden=!this.visible(face)||!!g.intro;const p=sc.project(point(face.n,face.d,face.r,rubik.halfExtent+.02,0,0)),q=sc.project(point(face.n,face.d,face.r,rubik.halfExtent+.02,.3,0));
        if(!p||!q){node.hidden=true;continue;}node.style.left=p[0]+'px';node.style.top=p[1]+'px';node.style.setProperty?.('--gravity-angle',(Math.atan2(q[1]-p[1],q[0]-p[0])-Math.PI/2)+'rad');
      }
    }
    pointerDown(e){
      if(e.button!==undefined&&e.button!==0)return false;
      const target=this.targets.find(t=>Math.abs(t.x-e.clientX)<=22&&Math.abs(t.y-e.clientY)<=22);if(!target)return false;
      this.active.add(e.pointerId);if(this.enabled())this.game.action('turn',target.turn);return true;
    }
    pointerMove(e){return this.active.has(e.pointerId);}
    pointerUp(e){return this.active.delete(e.pointerId);}
    cancel(){this.active.clear();}
    dispose(){this.holder.remove();this.cancel();}
  }
  g.ChallengeRubikControls=ChallengeRubikControls;
})(typeof window!=='undefined'?window:globalThis);

/* Continuous decorative meshes for the water puzzle; never adds playable cells. */
(function(root){
  'use strict';
  const I=[1,0,0,0,1,0,0,0,1],TAU=Math.PI*2;
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const scale=(a,s)=>a.map(v=>v*s),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const norm=a=>scale(a,1/(Math.hypot(...a)||1));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const clamp=n=>Math.max(0,Math.min(1,n));
  function tube(points,radius,segments=32,capped=false){
    const vertices=[],faces=[];
    points.forEach((p,j)=>{
      const tangent=norm(sub(points[Math.min(j+1,points.length-1)],points[Math.max(0,j-1)]));
      const ref=Math.abs(tangent[2])<.95?[0,0,1]:[0,1,0];
      const u=norm(cross(tangent,ref)),v=cross(tangent,u);
      for(let i=0;i<segments;i++)vertices.push(add(p,add(scale(u,radius*Math.cos(TAU*i/segments)),scale(v,radius*Math.sin(TAU*i/segments)))));
      if(j)for(let i=0;i<segments;i++)faces.push([(j-1)*segments+i,(j-1)*segments+(i+1)%segments,j*segments+(i+1)%segments,j*segments+i]);
    });
    if(capped){faces.push(Array.from({length:segments},(_,i)=>segments-1-i));faces.push(Array.from({length:segments},(_,i)=>(points.length-1)*segments+i));}
    return {vertices,faces};
  }
  function roundedPath(points){
    const result=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const p=points[i],prev=points[i-1],next=points[i+1];
      const a=add(p,scale(norm(sub(prev,p)),Math.min(.22,Math.hypot(...sub(prev,p))*.2)));
      const b=add(p,scale(norm(sub(next,p)),Math.min(.22,Math.hypot(...sub(next,p))*.2)));
      for(let k=0;k<=8;k++){const t=k/8;result.push(add(add(scale(a,(1-t)**2),scale(p,2*t*(1-t))),scale(b,t*t)));}
    }
    result.push(points.at(-1));return result;
  }
  function box(){return {vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]};}
  function flameMesh(bend){
    const vertices=[],faces=[],rows=[[0,.20],[.12,.34],[.32,.32],[.53,.24],[.72,.15],[.88,.065],[1,.004]],n=16;
    rows.forEach(([h,r],j)=>{
      for(let i=0;i<n;i++){const a=TAU*i/n;vertices.push([r*Math.cos(a)+bend*h*h,h,r*Math.sin(a)]);}
      if(j)for(let i=0;i<n;i++)faces.push([(j-1)*n+i,j*n+i,j*n+(i+1)%n,(j-1)*n+(i+1)%n]);
    });
    faces.push(Array.from({length:n},(_,i)=>i));faces.push(Array.from({length:n},(_,i)=>rows.length*n-1-i));
    return {vertices,faces};
  }
  function create(world){
    if(world.waterVisuals)return world.waterVisuals;
    const w=world.water,layout=w.layout||{},min=layout.tankMin||[-3.6,0,-1.4],max=layout.tankMax||[-.8,5.6,1.4];
    const pipePoints=layout.pipePoints||[[-2.2,0,0],[-2.2,-1,0],[1,-2.4,0],[2,-2.4,0]],radius=layout.pipeRadius||.4;
    const fire=layout.fireCenter||[3.4,-4.25,0],path=roundedPath(pipePoints),base=box();
    const visual={flames:[],embers:[],ripples:[],elapsed:0,layout:{min,max,fire},decorations:[]};
    const addDeco=(poly,center,rgb,alpha=1,size=[1,1,1])=>{
      const d={poly,center:center.slice(),rgb,alpha,size:size.slice(),basis:I.slice()};world.decorations.push(d);visual.decorations.push(d);return d;
    };
    const rect=(center,size,rgb,alpha)=>addDeco(base,center,rgb,alpha,size);
    const line=(a,b,r=.018,color=[.34,.77,.88],alpha=.8)=>addDeco(tube([a,b],r,8,true),[0,0,0],color,alpha);
    const middle=mix(min,max,.5),width=max[0]-min[0],height=max[1]-min[1],depth=max[2]-min[2];
    for(const x of [min[0],max[0]])rect([x,middle[1],middle[2]],[.025,height,depth],[.45,.82,.94],.10);
    for(const z of [min[2],max[2]])rect([middle[0],middle[1],z],[width,height,.025],[.45,.82,.94],.075);
    for(const x of [min[0],max[0]])for(const z of [min[2],max[2]])line([x,min[1],z],[x,max[1],z]);
    for(const y of [min[1],max[1]]){
      for(const x of [min[0],max[0]])line([x,y,min[2]],[x,y,max[2]]);
      for(const z of [min[2],max[2]])line([min[0],y,z],[max[0],y,z]);
    }
    // The floor consists of four panels plus a square-to-circle collar. Its
    // center is genuinely absent, matching the open pipe diameter exactly.
    const hole=pipePoints[0],floorY=min[1]-.012;
    for(const [a,b] of [[min[0],hole[0]-radius],[hole[0]+radius,max[0]]])if(b>a)rect([(a+b)/2,floorY,middle[2]],[b-a,.024,depth],[.30,.64,.76],.23);
    for(const [a,b] of [[min[2],hole[2]-radius],[hole[2]+radius,max[2]]])if(b>a)rect([hole[0],floorY,(a+b)/2],[radius*2,.024,b-a],[.30,.64,.76],.23);
    const collar={vertices:[],faces:[]};
    for(let i=0;i<32;i++){
      const a=TAU*i/32,c=Math.cos(a),s=Math.sin(a),outer=radius/Math.max(Math.abs(c),Math.abs(s));
      collar.vertices.push([hole[0]+radius*c,floorY,hole[2]+radius*s],[hole[0]+outer*c,floorY,hole[2]+outer*s]);
    }
    for(let i=0;i<32;i++){
      const face=[i*2,i*2+1,((i+1)%32)*2+1,((i+1)%32)*2];
      const unique=face.filter((index,j)=>!face.slice(0,j).some(other=>Math.hypot(...sub(collar.vertices[index],collar.vertices[other]))<1e-8));
      if(unique.length>=3)collar.faces.push(unique);
    }
    addDeco(collar,[0,0,0],[.30,.64,.76],.23);
    visual.pipe=addDeco(tube(path,radius),[0,0,0],[.65,.95,1],.28);
    visual.pipeWater=addDeco(tube(path,radius*.78),[0,0,0],[.12,.67,1],0);
    // Four restrained continuous highlights establish roundness without a grid.
    for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const edge=path.map((p,j)=>{const tangent=norm(sub(path[Math.min(j+1,path.length-1)],path[Math.max(0,j-1)]));return add(p,[tangent[1]*radius*Math.cos(angle),-tangent[0]*radius*Math.cos(angle),radius*Math.sin(angle)]);});
      addDeco(tube(edge,.020,8),[0,0,0],[.72,.97,1],.88);
    }
    for(const end of [0,path.length-1]){
      const p=path[end],tangent=norm(sub(path[Math.min(end+1,path.length-1)],path[Math.max(0,end-1)])),u=norm(cross(tangent,[0,0,1]));
      const rim=Array.from({length:33},(_,i)=>add(p,add(scale(u,radius*Math.cos(TAU*i/32)),[0,0,radius*Math.sin(TAU*i/32)])));
      addDeco(tube(rim,.025,8),[0,0,0],[.72,.97,1],.95);
    }
    visual.waterVolume=rect(middle,[width-.08,height-.1,depth-.08],[.10,.72,1],.66);
    visual.waterSurface=rect([middle[0],max[1]-.15,middle[2]],[width-.08,.025,depth-.08],[.26,.86,1],.68);
    for(let i=0;i<5;i++){
      const z=min[2]+.35+i*(depth-.7)/4;
      const points=Array.from({length:25},(_,j)=>[min[0]+.16+j*(width-.32)/24,0,z+.055*Math.sin(j*.5+i)]);
      const ripple=addDeco(tube(points,.012,6),[0,0,0],[.68,.96,1],.8);
      ripple.phase=i;visual.ripples.push(ripple);
    }
    const outlet=pipePoints.at(-1),arc=Array.from({length:25},(_,i)=>{
      const t=i/24;return [outlet[0]+(fire[0]-outlet[0])*t,outlet[1]-.10*t-(outlet[1]-fire[1]-.10)*t*t,fire[2]*t+outlet[2]*(1-t)];
    });
    visual.jet=addDeco(tube(arc,.09,12),[0,0,0],[.20,.75,1],0);
    visual.jetHighlight=addDeco(tube(arc.map(p=>add(p,[0,.025,.035])),.025,8),[0,0,0],[.78,.96,1],0);
    visual.leak=addDeco(tube([[0,0,0],[.20,-.5,0],[.35,-1.4,0]],.065,10),[0,0,0],[.24,.7,1],0);
    for(let i=0;i<3;i++){
      const angle=i*Math.PI/3+.25,a=[Math.cos(angle)*.64,-.05,Math.sin(angle)*.64],b=[-a[0],-.05,-a[2]];
      addDeco(tube([add(fire,a),add(fire,b)],.14,12,true),[0,0,0],i%2?[.23,.10,.045]:[.34,.17,.075]);
      for(const p of [a,b])addDeco(tube([add(fire,p),add(add(fire,p),scale(norm(p),.012))],.115,12,true),[0,0,0],[.12,.055,.028]);
    }
    const colors=[[1,.26,.035],[1,.40,.045],[1,.60,.065],[1,.83,.22],[1,.97,.62]];
    for(let i=0;i<9;i++){
      const angle=i*2.4,outer=i<5,r=outer?.30:.17;
      // Keep amber/cream cores visibly in front of the red backing lobes.
      // The side and rear lobes still give the fire a full volume when rotated.
      const pos=add(fire,[Math.cos(angle)*r,.03,outer?-.18+Math.sin(angle)*.12:.31+Math.sin(angle)*.035]);
      const d=addDeco(flameMesh(Math.sin(angle)*.25),pos,colors[outer?i%3:3+i%2],.94,[outer?1.12:.74,outer?1.15+(i%3)*.22:.82+(i%2)*.2,outer?1.12:.57]);
      d.baseSize=d.size.slice();d.baseCenter=pos;d.phase=angle;visual.flames.push(d);
    }
    const emberMesh=flameMesh(.08);
    for(let i=0;i<12;i++){const d=addDeco(emberMesh,fire,[1,.64,.08],.75,[.08,.10,.08]);d.phase=i/12;visual.embers.push(d);}
    world.waterVisuals=visual;
    world.waterLabels=[{text:'水箱',center:[middle[0],max[1]+.35,0]},{text:'出水口',center:[outlet[0],outlet[1]+.58,0]}];
    update(world,0);return visual;
  }
  function update(world,dt){
    const v=world.waterVisuals,w=world.water;if(!v||!w)return;
    v.elapsed+=Math.max(0,Number(dt)||0);const t=v.elapsed,level=clamp(w.amount/Math.max(1,w.capacity||100)),heat=1-clamp(w.progress||0),{min,max,fire}=v.layout;
    const waterHeight=Math.max(.008,(max[1]-min[1]-.18)*level);
    v.waterVolume.size[1]=waterHeight;v.waterVolume.center[1]=min[1]+waterHeight/2;
    v.waterSurface.center[1]=min[1]+waterHeight;v.waterSurface.alpha=level>0?.68+.025*Math.sin(t*1.8):0;
    v.waterVolume.alpha=level>0?.66:0;
    for(const ripple of v.ripples){ripple.center[1]=min[1]+waterHeight+.025;ripple.center[2]=.035*Math.sin(t*1.5+ripple.phase);ripple.alpha=level>0?.66+.12*Math.sin(t*2+ripple.phase):0;}
    const flowing=Boolean(w.flowing&&level>0);v.pipeWater.alpha=flowing?.24:0;
    v.jet.alpha=flowing?.78:0;v.jetHighlight.alpha=flowing?.70:0;
    v.leak.alpha=w.leaking&&level>0?.7:0;v.leak.center=(w.leakPosition||[-2.2,1.2,0]).slice();
    for(const f of v.flames){
      const flicker=1+.075*Math.sin(t*8+f.phase)+.035*Math.sin(t*13-f.phase);
      f.size=f.baseSize.map((n,i)=>n*(i===1?heat*flicker:Math.sqrt(heat)*(1+.025*Math.sin(t*5+f.phase))));
      f.center=add(f.baseCenter,[.04*Math.sin(t*3+f.phase)*heat,0,.025*Math.cos(t*4+f.phase)*heat]);f.alpha=heat>0?.94:0;
    }
    for(const ember of v.embers){const age=(t*.36+ember.phase)%1;ember.center=add(fire,[Math.sin(ember.phase*TAU+age*3)*(.18+age*.3),.25+age*2.1,.08+Math.cos(ember.phase*TAU)*.24]);ember.alpha=heat*(1-age)*.8;}
  }
  root.ChallengeWaterVisual={create,update};
})(typeof window!=='undefined'?window:globalThis);

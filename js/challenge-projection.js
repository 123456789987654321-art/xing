/* Depth-tested adjacency of visible polyhedron faces, in CSS screen pixels. */
(function(g){
  'use strict';
  const identity=[1,0,0,0,1,0,0,0,1];
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  function worldVertices(tile){
    const c=tile.renderCenter||tile.center,e=tile.basis||identity,s=tile.size||[1,1,1];
    return tile.poly.vertices.map(p=>[0,1,2].map(k=>c[k]+e[k]*p[0]*s[0]+e[k+3]*p[1]*s[1]+e[k+6]*p[2]*s[2]));
  }
  function links(scene,tiles){
    const width=scene.w/scene.dpr,height=scene.h/scene.dpr,bin=32;
    const grid=new Map(),faces=[],shared=new Map(),colors=new Map();
    const pointKey=p=>p.map(v=>Math.round(v*1e7)).join(',');
    for(const tile of tiles){
      if(tile.color<0||tile.pickThrough||!tile.poly)continue;
      colors.set(tile.id,tile.color);
      const vertices=worldVertices(tile),screen=vertices.map(p=>scene.project(p));
      const valid=screen.filter(p=>p&&p.every(Number.isFinite));
      if(!valid.length)continue;
      const bounds=[Math.min(...valid.map(p=>p[0])),Math.min(...valid.map(p=>p[1])),Math.max(...valid.map(p=>p[0])),Math.max(...valid.map(p=>p[1]))];
      const entry={tile,bounds};
      for(let x=Math.max(0,Math.floor(bounds[0]/bin));x<=Math.min(Math.floor(width/bin),Math.floor(bounds[2]/bin));x++)
        for(let y=Math.max(0,Math.floor(bounds[1]/bin));y<=Math.min(Math.floor(height/bin),Math.floor(bounds[3]/bin));y++){
          const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(entry);
        }
      for(const indices of tile.poly.faces){
        if(indices.length<3)continue;
        const world=indices.map(i=>vertices[i]),key=world.map(pointKey).sort().join('|');
        shared.set(key,(shared.get(key)||0)+1);
        const normal=cross(sub(world[1],world[0]),sub(world[2],world[0]));
        if(scene.eye&&dot(normal,sub(scene.eye,world[0]))<=1e-10)continue;
        const points=indices.map(i=>screen[i]);
        if(points.some(p=>!p||!p.every(Number.isFinite)))continue;
        faces.push({points,key});
      }
    }
    const cache=new Map(),found=new Map(),edges=new Set();
    function pick(x,y){
      if(x<0||y<0||x>width||y>height)return -1;
      const key=x.toFixed(4)+','+y.toFixed(4);
      if(cache.has(key))return cache.get(key);
      const candidates=(grid.get(Math.floor(x/bin)+','+Math.floor(y/bin))||[])
        .filter(({bounds:b})=>x>=b[0]-.001&&x<=b[2]+.001&&y>=b[1]-.001&&y<=b[3]+.001).map(e=>e.tile);
      const id=candidates.length?scene.pick(x/width*2-1,1-y/height*2,candidates):-1;
      cache.set(key,id);return id;
    }
    for(const {points,key} of faces){
      if(shared.get(key)>1)continue; // Internal physical faces cannot bound the visible image.
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        const edgeKey=[a.map(v=>v.toFixed(4)).join(','),b.map(v=>v.toFixed(4)).join(',')].sort().join('|');
        if(edges.has(edgeKey))continue;edges.add(edgeKey);
        const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if(length<3)continue;
        // Tiny opposing probes reject visible gaps and preserve narrow triangles.
        const nx=-dy/length*.02,ny=dx/length*.02;
        const count=Math.max(4,Math.min(96,Math.ceil(length/2))),step=length/count;
        let previous='',run=0;
        for(let j=1;j<count;j++){
          const t=j/count,x=a[0]+dx*t,y=a[1]+dy*t;
          const one=pick(x+nx,y+ny),two=pick(x-nx,y-ny);
          const low=Math.min(one,two),high=Math.max(one,two),color=colors.get(low);
          const valid=low>=0&&low!==high&&color>=0&&color<6&&color===colors.get(high);
          const pair=valid?low+','+high:'';
          run=pair&&pair===previous?run+1:pair?1:0;previous=pair;
          if(run>=3&&(run-1)*step>=3)found.set(pair,[low,high]);
        }
      }
    }
    return [...found.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  }
  g.ChallengeProjection={links,worldVertices};
})(typeof window!=='undefined'?window:globalThis);

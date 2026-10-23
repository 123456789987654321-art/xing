/* Neutral miniature models, projected from the same solid cells as the game. */
(function(g){
  'use strict';
  const cache=new Map(),yaw=.65,pitch=.48;
  const eye=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const right=[Math.cos(yaw),0,-Math.sin(yaw)];
  const up=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)];
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  g.ChallengeThumbnail=function(shape){
    if(cache.has(shape))return cache.get(shape);
    const faces=new Map();
    for(const cell of g.ChallengeGeometry.make(shape,{size:1,resolution:7,smooth:true}))for(const indices of cell.poly.faces){
      const points=indices.map(i=>cell.poly.vertices[i].map((v,k)=>v+cell.center[k]));
      const key=points.map(p=>p.map(v=>v.toFixed(6)).join(',')).sort().join('|');
      if(faces.has(key)){faces.get(key).shared=true;continue;}
      const n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
      faces.set(key,{points,normal:n,shared:false});
    }
    const visible=[...faces.values()].filter(f=>!f.shared&&dot(f.normal,eye)>1e-8);
    visible.sort((a,b)=>dot(a.points[0],eye)-dot(b.points[0],eye));
    const projected=visible.map(f=>({...f,screen:f.points.map(p=>[dot(p,right),-dot(p,up)])}));
    const all=projected.flatMap(f=>f.screen),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
    const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top,scale=Math.min(86/width,66/height);
    const paths=projected.map(f=>{
      const light=.65+.3*Math.max(0,dot(f.normal,eye)/Math.hypot(...f.normal));
      const color=[164,188,218].map(v=>Math.round(v*light));
      const points=f.screen.map(p=>[(100-width*scale)/2+(p[0]-left)*scale,(80-height*scale)/2+(p[1]-top)*scale].map(v=>v.toFixed(2)).join(',')).join(' ');
      return `<polygon points="${points}" fill="rgb(${color})" stroke="#d9edff" stroke-opacity=".18" stroke-width=".3"/>`;
    }).join('');
    const svg=`<svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">${paths}</svg>`;
    cache.set(shape,svg);return svg;
  };
})(typeof window!=='undefined'?window:globalThis);

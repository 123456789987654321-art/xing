/* 关卡配置与独立机关逻辑，不依赖 DOM/WebGL。 */
(function (g) {
  'use strict';
  const profiles = {
    1: { size: 5, kind: 'normal', title: '经典消除' },
    2: { size: 5, kind: 'rotor', title: '旋转方板' },
    3: { size: 5, kind: 'perspective', title: '视角拼接' }
  };
  g.LevelProfile = (level, mode) => {
    if(mode==='challenge') {
      const names=['三棱锥','圆柱体','球体','高楼营救','三棱柱','棱台','十字双环','魔方消除','啮合齿轮','投射补靶','平衡跷跷板'];
      const n=Math.max(1,Math.min(11,Math.floor(level)));
      return {size:7,kind:'challenge',title:names[n-1]};
    }
    if(mode==='normal') {
      const n=Math.max(1,Math.min(15,Math.floor(level)));
      return {...profiles[(n-1)%3+1],size:5+Math.floor((n-1)/3)};
    }
    const p = profiles[level] || { size: 5, kind: 'normal', title: '经典消除' };
    return { ...p, size: Math.min(8, p.size) };
  };

  class Rotor {
    constructor(board, rnd = Math.random, panelCount = 1) {
      this.board = board;
      this.angle = 0;
      this.elapsed = 0;
      this.holdDuration = 2.4;
      this.turnDuration = 0.8;
      this.panelCount = Math.max(1,Math.min(5,Math.floor(panelCount)));
      this.colors = Int8Array.from({ length: 6*this.panelCount }, () => (rnd() * 6) | 0);
      this.pivot = [board.h + board.pitch / 2, 0, 0];
    }
    update(dt) {
      const cycle = this.holdDuration + this.turnDuration;
      this.elapsed = (this.elapsed + Math.max(0, dt)) % (cycle * 4);
      const step = Math.floor(this.elapsed / cycle);
      const phase = this.elapsed - step * cycle;
      const t = Math.max(0, Math.min(1, (phase - this.holdDuration) / this.turnDuration));
      const eased = t * t * (3 - 2 * t);
      this.angle = (step + eased) * Math.PI / 2;
    }
    center(i) {
      const panel=Math.floor(i/6),local=i%6;
      const p = this.board.pitch, y = (1 - Math.floor(local / 2)) * p, z = (local % 2 - 0.5) * p;
      const angle=this.angle+panel*Math.PI/2;
      const c = Math.cos(angle), s = -Math.sin(angle);
      if(panel===4) {
        const tangent=z-p/2;
        const radius=this.board.h*(Math.abs(c)+Math.abs(s))+p/2;
        return [y,c*radius-s*tangent,s*radius+c*tangent];
      }
      // Orbit clockwise around the host face. At each stop the outer edge
      // is flush; pull inward slightly during turns to keep all corners inside.
      const ac=Math.abs(c),as=Math.abs(s),h=this.board.h;
      const radius=h-1.5*p;
      // An even-width panel on an odd grid needs a half-cell centre offset.
      const size=Math.round(2*h/p);
      const tangent=this.panelCount>1&&size===6?p:size%2 ? -p/2 : 0;
      const limitY=h-p*(1.5*ac+as),limitZ=h-p*(1.5*as+ac);
      // Multiple panels rotate as one rigid layout so neighboring plates never
      // compress into each other. Their outer corners can sweep past the edge
      // during the turn, then align exactly with the grid at the next stop.
      const cy=this.panelCount>1?c*radius-s*tangent:Math.max(-limitY,Math.min(limitY,c*radius-s*tangent));
      const cz=this.panelCount>1?s*radius+c*tangent:Math.max(-limitZ,Math.min(limitZ,s*radius+c*tangent));
      return [this.pivot[0], this.pivot[1]+cy+c*y-s*z, this.pivot[2]+cz+s*y+c*z];
    }
    basis(i = 0) {
      const panel=Math.floor(i/6),angle=this.angle+panel*Math.PI/2;
      const c = Math.cos(angle), s = -Math.sin(angle);
      if(panel===4)return [0,-s,c,1,0,0,0,c,s];
      return [0, -s, c, 0, c, s, -1, 0, 0];
    }
    normal(i=0) {
      return Math.floor(i/6)===4?[0,Math.cos(this.angle),-Math.sin(this.angle)]:[1,0,0];
    }
    neighbors(i) {
      const start=Math.floor(i/6)*6,local=i%6,row = Math.floor(local / 2), col = local % 2, out = [];
      for (let j = 0; j < 6; j++) if (Math.abs(Math.floor(j / 2) - row) + Math.abs(j % 2 - col) === 1) out.push(start+j);
      return out;
    }
    static touching(a,A,b,B,p) {
      const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
      const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const axes=m=>[m.slice(0,3),m.slice(3,6),m.slice(6,9)],aa=axes(A),bb=axes(B);
      const delta=a.map((v,i)=>v-b[i]);let boundary=false;
      for(const axis of [...aa,...bb,...aa.flatMap(u=>bb.map(v=>cross(u,v)))]) {
        const length=Math.hypot(...axis);if(length<1e-8)continue;
        const gap=Math.abs(dot(delta,axis))-p/2*[...aa,...bb].reduce((sum,u)=>sum+Math.abs(dot(u,axis)),0);
        if(gap>1e-7*length)return false;
        if(Math.abs(gap)<1e-7*length&&
          aa.some(u=>Math.abs(Math.abs(dot(u,axis))-length)<1e-7)&&
          bb.some(u=>Math.abs(Math.abs(dot(u,axis))-length)<1e-7))boundary=true;
      }
      if(!boundary)return false;
      // Reject edge/corner-only touches: at least two cube face tangents overlap.
      const tangentOverlaps=aa.filter(axis=>{
        const radius=p/2*[...aa,...bb].reduce((sum,u)=>sum+Math.abs(dot(u,axis)),0);
        return radius-Math.abs(dot(delta,axis))>0.02*p;
      }).length;
      return tangentOverlaps>=2;
    }
    contacts() {
      const key=this.angle+'|'+this.colors.join(',')+'|'+this.board.color.join(',');
      if(this.contactKey===key)return this.contactLinks;
      const contacts=[],p=this.board.pitch,identity=[1,0,0,0,1,0,0,0,1];
      const boxes=Array.from(this.colors,(color,i)=>color>=0?{id:this.board.size+i,center:this.center(i),basis:this.basis(i)}:null).filter(Boolean);
      const close=(a,b)=>a.every((v,k)=>Math.abs(v-b[k])<=1.75*p);
      for(const a of boxes)for(let id=0;id<this.board.size;id++) {
        if(this.board.color[id]<0)continue;
        const b=this.board.cellCenter(id);
        if(close(a.center,b)&&Rotor.touching(a.center,a.basis,b,identity,p))contacts.push([id,a.id]);
      }
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
        const a=boxes[i],b=boxes[j];
        if(Math.floor((a.id-this.board.size)/6)===Math.floor((b.id-this.board.size)/6))continue;
        if(close(a.center,b.center)&&Rotor.touching(a.center,a.basis,b.center,b.basis,p))contacts.push([a.id,b.id]);
      }
      this.contactKey=key;this.contactLinks=contacts;return contacts;
    }
    remaining() { return this.colors.filter(c => c >= 0).length; }
  }
  g.Rotor = Rotor;
  class PerspectivePanel extends Rotor {
    constructor(board, rnd = Math.random, panelCount = 1) {
      super(board, rnd, panelCount);
      this.projected = true;
      this.links = [];
    }
    update() {} // The panel stays in world space; only the player's view moves.
    center(i) {
      const p = this.board.pitch,local=i%6,panel=Math.floor(i/6);
      const x=this.board.h+p/2+1.2+(local%2)*p,y=(1-Math.floor(local/2))*p,z=-0.8;
      return [[x,y,z],[-z,y,x],[-x,y,-z],[z,y,-x],[y,x,z]][panel];
    }
    basis() { return [1,0,0,0,1,0,0,0,1]; }
    normal(i=0) {return [[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,1,0]][Math.floor(i/6)];}
    contacts() { return this.links; }
    static hull(points) {
      const sorted = points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      const cross = (a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const half = list => { const out=[]; for(const p of list) { while(out.length>1&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p); }out.pop();return out; };
      return half(sorted).concat(half(sorted.slice().reverse()));
    }
    static edgesJoin(a,b) { return PerspectivePanel.seams(a,b).length > 0; }
    static seams(a,b) {
      const seams=[];
      if(a.length<3||b.length<3)return seams;
      const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[1]))];
      const A=bounds(a),B=bounds(b);
      if(A[0]>B[1]+2||B[0]>A[1]+2||A[2]>B[3]+2||B[2]>A[3]+2)return seams;
      for(let i=0;i<a.length;i++) {
        const p=a[i],q=a[(i+1)%a.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);
        if(len<3)continue;
        const u=[(q[0]-p[0])/len,(q[1]-p[1])/len],n=[-u[1],u[0]];
        const along=v=>(v[0]-p[0])*u[0]+(v[1]-p[1])*u[1];
        const across=v=>(v[0]-p[0])*n[0]+(v[1]-p[1])*n[1];
        for(let j=0;j<b.length;j++) {
          const r=b[j],s=b[(j+1)%b.length],other=Math.hypot(s[0]-r[0],s[1]-r[1]);
          if(other<3)continue;
          // Clockwise hulls must have opposing parallel edges at a seam.
          if(((s[0]-r[0])*u[0]+(s[1]-r[1])*u[1])/other> -0.985)continue;
          const low=Math.max(0,Math.min(along(r),along(s))),high=Math.min(len,Math.max(along(r),along(s)));
          const overlap=high-low;
          if(overlap<Math.max(3,Math.min(len,other)*0.20))continue;
          const acrossAt=t=>across(r)+(across(s)-across(r))*(t-along(r))/(along(s)-along(r));
          const tolerance=1.5;
          if(Math.max(Math.abs(acrossAt(low)),Math.abs(acrossAt(high)))>tolerance)continue;
          // The two silhouettes must lie on opposite sides, not overlap.
          if(Math.max(...b.map(across))>1e-5)continue;
          const inset=Math.min(1.5,overlap*0.12);
          for(const fraction of [0.25,0.5,0.75]) {
            const middle=low+overlap*fraction,gap=acrossAt(middle);
            seams.push({
              a:[p[0]+u[0]*middle+n[0]*inset,p[1]+u[1]*middle+n[1]*inset],
              b:[p[0]+u[0]*middle+n[0]*(gap-inset),p[1]+u[1]*middle+n[1]*(gap-inset)]
            });
          }
        }
      }
      return seams;
    }
    updateProjection(project, visible, eye, pickAt, includeMain = false) {
      const b=this.board,half=b.pitch/2;
      const cellKey=center=>center.map(v=>Math.round(v/b.pitch)).join(',');
      const occupied=new Set(b.cells.flatMap((_,id)=>b.color[id]>=0?[cellKey(b.cellCenter(id))]:[]));
      const neighbor=(center,axis,sign)=>{const p=center.slice();p[axis]+=sign*b.pitch;return occupied.has(cellKey(p));};
      const faces=(center,main=false)=>{
        const result=[];
        for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
          if(eye&&(eye[axis]-center[axis]-sign*half)*sign<=0)continue;
          if(main&&neighbor(center,axis,sign))continue;
          const others=[0,1,2].filter(a=>a!==axis),points=[];
          for(const u of [-half,half])for(const v of [-half,half]) {
            const world=center.slice();world[axis]+=sign*half;world[others[0]]+=u;world[others[1]]+=v;
            const p=project(world);if(p&&p.every(Number.isFinite)){p.world=world;points.push(p);}
          }
          if(points.length===4) {
            const polygon=PerspectivePanel.hull(points);
            if(main)polygon.skipEdges=polygon.map((p,i)=>{
              const q=polygon[(i+1)%polygon.length];
              return others.some(a=>Math.abs(p.world[a]-q.world[a])<1e-8&&neighbor(center,a,Math.sign(p.world[a]-center[a])));
            });
            result.push(polygon);
          }
        }
        return result;
      };
      const surface=b.cells.map((_,id)=>b.color[id]>=0?faces(b.cellCenter(id),true):null);
      const links=[];
      if(pickAt) {
        // Occlusion cuts new visible boundaries into a face. Sample the final
        // depth-tested image on each side of an edge, not its uncut polygon.
        const panels=Array.from({length:this.colors.length},(_,i)=>this.colors[i]>=0?faces(this.center(i)):[]);
        const bounds=shape=>[Math.min(...shape.map(p=>p[0])),Math.max(...shape.map(p=>p[0])),Math.min(...shape.map(p=>p[1])),Math.max(...shape.map(p=>p[1]))];
        const panelBounds=panels.flat().filter(s=>s.length>=3).map(bounds);
        const nearPanel=shape=>{const r=bounds(shape);return panelBounds.some(q=>r[0]<=q[1]+2&&q[0]<=r[1]+2&&r[2]<=q[3]+2&&q[2]<=r[3]+2);};
        const projectedBounds=[];
        surface.forEach((shapes,id)=>{if(shapes&&shapes.length)projectedBounds.push({id,rect:bounds(shapes.flat())});});
        panels.forEach((shapes,i)=>{if(shapes.length)projectedBounds.push({id:b.size+i,rect:bounds(shapes.flat())});});
        const cache=new Map(),found=new Set();
        const pick=p=>{
          const key=p.map(v=>v.toFixed(2)).join(',');
          if(!cache.has(key)) {
            const candidates=projectedBounds.filter(({rect:r})=>p[0]>=r[0]-0.01&&p[0]<=r[1]+0.01&&p[1]>=r[2]-0.01&&p[1]<=r[3]+0.01).map(v=>v.id);
            cache.set(key,pickAt(p,candidates));
          }
          return cache.get(key);
        };
        const scan=shape=>{
          if(shape.length<3||(!includeMain&&!nearPanel(shape)))return;
          for(let edge=0;edge<shape.length;edge++) {
            if(shape.skipEdges&&shape.skipEdges[edge])continue; // Shared physical edges are already Board neighbours.
            const a=shape[edge],z=shape[(edge+1)%shape.length],dx=z[0]-a[0],dy=z[1]-a[1],length=Math.hypot(dx,dy);
            if(length<4)continue;
            const inset=Math.min(1.25,length*0.06),nx=-dy/length*inset,ny=dx/length*inset;
            let previous='',run=0;
            for(let sample=1;sample<=9;sample++) {
              const t=sample/10,x=a[0]+dx*t,y=a[1]+dy*t;
              const first=pick([x+nx,y+ny]),second=pick([x-nx,y-ny]);
              const main=Math.min(first,second),extra=Math.max(first,second);
              const bodyPair=includeMain&&main!==extra&&extra<b.size&&b.color[extra]>=0;
              const panelPair=extra>=b.size&&extra<b.size+this.colors.length&&this.colors[extra-b.size]>=0&&
                (main<b.size||Math.floor((main-b.size)/6)!==Math.floor((extra-b.size)/6));
              const mainLive=main>=0&&(main<b.size?b.color[main]>=0:main<b.size+this.colors.length&&this.colors[main-b.size]>=0);
              const valid=main!==extra&&mainLive&&(bodyPair||panelPair);
              const key=valid?main+','+extra:'';
              run=key&&key===previous?run+1:key?1:0;previous=key;
              if(run>=3&&length*(run-1)/10>=3)found.add(key);
            }
          }
        };
        panels.flat().forEach(scan);
        surface.forEach(shapes=>{if(shapes)shapes.forEach(scan);});
        this.links=Array.from(found,key=>key.split(',').map(Number));
        return;
      }
      for(let i=0;i<this.colors.length;i++) {
        if(this.colors[i]<0)continue;
        const id=b.size+i,center=this.center(i),shapes=faces(center);
        for(let j=0;j<b.size;j++) {
          if(!surface[j])continue;
          const connected=shapes.some(shape=>surface[j].some(face=>PerspectivePanel.seams(shape,face).some(seam=>
            visible(id,center,seam.a)&&visible(j,b.cellCenter(j),seam.b))));
          if(connected)links.push([j,id]);
        }
      }
      this.links=links;
    }
  }
  g.PerspectivePanel = PerspectivePanel;
})(typeof window !== 'undefined' ? window : globalThis);

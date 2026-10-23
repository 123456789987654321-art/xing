(function(g){
 'use strict';
 g.SpaceOpening={mount(canvas){
  const ctx=canvas.getContext('2d'),reduced=g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sky=new Image(),ship=new Image();
  sky.src='assets/story/opening/starfield.png';ship.src='assets/story/opening/ship.png';
  let frame,dead=false,last=performance.now(),elapsed=0;
  const stars=Array.from({length:100},(_,i)=>({x:((i*7919)%997)/997,y:((i*3571)%991)/991,r:.5+i%3*.55}));
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function draw(now){
   if(dead)return;
   elapsed+=Math.min((now-last)/1000,.05);last=now;
   const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(g.devicePixelRatio||1,2);
   if(!w||!h){frame=requestAnimationFrame(draw);return;}
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#10244b';ctx.fillRect(0,0,w,h);
   if(sky.complete&&sky.naturalWidth){
    const scale=Math.max(w/sky.naturalWidth,h/sky.naturalHeight),tw=sky.naturalWidth*scale,th=sky.naturalHeight*scale;
    const offset=reduced?0:(elapsed*30)%(tw*2);
    // Mirrored neighboring tiles join seamlessly while the sky scrolls behind the ship.
    for(let i=-1;i<=3;i++){
     ctx.save();ctx.translate(i*tw-offset,(h-th)/2);
     if(Math.abs(i)%2){ctx.translate(tw,0);ctx.scale(-1,1);}
     ctx.drawImage(sky,0,0,tw,th);ctx.restore();
    }
   }
   for(const s of stars){
    const x=((s.x*w-(reduced?0:elapsed*(35+s.r*48)))%w+w)%w;
    ctx.globalAlpha=.25+s.r*.16;
    ellipse(x,s.y*h,s.r,s.r*.65,'#d8eaff');
    if(!reduced&&s.r>1.5){ctx.fillStyle='#b8d8ff25';ctx.fillRect(x,s.y*h,10,1);}
   }
   ctx.globalAlpha=1;
   if(ship.complete&&ship.naturalWidth){
    const size=Math.max(68,Math.min(140,w*.105)),scale=size/70;
    const motion=reduced?0:1;
    ctx.save();ctx.translate(w*.52+Math.sin(elapsed*.6)*18*motion,h*.45+Math.sin(elapsed*1.6)*10*motion);
    ctx.rotate(Math.sin(elapsed*1.15)*.035*motion);ctx.scale(scale,scale);
    const flame=24+(reduced?0:Math.sin(elapsed*24)*7+Math.sin(elapsed*37)*3);
    ctx.shadowColor='#ffb33e';ctx.shadowBlur=14;
    ellipse(-40-flame*.35,0,flame,6,'#ffb640');
    ellipse(-38-flame*.25,0,flame*.7,3,'#fff3b8');ctx.shadowBlur=0;
    ctx.drawImage(ship,-35,-27,70,54);ctx.restore();
   }
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return {start(){},stop(){dead=true;cancelAnimationFrame(frame);}};
 }};
})(window);

(function(g){
 'use strict';
 g.OpeningVideo={mount(root,onDone){
  const video=root.querySelector('video'),retry=root.querySelector('[data-video-retry]'),skip=root.querySelector('[data-video-skip]'),status=root.querySelector('[data-video-status]');
  let stopped=false,playing=false;
  function failed(){if(stopped)return;playing=false;status.textContent='暂时无法播放，请重试或跳过开场。';retry.hidden=false;retry.focus();}
  function stop(){if(stopped)return;stopped=true;video.pause();video.removeEventListener('ended',finish);video.removeEventListener('error',failed);retry.onclick=null;skip.onclick=null;}
  function finish(){if(stopped)return;stop();onDone();}
  function start(){
   if(stopped||playing)return;playing=true;retry.hidden=true;status.textContent='';
   try{video.currentTime=0;const result=video.play();if(result?.catch)result.catch(failed);}catch(e){failed();}
  }
  video.addEventListener('ended',finish);video.addEventListener('error',failed);
  retry.onclick=start;skip.onclick=finish;
  return {start,stop};
 }};
})(window);

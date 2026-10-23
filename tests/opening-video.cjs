const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
async function run(){
 const g={};vm.runInNewContext(fs.readFileSync('js/opening-video.js','utf8'),{window:g});
 function setup(reject=false){
  const events={},video={currentTime:5,plays:0,pauses:0,addEventListener(k,f){events[k]=f},removeEventListener(k){delete events[k]},play(){this.plays++;return reject?Promise.reject(new Error('blocked')):Promise.resolve()},pause(){this.pauses++}};
  const retry={hidden:true,onclick:null,focus(){}},skip={onclick:null},status={textContent:''};let done=0;
  const root={querySelector(s){return s==='video'?video:s==='[data-video-retry]'?retry:s==='[data-video-skip]'?skip:status}};
  const player=g.OpeningVideo.mount(root,()=>done++);
  return {player,events,video,retry,skip,status,get done(){return done}};
 }
 let p=setup();p.player.start();p.player.start();assert.equal(p.video.plays,1);assert.equal(p.video.currentTime,0);
 const ended=p.events.ended;p.skip.onclick();ended();assert.equal(p.done,1,'skip and ended complete once');
 p=setup();p.player.start();const stale=p.events.ended;p.player.stop();stale();assert.equal(p.done,0,'stale completion after cleanup ignored');
 p=setup(true);p.player.start();await new Promise(r=>setImmediate(r));assert.equal(p.retry.hidden,false);assert.equal(p.done,0);p.retry.onclick();assert.equal(p.video.plays,2);
 p=setup();p.events.error();assert.match(p.status.textContent,/无法/);assert.equal(p.retry.hidden,false);p.skip.onclick();assert.equal(p.done,1);
 console.log('PASS opening video: click guard, complete once, cleanup, retry, error escape');
}
run().catch(e=>{console.error(e);process.exitCode=1});

// Optional real WebGL integration checks. Run: node scripts/verify-challenge.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.qa');fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(data);});});
let edge,ws,seq=0;const pending=new Map(),errors=[],debugPort=9237;
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu-sandbox','--no-first-run','--remote-debugging-port='+debugPort,'--user-data-dir='+path.join(out,'edge-qa'),'--window-size=1280,900','about:blank'],{windowsHide:true,stdio:'ignore'});
 let pages;for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:'+debugPort+'/json')).json();break;}catch(e){await delay(200);}}
 if(!pages)throw Error('Edge debug endpoint unavailable');
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
 ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);});
 await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});await delay(1200);
 const results=[];
 results.push(await evaluate(`(()=>{App.showLevelSelect('challenge');const choices=document.querySelectorAll('.level-choice');const before=App.level;App.startSelectedLevel('challenge',12);return {elevenChallenges:choices.length===11,removedLevelAbsent:!document.querySelector('[data-level="12"]'),removedLevelRejected:App.level===before};})()`));
 await evaluate(`App.startSelectedLevel('challenge',2);window.qaEntryTime=App.challenge.world.time;`);await delay(200);
 results.push(await evaluate(`({entryPaused:App.state==='paused'&&App.challenge.world.time===qaEntryTime,entryAcknowledgePresent:[...document.querySelectorAll('#ovCard button')].some(b=>b.textContent==='我知道了')})`));
 fs.writeFileSync(path.join(out,'entry-instructions.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`window.qaEnter=level=>{App.startSelectedLevel('challenge',level);if(App.state!=='paused'||!document.getElementById('ovCard').textContent.includes('我知道了'))throw Error('Missing entry instructions '+level);document.querySelector('#overlay [data-act="resume"]').click();if(App.state!=='play')throw Error('Entry acknowledgement failed');};`);
 await evaluate(`window.qaFinish=g=>{g.checkResult();if(g.ending)g.frame(g.ending.duration+.01);};`);
 for(let level=1;level<=11;level++){
  await evaluate(`qaEnter(${level});App.challenge.intro=0;document.getElementById('banner').classList.remove('show');`);await delay(450);
  results.push(await evaluate(`({challengeNoTarget:App.challenge.world.target===null&&getComputedStyle(document.querySelector('.score-sub')).display==='none',challengeNoProgress:getComputedStyle(document.querySelector('.prog')).display==='none',challengeNoStars:getComputedStyle(document.getElementById('hudStars')).display==='none'})`));
  results.push(await evaluate(`({level:App.level,phase:App.challenge.world.phase,cells:App.challenge.world.cells.length,score:App.score,target:App.target,gl:App.scene.gl.getError(),timerHidden:document.getElementById('hudTimerBox').classList.contains('hidden'),title:document.getElementById('hudMode').textContent,noViewToggle:!document.querySelector('[data-challenge="view"]'),simplePanelHidden:[8,10,11,12].includes(App.level)||document.getElementById('challengePanel').classList.contains('hidden')})`));
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'level-'+level+'.png'),Buffer.from(shot.data,'base64'));
  if(level===9)for(let wait=0;wait<40;wait++){if(await evaluate('App.challenge.world.canRemove()'))break;await delay(100);}
  if(level!==10)results.push(await evaluate(`(()=>{const game=App.challenge;for(const t of game.tiles){const p=App.scene.project(t.center);if(!p||(!document.getElementById('challengePanel').classList.contains('hidden')&&p[1]>document.getElementById('challengePanel').getBoundingClientRect().top)||game.pick({clientX:p[0],clientY:p[1]})!==t.id||game.group(t.id).length<2)continue;const before=game.world.remaining();game.click({clientX:p[0],clientY:p[1]});return {clickedLevel:App.level,removed:before-game.world.remaining(),score:game.world.score};}return {clickedLevel:App.level,removed:0};})()`));
 }
 await evaluate(`qaEnter(8);App.challenge.intro=0;window.qaCubeColors=JSON.stringify(App.challenge.world.cells.map(c=>c.color));`);await delay(300);
 results.push(await evaluate(`({rubikReady:App.challenge.world.cells.length===1350,rubikNoTray:!document.querySelector('.challenge-parts'),rubikSixDirections:document.querySelectorAll('.rubik-gravity').length===6,rubikWhiteControls:document.querySelectorAll('.rubik-turn:not([hidden])').length>0})`));
 await evaluate(`window.qaRubikPoint=()=>{const buttons=[...document.querySelectorAll('.rubik-turn:not([hidden])')];for(const b of buttons){const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(x>0&&x<innerWidth&&y>0&&y<innerHeight&&b.contains(document.elementFromPoint(x,y)))return {x,y};}throw Error('No reachable cube arrow');};`);
 let rubikPoint=await evaluate('qaRubikPoint()');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',...rubikPoint,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...rubikPoint,button:'left',clickCount:1});
 results.push(await evaluate(`({rubikDesktopTurn:!!App.challenge.world.rubik.turn,rubikTurnLocksRemoval:!App.challenge.world.canRemove()})`));
 await delay(750);results.push(await evaluate(`({rubikTurnSettled:!App.challenge.world.rubik.turn,rubikColorsMoved:JSON.stringify(App.challenge.world.cells.map(c=>c.color))!==qaCubeColors,rubikTurnNoScore:App.challenge.world.score===0})`));
 fs.writeFileSync(path.join(out,'rubik-desktop.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`qaEnter(10);App.challenge.intro=0;window.qaAmmo=App.challenge.world.ammo.length;`);
 await delay(200);
 const throwPoints=await evaluate(`(()=>{const a=App.challenge.world.sling.anchor,p=App.scene.project(a),q=App.scene.project(a.map((v,i)=>v+[.45,-.55,0][i]));return {start:{x:p[0],y:p[1]},end:{x:q[0],y:q[1]}};})()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',...throwPoints.start,button:'left',clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...throwPoints.end,button:'left',buttons:1});
 await evaluate(`window.qaPullPower=App.challenge.thrower.power;window.qaThrowPreview=JSON.stringify(App.challenge.world.trajectory);`);await delay(250);
 results.push(await evaluate(`({slingDragging:App.challenge.thrower.charging,slingPullHasPower:qaPullPower>0,slingNoTimedCharge:App.challenge.thrower.power===qaPullPower,throwWaitsForRelease:App.challenge.world.ammo.length===qaAmmo,tenShots:qaAmmo===10,fiveHolesEach:[0,1].every(i=>App.challenge.world.cells.filter(c=>c.targetIndex===i&&c.hole).length===5)})`));
 fs.writeFileSync(path.join(out,'sling-drag.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',...throwPoints.end,button:'left',clickCount:1});
 results.push(await evaluate(`({throwReleased:!App.challenge.thrower.charging,throwConsumesOne:App.challenge.world.ammo.length===qaAmmo-1,slingFollowsPreview:JSON.stringify(App.challenge.world.projectile?.path)===qaThrowPreview})`));
 results.push(await evaluate(`(()=>{qaEnter(10);const g=App.challenge;g.intro=0;const hole=g.world.cells.find(c=>c.hole);g.action('aim',{x:hole.center[0],y:hole.center[1]});g.action('shoot');g.world.update(1.3);const filled=hole.color>=0;while(g.world.ammo.length){g.action('shoot');g.world.update(1.3);}return {targetHoleFilled:filled,targetElimination:g.world.phase==='play'};})()`));
 await evaluate(`qaEnter(4);App.challenge.intro=0;document.getElementById('banner').classList.remove('show');`);await delay(200);
 results.push(await evaluate(`({towerReady:!!App.challenge.world.tower,towerPersonAlive:App.challenge.world.tower.person.alive,towerSixFloors:App.challenge.world.tower.floors.length===6,towerFourCornerPillars:App.challenge.world.tower.floorSupports.every(columns=>columns.length===4&&columns.every(ids=>ids.length===36)),towerLayerCount:App.challenge.world.tower.floors.every(ids=>ids.length===145)})`));
 fs.writeFileSync(path.join(out,'tower-initial.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  results.push(await evaluate(`(()=>{const w=App.challenge.world,l=w.tower.levels[5],sc=App.scene,view=[sc.yaw,sc.pitch];w.remove(l.columnIds.slice(0,2).flat().filter(id=>w.cells.find(c=>c.id===id).towerRow===3));w.update(.8);return {towerTiltsOnAdjacentLoss:l.angle>.01,towerViewUnchanged:sc.yaw===view[0]&&sc.pitch===view[1]};})()`));
  await delay(100);fs.writeFileSync(path.join(out,'tower-tilt.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  results.push(await evaluate(`(()=>{qaEnter(4);const g=App.challenge,w=g.world,l=w.tower.levels[5];g.intro=0;const y=w.tower.person.y;w.remove([l.baseId]);w.update(1/60);return {towerBaseReleasesPerson:w.tower.person.y<y};})()`));
  await evaluate(`qaEnter(4);App.challenge.intro=0;document.getElementById('banner').classList.remove('show');`);
 await evaluate(`window.qaTowerFloors=App.challenge.world.tower.floors.slice().reverse();for(const ids of qaTowerFloors.slice(0,2)){App.challenge.world.remove(ids);App.challenge.world.update(2);}App.challenge.syncHud();`);await delay(100);
 results.push(await evaluate(`({towerMidwayAlive:App.challenge.world.tower.person.alive&&!App.challenge.world.result,towerMidwayDescended:App.challenge.world.tower.person.y<2&&App.challenge.world.tower.person.y>App.challenge.world.tower.groundY})`));
 fs.writeFileSync(path.join(out,'tower-midway.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 results.push(await evaluate(`(()=>{const g=App.challenge;for(const ids of qaTowerFloors.slice(2)){g.world.remove(ids);g.world.update(2);}qaFinish(g);const saved=JSON.parse(localStorage.getItem('popstar3d.progress.challenge.v2'));return {towerWon:g.world.result==='win',towerPersisted:Object.prototype.hasOwnProperty.call(saved.cleared,'4'),towerSafeGround:g.world.tower.person.alive&&Math.abs(g.world.tower.person.y-g.world.tower.groundY)<1e-6};})()`));
 await evaluate(`App.pause();window.qaPausedTime=App.challenge.world.time`);await delay(250);results.push(await evaluate(`({pauseFrozen:qaPausedTime===App.challenge.world.time})`));await evaluate('App.resume()');
 results.push(await evaluate(`(()=>{document.getElementById('btnMechanicInfo').click();const reopened=App.state==='paused'&&document.getElementById('ovCard').textContent.includes('我知道了');document.querySelector('#overlay [data-act="resume"]').click();return {infoReopens:reopened,infoDismissed:App.state==='play'&&document.getElementById('overlay').classList.contains('hidden')};})()`));
 await evaluate(`qaEnter(4);App.challenge.intro=0;document.getElementById('banner').classList.remove('show');`);await delay(200);
 fs.writeFileSync(path.join(out,'mobile-tower.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`qaEnter(8);App.challenge.intro=0;document.getElementById('banner').classList.remove('show');`);await delay(350);
 rubikPoint=await evaluate('qaRubikPoint()');
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...rubikPoint,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await delay(100);results.push(await evaluate(`({rubikTouchTurn:!!App.challenge.world.rubik.turn})`));await delay(650);
 fs.writeFileSync(path.join(out,'mobile-rubik.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 results.push(await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.rubik-turn:not([hidden])')].map(e=>e.getBoundingClientRect());return {rubikCompactControls:buttons.length===12,rubikButtonsVisible:buttons.every(r=>r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight),rubikButtonsSeparate:buttons.every((r,i)=>buttons.slice(i+1).every(q=>Math.min(r.right,q.right)-Math.max(r.left,q.left)<1||Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top)<1))};})()`));
 results.push(await evaluate(`({mobileOverflow:document.documentElement.scrollWidth>innerWidth,paused:(App.pause(),App.state)})`));
 await evaluate(`App.toMenu();App.startSelectedLevel('normal',1)`);await delay(100);results.push(await evaluate(`({normalUnaffected:!App.challenge&&App.mode==='normal'&&document.getElementById('challengePanel').classList.contains('hidden'),normalGL:App.scene.gl.getError()})`));
 await evaluate(`document.getElementById('btnLevelSelect').click();`);
 results.push(await evaluate(`({normalReturnPicker:App.selectMode==='normal'&&!!document.querySelector('[data-act="selectLevel"]')})`));
 await evaluate(`App.toMenu();App.showHelp(true);document.getElementById('ovCard').scrollTop=10000;`);await delay(400);
 results.push(await evaluate(`(()=>{const b=document.getElementById('btnDialogBack'),r=b.getBoundingClientRect();return {helpBackVisible:!b.hidden&&r.top>=0&&r.bottom<innerHeight,removedTestMenu:!document.querySelector('.test-levels')};})()`));
 fs.writeFileSync(path.join(out,'mobile-help.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`document.getElementById('btnDialogBack').click();`);
 results.push(await evaluate(`({helpBackCloses:App.state==='menu'&&document.getElementById('overlay').classList.contains('hidden')&&document.getElementById('btnDialogBack').hidden})`));
 results.push(await evaluate(`(()=>{for(const score of [900,700,1100]){qaEnter(1);const g=App.challenge;g.world.score=score;g.world.result='win';qaFinish(g);}document.getElementById('btnLevelSelect').click();const saved=JSON.parse(localStorage.getItem('popstar3d.progress.challenge.v2'));return {challengeReturnPicker:App.selectMode==='challenge',bestClearMax:saved.best[1]===1100,bestDisplayed:document.querySelector('[data-level="1"] .level-best').textContent==='历史最高分：1100'};})()`));
 await delay(400);fs.writeFileSync(path.join(out,'mobile-picker.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 for(const level of [11]){
  await evaluate(`qaEnter(${level});App.challenge.intro=0;document.getElementById('banner').classList.remove('show');`);await delay(200);
  results.push(await evaluate(`(()=>{const g=App.challenge,points=[...g.world.cells,...g.world.decorations].flatMap(c=>ChallengeProjection.worldVertices(c)).map(p=>App.scene.project(p)).filter(Boolean),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const labels=[...document.querySelectorAll('#challengeLabels span')].map(e=>e.getBoundingClientRect()),panel=document.getElementById('challengePanel').getBoundingClientRect();return {cameraLevel:${level},modelCentered:Math.abs((Math.min(...xs)+Math.max(...xs))/2-innerWidth/2)<innerWidth*.04,modelVisible:Math.min(...xs)>0&&Math.max(...xs)<innerWidth&&Math.min(...ys)>0&&Math.max(...ys)<innerHeight,binLabelsClear:labels.every(r=>r.bottom<panel.top||r.top>panel.bottom),numericBins:g.level!==12||[...document.querySelectorAll('#challengeLabels span')].map(e=>e.textContent).join(',')==='100,300,500,300,100'};})()`));
  fs.writeFileSync(path.join(out,'mobile-level-'+level+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate(`qaEnter(4);App.challenge.intro=0;App.scene.yaw=-.65;App.scene.pitch=.35;document.getElementById('banner').classList.remove('show');`);await delay(200);
 results.push(await evaluate(`(()=>{const g=App.challenge,w=g.world;w.remove(w.tower.floors.flat());w.update(4);qaFinish(g);return {towerFallFailure:w.result==='lose'&&w.tower.failure==='fall',towerFallPersonDead:!w.tower.person.alive};})()`));
 await delay(100);fs.writeFileSync(path.join(out,'tower-fall.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 results.push(await evaluate(`(()=>{qaEnter(4);const g=App.challenge,w=g.world;g.intro=0;const lower=w.tower.levels[4],person=w.tower.person;person.y=lower.originalY+.6;person.fallStart=person.y;person.supportId=lower.upperIds[103];w.remove(w.tower.levels[5].columnIds.flat());w.update(1.5);qaFinish(g);return {towerCrushFailure:w.result==='lose'&&w.tower.failure==='crush',towerCrushPersonDead:!w.tower.person.alive};})()`));
 await delay(100);fs.writeFileSync(path.join(out,'tower-crush.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 results.push(await evaluate(`(()=>{qaEnter(11);const g=App.challenge,sc=App.scene;g.intro=0;g.frame(.01);const beam=g.world.beam,ends=()=>[-3.5,3.5].map(x=>sc.project([beam.center[0]+x,beam.center[1],beam.center[2]]));const before=ends();g.pan(65,40);g.frame(.01);const after=ends();return {seesawNoPanel:document.getElementById('challengePanel').classList.contains('hidden'),seesawPanMoves:Math.abs(after[0][0]-before[0][0])>1,seesawStaysLevel:Math.abs(after[0][1]-after[1][1])<.01};})()`));
 for(const level of [1,3,7,8,11])results.push(await evaluate(`(()=>{qaEnter(${level});const g=App.challenge;g.intro=0;const distances=[];for(const v of [0,.25,.5,.75,1]){App.setZoom(v);g.frame(.001);distances.push(App.scene.dist);}return {zoomLevel:${level},wholeSliderChanges:distances.every((d,i)=>i===0||d<distances[i-1]-.001)};})()`));
 results.push(await evaluate(`(()=>{qaEnter(11);const g=App.challenge;g.world.score=g.world.target;g.world.result='win';qaFinish(g);return {lastChallengeNoNext:!document.querySelector('#ovCard [data-act="next"]')};})()`));
 await evaluate(`App.returnToLevelSelect();`);await delay(150);fs.writeFileSync(path.join(out,'eleven-challenges.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 results.push(await evaluate(`(()=>{qaEnter(6);const g=App.challenge;const oldBest=App.progressFor('challenge').best[6];const score=(oldBest||0)+20;g.world.score=score;App.returnToLevelSelect();const saved=App.progressFor('challenge').best[6];qaEnter(6);App.challenge.world.finish();qaFinish(App.challenge);const ended=App.challenge.world.result==='win'&&!document.getElementById('ovCard').textContent.includes('本关目标');App.toMenu();App.startSelectedLevel('normal',1);return {unfinishedBestDiscarded:saved===oldBest,zeroScoreCanEnd:ended,normalTargetStillVisible:getComputedStyle(document.querySelector('.score-sub')).display!=='none'};})()`));
 if(process.env.ZOOM_QA){
  for(const [width,height] of [[1280,900],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
   for(const mode of ['challenge','normal'])for(let level=1;level<=(mode==='challenge'?11:15);level++){
    await evaluate(`(()=>{if('${mode}'==='challenge'){qaEnter(${level});App.challenge.intro=0;}else{App.toMenu();App.progressFor('normal').cleared[${level}]=0;App.startSelectedLevel('normal',${level});App.updateAnimations(10);App.introDone=true;App.state='play';App.hideOverlay();}App.setZoom(1);App.scene.rotateOrbit(130,70);document.getElementById('banner').classList.remove('show');})()`);await delay(100);
    results.push(await evaluate(`(()=>{const cells=App.challenge?[...App.challenge.world.cells,...App.challenge.world.decorations]:App.tiles.filter(Boolean);const points=cells.flatMap(c=>ChallengeProjection.worldVertices(c.poly?c:{...c,poly:{vertices:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]}})).map(p=>App.scene.project(p));return {zoomMode:'${mode}',zoomLevel:${level},zoomWidth:${width},maxZoomFits:points.every(p=>p&&p[0]>=innerWidth*.035&&p[0]<=innerWidth*.965&&p[1]>=innerHeight*.035&&p[1]<=innerHeight*.965),zoomGL:App.scene.gl.getError()===0};})()`));
    if(level===1||level===12)fs.writeFileSync(path.join(out,'max-zoom-'+mode+'-'+level+'-'+width+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   }
  }
 }
 const failed=results.filter(r=>r.gl||r.normalGL||r.mobileOverflow||(r.clickedLevel&&r.removed<2)||Object.entries(r).some(([k,v])=>typeof v==='boolean'&&k!=='mobileOverflow'&&!v));
 const report={results,errors,failed};fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(errors.length||failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(ws&&ws.readyState===1){await call('Browser.close').catch(()=>{});ws.close();}if(edge)edge.kill();server.close();});

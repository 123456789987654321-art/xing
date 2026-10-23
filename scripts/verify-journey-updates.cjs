// Local Edge integration: isolated profile, real WebGL/UI, no external services.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.qa','journey-updates');fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.jpg')?'image/jpeg':'text/html; charset=utf-8');res.end(data);});});
let edge,ws,seq=0;const pending=new Map(),errors=[],checks=[],profile=path.join(out,'edge-'+Date.now());
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
async function check(name,expression){const result=await evaluate(expression);checks.push({name,result});assert.equal(result,true,name+': '+JSON.stringify(result));console.log('PASS '+name);}
async function shot(name){await delay(250);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
const fits=`(()=>{const root=document.getElementById('journey'),book=document.querySelector('.j-notebook'),next=document.querySelector('[data-j="journal-next"]');const b=book.getBoundingClientRect(),n=next.getBoundingClientRect();return root.scrollHeight<=root.clientHeight+1&&root.scrollWidth<=innerWidth&&b.bottom<=innerHeight&&n.bottom<=b.bottom&&n.right<=b.right;})()`;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu-sandbox','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1365,940','about:blank'],{windowsHide:true,stdio:'ignore'});
 let pages;for(let i=0;i<75;i++){try{const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();break;}catch{await delay(200);}}
 if(!pages)throw Error('Edge unavailable');
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p){if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});await delay(1000);
 await check('home boots with WebGL',`Journey.page==='home'&&!!App.scene&&App.scene.gl.getError()===0`);
 await check('home only shows start',`document.getElementById('journey').innerText.trim()==='开始游戏'`);await shot('desktop-home');
 await click('[data-j="launch"]');await check('start opens animated mode selection',`Journey.page==='modes'&&!!document.querySelector('.j-space canvas')&&document.querySelectorAll('.j-mode-actions button').length===2&&!!Journey.space`);
 await check('both modes use yellow entry button style',`[...document.querySelectorAll('.j-mode-actions button')].every(b=>getComputedStyle(b).backgroundImage.includes('255, 242, 156'))`);await shot('desktop-modes');
 await click('[data-mode="challenge"]');await check('challenge all eleven enabled before any story',`Journey.mode==='challenge'&&document.querySelectorAll('[data-j="start"]:not(:disabled)').length===11&&Journey.campaign.state.main===0`);
 await check('unplayed controls are opaque solid gray',`[...document.querySelectorAll('.j-stop.unpassed button')].every(b=>{const s=getComputedStyle(b);return s.backgroundColor==='rgb(201, 201, 201)'&&s.backgroundImage==='none'&&s.opacity==='1'&&!b.disabled;})`);
 await check('unreached status text removed',`!document.getElementById('journey').innerText.includes('抵达')`);await shot('desktop-challenge');
 await check('removed shortcuts replaced by icon back beside help',`(()=>{const back=document.querySelector('.j-header [data-j="back"]');return !!back?.querySelector('svg')&&back.previousElementSibling.dataset.j==='help'&&!document.getElementById('journey').innerText.includes('继续旅程')&&!document.getElementById('journey').innerText.includes('去创造模式');})()`);
 await click('.j-header [data-j="back"]');await check('challenge back returns to mode selection',`Journey.page==='modes'`);
 await evaluate(`Journey.map('normal',0)`);await click('[data-j="next"]');await check('next stop reaches wind without clears',`Journey.chapter===1&&document.querySelector('[data-level="6"]')!==null&&document.querySelector('.j-scene img').src.includes(JourneyData.chapters[1].panorama||JourneyData.chapters[1].asset)`);
 await click('[data-j="next"]');await check('next stop reaches light without clears',`Journey.chapter===2&&document.querySelector('[data-level="15"]')!==null`);await shot('desktop-light');
 await click('.j-header [data-j="back"]');await check('scene back returns to previous chapter',`Journey.chapter===1`);await click('[data-j="next"]');
 await click('[data-j="next"]');await check('final next stop opens ending choices',`Journey.page==='choice'&&Journey.campaign.state.main===0`);
 for(let level=1;level<=15;level++){
  await evaluate(`Journey.start('normal',${level})`);
  await check('main '+level+' starts with independent score and local stars',`App.level===${level}&&App.mode==='normal'&&!Journey.visible&&App.score===0&&App.target===JourneyState.target(${level})&&App.starSteps()[0]===App.target`);
 }
 await evaluate(`App.score=App.target-1;App.showClearPanel()`);await check('under-target jump does not record a clear',`App.state==='over'&&!Object.hasOwn(Journey.campaign.state.best.normal,15)`);
 await click('#overlay [data-act="retry"]');await check('jump retry starts from zero',`App.score===0&&App.level===15`);
 await evaluate(`App.score=App.target;App.showClearPanel()`);await check('out-of-order clear records only played level',`Journey.page==='map'&&Journey.campaign.state.main===0&&Journey.campaign.state.best.normal[15]===5200&&!Object.hasOwn(Journey.campaign.state.best.normal,14)`);
 await check('completion note is inside its colored button',`(()=>{const b=document.querySelector('[data-level="15"]'),note=b.querySelector('.j-stop-note'),r=b.getBoundingClientRect(),n=note.getBoundingClientRect();return note.textContent==='已通关'&&n.bottom<r.bottom&&n.top>r.top&&b.closest('.passed')!==null&&getComputedStyle(b).backgroundColor!=='rgb(201, 201, 201)';})()`);await shot('desktop-cleared');
 await call('Page.reload');await delay(800);await check('reload preserves out-of-order record and original progress',`Journey.campaign.state.main===0&&Journey.campaign.state.best.normal[15]===5200&&Journey.campaign.canEnter('normal',14)`);
 for(let level=1;level<=11;level++){
  await evaluate(`Journey.start('challenge',${level})`);
  await check('challenge '+level+' is playable without score gate',`!Journey.visible&&App.challenge.level===${level}&&App.target===null&&App.score===0`);
 }
 await evaluate(`App.resume();App.reduceMotion=true;App.challenge.intro=0;App.challenge.world.result='win';App.challenge.checkResult()`);
 await check('out-of-order challenge result saves zero score',`Journey.page==='map'&&Journey.campaign.state.creative===0&&Object.hasOwn(Journey.campaign.state.best.challenge,11)`);
 await evaluate(`Journey.journal(0)`);await delay(300);await check('notebook displays four comic previews on paper',`document.querySelectorAll('.j-notebook-leaf').length===2&&document.querySelectorAll('.j-memory-card').length===4&&document.querySelector('.j-memory-art img').naturalWidth>0`);
 await check('desktop notebook fits without page scroll',fits);await shot('desktop-notebook');
 await click('[data-j="journal-next"]');await check('next arrow changes paper contents',`Journey.journalPage===1&&document.querySelector('.j-memory-card').dataset.story==='main-04'`);await shot('desktop-notebook-page2');
 await click('.j-memory-card');await check('preview opens supplied full comic',`Journey.page==='comic'&&Journey.replay&&document.querySelector('.j-comic-page img')!==null`);
 await click('[data-j="next-panel"]');await check('return keeps original notebook spread',`Journey.page==='journal'&&Journey.journalPage===1`);
 await evaluate(`Journey.journal(999)`);await check('last notebook page has bounded next arrow',`Journey.journalPage===Math.ceil(Object.keys(JourneyData.stories).length/4)-1&&document.querySelector('[data-j="journal-next"]').disabled`);
 await evaluate(`Journey.start('normal',1)`);for(let i=0;i<60&&await evaluate(`App.state==='intro'`);i++)await delay(200);
 await check('real rendered cube click earns points',`(()=>{for(const t of App.renderList){if(!t||t.id===undefined||App.groupAt(t.id).length<2)continue;const p=App.scene.project(t.center);if(!p||App.scene.pick(p[0]/innerWidth*2-1,1-p[1]/innerHeight*2,App.renderList)!==t.id)continue;const before=App.remainingCount();App.click({clientX:p[0],clientY:p[1]});return App.remainingCount()<before&&App.score>0;}return false;})()`);
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate(`Journey.home();Journey.launch()`);await check('mobile mode buttons remain inside screen',`[...document.querySelectorAll('.j-mode-actions button')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})`);await shot('mobile-modes');
 await evaluate(`Journey.map('normal',2)`);await check('mobile completion note stays inside button',`(()=>{const b=document.querySelector('[data-level="15"]'),r=b.getBoundingClientRect(),n=b.querySelector('.j-stop-note').getBoundingClientRect();return n.bottom<r.bottom&&n.top>r.top;})()`);await shot('mobile-map');
 await evaluate(`Journey.journal(0)`);await check('mobile notebook fits without page scroll',fits);await shot('mobile-notebook');
 await click('[data-j="journal-next"]');await check('mobile page arrow works',`Journey.journalPage===1&&document.querySelectorAll('.j-memory-card').length===4`);await shot('mobile-notebook-page2');
 await click('[data-j="help"]');await click('.j-header [data-j="back"]');await check('help back restores notebook page',`Journey.page==='journal'&&Journey.journalPage===1`);
 await check('no runtime errors',JSON.stringify(errors.length===0));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));console.log('ALL '+checks.length+' BROWSER CHECKS PASSED');
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,checks,errors},null,2));process.exitCode=1;}).finally(()=>{ws?.close();edge?.kill();server.close();});

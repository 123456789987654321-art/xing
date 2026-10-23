(function(g){
 'use strict';
 const D=g.JourneyData,S=g.JourneyState,A=g.App,$=id=>document.getElementById(id);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ICONS={
  valley:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 4.4h5M10 4.4v-.9a2 2 0 1 1 4 0v.9"/><path d="M6.4 7.4h11.2l-.7 8.3a3.5 3.5 0 0 1-3.5 3.2h-2.8a3.5 3.5 0 0 1-3.5-3.2z"/><path d="M12 10.6v4.6"/></svg>',
  wind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.3"/><path d="M12 9.7V3.4M12 14.3v6.3M9.7 12H3.4M14.3 12h6.3"/><path d="M10.4 10.4 5.9 5.9M13.6 13.6l4.5 4.5" opacity=".4"/></svg>',
  light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 20 12l-8 9.2L4 12z"/><path d="M12 2.8 9.4 12l2.6 9.2M12 2.8l2.6 9.2L12 21.2" opacity=".4"/></svg>'};
 const themeIcon=t=>ICONS[t]||ICONS.valley;
 const ROUTE={
  valley:[[0,80],[17,52],[33,82],[65,54],[84,78]],
  wind:[[-12,54],[20,40],[52,20],[71,56],[100,46]],
  light:[[2,66],[50,92],[76,70],[58,18],[86,2]]
 };
 const routeOf=theme=>{
  const route=ROUTE[theme]||ROUTE.valley;
  if(theme!=='wind'||!Number.isFinite(g.innerWidth)||g.innerWidth<=800)return route;
  // The doorway lies left of the route container; keep its stop visible on narrower desktops.
  const width=Math.min(1300,g.innerWidth)-128,left=(g.innerWidth-width)/2;
  return route.map((point,i)=>i===0?[Math.max(point[0],(86-left)/width*100),point[1]]:point);
 };
 // 指定路段的弯曲控制点：{场地:{起点序号:[x%,y%]}}，用二次曲线穿过该控制点
 const BEND={ light:{ 2:[24,28] } };
 const original={};for(const key of ['boot','frame','startLevel','showClearPanel','recordClear','toMenu','showLevelSelect','startSelectedLevel','targetFor','starSteps','updateHud','showHelp','showBanner'])original[key]=A[key];
 const oldProfile=g.LevelProfile;
 A.storagePrefix='firefly.engine.v1';
 // 审核模式：全部关卡、创造模式与故事相册都不上锁。最终验收通过后把 true 改回 false 即可恢复原有关卡锁。
 const REVIEW=S.ALL_UNLOCKED;
 let storage;try{storage=g.localStorage;}catch(e){}
 const J=g.Journey={
  campaign:new S.Campaign(storage),visible:false,page:'home',mode:'normal',chapter:0,epoch:0,
  init(){
   this.root=$('journey');this.root.addEventListener('click',e=>{
    const b=e.target.closest('button[data-j]');if(!b||b.disabled)return;
    const act=b.dataset.j;
    if(act==='home')this.home();
    if(act==='launch')this.launch();
    if(act==='modes')this.modes();
    if(act==='back')this.back();
    if(act==='continue')this.continue();
    if(act==='map')this.map(b.dataset.mode||this.mode,Number(b.dataset.chapter??this.chapter));
    if(act==='start')this.start(this.mode,Number(b.dataset.level));
    if(act==='read')this.resumeStory();
    if(act==='next-panel')this.nextPanel();
    if(act==='previous-panel')this.previousPanel();
    if(act==='skip')this.finishComic();
    if(act==='journal')this.journal(0);
    if(act==='journal-next')this.journal(this.journalPage+1);
    if(act==='journal-previous')this.journal(this.journalPage-1);
    if(act==='replay')this.comic(b.dataset.story,true);
    if(act==='choose'){if(this.campaign.choose(b.dataset.ending))this.resumeStory();}
    if(act==='if'){if(this.campaign.enterIf())this.resumeStory();}
    if(act==='exit')this.departed();
    if(act==='help')this.help();
    if(act==='next')this.nextStop();
    if(act==='prev')this.prevStop();
    if(act==='backmap')this.map('normal',2);
   });
   this.root.addEventListener('keydown',e=>{
    if(e.target.closest('button'))return;
    if(this.page==='comic'&&['ArrowRight','Enter',' '].includes(e.key)){e.preventDefault();this.nextPanel();}
    else if(this.page==='comic'&&e.key==='ArrowLeft'){e.preventDefault();this.previousPanel();}
    else if(this.page==='journal'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.journal(this.journalPage+(e.key==='ArrowRight'?1:-1));}
   });
   this.home();
  },
  clean(){this.space?.stop();this.space=null;original.toMenu.call(A);document.body.classList.remove('journey-game');this.visible=true;A.state='menu';$('menu').classList.add('hidden');$('hud').classList.add('hidden');$('gl').classList.add('journey-idle');this.root.hidden=false;},
  render(html,theme='valley',extra=''){
   this.epoch++;this.visible=true;this.root.hidden=false;this.root.className='journey theme-'+theme+(this.page==='comic'?' comic-sky':'')+(extra?' '+extra:'');this.root.innerHTML=html;
   this.root.querySelectorAll('img').forEach(img=>{
    const loaded=()=>{img.parentElement.classList.add('art-ready');const draft=img.parentElement.querySelector('.j-shot-placeholder');if(draft)draft.hidden=true;};
    const failed=()=>{img.hidden=true;img.parentElement.classList.add('art-missing');};
    img.addEventListener('load',loaded,{once:true});img.addEventListener('error',failed,{once:true});
    if(img.complete){if(img.naturalWidth)loaded();else failed();}
   });
   this.root.querySelectorAll('[data-focus]')[0]?.focus({preventScroll:true});
  },
  head(label){return `<header class="j-header"><span class="j-location">${esc(label)}</span><nav><button data-j="journal">故事相册</button><button data-j="help" aria-label="玩法与素材说明">玩法</button><button class="j-header-back" data-j="back" aria-label="返回" title="返回"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 5 3 12l7 7M3 12h11a6 6 0 0 1 6 6"/></svg></button></nav></header>`;},
  note(){return !this.campaign.storageAvailable?'<p class="j-warning" role="status">浏览器未能保存进度。本次仍可游玩，关闭页面后可能丢失记录。</p>':'';},
  portrait(id){const c=D.characters[id];return `<span class="j-portrait" style="--person:${c.color}"><img src="assets/story/characters/${id}.png" alt="${c.name}" loading="lazy"><span aria-hidden="true">${c.name.slice(-1)}</span></span>`;},
  backdrop(src,fixed=false){return `<div class="j-scene${fixed?' j-scene-fixed':''}" aria-hidden="true"><img src="${src}" alt=""><div class="j-scene-lines"></div></div>`;},
  scene(chapter){const c=D.chapters[chapter];return this.backdrop(c.panorama||c.asset);},
  home(){
   this.clean();this.page='home';
   this.render('<main class="j-space"><canvas aria-label="宇宙中飞行的萤火号"></canvas><div class="j-mode-title"><span class="j-mode-emblem" aria-hidden="true">✧</span><b>星隙几何</b><small>THE STAR-RIFT GEOMETRY</small></div><button class="j-space-login" data-j="launch" data-focus>开始游戏</button></main>','space');
   this.space=g.SpaceOpening.mount(this.root.querySelector('canvas'),()=>this.launch());
  },
  launch(){if(this.page==='home')this.modes();},
  modes(){
  this.clean();this.page='modes';
  this.render('<main class="j-space"><canvas aria-label="宇宙中飞行的萤火号"></canvas><button class="j-mode-back" data-j="home" aria-label="返回开始画面">← 返回</button><div class="j-mode-title"><span class="j-mode-emblem" aria-hidden="true">✧</span><b>星隙几何</b><small>THE STAR-RIFT GEOMETRY</small></div><div class="j-mode-actions" aria-label="选择游戏模式"><button class="j-space-login" data-j="map" data-mode="normal" data-chapter="0" data-focus>冒险模式</button><button class="j-space-login" data-j="map" data-mode="challenge" data-chapter="0">挑战模式</button></div></main>','space');
  this.space=g.SpaceOpening.mount(this.root.querySelector('canvas'),()=>{});
 },
  back(){
  if(this.page==='help'&&this.helpFrom){const from=this.helpFrom;this.mode=from.mode;this.chapter=from.chapter;if(from.page==='journal'){this.journal(from.journalPage);return;}if(from.page==='choice'){this.choice();return;}if(from.page==='departed'){this.departed();return;}if(from.page==='map'){this.map(from.mode,from.chapter);return;}}
  if(this.page==='journal'){this.map(this.mode,this.chapter);return;}
  if(this.page==='map'&&this.mode==='normal'&&this.chapter>0){this.map('normal',this.chapter-1);return;}
  if(this.page==='choice'||this.page==='departed'){this.map('normal',2);return;}
  if(this.page==='modes'){this.home();return;}
  this.modes();
 },
  continue(){
  const s=this.campaign.state;
  if(REVIEW){this.map(this.mode,this.chapter);return;}
  if(s.pending.length){this.resumeStory();return;}
  if(s.main===15&&!s.ending){this.choice();return;}
  if(this.campaign.unlockedCreative){this.map('challenge',0);return;}
  this.map('normal',Math.min(2,Math.floor(s.main/5)));
 },
  nextStop(){
   if(this.chapter<2){
    const next=this.chapter+1,id=next===1?'travel-01':'travel-02',s=this.campaign.state;
    if(!s.seen.includes(id)&&!s.pending.includes(id)){s.pending=[...s.pending,id];this.campaign.persist();this.resumeStory();return;}
    this.map('normal',next);return;
   }
   if(REVIEW)this.choice();else this.continue();
  },
  prevStop(){if(this.chapter<=0)return;this.map('normal',this.chapter-1);},
  flash(text){
   if(!this.root)return;
   const el=document.createElement('div');el.className='j-toast';el.textContent=text;
   this.root.appendChild(el);setTimeout(()=>el.remove(),1600);
  },
  map(mode='normal',chapter=0,walkFrom=null){
  this.clean();this.page='map';this.mode=mode;
  const s=this.campaign.state,creative=mode==='challenge',homeLine=this.campaign.homeLine;
  if(creative&&!this.campaign.unlockedCreative){this.home();return;}
  this.chapter=Math.max(0,Math.min(2,Number.isInteger(chapter)?chapter:0));
  if(!REVIEW&&!creative&&this.chapter*5>s.main)this.chapter=Math.min(2,Math.floor(s.main/5));
  if(!creative&&s.main>=this.chapter*5){
   const intro=this.chapter===1?'travel-01':this.chapter===2?'travel-02':null;
   if(intro&&!s.seen.includes(intro)&&!s.pending.includes(intro)){s.pending=[...s.pending,intro];this.campaign.persist();this.resumeStory();return;}
  }
  const c=D.chapters[creative?0:this.chapter],route=typeof routeOf==='function'?routeOf(c.theme):ROUTE;
  const done=creative?s.creative:s.main,start=creative?1:this.chapter*5+1,count=creative?11:5;
  const hasPending=s.pending.length>0,current=Math.max(start,Math.min(start+count-1,done+(hasPending?0:1)));
  const nodes=Array.from({length:count},(_,i)=>{
   const level=start+i,passed=level<=done||Object.hasOwn(s.best[mode],level),unlocked=this.canEnter(mode,level),size=creative?D.creativeNames[i]:`${5+i} × ${5+i}`;
   const pos=creative?`--step:${i};--rise:${[1,0,1,0,1][i%5]}`:`--x:${route[i][0]}%;--y:${route[i][1]}%`,mark=creative?'':`<i class="j-stop-icon" aria-hidden="true">${themeIcon(c.theme)}</i>`;
   return `<div class="j-stop ${passed?'passed':'unpassed'} ${level===current?'current':''} ${unlocked?'':'locked'}" style="${pos}"><button data-j="start" data-level="${level}" ${unlocked?'':'disabled'} aria-label="${creative?'挑战':'本章'}第 ${i+1} 关，${size}，${passed?'已通关':unlocked?'可进入':'未解锁'}">${mark}<span>${String(i+1).padStart(2,'0')}</span>${passed?'<small class="j-stop-note">已通关</small>':''}</button>${creative?`<strong>${esc(size)}</strong><small>纪录 ${s.best.challenge[level]||0}</small>`:''}</div>`;
  }).join('');
  const local=Math.max(0,Math.min(count-1,current-start)),walkIndex=Math.max(0,Math.min(4,(Number.isFinite(walkFrom)?walkFrom:start)-start));
  const bend=BEND[c.theme]||{};
  const trail=creative?'':route.slice(0,count-1).map((a,i)=>{
   const b=route[i+1],ctl=bend[i];
   return [0.18,0.36,0.54,0.72,0.9].map(t=>{
    let x,y;
    if(ctl){const u=1-t;x=u*u*a[0]+2*u*t*ctl[0]+t*t*b[0];y=u*u*a[1]+2*u*t*ctl[1]+t*t*b[1];}
    else{x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t;}
    return `<i class="j-trail-dot" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%"></i>`;
   }).join('');
  }).join('');
  const walker=creative?'':`<div class="j-walker ${walkFrom!==null?'walking':''}" style="--at:${local};--from:${walkIndex};--x:${route[local][0]}%;--y:${route[local][1]}%;--from-x:${route[walkIndex][0]}%;--from-y:${route[walkIndex][1]}%" aria-label="小航走到第${local+1}关"><img class="j-walker-body" src="assets/story/characters/hang-full.png" alt=""><span>小航</span></div>`;
  this.render(`${creative?'':this.scene(c.id)}${this.head(creative?(homeLine?'挑战模式 · 回家后的故事':'挑战模式 · 在未来的日子里'):c.tag)}<main class="j-map">${creative||this.chapter===0?'':`<button class="j-next j-prev" data-j="prev" aria-label="上一站：${D.chapters[this.chapter-1].name}"><span>上一站</span></button>`}${creative?'':`<button class="j-next" data-j="next" ${(REVIEW||s.main>=(this.chapter+1)*5)?'':'disabled'} aria-label="前往下一站：${this.chapter<2?D.chapters[this.chapter+1].name:'送行的泊位'}"><span>下一站</span></button>`}${creative&&!homeLine?'':`<div class="j-map-heading"><div><h1>${creative?(homeLine?'回家后的日子':'留下来的日子'):c.name}</h1><p>${creative?(homeLine?'把灯带回家，让书信和重逢延续彼此的故事。':'一起修建、一起庆祝，把普通的每一天写成故事。'):c.description}</p></div></div>`}${this.note()}<div class="j-route ${creative?'creative-route':''}" style="--stops:${count}"><div class="j-route-line"></div>${trail}${nodes}${walker}</div><div class="j-map-bottom"><div class="j-actions">${creative&&homeLine&&!hasPending?'<button class="j-secondary" data-j="if">假设他留下来的生活 →</button>':''}${hasPending?'<button class="j-primary" data-j="read">阅读刚刚发生的故事 →</button>':''}${creative&&done===11?'<span class="j-complete">生活相册已集齐，可以重玩或回看故事。</span>':''}</div></div></main>`,c.theme,creative?'page-creative':'page-chapter');
 },
  canEnter(mode,level){return this.campaign.canEnter(mode,level);},
  start(mode,level){
   if(!this.canEnter(mode,level))return false;
   this.mode=mode;this.clean();this.visible=false;this.root.hidden=true;$('gl').classList.remove('journey-idle');
   A.mode=mode;A.level=level;A.score=0;A.entryScore=0;A.newRecord=false;A.startLevel(true);return true;
  },
  skin(mode,level){
   const scene=mode==='normal'?S.profile(level).chapter:D.stories[this.campaign.challengeStory(level)].scene;
   const c=D.chapters[scene],img=$('gameBackgroundArt');
   document.body.classList.add('journey-game');document.body.dataset.place=c.theme;
   img.hidden=false;img.onerror=()=>{img.hidden=true;};img.src=c.panorama||`assets/story/scenes/play-${c.theme}.png`;
   const caption=$('gameBackdrop').querySelector('.game-place-name');
   if(caption)caption.textContent=c.name+' / '+(mode==='normal'?c.kind:'在未来的日子里');
  },
  settled(mode,level,score){
  if(!this.campaign.complete(mode,level,score))return;
  this.map(mode,mode==='normal'?Math.floor((level-1)/5):0);
  if(!REVIEW&&this.campaign.state.pending.length){const token=this.epoch;setTimeout(()=>{if(this.visible&&this.epoch===token)this.resumeStory();},900);}
 },
  resumeStory(){const id=this.campaign.state.pending[0];if(id)this.comic(id,false);else this.continue();},
  comic(id,replay=false){
   if(!D.stories[id]||(replay&&!REVIEW&&!this.campaign.state.seen.includes(id)))return;
   this.clean();this.page='comic';this.story=D.stories[id];this.replay=replay;this.panel=0;this.pageIndex=0;
   if(!replay){try{const r=JSON.parse(storage?.getItem(S.KEY+'.reader')||'null');if(r?.id===id&&Number.isInteger(r.panel))this.panel=Math.max(0,Math.min(this.story.panels.length-1,r.panel));}catch(e){}}
   this.paintComic();
  },
  comicCard(p,index){
   const supplied=this.story.id==='opening'&&index<5;
   return `<section class="j-comic-panel ${supplied?'j-supplied-panel':''}" aria-label="第 ${index+1} 格"><div class="j-panel-art motion-${p.motion}"><img src="${p.asset}" alt="${esc(p.shot)}"><div class="j-shot-placeholder"><p>${esc(p.shot)}</p><small>此格插画待补</small></div><span class="j-panel-number">${String(index+1).padStart(2,'0')}</span></div><div class="j-dialogue"><strong>${esc(p.speaker)}</strong><p>${esc(p.text)}</p></div></section>`;
  },
  paintPage(s,c){
   const total=s.pages.length,idx=Math.max(0,Math.min(total-1,this.pageIndex||0)),last=idx===total-1,hasNext=!last;
   if(!this.replay){try{storage?.setItem(S.KEY+'.reader',JSON.stringify({id:s.id,panel:idx}));}catch(e){}}
   const arrow=hasNext?`<button class="j-next" data-j="next-panel" aria-label="下一页"><span>下一页</span></button>`:'';
   this.render(`${this.scene(s.scene)}<main class="j-comic j-comic-book"><div class="j-comic-page" tabindex="0" data-focus aria-label="${esc(s.title)} 漫画，第 ${idx+1} 页，共 ${total} 页"><span class="j-page-frame"><img src="${s.pages[idx]}" alt="${esc(s.title)}：第 ${idx+1} 页">${arrow}</span></div><div class="j-comic-controls"><span>${idx+1} / ${total}</span><button class="j-primary" data-j="next-panel">${last?(this.replay?'返回相册':'收下这一段回忆'):'下一页'} →</button></div></main>`,c.theme,'story-'+s.id);
  },
  paintComic(){
   const s=this.story,c=D.chapters[s.scene];
   if(s.pages&&s.pages.length)return this.paintPage(s,c);
   this.panel=Math.floor(this.panel/4)*4;
   const page=Math.floor(this.panel/4),pages=Math.ceil(s.panels.length/4);
   if(!this.replay){try{storage?.setItem(S.KEY+'.reader',JSON.stringify({id:s.id,panel:this.panel}));}catch(e){}}
   const cards=s.panels.slice(this.panel,this.panel+4).map((p,i)=>s.id==='opening'&&this.panel+i>=5?'':this.comicCard(p,this.panel+i)).join('');
   this.render(`${s.id==='opening'?'':this.scene(s.scene)}<main class="j-comic j-comic-book"><div class="j-comic-grid" tabindex="0" data-focus aria-label="第 ${page+1} 页，共 ${pages} 页；左右方向键翻页">${cards}</div><div class="j-comic-controls"><button class="j-secondary" data-j="previous-panel" ${page===0?'disabled':''}>← 上一页</button><span>${page+1} / ${pages}</span><button class="j-primary" data-j="next-panel">${page===pages-1?(this.replay?'返回相册':'收下这一段回忆'):'下一页'} →</button></div></main>`,c.theme,'story-'+s.id);
  },
  nextPanel(){
   const s=this.story;
   if(s.pages&&s.pages.length){
    if((this.pageIndex||0)+1<s.pages.length){this.pageIndex=(this.pageIndex||0)+1;this.paintPage(s,D.chapters[s.scene]);}
    else this.finishComic();
    return;
   }
   if(this.panel+4<this.story.panels.length){this.panel+=4;this.paintComic();}else this.finishComic();
  },
  previousPanel(){
   const s=this.story;
   if(s.pages&&s.pages.length){if((this.pageIndex||0)>0){this.pageIndex-=1;this.paintPage(s,D.chapters[s.scene]);}return;}
   if(this.panel>0){this.panel=Math.max(0,this.panel-4);this.paintComic();}
  },

  finishComic(){
  if(this.replay){this.journal();return;}
  const id=this.story.id;if(!this.campaign.acknowledge(id))return;
  if(this.campaign.state.pending.length){this.resumeStory();return;}
  if(id==='farewell'){this.choice();return;}
  if(['leave','stay','if-life'].includes(id)||id.startsWith('life-')||id.startsWith('home-')){this.map('challenge',0);return;}
  if(id==='travel-01'){this.map('normal',1);return;}
  if(id==='travel-02'){this.map('normal',2);return;}
  const n=id.startsWith('main-')?Number(id.slice(5)):null;
  this.map('normal',n===null?Math.min(2,Math.floor(this.campaign.state.main/5)):Math.floor((n-1)/5),n);
 },
  journal(page=this.journalPage||0){
  this.clean();this.page='journal';const s=this.campaign.state,list=(REVIEW?Object.keys(D.stories):s.seen).filter(id=>id!=='farewell');
  const pages=Math.max(1,Math.ceil(list.length/4));this.journalPage=Math.max(0,Math.min(pages-1,Number.isInteger(page)?page:0));
  const start=this.journalPage*4;
  const card=(id,i)=>{const story=D.stories[id],cover=story.pages?.[0]||story.panels[0]?.asset;return `<button class="j-memory-card" data-j="replay" data-story="${id}" aria-label="阅读：${esc(story.title)}"><span class="j-memory-art"><span class="j-shot-placeholder"><p>${esc(story.panels[0]?.text||story.title)}</p></span>${cover?`<img src="${esc(cover)}" alt="${esc(story.title)}漫画预览">`:''}</span><span class="j-memory-caption"><i>${String(start+i+1).padStart(2,'0')}</i><strong>${esc(story.title)}</strong><small>${D.chapters[story.scene].name}</small></span></button>`;};
  const leaves=[0,1].map(side=>`<section class="j-notebook-leaf" aria-label="第 ${this.journalPage*2+side+1} 页">${list.slice(start+side*2,start+side*2+2).map((id,i)=>card(id,side*2+i)).join('')||'<p class="j-notebook-empty">下一段回忆，留给明天。</p>'}<span class="j-paper-number">${this.journalPage*2+side+1}</span></section>`).join('');
  this.render(`${this.backdrop('assets/story/scenes/journal-room.jpg',true)}${this.head('旅行笔记')}<main class="j-journal j-notebook"><div class="j-notebook-heading"><h1>那些一起度过的日子</h1><p>把遇见的人和故事，收进纸页里。点击漫画，翻看回忆。</p></div><div class="j-notebook-spread" tabindex="0" data-focus aria-label="漫画笔记，第 ${this.journalPage+1} 组，共 ${pages} 组，可用左右方向键翻页">${leaves}</div><nav class="j-notebook-controls" aria-label="笔记翻页"><button class="j-page-arrow" data-j="journal-previous" aria-label="笔记上一页" ${this.journalPage===0?'disabled':''}>←</button><button class="j-notebook-back" data-j="back">回到旅程</button><span aria-live="polite">${this.journalPage+1} / ${pages}</span><button class="j-page-arrow" data-j="journal-next" aria-label="笔记下一页" ${this.journalPage===pages-1?'disabled':''}>→</button></nav></main>`,'valley','journal-view');
 },
  choice(){
   this.clean();this.page='choice';if(!REVIEW&&(this.campaign.state.main!==15||this.campaign.state.pending.length)){this.continue();return;}
   if(!REVIEW&&this.campaign.state.ending){this.continue();return;}
   this.render(`${this.scene(2)}${this.head('')}<main class="j-ending"><button class="j-next j-prev" data-j="backmap" aria-label="上一站：映光庭"><span>上一站</span></button><h1>天空很远。<br>朋友就在身边。</h1><div class="j-friends">${Object.keys(D.characters).map(id=>this.portrait(id)).join('')}</div><div class="j-ending-choices"><button data-j="choose" data-ending="leave">离开</button><button data-j="choose" data-ending="stay">留下</button></div></main>`,'light','ending-view');
  },
  departed(){
   this.clean();this.page='departed';
   this.render(`${this.scene(2)}${this.head('尾声 · 空着的泊位')}<main class="j-ending j-departed"><div class="j-empty-harbor"><img src="assets/story/panels/leave-06.png" alt="飞船已经离开，空泊位面向明亮的天空"><div><span class="j-eyebrow">AFTER THE GOODBYE</span><h1>风还经过这里。</h1><p>萤火号已飞向天空。<br>朋友们的祝福，陪着他去往更远的地方。</p></div></div><button class="j-primary" data-j="if">假设他留下来的生活 →</button><p class="j-reading-note">开启 IF 故事与创造模式，保留原来的离开结局。</p><button class="j-text-button" data-j="map" data-mode="normal" data-chapter="2">回顾走过的路</button></main>`,'light');
  },
  help(){
  if(this.page!=='help')this.helpFrom={page:this.page,mode:this.mode,chapter:this.chapter,journalPage:this.journalPage};
  this.clean();this.page='help';
  this.render(`${this.head('旅途手册')}<main class="j-help"><h1>把前面的路，一点点点亮。</h1><h2>怎么游玩</h2><p>拖动旋转，滚轮或双指缩放，点击至少两个相连的同色方块消除。冒险模式包含萤灯谷、风轮镇和映光庭，每章五关，尺寸从 5×5 到 9×9。</p><p>${REVIEW?'目前全部关卡、章节和故事均已开放，可以直接选关。灰色按钮表示尚未通关，仍然可以点击；完成的关卡会在按钮内显示“已通关”。':'关卡随旅程进度开放，读完本关故事后可进入下一关。'}</p><p>每一关从 0 分开始。结算达到本关目标才记录通关，一至五星门槛随关卡变化。消除一组 n 块得到 5×n² 分，少量剩余方块和全部消完另有结算奖励。失败或中途返回不记录通关，已完成的关卡可以重玩。</p><h2>故事与笔记</h2><p>故事相册是一册旅行笔记，点击右下角箭头翻页，左下角返回上一页，也可以用键盘左右方向键。点击纸页上的漫画预览打开完整故事，返回后保留笔记页码。阅读回忆不会改变已有通关成绩。</p><h2>挑战模式</h2><p>十一关${REVIEW?'全部开放':'随故事逐步开放'}，不设分数门槛，需完成本关任务。高楼营救仍需安全完成营救，失败可以重试。每关单独保存最高得分。</p><h2>进度与插画</h2><p>进度保存在当前浏览器，清除浏览器数据会删除记录。旧版存档不影响本版。已提供的漫画直接显示，缺图的故事仍可阅读文字。</p><button class="j-primary" data-j="modes">选择游戏模式 →</button></main>`,'valley','page-help');
 },
 };
 g.LevelProfile=(level,mode)=>mode==='normal'?S.profile(level):oldProfile(level,mode);
 A.boot=function(){original.boot.call(this);if(this.scene)J.init();};
 A.frame=function(now){if(J.visible){this.last=now;return;}return original.frame.call(this,now);};
 A.targetFor=function(level,tiles){return this.mode==='normal'?S.target(level):original.targetFor.call(this,level,tiles);};
 A.starSteps=function(){return this.mode==='normal'?S.starSteps(this.level):original.starSteps.call(this);};
 A.recordClear=function(){};
 A.showClearPanel=function(){if(this.mode==='normal'&&this.score>=this.target){J.settled('normal',this.level,this.score);return;}return original.showClearPanel.call(this);};
 A.startSelectedLevel=function(mode,level){return J.start(mode,level);};
 A.showLevelSelect=function(mode){J.map(mode,mode==='normal'?Math.floor((this.level-1)/5):0);};
 A.toMenu=function(){J.continue();};
 A.returnToLevelSelect=function(){J.map(this.mode==='challenge'?'challenge':'normal',this.mode==='normal'?Math.floor((this.level-1)/5):0);};
 A.startLevel=function(first){
  if(!J.campaign.canEnter(this.mode,this.level)){J.continue();return;}
  this.score=0;this.entryScore=0;J.skin(this.mode,this.level);original.startLevel.call(this,first);
  if(this.mode==='normal'){$('hudMode').textContent=D.chapters[S.profile(this.level).chapter].name;$('hudLevel').textContent=(this.level-1)%5+1;}
 };
 A.updateHud=function(){original.updateHud.call(this);if(this.mode==='normal'){$('hudMode').textContent=D.chapters[S.profile(this.level).chapter].name;$('hudLevel').textContent=(this.level-1)%5+1;}};
 A.showBanner=function(){original.showBanner.call(this);if(this.mode==='normal')$('banner').querySelector('.bn-lv').textContent=D.chapters[S.profile(this.level).chapter].name+' · 第 '+((this.level-1)%5+1)+' 关';};
 A.showHelp=function(){
  if(J.visible){J.help();return;}
  this.rememberHelpReturn();this.state='paused';this.overlay('<h2 class="ov-title">旅途玩法</h2><div class="ov-help"><p>点击至少两个相连的同色方块，拖动旋转视角，滚轮或双指缩放。提示按钮帮助寻找组合。</p><p>萤灯谷：普通消除。风轮镇：等待旋转板停靠。映光庭：让可见的同色边缘在画面中相接。</p><p>每关独立计分，结算达到目标才通关。创造模式没有目标分，需完成本关任务。详细机关说明请点击“！”按钮。</p></div><div class="ov-actions"><button class="ov-btn" data-act="resume">继续游戏</button></div>');
 };
 A.hasMechanicIntro=function(){return this.mode==='normal'&&S.profile(this.level).kind!=='normal';};
 A.showMechanicIntro=function(){
  if(this.challenge)return this.challenge.help();
  if(!this.hasMechanicIntro()||this.state!=='play')return;
  const rotor=S.profile(this.level).kind==='rotor';
  this.rememberHelpReturn();this.state='paused';this.clearHover();this.hideTip();
  this.overlay(`<h2 class="ov-title">${rotor?'旋转方板':'视角拼接'}</h2><div class="ov-help"><p>${rotor?'等方板停靠后，让实际接触的同色方块一起消除。转动的板沿主体边缘一转一停，只看起来重叠不算连接。':'旁边的方板是固定的。转动视角，让可见的同色边缘相接，就能一起消除。完全遮挡、只碰角或明显间隙不算连接。'}</p><p>消除仍需点击，不会自动发生。每关从 0 分开始，结算达到本关目标后解锁下一站。</p></div><div class="ov-actions"><button class="ov-btn" data-act="resume">我知道了</button></div>`);
 };
 const challengeResult=g.ChallengeGame.prototype.checkResult;
 g.ChallengeGame.prototype.checkResult=function(){
  const wasShown=this.resultShown;challengeResult.call(this);
  if(!wasShown&&this.resultShown&&this.world.result==='win')J.settled('challenge',this.level,this.world.score);
  else if(this.resultShown&&this.world.result==='lose')$('ovCard').querySelector('[data-act="next"]')?.remove();
 };
 const sync=g.ChallengeGame.prototype.syncHud;
 g.ChallengeGame.prototype.syncHud=function(){sync.call(this);$('hudMode').textContent='创造模式';};
})(window);

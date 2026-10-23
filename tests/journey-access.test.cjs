const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const S=require('../js/journey-state.js'),D=require('../js/journey-data.js');
test('all main and challenge levels are playable with unread stories and no progress',()=>{
 const c=new S.Campaign();
 for(const [mode,count] of [['normal',15],['challenge',11]])for(let n=1;n<=count;n++)assert.equal(c.canEnter(mode,n),true,`${mode} ${n}`);
 for(const [mode,n] of [['normal',0],['normal',16],['challenge',12],['other',1],['normal',1.5],['normal',NaN]])assert.equal(c.canEnter(mode,n),false);
 assert.equal(c.state.main,0);assert.equal(c.state.creative,0);assert.deepEqual(c.state.pending,['opening']);
});
test('out-of-order wins persist independently without marking skipped levels complete',()=>{
 let value=null;const storage={getItem:()=>value,setItem:(_,v)=>{value=v;}};let c=new S.Campaign(storage);
 assert.equal(c.complete('normal',10,S.target(10)-1),false);
 assert.equal(c.complete('normal',10,S.target(10)),true);assert.equal(c.state.main,0);
 assert.equal(c.complete('challenge',11,0),true);assert.equal(c.state.creative,0);
 c=new S.Campaign(storage);assert.equal(c.state.best.normal[10],S.target(10));assert.equal(c.state.best.challenge[11],0);
 assert.equal(c.state.best.normal[1],undefined);assert.ok(c.state.pending.includes('opening'));assert.ok(c.state.pending.includes('main-10'));
 assert.equal(c.complete('normal',1,S.target(1)),true);assert.equal(c.state.main,1);
 const pending=c.state.pending.slice();c.complete('normal',10,S.target(10)+50);assert.deepEqual(c.state.pending,pending);
});
function fixture(){
 let html='',stops=0;const handlers={};
 const root={addEventListener(name,fn){handlers[name]=fn;},querySelector(){return {};}};
 const g={JourneyData:D,JourneyState:S,App:{},ChallengeGame:function(){},SpaceOpening:{mount(){return {stop(){stops++;}};}}};
 const document={getElementById:()=>root,body:{classList:{add(){}},dataset:{}}};
 vm.runInNewContext(fs.readFileSync('js/journey.js','utf8'),{window:g,document});
 const j=g.Journey;j.clean=()=>{j.space?.stop();j.space=null;};j.render=s=>{html=s;};j.init();
 const click=dataset=>handlers.click({target:{closest:()=>({dataset,disabled:false})}});
 return {j,click,root,document,html:()=>html,stops:()=>stops};
}
test('start opens two modes on the same animated background and both buttons navigate',()=>{
 const f=fixture();f.click({j:'launch'});assert.equal(f.j.page,'modes');
 assert.match(f.html(),/冒险模式/);assert.match(f.html(),/挑战模式/);assert.match(f.html(),/<canvas/);assert.equal(f.stops(),1);
 f.click({j:'map',mode:'normal',chapter:'0'});assert.equal(f.j.page,'map');assert.equal(f.j.mode,'normal');
 f.j.modes();f.click({j:'map',mode:'challenge',chapter:'0'});assert.equal(f.j.mode,'challenge');
 assert.equal((f.html().match(/data-j="start"/g)||[]).length,11);assert.doesNotMatch(f.html(),/disabled|尚未抵达|未抵达/);
});
test('next stop advances scene and level range with zero clears',()=>{
 const f=fixture();f.j.campaign.acknowledge('opening');f.j.map('normal',0);
 f.click({j:'next'});assert.equal(f.j.page,'comic');assert.equal(f.j.story.id,'travel-01');assert.match(f.j.story.pages[0],/wind-0\.jpg/);
 f.j.finishComic();assert.equal(f.j.chapter,1);assert.match(f.html(),/data-level="6"/);assert.match(f.html(),/data-level="10"/);
 f.click({j:'next'});assert.equal(f.j.page,'comic');assert.equal(f.j.story.id,'travel-02');assert.match(f.j.story.pages[0],/light-0\.jpg/);
 f.j.finishComic();assert.equal(f.j.chapter,2);assert.match(f.html(),/data-level="11"/);assert.match(f.html(),/data-level="15"/);
 f.click({j:'next'});assert.equal(f.j.page,'choice');assert.equal(f.j.campaign.state.main,0);
});
test('only actually cleared buttons contain a completion label inside the button',()=>{
 const f=fixture();f.j.campaign.complete('normal',4,S.target(4));f.j.map('normal',0);
 assert.doesNotMatch(f.html(),/尚未抵达|未抵达|旅程在这里|故事进行中/);
 const buttons=[...f.html().matchAll(/<button data-j="start"[^>]*>(.*?)<\/button>/gs)];assert.equal(buttons.length,5);
 buttons.forEach((b,i)=>assert.equal(b[1].includes('已通关'),i===3));
 assert.equal((f.html().match(/j-stop unpassed/g)||[]).length,4);
});
test('notebook pagination exposes every story once and returns to the same spread after reading',()=>{
 const f=fixture();f.j.journal(0);const seen=[],expected=Object.keys(D.stories).filter(id=>id!=='farewell');
 for(let page=0;page<Math.ceil(expected.length/4);page++){
  assert.equal(f.j.journalPage,page);assert.match(f.html(),/j-notebook/);
  const ids=[...f.html().matchAll(/data-story="([^"]+)"/g)].map(m=>m[1]);assert.ok(ids.length>0&&ids.length<=4);seen.push(...ids);
  if(page===1){f.j.comic(ids[0],true);f.j.finishComic();assert.equal(f.j.journalPage,1);}
  f.click({j:'journal-next'});
 }
 assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,seen.length);
 assert.equal(seen[6],'travel-01');assert.equal(seen[7],'main-06');
 assert.equal(f.j.journalPage,Math.ceil(seen.length/4)-1);
 f.j.journal(0);f.click({j:'journal-previous'});assert.equal(f.j.journalPage,0);
});
test('reading a jumped-to main story returns to its chapter without indexing past the route',()=>{
 for(const level of [6,9,11,14]){
  const f=fixture();f.j.campaign.complete('normal',level,S.target(level));f.j.campaign.acknowledge('opening');
  f.j.comic(`main-${String(level).padStart(2,'0')}`);f.j.finishComic();
  assert.equal(f.j.page,'map');assert.equal(f.j.chapter,Math.floor((level-1)/5));assert.equal(f.j.campaign.state.main,0);
 }
});
test('header replaces continue with icon back and maps no longer contain the old creative shortcut',()=>{
 const f=fixture();f.j.map('normal',0);
 assert.doesNotMatch(f.html(),/>继续旅程<|>去创造模式</);
 assert.match(f.html(),/data-j="back"[^>]*aria-label="返回"/);
 f.click({j:'back'});assert.equal(f.j.page,'modes');
 f.j.map('normal',2);f.click({j:'back'});assert.equal(f.j.chapter,1);
 f.j.map('challenge',0);f.click({j:'back'});assert.equal(f.j.page,'modes');
 f.j.journal(2);f.j.help();f.click({j:'back'});assert.equal(f.j.page,'journal');assert.equal(f.j.journalPage,2);
});
test('game background launches even when the optional place caption is absent',()=>{
 const f=fixture();f.root.querySelector=()=>null;f.j.skin('normal',1);
 assert.equal(f.document.body.dataset.place,'valley');assert.equal(f.root.hidden,false);assert.ok(f.root.src);
});

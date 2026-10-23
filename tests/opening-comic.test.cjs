const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const D=require('../js/journey-data.js'),S=require('../js/journey-state.js');
let html='',stops=0;
const g={JourneyData:D,JourneyState:S,App:{},ChallengeGame:function(){}};
vm.runInNewContext(fs.readFileSync('js/journey.js','utf8'),{window:g,document:{getElementById(){}}});
const j=g.Journey;j.clean=()=>{j.space?.stop();j.space=null};j.render=s=>{html=s};j.root={querySelector(){return {}}};
g.SpaceOpening={mount(){return {stop(){stops++}}}};
j.home();assert.match(html,/开始游戏/);assert.match(html,/<canvas/);assert.doesNotMatch(html,/<video|登入/);
j.launch();assert.equal(j.page,'modes');assert.equal(stops,1);
assert.match(html,/冒险模式/);assert.match(html,/挑战模式/);assert.match(html,/<canvas/);
j.launch();assert.equal(j.page,'modes','repeated start ignored');
j.comic('opening');assert.equal(j.story.id,'opening');assert.equal(j.panel,0);
if(j.story.pages){assert.ok(fs.existsSync(j.story.pages[0]));assert.match(html,/j-comic-page/);}
// Also exercise the retained panel reader used by stories without a supplied full page.
j.story={...j.story,pages:undefined};j.paintComic();
for(const p of j.story.panels.slice(0,5))assert.ok(fs.existsSync(p.asset),p.asset);
assert.equal((html.match(/class="j-comic-panel/g)||[]).length,4,'four panels on each page');
assert.doesNotMatch(html,/<video|<canvas/);
assert.doesNotMatch(html,/j-header|j-comic-heading|j-filmstrip|j-reading-note/,'comic starts at top without chrome');
j.nextPanel();assert.equal(j.page,'comic');assert.equal(j.panel,4);
assert.match(html,/canyon.png/);
assert.doesNotMatch(html,/opening-04.png|opening-05.png|opening-06.png/,'omit empty rescue cards');
j.previousPanel();assert.equal(j.panel,0);
const campaign=j.campaign;let acknowledged=0;
j.campaign={...campaign,state:campaign.state,acknowledge(){acknowledged++;return false}};
j.nextPanel();assert.equal(acknowledged,0,'page turn must not finish story');
j.nextPanel();assert.equal(acknowledged,1,'only last page finishes story');j.campaign=campaign;
console.log('PASS start button, single transition, supplied comic images, consecutive reading');
let tick,finished=0,now=0,draws=0;
const ctx=new Proxy({createLinearGradient(){return {addColorStop(){}}},drawImage(){draws++}},{get(o,k){return k in o?o[k]:()=>{}}});
const win={matchMedia(){return {matches:false}},devicePixelRatio:1};
class Image{constructor(){this.complete=true;this.naturalWidth=1024;this.naturalHeight=1360}}
vm.runInNewContext(fs.readFileSync('js/space-opening.js','utf8'),{window:win,Image,performance:{now:()=>0},requestAnimationFrame(fn){tick=fn;return 1},cancelAnimationFrame(){}});
const animation=win.SpaceOpening.mount({getContext:()=>ctx,clientWidth:1000,clientHeight:700},()=>finished++);
for(let i=0;i<130;i++)tick(now+=50);
assert.equal(finished,0);assert.ok(draws>0,'home animates supplied artwork');
animation.stop();const before=draws;tick(now+=50);assert.equal(draws,before,'cleanup stops rendering');
console.log('PASS animated art waits for start and stops on cleanup');

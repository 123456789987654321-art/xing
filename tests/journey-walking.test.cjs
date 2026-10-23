const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../js/journey-state.js'),D=require('../js/journey-data.js');
function fixture(){
 const g={JourneyData:D,JourneyState:S,App:{},ChallengeGame:function(){},innerWidth:1440};
 vm.runInNewContext(fs.readFileSync('js/journey.js','utf8'),{window:g,document:{getElementById:()=>({classList:{remove(){}}})},setTimeout});
 const j=g.Journey;j.clean=()=>{};j.root={querySelector:()=>null};j.render=html=>{j.html=html;j.epoch++;};j.campaign.state.pending=[];j.campaign.state.seen=['opening','travel-01','travel-02'];j.map('normal',0);
 return {j,g};
}
test('route traverses intermediate stops and reverses the same curve',()=>{
 const {j}=fixture(),forward=j.routePath('light',0,4),back=j.routePath('light',4,0);
 assert.deepEqual(JSON.parse(JSON.stringify(back)),JSON.parse(JSON.stringify(forward)).reverse());
 for(const p of [[2,66],[50,92],[76,70],[58,18],[86,-18]])assert.ok(forward.some(q=>q[0]===p[0]&&q[1]===p[1]));
 assert.ok(forward.some(p=>p[0]<58&&p[1]>18&&p[1]<70));
});
test('clicking an old level waits for arrival before starting',()=>{
 const {j,g}=fixture();j.campaign.state.position=4;let arrive,started=0;
 j.walkTo=(level,callback)=>{assert.equal(level,1);arrive=callback;};g.App.startLevel=()=>started++;
 j.start('normal',1);assert.equal(started,0);arrive();assert.equal(started,1);
});
test('clearing level advances from that level, not furthest campaign progress',()=>{
 const {j}=fixture();j.campaign.state.main=5;const calls=[];j.walkTo=(level)=>calls.push(level);
 j.settled('normal',1,2000);assert.equal(j.campaign.state.position,1);assert.deepEqual(calls,[2]);
 j.settled('normal',5,99999);assert.deepEqual(calls,[2,5]);
});
test('next exits via fifth then lands at next first; final chapter cannot exit',()=>{
 const {j}=fixture();let arrive;j.walkTo=(level,callback,exit)=>{assert.equal(level,5);assert.equal(exit,1);arrive=callback;};
 j.nextStop();assert.equal(j.chapter,0);arrive();assert.equal(j.chapter,1);assert.equal(j.campaign.state.position,6);
 j.map('normal',2);j.nextStop();assert.equal(j.chapter,2);assert.doesNotMatch(j.html,/data-j="next"/);
});
test('previous returns via current first to previous fifth',()=>{
 const {j}=fixture();j.map('normal',2);let arrive;j.walkTo=(level,callback,exit)=>{assert.equal(level,11);assert.equal(exit,-1);arrive=callback;};
 j.prevStop();assert.equal(j.chapter,2);arrive();assert.equal(j.chapter,1);assert.equal(j.campaign.state.position,10);
});
test('a fully cleared chapter exits directly from current stop without detouring to fifth',()=>{
 const {j}=fixture();j.campaign.state.main=5;j.campaign.state.position=2;let arrive;
 j.walkTo=(level,callback,exit)=>{assert.equal(level,2);assert.equal(exit,1);arrive=callback;};
 j.nextStop();assert.equal(j.chapter,0);arrive();assert.equal(j.chapter,1);assert.equal(j.campaign.state.position,6);
});

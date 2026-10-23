(function(root){
 'use strict';
 const KEY='firefly.journey.v1';
 // 暂时开放全部内容；恢复顺序解锁时改为 false，已有通关纪录不变。
 const ALL_UNLOCKED=true;
 // 每行是一关的一至五星门槛；第一颗星同时是通关目标。
 const SCORES=[
  [700,900,1100,1300,1600],[1300,1550,1800,2100,2500],
  [2100,2400,2700,3000,3500],[3000,3400,3800,4200,4800],[4200,4700,5100,5500,6200],
  [800,1000,1200,1450,1800],[1450,1750,2050,2400,2850],
  [2300,2650,3000,3400,4000],[3300,3750,4200,4700,5400],[4600,5150,5650,6200,7000],
  [1000,1400,1900,2500,3300],[1750,2300,2950,3700,4600],
  [2700,3400,4200,5100,6200],[3850,4750,5700,6800,8100],[5200,6300,7500,8800,10300]
 ];
 const pad=n=>String(n).padStart(2,'0');
 const valid=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 function profile(level){
  const n=Math.max(1,Math.min(15,Math.floor(level)||1)),chapter=Math.floor((n-1)/5);
  return {size:5+(n-1)%5,kind:['normal','rotor','perspective'][chapter],title:['萤灯谷 · 经典消除','风轮镇 · 旋转方板','映光庭 · 视角拼接'][chapter],chapter};
 }
 function starSteps(level){const p=profile(level);return SCORES[p.chapter*5+p.size-5].slice();}
 function target(level){return starSteps(level)[0];}
 const fresh=()=>({version:1,main:0,creative:0,ending:null,ifLine:false,pending:['opening'],seen:[],best:{normal:{},challenge:{}}});
 function expectedIds(){return new Set(['opening','travel-01','travel-02','farewell','leave','stay','if-life',...Array.from({length:15},(_,i)=>'main-'+pad(i+1)),...Array.from({length:11},(_,i)=>'life-'+pad(i+1)),...Array.from({length:11},(_,i)=>'home-'+pad(i+1))]);}
 class Campaign{
  constructor(storage,{allUnlocked=ALL_UNLOCKED}={}){
   this.allUnlocked=allUnlocked;this.storage=storage;this.storageAvailable=true;this.state=fresh();
   try{
    const s=JSON.parse(storage?.getItem(KEY)||'null'),ids=expectedIds();
    if(s&&s.version===1&&valid(s.main,15)&&valid(s.creative,11)&&[null,'leave','stay'].includes(s.ending)&&typeof s.ifLine==='boolean'&&Array.isArray(s.pending)&&s.pending.every(x=>ids.has(x))&&Array.isArray(s.seen)&&s.seen.every(x=>ids.has(x))&&s.best&&typeof s.best==='object'&&(!s.ifLine||s.ending==='leave')){
     this.state={...s,seen:[...new Set(s.seen)],pending:[...new Set(s.pending)],best:{normal:{},challenge:{}}};
     for(const mode of ['normal','challenge'])for(const [k,v] of Object.entries(s.best[mode]||{}))if(valid(Number(k),mode==='normal'?15:11)&&Number(k)>0&&Number.isFinite(v)&&v>=0)this.state.best[mode][k]=v;
    }
   }catch(e){if(e?.name!=='SyntaxError')this.storageAvailable=false;}
  }
  persist(){try{if(!this.storage)throw Error('Storage unavailable');this.storage.setItem(KEY,JSON.stringify(this.state));}catch(e){this.storageAvailable=false;}}
  get homeLine(){return this.state.ending==='leave'&&!this.state.ifLine;}
  challengeStory(level){return (this.homeLine?'home-':'life-')+pad(level);}
  get unlockedCreative(){return this.allUnlocked||this.state.ending==='stay'||this.homeLine||this.state.ifLine;}
  canEnter(mode,level){
   const max=mode==='normal'?15:mode==='challenge'?11:0;
   return Number.isSafeInteger(level)&&level>0&&level<=max&&(this.allUnlocked||(!this.state.pending.length&&(mode==='normal'||this.unlockedCreative)&&level<=(mode==='normal'?this.state.main:this.state.creative)+1));
  }
  complete(mode,level,score){
   if(!this.canEnter(mode,level)||!Number.isFinite(score)||score<0||(mode==='normal'&&score<target(level)))return false;
   const s=this.state,key=mode==='normal'?'main':'creative',first=level>s[key]&&!Object.hasOwn(s.best[mode],level);
   s.best[mode][level]=Math.max(s.best[mode][level]||0,score);
   const story=mode==='normal'?'main-'+pad(level):this.challengeStory(level);
   if(first||(mode==='challenge'&&!s.seen.includes(story))){
    const stories=[story];
    if(mode==='normal'&&[5,10].includes(level))stories.push('travel-'+pad(level/5));
    if(mode==='normal'&&level===15)stories.push('farewell');
    s.pending=[...new Set([...s.pending,...stories])];
   }
   while(s[key]<(mode==='normal'?15:11)&&Object.hasOwn(s.best[mode],s[key]+1))s[key]++;
   this.persist();return true;
  }
  acknowledge(id){
   if(this.state.pending[0]!==id)return false;
   this.state.pending.shift();if(!this.state.seen.includes(id))this.state.seen.push(id);this.persist();return true;
  }
  choose(ending){
   const s=this.state;if(!['leave','stay'].includes(ending)||(!this.allUnlocked&&(s.main!==15||s.pending.length||s.ending)))return false;
   s.ending=ending;s.ifLine=false;s.pending=[ending];this.persist();return true;
  }
  enterIf(){
   const s=this.state;if(s.pending.length||(!this.allUnlocked&&(s.ending!=='leave'||s.ifLine)))return false;
   s.ending='leave';s.ifLine=true;s.pending=['if-life'];this.persist();return true;
  }
 }
 const api={Campaign,profile,target,starSteps,ALL_UNLOCKED,KEY};root.JourneyState=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

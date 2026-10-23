// Deterministic shell-only baseline, not a simulation of human spatial play.
const fs=require('node:fs'),path=require('node:path');
require('../js/board.js');
const {target}=require('../js/journey-state.js');
const samples=600,rows=[];let state=123456;
const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
for(const policy of ['random','largest'])for(let size=5;size<=9;size++){
 const scores=[],remains=[];
 for(let run=0;run<samples;run++){
  const board=new globalThis.Board(size);board.fillRandom(6,rnd);let score=0;
  while(true){
   const seen=new Set(),groups=[];
   for(let id=0;id<board.size;id++){
    if(board.color[id]<0||seen.has(id))continue;
    const group=board.groupOf(id);group.forEach(x=>seen.add(x));if(group.length>1)groups.push(group);
   }
   if(!groups.length)break;
   const group=policy==='random'?groups[Math.floor(rnd()*groups.length)]:groups.reduce((a,b)=>b.length>a.length?b:a);
   score+=5*group.length**2;board.remove(group);board.applyGravity();
  }
  const remain=board.aliveCount();scores.push(score+(remain===0?2000:Math.max(0,(13-remain)*100)));remains.push(remain);
 }
 scores.sort((a,b)=>a-b);remains.sort((a,b)=>a-b);const percentile=p=>scores[Math.floor(samples*p)];
 const goal=target(size-4),row={policy,size,samples,target:goal,p10:percentile(.1),p20:percentile(.2),median:percentile(.5),p80:percentile(.8),p95:percentile(.95),medianRemaining:remains[samples/2],passRate:scores.filter(n=>n>=goal).length/samples};
 rows.push(row);console.log(JSON.stringify(row));
}
const out=path.join(__dirname,'../.qa/score-balance.json');fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({seed:123456,samplesPerSizeAndPolicy:samples,runs:samples*10,scope:'Classic shell only; no rotor contacts or perspective seams. Mechanic premiums require human playtesting.',rows},null,2));

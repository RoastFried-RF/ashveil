import {playerAct} from '../src/core/game'
import {makeWorld} from './helpers'
import {player,tileAt,turnOf} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {marketFor} from '../src/core/economy'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
export function merchantAppraisalFixture(seed='merchant-appraisal'){
 const w=makeWorld(seed,'Bg.Hunter',true),s=w.s,p=player(w),m=s.overworld!
 p.pos={...s.map.exits[0]!};let error=playerAct(w,{type:'leave'});if(error)throw Error(error)
 const site=m.sites.find(site=>site.kind==='settlement'&&site.faction==='coalition')!;m.position={...site.cell};error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const trader=s.creatures.find(c=>c.traderSite)!,market=marketFor(w,trader)!
 s.time=1440000;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};s.storyteller.budget=-1e9
 for(const c of s.creatures)c.nextAct=1e12
 p.nextAct=s.time;p.literacy=2;p.literate=true;p.age=undefined;p.background=undefined;p.traits=[];p.traumas=[];p.thoughts=[];p.effects=[];p.diseases=[];p.body.wounds=[];p.body.tourniquets={};p.equip={};p.bag=[];p.money=1000;p.pos={x:trader.pos.x,y:trader.pos.y+1}
 Object.assign(p.needs,{bodyTemp:37,kcal:1000,waterDeficit:0,fatigue:20,sleepDebt:0,wetness:0,skinWetness:{},hygiene:70,stress:10})
 tileAt(w,p.pos).t='Terrain.Earth';tileAt(w,p.pos).roof=true
 const appearance=Object.keys(s.knowledge.pillMap).sort()[0]!,pill=makeItem(w,appearance,3)
 if(addToBag(w,p,pill))throw Error('original owned unknown pills')
 invalidateLights(w);updatePlayerVision(w,p)
 const policy=(honesty:number)=>{const m=loadMods([...readPackages(),{manifest:{id:'appraisal-test',name:'appraisal-test',version:'1'},defs:[],patches:[{op:'replace',target:'Knowledge.Human',path:'/appraisal/factionHonesty',value:{[trader.faction]:honesty}},{op:'replace',target:'Knowledge.Human',path:'/appraisal/relationPerPoint',value:0}]}]);if(m.report.errors.length)throw Error(m.report.errors.join('\n'));w.db=m.db}
 return{w,s,p,trader,market,pill,appearance,truth:s.knowledge.pillMap[appearance]!,policy,at:()=>turnOf(w)}
}

export type MerchantAppraisalPhase='quote'|'lie'|'refuted'|'honest'|'staleFee'|'pending'
export async function merchantAppraisalNativeFixture(phase:MerchantAppraisalPhase){
 const d=merchantAppraisalFixture(phase==='honest'?'merchant-appraisal-proof-1':'merchant-appraisal-proof-43')
 const {appraisalQuote}=await import('../src/core/merchant-appraisal'),{pillBelief}=await import('../src/core/knowledge-state'),{stateHash,serialize}=await import('../src/core/save')
 const q=appraisalQuote(d.w,d.p,d.trader,d.pill.uid),initialTime=d.s.time,initialMoney=d.p.money,initialMarketMoney=d.market.money,originalPill=structuredClone(d.pill)
 let claim:string|undefined,refused:string|undefined
 if(phase==='quote'){
  const before=stateHash(d.s);for(let i=0;i<5;i++)appraisalQuote(d.w,d.p,d.trader,d.pill.uid)
  if(before!==stateHash(d.s))throw Error('quote mutated whole world')
 }else if(phase==='staleFee'){
  const before=JSON.parse(serialize(d.s)),error=playerAct(d.w,{type:'merchantIdentify',target:d.trader.id,uid:d.pill.uid,expectedFee:q.fee+1}),after=JSON.parse(serialize(d.s))
  const feedback=after.log.splice(before.log.length)
  if(!error||feedback.length!==1||feedback[0].text!==error||JSON.stringify(before)!==JSON.stringify(after))throw Error('stale fee changed state beyond normal refusal feedback');refused=error
 }else{
  let error=playerAct(d.w,{type:'merchantIdentify',target:d.trader.id,uid:d.pill.uid,expectedFee:q.fee});if(error)throw Error(error)
  claim=pillBelief(d.w,d.appearance)!.belief
  if(phase==='refuted'||phase==='honest'||phase==='pending'){error=playerAct(d.w,{type:'examine',uid:d.pill.uid},phase==='pending'?2:undefined);if(error)throw Error(error)}
 }
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialMoney,initialMarketMoney,originalPill,appearance:d.appearance,traderId:d.trader.id,fee:q.fee,claim,refused,pending:phase==='pending'}}
}

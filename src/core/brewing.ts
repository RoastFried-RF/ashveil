import {capacity} from './body'
import {channelTurns} from './action-time'
import {log,turnOf,type World} from './ctx'
import {preservationFire} from './preservation-state'
import {campfireAt} from './campfire'
import {cheb} from './geom'
import {hasLos} from './fov'
import {itemDef} from './items'
import {drinkVolume} from './wash-water'
import {treatedWater,waterQuality} from './water-state'
import type {Creature} from './types'
function rawBrewQuote(w:World,c:Creature,uid:number,leafUid?:number){
 const bottle=c.bag.find(i=>i.uid===uid),leaf=leafUid===undefined?c.bag.find(i=>!!itemDef(w,i).brew):c.bag.find(i=>i.uid===leafUid),rule=leaf&&itemDef(w,leaf).brew
 const ml=bottle?drinkVolume(w,bottle):0,quality=bottle?waterQuality(w,bottle):undefined,fire=preservationFire(w,c.pos),need=rule?Math.ceil(ml/rule.mlPerLeaf):0
 const leaves:{uid:number;def:string;count:number}[]=[]
 let left=need
 if(leaf)for(const i of c.bag.filter(i=>i.def===leaf.def).sort((a,b)=>Number(b.uid===leaf.uid)-Number(a.uid===leaf.uid)||a.uid-b.uid)){const count=Math.min(left,i.count);if(count>0){leaves.push({uid:i.uid,def:i.def,count});left-=count}}
 let error:string|null=null
 if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 물병을 다룰 손이 필요하다'
 else if(!bottle||!leaf||!rule||!rule.bottles.includes(bottle.def)||bottle.count!==1||bottle.waterFrozen)error='배낭의 실제 물병과 솔잎을 확인해야 한다'
 else if(!Number.isSafeInteger(ml)||ml<rule.mlPerLeaf||ml>Math.min(Math.round((itemDef(w,bottle).uses??1)*itemDef(w,bottle).drink!.water),Math.round((w.db.item(rule.result).uses??1)*w.db.item(rule.result).drink!.water)))error='차 한 잔 이상 끓일 실제 물이 필요하다'
 else if(!quality||![quality.pathogen,quality.ash,quality.salinity??0].every(n=>Number.isFinite(n)&&n>=0))error='원래 물의 수질 기록을 확인해야 한다'
 else if(left>0)error='실제 물의 양에 맞는 솔잎이 부족하다'
 else if(!fire)error='직접 피운 실제 장작불 바로 곁이어야 한다'
 const turns=rule?channelTurns(w,c,rule.turns):null
 if(!error&&turns===null)error='몸 상태로 차를 끓일 수 없다'
 const signature=rule?JSON.stringify({rule,drink:w.db.item(rule.result).drink}):''
 return{error,bottle,leaf,rule,ml,quality,fire,leaves,turns:turns??0,signature}
}
export function brewQuote(w:World,c:Creature,uid:number,leafUid?:number){
 const job=c.brewJob,q=rawBrewQuote(w,c,uid,leafUid??(job?.uid===uid?job.brew.leafUid:undefined))
 let error=q.error
 if(job){
  const b=job.brew,f=campfireAt(w,b.firePos)
  if(uid!==job.uid)error='원래 물병의 차 끓이기를 마치거나 취소해야 한다'
  else if(!error&&(q.bottle!.def!==b.sourceDef||q.ml!==b.ml||JSON.stringify(q.quality)!==JSON.stringify(b.quality)||q.signature!==b.signature||JSON.stringify(q.leaves)!==JSON.stringify(b.leaves)||!f||f.uid!==b.fireUid||f.light.off||(f.light.fuelUntil??0)<=turnOf(w)||cheb(c.pos,b.firePos)>1||!hasLos(w,c.pos,b.firePos)))error='원래 물·솔잎·불이나 끓이기 규칙이 바뀌었다. 먼저 작업을 취소하자'
 }
 return{...q,error,turns:job?.uid===uid?job.remaining:q.turns}
}
export function cancelBrew(c:Creature){if(c.activity?.kind==='brewTea')c.activity=undefined;c.brewJob=undefined}
export function startBrew(w:World,c:Creature,uid:number,leafUid?:number):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=brewQuote(w,c,uid,leafUid);if(q.error)return q.error
 const job=c.brewJob??{uid,remaining:q.turns,total:q.turns,brew:{leafUid:q.leaf!.uid,leaves:structuredClone(q.leaves),sourceDef:q.bottle!.def,ml:q.ml,quality:structuredClone(q.quality!),signature:q.signature,fireUid:q.fire!.uid,firePos:{...q.fire!.light.pos}}}
 c.brewJob=job;c.activity={kind:'brewTea',remaining:job.remaining,total:job.total,label:'솔잎차 끓이기',uid,brew:structuredClone(job.brew)}
 return null
}
export function brewStep(w:World,c:Creature){
 const act=c.activity,b=act?.brew;if(!act||!b)return true
 const q=brewQuote(w,c,act.uid!,b.leafUid),f=campfireAt(w,b.firePos)
 const changed=q.error||q.bottle!.def!==b.sourceDef||q.ml!==b.ml||JSON.stringify(q.quality)!==JSON.stringify(b.quality)||q.signature!==b.signature||JSON.stringify(q.leaves)!==JSON.stringify(b.leaves)||!f||f.uid!==b.fireUid||f.light.off||(f.light.fuelUntil??0)<=turnOf(w)||cheb(c.pos,b.firePos)>1||!hasLos(w,c.pos,b.firePos)
 if(changed){c.activity=undefined;if(c.id===w.s.playerId)log(w,'warn','차 끓이기 중단: '+(q.error??'원래 물·솔잎·불이나 조리 규칙이 달라졌다')+'.');return true}
 if(c.brewJob)c.brewJob.remaining=Math.max(0,act.remaining)
 if(act.remaining>0)return false
 for(const row of b.leaves)c.bag.find(i=>i.uid===row.uid)!.count-=row.count
 c.bag=c.bag.filter(i=>i.count>0)
 const it=q.bottle!,d=w.db.item(q.rule!.result)
 it.def=d.id;it.uses=b.ml/d.drink!.water;it.water=treatedWater(w,b.quality,'boil');it.freshness=100;it.foodAgedAt=turnOf(w);delete it.waterSettlesAt
 c.activity=undefined;c.brewJob=undefined
 if(c.id===w.s.playerId)log(w,'info','같은 물병의 실제 물'+b.ml+'ml로 솔잎차를 끓였다. 원래 재와 소금은 남았다.')
 return true
}

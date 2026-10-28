// 원래 물건의 유료 감별. 근거가 확정될 때까지 상인의 말은 추정이다.
import {capacity} from './body'
import {clamp,log,rng,turnOf,type World} from './ctx'
import {reputation} from './diplomacy'
import {economyDef,marketFor,tradeAccess} from './economy'
import {rememberMeeting} from './first-impressions'
import {findItem,itemDef} from './items'
import {knowledgeDef,pillBelief,recordPill} from './knowledge-state'
import type {Creature,PillEffectDef} from './types'
export function appraisalQuote(w:World,c:Creature,trader:Creature,uid:number){
 const policy=knowledgeDef(w).appraisal,it=findItem(c,uid),fee=policy&&it?Math.max(1,Math.ceil((itemDef(w,it).value??0)*policy.feeRate)):0
 let error:string|null
 if(!policy)error='상인 감별 규칙이 없다'
 else if(c.id!==w.s.playerId)error='본인의 약만 감별할 수 있다'
 else if(!w.s.creatures.includes(c)||!w.s.creatures.includes(trader)||c.asleep||capacity(w,trader,'consciousness')<.5)error='의식이 또렷한 두 사람이 여기에 있어야 한다'
 else error=tradeAccess(w,c,trader)
 if(!error&&(!it||itemDef(w,it).unidentified!=='pill'||!w.db.tryGet<PillEffectDef>(w.s.knowledge.pillMap[it.def]??'')))error='가지고 있는 미확인 약이 필요하다'
 if(!error&&it&&pillBelief(w,it.def)?.confidence==='certain')error='이미 확정한 약이다'
 if(!error&&(c.money??0)<fee)error='감별료가 부족하다'
 return{fee,error}
}
export function appraisePill(w:World,c:Creature,trader:Creature,uid:number,expectedFee?:number):string|null{
 const quote=appraisalQuote(w,c,trader,uid)
 if(quote.error)return quote.error
 if(expectedFee!==undefined&&expectedFee!==quote.fee)return'감별료가 바뀌었다. 다시 확인하자'
 const it=findItem(c,uid)!,policy=knowledgeDef(w).appraisal!,truth=w.s.knowledge.pillMap[it.def],stream=rng(w,`world.knowledge.appraisal.${trader.id}`),honesty=clamp((policy.factionHonesty[trader.faction]??policy.honesty)+reputation(w,trader.faction)*policy.relationPerPoint,0,1)
 const honest=stream.float()<honesty,other=w.db.all<PillEffectDef>('PillEffect').filter(p=>p.id!==truth).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),belief=!honest&&other.length?stream.pick(other).id:truth,market=marketFor(w,trader)!,now=turnOf(w)
 c.money=(c.money??0)-quote.fee;market.money+=quote.fee
 const receipts=w.s.knowledge.appraisalReceipts??=[],old=receipts.find(r=>r.merchant===trader.id&&r.appearance===it.def&&r.belief===belief&&r.refutedAt===undefined)
 if(old){old.paid+=quote.fee;old.lastAt=now}else receipts.push({item:it.uid,merchant:trader.id,appearance:it.def,belief,paid:quote.fee,at:now,lastAt:now})
 w.s.knowledge.appraisalReceipts=receipts
 recordPill(w,it.def,'merchant',trader.name+'의 유료 감별',belief,'likely')
 rememberMeeting(w,c,trader)
 log(w,'info',trader.name+'의 감별: '+w.db.pill(belief).label+'이라고 말한다. 감별료'+quote.fee+economyDef(w).currency+'를 냈다.')
 return null
}

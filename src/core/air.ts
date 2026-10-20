// 실제 바깥 재 먼지/젖은 여과포·원래 현물 교체와 남은 작업.
import {channelTurns} from './action-time'
import {airRules,ashLungStage,dustMask,inhaledAsh} from './air-state'
import {capacity} from './body'
import {inBounds,log,tileAt,turnOf,type World} from './ctx'
import {allItems,removeOne} from './items'
import {emitNoise} from './perception'
import type {Creature,ItemInst} from './types'
export function inhalationTick(w:World,c:Creature){
 const d=airRules(w);if(!d||!c.alive||w.db.body(c.body.def).kind==='mechanical'||w.db.body(c.body.def).waterBreathing)return
 if(c.body.inhaledAsh!==undefined&&(!Number.isFinite(c.body.inhaledAsh)||c.body.inhaledAsh<0))return
 const turn=turnOf(w),oldStage=ashLungStage(w,c),rate=w.s.map.kind==='surface'&&inBounds(w,c.pos)&&!tileAt(w,c.pos).roof&&!c.aquatic?.submerged?d.weather[w.s.weather]??0:0
 if(rate>0){const mask=dustMask(w,c);c.body.inhaledAsh=Math.round((inhaledAsh(c)+rate*(1-(mask?.protection??0)))*1e6)/1e6;if(mask)mask.it.uses=Math.max(0,mask.it.uses!-1)}
 const stage=ashLungStage(w,c)
 if(stage>oldStage&&c.id===w.s.playerId)log(w,'danger','오래 들이마신 재가 폐에 남았다. 호흡의 손상은 회복되지 않는다. 재바람을 피하고 실제 여과포를 써야 한다.')
 if(stage&&!c.aquatic?.submerged&&turn%d.coughTurns===0)emitNoise(w,c.pos,d.coughNoise,c.id)
}
function ownedMask(w:World,c:Creature,uid:number){return allItems(c).find(it=>it.uid===uid&&it.count===1&&w.db.item(it.def).respirator)}
function fullFilter(w:World,it:ItemInst|undefined,id:string){return !!it&&it.def===id&&it.count>=1&&it.uses===w.db.item(id).uses&&Number.isFinite(it.uses)&&(it.uses??0)>0}
export function maskRefillQuote(w:World,c:Creature,uid:number,filterUid?:number){
 const mask=ownedMask(w,c,uid),rule=mask&&w.db.item(mask.def).respirator,filter=rule?(filterUid===undefined?c.bag.find(it=>fullFilter(w,it,rule.filter)):c.bag.find(it=>it.uid===filterUid)):undefined
 let error:string|null=null
 if(!mask||!rule)error='원래 방진 면포가 없다'
 else if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 여과포를 바꿀 손을 쓸 수 있어야 한다'
 else if((mask.durability??100)<=0)error='찢어진 면포를 먼저 기워야 한다'
 else if(!Number.isFinite(mask.uses??0)||(mask.uses??0)<0||(mask.uses??0)>rule.chargeTurns)error='남은 여과 시간 기록이 올바르지 않다'
 else if((mask.uses??0)>=rule.chargeTurns)error='이미 새 여과포다'
 else if(!fullFilter(w,filter,rule.filter))error='배낭에 쓰지 않은 원래 천 여과포가 필요하다'
 const turns=rule?channelTurns(w,c,rule.refillTurns):null;if(!error&&turns===null)error='몸 상태로 여과포를 바꿀 수 없다'
 return{error,turns:turns??0,mask,filter,rule}
}
export function startMaskRefill(w:World,c:Creature,uid:number,filterUid:number):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=maskRefillQuote(w,c,uid,filterUid);if(q.error)return q.error
 c.activity={kind:'respirator',uid,toolUid:filterUid,remaining:q.turns,total:q.turns,label:'원래 방진 면포의 여과포 바꾸기',maskSignature:JSON.stringify([q.mask?.def,q.rule]),maskUses:q.mask!.uses??0,supplies:[{uid:filterUid,def:q.filter!.def,count:1}]};return null
}
export function maskRefillStep(w:World,c:Creature):boolean{
 const a=c.activity!;if(a.kind!=='respirator')return true
 const q=maskRefillQuote(w,c,a.uid!,a.toolUid)
 if(q.error||JSON.stringify([q.mask?.def,q.rule])!==a.maskSignature||(q.mask!.uses??0)!==a.maskUses||q.filter?.def!==a.supplies?.[0]?.def){c.activity=undefined;if(c.id===w.s.playerId)log(w,'warn','원래 면포나 여과 재료를 잃어 교체를 멈췄다.');return true}
 if(a.remaining>0)return false
 removeOne(w,c,q.filter!.uid);q.mask!.uses=q.rule!.chargeTurns;c.activity=undefined
 if(c.id===w.s.playerId)log(w,'good','같은 방진 면포에 실제 새 여과포를 넣었다. 이미 들이마신 재는 남는다.')
 return true
}

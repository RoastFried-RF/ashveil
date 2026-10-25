/** Real gland portions and wound-bound local paralysis, never global invented poison damage. */
import {capacity,part,isDescendantOrSelf} from './body'
import {log,rng,tileAt,turnOf,type World} from './ctx'
import {addToBag} from './items'
import {lightLevel} from './fov'
import type {Creature,ToxinCoating,ItemDef} from './types'
export function applyLocalToxin(w:World,source:Creature,target:Creature,partId:string,woundId:number,toxin:ToxinCoating){
 const wound=target.body.wounds.find(x=>x.id===woundId&&x.part===partId&&x.sourceId===source.id)
 if(!target.alive||!wound||w.db.wound(wound.def).bleedPerSeverity<=0||w.db.body(target.body.def).kind==='mechanical')return false
 const pd=part(w,target,partId),body=w.db.body(target.body.def),root=pd.limb??pd.id
 const crawler=w.db.creature(target.def).crawler,motor=crawler?.segments.find(g=>g.body===pd.id||g.ganglion===pd.id)
 const parts=pd.limb?body.parts.filter(p=>isDescendantOrSelf(w,target,p.id,root)).map(p=>p.id):motor?[motor.body,motor.ganglion,...motor.legs]:crawler&&pd.id===crawler.head?body.parts.filter(p=>(p.id===crawler.head||p.parent===crawler.head)&&!crawler.segments.some(g=>g.body===p.id)).map(p=>p.id):[pd.id]
 const now=turnOf(w),until=now+rng(w,'combat').int(...toxin.turns)
 ;(target.paralysis??=[]).push({sourceUid:toxin.sourceUid,sourceDef:toxin.sourceDef,woundId,parts,region:pd.region,appliedAt:now,until})
 if(pd.region==='larm'||pd.region==='rarm'){
  const slot=pd.region==='larm'?'off':'main',item=target.equip[slot]
  if(item){delete target.equip[slot];tileAt(w,target.pos).items.push(item)}
 }
 if(target.id===w.s.playerId||source.id===w.s.playerId)log(w,'danger',`${target.id===w.s.playerId?'당신':target.name}의 ${pd.label}이(가) 저리며 마비됐다. (${until-now}턴)`)
 return true
}
export function paralysisTick(w:World,c:Creature){if(!c.paralysis?.length)return;const before=c.paralysis.length;c.paralysis=c.paralysis.filter(e=>e.until>turnOf(w));if(!c.paralysis.length)delete c.paralysis;if(before&& !c.paralysis&&c.id===w.s.playerId)log(w,'info','신경독의 마비가 풀렸다. 실제 상처는 남아 있다.')}
export function toxinCoatQuote(w:World,c:Creature,sourceUid:number,arrowUid:number){
 const source=c.bag.find(i=>i.uid===sourceUid),arrow=c.bag.find(i=>i.uid===arrowUid),rule=source&&w.db.item(source.def).neurotoxin
 let error:string|null=null
 if(!source||!rule||(source.uses??0)<1||source.count!==1)error='남은 실제 독샘이 필요하다'
 else if(!c.alive||c.unconscious||c.asleep||c.activity||capacity(w,c,'manipulation')<.5)error='깨어서 양손을 쓸 수 있어야 한다'
 else if(lightLevel(w,c.pos)>=2)error='독을 다루기에는 너무 어둡다'
 else if(!arrow||w.db.item(arrow.def).category!=='ammo'||!w.db.all<ItemDef>('Item').some(d=>d.ranged&&!d.ranged.firearm&&d.ranged.ammo===arrow.def)||arrow.count<1)error='배낭의 실제 목재 화살이 필요하다'
 else if(arrow.toxin)error='이미 독이 발린 화살이다'
 return{error,source,arrow,rule}
}
export function coatArrow(w:World,c:Creature,sourceUid:number,arrowUid:number){
 const q=toxinCoatQuote(w,c,sourceUid,arrowUid);if(q.error)return q.error
 const arrow=q.arrow!,toxin:ToxinCoating={sourceUid:q.source!.uid,sourceDef:q.source!.def,turns:[...q.rule!.turns]}
 q.source!.uses!--
 if(arrow.count===1)arrow.toxin=toxin
 else{arrow.count--;const coated={...arrow,uid:w.s.nextId++,count:1,toxin,gx:undefined,gy:undefined};if(addToBag(w,c,coated))tileAt(w,c.pos).items.push(coated)}
 log(w,'info','원래 독샘 한 회분을 실제 화살 한 발에 발랐다. 사격하면 이 독은 소모된다.');return null
}

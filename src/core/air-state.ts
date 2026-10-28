// 들이마신 재와 실제 착용 여과포만 읽는다. 섭취한 재/신장 손상과 섞지 않는다.
import type {World} from './ctx'
import type {Creature,WaterSafetyDef} from './types'
export const airRules=(w:World)=>w.db.tryGet<WaterSafetyDef>('WaterSafety.Human')?.inhalation
export const inhaledAsh=(c:Creature)=>Number.isFinite(c.body.inhaledAsh)&&c.body.inhaledAsh!>0?c.body.inhaledAsh!:0
export function ashLungStage(w:World,c:Creature){return airRules(w)?.caps.filter(row=>inhaledAsh(c)>=row.dose).length??0}
export function ashLungCap(w:World,c:Creature){return w.db.body(c.body.def).kind==='mechanical'?1.2:airRules(w)?.caps.filter(row=>inhaledAsh(c)>=row.dose).at(-1)?.cap??1.2}
export function dustMask(w:World,c:Creature){
 return Object.values(c.equip).flatMap(it=>{
  if(!it||it.count!==1||(it.uses??0)<=0||(it.durability??100)<=0||Object.values(it.partDurability??{}).some(n=>n<=0)||c.activity?.kind==='respirator'&&c.activity.uid===it.uid)return[]
  const rule=w.db.item(it.def).respirator;if(!rule||!Number.isFinite(it.uses)||(it.uses??0)>rule.chargeTurns)return[]
  const wet=Math.max(0,...Object.values(it.wetness??{})),protection=(wet>=rule.wetAbove?rule.wetProtection:rule.protection)*(it.half ? .5:1)
  return[{it,rule,protection}]
 }).sort((a,b)=>b.protection-a.protection||a.it.uid-b.it.uid)[0]
}
export function airLines(w:World,c:Creature){
 const d=airRules(w);if(!d||w.db.body(c.body.def).kind==='mechanical')return[]
 const out=['흡입한 재 '+inhaledAsh(c).toFixed(2)+' · 음식/물로 섭취한 재와 별개다.'],stage=ashLungStage(w,c)
 if(stage)out.push(d.label+' '+stage+'단계 · 호흡 상한 '+(ashLungCap(w,c)*100).toFixed(0)+'% · 기침으로 위치가 드러날 수 있다. 손상은 씻거나 일반 약으로 회복되지 않는다.')
 return out
}

// 흡입 재와 음식성 폐 부담의 장부는 구분하고 재폐 단계에서만 합친다. 신장의 재와 별개다.
import type {World} from './ctx'
import type {Creature,WaterSafetyDef} from './types'
import {foodExposureLungDose} from './food-exposure-state'
export const airRules=(w:World)=>w.db.tryGet<WaterSafetyDef>('WaterSafety.Human')?.inhalation
export const inhaledAsh=(c:Creature)=>Number.isFinite(c.body.inhaledAsh)&&c.body.inhaledAsh!>0?c.body.inhaledAsh!:0
export const lungAshBurden=(c:Creature)=>inhaledAsh(c)+foodExposureLungDose(c)
export function ashLungStage(w:World,c:Creature){const burden=lungAshBurden(c);return airRules(w)?.caps.filter(row=>burden>=row.dose).length??0}
export function ashLungCap(w:World,c:Creature){if(w.db.body(c.body.def).kind==='mechanical')return 1.2;const burden=lungAshBurden(c);return airRules(w)?.caps.filter(row=>burden>=row.dose).at(-1)?.cap??1.2}
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
 if(foodExposureLungDose(c)>0)out.push('음식성 재폐 부담 '+foodExposureLungDose(c).toFixed(2)+' · 흡입한 먼지나 신장의 재 장부와 별개다.')
 if(stage)out.push(d.label+' '+stage+'단계 · 호흡 상한 '+(ashLungCap(w,c)*100).toFixed(0)+'% · 기침으로 위치가 드러날 수 있다. 손상은 씻거나 일반 약으로 회복되지 않는다.')
 return out
}

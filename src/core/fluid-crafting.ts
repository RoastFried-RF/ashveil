import type {ScriptItemDebit} from './script-item'
import {isWaterVessel} from './water-vessels'
// A calibrated evaporation recipe binds an actual bottle, never a newly imagined liquid input.
import type { World } from './ctx'
import { drinkVolume, spendDrinkVolume } from './wash-water'
import { waterQuality, waterSalinity, waterSafetyDef } from './water-state'
import type { Creature, RecipeDef, WorkJob } from './types'
export function fluidCraftQuote(w:World,c:Creature,r:RecipeDef):{error:string|null;plan?:WorkJob['fluidPlan']}{
 const spec=r.evaporation,old=c.workJob?.kind==='craft'&&c.workJob.recipe===r.id?c.workJob:undefined
 if(!spec)return old?.fluidPlan?{error:'제작법의 실제 물 규칙이 바뀌었다. 먼저 작업을 취소하자'}:{error:null}
 const salt=w.db.item(r.output.item).saltGrams
 if(!salt||Math.abs(salt*r.output.count-spec.ml*spec.salinity/1000)>1e-9)return{error:'증발량과 실제 소금 질량이 일치하지 않는다'}
 if(old&&!old.fluidPlan)return{error:'제작법의 실제 물 규칙이 바뀌었다. 먼저 작업을 취소하자'}
 const source=old?.fluidPlan?c.bag.find(i=>i.uid===old.fluidPlan!.uid):c.bag.filter(i=>!r.inputs.some(row=>row.item===i.def)).find(i=>isWaterVessel(w,i)&&!i.waterFrozen&&drinkVolume(w,i)>=spec.ml&&waterSalinity(waterQuality(w,i))===spec.salinity)
 if(!source||!isWaterVessel(w,source)||source.count!==1||source.waterFrozen||drinkVolume(w,source)<spec.ml)return{error:'원래 물병의 실제 소금물과 잔량을 확인하자'}
 const q=waterQuality(w,source),signature=JSON.stringify({spec,output:r.output,salt})
 if(waterSalinity(q)!==spec.salinity||![q.pathogen,q.ash,waterSalinity(q)].every(n=>Number.isFinite(n)&&n>=0))return{error:'제작법에 맞는 실제 염도/수질의 물이 필요하다'}
 if(old?.fluidPlan&&(old.fluidPlan.def!==source.def||old.fluidPlan.uses!==source.uses||old.fluidPlan.ml!==spec.ml||JSON.stringify(old.fluidPlan.quality)!==JSON.stringify(q)||old.fluidPlan.signature!==signature))return{error:'예약한 원래 물의 양·수질 또는 제작법이 바뀌었다'}
 return{error:null,plan:old?.fluidPlan??{uid:source.uid,def:source.def,uses:source.uses??1,ml:spec.ml,quality:structuredClone(q),signature}}
}
export function consumeCraftFluid(w:World,c:Creature,plan:NonNullable<WorkJob['fluidPlan']>,debits?:ScriptItemDebit[]):number{
 const i=c.bag.find(i=>i.uid===plan.uid)!,d=waterSafetyDef(w),ash=plan.quality.ash/d.ashDivisor*plan.ml/d.exposureMl
 debits?.push({uid:i.uid,item:i.def,countConsumed:0,usesConsumed:0,mlConsumed:plan.ml,gramsConsumed:0})
 spendDrinkVolume(w,i,plan.ml);delete i.waterSettlesAt
 if(!i.uses){i.def='Item.WaterBottle';delete i.water}
 return ash
}

import {isWaterVessel} from './water-vessels'
// 국·죽은 원래 그릇/물/재료와 같은 유한 장작불을 정상 제작 진행에 묶는다.
import {turnOf,type World} from './ctx'
import {campfireAt} from './campfire'
import {cheb} from './geom'
import {hasLos} from './fov'
import {itemDef} from './items'
import {preservationFire} from './preservation-state'
import {drinkVolume,spendDrinkVolume} from './wash-water'
import {treatedWater,waterQuality,waterSafetyDef} from './water-state'
import type {Creature,ItemInst,RecipeDef,WorkJob} from './types'
export function boiledMealQuote(w:World,c:Creature,r:RecipeDef):{error:string|null;plan?:WorkJob['mealPlan']}{
 const old=c.workJob?.kind==='craft'&&c.workJob.recipe===r.id?c.workJob:undefined,spec=r.boiledMeal
 if(!spec)return old?.mealPlan?{error:'죽의 실제 조리 규칙이 바뀌었다. 먼저 작업을 취소하자'}:{error:null}
 const bound=old?.mealPlan
 if(old&&!bound)return{error:'원래 죽 조리 기록을 확인할 수 없다. 먼저 작업을 취소하자'}
 const vessel=bound?c.bag.find(i=>i.uid===bound.vesselUid):c.bag.filter(i=>i.def===spec.vessel&&i.count>0).sort((a,b)=>a.uid-b.uid)[0]
 const bottle=bound?c.bag.find(i=>i.uid===bound.bottleUid):c.bag.find(i=>isWaterVessel(w,i)&&i.count===1&&!i.waterFrozen&&drinkVolume(w,i)>=spec.waterMl&&!r.inputs.some(row=>row.item===i.def))
 if(!vessel||vessel.def!==spec.vessel||vessel.count!==1)return{error:'배낭의 같은 원래 빈 그릇이 필요하다'}
 if(!bottle||!isWaterVessel(w,bottle)||bottle.count!==1||bottle.waterFrozen||drinkVolume(w,bottle)<spec.waterMl)return{error:'원래 물병에 실제 물'+spec.waterMl+'ml가 필요하다'}
 const q=waterQuality(w,bottle),signature=JSON.stringify({spec,turns:r.workTurns,stations:r.stations,inputs:r.inputs,output:r.output,food:w.db.item(r.output.item).food})
 if(![q.pathogen,q.ash,q.salinity??0].every(n=>Number.isFinite(n)&&n>=0))return{error:'원래 물의 수질을 확인해야 한다'}
 const fire=bound?campfireAt(w,bound.firePos):preservationFire(w,c.pos)
 if(!fire||fire.light.off||(fire.light.fuelUntil??0)<=turnOf(w)||cheb(c.pos,fire.light.pos)>1||!hasLos(w,c.pos,fire.light.pos)||(bound&&fire.uid!==bound.fireUid))return{error:'같은 실제 장작불 바로 곁에서 끓여야 한다'}
 if(bound&&(bound.signature!==signature||bottle.def!==bound.bottleDef||bottle.uses!==bound.uses||JSON.stringify(q)!==JSON.stringify(bound.quality)||spec.waterMl!==bound.ml))return{error:'예약한 원래 물의 양·수질이나 죽 조리 규칙이 바뀌었다'}
 return{error:null,plan:bound??{bottleUid:bottle.uid,bottleDef:bottle.def,ml:spec.waterMl,uses:bottle.uses??1,quality:structuredClone(q),vesselUid:vessel.uid,fireUid:fire.uid,firePos:{...fire.light.pos},signature}}
}
export function consumeMealWater(w:World,c:Creature,plan:NonNullable<WorkJob['mealPlan']>){
 const bottle=c.bag.find(i=>i.uid===plan.bottleUid)!,vessel=structuredClone(c.bag.find(i=>i.uid===plan.vesselUid)!),q=treatedWater(w,plan.quality,'boil'),d=waterSafetyDef(w)
 spendDrinkVolume(w,bottle,plan.ml);delete bottle.waterSettlesAt
 if(!bottle.uses){bottle.def='Item.WaterBottle';delete bottle.water}
 return{vessel,ash:q.ash/d.ashDivisor*plan.ml/d.exposureMl,salt:(q.salinity??0)*plan.ml/1000}
}
export function warmMealGain(w:World,it:ItemInst){
 const warm=itemDef(w,it).food?.warm
 return warm&&!it.foodFrozen&&!it.waterFrozen&&it.foodHeatedAt!==undefined&&turnOf(w)>=it.foodHeatedAt&&turnOf(w)-it.foodHeatedAt<warm.coolTurns?warm.gain:0
}

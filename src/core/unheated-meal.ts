import {mergeFoodWater} from './food-contamination'
// 실제 원재료와 원래 물/그릇을 불 위 한 회분으로 옮긴다.
import {boiledMealQuote} from './boiled-meal'
import {cookingSlotError} from './cooking-state'
import {beginCooking} from './cooking'
import {bindInputs,craftError} from './crafting'
import {foodFreshness} from './food-state'
import {ageFood} from './food-safety'
import {ambientTemp} from './environment'
import {itemDef,removeOne} from './items'
import {drinkVolume,spendDrinkVolume} from './wash-water'
import {waterSafetyDef} from './water-state'
import {turnOf,type World} from './ctx'
import type {Creature,RecipeDef} from './types'
export function unheatedMealQuote(w:World,c:Creature,id:string){
 const r=w.db.tryGet<RecipeDef>(id)
 if(!r?.boiledMeal?.unheated)return{error:'불에 올릴 조리법이 없다'}
 if(c.workJob)return{error:'예약한 작업을 먼저 마치거나 취소해야 한다'}
 const error=craftError(w,c,r);if(error)return{error}
 const q=boiledMealQuote(w,c,r);if(q.error||!q.plan)return{error:q.error??'원래 물과 그릇이 필요하다'}
 const slot=cookingSlotError(w,c,q.plan.firePos);if(slot)return{error:slot}
 return{error:null,recipe:r,plan:q.plan,inputs:bindInputs(c,r.inputs)!}
}
export function prepareUnheatedMeal(w:World,c:Creature,id:string){
 const q=unheatedMealQuote(w,c,id);if(q.error||!q.recipe||!q.plan||!q.inputs)return q.error??'원래 조리를 준비할 수 없다'
 const {plan,recipe:r,inputs}=q,spec=r.boiledMeal!,now=turnOf(w),bottle=c.bag.find(i=>i.uid===plan.bottleUid)!
 const ingredients=inputs.filter(b=>b.uid!==plan.vesselUid).map(b=>({it:c.bag.find(i=>i.uid===b.uid)!,count:b.count}))
 for(const {it}of ingredients)if(itemDef(w,it).food){ageFood(w,it,ambientTemp(w),Math.max(0,now-(it.foodAgedAt??now)),c.needs.wetness>=50);it.foodAgedAt=now}
 const freshness=Math.min(100,...ingredients.filter(b=>itemDef(w,b.it).food).map(b=>foodFreshness(b.it))),ash=ingredients.reduce((n,b)=>n+(b.it.contaminantAsh??0)*b.count,0),thawed=ingredients.some(b=>b.it.foodThawed||b.it.foodFrozen)
 const ingredientWater=ingredients.some(b=>b.it.foodWater)?mergeFoodWater([{water:{quality:plan.quality,ml:plan.ml},count:1},...ingredients.map(b=>({water:b.it.foodWater,count:b.count}))]):undefined
 const vessel=removeOne(w,c,plan.vesselUid)!
 for(const binding of inputs.filter(b=>b.uid!==plan.vesselUid))for(let n=0;n<binding.count;n++)removeOne(w,c,binding.uid)
 spendDrinkVolume(w,bottle,plan.ml);delete bottle.waterSettlesAt
 if(!drinkVolume(w,bottle)){bottle.def='Item.WaterBottle';delete bottle.water}
 const d=waterSafetyDef(w),source=vessel.def
 vessel.def=spec.unheated!;vessel.count=1;vessel.uses=1;vessel.foodVesselDef=source;vessel.foodSealed=false;vessel.freshness=freshness;vessel.foodAgedAt=now
 vessel.foodWater=ingredientWater??{quality:structuredClone(plan.quality),ml:plan.ml};vessel.foodSaltGrams=(plan.quality.salinity??0)*plan.ml/1000
 vessel.contaminantAsh=ash+plan.quality.ash/d.ashDivisor*plan.ml/d.exposureMl
 if(thawed)vessel.foodThawed=true
 beginCooking(w,c,vessel,plan.firePos,plan.fireUid)
 return null
}

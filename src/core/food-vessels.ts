import {itemDef,removeOne} from './items'
import type {Creature,ItemInst} from './types'
import type {World} from './ctx'
export function foodServings(w:World,it:ItemInst){
 const f=itemDef(w,it).food
 return f?.servings?Math.max(0,Math.min(f.servings,it.uses??f.servings)):1
}
/** 실제 한 회분만 먹고 마지막에는 동일 용기를 남긴다. 일반 음식은 기존 한 조각 소비를 쓴다. */
export function consumeFoodServing(w:World,owner:Creature,it:ItemInst){
 const f=itemDef(w,it).food
 if(!f?.servings){removeOne(w,owner,it.uid);return}
 const left=foodServings(w,it)-1
 if(left>0){it.uses=left;delete it.foodSealed;it.foodLeftover=true;return}
 it.def=it.foodVesselDef??f.emptyVessel!
 for(const key of['workshopMade','cropHarvest','foodWater','foodBurnt','foodHeatedAt','foodSaltGrams','uses','foodVesselDef','freshness','foodAgedAt','foodFrozen','foodThawed','foodWet','foodLeftover','foodSealed','foodQ','contaminantAsh','cookProgress']as const)delete it[key]
}

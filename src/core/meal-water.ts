// 원래 음식에 섞인 물은 실제로 끓기 전까지 병원체를 유지한다.
import {turnOf,type World} from './ctx'
import {treatedWater,waterSafetyDef} from './water-state'
import {itemDef} from './items'
import type {ItemInst} from './types'
export function finishCookingWater(w:World,it:ItemInst){
 const water=it.foodWater
 if(water){const d=waterSafetyDef(w),boiled=treatedWater(w,water.quality,'boil');it.contaminantAsh=(it.contaminantAsh??0)+(boiled.ash-water.quality.ash)/d.ashDivisor*water.ml/d.exposureMl;delete it.foodWater}
 if(itemDef(w,it).food?.warm)it.foodHeatedAt=turnOf(w)
}

// 실제로 먹은 최근 식사의 단백질 열량 비중. 조회는 몸·시계·난수를 바꾸지 않는다.
import {turnOf,TURNS_PER_DAY,type World} from './ctx'
import type {Creature,NutritionDef} from './types'
export const dietRules=(w:World)=>w.db.get<NutritionDef>('Nutrition.Human').leanDiet
export function dietStatus(w:World,c:Creature){
 const d=dietRules(w),now=turnOf(w)
 const meals=d?(c.needs.dietHistory??[]).filter(m=>Number.isFinite(m.at)&&m.at<=now&&m.at>now-d.windowTurns&&Number.isFinite(m.kcal)&&m.kcal>0&&Number.isFinite(m.proteinKcal)&&m.proteinKcal>=0&&m.proteinKcal<=m.kcal):[]
 const kcal=meals.reduce((sum,m)=>sum+m.kcal,0),proteinKcal=meals.reduce((sum,m)=>sum+m.proteinKcal,0),active=!!d&&w.db.body(c.body.def).kind!=='mechanical'&&proteinKcal>kcal*d.proteinFraction
 return{windowDays:(d?.windowTurns??0)/TURNS_PER_DAY,kcal,proteinKcal,fraction:kcal>0?proteinKcal/kcal:0,active,absorption:active?d!.absorption:1,waterPerDay:active?d!.waterPerDay:0}
}
export function recordDietMeal(w:World,c:Creature,kcal:number,protein:number,source?:{uid:number;def:string}){
 const d=dietRules(w),now=turnOf(w)
 if(!d||!c.alive||w.db.body(c.body.def).kind==='mechanical'||!Number.isFinite(kcal)||kcal<=0||!Number.isFinite(protein)||protein<0)return
 const proteinKcal=Math.min(kcal,protein*d.proteinKcalPerGram),history=(c.needs.dietHistory??[]).filter(m=>m.at>now-d.windowTurns&&m.at<=now),last=history.at(-1)
 if(last?.at===now){last.kcal+=kcal;last.proteinKcal+=proteinKcal}else history.push({at:now,kcal,proteinKcal})
 c.needs.dietHistory=history;c.needs.lastDietMeal={at:now,kcal,proteinKcal,...(source?{uid:source.uid,def:source.def}:{})}
}
export function removeLastDietMeal(c:Creature){
 const meal=c.needs.lastDietMeal;if(!meal)return
 const bucket=c.needs.dietHistory?.find(m=>m.at===meal.at)
 if(bucket){bucket.kcal=Math.max(0,bucket.kcal-meal.kcal);bucket.proteinKcal=Math.max(0,Math.min(bucket.kcal,bucket.proteinKcal-meal.proteinKcal));c.needs.dietHistory=c.needs.dietHistory!.filter(m=>m.kcal>0)}
 if(!c.needs.dietHistory?.length)delete c.needs.dietHistory
 delete c.needs.lastDietMeal
}
export function expireDiet(w:World,c:Creature){
 const d=dietRules(w),history=c.needs.dietHistory;if(!d||!history?.length||history[0].at>turnOf(w)-d.windowTurns)return
 c.needs.dietHistory=history.filter(m=>m.at>turnOf(w)-d.windowTurns)
 if(!c.needs.dietHistory.length)delete c.needs.dietHistory
}

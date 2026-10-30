import {fmtClock,turnOf,TURNS_PER_DAY,type World} from './ctx'
import type {Creature,FoodExposureRecord,FoodExposureRule,FoodSafetyDef} from './types'

export function validFoodExposureRule(rule:FoodExposureRule):boolean {
 if(!rule||typeof rule!=='object')return false
 return typeof rule.food==='string'&&!!rule.food.trim()&&typeof rule.disease==='string'&&!!rule.disease.trim()
  &&[rule.servings,rule.durationDays].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=366)
  &&Number.isSafeInteger(rule.minIntervalTurns)&&rule.minIntervalTurns>=1
  &&Number.isSafeInteger(rule.maxGapTurns)&&rule.maxGapTurns>=rule.minIntervalTurns&&rule.maxGapTurns<=366*TURNS_PER_DAY
  &&Number.isFinite(rule.lungDose)&&rule.lungDose>=0&&rule.lungDose<=100
  &&Number.isFinite(rule.riskMult)&&rule.riskMult>0&&rule.riskMult<=1
  &&(rule.knowledgeBook===undefined||typeof rule.knowledgeBook==='string'&&!!rule.knowledgeBook.trim())
}
export const foodExposureSignature=(r:FoodExposureRule)=>JSON.stringify([r.food,r.disease,r.servings,r.durationDays,r.minIntervalTurns,r.maxGapTurns,r.lungDose,r.riskMult,r.knowledgeBook??null])
export function foodExposureRules(w:World):FoodExposureRule[]{
 const rules=w.db.tryGet<FoodSafetyDef>('FoodSafety.Human')?.exposureTraining
 return Array.isArray(rules)?rules.filter(validFoodExposureRule):[]
}
export function foodExposureRecords(c:Creature):FoodExposureRecord[]{
 return Array.isArray(c.foodExposureTraining)?c.foodExposureTraining.filter(r=>r&&validFoodExposureRule(r.rule)&&Number.isSafeInteger(r.doseCount)&&r.doseCount>=0):[]
}
export function validFoodExposureCourse(r:FoodExposureRecord){
 const rows=r.course?.receipts
 return Array.isArray(rows)&&rows.length<=r.rule.servings&&rows.length<=r.doseCount&&rows.every((row,i)=>row&&Number.isSafeInteger(row.uid)&&row.uid>0&&Number.isSafeInteger(row.at)&&row.at>=0&&(!i||row.at-rows[i-1].at>=r.rule.minIntervalTurns&&row.at-rows[i-1].at<=r.rule.maxGapTurns))
}
export function foodExposureReadyAt(r:FoodExposureRecord):number|null {
 if(!validFoodExposureCourse(r))return null
 const rows=r.course!.receipts
 if(rows.length!==r.rule.servings)return null
 const ready=Math.max(rows[0].at+r.rule.durationDays*TURNS_PER_DAY,rows.at(-1)!.at)
 return ready<=rows.at(-1)!.at+r.rule.maxGapTurns?ready:null
}
export function foodExposureCompletion(r:FoodExposureRecord,at:number):boolean {const ready=foodExposureReadyAt(r);return ready!==null&&at>=ready}
export const foodExposureCompleted=(r:FoodExposureRecord,now:number)=>Number.isSafeInteger(r.completedAt)&&r.completedAt!>=0&&r.completedAt!<=now&&foodExposureCompletion(r,r.completedAt!)
/** Food-associated pulmonary injury is separate from both inhaled dust and renal ash. */
export const foodExposureLungDose=(c:Creature)=>c.foodExposureTraining===undefined?0:foodExposureRecords(c).reduce((sum,r)=>sum+r.doseCount*r.rule.lungDose/r.rule.servings,0)
export function foodExposureDiseaseMultiplier(w:World,c:Creature,disease:string){
 if(c.foodExposureTraining===undefined)return 1
 return foodExposureRecords(c).reduce((mult,r)=>r.rule.disease===disease&&(foodExposureCompleted(r,turnOf(w))||foodExposureCompletion(r,turnOf(w)))?Math.min(mult,r.rule.riskMult):mult,1)
}
/** Personal observations only after the recorded, understood source book. */
export interface FoodExposureObservation {
 food:string;disease:string;doseCount:number;servings:number;target:number;lungDose:number;riskMult:number;durationDays:number;completed:boolean
 nextMealAt?:number;deadlineAt?:number;minimumAt?:number
}
export function foodExposureObservations(w:World,c:Creature):FoodExposureObservation[]{
 return foodExposureRecords(c).flatMap(r=>{
  const book=r.rule.knowledgeBook
  if(!book||!c.booksRead?.includes(book)||!(c.literacyBooks??c.booksRead).includes(book)||c.misreadBooks?.includes(book)||!w.db.has(r.rule.food)||!w.db.has(r.rule.disease))return[]
  const now=turnOf(w),completed=foodExposureCompleted(r,now)||foodExposureCompletion(r,now),rows=validFoodExposureCourse(r)?r.course!.receipts:[],last=rows.at(-1)
  const active=!!last&&(completed||now<=last.at+r.rule.maxGapTurns)
  return[{food:r.rule.food,disease:r.rule.disease,doseCount:r.doseCount,servings:active?rows.length:0,target:r.rule.servings,lungDose:r.doseCount*r.rule.lungDose/r.rule.servings,riskMult:r.rule.riskMult,durationDays:r.rule.durationDays,completed,...(!completed&&active?{nextMealAt:last!.at+r.rule.minIntervalTurns,deadlineAt:last!.at+r.rule.maxGapTurns,minimumAt:rows[0].at+r.rule.durationDays*TURNS_PER_DAY}:{})}]
 })
}
export function foodExposureLines(w:World,c:Creature):string[]{
 return foodExposureObservations(w,c).flatMap(o=>[
  w.db.item(o.food).label+' · 실제 섭취 '+o.doseCount+'회 · 간격을 지킨 식사 '+o.servings+'/'+o.target+'회 · 음식성 재폐 부담 '+o.lungDose.toFixed(2),
  o.completed?w.db.get(o.disease).label+' 노출 위험 ×'+o.riskMult+' · 완전 면역이나 현재 감염의 치료는 아니다.':o.durationDays+'일 경과와 식사 간격이 필요하다. 몰아 먹거나 간격을 놓쳐도 폐 부담은 사라지지 않는다.',
  ...(o.nextMealAt!==undefined?['다음 과정 기록 '+fmtClock(o.nextMealAt)+' 이후 · 연속 기록 한계 '+fmtClock(o.deadlineAt!)+' · 최소 관찰 완료 '+fmtClock(o.minimumAt!)]:[]),
 ])
}

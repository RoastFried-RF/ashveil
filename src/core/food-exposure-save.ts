import type {Creature} from './types'
import {validFoodExposureRule,validFoodExposureCourse,foodExposureCompletion} from './food-exposure-state'

/** Reject malformed new records; never repair old saves by inventing meals or immunity. */
export function validateFoodExposureTraining(actors:Creature[],now:number,nextId:number){
 for(const c of actors){
  const records=c.foodExposureTraining
  if(records===undefined)continue
  if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(nextId)||nextId<1)throw Error('실제 음식 장부의 원래 시각/UID 경계가 올바르지 않다')
  if(!Array.isArray(records))throw Error('실제 음식 노출 장부 형식이 올바르지 않다')
  for(const r of records){
   if(!r||!validFoodExposureRule(r.rule)||!Number.isSafeInteger(r.doseCount)||r.doseCount<1)throw Error('실제 음식 노출의 원래 규칙/회분 기록이 올바르지 않다')
   if(r.course!==undefined&&(!validFoodExposureCourse(r)||r.course.receipts.some(row=>row.at>now||row.uid>=nextId)))throw Error('실제 식사 UID/간격 기록이 올바르지 않다')
   if(r.completedAt!==undefined&&(!Number.isSafeInteger(r.completedAt)||r.completedAt<0||r.completedAt>now||!foodExposureCompletion(r,r.completedAt)))throw Error('실제 식사 과정 완료 시각이 올바르지 않다')
  }
 }
}

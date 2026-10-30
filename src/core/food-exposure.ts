import {log,turnOf,type World} from './ctx'
import type {Creature,ItemInst} from './types'
import {ashLungStage} from './air-state'
import {foodExposureCompleted,foodExposureCompletion,foodExposureReadyAt,foodExposureRecords,foodExposureRules,foodExposureSignature,validFoodExposureCourse} from './food-exposure-state'

export function foodExposureTick(w:World,c:Creature){
 if(c.foodExposureTraining===undefined)return
 const now=turnOf(w)
 for(const r of foodExposureRecords(c)){
  if(foodExposureCompleted(r,now))continue
  if(r.course&&!validFoodExposureCourse(r))delete r.course
  if(foodExposureCompletion(r,now)){
   r.completedAt=foodExposureReadyAt(r)!
   if(c.faction==='player')log(w,'info','간격을 지킨 식사를 '+r.rule.durationDays+'일 동안 이어 왔다.')
  }else if(r.course?.receipts?.length&&now>r.course.receipts.at(-1)!.at+r.rule.maxGapTurns)delete r.course
 }
}
/** Called only after actual food consumption succeeds, before its original vessel returns. */
export function recordFoodExposure(w:World,c:Creature,it:ItemInst,retained:boolean){
 if(!c.alive||w.db.body(c.body.def).kind==='mechanical'||c.foodExposureTraining!==undefined&&!Array.isArray(c.foodExposureTraining))return
 const rules=foodExposureRules(w).filter(r=>r.food===it.def)
 if(!rules.length)return
 foodExposureTick(w,c)
 const now=turnOf(w),before=ashLungStage(w,c)
 for(const rule of rules){
  let r=foodExposureRecords(c).find(row=>foodExposureSignature(row.rule)===foodExposureSignature(rule))
  if(!r){r={rule:{...rule},doseCount:0};(c.foodExposureTraining??=[]).push(r)}
  if(r.doseCount>=Number.MAX_SAFE_INTEGER)continue
  r.doseCount++
  if(!retained||foodExposureCompleted(r,now))continue
  const last=r.course?.receipts?.at(-1)
  if(last&&now-last.at<rule.minIntervalTurns)continue
  if(!last||now-last.at>rule.maxGapTurns)r.course={receipts:[]}
  r.course!.receipts.push({uid:it.uid,at:now})
  if(r.course!.receipts.length>rule.servings)r.course!.receipts.shift()
 }
 foodExposureTick(w,c)
 if(c.faction==='player'&&ashLungStage(w,c)>before)log(w,'warn','음식에 섞인 재가 폐에 부담을 남겼다.')
}

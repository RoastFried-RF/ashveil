// Actual dietary exposure; queries never consume food, time, RNG or personal evidence.
import {turnOf,type World} from './ctx'
import type {Creature,DiseaseDef,ItemInst} from './types'

export function foodTrainingReady(w:World,c:Creature,disease:DiseaseDef){
 const rule=disease.foodTraining,record=c.body.foodTraining?.[disease.id]
 return !!rule&&!!record&&record.servings>=rule.servings&&turnOf(w)>=record.firstAt+rule.courseTurns
}
export function foodTrainingRisk(w:World,c:Creature,disease:DiseaseDef){
 return foodTrainingReady(w,c,disease)?disease.foodTraining!.riskMultiplier:1
}
/** This exposure's lung injury is separate from inhaled dust and swallowed ash. */
export function foodTrainingLungAsh(c:Creature){
 return Math.round(Object.values(c.body.foodTraining??{}).reduce((n,row)=>n+row.lungAsh,0)*1e6)/1e6
}
/** Once an original food serving has passed all consumption checks. */
export function recordFoodTraining(w:World,c:Creature,item:ItemInst){
 if(w.db.body(c.body.def).kind==='mechanical')return
 for(const disease of w.db.all<DiseaseDef>('Disease')){
  const rule=disease.foodTraining;if(!rule||rule.item!==item.def)continue
  const now=turnOf(w),records=c.body.foodTraining??={},old=records[disease.id]
  const record=old??{firstAt:now,lastAt:now,servings:0,ashPhase:0,lungAsh:0,lastItemUid:item.uid}
  // Extra same-day food and completed courses still cost lung burden. Integer micro-units
  // distribute the rational cost exactly: 30 servings total 10, not 9.99999.
  const phase=record.ashPhase%rule.servings
  const dose=Math.round((phase+1)*rule.lungAsh*1e6/rule.servings)-Math.round(phase*rule.lungAsh*1e6/rule.servings)
  record.lungAsh=Math.round(record.lungAsh*1e6+dose)/1e6;record.ashPhase=(phase+1)%rule.servings;record.lastItemUid=item.uid
  if(!old)record.servings=1
  else if(!foodTrainingReady(w,c,disease)&&now-record.lastAt>rule.maxGapTurns){record.firstAt=now;record.lastAt=now;record.servings=1}
  else if(now-record.lastAt>=rule.intervalTurns){record.lastAt=now;record.servings=Math.min(rule.servings,record.servings+1)}
  records[disease.id]=record;c.body.foodTraining=records
 }
}

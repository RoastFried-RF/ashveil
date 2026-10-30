import {stateActors} from './missing-statuses'
import type {GameState} from './types'

/** Validate active, dormant, travelling and captive original bodies, without current Defs. */
export function validateFoodTrainingSave(s:GameState){
 const now=Math.floor(s.time/100),integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0
 for(const actor of stateActors(s)){
  const records=actor.body.foodTraining;if(records===undefined)continue
  if(!records||typeof records!=='object'||Array.isArray(records)||Object.keys(records).length>128)throw Error('식이 노출 기록 형식이 올바르지 않다')
  for(const[id,row]of Object.entries(records)){
   if(!id||id.length>256||!row||typeof row!=='object'||Array.isArray(row)||!integer(row.firstAt)||!integer(row.lastAt)||row.firstAt>row.lastAt||row.lastAt>now||!integer(row.servings)||row.servings<1||row.servings>365||row.lastAt-row.firstAt<row.servings-1||!integer(row.ashPhase)||row.ashPhase>=365||!Number.isFinite(row.lungAsh)||row.lungAsh<0||row.lungAsh>1e12||!integer(row.lastItemUid)||row.lastItemUid<1)throw Error('같은 몸의 실제 식이 노출/폐 부담/물품 시계 기록이 올바르지 않다')
  }
 }
}

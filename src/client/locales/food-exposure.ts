/** Only the core's personally learned observations cross this presentation boundary. */
import {clock,foodExposureLines,foodExposureObservations,type Creature,type World} from '../../core'
import {preferences} from '../preferences'
import {defText,t} from '../locale'

function displayClock(turn:number){const c=clock(turn);return t('{0}일차 {1}:{2}',c.day,String(c.hour).padStart(2,'0'),String(c.minute).padStart(2,'0'))}
export function displayFoodExposureLines(w:World,c:Creature):string[]{
 if(preferences.language==='ko')return foodExposureLines(w,c)
 return foodExposureObservations(w,c).flatMap(o=>[
  t('{0} · 실제 섭취 {1}회 · 간격을 지킨 식사 {2}/{3}회 · 음식성 재폐 부담 {4}',defText(w.db.item(o.food)),o.doseCount,o.servings,o.target,o.lungDose.toFixed(2)),
  o.completed?t('{0} 노출 위험 ×{1} · 완전 면역이나 현재 감염의 치료는 아니다.',defText(w.db.get(o.disease)),o.riskMult):t('{0}일 경과와 식사 간격이 필요하다. 몰아 먹거나 간격을 놓쳐도 폐 부담은 사라지지 않는다.',o.durationDays),
  ...(o.nextMealAt!==undefined?[t('다음 과정 기록 {0} 이후 · 연속 기록 한계 {1} · 최소 관찰 완료 {2}',displayClock(o.nextMealAt),displayClock(o.deadlineAt!),displayClock(o.minimumAt!))]:[]),
 ])
}

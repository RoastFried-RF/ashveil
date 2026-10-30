import {airRules,ashLungCap,ashLungStage,inhaledAsh,foodTrainingLungAsh,foodTrainingReady,researchThreads,turnOf,type World,type Creature,type DiseaseDef} from '../../core'
import {defText,t} from '../locale'

/** Behavioural records are public; physiological claims require the actor's own confirmed evidence. */
export function foodTrainingTip(w:World,c:Creature,itemId:string):string[]{
 const out:string[]=[]
 for(const disease of w.db.all<DiseaseDef>('Disease')){
  const rule=disease.foodTraining;if(!rule||rule.item!==itemId)continue
  const record=c.body.foodTraining?.[disease.id]
  out.push(record?t('간격을 두고 기록한 의식 음식 {0}회 · 마지막 간격 기록 후 {1}시간',record.servings,((turnOf(w)-record.lastAt)/1200).toFixed(1)):t('이 몸의 의식 음식 섭취 기록은 없다.'))
  const known=researchThreads(w,c).find(thread=>thread.id===rule.research.thread)?.steps.some(step=>step.id===rule.research.step&&step.confirmed)
  if(!known)continue
  out.push(t('개인 근거로 대조: {0}회·{1}일 · 간격 {2}시간 · 미완료 중 {3}시간 넘게 중단하면 진행 초기화',rule.servings,rule.courseTurns/28800,rule.intervalTurns/1200,rule.maxGapTurns/1200))
  out.push(t('완료 시 {0} 노출 위험 ×{1} · 같은 몸에 유지 · 완전 면역이나 현재 감염 치료가 아니다',defText(disease),rule.riskMultiplier.toFixed(2)))
  out.push(t('실제 {0}회분마다 폐 부담 +{1} · 같은 날 추가 섭취도 비용 적용',rule.servings,rule.lungAsh))
  if(record)out.push(t('이 몸의 반복 노출 {0}/{1}회 · 경과 {2}/{3}일 · {4}',record.servings,rule.servings,((turnOf(w)-record.firstAt)/28800).toFixed(1),rule.courseTurns/28800,foodTrainingReady(w,c,disease)?t('저항 형성됨'):t('아직 형성되지 않음')))
 }
 return out
}
export function displayAirLines(w:World,c:Creature):string[]{
 const rule=airRules(w);if(!rule||w.db.body(c.body.def).kind==='mechanical')return[]
 const out=[t('흡입한 재 {0} · 음식/물로 섭취한 재와 별개다.',inhaledAsh(c).toFixed(2))],stage=ashLungStage(w,c),diet=foodTrainingLungAsh(c)
 if(diet>0)out.push(t('의식 음식 노출로 남은 폐 부담 {0} · 흡입 재와 별도로 기록하며 재폐 누적에 합산한다.',diet.toFixed(2)))
 if(stage)out.push(t('{0} {1}단계 · 호흡 상한 {2}% · 기침으로 위치가 드러날 수 있다. 손상은 씻거나 일반 약으로 회복되지 않는다.',t(rule.label),stage,(ashLungCap(w,c)*100).toFixed(0)))
 return out
}

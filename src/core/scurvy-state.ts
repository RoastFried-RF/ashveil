// 괴혈의 실제 출혈과 현재 단계. 표시와 몸 정산이 같은 값을 읽는다.
import {TURNS_PER_DAY,type World} from './ctx'
import type {Creature,NutritionDef} from './types'
export function scurvyBleed(w:World,c:Creature):number{
 if(w.db.body(c.body.def).kind==='mechanical'||!Number.isFinite(c.needs.scurvy)||c.needs.scurvy<20)return 0
 const d=w.db.get<NutritionDef>('Nutrition.Human')
 return d.scurvyGumBloodDay/TURNS_PER_DAY*(c.needs.scurvy>=80?d.scurvyBleedMult:1)
}
export function scurvyLines(w:World,c:Creature):string[]{
 if(w.db.body(c.body.def).kind==='mechanical'||!Number.isFinite(c.needs.scurvy)||c.needs.scurvy<=0)return[]
 const d=w.db.get<NutritionDef>('Nutrition.Human'),n=c.needs,next=Math.max(0,n.vitamin-d.vitaminDaily)
 return[
  '괴혈 진행 '+n.scurvy.toFixed(0)+'/100 · 비타민 '+n.vitamin.toFixed(1)+'/100',
  '다음 일일 정산: 비타민 '+d.vitaminDaily+' 소모 후 진행 '+(next===0?'+'+d.scurvyDaily:'−'+d.scurvyRecovery),
  ...(n.scurvy>=20?['실제 잇몸 출혈 '+(scurvyBleed(w,c)*TURNS_PER_DAY).toFixed(2)+'ml/일']:[]),
  ...(n.scurvy>=40?['40 문턱에서 남아 있는 옛 흉터가 다시 벌어진다. 비타민을 먹어도 새 상처는 그대로 남는다.']:[]),
  ...(n.scurvy>=60?['괴혈 때문에 자연 치유가 멈췄다.']:[]),
  ...(n.scurvy>=80?['출혈 ×'+d.scurvyBleedMult]:[]),
 ]
}

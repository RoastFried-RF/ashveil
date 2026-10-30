import {airLines,airRules,ashLungCap,ashLungStage,foodExposureLungDose,inhaledAsh,type Creature,type World} from '../../core'
import {preferences} from '../preferences'
import {t} from '../locale'

export function displayAirLines(w:World,c:Creature):string[]{
 if(preferences.language==='ko')return airLines(w,c)
 const d=airRules(w);if(!d||w.db.body(c.body.def).kind==='mechanical')return[]
 const lines=[t('흡입한 재 {0} · 음식/물로 섭취한 재와 별개다.',inhaledAsh(c).toFixed(2))],food=foodExposureLungDose(c),stage=ashLungStage(w,c)
 if(food>0)lines.push(t('음식성 재폐 부담 {0} · 흡입한 먼지나 신장의 재 장부와 별개다.',food.toFixed(2)))
 if(stage)lines.push(t('{0} {1}단계 · 호흡 상한 {2}% · 기침으로 위치가 드러날 수 있다. 손상은 씻거나 일반 약으로 회복되지 않는다.',t(d.label),stage,(ashLungCap(w,c)*100).toFixed(0)))
 return lines
}

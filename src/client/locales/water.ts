import {observeWater,waterSafetyDef,type World,type Creature,type ItemInst} from '../../core'
import {preferences} from '../preferences'
import {t} from '../locale'
import {translateWaterSource,translateWaterBand} from './content'

/** The core prunes observations before either language formats them. */
export function displayWaterLines(w:World,c:Creature,it:ItemInst):string[]{
  const view=observeWater(w,c,it)
  if(!view)return[]
  if(view.kind==='empty')return[t(view.label)]
  const rules=waterSafetyDef(w),source=translateWaterSource(rules,view.source,preferences.language)
  const band=(label:string)=>translateWaterBand(rules,label,preferences.language)
  const lines=[view.quality.kind==='bands'?t('{0} — 병원체 {1} / 재 {2}',source,band(view.quality.pathogen),band(view.quality.ash)):t('{0} — {1}',source,t(view.quality.cloudy?'탁함':'맑음'))]
  lines.push(t('남은 물 {0}ml · 한 번에 최대 {1}ml',view.remainingMl,view.sipMl))
  if(view.salt)lines.push(t('염도 {0}g/L · 남은 소금 {1}g{2}',view.salt.gramsPerLiter,view.salt.remainingGrams,view.salt.drinkable?'':t(' · 음수 부적합: 마시면 수분 손실')),t('끓임·천/숯 여과·침전·정수정은 소금을 없애지 못한다'))
  if(view.frozen)lines.unshift(t('눈/얼음 — 불에서 녹여야 한다'))
  if(view.settlesHours!==undefined)lines.push(t('침전까지 약{0}시간',view.settlesHours.toFixed(1)))
  return lines
}

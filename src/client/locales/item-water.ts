/** Public water observations only. Stored source names remain literal records. */
import {drinkVolume,drinkableSalinity,masteryStage,turnOf,waterLines,waterQuality,waterSafetyDef,waterSalinity,type Creature,type ItemInst,type World} from '../../core'
import {preferences} from '../preferences'
import {t} from '../locale'

export function displayWaterLines(w:World,c:Creature,it:ItemInst):string[]{
 if(preferences.language==='ko')return waterLines(w,c,it)
 const def=w.db.item(it.def)
 if(!def.drink||def.drink.alcohol)return[]
 if((it.uses??1)<=0)return[t(def.waterVessel&&it.def!=='Item.WaterBottle'&&it.def!=='Item.DirtyWaterBottle'?'빈 물 용기':'빈 병')]
 const q=waterQuality(w,it),stage=(value:number)=>t([...waterSafetyDef(w).riskBands].reverse().find(b=>value>=b.at)?.label??'없음')
 const lines=[masteryStage(w,c,'survival')>=1?t('{0} — 병원체 {1} / 재 {2}',q.source??t('물'),stage(q.pathogen),stage(q.ash)):t('{0} — {1}',q.source??t('물'),t(q.pathogen>0||q.ash>0?'탁함':'맑음'))]
 lines.push(t('남은 물 {0}ml · 한 번에 최대 {1}ml',drinkVolume(w,it),def.drink.water))
 if(waterSalinity(q)>0)lines.push(t('염도 {0}g/L · 남은 소금 {1}g{2}',Number(waterSalinity(q).toFixed(3)),Number((waterSalinity(q)*drinkVolume(w,it)/1000).toFixed(3)),drinkableSalinity(w,q)?'':t(' · 음수 부적합: 마시면 수분 손실')))
 if(waterSalinity(q)>0)lines.push(t('끓임·천/숯 여과·침전·정수정은 소금을 없애지 못한다'))
 if(it.waterFrozen)lines.unshift(t('눈/얼음 — 불에서 녹여야 한다'))
 if(it.waterSettlesAt)lines.push(t('침전까지 약{0}시간',Math.max(0,(it.waterSettlesAt-turnOf(w))/1200).toFixed(1)))
 return lines
}

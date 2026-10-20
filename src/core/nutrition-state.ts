// 03 §3. 상태 구간과 공통 보정. 시간 진행·UI·저장 장치에 의존하지 않는다.
import { turnOf, type World } from './ctx'
import { hasEffect, traitMul, traitOverride } from './traits'
import type { Creature, NutritionBand, NutritionDef, Stats } from './types'

export const nutritionDef = (w: World) => w.db.get<NutritionDef>('Nutrition.Human')
/** 과식의 불이익 경계와 저장 가능한 칼로리 상한은 별개의 규칙이다. */
export const overeatThreshold=(w:World,c:Creature)=>Math.max(0,traitOverride(w,c,'overeatAt')??nutritionDef(w).maxKcal)
export function metabolicSize(w: World, c: Creature): number {
  const d = w.db.creature(c.def)
  return Math.max(.01, (d.metabolicScale ?? (d.weightKg ?? 70) / 70) * traitMul(w, c, 'bodySizeMult'))
}
function band(list: NutritionBand[], deficit: number) { return list.filter((b) => b.deficit <= deficit).at(-1)! }
export function hungerBand(w: World, c: Creature) { return band(nutritionDef(w).hunger, Math.max(0, -c.needs.kcal) / metabolicSize(w, c)) }
export function thirstBand(w: World, c: Creature) { return band(nutritionDef(w).thirst, c.needs.waterDeficit) }
export function hungerStage(w: World, c: Creature) { return nutritionDef(w).hunger.indexOf(hungerBand(w, c)) }
export function thirstStage(w: World, c: Creature) { return nutritionDef(w).thirst.indexOf(thirstBand(w, c)) }
export function nutritionMultiplier(w: World, c: Creature, kind: 'energy' | 'immunity' | 'healing'): number {
  if (kind === 'healing' && c.needs.scurvy >= 60) return 0
  const d = nutritionDef(w)
  return hungerBand(w, c)[kind] * thirstBand(w, c)[kind] * (c.needs.protein < d.lowProtein ? d.lowProteinMult : 1)
}
export function nutritionStat(w: World, c: Creature, stat: keyof Stats): number {
  if (stat !== 'str') return 0
  return hungerBand(w, c).str + thirstBand(w, c).str + (c.needs.protein < nutritionDef(w).criticalProtein ? -1 : 0)
}
export function nutritionConsciousness(w: World, c: Creature) { return hungerBand(w, c).consciousness + thirstBand(w, c).consciousness }
export function nutritionSleep(w: World, c: Creature): number {
  return (hungerStage(w, c) >= 1 ? .85 : 1) * (thirstStage(w, c) >= 1 ? .9 : 1) * (hasEffect(c, 'overfull', turnOf(w)) ? .9 : 1)
}
export function nutritionKey(w: World, c: Creature): string {
  return `${hungerStage(w, c)}:${thirstStage(w, c)}:${c.needs.protein < nutritionDef(w).lowProtein ? 1 : 0}:${c.needs.protein < nutritionDef(w).criticalProtein ? 1 : 0}:${c.needs.scurvy >= 20 ? 1 : 0}:${c.needs.scurvy >= 60 ? 1 : 0}:${c.needs.scurvy >= 80 ? 1 : 0}`
}

/** 구간 사이도 연속으로 보여 주되 단계별 위험 영역은 같은 폭으로 표시한다. */
export function nutritionProgress(w: World, c: Creature, kind: 'hunger' | 'thirst'): number {
  const list = nutritionDef(w)[kind], deficit = kind === 'hunger' ? Math.max(0, -c.needs.kcal) / metabolicSize(w, c) : c.needs.waterDeficit
  const i = list.indexOf(band(list, deficit)), next = list[i + 1]
  return next ? (i + (deficit - list[i].deficit) / (next.deficit - list[i].deficit)) / (list.length - 1) : 1
}

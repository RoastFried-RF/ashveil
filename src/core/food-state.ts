import { handState } from './hand-hygiene'
// 03 §4·§8. 읽기 전용 음식/위생 규칙. 조회는 시간·난수를 소비하지 않는다.
import type { World } from './ctx'
import { masteryStage } from './skills'
import { traitMul, traitOverride } from './traits'
import type { Creature, FoodSafetyDef, ItemDef, ItemInst } from './types'

export const foodSafetyDef = (w: World) => w.db.get<FoodSafetyDef>('FoodSafety.Human')
export const foodFreshness = (it: ItemInst) => it.freshness ?? 100
export function freshnessBand(w: World, it: ItemInst): 'fresh' | 'stale' | 'spoiled' | 'rotten' {
  const f = foodFreshness(it), d = foodSafetyDef(w)
  return f <= 0 ? 'rotten' : f <= d.spoiledAt ? 'spoiled' : f <= d.staleAt ? 'stale' : 'fresh'
}
export const FRESHNESS_LABEL = { fresh: '신선', stale: '오래됨', spoiled: '상함', rotten: '썩음' }
export function rotTemperature(w: World, temperature: number): number {
  const bands = foodSafetyDef(w).temperature
  return (bands.find((b) => temperature <= b.max) ?? bands.at(-1)!).mult
}
export function rotRate(w: World, it: ItemInst, def: ItemDef, temperature: number, wet = false, sealed = false): number {
  const hours=def.food?.freshHours??def.drink?.freshHours
  if (!hours) return 0
  const d = foodSafetyDef(w)
  return 100 / hours * rotTemperature(w, temperature) * (sealed || it.foodSealed ? d.sealedMult : 1) * (wet || it.foodWet ? d.wetMult : 1) * (it.foodLeftover ? d.leftoverMult : 1) * (it.foodThawed ? d.thawedMult : 1)
}
export function foodPoisonRisk(w: World, c: Creature, it: ItemInst,handler:Creature=c): number {
  if (traitOverride(w, c, 'foodPoisonImmune')) return 0
  const def=w.db.item(it.def), f = def.food ?? (def.drink?.freshHours ? {raw:false,cooked:true,poison:0} : undefined)
  if (!f) return 0
  const d = foodSafetyDef(w), band = freshnessBand(w, it)
  const rot = band === 'rotten' ? d.rottenRisk : band === 'spoiled' ? d.spoiledRisk : band === 'stale' ? d.staleRisk : 0
  return Math.min(100, Math.max(0, (f.raw ? (f.poison ?? 25)+('sprouts'in f&&f.sprouts&&foodFreshness(it)<=f.sprouts.at?f.sprouts.risk:0) : 0) + rot + (c.needs.hygiene < d.dirtyHandsAt || handler.needs.hygiene < d.dirtyHandsAt || handState(w, handler) === 'dirty' ? d.dirtyHandsRisk : 0) - (f.cooked ? masteryStage(w, handler, 'survival') : 0)) * traitMul(w, c, 'foodPoisonMult')) / 100
}
export function hygieneContamination(w: World, c: Creature): number {
  const d = foodSafetyDef(w)
  return c.needs.hygiene < d.filthyAt ? d.filthyWound : c.needs.hygiene < d.dirtyHandsAt ? d.dirtyWound : 0
}

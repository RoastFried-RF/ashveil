// Two actual carried bottles exchange millilitres; dissolved salt and contamination are conserved.
import { capacity } from './body'
import { log, type World } from './ctx'
import { itemDef } from './items'
import { drinkVolume, spendDrinkVolume } from './wash-water'
import { waterQuality, waterSalinity } from './water-state'
import {isWaterVessel,waterCapacity,waterVesselForm} from './water-vessels'
import type { Creature, WaterQuality } from './types'
const valid = (q: WaterQuality) => [q.pathogen, q.ash, waterSalinity(q)].every(n => Number.isFinite(n) && n >= 0) && waterSalinity(q) <= 400
/** No intermediate rounding: concentration × actual volume preserves the dissolved mass. */
export function mixWater(a: WaterQuality, aMl: number, b: WaterQuality, bMl: number): WaterQuality {
  if (!Number.isSafeInteger(aMl) || !Number.isSafeInteger(bMl) || aMl < 0 || bMl < 0 || !Number.isSafeInteger(aMl + bMl) || aMl + bMl <= 0 || !valid(a) || !valid(b)) throw new Error('유효한 수질과 실제 혼합량이 필요하다')
  if (!aMl) return { ...b }
  if (!bMl) return { ...a }
  const total = aMl + bMl, mean = (av: number, bv: number) => (av * aMl + bv * bMl) / total
  const q: WaterQuality = { pathogen: mean(a.pathogen, b.pathogen), ash: mean(a.ash, b.ash), source: a.source === b.source ? a.source : '섞은 물' }
  if (a.salinity !== undefined || b.salinity !== undefined) q.salinity = mean(waterSalinity(a), waterSalinity(b))
  return q
}
export function waterPourQuote(w: World, c: Creature, uid: number, targetUid: number, ml: number) {
  const source = c.bag.find(i => i.uid === uid), target = c.bag.find(i => i.uid === targetUid)
  const out = { error: null as string | null, ml, source, target, sourceMl: source ? drinkVolume(w, source) : 0, targetMl: target ? drinkVolume(w, target) : 0, capacityMl: target ? waterCapacity(w,target) : 0, quality: undefined as WaterQuality | undefined }
  if (!c.alive || !w.s.creatures.includes(c) || c.asleep || c.unconscious || c.captivity || capacity(w, c, 'consciousness') < .5 || capacity(w, c, 'manipulation') < .2) out.error = '깨어서 물병을 다룰 손이 필요하다'
  else if (!source || !target || source === target || uid === targetUid || !isWaterVessel(w,source) || !isWaterVessel(w,target) || source.count !== 1 || target.count !== 1) out.error = '배낭의 서로 다른 실제 물 용기 두 개가 필요하다'
  else if (source.waterFrozen || target.waterFrozen) out.error = '눈이나 얼음을 먼저 녹여야 한다'
  else if (![out.sourceMl,out.targetMl,out.capacityMl].every(n=>Number.isSafeInteger(n)&&n>=0) || !Number.isSafeInteger(ml) || ml <= 0 || ml > out.sourceMl || ml + out.targetMl > out.capacityMl || out.sourceMl > waterCapacity(w,source)) out.error = '실제 물의 양과 받는 용기의 빈 공간을 확인하자'
  else if (!valid(waterQuality(w, source)) || out.targetMl > 0 && !valid(waterQuality(w, target))) out.error = '물의 수질 기록이 올바르지 않다'
  else out.quality = mixWater(out.targetMl ? waterQuality(w, target) : {pathogen:0,ash:0}, out.targetMl, waterQuality(w, source), ml)
  return out
}
export function pourWater(w: World, c: Creature, uid: number, targetUid: number, ml: number): string | null {
  const q = waterPourQuote(w, c, uid, targetUid, ml)
  if (q.error) return q.error
  const source = q.source!, target = q.target!, quality = q.quality!, unit = itemDef(w, target).drink!.water
  spendDrinkVolume(w, source, ml)
  if (!source.uses)waterVesselForm(w,source)
  target.water = quality; waterVesselForm(w,target,quality); target.uses = (q.targetMl + ml) / unit
  delete source.waterSettlesAt; delete target.waterSettlesAt
  if (c.id === w.s.playerId) log(w, 'info', `같은 물병 사이에 물${ml}ml를 옮겼다. 소금과 오염도 함께 옮겨졌다.`)
  return null
}

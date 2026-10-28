// 물은 ml로 정산한다. Item.uses의 1단위는 그 음료의 drink.water ml다.
import { tileAt, turnOf, type World } from './ctx'
import { itemDef } from './items'
import {isWaterVessel,waterVesselForm} from './water-vessels'
import type { Creature, ItemInst } from './types'
export function drinkVolume(w: World, it: ItemInst): number {
  return Math.max(0, Math.round((itemDef(w, it).drink?.water ?? 0) * (it.uses ?? 1)))
}
export function spendDrinkVolume(w: World, it: ItemInst, ml: number): number {
  if (!Number.isSafeInteger(ml) || ml <= 0) return 0
  const volume = drinkVolume(w, it), take = Math.min(volume, ml), unit = itemDef(w, it).drink?.water ?? 0
  if (unit > 0) it.uses = (volume - take) / unit
  const empty=itemDef(w,it).drink?.emptyVessel
  if(empty&&it.uses===0){
    it.def=empty;it.uses=0
    for(const key of ['water','waterSettlesAt','freshness','foodAgedAt','foodFrozen','foodThawed','foodWet','foodLeftover','foodSealed']as const)delete it[key]
  }
  if(it.uses===0&&isWaterVessel(w,it))waterVesselForm(w,it)
  return take
}
export function washWaterSupply(w: World, c: Creature, ml: number) {
  const tile = tileAt(w, c.pos), def = w.db.terrain(tile.t)
  const river = !!def.water && (!(tile.icy || def.icy) || (tile.iceHoleUntil ?? 0) > turnOf(w))
  const water = c.bag.reduce((n, it) => n + (itemDef(w, it).drink && !itemDef(w, it).drink!.alcohol && !it.waterFrozen ? drinkVolume(w, it) : 0), 0)
  return { available: Number.isSafeInteger(ml) && ml > 0 && (river || water >= ml), river, water }
}
export function spendWashWater(w: World, c: Creature, ml: number): boolean {
  const supply = washWaterSupply(w, c, ml)
  if (!supply.available) return false
  if (supply.river) return true
  let left = ml
  for (const it of c.bag) {
    const drink = itemDef(w, it).drink
    if (!drink || drink.alcohol || it.waterFrozen || drink.water <= 0) continue
    const volume = drinkVolume(w, it), take = Math.min(left, volume)
    if (!take) continue
    spendDrinkVolume(w, it, take); left -= take
    if (!it.uses && isWaterVessel(w,it))waterVesselForm(w,it)
    if (!left) break
  }
  c.bag = c.bag.filter((it) => it.uses !== 0 || isWaterVessel(w,it))
  return true
}

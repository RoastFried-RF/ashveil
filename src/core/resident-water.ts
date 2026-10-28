import {isWaterVessel} from './water-vessels'
import {residentHygieneGoal,residentHygieneSupply} from './resident-hygiene'
import { suitableDrink } from './water-state'
import { npcRestDef, residentPreparingRest } from './resident-rest'
// 실제 우물/물병을 쓴다. 먼 수원의 현재 상태는 곁에 도착해 확인한다.
import { capacity } from './body'
import { creatureAt, inBounds, terrainAt, tileAt, turnOf, type World } from './ctx'
import { invalidateLights } from './fov'
import { cheb } from './geom'
import { handHygieneDef, handState } from './hand-hygiene'
import { allItems, itemDef } from './items'
import { drinkVolume } from './wash-water'
import type { Creature, ResidentWaterDef, WorldSite } from './types'
export const residentWaterDef = (w: World) => w.db.tryGet<ResidentWaterDef>('ResidentWater.Hearth')
export function initializeResidentWater(w: World, site: WorldSite) {
  const d = residentWaterDef(w)
  if (!d || w.s.map.residentWaterInitialized) return
  const keeper = w.s.creatures.find((c) => c.traderSite === site.id), home = keeper?.home
  if (home) {
    let placed = false
    for (let r = 1; r <= d.radius && !placed; r++) for (let y = home.y - r; y <= home.y + r && !placed; y++) for (let x = home.x - r; x <= home.x + r && !placed; x++) {
      const pos = { x, y }
      if (cheb(home, pos) !== r || !inBounds(w, pos) || creatureAt(w, pos)) continue
      const tile = tileAt(w, pos), t = terrainAt(w, pos)
      if (!t.passable || t.water || t.stairs || t.container || t.station || t.bedding || t.residentDepot || t.residentWell || tile.placed || tile.items.length || w.s.map.exits.some((e) => e.x === x && e.y === y)) continue
      tile.t = d.terrain; tile.roof = true; delete tile.icy; delete tile.snow; delete tile.iceHoleUntil
      w.s.map.residentWell = { site: site.id, terrain: d.terrain, pos }; placed = true
    }
  }
  w.s.map.residentWaterInitialized = true
  invalidateLights(w)
}
export function residentDrink(w: World, c: Creature) { return allItems(c).find((it) => itemDef(w, it).drink && !itemDef(w, it).drink!.alcohol && !it.waterFrozen && drinkVolume(w, it) > 0 && suitableDrink(w,it)) }
export function residentNeedsDrink(w: World, c: Creature): boolean {
  const d = residentWaterDef(w), prep = residentPreparingRest(w,c) ? npcRestDef(w)?.prepareWaterDeficit : undefined
  return !!d && (c.needs.waterDeficit >= d.thirstAt || prep !== undefined && c.needs.waterDeficit > prep)
}
export function residentWaterGoal(w: World, c: Creature) {
  const d = residentWaterDef(w), well = w.s.map.residentWell, m = w.s.overworld
  if (!d || !well || !m || c.id === w.s.playerId || !c.alive || c.activity || c.unconscious || c.asleep || capacity(w, c, 'manipulation') < .2 || c.residentSite !== m.currentRegion || c.residentSite !== well.site || c.faction !== m.sites.find((s) => s.id === well.site)?.faction || (c.residentWaterAfter ?? 0) > turnOf(w)) return null
  const water = allItems(c).reduce((sum, it) => sum + (itemDef(w, it).drink && !itemDef(w, it).drink!.alcohol && !it.waterFrozen ? drinkVolume(w, it) : 0), 0)
  const thirsty = residentNeedsDrink(w, c) && !residentDrink(w, c), hands = d.handWash && handState(w, c) === 'dirty' && water < handHygieneDef(w).waterMl
  const hygiene=residentHygieneGoal(w,c),wash=hygiene?residentHygieneSupply(w,c,hygiene.waterMl):undefined
  if(!thirsty&&!hands&&wash&&!wash.available&&wash.fill)return {...well,uid:wash.fill.uid}
  if (!thirsty && !hands) return null
  const bottle = allItems(c).filter((it) => isWaterVessel(w,it)).sort((a, b) => drinkVolume(w, a) - drinkVolume(w, b) || a.uid - b.uid)[0]
  return { ...well, uid: bottle?.uid }
}
export function delayResidentWater(w: World, c: Creature) { c.residentWaterAfter = turnOf(w) + (residentWaterDef(w)?.retryTurns ?? 1); c.residentReturning = true }

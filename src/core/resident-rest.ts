import { baseBedTenant } from './base-rest'
import { prisonerCareDef } from './prisoner-state'
import { companionDef, isCompanion } from './companion-state'
// 실제 주민 침대와 휴식 계획. 원격의 침대 점유는 도착해 확인한다.
import { painStage, painTotal } from './body'
import { creatureAt, inBounds, terrainAt, tileAt, turnOf, type World } from './ctx'
import { invalidateLights } from './fov'
import { cheb } from './geom'
import type { Creature, NpcRestDef, WorldSite } from './types'
export const npcRestDef = (w: World) => w.db.tryGet<NpcRestDef>('NpcRest.Hearth')
export function residentPreparingRest(w: World, c: Creature): boolean {
  const d = npcRestDef(w)
  return !!d && c.id !== w.s.playerId && c.alive && !c.unconscious && !c.asleep && !c.activity && !!c.residentSite && c.residentSite === w.s.overworld?.currentRegion && (c.needs.fatigue >= d.sleepAt || (c.needs.sleepDebt ?? 0) >= d.debtAt)
}
export const residentSleepFoodTarget = (w: World, c: Creature) => residentPreparingRest(w, c) ? npcRestDef(w)?.prepareKcal ?? 0 : 0
export function initializeResidentRest(w: World, site: WorldSite) {
  const d = npcRestDef(w)
  if (!d || w.s.map.residentRestInitialized) return
  const beds = w.s.map.residentBeds ??= []
  for (const c of w.s.creatures.filter((o) => o.alive && o.id !== w.s.playerId && o.home && o.mapId === w.s.map.id && o.faction === site.faction)) {
    c.residentSite = site.id
    if (beds.some((b) => b.owner === c.id)) continue
    let placed = false
    for (let r = 1; r <= d.radius && !placed; r++) for (let y = c.home!.y - r; y <= c.home!.y + r && !placed; y++) for (let x = c.home!.x - r; x <= c.home!.x + r && !placed; x++) {
      const pos = { x, y }
      if (cheb(pos, c.home!) !== r || !inBounds(w, pos) || creatureAt(w, pos)) continue
      const tile = tileAt(w, pos), t = terrainAt(w, pos)
      if (!t.passable || t.water || t.stairs || t.container || t.station || t.bedding || tile.placed || tile.items.length || w.s.map.exits.some((e) => e.x === x && e.y === y)) continue
      const base=tile.t
      tile.t = d.terrain; tile.roof = true
      beds.push({ owner: c.id, terrain: d.terrain, pos, base }); placed = true
    }
  }
  w.s.map.residentRestInitialized = true
  invalidateLights(w)
}
export function residentBedAt(w: World, pos: Creature['pos']) {
  return w.s.map.residentBeds?.find((b) => !b.packedUid && b.pos.x === pos.x && b.pos.y === pos.y && tileAt(w, pos).t === b.terrain)
}
export function residentBedError(w: World, c: Creature): string | null {
  const tenant=baseBedTenant(w,c.pos);if(tenant!==undefined)return tenant===c.id?null:'이 침구는 다른 동료에게 사용을 허락했다'
  const owner=residentBedAt(w,c.pos)?.owner??tileAt(w,c.pos).placed?.owner
  return owner!==undefined&&owner!==c.id?'이 침대는 다른 사람의 개인 침대다':null
}
export function residentWakeTarget(w: World, c: Creature) {
  if(c.captivity)return prisonerCareDef(w).wakeAt
  if(isCompanion(w,c))return companionDef(w).wakeAt
  return c.id !== w.s.playerId && residentBedAt(w, c.pos)?.owner === c.id ? npcRestDef(w)?.wakeAt : undefined
}
export function residentRestGoal(w: World, c: Creature) {
  const d = npcRestDef(w)
  if (!d || c.id === w.s.playerId || !c.alive || c.activity || c.unconscious || c.asleep || !c.residentSite || c.residentSite !== w.s.overworld?.currentRegion || (c.residentRestAfter ?? 0) > turnOf(w)) return null
  if (c.needs.fatigue < d.sleepAt && (c.needs.sleepDebt ?? 0) < d.debtAt) return null
  if (c.needs.bodyTemp < 35 || painStage(painTotal(w, c)) >= 5) return null
  return w.s.map.residentBeds?.find((b) => b.owner === c.id && !b.packedUid) ?? null
}
export function delayResidentRest(w: World, c: Creature) { c.residentRestAfter = turnOf(w) + (npcRestDef(w)?.retryTurns ?? 1) }

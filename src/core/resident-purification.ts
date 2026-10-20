import {isWaterVessel} from './water-vessels'
import {waterBatches,waterResourcePlan,suitableDrink } from './water-state'
// 아는 화덕/배급 창고까지 실제로 움직이고 기존 물 끓이기 활동을 쓴다.
import { capacity } from './body'
import { turnOf, TURNS_PER_DAY, type World } from './ctx'
import { makeMarketItem } from './economy'
import { hasLos } from './fov'
import { cheb } from './geom'
import { addToBag, countOf, makeItem } from './items'
import { waterQuality, waterSafetyDef } from './water-state'
import { worldSimulationDef } from './world-simulation'
import type { Creature, ItemInst, ResidentPurificationDef, WorldSite } from './types'

export const residentPurificationDef = (w: World) => w.db.tryGet<ResidentPurificationDef>('ResidentPurification.Hearth')
const dayOf = (w: World) => Math.floor(turnOf(w) / TURNS_PER_DAY)
const round = (n: number) => Math.round(n * 1e6) / 1e6
const resident = (w: World, c: Creature) => c.id !== w.s.playerId && c.alive && !c.activity && !c.asleep && !c.unconscious && capacity(w, c, 'consciousness') >= .5 && capacity(w, c, 'manipulation') >= .2 && !!c.residentSite && c.residentSite === w.s.overworld?.currentRegion && c.faction === w.s.overworld?.sites.find((s) => s.id === c.residentSite)?.faction
export function initializeResidentPurification(w: World, site: WorldSite) {
  const d = residentPurificationDef(w)
  if (!d || w.s.map.residentPurificationInitialized) return
  const home = w.s.creatures.find((c) => c.traderSite === site.id)?.home
  const fire = home && w.s.map.lights.filter((l) => l.kind === 'campfire' && w.db.terrain(w.s.map.tiles[l.pos.y * w.s.map.w + l.pos.x].t).id === d.fireTerrain)
    .sort((a, b) => cheb(home, a.pos) - cheb(home, b.pos) || a.pos.y - b.pos.y || a.pos.x - b.pos.x)[0]
  if (fire) w.s.map.residentHearth = { site: site.id, terrain: d.fireTerrain, pos: { ...fire.pos } }
  w.s.map.residentPurificationInitialized = true
}
export function delayResidentPurification(w: World, c: Creature) { c.residentPurifyAfter = turnOf(w) + (residentPurificationDef(w)?.retryTurns ?? 1); c.residentReturning = true }
export function residentPurificationGoal(w: World, c: Creature, it: ItemInst) {
  const d = residentPurificationDef(w), fire = w.s.map.residentHearth, depot = w.s.map.residentDepot, fuel = waterSafetyDef(w).treatments.boil.fuel
  if (!d || !resident(w, c) || !fire || fire.site !== c.residentSite || (c.residentPurifyAfter ?? 0) > turnOf(w) || !isWaterVessel(w,it) || (it.uses ?? 0) <= 0 || waterQuality(w, it).pathogen <= 0 || !suitableDrink(w,it) || !fuel) return null
  if (waterResourcePlan(c,fuel,waterBatches(w,it))) return { kind: 'boil' as const, pos: fire.pos, uid: it.uid }
  const unit = worldSimulationDef(w).items[fuel], used = c.residentFuel?.day === dayOf(w) ? c.residentFuel.units : 0
  if (!depot || depot.site !== c.residentSite || unit?.commodity !== 'Fuel' || d.dailyFuelUnits - used + 1e-9 < unit.units) return null
  return { kind: 'fuel' as const, pos: depot.pos, uid: it.uid }
}
export function residentFuelQuote(w: World, c: Creature) {
  const d = residentPurificationDef(w), depot = w.s.map.residentDepot, fuel = waterSafetyDef(w).treatments.boil.fuel, day = dayOf(w)
  const out = { error: null as string | null, item: fuel, count: 0, units: 0, day }
  if (!d || !resident(w, c) || !depot || depot.site !== c.residentSite) { out.error = '이 정착지 주민의 연료 배급이 아니다'; return out }
  if (cheb(c.pos, depot.pos) > 1 || !hasLos(w, c.pos, depot.pos) || w.s.map.tiles[depot.pos.y * w.s.map.w + depot.pos.x].t !== depot.terrain) { out.error = '실제 배급 창고 곁으로 가야 한다'; return out }
  const unit = fuel && worldSimulationDef(w).items[fuel], stock = w.s.overworld?.simulation?.settlements[depot.site], used = c.residentFuel?.day === day ? c.residentFuel.units : 0
  if (!fuel || !unit || unit.commodity !== 'Fuel' || !stock) { out.error = '배급할 연료가 없다'; return out }
  out.count = Math.max(0, Math.min(d.fuelTarget - countOf(c, fuel), w.db.item(fuel).maxStack ?? 99, Math.floor(((stock.reserve.Fuel ?? 0) + 1e-9) / unit.units), Math.floor((d.dailyFuelUnits - used + 1e-9) / unit.units)))
  for (; out.count > 0; out.count--) {
    const shadow = { db: w.db, s: { ...w.s, nextId: -1, rng: structuredClone(w.s.rng) } }, probe = makeItem(shadow, fuel, out.count), copy = { ...c, bag: structuredClone(c.bag) }
    if (!addToBag(shadow, copy, probe)) break
  }
  if (!out.count) out.error = '실제 연료·공간이나 오늘 받을 수 있는 배급이 부족하다'
  out.units = round(out.count * unit.units)
  return out
}
export function takeResidentFuel(w: World, c: Creature): string | null {
  const q = residentFuelQuote(w, c)
  if (q.error) {
    const depot = w.s.map.residentDepot
    if (resident(w, c) && depot && depot.site === c.residentSite && cheb(c.pos, depot.pos) <= 1 && hasLos(w, c.pos, depot.pos)) delayResidentPurification(w, c)
    return q.error
  }
  addToBag(w, c, makeMarketItem(w, q.item!, q.count))
  const stock = w.s.overworld!.simulation!.settlements[c.residentSite!]!
  stock.reserve.Fuel = round((stock.reserve.Fuel ?? 0) - q.units)
  const used = c.residentFuel?.day === q.day ? c.residentFuel.units : 0
  c.residentFuel = { day: q.day, units: round(used + q.units) }; c.residentReturning = true
  return null
}

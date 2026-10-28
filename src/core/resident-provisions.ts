import {foodServings} from './food-vessels'
import {readyFood} from './open-food-state'
import { residentSleepFoodTarget } from './resident-rest'
// 실제 공공 저장고→주민 배낭. 개인 지급 한도와 실제 식량/공간을 함께 확인한다.
import { capacity } from './body'
import { creatureAt, inBounds, player, terrainAt, tileAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { fx } from './combat'
import { makeMarketItem } from './economy'
import { canSee, hasLos, invalidateLights } from './fov'
import { cheb } from './geom'
import { addToBag, itemDef, makeItem } from './items'
import { worldSimulationDef } from './world-simulation'
import type { Creature, ResidentProvisionDef, WorldSite } from './types'
export const residentProvisionDef = (w: World) => w.db.tryGet<ResidentProvisionDef>('ResidentProvision.Hearth')
const dayOf = (w: World) => Math.floor(turnOf(w) / TURNS_PER_DAY)
const quantize = (n: number) => Math.round(n * 1e6) / 1e6
export function initializeResidentProvisions(w: World, site: WorldSite) {
  const d = residentProvisionDef(w)
  if (!d || w.s.map.residentProvisionInitialized) return
  const keeper = w.s.creatures.find((c) => c.traderSite === site.id), home = keeper?.home
  if (home) {
    let placed = false
    for (let r = 1; r <= d.radius && !placed; r++) for (let y = home.y - r; y <= home.y + r && !placed; y++) for (let x = home.x - r; x <= home.x + r && !placed; x++) {
      const pos = { x, y }
      if (cheb(home, pos) !== r || !inBounds(w, pos) || creatureAt(w, pos)) continue
      const tile = tileAt(w, pos), t = terrainAt(w, pos)
      if (!t.passable || t.water || t.stairs || t.container || t.station || t.bedding || t.residentDepot || tile.placed || tile.items.length || w.s.map.exits.some((e) => e.x === x && e.y === y)) continue
      tile.t = d.terrain; tile.roof = true
      w.s.map.residentDepot = { site: site.id, terrain: d.terrain, pos }; placed = true
    }
  }
  w.s.map.residentProvisionInitialized = true
  invalidateLights(w)
}
export function residentFoodKcal(w: World, c: Creature): number { return c.bag.reduce((sum, it) => sum + (readyFood(w,c,it)?itemDef(w, it).food!.kcal:0) * it.count * foodServings(w,it), 0) }
export function residentProvisionGoal(w: World, c: Creature) {
  const d = residentProvisionDef(w), depot = w.s.map.residentDepot, m = w.s.overworld
  if (!d || !depot || !m || c.id === w.s.playerId || !c.alive || c.activity || c.unconscious || c.asleep || c.residentSite !== depot.site || c.residentSite !== w.s.overworld?.currentRegion || (c.residentSupplyAfter ?? 0) > turnOf(w)) return null
  if (c.faction !== m.sites.find((s) => s.id === depot.site)?.faction || (c.needs.kcal > d.requestBelowKcal && c.needs.kcal >= residentSleepFoodTarget(w,c)) || residentFoodKcal(w, c) >= d.minimumKcal) return null
  const used = c.residentRation?.day === dayOf(w) ? c.residentRation.units : 0, unit = worldSimulationDef(w).items[d.food]
  return unit && d.dailyFoodUnits - used + 1e-9 >= unit.units ? depot.pos : null
}
export function delayResidentSupply(w: World, c: Creature) { c.residentSupplyAfter = turnOf(w) + (residentProvisionDef(w)?.retryTurns ?? 1); c.residentReturning = true }
export function residentRationQuote(w: World, c: Creature) {
  const d = residentProvisionDef(w), depot = w.s.map.residentDepot, day = dayOf(w), m = w.s.overworld
  const out = { error: null as string | null, count: 0, units: 0, day }
  if (!d || !depot || !m || c.id === w.s.playerId || !c.alive || c.activity || c.unconscious || c.asleep || capacity(w, c, 'consciousness') < .5 || c.residentSite !== depot.site || c.residentSite !== w.s.overworld?.currentRegion || c.faction !== m.sites.find((s) => s.id === depot.site)?.faction) { out.error = '이 정착지 주민의 배급이 아니다'; return out }
  if (cheb(c.pos, depot.pos) > 1 || !hasLos(w, c.pos, depot.pos) || tileAt(w, depot.pos).t !== depot.terrain || !terrainAt(w, depot.pos).residentDepot) { out.error = '실제 배급 창고 곁으로 가야 한다'; return out }
  const stock = m.simulation?.settlements[depot.site], unit = worldSimulationDef(w).items[d.food], food = w.db.item(d.food), used = c.residentRation?.day === day ? c.residentRation.units : 0
  if (!stock || unit?.commodity !== 'Food') { out.error = '배급할 저장고가 없다'; return out }
  out.count = Math.min(food.maxStack ?? 99, Math.ceil(Math.max(0, d.targetKcal - residentFoodKcal(w, c)) / food.food!.kcal), Math.floor(((stock.reserve.Food ?? 0) + 1e-9) / unit.units), Math.floor((d.dailyFoodUnits - used + 1e-9) / unit.units))
  out.count = Math.max(0, out.count)
  if (out.count <= 0) { out.error = '실제 식량이나 오늘 받을 수 있는 배급이 부족하다'; return out }
  // 탐색은 임시 UID/배낭에서만 한다. 실패한 요청은 전역 물품 UID를 소비하지 않는다.
  for (; out.count > 0; out.count--) {
    const shadow = { db: w.db, s: { ...w.s, nextId: -1, rng: structuredClone(w.s.rng) } }, probe = makeItem(shadow, d.food, out.count), copy = { ...c, bag: structuredClone(c.bag) }
    if (!addToBag(shadow, copy, probe)) break
  }
  if (!out.count) out.error = '배급 식량을 넣을 공간이 없다'
  out.units = quantize(out.count * unit.units)
  return out
}
export function takeResidentRation(w: World, c: Creature): string | null {
  const quote = residentRationQuote(w, c)
  if (quote.error) {
    const depot = w.s.map.residentDepot
    if (depot && c.id !== w.s.playerId && c.alive && !c.activity && !c.unconscious && !c.asleep && capacity(w, c, 'consciousness') >= .5 && c.residentSite === w.s.overworld?.currentRegion && cheb(c.pos, depot.pos) <= 1 && hasLos(w, c.pos, depot.pos)) delayResidentSupply(w, c)
    return quote.error
  }
  const d = residentProvisionDef(w)!, stock = w.s.overworld!.simulation!.settlements[c.residentSite!]!, item = makeMarketItem(w, d.food, quote.count)
  addToBag(w, c, item)
  stock.reserve.Food = quantize((stock.reserve.Food ?? 0) - quote.units)
  const used = c.residentRation?.day === quote.day ? c.residentRation.units : 0
  c.residentRation = { day: quote.day, units: quantize(used + quote.units) }; c.residentReturning = true
  if (canSee(w, player(w), c.pos)) fx(w, { k: 'status', id: c.id, text: '식량 배급', color: '#d6c690', turn: turnOf(w) })
  return null
}

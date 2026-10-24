import {cookingTemperature} from './cooking-state'
import {removeLastDietMeal} from './diet-state'
import { mapWorlds } from './journey'
import { spendWashWater, washWaterSupply } from './wash-water'
// 시간 경과에 따른 부패·식중독·씻기. 모든 상태는 저장에 포함한다.
import { log, rng, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { ambientTemp, regionalWeatherAt } from './environment'
import { foodFreshness, foodPoisonRisk, foodSafetyDef, rotRate } from './food-state'
import { allItems, itemDef, storedItems } from './items'
import { addThought } from './thoughts'
import {rememberLifeEvent} from './life-memories'
import {ageCarcass} from './carcass'
import { addEffect, hasEffect } from './traits'
import type { Creature, ItemInst,ItemDef } from './types'

export function ageFood(w: World, it: ItemInst, temperature: number, elapsed: number, wet = false, sealed = false) {
  const def = itemDef(w, it)
  ageFoodState(w,it,def,temperature,elapsed,wet,sealed)
}
export function ageFoodState(w:World,it:Pick<ItemInst,'freshness'|'foodSealed'|'foodWet'|'foodLeftover'|'foodThawed'|'foodFrozen'>,def:ItemDef,temperature:number,elapsed:number,wet=false,sealed=false){
  if (!(def.food?.freshHours||def.drink?.freshHours) || elapsed <= 0) return
  if (temperature <= 0) it.foodFrozen = true
  else if (it.foodFrozen) { it.foodThawed = true; it.foodFrozen = false }
  it.freshness = Math.max(0, foodFreshness(it) - rotRate(w, it, def, temperature, wet, sealed) * elapsed / TURNS_PER_HOUR)
}
/** 매시간 모든 생성된 지도의 바닥/밀폐 보관함/시체/배낭을 한 번씩 정산한다. */
export function foodTick(w: World) {
  const now = turnOf(w)
  if (now % TURNS_PER_HOUR) return
  for (const local of mapWorlds(w)) {
    const map = local.s.map, temp = ambientTemp(local)
    const age = (it: ItemInst, wet = false, sealed = false) => {
      if (!(itemDef(w, it).food?.freshHours||itemDef(w,it).drink?.freshHours)) return
      ageFood(w, it, temp, Math.max(0, now - (it.foodAgedAt ?? now - TURNS_PER_HOUR)), wet, sealed)
      it.foodAgedAt = now
    }
    for(const b of map.cooking??[]){if(b.item.missingItem)continue;ageFood(local,b.item,cookingTemperature(local,b,temp),Math.max(0,now-(b.item.foodAgedAt??now-TURNS_PER_HOUR)));b.item.foodAgedAt=now}
    for (const tile of map.tiles) {
      const wet = !!w.db.terrain(tile.t).water || (map.kind === 'surface' && !tile.roof && ['ashrain', 'ashstorm'].includes(w.s.weather))
      for (const it of storedItems(tile.items)) age(it, wet)
      for (const it of storedItems(tile.cont?.items ?? [])) age(it, false, !tile.cont!.opened)
    }
    for (const c of local.s.creatures){if(!c.alive)ageCarcass(local,c,temp,now);for (const it of storedItems(allItems(c))) age(it, c.needs.wetness >= 50)}
  }
  for (const [key,market] of Object.entries(w.s.overworld?.markets ?? {})) {
    const site = w.s.overworld!.sites.find((s) => s.id === market.site)
    const cell=market.worldCell??site?.cell
    if (!cell) continue
    const weather = regionalWeatherAt(w, cell), local = { db: w.db, s: { ...w.s, map: { ...w.s.map, kind: 'surface' as const, worldCell: cell }, weather: weather.weather, wind: weather.wind } }
    for (const it of storedItems(market.items)) if (itemDef(w, it).food?.freshHours||itemDef(w,it).drink?.freshHours) {
      ageFood(w, it, ambientTemp(local), Math.max(0, now - (it.foodAgedAt ?? now - TURNS_PER_HOUR)))
      it.foodAgedAt = now
    }
    // 지도를 떠난 같은 주민의 개인 식량도 실제 무리의 현재 기후에서 상한다.
    if(market.mobile)for(const c of w.s.overworld?.caravans?.find(c=>c.market===key)?.actors??[])for(const it of storedItems(allItems(c)))if(itemDef(w,it).food?.freshHours||itemDef(w,it).drink?.freshHours){
      ageFood(w,it,ambientTemp(local),Math.max(0,now-(it.foodAgedAt??now-TURNS_PER_HOUR)),c.needs.wetness>=50)
      it.foodAgedAt=now
    }
  }
  for(const group of w.s.overworld?.roadRaids??[])if(group.actors?.length){
    const weather=regionalWeatherAt(w,group.position),local={db:w.db,s:{...w.s,map:{...w.s.map,kind:'surface' as const,worldCell:group.position},weather:weather.weather,wind:weather.wind}}
    for(const c of group.actors)for(const it of storedItems(allItems(c)))if(itemDef(w,it).food?.freshHours||itemDef(w,it).drink?.freshHours){ageFood(w,it,ambientTemp(local),Math.max(0,now-(it.foodAgedAt??now-TURNS_PER_HOUR)),c.needs.wetness>=50);it.foodAgedAt=now}
  }

}
export function vomit(w: World, c: Creature) {
  removeLastDietMeal(c)
  const kcal = c.needs.lastMealKcal ?? 0
  c.needs.kcal -= kcal; c.needs.lastMealKcal = 0
  c.needs.waterDeficit += foodSafetyDef(w).vomitWater
  addThought(w, c, 'Thought.Vomited')
  if (c.faction === 'player') log(w, 'danger', '토했다. 직전 식사를 게워 내고 수분을 잃었다.')
}
export function foodPoison(w: World, c: Creature, it: ItemInst,handler:Creature=c): boolean {
  const chance = foodPoisonRisk(w, c, it,handler)
  if (chance <= 0 || !rng(w, 'body').chance(chance)) return false
  const d = foodSafetyDef(w), r = rng(w, 'body'), now = turnOf(w)
  const until = Math.max(c.needs.poisoning?.until ?? now, now + r.int(...d.poisonHours) * TURNS_PER_HOUR)
  const count = r.int(...d.vomits), pending = c.needs.poisoning?.vomitAt ?? []
  for (let i = 1; i < count; i++) pending.push(now + Math.ceil((until - now) * i / count))
  c.needs.poisoning = { until, vomitAt: pending.sort((a, b) => a - b) }
  addEffect(c, 'foodPoisoning', until)
  vomit(w, c)
  if (c.faction === 'player') log(w, 'danger', `${w.db.item(it.def).label}을(를) 먹고 탈이 났다.`)
  return true
}
export function poisoningTick(w: World, c: Creature) {
  const p = c.needs.poisoning
  if (!p) return
  const now = turnOf(w)
  while (p.vomitAt.length && p.vomitAt[0] <= now) { p.vomitAt.shift(); vomit(w, c) }
  if (now >= p.until) { delete c.needs.poisoning; c.effects = c.effects.filter((e) => e.kind !== 'foodPoisoning') }
}
export function hygieneDaily(w: World, c: Creature) {
  const d = foodSafetyDef(w)
  if (w.s.hygieneEnabled === false) { c.needs.hygiene = 70; return }
  if (c.needs.hygiene < d.filthyAt && !hasEffect(c, 'lice', turnOf(w)) && rng(w, 'body').chance(d.liceRisk)) {
    addEffect(c, 'lice', Number.MAX_SAFE_INTEGER)
    if (c.faction === 'player') log(w, 'warn', '몸에 이가 생겼다. 가렵고 잠을 설친다. 씻어야 한다.')
  }
}
/** 물은 여러 병에 나눠 있어도 합산하며, 완료 때 필요한 양 전체를 다시 확인한다. */
export function washSupply(w: World, c: Creature): { available: boolean; river: boolean } {
  const supply = washWaterSupply(w, c, foodSafetyDef(w).washWater)
  return { available: supply.available, river: supply.river }
}
export function finishWash(w: World, c: Creature): boolean {
  const supply = washSupply(w, c), d = foodSafetyDef(w)
  if (!supply.available) { if (c.faction === 'player') log(w, 'warn', '씻을 물이 부족해 중단했다.'); return false }
  spendWashWater(w, c, d.washWater)
  c.hands = { kind: 'washed', at: turnOf(w) }
  c.needs.hygiene = w.s.hygieneEnabled === false ? 70 : Math.min(100, c.needs.hygiene + d.washGain)
  c.effects = c.effects.filter((e) => e.kind !== 'lice')
  rememberLifeEvent(w,c,'wash')
  if (supply.river && ambientTemp(w, c.pos) < 20) {
    c.needs.wetness = 100
    c.needs.skinWetness = { head: 100, torso: 100, arms: 100, legs: 100, hands: 100, feet: 100 }
    c.needs.bodyTemp -= d.bathCooling
  }
  if (c.faction === 'player') log(w, 'good', '몸을 씻었다. 위생이 회복됐다.')
  return true
}

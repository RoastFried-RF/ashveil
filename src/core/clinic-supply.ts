// 의사는 상점에 걸어가 자신의 돈으로 실제 재고를 산다. 원격 재고를 읽어 이동하지 않는다.
import { allItems, itemDef } from './items'
import { exchange, marketFor, tradeAccess, tradePrice } from './economy'
import { hostile } from './diplomacy'
import { canSee } from './fov'
import { cheb, eq, type Pos } from './geom'
import { turnOf, type World } from './ctx'
import type { ClinicDef, Creature } from './types'

const policy = (w: World, c: Creature) => {
  const id = w.db.creature(c.def).clinic
  return id ? w.db.tryGet<ClinicDef>(id) : undefined
}

export function clinicSupplyStock(w: World, c: Creature) {
  const items = allItems(c)
  return (policy(w, c)?.restock?.targets ?? []).map((rule) => {
    const count = items.reduce((n, it) => {
      const matches = it.def === rule.item || rule.equivalents?.includes(it.def), usable = (it.durability ?? 100) > 0
      if (!matches || !usable) return n
      const units = rule.uses ? Math.max(0, it.uses ?? itemDef(w, it).uses ?? 1) : 1
      return n + it.count * units
    }, 0)
    return { rule, count, missing: Math.max(0, rule.target - count) }
  })
}
export const clinicSupplyNeeds = (w: World, c: Creature) => clinicSupplyStock(w, c).filter((r) => r.count < r.rule.minimum)

export function clinicSupplyGoal(w: World, c: Creature): { kind: 'shop' | 'home'; pos: Pos; trader?: number } | null {
  const d = policy(w, c)
  if (!d?.restock || !c.home || !c.clinicSite || c.clinicSite !== w.s.overworld?.currentRegion || c.activity) return null
  if (clinicSupplyNeeds(w, c).length && (c.money ?? 0) > 0 && (c.clinicSupplyAfter ?? 0) <= turnOf(w)) {
    const trader = w.s.creatures.filter((o) => o.traderSite === c.clinicSite && o.alive && !hostile(w, c, o)).sort((a, b) => cheb(c.pos, a.home ?? a.pos) - cheb(c.pos, b.home ?? b.pos) || a.id - b.id)[0]
    if (trader) return { kind: 'shop', pos: { ...(canSee(w, c, trader.pos) ? trader.pos : trader.home ?? trader.pos) }, trader: trader.id }
  }
  return eq(c.pos, c.home) ? null : { kind: 'home', pos: { ...c.home } }
}

export function delayClinicSupply(w: World, c: Creature) {
  const d = policy(w, c)
  if (d?.restock) c.clinicSupplyAfter = turnOf(w) + d.restock.retryTurns
}

/** 도착한 뒤만 실제 상품·가격을 본다. 실패한 구매는 돈/시장/배낭/UID를 바꾸지 않는다. */
export function buyClinicSupplies(w: World, c: Creature, trader: Creature): string | null {
  const d = policy(w, c), market = marketFor(w, trader)
  if (!d?.restock || c.id === w.s.playerId || c.clinicSite !== trader.traderSite || !market) return '이곳에서 진료 물품을 살 수 없다'
  const access = tradeAccess(w, c, trader)
  if (access) { delayClinicSupply(w, c); return access }
  let reason = '살 수 있는 진료 물품이 없다'
  for (const need of clinicSupplyNeeds(w, c)) {
    for (const it of market.items.filter((i) => i.def === need.rule.item && (i.durability ?? 100) > 0 && (i.uses ?? 1) > 0)) {
      const price = tradePrice(w, c, trader, it, true)
      if (price > need.rule.maxPrice) { reason = '물품 가격이 지불 한도를 넘었다'; continue }
      const units = need.rule.uses ? it.uses ?? itemDef(w, it).uses ?? 1 : 1
      const count = Math.min(it.count, Math.ceil(need.missing / units), Math.floor((c.money ?? 0) / price))
      if (count <= 0) { reason = '물품을 살 돈이 부족하다'; continue }
      const error = exchange(w, c, trader, [{ uid: it.uid, count }], [], price * count)
      if (!error) return null
      reason = error
    }
  }
  delayClinicSupply(w, c)
  return reason
}

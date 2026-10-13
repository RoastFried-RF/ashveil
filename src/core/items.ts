// 아이템 인스턴스, 소지품, 장비, 무게

import { type World } from './ctx'
import type { AttackDef, Creature, ItemDef, ItemInst } from './types'

export function makeItem(w: World, defId: string, count = 1): ItemInst {
  const def = w.db.item(defId)
  const it: ItemInst = { uid: w.s.nextId++, def: defId, count }
  if (def.apparel) it.durability = def.apparel.durability
  if (def.light) { it.fuel = def.light.fuelTurns; it.lit = false }
  if (def.uses) it.uses = def.uses
  return it
}

export function itemDef(w: World, it: ItemInst): ItemDef {
  return w.db.item(it.def)
}

export function addToInventory(w: World, c: Creature, it: ItemInst) {
  const def = itemDef(w, it)
  if (def.stackable) {
    const ex = c.inventory.find((x) => x.def === it.def)
    if (ex) { ex.count += it.count; return }
  }
  c.inventory.push(it)
}

export function findItem(c: Creature, uid: number): ItemInst | undefined {
  return c.inventory.find((i) => i.uid === uid)
}

export function removeOne(w: World, c: Creature, uid: number): ItemInst | undefined {
  const it = findItem(c, uid)
  if (!it) return undefined
  if (it.count > 1) {
    it.count--
    return { ...it, uid: w.s.nextId++, count: 1 }
  }
  c.inventory = c.inventory.filter((i) => i.uid !== uid)
  unequip(c, uid)
  return it
}

export function isEquipped(c: Creature, uid: number): boolean {
  return c.equipment.main === uid || c.equipment.off === uid || c.equipment.apparel.includes(uid)
}

export function unequip(c: Creature, uid: number) {
  if (c.equipment.main === uid) c.equipment.main = undefined
  if (c.equipment.off === uid) c.equipment.off = undefined
  c.equipment.apparel = c.equipment.apparel.filter((u) => u !== uid)
}

/** 장착. 반환: 오류 메시지 또는 null */
export function equip(w: World, c: Creature, uid: number): string | null {
  const it = findItem(c, uid)
  if (!it) return '아이템 없음'
  const def = itemDef(w, it)
  if (def.apparel) {
    const ap = def.apparel
    c.equipment.apparel = c.equipment.apparel.filter((u) => {
      const o = findItem(c, u)
      if (!o) return false
      const oa = itemDef(w, o).apparel!
      return !(oa.layer === ap.layer && oa.groups.some((g) => ap.groups.includes(g)))
    })
    c.equipment.apparel.push(uid)
    return null
  }
  if (def.category === 'weapon') {
    c.equipment.main = uid
    if (def.twoHanded) c.equipment.off = undefined
    return null
  }
  if (def.category === 'shield') {
    const main = c.equipment.main !== undefined ? findItem(c, c.equipment.main) : undefined
    if (main && itemDef(w, main).twoHanded) return '양손 무기를 들고 있다'
    c.equipment.off = uid
    return null
  }
  if (def.light) {
    c.equipment.off = uid
    return null
  }
  return '장착할 수 없는 물건'
}

export function mainWeapon(w: World, c: Creature): ItemInst | undefined {
  return c.equipment.main !== undefined ? findItem(c, c.equipment.main) : undefined
}

export function offHand(w: World, c: Creature): ItemInst | undefined {
  return c.equipment.off !== undefined ? findItem(c, c.equipment.off) : undefined
}

export function currentAttack(w: World, c: Creature): AttackDef | undefined {
  const mw = mainWeapon(w, c)
  if (mw) return itemDef(w, mw).attack
  return w.db.creature(c.def).naturalAttack
}

export function apparelItems(w: World, c: Creature): { it: ItemInst; def: ItemDef }[] {
  return c.equipment.apparel
    .map((u) => findItem(c, u))
    .filter((x): x is ItemInst => !!x)
    .map((it) => ({ it, def: itemDef(w, it) }))
}

export function carriedWeight(w: World, c: Creature): number {
  let t = 0
  for (const it of c.inventory) t += itemDef(w, it).weight * it.count
  return Math.round(t * 10) / 10
}

export function carryCapacity(c: Creature): number {
  return 15 + c.stats.str * 1.5
}

/** 과적 TU 배율 */
export function encumbranceMult(w: World, c: Creature): number {
  const cap = carryCapacity(c)
  const wt = carriedWeight(w, c)
  if (wt <= cap) return 1
  return 1 + (0.5 * (wt - cap)) / cap
}

export function lightSource(w: World, c: Creature): ItemInst | undefined {
  return c.inventory.find((i) => i.lit && (i.fuel ?? 0) > 0)
}

export function hasBlade(w: World, c: Creature): boolean {
  return c.inventory.some((i) => itemDef(w, i).attack?.skill === 'blade')
}

export function itemLabel(w: World, it: ItemInst): string {
  const def = itemDef(w, it)
  let s = def.label
  if (def.unidentified) {
    const eff = w.s.knowledge.pillKnown[it.def]
    if (eff) s += ` (${w.db.pill(eff).label})`
    else s += ' (미확인)'
  }
  if (it.count > 1) s += ` ×${it.count}`
  if (it.uses !== undefined) s += ` [${it.uses}회]`
  if (def.light) s += it.lit ? ' (켜짐)' : ''
  return s
}

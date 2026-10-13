// 아이템: 격자 배낭 + 장비 슬롯 + 빠른 슬롯

import { type World } from './ctx'
import type { AttackDef, Creature, ItemDef, ItemInst, Slot } from './types'

export const BAG_W = 10
export const BAG_H = 6

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

export function maxStack(def: ItemDef): number {
  return def.stackable ? def.maxStack ?? 5 : 1
}

/** 장착 + 배낭의 모든 아이템 */
export function allItems(c: Creature): ItemInst[] {
  const eq = Object.values(c.equip).filter((x): x is ItemInst => !!x)
  return [...c.bag, ...eq]
}

export function findItem(c: Creature, uid: number): ItemInst | undefined {
  return allItems(c).find((i) => i.uid === uid)
}

export function isEquipped(c: Creature, uid: number): boolean {
  return Object.values(c.equip).some((i) => i?.uid === uid)
}

export function equippedSlot(c: Creature, uid: number): Slot | undefined {
  return (Object.keys(c.equip) as Slot[]).find((k) => c.equip[k]?.uid === uid)
}

// ── 격자 ──────────────────────────────────────────────

function occupied(w: World, c: Creature, ignore?: number): boolean[] {
  const grid = new Array(BAG_W * BAG_H).fill(false)
  for (const it of c.bag) {
    if (it.uid === ignore || it.gx === undefined || it.gy === undefined) continue
    const [iw, ih] = itemDef(w, it).size
    for (let y = it.gy; y < it.gy + ih; y++) for (let x = it.gx; x < it.gx + iw; x++) grid[y * BAG_W + x] = true
  }
  return grid
}

export function fitsAt(w: World, c: Creature, def: ItemDef, gx: number, gy: number, ignore?: number): boolean {
  const [iw, ih] = def.size
  if (gx < 0 || gy < 0 || gx + iw > BAG_W || gy + ih > BAG_H) return false
  const g = occupied(w, c, ignore)
  for (let y = gy; y < gy + ih; y++) for (let x = gx; x < gx + iw; x++) if (g[y * BAG_W + x]) return false
  return true
}

export function findSpot(w: World, c: Creature, def: ItemDef): [number, number] | null {
  // 세로 우선(왼쪽 위부터 채움)
  for (let x = 0; x < BAG_W; x++) for (let y = 0; y < BAG_H; y++) if (fitsAt(w, c, def, x, y)) return [x, y]
  return null
}

/** 배낭에 넣기. 같은 종류는 먼저 쌓는다. 실패하면 남은 개수 반환 */
export function addToBag(w: World, c: Creature, it: ItemInst): number {
  const def = itemDef(w, it)
  const ms = maxStack(def)
  let left = it.count
  if (ms > 1) {
    for (const ex of c.bag) {
      if (ex.def !== it.def || ex.count >= ms) continue
      const take = Math.min(ms - ex.count, left)
      ex.count += take
      left -= take
      if (left <= 0) return 0
    }
  }
  while (left > 0) {
    const spot = findSpot(w, c, def)
    if (!spot) return left
    const n = Math.min(ms, left)
    const piece: ItemInst = n === it.count && left === it.count ? it : { ...it, uid: w.s.nextId++, count: n }
    piece.count = n
    piece.gx = spot[0]
    piece.gy = spot[1]
    c.bag.push(piece)
    left -= n
  }
  return 0
}

/** NPC 등 격자 제약 없이 넣기 (배낭이 꽉 차도 소지) */
export function addToInventory(w: World, c: Creature, it: ItemInst) {
  if (addToBag(w, c, it) > 0) {
    it.gx = undefined
    it.gy = undefined
    c.bag.push(it)
  }
}

export function moveInBag(w: World, c: Creature, uid: number, gx: number, gy: number): boolean {
  const it = c.bag.find((i) => i.uid === uid)
  if (!it) return false
  if (!fitsAt(w, c, itemDef(w, it), gx, gy, uid)) return false
  it.gx = gx
  it.gy = gy
  return true
}

/** 하나 빼내기 (쌓인 경우 1개 분리) */
export function removeOne(w: World, c: Creature, uid: number): ItemInst | undefined {
  const slot = equippedSlot(c, uid)
  if (slot) {
    const it = c.equip[slot]!
    delete c.equip[slot]
    return it
  }
  const it = c.bag.find((i) => i.uid === uid)
  if (!it) return undefined
  if (it.count > 1) {
    it.count--
    return { ...it, uid: w.s.nextId++, count: 1, gx: undefined, gy: undefined }
  }
  c.bag = c.bag.filter((i) => i.uid !== uid)
  return { ...it, gx: undefined, gy: undefined }
}

export function removeStack(c: Creature, uid: number): ItemInst | undefined {
  const slot = equippedSlot(c, uid)
  if (slot) {
    const it = c.equip[slot]!
    delete c.equip[slot]
    return it
  }
  const it = c.bag.find((i) => i.uid === uid)
  if (!it) return undefined
  c.bag = c.bag.filter((i) => i.uid !== uid)
  return { ...it, gx: undefined, gy: undefined }
}

export function countOf(c: Creature, defId: string): number {
  return c.bag.filter((i) => i.def === defId).reduce((s, i) => s + i.count, 0)
}

// ── 장비 ──────────────────────────────────────────────

export function slotFor(w: World, c: Creature, def: ItemDef): Slot | null {
  if (!def.slot) return null
  if (def.slot === 'ring') return c.equip.ring1 ? (c.equip.ring2 ? 'ring1' : 'ring2') : 'ring1'
  return def.slot
}

/** 장착. 기존 장비는 배낭으로. 반환: 오류 메시지 또는 null */
export function equip(w: World, c: Creature, uid: number, target?: Slot): string | null {
  const it = c.bag.find((i) => i.uid === uid)
  if (!it) return '배낭에 없다'
  const def = itemDef(w, it)
  const slot = target ?? slotFor(w, c, def)
  if (!slot) return '장착할 수 없는 물건'
  if (def.slot === 'ring' ? !slot.startsWith('ring') : def.slot !== slot) return '그 칸에는 맞지 않는다'
  if (slot === 'off') {
    const main = c.equip.main
    if (main && itemDef(w, main).twoHanded) return '양손 무기를 들고 있다'
  }
  c.bag = c.bag.filter((i) => i.uid !== uid)
  it.gx = undefined
  it.gy = undefined
  const prev = c.equip[slot]
  c.equip[slot] = it
  if (prev) addToInventory(w, c, prev)
  if (slot === 'main' && def.twoHanded && c.equip.off) {
    const off = c.equip.off
    delete c.equip.off
    addToInventory(w, c, off)
  }
  return null
}

export function unequip(w: World, c: Creature, slot: Slot): string | null {
  const it = c.equip[slot]
  if (!it) return '비어 있다'
  const def = itemDef(w, it)
  if (!findSpot(w, c, def) && !c.bag.some((b) => b.def === it.def && b.count < maxStack(def))) return '배낭에 자리가 없다'
  delete c.equip[slot]
  addToBag(w, c, it)
  return null
}

export function mainWeapon(_w: World, c: Creature): ItemInst | undefined {
  return c.equip.main
}

export function offHand(_w: World, c: Creature): ItemInst | undefined {
  return c.equip.off
}

export function currentAttack(w: World, c: Creature): AttackDef | undefined {
  const mw = c.equip.main
  if (mw) {
    const d = itemDef(w, mw)
    if (d.attack && !d.ranged) return d.attack
    if (d.ranged) return d.attack
  }
  return w.db.creature(c.def).naturalAttack
}

export function apparelItems(w: World, c: Creature): { it: ItemInst; def: ItemDef }[] {
  return Object.values(c.equip)
    .filter((x): x is ItemInst => !!x)
    .map((it) => ({ it, def: itemDef(w, it) }))
    .filter((x) => !!x.def.apparel)
}

/** 장비 수정치 합 (반지·목걸이 등) */
export function gearAdd(w: World, c: Creature, key: string): number {
  let v = 0
  for (const it of Object.values(c.equip)) {
    if (!it) continue
    const m = itemDef(w, it).mods?.[key]
    if (typeof m === 'number') v += m
  }
  return v
}

export function lightSource(w: World, c: Creature): ItemInst | undefined {
  return allItems(c).find((i) => i.lit && (i.fuel ?? 0) > 0)
}

export function hasBlade(w: World, c: Creature): boolean {
  return allItems(c).some((i) => itemDef(w, i).attack?.skill === 'blade')
}

// 무게는 쓰지 않는다 (공간이 제약). 호환용으로 1 고정
export function encumbranceMult(_w: World, _c: Creature): number {
  return 1
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

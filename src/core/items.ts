// 아이템: 격자 배낭 + 장비 슬롯 + 빠른 슬롯

import { regionState } from './body'
import { type World } from './ctx'
import type { AttackDef, Creature, ItemDef, ItemInst, Slot } from './types'

export const BAG_W = 10
export const BAG_H = 6

export function makeItem(w: World, defId: string, count = 1): ItemInst {
  const def = w.db.item(defId)
  const it: ItemInst = { uid: w.s.nextId++, def: defId, count }
  if (def.apparel || def.attacks || def.shield) it.durability = 100
  if (def.attacks?.some((a) => a.damageType === 'cut' || a.damageType === 'stab')) it.edge = def.edgeStart ?? 100
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

/** 놓인 방향을 반영한 칸 크기 [가로, 세로] */
export function itemSize(w: World, it: ItemInst): [number, number] {
  const [a, b] = itemDef(w, it).size ?? [1, 1]
  return it.rot ? [b, a] : [a, b]
}

function occupied(w: World, c: Creature, ignore?: number): boolean[] {
  const grid = new Array(BAG_W * BAG_H).fill(false)
  for (const it of c.bag) {
    if (it.uid === ignore || it.gx === undefined || it.gy === undefined) continue
    const [iw, ih] = itemSize(w, it)
    for (let y = it.gy; y < it.gy + ih; y++) for (let x = it.gx; x < it.gx + iw; x++) grid[y * BAG_W + x] = true
  }
  return grid
}

export function fitsAt(w: World, c: Creature, def: ItemDef, gx: number, gy: number, ignore?: number, rot = false): boolean {
  const [iw, ih] = rot ? [def.size[1], def.size[0]] : def.size
  if (gx < 0 || gy < 0 || gx + iw > BAG_W || gy + ih > BAG_H) return false
  const g = occupied(w, c, ignore)
  for (let y = gy; y < gy + ih; y++) for (let x = gx; x < gx + iw; x++) if (g[y * BAG_W + x]) return false
  return true
}

/** 빈 자리: 세로 우선(왼쪽 위부터), 기본 방향 먼저 → 안 되면 돌려서 (13 §9) */
export function findSpot(w: World, c: Creature, def: ItemDef): [number, number, boolean] | null {
  for (const rot of def.size[0] === def.size[1] ? [false] : [false, true]) {
    for (let x = 0; x < BAG_W; x++) for (let y = 0; y < BAG_H; y++) if (fitsAt(w, c, def, x, y, undefined, rot)) return [x, y, rot]
  }
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
    piece.rot = spot[2] || undefined
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

export function moveInBag(w: World, c: Creature, uid: number, gx: number, gy: number, rot?: boolean): boolean {
  const it = c.bag.find((i) => i.uid === uid)
  if (!it) return false
  const r = rot ?? !!it.rot
  if (!fitsAt(w, c, itemDef(w, it), gx, gy, uid, r)) return false
  it.gx = gx
  it.gy = gy
  it.rot = r || undefined
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
  // 한손 무기는 보조 칸에도 든다 (13 §6.1)
  const offWeapon = slot === 'off' && def.slot === 'main' && !def.twoHanded && !!def.attacks
  if (!offWeapon && (def.slot === 'ring' ? !slot.startsWith('ring') : def.slot !== slot)) return '그 칸에는 맞지 않는다'
  const blocked = slotBlocked(w, c, slot)
  if (blocked) return blocked
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

/** 슬롯이 막혔는가 (13 §6.1): 보조 칸은 왼팔 불구면, 반지는 그 손 손가락을 잃으면 */
export function slotBlocked(w: World, c: Creature, slot: Slot): string | null {
  if (slot === 'off' && regionState(w, c, 'larm') === 4) return '왼팔을 쓸 수 없다'
  if (slot === 'main' && regionState(w, c, 'rarm') === 4) return '오른팔을 쓸 수 없다'
  if (slot === 'ring1' || slot === 'ring2') {
    const side = slot === 'ring1' ? 'Right' : 'Left'
    if (c.body.missing.some((m) => m.startsWith(side) && /Thumb|Index|Middle|Ring|Pinky|Hand|Forearm|UpperArm/.test(m))) return '그 손에 낄 손가락이 없다'
  }
  return null
}

/** 지금 공격에 쓰는 무기·팔 (02 §2.0.3: 불구 팔의 무기는 못 쓴다, 양손 무기는 두 팔 모두 필요) */
export interface Wield {
  atk: AttackDef
  item?: ItemInst
  arm: 'larm' | 'rarm'
  twoHanded: boolean
}

function pickMode(def: ItemDef, mode?: string): AttackDef {
  const list = def.attacks!
  return list.find((a) => a.id === mode) ?? list[0]
}

export function wield(w: World, c: Creature, mode?: string): Wield | undefined {
  const la = regionState(w, c, 'larm'), ra = regionState(w, c, 'rarm')
  const want = mode ?? c.attackMode
  const main = c.equip.main
  if (main) {
    const d = itemDef(w, main)
    if (d.attacks?.length) {
      if (d.twoHanded ? la < 4 && ra < 4 : ra < 4) return { atk: pickMode(d, want), item: main, arm: 'rarm', twoHanded: !!d.twoHanded }
    }
  }
  const off = c.equip.off
  if (off && la < 4) {
    const d = itemDef(w, off)
    if (d.attacks?.length && !d.ranged) return { atk: pickMode(d, want), item: off, arm: 'larm', twoHanded: false }
  }
  const nat = w.db.creature(c.def).naturalAttack
  if (!nat) return undefined
  if (nat.family === 'unarmed' && w.db.body(c.body.def).kind === 'humanoid') {
    if (ra < 4) return { atk: nat, arm: 'rarm', twoHanded: false }
    if (la < 4) return { atk: nat, arm: 'larm', twoHanded: false }
    return undefined
  }
  return { atk: nat, arm: 'rarm', twoHanded: false }
}

/** 근접에 쓰는 무기 (활을 들고 있으면 주먹) */
export function meleeWield(w: World, c: Creature, mode?: string): Wield | undefined {
  const main = c.equip.main
  if (main && itemDef(w, main).ranged) {
    const nat = w.db.creature(c.def).naturalAttack
    return nat ? { atk: nat, arm: 'rarm', twoHanded: false } : undefined
  }
  return wield(w, c, mode)
}

export function mainWeapon(_w: World, c: Creature): ItemInst | undefined {
  return c.equip.main
}

export function offHand(_w: World, c: Creature): ItemInst | undefined {
  return c.equip.off
}

export function currentAttack(w: World, c: Creature): AttackDef | undefined {
  return wield(w, c)?.atk
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

/** 켜진 등불이 빛나는 곳 (13 §6, C5): 보조 손 = 제 반경, 허리띠 걸이(배낭 속 + 허리띠) = 반경 −1. 배낭에만 있으면 빛이 새지 않는다 */
export function lightSource(w: World, c: Creature): { it: ItemInst; radius: number } | undefined {
  const lit = (i?: ItemInst) => !!i && !!i.lit && (i.fuel ?? 0) > 0 && !!itemDef(w, i).light
  const off = c.equip.off
  if (off && lit(off)) return { it: off, radius: itemDef(w, off).light!.radius }
  for (const it of Object.values(c.equip)) if (it && lit(it) && it !== off) return { it, radius: itemDef(w, it).light!.radius }
  if (c.equip.belt) {
    const hooked = c.bag.find((i) => lit(i))
    if (hooked) return { it: hooked, radius: itemDef(w, hooked).light!.radius - 1 }
  }
  return undefined
}

export function hasBlade(w: World, c: Creature): boolean {
  return allItems(c).some((i) => itemDef(w, i).attacks?.some((a) => a.family === 'blade'))
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

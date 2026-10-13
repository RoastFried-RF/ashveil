// 행동 실행. 플레이어와 NPC가 같은 함수를 쓴다 (규칙 대칭성).
// 기본: 이동·공격 = 1턴(100TU). 치료·수색·수면 등은 여러 턴.

import { abilityStrike, recoverArrow, spearWallReact, useAbility } from './abilities'
import {
  bandageCoef, bloodLoss, capacity, energyMax, isMissing, PAIN_MULTI, painSpike, painStage, painTotal, part, regionPenalties, tryPart, woundDef,
} from './body'
import { canReach, fx, resolveAttack, pushBack, shoveChance } from './combat'
import { clamp, creatureAt, creatureById, inBounds, log, rng, terrainAt, tileAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { hasLos, invalidateLights, lightLevel } from './fov'
import {
  addToBag, addToInventory, equip, findItem, findSpot, gridAdd, gridFits, gridSpot, hasBlade, itemDef, itemLabel, makeItem, meleeWield, moveInBag,
  removeOne, removeStack, unequip, wield, type Grid,
} from './items'
import { addThought } from './needs'
import { diagonalBlocked } from './path'
import { emitNoise } from './perception'
import { learnAbility, spendStat } from './progression'
import { masteryStage, practice } from './skills'
import { addEffect, hasEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { Activity, Creature, HotbarRef, ItemInst, Slot, Stats, Wound } from './types'

export type Action =
  | { type: 'move'; dir: number }
  | { type: 'attack'; target: number }
  | { type: 'shoot'; target: number }
  | { type: 'wait' }
  | { type: 'rest'; turns: number }
  | { type: 'sleep' }
  | { type: 'pickup'; uid?: number }
  | { type: 'drop'; uid: number }
  | { type: 'equip'; uid: number; slot?: Slot }
  | { type: 'unequip'; slot: Slot }
  | { type: 'moveItem'; uid: number; gx: number; gy: number; rot?: boolean }
  | { type: 'search' }
  | { type: 'lootTake'; uid: number }
  | { type: 'lootAll' }
  | { type: 'lootPut'; uid: number; gx?: number; gy?: number; rot?: boolean }
  | { type: 'lootMove'; uid: number; gx: number; gy: number; rot?: boolean }
  | { type: 'lootClose' }
  | { type: 'treat'; uid: number; woundId?: number; limb?: string }
  | { type: 'consume'; uid: number }
  | { type: 'press'; woundId: number }
  | { type: 'cauterize'; woundId: number }
  | { type: 'removeTourniquet'; limb: string }
  | { type: 'toggleLight'; uid: number }
  | { type: 'examine'; uid: number }
  | { type: 'drinkHere' }
  | { type: 'fillBottle'; uid: number }
  | { type: 'throw'; uid: number; target: Pos }
  | { type: 'eatFloor' }
  | { type: 'stairs' }
  | { type: 'ability'; id: string; target?: number }
  | { type: 'spendStat'; stat: keyof Stats }
  | { type: 'learn'; id: string }
  | { type: 'hotbar'; index: number; ref: HotbarRef | null }
  | { type: 'leave' }
  | { type: 'shove'; dir: number }
  | { type: 'face'; dir: number }
  | { type: 'examineSelf' }
  | { type: 'closeDoor'; dir: number }
  | { type: 'attackMode' }

export interface ActResult { ok: boolean; tu: number; msg?: string }

const FAIL = (msg: string): ActResult => ({ ok: false, tu: 0, msg })
const FREE: ActResult = { ok: true, tu: 0 }

function isPl(c: Creature) { return c.faction === 'player' }

/** 이동 = 1턴(01 §4). 잠행 2턴, 양다리 불구면 기어가기 2턴 */
export function moveTU(w: World, c: Creature, _to: Pos): number {
  if (regionPenalties(w, c).crawl) return 200
  return c.sneaking ? 200 : 100
}

/** 다턴 행동 배율 (01 §5.1): 조작 · 팔 · 피로 · 탈수 · 통증 · 실혈 · 추위 · 쇼크 · 술 · 공포 · 조명 · 잠기운. ×4 초과면 불가 */
export function multiTurnFactor(w: World, c: Creature, opts: { equip?: boolean } = {}): number {
  const turn = turnOf(w)
  const k = capacity(w, c, 'manipulation')
  if (k < 0.1) return Infinity
  let f = 1 / k
  f *= regionPenalties(w, c).multiTurn
  const n = c.needs
  f *= n.fatigue > 90 ? 1.3 : n.fatigue > 75 ? 1.15 : n.fatigue > 60 ? 1.05 : 1
  if (n.water < -1500) f *= 1.2
  f *= PAIN_MULTI[painStage(painTotal(w, c))]
  const loss = bloodLoss(c)
  f *= loss >= 0.3 ? 1.2 : loss >= 0.15 ? 1.05 : 1
  f *= n.bodyTemp < 34 ? 1.5 : n.bodyTemp < 35 ? 1.25 : n.bodyTemp < 36 ? 1.1 : 1
  if (opts.equip && n.wetness > 50) f *= 1.2
  if (c.cond?.shock) f *= 1.2
  if (hasEffect(c, 'alcohol', turn)) f *= 1.05
  if (hasEffect(c, 'panic', turn) || n.stress > 85) f *= 1.2
  const lv = lightLevel(w, c.pos)
  f *= lv === 3 ? 1.5 : lv === 2 ? 1.2 : 1
  if ((c.drowsyUntil ?? 0) > turn) f *= 1.3
  return f
}

/** 실제 턴 = ceil(기본 턴 × Π배율). ×4를 넘으면 null (할 수 없다) */
export function channelTurns(w: World, c: Creature, base: number, opts: { equip?: boolean } = {}): number | null {
  const f = multiTurnFactor(w, c, opts)
  if (f > 4) return null
  return Math.max(1, Math.ceil(base * f - 1e-9))
}

/** 적대 개체가 나를 인식한 상태 (13 §8.3) */
export function hostileAware(w: World, c: Creature): boolean {
  return w.s.creatures.some((o) => o.alive && !o.asleep && !o.unconscious && o.id !== c.id && hostile(c, o) && o.ai.mode === 'hunt' && o.ai.target === c.id)
}

/** 비틀거림% = clamp(0, 60, 왼다리 + 오른다리 + 지형 + 몸) (01 §5.2) */
export function stumbleChance(w: World, c: Creature, to: Pos): number {
  const pen = regionPenalties(w, c)
  if (pen.crawl) return 0
  let p = pen.stumble + (terrainAt(w, to).stumble ?? 0)
  if (tileAt(w, to).taint) p += 5 // 포자 바닥
  if (tileAt(w, to).blood > 20) p += 5
  const loss = bloodLoss(c)
  if (loss >= 0.3) p += 10
  else if (loss >= 0.15) p += 5
  if (painStage(painTotal(w, c)) >= 4) p += 5
  if (hasEffect(c, 'alcohol', turnOf(w))) p += 5
  const cons = capacity(w, c, 'consciousness')
  if (cons < 0.5) p += 10
  if ((c.drowsyUntil ?? 0) > turnOf(w)) p += 5
  if (c.needs.water < -1500) p += 10
  if (c.needs.fatigue > 90) p += 5
  p += c.needs.bodyTemp < 34 ? 15 : c.needs.bodyTemp < 35 ? 10 : 0
  return Math.max(0, Math.min(60, Math.round(p)))
}

export function hostile(a: Creature, b: Creature): boolean {
  if (a.faction === b.faction) return false
  if (a.faction === 'player' || b.faction === 'player') return true
  if (a.faction === 'vermin' || b.faction === 'vermin') return false
  if ((a.faction === 'withered' && b.faction === 'shades') || (a.faction === 'shades' && b.faction === 'withered')) return false
  return true
}

/** 주변의 아직 열지 않은 용기 */
export function adjacentContainer(w: World, c: Creature, includeOpened = false): Pos | undefined {
  for (const d of [{ x: 0, y: 0 }, ...DIRS]) {
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!inBounds(w, p)) continue
    const t = tileAt(w, p)
    if (terrainAt(w, p).container && (includeOpened || !t.searched)) return p
  }
  return undefined
}

function sleepingBlocked(w: World, c: Creature): string | null {
  for (const o of w.s.creatures) {
    if (o.alive && !o.asleep && hostile(c, o) && o.ai.mode !== 'surrender' && cheb(o.pos, c.pos) <= 8 && hasLos(w, c.pos, o.pos)) return '적이 가까이 있다'
  }
  return null
}

/** 수색 기본 턴: 생존 숙달 −5%/단계(최대 −25%) (15 §9.3) */
function searchBase(_w: World, c: Creature, base: number): number {
  return Math.max(1, Math.ceil(base * (1 - 0.05 * masteryStage(c, 'survival')) - 1e-9))
}

/** 자동 정렬 순서 (13 §9): 범주 → 칸 수 내림차순 → 긴 변 → defId */
const CAT_ORDER = ['weapon', 'shield', 'apparel', 'medical', 'drug', 'food', 'drink', 'tool', 'ammo', 'misc']
export function sortForPacking(w: World, items: ItemInst[]): ItemInst[] {
  const key = (i: ItemInst) => {
    const d = itemDef(w, i)
    const [a, b] = d.size ?? [1, 1]
    return [CAT_ORDER.indexOf(d.category), -(a * b), -Math.max(a, b)]
  }
  return items.sort((x, y) => {
    const kx = key(x), ky = key(y)
    for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return kx[i] - ky[i]
    return x.def < y.def ? -1 : x.def > y.def ? 1 : x.uid - y.uid
  })
}

/** 용기를 열어 내용물을 정한다 (전리품 표는 처음 열 때 한 번) */
function openContainer(w: World, c: Creature, p: Pos) {
  const t = tileAt(w, p)
  const terr = terrainAt(w, p)
  t.searched = true
  if (!t.cont) {
    t.cont = { items: [], opened: true, kind: terr.id }
    const [gw, gh] = terr.lootGrid ?? [6, 4]
    const g: Grid = { items: t.cont.items, w: gw, h: gh }
    for (const it of sortForPacking(w, terr.container ? rollLoot(w, terr.container) : [])) gridAdd(w, g, it)
  }
  t.cont.opened = true
  if (isPl(c)) w.s.loot = { pos: p, kind: 'cont' }
}

/** 주변의 시체 (소지품이 남은) */
export function adjacentCorpse(w: World, c: Creature, unsearchedOnly = false): Creature | undefined {
  return w.s.creatures.find((o) => !o.alive && o.id !== c.id && cheb(o.pos, c.pos) <= 1 && (!unsearchedOnly || !o.searched)
    && (o.bag.length > 0 || Object.values(o.equip).some(Boolean)))
}

/** 현재 루팅 대상의 격자 (상자·석관·서가·보관함·시체 배낭). 바닥은 null */
export function lootGrid(w: World): Grid | null {
  const l = w.s.loot
  if (!l) return null
  if (l.kind === 'corpse') {
    const o = w.s.creatures.find((x) => x.id === l.id)
    if (!o) return null
    const [gw, gh] = w.db.creature(o.def).bagSize ?? [4, 3]
    return { items: o.bag, w: gw, h: gh }
  }
  if (l.kind !== 'cont') return null
  const t = tileAt(w, l.pos)
  const [gw, gh] = terrainAt(w, l.pos).lootGrid ?? [6, 4]
  t.cont ??= { items: [], opened: true, kind: terrainAt(w, l.pos).id }
  return { items: t.cont.items, w: gw, h: gh }
}

/** 시체의 장착 장비 (벗기기 = 그 장비 탈 턴) */
export function lootEquip(w: World): Creature | undefined {
  const l = w.s.loot
  return l?.kind === 'corpse' ? w.s.creatures.find((x) => x.id === l.id) : undefined
}

/** 현재 루팅 대상의 아이템 목록 */
export function lootItems(w: World): ItemInst[] | null {
  const l = w.s.loot
  if (!l) return null
  if (l.kind === 'floor') return tileAt(w, l.pos).items
  const g = lootGrid(w)
  if (!g) return null
  const o = lootEquip(w)
  return o ? [...g.items, ...Object.values(o.equip).filter((i): i is ItemInst => !!i)] : g.items
}

/** 루팅 대상에서 아이템 하나 꺼내기 (시체 장비면 벗긴다) */
function lootRemove(w: World, uid: number): ItemInst | undefined {
  const g = lootGrid(w)
  const l = w.s.loot
  if (l?.kind === 'floor') {
    const t = tileAt(w, l.pos)
    const it = t.items.find((i) => i.uid === uid)
    if (it) t.items = t.items.filter((i) => i !== it)
    return it
  }
  if (!g) return undefined
  const i = g.items.findIndex((x) => x.uid === uid)
  if (i >= 0) return g.items.splice(i, 1)[0]
  const o = lootEquip(w)
  if (o) for (const k of Object.keys(o.equip) as Slot[]) if (o.equip[k]?.uid === uid) { const it = o.equip[k]!; delete o.equip[k]; return it }
  return undefined
}

export function perform(w: World, c: Creature, a: Action): ActResult {
  const turn = turnOf(w)
  const r = rng(w, 'ai')
  switch (a.type) {
    case 'wait':
      c.rested = true
      return { ok: true, tu: 100 }

    case 'move': {
      const d = DIRS[a.dir]
      if (!d) return FAIL('방향 오류')
      const to = { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (!inBounds(w, to)) return FAIL(isPl(c) ? '더 갈 수 없다.' : '경계')
      const other = creatureAt(w, to)
      if (other) {
        if (hostile(c, other) && other.ai.mode !== 'surrender') return perform(w, c, { type: 'attack', target: other.id })
        if (other.ai.mode === 'surrender' && isPl(c)) return FAIL(`${other.name}은(는) 항복했다.`)
        return FAIL('길이 막혔다')
      }
      const terr = terrainAt(w, to)
      if (terr.door === 'closed') {
        tileAt(w, to).t = 'Terrain.DoorOpen'
        invalidateLights(w)
        emitNoise(w, to, c.sneaking ? 2 : 4, c.id)
        if (isPl(c)) log(w, 'info', '문을 열었다. 녹슨 경첩이 삐걱인다.')
        c.facing = a.dir
        return { ok: true, tu: 100 }
      }
      if (!terr.passable) return FAIL(`${terr.label}에 막혔다`)
      if (diagonalBlocked(w, c.pos, d.x, d.y)) return FAIL('모서리에 끼어 지나갈 수 없다')
      // 비틀거림 (01 §5.2): 다리 상태 + 지형 + 몸, 상한 60%. 양다리 불구면 기어간다(2턴, 판정 없음)
      const sp = stumbleChance(w, c, to)
      if (sp > 0 && r.chance(sp / 100)) {
        fx(w, { k: 'status', id: c.id, text: '휘청', color: '#e0b070', turn })
        if (isPl(c)) log(w, 'warn', `발이 꺾여 휘청였다. (비틀거림 ${sp}%)`)
        return { ok: true, tu: 100 }
      }
      const tu = moveTU(w, c, to)
      const from = { ...c.pos }
      c.pos = to
      c.facing = a.dir
      c.movedTurn = turn
      fx(w, { k: 'move', id: c.id, from, to, turn })
      // 걷기 소음: 맨몸 2와 입은 옷 중 가장 큰 값 하나 (13 §6.2)
      let noise = 2
      for (const it of Object.values(c.equip)) if (it) noise = Math.max(noise, itemDef(w, it).apparel?.noise ?? 0)
      noise *= terr.noiseMult ?? 1
      noise *= traitMul(w, c, 'noiseMult') * (c.sneaking ? 0.3 : 1)
      if (noise >= 2.5) emitNoise(w, to, Math.round(noise), c.id)
      worsenFractures(w, c, 'leg')
      spearWallReact(w, c)
      if (isPl(c)) {
        const t = tileAt(w, to)
        if (t.items.length) log(w, 'info', `여기에: ${t.items.map((i) => itemLabel(w, i)).join(', ')} (G 줍기 · 클릭으로 루팅 창)`)
        if (terr.stairs) log(w, 'info', terr.stairs === 'down' ? '내려가는 계단이다. (> 내려가기)' : '올라가는 계단이다. (< 올라가기)')
        w.s.loot = undefined
      }
      return { ok: true, tu }
    }

    case 'attack': {
      const t = creatureById(w, a.target)
      if (!t || !t.alive) return FAIL('대상이 없다')
      const wl = meleeWield(w, c)
      if (!wl) return FAIL('두 팔을 다 쓸 수 없다')
      if (!canReach(w, c, t)) return FAIL('닿지 않는다')
      if (wl.atk.requiresCapacity && capacity(w, c, wl.atk.requiresCapacity) < 0.1) return FAIL('공격할 수 없는 상태다')
      if (c.needs.energy < wl.atk.energy && isPl(c)) log(w, 'warn', '기력이 바닥났다. 공격이 무디다.')
      if (t.ai.mode === 'surrender' && isPl(c)) c.history.push({ turn, kind: 'execute', text: `항복한 ${t.name}을(를) 공격` })
      resolveAttack(w, c, t)
      worsenFractures(w, c, wl.arm === 'larm' ? 'larm' : 'rarm')
      return { ok: true, tu: 100 }
    }

    case 'shoot': {
      const t = creatureById(w, a.target)
      const wl = wield(w, c)
      const mw = wl?.item
      if (!mw || !itemDef(w, mw).ranged) return FAIL(c.equip.main && itemDef(w, c.equip.main).ranged ? '활을 쥘 팔을 쓸 수 없다' : '원거리 무기가 없다')
      if (!t || !t.alive) return FAIL('대상이 없다')
      const rd = itemDef(w, mw).ranged!
      if (cheb(c.pos, t.pos) > rd.range) return FAIL('사거리 밖이다')
      if (!hasLos(w, c.pos, t.pos)) return FAIL('시야가 막혔다')
      const ammo = c.bag.find((i) => i.def === rd.ammo)
      if (!ammo) return FAIL('화살이 없다')
      if (capacity(w, c, 'manipulation') < 0.5) return FAIL('손이 성치 않아 시위를 당길 수 없다')
      removeOne(w, c, ammo.uid)
      const res = resolveAttack(w, c, t, { ranged: true })
      recoverArrow(w, c, t, res.hit)
      return { ok: true, tu: 100 }
    }

    case 'shove': {
      // 밀치기 (07 §7.2): 1턴, 기력 10. 성공하면 1칸, 벽이면 타격 5 + 넘어짐 25%
      const d = DIRS[a.dir]
      const t = d ? creatureAt(w, { x: c.pos.x + d.x, y: c.pos.y + d.y }) : undefined
      if (!t || !t.alive) return FAIL('밀칠 상대가 없다')
      if (c.needs.energy < 10) return FAIL('기력이 부족하다')
      c.needs.energy -= 10
      c.exerted = true
      c.facing = a.dir
      const ch = shoveChance(w, c, t)
      const roll = rng(w, 'combat').int(0, 99)
      const ok = roll < ch && w.db.creature(t.def).sizeClass !== 'huge'
      if (isPl(c) || isPl(t)) log(w, 'combat', `${isPl(c) ? '당신' : c.name}이(가) ${isPl(t) ? '당신' : t.name}을(를) 밀쳤다 — ${ok ? '밀려났다' : '버텼다'}.`, [`밀치기 ${ch}% (roll ${roll})`])
      t.ai.alertTurn = turn
      if (ok) pushBack(w, c, t, 1)
      return { ok: true, tu: 100 }
    }

    case 'face':
      c.facing = a.dir
      return { ok: true, tu: 100 }

    case 'examineSelf':
      // 자기 몸 살피기 (01 §4.1): 상처 상세·동맥·내출혈 징후 공개
      c.examinedAt = turn
      if (isPl(c)) log(w, 'info', '옷을 걷고 몸을 살핀다. (상처 창에 동맥·내출혈 징후가 표시된다)')
      return { ok: true, tu: 100 }

    case 'closeDoor': {
      const d = DIRS[a.dir]
      const p = d && { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (!p || !inBounds(w, p) || terrainAt(w, p).door !== 'open') return FAIL('닫을 문이 없다')
      if (creatureAt(w, p) || tileAt(w, p).items.length) return FAIL('문틀이 막혀 있다')
      tileAt(w, p).t = 'Terrain.DoorClosed'
      invalidateLights(w)
      emitNoise(w, p, c.sneaking ? 2 : 4, c.id)
      if (isPl(c)) log(w, 'info', '문을 닫았다.')
      return { ok: true, tu: 100 }
    }

    case 'attackMode': {
      // 공격 방식 바꾸기 (베기 ↔ 찌르기) = 자유 행동
      const wl = wield(w, c)
      const list = wl?.item ? itemDef(w, wl.item).attacks ?? [] : []
      if (list.length < 2) return FAIL('이 무기는 공격 방식이 하나뿐이다')
      if (c.freeActTurn === turn) return FAIL('자유 행동은 턴당 한 번')
      c.freeActTurn = turn
      const i = list.findIndex((x) => x.id === wl!.atk.id)
      c.attackMode = list[(i + 1) % list.length].id
      if (isPl(c)) log(w, 'info', `공격 방식: ${list[(i + 1) % list.length].label}`)
      return FREE
    }

    case 'ability': return useAbility(w, c, a.id, a.target)

    case 'rest':
      c.activity = { kind: 'rest', remaining: a.turns, label: '휴식' }
      return { ok: true, tu: 0 }

    case 'sleep': {
      const why = sleepingBlocked(w, c)
      if (why) return FAIL(`잠들 수 없다: ${why}`)
      if (c.needs.fatigue < 15) return FAIL('졸리지 않다')
      if (c.needs.bodyTemp < 35) return FAIL('너무 추워 잠들 수 없다. 몸부터 녹여야 한다')
      c.activity = { kind: 'sleep', remaining: 9600, label: '수면' }
      if (isPl(c)) log(w, 'info', '눈을 감는다…')
      return { ok: true, tu: 0 }
    }

    case 'pickup': {
      const t = tileAt(w, c.pos)
      if (!t.items.length) return FAIL('주울 것이 없다')
      const items = a.uid !== undefined ? t.items.filter((i) => i.uid === a.uid) : [...t.items]
      const got: string[] = []
      let full = false
      for (const it of items) {
        const label = itemLabel(w, it)
        const left = addToBag(w, c, { ...it })
        if (left === 0) { t.items = t.items.filter((i) => i.uid !== it.uid); got.push(label) }
        else { full = true; it.count = left }
      }
      if (isPl(c)) {
        if (got.length) log(w, 'info', `주웠다: ${got.join(', ')}`)
        if (full) log(w, 'warn', '배낭에 자리가 없다. 정리하거나 버려야 한다.')
      }
      return got.length ? { ok: true, tu: hostileAware(w, c) ? 100 : 0 } : FAIL('배낭에 자리가 없다')
    }

    case 'drop': {
      // 떨구기 = 자유 행동 (0턴, 턴당 1회)
      if (c.freeActTurn === turn) return FAIL('자유 행동은 턴당 한 번')
      const it = removeStack(c, a.uid)
      if (!it) return FAIL('없다')
      c.freeActTurn = turn
      tileAt(w, c.pos).items.push(it)
      return FREE
    }

    case 'equip': {
      const it = findItem(c, a.uid)
      if (!it) return FAIL('없다')
      const def = itemDef(w, it)
      if (def.light && !def.slot) return perform(w, c, { type: 'toggleLight', uid: a.uid })
      // 착용 턴 (13 §6.1). 반쯤 걸친 옷은 남은 절반만
      const base = def.equipTurns?.[0] ?? 1
      const turns = Math.ceil((it.half ? base / 2 : base) * multiTurnFactor(w, c))
      if (turns <= 1) {
        const err = equip(w, c, a.uid, a.slot)
        if (err) return FAIL(err)
        it.half = undefined
        if (isPl(c)) log(w, 'info', `${def.label}을(를) ${def.apparel ? '입었다' : '들었다'}.`)
        return { ok: true, tu: 100 }
      }
      c.activity = { kind: 'equip', remaining: turns, uid: a.uid, slot: a.slot, label: `${def.label} 입기` }
      return { ok: true, tu: 0 }
    }

    case 'unequip': {
      const it = c.equip[a.slot]
      if (!it) return FAIL('비어 있다')
      const def = itemDef(w, it)
      const turns = Math.ceil((def.equipTurns?.[1] ?? 1) * multiTurnFactor(w, c))
      if (turns <= 1) {
        const err = unequip(w, c, a.slot)
        if (err) return FAIL(err)
        it.half = undefined
        return { ok: true, tu: 100 }
      }
      c.activity = { kind: 'unequip', remaining: turns, slot: a.slot, uid: it.uid, label: `${def.label} 벗기` }
      return { ok: true, tu: 0 }
    }

    case 'moveItem':
      return moveInBag(w, c, a.uid, a.gx, a.gy, a.rot) ? FREE : FAIL('그 자리에 들어가지 않는다')

    case 'search': {
      // 시체 먼저 (첫 수색 2턴, 소음 2), 그다음 아직 안 뒤진 용기 → 이미 연 용기 (13 §8.1)
      const corpse = adjacentCorpse(w, c)
      if (corpse && !adjacentContainer(w, c)) {
        if (corpse.searched) { w.s.loot = { pos: { ...corpse.pos }, kind: 'corpse', id: corpse.id }; return FREE }
        const n = channelTurns(w, c, searchBase(w, c, 2))
        if (n === null) return FAIL('손이 말을 듣지 않는다')
        c.activity = { kind: 'search', remaining: n, total: n, target: { ...corpse.pos }, uid: corpse.id, label: `${corpse.name}의 시체 뒤지기` }
        return { ok: true, tu: 0 }
      }
      const p = adjacentContainer(w, c) ?? adjacentContainer(w, c, true)
      if (!p) return FAIL('뒤질 만한 것이 없다')
      const t = tileAt(w, p)
      const terr = terrainAt(w, p)
      if (t.searched && t.cont) {
        w.s.loot = { pos: p, kind: 'cont' }
        return FREE
      }
      if ((terr.openTurns ?? 1) === 0) {
        openContainer(w, c, p)
        return FREE
      }
      const n = channelTurns(w, c, searchBase(w, c, terr.openTurns ?? 1))
      if (n === null) return FAIL('손이 말을 듣지 않는다')
      c.activity = { kind: 'search', remaining: n, total: n, target: p, label: `${terr.label} 열기` }
      return { ok: true, tu: 0 }
    }

    case 'lootTake': {
      const list = lootItems(w)
      const it = list?.find((i) => i.uid === a.uid)
      if (!list || !it) return FAIL('없다')
      // 시체가 입은 장비는 벗기는 데 그 장비의 탈 턴이 든다 (13 §8.1)
      const o = lootEquip(w)
      if (o && Object.values(o.equip).some((e) => e?.uid === it.uid)) {
        if (!findSpot(w, c, itemDef(w, it))) return FAIL('배낭에 자리가 없다')
        const n = channelTurns(w, c, itemDef(w, it).equipTurns?.[1] ?? 1, { equip: true })
        if (n === null) return FAIL('손이 말을 듣지 않는다')
        c.activity = { kind: 'strip', remaining: n, total: n, uid: it.uid, label: `${itemDef(w, it).label} 벗겨 내기` }
        return { ok: true, tu: 0 }
      }
      const left = addToBag(w, c, { ...it, gx: undefined, gy: undefined, rot: undefined })
      if (left === it.count) return FAIL('배낭에 자리가 없다')
      if (left === 0) lootRemove(w, it.uid)
      else it.count = left
      // 꺼내기·옮기기 0턴, 적이 나를 알아챈 동안은 1회당 1턴 (13 §8.3)
      return { ok: true, tu: hostileAware(w, c) ? 100 : 0 }
    }

    case 'lootAll': {
      // 모두 가져가기 = 자동 정렬 순서로 들어가는 것만, 장착 장비는 빼고 (13 §8.2)
      const g = lootGrid(w)
      const list = g ? g.items : w.s.loot?.kind === 'floor' ? tileAt(w, w.s.loot.pos).items : null
      if (!list || !list.length) return FAIL('가져갈 것이 없다')
      let took = 0
      for (const it of sortForPacking(w, [...list])) {
        const left = addToBag(w, c, { ...it, gx: undefined, gy: undefined, rot: undefined })
        if (left === 0) { lootRemove(w, it.uid); took++ }
        else it.count = left
      }
      if (!took) return FAIL('배낭에 자리가 없다')
      if (list.length && isPl(c)) log(w, 'warn', '배낭이 가득 차 다 가져가지 못했다.')
      return { ok: true, tu: hostileAware(w, c) ? 100 : 0 }
    }

    case 'lootPut': {
      const g = lootGrid(w)
      const held = findItem(c, a.uid)
      if (!held) return FAIL('없다')
      if (w.s.loot?.kind === 'floor' || !g) {
        if (!w.s.loot) return FAIL('넣을 곳이 없다')
        const it = removeStack(c, a.uid)!
        tileAt(w, w.s.loot.pos).items.push(it)
        return FREE
      }
      const def = itemDef(w, held)
      const rot = a.rot ?? false
      if (a.gx !== undefined && a.gy !== undefined) {
        if (!gridFits(w, g, def, a.gx, a.gy, undefined, rot)) return FAIL('그 자리에 들어가지 않는다')
        const it = removeStack(c, a.uid)!
        Object.assign(it, { gx: a.gx, gy: a.gy, rot: rot || undefined })
        g.items.push(it)
        return FREE
      }
      if (!gridSpot(w, g, def)) return FAIL('자리가 없다')
      const it = removeStack(c, a.uid)!
      gridAdd(w, g, { ...it, gx: undefined, gy: undefined })
      return FREE
    }

    case 'lootMove': {
      const g = lootGrid(w)
      const it = g?.items.find((i) => i.uid === a.uid)
      if (!g || !it) return FAIL('없다')
      const r0 = a.rot ?? !!it.rot
      if (!gridFits(w, g, itemDef(w, it), a.gx, a.gy, it.uid, r0)) return FAIL('그 자리에 들어가지 않는다')
      Object.assign(it, { gx: a.gx, gy: a.gy, rot: r0 || undefined })
      return FREE
    }

    case 'lootClose':
      w.s.loot = undefined
      return FREE

    case 'treat': return treat(w, c, a.uid, a.woundId, a.limb)

    case 'consume': return consume(w, c, a.uid)

    case 'press': {
      const wd = c.body.wounds.find((x) => x.id === a.woundId)
      if (!wd) return FAIL('상처가 없다')
      if (wd.internal) return FAIL('몸속 출혈은 누를 수 없다')
      if (capacity(w, c, 'manipulation') < 0.2) return FAIL('손을 쓸 수 없다')
      // 손 압박: 1턴 행동, 유지하는 동안 매 턴 (02 §12.2)
      c.body.pressing = wd.id
      c.activity = { kind: 'press', remaining: 20, woundId: wd.id, label: '상처 압박' }
      return { ok: true, tu: 100 }
    }

    case 'cauterize': {
      const wd = c.body.wounds.find((x) => x.id === a.woundId)
      if (!wd) return FAIL('상처가 없다')
      const lamp = allLit(w, c)
      const fire = [{ x: 0, y: 0 }, ...DIRS].some((d) => {
        const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
        return inBounds(w, p) && (terrainAt(w, p).id === 'Terrain.Brazier' || terrainAt(w, p).id === 'Terrain.Campfire')
      })
      if (!lamp && !fire) return FAIL('불이 필요하다 (켜진 등불이나 곁의 화로)')
      if (!hasBlade(w, c)) return FAIL('달굴 칼날이 필요하다')
      if (wd.internal) return FAIL('몸속 출혈은 지질 수 없다')
      // 인두 가열 20턴(보존, 1분에 25% 식음) + 시술 1턴 (01 §4.2)
      const heat = c.heat && turn - c.heat.at < 20 + 20 ? c.heat.done : 0
      const n = channelTurns(w, c, 20 - heat)
      if (n === null) return FAIL('손이 말을 듣지 않아 할 수 없다')
      c.activity = { kind: 'treat', remaining: n + 1, woundId: wd.id, label: '칼날 달구기 → 소작', treat: 'cauterize', total: n + 1 }
      return { ok: true, tu: 0 }
    }

    case 'removeTourniquet': {
      if (c.body.tourniquets[a.limb] === undefined) return FAIL('지혈대가 없다')
      delete c.body.tourniquets[a.limb]
      addToInventory(w, c, makeItem(w, 'Item.Tourniquet'))
      // 재관류 통증 +10 (02 §12.2)
      addEffect(c, 'reperfusion', turn + 30)
      if (isPl(c)) log(w, 'info', '지혈대를 풀었다. 피가 다시 돌며 욱신거린다.')
      return { ok: true, tu: 100 }
    }

    case 'toggleLight': {
      const it = findItem(c, a.uid)
      if (!it || !itemDef(w, it).light) return FAIL('켤 수 없다')
      if (!it.lit && (it.fuel ?? 0) <= 0) return FAIL('기름이 없다')
      it.lit = !it.lit
      if (isPl(c)) log(w, 'info', it.lit ? '등불을 켰다. 주변이 밝아졌다. 멀리서도 보일 것이다.' : '등불을 껐다. 어둠이 내려앉는다.')
      return { ok: true, tu: 100 }
    }

    case 'examine': {
      const it = findItem(c, a.uid)
      if (!it) return FAIL('없다')
      const def = itemDef(w, it)
      if (!def.unidentified) return FAIL('살펴볼 필요가 없다')
      if (w.s.knowledge.pillKnown[it.def]) return FAIL('이미 아는 약이다')
      c.activity = { kind: 'examine', remaining: 30, uid: it.uid, label: `${def.label} 감별` }
      return { ok: true, tu: 0 }
    }

    case 'drinkHere': {
      const near = [{ x: 0, y: 0 }, ...DIRS].some((d) => {
        const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
        return inBounds(w, p) && terrainAt(w, p).water
      })
      if (!near) return FAIL('물이 없다')
      c.needs.water = Math.min(3000, c.needs.water + 300)
      dirtyWater(w, c)
      if (isPl(c)) log(w, 'info', '고인 물을 손으로 떠 마셨다. 쇠 맛과 재 맛이 난다.')
      return { ok: true, tu: 200 }
    }

    case 'fillBottle': {
      const it = findItem(c, a.uid)
      if (!it || !itemDef(w, it).drink) return FAIL('담을 병이 없다')
      const near = [{ x: 0, y: 0 }, ...DIRS].some((d) => {
        const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
        return inBounds(w, p) && terrainAt(w, p).water
      })
      if (!near) return FAIL('물이 없다')
      it.def = 'Item.DirtyWaterBottle'
      it.uses = 5 // 1,000ml = 200ml × 5 (13 §4)
      if (isPl(c)) log(w, 'info', '흐린 물을 병에 채웠다.')
      return { ok: true, tu: 150 }
    }

    case 'throw': {
      const it = removeOne(w, c, a.uid)
      if (!it) return FAIL('없다')
      if (cheb(c.pos, a.target) > 6 || !hasLos(w, c.pos, a.target)) {
        addToInventory(w, c, it)
        return FAIL('너무 멀거나 보이지 않는다')
      }
      const t = inBounds(w, a.target) && terrainAt(w, a.target).passable ? a.target : c.pos
      tileAt(w, t).items.push(it)
      emitNoise(w, t, 3, c.id)
      if (isPl(c)) log(w, 'info', `${itemDef(w, it).label}을(를) 던졌다.`)
      return { ok: true, tu: 100 }
    }

    case 'eatFloor': {
      const t = tileAt(w, c.pos)
      const food = t.items.find((i) => itemDef(w, i).food?.raw)
      if (!food) return FAIL('먹을 것이 없다')
      if (food.count > 1) food.count--
      else t.items = t.items.filter((i) => i !== food)
      c.ai.hunger = Math.max(0, c.ai.hunger - 0.35)
      c.ai.morale = Math.min(w.db.creature(c.def).morale, c.ai.morale + 10)
      return { ok: true, tu: 400 }
    }

    case 'stairs': {
      const terr = terrainAt(w, c.pos)
      if (!terr.stairs) return FAIL('계단 위에 있어야 한다')
      const link = w.s.map.links.find((l) => eq(l.pos, c.pos))
      if (!link) return FAIL('막혀 있다')
      return { ok: true, tu: 100, msg: 'stairs' }
    }

    case 'spendStat': {
      const err = spendStat(c, a.stat)
      return err ? FAIL(err) : FREE
    }

    case 'learn': {
      const err = learnAbility(w, c, a.id)
      return err ? FAIL(err) : FREE
    }

    case 'hotbar': {
      if (a.index < 0 || a.index >= c.hotbar.length) return FAIL('칸 오류')
      c.hotbar[a.index] = a.ref
      return FREE
    }

    case 'leave': {
      if (!w.s.map.exits.some((e) => eq(e, c.pos))) return FAIL('여기서는 떠날 수 없다. 남쪽 길 끝으로 가야 한다.')
      return { ok: true, tu: 100, msg: 'leave' }
    }
  }
}

function dirtyWater(w: World, c: Creature) {
  const r = rng(w, 'body')
  if (traitOverride(w, c, 'foodPoisonImmune')) return
  if (r.chance(0.18)) {
    addEffect(c, 'dysentery', turnOf(w) + TURNS_PER_DAY)
    if (isPl(c)) log(w, 'danger', '배가 뒤틀린다. 이질이다. 물을 평소보다 훨씬 많이 잃게 된다.')
    c.history.push({ turn: turnOf(w), kind: 'disease', text: '흐린 물을 마시고 이질에 걸림' })
  }
}

/** 처치 기본 턴 (01 §4.2): 지혈대 3 · 붕대 사지 5 / 몸통·머리 6 · 부목 10 · 세척 3. 응급 처치 ×0.6, 의료 숙달 5단계 ×0.9 */
function treatBase(w: World, c: Creature, kind: string, wd?: Wound): number {
  let base = kind === 'tourniquet' ? 3 : kind === 'splint' ? 10 : kind === 'disinfect' ? 3 : 5
  if (kind === 'bandage' && wd) {
    const reg = tryPart(w, c, wd.part)?.region
    if (reg === 'torso' || reg === 'head') base = 6
  }
  let f = 1 - Math.min(0.6, traitAdd(w, c, 'treatSpeed'))
  if (masteryStage(c, 'medicine') >= 5) f *= 0.9
  return Math.ceil(base * f - 1e-9)
}

/**
 * 처치 품질 Q (02 §12.1)
 * = clamp(5, 100, (40 + (지각 − 10) × 2 + 의료 숙달 × 4 + 도구 + 조명 + 청결 + 환경 − 통증 페널티) × 조작 × 자가계수)
 */
export function treatQuality(w: World, c: Creature, tool: number, wd?: Wound): { q: number; lines: string[] } {
  const lines: string[] = []
  let v = 40
  const add = (label: string, x: number) => { if (x) { v += x; lines.push(`${label} ${x > 0 ? '+' : ''}${x}`) } }
  add('지각', (c.stats.per - 10) * 2)
  add('의료 숙달', masteryStage(c, 'medicine') * 4)
  add('도구', tool)
  add('조명', [0, -5, -15, -30][lightLevel(w, c.pos)])
  if (c.equip.hands) add('장갑', -5)
  if (tileAt(w, c.pos).roof) add('실내', 5)
  if (w.s.map.kind === 'surface' && w.s.weather === 'ashrain' && !tileAt(w, c.pos).roof) add('재비', -5)
  if (terrainAt(w, c.pos).id.includes('Mud')) add('진흙', -5)
  if (hostileAware(w, c)) add('적대 인식', -15)
  add('통증', -Math.floor(Math.max(0, painTotal(w, c) - 30) * 0.3))
  const manip = capacity(w, c, 'manipulation')
  const reg = wd ? tryPart(w, c, wd.part)?.region : undefined
  const self = reg === 'rarm' || reg === 'larm' ? 0.7 : 0.85
  const q = clamp(Math.round(v * Math.min(1, manip) * self), 5, 100)
  lines.push(`× 조작 ${manip.toFixed(2)} × 자가 ${self} = Q ${q}`)
  return { q, lines }
}

function treat(w: World, c: Creature, uid: number, woundId?: number, limb?: string): ActResult {
  const it = findItem(c, uid)
  if (!it) return FAIL('없다')
  const def = itemDef(w, it)
  const med = def.medical
  if (!med) return FAIL('치료 도구가 아니다')
  const wd: Wound | undefined = woundId !== undefined ? c.body.wounds.find((x) => x.id === woundId) : undefined
  let lb = limb
  switch (med.kind) {
    case 'bandage':
      if (!wd) return FAIL('상처를 골라야 한다')
      if (wd.internal) return FAIL('몸속 상처는 붕대로 막을 수 없다')
      if (wd.bandage && !wd.bandage.dirty && !med.dirty && turnOf(w) - wd.bandage.at < TURNS_PER_DAY) return FAIL('이미 붕대가 감겨 있다')
      break
    case 'tourniquet':
      if (!lb && wd) lb = tryPart(w, c, wd.part)?.limb
      if (!lb) return FAIL('지혈대는 팔이나 다리에만 감을 수 있다')
      if (c.body.tourniquets[lb] !== undefined) return FAIL('이미 감겨 있다')
      if (isMissing(w, c, lb)) return FAIL('그 팔다리는 이미 없다')
      break
    case 'splint': {
      const target = wd ?? c.body.wounds.find((x) => x.fracture && !x.splint)
      if (!target?.fracture) return FAIL('부러진 곳이 없다')
      if (target.splint && !target.splint.half) return FAIL('이미 부목을 댔다')
      if (target.part === 'Chest') return FAIL('갈비뼈에는 부목을 댈 수 없다. 압박 붕대만 감을 수 있다')
      woundId = target.id
      break
    }
    case 'disinfect':
      if (!wd) return FAIL('상처를 골라야 한다')
      if (wd.internal) return FAIL('몸속 상처는 씻을 수 없다')
      break
  }
  const target = woundId !== undefined ? c.body.wounds.find((x) => x.id === woundId) : undefined
  const n = channelTurns(w, c, treatBase(w, c, med.kind, target))
  if (n === null) return FAIL('손이 말을 듣지 않아 처치할 수 없다 (다턴 배율 ×4 초과)')
  c.activity = { kind: 'treat', treat: med.kind, remaining: n, total: n, uid, woundId, limb: lb, label: `${def.label} — ${med.kind === 'tourniquet' ? '지혈대 감기' : med.kind === 'splint' ? '부목 대기' : med.kind === 'disinfect' ? '상처 씻기' : '붕대 감기'}` }
  if (isPl(c)) log(w, 'info', `${c.activity.label} (${n}턴)`)
  return { ok: true, tu: 0 }
}

/** 채널이 끝났을 때 처치 효과 (02 §12.2) */
function finishTreat(w: World, c: Creature, act: Activity, half = false) {
  const turn = turnOf(w)
  const wd = act.woundId !== undefined ? c.body.wounds.find((x) => x.id === act.woundId) : undefined
  if (act.treat === 'cauterize') {
    if (!wd) return
    cauterize(w, c, wd)
    return
  }
  const it = act.uid !== undefined ? findItem(c, act.uid) : undefined
  if (!it) return
  const def = itemDef(w, it)
  const med = def.medical!
  const { q, lines } = treatQuality(w, c, med.tool ?? 0, wd)
  switch (act.treat) {
    case 'bandage': {
      if (!wd) return
      wd.bandage = { quality: q, at: turn, dirty: med.dirty, firstAid: traitAdd(w, c, 'bandageBonus') || undefined }
      if (med.dirty) wd.contam = Math.min(100, wd.contam + 10)
      removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `wound:${wd.id}`)
      fx(w, { k: 'status', id: c.id, text: '붕대', color: '#e8e0c8', turn })
      if (isPl(c)) {
        const coef = bandageCoef(q, false, wd.bandage.firstAid)
        let msg = `${part(w, c, wd.part).label}의 ${woundDef(w, wd).label}에 ${def.label}을(를) 감았다. (Q ${q} → 출혈 ×${coef.toFixed(2)})`
        if (wd.arterial) msg += ' 하지만 동맥 출혈은 붕대로는 멈추지 않는다. 지혈대나 소작이 필요하다.'
        log(w, wd.arterial ? 'warn' : 'info', msg, lines)
        c.history.push({ turn, kind: 'treat', text: `${part(w, c, wd.part).label} 붕대 (Q ${q})` })
      }
      return
    }
    case 'tourniquet': {
      const lb = act.limb
      if (!lb) return
      c.body.tourniquets[lb] = turn
      removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `limb:${lb}`)
      if (isPl(c)) log(w, 'info', `${part(w, c, lb).label}에 지혈대를 단단히 감았다. 아래로는 피가 돌지 않는다. 두 시간 안에 풀어야 한다.`)
      return
    }
    case 'splint': {
      if (!wd?.fracture) return
      wd.splint = { quality: q, half: half || undefined }
      removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `wound:${wd.id}`)
      if (isPl(c)) log(w, 'info', half ? `${part(w, c, wd.part).label}에 부목을 반만 묶었다. 효과가 절반이다.` : `${part(w, c, wd.part).label}에 부목을 댔다. (Q ${q})`, lines)
      return
    }
    case 'disinfect': {
      if (!wd) return
      wd.contam = Math.round(wd.contam * (med.washMult ?? 0.75))
      addEffect(c, 'sting', turn + 20)
      it.uses = (it.uses ?? 1) - 1
      if ((it.uses ?? 0) <= 0) removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `wound:${wd.id}`)
      if (isPl(c)) log(w, 'info', `${part(w, c, wd.part).label}의 상처를 술로 씻었다. 타는 듯이 쓰라리다. (오염 ${wd.contam})`)
      return
    }
  }
}

/** 소작 (02 §12.2): 출혈 즉시 0, 오염 5, 화상(sev × 0.5), 통증 스파이크 +45. 대퇴·경동맥은 성공률 40 + Q/2 % */
function cauterize(w: World, c: Creature, wd: Wound) {
  const turn = turnOf(w)
  const r = rng(w, 'body')
  const { q } = treatQuality(w, c, 0, wd)
  const big = (wd.artery ?? 0) >= 150
  const ok = !big || r.int(0, 99) < 40 + Math.floor(q / 2)
  if (ok) {
    wd.cauterized = true
    wd.bleed = 0
    wd.artery = undefined
    wd.contam = 5
    wd.infectionChecked = true
  }
  c.body.wounds.push({
    id: w.s.nextId++, def: 'Wound.Burn', part: wd.part, severity: Math.max(1, Math.ceil(wd.severity * 0.5)), healed: 0, bleed: 0, arterial: false,
    internal: false, contam: 5, ageTurns: 0, source: '소작', scar: true, infectionChecked: true,
  })
  c.heat = undefined
  emitNoise(w, c.pos, 12, c.id)
  addThought(w, c, 'Thought.Cauterized')
  practice(w, c, 'medicine', `wound:${wd.id}`)
  fx(w, { k: 'status', id: c.id, text: '지글…', color: '#ff9040', turn })
  if (isPl(c)) {
    log(w, ok ? 'warn' : 'danger', ok
      ? `달군 칼날을 ${part(w, c, wd.part).label}에 댄다. 살 타는 냄새. 비명이 새어 나온다. 출혈은 멎었다.`
      : `달군 칼날을 댔지만 굵은 동맥은 지져지지 않았다. 피가 계속 뿜어져 나온다. (성공률 ${40 + Math.floor(q / 2)}%)`)
    c.history.push({ turn, kind: 'treat', text: `${part(w, c, wd.part).label} 소작${ok ? '' : ' (실패)'}` })
  }
  painSpike(w, c, 45)
}

/** 처치 채널이 끊겼을 때 (01 §7): 부목은 절반 이상 묶었으면 반쪽 부목, 소작은 가열 보존 */
export function interruptTreat(w: World, c: Creature) {
  const act = c.activity
  if (act?.kind !== 'treat') return
  const done = (act.total ?? 0) - act.remaining
  if (act.treat === 'splint' && done * 2 >= (act.total ?? 0)) finishTreat(w, c, act, true)
  if (act.treat === 'cauterize') c.heat = { done: Math.min(20, done), at: turnOf(w) }
}

/** 부목 없는 골절에 하중: 금→단순 3%, 단순→복합 2%, 통증 +5 (02 §9) */
function worsenFractures(w: World, c: Creature, where: 'leg' | 'larm' | 'rarm') {
  const r = rng(w, 'body')
  for (const wd of c.body.wounds) {
    if (!wd.fracture || wd.splint || wd.fracture.progress >= 1) continue
    const reg = tryPart(w, c, wd.part)?.region
    if (where === 'leg' ? reg !== 'lleg' && reg !== 'rleg' : reg !== where) continue
    const g = wd.fracture.grade
    if (g === 'hairline' && r.int(0, 99) < 3) wd.fracture.grade = 'simple'
    else if (g === 'simple' && r.int(0, 99) < 2) { wd.fracture.grade = 'compound'; wd.bleed += wd.severity; wd.contam = Math.min(100, wd.contam + 30) }
    else continue
    if (isPl(c)) log(w, 'warn', `부러진 ${part(w, c, wd.part).label}에 힘을 싣자 뼈가 더 어긋난다. 부목이 필요하다.`)
  }
}

function allLit(w: World, c: Creature): ItemInst | undefined {
  return [...c.bag, ...Object.values(c.equip)].find((i): i is ItemInst => !!i && !!i.lit && (i.fuel ?? 0) > 0 && !!itemDef(w, i).light)
}

function consume(w: World, c: Creature, uid: number): ActResult {
  const it = findItem(c, uid)
  if (!it) return FAIL('없다')
  const def = itemDef(w, it)
  const turn = turnOf(w)
  const r = rng(w, 'body')
  if (def.food) {
    // 먹기(간식 1개) 1턴 (01 §4.1). 통조림 따기 2턴, 칼이 없으면 12턴
    let tu = 100
    if (def.food.needsTool === 'blade') tu = 300
    if (def.food.needsTool === 'blade' && !hasBlade(w, c)) {
      tu = 1200
      if (isPl(c)) log(w, 'info', '칼이 없어 돌로 통조림을 한참 두드려 땄다.')
    }
    if (capacity(w, c, 'manipulation') < 0.2) return FAIL('손을 쓸 수 없다')
    c.needs.kcal = Math.min(3200, c.needs.kcal + def.food.kcal)
    c.needs.vitamin = Math.min(100, c.needs.vitamin + (def.food.vitamin ?? 0))
    c.needs.water += def.food.water ?? 0
    if (def.food.raw) {
      addThought(w, c, 'Thought.AteRaw')
      if (!traitOverride(w, c, 'foodPoisonImmune') && r.chance(0.25)) {
        addEffect(c, 'foodPoisoning', turn + 2400)
        c.needs.water -= 300
        c.needs.kcal -= 200
        addThought(w, c, 'Thought.Vomited')
        if (isPl(c)) log(w, 'danger', '속이 뒤집혀 토했다. 날고기가 탈이 났다.')
      }
    } else if (def.food.kcal >= 500) addThought(w, c, 'Thought.AteGood')
    removeOne(w, c, uid)
    if (isPl(c)) {
      log(w, 'info', `${def.label}을(를) 먹었다.`)
      c.history.push({ turn, kind: 'meal', text: def.label })
    }
    return { ok: true, tu }
  }
  if (def.drink) {
    if ((it.uses ?? 1) <= 0) return FAIL('비어 있다')
    c.needs.water = Math.min(3000, c.needs.water + def.drink.water)
    if (def.drink.dirty) dirtyWater(w, c)
    if (def.drink.alcohol) {
      addEffect(c, 'alcohol', turn + 2400)
      addEffect(c, 'drankRecently', turn + TURNS_PER_DAY)
      c.effects = c.effects.filter((e) => e.kind !== 'withdrawal')
      addThought(w, c, 'Thought.Drunk')
    }
    it.uses = (it.uses ?? 1) - 1
    if (it.uses <= 0) {
      if (def.id === 'Item.WaterBottle' || def.id === 'Item.DirtyWaterBottle') {
        it.def = 'Item.WaterBottle'
        it.uses = 0
        if (isPl(c)) log(w, 'info', '병이 비었다. 물가에서 다시 채울 수 있다.')
      } else removeOne(w, c, uid)
    }
    if (isPl(c)) log(w, 'info', `${def.label}을(를) 마셨다.${def.drink.alcohol ? ' 목이 타고 통증이 무뎌진다.' : ''}`)
    return { ok: true, tu: 100 }
  }
  if (def.drug) {
    addEffect(c, def.drug.effect, turn + def.drug.durationTurns)
    removeOne(w, c, uid)
    if (isPl(c)) log(w, 'info', `${def.label}을(를) 삼켰다.`)
    fx(w, { k: 'status', id: c.id, text: def.label, color: '#a0d0a0', turn })
    return { ok: true, tu: 100 }
  }
  if (def.refuel) {
    const lamp = c.bag.find((i) => itemDef(w, i).light)
    if (!lamp) return FAIL('기름을 부을 등불이 없다')
    lamp.fuel = Math.min(itemDef(w, lamp).light!.fuelTurns, (lamp.fuel ?? 0) + def.refuel)
    removeOne(w, c, uid)
    if (isPl(c)) log(w, 'info', '등불에 기름을 부었다.')
    return { ok: true, tu: 100 }
  }
  if (def.unidentified) {
    const effId = w.s.knowledge.pillMap[def.id]
    const eff = w.db.pill(effId)
    applyPillEffect(w, c, eff.effect, eff.durationTurns)
    removeOne(w, c, uid)
    const known = !!w.s.knowledge.pillKnown[def.id]
    w.s.knowledge.pillKnown[def.id] = effId
    fx(w, { k: 'status', id: c.id, text: eff.label, color: '#c0a0e0', turn })
    if (isPl(c)) {
      log(w, known ? 'info' : 'good', `${def.label}을(를) 삼켰다. ${known ? '' : `— 이건 ${eff.label}이었다. (${eff.description})`}`)
      c.history.push({ turn, kind: 'pill', text: `${def.label} (${eff.label}) 복용` })
    }
    return { ok: true, tu: 100 }
  }
  return FAIL('먹거나 마실 수 없다')
}

export function applyPillEffect(w: World, c: Creature, effect: string, duration: number) {
  const turn = turnOf(w)
  switch (effect) {
    case 'painkiller': addEffect(c, 'analgesic', turn + duration); break
    case 'stimulant':
      addEffect(c, 'stimulant', turn + duration)
      c.needs.energy = energyMax(w, c)
      c.needs.fatigue = Math.max(0, c.needs.fatigue - 40)
      break
    case 'antibiotic': addEffect(c, 'antibiotic', turn + duration); break
    case 'sedative':
      addEffect(c, 'sedative', turn + duration)
      c.needs.stress = Math.max(0, c.needs.stress - 30)
      break
    case 'toxin':
      c.needs.water -= 400
      c.needs.kcal -= 300
      addThought(w, c, 'Thought.Vomited')
      if (isPl(c)) log(w, 'danger', '위가 뒤집힌다. 먹은 것을 전부 게워냈다.')
      break
    case 'vitamin': c.needs.vitamin = Math.min(100, c.needs.vitamin + 40); break
  }
}

/** 활동(장시간 행동) 한 턴 진행. 반환: 완료 여부 */
export function activityStep(w: World, c: Creature): boolean {
  const act = c.activity
  if (!act) return true
  act.remaining--
  act.elapsed = (act.elapsed ?? 0) + 1
  switch (act.kind) {
    case 'press': {
      const wd = c.body.wounds.find((x) => x.id === act.woundId)
      if (!wd || (wd.bleed <= 0 && !wd.artery)) { c.activity = undefined; return true }
      c.body.pressing = wd.id
      break
    }
    case 'treat':
      if (act.treat === 'cauterize' && act.remaining === 1 && isPl(c)) log(w, 'info', '칼날이 벌겋게 달았다.')
      if (act.remaining <= 0) finishTreat(w, c, act)
      break
    case 'aim':
      // 조준 사격 2턴째: 대상이 시야에 없으면 취소, 기력 절반 환급 (15 §17)
      if (act.remaining <= 0) {
        const t = creatureById(w, act.uid)
        const d = act.abilityId ? w.db.ability(act.abilityId) : undefined
        const rd = c.equip.main ? itemDef(w, c.equip.main).ranged : undefined
        if (!t || !t.alive || !d || !rd || cheb(c.pos, t.pos) > rd.range || !hasLos(w, c.pos, t.pos)) {
          if (d) c.needs.energy += Math.floor((d.energy ?? 0) / 2)
          if (isPl(c)) log(w, 'info', '겨누던 대상을 놓쳤다.')
        } else {
          c.facing = dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)
          abilityStrike(w, c, t, d, true)
        }
      }
      break
    case 'search':
      if (act.remaining <= 0 && act.target) {
        // 시체 첫 수색 (소음 2)
        const corpse = act.uid !== undefined ? w.s.creatures.find((o) => o.id === act.uid && !o.alive) : undefined
        if (corpse) {
          corpse.searched = true
          emitNoise(w, c.pos, 2, c.id)
          practice(w, c, 'survival', `corpse:${corpse.id}`)
          if (isPl(c)) w.s.loot = { pos: { ...corpse.pos }, kind: 'corpse', id: corpse.id }
          break
        }
        const t = tileAt(w, act.target)
        const terr = terrainAt(w, act.target)
        openContainer(w, c, act.target)
        practice(w, c, 'survival', `search:${act.target.x},${act.target.y}`)
        emitNoise(w, c.pos, terr.openNoise ?? 2, c.id)
        const n = t.cont?.items.length ?? 0
        fx(w, { k: 'status', id: c.id, text: n ? '발견!' : '빈 통', color: n ? '#e0c060' : '#a0a0a0', turn: turnOf(w) })
        if (isPl(c) && t.cont) log(w, n ? 'good' : 'info', n ? `${terr.label}에서 찾았다: ${t.cont.items.map((i) => itemLabel(w, i)).join(', ')}` : '아무것도 없다. 누군가 먼저 다녀갔다.')
      }
      break
    case 'strip':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const list = lootItems(w)
        const it = list?.find((i) => i.uid === act.uid)
        if (it && addToBag(w, c, { ...it, gx: undefined, gy: undefined, rot: undefined, half: undefined }) === 0) {
          lootRemove(w, it.uid)
          if (isPl(c)) log(w, 'info', `${itemDef(w, it).label}을(를) 벗겨 냈다.`)
        } else if (isPl(c)) log(w, 'warn', '벗겨 내지 못했다. (배낭에 자리가 없다)')
      }
      break
    case 'equip':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const it = findItem(c, act.uid)
        const err = it ? equip(w, c, act.uid, act.slot) : '없다'
        if (it && !err) {
          it.half = undefined
          if (isPl(c)) log(w, 'info', `${itemDef(w, it).label}을(를) 다 입었다.`)
        } else if (isPl(c)) log(w, 'warn', `입지 못했다: ${err}`)
      }
      break
    case 'unequip':
      if (act.remaining <= 0 && act.slot) {
        const it = c.equip[act.slot]
        const err = unequip(w, c, act.slot)
        if (it && !err) it.half = undefined
        if (err && isPl(c)) log(w, 'warn', `벗지 못했다: ${err}`)
      }
      break
    case 'examine':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const it = findItem(c, act.uid)
        if (it) {
          const r = rng(w, 'body')
          // 감별 (06): 감별치 = 지각 + 의료 숙달 × 5, 성공 = 50 + (감별치 − 난이도 25) × 3 %
          const ch = (50 + (c.stats.per + masteryStage(c, 'medicine') * 5 - 25) * 3) / 100
          if (r.chance(Math.min(0.9, ch))) {
            const eff = w.s.knowledge.pillMap[it.def]
            w.s.knowledge.pillKnown[it.def] = eff
            if (isPl(c)) log(w, 'good', `${itemDef(w, it).label}의 정체를 알아냈다: ${w.db.pill(eff).label}.`)
            practice(w, c, 'medicine', `pill:${it.def}`)
          } else if (isPl(c)) log(w, 'info', '냄새와 색만으로는 알 수 없었다.')
        }
      }
      break
  }
  if (act.remaining <= 0) {
    if (act.kind === 'sleep' && isPl(c)) log(w, 'info', '잠에서 깼다.')
    c.activity = undefined
    return true
  }
  return false
}

export function rollLoot(w: World, tableId: string): ItemInst[] {
  const r = rng(w, 'loot')
  const tbl = w.db.loot(tableId)
  const n = r.int(tbl.rolls[0], tbl.rolls[1])
  const out: ItemInst[] = []
  for (let i = 0; i < n; i++) {
    const e = r.weighted(tbl.entries, (x) => x.weight)
    if (!e) continue
    const count = e.count ? r.int(e.count[0], e.count[1]) : 1
    out.push(makeItem(w, e.item, count))
  }
  return out
}

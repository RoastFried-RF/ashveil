// 행동 실행. 플레이어와 NPC가 같은 함수를 쓴다 (규칙 대칭성).

import { capacity, isMissing, part, woundDef } from './body'
import { canReach, resolveAttack } from './combat'
import { creatureAt, creatureById, inBounds, log, rng, terrainAt, tileAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { cheb, DIRS, eq, type Pos } from './geom'
import { hasLos } from './fov'
import {
  addToInventory, carryCapacity, carriedWeight, encumbranceMult, equip, findItem, hasBlade, itemDef, itemLabel,
  mainWeapon, makeItem, removeOne, unequip,
} from './items'
import { addThought } from './needs'
import { diagonalBlocked } from './path'
import { emitNoise } from './perception'
import { gainXp, skillLevel } from './skills'
import { addEffect, traitMul, traitOverride } from './traits'
import type { Creature, ItemInst, Wound } from './types'

export type Action =
  | { type: 'move'; dir: number }
  | { type: 'attack'; target: number }
  | { type: 'shoot'; target: number }
  | { type: 'wait' }
  | { type: 'rest'; turns: number }
  | { type: 'sleep' }
  | { type: 'pickup'; uid?: number }
  | { type: 'drop'; uid: number }
  | { type: 'equip'; uid: number }
  | { type: 'unequip'; uid: number }
  | { type: 'search' }
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
  | { type: 'leave' }

export interface ActResult { ok: boolean; tu: number; msg?: string }

const FAIL = (msg: string): ActResult => ({ ok: false, tu: 0, msg })

function isPl(c: Creature) { return c.faction === 'player' }

export function moveTU(w: World, c: Creature, to: Pos): number {
  const cdef = w.db.creature(c.def)
  const terr = terrainAt(w, to)
  return Math.round(cdef.moveTU * terr.moveMult * encumbranceMult(w, c) / Math.max(0.15, capacity(w, c, 'moving')))
}

export function hostile(a: Creature, b: Creature): boolean {
  if (a.faction === b.faction) return false
  if (a.faction === 'player' || b.faction === 'player') return true
  if (a.faction === 'vermin' || b.faction === 'vermin') return false
  return true
}

/** 주변에 있는 수색 가능한 용기 */
export function adjacentContainer(w: World, c: Creature): Pos | undefined {
  for (const d of [{ x: 0, y: 0 }, ...DIRS]) {
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!inBounds(w, p)) continue
    const t = tileAt(w, p)
    if (terrainAt(w, p).container && !t.searched) return p
  }
  return undefined
}

function sleepingBlocked(w: World, c: Creature): string | null {
  for (const o of w.s.creatures) {
    if (o.alive && hostile(c, o) && o.ai.mode !== 'surrender' && cheb(o.pos, c.pos) <= 8 && hasLos(w, c.pos, o.pos)) return '적이 가까이 있다'
  }
  return null
}

export function perform(w: World, c: Creature, a: Action): ActResult {
  const turn = turnOf(w)
  const r = rng(w, 'ai')
  switch (a.type) {
    case 'wait':
      return { ok: true, tu: 100 }

    case 'move': {
      const d = DIRS[a.dir]
      const to = { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (!inBounds(w, to)) {
        if (isPl(c)) return FAIL('지도 끝이다. 길이 이어진 동쪽 끝에서 떠날 수 있다 (L).')
        return FAIL('경계')
      }
      const other = creatureAt(w, to)
      if (other) {
        if (hostile(c, other) && other.ai.mode !== 'surrender') return perform(w, c, { type: 'attack', target: other.id })
        if (other.ai.mode === 'surrender' && isPl(c)) return FAIL(`${other.name}은(는) 항복했다. 공격하려면 F로 지정하라.`)
        return FAIL('길이 막혔다')
      }
      const terr = terrainAt(w, to)
      if (terr.door === 'closed') {
        tileAt(w, to).t = 'Terrain.DoorOpen'
        emitNoise(w, to, 4, c.id)
        if (isPl(c)) log(w, 'info', '문을 열었다. 녹슨 경첩이 삐걱인다.')
        c.facing = a.dir
        return { ok: true, tu: 100 }
      }
      if (!terr.passable) return FAIL(`${terr.label}에 막혔다`)
      if (diagonalBlocked(w, c.pos, d.x, d.y)) return FAIL('모서리에 끼어 지나갈 수 없다')
      const tu = moveTU(w, c, to)
      c.pos = to
      c.facing = a.dir
      // 소음
      let noise = 2 * (terr.noiseMult ?? 1)
      for (const u of c.equipment.apparel) {
        const it = findItem(c, u)
        if (it) noise += itemDef(w, it).apparel?.noise ?? 0
      }
      noise *= traitMul(w, c, 'noiseMult') * (1 - skillLevel(c, 'stealth') / 100)
      if (noise >= 3) emitNoise(w, to, Math.round(noise), c.id)
      // 골절 악화
      for (const wd of c.body.wounds) {
        if (wd.fracture && !wd.splinted && part(w, c, wd.part).limb?.endsWith('Leg') && r.chance(0.015)) {
          wd.severity += 1
          if (isPl(c)) log(w, 'warn', `부러진 ${part(w, c, wd.part).label}로 걷자 뼈가 어긋난다. 부목이 필요하다.`)
        }
      }
      if (isPl(c)) {
        const t = tileAt(w, to)
        if (t.items.length) log(w, 'info', `여기에: ${t.items.map((i) => itemLabel(w, i)).join(', ')}`)
        if (terr.water === 'shallow' && turn % 5 === 0) log(w, 'info', '차가운 물이 무릎까지 찬다.')
      }
      return { ok: true, tu }
    }

    case 'attack': {
      const t = creatureById(w, a.target)
      if (!t || !t.alive) return FAIL('대상이 없다')
      if (!canReach(w, c, t)) return FAIL('닿지 않는다')
      const mw = mainWeapon(w, c)
      // 원거리 무기를 든 채 근접하면 맨손(주먹)으로 싸운다
      const atk = (mw && !itemDef(w, mw).ranged ? itemDef(w, mw).attack : undefined) ?? w.db.creature(c.def).naturalAttack
      if (!atk) return FAIL('공격 수단이 없다')
      if (atk.requiresCapacity && capacity(w, c, atk.requiresCapacity) < 0.1) return FAIL('공격할 수 없는 상태다')
      if (c.needs.stamina < atk.stamina * 0.5 && isPl(c)) log(w, 'warn', '기력이 바닥났다. 공격이 무디다.')
      if (t.ai.mode === 'surrender' && isPl(c)) {
        c.history.push({ turn, kind: 'execute', text: `항복한 ${t.name}을(를) 공격` })
      }
      if (mw && itemDef(w, mw).ranged) {
        const saved = c.equipment.main
        c.equipment.main = undefined
        resolveAttack(w, c, t)
        c.equipment.main = saved
      } else resolveAttack(w, c, t)
      return { ok: true, tu: Math.round(atk.tu * (c.needs.stamina < 10 ? 1.3 : 1)) }
    }

    case 'shoot': {
      const t = creatureById(w, a.target)
      const mw = mainWeapon(w, c)
      if (!mw || !itemDef(w, mw).ranged) return FAIL('원거리 무기가 없다')
      if (!t || !t.alive) return FAIL('대상이 없다')
      const rd = itemDef(w, mw).ranged!
      if (cheb(c.pos, t.pos) > rd.range) return FAIL('사거리 밖이다')
      if (!hasLos(w, c.pos, t.pos)) return FAIL('시야가 막혔다')
      const ammo = c.inventory.find((i) => i.def === rd.ammo)
      if (!ammo) return FAIL('화살이 없다')
      if (capacity(w, c, 'manipulation') < 0.5) return FAIL('손이 성치 않아 시위를 당길 수 없다')
      removeOne(w, c, ammo.uid)
      const res = resolveAttack(w, c, t, { ranged: true })
      // 화살 회수 가능성
      const landing = res.hit ? t.pos : t.pos
      if (r.chance(res.hit ? 0.5 : 0.7)) tileAt(w, landing).items.push(makeItem(w, rd.ammo, 1))
      return { ok: true, tu: itemDef(w, mw).attack!.tu }
    }

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
      for (const it of items) {
        t.items = t.items.filter((i) => i.uid !== it.uid)
        addToInventory(w, c, it)
      }
      if (isPl(c)) {
        log(w, 'info', `주웠다: ${items.map((i) => itemLabel(w, i)).join(', ')}`)
        if (carriedWeight(w, c) > carryCapacity(c)) log(w, 'warn', '짐이 너무 무겁다. 움직임이 느려진다.')
      }
      return { ok: true, tu: 50 + 25 * items.length }
    }

    case 'drop': {
      const it = removeOne(w, c, a.uid)
      if (!it) return FAIL('없다')
      tileAt(w, c.pos).items.push(it)
      return { ok: true, tu: 50 }
    }

    case 'equip': {
      const it = findItem(c, a.uid)
      if (!it) return FAIL('없다')
      const def = itemDef(w, it)
      if (def.light) return perform(w, c, { type: 'toggleLight', uid: a.uid })
      const err = equip(w, c, a.uid)
      if (err) return FAIL(err)
      if (isPl(c)) log(w, 'info', `${def.label}을(를) ${def.apparel ? '입었다' : '들었다'}.`)
      return { ok: true, tu: def.apparel ? 300 + def.apparel.layer * 100 : 100 }
    }

    case 'unequip': {
      unequip(c, a.uid)
      return { ok: true, tu: 150 }
    }

    case 'search': {
      const p = adjacentContainer(w, c)
      if (!p) return FAIL('뒤질 만한 것이 없다')
      c.activity = { kind: 'search', remaining: 40, target: p, label: `${terrainAt(w, p).label} 뒤지기` }
      return { ok: true, tu: 0 }
    }

    case 'treat': return treat(w, c, a.uid, a.woundId, a.limb)

    case 'consume': return consume(w, c, a.uid)

    case 'press': {
      const wd = c.body.wounds.find((x) => x.id === a.woundId)
      if (!wd) return FAIL('상처가 없다')
      if (capacity(w, c, 'manipulation') < 0.2) return FAIL('손을 쓸 수 없다')
      c.activity = { kind: 'press', remaining: 20, woundId: wd.id, label: '상처 압박' }
      return { ok: true, tu: 0 }
    }

    case 'cauterize': {
      const wd = c.body.wounds.find((x) => x.id === a.woundId)
      if (!wd) return FAIL('상처가 없다')
      const lamp = c.inventory.find((i) => i.lit && (i.fuel ?? 0) > 0)
      if (!lamp) return FAIL('불이 필요하다 (켜진 등불)')
      if (!hasBlade(w, c)) return FAIL('달굴 칼날이 필요하다')
      if (wd.internal) return FAIL('몸속 출혈은 지질 수 없다')
      wd.cauterized = true
      wd.bleed = 0
      wd.infectionChecked = true
      const { severity } = { severity: 4 + r.int(0, 3) }
      c.body.wounds.push({
        id: w.s.nextId++, def: 'Wound.Burn', part: wd.part, severity, healed: 0, bleed: 0, arterial: false,
        internal: false, fracture: false, ageTurns: 0, source: '소작', scar: true,
      })
      emitNoise(w, c.pos, 9, c.id) // 비명
      addThought(w, c, 'Thought.Cauterized')
      gainXp(w, c, 'medicine', 8)
      if (isPl(c)) {
        log(w, 'warn', `달군 칼날을 ${part(w, c, wd.part).label}에 댄다. 살 타는 냄새. 비명이 새어 나온다. 출혈은 멎었다.`)
        c.history.push({ turn, kind: 'treat', text: `${part(w, c, wd.part).label} 소작` })
      }
      return { ok: true, tu: 300 }
    }

    case 'removeTourniquet': {
      if (c.body.tourniquets[a.limb] === undefined) return FAIL('지혈대가 없다')
      delete c.body.tourniquets[a.limb]
      addToInventory(w, c, makeItem(w, 'Item.Tourniquet'))
      if (isPl(c)) log(w, 'info', '지혈대를 풀었다. 피가 다시 돈다.')
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
      if (skillLevel(c, 'medicine') < 15) return FAIL('의료 숙련 15 이상이어야 감별할 수 있다')
      c.activity = { kind: 'examine', remaining: 100, uid: it.uid, label: `${def.label} 감별` }
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
      if (isPl(c)) log(w, 'info', '웅덩이 물을 손으로 떠 마셨다. 쇠 맛과 재 맛이 난다.')
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
      it.uses = 2
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

    case 'leave': {
      if (!w.s.map.exits.some((e) => eq(e, c.pos))) return FAIL('여기서는 떠날 수 없다. 동쪽 길 끝으로 가야 한다.')
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

function treatTU(w: World, c: Creature, base: number): number {
  // 손을 다치면 처치가 오래 걸린다
  return Math.round(base / Math.max(0.25, capacity(w, c, 'manipulation')) * (1 - skillLevel(c, 'medicine') / 200))
}

function treat(w: World, c: Creature, uid: number, woundId?: number, limb?: string): ActResult {
  const it = findItem(c, uid)
  if (!it) return FAIL('없다')
  const def = itemDef(w, it)
  const med = def.medical
  if (!med) return FAIL('치료 도구가 아니다')
  const turn = turnOf(w)
  const wd: Wound | undefined = woundId !== undefined ? c.body.wounds.find((x) => x.id === woundId) : undefined
  switch (med.kind) {
    case 'bandage': {
      if (!wd) return FAIL('상처를 골라야 한다')
      if (wd.internal) return FAIL('몸속 상처는 붕대로 막을 수 없다')
      if (wd.bandage && wd.bandage.quality === 'clean') return FAIL('이미 깨끗한 붕대가 감겨 있다')
      const q = skillLevel(c, 'medicine')
      const skillBonus = 1 - Math.min(0.4, q / 100)
      wd.bandage = {
        quality: med.quality ? 'clean' : 'dirty',
        infectionMult: med.infectionMult ?? 1,
        bleedMult: (med.bleedMult ?? 0.2) * skillBonus,
        arterialMult: (med.arterialBleedMult ?? 0.7) * skillBonus,
      }
      removeOne(w, c, uid)
      gainXp(w, c, 'medicine', 10)
      if (isPl(c)) {
        let msg = `${part(w, c, wd.part).label}의 ${woundDef(w, wd).label}에 ${def.label}을(를) 감았다.`
        if (wd.arterial) msg += ' 하지만 동맥 출혈은 붕대로는 멈추지 않는다. 지혈대나 소작이 필요하다.'
        log(w, wd.arterial ? 'warn' : 'info', msg)
      }
      return { ok: true, tu: treatTU(w, c, med.tu) }
    }
    case 'tourniquet': {
      let lb = limb
      if (!lb && wd) lb = part(w, c, wd.part).limb
      if (!lb) return FAIL('지혈대는 팔이나 다리에만 감을 수 있다')
      if (c.body.tourniquets[lb] !== undefined) return FAIL('이미 감겨 있다')
      if (isMissing(w, c, lb)) return FAIL('그 팔다리는 이미 없다')
      c.body.tourniquets[lb] = turn
      removeOne(w, c, uid)
      gainXp(w, c, 'medicine', 8)
      if (isPl(c)) log(w, 'info', `${part(w, c, lb).label}에 지혈대를 단단히 감았다. 두 시간 안에 풀어야 한다.`)
      return { ok: true, tu: treatTU(w, c, med.tu) }
    }
    case 'splint': {
      const target = wd ?? c.body.wounds.find((x) => x.fracture && !x.splinted)
      if (!target || !target.fracture) return FAIL('부러진 곳이 없다')
      if (target.splinted) return FAIL('이미 부목을 댔다')
      target.splinted = true
      removeOne(w, c, uid)
      gainXp(w, c, 'medicine', 10)
      if (isPl(c)) log(w, 'info', `${part(w, c, target.part).label}에 부목을 댔다. 욱신거림이 조금 가라앉는다.`)
      return { ok: true, tu: treatTU(w, c, med.tu) }
    }
    case 'disinfect': {
      if (!wd) return FAIL('상처를 골라야 한다')
      if (wd.infectionChecked && !wd.infection) return FAIL('이미 아물기 시작해 소독할 필요가 없다')
      wd.disinfected = true
      if (wd.infection) wd.infection.progress = Math.max(0, wd.infection.progress - 10)
      it.uses = (it.uses ?? 1) - 1
      if ((it.uses ?? 0) <= 0) removeOne(w, c, uid)
      gainXp(w, c, 'medicine', 6)
      if (isPl(c)) log(w, 'info', `${part(w, c, wd.part).label}의 상처에 술을 부었다. 타는 듯이 쓰라리다.`)
      return { ok: true, tu: treatTU(w, c, med.tu) }
    }
  }
}

function consume(w: World, c: Creature, uid: number): ActResult {
  const it = findItem(c, uid)
  if (!it) return FAIL('없다')
  const def = itemDef(w, it)
  const turn = turnOf(w)
  const r = rng(w, 'body')
  if (def.food) {
    let tu = 300
    if (def.food.needsTool === 'blade' && !hasBlade(w, c)) {
      tu = 2400
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
    return { ok: true, tu: 150 }
  }
  if (def.drug) {
    addEffect(c, def.drug.effect, turn + def.drug.durationTurns)
    removeOne(w, c, uid)
    if (isPl(c)) log(w, 'info', `${def.label}을(를) 삼켰다.`)
    return { ok: true, tu: 100 }
  }
  if (def.unidentified) {
    const effId = w.s.knowledge.pillMap[def.id]
    const eff = w.db.pill(effId)
    applyPillEffect(w, c, eff.effect, eff.durationTurns)
    removeOne(w, c, uid)
    const known = !!w.s.knowledge.pillKnown[def.id]
    w.s.knowledge.pillKnown[def.id] = effId
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
      c.needs.stamina = 100
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
      if (!wd || wd.bleed <= 0) { c.activity = undefined; return true }
      c.body.pressing = wd.id
      break
    }
    case 'search':
      if (act.remaining <= 0 && act.target) {
        const t = tileAt(w, act.target)
        const terr = terrainAt(w, act.target)
        t.searched = true
        const loot = terr.container ? rollLoot(w, terr.container) : []
        const dropAt = tileAt(w, c.pos)
        dropAt.items.push(...loot)
        if (terr.id === 'Terrain.Crate') t.t = 'Terrain.OpenedCrate'
        gainXp(w, c, 'survival', 3)
        emitNoise(w, c.pos, 3, c.id)
        if (isPl(c)) log(w, loot.length ? 'good' : 'info', loot.length ? `찾았다: ${loot.map((i) => itemLabel(w, i)).join(', ')} (발밑에 놓음 — G로 줍기)` : '아무것도 없다. 누군가 먼저 다녀갔다.')
      }
      break
    case 'examine':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const it = findItem(c, act.uid)
        if (it) {
          const r = rng(w, 'body')
          const ch = (skillLevel(c, 'medicine') - 10) / 40
          if (r.chance(Math.min(0.9, ch))) {
            const eff = w.s.knowledge.pillMap[it.def]
            w.s.knowledge.pillKnown[it.def] = eff
            if (isPl(c)) log(w, 'good', `${itemDef(w, it).label}의 정체를 알아냈다: ${w.db.pill(eff).label}.`)
            gainXp(w, c, 'medicine', 15)
          } else if (isPl(c)) log(w, 'info', '냄새와 색만으로는 알 수 없었다.')
        }
      }
      break
  }
  if (act.remaining <= 0) {
    if (act.kind === 'sleep' && isPl(c)) {
      log(w, 'info', '잠에서 깼다.')
    }
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

export function partLabel(w: World, c: Creature, id: string) {
  return part(w, c, id).label
}


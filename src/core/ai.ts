// 적 AI: 무리 사냥꾼(재늑대), 약탈자, 겁많은 쥐. 같은 규칙 아래에서 판단한다.

import { hostile, type Action } from './actions'
import { bloodLoss, capacity, totalBleed } from './body'
import { canReach, facingRelation } from './combat'
import { creatureAt, inBounds, log, player, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee } from './fov'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { itemDef, mainWeapon } from './items'
import { diagonalBlocked, findPath } from './path'
import { emitNoise, smells } from './perception'
import type { Creature } from './types'

function visibleHostiles(w: World, c: Creature): Creature[] {
  return w.s.creatures.filter((o) => o.alive && o.id !== c.id && hostile(c, o) && o.ai.mode !== 'surrender' && canSee(w, c, o.pos))
}

function stepToward(w: World, c: Creature, dest: Pos): Action | null {
  if (eq(c.pos, dest)) return null
  let path = c.ai.path
  if (!path || !path.length || !eq(path[path.length - 1], dest) || (c.id + turnOf(w)) % 7 === 0) {
    path = findPath(w, c.pos, dest, { avoidCreatures: true, selfId: c.id, maxNodes: 1200 }) ?? undefined
    c.ai.path = path
  }
  if (!path || !path.length) return null
  const next = path[0]
  const occ = creatureAt(w, next)
  if (occ && occ.id !== c.id) {
    c.ai.path = undefined
    // 막히면 옆으로 비켜 접근
    return sidestep(w, c, dest)
  }
  path.shift()
  const dir = dirIndex(next.x - c.pos.x, next.y - c.pos.y)
  if (dir < 0 || cheb(next, c.pos) !== 1) {
    c.ai.path = undefined
    return null
  }
  return { type: 'move', dir }
}

function freeStep(w: World, c: Creature, p: Pos, d: Pos): boolean {
  return inBounds(w, p) && terrainAt(w, p).passable && !creatureAt(w, p) && !diagonalBlocked(w, c.pos, d.x, d.y)
}

function sidestep(w: World, c: Creature, dest: Pos): Action | null {
  let best: { dir: number; score: number } | null = null
  for (let i = 0; i < 8; i++) {
    const d = DIRS[i]
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!freeStep(w, c, p, d)) continue
    const score = cheb(p, dest)
    if (!best || score < best.score) best = { dir: i, score }
  }
  return best && best.score <= cheb(c.pos, dest) ? { type: 'move', dir: best.dir } : null
}

function stepAway(w: World, c: Creature, threats: Creature[]): Action | null {
  let best: { dir: number; score: number } | null = null
  for (let i = 0; i < 8; i++) {
    const d = DIRS[i]
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!freeStep(w, c, p, d)) continue
    const score = Math.min(...threats.map((t) => cheb(p, t.pos))) * 10 - terrainAt(w, p).moveMult
    if (!best || score > best.score) best = { dir: i, score }
  }
  return best ? { type: 'move', dir: best.dir } : null
}

/** 무리 사냥꾼: 대상의 측면/후면 빈칸을 노린다 */
function flankSpot(w: World, c: Creature, target: Creature): Pos | null {
  let best: { p: Pos; score: number } | null = null
  for (const d of DIRS) {
    const p = { x: target.pos.x + d.x, y: target.pos.y + d.y }
    if (!inBounds(w, p) || !terrainAt(w, p).passable) continue
    const occ = creatureAt(w, p)
    if (occ && occ.id !== c.id) continue
    const rel = facingRelation(target, p)
    const score = (rel === 'back' ? 30 : rel === 'side' ? 15 : 0) - cheb(c.pos, p) * 3
    if (!best || score > best.score) best = { p, score }
  }
  return best?.p ?? null
}

function nearestFood(w: World, c: Creature, range: number): Pos | null {
  let best: { p: Pos; d: number } | null = null
  for (let y = Math.max(0, c.pos.y - range); y <= Math.min(w.s.map.h - 1, c.pos.y + range); y++) {
    for (let x = Math.max(0, c.pos.x - range); x <= Math.min(w.s.map.w - 1, c.pos.x + range); x++) {
      const t = w.s.map.tiles[y * w.s.map.w + x]
      if (!t.items.some((i) => itemDef(w, i).food?.raw)) continue
      const p = { x, y }
      if (!canSee(w, c, p)) continue
      const d = cheb(c.pos, p)
      if (!best || d < best.d) best = { p, d }
    }
  }
  return best?.p ?? null
}

export function aiDecide(w: World, c: Creature): Action {
  const r = rng(w, 'ai')
  const cdef = w.db.creature(c.def)
  const turn = turnOf(w)
  const pl = player(w)
  const ai = c.ai

  // 사기 회복 (위협이 없을 때)
  const threats = visibleHostiles(w, c)
  if (!threats.length) ai.morale = Math.min(cdef.morale, ai.morale + 0.3)
  // 수적 우세
  const allies = w.s.creatures.filter((o) => o.alive && o.faction === c.faction && o.id !== c.id && cheb(o.pos, c.pos) <= 6).length

  // 도주/항복 판단
  const fleeLine = cdef.ai === 'raider' ? 22 : cdef.ai === 'skittish' ? 15 : 18
  const tooHurt = bloodLoss(c) > (cdef.ai === 'raider' ? 0.25 : 0.32) || capacity(w, c, 'moving') < 0.35
  if (ai.mode !== 'surrender' && ai.mode !== 'flee' && (ai.morale + allies * 6 < fleeLine || tooHurt) && threats.length) {
    ai.mode = 'flee'
    if (canSee(w, pl, c.pos)) log(w, 'combat', `${c.name}이(가) 겁에 질려 달아나기 시작한다.`)
    if (cdef.ai === 'packHunter') emitNoise(w, c.pos, 8, c.id) // 깨갱
  }

  if (ai.mode === 'surrender') {
    if (!threats.length || threats.every((t) => cheb(t.pos, c.pos) > 6)) {
      if (r.chance(0.05)) ai.mode = 'flee'
    }
    return { type: 'wait' }
  }

  if (ai.mode === 'flee') {
    if (!threats.length && ai.morale > fleeLine + 15 && !tooHurt) ai.mode = 'idle'
    const atEdge = c.pos.x === 0 || c.pos.y === 0 || c.pos.x === w.s.map.w - 1 || c.pos.y === w.s.map.h - 1
    if (atEdge && threats.every((t) => cheb(t.pos, c.pos) > 3)) {
      c.alive = false
      c.deathCause = 'escaped'
      if (canSee(w, pl, c.pos)) log(w, 'info', `${c.name}이(가) 지도 밖으로 사라졌다.`)
      return { type: 'wait' }
    }
    // 궁지에 몰린 사람은 항복
    if (cdef.ai === 'raider' && threats.some((t) => cheb(t.pos, c.pos) <= 1) && (ai.morale < 5 || capacity(w, c, 'moving') < 0.35)) {
      ai.mode = 'surrender'
      const mw = mainWeapon(w, c)
      if (mw) {
        c.equipment.main = undefined
        c.inventory = c.inventory.filter((i) => i.uid !== mw.uid)
        tileAt(w, c.pos).items.push(mw)
      }
      if (canSee(w, pl, c.pos)) log(w, 'warn', `${c.name}이(가) 무기를 내던지고 무릎을 꿇는다. "살려줘…!"`)
      return { type: 'wait' }
    }
    if (threats.length) {
      const away = stepAway(w, c, threats)
      if (away) return away
      // 도망칠 곳이 없으면 싸운다
      const adj = threats.find((t) => canReach(w, c, t))
      if (adj) return { type: 'attack', target: adj.id }
    }
    // 가장 가까운 가장자리로
    const edge = { x: c.pos.x < w.s.map.w / 2 ? 0 : w.s.map.w - 1, y: c.pos.y }
    return stepToward(w, c, edge) ?? { type: 'wait' }
  }

  // 목표 선택
  let target: Creature | undefined
  const wantsFight = cdef.ai === 'raider'
    || (cdef.ai === 'packHunter' && (ai.hunger > 0.4 || (ai.alertTurn !== undefined && turn - ai.alertTurn < 200)))
    || (cdef.ai === 'skittish' && (ai.alertTurn !== undefined && turn - ai.alertTurn < 50))
  if (threats.length) {
    threats.sort((a, b) => cheb(a.pos, c.pos) - cheb(b.pos, c.pos))
    const cand = threats[0]
    // 쥐는 쓰러졌거나 피 흘리는 대상에게만 대담
    const weak = cand.unconscious || totalBleed(w, cand, true) > 3
    const cornered = cheb(cand.pos, c.pos) <= 1 && (cdef.ai !== 'skittish' || r.chance(0.35))
    if (wantsFight || (cdef.ai === 'skittish' && weak) || cornered) target = cand
    else if (cdef.ai === 'skittish' && cheb(cand.pos, c.pos) <= 4) {
      return stepAway(w, c, threats) ?? { type: 'wait' }
    }
  }

  // 배고픈 짐승: 고기가 보이면 먼저 먹는다
  if (cdef.ai !== 'raider' && ai.hunger > 0.3) {
    const nearThreat = threats.some((t) => cheb(t.pos, c.pos) <= 2)
    if (!nearThreat) {
      const here = tileAt(w, c.pos).items.some((i) => itemDef(w, i).food?.raw)
      if (here) {
        if (canSee(w, pl, c.pos) && ai.mode !== 'eat') log(w, 'flavor', `${c.name}이(가) 고기를 뜯기 시작한다.`)
        ai.mode = 'eat'
        return { type: 'eatFloor' }
      }
      const food = nearestFood(w, c, 8)
      if (food) {
        ai.mode = 'eat'
        const st = stepToward(w, c, food)
        if (st) return st
      }
    }
  }

  if (target) {
    if (ai.mode !== 'hunt' && cdef.ai === 'packHunter') {
      emitNoise(w, c.pos, 12, c.id) // 짖어서 무리를 부른다
      if (canSee(w, pl, c.pos)) log(w, 'warn', `${c.name}이(가) 이빨을 드러내고 짖는다.`)
    }
    ai.mode = 'hunt'
    ai.target = target.id
    ai.lastSeen = { ...target.pos }
    // 원거리 무기
    const mw = mainWeapon(w, c)
    if (mw && itemDef(w, mw).ranged && cheb(c.pos, target.pos) > 1) {
      if (c.inventory.some((i) => i.def === itemDef(w, mw).ranged!.ammo)) return { type: 'shoot', target: target.id }
    }
    if (canReach(w, c, target)) return { type: 'attack', target: target.id }
    if (cdef.ai === 'packHunter') {
      const spot = flankSpot(w, c, target)
      if (spot) {
        const st = stepToward(w, c, spot)
        if (st) return st
      }
    }
    return stepToward(w, c, target.pos) ?? sidestep(w, c, target.pos) ?? { type: 'wait' }
  }

  // 냄새 추적
  if (cdef.scentSense && (ai.hunger > 0.4 || cdef.ai === 'packHunter')) {
    const prey = w.s.creatures.find((o) => o.alive && hostile(c, o) && smells(w, c, o))
    if (prey) {
      if (ai.mode !== 'investigate' && canSee(w, pl, c.pos)) log(w, 'flavor', `${c.name}이(가) 코를 킁킁대며 바람을 맡는다.`)
      ai.mode = 'investigate'
      ai.dest = { ...prey.pos }
    }
  }

  // 마지막으로 본 곳 / 소리 난 곳 조사
  if (ai.mode === 'hunt' && ai.lastSeen) {
    ai.mode = 'investigate'
    ai.dest = ai.lastSeen
  }
  if (ai.mode === 'investigate' && ai.dest) {
    if (cheb(c.pos, ai.dest) <= 0) { ai.mode = 'wander'; ai.dest = undefined }
    else {
      const st = stepToward(w, c, ai.dest)
      if (st) return st
      ai.mode = 'wander'
    }
  }

  // 배회
  ai.mode = ai.mode === 'eat' ? 'wander' : ai.mode
  if (r.chance(cdef.ai === 'raider' ? 0.5 : 0.35)) {
    if (!ai.dest || r.chance(0.05) || eq(ai.dest, c.pos)) {
      ai.dest = { x: Math.max(1, Math.min(w.s.map.w - 2, c.pos.x + r.int(-8, 8))), y: Math.max(1, Math.min(w.s.map.h - 2, c.pos.y + r.int(-8, 8))) }
      ai.path = undefined
    }
    const st = stepToward(w, c, ai.dest)
    if (st) return st
    ai.dest = undefined
  }
  // 굶주림 증가
  ai.hunger = Math.min(1, ai.hunger + 0.0005)
  return { type: 'wait' }
}

// 적 AI: 무리 사냥꾼(재늑대), 약탈자, 겁많은 쥐. 같은 규칙 아래에서 판단한다.

import { hostile, type Action } from './actions'
import { abilityReady } from './abilities'
import { energyMax, regionState, totalBleed } from './body'
import { canReach, facingRelation, fx, wake } from './combat'
import { creatureAt, inBounds, log, player, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee } from './fov'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { countOf, itemDef, lightSource, mainWeapon } from './items'
import { diagonalBlocked, findPath } from './path'
import { emitNoise, smells } from './perception'
import { moraleEvent, moraleOf, packHalved } from './morale'
import { awardDefeat } from './progression'
import { alarmArrived, PATROL_WAIT, raidStash } from './storyteller'
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

/** 적의 능력 사용 규칙 (A13) */
function chooseAbility(w: World, c: Creature, t: Creature, threats: Creature[]): Action | null {
  const r = rng(w, 'ai')
  const d = cheb(c.pos, t.pos)
  for (const id of c.abilities) {
    const def = w.db.ability(id)
    if (def.kind !== 'active' || abilityReady(w, c, id)) continue
    if (def.sweep) {
      if (threats.some((o) => cheb(o.pos, c.pos) <= 1)) return { type: 'ability', id }
      continue
    }
    if (def.burst) {
      if (threats.some((o) => cheb(o.pos, c.pos) <= def.burst!.radius)) return { type: 'ability', id }
      continue
    }
    if (def.grab) {
      if (d <= 1 && !t.effects.some((e) => e.kind === 'grabbed') && r.chance(0.3)) return { type: 'ability', id, target: t.id }
      continue
    }
    if (def.lunge) {
      const dx = t.pos.x - c.pos.x, dy = t.pos.y - c.pos.y
      if (d >= 2 && d <= def.lunge + 1 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
        let clear = true
        for (let k = 1; k < d; k++) {
          const p = { x: c.pos.x + Math.sign(dx) * k, y: c.pos.y + Math.sign(dy) * k }
          if (!terrainAt(w, p).passable || creatureAt(w, p)) clear = false
        }
        if (clear) return { type: 'ability', id, target: t.id }
      }
      continue
    }
    if (def.self) {
      if (c.needs.energy < energyMax(w, c) * 0.3 && !threats.some((o) => cheb(o.pos, c.pos) <= 1)) return { type: 'ability', id }
      continue
    }
    if (def.channel) {
      if (d >= 3 && r.chance(0.6)) return { type: 'ability', id, target: t.id }
      continue
    }
    if (def.attack && canReach(w, c, t) && r.chance(0.5)) return { type: 'ability', id, target: t.id }
  }
  return null
}

/** 항복 (07 §8): 무기를 내려놓는다. 항복을 받아낸 경험치는 처치와 같다 (15 §3) */
function surrender(w: World, c: Creature, threats: Creature[]): Action {
  const pl = player(w)
  c.ai.mode = 'surrender'
  c.ai.cornered = false
  if (threats.some((t) => t.id === pl.id)) awardDefeat(w, pl, c, 1, '항복시킴')
  const mw = mainWeapon(w, c)
  if (mw) {
    c.equip.main = undefined
    tileAt(w, c.pos).items.push(mw)
  }
  fx(w, { k: 'status', id: c.id, text: '항복', color: '#f0f0f0', turn: turnOf(w) })
  if (canSee(w, pl, c.pos)) log(w, 'warn', `${c.name}이(가) 무기를 내던지고 무릎을 꿇는다. "살려줘…!"`)
  return { type: 'wait' }
}

/** 도주 목적지: 약탈자 = 야영지(거점), 던전 = 가까운 계단 */
function fleeDest(w: World, c: Creature): Pos | undefined {
  if (w.s.map.kind === 'surface') return c.faction === 'reavers' ? c.home ?? w.s.map.waypoints?.reaverCamp : undefined
  const links = w.s.map.links.map((l) => l.pos).sort((a, b) => cheb(a, c.pos) - cheb(b, c.pos))
  return links[0]
}

export function aiDecide(w: World, c: Creature): Action {
  const r = rng(w, 'ai')
  const cdef = w.db.creature(c.def)
  const turn = turnOf(w)
  const pl = player(w)
  const ai = c.ai

  // 잠든 적: 소리로만 깬다(perception). 포자 인간은 인접 칸에 2턴 이상 머물면 깬다 (14 §7.2)
  if (c.asleep) {
    if (c.def.startsWith('Creature.SporeMan') && pl.alive && cheb(pl.pos, c.pos) <= 1) {
      ai.nearTurns = (ai.nearTurns ?? 0) + 1
      if (ai.nearTurns >= 2) wake(w, c, '곁의 기척')
    } else ai.nearTurns = 0
    if (c.asleep) return { type: 'wait' }
  }
  const isGuard = cdef.ai === 'guard' || cdef.ai === 'boss'

  // 진정한 개체(물을 받은 말라붙은 자)는 그 자리에 머문다
  if (ai.mode === 'calm') return { type: 'wait' }
  const threats = visibleHostiles(w, c)

  // 사기 (07 §8): 사건 즉시 + 5턴마다 판정
  const M = moraleOf(w, c)
  ai.morale = M
  if (!cdef.noMorale && ai.mode !== 'surrender' && ai.mode !== 'flee' && threats.length) {
    const check = ai.moraleCheck === undefined || turn - ai.moraleCheck >= 5
    let flee = M < 10 || packHalved(w, c)
    if (!flee && M < 25 && check) flee = r.int(0, 99) < (25 - M) * 4
    if (check) ai.moraleCheck = turn
    if (flee) {
      // 도주 불가: 다리 중상 이상 · 물러날 칸 없음(포위·막다른 곳)
      const legs = Math.max(regionState(w, c, 'lleg'), regionState(w, c, 'rleg'))
      const away = stepAway(w, c, threats)
      const gain = away?.type === 'move' && threats.every((t) => cheb(t.pos, { x: c.pos.x + DIRS[away.dir].x, y: c.pos.y + DIRS[away.dir].y }) >= cheb(t.pos, c.pos))
      if (legs < 3 && gain) {
        ai.mode = 'flee'
        ai.cornered = false
        for (const o of w.s.creatures) if (o.alive && o.id !== c.id && o.faction === c.faction && canSee(w, o, c.pos)) moraleEvent(o, -5, 't20', turn)
        fx(w, { k: 'status', id: c.id, text: '도주!', color: '#e0c050', turn })
        if (canSee(w, pl, c.pos)) log(w, 'combat', `${c.name}이(가) 겁에 질려 달아나기 시작한다.`)
      } else if (c.faction === 'reavers' && !ai.cornered && r.int(0, 99) < Math.max(20, (25 - M) * 3)) {
        return surrender(w, c, threats)
      } else if (!ai.cornered) {
        ai.cornered = true
        fx(w, { k: 'status', id: c.id, text: '궁지', color: '#e07040', turn })
        if (canSee(w, pl, c.pos)) log(w, 'combat', `${c.name}이(가) 궁지에 몰렸다. 이를 악물고 덤빈다.`)
      }
    }
  }

  if (ai.mode === 'surrender') {
    if (!threats.length || threats.every((t) => cheb(t.pos, c.pos) > 6)) {
      if (r.chance(0.05)) ai.mode = 'flee'
    }
    return { type: 'wait' }
  }

  if (ai.mode === 'flee') {
    if (!threats.length && M >= 40) { ai.mode = 'idle'; ai.goneSince = undefined }
    // 도주 경험치: 시야 밖으로 사라져 30턴 동안 돌아오지 않으면 50% (15 §3)
    if (canSee(w, pl, c.pos)) ai.goneSince = undefined
    else {
      ai.goneSince ??= turn
      if (turn - ai.goneSince >= 30 && c.body.wounds.some((wd) => wd.sourceId === pl.id)) awardDefeat(w, pl, c, 0.5, '도주시킴')
    }
    // 도주는 지도 가장자리가 아니라 공급원 쪽으로 (12 §12.3 · D11): 약탈자는 야영지, 던전 거주자는 계단(관로·순례길로 이어진다)
    const dest = fleeDest(w, c)
    if (dest && cheb(c.pos, dest) <= 0 && !canSee(w, pl, c.pos)) {
      if (w.s.map.kind === 'dungeon') {
        // 층을 떠나 공급원으로 돌아간다
        c.alive = false
        c.deathCause = 'escaped'
        const src = w.s.sources?.find((x) => x.species === c.def && x.floors.includes(w.s.map.id))
        if (src) src.count = Math.min(src.cap, src.count + 1)
        if (c.body.wounds.some((wd) => wd.sourceId === pl.id)) awardDefeat(w, pl, c, 0.5, '도주시킴')
        return { type: 'wait' }
      }
      ai.mode = 'guard'
      return { type: 'wait' }
    }
    if (threats.length) {
      const toward = dest ? stepToward(w, c, dest) : undefined
      if (toward && toward.type === 'move') {
        const d = DIRS[toward.dir]
        const next = { x: c.pos.x + d.x, y: c.pos.y + d.y }
        if (threats.every((t) => cheb(t.pos, next) >= cheb(t.pos, c.pos) || cheb(t.pos, next) > 1)) return toward
      }
      const away = stepAway(w, c, threats)
      if (away) return away
      // 도망칠 곳이 없으면 싸운다
      const adj = threats.find((t) => canReach(w, c, t))
      if (adj) return { type: 'attack', target: adj.id }
    }
    if (dest) return stepToward(w, c, dest) ?? { type: 'wait' }
    return { type: 'wait' }
  }

  // 목표 선택
  let target: Creature | undefined
  const wantsFight = cdef.ai === 'raider' || isGuard
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
  if ((cdef.ai === 'packHunter' || cdef.ai === 'skittish') && ai.hunger > 0.3) {
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

  // 거점 경비는 일정 거리 이상 쫓지 않는다 (보스 7칸, 경비 14칸)
  if (target && c.home && !ai.route && (cdef.ai === 'boss' || cdef.ai === 'guard') && cheb(target.pos, c.home) > (cdef.ai === 'boss' ? 7 : 14)) {
    target = undefined
    if (ai.mode === 'hunt') { ai.mode = 'return'; ai.path = undefined }
  }
  if (target) {
    if (ai.mode !== 'hunt' && isGuard && turn - (ai.alertTurn ?? -999) > 20) {
      ai.alertTurn = turn
      emitNoise(w, c.pos, 12, c.id) // 소리쳐 동료를 깨운다 (14 §7.3: 소음 12)
      fx(w, { k: 'status', id: c.id, text: '!', color: '#ff5050', turn })
      if (canSee(w, pl, c.pos)) log(w, 'warn', cdef.ai === 'boss' ? `${c.name}이(가) 꿈틀거리며 몸을 일으킨다. 방 전체가 울린다.` : `${c.name}이(가) 당신을 발견했다.`)
    }
    if (ai.mode !== 'hunt' && cdef.ai === 'packHunter') {
      emitNoise(w, c.pos, 12, c.id) // 짖어서 무리를 부른다
      if (canSee(w, pl, c.pos)) log(w, 'warn', `${c.name}이(가) 이빨을 드러내고 짖는다.`)
    }
    ai.mode = 'hunt'
    ai.target = target.id
    ai.lastSeen = { ...target.pos }
    // 능력 (15 §15: 적도 같은 능력 Def를 쓴다)
    const ab = chooseAbility(w, c, target, threats)
    if (ab) return ab
    // 빛을 싫어하는 무리: 광원을 든 대상에게는 정면으로 오지 않고, 동료 둘이 붙을 때까지 빛 밖에서 기다린다 (07 §12.4)
    if (cdef.lightAverse && cheb(c.pos, target.pos) > 1) {
      const src = lightSource(w, target)
      if (src) {
        const near = w.s.creatures.filter((o) => o.alive && o.id !== c.id && o.faction === c.faction && cheb(o.pos, target.pos) <= 2).length
        if (near < 2 && cheb(c.pos, target.pos) <= src.radius + 1) {
          return stepAway(w, c, [target]) ?? { type: 'wait' }
        }
        if (near < 2) return { type: 'wait' }
        const spot = flankSpot(w, c, target)
        if (spot) { const st = stepToward(w, c, spot); if (st) return st }
      }
    }
    // 원거리 무기
    const mw = mainWeapon(w, c)
    if (mw && itemDef(w, mw).ranged && cheb(c.pos, target.pos) > 1) {
      if (countOf(c, itemDef(w, mw).ranged!.ammo) > 0) return { type: 'shoot', target: target.id }
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

  // 순찰 (14 §10): 경유지마다 30분 대기, 마지막은 거점 → 경비로 복귀
  if (ai.route?.length) {
    if (ai.mode !== 'patrol') ai.mode = 'patrol'
    const i = ai.routeIdx ?? 0
    const goal = ai.route[i]
    if (cheb(c.pos, goal) <= 1) {
      const last = i >= ai.route.length - 1
      // 수색대는 기다리지 않는다. 보관함에 닿으면 턴다 (10 §3.2)
      const searching = ai.task?.kind === 'search' || ai.task?.kind === 'alarm'
      if (ai.task?.kind === 'search' && ai.task.stash && eq(goal, ai.task.stash)) raidStash(w, c, w.s.map, goal)
      if (ai.waitUntil === undefined) ai.waitUntil = turn + (last || searching ? 0 : PATROL_WAIT)
      if (turn >= ai.waitUntil) {
        ai.waitUntil = undefined
        ai.routeIdx = i + 1
        if (last) {
          if (ai.task?.kind === 'alarm') alarmArrived(w, c)
          ai.task = undefined
          ai.route = undefined; ai.routeIdx = undefined; ai.mode = isGuard ? 'guard' : 'wander'
        }
      }
      return { type: 'wait' }
    }
    const st = stepToward(w, c, goal)
    if (st) return st
  }

  // 경비형: 거점 근처에 머문다
  if (isGuard && c.home) {
    if (cheb(c.pos, c.home) > 5) {
      ai.mode = 'return'
      const st = stepToward(w, c, c.home)
      if (st) return st
    }
    ai.mode = 'guard'
    if (r.chance(0.15)) {
      const d = DIRS[r.int(0, 7)]
      const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (cheb(p, c.home) <= 3 && freeStep(w, c, p, d)) return { type: 'move', dir: DIRS.indexOf(d) }
    }
    return { type: 'wait' }
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

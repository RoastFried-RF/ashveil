import {recordHeardThoughts} from './sound-thoughts'
import {finishSleepMemories} from './sleep-memories'
import {fatigueBand,fatigueAt} from './fatigue-state'
import { drugEffects } from './drug-state'
import { regionalWindBonus, weatherDef, weatherNoise, weatherScent } from './climate-state'
import { foodFreshness, foodSafetyDef } from './food-state'
// 소음·냄새 전파. 벽은 소리를 줄이고, 바람은 냄새를 실어 나른다.

import { capacity } from './body'
import { hostile } from './diplomacy'
import { log, player, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { cheb, DIRS, dirIndex, DIR_LABELS, type Pos } from './geom'
import { itemDef } from './items'
import { traitAdd } from './traits'
import type { Creature } from './types'

/**
 * 소리 경로 비용 (07 §9.1): 최단 경로(8방향) 칸당 1, 닫힌 나무문 +4. 경로가 없으면 직선 거리 + 돌벽 관통 8.
 * 반환: 칸 인덱스 → 비용 (limit 이하만)
 */
export function noiseCost(w: World, from: Pos, limit: number): Map<number, number> {
  const m = w.s.map
  const cost = new Map<number, number>([[from.y * m.w + from.x, 0]])
  // 비용이 1 또는 5라서 단순 버킷 큐로 충분하다
  const buckets: number[][] = [[from.y * m.w + from.x]]
  for (let c = 0; c <= limit; c++) {
    const q = buckets[c]
    if (!q) continue
    for (const i of q) {
      if (cost.get(i) !== c) continue
      const x = i % m.w, y = (i - x) / m.w
      for (const d of DIRS) {
        const nx = x + d.x, ny = y + d.y
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue
        const t = w.db.terrain(m.tiles[ny * m.w + nx].t)
        const step = t.door === 'closed' ? 5 : t.opaque && !t.passable ? -1 : 1
        if (step < 0) continue
        const nc = c + step
        const ni = ny * m.w + nx
        if (nc > limit || (cost.get(ni) ?? Infinity) <= nc) continue
        cost.set(ni, nc)
        ;(buckets[nc] ??= []).push(ni)
      }
    }
  }
  return cost
}

/** 주변 소음: 재비 3(지상) · 천장 누수 1(지하 1층, 재비 시) */
export function ambientNoise(w: World): number {
  return weatherNoise(w)
}

/** 청각 보정: 종(그늘 사람 +2 · 포자 인간 −2) + 귀 상태 + 고철 투구 −1 */
export function hearingBonus(w: World, c: Creature): number {
  let h = w.db.creature(c.def).hearing ?? 0
  h += Math.round((capacity(w, c, 'hearing') - 1) * 3)
  if (c.equip.head && itemDef(w, c.equip.head).id === 'Item.ScrapHelmet') h -= 1
  return h
}

/** 수면 주기 (01 §8.1): 얕은 잠 30분 → 깊은 잠 45분(수면 부채: 지침 +15분 · 탈진 +30분) → 얕은 잠 15분, 반복 */
export function sleepCycleDeep(w: World, elapsedTurns: number, fatigueAtStart: number, debtAtStart = 0): boolean {
  const MIN = TURNS_PER_HOUR / 60
  const extra = fatigueAt(w,fatigueAtStart,debtAtStart).deepMinutes
  const t = elapsedTurns % ((90 + extra) * MIN)
  return t >= 30 * MIN && t < (75 + extra) * MIN
}

/** 각성 임계 (01 §8.2 · 14 §7.2): 얕은 잠 3 · 깊은 잠 8 + 피로 + 종 보정(포자 인간 +2 · 말라붙은 자 −1) */
export function wakeThreshold(w: World, c: Creature): number {
  let t = c.deepSleep ? 8 : 3
  t += fatigueBand(w,c).wake
  t += traitAdd(w, c, 'wakeThreshold')
  t += drugEffects(w, c).wakeThreshold
  if (c.effects.some((e) => e.kind === 'sedative' && e.untilTurn > turnOf(w))) t += 6
  const id = c.def
  if (id.startsWith('Creature.SporeMan')) t += 2
  if (id.startsWith('Creature.Withered')) t -= 1
  return t
}

/** 소리 내기: 도달 세기 = 세기 − 경로 비용 − 주변 소음 + 청각 보정. 잠든 개체는 ≥ 각성 임계, 깨어 있으면 ≥ 0 */
export function emitNoise(w: World, pos: Pos, strength: number, sourceId: number) {
  const turn = turnOf(w)
  w.s.noiseEvents.push({ pos: { ...pos }, radius: strength, source: sourceId, turn })
  if (w.s.noiseEvents.length > 30) w.s.noiseEvents.shift()
  const pl = player(w)
  const src = w.s.creatures.find((o) => o.id === sourceId)
  const amb = ambientNoise(w)
  const limit = strength + 4
  let costs: Map<number, number> | undefined
  for (const c of w.s.creatures) {
    if (!c.alive || c.unconscious || c.id === sourceId) continue
    if(capacity(w,c,'hearing')<=0)continue
    // 동료의 발소리·일상 소음은 무시한다 (경보 외침은 세기 ≥ 6)
    if (src && src.faction === c.faction && strength < 6 && !c.asleep) continue
    const d = cheb(c.pos, pos)
    if (d > limit) continue
    costs ??= noiseCost(w, pos, limit)
    const pc = costs.get(c.pos.y * w.s.map.w + c.pos.x) ?? d + 8
    const reach = strength - pc - amb + hearingBonus(w, c)
    if(reach>=0)recordHeardThoughts(w,c,src)
    if (c.id === pl.id) {
      // 자는 플레이어도 같은 규칙으로 깬다 (01 §8.2)
      if (c.activity?.kind === 'sleep') {
        if (reach >= wakeThreshold(w, c)) c.activity.wokeBy ??= '소리에 잠이 깼다.'
        continue
      }
      if (strength >= 6 && reach >= 0 && d > 2 && !w.s.visible.includes(pos.y * w.s.map.w + pos.x)) {
        const dir = DIR_LABELS[dirIndex(pos.x - c.pos.x, pos.y - c.pos.y)]
        log(w, 'flavor', `${dir}쪽 어딘가에서 소리가 났다.`)
      }
      continue
    }
    if (c.asleep) {
      if (reach < wakeThreshold(w, c)) continue
      const familiar = !!c.residentSite && !!src && !hostile(w, c, src) && strength < 6
      if (c.activity?.kind === 'sleep') c.activity.wokeBy ??= familiar ? '익숙한 소리에 잠이 깼다.' : '소리에 잠이 깼다.'
      finishSleepMemories(w,c)
      c.asleep = false
      c.drowsyUntil = turn + (c.deepSleep ? 20 : 10)
      c.deepSleep = undefined
      c.ai.alertTurn = turn
      w.s.fx.push({ k: 'status', id: c.id, text: '!', color: '#ffd060', turn })
      // 깨어난 개체는 같은 방 동료를 깨운다 (소리침 12)
      if (!familiar && c.room !== undefined && w.s.creatures.some((o) => o.alive && o.asleep && o.room === c.room && o.faction === c.faction)) {
        emitNoise(w, c.pos, 12, c.id)
      }
      if (familiar) continue
    } else if (reach < 0) continue
    if (c.ai.mode === 'idle' || c.ai.mode === 'wander' || c.ai.mode === 'investigate' || c.ai.mode === 'guard' || c.ai.mode === 'return') {
      c.ai.mode = 'investigate'
      c.ai.dest = { ...pos }
      c.ai.path = undefined
    }
  }
}

/** 정수 제곱근 */
function isqrt(n: number): number {
  return Math.floor(Math.sqrt(Math.max(0, n)))
}

/**
 * 냄새 누적 (07 §9.2): 매 턴 + floor(흘린 피 ml / 10)(소수부 이월), 생고기 소지 +1/턴, 재비 ×1/2.
 * 10턴마다 누적 = floor(누적 × 9/10). 반경 R = isqrt(누적)
 */
export function scentTick(w: World, c: Creature, bledMl: number) {
  const rain = weatherScent(w)
  const raw = c.bag.reduce((n, it) => n + (itemDef(w, it).food ? foodFreshness(it) <= 0 ? foodSafetyDef(w).rottenScent * it.count : itemDef(w, it).food?.raw ? it.count : 0 : 0), 0)
  c.scentCarry = (c.scentCarry ?? 0) + (bledMl / 10 + (!c.alive ? 2 : 0) + (c.activity?.kind === 'cook' ? 3 : c.activity?.kind === 'craft' && c.workJob?.recipe ? w.db.get<import('./types').RecipeDef>(c.workJob.recipe).smell ?? 0 : 0) + raw) * rain
  const gen = Math.floor(c.scentCarry)
  c.scentCarry -= gen
  c.scent = (c.scent ?? 0) + gen
  if (turnOf(w) % 10 === 0) c.scent = Math.floor((c.scent * 9) / 10)
}

export function scentStrength(w: World, c: Creature): number {
  const food=Math.max(0,...c.bag.map(i=>itemDef(w,i).food?.scentRadius??0))
  return isqrt(c.scent ?? 0)+food
}

/** 후각 배율: 인간 1/2 · 그늘 사람 1 · 포자 인간 0 · 말라붙은 자 1/2 · 융합체 2 */
export function smellMult(w: World, c: Creature): number {
  const d = w.db.creature(c.def)
  return d.smell ?? d.scentSense ?? 0.5
}

/** 냄새로 대상을 감지하는가: 거리 ≤ floor(R × 방향 배율 × 후각 배율). 바람 아래 ×(1 + 풍속/2), 위 ×1/2, 지하는 바람 0 */
export function smells(w: World, sniffer: Creature, target: Creature): boolean {
  const sense = smellMult(w, sniffer)
  if (sense <= 0) return false
  const R = scentStrength(w, target)
  if (R <= 0) return false
  let dir = 1
  if (w.s.map.kind === 'surface') {
    const wind = w.s.wind
    const speed = Math.max(Math.abs(wind.x), Math.abs(wind.y)) + regionalWindBonus(w)
    const vx = sniffer.pos.x - target.pos.x, vy = sniffer.pos.y - target.pos.y
    const dot = vx * wind.x + vy * wind.y
    const len2 = (vx * vx + vy * vy) * (wind.x * wind.x + wind.y * wind.y)
    if (speed > 0 && len2 > 0) {
      if (dot > 0 && 2 * dot * dot >= len2) dir = w.s.overworld ? weatherDef(w).windScentMult ?? 1 + speed / 2 : 1 + speed / 2
      else if (dot < 0 && 2 * dot * dot >= len2) dir = 0.5
    }
  }
  const room = w.s.map.rooms.find((r) => target.pos.x >= r.x && target.pos.x < r.x + r.w && target.pos.y >= r.y && target.pos.y < r.y + r.h)
  let enclosed = false
  if (room && !(sniffer.pos.x >= room.x && sniffer.pos.x < room.x + room.w && sniffer.pos.y >= room.y && sniffer.pos.y < room.y + room.h)) {
    enclosed = true
    for (let y = room.y - 1; y <= room.y + room.h; y++) for (let x = room.x - 1; x <= room.x + room.w; x++) {
      if (x !== room.x - 1 && x !== room.x + room.w && y !== room.y - 1 && y !== room.y + room.h) continue
      if (x < 0 || y < 0 || x >= w.s.map.w || y >= w.s.map.h) continue
      const t = w.s.map.tiles[y * w.s.map.w + x]
      if (w.db.terrain(t.t).passable) enclosed = false
    }
  }
  return cheb(sniffer.pos, target.pos) <= Math.floor(R * dir * sense * (enclosed ? 0.5 : 1))
}

// 소음·냄새 전파. 벽은 소리를 줄이고, 바람은 냄새를 실어 나른다.

import { capacity, totalBleed } from './body'
import { log, player, turnOf, type World } from './ctx'
import { cheb, DIRS, dirIndex, DIR_LABELS, type Pos } from './geom'
import { allItems, itemDef } from './items'
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
  if (w.s.weather !== 'ashrain') return 0
  return w.s.map.kind === 'surface' ? 3 : w.s.map.depth === 1 ? 1 : 0
}

/** 청각 보정: 종(그늘 사람 +2 · 포자 인간 −2) + 귀 상태 + 고철 투구 −1 */
export function hearingBonus(w: World, c: Creature): number {
  let h = w.db.creature(c.def).hearing ?? 0
  h += Math.round((capacity(w, c, 'hearing') - 1) * 3)
  if (c.equip.head && itemDef(w, c.equip.head).id === 'Item.ScrapHelmet') h -= 1
  return h
}

/** 각성 임계 (01 §8.2 · 14 §7.2): 얕은 잠 3 · 깊은 잠 8 + 피로 + 종 보정(포자 인간 +2 · 말라붙은 자 −1) */
export function wakeThreshold(w: World, c: Creature): number {
  let t = c.deepSleep ? 8 : 3
  t += c.needs.fatigue > 90 ? 3 : c.needs.fatigue > 75 ? 1 : 0
  t += traitAdd(w, c, 'wakeThreshold')
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
    // 동료의 발소리·일상 소음은 무시한다 (경보 외침은 세기 ≥ 6)
    if (src && src.faction === c.faction && strength < 6 && !c.asleep) continue
    const d = cheb(c.pos, pos)
    if (d > limit) continue
    costs ??= noiseCost(w, pos, limit)
    const pc = costs.get(c.pos.y * w.s.map.w + c.pos.x) ?? d + 8
    const reach = strength - pc - amb + hearingBonus(w, c)
    if (c.id === pl.id) {
      if (strength >= 6 && reach >= 0 && d > 2 && !w.s.visible.includes(pos.y * w.s.map.w + pos.x)) {
        const dir = DIR_LABELS[dirIndex(pos.x - c.pos.x, pos.y - c.pos.y)]
        log(w, 'flavor', `${dir}쪽 어딘가에서 소리가 났다.`)
      }
      continue
    }
    if (c.asleep) {
      if (reach < wakeThreshold(w, c)) continue
      c.asleep = false
      c.drowsyUntil = turn + (c.deepSleep ? 20 : 10)
      c.deepSleep = undefined
      c.ai.alertTurn = turn
      w.s.fx.push({ k: 'status', id: c.id, text: '!', color: '#ffd060', turn })
      // 깨어난 개체는 같은 방 동료를 깨운다 (소리침 12)
      if (c.room !== undefined && w.s.creatures.some((o) => o.alive && o.asleep && o.room === c.room && o.faction === c.faction)) {
        emitNoise(w, c.pos, 12, c.id)
      }
    } else if (reach < 0) continue
    if (c.ai.mode === 'idle' || c.ai.mode === 'wander' || c.ai.mode === 'investigate' || c.ai.mode === 'guard' || c.ai.mode === 'return') {
      c.ai.mode = 'investigate'
      c.ai.dest = { ...pos }
      c.ai.path = undefined
    }
  }
}

/** 냄새 세기: 외부 출혈 + 들고 있는 날고기 등 */
export function scentStrength(w: World, c: Creature): number {
  let s = totalBleed(w, c, true)
  for (const it of allItems(c)) s += (itemDef(w, it).food?.scent ?? 0) * it.count
  return s
}

/** 냄새로 대상을 감지하는가 (바람 방향 반영) */
export function smells(w: World, sniffer: Creature, target: Creature): boolean {
  const sense = w.db.creature(sniffer.def).scentSense ?? 0
  if (sense <= 0) return false
  const strength = scentStrength(w, target)
  if (strength <= 0.3) return false
  let range = Math.min(22, (3 + strength / 3) * sense)
  const vx = sniffer.pos.x - target.pos.x, vy = sniffer.pos.y - target.pos.y
  const dot = vx * w.s.wind.x + vy * w.s.wind.y
  if (dot > 0) range *= 1.6
  else if (dot < 0) range *= 0.5
  return cheb(sniffer.pos, target.pos) <= range
}

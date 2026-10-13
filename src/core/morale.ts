// 사기 (07 §8): 사기 = 기본 사기 + Σ사건 수정(감쇠) + 몸 상태 + 전력비 수정.
// 40 이상 정상 · 25~39 흔들림(명중 −5) · 10~24 판정마다 (25 − 사기) × 4% 도주 · 10 미만 확정 도주.

import { bloodLoss, hpMax, regionState } from './body'
import { cheb } from './geom'
import { lightLevel, canSee } from './fov'
import { turnOf, type World } from './ctx'
import { wield } from './items'
import type { Creature, Region } from './types'

type MoraleKind = 'half30' | 'fixed' | 't20' | 't30'

/** 사기 사건 기록: 아군 사망 −15(30턴 반감) · 우두머리 사망 −30(고정) · 아군 도주 −5(20턴) · 내가 처치 +5(30턴) */
export function moraleEvent(c: Creature, v: number, k: MoraleKind, turn: number) {
  const list = (c.ai.mev ??= [])
  list.push({ v, t: turn, k })
  if (list.length > 20) list.shift()
}

function hostileTo(a: Creature, b: Creature): boolean {
  if (a.faction === b.faction) return false
  if (a.faction === 'player' || b.faction === 'player') return true
  return !(a.faction === 'vermin' || b.faction === 'vermin')
}

/** 위협 = HP% × 무기 등급(공격 피해), 시야 안만 */
function threat(w: World, c: Creature): number {
  const atk = wield(w, c)?.atk
  return Math.max(0, c.hp / hpMax(w, c)) * (atk?.damage ?? 3)
}

const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']

export function moraleOf(w: World, c: Creature): number {
  const def = w.db.creature(c.def)
  if (def.noMorale) return 100
  const turn = turnOf(w)
  let m = def.morale
  for (const e of c.ai.mev ?? []) {
    const dt = turn - e.t
    if (e.k === 'fixed') m += e.v
    else if (e.k === 'half30') m += Math.trunc(e.v / (1 << Math.min(10, Math.floor(dt / 30))))
    else if (e.k === 't20' ? dt < 20 : dt < 30) m += e.v
  }
  // 자신 6부위 중 하나 중상 −10 / 불구 −20, 혈액 손실 15% −10 / 30% −20
  const worst = Math.max(...REGIONS.map((r) => regionState(w, c, r)))
  m -= worst >= 4 ? 20 : worst >= 3 ? 10 : 0
  const loss = bloodLoss(c)
  m -= loss >= 0.3 ? 20 : loss >= 0.15 ? 10 : 0
  // 전력비 수정 = clamp(−20, +10, floor((1 − 적 위협 합 / 아군 위협 합) × 10))
  let foe = 0, ally = threat(w, c)
  for (const o of w.s.creatures) {
    if (!o.alive || o.id === c.id || o.unconscious || cheb(o.pos, c.pos) > 12) continue
    if (o.faction === c.faction && o.ai.mode !== 'flee') ally += threat(w, o)
    else if (hostileTo(c, o) && o.ai.mode !== 'surrender' && canSee(w, c, o.pos)) foe += threat(w, o)
  }
  if (foe > 0) m += Math.max(-20, Math.min(10, Math.floor((1 - foe / Math.max(0.1, ally)) * 10)))
  // 빛을 싫어함: 광원 반경 안 −10 (그늘 사람)
  if (def.lightAverse && lightLevel(w, c.pos) === 0 && w.s.map.kind === 'dungeon') m -= 10
  return m
}

/** 무리 절반 손실 (그늘 사람 '무리 절반을 잃으면 도주') */
export function packHalved(w: World, c: Creature): boolean {
  if (!w.db.creature(c.def).packFlee || c.room === undefined) return false
  const R = w.s.map.rooms[c.room]
  const orig = R?.residents?.length ?? 0
  if (orig < 2) return false
  const alive = w.s.creatures.filter((o) => o.alive && o.room === c.room && o.faction === c.faction && o.ai.mode !== 'flee').length
  return alive * 2 <= orig
}

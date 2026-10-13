// TU 스케줄러 정렬 키 (01 §3.1): readyAt → phase(0 시스템 · 1 반응 · 2 일반) → −주도권 → seq(플레이어 0).
// phase 0(신체·환경 틱)은 advanceTo가 턴 경계를 넘을 때 행위자보다 먼저 돌린다.

import { turnOf, type World } from './ctx'
import type { Creature } from './types'

/** 반응 자세(창벽·받아넘기기 자세)면 phase 1 */
const STANCE_EFFECTS = new Set(['spearWall', 'parryStance'])

/** 반응속도 = 민첩 × 2 + 지각. 기절·수면이면 0 (01 §3.2) */
export function initiative(c: Creature): number {
  if (c.unconscious || c.asleep) return 0
  return c.stats.agi * 2 + c.stats.per
}

export function phaseOf(w: World, c: Creature): 1 | 2 {
  const turn = turnOf(w)
  return c.effects.some((e) => STANCE_EFFECTS.has(e.kind) && e.untilTurn > turn) ? 1 : 2
}

/** 생성 순서: 플레이어 = 0, 그 밖은 id */
const seqOf = (w: World, c: Creature) => (c.id === w.s.playerId ? 0 : c.id)

/** a가 b보다 먼저 행동하는가 */
export function actsBefore(w: World, a: Creature, b: Creature): boolean {
  if (a.nextAct !== b.nextAct) return a.nextAct < b.nextAct
  const pa = phaseOf(w, a), pb = phaseOf(w, b)
  if (pa !== pb) return pa < pb
  const ia = initiative(a), ib = initiative(b)
  if (ia !== ib) return ia > ib
  return seqOf(w, a) < seqOf(w, b)
}

export function nextActor(w: World): Creature | undefined {
  let best: Creature | undefined
  for (const c of w.s.creatures) if (c.alive && (!best || actsBefore(w, c, best))) best = c
  return best
}

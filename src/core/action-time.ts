import {fatigueBand} from './fatigue-state'
// 다턴 시간과 적대 인식. 시술자와 환자의 처치를 같은 시간 규칙으로 진행한다.
import { alcoholStage } from './drug-state'
import { machineProtecting, machineRules } from './machine-state'
import { bloodLoss, capacity, handCapacity, PAIN_MULTI, painStage, painTotal, regionPenalties } from './body'
import { turnOf, type World } from './ctx'
import { hostile } from './diplomacy'
import { lightLevel } from './fov'
import { thirstBand } from './nutrition-state'
import { hasEffect, traitMul } from './traits'
import type { Creature } from './types'

/** 다턴 행동 배율 (01 §5.1): 조작 · 팔 · 피로 · 탈수 · 통증 · 실혈 · 추위 · 쇼크 · 술 · 공포 · 조명 · 잠기운. ×4 초과면 불가 */
export function multiTurnFactor(w: World, c: Creature, opts: { equip?: boolean; dexterous?: boolean; arm?: 'larm' | 'rarm' } = {}): number {
  const turn = turnOf(w)
  const k = opts.arm ? handCapacity(w, c, opts.arm === 'larm' ? 'Left' : 'Right') : capacity(w, c, 'manipulation')
  if (k < 0.1) return Infinity
  if(machineRules(w,c))return (machineProtecting(w,c)?1.5:1)/k
  let f = 1 / k
  f *= regionPenalties(w, c, opts.arm).multiTurn
  const n = c.needs
  f *= fatigueBand(w,c).multiTurn
  f *= thirstBand(w, c).turns
  f *= PAIN_MULTI[painStage(painTotal(w, c))]
  const loss = bloodLoss(c)
  f *= loss >= 0.3 ? 1.2 : loss >= 0.15 ? 1.05 : 1
  f *= n.bodyTemp < 34 ? 1.5 : n.bodyTemp < 35 ? 1.25 : n.bodyTemp < 36 ? 1.1 : 1
  if (opts.equip && n.wetness > 50) f *= 1.2
  if (c.cond?.shock) f *= 1.2
  f *= [1, 1.05, 1.15, 1.35][alcoholStage(w, c)]
  if (hasEffect(c, 'panic', turn) || n.stress > 85) f *= 1.2
  const lv = lightLevel(w, c.pos)
  f *= lv === 3 ? 1.5 : lv === 2 ? 1.2 : 1
  if ((c.drowsyUntil ?? 0) > turn) f *= 1.3
  if (opts.dexterous !== false) f *= traitMul(w, c, 'manipulationTime')
  return f
}

/** 실제 턴 = ceil(기본 턴 × Π배율). ×4를 넘으면 null (할 수 없다) */
export function channelTurns(w: World, c: Creature, base: number, opts: { equip?: boolean; dexterous?: boolean; arm?: 'larm' | 'rarm' } = {}): number | null {
  const f = multiTurnFactor(w, c, opts)
  if (f > 4) return null
  return Math.max(1, Math.ceil(base * f - 1e-9))
}

/** 적대 개체가 나를 인식한 상태 (13 §8.3) */
export function hostileAware(w: World, c: Creature): boolean {
  return w.s.creatures.some((o) => o.alive && !o.asleep && !o.unconscious && o.id !== c.id && hostile(w, c, o) && o.ai.mode === 'hunt' && o.ai.target === c.id)
}


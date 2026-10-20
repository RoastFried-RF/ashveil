// 기계의 물리 상태는 생물학적 욕구·혈액·통증에 의존하지 않는다.
import { clamp, turnOf, type World } from './ctx'
import type { Creature, MechanicalRules } from './types'

export function machineRules(w: World, c: Creature): MechanicalRules | undefined {
  const body = w.db.body(c.body.def)
  return body.kind === 'mechanical' ? body.mechanical : undefined
}
export function machineReady(w: World, c: Creature): boolean {
  const m = c.body.machine
  return !!m && m.power > 0 && m.shutdownUntil <= turnOf(w)
}
export function machineProtecting(w: World, c: Creature): boolean {
  const d = machineRules(w, c)
  return !!d && (c.body.machine?.heat ?? 0) >= d.protectiveHeat
}
export function machineAction(w: World, c: Creature, kind: 'move' | 'attack' | 'weld') {
  const d = machineRules(w, c), m = c.body.machine
  if (!d || !m) return
  m.heat = clamp(m.heat + (kind === 'move' ? d.moveHeat : kind === 'weld' ? d.weldHeat : d.attackHeat), 0, 100)
  m.power = Math.max(0, m.power - d.actionPower)
  if(kind!=='move')m.attacks=(m.attacks??0)+1
}

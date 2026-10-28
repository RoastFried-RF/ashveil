// 의수족의 물리적 범위와 기능. body.ts를 가져오지 않아 신체 계산에서 안전하게 조회한다.
import { clamp, turnOf, type World } from './ctx'
import { ambientTemp } from './environment'
import type { Creature, ProstheticDef, ProstheticState } from './types'

export function prostheticAt(w: World, c: Creature, id: string): { root: string; state: ProstheticState; rule: ProstheticDef } | undefined {
  if (!c.body.prosthetics) return undefined
  const parts = w.db.body(c.body.def).parts
  let current: string | undefined = id
  while (current) {
    const state = c.body.prosthetics?.[current]
    if (state) return { root: current, state, rule: w.db.get<ProstheticDef>(state.def) }
    current = parts.find((p) => p.id === current)?.parent
  }
}
export function prostheticEfficiency(w: World, c: Creature, root: string, state: ProstheticState): number {
  const d = w.db.get<ProstheticDef>(state.def), now = turnOf(w)
  if (d.powerTurns && (state.powerUntil ?? now) <= now) return 0
  const bonus = d.efficiency > 0 ? c.body.amputationQuality?.[root] ?? 0 : 0
  let value = (d.efficiency + bonus) * clamp((state.item.durability ?? 100) / 100, 0, 1)
  if (d.maintenanceTurns && now - state.servicedAt >= d.maintenanceTurns) value *= d.overdueMult ?? 1
  if (d.coldThreshold !== undefined && ambientTemp(w, c.pos) < d.coldThreshold) value *= d.coldMult ?? 1
  return clamp(value, 0, 1.2)
}
/** 대체한 뿌리에만 효율을 곱한다. 그 아래 손가락/발가락에 중복 적용하지 않는다. */
export function prostheticPartEfficiency(w: World, c: Creature, id: string): number | undefined {
  const p = prostheticAt(w, c, id)
  if (!p) return undefined
  const efficiency = prostheticEfficiency(w, c, p.root, p.state)
  return id === p.root ? efficiency : efficiency > 0 ? 1 : 0
}
export function prostheticKey(w: World, c: Creature): string {
  return Object.entries(c.body.prosthetics ?? {}).map(([root, s]) => `${root}:${s.def}:${s.item.uid}:${prostheticEfficiency(w, c, root, s)}`).join(';')
}
export function prostheticGrip(w: World, c: Creature, side: 'Left' | 'Right'): boolean {
  return prostheticAt(w, c, `${side}Hand`)?.rule.grip !== false
}
export function prostheticNoise(w: World, c: Creature): number {
  return Object.values(c.body.prosthetics ?? {}).reduce((n, s) => n + (w.db.get<ProstheticDef>(s.def).noise ?? 0), 0)
}
export function prostheticIceSlip(w: World, c: Creature): number {
  return Object.values(c.body.prosthetics ?? {}).reduce((n, s) => Math.max(n, w.db.get<ProstheticDef>(s.def).iceSlipMult ?? 1), 1)
}
export function prostheticFirstImpression(w: World, c: Creature): number {
  return Object.values(c.body.prosthetics ?? {}).filter(s=>Number.isFinite(s.item.durability??100)&&(s.item.durability??100)>0).reduce((n, s) => n + (w.db.get<ProstheticDef>(s.def).firstImpression ?? 0), 0)
}

/** 갈고리는 일반 조작.3과 별개로 양손 무기 보조.5를 제공한다. */
export function prostheticSupport(w: World, c: Creature, side: 'Left' | 'Right'): number | undefined {
  const p = prostheticAt(w, c, `${side}Hand`)
  if (!p || p.rule.twoHandSupport === undefined) return undefined
  const base = p.rule.efficiency + (c.body.amputationQuality?.[p.root] ?? 0)
  return p.rule.twoHandSupport * (base > 0 ? prostheticEfficiency(w, c, p.root, p.state) / base : 0)
}

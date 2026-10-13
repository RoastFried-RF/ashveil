import type { World } from './ctx'
import type { Creature } from './types'

/** 곱연산 특성 수정치 (기본 1) */
export function traitMul(w: World, c: Creature, key: string): number {
  let v = 1
  for (const t of c.traits) {
    const m = w.db.trait(t).mods?.[key]
    if (typeof m === 'number') v *= m
  }
  return v
}

/** 합연산 특성 수정치 (기본 0) */
export function traitAdd(w: World, c: Creature, key: string): number {
  let v = 0
  for (const t of c.traits) {
    const m = w.db.trait(t).mods?.[key]
    if (typeof m === 'number') v += m
  }
  return v
}

/** 덮어쓰기형 수정치 (없으면 undefined) */
export function traitOverride(w: World, c: Creature, key: string): number | undefined {
  let v: number | undefined
  for (const t of c.traits) {
    const m = w.db.trait(t).mods?.[key]
    if (typeof m === 'number') v = m
  }
  return v
}

export function hasEffect(c: Creature, kind: string, turn: number): boolean {
  return c.effects.some((e) => e.kind === kind && e.untilTurn > turn)
}

export function addEffect(c: Creature, kind: string, untilTurn: number, magnitude?: number) {
  const ex = c.effects.find((e) => e.kind === kind)
  if (ex) {
    ex.untilTurn = Math.max(ex.untilTurn, untilTurn)
    if (magnitude !== undefined) ex.magnitude = magnitude
  } else c.effects.push({ kind, untilTurn, magnitude })
}

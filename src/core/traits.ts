// 수정치 파이프라인: 특성 + 생물 고유 + 배운 패시브 능력 + 장비 수정치를 한 곳에서 합산

import type { World } from './ctx'
import type { AbilityDef, Creature, ItemInst } from './types'

function* modSources(w: World, c: Creature): Generator<Partial<Record<string, number>>> {
  for (const t of c.traits) {
    const m = w.db.trait(t).mods
    if (m) yield m
  }
  const cm = w.db.creature(c.def).mods
  if (cm) yield cm
  for (const a of c.abilities ?? []) {
    const d = w.db.tryGet<AbilityDef>(a)
    if (d && d.kind === 'passive' && d.mods) yield d.mods
  }
  for (const it of Object.values(c.equip ?? {}) as (ItemInst | undefined)[]) {
    if (!it) continue
    const m = w.db.item(it.def).mods
    if (m) yield m
  }
}

/** 곱연산 수정치 (기본 1) */
export function traitMul(w: World, c: Creature, key: string): number {
  let v = 1
  for (const m of modSources(w, c)) if (typeof m[key] === 'number') v *= m[key]!
  return v
}

/** 합연산 수정치 (기본 0) */
export function traitAdd(w: World, c: Creature, key: string): number {
  let v = 0
  for (const m of modSources(w, c)) if (typeof m[key] === 'number') v += m[key]!
  return v
}

/** 덮어쓰기형 (없으면 undefined) */
export function traitOverride(w: World, c: Creature, key: string): number | undefined {
  let v: number | undefined
  for (const m of modSources(w, c)) if (typeof m[key] === 'number') v = m[key]
  return v
}

export function hasEffect(c: Creature, kind: string, turn: number): boolean {
  return c.effects.some((e) => e.kind === kind && e.untilTurn > turn)
}

export function effectMag(c: Creature, kind: string, turn: number): number {
  const e = c.effects.find((x) => x.kind === kind && x.untilTurn > turn)
  return e?.magnitude ?? 0
}

export function addEffect(c: Creature, kind: string, untilTurn: number, magnitude?: number) {
  const ex = c.effects.find((e) => e.kind === kind)
  if (ex) {
    ex.untilTurn = Math.max(ex.untilTurn, untilTurn)
    if (magnitude !== undefined) ex.magnitude = magnitude
  } else c.effects.push({ kind, untilTurn, magnitude })
}

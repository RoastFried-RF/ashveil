// 수정치 파이프라인: 특성 + 생물 고유 + 배운 패시브 능력 + 장비 수정치를 한 곳에서 합산

import { nutritionStat } from './nutrition-state'
import type { World } from './ctx'
import type { AbilityDef, BackgroundDef, Creature, ItemInst, Stats, GrowthDef } from './types'

function* modSources(w: World, c: Creature): Generator<Partial<Record<string, number>>> {
  if (c.age) {
    const growth = w.db.tryGet<GrowthDef>('Growth.Human')
    const band = growth?.ageBands.filter((b) => b.min <= c.age!.years).sort((a, b) => b.min - a.min)[0]
    if (band?.mods) yield band.mods
    if (c.age.senses) yield { sightCap: .9, hearingCap: .9 }
  }

  for (const t of c.traits) {
    const m = w.db.trait(t).mods
    if (m) yield m
  }
  const cm = w.db.creature(c.def).mods
  if (cm) yield cm
  if (c.background) {
    const bm = w.db.tryGet<BackgroundDef>(c.background)?.mods
    if (bm) yield bm
  }
  // 갈래 패시브는 그 계열 무기로 싸울 때만 (15 §7)
  let fam: string | undefined | null = null
  for (const a of c.abilities ?? []) {
    const d = w.db.tryGet<AbilityDef>(a)
    if (!d || d.kind !== 'passive' || !d.mods) continue
    if (d.weapon) {
      if (fam === null) fam = mainFamily(w, c)
      if (fam !== d.weapon) continue
    }
    yield d.mods
  }
  for (const it of Object.values(c.equip ?? {}) as (ItemInst | undefined)[]) {
    if (!it) continue
    const m = w.db.item(it.def).mods
    if (m) yield m
  }
}

function mainFamily(w: World, c: Creature): string | undefined {
  const m = c.equip?.main
  const d = m ? w.db.item(m.def) : undefined
  return d?.attacks?.[0]?.family ?? w.db.creature(c.def).naturalAttack?.family
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

/** 특성·능력·장비의 능력치 보정. 원래 능력치는 저장·레벨업에 보존한다. */
export function effectiveStat(w: World, c: Creature, key: keyof Stats): number {
  return Math.max(1, Math.min(20, c.stats[key] + traitAdd(w, c, `stat_${key}`) + nutritionStat(w, c, key)))
}

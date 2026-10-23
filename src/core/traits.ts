// 수정치 파이프라인: 특성 + 생물 고유 + 배운 패시브 능력 + 장비 수정치를 한 곳에서 합산

import { nutritionStat } from './nutrition-state'
import type { World } from './ctx'
import type { AbilityDef, BackgroundDef, Creature, ItemInst, Stats, GrowthDef } from './types'

type ModifierMode = 'mul' | 'add' | 'override'
function combine(value: number | undefined, next: unknown, mode: ModifierMode): number | undefined {
  if (typeof next !== 'number') return value
  return mode === 'mul' ? value! * next : mode === 'add' ? value! + next : next
}

// 원래 원천 순서를 유지한다. 질의마다 generator/중간 수정치 객체를 만들거나
// 턴 단위 캐시를 쓰지 않아 같은 TU의 장비·특성·배운 능력 변화도 바로 읽는다.
function modifier(w: World, c: Creature, key: string, mode: ModifierMode): number | undefined {
  let value: number | undefined = mode === 'mul' ? 1 : mode === 'add' ? 0 : undefined
  if (c.age) {
    const growth = w.db.tryGet<GrowthDef>('Growth.Human')
    let band: GrowthDef['ageBands'][number] | undefined
    for (const candidate of growth?.ageBands ?? []) {
      if (candidate.min <= c.age.years && (!band || candidate.min > band.min)) band = candidate
    }
    value = combine(value, band?.mods?.[key], mode)
    if (c.age.senses && (key === 'sightCap' || key === 'hearingCap')) value = combine(value, .9, mode)
  }

  for (const t of c.traits) {
    value = combine(value, w.db.trait(t).mods?.[key], mode)
  }
  value = combine(value, w.db.creature(c.def).mods?.[key], mode)
  if (c.background) {
    value = combine(value, w.db.tryGet<BackgroundDef>(c.background)?.mods?.[key], mode)
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
    value = combine(value, d.mods[key], mode)
  }
  for (const it of Object.values(c.equip ?? {}) as (ItemInst | undefined)[]) {
    if (!it) continue
    value = combine(value, w.db.item(it.def).mods?.[key], mode)
  }
  return value
}

function mainFamily(w: World, c: Creature): string | undefined {
  const m = c.equip?.main
  const d = m ? w.db.item(m.def) : undefined
  return d?.attacks?.[0]?.family ?? w.db.creature(c.def).naturalAttack?.family
}

/** 곱연산 수정치 (기본 1) */
export function traitMul(w: World, c: Creature, key: string): number {
  return modifier(w, c, key, 'mul')!
}

/** 합연산 수정치 (기본 0) */
export function traitAdd(w: World, c: Creature, key: string): number {
  return modifier(w, c, key, 'add')!
}

/** 덮어쓰기형 (없으면 undefined) */
export function traitOverride(w: World, c: Creature, key: string): number | undefined {
  return modifier(w, c, key, 'override')
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

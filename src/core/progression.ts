// 성장: 경험치 → 레벨 → 능력치 1 + 능력 포인트 1

import { log, turnOf, TURNS_PER_DAY, type World } from './ctx'
import type { AbilityDef, Creature, Stats } from './types'

export const MAX_LEVEL = 20
export const STAT_CAP = 20

/** 레벨 L → L+1 에 필요한 경험치 (레벨당 필요량, CANON 7.2 · 15 §2) = 100 × L × (L+1) / 2 */
export function xpNeed(level: number): number {
  return (100 * level * (level + 1)) / 2
}

/** 레벨 L 에 도달하는 누적 경험치 = 100 × (L−1) × L × (L+1) / 6 → L2 100 · L3 400 · L4 1,000 */
export function xpTotalFor(level: number): number {
  return (100 * (level - 1) * level * (level + 1)) / 6
}

/** 다음 레벨까지의 누적 문턱 (c.xp 는 누적값) */
export function xpToNext(level: number): number {
  return xpTotalFor(level + 1)
}

export function gainXp(w: World, c: Creature, amount: number, reason?: string) {
  if (c.faction !== 'player' || amount <= 0) return
  c.xp += amount
  // 경험치 숫자는 회색 "+15" (12 §2.5, 피해 숫자와 구분)
  if (reason) w.s.fx.push({ k: 'xp', id: c.id, v: amount, turn: turnOf(w) })
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
    c.level++
    c.statPoints++
    c.abilityPoints++
    w.s.fx.push({ k: 'level', id: c.id, turn: turnOf(w) })
    log(w, 'good', `레벨 ${c.level}! 능력치 포인트와 능력 포인트를 얻었다. (C: 캐릭터 · K: 능력)`)
    c.history.push({ turn: turnOf(w), kind: 'level', text: `레벨 ${c.level} 달성` })
  }
}

/** 적을 꺾은 대가: 처치·항복 = 전액, 도주시킴 = 50%, 재점거 개체 ×0.5 (15 §3) */
export function awardDefeat(w: World, pl: Creature, c: Creature, mult: number, how: string) {
  if (c.xpAwarded || pl.faction !== 'player' || !pl.alive) return
  c.xpAwarded = true
  const base = w.db.creature(c.def).xp ?? 10
  const amount = Math.round(base * mult * (c.reoccupied ? 0.5 : 1))
  gainXp(w, pl, amount, `${c.name} ${how}`)
}

/** 위기 극복: 같은 종류는 게임일당 1회 (15 §3) */
export function awardCrisis(w: World, pl: Creature, kind: string, amount: number, text: string) {
  const day = Math.floor(turnOf(w) / TURNS_PER_DAY)
  const cw = (pl.crisis ??= { last: {}, arterial: [], bleeding: false, wasUnconscious: false })
  if (cw.last[kind] === day) return
  cw.last[kind] = day
  log(w, 'good', `위기를 넘겼다: ${text}`)
  gainXp(w, pl, amount, text)
}

export const STAT_LABEL: Record<keyof Stats, string> = { str: '근력', agi: '민첩', per: '지각', vit: '활력', wil: '의지' }

export function spendStat(c: Creature, stat: keyof Stats): string | null {
  if (c.statPoints <= 0) return '능력치 포인트가 없다'
  if (c.stats[stat] >= STAT_CAP) return '더 올릴 수 없다'
  c.statPoints--
  c.stats[stat]++
  if (stat === 'vit') c.hp += 5 // 15 §4: 활력 +1 → 최대 HP +5, 현재 HP +5
  return null
}

export function canLearn(w: World, c: Creature, id: string): string | null {
  const d = w.db.ability(id)
  if (c.abilities.includes(id)) return '이미 배웠다'
  if (c.abilityPoints <= 0) return '능력 포인트가 없다'
  // 15 §7: ①② 는 조건 없음, ③④ 는 같은 갈래 능력 1개 이상 (+ 명시된 선행)
  const inTree = c.abilities.filter((a) => w.db.ability(a).tree === d.tree).length
  if (d.tree === 'unique') return '배울 수 없는 능력'
  if (d.tier >= 3 && inTree < 1) return `${treeLabel(d.tree)} 갈래 능력을 하나 이상 먼저 배워야 한다`
  for (const r of d.requires ?? []) if (!c.abilities.includes(r)) return `먼저 '${w.db.ability(r).label}'을(를) 배워야 한다`
  return null
}

export function learnAbility(w: World, c: Creature, id: string): string | null {
  const err = canLearn(w, c, id)
  if (err) return err
  c.abilityPoints--
  c.abilities.push(id)
  const d = w.db.ability(id)
  if (d.kind !== 'passive') {
    const free = c.hotbar.findIndex((h) => h === null)
    if (free >= 0 && !c.hotbar.some((h) => h?.kind === 'ability' && h.id === id)) c.hotbar[free] = { kind: 'ability', id }
  }
  log(w, 'good', `능력을 배웠다: ${d.label}`)
  return null
}

export const TREES: { id: string; label: string }[] = [
  { id: 'blade', label: '도검' }, { id: 'axe', label: '도끼' }, { id: 'blunt', label: '둔기' },
  { id: 'spear', label: '창' }, { id: 'archery', label: '궁술' }, { id: 'survival', label: '생존' },
]

export function treeLabel(id: string): string {
  return TREES.find((t) => t.id === id)?.label ?? id
}

export function abilitiesByTree(w: World): Record<string, AbilityDef[]> {
  const out: Record<string, AbilityDef[]> = {}
  // 고유 능력(적 전용)은 배울 수 없다
  for (const a of w.db.all<AbilityDef>('Ability')) if (a.tree !== 'unique') (out[a.tree] ??= []).push(a)
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.tier - b.tier)
  return out
}

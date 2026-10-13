// 성장: 경험치 → 레벨 → 능력치 1 + 능력 포인트 1

import { hpMax } from './body'
import { log, turnOf, type World } from './ctx'
import type { AbilityDef, Creature, Stats } from './types'

/** 레벨 L 에서 L+1 이 되는 데 필요한 누적 경험치 = 100 × L × (L+1) / 2 */
export function xpToNext(level: number): number {
  return (100 * level * (level + 1)) / 2
}

export function gainXp(w: World, c: Creature, amount: number, reason?: string) {
  if (c.faction !== 'player' || amount <= 0) return
  c.xp += amount
  if (reason) w.s.fx.push({ k: 'status', id: c.id, text: `+${amount} 경험치`, color: '#d9c27a', turn: turnOf(w) })
  while (c.xp >= xpToNext(c.level)) {
    c.level++
    c.statPoints++
    c.abilityPoints++
    c.hp = Math.min(hpMax(w, c), c.hp + hpMax(w, c) * 0.25)
    w.s.fx.push({ k: 'level', id: c.id, turn: turnOf(w) })
    log(w, 'good', `레벨 ${c.level}! 능력치 포인트와 능력 포인트를 얻었다. (C: 캐릭터 · K: 능력)`)
    c.history.push({ turn: turnOf(w), kind: 'level', text: `레벨 ${c.level} 달성` })
  }
}

export const STAT_LABEL: Record<keyof Stats, string> = { str: '근력', agi: '민첩', per: '지각', vit: '활력', wil: '의지' }

export function spendStat(c: Creature, stat: keyof Stats): string | null {
  if (c.statPoints <= 0) return '능력치 포인트가 없다'
  if (c.stats[stat] >= 30) return '더 올릴 수 없다'
  c.statPoints--
  c.stats[stat]++
  return null
}

export function canLearn(w: World, c: Creature, id: string): string | null {
  const d = w.db.ability(id)
  if (c.abilities.includes(id)) return '이미 배웠다'
  if (c.abilityPoints <= 0) return '능력 포인트가 없다'
  const inTree = c.abilities.filter((a) => w.db.ability(a).tree === d.tree).length
  if (inTree < d.tier - 1) return `${treeLabel(d.tree)} 계열을 ${d.tier - 1}개 이상 먼저 배워야 한다`
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
  for (const a of w.db.all<AbilityDef>('Ability')) (out[a.tree] ??= []).push(a)
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.tier - b.tier)
  return out
}

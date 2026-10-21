import { rng, type World } from './ctx'
import { effectiveStat } from './traits'
import type { Creature, ItemInst, KnowledgeDef } from './types'

/** 발굴 정제의 한 더미가 공유하는 상태. 구형 물품은 다시 굴리지 않는다. */
export function makePillAge(w: World): ItemInst['pillAge'] {
  const rule = w.db.tryGet<KnowledgeDef>('Knowledge.Human')?.pillAging
  if (!rule) return undefined
  const stream = rng(w, 'items.pill-aging')
  return { potency: stream.int(rule.minPotency, rule.maxPotency), spoiled: stream.chance(rule.spoilChance) }
}

export const pillPotency = (it: ItemInst): number => (it.pillAge?.potency ?? 100) / 100

/** 보이는 가장자리만 관찰한다. 정체·실제 효력·숨은 변질 여부를 공개하지 않는다. */
export function pillAgeLines(w: World, c: Creature, it: ItemInst): string[] {
  const rule = w.db.tryGet<KnowledgeDef>('Knowledge.Human')?.pillAging
  if (!it.pillAge || !rule) return []
  const lines = ['오래된 발굴 정제 · 더미마다 효력이 다를 수 있다. 외형 감별은 원래 약의 종류를 뜻한다.']
  if (it.pillAge.spoiled && effectiveStat(w, c, 'per') >= rule.noticePer) lines.push('가장자리가 누렇다.')
  return lines
}

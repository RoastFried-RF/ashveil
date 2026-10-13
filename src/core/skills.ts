// 사용 기반 숙련: xp = 4 × L² (L20 = 1600xp, L40 = 6400xp)

import { log, type World } from './ctx'
import type { Creature } from './types'

export function skillLevel(c: Creature, skill: string): number {
  const xp = c.skills[skill] ?? 0
  return Math.floor(Math.sqrt(xp / 4))
}

export function xpForLevel(level: number): number {
  return 4 * level * level
}

/** 경험치 획득. 열정 1(관심) ×1.5, 2(열정) ×2. 피로하면 절반 */
export function gainXp(w: World, c: Creature, skill: string, amount: number) {
  const before = skillLevel(c, skill)
  const passion = c.passions[skill] ?? 0
  let mult = passion === 2 ? 2 : passion === 1 ? 1.5 : 1
  if (c.needs.fatigue > 70) mult *= 0.5
  c.skills[skill] = (c.skills[skill] ?? 0) + amount * mult
  const after = skillLevel(c, skill)
  if (after > before && c.faction === 'player' && w.db.has(skill)) {
    log(w, 'good', `${w.db.skill(skill).label} 숙련이 ${after}이(가) 되었다.`)
  }
}

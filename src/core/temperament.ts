import { hostile } from './diplomacy'
// 특성의 조건형 효과. 기록형 사고와 달리 현재 상태에서만 파생한다.
import { bodyDef, totalBleed } from './body'
import type { World } from './ctx'
import { canSee } from './fov'
import { cheb } from './geom'
import { itemDef, qualityOf } from './items'
import { traitAdd,traitOverride } from './traits'
import type { Creature } from './types'

export function bleedingEnemyNear(w: World, c: Creature): boolean {
  return w.s.creatures.some((o) => o.alive && o.id !== c.id && hostile(w, c, o) && cheb(o.pos, c.pos) <= 3 && canSee(w, c, o.pos) && totalBleed(w, o) > 0)
}
export function temperamentThoughts(w: World, c: Creature) {
  const out: { def: string; label: string; mood: number; count: number }[] = []
  const add = (def: string, label: string, value: number) => { if (value) out.push({ def, label, mood: value, count: 1 }) }
  add('Temperament.Mood', '기질', traitAdd(w, c, 'mood'))
  if (traitAdd(w, c, 'bloodMood') && bleedingEnemyNear(w, c)) add('Temperament.Blood', '피 냄새에 취함', traitAdd(w, c, 'bloodMood'))
  if (traitAdd(w, c, 'aloneMood') && !w.s.creatures.some((o) => o.alive && o.id !== c.id && bodyDef(w,o).kind==='humanoid' && cheb(o.pos, c.pos) <= (traitOverride(w,c,'aloneRadius')??8) && canSee(w, c, o.pos))) add('Temperament.Alone', '홀로 있는 평온', traitAdd(w, c, 'aloneMood'))
  const equipped = Object.values(c.equip).filter((i) => !!i)
  if (equipped.some((i) => (i!.rust ?? 0) > 0 || (i!.edge !== undefined && i!.edge < (traitOverride(w,c,'neatEdgeThreshold')??50)))) add('Temperament.Neat', '손질되지 않은 장비', traitAdd(w, c, 'neatGearMood'))
  if (equipped.some((i) => !!itemDef(w, i!).apparel && qualityOf(i!) >= 2)) add('Temperament.Clothes', '좋은 옷을 입었다', traitAdd(w, c, 'fineClothesMood'))
  return out
}

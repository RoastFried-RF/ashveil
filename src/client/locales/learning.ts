/** Render the core's actual refusal; unknown/modded reasons remain verbatim. */
import type {AbilityDef, Creature, World} from '../../core'
import {treeLabel} from '../../core'
import {defText, t} from '../locale'

export function learningReason(w:World, person:Creature, ability:AbilityDef, source:string):string {
  for (const plain of ['이미 배웠다','능력 포인트가 없다','배울 수 없는 능력']) if (source === plain) return t(plain)
  const tree = treeLabel(ability.tree)
  if (source === `${tree} 갈래 능력을 하나 이상 먼저 배워야 한다`) return t('{0} 갈래 능력을 하나 이상 먼저 배워야 한다',t(tree))
  for (const id of ability.requires ?? []) {
    if (person.abilities.includes(id)) continue
    const prerequisite = w.db.ability(id)
    if (source === `먼저 '${prerequisite.label}'을(를) 배워야 한다`) return t("먼저 '{0}'을(를) 배워야 한다",defText(prerequisite))
  }
  return source
}

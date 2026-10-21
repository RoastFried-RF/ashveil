import type {World} from '../../core/ctx'
import type {Creature} from '../../core/types'

/** 저장된 외형 선택은 보존하고 현재 Def가 지정한 표시 대체만 한 번 적용한다. */
export function creatureSprite(w:World,c:Creature):string{
  const aliases=w.db.creature(c.def).characterAliases
  return aliases&&Object.hasOwn(aliases,c.sprite)?aliases[c.sprite]:c.sprite
}

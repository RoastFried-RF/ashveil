import type {World} from '../../core/ctx'
import type {Creature} from '../../core/types'

/** 저장 선택을 보존한다. 명시한 Def 대응을 우선하고 기본 플레이어만 새 원본으로 표시한다. */
export function creatureSprite(w:World,c:Creature):string{
  const aliases=w.db.creature(c.def).characterAliases
  if(aliases&&Object.hasOwn(aliases,c.sprite))return aliases[c.sprite]
  return c.id===w.s.playerId&&c.sprite==='hero'?'original_wanderer_hero':c.sprite
}

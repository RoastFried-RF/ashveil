import { creatureAt, eq, inBounds, type Pos, type World } from '../core'
import { mapVisibility } from './map-memory'

/** 맵 클릭은 실제 표시 중인 개체만 해석한다. 기억한 빈칸은 같은 이동 문맥을 쓴다. */
export function observedClickActors(w: World, pos: Pos) {
  if (!inBounds(w, pos) || !mapVisibility(w).has(pos.y * w.s.map.w + pos.x)) return {}
  return {
    actor: creatureAt(w, pos),
    corpse: [...w.s.creatures].reverse().find(c => !c.alive && c.deathCause !== 'escaped' && eq(c.pos, pos)),
  }
}

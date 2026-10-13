// 스토리텔러(장소 기반): 적은 맵 가장자리에서 솟아나지 않는다.
// 이미 존재하는 거점(약탈자 야영지)의 무리가 밤에 순찰을 나서는 식으로만 사건이 일어난다.

import { log, rng, turnOf, type World } from './ctx'
import { isNight } from './environment'

/** 순찰 간격(턴). 100TU=1턴=3초 → 7200턴 ≈ 6시간 */
export const PATROL_COOLDOWN = 7200

export function storytellerTick(w: World) {
  const st = w.s.storyteller
  const turn = turnOf(w)
  if (w.s.map.kind !== 'surface' || turn % 100 !== 0) return
  if (!isNight(w) || turn - st.lastEventTurn < PATROL_COOLDOWN) return
  const reavers = w.s.creatures.filter((c) => c.alive && c.faction === 'reavers' && !c.asleep && c.ai.mode === 'guard' && c.def === 'Creature.Reaver')
  if (reavers.length < 2) return
  const r = rng(w, 'story')
  const stairs = w.s.map.links[0]?.pos
  if (!stairs) return
  for (const c of r.shuffle([...reavers]).slice(0, 2)) {
    c.ai.mode = 'investigate'
    c.ai.dest = { x: stairs.x + r.int(-3, 3), y: stairs.y + 7 + r.int(0, 3) }
    c.ai.path = undefined
  }
  st.lastEventTurn = turn
  st.history.push({ turn, event: 'Event.ReaverPatrol' })
  log(w, 'flavor', w.db.event('Event.ReaverPatrol').hint ?? '')
}

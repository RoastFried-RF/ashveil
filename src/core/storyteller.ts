// 장소 기반 사건 (10 · 14 §10): 적은 맵 가장자리에서 솟아나지 않는다.
// 이미 있는 거점(약탈자 야영지)의 사람들이 정해진 경로를 걸어서 순찰한다.

import { log, rng, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'

/** 순찰: 매일 06:00, 야영지 인원 ≥ 4이면 50% → 2~3명 (두목 제외), 경유지마다 30분 대기 */
export const PATROL_HOUR = 6
export const PATROL_CHANCE = 0.5
export const PATROL_MIN_CAMP = 4
export const PATROL_WAIT = TURNS_PER_HOUR / 2

export function storytellerTick(w: World) {
  const st = w.s.storyteller
  const turn = turnOf(w)
  const map = w.s.map
  if (map.kind !== 'surface' || !map.waypoints) return
  if (turn % TURNS_PER_DAY !== PATROL_HOUR * TURNS_PER_HOUR || st.lastEventTurn === turn) return
  st.lastEventTurn = turn
  const camp = w.s.creatures.filter((c) => c.alive && c.faction === 'reavers' && c.ai.mode !== 'flee' && c.ai.mode !== 'surrender')
  if (camp.length < PATROL_MIN_CAMP) return
  const r = rng(w, 'story')
  if (!r.chance(PATROL_CHANCE)) return
  const pool = camp.filter((c) => c.def !== 'Creature.ReaverChief' && !c.unconscious && c.ai.mode !== 'hunt')
  const n = Math.min(pool.length, r.int(2, 3))
  const wp = map.waypoints
  for (const c of r.shuffle([...pool]).slice(0, n)) {
    c.asleep = false
    c.ai.mode = 'patrol'
    c.ai.route = [wp.stream, wp.monastery, c.home ?? wp.reaverCamp]
    c.ai.routeIdx = 0
    c.ai.waitUntil = undefined
    c.ai.path = undefined
  }
  st.history.push({ turn, event: 'Event.ReaverPatrol' })
  log(w, 'flavor', w.db.event('Event.ReaverPatrol').hint ?? '')
}

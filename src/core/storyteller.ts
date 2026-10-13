// 장소 기반 사건 (10 · 14 §10): 적은 맵 가장자리에서 솟아나지 않는다.
// 이미 있는 거점(약탈자 야영지)의 사람들이 정해진 경로를 걸어서 순찰하고, 흔적을 보면 수색대를 꾸린다.

import { daylight } from './environment'
import { canSee } from './fov'
import { cheb, type Pos } from './geom'
import { addToInventory, itemDef } from './items'
import { emitNoise } from './perception'
import { log, player, rng, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import type { Creature, ItemInst, MapState } from './types'

/** 순찰: 매일 06:00, 야영지 인원 ≥ 4이면 50% → 2~3명 (두목 제외), 경유지마다 30분 대기 */
export const PATROL_HOUR = 6
export const PATROL_CHANCE = 0.5
export const PATROL_MIN_CAMP = 4
export const PATROL_WAIT = TURNS_PER_HOUR / 2

/** 야영지에 남아 있는 약탈자 (도주·항복 제외) */
function campMembers(cs: Creature[]): Creature[] {
  return cs.filter((c) => c.alive && c.faction === 'reavers' && c.ai.mode !== 'flee' && c.ai.mode !== 'surrender')
}

export function storytellerTick(w: World) {
  const st = w.s.storyteller
  const turn = turnOf(w)
  const map = w.s.map
  if (map.kind !== 'surface' || !map.waypoints) return
  traceWatch(w)
  if (st.search && turn >= st.search.at) {
    const pos = st.search.pos
    st.search = undefined
    sendSearchParty(w, w.s.creatures, map, pos, rng(w, 'story'))
  }
  if (turn % TURNS_PER_DAY !== PATROL_HOUR * TURNS_PER_HOUR || st.lastEventTurn === turn) return
  st.lastEventTurn = turn
  const camp = campMembers(w.s.creatures)
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
    c.ai.task = undefined
  }
  st.history.push({ turn, event: 'Event.ReaverPatrol' })
  log(w, 'flavor', w.db.event('Event.ReaverPatrol').hint ?? '')
}

// ── 흔적 (10 §3.1) ───────────────────────────────

/** 모닥불 흔적이 이 위치에서 보이는가: 밤 불빛 = 반경 6 × 3 = 18칸, 낮 연기 = 15칸, 바람 아래(±45°)면 × 1.5 */
export function fireVisibleFrom(w: World, map: MapState, at: Pos): Pos | undefined {
  const fire = map.lights.find((L) => L.kind === 'campfire' && !L.off && map.waypoints?.homeFire && cheb(L.pos, map.waypoints.homeFire) === 0)
  if (!fire) return undefined
  const d = cheb(fire.pos, at)
  const night = daylight(w) < 0.3
  if (night) return d <= fire.radius * 3 ? fire.pos : undefined
  let range = 15
  const vx = at.x - fire.pos.x, vy = at.y - fire.pos.y
  const dot = vx * w.s.wind.x + vy * w.s.wind.y
  // 바람 아래: 불에서 관찰자 쪽 방향이 바람 방향과 45° 안 (cos² ≥ 1/2, 제곱으로 비교)
  if (dot > 0 && 2 * dot * dot >= (vx * vx + vy * vy) * (w.s.wind.x * w.s.wind.x + w.s.wind.y * w.s.wind.y)) range = 22.5
  return d <= range ? fire.pos : undefined
}

/** 순찰 중인 약탈자가 흔적을 보면 경보: 외치고 야영지로 돌아간다 */
function traceWatch(w: World) {
  const map = w.s.map
  for (const c of w.s.creatures) {
    if (!c.alive || c.faction !== 'reavers' || c.ai.mode !== 'patrol' || c.ai.task) continue
    const trace = findTrace(w, c)
    if (!trace) continue
    c.ai.task = { kind: 'alarm', pos: trace }
    c.ai.route = [c.home ?? map.waypoints!.reaverCamp]
    c.ai.routeIdx = 0
    c.ai.waitUntil = undefined
    emitNoise(w, c.pos, 12, c.id)
    if (cheb(player(w).pos, c.pos) <= 20) log(w, 'warn', '숲 쪽에서 누군가 외치는 소리가 들린다. 무언가를 찾은 모양이다.')
  }
}

function findTrace(w: World, c: Creature): Pos | undefined {
  const map = w.s.map
  const fire = fireVisibleFrom(w, map, c.pos)
  if (fire) return fire
  // 마르지 않은 핏자국: 3칸 안
  for (let y = c.pos.y - 3; y <= c.pos.y + 3; y++) for (let x = c.pos.x - 3; x <= c.pos.x + 3; x++) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue
    if (map.tiles[y * map.w + x].blood > 20) return { x, y }
  }
  // 약탈자 시체: 시야 안
  const body = w.s.creatures.find((o) => !o.alive && o.faction === 'reavers' && canSee(w, c, o.pos))
  return body ? { ...body.pos } : undefined
}

// ── 수색대 (10 §3 #2 · §3.2) ──────────────────────

/** 경보를 가진 순찰이 야영지에 닿으면 1시간 뒤 수색대 */
export function alarmArrived(w: World, c: Creature) {
  const t = c.ai.task
  c.ai.task = undefined
  if (t?.kind !== 'alarm') return
  const st = w.s.storyteller
  st.search ??= { at: turnOf(w) + TURNS_PER_HOUR, pos: t.pos }
}

/** 3~4명(두목 50%)이 흔적 지점으로, 플레이어 야영지가 가까우면 보관함까지 */
function sendSearchParty(w: World, cs: Creature[], map: MapState, pos: Pos, r: ReturnType<typeof rng>): Creature[] {
  const camp = campMembers(cs).filter((c) => !c.unconscious && c.ai.mode !== 'hunt')
  if (camp.length < 2) return []
  const chief = camp.find((c) => c.def === 'Creature.ReaverChief')
  const others = r.shuffle(camp.filter((c) => c !== chief))
  const party = others.slice(0, r.int(3, 4))
  if (chief && r.chance(0.5)) party.push(chief)
  const stash = map.waypoints?.homeStash
  const near = stash && cheb(stash, pos) <= 12 ? stash : undefined
  for (const c of party) {
    c.asleep = false
    c.ai.mode = 'patrol'
    c.ai.route = near ? [pos, near, c.home ?? map.waypoints!.reaverCamp] : [pos, c.home ?? map.waypoints!.reaverCamp]
    c.ai.routeIdx = 0
    c.ai.waitUntil = undefined
    c.ai.path = undefined
    c.ai.task = { kind: 'search', pos, stash: near }
  }
  w.s.storyteller.history.push({ turn: turnOf(w), event: 'Event.ReaverSearch' })
  if (map === w.s.map) log(w, 'warn', '약탈자 야영지가 소란스럽다. 무리가 무장을 갖추고 나선다.')
  return party
}

/** 보관함 약탈: 가치 내림차순으로 1명당 2개 (10 §3.2) */
export function raidStash(w: World, c: Creature, map: MapState, stash: Pos): ItemInst[] {
  const t = map.tiles[stash.y * map.w + stash.x]
  const items = t.cont?.items ?? []
  const take = [...items].sort((a, b) => (itemDef(w, b).value ?? 0) * b.count - (itemDef(w, a).value ?? 0) * a.count).slice(0, 2)
  for (const it of take) {
    items.splice(items.indexOf(it), 1)
    addToInventory(w, c, { ...it, gx: undefined, gy: undefined })
  }
  if (take.length && map === w.s.map && canSee(w, player(w), c.pos)) log(w, 'danger', `${c.name}이(가) 야영지 보관함을 뒤져 ${take.map((i) => itemDef(w, i).label).join(', ')}을(를) 챙긴다!`)
  return take
}

/**
 * 지상을 비운 동안의 정산 (14 §9.2 6단계 · 10 §3.3 검산 2): 06:00마다 순찰 50%,
 * 켜진 모닥불 연기가 숲 개울에서 보이면(바람 아래) 수색대가 보관함을 턴다.
 */
export function settleSurfaceEvents(w: World, map: MapState, residents: Creature[], boundary: number, r: ReturnType<typeof rng>) {
  if (map.kind !== 'surface' || !map.waypoints) return
  const camp = campMembers(residents)
  if (camp.length < PATROL_MIN_CAMP || !r.chance(PATROL_CHANCE)) return
  w.s.storyteller.history.push({ turn: boundary, event: 'Event.ReaverPatrol' })
  // 바람은 정산 시점마다 8방위 균등 (09)
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
  const [wx, wy] = dirs[r.int(0, 7)]
  const saved = w.s.wind
  w.s.wind = { x: wx, y: wy }
  const seen = fireVisibleFrom(w, map, map.waypoints.stream)
  w.s.wind = saved
  if (!seen) return
  const party = sendSearchParty(w, residents, map, seen, r)
  const stash = map.waypoints.homeStash
  if (!stash) return
  for (const c of party) {
    c.ai.route = undefined
    c.ai.task = undefined
    c.ai.mode = 'guard'
    raidStash(w, c, map, stash)
  }
  if (party.length) w.s.storyteller.history.push({ turn: boundary, event: 'Event.StashRaided' })
}

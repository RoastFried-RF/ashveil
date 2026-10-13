// 시간대·날씨·기온·조명

import { clock, lerpTable, rng, turnOf, TURNS_PER_HOUR, log, tileAt, type World } from './ctx'
import type { Pos } from './geom'
import type { Weather } from './types'

// 늦가을 고원 (장막으로 일교차가 작고 춥다)
const TEMP_BY_HOUR: [number, number][] = [[0, -1], [5, -3], [8, 1], [13, 7], [16, 6], [19, 2], [24, -1]]
// 장막 탓에 한낮에도 흐리다
const LIGHT_BY_HOUR: [number, number][] = [[0, 0.06], [5, 0.06], [7, 0.45], [9, 0.72], [16, 0.72], [18, 0.4], [19.5, 0.08], [24, 0.06]]

export const WEATHER_LABEL: Record<Weather, string> = { clear: '옅은 장막', overcast: '짙은 구름', ashrain: '재비' }

export function ambientTemp(w: World, pos?: Pos): number {
  if (w.s.map.kind === 'dungeon') {
    // 지하는 서늘하고 일정하다. 화로 곁은 따뜻하다
    let t = 9 - w.s.map.depth
    if (pos && w.s.map.lights.some((L) => L.kind !== 'torch' && Math.abs(L.pos.x - pos.x) <= 2 && Math.abs(L.pos.y - pos.y) <= 2)) t += 10
    return t
  }
  const { hourF } = clock(turnOf(w))
  let t = lerpTable(TEMP_BY_HOUR, hourF)
  if (w.s.weather === 'overcast') t -= 1
  if (w.s.weather === 'ashrain') t -= 3
  if (pos && tileAt(w, pos).roof) t += 3
  if (pos && w.s.map.lights.some((L) => L.kind === 'campfire' && !L.off && Math.abs(L.pos.x - pos.x) <= 2 && Math.abs(L.pos.y - pos.y) <= 2)) t += 14
  return Math.round(t * 10) / 10
}

export function daylight(w: World): number {
  const { hourF } = clock(turnOf(w))
  let l = lerpTable(LIGHT_BY_HOUR, hourF)
  if (w.s.weather === 'overcast') l *= 0.85
  if (w.s.weather === 'ashrain') l *= 0.7
  return l
}

export function isNight(w: World): boolean {
  return daylight(w) < 0.2
}

export function isRaining(w: World): boolean {
  return w.s.weather === 'ashrain' && w.s.map.kind === 'surface'
}

/** 날씨 전이 (매 턴 호출, 만료 시 다음 날씨 결정) */
export function weatherTick(w: World) {
  const turn = turnOf(w)
  if (turn < w.s.weatherUntil) return
  const r = rng(w, 'world')
  const prev = w.s.weather
  const next: Weather = r.weighted<Weather>(['clear', 'overcast', 'ashrain'], (x) =>
    x === prev ? 1 : x === 'ashrain' ? (prev === 'overcast' ? 2 : 0.6) : 1.5) ?? 'clear'
  w.s.weather = next
  w.s.weatherUntil = turn + r.int(TURNS_PER_HOUR * 1, TURNS_PER_HOUR * 4)
  // 바람도 함께 바뀜
  w.s.wind = { x: r.int(-1, 1), y: r.int(-1, 1) }
  if (next !== prev) {
    const msg: Record<Weather, string> = {
      clear: '구름이 걷히고 장막이 조금 옅어졌다.',
      overcast: '구름이 짙게 깔린다.',
      ashrain: '회색 비가 내리기 시작한다. 재 냄새가 섞여 있다.',
    }
    if (w.s.map.kind === 'surface') log(w, 'flavor', msg[next])
  }
}

import { calendar, climateDef, regionalDaylight, regionalTemperature, climateCell, seasonPhase, veilConcentration, weatherDef } from './climate-state'
// 시간대·날씨·기온·조명

import { clock, lerpTable, rng, turnOf, TURNS_PER_HOUR, START_TURN, log, type World } from './ctx'
import type { Pos } from './geom'
import type { Weather } from './types'

// 늦가을 고원 (장막으로 일교차가 작고 춥다)
const TEMP_BY_HOUR: [number, number][] = [[0, -1], [5, -3], [8, 1], [13, 7], [16, 6], [19, 2], [24, -1]]
// 장막 탓에 한낮에도 흐리다
const LIGHT_BY_HOUR: [number, number][] = [[0, 0.06], [5, 0.06], [7, 0.45], [9, 0.72], [16, 0.72], [18, 0.4], [19.5, 0.08], [24, 0.06]]

export const WEATHER_LABEL: Record<Weather, string> = { clear: '옅은 장막', overcast: '짙은 구름', ashrain: '재비', deepOvercast: '짙은 흐림', ashstorm: '재비 폭풍', ashsnow: '재눈', ashgale: '재바람', frostfog: '서리안개' }

export function ambientTemp(w: World, _pos?: Pos): number {
  if (w.s.map.kind === 'dungeon') {
    // 01 §9.1 · 14: 지하 6°C, 오염된 성소 12°C. 열원은 체감에서 한 번만 더한다.
    return w.s.map.depth === 3 ? 12 : 6
  }
  if (w.s.overworld) return regionalTemperature(w)
  const { hourF } = clock(turnOf(w))
  let t = lerpTable(TEMP_BY_HOUR, hourF)
  if (w.s.weather === 'overcast') t -= 1
  if (w.s.weather === 'ashrain') t -= 3
  return Math.round(t * 10) / 10
}

export function daylight(w: World): number {
  if (w.s.overworld) return regionalDaylight(w)
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
  return ['ashrain', 'ashstorm'].includes(w.s.weather) && w.s.map.kind === 'surface'
}

/** 날씨 전이 (매 턴 호출, 만료 시 다음 날씨 결정) */
/** 날씨 블록 6시간 (09 §9.2) */
export const WEATHER_BLOCK = TURNS_PER_HOUR * 6

/** 마르코프 전이표 % (09 §9.2, 프로토타입: 맑음·흐림·재비만 — 폭풍·눈 몫은 재비·흐림에 합친다) */
export const WEATHER_TABLE: Record<'clear' | 'overcast' | 'ashrain', Record<'clear' | 'overcast' | 'ashrain', number>> = {
  clear: { clear: 50, overcast: 40, ashrain: 10 },
  overcast: { clear: 15, overcast: 52, ashrain: 33 },
  ashrain: { clear: 5, overcast: 45, ashrain: 50 },
}

/** 다음 6시간 블록 경계 (00·06·12·18시) */
export const nextWeatherBlock = (turn: number) => (Math.floor(turn / WEATHER_BLOCK) + 1) * WEATHER_BLOCK

export function weatherTick(w: World) {
  const turn = turnOf(w)
  if (w.s.overworld) { syncRegionalWeather(w, true); return }
  if (turn < w.s.weatherUntil) return
  const r = rng(w, 'world')
  const prev = w.s.weather
  const row = WEATHER_TABLE[prev as keyof typeof WEATHER_TABLE] ?? WEATHER_TABLE.overcast
  const roll = r.int(0, 99)
  const next: Weather = roll < row.clear ? 'clear' : roll < row.clear + row.overcast ? 'overcast' : 'ashrain'
  w.s.weather = next
  w.s.weatherUntil = nextWeatherBlock(turn)
  // 바람도 함께 바뀜
  w.s.wind = { x: r.int(-1, 1), y: r.int(-1, 1) }
  if (next !== prev) {
    const msg: Partial<Record<Weather, string>> = {
      clear: '구름이 걷히고 장막이 조금 옅어졌다.',
      overcast: '구름이 짙게 깔린다.',
      ashrain: '회색 비가 내리기 시작한다. 재 냄새가 섞여 있다.',
    }
    if (w.s.map.kind === 'surface') log(w, 'flavor', msg[next] ?? next)
  }
}

export function weatherLabel(w: World): string { return w.s.overworld ? weatherDef(w).label : WEATHER_LABEL[w.s.weather] }
function expandedWeather(w: World, stream: `world.${string}`) {
  const r = rng(w, stream), turn = turnOf(w), profile = weatherDef(w), d = climateDef(w)
  const row = { ...d.weatherRows[profile.group] }
  const ash = Math.min(row.cloud, Math.floor(veilConcentration(w, undefined, turn - 1) / 10)); row.rain += ash; row.cloud -= ash
  const snow = w.db.all<import('./types').WeatherDef>('Weather').find((v) => v.group === 'snow')!
  const warmSnow = climateCell(w, undefined, turn - 1).temperature + d.amplitude * seasonPhase(w) + snow.temperature > 0
  if (warmSnow) { row.rain += row.snow; row.snow = 0 }
  else if (calendar(w).season.phase < 0) { row.snow += row.rain; row.rain = 0 }
  const groups = ['clear', 'cloud', 'rain', 'storm', 'snow'] as const
  const group = r.weighted(groups, (g) => row[g])!
  const next = r.weighted(w.db.all<import('./types').WeatherDef>('Weather').filter((v) => v.group === group), (v) => v.selectionWeight)!
  w.s.weather = next.weather; w.s.weatherUntil = nextWeatherBlock(turn); w.s.wind = { x: r.int(-1, 1), y: r.int(-1, 1) }
  if (next.windBonus > 0 && !w.s.wind.x && !w.s.wind.y) w.s.wind.x = 1
}

/** 지역의6시간 블록을 자체 스트림으로 따라잡는다. 다른 지역 방문 순서에 영향을 받지 않는다. */
export function regionalWeatherAt(w: World, p: Pos, adoptCurrent = false) {
  const m = w.s.overworld!, key = `${p.x},${p.y}`, cells = m.weatherCells ??= {}, now = turnOf(w)
  let state = cells[key]
  if (!state) state = cells[key] = adoptCurrent ? { weather: w.s.weather, until: w.s.weatherUntil > 0 ? w.s.weatherUntil : Math.floor(now / WEATHER_BLOCK) * WEATHER_BLOCK, wind: { ...w.s.wind } } : { weather: 'overcast', until: nextWeatherBlock(START_TURN), wind: { x: 1, y: 0 } }
  else if (adoptCurrent && (w.s.weatherUntil <= 0 || w.s.weatherUntil >= state.until) && (state.weather !== w.s.weather || state.until !== w.s.weatherUntil || state.wind.x !== w.s.wind.x || state.wind.y !== w.s.wind.y)) state = cells[key] = { weather: w.s.weather, until: w.s.weatherUntil > 0 ? w.s.weatherUntil : Math.floor(now / WEATHER_BLOCK) * WEATHER_BLOCK, wind: { ...w.s.wind } }
  while (state.until <= now) {
    const view: World = { db: w.db, s: { ...w.s, time: state.until * 100, map: { ...w.s.map, worldCell: { ...p } }, weather: state.weather, weatherUntil: state.until, wind: { ...state.wind } } }
    expandedWeather(view, `world.weather.${key}`)
    state = cells[key] = { weather: view.s.weather, until: view.s.weatherUntil, wind: view.s.wind }
  }
  return state
}
export function syncRegionalWeather(w: World, adoptCurrent = false) {
  if (!w.s.overworld) return
  const previous = w.s.weather, state = regionalWeatherAt(w, w.s.map.worldCell ?? w.s.overworld.position, adoptCurrent)
  w.s.weather = state.weather; w.s.weatherUntil = state.until; w.s.wind = { ...state.wind }
  if (previous !== state.weather && w.s.map.kind === 'surface') log(w, 'flavor', `하늘이 바뀐다. ${weatherDef(w).label}.`)
}

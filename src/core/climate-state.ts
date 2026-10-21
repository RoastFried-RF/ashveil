// 계절·장막·확장 날씨의 읽기 전용 규칙. 실제 난수 전이는 environment에서 한다.
import { clamp, clock, lerpTable, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { climateMean, veilAt, worldIndex, worldPos } from './overworld'
import type { BiomeDef, ClimateDef, SeasonDef, WeatherDef, WaterSafetyDef, WorldCell } from './types'
import { atmosphericTowers, stopTowerState, stoppedVeil, towerClearingProgress, towerSunBonus } from './tower-consequences'
import { ensureSociety } from './diplomacy'
interface Derived { db: World['db']; key: string; values: Map<string, unknown> }
const derived = new WeakMap<World['s'], Derived>()
const seasonLists = new WeakMap<World['db'], SeasonDef[]>()
function cached<T>(w: World, name: string, read: () => T): T {
  const p = w.s.map.worldCell ?? w.s.overworld?.position
  const key = `${turnOf(w)}:${w.s.weather}:${p?.x},${p?.y}:${w.s.overworld?.climateRevision ?? 0}`
  let hit = derived.get(w.s)
  if (!hit || hit.db !== w.db || hit.key !== key) { hit = { db: w.db, key, values: new Map() }; derived.set(w.s, hit) }
  if (!hit.values.has(name)) hit.values.set(name, read())
  return hit.values.get(name) as T
}
export const climateDef = (w: World) => w.db.get<ClimateDef>('Climate.Hearth')
export function seasons(w: World): SeasonDef[] { let list = seasonLists.get(w.db); if (!list) { list = w.db.all<SeasonDef>('Season').slice().sort((a, b) => a.order - b.order); seasonLists.set(w.db, list) }; return list }
export const weatherDef = (w: World): WeatherDef => w.db.all<WeatherDef>('Weather').find((d) => d.weather === w.s.weather)!
export function calendar(w: World) {
  return cached(w, 'calendar', () => calendarAtDay(w,Math.floor(turnOf(w)/TURNS_PER_DAY)))
}
/** 지난 일일 정산도 그 날짜의 계절을 사용한다. 현재 날씨·현재 시각을 바꾸지 않는다. */
export function calendarAtDay(w:World,elapsedDay:number){
  const list = seasons(w), yearDays = list.reduce((n, s) => n + s.lengthDays, 0)
  const elapsed = elapsedDay + climateDef(w).startDay - 1
  const day = ((elapsed % yearDays) + yearDays) % yearDays + 1
  let offset = 0
  for (const season of list) { if (day <= offset + season.lengthDays) return { year: Math.floor(elapsed / yearDays), day, yearDays, season, seasonDay: day - offset }; offset += season.lengthDays }
  throw new Error('계절 길이 오류')
}
export function seasonPhase(w: World, day = calendar(w).day): number {
  const list = seasons(w), yearDays = list.reduce((n, s) => n + s.lengthDays, 0), knots: [number, number][] = []
  let offset = 0
  for (const s of list) { knots.push([offset + s.phaseDay, s.phase]); offset += s.lengthDays }
  return lerpTable([[knots.at(-1)![0] - yearDays, knots.at(-1)![1]], ...knots, [knots[0][0] + yearDays, knots[0][1]]], day)
}
export function sunTimes(w: World): { sunrise: number; sunset: number } {
  return cached(w, 'sun', () => {
  const c = calendar(w), list = seasons(w), i = list.findIndex((s) => s.id === c.season.id), span = climateDef(w).sunTransitionDays
  let from = c.season, to = c.season, amount = 0
  if (span > 0 && c.seasonDay - 1 < span / 2) { from = list[(i + list.length - 1) % list.length]; amount = (c.seasonDay - 1 + span / 2) / span }
  else if (span > 0 && c.seasonDay - 1 > c.season.lengthDays - span / 2) { to = list[(i + 1) % list.length]; amount = (c.seasonDay - 1 - (c.season.lengthDays - span / 2)) / span }
  return { sunrise: from.sunrise + (to.sunrise - from.sunrise) * amount, sunset: from.sunset + (to.sunset - from.sunset) * amount }
  })
}
export function climateCell(w: World, p = w.s.map.worldCell ?? w.s.overworld!.position, cutoff = turnOf(w)): WorldCell {
  const m = w.s.overworld!, c = m.cells[worldIndex(m, p)]
  if (!m.towers.some((t) => t.shutdown || t.history?.length && t.history.at(-1)!.turn > cutoff)) return c
  const towers = atmosphericTowers(w,cutoff)
  const veil = stoppedVeil(w,p,veilAt(towers, p),cutoff)
  return { ...c, veil, temperature: climateMean(p.y, m.h, c.altitude, veil) }
}
export function veilConcentration(w: World, p = w.s.map.worldCell ?? w.s.overworld!.position, cutoff = turnOf(w)): number {
  const m = w.s.overworld!, d = climateDef(w), c = climateCell(w, p, cutoff), day = Math.floor(turnOf(w) / TURNS_PER_DAY)
  let extra = -seasonPhase(w) * d.veilAmplitude
  for (const surge of m.surges ?? []) { if ((surge.turn ?? surge.day * TURNS_PER_DAY) > cutoff) continue; const tower = m.towers.find((t) => t.id === surge.tower); if (!tower) continue; const distance = Math.sqrt((p.x - tower.cell.x) ** 2 + (p.y - tower.cell.y) ** 2); extra += Math.max(0, surge.amount - Math.max(0, day - surge.day) * d.eruptionDecay) * Math.max(0, tower.radius - distance) / tower.radius }
  return Math.round(clamp(c.veil + extra*(1-towerClearingProgress(w,p,cutoff)), 0, 100) * 10) / 10
}
export function regionalTemperature(w: World): number {
  return cached(w, 'temperature', () => {
  const c = climateCell(w), phase = seasonPhase(w), d = climateDef(w), weather = weatherDef(w), h = clock(turnOf(w)).hourF
  return Math.round((c.temperature + d.amplitude * phase + lerpTable(d.diurnal, h) * weather.diurnalMult + weather.temperature) * 10) / 10
  })
}
export function regionalDaylight(w: World): number {
  return cached(w, 'daylight', () => {
  const { sunrise, sunset } = sunTimes(w), h = clock(turnOf(w)).hourF, weather = weatherDef(w), veil = veilConcentration(w)
  const peak = clamp((100 - Math.floor(veil / 2) + weather.daylightBonus + towerSunBonus(w,w.s.map.worldCell??w.s.overworld!.position)) / 100, 0, 1), night = Math.max(0, weather.nightLight - (veil >= 75 ? 10 : 0)) / 100
  const knots: [number, number][] = [[0, night], [sunrise - 1, night], [sunrise, peak * .4], [sunrise + 1, peak * .4], [sunrise + 3, peak * .8], [(sunrise + sunset) / 2, peak], [sunset - 2, peak * .8], [sunset, peak * .4], [sunset + 1, night], [24, night]]
  return lerpTable(knots.sort((a, b) => a[0] - b[0]), h)
  })
}
export function regionalWindBonus(w: World): number { return w.s.overworld ? (w.db.get<BiomeDef>(climateCell(w).biome).windBonus ?? 0) + weatherDef(w).windBonus : 0 }
export function weatherWetPerTurn(w: World): number { return w.s.overworld ? weatherDef(w).wetPerTen / 10 : w.s.weather === 'ashrain' ? .5 : 0 }
export function weatherNoise(w: World): number { if (w.s.map.kind === 'dungeon') return w.s.map.depth === 1 && ['ashrain', 'ashstorm'].includes(w.s.weather) ? 1 : 0; return w.s.overworld ? weatherDef(w).noise : w.s.weather === 'ashrain' ? 3 : 0 }
export function weatherScent(w: World): number { return w.s.map.kind === 'dungeon' ? 1 : w.s.overworld ? weatherDef(w).scentMult : w.s.weather === 'ashrain' ? .5 : 1 }
export function weatherSight(w: World): { flat: number; mult: number; eyes: number } { if (!w.s.overworld || w.s.map.kind === 'dungeon') return { flat: 0, mult: 1, eyes: 1 }; const d = weatherDef(w); return { flat: d.sightFlat, mult: d.sightMult, eyes: d.eyeSightMult ?? 1 } }
export function rainAcidity(w: World): number { return w.s.overworld ? Math.floor(veilConcentration(w) / 20) : w.db.get<WaterSafetyDef>('WaterSafety.Human').rainAcidity }
export function eruptTower(w: World, id: string): boolean {
  const m = w.s.overworld, tower = m?.towers.find((t) => t.id === id)
  if (!m || !tower || tower.output <= 0) return false
  ;m.climateRevision = (m.climateRevision ?? 0) + 1
  ;(m.surges ??= []).push({ tower: id, amount: climateDef(w).eruptionAmount, day: Math.floor(turnOf(w) / TURNS_PER_DAY), turn: turnOf(w) }); return true
}
/** 탑 출력 변경은 기저 장막·연평균을 함께 다시 계산한다. */
export function setTowerOutput(w: World, id: string, output: number): boolean {
  const m = w.s.overworld, tower = m?.towers.find((t) => t.id === id)
  if (!m || !tower || tower.shutdown || !Number.isFinite(output) || output < 0 || output > 100) return false
  const history = tower.history ??= [{ turn: 0, output: tower.output }]
  history.push({ turn: turnOf(w), output })
  tower.output = output
  m.climateRevision = (m.climateRevision ?? 0) + 1
  m.cells.forEach((c, i) => { const p = worldPos(m, i); c.veil = veilAt(m.towers, p); c.temperature = climateMean(p.y, m.h, c.altitude, c.veil) })
  return true
}
export function stopTower(w:World,id:string):boolean{
  const rule=climateDef(w).towerStop
  if(!rule||!stopTowerState(w,id,calendar(w).season,rule))return false
  const society=ensureSociety(w);if(society)society.reputation[rule.hostileFaction]=-100
  return true
}

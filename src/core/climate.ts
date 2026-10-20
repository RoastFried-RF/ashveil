// 기후의 시간성 지형과 눈·얼음 채집. 실제 생존 처리는 기존 영양/열/물 규칙을 쓴다.
import { ambientTemp, syncRegionalWeather } from './environment'
import { climateDef, weatherDef } from './climate-state'
import { inBounds, log, tileAt, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { cheb, DIRS, type Pos } from './geom'
import { mapWorlds } from './journey'
import { findItem } from './items'
import {capacity} from './body'
import {channelTurns} from './action-time'
import {hasLos} from './fov'
import {diagonalBlocked} from './path'
import {isWaterVessel,waterCapacity,waterVessel} from './water-vessels'
import { emitNoise } from './perception'
import { hydrate } from './nutrition'
import { drinkContaminants } from './water'
import { waterSafetyDef } from './water-state'
import type { Creature } from './types'

function updateTerrain(scope: World, initialize: boolean) {
  const m = scope.s.map
  if (m.kind !== 'surface') return
  const d = climateDef(scope), temp = ambientTemp(scope), snowing = weatherDef(scope).precipitation === 'snow'
  for (const t of m.tiles) {
    if (t.roof) continue
    if (snowing && temp <= d.freezeBelow) { if (!initialize || t.snow === undefined) t.snow = Math.min(100, (t.snow ?? 0) + d.snowPerHour) }
    else if (!initialize && t.snow && temp > d.freezeBelow) t.snow = Math.max(0, t.snow - (temp - d.freezeBelow) * d.snowMeltPerDegreeHour)
    const water = !!scope.db.terrain(t.t).water
    const frozen = temp <= d.freezeBelow && (water || (t.snow ?? 0) >= d.snowIceAt)
    if (frozen) t.icy = true
    else if (t.icy) delete t.icy
    if (t.iceHoleUntil && t.iceHoleUntil <= turnOf(scope)) delete t.iceHoleUntil
  }
}
export function initializeClimateMap(w: World) { if (w.s.overworld) updateTerrain(w, true) }
export function initializeClimate(w: World) {
  const m = w.s.overworld
  if (!m || m.climateInitialized) return
  syncRegionalWeather(w, true)
  for (const scope of mapWorlds(w)) updateTerrain(scope, true)
  m.climateInitialized = true
}
export function climateTick(w: World) {
  if (!w.s.overworld || turnOf(w) % TURNS_PER_HOUR) return
  for (const scope of mapWorlds(w)) updateTerrain(scope, false)
}

export function nearbyIce(w: World, c: Creature): Pos | null {
  for (const d of [{ x: 0, y: 0 }, ...DIRS]) {
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!inBounds(w, p)) continue
    const t = tileAt(w, p)
    if ((t.icy || w.db.terrain(t.t).icy) && (t.iceHoleUntil ?? 0) <= turnOf(w) && w.db.terrain(t.t).water) return p
  }
  return null
}
export function nearbySnow(w: World, c: Creature,minDepth=0): Pos | null {
  if (!w.s.overworld || w.s.map.kind !== 'surface') return null
  for (const d of [{ x: 0, y: 0 }, ...DIRS]) {
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!inBounds(w, p)) continue
    const t = tileAt(w, p)
    if (!t.roof && (t.snow??0)>=minDepth && ((t.snow ?? 0) > 0 || weatherDef(w).precipitation === 'snow')&&hasLos(w,c.pos,p)&&!diagonalBlocked(w,c.pos,d.x,d.y)) return p
  }
  return null
}
export function eatSnow(w: World, c: Creature): string | null {
  const p = nearbySnow(w, c)
  if (!p) return '먹을 눈이 없다'
  const d = waterSafetyDef(w)
  hydrate(w, c, 100); drinkContaminants(w, c, d.sources.snow, 100)
  c.needs.bodyTemp -= d.snowCoolingPer100
  if (tileAt(w, p).snow) tileAt(w, p).snow = Math.max(0, tileAt(w, p).snow! - 1)
  if (c.id === w.s.playerId) log(w, 'info', '눈을 먹었다. 목은 축였지만 몸이 식는다.')
  return null
}
export function startSnow(w: World, c: Creature, uid: number): string | null {
  if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'manipulation')<.2)return '깨어서 눈을 모을 손을 쓸 수 있어야 한다'
  const it = findItem(c, uid)
  if (!it || !isWaterVessel(w,it) || it.count!==1 || (it.uses ?? 0) > 0) return '빈 실제 물 용기 하나가 필요하다'
  const ml=waterCapacity(w,it),depth=Math.ceil(ml/1000*(waterSafetyDef(w).snowDepthPerL??10)),target=nearbySnow(w,c,depth)
  if (!target||(tileAt(w,target).snow??0)<depth) return '실제 용량을 채울 눈이 부족하다'
  const turns = channelTurns(w,c,climateDef(w).snowCollectTurns)
  if(turns===null)return '몸 상태 때문에 눈을 모을 수 없다'
  c.activity = { kind: 'collectSnow', remaining: turns, total: turns, uid,target,waterCollectCapacity:ml,label: '눈 모으기' }
  return null
}
export function finishClimateAction(w: World, c: Creature) {
  const a = c.activity!
  if (a.kind === 'breakIce') {
    const p = a.target
    if (!p || !inBounds(w, p) || cheb(p, c.pos) > 1 || !tileAt(w, p).icy) return
    emitNoise(w, p, 8, c.id)
    tileAt(w, p).iceHoleUntil = turnOf(w) + climateDef(w).iceHoleTurns
    if (c.id === w.s.playerId) log(w, 'info', '얼음에 물을 뜰 구멍을 냈다. 추우면 다시 언다.')
  } else {
    const fail=()=>{if(c.id===w.s.playerId)log(w,'warn','눈 모으기 중단: 원래 빈 용기·쓸 손·채집할 눈을 다시 확인하자.')}
    const it = findItem(c, a.uid ?? -1), p = a.target??nearbySnow(w, c)
    if (!it || !p || !inBounds(w,p)||cheb(p,c.pos)>1||!isWaterVessel(w,it)||it.count!==1||(it.uses??0)>0||!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'manipulation')<.2||!hasLos(w,c.pos,p)||diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y)){fail();return}
    const ml=waterCapacity(w,it),depth=Math.ceil(ml/1000*(waterSafetyDef(w).snowDepthPerL??10))
    if(a.waterCollectCapacity!==undefined&&a.waterCollectCapacity!==ml||(tileAt(w,p).snow??0)<depth){fail();return}
    it.def=waterVessel(w,it)!.dirty;it.uses=ml/w.db.item(it.def).drink!.water;it.water={...waterSafetyDef(w).sources.snow};it.waterFrozen=true;delete it.waterSettlesAt
    tileAt(w,p).snow=tileAt(w,p).snow!-depth
    if (c.id === w.s.playerId) log(w, 'info', '병에 눈을 모았다. 불에서 녹여 끓일 수 있다.')
  }
}

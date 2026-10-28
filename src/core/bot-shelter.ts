// 현재 실제 열수지로 보온 행동/알려진 피난처를 고른다. 연료·옷·열을 만들지 않는다.
import type { Action } from './actions'
import { creatureAt, player, terrainAt, tileAt, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, dirIndex, eq, type Pos } from './geom'
import { findPath } from './path'
import { warmthError } from './resident-warmth'
import { fireWarmth, projectThermalState, temperatureDelta } from './thermal'

export function botShelterAction(w: World, avoid: (p: Pos) => boolean): Action | null {
  const pl = player(w)
  const rest = temperatureDelta(pl, projectThermalState(w, pl, 'rest'))
  const canWarm = warmthError(w, pl) === null
  const warm = canWarm ? temperatureDelta(pl, projectThermalState(w, pl, 'work')) : -Infinity
  const sheltered = !!tileAt(w, pl.pos).roof || fireWarmth(w, pl) >= 15
  if (sheltered && rest > 0) return { type: 'rest', turns: 60 }
  if (canWarm && warm > 0) return { type: 'warmByFire' }

  const observed = new Map<number, boolean>()
  const known = (p: Pos) => {
    const key = p.y * w.s.map.w + p.x
    if (!observed.has(key)) observed.set(key, !!tileAt(w, p).seen || canSee(w, pl, p))
    return observed.get(key)!
  }
  const fires = w.s.map.lights.filter(l => l.kind === 'campfire' && known(l.pos) && !avoid(l.pos))
  const candidates: { pos: Pos; delta: number; ignite: boolean; dry: boolean }[] = []
  const here = Math.max(rest, warm)
  for (let y = 0; y < w.s.map.h; y++) for (let x = 0; x < w.s.map.w; x++) {
    const pos = { x, y }, tile = tileAt(w, pos)
    if (eq(pos, pl.pos) || !tile.roof && !fires.some(l => cheb(l.pos, pos) <= (l.off ? 1 : 2))) continue
    if (!known(pos) || avoid(pos)) continue
    const terrain = terrainAt(w, pos)
    if (!terrain.passable || terrain.water || creatureAt(w, pos)) continue
    const nearby = fires.filter(l => cheb(l.pos, pos) <= (l.off ? 1 : 2) && hasLos(w, pos, l.pos))
    if (!tile.roof && !nearby.length) continue
    const at = { ...pl, pos }
    const recovery = temperatureDelta(pl, projectThermalState(w, pl, 'rest', pos))
    const working = warmthError(w, at) === null ? temperatureDelta(pl, projectThermalState(w, pl, 'work', pos)) : -Infinity
    const delta = Math.max(recovery, working)
    // 기존 고정 모닥불만 toggleFire로 다시 켠다. 설치품은 실제 연료 작업이 필요하다.
    const ignite = nearby.some(l => l.off && l.sourceUid === undefined)
    const dry = !!tile.roof && !tileAt(w, pl.pos).roof && pl.needs.wetness > 40
    if (delta > here || ignite || dry && delta >= here) candidates.push({ pos, delta, ignite, dry })
  }
  candidates.sort((a, b) => Number(b.delta > 0) - Number(a.delta > 0)
    || Number(b.ignite) - Number(a.ignite)
    || (a.delta > 0 && b.delta > 0 ? cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos) : b.delta - a.delta)
    || Number(b.dry) - Number(a.dry)
    || cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos) || a.pos.y - b.pos.y || a.pos.x - b.pos.x)
  if (!candidates.length) return canWarm && warm > rest ? { type: 'warmByFire' }
    : sheltered && rest >= 0 ? { type: 'rest', turns: 60 } : null
  const avoidCells = new Set<number>()
  for (let y = 0; y < w.s.map.h; y++) for (let x = 0; x < w.s.map.w; x++) {
    const pos = { x, y }
    if (!known(pos) || avoid(pos)) avoidCells.add(y * w.s.map.w + x)
  }
  for (const candidate of candidates) {
    const path = findPath(w, pl.pos, candidate.pos, { avoidCreatures: true, selfId: pl.id, avoidWater: true, avoidCells })
    if (path?.length) return { type: 'move', dir: dirIndex(path[0].x - pl.pos.x, path[0].y - pl.pos.y) }
  }
  // 더 나은 알려진 자리가 없을 때만 몸 풀기로 손실을 줄인다. 회복을 보장하지 않는다.
  if (canWarm && warm > rest) return { type: 'warmByFire' }
  if (sheltered && rest >= 0) return { type: 'rest', turns: 60 }
  return null
}

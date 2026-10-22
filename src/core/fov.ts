import {rememberVisiblePrisoners} from './prisoner-memory'
import {turnOf} from './ctx'
import { weatherSight } from './climate-state'
// 시야(재귀 그림자 투사)와 조명

import { capacity } from './body'
import { creatureAt, idx, inBounds, isOpaque, tileAt, type World } from './ctx'
import { daylight } from './environment'
import { cheb, dist2, line, type Pos } from './geom'
import { lightSource } from './items'
import { effectiveStat, traitAdd, traitMul, traitOverride } from './traits'
import type { Creature, MapState } from './types'

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
]

export function computeFov(w: World, origin: Pos, radius: number): Set<number> {
  const seen = new Set<number>([idx(w, origin)])
  const r2 = radius * radius
  const cast = (row: number, start: number, end: number, xx: number, xy: number, yx: number, yy: number) => {
    if (start < end) return
    let newStart = 0
    for (let j = row; j <= radius; j++) {
      let dx = -j - 1
      const dy = -j
      let blocked = false
      while (dx <= 0) {
        dx++
        const X = origin.x + dx * xx + dy * xy
        const Y = origin.y + dx * yx + dy * yy
        const lSlope = (dx - 0.5) / (dy + 0.5)
        const rSlope = (dx + 0.5) / (dy - 0.5)
        if (start < rSlope) continue
        if (end > lSlope) break
        const p = { x: X, y: Y }
        if (dx * dx + dy * dy <= r2 && inBounds(w, p)) seen.add(idx(w, p))
        if (blocked) {
          if (isOpaque(w, p)) { newStart = rSlope; continue }
          blocked = false
          start = newStart
        } else if (isOpaque(w, p) && j < radius) {
          blocked = true
          cast(j + 1, start, lSlope, xx, xy, yx, yy)
          newStart = rSlope
        }
      }
      if (blocked) break
    }
  }
  for (let o = 0; o < 8; o++) cast(1, 1.0, 0.0, MULT[0][o], MULT[1][o], MULT[2][o], MULT[3][o])
  return seen
}

export function hasLos(w: World, a: Pos, b: Pos): boolean {
  const pts = line(a, b)
  for (let i = 0; i < pts.length - 1; i++) if (isOpaque(w, pts[i])) return false
  return true
}

// 고정 광원(화로·횃불·모닥불) 밝기 캐시. 문이 열리고 닫히면 무효화
const staticCache = new WeakMap<MapState, { ver: number; arr: Float32Array }>()
const versions = new WeakMap<MapState, number>()

export function invalidateLights(w: World) {
  versions.set(w.s.map, (versions.get(w.s.map) ?? 0) + 1)
}

function staticLight(w: World): Float32Array {
  const m = w.s.map
  const ver = versions.get(m) ?? 0
  const hit = staticCache.get(m)
  if (hit && hit.ver === ver) return hit.arr
  const arr = new Float32Array(m.w * m.h)
  for (const L of m.lights) {
    if (L.off) continue
    const r = L.radius
    for (let y = Math.max(0, L.pos.y - r - 1); y <= Math.min(m.h - 1, L.pos.y + r + 1); y++) {
      for (let x = Math.max(0, L.pos.x - r - 1); x <= Math.min(m.w - 1, L.pos.x + r + 1); x++) {
        const p = { x, y }
        const d2 = dist2(L.pos, p)
        if (d2 > (r + 1) * (r + 1)) continue
        if (d2 > 0 && !hasLos(w, L.pos, p)) continue
        const v = sourceLight(Math.sqrt(d2), r)
        const i = y * m.w + x
        if (v > arr[i]) arr[i] = v
      }
    }
  }
  staticCache.set(m, { ver, arr })
  return arr
}

/** 타일 밝기 0~1 */
export function lightAt(w: World, p: Pos): number {
  const m = w.s.map
  let l = m.kind === 'surface' ? daylight(w) * (m.daylightMult??1) * (tileAt(w, p).roof ? 0.45 : 1) : m.ambient
  l = Math.max(l, staticLight(w)[p.y * m.w + p.x])
  for (const c of w.s.creatures) {
    if (!c.alive) continue
    const src = lightSource(w, c)
    if (!src) continue
    const r = src.radius
    const d2 = dist2(c.pos, p)
    if (d2 > (r + 1) * (r + 1)) continue
    if (d2 > 0 && !hasLos(w, c.pos, p)) continue
    l = Math.max(l, sourceLight(Math.sqrt(d2), r))
  }
  return l
}

/** 광원 반경 안은 '밝음'(≥ 0.7), 경계 1칸은 '어스름'(0.55) (01 §9.2) */
function sourceLight(d: number, r: number): number {
  if (d <= r) return 0.7 + 0.3 * (1 - d / (r + 1))
  return 0.55
}

/** 조명 단계 (01 §9.2): 0 밝음(≥ 0.7) · 1 어스름(≥ 0.5) · 2 어둠(≥ 0.1) · 3 칠흑 */
export function lightLevel(w: World, p: Pos): 0 | 1 | 2 | 3 {
  const l = lightAt(w, p)
  return l >= 0.7 ? 0 : l >= 0.5 ? 1 : l >= 0.1 ? 2 : 3
}

export const LIGHT_LABEL = ['밝음', '어스름', '어둠', '칠흑'] as const

export function lightThreshold(w: World, c: Creature): number {
  return traitOverride(w, c, 'lightThreshold') ?? w.db.creature(c.def).lightThreshold
}

export function sightRange(w: World, c: Creature): number {
  const def = w.db.creature(c.def), vision = def.vision
  const perception = effectiveStat(w, c, 'per') - 10
  const statRange = vision
    ? def.sightRange * (1 + Math.max(0, Math.floor(perception / vision.perceptionStep)) * vision.perceptionBonus)
    : def.sightRange + Math.floor(perception / 2)
  const base = Math.min(vision?.maxRange ?? Infinity, statRange + traitAdd(w, c, 'sightRange') - (c.breakdown?.kind === 'cry' ? 2 : 0))
  const weather = weatherSight(w), protectedEyes = Object.values(c.equip).some((it) => it && w.db.item(it.def).apparel?.eyeProtection)
  return Math.max(1, Math.min(vision?.maxRange ?? Infinity, Math.round((base + weather.flat) * weather.mult * (w.s.map.fog?.sightMult??1) * (protectedEyes ? 1 : weather.eyes) * Math.max(0.15, capacity(w, c, 'sight')))))
}

/** 광원이 닿지 않는 곳을 볼 수 있는 거리. 조명된 대상은 전체 시야 범위를 사용한다. */
export function darkSightRange(w: World, c: Creature, range = sightRange(w, c)): number {
  const penalty = w.db.creature(c.def).vision?.darkPenalty
  return penalty === undefined ? 1 : Math.max(1, range - penalty)
}

/** 관찰자가 대상 위치를 볼 수 있는가 (거리·시선·조명·잠행) */
export function canSee(w: World, viewer: Creature, p: Pos, fov?: Set<number>, baseRange?: number): boolean {
  if(capacity(w,viewer,'sight')<=0)return false
  if (viewer.unconscious || viewer.asleep) return false
  const d = cheb(viewer.pos, p)
  if (d <= 1) return true
  let range = baseRange ?? sightRange(w, viewer)
  const vision = w.db.creature(viewer.def).vision
  if (d > range || vision && dist2(viewer.pos, p) > range * range) return false
  const lit = lightAt(w, p) >= lightThreshold(w, viewer)
  if (!lit) {
    if (!vision) return false
    range = darkSightRange(w, viewer, range)
  }
  const target = creatureAt(w, p)
  if (target?.sneaking && target.id !== viewer.id) range = Math.floor(range * 0.6)
  if (d > 5) range = Math.max(5, Math.floor(range * traitMul(w, viewer, 'farSightMult')))
  if (d > range) return false
  // 그림자 투사와 직접 관찰 판정이 동일한 원형 범위를 사용한다.
  if (vision && dist2(viewer.pos, p) > range * range) return false
  if (fov) { if (!fov.has(idx(w, p))) return false }
  else if (!hasLos(w, viewer.pos, p)) return false
  return true
}

export function updatePlayerVision(w: World, pl: Creature) {
  const fov = computeFov(w, pl.pos, sightRange(w, pl))
  const vis: number[] = []
  const range = sightRange(w, pl)
  const observedAt=canObserveTerrain(w,pl)?turnOf(w):undefined
  for (const i of fov) {
    const p = { x: i % w.s.map.w, y: Math.floor(i / w.s.map.w) }
    if (canSee(w, pl, p, fov, range)) {
      vis.push(i)
      const tile=w.s.map.tiles[i];tile.seen = true
      if(observedAt!==undefined){
        let contents=tile.observed?.contents
        const loot=w.s.loot
        if(pl.id===w.s.playerId&&loot?.kind==='cont'&&loot.pos.x===p.x&&loot.pos.y===p.y&&cheb(pl.pos,p)<=1&&tile.cont?.opened&&capacity(w,pl,'sight')>=.2&&lightLevel(w,pl.pos)<2)contents={at:observedAt,terrain:tile.t,items:tile.cont.items.map(it=>({uid:it.uid,def:it.def,count:it.count}))}
        tile.observed={terrain:tile.t,at:observedAt,...(tile.device?{device:{uid:tile.device.uid,def:tile.device.def,completed:[...tile.device.completed]}}:{}),...(contents?{contents}:{})}
      }
    }
  }
  w.s.visible = vis
  rememberVisiblePrisoners(w,pl,vis)
}

export function canObserveTerrain(w:World,c:Creature):boolean{return c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'sight')>0&&capacity(w,c,'consciousness')>=.5}

// 시야(재귀 그림자 투사)와 조명

import { capacity } from './body'
import { creatureAt, idx, inBounds, isOpaque, tileAt, type World } from './ctx'
import { daylight } from './environment'
import { cheb, dist2, line, type Pos } from './geom'
import { lightSource } from './items'
import { traitAdd, traitOverride } from './traits'
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
    const r = L.radius
    for (let y = Math.max(0, L.pos.y - r); y <= Math.min(m.h - 1, L.pos.y + r); y++) {
      for (let x = Math.max(0, L.pos.x - r); x <= Math.min(m.w - 1, L.pos.x + r); x++) {
        const p = { x, y }
        const d2 = dist2(L.pos, p)
        if (d2 > r * r) continue
        if (d2 > 0 && !hasLos(w, L.pos, p)) continue
        const v = 1 - Math.sqrt(d2) / (r + 1)
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
  let l = m.kind === 'surface' ? daylight(w) * (tileAt(w, p).roof ? 0.45 : 1) : m.ambient
  l = Math.max(l, staticLight(w)[p.y * m.w + p.x])
  for (const c of w.s.creatures) {
    if (!c.alive) continue
    const src = lightSource(w, c)
    if (!src) continue
    const r = w.db.item(src.def).light!.radius
    const d2 = dist2(c.pos, p)
    if (d2 > r * r) continue
    if (d2 > 0 && !hasLos(w, c.pos, p)) continue
    l = Math.max(l, 1 - Math.sqrt(d2) / (r + 1))
  }
  return l
}

export function lightThreshold(w: World, c: Creature): number {
  return traitOverride(w, c, 'lightThreshold') ?? w.db.creature(c.def).lightThreshold
}

export function sightRange(w: World, c: Creature): number {
  const base = w.db.creature(c.def).sightRange + traitAdd(w, c, 'sightRange') + Math.floor((c.stats.per - 10) / 2)
  return Math.max(1, Math.round(base * Math.max(0.15, capacity(w, c, 'sight'))))
}

/** 관찰자가 대상 위치를 볼 수 있는가 (거리·시선·조명·잠행) */
export function canSee(w: World, viewer: Creature, p: Pos, fov?: Set<number>): boolean {
  if (viewer.unconscious || viewer.asleep) return false
  const d = cheb(viewer.pos, p)
  if (d <= 1) return true
  let range = sightRange(w, viewer)
  const target = creatureAt(w, p)
  if (target?.sneaking && target.id !== viewer.id) range = Math.floor(range * 0.6)
  if (d > range) return false
  if (fov) { if (!fov.has(idx(w, p))) return false }
  else if (!hasLos(w, viewer.pos, p)) return false
  return lightAt(w, p) >= lightThreshold(w, viewer)
}

export function updatePlayerVision(w: World, pl: Creature) {
  const fov = computeFov(w, pl.pos, sightRange(w, pl))
  const vis: number[] = []
  for (const i of fov) {
    const p = { x: i % w.s.map.w, y: Math.floor(i / w.s.map.w) }
    if (canSee(w, pl, p, fov)) {
      vis.push(i)
      w.s.map.tiles[i].seen = true
    }
  }
  w.s.visible = vis
}

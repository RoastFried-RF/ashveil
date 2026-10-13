// 로컬 맵 생성: 회색 고원 폐허 외곽

import { inBounds, rng, type World } from './ctx'
import type { Pos } from './geom'
import type { Rng } from './rng'
import type { MapState, Tile } from './types'

export const MAP_W = 64
export const MAP_H = 48

function valueNoise(r: Rng, w: number, h: number, cell: number): number[] {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2
  const grid: number[] = []
  for (let i = 0; i < gw * gh; i++) grid.push(r.float())
  const out: number[] = []
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / cell, gy = y / cell
      const x0 = Math.floor(gx), y0 = Math.floor(gy)
      const tx = smooth(gx - x0), ty = smooth(gy - y0)
      const a = grid[y0 * gw + x0], b = grid[y0 * gw + x0 + 1]
      const c = grid[(y0 + 1) * gw + x0], d = grid[(y0 + 1) * gw + x0 + 1]
      out.push(a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty)
    }
  }
  return out
}

interface Rect { x: number; y: number; w: number; h: number }

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return a.x - margin < b.x + b.w && a.x + a.w + margin > b.x && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y
}

export function generateMap(w: World): { map: MapState; start: Pos; spawnable: Pos[] } {
  const r = rng(w, 'world')
  const W = MAP_W, H = MAP_H
  const tiles: Tile[] = []
  const n1 = valueNoise(r, W, H, 8)
  const n2 = valueNoise(r, W, H, 5)
  for (let i = 0; i < W * H; i++) {
    let t = n1[i] < 0.33 ? 'Terrain.Dirt' : n1[i] < 0.7 ? 'Terrain.Grass' : 'Terrain.GrassDirt'
    if (n2[i] > 0.7) t = 'Terrain.Ash'
    tiles.push({ t, v: r.int(0, 7), roof: false, blood: 0, items: [] })
  }
  const map: MapState = { w: W, h: H, tiles, exits: [] }
  const at = (x: number, y: number) => tiles[y * W + x]
  const set = (x: number, y: number, t: string) => { if (x >= 0 && y >= 0 && x < W && y < H) at(x, y).t = t }
  const reserved = new Set<number>()

  // 도로 (서→동, 완만한 굴곡)
  let ry = r.int(14, H - 14)
  const road: Pos[] = []
  for (let x = 0; x < W; x++) {
    if (x % 6 === 0) ry += r.int(-1, 1)
    ry = Math.max(6, Math.min(H - 7, ry))
    for (let dy = 0; dy < 2; dy++) {
      set(x, ry + dy, r.chance(0.1) ? 'Terrain.Rubble' : 'Terrain.Road')
      reserved.add((ry + dy) * W + x)
      road.push({ x, y: ry + dy })
    }
  }
  const start = { x: 1, y: road[0].y }
  for (const p of road) if (p.x === W - 1) map.exits.push(p)

  // 웅덩이
  const pond = { x: r.int(10, W - 10), y: r.chance(0.5) ? r.int(5, 12) : r.int(H - 12, H - 5) }
  const pr = r.int(3, 5)
  for (let y = pond.y - pr - 2; y <= pond.y + pr + 2; y++) {
    for (let x = pond.x - pr - 2; x <= pond.x + pr + 2; x++) {
      if (!inBounds(w, { x, y }) || reserved.has(y * W + x)) continue
      const d = Math.sqrt((x - pond.x) ** 2 + (y - pond.y) ** 2) + r.float() * 0.8
      if (d < pr - 1.5) set(x, y, 'Terrain.DeepWater')
      else if (d < pr) set(x, y, 'Terrain.ShallowWater')
      else if (d < pr + 1.6) set(x, y, 'Terrain.Mud')
      else continue
      reserved.add(y * W + x)
    }
  }

  // 건물
  const rects: Rect[] = []
  for (let tries = 0; tries < 80 && rects.length < 8; tries++) {
    const rw = r.int(7, 13), rh = r.int(6, 10)
    const rc: Rect = { x: r.int(3, W - rw - 3), y: r.int(2, H - rh - 2), w: rw, h: rh }
    if (rects.some((o) => overlaps(o, rc, 3))) continue
    let clash = false
    for (let y = rc.y - 1; y < rc.y + rc.h + 1 && !clash; y++)
      for (let x = rc.x - 1; x < rc.x + rc.w + 1; x++) if (reserved.has(y * W + x)) { clash = true; break }
    if (clash) continue
    rects.push(rc)
  }
  for (const rc of rects) {
    const roll = r.float()
    const wall = roll < 0.65 ? 'Terrain.BrickWall' : roll < 0.88 ? 'Terrain.StoneWall' : 'Terrain.MetalWall'
    const isOld = wall === 'Terrain.MetalWall'
    for (let y = rc.y; y < rc.y + rc.h; y++) {
      for (let x = rc.x; x < rc.x + rc.w; x++) {
        const edge = x === rc.x || y === rc.y || x === rc.x + rc.w - 1 || y === rc.y + rc.h - 1
        const corner = (x === rc.x || x === rc.x + rc.w - 1) && (y === rc.y || y === rc.y + rc.h - 1)
        if (edge) set(x, y, !corner && r.chance(0.1) ? 'Terrain.Rubble' : wall)
        else { set(x, y, 'Terrain.Concrete'); at(x, y).roof = true }
        reserved.add(y * W + x)
      }
    }
    // 문 1~2
    const doors = r.int(1, 2)
    for (let d = 0; d < doors; d++) {
      const side = r.int(0, 3)
      const dx = side < 2 ? r.int(rc.x + 1, rc.x + rc.w - 2) : side === 2 ? rc.x : rc.x + rc.w - 1
      const dy = side >= 2 ? r.int(rc.y + 1, rc.y + rc.h - 2) : side === 0 ? rc.y : rc.y + rc.h - 1
      set(dx, dy, r.chance(0.6) ? 'Terrain.DoorClosed' : 'Terrain.DoorOpen')
    }
    // 내부 칸막이
    if (rc.w >= 10) {
      const px = rc.x + r.int(4, rc.w - 5)
      const gap = r.int(rc.y + 1, rc.y + rc.h - 2)
      for (let y = rc.y + 1; y < rc.y + rc.h - 1; y++) set(px, y, y === gap ? 'Terrain.DoorOpen' : wall)
    }
    // 무너진 지붕
    if (r.chance(0.6)) {
      const cw = r.int(2, 4), ch = r.int(2, 3)
      const cx = r.int(rc.x + 1, rc.x + rc.w - 1 - cw), cy = r.int(rc.y + 1, rc.y + rc.h - 1 - ch)
      for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) {
        if (at(x, y).t !== 'Terrain.Concrete') continue
        at(x, y).roof = false
        if (r.chance(0.5)) set(x, y, 'Terrain.Rubble')
      }
    }
    // 용기
    const interior: Pos[] = []
    for (let y = rc.y + 1; y < rc.y + rc.h - 1; y++) for (let x = rc.x + 1; x < rc.x + rc.w - 1; x++) {
      if (at(x, y).t !== 'Terrain.Concrete') continue
      const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => {
        const t = at(x + ax, y + ay).t
        return t === wall
      })
      if (nearWall) interior.push({ x, y })
    }
    r.shuffle(interior)
    const nCont = Math.min(interior.length, r.int(1, 3))
    for (let i = 0; i < nCont; i++) {
      const p = interior[i]
      const kind = isOld && i === 0 ? 'Terrain.Chest' : r.weighted(['Terrain.Crate', 'Terrain.Locker', 'Terrain.Chest'], (k) => k === 'Terrain.Chest' ? 0.4 : 1)!
      set(p.x, p.y, kind)
    }
    if (interior.length > nCont && r.chance(0.35)) set(interior[nCont].x, interior[nCont].y, 'Terrain.Remains')
  }

  // 나무 군락
  const clusters = r.int(7, 11)
  for (let c = 0; c < clusters; c++) {
    let x = r.int(2, W - 3), y = r.int(2, H - 3)
    const n = r.int(3, 9)
    for (let i = 0; i < n; i++) {
      if (inBounds(w, { x, y }) && !reserved.has(y * W + x) && Math.abs(x - start.x) + Math.abs(y - start.y) > 4) {
        set(x, y, 'Terrain.Tree')
        reserved.add(y * W + x)
      }
      x += r.int(-1, 1); y += r.int(-1, 1)
    }
  }
  // 바위·기둥·야외 유골
  const scatter = (t: string, n: number) => {
    for (let i = 0, guard = 0; i < n && guard < 500; guard++) {
      const x = r.int(1, W - 2), y = r.int(1, H - 2)
      if (reserved.has(y * W + x) || Math.abs(x - start.x) + Math.abs(y - start.y) < 5) continue
      set(x, y, t); reserved.add(y * W + x); i++
    }
  }
  scatter('Terrain.Boulder', r.int(8, 14))
  scatter('Terrain.Column', r.int(4, 8))
  scatter('Terrain.Remains', r.int(2, 4))

  const spawnable: Pos[] = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1
    if (edge && !reserved.has(y * W + x)) spawnable.push({ x, y })
  }
  return { map, start, spawnable }
}

// A* (8방향, 체비셰프). 대각선 모서리 끼기 금지. 닫힌 문은 통과 가능(열면 됨).

import { creatureAt, inBounds, type World } from './ctx'
import { DIRS, type Pos } from './geom'

function passableForPath(w: World, p: Pos): boolean {
  if (!inBounds(w, p)) return false
  const t = w.db.terrain(w.s.map.tiles[p.y * w.s.map.w + p.x].t)
  return t.passable || t.door === 'closed'
}

export function diagonalBlocked(w: World, from: Pos, dx: number, dy: number): boolean {
  if (dx === 0 || dy === 0) return false
  const a = { x: from.x + dx, y: from.y }
  const b = { x: from.x, y: from.y + dy }
  const pa = inBounds(w, a) && w.db.terrain(w.s.map.tiles[a.y * w.s.map.w + a.x].t).passable
  const pb = inBounds(w, b) && w.db.terrain(w.s.map.tiles[b.y * w.s.map.w + b.x].t).passable
  return !pa && !pb
}

export function findPath(w: World, from: Pos, to: Pos, opts: { maxNodes?: number; avoidCreatures?: boolean; selfId?: number } = {}): Pos[] | null {
  const W = w.s.map.w
  const maxNodes = opts.maxNodes ?? 2500
  const key = (p: Pos) => p.y * W + p.x
  const goal = key(to)
  const open: { k: number; f: number }[] = [{ k: key(from), f: 0 }]
  const g = new Map<number, number>([[key(from), 0]])
  const came = new Map<number, number>()
  const h = (k: number) => Math.max(Math.abs((k % W) - to.x), Math.abs(Math.floor(k / W) - to.y))
  let expanded = 0
  while (open.length && expanded < maxNodes) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f || (open[i].f === open[bi].f && open[i].k < open[bi].k)) bi = i
    const cur = open.splice(bi, 1)[0]
    if (cur.k === goal) break
    expanded++
    const cp = { x: cur.k % W, y: Math.floor(cur.k / W) }
    for (const d of DIRS) {
      const np = { x: cp.x + d.x, y: cp.y + d.y }
      const nk = key(np)
      if (nk !== goal && !passableForPath(w, np)) continue
      if (diagonalBlocked(w, cp, d.x, d.y)) continue
      let cost = 1
      if (opts.avoidCreatures && nk !== goal) {
        const oc = creatureAt(w, np)
        if (oc && oc.id !== opts.selfId) cost += 6
      }
      const t = w.db.terrain(w.s.map.tiles[nk].t)
      cost *= t.moveMult
      const ng = (g.get(cur.k) ?? 0) + cost
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        came.set(nk, cur.k)
        const f = ng + h(nk)
        const ex = open.find((o) => o.k === nk)
        if (ex) ex.f = f
        else open.push({ k: nk, f })
      }
    }
  }
  if (!came.has(goal)) return null
  const path: Pos[] = []
  let k = goal
  while (k !== key(from)) {
    path.push({ x: k % W, y: Math.floor(k / W) })
    k = came.get(k)!
  }
  return path.reverse()
}

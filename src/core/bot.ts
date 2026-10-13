// 헤드리스 밸런스용 단순 플레이어 봇. 사람처럼 잘하진 않지만 시스템이 돌아가는지 본다.

import { adjacentContainer, hostile, type Action } from './actions'
import { bloodLoss, effectiveBleed, part } from './body'
import { canReach } from './combat'
import { creatureAt, inBounds, player, terrainAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { canSee } from './fov'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { itemDef, mainWeapon } from './items'
import { isRaining } from './environment'
import { diagonalBlocked, findPath } from './path'

export function botDecide(w: World): Action {
  const pl = player(w)
  const inv = pl.inventory
  const find = (pred: (d: ReturnType<typeof itemDef>) => boolean) => inv.find((i) => pred(itemDef(w, i)))

  // 출혈 처치
  const bleeding = pl.body.wounds
    .filter((wd) => !wd.internal && effectiveBleed(w, pl, wd) > 1.2)
    .sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))
  const enemies = w.s.creatures.filter((o) => o.alive && hostile(pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos))
  const adjacentEnemy = enemies.find((e) => cheb(e.pos, pl.pos) <= 1)
  if (bleeding.length && !adjacentEnemy) {
    const wd = bleeding[0]
    const limb = part(w, pl, wd.part).limb
    const tq = find((d) => d.medical?.kind === 'tourniquet')
    if (wd.arterial && limb && tq && pl.body.tourniquets[limb] === undefined) return { type: 'treat', uid: tq.uid, woundId: wd.id }
    if (!wd.bandage) {
      const band = find((d) => d.medical?.kind === 'bandage')
      if (band) return { type: 'treat', uid: band.uid, woundId: wd.id }
    }
    if (effectiveBleed(w, pl, wd) > 2) return { type: 'press', woundId: wd.id }
  }
  // 지혈대 1.5시간 넘으면 풀기
  for (const [limb, at] of Object.entries(pl.body.tourniquets)) if (turnOf(w) - at > 1800) return { type: 'removeTourniquet', limb }
  const frac = pl.body.wounds.find((wd) => wd.fracture && !wd.splinted)
  const splint = find((d) => d.medical?.kind === 'splint')
  if (frac && splint && !adjacentEnemy) return { type: 'treat', uid: splint.uid, woundId: frac.id }

  // 전투
  if (enemies.length) {
    enemies.sort((a, b) => cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos))
    const e = enemies[0]
    if (bloodLoss(pl) > 0.3 && cheb(e.pos, pl.pos) > 1) {
      const away = stepAway(w, enemies.map((x) => x.pos))
      if (away !== null) return { type: 'move', dir: away }
    }
    const mw = mainWeapon(w, pl)
    if (cheb(e.pos, pl.pos) <= 1 && mw && itemDef(w, mw).ranged) {
      const melee = inv.find((i) => itemDef(w, i).category === 'weapon' && !itemDef(w, i).ranged)
      if (melee) return { type: 'equip', uid: melee.uid }
    }
    if (!(mw && itemDef(w, mw).ranged && cheb(e.pos, pl.pos) > 1) && canReach(w, pl, e)) return { type: 'attack', target: e.id }
    if (mw && itemDef(w, mw).ranged && inv.some((i) => i.def === itemDef(w, mw).ranged!.ammo)) return { type: 'shoot', target: e.id }
    const st = stepTo(w, e.pos)
    if (st !== null) return { type: 'move', dir: st }
    return { type: 'wait' }
  }

  // 생존
  if (pl.needs.kcal < 900) {
    const food = find((d) => !!d.food && !d.food.raw) ?? find((d) => !!d.food)
    if (food) return { type: 'consume', uid: food.uid }
  }
  if (pl.needs.water < 900) {
    const drink = inv.find((i) => itemDef(w, i).drink && !itemDef(w, i).drink!.alcohol && (i.uses ?? 0) > 0)
    if (drink) return { type: 'consume', uid: drink.uid }
    if (DIRS.some((d) => { const p = { x: pl.pos.x + d.x, y: pl.pos.y + d.y }; return inBounds(w, p) && !!terrainAt(w, p).water })) return { type: 'drinkHere' }
    const water = nearest(w, (p) => terrainAt(w, p).water === 'shallow')
    if (water) { const st = stepTo(w, water); if (st !== null) return { type: 'move', dir: st } }
  }
  // 추위·비: 지붕 아래로
  const here = w.s.map.tiles[pl.pos.y * w.s.map.w + pl.pos.x]
  if (!here.roof && (pl.needs.bodyTemp < 36 || (isRaining(w) && pl.needs.wetness > 30))) {
    const roof = nearest(w, (p) => w.s.map.tiles[p.y * w.s.map.w + p.x].roof && terrainAt(w, p).passable && !creatureAt(w, p))
    if (roof) { const st = stepTo(w, roof); if (st !== null) return { type: 'move', dir: st } }
  }
  if (pl.needs.fatigue > 75 && pl.needs.bodyTemp >= 35) return { type: 'sleep' }
  if (pl.needs.bodyTemp < 36 && here.roof) return { type: 'rest', turns: 120 }

  // 탐색
  if (w.s.map.tiles[pl.pos.y * w.s.map.w + pl.pos.x].items.length) return { type: 'pickup' }
  if (adjacentContainer(w, pl)) return { type: 'search' }
  const cont = nearest(w, (p) => !!terrainAt(w, p).container && !w.s.map.tiles[p.y * w.s.map.w + p.x].searched)
  if (cont) {
    const st = stepTo(w, cont)
    if (st !== null) return { type: 'move', dir: st }
  }
  if (turnOf(w) > TURNS_PER_DAY * 2.5) {
    const exit = w.s.map.exits[0]
    if (eq(pl.pos, exit)) return { type: 'leave' }
    const st = stepTo(w, exit)
    if (st !== null) return { type: 'move', dir: st }
  }
  return { type: 'rest', turns: 60 }
}

function nearest(w: World, pred: (p: Pos) => boolean): Pos | null {
  const pl = player(w)
  let best: Pos | null = null
  let bd = Infinity
  for (let y = 0; y < w.s.map.h; y++) for (let x = 0; x < w.s.map.w; x++) {
    const p = { x, y }
    if (!pred(p)) continue
    const d = cheb(p, pl.pos)
    if (d < bd) { bd = d; best = p }
  }
  return best
}

function stepTo(w: World, dest: Pos): number | null {
  const pl = player(w)
  const path = findPath(w, pl.pos, dest, { avoidCreatures: true, selfId: pl.id })
  if (!path || !path.length) return null
  const n = path[0]
  if (eq(n, dest) && terrainAt(w, dest).container && !terrainAt(w, dest).passable) return null
  return dirIndex(n.x - pl.pos.x, n.y - pl.pos.y)
}

function stepAway(w: World, threats: Pos[]): number | null {
  const pl = player(w)
  let best: number | null = null, bs = -1
  for (let i = 0; i < 8; i++) {
    const p = { x: pl.pos.x + DIRS[i].x, y: pl.pos.y + DIRS[i].y }
    if (p.x < 0 || p.y < 0 || p.x >= w.s.map.w || p.y >= w.s.map.h) continue
    if (!terrainAt(w, p).passable || creatureAt(w, p) || diagonalBlocked(w, pl.pos, DIRS[i].x, DIRS[i].y)) continue
    const s = Math.min(...threats.map((t) => cheb(t, p)))
    if (s > bs) { bs = s; best = i }
  }
  return best
}

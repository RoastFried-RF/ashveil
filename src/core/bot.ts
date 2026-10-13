// 헤드리스 밸런스용 단순 플레이어 봇. 사람처럼 잘하진 않지만 시스템이 돌아가는지 본다.
// 지상 → 수도원 계단 → 지하 묘소를 탐색하며 상자를 뒤지고, 레벨업 포인트를 쓰고, 능력을 쓴다.

import { abilityReady } from './abilities'
import { adjacentContainer, adjacentCorpse, hostile, lootItems, type Action } from './actions'
import { bloodLoss, effectiveBleed, hpMax, part } from './body'
import { canReach } from './combat'
import { creatureAt, inBounds, player, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee } from './fov'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { allItems, countOf, currentAttack, itemDef, mainWeapon } from './items'
import { diagonalBlocked, findPath } from './path'
import { abilitiesByTree, canLearn } from './progression'
import type { Stats } from './types'

const STAT_ORDER: (keyof Stats)[] = ['agi', 'str', 'vit', 'agi', 'per', 'vit', 'wil']
/** 세계(상태)마다 '이번 턴에 이미 다 담았다' 표시 — 모듈 전역이면 두 세계가 섞인다 */
const lastLootTurn = new WeakMap<object, number>()

export function botDecide(w: World): Action {
  const pl = player(w)
  const inv = allItems(pl)
  const find = (pred: (d: ReturnType<typeof itemDef>) => boolean) => inv.find((i) => pred(itemDef(w, i)))

  // 성장 포인트
  if (pl.statPoints > 0) return { type: 'spendStat', stat: STAT_ORDER[(pl.level + pl.statPoints) % STAT_ORDER.length] }
  if (pl.abilityPoints > 0) {
    const skill = currentAttack(w, pl)?.family
    const trees = abilitiesByTree(w)
    for (const tree of Object.keys(trees).sort((a, b) => Number(b === skill) - Number(a === skill))) {
      const ab = trees[tree].find((d) => !canLearn(w, pl, d.id))
      if (ab) return { type: 'learn', id: ab.id }
    }
  }
  // 열린 루팅 창: 한 번 다 담고 닫는다
  const list = lootItems(w)
  if (list) {
    if (list.length && lastLootTurn.get(w.s) !== turnOf(w)) {
      lastLootTurn.set(w.s, turnOf(w))
      return { type: 'lootAll' }
    }
    return { type: 'lootClose' }
  }

  // 어두운 곳에서는 등불을 켠다
  const lamp = inv.find((i) => !!itemDef(w, i).light)
  if (lamp && !lamp.lit && (lamp.fuel ?? 0) > 0 && w.s.map.kind === 'dungeon') return { type: 'toggleLight', uid: lamp.uid }

  // 출혈 처치
  const bleeding = pl.body.wounds
    .filter((wd) => !wd.internal && effectiveBleed(w, pl, wd) > 1.2)
    .sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))
  const enemies = w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos))
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
  const frac = pl.body.wounds.find((wd) => wd.fracture && !wd.splint)
  const splint = find((d) => d.medical?.kind === 'splint')
  if (frac && splint && !adjacentEnemy) return { type: 'treat', uid: splint.uid, woundId: frac.id }
  if (pl.hp < hpMax(w, pl) * 0.35) {
    const draught = inv.find((i) => i.def === 'Item.HealthDraught')
    if (draught) return { type: 'consume', uid: draught.uid }
  }

  // 전투
  if (enemies.length) {
    enemies.sort((a, b) => cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos))
    const e = enemies[0]
    if (bloodLoss(pl) > 0.3 && cheb(e.pos, pl.pos) > 1) {
      const away = stepAway(w, enemies.map((x) => x.pos))
      if (away !== null) return { type: 'move', dir: away }
    }
    const mw = mainWeapon(w, pl)
    const ranged = !!(mw && itemDef(w, mw).ranged)
    if (cheb(e.pos, pl.pos) <= 1 && ranged) {
      const melee = inv.find((i) => itemDef(w, i).category === 'weapon' && !itemDef(w, i).ranged)
      if (melee) return { type: 'equip', uid: melee.uid }
    }
    if (canReach(w, pl, e) && !(ranged && cheb(e.pos, pl.pos) > 1)) {
      for (const id of pl.abilities) {
        const d = w.db.ability(id)
        if (d.kind === 'active' && d.attack && !abilityReady(w, pl, id)) return { type: 'ability', id, target: e.id }
      }
      return { type: 'attack', target: e.id }
    }
    if (ranged && countOf(pl, itemDef(w, mw!).ranged!.ammo) > 0) return { type: 'shoot', target: e.id }
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
    // 지하에는 물이 없다: 위층 계단으로 올라간다
    const up = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsUp')
    if (up && pl.needs.water < 600) {
      if (eq(pl.pos, up.pos)) return { type: 'stairs' }
      const st = stepTo(w, up.pos)
      if (st !== null) return { type: 'move', dir: st }
    }
  }
  const awakeNear = w.s.creatures.some((o) => o.alive && !o.asleep && hostile(pl, o) && o.ai.mode !== 'surrender' && cheb(o.pos, pl.pos) <= 8)
  if (pl.needs.fatigue > 75 && pl.needs.bodyTemp >= 35 && !awakeNear) return { type: 'sleep' }
  // 다쳤으면 다음 방으로 가기 전에 쉰다 (던전 탐험의 정석)
  if ((pl.hp < hpMax(w, pl) * 0.75 || bloodLoss(pl) > 0.12) && !awakeNear) return { type: 'rest', turns: 120 }

  // 탐색: 바닥 → 용기 → 미발견 방 → 아래층
  if (tileAt(w, pl.pos).items.length) return { type: 'pickup' }
  if (adjacentContainer(w, pl) || adjacentCorpse(w, pl, true)) return { type: 'search' }
  // 쓰러뜨린 적의 시체를 뒤진다 (소지품은 시체에 남는다)
  const body = w.s.creatures.find((o) => !o.alive && !o.searched && o.id !== pl.id && cheb(o.pos, pl.pos) <= 10 && (o.bag.length > 0 || Object.values(o.equip).some(Boolean)))
  if (body) {
    const st = stepTo(w, body.pos)
    if (st !== null) return { type: 'move', dir: st }
  }
  // 레벨이 낮으면 약탈자 야영지는 피한다
  const avoid = (p: Pos) => pl.level < 5 && w.s.map.rooms[tileAt(w, p).room ?? -1]?.type === 'camp'
  const cont = nearest(w, (p) => !!terrainAt(w, p).container && !tileAt(w, p).searched && !!tileAt(w, p).seen && !avoid(p))
  if (cont) {
    const st = stepTo(w, cont)
    if (st !== null) return { type: 'move', dir: st }
  }
  const room = w.s.map.rooms
    .filter((r) => !r.discovered && !(r.type === 'camp' && pl.level < 5))
    .map((r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }))
    .sort((a, b) => cheb(a, pl.pos) - cheb(b, pl.pos))[0]
  if (room) {
    const st = stepTo(w, room)
    if (st !== null) return { type: 'move', dir: st }
  }
  const down = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsDown')
  if (down) {
    if (eq(pl.pos, down.pos)) return { type: 'stairs' }
    const st = stepTo(w, down.pos)
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
    if (!inBounds(w, p)) continue
    if (!terrainAt(w, p).passable || creatureAt(w, p) || diagonalBlocked(w, pl.pos, DIRS[i].x, DIRS[i].y)) continue
    const s = Math.min(...threats.map((t) => cheb(t, p)))
    if (s > bs) { bs = s; best = i }
  }
  return best
}

import { describe, expect, it } from 'vitest'
import { abilityReady } from '../src/core/abilities'
import { player, terrainAt, type World } from '../src/core/ctx'
import { changeMap, playerAct } from '../src/core/game'
import { addToBag, BAG_H, BAG_W, fitsAt, itemDef, makeItem, moveInBag } from '../src/core/items'
import { generateDungeon } from '../src/core/mapgen'
import { findPath } from '../src/core/path'
import { canLearn, gainXp, xpToNext } from '../src/core/progression'
import { makeWorld } from './helpers'

function emptyBag(w: World) {
  const pl = player(w)
  pl.bag = []
  return pl
}

describe('격자 배낭·장비', () => {
  it('크기만큼 칸을 차지하고 겹치지 않는다', () => {
    const w = makeWorld('inv1')
    const pl = emptyBag(w)
    const spear = makeItem(w, 'Item.RebarSpear')
    const [sw, sh] = itemDef(w, spear).size
    expect(addToBag(w, pl, spear)).toBe(0)
    expect(spear.gx).toBe(0)
    expect(spear.gy).toBe(0)
    // 같은 자리에는 다른 물건이 못 들어간다
    expect(fitsAt(w, pl, w.db.item('Item.Bandage'), 0, 0)).toBe(false)
    expect(fitsAt(w, pl, w.db.item('Item.Bandage'), sw, 0)).toBe(true)
    // 옮기기: 범위 밖 금지
    expect(moveInBag(w, pl, spear.uid, BAG_W - sw + 1, 0)).toBe(false)
    expect(moveInBag(w, pl, spear.uid, BAG_W - sw, BAG_H - sh)).toBe(true)
  })
  it('쌓이는 물건은 기존 묶음부터 채운다', () => {
    const w = makeWorld('inv2')
    const pl = emptyBag(w)
    addToBag(w, pl, makeItem(w, 'Item.Arrow', 3))
    addToBag(w, pl, makeItem(w, 'Item.Arrow', 2))
    const arrows = pl.bag.filter((i) => i.def === 'Item.Arrow')
    const total = arrows.reduce((s, i) => s + i.count, 0)
    expect(total).toBe(5)
    expect(arrows.length).toBe(Math.ceil(5 / (w.db.item('Item.Arrow').maxStack ?? 5)))
  })
  it('가득 차면 남은 개수를 돌려준다', () => {
    const w = makeWorld('inv3')
    const pl = emptyBag(w)
    let left = 0
    for (let i = 0; i < BAG_W * BAG_H + 5; i++) left += addToBag(w, pl, makeItem(w, 'Item.RustyKnife'))
    expect(left).toBeGreaterThan(0)
  })
  it('장착하면 배낭에서 빠지고, 벗으면 돌아온다', () => {
    const w = makeWorld('inv4')
    const pl = emptyBag(w)
    pl.equip = {}
    const knife = makeItem(w, 'Item.RustyKnife')
    addToBag(w, pl, knife)
    expect(playerAct(w, { type: 'equip', uid: knife.uid })).toBeNull()
    expect(pl.equip.main?.uid).toBe(knife.uid)
    expect(pl.bag.some((i) => i.uid === knife.uid)).toBe(false)
    expect(playerAct(w, { type: 'unequip', slot: 'main' })).toBeNull()
    expect(pl.bag.some((i) => i.uid === knife.uid)).toBe(true)
  })
})

describe('성장', () => {
  it('누적 경험치 문턱 100·300·600 → 레벨과 포인트', () => {
    expect([xpToNext(1), xpToNext(2), xpToNext(3)]).toEqual([100, 300, 600])
    const w = makeWorld('lv1')
    const pl = player(w)
    const sp = pl.statPoints, ap = pl.abilityPoints
    gainXp(w, pl, 320)
    expect(pl.level).toBe(3)
    expect(pl.statPoints).toBe(sp + 2)
    expect(pl.abilityPoints).toBe(ap + 2)
  })
  it('같은 갈래를 (단계−1)개 배워야 다음 단계', () => {
    const w = makeWorld('lv2', 'Bg.Deserter')
    const pl = player(w)
    pl.abilityPoints = 5
    pl.abilities = []
    expect(canLearn(w, pl, 'Ab.Blade.Edge')).toMatch(/먼저 배워야/)
    expect(canLearn(w, pl, 'Ab.Blade.DeepCut')).toBeNull()
    expect(playerAct(w, { type: 'learn', id: 'Ab.Blade.DeepCut' })).toBeNull()
    expect(canLearn(w, pl, 'Ab.Blade.Edge')).toBeNull()
    expect(pl.hotbar.some((h) => h?.kind === 'ability' && h.id === 'Ab.Blade.DeepCut')).toBe(true)
  })
  it('능력은 기력·재사용 대기가 있다', () => {
    const w = makeWorld('lv3', 'Bg.Deserter')
    const pl = player(w)
    pl.needs.stamina = 0
    expect(abilityReady(w, pl, 'Ab.Blade.DeepCut')).toMatch(/기력/)
  })
})

describe('장소·던전', () => {
  it('모든 층의 모든 방이 입구에서 걸어서 닿는다 (여러 시드)', () => {
    for (const seed of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']) {
      const w = makeWorld(seed)
      for (let depth = 1; depth <= 3; depth++) {
        const gen = generateDungeon(w, depth)
        const s = { ...w.s, map: gen.map, creatures: [] }
        const ww: World = { db: w.db, s }
        for (const R of gen.map.rooms) {
          let ok = false
          for (let y = R.y; y < R.y + R.h && !ok; y++) for (let x = R.x; x < R.x + R.w && !ok; x++) {
            if (!terrainAt(ww, { x, y }).passable) continue
            ok = !!findPath(ww, gen.start, { x, y }, { maxNodes: 6000 })
          }
          expect(ok, `${seed} 지하${depth} ${R.name}`).toBe(true)
        }
        // 계단이 있다
        expect(gen.map.links.length).toBeGreaterThanOrEqual(depth < 3 ? 2 : 1)
      }
    }
  })
  it('적은 정해진 방에 산다: 지하 3층에만 우두머리', () => {
    const w = makeWorld('d7')
    const g1 = generateDungeon(w, 1), g3 = generateDungeon(w, 3)
    expect(g1.spawns.some((s) => s.def === 'Creature.Amalgam')).toBe(false)
    expect(g3.spawns.filter((s) => s.def === 'Creature.Amalgam').length).toBe(1)
    for (const s of g1.spawns) expect(g1.map.tiles[s.pos.y * g1.map.w + s.pos.x].room).not.toBeUndefined()
  })
  it('지도를 오가도 떠난 층의 상태가 남는다', () => {
    const w = makeWorld('d8')
    const pl = player(w)
    changeMap(w, 'crypt1')
    expect(w.s.map.id).toBe('crypt1')
    const n1 = w.s.creatures.length
    const t = w.s.map.tiles.find((x) => terrainAt(w, { x: 0, y: 0 }) && x.t === 'Terrain.KtFloor')!
    t.blood = 77
    changeMap(w, 'surface')
    expect(w.s.map.id).toBe('surface')
    changeMap(w, 'crypt1')
    expect(w.s.creatures.length).toBe(n1)
    expect(w.s.map.tiles.some((x) => x.blood === 77)).toBe(true)
    expect(terrainAt(w, pl.pos).stairs).toBe('up')
  })
})

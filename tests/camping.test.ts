import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { energyMax, hpMax } from '../src/core/body'
import { beddingAt, campingTick, packBedding } from '../src/core/camping'
import { sleepQuality } from '../src/core/conditions'
import { player, tileAt, TURNS_PER_HOUR } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { thermalState } from '../src/core/thermal'
import { makeWorld } from './helpers'

function setup() {
  const w = makeWorld('camping', 'Bg.Excommunicate'), pl = player(w)
  pl.pos = { x: 20, y: 20 }; pl.traits = []; pl.bag = []; pl.equip = {}; pl.thoughts = []
  pl.hp = hpMax(w, pl); pl.needs.energy = energyMax(w, pl)
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  w.s.map.lights = [{ pos: { ...pl.pos }, kind: 'campfire', radius: 6 }]
  w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time; invalidateLights(w)
  return { w, pl }
}
function deploy(w: ReturnType<typeof makeWorld>, id = 'Item.Bedroll') {
  const pl = player(w), it = makeItem(w, id)
  expect(addToBag(w, pl, it)).toBe(0)
  expect(perform(w, pl, { type: 'place', uid: it.uid, dir: 2 }).ok).toBe(true)
  return { it, pos: { x: pl.pos.x + 1, y: pl.pos.y } }
}

describe('침구·야영', () => {
  it('정본의 침구 6종 수면 질을 실제 발밑 지형으로 계산한다', () => {
    const { w, pl } = setup()
    for (const [id, q] of [['Earth', .5], ['FieldMat', .65], ['Bedroll', .8], ['StrawBed', .9], ['Bed', 1], ['GoodBed', 1.1]] as const) {
      tileAt(w, pl.pos).t = `Terrain.${id}`
      expect(sleepQuality(w, pl)).toBeCloseTo(q)
    }
  })
  it('침낭은 가방에 있을 때·깨어 있을 때는 보온하지 않고 수면 때만 +6이다', () => {
    const { w, pl } = setup(), before = thermalState(w, pl, false).insulation
    const { pos } = deploy(w)
    expect(thermalState(w, pl, true).insulation).toBe(before)
    pl.pos = pos
    expect(thermalState(w, pl, false).insulation).toBe(before)
    expect(thermalState(w, pl, true).insulation).toBeCloseTo(before + 6)
    expect(thermalState(w, pl, true).low).toBeCloseTo(21 - 2.5 * (before + 6))
  })
  it('비에 젖은 침낭은 보온이 줄고 접어도 젖음·UID·품질을 보존한다', () => {
    const { w, pl } = setup(), { it, pos } = deploy(w)
    tileAt(w, pos).placed!.item.quality = 2
    w.s.weather = 'ashrain'; campingTick(w)
    const b = beddingAt(w, pos)
    expect(b.wetness).toBe(100); expect(b.insulation).toBeCloseTo(6 * 1.05 * .3)
    expect(packBedding(w, pl, pos)).toBeNull()
    const packed = pl.bag.find((i) => i.uid === it.uid)!
    expect(packed.quality).toBe(2); expect(packed.wetness!.torso).toBe(100)
    expect(perform(w, pl, { type: 'place', uid: it.uid, dir: 2 }).ok).toBe(true)
    expect(beddingAt(w, pos).wetness).toBe(100)
  })
  it('지붕은 침구의 비 젖음을 막고 벽은 모닥불 건조를 막는다', () => {
    const { w } = setup(), { pos } = deploy(w), tile = tileAt(w, pos)
    tile.roof = true; w.s.weather = 'ashrain'; campingTick(w)
    expect(beddingAt(w, pos).wetness).toBe(0)
    tile.placed!.item.wetness = { torso: 100 }; campingTick(w)
    expect(beddingAt(w, pos).wetness).toBe(90)
    w.s.map.lights[0].pos = { x: 19, y: 20 }; tileAt(w, { x: 20, y: 20 }).t = 'Terrain.KtWall'; invalidateLights(w)
    campingTick(w); expect(beddingAt(w, pos).wetness).toBe(88)
  })
  it('접으면 설치 전 지형이 복원되고 재회수·침대 접기는 실패한다', () => {
    const { w, pl } = setup(), p = { x: 21, y: 20 }; tileAt(w, p).t = 'Terrain.Mud'
    deploy(w, 'Item.FieldMat')
    expect(packBedding(w, pl, p)).toBeNull(); expect(tileAt(w, p).t).toBe('Terrain.Mud')
    expect(packBedding(w, pl, p)).not.toBeNull()
    deploy(w, 'Item.GoodBed'); expect(packBedding(w, pl, p)).toContain('접어')
  })
  it('접을 때 가방이 가득 차면 침낭 하나만 발밑에 남긴다', () => {
    const { w, pl } = setup(), { pos } = deploy(w)
    while (addToBag(w, pl, makeItem(w, 'Item.Needle')) === 0) { /* 채우기 */ }
    expect(packBedding(w, pl, pos)).toBeNull()
    expect(tileAt(w, pl.pos).items.filter((i) => i.def === 'Item.Bedroll')).toHaveLength(1)
    expect(packBedding(w, pl, pos)).not.toBeNull()
  })
  it('설치한 침구 저장·복원 후 같은 시간 동안 자면 같은 상태다', () => {
    const { w, pl } = setup(), { pos } = deploy(w); pl.pos = pos; pl.needs.fatigue = 80
    const restored = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const x of [w, restored]) expect(playerAct(x, { type: 'sleep' }, undefined, x.s.time + 20 * 100)).toBeNull()
    expect(player(w).needs.fatigue).toBeLessThan(80)
    expect(stateHash(w.s)).toBe(stateHash(restored.s))
  })
})

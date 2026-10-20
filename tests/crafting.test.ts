import { describe, expect, it } from 'vitest'
import { activityStep, multiTurnFactor, perform } from '../src/core/actions'
import { energyMax, hpMax } from '../src/core/body'
import { collectBatch, craftError, craftingQuality, craftTurns, nearbyGather, qualityFromScore, repairPreview, salvagePreview, startCraft, startMaintenance, workshop } from '../src/core/crafting'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { loadMods } from '../src/core/defs'
import { invalidateLights } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { studyBook } from '../src/core/skills'
import type { RecipeDef, TraitDef } from '../src/core/types'
import { readPackages } from '../tools/loadContent'
import { makeWorld } from './helpers'

function setup() {
  const w = makeWorld('crafting', 'Bg.Excommunicate'), pl = player(w)
  pl.pos = { x: 20, y: 20 }; pl.traits = []; pl.abilities = []; pl.bag = []; pl.equip = {}; pl.background = undefined
  pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.skills = {}; pl.thoughts = []
  pl.hp = hpMax(w, pl); pl.needs.energy = energyMax(w, pl)
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.map.lights = []
  for (let y = 16; y <= 24; y++) for (let x = 16; x <= 24; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time; invalidateLights(w)
  return { w, pl }
}
function item(w: ReturnType<typeof makeWorld>, id: string, count = 1) {
  const it = makeItem(w, id, count)
  expect(addToBag(w, player(w), it)).toBe(0)
  return it
}
function finish(w: ReturnType<typeof makeWorld>) {
  for (let guard = 0; player(w).activity && guard < 10000; guard++) activityStep(w, player(w))
  expect(player(w).activity).toBeUndefined()
}
function station(w: ReturnType<typeof makeWorld>, id: string) { tileAt(w, { x: 21, y: 20 }).t = id; invalidateLights(w) }
function fire(w: ReturnType<typeof makeWorld>) { w.s.map.lights = [{ pos: { ...player(w).pos }, kind: 'campfire', radius: 6 }]; invalidateLights(w) }
function artisan(w: ReturnType<typeof makeWorld>) {
  const { db, report } = loadMods([...readPackages(), { manifest: { id: 'test.craft', name: '검증', version: '1' }, defs: [{ defType: 'Trait', id: 'Trait.TestCraft', label: '검증', description: '제작 정본 검산', mods: { craftQ: 10, repairBonus: 10 } } as TraitDef], patches: [] }])
  expect(report.errors).toEqual([]); w.db = db; player(w).traits = ['Trait.TestCraft']
}

describe('제작·재료와 저장', () => {
  it('중단 17턴 뒤 저장·재개해 40턴에 재료 2개를 한 번만 소비한다', () => {
    const { w, pl } = setup(), cloth = item(w, 'Item.Cloth', 3)
    expect(startCraft(w, pl, 'Recipe.Bandage', 1)).toBeNull()
    for (let i = 0; i < 17; i++) activityStep(w, pl)
    expect(cloth.count).toBe(3); expect(pl.workJob!.progress).toBe(17)
    pl.activity = undefined
    const restored = { db: w.db, s: deserialize(serialize(w.s)) }, rp = player(restored)
    for (const x of [w, restored]) {
      const p = player(x)
      expect(startCraft(x, p, 'Recipe.Bandage', 1)).toBeNull(); expect(p.activity!.remaining).toBe(23)
      finish(x)
      expect(p.bag.filter((i) => i.def === 'Item.Cloth').reduce((n, i) => n + i.count, 0)).toBe(1)
      expect(p.bag.filter((i) => i.def === 'Item.Bandage')).toHaveLength(1)
      expect(p.skills.medicine).toBe(1); expect(p.workJob).toBeUndefined()
    }
    expect(rp.activity).toBeUndefined(); expect(stateHash(w.s)).toBe(stateHash(restored.s))
  })
  it('예약 재료가 사라지면 멈추며 새 묶음으로 바꿔서 진행을 보존할 수 없다', () => {
    const { w, pl } = setup(), cloth = item(w, 'Item.Cloth', 2)
    startCraft(w, pl, 'Recipe.Bandage', 1); activityStep(w, pl)
    pl.bag = []; item(w, 'Item.Cloth', 2)
    expect(activityStep(w, pl)).toBe(true); expect(pl.workJob!.progress).toBe(1)
    expect(startCraft(w, pl, 'Recipe.Bandage', 1)).toContain('바뀌었다')
    expect(perform(w, pl, { type: 'cancelWork' }).ok).toBe(true)
    expect(startCraft(w, pl, 'Recipe.Bandage', 1)).toBeNull(); expect(pl.workJob!.progress).toBe(0)
    expect(pl.workJob!.inputs[0].uid).not.toBe(cloth.uid)
  })
  it('같은 묶음을 쓰는 복수 입력도 합산해 부족분과 이중 소비를 막는다', () => {
    const { w, pl } = setup(), base = w.db.get<RecipeDef>('Recipe.Bandage')
    const r: RecipeDef = { ...base, inputs: [{ item: 'Item.Cloth', count: 2 }, { item: 'Item.Cloth', count: 2 }] }
    item(w, 'Item.Cloth', 3)
    expect(craftError(w, pl, r)).toContain('부족')
  })
  it('제작법·도구·작업장 조건을 실제 시작에서 확인한다', () => {
    const { w, pl } = setup()
    expect(startCraft(w, pl, 'Recipe.Knife', 1)).toContain('모르는')
    studyBook(w, pl, 'Item.CraftManual'); expect(pl.recipes).toContain('Recipe.Knife')
    expect(startCraft(w, pl, 'Recipe.Knife', 1)).toContain('작업장')
    station(w, 'Terrain.Forge')
    expect(startCraft(w, pl, 'Recipe.Knife', 1)).toContain('도구')
    item(w, 'Item.IronHammer'); item(w, 'Item.Tongs')
    expect(startCraft(w, pl, 'Recipe.Knife', 1)).toContain('재료')
  })
  it('젖어 잃어버린 책 부분은 제작법을 가르치지 않는다', () => {
    const { w, pl } = setup(), xp = pl.xp
    studyBook(w, pl, 'Item.CraftManual', false, 0.8)
    expect(pl.recipes ?? []).toHaveLength(0); expect(pl.xp).toBe(xp)
  })
  it('모닥불이 꺼지면 멈추고 조리 재료와 진행을 보존한다', () => {
    const { w, pl } = setup(); item(w, 'Item.RawMeat'); fire(w)
    expect(startCraft(w, pl, 'Recipe.RoastMeat', 1)).toBeNull(); activityStep(w, pl)
    w.s.map.lights[0].off = true; activityStep(w, pl)
    expect(pl.activity).toBeUndefined(); expect(pl.workJob!.progress).toBe(1)
    expect(pl.bag[0].def).toBe('Item.RawMeat')
    w.s.map.lights[0].off = false
    expect(startCraft(w, pl, 'Recipe.RoastMeat', 1)).toBeNull(); finish(w)
    expect(pl.bag[0].def).toBe('Item.RoastedMeat')
  })
  it('생존 숙달의 조리 시간과 UI용 공용 시간이 일치한다', () => {
    const { w, pl } = setup(); pl.skills.survival = 15; item(w, 'Item.RawMeat'); fire(w)
    const r = w.db.get<RecipeDef>('Recipe.RoastMeat')
    expect(craftTurns(w, pl, r, 1)).toBe(180)
    expect(perform(w, pl, { type: 'craft', id: r.id }).ok).toBe(true)
    expect(pl.activity!.total).toBe(craftTurns(w, pl, r, multiTurnFactor(w, pl)))
  })
  it('반 병의 더러운 물을 끓여도 물의 양이 늘지 않는다', () => {
    const { w, pl } = setup(), bottle = item(w, 'Item.DirtyWaterBottle'); bottle.uses = 2; item(w, 'Item.Wood'); fire(w)
    startCraft(w, pl, 'Recipe.BoilWater', 1); finish(w)
    expect(pl.bag[0].def).toBe('Item.WaterBottle'); expect(pl.bag[0].uses).toBe(2)
  })
  it('완성품이 배낭에 안 들어가면 남은 개수만 바닥에 놓는다', () => {
    const { w, pl } = setup(); item(w, 'Item.Cloth', 3)
    startCraft(w, pl, 'Recipe.Bandage', 1)
    // 예약 천은 남기고 빈 칸은 모두 1×1 바늘로 채운다.
    while (addToBag(w, pl, makeItem(w, 'Item.Needle')) === 0) { /* 배낭 채우기 */ }
    // 천 1개가 남으므로 완료 때도 배낭 칸은 비지 않는다.
    finish(w)
    const drops = tileAt(w, pl.pos).items.filter((i) => i.def === 'Item.Bandage')
    expect(drops.reduce((n, i) => n + i.count, 0)).toBe(1)
    expect(pl.bag.some((i) => i.def === 'Item.Bandage')).toBe(false)
    expect(new Set([...pl.bag, ...drops].map((i) => i.uid)).size).toBe(pl.bag.length + drops.length)
  })
})

describe('품질·작업장·정비', () => {
  it('정본 대장 검산 Q56, 현장 Q0과 6단계 경계를 재현한다', () => {
    const { w, pl } = setup(); artisan(w); pl.stats.str = 13
    const hammer = item(w, 'Item.IronHammer'); hammer.quality = 2; station(w, 'Terrain.Forge')
    expect(craftingQuality(w, pl, w.db.get('Recipe.Knife'), 22)).toBe(56)
    pl.traits = []; pl.stats.str = 10; hammer.quality = 0; station(w, 'Terrain.Earth')
    expect(craftingQuality(w, pl, w.db.get('Recipe.Knife'), 3)).toBe(0)
    expect([19, 20, 44, 45, 64, 65, 79, 80, 94, 95].map(qualityFromScore)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5])
  })
  it('인접 대장간이 작업대·무두질 통의 레시피를 가리지 않는다', () => {
    const { w, pl } = setup(); station(w, 'Terrain.Forge')
    tileAt(w, { x: 20, y: 21 }).t = 'Terrain.Workbench'; tileAt(w, { x: 19, y: 20 }).t = 'Terrain.TanningVat'
    expect(workshop(w, pl).id).toBe('forge')
    expect(workshop(w, pl, ['workbench']).id).toBe('workbench')
    expect(workshop(w, pl, ['tanning']).id).toBe('tanning')
  })
  it('수리 S19는 49% 회복·최대 7% 영구 감소를 누적한다', () => {
    const { w, pl } = setup(); artisan(w); pl.stats.str = 12; station(w, 'Terrain.Forge')
    item(w, 'Item.IronHammer'); item(w, 'Item.IronScrap', 5)
    const knife = item(w, 'Item.RustyKnife'); knife.durability = 20
    const p = repairPreview(w, pl, knife.uid)!
    expect([p.score, p.amount, p.loss, p.nextMax, p.next]).toEqual([19, 49, 7, 93, 69])
    for (let i = 0; i < 5; i++) {
      knife.durability = 1
      expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toBeNull(); finish(w)
      if (i < 4) item(w, 'Item.IronScrap', 2)
    }
    expect(knife.maxDurability).toBeCloseTo(69.56883693)
  })
  it('현장 수리 S−15는 15% 회복, 최대 내구 −13%, 부족 재료는 거부한다', () => {
    const { w, pl } = setup(), hammer = item(w, 'Item.StoneHammer'); hammer.quality = 0
    const knife = item(w, 'Item.RustyKnife'); knife.durability = 10
    expect(repairPreview(w, pl, knife.uid)!.score).toBe(-15)
    expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toContain('재료')
    item(w, 'Item.IronScrap'); expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toBeNull(); finish(w)
    expect(knife.maxDurability).toBe(87); expect(knife.durability).toBe(25)
    knife.durability = 60
    expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toContain('좋아지지')
  })
  it('중단 중 새로 입은 장비 피해를 수리가 공짜로 복구하지 않는다', () => {
    const { w, pl } = setup(); station(w, 'Terrain.Workbench'); item(w, 'Item.IronHammer'); item(w, 'Item.IronScrap', 3)
    const knife = item(w, 'Item.RustyKnife'); knife.durability = 20
    startMaintenance(w, pl, 'repair', knife.uid, 1); activityStep(w, pl); pl.activity = undefined; knife.durability = 5
    expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toBeNull(); finish(w)
    expect(knife.durability).toBe(35); expect(knife.maxDurability).toBe(90)
  })
  it('분해는 내구와 회수율을 적용하고 장착 물건도 한 번만 제거한다', () => {
    const { w, pl } = setup(); artisan(w); pl.stats.str = 12; station(w, 'Terrain.Workbench'); item(w, 'Item.IronHammer')
    const mail = makeItem(w, 'Item.ScrapMail'); mail.durability = 60; pl.equip.chest = mail
    expect(salvagePreview(w, pl, mail.uid)!.count).toBe(3)
    expect(startMaintenance(w, pl, 'salvage', mail.uid, 1)).toBeNull(); finish(w)
    expect(pl.equip.chest).toBeUndefined(); expect(pl.bag.filter((i) => i.def === 'Item.IronScrap').reduce((n, i) => n + i.count, 0)).toBe(3)
    expect(startMaintenance(w, pl, 'salvage', mail.uid, 1)).not.toBeNull()
  })
})

describe('채집·설치·시간 가공', () => {
  it('채집은 곁에서만 가능하고 재생 시간 전에는 중복 획득할 수 없다', () => {
    const { w, pl } = setup(), p = { x: 21, y: 20 }; tileAt(w, p).t = 'Terrain.Tree'
    expect(nearbyGather(w, pl)).toContainEqual(p)
    expect(perform(w, pl, { type: 'gather', pos: p }).ok).toBe(true); finish(w)
    expect(pl.bag[0].def).toBe('Item.Wood'); expect(nearbyGather(w, pl)).not.toContainEqual(p)
    expect(perform(w, pl, { type: 'gather', pos: p }).ok).toBe(false)
    w.s.time += TURNS_PER_DAY * 100
    expect(nearbyGather(w, pl)).toContainEqual(p)
    pl.pos.x = 18
    expect(perform(w, pl, { type: 'gather', pos: p }).ok).toBe(false)
  })
  it('설치 실패는 키트를 보존하고 성공은 1턴과 실제 작업장을 만든다', () => {
    const { w, pl } = setup(), kit = item(w, 'Item.WorkbenchKit'), p = { x: 21, y: 20 }
    tileAt(w, p).t = 'Terrain.ShallowWater'
    expect(perform(w, pl, { type: 'place', uid: kit.uid, dir: 2 }).ok).toBe(false); expect(pl.bag).toContain(kit)
    tileAt(w, p).t = 'Terrain.Earth'
    const t = w.s.time
    expect(playerAct(w, { type: 'place', uid: kit.uid, dir: 2 })).toBeNull()
    expect(w.s.time - t).toBe(100); expect(tileAt(w, p).t).toBe('Terrain.Workbench'); expect(pl.bag).not.toContain(kit)
    const saved = { db: w.db, s: deserialize(serialize(w.s)) }
    expect(workshop(saved, player(saved)).id).toBe('workbench')
  })
  it('무두질은 준비 후 3일 동안 별도 가공하고 저장 뒤 한 번만 회수된다', () => {
    const { w, pl } = setup(); station(w, 'Terrain.TanningVat'); item(w, 'Item.RawHide'); item(w, 'Item.Salt'); studyBook(w, pl, 'Item.CraftManual')
    expect(startCraft(w, pl, 'Recipe.TanLeather', 1)).toBeNull(); finish(w)
    const b = w.s.map.batches![0]
    expect(b.readyAt - turnOf(w)).toBe(3 * TURNS_PER_DAY); expect(pl.bag).toHaveLength(0)
    expect(collectBatch(w, pl, b.id)).toContain('아직')
    w.s = deserialize(serialize(w.s)); w.s.time += 3 * TURNS_PER_DAY * 100
    const rp = player(w)
    expect(collectBatch(w, rp, b.id)).toBeNull(); expect(rp.bag[0].def).toBe('Item.Leather'); expect(rp.bag[0].count).toBe(2)
    expect(collectBatch(w, rp, b.id)).not.toBeNull(); expect(w.s.map.batches).toHaveLength(0)
  })
})

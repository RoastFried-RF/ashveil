import { describe, expect, it } from 'vitest'
import { activityStep } from '../src/core/actions'
import { hpMax } from '../src/core/body'
import { resolveAttack } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { craftingQuality, startCraft } from '../src/core/crafting'
import { player, tileAt, TURNS_PER_HOUR } from '../src/core/ctx'
import { loadMods } from '../src/core/defs'
import { invalidateLights } from '../src/core/fov'
import { addToBag, itemDef, makeItem } from '../src/core/items'
import { materialDurabilityRatio, materialMassG, materialMixPenalty, structuralDurability, stuffProfile } from '../src/core/materials'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { studyBook } from '../src/core/skills'
import { thermalState } from '../src/core/thermal'
import type { MaterialDef, RecipeDef, Stuff } from '../src/core/types'
import { readPackages } from '../tools/loadContent'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('materials', 'Bg.Excommunicate'), pl = player(w)
  pl.pos = { x: 20, y: 20 }; pl.bag = []; pl.equip = {}; pl.traits = []; pl.abilities = []; pl.hp = hpMax(w, pl)
  w.s.creatures = [pl]; w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time; w.s.weather = 'clear'
  for (let y = 18; y <= 22; y++) for (let x = 18; x <= 22; x++) tileAt(w, { x, y }).t = 'Terrain.Earth'
  tileAt(w, { x: 21, y: 20 }).t = 'Terrain.Forge'; invalidateLights(w)
  return { w, pl }
}
function finish(w: ReturnType<typeof makeWorld>) {
  for (let i = 0; player(w).activity && i < 10000; i++) activityStep(w, player(w))
  expect(player(w).activity).toBeUndefined()
}

describe('재질 물성과 제작', () => {
  it('기존 재질 미지정 장비는 이전 결과값과 같은 객체를 쓴다', () => {
    const { w } = setup(), it = makeItem(w, 'Item.Hatchet')
    expect(it.stuff).toBeUndefined(); expect(itemDef(w, it)).toBe(db.item(it.def))
    expect(itemDef(w, it).attacks![0].damage).toBe(14)
  })
  it('강철 손도끼 검산은 피해16·관통19·내구112·질량1141g, 칸2×2다', () => {
    const { w } = setup(), it = makeItem(w, 'Item.SteelHatchet'), def = itemDef(w, it)
    expect(def.attacks![0].damage).toBe(16); expect(def.attacks![0].pen).toBe(19)
    expect(structuralDurability(w, it)).toBe(112); expect(materialMassG(w, it)).toBeCloseTo(1141)
    expect(def.size).toEqual([2, 2]); expect(materialDurabilityRatio(w, it)).toBe(1.4)
  })
  it('부싯돌은 날카롭지만 깨지기 쉽고 폐합금 둔기는 가벼워 피해가 줄어든다', () => {
    const { w } = setup(), flint = makeItem(w, 'Item.FlintHatchet'), alloy = makeItem(w, 'Item.AlloyClub')
    expect(itemDef(w, flint).attacks![0].damage).toBe(17)
    expect(structuralDurability(w, flint)).toBe(24); expect(materialDurabilityRatio(w, flint)).toBe(.3)
    const base = db.item('Item.PipeClub').attacks![0].damage
    expect(itemDef(w, alloy).attacks![0].damage).toBe(Math.floor(base * Math.sqrt(5.5 / 8.7)))
    expect(itemDef(w, alloy).attacks![0].pen).toBe(db.item('Item.PipeClub').attacks![0].pen + 5)
  })
  it('실제 명중 후 강철 무기는 고철보다 천천히 닳는다', () => {
    const strike = (id: string, quality = 1) => {
      const { w, pl } = setup(), weapon = makeItem(w, id)
      weapon.quality = quality; pl.equip.main = weapon; pl.stats.agi = 20; pl.stats.per = 20
      const enemy = createCreature(w, 'Creature.Reaver', { x: 20, y: 19 })
      enemy.equip = {}; enemy.unconscious = true; enemy.hp = 1000; w.s.creatures.push(enemy)
      const result = resolveAttack(w, pl, enemy)
      expect(result.hit).toBe(true)
      return 100 - weapon.durability!
    }
    expect(strike('Item.Hatchet')).toBe(1.25)
    expect(strike('Item.SteelHatchet')).toBeCloseTo(100 / 112)
    expect(strike('Item.SteelHatchet', 0)).toBeCloseTo(100 / (112 * .7))
  })
  it('사슬옷 재질 검산은 고철45/15/2, 연철45/17/2, 강철54/18/2다', () => {
    const { w } = setup()
    for (const [id, values] of [['ScrapMail', [45, 15, 2]], ['IronMail', [45, 17, 2]], ['SteelMail', [54, 18, 2]]] as const) {
      const a = itemDef(w, makeItem(w, `Item.${id}`)).apparel!.armor
      expect([a.sharp, a.blunt, a.heat]).toEqual(values)
    }
  })
  it('의복의 구조 내구 표시는 실제 방어층 마모 기준과 일치한다', () => {
    const { w } = setup()
    for (const id of ['RagShirt', 'LeatherCoat', 'Gloves', 'WolfCoat', 'WoolShirt', 'WoolGloves', 'ScrapMail', 'IronMail', 'SteelMail']) {
      const it = makeItem(w, `Item.${id}`)
      expect(structuralDurability(w, it), id).toBe(itemDef(w, it).apparel!.durability)
    }
  })
  it('젖은 양모 셔츠와 재늑대 코트는 실제 체온 계산에서 원형보다 따뜻하다', () => {
    const { w, pl } = setup(), wool = makeItem(w, 'Item.WoolShirt')
    pl.equip.chest = makeItem(w, 'Item.RagShirt'); const linen = thermalState(w, pl).insulation
    pl.equip.chest = wool; const dry = thermalState(w, pl).insulation
    expect(dry).toBeGreaterThan(linen); expect(itemDef(w, wool).apparel!.wetLoss).toBe(50)
    wool.wetness = { torso: 50, arms: 50 }
    expect(thermalState(w, pl).insulation).toBeLessThan(dry)
    const coat = makeItem(w, 'Item.WolfCoat'); expect(itemDef(w, coat).apparel!.insulation).toBe(5)
    const oil = makeItem(w, 'Item.OilclothShirt'); expect(itemDef(w, oil).apparel!.waterproofPct).toBe(90)
  })
  it('같은 슬롯의 재질은 질량 가중해 내리고 혼합 Q−5를 한 번 적용한다', () => {
    const { w } = setup(), stuff: Stuff = { body: [{ material: 'Material.AshWolfHide', massG: 2000 }, { material: 'Material.Leather', massG: 1000 }] }
    expect(stuffProfile(w, stuff.body).insulation).toBe(4); expect(materialMixPenalty(stuff)).toBe(-5)
    expect(materialMixPenalty({ body: [{ material: 'Material.Leather', massG: 1 }, { material: 'Material.Leather', massG: 2 }] })).toBe(0)
    expect(() => stuffProfile(w, [{ material: 'Material.Leather', massG: 0 }])).toThrow('질량')
  })
  it('재질 변경·저장 복원·다른 Def DB는 캐시를 잘못 재사용하지 않는다', () => {
    const { w } = setup(), it = makeItem(w, 'Item.SteelHatchet')
    expect(itemDef(w, it).attacks![0].pen).toBe(19)
    it.stuff!.head = 'Material.Bone'; expect(itemDef(w, it).attacks![0].pen).toBe(12)
    const pkgs = readPackages(); const core = pkgs.find((p) => p.manifest.id === 'core')!
    core.defs.push({ ...db.get<MaterialDef>('Material.Bone'), override:true, sharpness: 80 } as MaterialDef)
    const { db: other, report } = loadMods(pkgs, []); expect(report.errors).toEqual([])
    expect(itemDef({ db: other, s: w.s }, it).attacks![0].damage).toBe(17)
  })
  it('강철 제작은 재료를 실제 소비하고 저장 뒤에도 같은 재질 결과다', () => {
    const { w, pl } = setup(); studyBook(w, pl, 'Item.CraftManual')
    for (const [id, n] of [['SteelIngot', 4], ['Wood', 1], ['Charcoal', 3], ['IronHammer', 1], ['Tongs', 1]] as const) expect(addToBag(w, pl, makeItem(w, `Item.${id}`, n))).toBe(0)
    expect(startCraft(w, pl, 'Recipe.SteelHatchet', 1)).toBeNull()
    for (let i = 0; i < 100; i++) activityStep(w, pl)
    const restored = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const x of [w, restored]) {
      finish(x)
      const result = player(x).bag.find((i) => i.def === 'Item.SteelHatchet')!
      expect(result.stuff!.head).toBe('Material.Steel'); expect(itemDef(x, result).attacks![0].pen).toBe(19)
      expect(player(x).bag.some((i) => i.def === 'Item.SteelIngot')).toBe(false)
    }
    expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('가공 불가 재질·작업장 누락·맞지 않는 슬롯은 모드 로드 때 거부한다', () => {
    const pkgs = readPackages(), core = pkgs.find((p) => p.manifest.id === 'core')!
    core.defs.push({ ...db.item('Item.SteelHatchet'), id: 'Item.BadMaterial', stuffDefaults: { head: 'Material.Synthetic' } } as never)
    core.defs.push({ ...db.get<RecipeDef>('Recipe.SteelHatchet'), id: 'Recipe.BadMaterial', output: { item: 'Item.BadMaterial', count: 1 } } as never)
    core.patches.push({ op: 'replace', target: 'Recipe.AlloyHatchet', path: '/stations', value: ['forge'] })
    const { report } = loadMods(pkgs, [])
    expect(report.errors.some((e) => e.includes('슬롯'))).toBe(true)
    expect(report.errors.some((e) => e.includes('제작 불가'))).toBe(true)
    expect(report.errors.some((e) => e.includes('artisan'))).toBe(true)
  })
  it('제작→분해 순환은 원재료 개수를 늘리지 못한다', () => {
    for (const r of db.all<RecipeDef>('Recipe')) {
      const output = db.item(r.output.item), salvage = output.salvage
      if (!salvage) continue
      const need = r.inputs.filter((i) => i.item === salvage.material).reduce((n, i) => n + i.count, 0)
      if (need) expect(Math.floor(salvage.count * .8) * r.output.count, r.id).toBeLessThanOrEqual(need)
    }
  })
  it('같은 품질 Q 범위는 재질이 바뀌어도 무작위 스트림을 미리 소비하지 않는다', () => {
    const { w, pl } = setup(), before = stateHash(w.s)
    const steel = craftingQuality(w, pl, db.get('Recipe.SteelHatchet'), 10)
    expect(Number.isFinite(steel)).toBe(true); expect(stateHash(w.s)).toBe(before)
  })
})

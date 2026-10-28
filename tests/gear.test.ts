import { describe, expect, it } from 'vitest'
import { abilityReady } from '../src/core/abilities'
import { activityStep, perform } from '../src/core/actions'
import { botDecide } from '../src/core/bot'
import { bodyDef, hpMax } from '../src/core/body'
import { repairPreview, startMaintenance } from '../src/core/crafting'
import { player, tileAt, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { rangedRange } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { invalidateLights } from '../src/core/fov'
import { edgeLoss, gearCareError, gearTick, startGearCare } from '../src/core/gear-care'
import { armorDurability, armorPartIDs, wearArmorPart } from '../src/core/gear-state'
import { addToBag, itemDef, makeItem, wield } from '../src/core/items'
import { structuralDurability } from '../src/core/materials'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { makeWorld } from './helpers'

function setup() {
  const w = makeWorld('gear', 'Bg.Excommunicate'), pl = player(w)
  pl.age = undefined; pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.pos = { x: 20, y: 20 }; pl.traits = []; pl.background = undefined; pl.abilities = []; pl.bag = []; pl.equip = {}; pl.hp = hpMax(w, pl)
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.map.lights = []
  for (let y = 16; y <= 24; y++) for (let x = 16; x <= 24; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time; invalidateLights(w)
  return { w, pl }
}
function item(w: ReturnType<typeof makeWorld>, id: string, count = 1) { const it = makeItem(w, id, count); expect(addToBag(w, player(w), it)).toBe(0); return it }
function tick(w: ReturnType<typeof makeWorld>, n: number) { for (let i = 0; i < n; i++) { w.s.time += 100; gearTick(w, player(w)) } }
function finish(w: ReturnType<typeof makeWorld>) { for (let i = 0; player(w).activity && i < 1000; i++) activityStep(w, player(w)); expect(player(w).activity).toBeUndefined() }

describe('장비 마모·정비', () => {
  it('강철 살 타격50회는 날60%, 연철은50%이며 소수 마모를 이월한다', () => {
    const { w } = setup(), steel = makeItem(w, 'Item.SteelKnife'), iron = makeItem(w, 'Item.HuntingKnife')
    steel.edge = 100; iron.edge = 100
    edgeLoss(w, steel, 1); expect(steel.edge).toBe(100); expect(steel.edgeWear).toBe(80)
    for (let i = 1; i < 50; i++) edgeLoss(w, steel, 1)
    for (let i = 0; i < 50; i++) edgeLoss(w, iron, 1)
    expect(steel.edge).toBe(60); expect(iron.edge).toBe(50)
  })
  it('숫돌이 있어야 갈며 중단은 재료를 쓰지 않고 완료는 날과 도구를 갱신한다', () => {
    const { w, pl } = setup(), knife = item(w, 'Item.SteelKnife'); knife.edge = 30
    expect(gearCareError(w, pl, knife.uid, 'sharpen')).toContain('숫돌')
    const stone = item(w, 'Item.SharpeningStone')
    expect(startGearCare(w, pl, knife.uid, 'sharpen', 1)).toBeNull(); activityStep(w, pl); pl.activity = undefined
    expect(knife.edge).toBe(30); expect(stone.durability).toBe(100)
    startGearCare(w, pl, knife.uid, 'sharpen', 1); finish(w)
    expect(knife.edge).toBe(100); expect(stone.durability).toBe(99)
    knife.rust = 3; knife.edge = 20
    startGearCare(w, pl, knife.uid, 'sharpen', 1); finish(w); expect(knife.edge).toBe(70)
  })
  it('0내구 무기는 맨손으로 대체하고 무기 능력은 수리를 요구한다', () => {
    const { w, pl } = setup(), axe = makeItem(w, 'Item.Hatchet'); axe.durability = 0; pl.equip.main = axe; pl.abilities = ['Ab.Axe.Split']
    expect(wield(w, pl)!.atk.family).toBe('unarmed'); expect(abilityReady(w, pl, 'Ab.Axe.Split')).toContain('부서')
  })
  it('공격한 부위만 닳고 다른 부위는100%, 전체 표시는 평균이다', () => {
    const { w, pl } = setup(), mail = makeItem(w, 'Item.IronMail'); pl.equip.chest = mail
    const ids = armorPartIDs(w, pl, itemDef(w, mail)), id = ids[0]
    wearArmorPart(w, pl, mail, id, 50)
    expect(armorDurability(mail, id)).toBe(50)
    expect(armorDurability(mail, ids[1])).toBe(100)
    expect(mail.durability).toBeCloseTo(100 - 50 / ids.length)
  })
  it('평균보다 나쁜 부위가 있으면 수리할 수 있고 최대 내구 손실을 모든 부위에 적용한다', () => {
    const { w, pl } = setup(), mail = makeItem(w, 'Item.IronMail'); pl.equip.chest = mail
    tileAt(w, { x: 21, y: 20 }).t = 'Terrain.Workbench'
    const id = armorPartIDs(w, pl, itemDef(w, mail))[0]; wearArmorPart(w, pl, mail, id, 60)
    item(w, 'Item.IronHammer'); item(w, 'Item.IronIngot', 5)
    const p = repairPreview(w, pl, mail.uid)!
    expect(p.current).toBe(40); expect(p.next).toBe(70)
    expect(startMaintenance(w, pl, 'repair', mail.uid, 1)).toBeNull(); finish(w)
    expect(armorDurability(mail, id)).toBe(70)
    expect(Math.max(...Object.values(mail.partDurability!))).toBe(90)
  })
  it('좋은 작업장에서 시작한 수리를 현장으로 옮겨 보너스를 유지할 수 없다', () => {
    const { w, pl } = setup(), knife = item(w, 'Item.HuntingKnife'); knife.durability = 10
    const station = tileAt(w, { x: 21, y: 20 }); station.t = 'Terrain.Forge'
    item(w, 'Item.IronHammer'); item(w, 'Item.IronScrap', 4)
    expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toBeNull(); activityStep(w, pl)
    station.t = 'Terrain.Earth'; activityStep(w, pl)
    expect(pl.activity).toBeUndefined(); expect(pl.workJob!.progress).toBe(1)
    expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toContain('조건')
    station.t = 'Terrain.Forge'; expect(startMaintenance(w, pl, 'repair', knife.uid, 1)).toBeNull(); finish(w)
    expect(knife.durability).toBe(45); expect(knife.maxDurability).toBe(91)
  })
  it('8시간 재비의 연철은 부식6720점·6내구 감소·녹3 상한이다', () => {
    const { w, pl } = setup(), knife = makeItem(w, 'Item.HuntingKnife'); knife.stuff = { blade: 'Material.Iron' }; knife.edge = 100; pl.equip.main = knife; w.s.weather = 'ashrain'
    tick(w, 9600)
    expect(knife.corrosion).toBeCloseTo(720); expect(knife.rust).toBe(3); expect(knife.edge).toBe(70)
    expect(knife.durability).toBeCloseTo(100 - 6 * 100 / structuralDurability(w, knife)!)
  })
  it('망토 아래 부위는 부식1344점, 드러난 목은6720점으로 따로 누적한다', () => {
    const { w, pl } = setup(), mail = makeItem(w, 'Item.IronMail'); pl.equip.chest = mail; pl.equip.back = makeItem(w, 'Item.OilclothCloak'); w.s.weather = 'ashrain'
    const parts = bodyDef(w, pl).parts, chest = parts.find((p) => p.groups.includes('chest') && !p.internal)!.id, neck = parts.find((p) => p.groups.includes('neck') && !p.internal)!.id
    tick(w, 9600)
    expect(mail.partCorrosion![chest]).toBeCloseTo(344); expect(mail.partCorrosion![neck]).toBeCloseTo(720)
    expect(mail.partRust![chest]).toBe(1); expect(mail.partRust![neck]).toBe(3)
    const max = structuralDurability(w, mail)!
    expect(armorDurability(mail, chest)).toBeCloseTo(100 - 100 / max)
    expect(armorDurability(mail, neck)).toBeCloseTo(100 - 600 / max)
  })
  it('기름은 완료 때 한 개 소비하고48시간 동안 면제, 지붕도 부식을 막는다', () => {
    const { w, pl } = setup(), knife = item(w, 'Item.HuntingKnife'), oil = item(w, 'Item.LampOil')
    expect(startGearCare(w, pl, knife.uid, 'oil', 1)).toBeNull(); activityStep(w, pl); expect(pl.bag).toContain(oil); finish(w)
    expect(pl.bag).not.toContain(oil); expect(knife.oiledUntil).toBe(w.s.time / 100 + 2 * TURNS_PER_DAY)
    pl.bag = []; pl.equip.main = knife; w.s.weather = 'ashrain'; tick(w, 9600); expect(knife.corrosion).toBeUndefined()
    w.s.time = knife.oiledUntil! * 100; gearTick(w, pl); expect(knife.corrosion).toBeCloseTo(.75)
    const c = knife.corrosion; tileAt(w, pl.pos).roof = true; tick(w, 100); expect(knife.corrosion).toBe(c)
  })
})

describe('활시위 상태', () => {
  it('재비120턴은 습기60%·피해−25%·사거리−3, 밀랍은18%다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'); pl.equip.main = bow; w.s.weather = 'ashrain'
    const base = w.db.item(bow.def); tick(w, 120)
    expect(bow.bowMoisture).toBe(60)
    expect(itemDef(w, bow).ranged!.range).toBe(base.ranged!.range - 3)
    expect(itemDef(w, bow).attacks![0].damage).toBeCloseTo(base.attacks![0].damage * .75)
    bow.bowMoisture = 0; bow.waxedUntil = w.s.time / 100 + TURNS_PER_DAY; tick(w, 120)
    expect(bow.bowMoisture).toBeCloseTo(18)
  })
  it('습한 날은 시간당1%, 밀랍 완료 뒤24시간 동안 증가량×0.3이다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'); pl.equip.main = bow; w.s.weather = 'overcast'; item(w, 'Item.Wax')
    tick(w, 1200); expect(bow.bowMoisture).toBeCloseTo(1)
    startGearCare(w, pl, bow.uid, 'wax', 1); finish(w)
    expect(bow.waxedUntil! - w.s.time / 100).toBe(TURNS_PER_DAY)
    tick(w, 1200); expect(bow.bowMoisture).toBeCloseTo(1.3)
  })
  it('불 곁에서200턴이면 습기10%를 말린다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'); bow.bowMoisture = 60; pl.equip.main = bow
    w.s.map.lights = [{ pos: { ...pl.pos }, kind: 'campfire', radius: 6 }]; invalidateLights(w)
    tick(w, 200); expect(bow.bowMoisture).toBeCloseTo(50)
  })
  it('시위 풀기3턴·걸기6턴, 풀린 활은 기본·능력 사격을 막는다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'), foe = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }); pl.equip.main = bow; w.s.creatures.push(foe); pl.abilities = ['Ab.Archery.Aimed']
    expect(startGearCare(w, pl, bow.uid, 'unstring', 1)).toBeNull(); expect(pl.activity!.remaining).toBe(3); finish(w)
    expect(perform(w, pl, { type: 'shoot', target: foe.id }).msg).toContain('시위')
    expect(abilityReady(w, pl, 'Ab.Archery.Aimed')).toContain('시위')
    tileAt(w, pl.pos).t = 'Terrain.Rubble'; expect(rangedRange(w, pl, foe)).toBe(0)
    bow.bowMoisture = 45; expect(startGearCare(w, pl, bow.uid, 'string', 1)).toBeNull(); expect(pl.activity!.remaining).toBe(6); finish(w)
    expect(bow.bowMoisture).toBe(45); expect(bow.bowUnstrung).toBe(false)
  })
  it('끊어진 시위는 여분을 완료 때 소비하고 새 시위는 마른 상태다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'); bow.bowBroken = true; bow.bowMoisture = 90; pl.equip.main = bow
    expect(gearCareError(w, pl, bow.uid, 'string')).toContain('여분')
    const string = item(w, 'Item.BowString'); startGearCare(w, pl, bow.uid, 'string', 1); activityStep(w, pl); expect(pl.bag).toContain(string); finish(w)
    expect(pl.bag).not.toContain(string); expect(bow.bowBroken).toBe(false); expect(bow.bowMoisture).toBe(0)
  })
  it('실제 사격 중 젖은 시위가 끊어지면 기력은 쓰고 화살은 남는다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'), foe = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }); pl.equip.main = bow; bow.bowMoisture = 100; foe.hp = 10000; foe.unconscious = true; foe.equip = {}; w.s.creatures.push(foe); item(w, 'Item.Arrow', 60)
    const arrows = () => pl.bag.filter((i) => i.def === 'Item.Arrow').reduce((n, i) => n + i.count, 0)
    for (let i = 0; i < 50; i++) {
      pl.needs.energy = 100; const before = arrows()
      perform(w, pl, { type: 'shoot', target: foe.id })
      if (bow.bowBroken) { expect(arrows()).toBe(before); expect(pl.needs.energy).toBe(94); return }
    }
    throw new Error('고정 난수50회 안에 시위 끊어짐이 있어야 한다')
  })
  it('봇은 끊어진 활의 실패 사격을 반복하지 않고 예비 칼을 든다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'); pl.equip.main = bow; bow.bowBroken = true
    pl.abilityPoints = 0; pl.statPoints = 0
    const knife = item(w, 'Item.HuntingKnife'), enemy = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }); w.s.creatures.push(enemy)
    expect(botDecide(w)).toEqual({ type: 'equip', uid: knife.uid })
  })
  it('시위를 건 활만 날짜 경계에서 탄성1%를 잃는다', () => {
    const { w, pl } = setup(), bow = makeItem(w, 'Item.Bow'); pl.equip.main = bow; w.s.time = (TURNS_PER_DAY - 1) * 100
    tick(w, 1); expect(bow.elasticity).toBe(99)
    bow.bowUnstrung = true; tick(w, TURNS_PER_DAY); expect(bow.elasticity).toBe(99)
  })
  it('부위 내구·부식·시위·정비 중간 저장 뒤 같은 상태로 진행한다', () => {
    const { w, pl } = setup(), mail = makeItem(w, 'Item.SteelMail'), bow = makeItem(w, 'Item.Bow'); pl.equip.chest = mail; pl.equip.main = bow; w.s.weather = 'ashrain'; tick(w, 137)
    item(w, 'Item.Wax'); startGearCare(w, pl, bow.uid, 'wax', 1); activityStep(w, pl)
    const restored = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const x of [w, restored]) { finish(x); tick(x, 500) }
    expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
})

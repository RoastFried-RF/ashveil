import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { handState } from '../src/core/hand-hygiene'
import { addToBag, allItems, makeItem } from '../src/core/items'
import { initializeResidentWater, residentDrink, residentWaterGoal } from '../src/core/resident-water'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { nearbyWater } from '../src/core/water'
import { drinkVolume } from '../src/core/wash-water'
import { db } from './helpers'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
const { db: rawDb } = loadMods(readPackages().map((pkg) => ({ ...pkg, defs: pkg.defs.filter((d) => d.id !== 'ResidentPurification.Hearth') })))
const template = newGame(db, { seed: 'resident-water', overworld: true })
function setup() {
  const w: World = { db: rawDb, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }; p.pos = { x: 20, y: 20 }; w.s.sources = []; w.s.storyteller.budget = -1e9
  for (let y = 12; y <= 25; y++) for (let x = 24; x <= 42; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  initializeSettlement(w)
  const doctor = w.s.creatures.find((c) => c.clinicSite)!, well = w.s.map.residentWell!
  for (const c of w.s.creatures) {
    c.nextAct = c.id === p.id || c.id === doctor.id ? w.s.time : 1e12; c.hp = 95; c.age = undefined; c.traits = []; c.traumas = []; c.background = undefined; c.effects = []; c.thoughts = []; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax; c.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100 })
  }
  w.s.map.lights = [{ pos: { x: 32, y: 18 }, radius: 12, kind: 'campfire' }]; invalidateLights(w)
  const bottles = () => allItems(doctor).filter((it) => ['Item.WaterBottle','Item.DirtyWaterBottle'].includes(it.def))
  const empty = () => { for (const it of bottles()) { it.uses = 0; delete it.water; delete it.waterFrozen } }
  return { w, p, doctor, well, site, bottles, empty }
}
function wait(w: World, n: number) { for (let i = 0; i < n; i++) expect(playerAct(w, { type: 'wait' })).toBeNull() }
describe('주민의 실제 우물·급수', () => {
  it('덮개 우물을 빈 자리에 한 번만 배치하고 정착지 재진입 때 중복되지 않는다', () => {
    const { w, well, site } = setup(); expect(w.db.terrain(tileAt(w, well.pos).t)).toMatchObject({ residentWell: true, passable: false, waterSource: 'well' }); expect(tileAt(w, well.pos).roof).toBe(true)
    const before = stateHash(w.s); initializeResidentWater(w, site); initializeSettlement(w); expect(stateHash(w.s)).toBe(before)
  })
  it('갈증 난 의사는 실제로 우물까지 걸어 같은 빈 병을 채우고 마신 뒤 돌아온다', () => {
    const { w, doctor, well, empty, bottles } = setup(); empty(); doctor.needs.waterDeficit = 1000
    const ids = bottles().map((it) => it.uid), uid = w.s.overworld!.simulation!.nextItemId, cash = doctor.money, before = stateHash(w.s)
    expect(residentWaterGoal(w, doctor)?.pos).toEqual(well.pos); expect(stateHash(w.s)).toBe(before); wait(w, 40)
    expect(doctor.pos).toEqual(doctor.home); expect(doctor.needs.waterDeficit).toBeLessThan(500); expect(bottles().map((it) => it.uid)).toEqual(ids); expect(w.s.overworld!.simulation!.nextItemId).toBe(uid); expect(doctor.money).toBe(cash)
    const filled = bottles().find((it) => it.water); expect(filled?.water).toMatchObject({ pathogen: 10, ash: 5, source: '우물물' }); expect(filled?.uses).toBe(2); expect(doctor.needs.ash).toBeGreaterThan(0)
  })
  it('가장 가까운 접근 칸을 다른 사람이 막아도 다른 쪽으로 돌아서 물을 뜬다', () => {
    const { w, p, doctor, well, empty } = setup(); empty(); p.pos = { x: well.pos.x + 1, y: well.pos.y - 1 }; doctor.pos = { x: well.pos.x + 4, y: well.pos.y - 3 }; doctor.needs.waterDeficit = 1000
    wait(w, 50); expect(doctor.needs.waterDeficit).toBeLessThan(500); expect(doctor.pos).toEqual(doctor.home)
  })
  it('물병이 없으면 실제 우물물300ml를 떠 마시며 새 병을 만들지 않는다', () => {
    const { w, doctor } = setup(); doctor.bag = doctor.bag.filter((it) => !['Item.WaterBottle','Item.DirtyWaterBottle'].includes(it.def)); doctor.needs.waterDeficit = 700
    const uid = w.s.overworld!.simulation!.nextItemId; wait(w, 40); expect(doctor.needs.waterDeficit).toBeLessThan(500); expect(doctor.bag.some((it) => it.water)).toBe(false); expect(w.s.overworld!.simulation!.nextItemId).toBe(uid); expect(doctor.pos).toEqual(doctor.home)
  })
  it('갈증이 없어도 손 씻을 물이 부족하면 실제 물을 떠서 씻는다', () => {
    const { w, doctor, empty, bottles } = setup(); empty(); doctor.hands = { kind: 'dirty', at: turnOf(w) }; expect(residentWaterGoal(w, doctor)).not.toBeNull(); wait(w, 40)
    expect(handState(w, doctor)).toBe('washed'); expect(bottles().find((it) => it.water)?.uses).toBe(4); expect(doctor.needs.waterDeficit).toBeLessThan(10); expect(doctor.needs.waterExposure).toBeUndefined(); expect(doctor.pos).toEqual(doctor.home)
  })
  it('의료용 술 대신 남은 실제 비알코올 물을 먼저 마신다', () => {
    const { w, doctor, bottles } = setup(); const list = bottles(); list[0].uses = 0; list[1].uses = 0; doctor.needs.waterDeficit = 600; const spirit = doctor.bag.find((it) => it.def === 'Item.Moonshine')!, uses = spirit.uses
    const drink = residentDrink(w, doctor)!; expect(drink.uid).not.toBe(spirit.uid); expect(residentWaterGoal(w, doctor)).toBeNull(); expect(aiDecide(w, doctor)).toEqual({ type: 'consume', uid: drink.uid }); perform(w, doctor, { type: 'consume', uid: drink.uid }); expect(spirit.uses).toBe(uses)
  })
  it('경비도 가진 물을 마시고 보이는 적 앞에서는 급수보다 대응을 먼저 한다', () => {
    const { w } = setup(), guard = w.s.creatures.find((c) => c.def.includes('Guard'))!; guard.needs.waterDeficit = 600; expect(aiDecide(w, guard).type).toBe('consume')
    w.s.creatures.push(createCreature(w, 'Creature.Reaver', { x: guard.pos.x + 1, y: guard.pos.y })); expect(aiDecide(w, guard).type).not.toBe('consume')
  })
  it('먼 우물의 훼손/얼음을 미리 읽지 않고 도착한 뒤 재시도한다', () => {
    const { w, doctor, well, empty } = setup(); empty(); doctor.needs.waterDeficit = 1000; const known = residentWaterGoal(w, doctor); tileAt(w, well.pos).icy = true; expect(residentWaterGoal(w, doctor)).toEqual(known)
    doctor.pos = { x: well.pos.x + 1, y: well.pos.y }; expect(aiDecide(w, doctor)).toEqual({ type: 'wait' }); expect(doctor.residentWaterAfter).toBe(turnOf(w) + 1200); expect(residentDrink(w, doctor)).toBeUndefined()
    doctor.residentWaterAfter = undefined; delete tileAt(w, well.pos).icy; tileAt(w, well.pos).t = 'Terrain.Earth'; expect(aiDecide(w, doctor)).toEqual({ type: 'wait' }); expect(residentDrink(w, doctor)).toBeUndefined()
  })
  it('지나갈 길이 없으면 물병/물을 생성하지 않고 재시도를 미룬다', () => {
    const { w, p, doctor, empty, bottles } = setup(); empty(); doctor.needs.waterDeficit = 1000; doctor.pos = { x: 20, y: 20 }; p.pos = { x: 20, y: 23 }
    for (let y = 19; y <= 21; y++) for (let x = 19; x <= 21; x++) if (x !== 20 || y !== 20) tileAt(w, { x, y }).t = 'Terrain.KtWall'
    const ids = bottles().map((it) => it.uid); expect(aiDecide(w, doctor)).toEqual({ type: 'wait' }); expect(bottles().map((it) => it.uid)).toEqual(ids); expect(bottles().every((it) => it.uses === 0)).toBe(true); expect(doctor.residentWaterAfter).toBeGreaterThan(turnOf(w))
  })
  it('설치할 덮개 우물의 눈/얼음은 제거하지만 기존 아이템을 덮어쓰지 않는다', () => {
    const { w, well, site } = setup(), tile = tileAt(w, well.pos); w.s.map.residentWaterInitialized = undefined; w.s.map.residentWell = undefined; Object.assign(tile, { t: 'Terrain.Earth', roof: false, snow: 100, icy: true, iceHoleUntil: 1 })
    initializeResidentWater(w, site); expect(w.s.map).toMatchObject({ residentWell: { pos: well.pos } }); expect(tile.roof).toBe(true); expect([tile.snow,tile.icy,tile.iceHoleUntil]).toEqual([undefined,undefined,undefined])
  })
  it('선택한 우물의 물을 담으며 옆의 웅덩이 물로 바꾸지 않는다', () => {
    const { w, p } = setup(); p.pos = { x: 20, y: 20 }; tileAt(w, p.pos).t = 'Terrain.Earth'; tileAt(w, { x: 20, y: 19 }).t = 'Terrain.ShallowWater'; const pos = { x: 21, y: 20 }; tileAt(w, pos).t = 'Terrain.SettlementWell'
    const bottle = makeItem(w, 'Item.WaterBottle'); bottle.uses = 0; p.bag = []; addToBag(w, p, bottle); const uid = bottle.uid
    expect(nearbyWater(w, p)?.quality.pathogen).toBe(70); expect(perform(w, p, { type: 'fillBottle', uid, pos })).toMatchObject({ ok: true, tu: 150 }); expect(bottle.uid).toBe(uid); expect(drinkVolume(w, bottle)).toBe(1000); expect(bottle.water).toMatchObject({ pathogen: 10, ash: 5 })
  })
  it('원격이나 막힌 모퉁이의 물을 채우지 않고 손을 못 쓰면 뜰 수 없다', () => {
    const { w, p, well } = setup(), bottle = makeItem(w, 'Item.WaterBottle'); p.bag = []; addToBag(w, p, bottle); let before = stateHash(w.s); expect(perform(w, p, { type: 'fillBottle', uid: bottle.uid, pos: well.pos }).ok).toBe(false); expect(stateHash(w.s)).toBe(before)
    p.pos = { x: 20, y: 20 }; const pos = { x: 21, y: 19 }; tileAt(w, pos).t = 'Terrain.ShallowWater'; tileAt(w, { x: 20, y: 19 }).t = 'Terrain.KtWall'; tileAt(w, { x: 21, y: 20 }).t = 'Terrain.KtWall'; expect(nearbyWater(w, p, pos)).toBeNull()
    tileAt(w, { x: 20, y: 19 }).t = 'Terrain.Earth'; tileAt(w, { x: 21, y: 20 }).t = 'Terrain.ShallowWater'; p.body.missing = ['LeftUpperArm','RightUpperArm']; before = stateHash(w.s); expect(perform(w, p, { type: 'drinkHere', pos: { x: 21, y: 20 } }).ok).toBe(false); expect(stateHash(w.s)).toBe(before)
  })
  it('물 뜨기는 플레이어 기록/지식을 대신 공개하지 않고 경로 각인도 같다', () => {
    const { w, doctor, well, empty, bottles } = setup(); empty(); doctor.pos = { x: well.pos.x + 1, y: well.pos.y }; const log = structuredClone(w.s.log), knowledge = structuredClone(w.s.knowledge), uid = bottles()[0].uid
    expect(perform(w, doctor, { type: 'fillBottle', uid, pos: well.pos }).ok).toBe(true); expect(w.s.log).toEqual(log); expect(w.s.knowledge).toEqual(knowledge)
    empty(); doctor.pos = { ...doctor.home! }; doctor.needs.waterDeficit = 1000; wait(w, 1); const copy = { db: w.db, s: deserialize(serialize(w.s)) }; wait(w, 40); wait(copy, 40); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('v15의 물병·수질·배급 원장을 보존하고 새 물을 부여하지 않는다', () => {
    const { w } = setup(), old = JSON.parse(serialize(w.s)); old.version = 15; delete old.map.residentWell; delete old.map.residentWaterInitialized; const restored = deserialize(JSON.stringify(old)); expect(restored.version).toBe(SAVE_VERSION); expect({ ...restored, version: 15 }).toEqual(old)
  })
})

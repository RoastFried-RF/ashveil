import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { addToBag, allItems, countOf, makeItem, removeOne } from '../src/core/items'
import { initializeResidentPurification, residentFuelQuote, residentPurificationGoal, takeResidentFuel } from '../src/core/resident-purification'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { waterStep } from '../src/core/water'
import { db } from './helpers'
const template = newGame(db, { seed: 'resident-purification', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * 1200 * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }; w.s.sources = []; w.s.storyteller.budget = -1e9; p.pos = { x: 20, y: 20 }
  for (let y = 12; y <= 25; y++) for (let x = 24; x <= 42; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  initializeSettlement(w)
  const doctor = w.s.creatures.find((c) => c.clinicSite)!, stock = m.simulation!.settlements[site.id]!, fire = w.s.map.residentHearth!, depot = w.s.map.residentDepot!
  for (const c of w.s.creatures) {
    c.nextAct = c.id === p.id || c.id === doctor.id ? w.s.time : 1e12; c.hp = 95; c.age = undefined; c.traits = []; c.traumas = []; c.background = undefined; c.effects = []; c.thoughts = []; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax; c.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100, ash: 0 })
  }
  for (const it of allItems(doctor)) if (['Item.WaterBottle','Item.DirtyWaterBottle'].includes(it.def)) { it.uses = 0; delete it.water; delete it.waterFrozen }
  const bottle = doctor.bag.find((it) => it.def === 'Item.WaterBottle')!
  const raw = () => { bottle.uses = 5; bottle.def = 'Item.DirtyWaterBottle'; bottle.water = { pathogen: 10, ash: 5, source: '우물물' }; return bottle }
  const adjacent = () => { doctor.pos = { x: depot.pos.x, y: depot.pos.y + 1 } }
  const wood = () => { addToBag(w, doctor, makeItem(w, 'Item.Wood')); return doctor.bag.find((it) => it.def === 'Item.Wood')! }
  w.s.map.lights = [{ pos: { ...fire.pos }, radius: 12, kind: 'campfire' }]; invalidateLights(w)
  return { w, p, site, doctor, stock, fire, depot, bottle, raw, adjacent, wood }
}
function wait(w: World, n: number) { for (let i = 0; i < n; i++) expect(playerAct(w, { type: 'wait' })).toBeNull() }
describe('주민의 실제 연료 배급·식수 끓이기', () => {
  it('기존 화덕을 기억하고 중복 생성·무료 연료·회복 없이 한 번 초기화한다', () => {
    const { w, site, fire } = setup(); expect(fire.pos).toEqual({ x: 32, y: 18 }); const hash = stateHash(w.s); initializeResidentPurification(w, site); initializeSettlement(w); expect(stateHash(w.s)).toBe(hash)
  })
  it('우물→연료 창고→화덕→실제 끓이기/음수→업무 귀환의 자원과 시간이 이어진다', () => {
    const { w, doctor, stock, bottle } = setup(); doctor.needs.waterDeficit = 1000
    const ids = allItems(doctor).map((it) => it.uid), reserve = stock.reserve.Fuel!, uid = w.s.overworld!.simulation!.nextItemId!, time = w.s.time, cash = doctor.money
    wait(w, 350)
    expect(doctor.pos).toEqual(doctor.home); expect(doctor.needs.waterDeficit).toBeLessThan(500); expect(w.s.time - time).toBeGreaterThanOrEqual(20000); expect(bottle.uses).toBe(2); expect(bottle.water).toMatchObject({ pathogen: 0, ash: 5.5 }); expect(allItems(doctor).map((it) => it.uid)).toEqual(ids); expect(doctor.money).toBe(cash)
    expect(stock.reserve.Fuel).toBeCloseTo(reserve - 1, 8); expect(w.s.overworld!.simulation!.nextItemId).toBe(uid + 1); expect(countOf(doctor, 'Item.Wood')).toBe(0); expect(doctor.residentFuel?.units).toBe(1); expect(doctor.residentConsumption?.units.Fuel).toBe(.15); expect(stock.residentConsumption?.units.Fuel).toBe(.15); expect(doctor.needs.waterExposure).toBeUndefined()
  })
  it('읽기 전용 견적 뒤 실제 연료만 인출하고 몸·물·돈·시장 재고를 보존한다', () => {
    const { w, doctor, stock, bottle, adjacent, raw } = setup(); raw(); adjacent(); const before = stateHash(w.s), water = structuredClone(bottle), cash = doctor.money, reserve = stock.reserve.Fuel!, uid = w.s.overworld!.simulation!.nextItemId!, market = structuredClone(w.s.overworld!.markets)
    expect(residentFuelQuote(w, doctor)).toMatchObject({ error: null, count: 1, units: 1 }); expect(stateHash(w.s)).toBe(before); expect(takeResidentFuel(w, doctor)).toBeNull(); expect(countOf(doctor, 'Item.Wood')).toBe(1); expect(stock.reserve.Fuel).toBeCloseTo(reserve - 1, 8); expect(bottle).toEqual(water); expect(doctor.money).toBe(cash); expect(w.s.overworld!.markets).toEqual(market); expect(w.s.overworld!.simulation!.nextItemId).toBe(uid + 1); expect(doctor.residentConsumption).toBeUndefined()
  })
  it('품절·소수 연료·가득 찬 배낭은 자원이나 UID를 만들지 않고 재시도한다', () => {
    for (const kind of ['empty','fraction','bag']) {
      const { w, doctor, stock, adjacent } = setup(); adjacent()
      if (kind !== 'bag') stock.reserve.Fuel = kind === 'empty' ? 0 : .9
      else { doctor.bag = []; for (let y = 0; y < 6; y += 3) for (let x = 0; x < 10; x += 2) { const bed = makeItem(w, 'Item.Bed'); Object.assign(bed, { gx: x, gy: y }); doctor.bag.push(bed) } }
      const before = { bag: structuredClone(doctor.bag), reserve: stock.reserve.Fuel, uid: w.s.overworld!.simulation!.nextItemId, id: w.s.nextId }, hash = stateHash(w.s)
      expect(residentFuelQuote(w, doctor).error).not.toBeNull(); expect(stateHash(w.s)).toBe(hash); expect(takeResidentFuel(w, doctor)).not.toBeNull(); expect({ bag: doctor.bag, reserve: stock.reserve.Fuel, uid: w.s.overworld!.simulation!.nextItemId, id: w.s.nextId }).toEqual(before); expect(doctor.residentPurifyAfter).toBe(turnOf(w) + 1200)
    }
  })
  it('하루4Fuel 한도는 새 날짜에만 갱신되고 기존 소지 연료를 중복 지급하지 않는다', () => {
    const { w, doctor, adjacent } = setup(); adjacent()
    for (let n = 0; n < 4; n++) { expect(takeResidentFuel(w, doctor)).toBeNull(); expect(residentFuelQuote(w, doctor).count).toBe(0); removeOne(w, doctor, doctor.bag.find((it) => it.def === 'Item.Wood')!.uid) }
    expect(doctor.residentFuel?.units).toBe(4); expect(residentFuelQuote(w, doctor).error).not.toBeNull(); w.s.time += TURNS_PER_DAY * 100; expect(takeResidentFuel(w, doctor)).toBeNull(); expect(doctor.residentFuel?.units).toBe(1)
  })
  it('플레이어·다른 지역·원격 요청은 물품·돈·원장을 만들지 않는다', () => {
    const { w, p, doctor, adjacent } = setup(); adjacent(); p.pos = { ...doctor.pos }; p.residentSite = doctor.residentSite; p.faction = doctor.faction
    let hash = stateHash(w.s); expect(perform(w, p, { type: 'residentFuel' }).ok).toBe(false); expect(stateHash(w.s)).toBe(hash)
    doctor.pos = { x: 20, y: 20 }; hash = stateHash(w.s); expect(takeResidentFuel(w, doctor)).not.toBeNull(); expect(stateHash(w.s)).toBe(hash); doctor.residentSite = 'elsewhere'; hash = stateHash(w.s); expect(takeResidentFuel(w, doctor)).not.toBeNull(); expect(stateHash(w.s)).toBe(hash)
  })
  it('먼 창고의 재고와 화덕의 불을 미리 읽지 않고 도착 후 실패하면 생수로 돌아간다', () => {
    const { w, doctor, stock, fire, raw, wood } = setup(), it = raw(); doctor.needs.waterDeficit = 1000; const fuelGoal = residentPurificationGoal(w, doctor, it); stock.reserve.Fuel = 0; expect(residentPurificationGoal(w, doctor, it)).toEqual(fuelGoal)
    wood(); const fireGoal = residentPurificationGoal(w, doctor, it); w.s.map.lights[0].off = true; expect(residentPurificationGoal(w, doctor, it)).toEqual(fireGoal); doctor.pos = { x: fire.pos.x + 1, y: fire.pos.y }; expect(aiDecide(w, doctor)).toEqual({ type: 'consume', uid: it.uid }); expect(doctor.residentPurifyAfter).toBe(turnOf(w) + 1200); expect(it.water!.pathogen).toBe(10)
  })
  it('훼손된 창고와 사라진 화덕에서 실제 연료나 멸균 효과를 만들지 않는다', () => {
    const { w, doctor, depot, fire, raw, adjacent, wood } = setup(), it = raw(); adjacent(); tileAt(w, depot.pos).t = 'Terrain.Earth'; expect(takeResidentFuel(w, doctor)).toContain('창고'); wood(); doctor.residentPurifyAfter = undefined; doctor.needs.waterDeficit = 1000; doctor.pos = { x: fire.pos.x + 1, y: fire.pos.y }; tileAt(w, fire.pos).t = 'Terrain.Earth'; expect(aiDecide(w, doctor)).toEqual({ type: 'consume', uid: it.uid }); expect(it.water!.pathogen).toBe(10)
  })
  it('중단·병 변경·연료 상실은 끓인 물이나 소비 공제를 만들지 않는다', () => {
    for (const kind of ['bottle','fuel','fire']) {
      const { w, doctor, fire, raw, wood } = setup(), it = raw(), fuel = wood(); doctor.pos = { x: fire.pos.x + 1, y: fire.pos.y }; expect(perform(w, doctor, { type: 'waterTreatment', uid: it.uid, method: 'boil' }).ok).toBe(true)
      if (kind === 'bottle') it.uses!--; if (kind === 'fuel') removeOne(w, doctor, fuel.uid); if (kind === 'fire') w.s.map.lights[0].off = true
      doctor.activity!.remaining = 0; expect(waterStep(w, doctor)).toBe(true); expect(doctor.activity).toBeUndefined(); expect(it.water!.pathogen).toBe(10); expect(doctor.residentConsumption).toBeUndefined(); if (kind !== 'fuel') expect(countOf(doctor, 'Item.Wood')).toBe(1)
    }
  })
  it('연료는 실제 완료 때1개만 소비하고 물량·재·플레이어 비밀과 공제 상한을 유지한다', () => {
    const { w, doctor, fire, raw, wood } = setup(), it = raw(); doctor.pos = { x: fire.pos.x + 1, y: fire.pos.y }; const log = structuredClone(w.s.log), knowledge = structuredClone(w.s.knowledge)
    for (let n = 0; n < 2; n++) { raw(); wood(); expect(perform(w, doctor, { type: 'waterTreatment', uid: it.uid, method: 'boil' }).ok).toBe(true); expect(doctor.activity!.total).toBe(200); doctor.activity!.remaining = 0; waterStep(w, doctor); expect(it.uses).toBe(5); expect(it.water).toMatchObject({ pathogen: 0, ash: 5.5 }); expect(countOf(doctor, 'Item.Wood')).toBe(0) }
    expect(doctor.residentConsumption?.units.Fuel).toBe(.15); expect(w.s.log).toEqual(log); expect(w.s.knowledge).toEqual(knowledge)
  })
  it('끓이기 중 각인과 이어 하기의 전체 몸·병·연료·소비 원장이 같다', () => {
    const { w, doctor, raw, wood } = setup(); raw(); wood(); doctor.needs.waterDeficit = 1000; wait(w, 20); expect(doctor.activity?.kind).toBe('water'); const copy = { db, s: deserialize(serialize(w.s)) }; wait(w, 300); wait(copy, 300); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('v16의 병·수질·원장을 보존하고 무료 연료·멸균을 부여하지 않는다', () => {
    const { w, raw } = setup(); raw(); const old = JSON.parse(serialize(w.s)); old.version = 16; delete old.map.residentHearth; delete old.map.residentPurificationInitialized; const restored = deserialize(JSON.stringify(old)); expect(restored.version).toBe(SAVE_VERSION); expect({ ...restored, version: 16 }).toEqual(old)
  })
})

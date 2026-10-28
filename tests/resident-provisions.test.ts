import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { residentFoodKcal, residentProvisionGoal, residentRationQuote, takeResidentRation } from '../src/core/resident-provisions'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { recordResidentUse, worldSimulationTick } from '../src/core/world-simulation'
import { db } from './helpers'
const template = newGame(db, { seed: 'resident-provisions', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }; p.pos = { x: 20, y: 20 }; w.s.sources = []; w.s.storyteller.budget = -1e9
  for (let y = 12; y <= 25; y++) for (let x = 24; x <= 42; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  initializeSettlement(w)
  const doctor = w.s.creatures.find((c) => c.clinicSite)!, depot = w.s.map.residentDepot!, stock = m.simulation!.settlements[site.id], market = m.markets![site.id]
  for (const c of w.s.creatures) {
    c.bag = c.bag.filter((it) => !db.item(it.def).food)
    c.nextAct = c.id === p.id || c.id === doctor.id ? w.s.time : 1e12; c.hp = 95; c.age = undefined; c.traits = []; c.traumas = []; c.background = undefined; c.effects = []; c.thoughts = []; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100 })
  }
  doctor.needs.kcal = 0
  w.s.map.lights = [{ pos: { x: 32, y: 18 }, radius: 12, kind: 'campfire' }]; invalidateLights(w)
  const adjacent = () => { doctor.pos = { x: depot.pos.x + 1, y: depot.pos.y } }
  const food = (count: number) => { const it = makeItem(w, 'Item.Hardtack', count); expect(addToBag(w, doctor, it)).toBe(0); return it }
  return { w, p, doctor, depot, stock, market, site, adjacent, food }
}
function wait(w: World, n: number) { for (let i = 0; i < n; i++) expect(playerAct(w, { type: 'wait' })).toBeNull() }
describe('실제 주민 배급과 인구 소비 원장', () => {
  it('견적은 읽기 전용이고 식량5개는 저장고0.7Food와 실제 배낭/UID만 옮긴다', () => {
    const { w, doctor, stock, market, adjacent } = setup(); adjacent(); const before = stateHash(w.s), reserve = stock.reserve.Food!, cash = doctor.money, shop = structuredClone(market), uid = w.s.overworld!.simulation!.nextItemId!
    expect(residentRationQuote(w, doctor)).toMatchObject({ error: null, count: 5, units: .7 }); expect(stateHash(w.s)).toBe(before)
    expect(takeResidentRation(w, doctor)).toBeNull(); expect(stock.reserve.Food).toBeCloseTo(reserve - .7, 8); expect(residentFoodKcal(w, doctor)).toBe(1750); expect(doctor.needs.kcal).toBe(0); expect(doctor.money).toBe(cash); expect(market).toEqual(shop); expect(w.s.overworld!.simulation!.nextItemId).toBe(uid + 1); expect(doctor.residentRation?.units).toBe(.7)
  })
  it('실제 스케줄러에서 창고로 걸어 받아 먹고 업무 자리로 돌아온다', () => {
    const { w, doctor, stock } = setup(), reserve = stock.reserve.Food!
    wait(w, 30); expect(doctor.pos).toEqual(doctor.home); expect(doctor.needs.kcal).toBeGreaterThan(300); expect(doctor.bag.find((it) => it.def === 'Item.Hardtack')?.count).toBe(4); expect(stock.reserve.Food).toBeCloseTo(reserve - .7, 8); expect(doctor.residentConsumption?.units.Food).toBe(.14); expect(stock.residentConsumption?.units.Food).toBe(.14)
  })
  it('저장고에2개분만 있으면2개만 지급하고 식량을 새로 채우지 않는다', () => {
    const { w, doctor, stock, adjacent } = setup(); adjacent(); stock.reserve.Food = .28; expect(takeResidentRation(w, doctor)).toBeNull(); expect(residentFoodKcal(w, doctor)).toBe(700); expect(stock.reserve.Food).toBe(0)
  })
  it('빈 저장고/가득 찬 배낭은 물품·현금·UID를 바꾸지 않고 재시도만 미룬다', () => {
    for (const kind of ['stock','bag']) {
      const { w, doctor, stock, adjacent } = setup(); adjacent()
      if (kind === 'stock') stock.reserve.Food = 0
      else { doctor.bag = []; for (let y = 0; y < 6; y += 3) for (let x = 0; x < 10; x += 2) { const bed = makeItem(w, 'Item.Bed'); Object.assign(bed, { gx: x, gy: y }); doctor.bag.push(bed) } }
      const before = { bag: structuredClone(doctor.bag), reserve: stock.reserve.Food, money: doctor.money, id: w.s.nextId, worldId: w.s.overworld!.simulation!.nextItemId }, hash = stateHash(w.s)
      expect(residentRationQuote(w, doctor).error).not.toBeNull(); expect(stateHash(w.s)).toBe(hash); expect(takeResidentRation(w, doctor)).not.toBeNull()
      expect({ bag: doctor.bag, reserve: stock.reserve.Food, money: doctor.money, id: w.s.nextId, worldId: w.s.overworld!.simulation!.nextItemId }).toEqual(before); expect(doctor.residentSupplyAfter).toBe(turnOf(w) + 1200)
    }
  })
  it('하루 개인 한도를 넘지 않고 전역 다음 날에만 새 한도를 받는다', () => {
    const { w, doctor, adjacent } = setup(); adjacent(); doctor.residentRation = { day: Math.floor(turnOf(w) / TURNS_PER_DAY), units: 1.4 }; expect(residentProvisionGoal(w, doctor)).toBeNull(); expect(residentRationQuote(w, doctor).error).not.toBeNull()
    w.s.time += TURNS_PER_DAY * 100; expect(residentRationQuote(w, doctor).count).toBe(5); expect(takeResidentRation(w, doctor)).toBeNull(); expect(doctor.residentRation?.units).toBe(.7)
  })
  it('멀리서 저장고 재고를 읽지 않고 실제 창고가 사라지면 지급하지 않는다', () => {
    const { w, doctor, stock, depot, adjacent } = setup(), full = residentProvisionGoal(w, doctor); stock.reserve.Food = 0; const hash = stateHash(w.s)
    expect(residentProvisionGoal(w, doctor)).toEqual(full); expect(stateHash(w.s)).toBe(hash); adjacent(); tileAt(w, depot.pos).t = 'Terrain.Earth'; expect(takeResidentRation(w, doctor)).toContain('창고'); expect(residentFoodKcal(w, doctor)).toBe(0)
  })
  it('플레이어·다른 지역 주민·먼 거리의 요청은 배급이나 현금을 만들지 않는다', () => {
    const { w, p, doctor, adjacent } = setup(); adjacent(); p.pos = { ...doctor.pos }; p.residentSite = doctor.residentSite; p.faction = doctor.faction
    let hash = stateHash(w.s); expect(perform(w, p, { type: 'residentRation' }).ok).toBe(false); expect(stateHash(w.s)).toBe(hash)
    doctor.pos = { x: 20, y: 20 }; hash = stateHash(w.s); expect(takeResidentRation(w, doctor)).toContain('창고'); expect(stateHash(w.s)).toBe(hash)
    doctor.residentSite = 'elsewhere'; hash = stateHash(w.s); expect(takeResidentRation(w, doctor)).not.toBeNull(); expect(stateHash(w.s)).toBe(hash)
  })
  it('실제 식사만 소비를 기록하고 개인 하루 기본량을 넘겨 중복 공제하지 않는다', () => {
    const { w, doctor, stock, food } = setup(), meal = food(10)
    for (let i = 0; i < 10; i++) expect(perform(w, doctor, { type: 'consume', uid: doctor.bag.find((it) => it.def === meal.def)!.uid }).ok).toBe(true)
    expect(doctor.bag.some((it) => it.uid === meal.uid)).toBe(false); expect(doctor.residentConsumption?.units.Food).toBe(1); expect(stock.residentConsumption?.units.Food).toBe(1)
  })
  it('플레이어·원격 지역·잘못된 수량은 주민 소비 공제를 만들지 않는다', () => {
    const { w, p, doctor } = setup(), hash = stateHash(w.s)
    for (const count of [-1, 0, .5, NaN]) recordResidentUse(w, doctor, 'Item.Hardtack', count)
    recordResidentUse(w, p, 'Item.Hardtack', 1); expect(stateHash(w.s)).toBe(hash); doctor.residentSite = 'elsewhere'; const remote = stateHash(w.s); recordResidentUse(w, doctor, 'Item.Hardtack', 1); expect(stateHash(w.s)).toBe(remote)
  })
  it('주민이 먹은1Food는 자정 요약 소비에서 빠지고 다음 날 재사용하지 않는다', () => {
    const { w, doctor, stock, food } = setup(), meal = food(8)
    for (let i = 0; i < 8; i++) expect(perform(w, doctor, { type: 'consume', uid: doctor.bag.find((it) => it.def === meal.def)!.uid }).ok).toBe(true)
    Object.assign(stock.population, { total: 1, S: 1, I: 0, R: 0, deaths: 0 }); stock.production = {}; stock.reserve.Food = 1000; stock.consumptionCarry = {}
    w.s.time = TURNS_PER_DAY * 100; worldSimulationTick(w); expect(stock.reserve.Food).toBe(1000); expect(stock.residentConsumption).toBeUndefined()
    const hash = stateHash(w.s); worldSimulationTick(w); expect(stateHash(w.s)).toBe(hash)
    w.s.time += TURNS_PER_DAY * 100; worldSimulationTick(w); expect(stock.reserve.Food).toBe(999)
  })
  it('소수 식량 공제는 기존 소비 이월과 합쳐 자원 보존을 유지한다', () => {
    const { w, doctor, stock, food } = setup(), meal = food(1); perform(w, doctor, { type: 'consume', uid: meal.uid })
    Object.assign(stock.population, { total: 1, S: 1, I: 0, R: 0, deaths: 0 }); stock.production = {}; stock.reserve.Food = 1000; stock.consumptionCarry = {}; w.s.time = TURNS_PER_DAY * 100; worldSimulationTick(w)
    expect(stock.reserve.Food).toBe(1000); expect(stock.consumptionCarry.Food).toBe(.86)
  })
  it('배고프면 취침보다 실제 배급을 먼저 찾고 경비도 보이는 적 앞에서는 배급을 미룬다', () => {
    const { w, doctor, depot } = setup(), bed = w.s.map.residentBeds!.find((b) => b.owner === doctor.id)!; doctor.pos = { ...bed.pos }; doctor.needs.fatigue = 80; expect(aiDecide(w, doctor).type).toBe('move')
    const guard = w.s.creatures.find((c) => c.def.includes('Guard'))!; guard.pos = { ...depot.pos }; guard.needs.kcal = 0; expect(aiDecide(w, guard)).toEqual({ type: 'residentRation' }); w.s.creatures.push(createCreature(w, 'Creature.Reaver', { x: depot.pos.x + 1, y: depot.pos.y })); expect(aiDecide(w, guard).type).not.toBe('residentRation')
  })
  it('NPC의 수령/식사는 플레이어 기록·지식을 바꾸지 않고 저장 후 소비도 한 번만 공제한다', () => {
    const { w, doctor, stock, adjacent } = setup(); adjacent(); const log = structuredClone(w.s.log), knowledge = structuredClone(w.s.knowledge); takeResidentRation(w, doctor); const meal = doctor.bag.find((it) => it.def === 'Item.Hardtack')!; perform(w, doctor, { type: 'consume', uid: meal.uid }); expect(w.s.log).toEqual(log); expect(w.s.knowledge).toEqual(knowledge)
    const copy = { db, s: deserialize(serialize(w.s)) }; for (const env of [w, copy]) { env.s.time = TURNS_PER_DAY * 100; worldSimulationTick(env) }
    expect(stateHash(copy.s)).toBe(stateHash(w.s)); expect(stock.residentConsumption).toBeUndefined()
  })
  it('v14의 몸·물품·개인 침대를 보존하고 새 배급/공제를 부여하지 않는다', () => {
    const { w } = setup(), old = JSON.parse(serialize(w.s)); old.version = 14; const restored = deserialize(JSON.stringify(old)); expect(restored.version).toBe(SAVE_VERSION); expect({ ...restored, version: 14 }).toEqual(old)
  })
})

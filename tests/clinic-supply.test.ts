import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { buyClinicSupplies, clinicSupplyGoal, clinicSupplyNeeds } from '../src/core/clinic-supply'
import { player, tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { marketFor, stockCount, tradePrice, tradeQuote } from '../src/core/economy'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { makeItem, addToBag } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template = newGame(db, { seed: 'clinic-supply', background: 'Bg.GuildMerchant', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'guild')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }
  initializeSettlement(w)
  const doctor = w.s.creatures.find((c) => c.clinicSite)!, trader = w.s.creatures.find((c) => c.traderSite)!, market = marketFor(w, trader)!
  for (const c of w.s.creatures) {
    c.nextAct = w.s.time; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax; c.hp = 95; c.diseases = []; c.effects = []; c.traumas = []; c.thoughts = []
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 10, stress: 0, bodyTemp: 37, wetness: 0, protein: 100, vitamin: 100 })
  }
  p.age = undefined; p.background = undefined; p.traits = []; p.pos = { x: 20, y: 20 }; doctor.money = 100
  for (let y = 15; y <= 23; y++) for (let x = 20; x <= 40; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  w.s.map.lights = [{ pos: { x: 32, y: 18 }, radius: 10, kind: 'campfire' }]; invalidateLights(w)
  return { w, p, doctor, trader, market }
}
function emptyBandages(env: ReturnType<typeof setup>) { env.doctor.bag = env.doctor.bag.filter((i) => !['Item.MedicalBag','Item.Bandage'].includes(i.def)) }
function adjacent(env: ReturnType<typeof setup>) { env.doctor.pos = { x: env.trader.pos.x + 1, y: env.trader.pos.y } }
function wait(w: World, n: number) { for (let i = 0; i < n; i++) expect(playerAct(w, { type: 'wait' })).toBeNull() }

describe('의사의 실제 상점 방문·구매·귀환', () => {
  it('의료가방의 남은 사용량을 세며 재보급 조회는 상태/RNG를 바꾸지 않는다', () => {
    const env = setup(), { w, doctor } = env, before = stateHash(w.s)
    expect(clinicSupplyNeeds(w, doctor)).toHaveLength(0); expect(clinicSupplyGoal(w, doctor)).toBeNull(); expect(stateHash(w.s)).toBe(before)
    const kits = doctor.bag.filter((it) => it.def === 'Item.MedicalBag'); kits[0].uses = 1; kits[1].uses = 0
    const need = clinicSupplyNeeds(w, doctor).find((n) => n.rule.item === 'Item.Bandage')!; expect(need.count).toBe(1); expect(need.missing).toBe(4)
  })
  it('실제 스케줄러에서 상점까지 걸어5개를 사고 진료 자리로 돌아온다', () => {
    const env = setup(), { w, p, doctor, market } = env; emptyBandages(env)
    const before = { stock: stockCount(market, 'Item.Bandage'), money: market.money, private: doctor.money!, time: w.s.time }
    expect(clinicSupplyGoal(w, doctor)?.kind).toBe('shop'); expect(doctor.pos).toEqual(doctor.home)
    wait(w, 20)
    expect(w.s.time - before.time).toBe(2000); expect(doctor.pos).toEqual(doctor.home); expect(stockCount(market, 'Item.Bandage')).toBe(before.stock - 5)
    expect(doctor.bag.filter((it) => it.def === 'Item.Bandage').reduce((n, it) => n + it.count, 0)).toBe(5); expect(doctor.money).toBe(before.private - 25); expect(market.money).toBe(before.money + 25); expect(p.money).toBeDefined()
  })
  it('한번에 지불할 수 있는2개만 사고 시장/개인 돈을 보존한다', () => {
    const env = setup(), { w, doctor, trader, market } = env; emptyBandages(env); adjacent(env); doctor.money = 12
    const cash = market.money, before = stockCount(market, 'Item.Bandage'); expect(buyClinicSupplies(w, doctor, trader)).toBeNull()
    expect(doctor.money).toBe(2); expect(market.money).toBe(cash + 10); expect(stockCount(market, 'Item.Bandage')).toBe(before - 2)
  })
  it('상점 물품이 없으면 돈/물품/UID를 만들지 않고1시간 뒤 확인한다', () => {
    const env = setup(), { w, doctor, trader, market } = env; emptyBandages(env); adjacent(env); market.items = []
    const before = { bag: structuredClone(doctor.bag), cash: doctor.money, id: w.s.nextId, money: market.money }
    expect(buyClinicSupplies(w, doctor, trader)).not.toBeNull(); expect({ bag: doctor.bag, cash: doctor.money, id: w.s.nextId, money: market.money }).toEqual(before); expect(doctor.clinicSupplyAfter).toBe(turnOf(w) + 1200); expect(clinicSupplyGoal(w, doctor)?.kind).toBe('home')
  })
  it('가격 한도·가득찬 배낭·돈 없음은 구매를 거절한다', () => {
    for (const kind of ['price','space','cash'] as const) {
      const env = setup(), { w, doctor, trader, market } = env; emptyBandages(env); adjacent(env)
      if (kind === 'price') { const stock = w.s.overworld!.simulation!.settlements[market.site]; stock.target.Medicine = 1000; stock.reserve.Medicine = 0; market.items = market.items.filter((it) => it.def === 'Item.Bandage') }
      if (kind === 'space') { doctor.bag = []; for (let n = 0; n < 60; n++) expect(addToBag(w, doctor, makeItem(w, 'Item.BoneCharm'))).toBe(0) }
      if (kind === 'cash') doctor.money = 0
      const before = { bag: structuredClone(doctor.bag), money: doctor.money, market: structuredClone(market), id: w.s.nextId }; expect(buyClinicSupplies(w, doctor, trader)).not.toBeNull()
      expect({ bag: doctor.bag, money: doctor.money, market, id: w.s.nextId }).toEqual(before)
    }
  })
  it('구매 불가를 기억한 의사는 돌아온 뒤 즉시 같은 상점을 왕복하지 않는다', () => {
    const env = setup(), { w, doctor, trader, market } = env; emptyBandages(env); adjacent(env); market.items = []; buyClinicSupplies(w, doctor, trader)
    wait(w, 20); expect(doctor.pos).toEqual(doctor.home); const after = doctor.clinicSupplyAfter; expect(aiDecide(w, doctor).type).toBe('wait'); expect(doctor.clinicSupplyAfter).toBe(after)
  })
  it('멀리서는 재고를 읽어 이동 여부를 결정하지 않으며 도착할 때 확인한다', () => {
    const env = setup(), { w, doctor, market } = env; emptyBandages(env); const full = clinicSupplyGoal(w, doctor); market.items = []
    expect(clinicSupplyGoal(w, doctor)).toEqual(full); expect(full?.kind).toBe('shop')
  })
  it('재보급 이동 중 각인을 읽어도 경로/구매/돈/UID가 같은 상태가 된다', () => {
    const env = setup(), { w } = env; emptyBandages(env); wait(w, 2)
    const copy = { db, s: deserialize(serialize(w.s)) }; wait(w, 20); wait(copy, 20); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('제삼자 NPC 거래는 플레이어 로그/지식을 바꾸지 않는다', () => {
    const env = setup(), { w, doctor, trader } = env; emptyBandages(env); adjacent(env); const logs = JSON.stringify(w.s.log), knowledge = JSON.stringify(w.s.knowledge)
    expect(buyClinicSupplies(w, doctor, trader)).toBeNull(); expect(JSON.stringify(w.s.log)).toBe(logs); expect(JSON.stringify(w.s.knowledge)).toBe(knowledge)
  })
  it('플레이어가 얻은 흥정 할인/거절을 의사의 거래에 전파하지 않는다', () => {
    const env = setup(), { w, p, doctor, trader, market } = env; emptyBandages(env); adjacent(env)
    const item = market.items.find((i) => i.def === 'Item.Bandage')!; market.haggle = { day: Math.floor(turnOf(w) / 28800), rounds: 3, successes: 2, irritation: 3, refusedUntil: turnOf(w) + 28800 }
    expect(tradePrice(w, doctor, trader, item, true)).toBe(5); expect(buyClinicSupplies(w, doctor, trader)).toBeNull()
    p.pos = { x: trader.pos.x - 1, y: trader.pos.y }; expect(tradeQuote(w, p, trader, [{ uid: item.uid, count: 1 }], []).error).toContain('거절')
  })
  it('의사는 진료 중/돈 없을 때 재보급으로 떠나지 않고 플레이어는 NPC 행동을 쓰지 못한다', () => {
    const env = setup(), { w, p, doctor, trader } = env; emptyBandages(env); doctor.activity = { kind: 'diagnose', patientId: p.id, remaining: 10, label: '진찰' }
    expect(clinicSupplyGoal(w, doctor)).toBeNull(); doctor.activity = undefined; doctor.money = 0; expect(clinicSupplyGoal(w, doctor)).toBeNull(); expect(perform(w, p, { type: 'clinicSupply', target: trader.id }).ok).toBe(false)
  })
})

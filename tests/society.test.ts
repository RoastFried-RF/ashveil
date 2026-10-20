import { describe, expect, it } from 'vitest'
import { player, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { newGame, playerAct } from '../src/core/game'
import { perform } from '../src/core/actions'
import { aiDecide as chooseAction } from '../src/core/ai'
import { createCreature } from '../src/core/creatures'
import { autoSnap } from '../src/core/autostop'
import { hostile, reputation, ensureSociety, diplomacyTick, witnessAttack } from '../src/core/diplomacy'
import { bargain, bargainChance, economyTick, exchange, marketFor, regionalPrice, stockCount, tradePrice, tradeQuote } from '../src/core/economy'
import { initializeSettlement } from '../src/core/settlements'
import { makeItem } from '../src/core/items'
import { foodTick } from '../src/core/food-safety'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { db } from './helpers'
const template = newGame(db, { seed: 'society-contracts', background: 'Bg.GuildMerchant', overworld: true })
function setup(faction = 'guild') {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!
  p.traits = []; p.age = undefined; p.background = undefined; p.abilities = []; p.effects = []; p.thoughts = []
  p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 95; p.needs.bodyTemp = 37; p.needs.kcal = 3000; p.needs.waterDeficit = 0; p.needs.fatigue = 10
  p.pos = { ...w.s.map.exits[0] }; expect(playerAct(w, { type: 'leave' })).toBeNull()
  const site = m.sites.find((s) => s.kind === 'settlement' && s.faction === faction)!
  m.position = { ...site.cell }; expect(playerAct(w, { type: 'enterRegion' })).toBeNull()
  const trader = w.s.creatures.find((c) => c.traderSite)!
  p.pos = { x: trader.pos.x - 1, y: trader.pos.y }; p.nextAct = w.s.time; p.money = 200
  const market = marketFor(w, trader)!
  return { w, p, m, site, trader, market }
}

describe('정착지 주민·세력·목격 평판', () => {
  it('실제 지역 입력으로 주민/상인/경비와 화덕을 만들고 재초기화·각인에 중복되지 않는다', () => {
    const { w, p, trader, market } = setup()
    expect(w.s.creatures.filter((c) => c.id !== p.id)).toHaveLength(4)
    const hash = stateHash(w.s); initializeSettlement(w); expect(stateHash(w.s)).toBe(hash)
    const restored = { db, s: deserialize(serialize(w.s)) }; initializeSettlement(restored)
    expect(stateHash(restored.s)).toBe(hash); expect(market.items.length).toBeGreaterThan(5)
    expect(hostile(w, p, trader)).toBe(false); expect(hostile(w, trader, p)).toBe(false)
    expect(autoSnap(w).hostiles).not.toContain(trader.id)
  })
  it('주민 곁 이동은 공격하지 않으며 대화는 실제로1턴을 소비한다', () => {
    const { w, p, trader } = setup(), before = w.s.time, hp = trader.hp
    expect(perform(w, p, { type: 'move', dir: 2 }).ok).toBe(false)
    expect(trader.hp).toBe(hp)
    expect(playerAct(w, { type: 'talk', target: trader.id })).toBeNull()
    expect(w.s.time - before).toBe(100); expect(trader.met).toBe(true)
    expect(w.s.log.at(-1)?.text).toContain('이야기')
  })
  it('정본 기본 태도와 배경 평판을 적용하고 구형 비월드 교전 규칙을 유지한다', () => {
    const { w, p, trader } = setup(), bandit = createCreature(w, 'Creature.Reaver', { x: 32, y: 19 })
    expect(hostile(w, p, bandit)).toBe(true); expect(reputation(w, 'guild')).toBe(20)
    delete w.s.overworld!.society; p.background = 'Bg.Deserter'; expect(reputation(w, 'guard')).toBe(-40)
    const old = { db, s: { ...w.s, overworld: undefined } }; expect(hostile(old, p, trader)).toBe(true)
  })
  it('보지 못한 공격은 세력 평판을 바꾸지 않지만 피해자가 실제로 반격할 수 있다', () => {
    const { w, p, trader, m } = setup(); w.s.creatures = [p, trader]; trader.unconscious = true
    witnessAttack(w, p, trader)
    expect(m.society!.events).toHaveLength(0); expect(reputation(w, 'guild')).toBe(20)
    expect(hostile(w, p, trader)).toBe(true)
  })
  it('현지 목격은 즉시 적용되고 반복 공격은 중복되지 않는다', () => {
    const { w, p, trader, m } = setup()
    witnessAttack(w, p, trader); witnessAttack(w, p, trader)
    expect(m.society!.events).toHaveLength(1); expect(reputation(w, 'guild')).toBe(0)
    expect(m.society!.events[0].applied).toBe(true)
    expect(w.s.creatures.filter((c) => c.id !== p.id).some((c) => hostile(w, c, p))).toBe(true)
  })
  it('먼 곳의 목격 소식은 저장 후 도착시각에 한 번만 반영된다', () => {
    const { w, p, trader, m } = setup(); m.currentRegion = undefined; m.position = { x: 1, y: 1 }
    witnessAttack(w, p, trader); expect(reputation(w, 'guild')).toBe(20)
    const event = m.society!.events[0]; expect(event.arrives - event.turn).toBe(4 * TURNS_PER_DAY)
    const copy = { db, s: deserialize(serialize(w.s)) }; copy.s.time = event.arrives * 100 - 100; diplomacyTick(copy); expect(reputation(copy, 'guild')).toBe(20)
    copy.s.time += 100; diplomacyTick(copy); diplomacyTick(copy); expect(reputation(copy, 'guild')).toBe(0)
  })
  it('무고한 주민은 평화로울 때 먹고 마시며 적이 보이면 물러난다', () => {
    const { w, p, trader } = setup(); trader.needs.waterDeficit = 600
    expect(chooseAction(w, trader).type).toBe('consume')
    trader.needs.waterDeficit = 0; trader.needs.kcal = -100
    expect(chooseAction(w, trader).type).toBe('consume')
    trader.attackedBy = [p.id]; expect(chooseAction(w, trader).type).toBe('move')
  })
})

describe('보존되는 재고·실제 거래·흥정', () => {
  it('붕대 목표18/현재2의 중립 판매가는15, 평시는5다', () => {
    const { w, p, trader, market, m } = setup(); ensureSociety(w)!.reputation.guild = 0
    const it = market.items.find((i) => i.def === 'Item.Bandage')!
    market.items = market.items.filter((i) => i.def === 'Item.Bandage'); m.simulation!.settlements[market.site].reserve.Medicine = 0; m.simulation!.settlements[market.site].target.Medicine = 18
    expect(w.db.item(it.def).value).toBe(4); expect(tradePrice(w, p, trader, it, true)).toBe(5)
    it.count = 2; expect(regionalPrice(w, market, it.def)).toBe(3); expect(tradePrice(w, p, trader, it, true)).toBe(15)
    expect(m.markets![market.site]).toBe(market)
  })
  it('조회는 상태/RNG를 소비하지 않으며 재질·품질·내구·사용량을 가격에 반영한다', () => {
    const { w, p, trader, market } = setup(), it = market.items.find((i) => i.def === 'Item.RebarSpear')!, hash = stateHash(w.s)
    const ordinary = tradePrice(w, p, trader, it, true); tradeQuote(w, p, trader, [{ uid: it.uid, count: 1 }], []); expect(stateHash(w.s)).toBe(hash)
    it.quality = 2; expect(tradePrice(w, p, trader, it, true)).toBeGreaterThan(ordinary)
    it.quality = 1; it.durability = 0; expect(tradePrice(w, p, trader, it, true)).toBeLessThan(ordinary)
    const bottle = market.items.find((i) => i.def === 'Item.WaterBottle')!, full = tradePrice(w, p, trader, bottle, true); bottle.uses = 0
    expect(tradePrice(w, p, trader, bottle, true)).toBeLessThan(full)
  })
  it('구매는1턴·돈 보존·수량 보존·고유UID로 완료된다', () => {
    const { w, p, trader, market } = setup(); p.bag = []
    const it = market.items.find((i) => i.def === 'Item.Bandage')!, price = tradePrice(w, p, trader, it, true), money = market.money + p.money!, before = w.s.time
    expect(playerAct(w, { type: 'trade', target: trader.id, buy: [{ uid: it.uid, count: 2 }], sell: [], expectedBalance: price * 2 })).toBeNull()
    expect(w.s.time - before).toBe(100); expect(p.bag[0].count).toBe(2); expect(it.count).toBe(18) // 원본 참조는 교체됨
    expect(stockCount(market, it.def)).toBe(16); expect(market.money + p.money!).toBe(money)
    const ids = [...market.items, ...p.bag].map((i) => i.uid); expect(new Set(ids).size).toBe(ids.length)
  })
  it('돈·배낭·상인 자금 부족과 잘못된 수량은 상태/UID/RNG를 전혀 바꾸지 않는다', () => {
    const { w, p, trader, market } = setup(), it = market.items[0]
    p.money = 0; let hash = stateHash(w.s)
    expect(exchange(w, p, trader, [{ uid: it.uid, count: 1 }], [])).toContain('부족'); expect(stateHash(w.s)).toBe(hash)
    p.money = 10000; p.bag = Array.from({ length: 60 }, (_, i) => ({ ...makeItem(w, 'Item.Stone'), gx: i % 10, gy: Math.floor(i / 10) })); hash = stateHash(w.s)
    expect(exchange(w, p, trader, [{ uid: it.uid, count: 1 }], [])).toContain('들어가지'); expect(stateHash(w.s)).toBe(hash)
    for (const count of [0, -1, .5, Infinity, it.count + 1]) { expect(exchange(w, p, trader, [{ uid: it.uid, count }], [])).not.toBeNull(); expect(stateHash(w.s)).toBe(hash) }
    market.money = 0; p.bag[0].def = 'Item.Bandage'; hash = stateHash(w.s)
    expect(exchange(w, p, trader, [], [{ uid: p.bag[0].uid, count: 1 }])).toContain('부족'); expect(stateHash(w.s)).toBe(hash)
  })
  it('판매로 생긴 공간을 같은 거래의 구매가 사용하고 판매품은 실제 재고로 남는다', () => {
    const { w, p, trader, market } = setup(); p.bag = []
    const needle = makeItem(w, 'Item.Needle'); needle.gx = 0; needle.gy = 0
    p.bag.push(needle)
    const before = p.money! + market.money, it = market.items.find((i) => i.def === 'Item.Bandage')!
    expect(exchange(w, p, trader, [{ uid: it.uid, count: 1 }], [{ uid: needle.uid, count: 1 }])).toBeNull()
    expect(market.items.some((i) => i.uid === needle.uid)).toBe(true); expect(p.bag.some((i) => i.uid === needle.uid)).toBe(false)
    expect(p.money! + market.money).toBe(before)
  })
  it('견적 뒤 가격 변경·중복UID·장착품 판매를 거절한다', () => {
    const { w, p, trader, market } = setup(), it = market.items[0]
    const buy = [{ uid: it.uid, count: 1 }], quote = tradeQuote(w, p, trader, buy, []); it.count = 1; const hash = stateHash(w.s)
    expect(exchange(w, p, trader, buy, [], quote.balance)).toContain('가격'); expect(stateHash(w.s)).toBe(hash)
    expect(exchange(w, p, trader, [...buy, ...buy], [])).toContain('수량')
    expect(exchange(w, p, trader, [], [{ uid: p.equip.main!.uid, count: 1 }])).toContain('수량')
  })
  it('배경 흥정 검산50%, 세 번 실패하면24시간 거절되고 저장으로 초기화되지 않는다', () => {
    const { w, p, trader, market } = setup('coalition'); ensureSociety(w)!.reputation.coalition = 10
    p.background = 'Bg.GuildMerchant'; p.stats.per = 11; p.stats.wil = 11; expect(bargainChance(w, p, trader)).toBe(50)
    p.background = undefined; p.stats.per = 10; p.stats.wil = 10; expect(bargainChance(w, p, trader)).toBe(32)
    for (let i = 0; i < 3; i++) { w.s.rng.story = [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]; expect(bargain(w, p, trader)).toBeNull() }
    expect(market.haggle!.rounds).toBe(3); expect(market.haggle!.irritation).toBe(3)
    const copy = { db, s: deserialize(serialize(w.s)) }, t = copy.s.creatures.find((c) => c.id === trader.id)!
    expect(bargain(copy, player(copy), t)).toContain('내일까지')
    copy.s.time += TURNS_PER_DAY * 100; expect(bargain(copy, player(copy), t)).toBeNull()
  })
  it('한꺼번에3일 정산해도 일별 정산과 재고/UID/각인 해시가 같다', () => {
    const { w } = setup(), copy = { db, s: deserialize(serialize(w.s)) }, start = Math.floor(turnOf(w) / TURNS_PER_DAY)
    for (let i = 1; i <= 3; i++) { w.s.time = (start + i) * TURNS_PER_DAY * 100; economyTick(w) }
    copy.s.time = w.s.time; economyTick(copy); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('상인 식량도 실제 지역 기온에서 부패하며 각인에 품질/재고/흥정이 남는다', () => {
    const { w, market } = setup(), food = market.items.find((i) => i.def === 'Item.Hardtack')!
    w.s.overworld!.cells[w.s.overworld!.position.y * w.s.overworld!.w + w.s.overworld!.position.x].temperature = 25
    w.s.time = Math.ceil(turnOf(w) / TURNS_PER_HOUR) * TURNS_PER_HOUR * 100 + TURNS_PER_HOUR * 100; foodTick(w)
    expect(food.freshness).toBeLessThan(100)
    const restored = deserialize(serialize(w.s)); expect(stateHash(restored)).toBe(stateHash(w.s))
  })
})

import { createCreature } from '../src/core/creatures'
import { describe, expect, it } from 'vitest'
import { newGame, playerAct } from '../src/core/game'
import { player, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { makeMarketItem, WORLD_STOCK_ID_START, marketFor, regionalPrice, stockCount } from '../src/core/economy'
import { applySettlementChanges, initializeWorldSimulation, infectionSeedChance, introduceInfection, settlementCommodity, settlementEntryError, settlementVisit, sirDay, withdrawForMarket, worldSimulationDef, worldSimulationTick } from '../src/core/world-simulation'
import { deserialize, serialize, stateHash } from '../src/core/save'
import type { PopulationState } from '../src/core/types'
import { db } from './helpers'
const template = newGame(db, { seed: 'world-simulation-contracts', background: 'Bg.Hunter', overworld: true })
function setup() { const w: World = { db, s: structuredClone(template) }, m = w.s.overworld!, simulation = m.simulation!, site = m.sites.find((s) => s.id === 'Region.ShepherdDale')!, settlement = simulation.settlements[site.id]; return { w, m, simulation, site, settlement } }
function advanceDay(w: World, days: number) { w.s.time = (Math.floor(turnOf(w) / TURNS_PER_DAY) + days) * TURNS_PER_DAY * 100; worldSimulationTick(w) }

describe('전역 저장고와 정착지 SIR', () => {
  it('09 검산4의400명/20감염/3일 표와 이월분·인구 보존이 정확히 일치한다', () => {
    const p: PopulationState = { total: 400, S: 380, I: 20, R: 0, deaths: 0, infectionCarry: 0, recoveryCarry: 0, deathCarry: 0 }, d = worldSimulationDef(setup().w).disease
    const expected = [[375,23,2,0],[368,27,4,1],[361,30,7,2]]
    for (const row of expected) { sirDay(p,d); expect([p.S,p.I,p.R,p.deaths]).toEqual(row); expect(p.S+p.I+p.R+p.deaths).toBe(400) }
  })
  it('SIR는 난수를 쓰지 않고 감염/회복/사망을 인구 안으로 제한한다', () => {
    const d = worldSimulationDef(setup().w).disease
    const p: PopulationState = { total: 11, S: 1, I: 10, R: 0, deaths: 0, infectionCarry: 0, recoveryCarry: 999, deathCarry: 999 }
    for (let i=0;i<100;i++) { sirDay(p,d); expect(Math.min(p.S,p.I,p.R,p.deaths)).toBeGreaterThanOrEqual(0); expect(p.S+p.I+p.R+p.deaths).toBe(11) }
  })
  it('모든 인간 정착지의 인구·저장고·시장이 처음부터 존재하며 이중 초기화하지 않는다', () => {
    const { w,m,simulation } = setup(); expect(Object.keys(simulation.settlements).sort()).toEqual(m.sites.filter(s=>s.kind==='settlement').map(s=>s.id).sort()); expect(Object.keys(m.markets!).sort()).toEqual(m.sites.filter(s=>s.kind==='settlement').map(s=>s.id).sort())
    const before = stateHash(w.s); initializeWorldSimulation(w); expect(stateHash(w.s)).toBe(before)
  })
  it('먼 시장 물품의 생성은 로컬 NPC의 ID·몸·장비·난수 상태를 바꾸지 않는다', () => {
    const { w,m }=setup(), copy={db,s:deserialize(serialize(w.s))}, before=w.s.nextId
    const items=Array.from({length:20},()=>makeMarketItem(w,'Item.Cloth',1))
    expect(w.s.nextId).toBe(before); expect(new Set(items.map((i)=>i.uid)).size).toBe(20)
    expect(items.every((i)=>i.uid>=WORLD_STOCK_ID_START)).toBe(true)
    expect(Object.values(m.markets!).flatMap((m)=>m.items).every((i)=>i.uid>=WORLD_STOCK_ID_START)).toBe(true)
    const a=createCreature(w,'Creature.Reaver',{x:20,y:20}),b=createCreature(copy,'Creature.Reaver',{x:20,y:20})
    expect(a).toEqual(b); expect(w.s.rng).toEqual(copy.s.rng)
  })
  it('180명 기준 식량2400/연료600/소금90에서 하루 생산−소비를 보존한다', () => {
    const { w,settlement } = setup(); expect(settlement.population.total).toBe(180)
    expect(settlementCommodity(w,settlement,'Food')).toBe(2400); expect(settlementCommodity(w,settlement,'Fuel')).toBe(600)
    advanceDay(w,1)
    expect(settlementCommodity(w,settlement,'Food')).toBe(2380); expect(settlementCommodity(w,settlement,'Fuel')).toBe(598); expect(settlementCommodity(w,settlement,'Salt')).toBe(81)
  })
  it('시장 입고가 저장고 물자를 실제로 차감하고 없는 물자를 만들지 않는다', () => {
    const { w,m,site,settlement } = setup(), market=m.markets![site.id], before=settlementCommodity(w,settlement,'Food')
    const available=settlement.reserve.Food!, count=withdrawForMarket(w,site.id,'Item.Hardtack',10)
    expect(count).toBe(10); expect(settlement.reserve.Food).toBeCloseTo(available-10*.14,8)
    expect(settlementCommodity(w,settlement,'Food')).toBeCloseTo(before-1.4,8)
    settlement.reserve.Medicine=0; expect(withdrawForMarket(w,site.id,'Item.Bandage',20)).toBe(0)
    expect(market.items.every((i)=>i.count>0)).toBe(true)
  })
  it('저장고가 비면 실제 시장 식량도 주민 소비에서 빠진다', () => {
    const { w,m,site,settlement }=setup(), market=m.markets![site.id]
    settlement.reserve.Food=0; settlement.production.Food=0
    expect(stockCount(market,'Item.Hardtack')).toBeGreaterThan(0); advanceDay(w,1)
    expect(settlementCommodity(w,settlement,'Food')).toBe(0); expect(stockCount(market,'Item.Hardtack')).toBe(0)
  })
  it('한 번에3일 정산과 하루씩 진행한 인구/저장고/시장/UID/난수 해시가 같다', () => {
    const { w,site }=setup(), copy={db,s:deserialize(serialize(w.s))}; introduceInfection(w,site.id,20); introduceInfection(copy,site.id,20)
    for(let i=0;i<3;i++) advanceDay(w,1)
    advanceDay(copy,3); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('09 검산5의왕래6×23/400×.5=17.25%, 봉쇄면 이동량×.2다', () => {
    const { w,simulation,settlement }=setup(), dest=Object.values(simulation.settlements).find((s)=>s.site!==settlement.site)!
    settlement.population.total=400; settlement.population.I=23; settlement.quarantined=false; dest.quarantined=false
    expect(infectionSeedChance(w,settlement,dest)).toBeCloseTo(.1725,10)
    settlement.quarantined=true; expect(infectionSeedChance(w,settlement,dest)).toBeCloseTo(.0345,10)
  })
  it('5% 봉쇄는 실제 지역 진입을 거절하고 회복되면 재개한다', () => {
    const { w,m,site,settlement }=setup(),p=player(w); introduceInfection(w,site.id,9)
    expect(settlement.quarantined).toBe(true); expect(settlementEntryError(w,site.id)).toContain('봉쇄')
    p.pos={...w.s.map.exits[0]}; expect(playerAct(w,{type:'leave'})).toBeNull(); m.position={...site.cell}; const before=w.s.time
    expect(playerAct(w,{type:'enterRegion'})).toContain('봉쇄'); expect(w.s.time).toBe(before); expect(m.currentRegion).toBeUndefined()
    settlement.population.R+=settlement.population.I; settlement.population.I=0; advanceDay(w,1)
    expect(settlementEntryError(w,site.id)).toBeNull(); expect(playerAct(w,{type:'enterRegion'})).toBeNull(); expect(m.currentRegion).toBe(site.id)
  })
  it('현재 지도는 장소 변화 적용 때만 봉쇄 상태를 바꾸며 중복 로그를 남기지 않는다', () => {
    const { w,m,site,settlement }=setup(); m.currentRegion=site.id
    introduceInfection(w,site.id,9); expect(w.s.map.quarantine).toBeUndefined()
    applySettlementChanges(w); expect(w.s.map.quarantine).toBe(true); const count=w.s.log.length
    applySettlementChanges(w); expect(w.s.log.length).toBe(count); expect(settlement.changes[0].applied).toBe(true)
  })
  it('봉쇄된 정착지는 목표 약품3배로 실제 거래 가격이 오른다', () => {
    const { w,m,site,settlement }=setup(),market=m.markets![site.id], normal=regionalPrice(w,market,'Item.Bandage')
    introduceInfection(w,site.id,9); expect(regionalPrice(w,market,'Item.Bandage')).toBeCloseTo(normal*Math.sqrt(3),10)
    expect(w.s.creatures.some((c)=>marketFor(w,c)===market)).toBe(false) // 멀리 있는 상점에도 저장고·가격은 존재한다.
    expect(settlement.quarantined).toBe(true)
  })
  it('감염된 방문객은 실제 주민에게 전파하며 같은 날 반복 출입은 난수를 더 쓰지 않는다', () => {
    const { w,site,settlement }=setup(),p=player(w)
    p.diseases=[{def:'Disease.GreyFever',incubatesUntil:turnOf(w)-1,progress:20,immunity:0}]; w.s.rng[`world.visits.${site.id}`]=[0,0,0,1]
    settlementVisit(w,site.id); expect(settlement.population.I).toBe(1); const hash=stateHash(w.s)
    settlementVisit(w,site.id); expect(stateHash(w.s)).toBe(hash)
  })
  it('감염 지역 방문이 플레이어의 실제 회색열 잠복 상태로 이어지고 저장된다', () => {
    const { w,site,settlement }=setup(),p=player(w); introduceInfection(w,site.id); w.s.rng[`world.visits.${site.id}`]=[0,0,0,1]
    settlementVisit(w,site.id); expect(p.diseases?.some((d)=>d.def==='Disease.GreyFever'&&d.incubatesUntil>turnOf(w))).toBe(true)
    expect(settlement.population.I).toBe(1); expect(stateHash(deserialize(serialize(w.s)))).toBe(stateHash(w.s))
  })
  it('구형 방문 시장을 유지하며 전역 저장고를 연결한다', () => {
    const { w,m,site }=setup(), old=structuredClone(m.markets![site.id]); delete m.simulation
    initializeWorldSimulation(w); expect(m.markets![site.id]).toEqual(old)
    const saved=serialize(w.s); expect(stateHash(deserialize(saved))).toBe(stateHash(w.s))
  })
})

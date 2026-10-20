import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { sleepQuality } from '../src/core/conditions'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { marketFor } from '../src/core/economy'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { initializeInn, innQuote, innSleepError, rentInnBed } from '../src/core/inn'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template = newGame(db, { seed: 'inn-contract', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }
  p.pos = { x: 29, y: 18 }; p.money = 100; p.age = undefined; p.traits = []; p.background = undefined; p.effects = []; p.traumas = []; p.thoughts = []; p.body.wounds = []; p.body.missing = []; p.body.blood = p.body.bloodMax
  for (let y = 12; y <= 24; y++) for (let x = 24; x <= 40; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  initializeSettlement(w)
  for (const c of w.s.creatures) {
    c.nextAct = c.id === p.id ? w.s.time : 1e12
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 70, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100 })
  }
  const keeper = w.s.creatures.find((c) => c.traderSite)!, market = marketFor(w, keeper)!, beds = w.s.map.innBeds!
  w.s.map.lights = [{ pos: { x: 30, y: 18 }, radius: 10, kind: 'campfire' }]; invalidateLights(w)
  return { w, p, keeper, market, beds }
}
describe('실제 여관 침대·숙박 계약', () => {
  it('견적은 읽기 전용이며 유한한2침대에 실제 현금과1턴을 지불한다', () => {
    const { w, p, keeper, market, beds } = setup(), before = stateHash(w.s), cash = market.money, pos = { ...p.pos }, time = w.s.time
    expect(beds).toHaveLength(2)
    const q = innQuote(w, p, keeper, beds[0].id); expect(q.error).toBeNull(); expect(q.fee).toBe(8); expect(stateHash(w.s)).toBe(before)
    expect(playerAct(w, { type: 'rentBed', target: keeper.id, bed: beds[0].id, expectedFee: q.fee })).toBeNull()
    expect(w.s.time).toBe(time + 100); expect(p.money).toBe(92); expect(market.money).toBe(cash + 8); expect(p.pos).toEqual(pos)
    expect(beds[0].lease).toEqual({ tenant: p.id, until: time / 100 + TURNS_PER_DAY })
  })
  it('타인 계약/점유·다른 자리 중복·돈 부족·변경 가격은 원자적으로 거부한다', () => {
    const { w, p, keeper, beds } = setup()
    beds[0].lease = { tenant: keeper.id, until: turnOf(w) + 100 }
    let before = stateHash(w.s); expect(rentInnBed(w, p, keeper, beds[0].id)).toContain('다른 손님'); expect(stateHash(w.s)).toBe(before)
    beds[0].lease = undefined; p.money = 0; before = stateHash(w.s); expect(rentInnBed(w, p, keeper, beds[0].id)).toContain('부족'); expect(stateHash(w.s)).toBe(before)
    p.money = 100; before = stateHash(w.s); expect(rentInnBed(w, p, keeper, beds[0].id, 999)).toContain('바뀌'); expect(stateHash(w.s)).toBe(before)
    expect(rentInnBed(w, p, keeper, beds[0].id)).toBeNull(); before = stateHash(w.s); expect(rentInnBed(w, p, keeper, beds[1].id)).toContain('이미 빌린'); expect(stateHash(w.s)).toBe(before)
    beds[0].lease!.until = turnOf(w); const guard = w.s.creatures.find((c) => c.id !== p.id && c.id !== keeper.id)!; guard.pos = { ...beds[0].pos }
    before = stateHash(w.s); expect(rentInnBed(w, p, keeper, beds[0].id)).toContain('쓰고'); expect(stateHash(w.s)).toBe(before)
  })
  it('유효 기한에서 연장하고 만료된 빈 침대는 현재부터 새로 계약한다', () => {
    const { w, p, keeper, beds } = setup(), bed = beds[0], now = turnOf(w)
    expect(rentInnBed(w, p, keeper, bed.id)).toBeNull(); expect(rentInnBed(w, p, keeper, bed.id)).toBeNull(); expect(bed.lease!.until).toBe(now + 2 * TURNS_PER_DAY)
    bed.lease = { tenant: keeper.id, until: now - 1 }; expect(rentInnBed(w, p, keeper, bed.id)).toBeNull(); expect(bed.lease!.until).toBe(now + TURNS_PER_DAY)
  })
  it('상인과 멀거나 적대·무의식·침대 훼손 시 지불하지 않는다', () => {
    const { w, p, keeper, beds } = setup(), bed = beds[0]
    for (const kind of ['distance','unconscious','destroyed','hostile']) {
      const pos = { ...p.pos }, t = tileAt(w, bed.pos).t, faction = keeper.faction
      if (kind === 'distance') p.pos = { x: 20, y: 20 }
      if (kind === 'unconscious') keeper.unconscious = true
      if (kind === 'destroyed') tileAt(w, bed.pos).t = 'Terrain.Earth'
      if (kind === 'hostile') keeper.faction = 'beast'
      const before = stateHash(w.s); expect(rentInnBed(w, p, keeper, bed.id)).not.toBeNull(); expect(stateHash(w.s)).toBe(before)
      p.pos = pos; tileAt(w, bed.pos).t = t; keeper.faction = faction; keeper.unconscious = false
    }
  })
  it('미대여 침대의 수면을 막고 실제 침구 품질로 회복하며 기한에 깬다', () => {
    const { w, p, beds } = setup(), bed = beds[0]; p.pos = { ...bed.pos }
    expect(perform(w, p, { type: 'sleep' }).ok).toBe(false); expect(innSleepError(w, p)).toContain('먼저')
    tileAt(w, bed.pos).t = 'Terrain.Earth'; const rough = sleepQuality(w, p); tileAt(w, bed.pos).t = bed.terrain; expect(sleepQuality(w, p)).toBeCloseTo(rough * 2)
    bed.lease = { tenant: p.id, until: turnOf(w) + 3 }; const fatigue = p.needs.fatigue
    expect(playerAct(w, { type: 'sleep' })).toBeNull(); expect(p.activity).toBeUndefined(); expect(p.asleep).toBe(false); expect(p.needs.fatigue).toBeLessThan(fatigue)
    expect(w.s.log.some((l) => l.text.includes('대여 시간이 끝났다'))).toBe(true)
  })
  it('계약·수면 도중 각인은 같은 기한/돈/몸/난수 결과로 이어진다', () => {
    const { w, p, keeper, beds } = setup(); expect(rentInnBed(w, p, keeper, beds[0].id)).toBeNull(); p.pos = { ...beds[0].pos }; beds[0].lease!.until = turnOf(w) + 6
    expect(playerAct(w, { type: 'sleep' }, 1)).toBeNull(); expect(p.activity?.kind).toBe('sleep')
    const restored = { db, s: deserialize(serialize(w.s)) }
    for (const x of [w, restored]) for (let i = 0; x.s.simulationPending && i < 100; i++) runUntilInput(x, 100)
    expect(stateHash(restored.s)).toBe(stateHash(w.s)); expect(player(restored).activity).toBeUndefined()
  })
  it('구형 지역에 안전한 자리만 한 번 설치하고 대여/사망을 재초기화하지 않는다', () => {
    const { w, keeper, beds } = setup(); beds[0].lease = { tenant: w.s.playerId, until: turnOf(w) + 100 }; keeper.alive = false
    const before = stateHash(w.s); initializeSettlement(w); expect(stateHash(w.s)).toBe(before)
    w.s.map.innInitialized = undefined; w.s.map.innBeds = undefined
    for (let y = 13; y <= 23; y++) for (let x = 25; x <= 35; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.KtWall' })
    initializeInn(w); expect(w.s.map.innBeds).toEqual([]); expect(w.s.map.innInitialized).toBe(true)
  })
  it('v10의 몸·현금·활동을 보존하고 새 계약을 임의 생성하지 않는다', () => {
    const { w } = setup(), old = JSON.parse(serialize(w.s)); old.version = 10; delete old.map.innBeds; delete old.map.innInitialized
    const restored = deserialize(JSON.stringify(old)); expect(restored.version).toBe(SAVE_VERSION); expect({ ...restored, version: 10 }).toEqual(old)
  })
})

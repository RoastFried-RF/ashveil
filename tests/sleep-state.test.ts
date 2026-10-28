import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { wake } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { canSee, invalidateLights } from '../src/core/fov'
import { newGame, playerAct, SAVE_VERSION } from '../src/core/game'
import { emitNoise } from '../src/core/perception'
import { administerDrug, pharmacologyTick } from '../src/core/pharmacology'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { db } from './helpers'
const template = newGame(db, { seed: 'sleep-state', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w)
  p.pos = { x: 20, y: 20 }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }
  const npc = createCreature(w, 'Creature.SettlementDoctor', { x: 21, y: 20 }); w.s.creatures.push(npc)
  for (const c of [p, npc]) {
    c.nextAct = w.s.time; c.hp = 95; c.age = undefined; c.traits = []; c.traumas = []; c.background = undefined; c.abilities = []; c.effects = []; c.thoughts = []; c.bag = []; c.equip = {}; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax; c.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 60, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100 })
  }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  w.s.map.lights = [{ pos: { ...p.pos }, radius: 8, kind: 'campfire' }]; invalidateLights(w)
  return { w, p, npc }
}
function sleep(w: World, c: ReturnType<typeof player>, remaining = 2) { expect(perform(w, c, { type: 'sleep' }).ok).toBe(true); c.activity!.remaining = remaining }
function wait(w: World, n = 3) { for (let i = 0; i < n; i++) expect(playerAct(w, { type: 'wait' })).toBeNull() }
describe('수면 활동과 실제 수면 상태', () => {
  it('플레이어도 잠든 순간 눈을 감고 스스로 취소하면 즉시 시야를 되찾는다', () => {
    const { w, p, npc } = setup(); npc.nextAct = 1e12
    expect(canSee(w, p, npc.pos)).toBe(true); sleep(w, p, 10); expect(p.asleep).toBe(true); expect(canSee(w, p, npc.pos)).toBe(false)
    expect(playerAct(w, { type: 'stopActivity' })).toBeNull(); expect(p.asleep).toBe(false); expect(p.activity).toBeUndefined(); expect(canSee(w, p, npc.pos)).toBe(true); expect(p.drowsyUntil).toBeGreaterThan(turnOf(w))
  })
  it('NPC의 마지막 실제 수면 턴도 회복하고 종료하면 깨어서 다시 볼 수 있다', () => {
    const { w, npc } = setup(), fatigue = npc.needs.fatigue; sleep(w, npc, 10); expect(canSee(w, npc, player(w).pos)).toBe(false)
    wait(w, 10); expect(npc.needs.fatigue).toBeLessThan(fatigue); expect(npc.asleep).toBe(false); expect(npc.activity).toBeUndefined(); expect(canSee(w, npc, player(w).pos)).toBe(true); expect(npc.drowsyUntil).toBeGreaterThan(turnOf(w))
  })
  it('NPC는 큰 소리에 깨면 수면 활동을 멈추고 깊은 잠의20턴 잠기운을 보존한다', () => {
    const { w, npc } = setup(); sleep(w, npc, 100); npc.deepSleep = true; npc.activity!.elapsed = 1200
    emitNoise(w, npc.pos, 40, player(w).id); expect(npc.activity!.wokeBy).toContain('소리'); const until = npc.drowsyUntil!
    wait(w, 1); expect(npc.activity).toBeUndefined(); expect(npc.asleep).toBe(false); expect(npc.drowsyUntil).toBeGreaterThanOrEqual(until); expect(until - w.s.time / 100).toBeGreaterThanOrEqual(19)
  })
  it('같은 상처 수로 깨워도 수면 활동에 복귀하지 않는다', () => {
    const { w, npc } = setup(); sleep(w, npc, 100); const wounds = npc.body.wounds.length
    wake(w, npc, '흔들어 깨웠다'); wait(w, 1); expect(npc.body.wounds).toHaveLength(wounds); expect(npc.activity).toBeUndefined(); expect(npc.asleep).toBe(false)
  })
  it('NPC도 허기·갈증·체온 신호와 완전 회복으로 수면을 끝낸다', () => {
    for (const kind of ['cold','heat','thirst','recovered']) {
      const { w, npc } = setup(); sleep(w, npc, 100); npc.activity!.elapsed = 1; npc.activity!.sleep0 = { fatigue: 60, hunger: 0, thirst: 0, wet: 0 }
      if (kind === 'cold') npc.needs.bodyTemp = 34.9
      if (kind === 'heat') npc.needs.bodyTemp = 40.6
      if (kind === 'thirst') npc.needs.waterDeficit = 1200
      if (kind === 'recovered') npc.needs.fatigue = 0
      wait(w, 1); expect(npc.activity, kind).toBeUndefined(); expect(npc.asleep).toBe(false)
    }
  })
  it('보이지 않는 NPC의 수면 종료는 플레이어 기록과 지식을 바꾸지 않는다', () => {
    const { w, npc } = setup(); player(w).needs.fatigue=20; npc.pos = { x: 45, y: 30 }; Object.assign(tileAt(w, npc.pos), { t: 'Terrain.Earth', roof: true }); expect(canSee(w, player(w), npc.pos)).toBe(false); sleep(w, npc); const logs = structuredClone(w.s.log), knowledge = structuredClone(w.s.knowledge)
    wait(w); expect(w.s.log).toEqual(logs); expect(w.s.knowledge).toEqual(knowledge)
  })
  it('수면 도중 각인도 같은 NPC 기상 시각·몸·잠기운으로 끝난다', () => {
    const { w, npc } = setup(); sleep(w, npc, 4); wait(w, 1); const copy = { db, s: deserialize(serialize(w.s)) }
    wait(w, 5); wait(copy, 5); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('약물 수면의 자연 만료도 두 인물 모두 기상 시각과 깊은 잠 잠기운을 남긴다', () => {
    const { w, p, npc } = setup()
    for (const c of [p, npc]) { expect(administerDrug(w, c, 'Drug.SleepPill')).toBeNull(); c.deepSleep = true }
    w.s.time += 2400 * 100
    for (const c of [p, npc]) { pharmacologyTick(w, c); expect(c.activity).toBeUndefined(); expect(c.asleep).toBe(false); expect(c.lastWokeAt).toBe(turnOf(w)); expect(c.drowsyUntil).toBe(turnOf(w) + 20) }
  })
  it('구형12 각인의 잠든 활동만 실제 수면으로 맞추고 몸·물품·깨어난 활동은 보존한다', () => {
    const { w, p, npc } = setup(); sleep(w, npc, 10); npc.asleep = false; sleep(w, p, 10); p.asleep = false; p.activity!.wokeBy = '이미 들은 소리'
    const old = JSON.parse(serialize(w.s)); old.version = 12; const restored = deserialize(JSON.stringify(old)), expected = structuredClone(old); expected.version = SAVE_VERSION; expected.creatures.find((c: typeof npc) => c.id === npc.id).asleep = true
    expect(restored).toEqual(expected); expect(deserialize(serialize(restored))).toEqual(restored)
  })
})

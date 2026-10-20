import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { canSee, invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { initializeResidentRest, residentBedError, residentRestGoal } from '../src/core/resident-rest'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template = newGame(db, { seed: 'resident-rest', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }; p.pos = { x: 20, y: 20 }
  for (let y = 12; y <= 25; y++) for (let x = 24; x <= 42; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  initializeSettlement(w)
  const doctor = w.s.creatures.find((c) => c.clinicSite)!, bed = w.s.map.residentBeds!.find((b) => b.owner === doctor.id)!
  for (const c of w.s.creatures) {
    c.nextAct = c.id === p.id || c.id === doctor.id ? w.s.time : 1e12; c.hp = 95; c.age = undefined; c.traits = []; c.traumas = []; c.background = undefined; c.effects = []; c.thoughts = []; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100 })
  }
  w.s.map.lights = [{ pos: { x: 32, y: 18 }, radius: 12, kind: 'campfire' }]; invalidateLights(w)
  return { w, p, doctor, bed, site }
}
function wait(w: World, n: number) { for (let i = 0; i < n; i++) expect(playerAct(w, { type: 'wait' })).toBeNull() }
describe('주민의 실제 개인 침대·휴식 일과', () => {
  it('4명의 개인 침대와2개의 대여 침대를 한 번만 만들고 초기화는 중복되지 않는다', () => {
    const { w, site } = setup(); expect(w.s.map.residentBeds).toHaveLength(4); expect(w.s.map.innBeds).toHaveLength(2)
    const coords = [...w.s.map.residentBeds!, ...w.s.map.innBeds!].map((b) => `${b.pos.x},${b.pos.y}`); expect(new Set(coords).size).toBe(6)
    const before = stateHash(w.s); initializeResidentRest(w, site); initializeSettlement(w); expect(stateHash(w.s)).toBe(before)
  })
  it('피곤한 의사는 순간이동 없이 자기 침대까지 실제 이동해 잠든다', () => {
    const { w, doctor, bed } = setup(), start = { ...doctor.pos }; doctor.needs.fatigue = 80
    const before = stateHash(w.s); expect(residentRestGoal(w, doctor)?.pos).toEqual(bed.pos); expect(stateHash(w.s)).toBe(before); expect(doctor.pos).toEqual(start)
    wait(w, 8); expect(doctor.pos).toEqual(bed.pos); expect(doctor.asleep).toBe(true); expect(doctor.activity?.kind).toBe('sleep'); expect(doctor.activity?.wakeFatigue).toBe(20); expect(doctor.needs.fatigue).toBeLessThan(80)
  })
  it('충분히 쉬면 깨어서 자기 업무 자리로 걸어 돌아간다', () => {
    const { w, doctor, bed } = setup(); doctor.pos = { ...bed.pos }; doctor.needs.fatigue = 80; expect(perform(w, doctor, { type: 'sleep' }).ok).toBe(true); doctor.activity!.elapsed = 1; doctor.needs.fatigue = 19
    wait(w, 10); expect(doctor.asleep).toBe(false); expect(doctor.activity).toBeUndefined(); expect(doctor.pos).toEqual(doctor.home); expect(doctor.residentReturning).toBeUndefined(); expect(doctor.residentRestAfter).toBeGreaterThan(turnOf(w))
  })
  it('플레이어와 다른 주민은 개인 침대에서 잠들 수 없고 대여 침대 계약은 별개다', () => {
    const { w, p, bed, doctor } = setup(); p.pos = { ...bed.pos }; p.needs.fatigue = 80; const before = stateHash(w.s)
    expect(residentBedError(w, p)).toContain('개인 침대'); expect(perform(w, p, { type: 'sleep' }).ok).toBe(false); expect(stateHash(w.s)).toBe(before)
    p.pos = { x: 20, y: 20 }; doctor.pos = { ...bed.pos }; doctor.needs.fatigue = 80; expect(residentBedError(w, doctor)).toBeNull(); expect(perform(w, doctor, { type: 'sleep' }).ok).toBe(true)
  })
  it('멀리 있는 침대의 점유를 미리 읽지 않고 가까이서 막힌 것을 확인하면 재시도한다', () => {
    const { w, p, doctor, bed } = setup(); doctor.needs.fatigue = 80; doctor.pos = { x: 24, y: 23 }
    const empty = residentRestGoal(w, doctor); p.pos = { ...bed.pos }; expect(residentRestGoal(w, doctor)).toEqual(empty)
    doctor.pos = { ...doctor.home! }; expect(canSee(w, doctor, bed.pos)).toBe(true); expect(aiDecide(w, doctor)).toEqual({ type: 'wait' }); expect(doctor.residentRestAfter).toBe(turnOf(w) + 1200); expect(residentRestGoal(w, doctor)).toBeNull()
  })
  it('침대가 없어졌거나 길이 막혀도 바닥에 새 침대를 생성하지 않는다', () => {
    const { w, doctor, bed } = setup(); doctor.needs.fatigue = 80; tileAt(w, bed.pos).t = 'Terrain.Earth'; const id = w.s.nextId
    expect(aiDecide(w, doctor)).toEqual({ type: 'wait' }); expect(tileAt(w, bed.pos).t).toBe('Terrain.Earth'); expect(w.s.nextId).toBe(id); expect(doctor.residentRestAfter).toBeGreaterThan(turnOf(w))
    const blocked = setup(); blocked.p.pos = { x: 20, y: 23 }; blocked.doctor.pos = { x: 20, y: 20 }; blocked.doctor.needs.fatigue = 80
    for (let y = 19; y <= 21; y++) for (let x = 19; x <= 21; x++) if (x !== 20 || y !== 20) tileAt(blocked.w, { x, y }).t = 'Terrain.KtWall'
    expect(aiDecide(blocked.w, blocked.doctor)).toEqual({ type: 'wait' }); expect(blocked.doctor.residentRestAfter).toBeGreaterThan(turnOf(blocked.w)); expect(tileAt(blocked.w, blocked.bed.pos).t).toBe(blocked.bed.terrain)
  })
  it('건강한 각성 상태·피로/수면 부채·소속 지역으로 계획을 제한한다', () => {
    const { w, doctor } = setup(); expect(residentRestGoal(w, doctor)).toBeNull(); doctor.needs.sleepDebt = 1; expect(residentRestGoal(w, doctor)).not.toBeNull()
    doctor.needs.bodyTemp = 34.9; expect(residentRestGoal(w, doctor)).toBeNull(); doctor.needs.bodyTemp = 37; doctor.residentSite = 'elsewhere'; expect(residentRestGoal(w, doctor)).toBeNull()
  })
  it('경비도 자기 침대를 찾고, 보이는 적 앞에서는 의사도 잠들지 않고 피한다', () => {
    const { w, doctor, bed } = setup(), guard = w.s.creatures.find((c) => c.def.includes('Guard'))!; guard.needs.fatigue = 80
    expect(residentRestGoal(w, guard)).not.toBeNull(); expect(aiDecide(w, guard).type).toBe('move')
    doctor.pos = { ...bed.pos }; doctor.needs.fatigue = 80; const enemy = createCreature(w, 'Creature.Reaver', { x: bed.pos.x + 1, y: bed.pos.y }); w.s.creatures.push(enemy)
    expect(canSee(w, doctor, enemy.pos)).toBe(true); expect(aiDecide(w, doctor).type).toBe('move'); expect(doctor.asleep).not.toBe(true)
  })
  it('다른 창조물과 물건을 덮어쓰지 않고 죽은 주민을 부활시키지 않는다', () => {
    const { w, doctor, site } = setup(); doctor.alive = false; w.s.map.residentRestInitialized = undefined; w.s.map.residentBeds = []
    for (let y = 12; y <= 25; y++) for (let x = 24; x <= 42; x++) tileAt(w, { x, y }).t = 'Terrain.KtWall'
    initializeResidentRest(w, site); expect(w.s.map.residentBeds).toEqual([]); expect(doctor.alive).toBe(false); expect(w.s.map.residentRestInitialized).toBe(true)
  })
  it('침대로 이동 중/수면 중 각인은 실제 위치·목표·몸을 같은 결과로 잇는다', () => {
    const { w, doctor } = setup(); doctor.needs.fatigue = 80; wait(w, 1); const copy = { db, s: deserialize(serialize(w.s)) }
    wait(w, 8); wait(copy, 8); expect(stateHash(copy.s)).toBe(stateHash(w.s)); const sleeping = { db, s: deserialize(serialize(w.s)) }; wait(w, 5); wait(sleeping, 5); expect(stateHash(sleeping.s)).toBe(stateHash(w.s))
  })
})

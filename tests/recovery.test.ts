import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { addWound, bodyTick, capacity, healFracture, painTotal, partEff } from '../src/core/body'
import { wake } from '../src/core/combat'
import { frostbiteTick } from '../src/core/conditions'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { createCreature } from '../src/core/creatures'
import { changeMap } from '../src/core/game'
import { invalidateLights } from '../src/core/fov'
import { chronicPain, completeHealing, recoveryLines, tourniquetNerves } from '../src/core/recovery'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { activeThoughts } from '../src/core/thoughts'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('recovery', 'Bg.Excommunicate'), pl = player(w)
  pl.age = undefined; pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.traits = []; pl.background = undefined; pl.abilities = []; pl.equip = {}; pl.bag = []; pl.body.wounds = []; pl.effects = []; pl.needs.fatigue = 20; pl.needs.bodyTemp = 37; pl.hp = 100
  w.s.creatures = [pl]; w.s.map.lights = []; w.s.wind = { x: 0, y: 0 }; w.s.weather = 'clear'; w.s.time = 12 * TURNS_PER_HOUR * 100
  pl.pos = { x: 20, y: 20 }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  invalidateLights(w); return { w, pl }
}
function wound(w: ReturnType<typeof makeWorld>, part = 'LeftForearm', severity = 3, def = 'Wound.Cut') {
  return addWound(w, player(w), { def, part, severity, source: '검증' }).wound
}

describe('치유 후 흉터·구축·힘줄', () => {
  it('실제 신체 틱이 치유를 마치면 열린 상처를 지우고 소작 흉터를 보존한다', () => {
    const { w, pl } = setup(), wd = wound(w); wd.scar = true; wd.healed = wd.severity - 1e-7
    bodyTick(w, pl, false)
    expect(pl.body.wounds).toEqual([]); expect(pl.body.scars).toHaveLength(1); expect(pl.body.scars![0].part).toBe(wd.part)
    expect(recoveryLines(w, pl).join(' ')).toContain('흉터')
    const before = stateHash(w.s); completeHealing(w, pl); expect(stateHash(w.s)).toBe(before)
  })
  it('치료 Q를 반영해 흉터 판정하며 내출혈은 외부 흉터를 만들지 않는다', () => {
    for (const [quality, scars] of [[0, 1], [100, 0]]) {
      const { w, pl } = setup(), wd = wound(w); wd.healed = wd.severity; wd.bandage = { quality, at: turnOf(w) }; w.s.rng.body = [0, 0, 0, 858993459]
      completeHealing(w, pl); expect(pl.body.scars?.length ?? 0).toBe(scars)
    }
    const { w, pl } = setup(), hidden = wound(w, 'LeftLung', 3, 'Wound.InternalBleed'); hidden.healed = hidden.severity; hidden.scar = true
    completeHealing(w, pl); expect(pl.body.scars).toBeUndefined()
  })
  it('같은 부위 새 상처의 통증 전체는0.8배이며 다른 부위는 그대로다', () => {
    const { w, pl } = setup(), wd = wound(w); wd.fracture = { grade: 'simple', progress: 0 }; wd.infection = { progress: 20, immunity: 0 }
    const base = painTotal(w, pl); pl.body.scars = [{ part: wd.part, severity: 2, cap: 1, burn: false, at: 0, source: '옛 상처' }]
    expect(painTotal(w, pl)).toBeCloseTo(base * .8)
    pl.body.scars[0].part = 'RightForearm'; expect(painTotal(w, pl)).toBe(base)
  })
  it('큰 관절 흉터는95%, 관절 화상은85% 상한이고 같은 부위는 강한 후유증을 유지한다', () => {
    const { w, pl } = setup(), cut = wound(w, 'LeftHand', pl.body.maxHp.LeftHand / 2); cut.healed = cut.severity; cut.scar = true
    completeHealing(w, pl); expect(partEff(w, pl, 'LeftHand')).toBe(.95)
    const burn = wound(w, 'LeftHand', 1, 'Wound.Burn'); burn.healed = 1
    completeHealing(w, pl); expect(pl.body.scars).toHaveLength(1); expect(partEff(w, pl, 'LeftHand')).toBe(.85); expect(pl.body.scars![0].burn).toBe(true)
  })
  it('힘줄은 피부가 아문 뒤에도50% 상한이 남고 중간 저장에도 보존된다', () => {
    const { w, pl } = setup(), wd = wound(w); wd.tendon = true; wd.healed = wd.severity; completeHealing(w, pl)
    expect(pl.body.wounds).toEqual([]); expect(pl.body.damagedTendons).toContain(wd.part); expect(partEff(w, pl, wd.part)).toBe(.5)
    const copy = { db, s: deserialize(serialize(w.s)) }; expect(partEff(copy, player(copy), wd.part)).toBe(.5)
  })
  it('얼굴 흉터는 상처를 지운 뒤에도 허영의 기분을 내린다', () => {
    const { w, pl } = setup(), wd = wound(w, 'Skull', 2); pl.traits = ['Trait.Vain']; wd.scar = true; wd.healed = 2; completeHealing(w, pl)
    expect(pl.body.wounds).toEqual([]); expect(activeThoughts(w, pl).find((t) => t.def === 'Thought.Scar')?.mood).toBe(-10)
  })
})

describe('만성 통증·환경·신경 손상', () => {
  it('심각한 상처/부정유합 치유의20% 판정으로 만성 통증이 한 번만 남는다', () => {
    const { w, pl } = setup(), wd = wound(w, 'LeftForearm', pl.body.maxHp.LeftForearm / 2); wd.healed = wd.severity; w.s.rng.body = [0, 0, 0, 1]
    completeHealing(w, pl); expect(pl.body.chronicPain).toEqual(['LeftForearm'])
    const again = wound(w, 'LeftForearm', pl.body.maxHp.LeftForearm / 2); again.healed = again.severity; w.s.rng.body = [0, 0, 0, 1]
    completeHealing(w, pl); expect(pl.body.chronicPain).toHaveLength(1)
  })
  it('추위·재비·기상1시간을 같은 상태 캐시에서도 정확히 반영한다', () => {
    const { w, pl } = setup(); pl.body.chronicPain = ['LeftHand']
    expect(chronicPain(w, pl)).toBe(5); expect(painTotal(w, pl)).toBe(5)
    w.s.time = 0; expect(painTotal(w, pl)).toBe(10)
    w.s.weather = 'ashrain'; expect(painTotal(w, pl)).toBe(15)
    pl.asleep = true; wake(w, pl, '검증'); expect(painTotal(w, pl)).toBe(20)
    w.s.time = TURNS_PER_HOUR * 100; expect(painTotal(w, pl)).toBe(15)
    const copy = { db, s: deserialize(serialize(w.s)) }; expect(painTotal(copy, player(copy))).toBe(painTotal(w, pl))
  })
  it('지혈대2시간까지 안전하고3시간의 신경 손상10%는 제거 후에도 남는다', () => {
    const { w, pl } = setup(), now = turnOf(w), limb = 'LeftUpperArm'
    pl.body.tourniquets[limb] = now - 2 * TURNS_PER_HOUR; tourniquetNerves(w, pl, limb, pl.body.tourniquets[limb]); expect(pl.body.nerveDamage).toBeUndefined()
    pl.body.tourniquets[limb] -= TURNS_PER_HOUR; tourniquetNerves(w, pl, limb, pl.body.tourniquets[limb]); expect(pl.body.nerveDamage![limb]).toBeCloseTo(.1)
    const hash = stateHash(w.s); tourniquetNerves(w, pl, limb, pl.body.tourniquets[limb]); expect(stateHash(w.s)).toBe(hash)
    expect(perform(w, pl, { type: 'removeTourniquet', limb }).ok).toBe(true)
    expect(partEff(w, pl, 'LeftHand')).toBeCloseTo(.9); expect(capacity(w, pl, 'manipulation')).toBeCloseTo(.96)
    expect(pl.body.nerveClock![limb]).toBeUndefined(); expect(pl.body.nerveDamage![limb]).toBeCloseTo(.1)
  })
  it('다시 감은 지혈대도 이전 신경 손상을 지우지 않는다', () => {
    const { w, pl } = setup(), limb = 'LeftUpperArm', now = turnOf(w); pl.body.nerveDamage = { [limb]: .1 }
    tourniquetNerves(w, pl, limb, now - 3 * TURNS_PER_HOUR); expect(pl.body.nerveDamage[limb]).toBeCloseTo(.2)
    const copy = { db, s: deserialize(serialize(w.s)) }
    for (const ww of [w, copy]) { ww.s.time += 100; tourniquetNerves(ww, player(ww), limb, now - 3 * TURNS_PER_HOUR) }
    expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('손의 신경 손상은 그 손 손가락 동상 노출만1.5배로 만든다', () => {
    const normal = setup(), damaged = setup(); damaged.pl.body.nerveDamage = { LeftUpperArm: .1 }
    for (const { w } of [normal, damaged]) { w.s.time = 0; w.s.weather = 'ashrain'; w.s.wind = { x: 6, y: 0 }; frostbiteTick(w, player(w)) }
    const a = normal.pl.frostbite!, b = damaged.pl.frostbite!
    expect(a.LeftIndex.exposure).toBeGreaterThan(0); expect(b.LeftIndex.exposure).toBeCloseTo(a.LeftIndex.exposure * 1.5); expect(b.RightIndex.exposure).toBe(a.RightIndex.exposure)
  })
})

describe('미활성 치유·기존 저장', () => {
  it('상처 연조직이 아물어도 골절이 붙기 전에는 남고 일괄 뼈 치유는100%를 넘지 않는다', () => {
    const { w, pl } = setup(), wd = wound(w); wd.healed = wd.severity; wd.fracture = { grade: 'simple', progress: 0 }
    completeHealing(w, pl); expect(pl.body.wounds).toContain(wd)
    healFracture(wd, 100 * TURNS_PER_DAY); expect(wd.fracture.progress).toBe(1); completeHealing(w, pl); expect(pl.body.wounds).toEqual([])
  })
  it('미활성 지역 재진입 치유도 흉터를 남기고 저장을 거쳐도 한 번만 처리한다', () => {
    const { w } = setup(); changeMap(w, 'crypt1'); const npc = createCreature(w, 'Creature.Reaver', { ...player(w).pos }); w.s.creatures.push(npc)
    const wd = addWound(w, npc, { def: 'Wound.Bruise', part: 'LeftForearm', severity: 2, source: '검증' }).wound; wd.scar = true; wd.bleed = 0
    changeMap(w, 'surface'); w.s.time += 3 * TURNS_PER_DAY * 100
    const copy = { db, s: deserialize(serialize(w.s)) }
    for (const ww of [w, copy]) changeMap(ww, 'crypt1')
    const healed = w.s.creatures.find((c) => c.id === npc.id)!; expect(healed.body.wounds).toEqual([]); expect(healed.body.scars).toHaveLength(1); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
})

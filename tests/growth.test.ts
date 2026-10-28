import { describe, expect, it } from 'vitest'
import { bodyTick, capacity, hpMax, painTotal } from '../src/core/body'
import { player, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { rollStats } from '../src/core/creatures'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
import { newGame } from '../src/core/game'
import { ageBand, growthTick, initializeAge, regenerationPeriod, willForChecks } from '../src/core/growth'
import { needsTick } from '../src/core/needs'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { masteryNext, masteryStage, masterySteps, setMasteryStage, studyBook } from '../src/core/skills'
import { traitMul } from '../src/core/traits'
import type { BackgroundDef, Stats } from '../src/core/types'
import { db, makeWorld } from './helpers'

function setup(years = 30) {
  const w = makeWorld('growth', 'Bg.Excommunicate'), pl = player(w)
  pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.traits = []; pl.abilities = []; pl.background = undefined; pl.equip = {}; pl.bag = []; pl.body.wounds = []; pl.effects = []; pl.needs.energy = 0; pl.hp = hpMax(w, pl); pl.needs.bodyTemp = 37
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.time = 12 * TURNS_PER_HOUR * 100; initializeAge(w, pl, years)
  return { w, pl }
}

describe('초기 능력치·배경·재굴림', () => {
  it('6회 양도는 합50·7~13이고 양도 총량을 넘지 않는다', () => {
    const { w } = setup()
    for (let i = 0; i < 300; i++) {
      const stats = rollStats(w), values = Object.values(stats)
      expect(values.reduce((a, b) => a + b, 0)).toBe(50)
      expect(values.every((n) => n >= 7 && n <= 13)).toBe(true)
      expect(values.reduce((n, x) => n + Math.abs(x - 10), 0)).toBeLessThanOrEqual(12)
    }
  })
  it('모든 배경은 합0 보정·나이 범위·유효 숙달·상충 없는 특성을 지닌다', () => {
    for (const bg of db.all<BackgroundDef>('Background')) for (let i = 0; i < 12; i++) {
      const s = newGame(db, { seed: `create-${i}`, background: bg.id }), pl = player({ db, s })
      expect(Object.values(pl.stats).reduce((a, b) => a + b, 0)).toBe(50)
      for (const key of Object.keys(pl.stats) as (keyof Stats)[]) { expect(pl.stats[key] - (bg.stats?.[key] ?? 0)).toBeGreaterThanOrEqual(7); expect(pl.stats[key] - (bg.stats?.[key] ?? 0)).toBeLessThanOrEqual(13) }
      expect(pl.age!.years).toBeGreaterThanOrEqual(bg.ageRange![0]); expect(pl.age!.years).toBeLessThanOrEqual(bg.ageRange![1])
      for (const [k, stage] of Object.entries(bg.mastery ?? {})) expect(masteryStage({ db, s }, pl, k as 'medicine' | 'survival')).toBe(stage)
      for (const id of pl.traits) expect(pl.traits.some((t) => db.trait(id).conflicts?.includes(t))).toBe(false)
    }
  })
  it('구형 모드의 absolute stats는 delta로 오해하지 않고 기존값을 유지한다', () => {
    const loaded = loadMods([...readPackages(), { manifest: { id: 'legacy.creation', name: 'legacy', version: '1' }, defs: [], patches: [
      { op: 'remove', target: 'Bg.Hunter', path: '/statMode' },
      { op: 'remove', target: 'Bg.Hunter', path: '/ageRange' },
      { op: 'replace', target: 'Bg.Hunter', path: '/stats', value: { per: 13, agi: 11 } },
    ] }], ['legacy.creation'])
    expect(loaded.report.errors).toEqual([])
    const s = newGame(loaded.db, { seed: 'legacy', background: 'Bg.Hunter' }), pl = player({ db: loaded.db, s })
    expect(pl.stats).toEqual({ str: 10, agi: 11, per: 13, vit: 10, wil: 10 }); expect(pl.age!.years).toBeGreaterThanOrEqual(20); expect(pl.age!.years).toBeLessThan(40)
  })
  it('기본·1회 특성 재굴림이 재현되고 능력치·나이는 유지한다', () => {
    const a = newGame(db, { seed: 'reroll', background: 'Bg.Hunter' }), b = newGame(db, { seed: 'reroll', background: 'Bg.Hunter', characterRoll: 1 })
    expect(stateHash(a)).toBe(stateHash(newGame(db, { seed: 'reroll', background: 'Bg.Hunter' })))
    expect(stateHash(b)).toBe(stateHash(newGame(db, { seed: 'reroll', background: 'Bg.Hunter', characterRoll: 1 })))
    expect(player({ db, s: b }).creationRoll).toBe(1)
    expect(player({ db, s: a }).stats).toEqual(player({ db, s: b }).stats)
    expect(player({ db, s: a }).age).toEqual(player({ db, s: b }).age)
    expect(player({ db, s: a }).traits).not.toEqual(player({ db, s: b }).traits)
    expect(Object.values(player({ db, s: b }).stats).reduce((a, b) => a + b, 0)).toBe(50)
  })
})

describe('나이·노화·저장', () => {
  it('19세 회복9턴·30세10턴이며 실제 HP 재생도 다르다', () => {
    const young = setup(19), adult = setup(30)
    expect(regenerationPeriod(young.w, young.pl)).toBe(9); expect(regenerationPeriod(adult.w, adult.pl)).toBe(10)
    for (const { w, pl } of [young, adult]) { pl.hp -= 10; bodyTick(w, pl, false) }
    expect(young.pl.hp).toBeGreaterThan(adult.pl.hp)
  })
  it('40/55/65세 면역0.9/0.8/0.8과 기력1/0.9/0.8을 적용한다', () => {
    for (const [years, immunity, energy] of [[40, .9, 4], [55, .8, 3.6], [65, .8, 3.2]]) {
      const { w, pl } = setup(years)
      expect(traitMul(w, pl, 'immunityMult')).toBe(immunity); needsTick(w, pl, false); expect(pl.needs.energy).toBeCloseTo(energy)
    }
  })
  it('노련함 문턱4/12/24/40/64와 책 상한12는 실제 성공 횟수를 깎지 않는다', () => {
    const { w, pl } = setup(40); pl.skills.medicine = 12
    expect(masterySteps(w, pl)).toEqual([4, 12, 24, 40, 64]); expect(masteryStage(w, pl, 'medicine')).toBe(2); expect(masteryNext(w, pl, 'medicine')).toBe(24)
    expect(studyBook(w, pl, 'Item.MedicalGuide')).toBe(5); expect(studyBook(w, pl, 'Item.FieldManual')).toBe(7); expect(studyBook(w, pl, 'Item.WardRecords')).toBe(0)
    expect(pl.skills.medicine).toBe(24); expect(pl.bookMastery?.medicine).toBe(12)
    setMasteryStage(w, pl, 'survival', 1); expect(pl.skills.survival).toBe(4)
  })
  it('40세 의지 판정은+2지만 저장 능력치와 최대 기력은 바꾸지 않는다', () => {
    const { w, pl } = setup(40)
    expect(willForChecks(w, pl)).toBe(12); expect(pl.stats.wil).toBe(10); expect(ageBand(w, 39).willBonus).toBe(0)
  })
  it('90일 생일 경계에서 한 번만 나이를 더하고 다음 생일을 저장한다', () => {
    const { w, pl } = setup(39), birthday = pl.age!.nextBirthday
    w.s.time = (birthday - 1) * 100; growthTick(w, pl); expect(pl.age!.years).toBe(39)
    w.s.time += 100; w.s.rng.body = [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]; growthTick(w, pl); expect(pl.age!.years).toBe(40); expect(pl.age!.masteryMult).toBe(.8)
    const state = [...w.s.rng.body]; growthTick(w, pl); expect(pl.age!.years).toBe(40); expect(w.s.rng.body).toEqual(state)
    expect(pl.age!.nextBirthday).toBe(birthday + 90 * TURNS_PER_DAY)
  })
  it('60세 생일의 능력 저하·관절통·감각 상한이 실제 몸에 반영된다', () => {
    const { w, pl } = setup(59); w.s.time = pl.age!.nextBirthday * 100; w.s.rng.body = [0, 0, 0, 1]
    growthTick(w, pl); expect(pl.stats.str).toBe(9); expect(pl.age!.jointPain).toBe(true); expect(pl.age!.senses).toBe(true)
    expect(painTotal(w, pl)).toBe(5); expect(capacity(w, pl, 'sight')).toBeLessThanOrEqual(.9); expect(capacity(w, pl, 'hearing')).toBe(.9)
  })
  it('여러 해를 건너뛰어도 생일을 빠뜨리지 않고 중간 저장 이후 같은 결과다', () => {
    const { w, pl } = setup(58), restored = { db, s: deserialize(serialize(w.s)) }
    for (const ww of [w, restored]) { ww.s.time = (player(ww).age!.nextBirthday + 2 * 90 * TURNS_PER_DAY) * 100; growthTick(ww, player(ww)) }
    expect(pl.age!.years).toBe(61); expect(pl.history.filter((h) => h.kind === 'birthday')).toHaveLength(3); expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('나이가 없는 기존 저장은 기본 몸·숙달을 유지하고 임의 생일 판정을 하지 않는다', () => {
    const { w, pl } = setup(); pl.age = undefined; const before = stateHash(w.s)
    growthTick(w, pl); expect(stateHash(w.s)).toBe(before); expect(regenerationPeriod(w, pl)).toBe(10); expect(masterySteps(w, pl)[0]).toBe(5)
    expect(turnOf(w)).toBe(12 * TURNS_PER_HOUR)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { addWound, hpMax } from '../src/core/body'
import { killCreature, previewHit, resolveAttack } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { fearActive, fearFamily, traumaHit, traumaMorale } from '../src/core/fear-state'
import { invalidateLights } from '../src/core/fov'
import { makeItem, addToBag } from '../src/core/items'
import { moraleOf } from '../src/core/morale'
import { awardDefeat } from '../src/core/progression'
import { startBreakdown } from '../src/core/psyche'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { activeThoughts, addThought } from '../src/core/thoughts'
import { gainTrauma, overcome, traumaChance, traumaEngage, traumaHandleFire, traumaMeat, traumaMove, traumaTick, traumaTreat, traumaVictory } from '../src/core/trauma'
import type { BreakDef, Creature, ThoughtDef, Trauma } from '../src/core/types'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('psyche-020', 'Bg.Excommunicate'), pl = player(w)
  pl.age = undefined; pl.pos = { x: 20, y: 20 }; pl.traits = []; pl.background = undefined; pl.abilities = []; pl.equip = {}; pl.bag = []; pl.thoughts = []; pl.hp = hpMax(w, pl); pl.needs.stress = 0
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.map.lights = []; w.s.time = 12 * TURNS_PER_HOUR * 100
  for (let y = 14; y <= 26; y++) for (let x = 14; x <= 26; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  invalidateLights(w)
  return { w, pl }
}
function foe(w: ReturnType<typeof makeWorld>, def = 'Creature.Reaver') { const c = createCreature(w, def, { x: 21, y: 20 }); w.s.creatures.push(c); return c }
function thought(w: ReturnType<typeof makeWorld>, c: Creature, def: string) { return activeThoughts(w, c).find((t) => t.def === def) }
function setTurn(w: ReturnType<typeof makeWorld>, turn: number) { w.s.time = turn * 100; invalidateLights(w) }
function fear(w: ReturnType<typeof makeWorld>, c: Creature, kind: string, target?: string): Trauma { return gainTrauma(w, c, `Trauma.${kind}`, target)! }

describe('사고 감쇠·중첩·그룹', () => {
  it('각 살인 기억은 자기 만료 시각을 지니고 최신 것부터 ×0.5로 중첩한다', () => {
    const { w, pl } = setup(), now = turnOf(w)
    addThought(w, pl, 'Thought.KilledHuman'); setTurn(w, now + TURNS_PER_DAY)
    addThought(w, pl, 'Thought.KilledHuman'); expect(thought(w, pl, 'Thought.KilledHuman')!.mood).toBe(-6)
    expect(pl.thoughts[0].events).toHaveLength(2)
    setTurn(w, now + 3 * TURNS_PER_DAY)
    expect(thought(w, pl, 'Thought.KilledHuman')!.count).toBe(1)
    expect(thought(w, pl, 'Thought.KilledHuman')!.mood).toBe(-4)
    setTurn(w, now + 4 * TURNS_PER_DAY); expect(thought(w, pl, 'Thought.KilledHuman')).toBeUndefined()
  })
  it('음수 선형 감쇠는 0쪽으로 버리며 단계 감쇠는 표의 경계에서 바뀐다', () => {
    const { w, pl } = setup(), now = turnOf(w)
    addThought(w, pl, 'Thought.FirstHumanKill'); addThought(w, pl, 'Thought.NearDeath')
    setTurn(w, now + 57600 - 1); expect(thought(w, pl, 'Thought.NearDeath')!.mood).toBe(-12)
    setTurn(w, now + 57600); expect(thought(w, pl, 'Thought.NearDeath')!.mood).toBe(-6)
    setTurn(w, now + 288000 - 1); expect(thought(w, pl, 'Thought.FirstHumanKill')!.mood).toBe(0)
  })
  it('최대 중첩을 지키고 실제 moodOverride를 보존하며 같은 그룹은 강한 값만 적용한다', () => {
    const { w, pl } = setup(); pl.needs.bodyTemp = 33
    pl.thoughts.push({ def: 'Thought.Cold', untilTurn: turnOf(w) + 100, count: 1 })
    expect(activeThoughts(w, pl).filter((t) => ['Thought.Cold', 'Thought.Freezing'].includes(t.def))).toHaveLength(1)
    for (let i = 0; i < 8; i++) addThought(w, pl, 'Thought.KilledHuman', -8)
    expect(pl.thoughts.find((t) => t.def === 'Thought.KilledHuman')!.count).toBe(5)
    expect(thought(w, pl, 'Thought.KilledHuman')!.mood).toBe(-15)
    addThought(w, pl, 'Thought.FirstHumanKill', 0); expect(thought(w, pl, 'Thought.FirstHumanKill')).toBeUndefined()
  })
  it('옛 count 저장은 읽기만으로 변형하지 않고 올바르게 중첩한다', () => {
    const { w, pl } = setup(); pl.thoughts = [{ def: 'Thought.KilledHuman', untilTurn: turnOf(w) + 100, count: 3 }]
    const before = JSON.stringify(pl.thoughts)
    expect(thought(w, pl, 'Thought.KilledHuman')!.mood).toBe(-7); expect(JSON.stringify(pl.thoughts)).toBe(before)
    addThought(w, pl, 'Thought.KilledHuman'); expect(pl.thoughts[0].events).toHaveLength(4)
  })
  it('첫 살인은 생애 한 번만 생성하고 냉혈은 사고를 막는다', () => {
    const { w, pl } = setup()
    for (let i = 0; i < 2; i++) { const c = foe(w); c.lastAttacker = pl.name; killCreature(w, c, '검증') }
    expect(pl.firstHumanKill).toBe(true); expect(pl.thoughts.find((t) => t.def === 'Thought.FirstHumanKill')!.count).toBe(1)
    pl.thoughts = []; pl.firstHumanKill = false; pl.traits = ['Trait.ColdBlooded']
    const c = foe(w); c.lastAttacker = pl.name; killCreature(w, c, '검증'); expect(pl.thoughts).toEqual([])
  })
})

describe('트라우마 획득·노출', () => {
  it('확률 검산 S60 의지12는54%, 특성 배율 뒤5~90% 제한', () => {
    expect(traumaChance(60, 12)).toBe(54); expect(traumaChance(60, 12, .5)).toBe(27); expect(traumaChance(100, 1, 1.5)).toBe(90); expect(traumaChance(0, 100)).toBe(5)
  })
  it('실혈40% 위기를 처음 넘을 때만 사고·스트레스·공포를 얻고 즉사에는 생성하지 않는다', () => {
    const { w, pl } = setup(), c = foe(w)
    addWound(w, pl, { def: 'Wound.Cut', part: 'LeftForearm', severity: 5, source: c.name, sourceId: c.id })
    pl.body.blood = pl.body.bloodMax * .59; w.s.rng.body = [0, 0, 0, 1]
    traumaTick(w, pl); expect(pl.needs.stress).toBe(22); expect(pl.traumas?.[0].target).toBe(fearFamily(w, c)); expect(thought(w, pl, 'Thought.NearDeath')).toBeDefined()
    traumaTick(w, pl); expect(pl.thoughts.find((t) => t.def === 'Thought.NearDeath')!.count).toBe(1)
    const fresh = setup(); fresh.pl.hp = 0; fresh.pl.body.blood = fresh.pl.body.bloodMax * .4
    traumaTick(fresh.w, fresh.pl); expect(fresh.pl.thoughts).toEqual([]); expect(fresh.pl.traumas).toBeUndefined()
  })
  it('불·물·칠흑도 실제 위기 원인으로 선택한다', () => {
    for (const kind of ['Fire', 'Water', 'Dark']) {
      const { w, pl } = setup(); pl.needs.bodyTemp = 31
      if (kind === 'Fire') addWound(w, pl, { def: 'Wound.Burn', part: 'LeftHand', severity: 3, source: '불' })
      if (kind === 'Water') tileAt(w, pl.pos).t = 'Terrain.ShallowWater'
      if (kind === 'Dark') { w.s.map.kind = 'dungeon'; invalidateLights(w) }
      w.s.rng.body = [0, 0, 0, 1]; traumaTick(w, pl); expect(pl.traumas?.[0].def).toBe(`Trauma.${kind}`)
    }
  })
  it('시야·벽·각성에 따라 공포 사고, 명중−5, 사기−10이 적용된다', () => {
    const { w, pl } = setup(), c = foe(w), normal = moraleOf(w, pl), t = fear(w, pl, 'Species', fearFamily(w, c))
    expect(fearActive(w, pl, t)).toBe(true); expect(traumaHit(w, pl, c)).toBe(-5); expect(moraleOf(w, pl)).toBe(normal - 10)
    expect(thought(w, pl, t.def)!.mood).toBe(-8)
    c.pos.x = 22; tileAt(w, { x: 21, y: 20 }).t = 'Terrain.RuinWall'; invalidateLights(w)
    expect(fearActive(w, pl, t)).toBe(false); expect(traumaHit(w, pl, c)).toBe(0)
    pl.unconscious = true; expect(fearActive(w, pl, t)).toBe(false)
  })
  it('심화 공황은 다시 보이는 순간3배 판정, 지속 노출은10턴당 스트레스2', () => {
    const { w, pl } = setup(), c = foe(w), t = fear(w, pl, 'Species', c.def); t.overcome = -50
    const now = turnOf(w); setTurn(w, now + 1); expect(traumaTick(w, pl)).toBe(3); expect(pl.needs.stress).toBe(5)
    expect(traumaTick(w, pl)).toBe(0); setTurn(w, now + 10); traumaTick(w, pl); expect(pl.needs.stress).toBe(7)
    c.pos.x = 26; tileAt(w, { x: 21, y: 20 }).t = 'Terrain.RuinWall'; invalidateLights(w); traumaTick(w, pl)
    tileAt(w, { x: 21, y: 20 }).t = 'Terrain.Earth'; c.pos.x = 21; invalidateLights(w); expect(traumaTick(w, pl)).toBe(3)
  })
  it('불 공포는 소작을 거부하고 하루 한 번만 불 다루기 점수를 준다', () => {
    const { w, pl } = setup(), t = fear(w, pl, 'Fire')
    expect(perform(w, pl, { type: 'cauterize', woundId: -1 })).toMatchObject({ ok: false, msg: expect.stringContaining('불 공포') })
    w.s.map.lights = [{ pos: { ...pl.pos }, radius: 3, kind: 'campfire', off: true }]
    expect(perform(w, pl, { type: 'toggleFire' }).ok).toBe(true); expect(t.overcome).toBe(5)
    traumaHandleFire(w, pl); expect(t.overcome).toBe(5)
    setTurn(w, turnOf(w) + TURNS_PER_DAY); traumaHandleFire(w, pl); expect(t.overcome).toBe(10)
  })
  it('물 공포는 진입 즉시 판정을 요청하고 같은 기슭 왕복에는 점수가 없다', () => {
    const { w, pl } = setup(), t = fear(w, pl, 'Water'); tileAt(w, { x: 21, y: 20 }).t = 'Terrain.ShallowWater'
    const from = { ...pl.pos }; pl.pos = { x: 21, y: 20 }; traumaMove(w, pl, from); expect(traumaTick(w, pl)).toBe(2)
    pl.pos = from; traumaMove(w, pl, { x: 21, y: 20 }); expect(t.overcome).toBe(0)
    pl.pos = { x: 21, y: 20 }; traumaMove(w, pl, from); pl.pos = { x: 22, y: 20 }; traumaMove(w, pl, { x: 21, y: 20 }); expect(t.overcome).toBe(20)
    const terrain = w.db.terrain.bind(w.db)
    const stub = vi.spyOn(w.db, 'terrain').mockImplementation((id) => id === 'Terrain.ShallowWater' ? { ...terrain(id), water: 'deep' } : terrain(id))
    tileAt(w, { x: 23, y: 20 }).t = 'Terrain.ShallowWater'
    try { expect(perform(w, pl, { type: 'move', dir: 2 })).toMatchObject({ ok: false, msg: expect.stringContaining('물 공포') }) } finally { stub.mockRestore() }
  })
  it('칠흑 한 시간은 연속 노출이어야 하며 수면으로 극복하지 못한다', () => {
    const { w, pl } = setup(), t = fear(w, pl, 'Dark'); w.s.map.kind = 'dungeon'; invalidateLights(w)
    const now = turnOf(w); traumaTick(w, pl); setTurn(w, now + TURNS_PER_HOUR); traumaTick(w, pl); expect(t.overcome).toBe(15)
    pl.asleep = true; traumaTick(w, pl); setTurn(w, now + 2 * TURNS_PER_HOUR); traumaTick(w, pl); expect(t.overcome).toBe(15)
  })
  it('피 공포는 동일 상처를 재판정하지 않으며 실제 자기 처치 한 번에+10', () => {
    const { w, pl } = setup(), t = fear(w, pl, 'Blood')
    const { wound: wd } = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftForearm', severity: 3, source: '검증' })
    w.s.rng.body = [0, 0, 0, 1]; traumaTick(w, pl); expect(pl.unconscious).toBe(true)
    pl.unconscious = false; pl.cond = {}; const before = [...w.s.rng.body]; traumaTick(w, pl); expect(pl.unconscious).toBe(false); expect(w.s.rng.body).toEqual(before)
    const bandage = makeItem(w, 'Item.Bandage'); addToBag(w, pl, bandage)
    const result = perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: wd.id }); expect(result.msg).toBeUndefined(); expect(result.ok).toBe(true)
    for (let i = 0; pl.activity && i < 100; i++) activityStep(w, pl)
    expect(t.overcome).toBe(10); traumaTreat(w, pl, wd.id); expect(t.overcome).toBe(10)
  })
})

describe('교전 극복·변환·저장', () => {
  it('실제 공격은 교전을 기록하고 마무리35점, 격퇴25점은 중복하지 않는다', () => {
    const { w, pl } = setup(), c = foe(w), t = fear(w, pl, 'Species', c.def)
    const before = previewHit(w, pl, c)!
    expect(before.lines.some((line) => line.includes('공포·극복 -5'))).toBe(true)
    resolveAttack(w, pl, c); expect(t.encounters?.[c.id]).toBeDefined()
    c.lastAttacker = pl.name; killCreature(w, c, '검증'); expect(t.overcome).toBe(35)
    awardDefeat(w, pl, c, 1, '중복'); expect(t.overcome).toBe(35)
    const d = foe(w); traumaEngage(w, pl, d); awardDefeat(w, pl, d, .5, '격퇴'); expect(t.overcome).toBe(60)
    d.lastAttacker = pl.name; killCreature(w, d, '중복'); expect(t.overcome).toBe(60)
  })
  it('위협 절반 미만 상대나 붕괴한 교전은 극복에 기여하지 않는다', () => {
    const { w, pl } = setup(), c = foe(w), t = fear(w, pl, 'Species', c.def)
    c.hp = 1; traumaEngage(w, pl, c); traumaVictory(w, pl, c, true); expect(t.overcome).toBe(0)
    const d = foe(w); traumaEngage(w, pl, d); startBreakdown(w, pl, db.get<BreakDef>('Break.Cry')); expect(t.overcome).toBe(-20)
    traumaVictory(w, pl, d, true); expect(t.overcome).toBe(-20)
  })
  it('극복100은 제거되고 변환 성공 시 종족 한정 명중·사기·수율을 얻는다', () => {
    const { w, pl } = setup(), c = foe(w), t = fear(w, pl, 'Species', c.def)
    pl.stats.wil = 20; w.s.rng.body = [0, 0, 0, 1]; t.overcome = 90; overcome(w, pl, t, 10, '검증')
    expect(pl.traumas).toEqual([]); expect(pl.traits).toContain('Trait.HunterOf'); expect(traumaHit(w, pl, c)).toBe(10); expect(traumaMorale(w, pl)).toBe(10)
    const meat = Array.from({ length: 5 }, () => traumaMeat(w, pl, c, 3)).reduce((a, b) => a + b, 0); expect(meat).toBe(18)
    expect(traumaMeat(w, pl, { ...c, def: 'Creature.BurrowRat' }, 3)).toBe(3)
  })
  it('자기 이동으로 교전 상대가 시야에서 멀어지면 한 번만 도주−10을 받는다', () => {
    const { w, pl } = setup(), c = foe(w), t = fear(w, pl, 'Species', c.def)
    traumaEngage(w, pl, c); traumaTick(w, pl)
    pl.pos = { x: 19, y: 20 }; pl.movedTurn = turnOf(w); tileAt(w, { x: 20, y: 20 }).t = 'Terrain.RuinWall'; invalidateLights(w)
    traumaTick(w, pl); expect(t.overcome).toBe(-10)
    traumaTick(w, pl); expect(t.overcome).toBe(-10)
  })
  it('같은 턴 중복 노출은 스트레스를 더하지 않고 재등장은 첫 목격 가산을 반복하지 않는다', () => {
    const { w, pl } = setup(), c = foe(w); fear(w, pl, 'Species', c.def)
    traumaTick(w, pl); const stress = pl.needs.stress; traumaTick(w, pl); expect(pl.needs.stress).toBe(stress)
    tileAt(w, { x: 21, y: 20 }).t = 'Terrain.RuinWall'; c.pos.x = 22; invalidateLights(w); traumaTick(w, pl)
    tileAt(w, { x: 21, y: 20 }).t = 'Terrain.Earth'; c.pos.x = 21; invalidateLights(w); traumaTick(w, pl); expect(pl.needs.stress).toBe(stress)
  })
  it('원인을 식별하지 못한 저체온 위기는 피 공포로 임의 변환하지 않는다', () => {
    const { w, pl } = setup(); pl.needs.bodyTemp = 31; w.s.rng.body = [0, 0, 0, 1]
    traumaTick(w, pl); expect(thought(w, pl, 'Thought.NearDeath')).toBeDefined(); expect(pl.traumas).toBeUndefined()
  })
  it('긍정 특성 변환은 상충 특성을 제거한다', () => {
    const { w, pl } = setup(), t = fear(w, pl, 'Fire'); pl.stats.wil = 20; w.s.rng.body = [0, 0, 0, 1]; pl.traits = ['Trait.Nervous']
    overcome(w, pl, t, 100, '검증'); expect(pl.traits).toContain('Trait.IronWill'); expect(pl.traits).not.toContain('Trait.Nervous')
  })
  it('중간 저장·복원 뒤 노출·기억·극복 결과와 난수 상태가 같다', () => {
    const { w, pl } = setup(), c = foe(w), t = fear(w, pl, 'Species', c.def)
    traumaEngage(w, pl, c); traumaTick(w, pl); addThought(w, pl, 'Thought.NearDeath')
    const restored = { db, s: deserialize(serialize(w.s)) }
    for (const ww of [w, restored]) { ww.s.time += 1000; const p = player(ww); traumaTick(ww, p); traumaVictory(ww, p, ww.s.creatures[1], true); addThought(ww, p, 'Thought.NearDeath') }
    expect(t.overcome).toBe(35); expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('모든 Thought Def의 단계·중첩 필드를 읽으며 트라우마는5종이다', () => {
    expect(db.all('Trauma')).toHaveLength(5)
    expect(db.all<ThoughtDef>('Thought').every((d) => d.durationTurns >= 0)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { activityStep, perform, treatQuality } from '../src/core/actions'
import { addWound, effectiveBleed, isMissing, painTotal, partEff } from '../src/core/body'
import { createCreature } from '../src/core/creatures'
import { killCreature, resolveAttack } from '../src/core/combat'
import { player, tileAt, turnOf, TURNS_PER_DAY } from '../src/core/ctx'
import { playerAct } from '../src/core/game'
import { invalidateLights } from '../src/core/fov'
import { addToBag, equip, makeItem } from '../src/core/items'
import { canHeatBlade, finishProcedure, lodgeProjectile, procedureDef, procedureError } from '../src/core/medical'
import { completeHealing } from '../src/core/recovery'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { surgeryDef, surgeryError } from '../src/core/surgery'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('medical', 'Bg.Excommunicate'), pl = player(w)
  pl.age = undefined; pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.traits = []; pl.background = undefined; pl.skills = {}; pl.abilities = []; pl.equip = {}; pl.bag = []; pl.body.wounds = []; pl.effects = []; pl.body.blood = pl.body.bloodMax; pl.hp = 90; pl.needs.stress = 0; pl.needs.fatigue = 20; pl.needs.bodyTemp = 37
  pl.pos = { x: 20, y: 20 }; w.s.creatures = [pl]; w.s.time = 14400 * 100; pl.nextAct = w.s.time; w.s.map.lights = []; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  invalidateLights(w)
  return { w, pl }
}
function blade(w: ReturnType<typeof makeWorld>) { const it = makeItem(w, 'Item.HuntingKnife'); addToBag(w, player(w), it); return it }
function cut(w: ReturnType<typeof makeWorld>, part = 'LeftForearm') { return addWound(w, player(w), { def: 'Wound.Stab', part, severity: 3, source: '검증' }).wound }
function finish(w: ReturnType<typeof makeWorld>) { for (let i = 0; player(w).activity && i < 1000; i++) activityStep(w, player(w)); expect(player(w).activity).toBeUndefined() }

describe('절단·영구 손상', () => {
  it('상완/대퇴 지혈대와 쓸 수 있는 칼날이 필요하며 몸통·눈·잃은 부위를 거부한다', () => {
    const { w, pl } = setup(), rule = procedureDef(w, 'amputate')
    expect(procedureError(w, pl, rule, undefined, 'LeftHand')).toContain('칼날')
    const knife = blade(w)
    expect(procedureError(w, pl, rule, undefined, 'LeftHand')).toContain('지혈대')
    pl.body.tourniquets.LeftUpperArm = turnOf(w)
    expect(procedureError(w, pl, rule, undefined, 'LeftHand')).toBeNull()
    expect(procedureError(w, pl, rule, undefined, 'Chest')).toContain('팔다리')
    expect(procedureError(w, pl, rule, undefined, 'LeftEye')).toContain('혼자')
    knife.durability = 0; expect(procedureError(w, pl, rule, undefined, 'LeftHand')).toContain('칼날')
  })
  it('중단은 부위를 보존하고 완료 직전 지혈대를 잃으면 절단하지 않는다', () => {
    const { w, pl } = setup(); const knife = blade(w); pl.body.tourniquets.LeftUpperArm = turnOf(w)
    perform(w, pl, { type: 'procedure', procedure: 'amputate', part: 'LeftHand' }); activityStep(w, pl); pl.activity = undefined
    expect(pl.body.missing).toEqual([]); expect(knife.durability).toBe(100)
    perform(w, pl, { type: 'procedure', procedure: 'amputate', part: 'LeftHand' }); delete pl.body.tourniquets.LeftUpperArm; finish(w)
    expect(pl.body.missing).toEqual([]); expect(knife.durability).toBe(100)
  })
  it('쓰던 칼날을 잃으면 대체 칼이 있어도 절단하지 않는다', () => {
    const { w, pl } = setup(); const knife = blade(w); blade(w); pl.body.tourniquets.LeftUpperArm = turnOf(w)
    perform(w, pl, { type: 'procedure', procedure: 'amputate', part: 'LeftHand' }); pl.bag = pl.bag.filter((i) => i.uid !== knife.uid); finish(w)
    expect(pl.body.missing).toEqual([])
  })
  it('부위·아래 상처/후유증 제거, 절단면60%, 기능 상실과 반지 낙하, 지혈대 해제 출혈을 연결한다', () => {
    const { w, pl } = setup(); blade(w); pl.body.tourniquets.LeftUpperArm = turnOf(w)
    pl.equip.ring2 = makeItem(w, 'Item.SealRing'); const uid = pl.equip.ring2.uid
    pl.body.chronicPain = ['LeftIndex', 'RightHand']; pl.body.damagedTendons = ['LeftHand']; cut(w, 'LeftIndex')
    expect(perform(w, pl, { type: 'procedure', procedure: 'amputate', part: 'LeftHand' }).ok).toBe(true); finish(w)
    expect(isMissing(w, pl, 'LeftIndex')).toBe(true); expect(partEff(w, pl, 'LeftHand')).toBe(0)
    expect(pl.body.wounds).toHaveLength(1); const wd = pl.body.wounds[0]
    expect(wd.part).toBe('LeftForearm'); expect(wd.severity).toBe(Math.round(pl.body.maxHp.LeftHand * .6)); expect(effectiveBleed(w, pl, wd)).toBe(0)
    expect(pl.body.chronicPain).toEqual(['RightHand']); expect(pl.body.damagedTendons).toEqual([])
    expect(pl.equip.ring2).toBeUndefined(); expect(tileAt(w, pl.pos).items.some((i) => i.uid === uid)).toBe(true)
    perform(w, pl, { type: 'removeTourniquet', limb: 'LeftUpperArm' }); expect(effectiveBleed(w, pl, wd)).toBeGreaterThan(0)
  })
  it('상완 절단면도 남아 있는 지혈대로 막고 Q60 이상 의수족 보정10%를 보관한다', () => {
    const { w, pl } = setup(); blade(w); pl.body.tourniquets.LeftUpperArm = turnOf(w)
    finishProcedure(w, pl, procedureDef(w, 'amputate'), 60, undefined, 'LeftUpperArm')
    expect(pl.body.wounds[0].part).toBe('Chest'); expect(effectiveBleed(w, pl, pl.body.wounds[0])).toBe(0); expect(pl.body.amputationQuality?.LeftUpperArm).toBe(.1)
    delete pl.body.tourniquets.LeftUpperArm; expect(effectiveBleed(w, pl, pl.body.wounds[0])).toBeGreaterThan(0)
  })
  it('절단 채널 중간 저장 후 부위·실신·도구·숙달·낙하가 같다', () => {
    const { w, pl } = setup(); blade(w); pl.body.tourniquets.LeftUpperArm = turnOf(w)
    perform(w, pl, { type: 'procedure', procedure: 'amputate', part: 'LeftForearm' }); for (let i = 0; i < 20; i++) activityStep(w, pl)
    const restored = { db, s: deserialize(serialize(w.s)) }; finish(w); finish(restored); expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('힘줄30일 경계는 피부 치유·저장 뒤에도 보존되고 영구화 전에는 수복할 수 있다', () => {
    const { w, pl } = setup(); const needle = makeItem(w, 'Item.Needle'); addToBag(w, pl, needle); addToBag(w, pl, makeItem(w, 'Item.Thread', 2)); pl.skills.medicine = 30
    const wd = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftForearm', severity: 3, source: '검증', tendon: true }).wound
    const at = turnOf(w); wd.healed = wd.severity; completeHealing(w, pl); expect(pl.body.tendonSince?.LeftForearm).toBe(at)
    w.s.time += (30 * TURNS_PER_DAY - 1) * 100; expect(surgeryError(w, pl, surgeryDef(w, 'tendon'), undefined, 'LeftForearm')).toBeNull()
    const restored = { db, s: deserialize(serialize(w.s)) }; restored.s.time += 100
    expect(surgeryError(restored, player(restored), surgeryDef(restored, 'tendon'), undefined, 'LeftForearm')).toContain('영구')
  })
  it('버틸 HP가 없는 절단은 처치 완료 즉시 사망하고 다음 틱 회복으로 되살아나지 않는다', () => {
    const { w, pl } = setup(); blade(w); pl.hp = 1; pl.body.tourniquets.LeftUpperArm = turnOf(w)
    expect(playerAct(w, { type: 'procedure', procedure: 'amputate', part: 'LeftHand' })).toBeNull()
    expect(pl.alive).toBe(false); expect(pl.deathCause).toBe('치명상'); expect(w.s.over?.kind).toBe('death')
    expect(playerAct(w, { type: 'wait' })).toBe('게임이 끝났다')
  })
  it('약지 이외의 손가락 상실은 반지 착용을 막지 않는다', () => {
    const { w, pl } = setup(); pl.body.missing.push('RightIndex'); const ring = makeItem(w, 'Item.SealRing'); addToBag(w, pl, ring)
    expect(equip(w, pl, ring.uid, 'ring1')).toBeNull()
  })
})

describe('이물질·탈구와 열원', () => {
  it('박힌 화살은 출혈 반·통증5, 실제 이동/공격마다 통증1, 제거 성공은 혈액sev×5와 화살1회 회수다', () => {
    const { w, pl } = setup(), wd = cut(w), before = effectiveBleed(w, pl, wd), pain = painTotal(w, pl)
    lodgeProjectile(w, pl, wd, 'Item.Arrow', true); expect(effectiveBleed(w, pl, wd)).toBeCloseTo(before * .5); expect(painTotal(w, pl)).toBeCloseTo(pain + 5)
    perform(w, pl, { type: 'move', dir: 2 }); expect(wd.foreign!.pain).toBe(1)
    const target = createCreature(w, 'Creature.Reaver', { x: pl.pos.x + 1, y: pl.pos.y }); w.s.creatures.push(target); resolveAttack(w, pl, target); expect(wd.foreign!.pain).toBe(2)
    pl.exerted = false
    const blood = pl.body.blood; w.s.rng.body = [0, 0, 0, 1]
    finishProcedure(w, pl, procedureDef(w, 'extract'), 100, wd)
    expect(wd.foreign).toBeUndefined(); expect(effectiveBleed(w, pl, wd)).toBeCloseTo(before); expect(pl.body.blood).toBe(blood - wd.severity * 5)
    expect(tileAt(w, pl.pos).items.filter((i) => i.def === 'Item.Arrow').reduce((n, i) => n + i.count, 0)).toBe(1)
    expect(procedureError(w, pl, procedureDef(w, 'extract'), wd)).toContain('없다')
  })
  it('실제 발사 입력으로 상처에 박히며 화살이 몸과 바닥에 중복 생성되지 않는다', () => {
    const { w, pl } = setup(); pl.equip.main = makeItem(w, 'Item.Bow'); const arrows = makeItem(w, 'Item.Arrow', 20); addToBag(w, pl, arrows)
    let lodged = false
    for (let i = 0; i < 20 && !lodged; i++) {
      const target = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }); target.equip = {}; target.hp = 1000; target.ai.mode = 'idle'; target.ai.morale = 100; w.s.creatures = [pl, target]
      const floorBefore = tileAt(w, target.pos).items.filter((it) => it.def === 'Item.Arrow').reduce((n, it) => n + it.count, 0)
      const count = arrows.count; expect(perform(w, pl, { type: 'shoot', target: target.id }).ok).toBe(true); expect(arrows.count).toBe(count - 1)
      lodged = target.body.wounds.some((wd) => wd.foreign?.kind === 'arrow')
      if (lodged) expect(tileAt(w, target.pos).items.filter((it) => it.def === 'Item.Arrow').reduce((n, it) => n + it.count, 0)).toBe(floorBefore)
    }
    expect(lodged).toBe(true)
  })
  it('죽은 몸에서 회수한 화살은 바닥에 한 번만 남는다', () => {
    const { w, pl } = setup(), wd = cut(w); lodgeProjectile(w, pl, wd, 'Item.Arrow', true)
    killCreature(w, pl, '검증'); killCreature(w, pl, '중복')
    expect(tileAt(w, pl.pos).items.filter((i) => i.def === 'Item.Arrow')).toHaveLength(1)
  })
  it('제거 실패는 이물질을 남기고 심각도·HP·출혈을 악화하며 봉합을 연다', () => {
    const { w, pl } = setup(), wd = cut(w); lodgeProjectile(w, pl, wd, 'Item.Arrow', true); wd.suture = { def: 'Surgery.Suture', quality: 70, at: turnOf(w) }
    const blood = pl.body.blood, hp = pl.hp; w.s.rng.body = [0, 0, 0, 4294967295]
    finishProcedure(w, pl, procedureDef(w, 'extract'), 5, wd)
    expect(wd.foreign).toBeDefined(); expect(wd.severity).toBe(5); expect(pl.hp).toBe(hp - 2); expect(pl.body.blood).toBe(blood); expect(wd.suture).toBeUndefined()
  })
  it('제거 순간 출혈이 사망 문턱을 넘으면 즉시 과다 출혈로 사망한다', () => {
    const { w, pl } = setup(), wd = cut(w); lodgeProjectile(w, pl, wd, 'Item.Arrow', true); pl.body.blood = pl.body.bloodMax * .5 + 1; w.s.rng.body = [0, 0, 0, 1]
    finishProcedure(w, pl, procedureDef(w, 'extract'), 100, wd); expect(pl.alive).toBe(false); expect(pl.deathCause).toBe('과다 출혈')
  })
  it('이물질·탈구는 피부만 다 아물어도 지워지지 않고 관절 맞추기 뒤 기능이 회복된다', () => {
    const { w, pl } = setup(), wd = addWound(w, pl, { def: 'Wound.Bruise', part: 'LeftForearm', severity: 1, source: '검증', dislocated: true }).wound
    wd.healed = wd.severity; completeHealing(w, pl); expect(pl.body.wounds).toContain(wd); expect(partEff(w, pl, wd.part)).toBe(.3)
    expect(perform(w, pl, { type: 'procedure', procedure: 'reduce', woundId: wd.id }).ok).toBe(true); finish(w); expect(wd.dislocated).toBe(false); expect(partEff(w, pl, wd.part)).toBe(1)
  })
  it('이물질 제거 중간 저장을 이어도 성공/실패·혈액·회수물·연습이 같다', () => {
    const { w, pl } = setup(), wd = cut(w); lodgeProjectile(w, pl, wd, 'Item.Arrow', true)
    perform(w, pl, { type: 'procedure', procedure: 'extract', woundId: wd.id }); activityStep(w, pl)
    const restored = { db, s: deserialize(serialize(w.s)) }; finish(w); finish(restored); expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('소작은 꺼진 불을 거부하고 켜진 곁불을 쓰며 완료 전에 꺼지면 화상을 만들지 않는다', () => {
    const { w, pl } = setup(), wd = cut(w); blade(w)
    tileAt(w, pl.pos).t = 'Terrain.Campfire'; w.s.map.lights = [{ pos: { ...pl.pos }, kind: 'campfire', radius: 6, off: true }]
    expect(canHeatBlade(w, pl)).toBe(false); expect(perform(w, pl, { type: 'cauterize', woundId: wd.id }).ok).toBe(false)
    w.s.map.lights[0].off = false; expect(canHeatBlade(w, pl)).toBe(true); expect(perform(w, pl, { type: 'cauterize', woundId: wd.id }).ok).toBe(true)
    w.s.map.lights[0].off = true; finish(w); expect(wd.cauterized).toBeUndefined(); expect(pl.body.wounds).toHaveLength(1)
  })
  it('Q59.5는 부동소수점 오차 없이60으로 반올림해 의수족 보정 문턱을 충족한다', () => {
    const { w, pl } = setup(); pl.stats.per = 20; pl.skills.medicine = 80; tileAt(w, pl.pos).roof = true
    w.s.map.lights = [{ pos: { ...pl.pos }, kind: 'campfire', radius: 6 }]; invalidateLights(w)
    expect(treatQuality(w, pl, 0, undefined, { part: 'LeftHand' }).q).toBe(60)
  })
  it('일반 붕대의 품질도 오른팔 손상에 영향받지 않는 왼손으로 계산한다', () => {
    const { w, pl } = setup(), wd = cut(w, 'RightForearm'), before = treatQuality(w, pl, 0, wd).q
    pl.body.damagedTendons = ['RightForearm']; expect(treatQuality(w, pl, 0, wd).q).toBe(before)
    const bandage = makeItem(w, 'Item.Bandage'); addToBag(w, pl, bandage); expect(perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: wd.id }).ok).toBe(true)
  })
})

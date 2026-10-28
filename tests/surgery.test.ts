import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { addWound, bodyTick, effectiveBleed, partEff } from '../src/core/body'
import { resolveAttack } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_HOUR } from '../src/core/ctx'
import { playerAct } from '../src/core/game'
import { invalidateLights } from '../src/core/fov'
import { addToBag, makeItem } from '../src/core/items'
import { completeHealing } from '../src/core/recovery'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { markSuture, strainStitches, surgeryDef, surgeryError } from '../src/core/surgery'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('surgery', 'Bg.Excommunicate'), pl = player(w)
  pl.age = undefined; pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.traits = []; pl.background = undefined; pl.skills = {}; pl.abilities = []; pl.equip = {}; pl.bag = []; pl.body.wounds = []; pl.effects = []; pl.body.blood = pl.body.bloodMax; pl.hp = 100; pl.needs.stress = 0; pl.needs.fatigue = 20; pl.needs.bodyTemp = 37
  pl.pos = { x: 20, y: 20 }; w.s.creatures = [pl]; w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time; w.s.map.lights = []; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  invalidateLights(w)
  const thread = makeItem(w, 'Item.Thread', 5); addToBag(w, pl, thread)
  return { w, pl, thread }
}
function needle(w: ReturnType<typeof makeWorld>) { const it = makeItem(w, 'Item.Needle'); addToBag(w, player(w), it); return it }
function wound(w: ReturnType<typeof makeWorld>, severity = 3) { return addWound(w, player(w), { def: 'Wound.Cut', part: 'LeftForearm', severity, source: '검증' }).wound }
function finish(w: ReturnType<typeof makeWorld>) { for (let i = 0; player(w).activity && i < 1000; i++) activityStep(w, player(w)); expect(player(w).activity).toBeUndefined() }

describe('외과 처치 조건·소비·저장', () => {
  it('기본 봉합은 숙달0에도 가능하며 바늘이 필요하고 망가진 바늘은 못 쓴다', () => {
    const { w, pl, thread } = setup(), wd = wound(w)
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }).msg).toContain('바늘')
    const tool = needle(w); expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }).ok).toBe(true)
    pl.activity = undefined; tool.durability = 0
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }).msg).toContain('바늘')
  })
  it('중단은 실·바늘을 쓰지 않고 완료 때 실1·바늘내구1을 소비하며 중복 봉합을 거부한다', () => {
    const { w, pl, thread } = setup(), wd = wound(w), tool = needle(w)
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); activityStep(w, pl); pl.activity = undefined
    expect(thread.count).toBe(5); expect(tool.durability).toBe(100); expect(wd.suture).toBeUndefined()
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); finish(w)
    expect(thread.count).toBe(4); expect(tool.durability).toBe(99); expect(wd.suture?.def).toBe('Surgery.Suture')
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }).msg).toContain('이미 봉합')
  })
  it('쓰던 바늘이 사라지면 다른 바늘이 있어도 완료하지 않는다', () => {
    const { w, pl, thread } = setup(), wd = wound(w), a = needle(w), b = needle(w)
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); pl.bag = pl.bag.filter((i) => i.uid !== a.uid); finish(w)
    expect(wd.suture).toBeUndefined(); expect(thread.count).toBe(5); expect(b.durability).toBe(100)
  })
  it('동맥·힘줄은 의료3단계이며 일반 봉합으로 동맥을 우회하지 못한다', () => {
    const { w, pl, thread } = setup(), wd = wound(w); needle(w); wd.arterial = true; wd.artery = 150; pl.skills.medicine = 29
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }).msg).toContain('결찰')
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id, procedure: 'ligate' }).msg).toContain('3단계')
    pl.skills.medicine = 30; expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id, procedure: 'ligate' }).ok).toBe(true); finish(w)
    expect(wd.artery).toBeUndefined(); expect(wd.ligated).toBe(true); expect(thread.count).toBe(3)
  })
  it('의식이 혼미하면 손이 남아 있어도 정밀 수술을 거부한다', () => {
    const { w, pl, thread } = setup(), wd = wound(w); needle(w); pl.body.blood = pl.body.bloodMax * .55
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }).msg).toContain('혼미')
  })
  it('자기 눈·몸속·이미 없는 팔 아래에는 수술할 수 없다', () => {
    const { w, pl } = setup(); needle(w); pl.skills.medicine = 30
    const eye = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftEye', severity: 1, source: '검증' }).wound
    expect(surgeryError(w, pl, surgeryDef(w, 'suture'), eye)).toContain('자기 눈')
    const inside = addWound(w, pl, { def: 'Wound.InternalBleed', part: 'LeftLung', severity: 1, source: '검증', internal: true }).wound
    expect(surgeryError(w, pl, surgeryDef(w, 'suture'), inside)).toContain('몸속')
    pl.body.missing.push('LeftUpperArm'); pl.body.damagedTendons = ['LeftForearm']
    expect(surgeryError(w, pl, surgeryDef(w, 'tendon'), undefined, 'LeftForearm')).toContain('부위가 없다')
  })
  it('의료5와 손재주의 시간 배율을 곱하고 특성의 봉합Q 보정도 적용한다', () => {
    const { w, pl, thread } = setup(), wd = wound(w, 11); needle(w)
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); expect(pl.activity!.total).toBe(16); pl.activity = undefined
    pl.skills.medicine = 80; perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); expect(pl.activity!.total).toBe(15); pl.activity = undefined
    pl.traits = ['Trait.NimbleHands']; perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); expect(pl.activity!.total).toBe(13)
  })
  it('다친 오른팔은 건강한 왼손으로 수복하며 사용할 반대손이 없으면 거부한다', () => {
    const { w, pl, thread } = setup(); needle(w); pl.skills.medicine = 30; pl.body.damagedTendons = ['RightForearm']
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, limb: 'RightForearm', procedure: 'tendon' }).ok).toBe(true)
    expect(pl.activity!.total).toBe(40); finish(w); expect(partEff(w, pl, 'RightForearm')).toBe(1)
    pl.body.damagedTendons = ['RightForearm']; pl.body.missing.push('LeftUpperArm')
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, limb: 'RightForearm', procedure: 'tendon' }).msg).toContain('손이 말을 듣지')
  })
  it('분리된 실 더미를 합쳐 비용을 충족하되 부족하면 시작하지 않는다', () => {
    const { w, pl, thread } = setup(); needle(w); pl.skills.medicine = 30; pl.body.damagedTendons = ['LeftForearm']; thread.count = 1
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, limb: 'LeftForearm', procedure: 'tendon' }).msg).toContain('2개')
    const other = makeItem(w, 'Item.Thread'); other.quality = 2; addToBag(w, pl, other)
    expect(perform(w, pl, { type: 'treat', uid: thread.uid, limb: 'LeftForearm', procedure: 'tendon' }).ok).toBe(true); finish(w)
    expect(pl.bag.some((i) => i.def === 'Item.Thread')).toBe(false)
  })
  it('장시간 힘줄 봉합 중간 저장을 읽어도 실·도구·숙달·기능이 같다', () => {
    const { w, pl, thread } = setup(); needle(w); pl.skills.medicine = 30; pl.body.damagedTendons = ['LeftForearm']
    perform(w, pl, { type: 'treat', uid: thread.uid, limb: 'LeftForearm', procedure: 'tendon' }); for (let i = 0; i < 13; i++) activityStep(w, pl)
    const restored = { db, s: deserialize(serialize(w.s)) }; finish(w); finish(restored)
    expect(stateHash(restored.s)).toBe(stateHash(w.s)); expect(partEff(w, pl, 'LeftForearm')).toBe(1)
  })
})

describe('봉합의 실제 효과·위험', () => {
  it('완료 후 정맥성 출혈이 원래의2%가 된다', () => {
    const { w, pl, thread } = setup(), wd = wound(w), before = effectiveBleed(w, pl, wd); needle(w)
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); finish(w)
    expect(effectiveBleed(w, pl, wd)).toBeCloseTo(before * .02)
  })
  it('봉합의 실제 치유는 붕대 기준1.5배이고 흉터 판정은 절반이다', () => {
    const normal = setup(), stitched = setup(), a = wound(normal.w, 4), b = wound(stitched.w, 4)
    a.bandage = { quality: 100, at: 0 }; markSuture(stitched.w, b, surgeryDef(stitched.w, 'suture'), 100)
    bodyTick(normal.w, normal.pl, false); bodyTick(stitched.w, stitched.pl, false); expect(b.healed).toBeCloseTo(a.healed * 1.5)
    for (const [ww, wd] of [[normal.w, a], [stitched.w, b]] as const) { wd.healed = wd.severity; ww.s.rng.body = [0, 0, 0, 429496730]; completeHealing(ww, player(ww)) }
    expect(normal.pl.body.scars).toHaveLength(1); expect(stitched.pl.body.scars).toBeUndefined()
  })
  it('손을 씻은 뒤 봉합: 상처 미세척이면 오염1.5배, 상처도 세척했으면 추가 오염이 없다', () => {
    const dirty = setup(), washed = setup()
    for (const env of [dirty, washed]) {
      const { w, pl, thread } = env, wd = wound(w); needle(w)
      if (env === washed) { const spirit = makeItem(w, 'Item.Moonshine'); addToBag(w, pl, spirit); expect(perform(w, pl, { type: 'treat', uid: spirit.uid, woundId: wd.id }).ok).toBe(true); finish(w); expect(wd.washedAt).toBe(turnOf(w)) }
      const handWater = makeItem(w, 'Item.WaterBottle'); addToBag(w, pl, handWater); expect(perform(w, pl, { type: 'washHands' }).ok).toBe(true); finish(w); const before = wd.contam; perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); finish(w)
      expect(wd.contam).toBeCloseTo(before * (env === dirty ? 1.5 : 1))
    }
  })
  it('장갑을 끼고 만든 낮은Q 봉합은 실제 공격의5% 판정으로 터지고 출혈이 재개된다', () => {
    const { w, pl, thread } = setup(), wd = wound(w); needle(w); pl.equip.hands = makeItem(w, 'Item.Gloves')
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); finish(w); expect(wd.suture!.quality).toBeLessThan(30)
    const before = effectiveBleed(w, pl, wd), target = createCreature(w, 'Creature.Reaver', { x: 21, y: 20 }); w.s.creatures.push(target)
    w.s.rng.body = [0, 0, 0, 1]; resolveAttack(w, pl, target)
    expect(wd.suture).toBeUndefined(); expect(effectiveBleed(w, pl, wd)).toBeGreaterThan(before * 40)
  })
  it('Q30 이상 실밥은 판정하지 않고 결찰한 동맥은 겉 실밥이 터져도 다시 열리지 않는다', () => {
    const { w, pl } = setup(), wd = wound(w); markSuture(w, wd, surgeryDef(w, 'ligate'), 30); wd.ligated = true
    const before = [...w.s.rng.body]; strainStitches(w, pl); expect(w.s.rng.body).toEqual(before); expect(wd.suture).toBeDefined()
    wd.suture!.quality = 20; w.s.rng.body = [0, 0, 0, 1]; strainStitches(w, pl); expect(wd.suture).toBeUndefined(); expect(wd.artery).toBeUndefined(); expect(wd.ligated).toBe(true)
  })
  it('활성·이미 아문 힘줄 손상을 모두 수복하지만 같은 상처 숙달은1회다', () => {
    const { w, pl, thread } = setup(), wd = wound(w); needle(w); pl.skills.medicine = 30; wd.tendon = true
    expect(partEff(w, pl, wd.part)).toBe(.5)
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id }); finish(w); expect(wd.tendon).toBe(true); expect(pl.skills.medicine).toBe(31)
    perform(w, pl, { type: 'treat', uid: thread.uid, woundId: wd.id, procedure: 'tendon' }); finish(w)
    expect(wd.tendon).toBe(false); expect(partEff(w, pl, wd.part)).toBe(1); expect(pl.skills.medicine).toBe(31)
  })
  it('결찰 뒤 남은 정맥 출혈과 무관하게 게임의 동맥 위기 극복을 한 번 보상한다', () => {
    const { w, pl, thread } = setup(), wd = wound(w); needle(w); pl.skills.medicine = 30; wd.arterial = true; wd.artery = 5
    expect(playerAct(w, { type: 'wait' })).toBeNull(); const before = pl.xp
    expect(playerAct(w, { type: 'treat', uid: thread.uid, woundId: wd.id, procedure: 'ligate' })).toBeNull()
    expect(wd.ligated).toBe(true)
    playerAct(w, { type: 'wait' }); expect(pl.xp - before).toBe(30)
    playerAct(w, { type: 'wait' }); expect(pl.xp - before).toBe(30)
  })
})

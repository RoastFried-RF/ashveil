import { describe, expect, it } from 'vitest'
import { activityStep, perform, stumbleChance } from '../src/core/actions'
import { autoSnap, autoStop } from '../src/core/autostop'
import { anatomicalMissing, capacity, handManip, isMissing, legEff, partEff, regionPenalties } from '../src/core/body'
import { resolveAttack } from '../src/core/combat'
import { frostbiteTick } from '../src/core/conditions'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
import { playerAct } from '../src/core/game'
import { addToBag, makeItem, slotBlocked, wield } from '../src/core/items'
import { prostheticFirstImpression, prostheticSupport } from '../src/core/prosthetic-state'
import { appraiseRelic, damageProsthetic, prostheticError, prostheticTick, startProsthetic } from '../src/core/prosthetics'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { activeThoughts } from '../src/core/thoughts'
import { makeWorld } from './helpers'

function setup() {
  const w = makeWorld('prosthetics', 'Bg.Excommunicate'), p = player(w)
  p.traits = []; p.abilities = []; p.sneaking = false; p.equip = {}; p.bag = []; p.effects = []; p.thoughts = []; p.body.wounds = []; p.body.missing = []; p.skills = {}; p.background = undefined; p.age = undefined; p.pos = { x: 20, y: 20 }; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 90; p.body.blood = p.body.bloodMax; p.unconscious = false; p.cond = {}
  Object.assign(p.needs, { kcal: 0, waterDeficit: 0, fatigue: 20, bodyTemp: 37, protein: 100, vitamin: 100, hygiene: 100, stress: 0 })
  w.s.creatures = [p]; w.s.time = 14400 * 100; p.nextAct = w.s.time; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.noiseEvents = []
  w.s.map = { ...w.s.map, lights: [{ pos: { ...p.pos }, kind: 'campfire', radius: 6 }] }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  invalidateLights(w); return { w, p }
}
function add(w: World, id: string, count = 1) { const it = makeItem(w, id, count); expect(addToBag(w, player(w), it)).toBe(0); return it }
function finish(w: World) { const p = player(w); for (let i = 0; p.activity && i < 3000; i++) activityStep(w, p); expect(p.activity).toBeUndefined() }
function install(w: World, item: string, root: string) { const p = player(w), it = add(w, item); expect(startProsthetic(w, p, 'install', root, it.uid, 1)).toBeNull(); finish(w); return p.body.prosthetics![root] }

describe('의수족의 신체 기능', () => {
  it('막대 의족은 절단 기록을 보존하면서 다리.55·이동.775를 복구한다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftShin']; expect(legEff(w, p, 'Left')).toBe(0)
    const state = install(w, 'Item.PegLeg', 'LeftShin')
    expect(p.body.missing).toEqual(['LeftShin']); expect(anatomicalMissing(w, p, 'LeftFoot')).toBe(true); expect(isMissing(w, p, 'LeftFoot')).toBe(false)
    expect(legEff(w, p, 'Left')).toBeCloseTo(.55); expect(capacity(w, p, 'moving')).toBeCloseTo(.775); expect(p.bag.some((i) => i.uid === state.item.uid)).toBe(false)
  })
  it('정확한 결손/대체 범위를 검사하고 더 위의 팔다리가 없으면 설치하지 못한다', () => {
    const { w, p } = setup(), peg = add(w, 'Item.PegLeg')
    expect(prostheticError(w, p, 'install', 'LeftShin', peg.uid)).toContain('결손')
    p.body.missing = ['LeftThigh', 'LeftFoot']; expect(prostheticError(w, p, 'install', 'LeftFoot', peg.uid)).toContain('그 위')
    expect(prostheticError(w, p, 'install', 'LeftHand', peg.uid)).toContain('결손')
  })
  it('Q60 절단 보정은 한 번만 더하며 손가락/발가락에 중복 곱하지 않는다', () => {
    const { w, p } = setup(); p.body.missing = ['RightShin']; p.body.amputationQuality = { RightShin: .1 }
    install(w, 'Item.PegLeg', 'RightShin'); expect(legEff(w, p, 'Right')).toBeCloseTo(.65); expect(partEff(w, p, 'RightToe1')).toBe(1)
  })
  it('갈고리는 조작.3·무기 쥐기 제한·양손 보조.5·고유 공격을 제공한다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftHand']; install(w, 'Item.HookHand', 'LeftHand')
    expect(handManip(w, p, 'Left')).toBeCloseTo(.3); expect(prostheticSupport(w, p, 'Left')).toBeCloseTo(.5); expect(slotBlocked(w, p, 'off')).toContain('갈고리')
    const main = makeItem(w, 'Item.Hatchet'); p.equip.main = main
    expect(regionPenalties(w, p, 'rarm', true).armState).toBe(2)
    p.equip = {}; expect(wield(w, p)!.atk.id).toBe('hook'); expect(wield(w, p)!.arm).toBe('larm')
    expect(slotBlocked(w, p, 'ring2')).toContain('반지')
  })
  it('막대 의족의 소음10과 얼음 미끄러짐 배율2가 실제 이동에 적용된다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftShin']; install(w, 'Item.PegLeg', 'LeftShin')
    w.db = loadMods([...readPackages(), { manifest: { id: 'ice.test', name: '검증', version: '1' }, defs: [], patches: [{ op: 'add', target: 'Terrain.Earth', path: '/icy', value: true }, { op: 'add', target: 'Terrain.Earth', path: '/stumble', value: 10 }, { op: 'add', target: 'Terrain.Earth', path: '/noiseMult', value: 1 }] }]).db
    const ice = stumbleChance(w, p, p.pos); w.db = loadMods([...readPackages(), { manifest: { id: 'ice.test', name: '검증', version: '1' }, defs: [], patches: [{ op: 'add', target: 'Terrain.Earth', path: '/icy', value: false }, { op: 'add', target: 'Terrain.Earth', path: '/stumble', value: 10 }, { op: 'add', target: 'Terrain.Earth', path: '/noiseMult', value: 1 }] }]).db
    expect(ice).toBe(stumbleChance(w, p, p.pos) * 2)
    for (let i = 0; p.pos.x === 20 && i < 20; i++) expect(perform(w, p, { type: 'move', dir: 2 }).ok).toBe(true)
    expect(p.pos.x).toBe(21); expect(w.s.noiseEvents.some((n) => n.source === p.id && n.radius >= 12)).toBe(true)
  })
  it('유리 눈은 시야를 복구하지 않지만 미관 보정3을 제공한다', () => {
    const { w, p } = setup(); p.skills.medicine = 5; p.body.missing = ['LeftEye']; const before = capacity(w, p, 'sight')
    install(w, 'Item.GlassEye', 'LeftEye'); expect(capacity(w, p, 'sight')).toBe(before); expect(partEff(w, p, 'LeftEye')).toBe(0); expect(prostheticFirstImpression(w, p)).toBe(3)
  })
  it('관절 의족의30일 정비 저하는 분리·재설치로 초기화할 수 없다', () => {
    const { w, p } = setup(); p.skills.medicine = 5; p.body.missing = ['LeftShin']; const state = install(w, 'Item.ArticulatedLeg', 'LeftShin')
    w.s.time += 30 * TURNS_PER_DAY * 100; expect(legEff(w, p, 'Left')).toBeCloseTo(.35)
    startProsthetic(w, p, 'remove', 'LeftShin', undefined, 1); finish(w); expect(startProsthetic(w, p, 'install', 'LeftShin', state.item.uid, 1)).toBeNull(); finish(w)
    expect(legEff(w, p, 'Left')).toBeCloseTo(.35); const strap = add(w, 'Item.LeatherStrap', 2)
    startProsthetic(w, p, 'service', 'LeftShin', undefined, 1); expect(strap.count).toBe(2); finish(w); expect(strap.count).toBe(1); expect(legEff(w, p, 'Left')).toBeCloseTo(.7)
  })
  it('개척 의수는 감정/의료/도구를 요구하고 영하에서는 조작×.8이다', () => {
    const { w, p } = setup(); p.skills.medicine = 30; p.body.missing = ['LeftForearm']; const it = add(w, 'Item.PioneerArm'); add(w, 'Item.Needle')
    expect(prostheticError(w, p, 'install', 'LeftForearm', it.uid)).toContain('감정'); p.stats.per = 16; p.literacy = 3; appraiseRelic(w, p, it); expect(it.appraisal).toBe(2)
    startProsthetic(w, p, 'install', 'LeftForearm', it.uid, 1); finish(w); expect(handManip(w, p, 'Left')).toBeCloseTo(.85)
    w.s.time = 0; expect(handManip(w, p, 'Left')).toBeCloseTo(.85 * .8)
  })
  it('의수의 전원30일은 분리·재설치로 회복되지 않고 전원셀1로 충전한다', () => {
    const { w, p } = setup(); p.skills.medicine = 30; p.body.missing = ['LeftForearm']; const it = add(w, 'Item.PioneerArm'); it.appraisal = 2; add(w, 'Item.Needle')
    startProsthetic(w, p, 'install', 'LeftForearm', it.uid, 1); finish(w); const until = p.body.prosthetics!.LeftForearm.powerUntil!
    w.s.time += TURNS_PER_DAY * 100; startProsthetic(w, p, 'remove', 'LeftForearm', undefined, 1); finish(w); startProsthetic(w, p, 'install', 'LeftForearm', it.uid, 1); finish(w); expect(p.body.prosthetics!.LeftForearm.powerUntil).toBe(until)
    w.s.time = until * 100; expect(handManip(w, p, 'Left')).toBe(0); const cells = add(w, 'Item.PowerCell', 2); startProsthetic(w, p, 'charge', 'LeftForearm', undefined, 1); finish(w)
    expect(cells.count).toBe(1); expect(handManip(w, p, 'Left')).toBeCloseTo(.85)
  })
})

describe('의수족 행동·피격·저장', () => {
  it('설치30턴의 마지막TU까지 진행하고 중단에는 물건을 보존한다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftShin']; const it = add(w, 'Item.PegLeg'); const before = w.s.time
    expect(playerAct(w, { type: 'prosthetic', operation: 'install', part: 'LeftShin', uid: it.uid })).toBeNull(); expect(w.s.time - before).toBe(3000); expect(p.body.prosthetics!.LeftShin.item.uid).toBe(it.uid)
  })
  it('진행 중 정확한 물건/도구가 없어지면 대체품을 쓰지 않는다', () => {
    const { w, p } = setup(); p.body.missing = ['RightShin']; const a = add(w, 'Item.PegLeg'), b = add(w, 'Item.PegLeg')
    startProsthetic(w, p, 'install', 'RightShin', a.uid, 1); p.bag = p.bag.filter((i) => i.uid !== a.uid); finish(w)
    expect(p.body.prosthetics?.RightShin).toBeUndefined(); expect(p.bag.some((i) => i.uid === b.uid)).toBe(true)
  })
  it('같은 UID의 물건 종류를 바꿔 짧은 설치 시간으로 다른 의족을 달 수 없다', () => {
    const { w, p } = setup(); p.skills.medicine = 5; p.body.missing = ['LeftShin']; const it = add(w, 'Item.PegLeg')
    startProsthetic(w, p, 'install', 'LeftShin', it.uid, 1); it.def = 'Item.ArticulatedLeg'; finish(w)
    expect(p.body.prosthetics?.LeftShin).toBeUndefined(); expect(p.bag.some((i) => i.uid === it.uid)).toBe(true)
  })
  it('중간 저장한 설치와 분리는 같은 UID/기능/전원·난수 상태를 보존한다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftShin']; const it = add(w, 'Item.PegLeg'); startProsthetic(w, p, 'install', 'LeftShin', it.uid, 1)
    for (let i = 0; i < 7; i++) activityStep(w, p)
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const state of [w, copy]) { finish(state); const c = player(state); startProsthetic(state, c, 'remove', 'LeftShin', undefined, 1); finish(state) }
    expect(stateHash(w.s)).toBe(stateHash(copy.s)); expect(player(copy).bag[0].uid).toBe(it.uid); expect(legEff(copy, player(copy), 'Left')).toBe(0)
  })
  it('기계 피격은 내구/기능만 낮추고 HP·혈액·상처를 보존하며 자동 활동을 멈춘다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftShin']; const state = install(w, 'Item.PegLeg', 'LeftShin'), snap = autoSnap(w), hp = p.hp, blood = p.body.blood
    expect(damageProsthetic(w, p, 'LeftFoot', 3)).toBe(true); expect(state.item.durability).toBeCloseTo(90); expect(legEff(w, p, 'Left')).toBeCloseTo(.55 * .9)
    expect(p.hp).toBe(hp); expect(p.body.blood).toBe(blood); expect(p.body.wounds).toEqual([]); expect(autoStop(w, snap)).toContain('의수족')
    damageProsthetic(w, p, 'LeftFoot', 30); expect(p.body.prosthetics!.LeftShin).toBeUndefined(); expect(isMissing(w, p, 'LeftFoot')).toBe(true); expect(tileAt(w, p.pos).items.find((i) => i.uid === state.item.uid)!.durability).toBe(0)
  })
  it('실제 공격이 대체된 팔다리에 맞으면 유기 상처/이물질/HP 피해를 만들지 않는다', () => {
    const { w, p } = setup(); p.skills.medicine = 50; p.body.missing = ['RightThigh']; const it = add(w, 'Item.GardenerLimb'); it.appraisal = 2; add(w, 'Item.Needle'); startProsthetic(w, p, 'install', 'RightThigh', it.uid, 1); finish(w)
    const a = createCreature(w, 'Creature.Reaver', { x: 21, y: 20 }); a.stats.agi = 30; a.stats.per = 30; a.equip = {}; w.s.creatures.push(a); p.unconscious = true; const hp = p.hp
    let hit = false
    for (let i = 0; i < 20 && !hit; i++) hit = resolveAttack(w, a, p, { mods: { partWeights: { rleg: 1000, lleg: 0, rarm: 0, larm: 0, head: 0, torso: 0 } } }).hit
    expect(hit).toBe(true); expect(p.hp).toBe(hp); expect(p.body.wounds).toEqual([]); expect(p.body.prosthetics!.RightThigh.item.durability).toBeLessThan(100)
  })
  it('정원사 이식지는1.10 기능과 설치 후 한 시간마다 속삭임 기억을 준다', () => {
    const { w, p } = setup(); p.skills.medicine = 50; p.body.missing = ['LeftThigh']; const it = add(w, 'Item.GardenerLimb'); it.appraisal = 2; add(w, 'Item.Needle'); startProsthetic(w, p, 'install', 'LeftThigh', it.uid, 1); finish(w)
    expect(legEff(w, p, 'Left')).toBeCloseTo(1.1); prostheticTick(w, p); expect(activeThoughts(w, p).some((t) => t.def === 'Thought.GraftWhispers')).toBe(false)
    w.s.time += 1200 * 100; prostheticTick(w, p); expect(activeThoughts(w, p).find((t) => t.def === 'Thought.GraftWhispers')!.mood).toBe(-4)
    const saved = deserialize(serialize(w.s)); expect(saved.creatures[0].body.prosthetics!.LeftThigh.whisperAt).toBe(turnOf(w) + 1200)
  })
  it('기계 손가락은 동상 상처가 생기지 않고 감정은30턴 행동으로 저장한다', () => {
    const { w, p } = setup(); p.skills.medicine = 30; p.body.missing = ['LeftForearm']; const it = add(w, 'Item.PioneerArm'); p.stats.per = 16; p.literacy = 3
    expect(perform(w, p, { type: 'examine', uid: it.uid }).ok).toBe(true); finish(w); expect(it.appraisal).toBe(2); add(w, 'Item.Needle'); startProsthetic(w, p, 'install', 'LeftForearm', it.uid, 1); finish(w)
    w.s.time = 0; p.needs.bodyTemp = 20; for (let i = 0; i < 100; i++) frostbiteTick(w, p)
    expect(Object.keys(p.frostbite ?? {}).some((k) => k.startsWith('Left') && /Thumb|Index|Middle|Ring|Pinky/.test(k))).toBe(false)
  })
})

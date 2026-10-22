import {addWound} from '../src/core/body'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { resolveAttack } from '../src/core/combat'
import { player, tileAt, turnOf } from '../src/core/ctx'
import { loadMods } from '../src/core/defs'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { addToBag, makeItem, storedItems } from '../src/core/items'
import { Rng, seedState } from '../src/core/rng'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { throwQuote } from '../src/core/throwing'
import type { ItemInst } from '../src/core/types'
import { readPackages } from '../tools/loadContent'
import { prisonerFixture } from './prisoner-fixture'

function setup(count = 2) {
  const d = prisonerFixture()
  d.s.overworld = undefined; d.s.map.kind = 'dungeon'; d.s.map.depth = 3; d.s.map.ambient = 1; d.s.map.lights = []
  d.p.bag = []; d.p.equip = {}; d.p.abilities = []; d.p.needs.energy = 100; d.p.ai.morale = 80
  d.target.pos = { x: 24, y: 20 }; d.target.facing = 6; d.target.hp = 100; d.target.nextAct = 1e12
  d.target.reactPolicy = 'none'; d.target.ai.mode = 'hunt'; d.target.ai.target = d.p.id; d.target.ai.alertTurn = turnOf(d.w)
  for (let y = 12; y <= 29; y++) for (let x = 12; x <= 29; x++) Object.assign(tileAt(d.w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [], placed: undefined, spores: undefined })
  invalidateLights(d.w)
  const stone = makeItem(d.w, 'Item.Stone', count)
  expect(addToBag(d.w, d.p, stone)).toBe(0)
  updatePlayerVision(d.w, d.p)
  return { ...d, stone }
}
function attack(d: ReturnType<typeof setup>, uid = d.stone.uid) { return perform(d.w, d.p, { type: 'throwAttack', uid, target: d.target.id }) }
function onFloor(d: ReturnType<typeof setup>) { return tileAt(d.w, d.target.pos).items.filter(i => i.def === 'Item.Stone') }
function thrownState(it: ItemInst) { const copy = { ...it }; delete copy.gx; delete copy.gy; return copy }
function missRoll() {
  for (let i = 0; i < 10000; i++) { const state = seedState('stone-miss-' + i, 'combat'); if (new Rng([...state]).int(0, 99) === 99) return state }
  throw Error('빗나감 경계 시드 없음')
}
function unchangedFailure(d: ReturnType<typeof setup>, uid = d.stone.uid, target = d.target.id) {
  const before = serialize(d.s)
  expect(perform(d.w, d.p, { type: 'throwAttack', uid, target }).ok).toBe(false)
  expect(serialize(d.s)).toBe(before)
}

describe('기존 돌의 실제 투척 공격', () => {
  it('정본 타격5/관통0과 기존1×1/최대5를 유지하고 새 무기 슬롯을 만들지 않는다', () => {
    const d = setup(), def = d.w.db.item('Item.Stone')
    expect(def.size).toEqual([1, 1]); expect(def.maxStack).toBe(5); expect(def.slot).toBeUndefined(); expect(def.attacks).toBeUndefined()
    expect(def.throwable).toEqual({ range: 6, effective: 3, attack: { id: 'throw', label: '돌 던지기', damageType: 'blunt', damage: 5, pen: 0, accuracy: 0, energy: 3, family: 'throwing', noise: 3 } })
  })
  it('명중 미리보기는 전체 상태·난수·UID·수량을 바꾸지 않는다', () => {
    const d = setup(), before = serialize(d.s), quote = throwQuote(d.w, d.p, d.stone.uid, d.target.id)
    expect(quote.error).toBeNull(); expect(quote.preview?.attack.damage).toBe(5); expect(quote.wield?.throwing).toBe(true)
    expect(serialize(d.s)).toBe(before)
  })
  it('주무기를 바꾸지 않고 실제 돌로 같은 전투 피해·기력·상처·로그를 만든다', () => {
    const d = setup(1), axe = makeItem(d.w, 'Item.Hatchet'); d.p.equip.main = axe
    d.s.rng.combat = [0, 0, 0, 0]
    const beforeAxe = structuredClone(axe), expectedStone = thrownState(d.stone), energy = d.p.needs.energy
    expect(attack(d)).toEqual({ ok: true, tu: 100 })
    expect(d.target.hp).toBe(96); expect(d.target.body.wounds.some(w => w.def === 'Wound.Bruise' && w.severity === 4)).toBe(true)
    expect(d.p.needs.energy).toBe(energy - 3); expect(d.p.equip.main).toEqual(beforeAxe); expect(d.p.bag).toEqual([])
    expect(onFloor(d)).toEqual([expectedStone]); expect(d.s.log.some(l => l.text.includes('돌 던지기'))).toBe(true)
    expect(d.target.body.wounds.every(w => !w.foreign)).toBe(true)
  })
  it('같은 실제 투척 문맥의 공용 전투 결과와 피해·상처·난수가 일치한다', () => {
    const d = setup(1), copy = { db: d.w.db, s: deserialize(serialize(d.s)) }, p = player(copy), target = copy.s.creatures.find(c => c.id === d.target.id)!
    const quote = throwQuote(copy, p, d.stone.uid, target.id)
    expect(attack(d).ok).toBe(true)
    const result = resolveAttack(copy, p, target, { ranged: true, wield: quote.wield! })
    expect(d.target.hp).toBe(target.hp); expect(d.target.body.wounds).toEqual(target.body.wounds); expect(d.s.rng.combat).toEqual(copy.s.rng.combat)
    expect(result.damage).toBe(100 - d.target.hp)
  })
  it('더미에서 한 개만 분리하고 남은 더미/착지물 UID를 중복하지 않는다', () => {
    const d = setup(3), next = d.s.nextId
    d.s.rng.combat = missRoll()
    expect(attack(d).ok).toBe(true); expect(d.stone.count).toBe(2); expect(d.p.bag[0].uid).toBe(d.stone.uid)
    expect(onFloor(d)).toHaveLength(1); expect(onFloor(d)[0].uid).toBe(next); expect(onFloor(d)[0].count).toBe(1)
    expect(d.target.hp).toBe(100); expect(d.s.nextId).toBe(next + 1)
  })
  it('마지막 실제 돌의 품질/내구/오염/재질/회전을 바닥·저장·직접 줍기까지 보존한다', () => {
    const d = setup(1)
    Object.assign(d.stone, { quality: 2, durability: 47, dirty: true, rot: true, rawGrams: 17, rawMaterial: 'Material.Flint', oiledUntil: 12345, gearAgedAt: turnOf(d.w) })
    const expected = thrownState(d.stone)
    expect(attack(d).ok).toBe(true); expect(onFloor(d)).toEqual([expected])
    const copy = { db: d.w.db, s: deserialize(serialize(d.s)) }, p = player(copy)
    p.pos = { ...d.target.pos }
    expect(perform(copy, p, { type: 'pickup', uid: expected.uid }).ok).toBe(true)
    // 기존 자동 배치는1×1 물품을 기본 방향으로 놓는다. 착지/저장은 원래 회전을 유지했다.
    expect(thrownState(p.bag.find(i => i.uid === expected.uid)!)).toEqual({ ...expected, rot: undefined })
    expect(tileAt(copy, p.pos).items.some(i => i.uid === expected.uid)).toBe(false)
  })
  it('바닥의 같은 상태4개에는 한 개만 더하고 최대5개 더미를 넘지 않는다', () => {
    const d = setup(), floor = makeItem(d.w, 'Item.Stone', 4); tileAt(d.w, d.target.pos).items.push(floor)
    expect(attack(d).ok).toBe(true); expect(onFloor(d)).toHaveLength(1); expect(floor.count).toBe(5); expect(d.stone.count).toBe(1)
    expect(attack(d).ok).toBe(true); expect(onFloor(d).map(i => i.count)).toEqual([5, 1]); expect(d.p.bag).toEqual([])
  })
  it('품질/내구/오염/추가 상태가 다르면 바닥 병합으로 상태를 잃지 않는다', () => {
    for (const state of [{ quality: 2 }, { durability: 80 }, { dirty: true }, { oiledUntil: 555 }]) {
      const d = setup(1), other = Object.assign(makeItem(d.w, 'Item.Stone', 2), state); tileAt(d.w, d.target.pos).items.push(other)
      expect(attack(d).ok).toBe(true); expect(other.count).toBe(2); expect(onFloor(d).map(i => i.count)).toEqual([2, 1])
    }
  })
  it('빗나가거나 방패로 막혀도 실제 돌 하나가 회수 가능한 바닥 물품으로 남는다', () => {
    const miss = setup(1); miss.s.rng.combat = missRoll(); expect(attack(miss).ok).toBe(true); expect(miss.target.hp).toBe(100); expect(onFloor(miss)[0].uid).toBe(miss.stone.uid)
    const blocked = setup(1); blocked.target.reactPolicy = 'block'; blocked.target.equip.off = makeItem(blocked.w, 'Item.ScrapBuckler'); blocked.target.needs.energy = 100; blocked.s.rng.combat = [0, 0, 0, 0]
    expect(attack(blocked).ok).toBe(true); expect(blocked.target.hp).toBe(100); expect(onFloor(blocked)[0].uid).toBe(blocked.stone.uid)
    expect(blocked.s.fx.some(f => f.k === 'block')).toBe(true)
  })
  it('방어구에 튕긴 돌도 마모를 새로 만들지 않고 원래 상태로 착지한다', () => {
    const d = setup(1); d.target.equip.head = makeItem(d.w, 'Item.ScrapHelmet'); d.s.rng.combat = [0, 0, 0, 0]
    const expected = thrownState(d.stone)
    expect(attack(d).ok).toBe(true); expect(d.s.fx.some(f => f.k === 'deflect')).toBe(true); expect(d.target.hp).toBe(100); expect(onFloor(d)).toEqual([expected])
  })
  it('기존 다른 물품 던지기는 피해 없이1개를 옮기고100TU 유인 행동을 유지한다', () => {
    const d = setup(), food = makeItem(d.w, 'Item.Jerky', 2); addToBag(d.w, d.p, food)
    const hp = d.target.hp, energy = d.p.needs.energy
    expect(perform(d.w, d.p, { type: 'throw', uid: food.uid, target: d.target.pos })).toEqual({ ok: true, tu: 100 })
    expect(food.count).toBe(1); expect(d.target.hp).toBe(hp); expect(d.p.needs.energy).toBe(energy)
    expect(tileAt(d.w, d.target.pos).items.filter(i => i.def === food.def).map(i => i.count)).toEqual([1])
    expect(d.s.fx.some(f => f.k === 'attack')).toBe(false)
  })
})

describe('투척의 가시성·공간·손·저장 경계', () => {
  it('공용 유효 사거리 초과−3/칸·이동−5·5~95 명중 상한을 사용한다', () => {
    const d = setup(); d.target.pos.x = 23
    const close = throwQuote(d.w, d.p, d.stone.uid, d.target.id).preview!
    d.target.pos.x = 24
    const far = throwQuote(d.w, d.p, d.stone.uid, d.target.id).preview!
    expect(far.chance).toBe(close.chance - 3); expect(far.lines).toContain('사거리 초과 -3')
    d.target.movedTurn = turnOf(d.w); expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).preview!.chance).toBe(far.chance - 5)
    d.p.stats.agi = 100; expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).preview!.chance).toBe(95)
    d.p.stats.agi = -100; expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).preview!.chance).toBe(5)
  })
  it('체비셰프6칸의 대각선에 닿고 그 밖은 실물/시간/난수 변경 없이 거절한다', () => {
    const d = setup(); d.target.pos = { x: 26, y: 26 }; updatePlayerVision(d.w, d.p)
    expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).error).toBeNull()
    d.target.pos = { x: 27, y: 20 }; updatePlayerVision(d.w, d.p); unchangedFailure(d)
  })
  it('높은 자리의 명중+5와 최대 사거리+1은 기존 원거리 규칙을 읽는다', () => {
    const d = setup(); d.target.pos.x = 27; updatePlayerVision(d.w, d.p); unchangedFailure(d)
    tileAt(d.w, d.p.pos).t = 'Terrain.Rubble'
    const quote = throwQuote(d.w, d.p, d.stone.uid, d.target.id)
    expect(quote.error).toBeNull(); expect(quote.range).toBe(7); expect(quote.preview!.lines).toContain('높은 자리 +5')
  })
  it('직선 벽과 인접/중간 대각선의 두 막힌 모서리를 관통하지 않는다', () => {
    const straight = setup(); tileAt(straight.w, { x: 22, y: 20 }).t = 'Terrain.KtWall'; invalidateLights(straight.w); unchangedFailure(straight)
    for (const distance of [1, 4]) {
      const d = setup(); d.target.pos = { x: 20 + distance, y: 20 + distance }; updatePlayerVision(d.w, d.p)
      const at = distance === 1 ? 20 : 21
      tileAt(d.w, { x: at + 1, y: at }).t = 'Terrain.KtWall'; tileAt(d.w, { x: at, y: at + 1 }).t = 'Terrain.KtWall'
      expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).error).toContain('경로'); unchangedFailure(d)
    }
  })
  it('기억만 남은/어둠 속/자신/죽은/없는/경계 밖 대상은 무료 정보나 피해를 주지 않는다', () => {
    const remembered = setup(); tileAt(remembered.w, remembered.target.pos).seen = true; remembered.s.visible = []; unchangedFailure(remembered)
    const dark = setup(); dark.s.map.ambient = 0; dark.p.traits = ['Trait.Nearsighted']; dark.target.pos = { x: 26, y: 20 }; invalidateLights(dark.w); unchangedFailure(dark)
    const d = setup(); unchangedFailure(d, d.stone.uid, d.p.id); unchangedFailure(d, d.stone.uid, -1)
    d.target.alive = false; unchangedFailure(d); d.target.alive = true
    for (const x of [-1, d.s.map.w, 20.5, NaN, Infinity]) { d.target.pos.x = x; unchangedFailure(d) }
  })
  it('칠흑이어도 실제로 보이는6칸 경계의 대상에는 원래 돌 한 개를 던질 수 있다', () => {
    const d = setup(); d.s.map.ambient = 0; d.target.pos = { x: 26, y: 20 }; invalidateLights(d.w); updatePlayerVision(d.w, d.p)
    expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).error).toBeNull()
    expect(attack(d).ok).toBe(true); expect(d.stone.count).toBe(1)
  })
  it('닫힌 자루/없어진 UID/다른 물품을 선택해도 다른 돌을 자동 소비하지 않는다', () => {
    const d = setup(), sack = makeItem(d.w, 'Item.Sack'), inside = makeItem(d.w, 'Item.Stone'); inside.gx = 0; inside.gy = 0; sack.contents = [inside]; addToBag(d.w, d.p, sack)
    const wood = makeItem(d.w, 'Item.Wood'); addToBag(d.w, d.p, wood)
    for (const uid of [inside.uid, wood.uid, -1]) unchangedFailure(d, uid)
    d.p.bag = d.p.bag.filter(i => i.uid !== d.stone.uid); const other = makeItem(d.w, 'Item.Stone', 2); addToBag(d.w, d.p, other)
    unchangedFailure(d); expect(other.count).toBe(2)
  })
  it('양팔을 쓸 수 없으면 거절하고 한쪽 실제 팔이 남으면 그 팔을 사용한다', () => {
    const d = setup(); d.p.body.missing = ['RightUpperArm', 'LeftUpperArm']; unchangedFailure(d)
    d.p.body.missing = ['RightUpperArm']; expect(throwQuote(d.w, d.p, d.stone.uid, d.target.id).wield?.arm).toBe('larm')
  })
  it('저장 복원 후 같은 한 발은 전체 물리 상태와 난수·바닥 실물까지 결정론적으로 일치한다', () => {
    const d = setup(), copy = { db: d.w.db, s: deserialize(serialize(d.s)) }, p = player(copy)
    expect(attack(d).ok).toBe(true); expect(perform(copy, p, { type: 'throwAttack', uid: d.stone.uid, target: d.target.id }).ok).toBe(true)
    expect(stateHash(copy.s)).toBe(stateHash(d.s))
    const items = [...storedItems(d.p.bag), ...d.s.map.tiles.flatMap(t => storedItems(t.items))].filter(i => i.def === 'Item.Stone')
    expect(items.reduce((n, i) => n + i.count, 0)).toBe(2); expect(new Set(items.map(i => i.uid)).size).toBe(items.length)
  })
  it('NPC도 자기 시야와 실제 돌을 사용하며 플레이어의 현재 시야를 대신 쓰지 않는다', () => {
    const d = setup(), npcStone = makeItem(d.w, 'Item.Stone'); addToBag(d.w, d.target, npcStone); d.s.visible = []; d.s.rng.combat = [0, 0, 0, 0]
    expect(throwQuote(d.w, d.target, npcStone.uid, d.p.id).error).toBeNull()
    const hp = d.p.hp
    expect(perform(d.w, d.target, { type: 'throwAttack', uid: npcStone.uid, target: d.p.id })).toEqual({ ok: true, tu: 100 })
    expect(d.p.hp).toBeLessThan(hp); expect(d.target.bag).toEqual([]); expect(tileAt(d.w, d.p.pos).items.some(i => i.uid === npcStone.uid && i.count === 1)).toBe(true)
  })
})

describe('투척 콘텐츠 검증', () => {
  it('없는/음수/분수 거리와 잘못된 공격 수치를 Def 로드에서 거절한다', () => {
    const packages = readPackages()
    for (const [path, value] of [['range', 0], ['range', 2.5], ['effective', 7], ['attack/damage', -1], ['attack/energy', null], ['attack/damageType', 'gunshot']] as const) {
      const loaded = loadMods([...packages, { manifest: { id: 'throw-invalid', name: '잘못된 투척', version: '1', dependencies: ['core'] }, defs: [], patches: [{ op: 'replace', target: 'Item.Stone', path: '/throwable/' + path, value }] }], ['throw-invalid'])
      expect(loaded.report.errors.some(e => e.includes('throwable') || e.includes('투척'))).toBe(true)
    }
  })
})


describe('돌을 던지는 실제 팔의 골절 하중',()=>{
 it('던질 수 있는 금 간 팔을 실제 사용하면 기존3% 하중 판정을 거친다',()=>{const d=setup(),wound=addWound(d.w,d.p,{def:'Wound.Bruise',part:'RightForearm',severity:1,source:'기존 금 간 팔'}).wound;wound.fracture={grade:'hairline',progress:0};d.s.rng.body=[0,0,0,0];expect(throwQuote(d.w,d.p,d.stone.uid,d.target.id).wield?.arm).toBe('rarm');expect(attack(d).ok).toBe(true);expect(wound.fracture.grade).toBe('simple')})
 it('쓰지 않은 왼팔의 금과 무효 입력은 새 하중을 만들지 않는다',()=>{const d=setup(),wound=addWound(d.w,d.p,{def:'Wound.Bruise',part:'LeftForearm',severity:1,source:'기존 금 간 팔'}).wound;wound.fracture={grade:'hairline',progress:0};d.s.rng.body=[0,0,0,0];expect(throwQuote(d.w,d.p,d.stone.uid,d.target.id).wield?.arm).toBe('rarm');expect(attack(d).ok).toBe(true);expect(wound.fracture.grade).toBe('hairline');unchangedFailure(d,-1);expect(wound.fracture.grade).toBe('hairline')})
})

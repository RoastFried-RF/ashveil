import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { createCreature } from '../src/core/creatures'
import { player, tileAt } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { projectileReady } from '../src/core/ranged'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { db, makeWorld } from './helpers'

function setup(count = 6) {
  const w = makeWorld('crossbow', 'Bg.GuardArchivist'), p = player(w)
  p.age = undefined; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.bag = []; p.body.wounds = []; p.effects = []; p.body.blood = p.body.bloodMax; p.hp = 90; p.needs.stress = 0; p.needs.fatigue = 20; p.needs.bodyTemp = 37
  p.pos = { x: 20, y: 20 }; w.s.creatures = [p]; w.s.time = 14400 * 100; p.nextAct = w.s.time; w.s.map.lights = []; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  invalidateLights(w)
  const bow = makeItem(w, 'Item.LightCrossbow'), ammo = makeItem(w, 'Item.Bolt', count); p.equip.main = bow; addToBag(w, p, ammo)
  const target = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }); target.equip = {}; w.s.creatures.push(target)
  return { w, p, bow, ammo, target }
}
function finish(w: ReturnType<typeof makeWorld>) { for (let i = 0; player(w).activity && i < 1000; i++) activityStep(w, player(w)); expect(player(w).activity).toBeUndefined() }

describe('석궁 장전의 시간·탄약·저장', () => {
  it('빈 석궁 사격은 우선4턴 장전하며 완료 전에 탄약이나 기력을 쓰지 않는다', () => {
    const { w, p, bow, ammo, target } = setup(), energy = p.needs.energy, hp = target.hp
    expect(perform(w, p, { type: 'shoot', target: target.id }).ok).toBe(true)
    expect(p.activity?.kind).toBe('reload'); expect(p.activity?.total).toBe(4); expect(ammo.count).toBe(6); expect(p.needs.energy).toBe(energy); expect(target.hp).toBe(hp)
    finish(w); expect(ammo.count).toBe(5); expect(bow.loadedAmmo).toBe('Item.Bolt'); expect(projectileReady(w, p, bow)).toBe(true)
  })
  it('중단은 탄약을 남기고 중간 저장 후 완료 상태는 같다', () => {
    const { w, p, bow, ammo } = setup(); perform(w, p, { type: 'reload', uid: bow.uid }); activityStep(w, p); p.activity = undefined; expect(ammo.count).toBe(6)
    perform(w, p, { type: 'reload', uid: bow.uid }); activityStep(w, p); activityStep(w, p)
    const restored = { db, s: deserialize(serialize(w.s)) }; finish(w); finish(restored); expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('장전한 탄약만 한 발 쓰고 다음 사격 입력은 다시 장전한다', () => {
    const { w, p, bow, ammo, target } = setup(); perform(w, p, { type: 'reload', uid: bow.uid }); finish(w)
    expect(perform(w, p, { type: 'shoot', target: target.id }).ok).toBe(true); expect(bow.loadedAmmo).toBeUndefined(); expect(ammo.count).toBe(5)
    const energy = p.needs.energy; expect(perform(w, p, { type: 'shoot', target: target.id }).ok).toBe(true); expect(p.activity?.kind).toBe('reload'); expect(p.needs.energy).toBe(energy)
  })
  it('마지막 탄약이 배낭에서 사라져도 장전된 한 발은 쏠 수 있다', () => {
    const { w, p, bow, target } = setup(1); perform(w, p, { type: 'reload', uid: bow.uid }); finish(w); expect(p.bag.some((i) => i.def === 'Item.Bolt')).toBe(false)
    expect(perform(w, p, { type: 'shoot', target: target.id }).ok).toBe(true); expect(bow.loadedAmmo).toBeUndefined()
    expect(perform(w, p, { type: 'reload', uid: bow.uid }).msg).toContain('탄약이 없다')
  })
  it('선택한 탄약/무기 UID가 사라지면 다른 물건으로 대체하거나 탄약을 소비하지 않는다', () => {
    const { w, p, bow, ammo } = setup(); perform(w, p, { type: 'reload', uid: bow.uid }); p.bag = p.bag.filter((i) => i.uid !== ammo.uid)
    const spare = makeItem(w, 'Item.Bolt', 2); addToBag(w, p, spare); finish(w); expect(bow.loadedAmmo).toBeUndefined(); expect(spare.count).toBe(2)
    perform(w, p, { type: 'reload', uid: bow.uid }); delete p.equip.main; finish(w); expect(spare.count).toBe(2)
  })
  it('망가진 시위·불충분한 손·중복 장전은 시작하지 않는다', () => {
    const { w, p, bow } = setup(); bow.bowBroken = true; expect(perform(w, p, { type: 'reload', uid: bow.uid }).msg).toContain('시위'); bow.bowBroken = false
    p.body.missing = ['RightUpperArm']; expect(perform(w, p, { type: 'reload', uid: bow.uid }).msg).toContain('손 상태'); p.body.missing = []
    perform(w, p, { type: 'reload', uid: bow.uid }); finish(w); expect(perform(w, p, { type: 'reload', uid: bow.uid }).msg).toContain('이미 장전')
  })
  it('장전 마지막 구간의 NPC 차례도 다음 입력 전에 처리한다', () => {
    const { w, p, bow, target } = setup(); target.faction = p.faction; target.nextAct = w.s.time + 50; target.ai.mode = 'idle'
    expect(playerAct(w, { type: 'reload', uid: bow.uid })).toBeNull()
    expect(w.s.time).toBe(14400 * 100 + 400); expect(target.nextAct).toBeGreaterThan(w.s.time); expect(p.nextAct).toBe(w.s.time)
  })
  it('실제 게임 장전은4턴이 흐르고 장전 후 저장·버리기·줍기가 한 발을 보존한다', () => {
    const { w, p, bow, ammo } = setup(); w.s.creatures = [p]; const time = w.s.time
    expect(playerAct(w, { type: 'reload', uid: bow.uid })).toBeNull(); expect(w.s.time - time).toBe(400); expect(ammo.count).toBe(5)
    expect(playerAct(w, { type: 'drop', uid: bow.uid })).toBeNull(); const dropped = tileAt(w, p.pos).items.find((i) => i.uid === bow.uid)!
    expect(dropped.loadedAmmo).toBe('Item.Bolt'); expect(playerAct(w, { type: 'pickup', uid: bow.uid })).toBeNull()
    const restored = { db, s: deserialize(serialize(w.s)) }; expect(player(restored).bag.find((i) => i.uid === bow.uid)?.loadedAmmo).toBe('Item.Bolt')
  })
})

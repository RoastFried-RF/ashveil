import { describe, expect, it } from 'vitest'
import { killCreature } from '../src/core/combat'
import { player, tileAt } from '../src/core/ctx'
import { playerAct } from '../src/core/game'
import { deserialize, serialize } from '../src/core/save'
import { unseenDeathFixture } from './unseen-death-fixture'

describe('관찰한 죽음과 시야 밖의 실제 죽음', () => {
  it('실제 한 걸음으로 가려진 뒤 출혈사한 타인의 시체/혈액은 남지만 목격·사인 로그는 생기지 않는다', () => {
    const { w, targetId } = unseenDeathFixture(), target = w.s.creatures.find(c => c.id === targetId)!, p = player(w)
    expect(w.s.visible).toContain(target.pos.y * w.s.map.w + target.pos.x)
    expect(playerAct(w, { type: 'move', dir: 4 })).toBeNull()
    expect(target.alive).toBe(true); expect(target.body.blood).toBe(2510)
    expect(w.s.visible).not.toContain(target.pos.y * w.s.map.w + target.pos.x)
    const thoughts = structuredClone(p.thoughts), log = structuredClone(w.s.log), observed = structuredClone(tileAt(w, target.pos).observed)
    expect(playerAct(w, { type: 'wait' })).toBeNull()
    expect(target.alive).toBe(false); expect(target.body.blood).toBe(2462); expect(target.deathCause).toBe('과다 출혈')
    expect(p.thoughts).toEqual(thoughts); expect(w.s.log).toEqual(log)
    expect(tileAt(w, target.pos).observed).toEqual(observed)
    expect(w.s.creatures.filter(c => c.id === targetId)).toHaveLength(1)
    const raw = serialize(w.s), restored = deserialize(raw)
    expect(restored).toEqual(JSON.parse(raw))
  })
  it('실제 보이는 같은 출혈사는 목격 기분과 사인 로그를 남긴다', () => {
    const { w, targetId } = unseenDeathFixture(false), p = player(w)
    expect(playerAct(w, { type: 'move', dir: 4 })).toBeNull(); expect(playerAct(w, { type: 'wait' })).toBeNull()
    expect(w.s.creatures.find(c => c.id === targetId)!.alive).toBe(false)
    expect(p.thoughts.some(t => t.def === 'Thought.SawDeath')).toBe(true)
    expect(w.s.log.some(e => e.text.includes('쓰러졌다') && e.text.includes('과다 출혈'))).toBe(true)
  })
  it('자기 상처로 쓰러뜨린 적의 원래 처치·경험치·책임은 가려져도 유지하되 사인을 중계하지 않는다', () => {
    const { w, targetId } = unseenDeathFixture(true, true), p = player(w), xp = p.xp
    expect(playerAct(w, { type: 'move', dir: 4 })).toBeNull(); expect(playerAct(w, { type: 'wait' })).toBeNull()
    expect(w.s.creatures.find(c => c.id === targetId)!.alive).toBe(false)
    expect(p.xp).toBeGreaterThan(xp); expect(w.s.knowledge.bestiary['Creature.Reaver'].killed).toBe(1)
    expect(p.thoughts.some(t => t.def === 'Thought.KilledHuman')).toBe(true)
    expect(p.thoughts.some(t => t.def === 'Thought.SawDeath')).toBe(false)
    expect(w.s.log.some(e => e.text.includes('쓰러졌다'))).toBe(false)
  })
  it('보지도 기여하지도 않은 종의 죽음은 새 도감 기록을 만들지 않는다', () => {
    const { w, targetId } = unseenDeathFixture(), target = w.s.creatures.find(c => c.id === targetId)!
    target.pos = { x: 40, y: 40 }; delete w.s.knowledge.bestiary[target.def]
    const log = structuredClone(w.s.log); killCreature(w, target, '과다 출혈')
    expect(w.s.knowledge.bestiary[target.def]).toBeUndefined(); expect(w.s.log).toEqual(log)
    expect(player(w).thoughts.some(t => t.def === 'Thought.SawDeath')).toBe(false)
  })
  it.each(['asleep', 'unconscious'] as const)('잠들거나 실신한 관찰자에게 무음 죽음이 목격으로 기록되지 않는다: %s', condition => {
    const { w, targetId } = unseenDeathFixture(false), p = player(w), target = w.s.creatures.find(c => c.id === targetId)!
    p[condition] = true; const log = structuredClone(w.s.log); killCreature(w, target, '과다 출혈')
    expect(p.thoughts.some(t => t.def === 'Thought.SawDeath')).toBe(false); expect(w.s.log).toEqual(log)
  })
})

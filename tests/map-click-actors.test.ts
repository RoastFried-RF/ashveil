import { describe, expect, it } from 'vitest'
import { observedClickActors } from '../src/client/map-click-actors'
import { playerAct } from '../src/core/game'
import { serialize } from '../src/core/save'
import { unseenDeathFixture } from './unseen-death-fixture'

describe('현재 보이는 맵 클릭 대상', () => {
  it('같은 실제 개체가 가려지면 살아 있거나 죽어도 클릭 대상으로 공개하지 않는다', () => {
    const { w, targetId } = unseenDeathFixture(), target = w.s.creatures.find(c => c.id === targetId)!, pos = { ...target.pos }
    expect(observedClickActors(w, pos).actor).toBe(target)
    expect(playerAct(w, { type: 'move', dir: 4 })).toBeNull()
    expect(observedClickActors(w, pos)).toEqual({})
    expect(playerAct(w, { type: 'wait' })).toBeNull(); expect(target.alive).toBe(false)
    expect(observedClickActors(w, pos)).toEqual({})
    expect(playerAct(w, { type: 'move', dir: 0 })).toBeNull()
    const raw = serialize(w.s)
    expect(observedClickActors(w, pos).corpse).toBe(target)
    expect(serialize(w.s)).toBe(raw)
  })
  it('기억한 칸의 숨은 개체 위치·몸·생사 getter를 호출하지 않는다', () => {
    const { w, targetId } = unseenDeathFixture(), target = w.s.creatures.find(c => c.id === targetId)!, pos = { ...target.pos }
    expect(playerAct(w, { type: 'move', dir: 4 })).toBeNull()
    for (const key of ['pos', 'body', 'alive', 'deathCause']) Object.defineProperty(target, key, { get() { throw Error('Hidden field read: ' + key) } })
    expect(observedClickActors(w, pos)).toEqual({})
    expect(observedClickActors(w, { x: -1, y: -1 })).toEqual({})
  })
  it('이미 떠난 개체를 남아 있는 시체로 선택하지 않는다', () => {
    const { w, targetId } = unseenDeathFixture(), target = w.s.creatures.find(c => c.id === targetId)!
    target.alive = false; target.deathCause = 'escaped'
    expect(observedClickActors(w, target.pos).corpse).toBeUndefined()
  })
})

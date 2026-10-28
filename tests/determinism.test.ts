import { describe, expect, it } from 'vitest'
import { botDecide } from '../src/core/bot'
import { playerAct } from '../src/core/game'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { db, makeWorld } from './helpers'

function play(seed: string, steps: number) {
  const w = makeWorld(seed)
  for (let i = 0; i < steps && !w.s.over; i++) {
    if (playerAct(w, botDecide(w))) playerAct(w, { type: 'wait' })
  }
  return w
}

describe('결정론', () => {
  it('같은 시드 + 같은 입력 → 같은 상태 해시', () => {
    expect(stateHash(play('det-1', 200).s)).toBe(stateHash(play('det-1', 200).s))
  }, 60000)
  it('다른 시드 → 다른 세계', () => {
    expect(stateHash(makeWorld('a').s)).not.toBe(stateHash(makeWorld('b').s))
  })
  it('저장 → 불러오기 후 이어서 진행해도 결과가 같다', () => {
    const a = play('det-2', 150)
    const b = { db, s: deserialize(serialize(a.s)) }
    for (let i = 0; i < 100 && !a.s.over; i++) {
      const act = botDecide(a)
      expect(botDecide(b)).toEqual(act)
      if (playerAct(a, act)) playerAct(a, { type: 'wait' })
      if (playerAct(b, act)) playerAct(b, { type: 'wait' })
    }
    expect(stateHash(b.s)).toBe(stateHash(a.s))
  }, 60000)
})

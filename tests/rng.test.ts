import { describe, expect, it } from 'vitest'
import { Rng, seedState } from '../src/core/rng'

describe('rng', () => {
  it('같은 시드·스트림은 같은 수열', () => {
    const a = new Rng(seedState('x', 'combat'))
    const b = new Rng(seedState('x', 'combat'))
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })
  it('스트림이 다르면 수열이 다름', () => {
    const a = new Rng(seedState('x', 'combat'))
    const b = new Rng(seedState('x', 'loot'))
    expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()])
  })
  it('float 은 [0,1), int 는 양끝 포함', () => {
    const r = new Rng(seedState('y', 'world'))
    let lo = false, hi = false
    for (let i = 0; i < 5000; i++) {
      const f = r.float()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const n = r.int(1, 3)
      if (n === 1) lo = true
      if (n === 3) hi = true
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(3)
    }
    expect(lo && hi).toBe(true)
  })
})

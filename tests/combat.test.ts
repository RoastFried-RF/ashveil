import { describe, expect, it } from 'vitest'
import { previewHit } from '../src/core/combat'
import { player } from '../src/core/ctx'
import { createCreature } from '../src/core/creatures'
import { makeWorld } from './helpers'

describe('전투 공식', () => {
  it('명중률은 5~95로 제한된다', () => {
    const w = makeWorld('c1', 'Bg.Deserter')
    const pl = player(w)
    const rat = createCreature(w, 'Creature.BurrowRat', { x: pl.pos.x + 1, y: pl.pos.y })
    w.s.creatures.push(rat)
    const pv = previewHit(w, pl, rat)!
    expect(pv.chance).toBeGreaterThanOrEqual(5)
    expect(pv.chance).toBeLessThanOrEqual(95)
    expect(pv.lines.at(-1)).toContain('최종')
  })
  it('후면 공격은 정면보다 명중이 20 높다 (같은 조건)', () => {
    const w = makeWorld('c2', 'Bg.Deserter')
    const pl = player(w)
    const h = createCreature(w, 'Creature.AshHound', { x: pl.pos.x + 1, y: pl.pos.y })
    w.s.creatures.push(h)
    h.facing = 6 // 서쪽(플레이어 쪽)을 봄 → 정면
    const front = previewHit(w, pl, h)!.chance
    h.facing = 2 // 동쪽을 봄 → 플레이어는 등 뒤
    const back = previewHit(w, pl, h)!.chance
    if (front + 20 <= 95) expect(back - front).toBe(20)
    else expect(back).toBe(95)
  })
  it('방어구 기대 피해 배율 검산: 방어 0.8 관통 0.2 → 0.55', () => {
    const eff = 0.8 - 0.2
    const deflect = eff / 2, half = eff - deflect, full = 1 - eff
    expect(deflect * 0 + half * 0.5 + full * 1).toBeCloseTo(0.55, 5)
  })
})

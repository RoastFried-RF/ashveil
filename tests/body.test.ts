import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { addWound, bloodLoss, bodyTick, capacity, consciousness, deathCause, effectiveBleed } from '../src/core/body'
import { player } from '../src/core/ctx'
import { makeWorld } from './helpers'

describe('신체·출혈', () => {
  it('출혈량 공식: 심각도 × 크기계수 × 상처계수 × 부위계수 (× 동맥 4)', () => {
    const w = makeWorld('b1')
    const pl = player(w)
    // 베임 1.8, 심각도 12 → 크기계수 1.0 → 21.6 ml/턴
    const { wound } = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftLeg', severity: 12, source: 't' })
    expect(wound.bleed).toBeCloseTo(21.6, 1)
    // 같은 상처가 동맥이면 ×4 = 86.4
    const { wound: art } = addWound(w, pl, { def: 'Wound.Cut', part: 'RightLeg', severity: 12, source: 't', arterial: true })
    expect(art.bleed).toBeCloseTo(86.4, 1)
    // 작은 상처(3)는 크기계수 0.25 → 1.8×3×0.25 = 1.35 → 1.4
    const { wound: small } = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftArm', severity: 3, source: 't' })
    expect(small.bleed).toBeCloseTo(1.4, 1)
  })
  it('지혈대는 해당 팔다리 출혈을 0으로, 붕대는 동맥에 약하다', () => {
    const w = makeWorld('b2')
    const pl = player(w)
    const { wound } = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftLeg', severity: 12, source: 't', arterial: true })
    wound.bandage = { quality: 'clean', infectionMult: 0.6, bleedMult: 0.1, arterialMult: 0.6 }
    expect(effectiveBleed(w, pl, wound)).toBeCloseTo(86.4 * 0.6, 1)
    pl.body.tourniquets.LeftLeg = 0
    expect(effectiveBleed(w, pl, wound)).toBe(0)
  })
  it('혈액 50% 손실이면 과다 출혈 사망, 40%면 의식 저하', () => {
    const w = makeWorld('b3')
    const pl = player(w)
    pl.body.blood = pl.body.bloodMax * 0.6
    expect(consciousness(w, pl)).toBeLessThanOrEqual(0.5)
    expect(deathCause(w, pl)).toBeNull()
    pl.body.blood = pl.body.bloodMax * 0.5
    expect(deathCause(w, pl)).toBe('과다 출혈')
  })
  it('다리를 다치면 이동 능력이 줄어든다', () => {
    const w = makeWorld('b4')
    const pl = player(w)
    expect(capacity(w, pl, 'moving')).toBeCloseTo(1, 2)
    addWound(w, pl, { def: 'Wound.Bruise', part: 'LeftLeg', severity: 15, source: 't', fracture: true })
    expect(capacity(w, pl, 'moving')).toBeLessThan(0.85)
  })
  it('불변식: 무작위 상처를 줘도 혈액량은 0~최대, 손실률은 0~1', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ part: fc.constantFrom('Torso', 'LeftLeg', 'RightArm', 'Head', 'LeftHand'), sev: fc.double({ min: 0.5, max: 30, noNaN: true }), art: fc.boolean() }), { maxLength: 6 }),
      fc.integer({ min: 1, max: 200 }),
      (wounds, ticks) => {
        const w = makeWorld('prop')
        const pl = player(w)
        for (const x of wounds) addWound(w, pl, { def: 'Wound.Cut', part: x.part, severity: x.sev, source: 'p', arterial: x.art })
        for (let i = 0; i < ticks; i++) bodyTick(w, pl, false)
        expect(pl.body.blood).toBeGreaterThanOrEqual(0)
        expect(pl.body.blood).toBeLessThanOrEqual(pl.body.bloodMax)
        const loss = bloodLoss(pl)
        expect(loss).toBeGreaterThanOrEqual(0)
        expect(loss).toBeLessThanOrEqual(1)
        for (const wd of pl.body.wounds) expect(wd.bleed).toBeGreaterThanOrEqual(0)
      },
    ), { numRuns: 60 })
  })
})

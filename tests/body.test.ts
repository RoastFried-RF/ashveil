import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  addWound, bandageCoef, bloodLoss, bodyTick, capacity, consciousness, deathCause, effectiveBleed, hpCap, legEff, regionHpPct, regionState,
} from '../src/core/body'
import { layerOdds } from '../src/core/combat'
import { player } from '../src/core/ctx'
import { makeWorld } from './helpers'

describe('신체·출혈 (02)', () => {
  it('상처 출혈 = sev × 유형 출혈계수 × 부위 혈관계수, 동맥은 고정값 (02 §6.1·§6.2)', () => {
    const w = makeWorld('b1')
    const pl = player(w)
    pl.traits = []
    // 대퇴 베임 sev 15 → 15 × 2.0 × 1.2 = 36 ml/턴
    const { wound } = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftThigh', severity: 15, source: 't' })
    expect(wound.bleed).toBeCloseTo(36, 5)
    expect(effectiveBleed(w, pl, wound)).toBeCloseTo(36, 5)
    // 대퇴동맥 150 + 상처 36 = 186 ml/턴
    const { wound: art } = addWound(w, pl, { def: 'Wound.Cut', part: 'RightThigh', severity: 15, source: 't', artery: 150 })
    expect(effectiveBleed(w, pl, art)).toBeCloseTo(186, 5)
  })
  it('붕대 Q 29: 처치계수 0.384 · 동맥 0.742 → 약 125 ml/턴, 지혈대는 0 (02 §6.2 검산 3)', () => {
    const w = makeWorld('b2')
    const pl = player(w)
    pl.traits = []
    expect(bandageCoef(29, false)).toBeCloseTo(0.384, 5)
    expect(bandageCoef(29, true)).toBeCloseTo(0.742, 5)
    // 응급 처치: 1 − (1 − 0.384) × 1.5 = 0.076 → 하한 0.15 (15 검산 5)
    expect(bandageCoef(29, false, 0.5)).toBeCloseTo(0.15, 5)
    const { wound } = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftThigh', severity: 15, source: 't', artery: 150 })
    wound.bandage = { quality: 29, at: 0 }
    expect(effectiveBleed(w, pl, wound)).toBeCloseTo(36 * 0.384 + 150 * 0.742, 3)
    pl.body.tourniquets.LeftThigh = 0
    expect(effectiveBleed(w, pl, wound)).toBe(0)
  })
  it('검산 0-1: 오른팔 D 13 → 62% 타박, D 9 추가 → 37% 부상, 회복 상한 89 (02 §2.0.4)', () => {
    const w = makeWorld('b5')
    const pl = player(w)
    pl.stats.vit = 10
    pl.traits = []
    pl.abilities = []
    pl.equip = {}
    addWound(w, pl, { def: 'Wound.Cut', part: 'RightUpperArm', severity: 13, source: 't' })
    expect(regionHpPct(w, pl, 'rarm')).toBe(62)
    expect(regionState(w, pl, 'rarm')).toBe(1)
    addWound(w, pl, { def: 'Wound.Cut', part: 'RightForearm', severity: 9, source: 't' })
    expect(regionHpPct(w, pl, 'rarm')).toBe(37)
    expect(regionState(w, pl, 'rarm')).toBe(2)
    expect(hpCap(w, pl)).toBe(89)
  })
  it('검산 0-2: 정강이 단순 골절(미처치 0.1) → 다리효율 0.1 → 중상, HP%는 60 타박 (02 §2.0.4)', () => {
    const w = makeWorld('b6')
    const pl = player(w)
    pl.stats.vit = 10
    pl.traits = []
    pl.abilities = []
    pl.equip = {}
    addWound(w, pl, { def: 'Wound.Bruise', part: 'LeftShin', severity: 16, source: 't', fracture: { grade: 'simple', progress: 0 } })
    expect(regionHpPct(w, pl, 'lleg')).toBe(60)
    expect(legEff(w, pl, 'Left')).toBeCloseTo(0.1, 5)
    expect(regionState(w, pl, 'lleg')).toBe(3)
    // 한 다리 < 0.2 → 이동 = 다른 다리 × 0.3
    expect(capacity(w, pl, 'moving')).toBeCloseTo(0.3, 2)
  })
  it('혈액 50% 손실이면 과다 출혈 사망, 40%면 의식 0.6 (P혈액 0.4)', () => {
    const w = makeWorld('b3')
    const pl = player(w)
    pl.body.blood = pl.body.bloodMax * 0.6
    expect(consciousness(w, pl)).toBeCloseTo(0.6, 2)
    expect(deathCause(w, pl)).toBeNull()
    pl.body.blood = pl.body.bloodMax * 0.5
    expect(deathCause(w, pl)).toBe('과다 출혈')
  })
  it('방어구 층 정수 판정: 유효 37 → 튕김 19% · 절반 18% · 관통 63%, 유효 40 → 20/20/60 (07 §2.4)', () => {
    expect(layerOdds(37, false)).toEqual([19, 18, 63])
    expect(layerOdds(40, false)).toEqual([20, 20, 60])
    // 갑옷 우그러뜨리기: 4 × roll < 유효 → 튕김 ⌈37/4⌉ = 10%
    expect(layerOdds(37, true)).toEqual([10, 27, 63])
  })
  it('불변식: 무작위 상처를 줘도 혈액량은 0~최대, 손실률은 0~1', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ part: fc.constantFrom('Chest', 'LeftThigh', 'RightUpperArm', 'Skull', 'LeftHand', 'Abdomen'), sev: fc.integer({ min: 1, max: 30 }), art: fc.boolean() }), { maxLength: 6 }),
      fc.integer({ min: 1, max: 200 }),
      (wounds, ticks) => {
        const w = makeWorld('prop')
        const pl = player(w)
        for (const x of wounds) addWound(w, pl, { def: 'Wound.Cut', part: x.part, severity: x.sev, source: 'p', artery: x.art ? 90 : 0 })
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

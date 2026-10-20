import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, normalizePreferences } from '../src/client/preferences'

describe('화면 설정 호환', () => {
  it('손상·구버전 설정은 알려진 필드만 복원한다', () => {
    for (const raw of [null, 4, [], '잘못된 설정']) expect(normalizePreferences(raw)).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({ logFontSize: 20, oldSetting: true, palette: 'redgreen' })).toEqual({ ...DEFAULT_PREFERENCES, logFontSize: 20, palette: 'redgreen' })
  })
  it('깜빡임을 끈 false와 즉시 연출 0을 기본값으로 덮어쓰지 않는다', () => {
    expect(normalizePreferences({ animationSpeed: 0, screenShake: false, torchFlicker: false, hitFlash: false, warningPulse: false })).toEqual({ ...DEFAULT_PREFERENCES, animationSpeed: 0, screenShake: false, torchFlicker: false, hitFlash: false, warningPulse: false })
  })
  it('범위를 벗어난 글자와 잘못된 enum·숫자는 안전한 값으로 읽는다', () => {
    expect(normalizePreferences({ logFontSize: 100 }).logFontSize).toBe(24)
    expect(normalizePreferences({ logFontSize: -5 }).logFontSize).toBe(12)
    expect(normalizePreferences({ logFontSize: Infinity, animationSpeed: -1, palette: 'invalid', floaters: '<script>', screenShake: 0 })).toEqual(DEFAULT_PREFERENCES)
    const p = normalizePreferences({}); p.logFontSize = 24
    expect(DEFAULT_PREFERENCES.logFontSize).toBe(12)
  })
  it('키 반복 설정은 과거 배치를 유지하고 손상된 값만 제한한다',()=>{
    const p=normalizePreferences({keyRepeatMode:'limited',keyRepeatDelay:0,keyRepeatInterval:50,keyBindings:{north:['KeyA']}})
    expect(p.keyRepeatMode).toBe('limited');expect(p.keyRepeatDelay).toBe(0);expect(p.keyRepeatInterval).toBe(50);expect(p.keyBindings.north).toEqual(['KeyA'])
    expect(normalizePreferences({keyRepeatMode:'invalid',keyRepeatDelay:NaN,keyRepeatInterval:Infinity})).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({keyRepeatDelay:-1,keyRepeatInterval:0})).toMatchObject({keyRepeatDelay:0,keyRepeatInterval:50})
    expect(normalizePreferences({keyRepeatDelay:9999,keyRepeatInterval:9999})).toMatchObject({keyRepeatDelay:2000,keyRepeatInterval:1000})
  })

  it('읽기 지원은 구형 설정에서 꺼져 있고 실제 0.5배와 손상 범위를 구분한다',()=>{
    expect(normalizePreferences({}).speechEnabled).toBe(false)
    expect(normalizePreferences({speechEnabled:true,speechRate:.5})).toMatchObject({speechEnabled:true,speechRate:.5})
    expect(normalizePreferences({speechRate:100}).speechRate).toBe(2);expect(normalizePreferences({speechRate:-1}).speechRate).toBe(.5)
    expect(normalizePreferences({speechEnabled:'true',speechRate:Infinity})).toEqual(DEFAULT_PREFERENCES)
  })

})

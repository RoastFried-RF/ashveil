import {afterEach, describe, expect, it} from 'vitest'
import {computed} from 'vue'
import english from '../src/client/locales/en.json'
import {translate} from '../src/client/locales/message'
import {t, keyLabel} from '../src/client/locale'
import {DEFAULT_PREFERENCES, normalizePreferences, preferences} from '../src/client/preferences'

afterEach(() => {preferences.language = 'ko'})

describe('explicit presentation language boundary', () => {
  it('preserves Korean by default, old preferences and explicit saved key bindings', () => {
    expect(DEFAULT_PREFERENCES.language).toBe('ko')
    for (const language of [null, 0, {}, 'EN', 'en-US', '__proto__']) expect(normalizePreferences({language}).language).toBe('ko')
    expect(normalizePreferences({language:'en', keyBindings:{north:['KeyA']}})).toMatchObject({language:'en', keyBindings:{north:['KeyA']}})
    expect(normalizePreferences({}).language).toBe('ko')
  })
  it('reacts without reloading or replacing a world', () => {
    const title = computed(() => t('새 떠돌이'))
    expect(title.value).toBe('새 떠돌이')
    preferences.language = 'en'
    expect(title.value).toBe('New wanderer')
    preferences.language = 'ko'
    expect(title.value).toBe('새 떠돌이')
  })
  it('uses exact keys and preserves unknown text and personal names', () => {
    for (const source of ['검증용 떠돌이', '알 수 없는 모드 원문', '__proto__', 'constructor', ' 새 떠돌이 ']) expect(translate(source, 'en')).toBe(source)
    expect(translate('새 떠돌이','ko')).toBe('새 떠돌이')
    expect(translate('새 떠돌이','en')).toBe('New wanderer')
  })
  it('reorders placeholders once without treating values as markup or more placeholders', () => {
    const value = '<script>{0}$&</script>'
    expect(translate('{0} 키 변경','en',value)).toBe('Change key for '+value)
    expect(translate('{0}세 · {1}','en',27,'검증용 떠돌이')).toBe('Age 27 · 검증용 떠돌이')
    expect(translate('{0}세 · {1}','ko',27,'검증용 떠돌이')).toBe('27세 · 검증용 떠돌이')
    expect(translate('{0}세 · {1}','en',0)).toBe('Age 0 · {1}')
  })
  it('keeps every reviewed catalog placeholder and rejects empty English entries', () => {
    const placeholders = (source:string) => [...source.matchAll(/\{\d+\}/g)].map(match=>match[0]).sort()
    for (const [source, target] of Object.entries(english)) {
      expect(target.trim(),source).not.toBe('')
      expect(placeholders(target),source).toEqual(placeholders(source))
    }
  })
  it('does not change source objects when translating their display fields', () => {
    const source = Object.freeze({name:'검증용 떠돌이',label:'새 떠돌이',log:Object.freeze(['기존 사건 원문'])})
    preferences.language = 'en'
    expect(t(source.label)).toBe('New wanderer')
    expect(source).toEqual({name:'검증용 떠돌이',label:'새 떠돌이',log:['기존 사건 원문']})
  })
  it('only changes physical key display labels and preserves the bindings', () => {
    preferences.language = 'en'
    expect(keyLabel('Ctrl+숫자패드 8 / 공백')).toBe('Ctrl+Numpad 8 / Space')
    expect(keyLabel('미배정')).toBe('Unbound')
    preferences.language = 'ko'
    expect(keyLabel('Ctrl+숫자패드 8 / 공백')).toBe('Ctrl+숫자패드 8 / 공백')
  })
})

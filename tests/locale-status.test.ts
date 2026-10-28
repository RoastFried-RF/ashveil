import {afterEach,describe,expect,it} from 'vitest'
import {computeBanners} from '../src/client/warnings'
import {preferences} from '../src/client/preferences'
import {player} from '../src/core'
import {serialize} from '../src/core/save'
import {makeWorld} from './helpers'
import {thermalFixture} from './thermal-fixture'

afterEach(()=>{preferences.language='ko'})

describe('status language preserves warning behavior',()=>{
  it('keeps fatal acknowledgment identity Korean while translating visible warnings',()=>{
    const w=makeWorld('locale-fatal-warning','Bg.Deserter',true),p=player(w)
    p.hp=10;p.needs.bodyTemp=31;p.body.blood=p.body.bloodMax*.65
    const raw=serialize(w.s),original=computeBanners(w)
    preferences.language='en'
    expect(computeBanners(w)).toEqual(original)
    const english=computeBanners(w,'en')
    expect(english.map(({p,turns})=>({p,turns}))).toEqual(original.map(({p,turns})=>({p,turns})))
    expect(english).toHaveLength(3)
    expect(english.map(b=>b.text)).toEqual(['Blood loss 35%','HP 10 — critical','Body temperature 31.0°C'])
    expect(serialize(w.s)).toBe(raw)
  })
  it('retains thermal priority, actual estimates, order and full world for either language',()=>{
    const {w}=thermalFixture(),before=serialize(w.s)
    const korean=computeBanners(w),english=computeBanners(w,'en')
    expect(korean.some(b=>b.text.includes('불 곁에서도'))).toBe(true)
    expect(english.some(b=>b.text==='Cooling even by the fire · compare in Journal: Survival')).toBe(true)
    expect(english.map(b=>b.p)).toEqual(korean.map(b=>b.p))
    expect(serialize(w.s)).toBe(before)
  })
})

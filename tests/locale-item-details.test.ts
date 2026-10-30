import {afterEach,describe,expect,it} from 'vitest'
import {itemTip} from '../src/client/info'
import {translateDef,translateItemAttack} from '../src/client/locales/content'
import {preferences} from '../src/client/preferences'
import {makeItem} from '../src/core/items'
import {MISSING_ITEM} from '../src/core/missing-items'
import {serialize} from '../src/core/save'
import type {ItemDef} from '../src/core/types'
import {makeWorld} from './helpers'

afterEach(()=>{preferences.language='ko'})

describe('item detail display and knowledge boundaries',()=>{
  it('shows the original weapon numbers and public material/quality in English',()=>{
    const w=makeWorld('item-details'),knife=makeItem(w,'Item.RustyKnife')
    preferences.language='en'
    const tip=itemTip(w,knife),attack=w.db.item(knife.def).attacks![0]
    expect(tip.title).toBe('Rusty knife')
    expect(tip.lines).toContain(`Slash: Slash ${attack.damage} · penetration ${attack.pen} · accuracy +${attack.accuracy} · energy ${attack.energy}`)
    expect(tip.lines.some(l=>l.startsWith('Quality '))).toBe(true)
    expect(tip.lines).toContain('A dull blade that tears more than it cuts. It leaves dirty wounds.')
    expect(tip.lines.join('\n')).not.toMatch(/[가-힣]/)
    preferences.language='ko'
    const korean=itemTip(w,knife)
    expect(korean.lines).toContain(`베기: 베기 ${attack.damage} · 관통 ${attack.pen} · 정확도 +${attack.accuracy} · 기력 ${attack.energy}`)
    expect(korean.lines).toContain('날이 무뎌 베기보다 찢는다. 상처가 더럽다.')
  })
  it('keeps unknown relic functions private for instance and empty references',()=>{
    const w=makeWorld('item-details-relic'),arm=makeItem(w,'Item.PioneerArm')
    preferences.language='en'
    for(const level of [0,1] as const){
      arm.appraisal=level
      const tip=itemTip(w,arm)
      expect(tip.title).toBe('Warm metal arm')
      expect(tip.lines).toContain('A metal mass with a wrist-like joint. Slightly warm to the touch.')
      expect(tip.lines.join('\n')).not.toMatch(/base efficiency|Pioneer prosthetic|power cell|[가-힣]/i)
    }
    arm.appraisal=2
    expect(itemTip(w,arm).title).toBe('Pioneer prosthetic arm')
    expect(itemTip(w,arm).lines.some(l=>l.startsWith('Prosthetic · base efficiency'))).toBe(true)
    expect(itemTip(w,null,arm.def).title).toBe('Warm metal arm')
    expect(itemTip(w,null,arm.def).lines.join('\n')).not.toMatch(/base efficiency/)
  })
  it('guards both nested attack IDs and exact original text against mod replacements',()=>{
    const w=makeWorld(),d=w.db.item('Item.RustyKnife'),a=d.attacks![0]
    expect(translateItemAttack(d.id,a,'en')).toBe('Slash')
    expect(translateItemAttack('Item.Foreign',a,'en')).toBe(a.label)
    expect(translateItemAttack(d.id,{...a,id:'foreign'},'en')).toBe(a.label)
    expect(translateItemAttack(d.id,{...a,label:'모드 공격'},'en')).toBe('모드 공격')
    expect(translateDef({...d,description:'모드 설명'},'description','en')).toBe('모드 설명')
    const arm=w.db.item('Item.PioneerArm')
    expect(translateDef({...arm,unknownDescription:'다른 외형'},'unknownDescription','en')).toBe('다른 외형')
    expect(translateItemAttack(d.id,a,'ko')).toBe(a.label)
  })
  it('translates covered armor regions and the actual mixed material without changing its mass',()=>{
    const w=makeWorld('item-details-mix'),coat=makeItem(w,'Item.LeatherCoat')
    coat.stuff={body:[{material:'Material.Leather',massG:100},{material:'Material.Linen',massG:50}]}
    coat.wetness={torso:37};coat.maxDurability=74;coat.durability=45
    preferences.language='en'
    const tip=itemTip(w,coat),lines=tip.lines.join('\n')
    expect(lines).toContain('Tanned leather·Linen (mass-weighted mixture)')
    expect(lines).toContain('Tanned leather 100g · Linen 50g')
    expect(lines).toContain('Covers:')
    expect(lines).toContain('Maximum durability after repairs 74.0%')
    expect(lines).not.toMatch(/[가-힣]/)
  })
  it('does not use a hidden pill mapping and preserves every core item, saved world and RNG across language switches',()=>{
    const w=makeWorld('item-details-readonly'),items=w.db.all<ItemDef>('Item').filter(d=>d.id!==MISSING_ITEM).map(d=>makeItem(w,d.id))
    const pill=items.find(it=>it.def==='Item.PillYellow')!
    w.s.knowledge.pillMap[pill.def]='Pill.Toxin'
    const before=serialize(w.s),itemBefore=JSON.stringify(items)
    preferences.language='ko'
    const korean=items.map(it=>itemTip(w,it))
    preferences.language='en'
    for(const item of items)itemTip(w,item)
    expect(itemTip(w,pill).lines.join('\n')).not.toMatch(/Spoiled medicine|Drug\.Toxin/)
    preferences.language='ko'
    expect(items.map(it=>itemTip(w,it))).toEqual(korean)
    expect(serialize(w.s)).toBe(before)
    expect(JSON.stringify(items)).toBe(itemBefore)
  })
})

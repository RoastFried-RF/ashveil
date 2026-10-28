import {afterEach,describe,expect,it} from 'vitest'
import {displayItemDefLabel,displayItemLabel} from '../src/client/locales/item'
import {inventoryMatches} from '../src/client/inventory-filter'
import {preferences} from '../src/client/preferences'
import {itemLabel,makeItem} from '../src/core/items'
import {serialize} from '../src/core/save'
import {makeWorld} from './helpers'

afterEach(()=>{preferences.language='ko'})

describe('public localized item names',()=>{
  it('uses appearance and actual viewer belief without reading the hidden pill mapping',()=>{
    const w=makeWorld('localized-pills'),pill=makeItem(w,'Item.PillYellow')
    pill.pillRemaining=.75
    preferences.language='en'
    expect(displayItemLabel(w,pill)).toBe('Yellow pill (unidentified) [3/4 tablet]')
    w.s.knowledge.pillMap[pill.def]='Pill.Toxin'
    const before=serialize(w.s)
    expect(displayItemLabel(w,pill)).toBe('Yellow pill (unidentified) [3/4 tablet]')
    expect(inventoryMatches(w,pill,'all','Spoiled medicine',displayItemLabel(w,pill))).toBe(false)
    expect(serialize(w.s)).toBe(before)
    ;(w.s.knowledge.pillBeliefs??={})[pill.def]={belief:'Pill.Analgesic',confidence:'likely',ruledOut:[],evidence:[]}
    const beliefBefore=serialize(w.s)
    expect(displayItemLabel(w,pill)).toBe('Yellow pill (Painkiller suspected) [3/4 tablet]')
    expect(serialize(w.s)).toBe(beliefBefore)
  })
  it('does not disclose an unappraised relic in the title, empty hotbar or search',()=>{
    const w=makeWorld('localized-relic'),arm=makeItem(w,'Item.PioneerArm')
    preferences.language='en'
    expect(displayItemLabel(w,arm)).toBe('Warm metal arm')
    expect(displayItemDefLabel(w.db.item(arm.def))).toBe('Warm metal arm')
    expect(inventoryMatches(w,arm,'all','Pioneer prosthetic',displayItemLabel(w,arm))).toBe(false)
    arm.appraisal=2
    expect(displayItemLabel(w,arm)).toBe('Pioneer prosthetic arm')
    expect(inventoryMatches(w,arm,'all','Pioneer prosthetic',displayItemLabel(w,arm))).toBe(true)
    // Another empty reference has no right to borrow this instance's appraisal.
    expect(displayItemDefLabel(w.db.item(arm.def))).toBe('Warm metal arm')
  })
  it('searches English and original names with the same category and normalization rules',()=>{
    const w=makeWorld('localized-item-search'),bag=makeItem(w,'Item.MedicalBag')
    preferences.language='en';const label=displayItemLabel(w,bag),before=serialize(w.s)
    expect(label).toBe('Medical bag [5 uses]')
    for(const q of ['medicalbag','Ｍｅｄｉｃａｌ　ｂａｇ','의료가방'])expect(inventoryMatches(w,bag,'medical',q,label),q).toBe(true)
    expect(inventoryMatches(w,bag,'food','medical',label)).toBe(false)
    expect(serialize(w.s)).toBe(before)
  })
  it('retains Korean naming exactly and never rewrites item instances or saved state',()=>{
    const w=makeWorld('localized-item-preservation')
    const items=[makeItem(w,'Item.Jerky',3),makeItem(w,'Item.PillGreen'),makeItem(w,'Item.PioneerArm'),makeItem(w,'Item.Arrow',2),makeItem(w,'Item.Lantern')]
    items[1].pillRemaining=.5;items[2].appraisal=2;items[3].fletchingDamaged=true;items[4].lit=true
    const before=serialize(w.s),itemBefore=JSON.stringify(items)
    for(const language of ['ko','en','ko']as const){
      preferences.language=language
      for(const item of items){const label=displayItemLabel(w,item);if(language==='ko')expect(label).toBe(itemLabel(w,item))}
      expect(serialize(w.s)).toBe(before);expect(JSON.stringify(items)).toBe(itemBefore)
    }
  })
})

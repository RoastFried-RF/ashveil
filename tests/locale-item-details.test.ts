import {afterEach,describe,expect,it} from 'vitest'
import {itemTip} from '../src/client/info'
import {translateDef} from '../src/client/locales/content'
import {displayWaterLines} from '../src/client/locales/item-water'
import {displayItemLabel} from '../src/client/locales/item'
import {preferences} from '../src/client/preferences'
import {makeItem,player,waterLines,type ItemDef} from '../src/core'
import {serialize} from '../src/core/save'
import {makeWorld} from './helpers'

afterEach(()=>{preferences.language='ko'})

describe('public translated item details',()=>{
 it('keeps an unappraised relic description separate from its identified function',()=>{
  const w=makeWorld('locale-relic-detail'),arm=makeItem(w,'Item.PioneerArm'),def=w.db.item(arm.def)
  preferences.language='en'
  const unknown=itemTip(w,arm)
  expect(unknown.title).toBe('Warm metal arm')
  expect(unknown.lines[0]).toBe('A metal mass with a wrist-like joint. Slightly warm to the touch.')
  expect(unknown.lines.join('\n')).not.toContain('base efficiency')
  expect(itemTip(w,null,arm.def)).toEqual(unknown)
  expect(translateDef({...def,unknownDescription:'모드 기록 {0} $&'},'unknownDescription','en')).toBe('모드 기록 {0} $&')
  arm.appraisal=2
  expect(itemTip(w,arm).title).toBe('Pioneer prosthetic arm')
  expect(itemTip(w,arm).lines.join('\n')).toContain('base efficiency')
  expect(itemTip(w,null,arm.def)).toEqual(unknown)
 })
 it('describes only the public pill belief, retaining hidden mapping and potency',()=>{
  const w=makeWorld('locale-pill-detail'),pill=makeItem(w,'Item.PillYellow')
  pill.pillRemaining=.75;pill.pillAge={potency:35,spoiled:false}
  w.s.knowledge.pillMap[pill.def]='Pill.Toxin'
  ;(w.s.knowledge.pillBeliefs??={})[pill.def]={belief:'Pill.Analgesic',confidence:'likely',ruledOut:[],evidence:[]}
  const before=serialize(w.s),original=JSON.stringify(pill)
  preferences.language='en';const tip=itemTip(w,pill),text=tip.lines.join('\n')
  expect(tip.title).toBe('Yellow pill (Painkiller suspected) [3/4 tablet]')
  expect(text).toContain('Suspected effect: Reduces pain by 50 for 8 hours.')
  expect(text).toContain('Tablet remaining: 75%')
  expect(text).not.toContain('Causes vomiting')
  expect(text).not.toMatch(/potency 35|35%|[가-힣]/)
  expect(serialize(w.s)).toBe(before);expect(JSON.stringify(pill)).toBe(original)
 })
 it('formats equipment, food, firearms and placement data without changing the whole world',()=>{
  const w=makeWorld('locale-details'),items=['Item.PaddedJacket','Item.Javelin','Item.MedicalBag','Item.OatmealBowl','Item.Revolver','Item.WhitecapCulture'].map(id=>makeItem(w,id))
  const before=serialize(w.s),original=JSON.stringify(items)
  preferences.language='en'
  for(const item of items){const tip=itemTip(w,item);expect([tip.title,...tip.lines].join('\n'),item.def).not.toMatch(/[가-힣]/)}
  expect(itemTip(w,items[2]).title).toBe('Medical bag [5 uses]')
  preferences.language='ko'
  expect(itemTip(w,items[2]).lines).toContain('남은 양 5')
  expect(serialize(w.s)).toBe(before);expect(JSON.stringify(items)).toBe(original)
 })
 it('preserves named water-source records and the core Korean observation contract',()=>{
  const w=makeWorld('locale-water-detail'),c=player(w),water=makeItem(w,'Item.WaterBottle')
  water.water={pathogen:93,ash:1,salinity:35,source:'도겸의 우물 {0} $&'};water.waterFrozen=true;water.waterSettlesAt=Math.floor(w.s.time/100)+1200
  const before=serialize(w.s),original=JSON.stringify(water)
  preferences.language='ko';expect(displayWaterLines(w,c,water)).toEqual(waterLines(w,c,water))
  preferences.language='en';const lines=displayWaterLines(w,c,water)
  expect(lines[0]).toBe('Snow/ice — melt over a fire before use')
  expect(lines.join('\n')).toContain('도겸의 우물 {0} $& —')
  expect(lines.join('\n')).toContain('Salinity 35g/L')
  expect(lines.join('\n')).toContain('unsuitable for drinking: causes water loss')
  expect(lines.join('\n')).not.toContain('93')
  expect(serialize(w.s)).toBe(before);expect(JSON.stringify(water)).toBe(original)
 })
 it('names an actual raw-material fragment without replacing its mass or identity',()=>{
  const w=makeWorld('locale-material-fragment'),definition=w.db.all<ItemDef>('Item').find(d=>d.rawFragment)!
  const fragment=makeItem(w,definition.id);fragment.rawMaterial='Material.Steel';fragment.rawGrams=37
  const before=serialize(w.s),original=JSON.stringify(fragment)
  preferences.language='en';expect(displayItemLabel(w,fragment)).toBe('Steel fragment [37g]')
  expect(itemTip(w,fragment).lines.join('\n')).toContain('Steel · 37g per piece · 37g total')
  expect(serialize(w.s)).toBe(before);expect(JSON.stringify(fragment)).toBe(original)
 })
})

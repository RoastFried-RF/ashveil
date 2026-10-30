import {afterEach,describe,expect,it} from 'vitest'
import {itemTip} from '../src/client/info'
import {displayWaterLines} from '../src/client/locales/water'
import {translateDef,translateWaterSource,translateWaterBand} from '../src/client/locales/content'
import {preferences} from '../src/client/preferences'
import {makeWorld} from './helpers'
import {makeItem} from '../src/core/items'
import {player} from '../src/core/ctx'
import {observeWater,waterLines,waterSafetyDef} from '../src/core/water-state'
import {serialize} from '../src/core/save'
import {MISSING_ITEM} from '../src/core/missing-items'
import type {ItemDef} from '../src/core/types'
import baseMessages from '../src/client/locales/en.json'
import equipmentMessages from '../src/client/locales/en-item-details.json'
import extraMessages from '../src/client/locales/en-item-extra.json'

afterEach(()=>{preferences.language='ko'})

describe('complete core item detail display',()=>{
  it('covers every constructible core item and its appraised details without modifying original state',()=>{
    const w=makeWorld('all-item-details-v406'),items=w.db.all<ItemDef>('Item').filter(d=>d.id!==MISSING_ITEM).map(d=>makeItem(w,d.id))
    const before=serialize(w.s),original=JSON.stringify(items)
    preferences.language='ko';const korean=items.map(item=>itemTip(w,item))
    preferences.language='en'
    for(const item of items){
      for(const tip of [itemTip(w,item),itemTip(w,{...item,appraisal:2})])expect([tip.title,...tip.lines].join('\n'),item.def).not.toMatch(/[가-힣]|undefined|NaN|Infinity/)
    }
    preferences.language='ko';expect(items.map(item=>itemTip(w,item))).toEqual(korean)
    expect(serialize(w.s)).toBe(before);expect(JSON.stringify(items)).toBe(original)
  })
  it('uses the public water observation and never includes hidden contamination amounts',()=>{
    const w=makeWorld('water-public'),p=player(w),bottle=makeItem(w,'Item.WaterBottle')
    p.skills.survival=0;preferences.language='en'
    let reference:unknown
    for(const pathogen of [.01,7,35,90])for(const ash of [.01,4,33,99]){
      bottle.water={pathogen,ash,source:'개울물'}
      const before=serialize(w.s),view=observeWater(w,p,bottle),lines=displayWaterLines(w,p,bottle)
      expect(view).toMatchObject({kind:'filled',quality:{kind:'clarity',cloudy:true}})
      expect(Object.keys(view!.kind==='filled'?view!.quality:{})).toEqual(['kind','cloudy'])
      if(reference)expect({view,lines}).toEqual(reference);else reference={view,lines}
      expect(lines[0]).toBe('Stream water — Cloudy');expect(serialize(w.s)).toBe(before)
    }
    p.skills.survival=5;bottle.water={pathogen:15,ash:60,source:'개울물'}
    expect(displayWaterLines(w,p,bottle)[0]).toBe('Stream water — pathogens Moderate / ash Very high')
    preferences.language='ko';expect(displayWaterLines(w,p,bottle)).toEqual(waterLines(w,p,bottle))
  })
  it('keeps empty/frozen/saline/settling rules and guarded source history intact',()=>{
    const w=makeWorld('water-details-boundaries'),p=player(w),bottle=makeItem(w,'Item.WaterBottle')
    bottle.water={pathogen:35,ash:15,salinity:35,source:'우물물 · 끓임 · 숯 여과'};bottle.waterFrozen=true;bottle.waterSettlesAt=2400;bottle.uses=5
    preferences.language='en'
    const lines=displayWaterLines(w,p,bottle)
    expect(lines).toContain('Snow/ice — must be melted at a fire')
    expect(lines.some(line=>line.startsWith('Well water · Boiled · Charcoal-filtered'))).toBe(true)
    expect(lines.join('\n')).toMatch(/Salinity 35g\/L · salt remaining 35g · unsuitable for drinking/)
    expect(lines).toContain('Boiling, cloth/charcoal filtering, settling and purification tablets do not remove salt')
    bottle.uses=0;expect(displayWaterLines(w,p,bottle)).toEqual(['Empty bottle'])
    const rules=waterSafetyDef(w)
    expect(translateWaterSource(rules,'모드 우물 · 끓임','en')).toBe('모드 우물 · 끓임')
    expect(translateWaterSource({...rules,sources:{...rules.sources,well:{...rules.sources.well,source:'다른 우물'}}},'우물물','en')).toBe('우물물')
    expect(translateWaterSource(rules,'우물물 · 사용자 표식','en')).toBe('우물물 · 사용자 표식')
    expect(translateWaterBand({...rules,riskBands:[{at:999,label:'보통'}]},'보통','en')).toBe('보통')
  })
  it('does not turn suspected pills into true identities or reveal hidden potency/spoilage',()=>{
    const w=makeWorld('pill-detail-knowledge'),p=player(w),pill=makeItem(w,'Item.PillYellow')
    p.traits=[];p.stats.per=1
    w.s.knowledge.pillMap[pill.def]='Pill.Toxin'
    ;(w.s.knowledge.pillBeliefs??={})[pill.def]={belief:'Pill.Analgesic',confidence:'likely',ruledOut:[],evidence:[]}
    preferences.language='en';pill.pillAge={potency:31,spoiled:true}
    const first=itemTip(w,pill)
    pill.pillAge={potency:93,spoiled:false}
    expect(itemTip(w,pill)).toEqual(first)
    expect(first.lines.join('\n')).toContain('Suspected effect: Reduces pain by 50 for 8 hours')
    expect(first.lines.join('\n')).not.toMatch(/vomiting|93|31|yellowed|Spoiled medicine/)
    pill.pillAge={potency:31,spoiled:true};p.stats.per=100
    expect(itemTip(w,pill).lines).toContain('The edges are yellowed.')
    expect(itemTip(w,pill).lines.join('\n')).not.toMatch(/potency 31|vomiting/)
  })
  it('preserves mod descriptions and source fields and does not overwrite existing UI messages',()=>{
    const w=makeWorld(),d=w.db.item('Item.PickledCabbageJar')
    expect(translateDef({...d,description:'사용자 절임 설명'},'description','en')).toBe('사용자 절임 설명')
    expect(translateDef({...d,id:'Item.External'},'description','en')).toBe(d.description)
    const existing={...baseMessages,...equipmentMessages}
    expect(Object.keys(extraMessages).filter(key=>Object.hasOwn(existing,key))).toEqual([])
  })
  it('keeps bow strings distinct from firearm jams and formats real raw fragments',()=>{
    const w=makeWorld('ranged-and-fragments'),bow=makeItem(w,'Item.Bow')
    preferences.language='en'
    expect(itemTip(w,bow).lines.some(line=>line.startsWith('String strung · moisture'))).toBe(true)
    bow.bowUnstrung=true;expect(itemTip(w,bow).lines.some(line=>line.startsWith('String unstrung · moisture'))).toBe(true)
    bow.bowBroken=true;expect(itemTip(w,bow).lines.some(line=>line.startsWith('String broken · moisture'))).toBe(true)
    bow.partDurability={};expect(itemTip(w,bow).lines.join('\n')).not.toMatch(/Infinity|Durability by part/)
    const def=w.db.all<ItemDef>('Item').find(d=>d.rawFragment)!
    const fragment=makeItem(w,def.id);fragment.rawMaterial='Material.Iron';fragment.rawGrams=25
    const tip=itemTip(w,fragment)
    expect(tip.title).toContain('Wrought iron fragment');expect(tip.title).toContain('[25g]')
    expect(tip.lines.join('\n')).toContain('25g')
  })
})

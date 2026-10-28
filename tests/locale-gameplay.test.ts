import {afterEach, describe, expect, it} from 'vitest'
import {computed} from 'vue'
import catalog from '../src/client/locales/en-content.json'
import {translateDef} from '../src/client/locales/content'
import {learningReason} from '../src/client/locales/learning'
import {defText} from '../src/client/locale'
import {preferences} from '../src/client/preferences'
import {abilityFormula, abilityTip, modLines, temperatureTip} from '../src/client/info'
import {canLearn, player} from '../src/core'
import {serialize} from '../src/core/save'
import {db, makeWorld} from './helpers'

afterEach(()=>{preferences.language='ko'})

describe('reviewed gameplay display fields',()=>{
  it('guards both ID and exact source, preserving mod edits, unknown Defs and literal data',()=>{
    const ability=db.ability('Ab.Survival.Breath')
    const frozen=Object.freeze({...ability})
    expect(translateDef(frozen,'label','en')).toBe('Catch Breath')
    expect(translateDef(frozen,'label','ko')).toBe(ability.label)
    expect(translateDef({...ability,id:'Mod.Breath'},'label','en')).toBe(ability.label)
    for(const source of ['<b>{0}$&</b>', '검증용 떠돌이', ' 숨 고르기 ']) {
      expect(translateDef({...ability,label:source},'label','en')).toBe(source)
      expect(translateDef({...ability,description:source},'description','en')).toBe(source)
    }
    for(const id of ['__proto__','constructor']) expect(translateDef({id,label:'숨 고르기'},'label','en')).toBe('숨 고르기')
    expect(frozen.label).toBe('숨 고르기')
  })
  it('matches reviewed fields to actual loaded content and reacts to language changes',()=>{
    for(const [id,fields] of Object.entries(catalog)) {
      const def=db.get(id)
      for(const [field,entry] of Object.entries(fields)) {
        expect((def as unknown as Record<string,unknown>)[field],id+'.'+field).toBe(entry.source)
        expect(entry.text.trim(),id).not.toBe('')
      }
    }
    const ability=db.ability('Ab.Survival.Breath'), label=computed(()=>defText(ability))
    expect(label.value).toBe(ability.label)
    preferences.language='en';expect(label.value).toBe('Catch Breath')
    preferences.language='ko';expect(label.value).toBe(ability.label)
  })
  it('shows fractions as percentages in Korean and English formulas',()=>{
    for(const language of ['ko','en'] as const) {
      preferences.language=language
      const breath=abilityFormula(db.ability('Ab.Survival.Breath')).join('\n')
      expect(breath).toContain('50%');expect(breath).not.toContain('0.5%')
      expect(breath).toContain(language==='ko'?'통증 −50% (3턴)':'Pain −50% (3 turns)')
      expect(abilityFormula(db.ability('Ab.Blunt.Shove')).join('\n')).toContain('50%')
      expect(abilityFormula(db.ability('Ab.Spear.Trip')).join('\n')).toContain('60%')
    }
  })
  it('renders every reviewed ability tooltip and formula without Korean fragments in English',()=>{
    preferences.language='en'
    const world=makeWorld('locale-ability-tips')
    for(const id of Object.keys(catalog).filter(id=>id.startsWith('Ab.'))) {
      const ability=db.ability(id), tooltip=abilityTip(world,ability)
      expect([tooltip.title,...tooltip.lines,...abilityFormula(ability)].join('\n'),id).not.toMatch(/[가-힣]/)
    }
  })
  it('formats the actual learning refusal, retaining unknown reasons and changed prerequisites',()=>{
    const world=makeWorld('locale-learning'), person=player(world)
    preferences.language='en'
    const ability=db.ability('Ab.Blade.Vital')
    person.abilities=['Ab.Blade.Edge'];person.abilityPoints=1
    const source=canLearn(world,person,ability.id)!
    expect(learningReason(world,person,ability,source)).toBe("Learn 'Deep Cut' first")
    person.abilities=[]
    expect(learningReason(world,person,ability,canLearn(world,person,ability.id)!)).toBe('Learn at least one ability in the Blades tree first')
    person.abilityPoints=0
    expect(learningReason(world,person,ability,canLearn(world,person,ability.id)!)).toBe('No ability points')
    expect(learningReason(world,person,ability,'모드에서 막음 {0}')).toBe('모드에서 막음 {0}')
  })
  it('keeps rules, names, logs and whole saved world unchanged while producing either language',()=>{
    const world=makeWorld('locale-presentation-world','Bg.Deserter',true)
    const person=player(world), before=serialize(world.s)
    for(const language of ['ko','en','ko'] as const) {
      preferences.language=language
      for(const id of person.abilities) {
        abilityTip(world,db.ability(id));abilityFormula(db.ability(id))
      }
      temperatureTip(world,person);modLines(db.background(person.background!).mods)
      expect(serialize(world.s)).toBe(before)
    }
  })
})

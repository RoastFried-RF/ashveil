import {describe,it,expect} from 'vitest'
import {endingFixture} from './expedition-endings-fixture'
import {expeditionEndingQuote} from '../src/core/expedition-endings'
import {retirementDef} from '../src/core/retirement'
import {serialize} from '../src/core/save'
import {buildReport} from '../src/core/report'
import {formatExpeditionReport} from '../src/client/report-export'
import {translateEndingRule,translateEndingIssue} from '../src/client/locales/expedition-records'
import catalog from '../src/client/locales/en-expedition-records.json'

describe('expedition record presentation preserves original evidence',()=>{
 for(const kind of ['signal','unveiled','witness','acknowledged']as const)it(kind+' uses the actual patched rule without changing a world',()=>{
  const {w,p}=endingFixture(kind),before=serialize(w.s),q=expeditionEndingQuote(w,p,kind),parent=retirementDef(w).id
  expect(q.error).toBeNull()
  for(const field of ['label','summary','epitaph']as const){
   expect(translateEndingRule(parent,q.rule!,field,'en')).not.toMatch(/[가-힣]/)
   expect(translateEndingRule(parent,q.rule!,field,'ko')).toBe(q.rule![field])
   const foreign={...q.rule!,[field]:'외부 {0} $& <원문>'}
   expect(translateEndingRule(parent,foreign,field,'en')).toBe(foreign[field])
   expect(translateEndingRule('Retirement.Foreign',q.rule!,field,'en')).toBe(q.rule![field])
   expect(translateEndingRule(parent,{...q.rule!,id:'foreign'},field,'en')).toBe(q.rule![field])
  }
  expect(serialize(w.s)).toBe(before)
 })
 it('formats only the exact actual missing requirements and preserves their original note titles',()=>{
  const {w,p}=endingFixture('signal'),before=serialize(w.s),q=expeditionEndingQuote(w,p,'unveiled')
  expect(q.requirements.length).toBeGreaterThan(0);expect(q.error).toBe('아직 남은 일: '+q.requirements.join(' · '))
  expect(translateEndingIssue(q.error,q.requirements,'en')).toBe('Still to do: '+q.requirements.join(' · '))
  expect(translateEndingIssue(q.error,['다른 {0} $&'],'en')).toBe(q.error)
  expect(translateEndingIssue('외부 {0} $&',q.requirements,'en')).toBe('외부 {0} $&')
  expect(serialize(w.s)).toBe(before)
 })
 it('exports English headings with literal historical values and leaves a legacy report unchanged',()=>{
  const {w,p}=endingFixture('signal'),before=serialize(w.s),report=buildReport(w,p,'escape','원래 원인 {0} $&')
  report.name='이름 {0} $& <문자>';report.chain.push('과거 실제 문구 {1} $&');report.discoveries={format:1,at:0,omitted:1,records:[{kind:'fieldNote',id:'old',title:'과거 제목 {0}',details:['현재 내용으로 대체하지 않는다 $&']}]}
  const original=JSON.stringify(report),english=formatExpeditionReport({report,seed:'seed {0} $&',language:'en',modeLabel:'원래 방식'})
  expect(english).toContain('Name: '+report.name);expect(english).toContain('Cause / ending: '+report.cause);expect(english).toContain('Seed: seed {0} $&');expect(english).toContain('Save mode: 원래 방식')
  expect(english).toContain('[Field notes] 과거 제목 {0}');expect(english).toContain('현재 내용으로 대체하지 않는다 $&')
  for(const line of[report.title,report.epitaph,report.background,...report.traits,...report.chain,...report.vitals,...report.stats])expect(english).toContain(line)
  const ko=formatExpeditionReport({report,seed:w.s.seed});expect(ko).toContain('이름: '+report.name);expect(ko).toBe(formatExpeditionReport({report,seed:w.s.seed,language:'ko'}))
  const legacy={...report};delete legacy.discoveries;expect(formatExpeditionReport({report:legacy,seed:w.s.seed,language:'en'})).not.toContain('Discoveries and learning')
  expect(JSON.stringify(report)).toBe(original);expect(serialize(w.s)).toBe(before)
 })
 it('keeps reviewed heading placeholders without empty translations',()=>{
  const slots=(s:string)=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort()
  for(const[source,target]of Object.entries(catalog)){expect(target.trim()).not.toBe('');expect(slots(target),source).toEqual(slots(source))}
 })
})

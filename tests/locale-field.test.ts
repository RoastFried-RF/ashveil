import{describe,it,expect}from'vitest'
import{db}from'./helpers'
import{translateFieldIssue}from'../src/client/locales/field'
import{translateDef}from'../src/client/locales/content'
import messages from'../src/client/locales/en-field-camp.json'
import{brushClearingNativeFixture}from'./brush-clearing-fixture'
import{brushClearingQuote}from'../src/core/brush-clearing'

describe('field quote translations retain actual parameters and original labels',()=>{
 it('uses the actual clearing quote and same required tool, preserving all world fields',()=>{
  const d=brushClearingNativeFixture(),before=JSON.stringify(d.s),q=brushClearingQuote(d.w,d.p,d.north),tools=d.w.db.terrain('Terrain.AshBerryBush').clearing!.tools.map(id=>d.w.db.item(id))
  expect(q.error).toContain(tools[0].label);expect(translateFieldIssue(q.error,{tools},'en')).toBe('Equip a tool with a usable edge: Sheet-metal machete');expect(translateFieldIssue(q.error,{tools},'ko')).toBe(q.error);expect(JSON.stringify(d.s)).toBe(before)
 })
 it('translates a water requirement only for the current quote amount',()=>{
  const error='불을 끌 실제 물 200ml가 필요하다';expect(translateFieldIssue(error,{waterMl:200},'en')).toBe('You need 200 ml of water to put out the fire');expect(translateFieldIssue(error,{waterMl:400},'en')).toBe(error);expect(translateFieldIssue(error,undefined,'en')).toBe(error)
 })
 it('guards season identity and exact original labels and retains literal foreign text',()=>{
  const summer=db.get<import('../src/core/types').SeasonDef>('Season.Summer');expect(translateFieldIssue(summer.label+'에만 실제 열매가 열린다',{seasons:[summer]},'en')).toBe('Berries grow only in Summer')
  const foreign={id:'mod.season',label:'{0} 낯선 계절 $&'};expect(translateFieldIssue(foreign.label+'에만 실제 열매가 열린다',{seasons:[foreign]},'en')).toBe('Berries grow only in '+foreign.label);expect(translateFieldIssue(summer.label+'에만 실제 열매가 열린다',{seasons:[foreign]},'en')).toContain(summer.label)
 })
 it('keeps foreign and edited tool labels literal, with no recursive placeholder interpolation',()=>{
  const tool={id:'mod.tool',label:'{0} 새 도구 $&'},error='날이 남은 도구를 손에 장착해야 한다: '+tool.label
  expect(translateFieldIssue(error,{tools:[tool]},'en')).toBe('Equip a tool with a usable edge: '+tool.label);expect(translateFieldIssue('작가가 쓴 알 수 없는 오류',undefined,'en')).toBe('작가가 쓴 알 수 없는 오류')
 })
 it('covers three reviewed current terrain labels without changing original or foreign Defs',()=>{
  for(const id of ['Terrain.Tree','Terrain.PineTree','Terrain.AshBerryBush']){const def=db.terrain(id),before=JSON.stringify(def);expect(translateDef(def,'label','en')).not.toMatch(/[가-힣]/);expect(translateDef(def,'label','ko')).toBe(def.label);expect(translateDef({...def,id:'mod.foreign'},'label','en')).toBe(def.label);expect(translateDef({...def,label:def.label+' 변경'},'label','en')).toBe(def.label+' 변경');expect(JSON.stringify(def)).toBe(before)}
 })
 it('retains every message argument and states permanent clearing and cooking burn risk',()=>{
  const args=(text:string)=>[...text.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();for(const[source,target]of Object.entries(messages)){expect(args(target),source).toEqual(args(source));expect(target.trim(),source).not.toBe('')}
  expect(messages['덤불을 영구 제거한다. 열매가 다시 자라지 않으며, 빈 흙에 다른 작물을 심을 수 있다.']).toMatch(/Permanently.*no longer regrow/);expect(messages['음식이 불 위에 남아 탈 수 있다']).toContain('may burn')
 })
})

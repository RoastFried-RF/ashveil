import{describe,it,expect}from'vitest'
import{db}from'./helpers'
import{fieldDeviceFixture}from'./field-devices-fixture'
import{fieldDeviceQuote}from'../src/core/field-devices'
import{translateDef,translateDeviceOperation}from'../src/client/locales/content'
import{translateFieldWorkIssue}from'../src/client/locales/field-work'
import{serialize}from'../src/core/save'
import type{FieldDeviceDef}from'../src/core/types'

describe('field work display preserves original resources and source guards',()=>{
 it('covers each compiled core device description and nested operation without editing Defs',()=>{
  const devices=db.all<FieldDeviceDef>('FieldDevice'),before=JSON.stringify(devices);expect(devices).toHaveLength(5)
  for(const d of devices){expect(translateDef(d,'label','en')).not.toMatch(/[가-힣]/);expect(translateDef(d,'description','en')).not.toMatch(/[가-힣]/);for(const op of d.operations){expect(translateDeviceOperation(d.id,op,'en')).not.toMatch(/[가-힣]/);expect(translateDeviceOperation(d.id,op,'ko')).toBe(op.label)}}
  expect(JSON.stringify(devices)).toBe(before)
 })
 it('requires the device ID, operation ID and exact reviewed label',()=>{
  const d=db.get<FieldDeviceDef>('FieldDevice.TowerSensor'),op=d.operations[0]
  expect(translateDeviceOperation('mod.foreign',op,'en')).toBe(op.label);expect(translateDeviceOperation(d.id,{...op,id:'foreign'},'en')).toBe(op.label);expect(translateDeviceOperation(d.id,{...op,label:op.label+' 변경 $& {0}'},'en')).toBe(op.label+' 변경 $& {0}');expect(translateDef({...d,label:d.label+' 변경'},'label','en')).toBe(d.label+' 변경')
 })
 it('formats the actual missing cloth quote and preserves the complete original world',()=>{
  const d=fieldDeviceFixture(),op=d.w.db.get<FieldDeviceDef>(d.device.def).operations[0];d.p.bag=d.p.bag.filter(i=>i.uid!==d.cloth.uid)
  const before=serialize(d.s),q=fieldDeviceQuote(d.w,d.p,d.sensor,d.device.uid,op.id),materials=op.materials.map(row=>({def:d.w.db.item(row.item),displayLabel:translateDef(d.w.db.item(row.item),'label','en'),count:row.count}));expect(q.error).not.toBeNull();expect(translateFieldWorkIssue(q.error,{materials},'en')).toBe('Cloth scrap: 1 more required');expect(translateFieldWorkIssue(q.error,{materials},'ko')).toBe(q.error);expect(serialize(d.s)).toBe(before)
 })
 it('uses only matching boat capacity, water volume and tool context',()=>{
  expect(translateFieldWorkIssue('배의 실제 정원3명을 넘었다',{seats:3},'en')).toBe("The boat's capacity of 3 people is exceeded");expect(translateFieldWorkIssue('배의 실제 정원3명을 넘었다',{seats:4},'en')).toBe('배의 실제 정원3명을 넘었다')
  expect(translateFieldWorkIssue('한 병에 재가 섞이지 않은 물 200ml가 필요하다',{waterMl:200},'en')).toContain('200 ml');expect(translateFieldWorkIssue('한 병에 재가 섞이지 않은 물 200ml가 필요하다',{waterMl:201},'en')).toContain('한 병')
  expect(translateFieldWorkIssue('쓸 수 있는 hammer 도구가 필요하다',{tool:'hammer'},'en')).toBe('A usable hammer tool is required');expect(translateFieldWorkIssue('쓸 수 있는 hammer 도구가 필요하다',{tool:'axe'},'en')).toContain('도구')
 })
 it('keeps foreign names literal, refuses impossible shortfalls and uses the existing unidentified display label',()=>{
  const def={id:'mod.foreign',label:'원래 {0} $&'},materials=[{def,displayLabel:def.label,count:2}],source=def.label+' 2개가 부족하다'
  expect(translateFieldWorkIssue(source,{materials},'en')).toBe(def.label+': 2 more required');expect(translateFieldWorkIssue(def.label+' 3개가 부족하다',{materials},'en')).toBe(def.label+' 3개가 부족하다');expect(translateFieldWorkIssue(source,undefined,'en')).toBe(source)
  expect(translateFieldWorkIssue(source,{materials:[{...materials[0],displayLabel:'Unidentified relic'}]},'en')).toBe('Unidentified relic: 2 more required')
  expect(translateFieldWorkIssue('지원하지 않는 원래 모드 판정',undefined,'en')).toBe('지원하지 않는 원래 모드 판정')
 })
})

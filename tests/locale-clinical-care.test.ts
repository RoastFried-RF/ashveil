import {expect,it} from 'vitest'
import {carePlanFixture} from './companion-care-plan-fixture'
import {companionClinicalQuote} from '../src/core/companion-clinical'
import {companionCarePlanQuote} from '../src/core/companion-care-plan'
import {serialize} from '../src/core/save'
import {companionClinicalRule} from '../src/core/companion-state'
import {makeItem} from '../src/core/items'
import {translateClinicalIssue,translateClinicalLine,translateClinicalLabel} from '../src/client/locales/clinical-care'
import {translateBodyPart,translateDef} from '../src/client/locales/content'
import {translate} from '../src/client/locales/message'
import catalog from '../src/client/locales/en-clinical-care.json'

it('renders real care quotes and original bindings without changing any saved field',()=>{
 const {w,worker,requests}=carePlanFixture(),before=serialize(w.s),plan=companionCarePlanQuote(w,worker,requests)
 expect(plan.error).toBeNull();expect(plan.steps).toHaveLength(4)
 for(const step of plan.steps){
  expect(translateClinicalLabel(w,step.label,step.request,'en',step.bindings.uid?.def)).not.toMatch(/[가-힣]/)
  expect(translateClinicalLabel(w,step.label,step.request,'ko',step.bindings.uid?.def)).toBe(step.label)
  for(const line of step.lines){
   const en=translateClinicalLine(w,line,'en')
   expect(en,line).not.toMatch(/[가-힣]/)
   expect(en.match(/[+-]?\d+(?:\.\d+)?/g),line).toEqual(line.match(/[+-]?\d+(?:\.\d+)?/g))
   expect(translateClinicalLine(w,line,'ko')).toBe(line)
  }
 }
 expect(plan.steps[1]!.bindings.uid?.uid).toBe(requests[1]!.uid)
 expect(serialize(w.s)).toBe(before)
})
it('uses failed quotes and actual supply rules while preserving unrecognised text literally',()=>{
 const {w,worker,requests,thread}=carePlanFixture();thread.count=0
 const before=serialize(w.s),q=companionClinicalQuote(w,worker,requests[2]!)
 expect(q.error).toBe('실 꾸러미 1개가 필요하다')
 expect(translateClinicalIssue(w,q.error,'en')).toBe('Requires 1 × Thread bundle')
 expect(translateClinicalIssue(w,q.error,'ko')).toBe(q.error)
 const plan=companionCarePlanQuote(w,worker,requests)
 expect(plan.error).toBe('3번째 처치: 실 꾸러미 1개가 필요하다')
 expect(translateClinicalIssue(w,plan.error,'en')).toBe('Step 3: Requires 1 × Thread bundle')
 for(const text of ['원래 {0} $& <문자>','진찰에는 의료 숙달X단계가 필요하다','실 999개가 필요하다','의료 숙달 +4.0 변경','지각 +1.2 변경']){
  expect(translateClinicalIssue(w,text,'en')).toBe(text);expect(translateClinicalLine(w,text,'en')).toBe(text)
 }
 expect(serialize(w.s)).toBe(before)
})
it('requires the typed request, exact original work label and original item binding',()=>{
 const {w,worker,requests,drug}=carePlanFixture(),q=companionClinicalQuote(w,worker,requests[1]!),original=q.activity!.label!,before=serialize(w.s)
 expect(translateClinicalLabel(w,original,requests[1]!,'en',drug.def)).toBe('Apply Bittermoss poultice')
 expect(translateClinicalLabel(w,original,requests[1]!,'en','Item.Bandage')).toBe(original)
 expect(translateClinicalLabel(w,original+' {0} $&',requests[1]!,'en',drug.def)).toBe(original+' {0} $&')
 expect(translateClinicalLabel(w,'진찰',{kind:'bandage'},'en')).toBe('진찰')
 expect(serialize(w.s)).toBe(before)
})
it('requires body ID, part ID, original source and membership without inspecting foreign bodies',()=>{
 const {w,patient}=carePlanFixture(),body=w.db.body(patient.body.def),part=body.parts.find(p=>p.id==='LeftForearm')!,before=serialize(w.s)
 expect(translateBodyPart(body,part,'en')).toBe('Left forearm');expect(translateBodyPart(body,part,'ko')).toBe(part.label)
 const foreign={...body,id:'Body.Foreign'};Object.defineProperty(foreign,'parts',{get(){throw Error('foreign body must not be inspected')}})
 expect(translateBodyPart(foreign,part,'en')).toBe(part.label)
 expect(translateBodyPart(body,{...part,label:'원래 {0} $&'},'en')).toBe('원래 {0} $&')
 expect(translateBodyPart({...body,parts:[]},part,'en')).toBe(part.label)
 for(const part of body.parts)expect(translateBodyPart(body,part,'en')).not.toMatch(/[가-힣]/)
 expect(translateDef({id:'Drug.BitterMoss',label:'변경한 약 {0}'},'label','en')).toBe('변경한 약 {0}')
 expect(serialize(w.s)).toBe(before)
})
it('retains all reviewed clinical message placeholders',()=>{
 const slots=(s:string)=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort()
 for(const[source,target]of Object.entries(catalog)){expect(target.trim()).not.toBe('');expect(slots(target),source).toEqual(slots(source))}
})

it('formats actual fresh previews for every configured companion prescription without granting inventory or knowledge during display',()=>{
 const template=carePlanFixture(),policy=companionClinicalRule(template.w)!
 expect(policy.prescriptions.length).toBeGreaterThan(1)
 for(const rx of policy.prescriptions){
  const {w,worker,patient,wound}=carePlanFixture(),medicine=makeItem(w,rx.item)
  // Declared initial unit fixture: one original identified dose in the clinician's bag.
  medicine.appraisal=2;worker.bag=[medicine]
  const before=serialize(w.s),q=companionClinicalQuote(w,worker,{kind:'dose',uid:medicine.uid,patient:patient.id,woundId:wound.id})
  expect(q.error,rx.item).toBeNull()
  expect(q.lines.length,rx.item).toBeGreaterThan(0)
  for(const line of q.lines){expect(translateClinicalLine(w,line,'en'),rx.item+': '+line).not.toMatch(/[가-힣]/);expect(translateClinicalLine(w,line,'ko')).toBe(line)}
  expect(serialize(w.s)).toBe(before)
 }
})

it('uses actual singular counts for clinic stock, medicine, supplies and scheduled time',()=>{
 expect(translate('{0} · 재고 {1}회분','en','Original {0} $&',1)).toBe('Original {0} $& · 1 dose in stock')
 expect(translate('{0} · 재고 {1}회분','en','Original',2)).toBe('Original · 2 doses in stock')
 expect(translate('{0} · 재고 {1}회분','ko','원본',1)).toBe('원본 · 재고 1회분')
 for(const[source,en]of[['{0}분','1 minute'],['{0}턴','1 turn'],['{0}개','1 item'],['{0}회분','1 dose'],['붕대 재료 {0}회분','Bandaging supplies: 1 dose'],['규격 1회분 · 지속 {0}분','1 standard dose · Lasts 1 minute']]as const)expect(translate(source,'en',1)).toBe(en)
 expect(translate('다음 {0} · {1} · {2}턴 뒤','en','Examination','Day 1',1)).toBe('Next: Examination · Day 1 · In 1 turn')
 expect(translate('취소','en')).toBe('Cancel')
 expect(translate('이 순서대로 맡기기{0}','en',translate(' (1턴)','en'))).toBe('Assign this sequence (1 turn)')
})

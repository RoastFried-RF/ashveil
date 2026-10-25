import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {companionCarePlanQuote,requestCompanionCarePlan} from '../src/core/companion-care-plan'
import {cancelCompanionClinical} from '../src/core/companion-clinical'
import {stopActivity,SAVE_VERSION} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {carePlanFixture} from './companion-care-plan-fixture'
import {finishBase} from './base-camp-fixture'
it('quotes a finite ordered sequence without changing any world field and applies actual treatment once per step',()=>{
 const {w,worker,patient,wound,thread,needle,drug,bandage,requests}=carePlanFixture(),before=stateHash(w.s),q=companionCarePlanQuote(w,worker,requests),durability=needle.durability??100
 expect(q.error).toBeNull();expect(q.steps).toHaveLength(4);expect(stateHash(w.s)).toBe(before);expect(requestCompanionCarePlan(w,worker,requests,q.signature)).toBeNull()
 activityStep(w,worker);expect(patient.medicalReports).toBeUndefined();expect(drug.count).toBe(2);finishBase(w,worker)
 expect(worker.companion!.carePlan).toMatchObject({status:'complete',cursor:4,patient:patient.id});expect(patient.medicalReports?.at(-1)?.examinerId).toBe(worker.id);expect(wound.topicalDrug?.def).toBe('Drug.BitterMoss');expect(wound.suture).toBeDefined();expect(wound.bandage).toBeDefined();expect(thread.count).toBe(2);expect(drug.count).toBe(1);expect(bandage.count).toBe(1);expect(needle.durability).toBe(durability-1);expect(patient.activity).toBeUndefined()
})
it('preserves the full approved sequence and original UIDs through a mid-procedure save',()=>{
 const {w,worker,requests}=carePlanFixture(),q=companionCarePlanQuote(w,worker,requests);expect(requestCompanionCarePlan(w,worker,requests,q.signature)).toBeNull();activityStep(w,worker)
 const copy={db:w.db,s:deserialize(serialize(w.s))},other=copy.s.creatures.find(c=>c.id===worker.id)!
 finishBase(w,worker);finishBase(copy,other);expect(stateHash(copy.s)).toBe(stateHash(w.s));expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(w.s)))
})
it('pauses at a lost future UID instead of consuming a replacement and preserves completed history',()=>{
 const {w,worker,patient,drug,wound,requests}=carePlanFixture(),q=companionCarePlanQuote(w,worker,requests);expect(requestCompanionCarePlan(w,worker,requests,q.signature)).toBeNull()
 worker.bag=worker.bag.filter(i=>i.uid!==drug.uid);const replacement=makeItem(w,drug.def,2);addToBag(w,worker,replacement);finishBase(w,worker)
 expect(worker.companion!.carePlan).toMatchObject({status:'paused',cursor:1});expect(patient.medicalReports).toHaveLength(1);expect(wound.topicalDrug).toBeUndefined();expect(wound.suture).toBeUndefined();expect(replacement.count).toBe(2);expect(patient.activity).toBeUndefined()
})
it('cancels the remaining sequence when the patient interrupts and never silently resumes',()=>{
 const {w,p,worker,requests,drug}=carePlanFixture(),q=companionCarePlanQuote(w,worker,requests);requestCompanionCarePlan(w,worker,requests,q.signature);activityStep(w,worker);stopActivity(w,p);finishBase(w,worker)
 expect(worker.companion!.carePlan).toMatchObject({status:'paused',cursor:0});expect(p.activity).toBeUndefined();expect(drug.count).toBe(2)
})
it('lets an ally sequence continue while the leader does another activity and cancels only the exact patient',()=>{
 const {w,p,worker,patient,requests}=carePlanFixture(true),q=companionCarePlanQuote(w,worker,requests)
 expect(perform(w,p,{type:'companionCarePlan',target:worker.id,requests,expected:q.signature})).toEqual({ok:true,tu:100});p.activity={kind:'rest',remaining:50,label:'쉬기'};finishBase(w,worker);expect(worker.companion!.carePlan?.status).toBe('complete');expect(p.activity?.kind).toBe('rest');expect(patient.activity).toBeUndefined()
 const next=carePlanFixture(true),quote=companionCarePlanQuote(next.w,next.worker,next.requests);requestCompanionCarePlan(next.w,next.worker,next.requests,quote.signature);expect(cancelCompanionClinical(next.w,next.worker,next.p.id)).not.toBeNull();expect(cancelCompanionClinical(next.w,next.worker,next.patient.id)).toBeNull();expect(next.worker.companion!.carePlan?.status).toBe('paused')
})
it('rejects overbooking, mixed patients, automatic amputation and stale review without mutation',()=>{
 const {w,p,worker,drug,requests}=carePlanFixture(),dose=requests[1]!,before=stateHash(w.s)
 expect(companionCarePlanQuote(w,worker,[dose,dose,dose]).error).not.toBeNull();expect(companionCarePlanQuote(w,worker,[requests[0]!,{kind:'diagnose',patient:worker.id}]).error).not.toBeNull();expect(companionCarePlanQuote(w,worker,[{kind:'amputate',patient:p.id,part:'LeftHand',permanentLossAccepted:true}]).error).not.toBeNull();expect(companionCarePlanQuote(w,worker,Array(9).fill(dose)).error).not.toBeNull();expect(requestCompanionCarePlan(w,worker,requests,'stale')).not.toBeNull();expect(stateHash(w.s)).toBe(before);expect(drug.count).toBe(2)
})
it('rechecks changed wound state between steps instead of applying a redundant dressing',()=>{
 const {w,worker,bandage,requests}=carePlanFixture(),steps=[requests[3]!,requests[3]!],q=companionCarePlanQuote(w,worker,steps)
 expect(q.error).toBeNull();expect(requestCompanionCarePlan(w,worker,steps,q.signature)).toBeNull();finishBase(w,worker)
 expect(worker.companion!.carePlan).toMatchObject({status:'paused',cursor:1});expect(worker.companion!.carePlan!.reason).toContain('이미 붕대');expect(bandage.count).toBe(1)
})
it('does not switch to a replacement needle during a later operation',()=>{
 const {w,worker,needle,wound,requests}=carePlanFixture(),q=companionCarePlanQuote(w,worker,requests)
 expect(requestCompanionCarePlan(w,worker,requests,q.signature)).toBeNull();worker.bag=worker.bag.filter(i=>i.uid!==needle.uid);const other=makeItem(w,needle.def);addToBag(w,worker,other);finishBase(w,worker)
 expect(worker.companion!.carePlan).toMatchObject({status:'paused',cursor:2});expect(wound.suture).toBeUndefined();expect(other.durability??100).toBe(100)
})
it('validates stored counters and bindings and migrates old saves without inventing consent',()=>{
 const {w,worker,requests}=carePlanFixture(),old=JSON.parse(serialize(w.s));old.version=217;expect(deserialize(JSON.stringify(old))).toEqual({...old,version:SAVE_VERSION})
 const q=companionCarePlanQuote(w,worker,requests);requestCompanionCarePlan(w,worker,requests,q.signature)
 for(const corrupt of ['cursor','patient','uid','kind','count'] as const){const s=JSON.parse(serialize(w.s)),c=s.creatures.find((c:{id:number})=>c.id===worker.id),plan=c.companion.carePlan;if(corrupt==='cursor')plan.cursor=99;if(corrupt==='patient')plan.steps[0].request.patient++;if(corrupt==='uid')c.activity.companionCarePlan++;if(corrupt==='kind')plan.steps[0].request.kind='amputate';if(corrupt==='count')plan.steps[1].bindings.supplies[0].count=-1;expect(()=>deserialize(JSON.stringify(s))).toThrow()}
})

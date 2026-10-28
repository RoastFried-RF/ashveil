import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {addWound} from '../src/core/body'
import {companionClinicalQuote,requestCompanionClinical} from '../src/core/companion-clinical'
import {turnOf} from '../src/core/ctx'
import {invalidateLights} from '../src/core/fov'
import {SAVE_VERSION,stopActivity} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {baseFixture,finishBase} from './base-camp-fixture'
function fixture(){
 const d=baseFixture(),{w,p,worker}=d;w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];invalidateLights(w);worker.skills.medicine=50
 const wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:30,source:'선언한 초기 외부 상처'}).wound,drug=makeItem(w,'Item.BitterMoss',2);expect(addToBag(w,worker,drug)).toBe(0)
 return{...d,wound,drug}
}
it('explicit companion examination is read-only until requested, takes real work and retains only historical findings',()=>{
 const {w,p,worker}=fixture(),before=stateHash(w.s),money=[p.money,worker.money],request={kind:'diagnose'} as const,q=companionClinicalQuote(w,worker,request)
 expect(q.error).toBeNull();expect(q.turns).toBeGreaterThan(1);expect(stateHash(w.s)).toBe(before)
 expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull();expect(p.medicalReports).toBeUndefined();activityStep(w,worker);expect(p.medicalReports).toBeUndefined();finishBase(w,worker)
 expect(p.medicalReports?.at(-1)).toMatchObject({examinerId:worker.id,examiner:worker.name});expect(p.medicalReports!.at(-1)!.findings.join(' ')).toContain('왼 전완: 베임')
 const report=structuredClone(p.medicalReports);p.body.wounds=[];expect(p.medicalReports).toEqual(report);expect([p.money,worker.money]).toEqual(money);expect(p.activity).toBeUndefined()
})
it('one topical dose binds the original UID, consumes only on completion and resumes the exact serialized state',()=>{
 const {w,p,worker,wound,drug}=fixture(),request={kind:'dose',uid:drug.uid,woundId:wound.id} as const,q=companionClinicalQuote(w,worker,request),before=stateHash(w.s)
 expect(q.error).toBeNull();expect(stateHash(w.s)).toBe(before);expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull();activityStep(w,worker);expect(drug.count).toBe(2);expect(wound.topicalDrug).toBeUndefined()
 const copy={db:w.db,s:deserialize(serialize(w.s))},other=copy.s.creatures.find(c=>c.id===worker.id)!;finishBase(w,worker);finishBase(copy,other)
 expect(stateHash(copy.s)).toBe(stateHash(w.s));expect(drug.count).toBe(1);expect(wound.topicalDrug?.def).toBe('Drug.BitterMoss');expect(p.activity).toBeUndefined();expect(worker.companion!.aid).toBeUndefined()
})
it('stale review, lost original drug, unpaid contract and patient cancellation grant no replacement dose',()=>{
 for(const failure of ['stale','lost','unpaid','cancel'] as const){
  const {w,p,worker,wound,drug}=fixture(),request={kind:'dose',uid:drug.uid,woundId:wound.id} as const,q=companionClinicalQuote(w,worker,request)
  expect(q.error).toBeNull()
  if(failure==='stale'){
   worker.stats.agi+=10;const before=stateHash(w.s);expect(requestCompanionClinical(w,worker,request,'obsolete-review')).not.toBeNull();expect(stateHash(w.s)).toBe(before);continue
  }
  expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull()
  if(failure==='lost'){worker.bag.splice(worker.bag.findIndex(i=>i.uid===drug.uid),1);const replacement=makeItem(w,'Item.BitterMoss');addToBag(w,worker,replacement)}
  if(failure==='unpaid')worker.companion!.paidUntil=turnOf(w)
  if(failure==='cancel')stopActivity(w,p)
  finishBase(w,worker);expect(wound.topicalDrug).toBeUndefined();expect(p.activity).toBeUndefined();expect(worker.bag.filter(i=>i.def==='Item.BitterMoss').reduce((n,i)=>n+i.count,0)).toBe(failure==='lost'?1:2)
 }
})
it('old210 saves gain no implicit consultation and NPCs cannot request player-only consent',()=>{
 const {w,p,worker}=fixture(),old=JSON.parse(serialize(w.s));old.version=210;expect(deserialize(JSON.stringify(old))).toEqual({...old,version:SAVE_VERSION})
 const before=stateHash(w.s);expect(perform(w,worker,{type:'companionClinical',target:p.id,request:{kind:'diagnose'},expected:''}).ok).toBe(false);expect(stateHash(w.s)).toBe(before)
})

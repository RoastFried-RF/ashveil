import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {addWound} from '../src/core/body'
import {cancelCompanionClinical,companionClinicalQuote,requestCompanionClinical} from '../src/core/companion-clinical'
import {enlistRecruit} from '../src/core/companions'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {addToBag,makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {baseFixture,finishBase} from './base-camp-fixture'
function fixture(ally=false){
 const d=baseFixture(),{w,p,worker}=d;w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];worker.skills.medicine=50
 const thread=makeItem(w,'Item.Thread',3),needle=makeItem(w,'Item.Needle');expect(addToBag(w,worker,thread)).toBe(0);expect(addToBag(w,worker,needle)).toBe(0)
 let patient=p
 if(ally){patient=createCreature(w,'Creature.SettlementGuard',{x:19,y:21});patient.faction='coalition';patient.body.wounds=[];patient.body.missing=[];patient.bag=[];patient.equip={};patient.traumas=[];patient.effects=[];patient.asleep=false;patient.unconscious=false;patient.activity=undefined;w.s.creatures.push(patient);enlistRecruit(w,patient,1)}
 const wound=addWound(w,patient,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'선언한 초기 외부 상처'}).wound;invalidateLights(w);updatePlayerVision(w,p)
 return{...d,patient,wound,thread,needle}
}
it('field suture preview is read-only and completes on the original patient using one thread and the original needle',()=>{
 const {w,p,worker,patient,wound,thread,needle}=fixture(),request={kind:'suture',patient:patient.id,woundId:wound.id} as const,before=stateHash(w.s),q=companionClinicalQuote(w,worker,request)
 expect(q.error).toBeNull();expect(q.activity).toMatchObject({patientId:p.id,toolUid:needle.uid,supplies:[{uid:thread.uid,def:thread.def,count:1}]});expect(stateHash(w.s)).toBe(before)
 expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull();activityStep(w,worker);expect(wound.suture).toBeUndefined();expect(thread.count).toBe(3)
 const copy={db:w.db,s:deserialize(serialize(w.s))};finishBase(w,worker);finishBase(copy,copy.s.creatures.find(c=>c.id===worker.id)!);expect(stateHash(copy.s)).toBe(stateHash(w.s));expect(wound.suture).toBeDefined();expect(thread.count).toBe(2);expect(worker.bag.some(i=>i.uid===needle.uid)).toBe(true)
})
it('ordering care for another ally uses one command turn, reserves that patient and leaves the player free',()=>{
 const {w,p,worker,patient,wound}=fixture(true),request={kind:'suture',patient:patient.id,woundId:wound.id} as const,q=companionClinicalQuote(w,worker,request)
 expect(q.error).toBeNull();const result=perform(w,p,{type:'companionClinical',target:worker.id,request,expected:q.signature});expect(result).toEqual({ok:true,tu:100});expect(p.activity).toBeUndefined();expect(patient.activity).toMatchObject({kind:'careWait',healerId:worker.id});expect(worker.activity?.patientId).toBe(patient.id);finishBase(w,worker);expect(wound.suture).toBeDefined();expect(p.body.wounds).toEqual([]);expect(patient.activity).toBeUndefined()
})
it('losing the exact needle cancels the third-party procedure without spending thread or finding a replacement tool',()=>{
 const {w,worker,patient,wound,thread,needle}=fixture(true),request={kind:'suture',patient:patient.id,woundId:wound.id} as const,q=companionClinicalQuote(w,worker,request);expect(q.error).toBeNull();expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull();activityStep(w,worker)
 worker.bag.splice(worker.bag.findIndex(i=>i.uid===needle.uid),1);addToBag(w,worker,makeItem(w,'Item.Needle'));finishBase(w,worker);expect(wound.suture).toBeUndefined();expect(thread.count).toBe(3);expect(patient.activity).toBeUndefined()
})
it('amputation requires explicit permanent-loss consent and unknown patients are rejected without mutation',()=>{
 const {w,p,worker}=fixture(),knife=makeItem(w,'Item.RustyKnife');addToBag(w,worker,knife)
 p.body.tourniquets.LeftUpperArm=Math.floor(w.s.time/100)
 const request={kind:'amputate',patient:p.id,part:'LeftHand'} as const,q=companionClinicalQuote(w,worker,request),before=stateHash(w.s);expect(q.error).toBeNull();expect(requestCompanionClinical(w,worker,request,q.signature)).toContain('영구');expect(stateHash(w.s)).toBe(before)
 expect(companionClinicalQuote(w,worker,{kind:'diagnose',patient:999999}).error).not.toBeNull();expect(stateHash(w.s)).toBe(before)
 const accepted={...request,permanentLossAccepted:true},review=companionClinicalQuote(w,worker,accepted);expect(requestCompanionClinical(w,worker,accepted,review.signature)).toBeNull();expect(worker.activity?.treat).toBe('amputate')
})
it('the player can stop the exact ally consultation, with no dose/suture and no stale cancellation of a later patient',()=>{
 const {w,p,worker,patient,wound,thread}=fixture(true),request={kind:'suture',patient:patient.id,woundId:wound.id} as const,q=companionClinicalQuote(w,worker,request);expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull();activityStep(w,worker)
 const before=stateHash(w.s);expect(cancelCompanionClinical(w,worker,p.id)).not.toBeNull();expect(stateHash(w.s)).toBe(before);expect(cancelCompanionClinical(w,worker,patient.id)).toBeNull();expect(worker.activity).toBeUndefined();expect(patient.activity).toBeUndefined();expect(thread.count).toBe(3);expect(wound.suture).toBeUndefined()
})

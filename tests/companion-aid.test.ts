import {it,expect} from 'vitest'
import {baseFixture} from './base-camp-fixture'
import {addWound} from '../src/core/body'
import {addToBag,makeItem} from '../src/core/items'
import {activityStep,perform} from '../src/core/actions'
import {companionAidQuote,companionAidDecision,companionDragQuote,setCompanionAid,startCompanionDrag} from '../src/core/companion-aid'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {stopActivity,SAVE_VERSION} from '../src/core/game'
import {invalidateLights} from '../src/core/fov'
function fixture(){const d=baseFixture();d.s.map.kind='dungeon';d.s.map.ambient=1;d.s.map.lights=[];invalidateLights(d.w);const bandage=makeItem(d.w,'Item.Bandage',2);addToBag(d.w,d.worker,bandage);const wound=addWound(d.w,d.p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'유한 초기 상처'}).wound;return{...d,bandage,wound}}
it('mutual aid is opt-in and its query preserves the whole state; actual supplies are spent only on completion',()=>{
 const d=fixture(),{w,p,worker,bandage,wound}=d
 expect(companionAidDecision(w,worker)).toBeNull();expect(setCompanionAid(w,worker,'firstAid')).toBeNull()
 const before=stateHash(w.s),quote=companionAidQuote(w,worker,p);expect(quote.error).toBeNull();expect(quote.activity).toMatchObject({uid:bandage.uid,woundId:wound.id,patientId:p.id,treat:'bandage'});expect(companionAidDecision(w,worker)?.action).toEqual({type:'autoCompanionAid',target:p.id});expect(stateHash(w.s)).toBe(before)
 expect(perform(w,worker,{type:'autoCompanionAid',target:p.id}).ok).toBe(true);expect(bandage.count).toBe(2);expect(wound.bandage).toBeUndefined()
 const copy=deserialize(serialize(w.s));expect(copy).toEqual(JSON.parse(serialize(w.s)))
 for(let n=0;worker.activity&&n<40;n++)activityStep(w,worker)
 expect(wound.bandage).toBeDefined();expect(bandage.count).toBe(1);expect(p.activity).toBeUndefined();expect(companionAidQuote(w,worker,p).error).not.toBeNull()
})
it('cancelling or losing the reserved material releases the patient without a fabricated bandage',()=>{
 const d=fixture(),{w,p,worker,wound}=d;setCompanionAid(w,worker,'firstAid');perform(w,worker,{type:'autoCompanionAid',target:p.id});activityStep(w,worker);stopActivity(w,p);expect(worker.activity).toBeUndefined();expect(wound.bandage).toBeUndefined();expect(d.bandage.count).toBe(2)
 perform(w,worker,{type:'autoCompanionAid',target:p.id});worker.bag=[];activityStep(w,worker);expect(p.activity).toBeUndefined();expect(worker.activity).toBeUndefined();expect(wound.bandage).toBeUndefined()
})
it('evacuates the same unconscious patient one adjacent tile only after real work, and restores partial work exactly',()=>{
 const d=baseFixture(),{w,p,worker}=d;w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];invalidateLights(w);expect(setCompanionAid(w,worker,'rescue')).toBeNull()
 p.pos={x:17,y:20};worker.pos={x:18,y:20};p.unconscious=true
 const next={x:19,y:20},before=stateHash(w.s);expect(companionDragQuote(w,worker,p,next).error).toBeNull();expect(stateHash(w.s)).toBe(before);expect(companionAidDecision(w,worker)?.action).toMatchObject({type:'companionDrag',target:p.id})
 expect(startCompanionDrag(w,worker,p,next)).toBeNull();activityStep(w,worker);expect(p.pos).toEqual({x:17,y:20});expect(worker.pos).toEqual({x:18,y:20});const mid=deserialize(serialize(w.s));expect(mid).toEqual(JSON.parse(serialize(w.s)));const restored={db:w.db,s:mid},other=mid.creatures.find(c=>c.id===worker.id)!
 for(let n=0;worker.activity&&n<30;n++)activityStep(w,worker)
 for(let n=0;other.activity&&n<30;n++)activityStep(restored,other);expect(stateHash(mid)).toBe(stateHash(w.s))
 expect(p.pos).toEqual({x:18,y:20});expect(worker.pos).toEqual(next);expect(p.activity).toBeUndefined();expect(w.s.creatures.filter(c=>c.id===p.id)).toHaveLength(1)
})
it('blocks awake evacuation and expiry atomically; old saves gain no aid consent',()=>{
 const d=baseFixture(),{w,p,worker}=d;w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];invalidateLights(w);setCompanionAid(w,worker,'rescue');p.pos={x:17,y:20};worker.pos={x:18,y:20}
 let before=stateHash(w.s);expect(startCompanionDrag(w,worker,p,{x:19,y:20})).not.toBeNull();expect(stateHash(w.s)).toBe(before)
 p.unconscious=true;worker.companion!.paidUntil=Math.floor(w.s.time/100);before=stateHash(w.s);expect(startCompanionDrag(w,worker,p,{x:19,y:20})).not.toBeNull();expect(stateHash(w.s)).toBe(before)
 delete worker.companion!.aid;const old=JSON.parse(serialize(w.s));old.version=208;expect(deserialize(JSON.stringify(old))).toEqual({...old,version:SAVE_VERSION});expect(deserialize(JSON.stringify(old)).creatures.find(c=>c.id===worker.id)!.companion!.aid).toBeUndefined()
})
it('a rescued waiting companion keeps the relocated anchor instead of walking back after waking',()=>{
 const {w,p,worker}=baseFixture();w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];invalidateLights(w);expect(setCompanionAid(w,worker,'rescue')).toBeNull()
 const patient=structuredClone(worker);patient.id=w.s.nextId++;patient.pos={x:17,y:20};patient.companion!.order='hold';patient.companion!.anchor={...patient.pos};patient.unconscious=true;delete patient.companion!.aid;w.s.creatures.push(patient);worker.pos={x:18,y:20}
 expect(startCompanionDrag(w,worker,patient,{x:19,y:20})).toBeNull();for(let n=0;worker.activity&&n<30;n++)activityStep(w,worker)
 expect(patient.pos).toEqual({x:18,y:20});expect(patient.companion!.anchor).toEqual(patient.pos);expect(p.pos).toEqual({x:20,y:20})
})
it('can stop a fainted resting patient through the real interruption path before claiming first aid',()=>{
 const d=fixture(),{w,p,worker}=d;setCompanionAid(w,worker,'firstAid');p.activity={kind:'rest',remaining:180,total:200,label:'중단된 초기 휴식'};p.unconscious=true
 const hash=stateHash(w.s);expect(companionAidQuote(w,worker,p).error).toBeNull();expect(stateHash(w.s)).toBe(hash)
 expect(perform(w,worker,{type:'autoCompanionAid',target:p.id}).ok).toBe(true);expect(p.activity).toMatchObject({kind:'careWait',healerId:worker.id});expect(d.bandage.count).toBe(2)
})

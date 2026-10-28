import {expect,it} from 'vitest'
import {perform} from '../src/core/actions'
import {companionCarePlanQuote,requestCompanionCarePlan} from '../src/core/companion-care-plan'
import {beginCompanionScheduledCare,cancelCompanionCarePlan,scheduledCareQuote} from '../src/core/companion-care-schedule'
import {companionClinicalQuote} from '../src/core/companion-clinical'
import {commandCompanion,companionTick} from '../src/core/companions'
import {turnOf} from '../src/core/ctx'
import {playerAct,SAVE_VERSION} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {carePlanFixture} from './companion-care-plan-fixture'
import {finishBase} from './base-camp-fixture'
import {companionDecision} from '../src/core/companions'
import {setCompanionAid,startCompanionAid} from '../src/core/companion-aid'
import {killCreature} from '../src/core/combat'
function fixture(){const f=carePlanFixture(),steps=[{...f.requests[1]!,afterTurns:20},{...f.requests[1]!,afterTurns:20}];return{...f,steps}}
function waitUntil(f:ReturnType<typeof fixture>,condition:()=>boolean){for(let n=0;n<120&&!condition();n++)expect(playerAct(f.w,{type:'wait'})).toBeNull();expect(condition()).toBe(true)}
function start(f:ReturnType<typeof fixture>){const q=companionCarePlanQuote(f.w,f.worker,f.steps);expect(q.error).toBeNull();expect(requestCompanionCarePlan(f.w,f.worker,f.steps,q.signature)).toBeNull();return f.worker.companion!.carePlan!}
it('reserves finite doses read-only and executes them at two real later times while the patient remains free between them',()=>{
 const f=fixture(),before=stateHash(f.s),q=companionCarePlanQuote(f.w,f.worker,f.steps);expect(q.waitTurns).toBe(40);expect(stateHash(f.s)).toBe(before)
 const result=perform(f.w,f.p,{type:'companionCarePlan',target:f.worker.id,requests:f.steps,expected:q.signature});expect(result).toEqual({ok:true,tu:100});const plan=f.worker.companion!.carePlan!
 expect(plan).toMatchObject({status:'waiting',cursor:0,dueAt:turnOf(f.w)+20});expect(f.p.activity).toBeUndefined();expect(f.worker.activity).toBeUndefined();expect(f.drug.count).toBe(2)
 for(let n=0;n<10;n++)expect(playerAct(f.w,{type:'wait'})).toBeNull();expect(f.drug.count).toBe(2)
 waitUntil(f,()=>plan.cursor===1);expect(plan.status).toBe('waiting');expect(f.drug.count).toBe(1);expect(f.p.activity).toBeUndefined();const second=plan.dueAt!
 waitUntil(f,()=>plan.status==='complete');expect(turnOf(f.w)).toBeGreaterThanOrEqual(second);expect(plan.cursor).toBe(2);expect(f.worker.bag.some(i=>i.uid===f.drug.uid)).toBe(false);expect(f.p.activity).toBeUndefined()
})
it('retains the exact due time and source UIDs through save and resumes with a whole-state identical result',()=>{
 const f=fixture();start(f);playerAct(f.w,{type:'wait'});const copy={...f,w:{db:f.w.db,s:deserialize(serialize(f.s))}};copy.s=copy.w.s;copy.p=copy.s.creatures.find(c=>c.id===f.p.id)!;copy.worker=copy.s.creatures.find(c=>c.id===f.worker.id)!
 waitUntil(f,()=>f.worker.companion!.carePlan!.status==='complete');waitUntil(copy,()=>copy.worker.companion!.carePlan!.status==='complete');expect(stateHash(copy.s)).toBe(stateHash(f.s));expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(f.s)))
})
it('ends an already authorized patient rest only at the due time and does not wake a sleeping patient',()=>{
 const f=fixture(),p=start(f);f.w.s.time=p.dueAt!*100;f.p.activity={kind:'rest',remaining:100,label:'선언한 휴식'};const before=stateHash(f.s);expect(scheduledCareQuote(f.w,f.worker).error).toBeNull();expect(stateHash(f.s)).toBe(before);expect(beginCompanionScheduledCare(f.w,f.worker,p.uid)).toBeNull();expect(f.p.activity?.kind).toBe('careWait');finishBase(f.w,f.worker)
 const other=fixture(),plan=start(other);other.s.time=plan.dueAt!*100;other.p.asleep=true;other.p.activity={kind:'sleep',remaining:100,label:'선언한 수면'};expect(beginCompanionScheduledCare(other.w,other.worker,plan.uid)).not.toBeNull();expect(plan.status).toBe('paused');expect(other.p.asleep).toBe(true);expect(other.drug.count).toBe(2)
})
it('does not start early and refuses a replacement future drug without silently rebinding',()=>{
 const f=fixture(),plan=start(f),before=stateHash(f.s);expect(beginCompanionScheduledCare(f.w,f.worker,plan.uid)).not.toBeNull();expect(plan.status).toBe('waiting');expect(f.drug.count).toBe(2);expect(stateHash(f.s)).toBe(before)
 const g=fixture(),p=start(g);g.worker.bag=g.worker.bag.filter(i=>i.uid!==g.drug.uid);const replacement=makeItem(g.w,g.drug.def,2);addToBag(g.w,g.worker,replacement);g.s.time=p.dueAt!*100;expect(beginCompanionScheduledCare(g.w,g.worker,p.uid)).not.toBeNull();expect(replacement.count).toBe(2);expect(p.status).toBe('paused')
})
it('pauses missed deadlines, changed policy, wages, map or contract and accepts cancellation only for the exact plan',()=>{
 for(const cause of ['late','policy','wage','map','dismissed'] as const){const f=fixture(),p=start(f);if(cause==='late')f.s.time=(p.dueAt!+21)*100;if(cause==='policy')p.scheduleRule='previous-policy';if(cause==='wage')f.worker.companion!.paidUntil=turnOf(f.w);if(cause==='map')p.map='not-current-map';if(cause==='dismissed')f.worker.companion!.status='dismissed';companionTick(f.w,f.worker);expect(p.status).toBe('paused');expect(f.drug.count).toBe(2)}
 const f=fixture(),p=start(f),before=stateHash(f.s);expect(cancelCompanionCarePlan(f.w,f.worker,p.uid+1)).not.toBeNull();expect(stateHash(f.s)).toBe(before);expect(cancelCompanionCarePlan(f.w,f.worker,p.uid)).toBeNull();expect(p.status).toBe('paused');expect(f.p.activity).toBeUndefined()
})
it('new companion orders override scheduled waiting and one-off clinical work cannot overwrite it',()=>{
 const f=fixture(),plan=start(f);expect(companionClinicalQuote(f.w,f.worker,{kind:'diagnose'}).error).toContain('예약');expect(commandCompanion(f.w,f.worker,'follow')).toBeNull();expect(plan.status).toBe('paused');expect(f.worker.companion!.order).toBe('follow')
})
it('validates waiting save fields and migrates218 without fabricating a schedule',()=>{
 const f=fixture(),old=JSON.parse(serialize(f.s));old.version=218;expect(deserialize(JSON.stringify(old))).toEqual({...old,version:SAVE_VERSION});start(f)
 for(const field of ['dueAt','scheduleRule','waitTurns'] as const){const s=JSON.parse(serialize(f.s)),c=s.creatures.find((c:{id:number})=>c.id===f.worker.id);if(field==='dueAt')c.companion.carePlan.dueAt=-1;if(field==='scheduleRule')delete c.companion.carePlan.scheduleRule;if(field==='waitTurns')c.companion.carePlan.steps[0].waitTurns=.5;expect(()=>deserialize(JSON.stringify(s))).toThrow()}
 const before=stateHash(f.s);expect(perform(f.w,f.p,{type:'beginCompanionScheduledCare',uid:f.worker.companion!.carePlan!.uid}).ok).toBe(false);expect(stateHash(f.s)).toBe(before)
})
it('rejects invalid delays or excessive horizons without modifying supplies or consent',()=>{
 const f=fixture(),before=stateHash(f.s)
 for(const delay of [-1,.5,2401,Number.MAX_SAFE_INTEGER])expect(companionCarePlanQuote(f.w,f.worker,[{...f.steps[0]!,afterTurns:delay}]).error).not.toBeNull()
 expect(companionCarePlanQuote(f.w,f.worker,Array(5).fill({...f.requests[0]!,afterTurns:2400})).error).not.toBeNull();expect(stateHash(f.s)).toBe(before)
})
it('honors already enabled first aid before a future appointment and pauses only once real care starts',()=>{
 const f=fixture();expect(setCompanionAid(f.w,f.worker,'firstAid')).toBeNull();f.steps=[{...f.requests[1]!,afterTurns:200}];const p=start(f),drugBefore=structuredClone(f.drug)
 expect(companionDecision(f.w,f.worker,[])).toEqual({action:{type:'autoCompanionAid',target:f.p.id}})
 expect(p.status).toBe('waiting');expect(f.drug).toEqual(drugBefore)
 expect(startCompanionAid(f.w,f.worker,f.p)).toBeNull();expect(p.status).toBe('paused');expect(f.worker.activity?.companionAid).toBe(true)
 finishBase(f.w,f.worker);expect(f.wound.bandage).toBeDefined();expect(f.drug).toEqual(drugBefore);expect(f.bandage.count).toBe(1)
 for(let n=0;n<5;n++)playerAct(f.w,{type:'wait'});expect(p.status).toBe('paused');expect(p.cursor).toBe(0)
})
it('death pauses a waiting appointment immediately without spending or recreating the bound doses',()=>{
 const f=fixture(),p=start(f),uid=f.drug.uid;killCreature(f.w,f.worker,'감사: 시술자 사망')
 expect(p.status).toBe('paused');expect(p.reason).toContain('사망');expect(f.worker.activity).toBeUndefined();expect(f.p.activity).toBeUndefined()
 for(let n=0;n<5;n++)playerAct(f.w,{type:'wait'});expect(f.worker.bag.find(i=>i.uid===uid)?.count).toBe(2);expect(p.cursor).toBe(0)
})
it('unobserved clinician death pauses the real plan without announcing unseen clinical details',()=>{
 const f=fixture(),p=start(f);f.p.asleep=true;const before=f.s.log.length
 killCreature(f.w,f.worker,'감사: 자는 동안 시술자 사망')
 expect(p.status).toBe('paused');expect(f.s.log.slice(before).filter(l=>l.text.includes('처치 순서 중단'))).toEqual([])
})
it('death during a real treatment releases the surviving patient and round-trips the same complete state',()=>{
 const f=fixture();f.steps=[{...f.requests[1]!,afterTurns:0}];const p=start(f);expect(f.p.activity?.kind).toBe('careWait');expect(f.worker.activity?.kind).toBe('dose')
 const before=structuredClone(f.drug);killCreature(f.w,f.worker,'감사: 처치 중 사망')
 expect(p.status).toBe('paused');expect(f.p.activity).toBeUndefined();expect(f.worker.activity).toBeUndefined();expect(f.worker.bag.find(i=>i.uid===before.uid)).toEqual(before)
 const copy={db:f.w.db,s:deserialize(serialize(f.s))};for(let n=0;n<3;n++){playerAct(f.w,{type:'wait'});playerAct(copy,{type:'wait'})}
 expect(serialize(copy.s)).toBe(serialize(f.s));expect(stateHash(copy.s)).toBe(stateHash(f.s))
})

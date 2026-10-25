/** Finite explicitly approved work. Waiting does not freeze either actor or spend future medicine. */
import {companionClinicalWorkQuote} from './companion-clinical'
import {assignCompanionCare,careBindings} from './companion-care-plan'
import {pauseCompanionCarePlan} from './companion-care-plan-state'
import {companionAccess} from './companions'
import {companionDef,isCompanion} from './companion-state'
import {creatureById,log,turnOf,type World} from './ctx'
import {stopActivity} from './game'
import {canSee} from './fov'
import type {Creature} from './types'

export function companionCareScheduleTick(w:World,c:Creature){
 const plan=c.companion?.carePlan
 if(!plan||plan.status!=='waiting')return
 const policy=companionDef(w).careSchedule
 const error=!c.alive?'시술자가 사망했다':!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)?'예약한 동행·급료가 끝났다':plan.map!==w.s.map.id||plan.region!==w.s.overworld?.currentRegion?'예약한 현장을 벗어났다':!policy||plan.scheduleRule!==JSON.stringify(policy)?'예약 간호 규칙이 달라졌다':plan.dueAt===undefined||turnOf(w)>plan.dueAt+policy.maxLateTurns?'예약 처치를 시작할 기한이 지났다':null
 if(error)pauseCompanionCarePlan(w,c,error)
}
export function scheduledCareQuote(w:World,c:Creature){
 const plan=c.companion?.carePlan,patient=plan&&creatureById(w,plan.patient)
 if(!plan||plan.status!=='waiting'||!patient||plan.dueAt===undefined)return{error:'예약한 원래 환자와 처치가 없다',activity:undefined,turns:0}
 if(turnOf(w)<plan.dueAt)return{error:'아직 예약한 처치 시각이 아니다',activity:undefined,turns:0}
 if(!w.s.creatures.includes(patient)||!canSee(w,c,patient.pos))return{error:'예약한 환자를 현장에서 직접 볼 수 없다',activity:undefined,turns:0}
 // Prior consent permits ending ordinary rest, not waking a sleeper or interrupting another task.
 const resting=patient.activity?.kind==='rest',p=resting?{...patient,activity:undefined}:patient
 const shadow:World=resting?{db:w.db,s:{...w.s,creatures:w.s.creatures.map(o=>o===patient?p:o)}}:w
 const step=plan.steps[plan.cursor]!,q=companionClinicalWorkQuote(shadow,c,step.request,true)
 if(!q.error&&JSON.stringify(careBindings(c,q.activity!))!==JSON.stringify(step.bindings))q.error='확인한 원래 도구·의료품이 달라졌다'
 return q
}
export function beginCompanionScheduledCare(w:World,c:Creature,uid:number):string|null{
 const plan=c.companion?.carePlan
 if(!plan||plan.uid!==uid||plan.status!=='waiting')return '시작하려던 원래 예약이 달라졌다'
 if(plan.dueAt!==undefined&&turnOf(w)<plan.dueAt)return '아직 예약한 처치 시각이 아니다'
 companionCareScheduleTick(w,c);if(plan.status!=='waiting')return plan.reason??'예약 처치를 중단했다'
 const q=scheduledCareQuote(w,c)
 if(q.error){pauseCompanionCarePlan(w,c,q.error);return q.error}
 const patient=creatureById(w,plan.patient)!
 if(patient.activity?.kind==='rest')stopActivity(w,patient)
 plan.status='running';plan.dueAt=undefined;plan.updatedAt=turnOf(w)
 q.activity!.companionCarePlan=uid;assignCompanionCare(w,c,q.activity!,q.turns)
 log(w,'info',`${c.name}이(가) 예약한 ${q.activity!.label}을(를) 시작했다.`)
 return null
}
export function companionCareScheduleDecision(w:World,c:Creature){
 const plan=c.companion?.carePlan
 if(plan?.status!=='waiting')return null
 return plan.dueAt!==undefined&&turnOf(w)>=plan.dueAt?{action:{type:'beginCompanionScheduledCare' as const,uid:plan.uid}}:{action:{type:'wait' as const}}
}
export function companionCarePlanCancelError(w:World,c:Creature,uid:number){
 const access=companionAccess(w,c,'clinical');if(access)return access
 const plan=c.companion?.carePlan
 return !isCompanion(w,c)||!plan||plan.uid!==uid||!['running','waiting'].includes(plan.status)?'중단하려던 원래 처치 순서가 달라졌다':null
}
export function cancelCompanionCarePlan(w:World,c:Creature,uid:number){
 const error=companionCarePlanCancelError(w,c,uid);if(error)return error
 pauseCompanionCarePlan(w,c,'부탁한 예약·처치 순서를 직접 취소했다')
 if(c.activity?.companionCarePlan===uid)stopActivity(w,c)
 return null
}

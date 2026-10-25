// Explicit field consultations. A request grants exactly one examination or one real dose.
import {hostileAware} from './action-time'
import {capacity,totalBleed} from './body'
import {clinicalPlan,type ClinicRequest} from './clinic'
import {companionClinicalRule,companionDef,isCompanion} from './companion-state'
import {companionAccess} from './companions'
import {creatureById,log,player,turnOf,type World} from './ctx'
import {canSee,lightLevel} from './fov'
import {treatmentAccess} from './treatment'
import {stopActivity} from './game'
import type {Activity,Creature} from './types'

export type CompanionClinicalRequest=ClinicRequest&{patient?:number;permanentLossAccepted?:boolean}
export function companionClinicalQuote(w:World,c:Creature,request:CompanionClinicalRequest){
 return companionClinicalWorkQuote(w,c,request)
}
/** Continuing an explicitly approved sequence requires the patient, not another conversation with the leader. */
export function companionClinicalWorkQuote(w:World,c:Creature,request:CompanionClinicalRequest,continuing=false){
 const leader=player(w),p=request?.patient===undefined?leader:creatureById(w,request.patient),policy=companionClinicalRule(w),out={error:null as string|null,turns:0,quality:null as number|null,lines:[] as string[],activity:undefined as Activity|undefined,signature:''}
 const fail=(error:string)=>{out.error=error;return out}
 if(!request||request.patient!==undefined&&!Number.isSafeInteger(request.patient)||request.uid!==undefined&&!Number.isSafeInteger(request.uid)||request.woundId!==undefined&&!Number.isSafeInteger(request.woundId)||request.part!==undefined&&typeof request.part!=='string')return fail('실제 환자·상처·약·부위의 진료를 골라야 한다')
 if(!policy||policy.defType!=='Clinic')return fail('현재 구성에 동료 진료 규칙이 없다')
 if(!p||p===c||p!==leader&&!isCompanion(w,p)||!p.alive||p.captivity||p.asleep||p.unconscious||p.activity||p.breakdown||capacity(w,p,'consciousness')<.5||!continuing&&!canSee(w,leader,p.pos))return fail('직접 관찰한 깨어 있는 나 또는 동료를 환자로 골라야 한다')
 if(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w))return fail('급료 기간이 남은 동료에게 부탁해야 한다')
 const access=(continuing?null:companionAccess(w,c))??treatmentAccess(w,c,p);if(access)return fail(access)
 if(!w.s.creatures.includes(c)||!w.s.creatures.includes(p)||c.activity)return fail('같은 현장에서 하던 일을 마친 뒤 진료해야 한다')
 if([c,p].some(a=>a.mapId!==undefined&&a.mapId!==w.s.map.id)||c.body.machine||w.db.body(c.body.def).kind!=='humanoid'||c.breakdown||c.leading)return fail('같은 현장의 손을 쓸 수 있는 동료가 필요하다')
 if(c.companionRecovery||c.recoveryCargo||w.s.map.baseCamp?.tasks[c.id])return fail('맡긴 현장 작업을 먼저 마치거나 중단해야 한다')
 if(hostileAware(w,c)||hostileAware(w,p))return fail('위협을 벗어난 뒤 진료를 부탁해야 한다')
 if(!canSee(w,c,p.pos)||lightLevel(w,c.pos)>=2||lightLevel(w,p.pos)>=2||capacity(w,c,'sight')<.2)return fail('환자를 살필 시력과 빛이 필요하다')
 const needs=companionDef(w),aid=needs.aid
 if(totalBleed(w,c)>0||c.needs.kcal<needs.eatBelow||c.needs.waterDeficit>=needs.drinkAbove||c.needs.fatigue>=needs.sleepAt||aid&&(c.needs.bodyTemp<aid.minBodyTemp||c.needs.bodyTemp>aid.maxBodyTemp))return fail('동료의 출혈·식사·식수·휴식·체온을 먼저 돌봐야 한다')
 const plan=clinicalPlan(w,p,c,request,policy);if(plan.error)return fail(plan.error)
 out.activity=plan.activity;out.quality=plan.quality;out.lines=plan.lines
 out.activity!.companionClinical=policy.id
 out.turns=out.activity!.total!+Math.ceil(Math.max(0,c.nextAct-w.s.time)/100)
 out.signature=JSON.stringify({request,patient:p.id,policy:policy.id,turns:out.turns,quality:out.quality,lines:out.lines,uid:out.activity!.uid,toolUid:out.activity!.toolUid,supplies:out.activity!.supplies??[]})
 return out
}
export function requestCompanionClinical(w:World,c:Creature,request:CompanionClinicalRequest,expected:string):string|null{
 const q=companionClinicalQuote(w,c,request);if(q.error)return q.error
 if(request.kind==='amputate'&&request.permanentLossAccepted!==true)return '해당 부위의 영구 상실·출혈·실신·사망 위험을 직접 확인해야 한다'
 if(expected!==q.signature)return '약·몸 상태·검사 여건이 달라졌다. 진료 내용을 다시 확인해야 한다'
 const p=creatureById(w,q.activity!.patientId)!;c.activity=q.activity!;c.activity.woundCount=c.body.wounds.length;c.ai.path=undefined
 p.activity={kind:'careWait',healerId:c.id,remaining:q.turns,total:q.turns,label:`${c.name}의 ${c.activity.label}`}
 log(w,'info',`${c.name}에게 ${p.name}의 ${c.activity.label}을(를) 부탁했다. ${request.kind==='dose'?'정한 실제 약을 완료 때 1회분만 쓴다.':request.kind==='diagnose'?'진찰이 끝나면 소견을 기록한다.':'원래 도구·소모품으로 실제 처치한다.'}`)
 return null
}
export function companionClinicalCancelError(w:World,c:Creature,patient:number):string|null{
 const access=companionAccess(w,c,'clinical');if(access)return access
 if(!isCompanion(w,c)||!c.activity?.companionClinical||c.activity.patientId!==patient)return '중단하려던 원래 동료 진료가 달라졌다'
 return null
}
export function cancelCompanionClinical(w:World,c:Creature,patient:number):string|null{
 const error=companionClinicalCancelError(w,c,patient);if(error)return error
 stopActivity(w,c);log(w,'info',`${c.name}에게 부탁한 진료를 중단시켰다. 이미 적용된 처치와 사용한 물품은 되돌리지 않는다.`);return null
}

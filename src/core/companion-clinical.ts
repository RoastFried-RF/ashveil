// Explicit field consultations. A request grants exactly one examination or one real dose.
import {channelTurns,hostileAware} from './action-time'
import {capacity,totalBleed} from './body'
import {clinicalDosePlan} from './clinical-drugs'
import {companionClinicalRule,companionDef,isCompanion} from './companion-state'
import {companionAccess} from './companions'
import {log,player,turnOf,type World} from './ctx'
import {canSee,lightLevel} from './fov'
import {treatmentArm} from './medical'
import {masteryStage} from './skills'
import {treatmentAccess,treatQuality} from './treatment'
import type {Activity,Creature} from './types'

export type CompanionClinicalRequest={kind:'diagnose'}|{kind:'dose';uid:number;woundId?:number}
export function companionClinicalQuote(w:World,c:Creature,request:CompanionClinicalRequest){
 const p=player(w),policy=companionClinicalRule(w),out={error:null as string|null,turns:0,quality:null as number|null,lines:[] as string[],activity:undefined as Activity|undefined,signature:''}
 const fail=(error:string)=>{out.error=error;return out}
 if(!request||!['diagnose','dose'].includes(request.kind)||request.kind==='dose'&&(!Number.isSafeInteger(request.uid)||request.woundId!==undefined&&!Number.isSafeInteger(request.woundId)))return fail('진찰 또는 실제 약의 1회 투여를 골라야 한다')
 if(!policy||policy.defType!=='Clinic')return fail('현재 구성에 동료 진료 규칙이 없다')
 if(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w))return fail('급료 기간이 남은 동료에게 부탁해야 한다')
 const access=companionAccess(w,c)??treatmentAccess(w,c,p);if(access)return fail(access)
 if([c,p].some(a=>a.mapId!==undefined&&a.mapId!==w.s.map.id)||c.body.machine||w.db.body(c.body.def).kind!=='humanoid'||c.breakdown||c.leading)return fail('같은 현장의 손을 쓸 수 있는 동료가 필요하다')
 if(c.companionRecovery||c.recoveryCargo||w.s.map.baseCamp?.tasks[c.id])return fail('맡긴 현장 작업을 먼저 마치거나 중단해야 한다')
 if(hostileAware(w,c)||hostileAware(w,p))return fail('위협을 벗어난 뒤 진료를 부탁해야 한다')
 if(!canSee(w,c,p.pos)||lightLevel(w,c.pos)>=2||lightLevel(w,p.pos)>=2||capacity(w,c,'sight')<.2)return fail('환자를 살필 시력과 빛이 필요하다')
 const needs=companionDef(w),aid=needs.aid
 if(totalBleed(w,c)>0||c.needs.kcal<needs.eatBelow||c.needs.waterDeficit>=needs.drinkAbove||c.needs.fatigue>=needs.sleepAt||aid&&(c.needs.bodyTemp<aid.minBodyTemp||c.needs.bodyTemp>aid.maxBodyTemp))return fail('동료의 출혈·식사·식수·휴식·체온을 먼저 돌봐야 한다')
 if(request.kind==='diagnose'){
  if(masteryStage(w,c,'medicine')<policy.examination.mastery)return fail(`진찰에는 의료 숙달${policy.examination.mastery}단계가 필요하다`)
  const n=channelTurns(w,c,policy.examination.turns,{arm:treatmentArm(w,c)});if(n===null)return fail('동료가 손을 쓸 수 없다')
  const q=treatQuality(w,c,0,undefined,{patient:p});out.quality=q.q;out.lines=q.lines
  out.activity={kind:'diagnose',patientId:p.id,remaining:n,total:n,label:'동료 진찰'}
 }else{
  const plan=clinicalDosePlan(w,c,p,policy,request.uid,request.woundId);if(plan.error)return fail(plan.error)
  out.activity=plan.activity;out.lines=plan.lines
 }
 out.activity!.companionClinical=policy.id
 out.turns=out.activity!.total!+Math.ceil(Math.max(0,c.nextAct-w.s.time)/100)
 out.signature=JSON.stringify({request,policy:policy.id,turns:out.turns,quality:out.quality,lines:out.lines,supplies:out.activity!.supplies??[]})
 return out
}
export function requestCompanionClinical(w:World,c:Creature,request:CompanionClinicalRequest,expected:string):string|null{
 const q=companionClinicalQuote(w,c,request);if(q.error)return q.error
 if(expected!==q.signature)return '약·몸 상태·검사 여건이 달라졌다. 진료 내용을 다시 확인해야 한다'
 const p=player(w);c.activity=q.activity!;c.activity.woundCount=c.body.wounds.length;c.ai.path=undefined
 p.activity={kind:'careWait',healerId:c.id,remaining:q.turns,total:q.turns,label:`${c.name}의 ${c.activity.label}`}
 log(w,'info',`${c.name}에게 ${c.activity.label}을(를) 부탁했다. ${request.kind==='dose'?'정한 실제 약을 완료 때 1회분만 쓴다.':'진찰이 끝나면 소견을 기록한다.'}`)
 return null
}

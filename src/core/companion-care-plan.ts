import {companionClinicalWorkQuote,type CompanionClinicalRequest} from './companion-clinical'
import {companionDef} from './companion-state'
import {creatureById,log,player,turnOf,type World} from './ctx'
import {findItem} from './items'
import {pauseCompanionCarePlan} from './companion-care-plan-state'
import type {Activity,CompanionCareStep,Creature} from './types'
export type CompanionCarePlanRequest=CompanionClinicalRequest&{afterTurns?:number}

export function careBindings(c:Creature,a:Activity):CompanionCareStep['bindings']{
 const item=a.uid===undefined?undefined:findItem(c,a.uid),tool=a.toolUid===undefined?undefined:findItem(c,a.toolUid)
 return{...(item?{uid:{uid:item.uid,def:item.def}}:{}),...(tool?{tool:{uid:tool.uid,def:tool.def}}:{}),supplies:structuredClone(a.supplies??[])}
}
export function assignCompanionCare(w:World,c:Creature,a:Activity,turns:number){
 const p=creatureById(w,a.patientId)!
 c.activity=a;a.woundCount=c.body.wounds.length;c.ai.path=undefined
 p.activity={kind:'careWait',healerId:c.id,remaining:turns,total:turns,label:`${c.name}의 ${a.label}`}
}
/** Quote with a private inventory ledger: later steps cannot reserve already allocated quantities. */
export function companionCarePlanQuote(w:World,c:Creature,requests:CompanionCarePlanRequest[]){
 const def=companionDef(w),schedule=def.careSchedule,maxSteps=def.carePlanMaxSteps??0,out={error:null as string|null,steps:[] as CompanionCareStep[],turns:0,waitTurns:0,signature:'',maxSteps,schedule}
 const fail=(error:string)=>{out.error=error;return out}
 if(!Array.isArray(requests)||requests.length<1||requests.length>maxSteps)return fail(`처치 순서는 1~${maxSteps}개를 골라야 한다`)
 if(c.companion?.carePlan&&['running','waiting'].includes(c.companion.carePlan.status))return fail('진행·예약 중인 처치 순서를 먼저 중단해야 한다')
 const doctor=structuredClone(c),shadow:World={db:w.db,s:{...w.s,creatures:w.s.creatures.map(o=>o===c?doctor:o)}}
 const signatures:string[]=[],patient=requests[0]?.patient??player(w).id
 for(let index=0;index<requests.length;index++){
  const request=requests[index]
  if(!request||request.kind==='amputate'||request.permanentLossAccepted)return fail('영구 상실을 남기는 절단은 따로 상담·확인해야 한다')
  if((request.patient??player(w).id)!==patient)return fail('한 처치 순서는 같은 환자에게만 맡길 수 있다')
  const wait=request.afterTurns??0
  if(!Number.isSafeInteger(wait)||wait<0||wait>0&&(!schedule||wait>schedule.maxDelayTurns))return fail('예약 대기 시간이 허용된 범위를 벗어났다')
  out.waitTurns+=wait
  if(schedule&&out.waitTurns>schedule.maxSpanTurns)return fail('예약 대기 시간의 합이 허용된 범위를 벗어났다')
  const normalized={kind:request.kind,patient,...(request.uid===undefined?{}:{uid:request.uid}),...(request.woundId===undefined?{}:{woundId:request.woundId}),...(request.part===undefined?{}:{part:request.part})} as CompanionCareStep['request']
  const q=companionClinicalWorkQuote(shadow,doctor,normalized)
  if(q.error)return fail(`${index+1}번째 처치: ${q.error}`)
  const a=q.activity!,bound=careBindings(doctor,a)
  if(normalized.kind==='dose'&&out.steps.some(s=>s.request.kind==='dose'&&s.bindings.uid?.def===bound.uid?.def))q.lines.push('앞 단계에도 같은 약이 있다. 반복 투여는 내성·과용 위험과 지속 시간 갱신을 다시 확인해야 한다.')
  out.steps.push({request:normalized,label:a.label!,turns:a.total!,quality:q.quality,lines:q.lines,bindings:bound,...(wait?{waitTurns:wait}:{})});signatures.push(q.signature)
  // Consume only the private quote inventory, using the same count/uses semantics as treatment.
  for(const supply of bound.supplies){
   const it=findItem(doctor,supply.uid)!
   if(supply.uses!==undefined){it.uses=(it.uses??0)-supply.uses;if(it.uses<=0)it.count--}
   else it.count-=supply.count
   if(it.count<=0){doctor.bag=doctor.bag.filter(i=>i.uid!==it.uid);if(doctor.equip.belt?.contents)doctor.equip.belt.contents=doctor.equip.belt.contents.filter(i=>i.uid!==it.uid)}
  }
  out.turns+=a.total!
 }
 out.turns+=Math.ceil(Math.max(0,c.nextAct-w.s.time)/100)+out.waitTurns
 out.signature=JSON.stringify({patient,map:w.s.map.id,region:w.s.overworld?.currentRegion,maxSteps,schedule,steps:out.steps,signatures})
 return out
}
export function requestCompanionCarePlan(w:World,c:Creature,requests:CompanionCarePlanRequest[],expected:string):string|null{
 const q=companionCarePlanQuote(w,c,requests);if(q.error)return q.error
 if(expected!==q.signature)return '처치 순서·환자·원래 도구나 수량이 달라졌다. 다시 확인해야 한다'
 const first=q.steps[0]!,work=companionClinicalWorkQuote(w,c,first.request)
 if(work.error)return work.error
 const now=turnOf(w),uid=w.s.nextId++
 c.companion!.carePlan={uid,patient:first.request.patient,map:w.s.map.id,region:w.s.overworld?.currentRegion,startedAt:now,updatedAt:now,status:first.waitTurns?'waiting':'running',cursor:0,steps:q.steps,...(q.waitTurns?{scheduleRule:JSON.stringify(q.schedule)}:{}),...(first.waitTurns?{dueAt:now+first.waitTurns}:{})}
 if(!first.waitTurns){work.activity!.companionCarePlan=uid;assignCompanionCare(w,c,work.activity!,work.turns)}
 log(w,'info',`${c.name}에게 ${creatureById(w,first.request.patient)!.name}의 처치 ${q.steps.length}개를 순서대로 맡겼다. ${q.waitTurns?'예약 사이에는 환자가 자유롭게 행동하고 동료는 현장에서 기다린다. ':''}각 단계에서 원래 물품과 몸 상태를 다시 확인한다.`)
 return null
}
/** Called after a real completed work attempt and patient release, before the next input turn. */
export function advanceCompanionCarePlan(w:World,c:Creature,act:Activity,applied:boolean){
 const plan=c.companion?.carePlan
 if(!plan||plan.status!=='running'||act.companionCarePlan!==plan.uid)return false
 c.activity=undefined
 if(!applied){pauseCompanionCarePlan(w,c,'마지막 처치를 적용하지 못했다');return false}
 plan.cursor++;plan.updatedAt=turnOf(w)
 if(plan.cursor===plan.steps.length){plan.status='complete';log(w,'good',`${c.name}에게 맡긴 처치 ${plan.steps.length}개를 마쳤다. 회복과 후유증은 환자의 실제 상태를 따른다.`);return false}
 if(plan.map!==w.s.map.id||plan.region!==w.s.overworld?.currentRegion){pauseCompanionCarePlan(w,c,'정한 처치 현장을 벗어났다');return false}
 const step=plan.steps[plan.cursor]!
 if(step.waitTurns){plan.status='waiting';plan.dueAt=turnOf(w)+step.waitTurns;log(w,'info',`${c.name}의 다음 처치는 ${step.waitTurns}턴 뒤다. 그때 같은 현장의 환자 곁에서 다시 확인한다.`);return false}
 const q=companionClinicalWorkQuote(w,c,step.request,true)
 const error=q.error??(JSON.stringify(careBindings(c,q.activity!))!==JSON.stringify(step.bindings)?'확인한 원래 도구·의료품이 달라졌다':null)
 if(error){pauseCompanionCarePlan(w,c,error);return false}
 q.activity!.companionCarePlan=plan.uid;assignCompanionCare(w,c,q.activity!,q.turns)
 return true
}

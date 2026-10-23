// Requested field first aid uses the companion's actual hands, supplies and treatment turns.
import {hostileAware} from './action-time'
import {capacity,totalBleed,isMissing} from './body'
import {companionAccess} from './companions'
import {companionDef,isCompanion} from './companion-state'
import {log,player,turnOf,type World} from './ctx'
import {canSee,lightLevel} from './fov'
import {itemDef,supplyItems} from './items'
import {startTreatment,treatQuality} from './treatment'
import type {Activity,Creature,NpcCareDef} from './types'

export type CompanionCareKind='bandage'|'disinfect'|'splint'
export interface CompanionCareRequest {kind:CompanionCareKind;woundId:number}
export interface CompanionCareQuote {error:string|null;turns:number;quality:number|null;materialUid?:number;materialLabel?:string;activity?:Activity}
export function companionCareQuote(w:World,provider:Creature,request:CompanionCareRequest):CompanionCareQuote{
 const out:CompanionCareQuote={error:null,turns:0,quality:null},patient=player(w),fail=(error:string)=>{out.error=error;return out}
 if(!['bandage','disinfect','splint'].includes(request.kind)||!Number.isSafeInteger(request.woundId))return fail('붕대·세척·부목 중 실제 상처의 처치를 골라야 한다')
 if(!isCompanion(w,provider)||provider.companion?.status!=='employed'||provider.companion.paidUntil<=turnOf(w))return fail('급료 기간이 남은 내 동료에게 부탁해야 한다')
 const access=companionAccess(w,provider);if(access)return fail(access)
 if([provider,patient].some(c=>c.mapId!==undefined&&c.mapId!==w.s.map.id)||provider.body.machine||w.db.body(provider.body.def).kind!=='humanoid'||provider.breakdown)return fail('같은 현장에서 처치할 수 있는 동료가 필요하다')
 if(provider.companionRecovery||provider.recoveryCargo||w.s.map.baseCamp?.tasks[provider.id])return fail('맡긴 현장 작업을 먼저 마치거나 중단해야 한다')
 if(hostileAware(w,provider)||hostileAware(w,patient))return fail('위협이 가신 뒤 안전한 곳에서 처치를 부탁해야 한다')
 if(!canSee(w,provider,patient.pos)||lightLevel(w,provider.pos)>=2||lightLevel(w,patient.pos)>=2||capacity(w,provider,'sight')<.2)return fail('동료가 내 상처를 확인할 빛과 시력이 필요하다')
 const needs=companionDef(w),care=w.db.get<NpcCareDef>('NpcCare.Hearth')
 if(totalBleed(w,provider)>0||provider.needs.kcal<needs.eatBelow||provider.needs.waterDeficit>=needs.drinkAbove||provider.needs.fatigue>=needs.sleepAt||provider.needs.bodyTemp<care.minBodyTemp||provider.needs.bodyTemp>care.maxBodyTemp)return fail('동료가 먼저 자기 출혈·허기·갈증·피로·체온을 돌봐야 한다')
 const wound=patient.body.wounds.find(wd=>wd.id===request.woundId)
 if(!wound||wound.internal||wound.healed>=wound.severity||isMissing(w,patient,wound.part))return fail('아직 아물지 않은 외부 상처를 골라야 한다')
 const supplies=supplyItems(provider).filter(it=>it.count>0&&!it.half&&!it.missingItem&&(it.uses??1)>0&&(it.durability??100)>0&&itemDef(w,it).medical?.kind===request.kind&&!itemDef(w,it).medical?.dirty&&!it.dirty)
  .sort((a,b)=>(itemDef(w,b).medical?.tool??0)-(itemDef(w,a).medical?.tool??0)||a.uid-b.uid)
 if(!supplies.length)return fail('동료에게 필요한 실제 깨끗한 처치 물품이 없다. 배낭 물품 건네기로 준비할 수 있다')
 const material=supplies[0],actor:Creature={...provider,activity:undefined}
 // startTreatment only writes the actor's activity and optional player log; isolate both.
 const shadow:World={db:w.db,s:{...w.s,log:[...w.s.log]}}
 const result=startTreatment(shadow,actor,material.uid,request.woundId,undefined,undefined,patient)
 if(!result.ok||!actor.activity)return fail(result.msg??'동료가 이 상처를 처치할 수 없다')
 out.activity=actor.activity;out.turns=actor.activity.total!+Math.ceil(Math.max(0,provider.nextAct-w.s.time)/100)
 out.quality=treatQuality(w,provider,itemDef(w,material).medical?.tool??0,wound,{patient}).q
 out.materialUid=material.uid;out.materialLabel=itemDef(w,material).label
 return out
}

export function requestCompanionCare(w:World,provider:Creature,request:CompanionCareRequest,expectedUid:number,expectedTurns:number,expectedQuality:number):string|null{
 const q=companionCareQuote(w,provider,request);if(q.error)return q.error
 if(q.materialUid!==expectedUid||q.turns!==expectedTurns||q.quality!==expectedQuality)return '동료의 처치 물품이나 몸 상태가 달라졌다. 다시 확인해야 한다'
 const patient=player(w)
 provider.activity=q.activity!;provider.activity.woundCount=provider.body.wounds.length
 patient.activity={kind:'careWait',healerId:provider.id,remaining:q.turns,total:q.turns,label:`${provider.name}의 응급 처치 — ${q.activity!.label}`}
 provider.ai.path=undefined
 log(w,'info',`${provider.name}에게 ${q.activity!.label}을(를) 부탁했다. 처치 동안 기다린다.`)
 return null
}

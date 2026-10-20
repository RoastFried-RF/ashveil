// 실제 물린 원래 상처의 시간 제한 예방. 판정과 잠복 시계는 노출 때 한 번만 뽑는다.
import {rng,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {diseaseStream} from './disease-state'
import type {Creature,DiseaseDef,Wound} from './types'

export function recordBiteRisk(w:World,victim:Creature,attacker:Creature,wd:Wound){
 const rule=w.db.creature(attacker.def).biteDisease
 if(rule?.prevention){const current=victim.body.wounds.find(x=>x.id===wd.id||x.mergedIds?.includes(wd.id));(current??wd).biteCareUntil=turnOf(w)+rule.prevention.turns}
 if(!rule?.prevention||w.db.body(victim.body.def).kind==='mechanical'||victim.immuneDiseases?.includes(rule.id)||w.db.creature(victim.def).diseaseImmune?.includes(rule.id)||victim.diseases?.some(s=>s.def===rule.id))return
 const d=w.db.get<DiseaseDef>(rule.id),r=rng(w,diseaseStream('bite.pending.'+victim.id)),at=turnOf(w),chance=attacker.biteCarrier===rule.id?rule.carrier?.transmission??rule.chance:rule.chance,roll=r.float()
 if(roll>=chance)return
 ;(victim.biteRisks??=[]).push({def:rule.id,wound:wd.id,part:wd.part,attacker:attacker.id,at,deadline:at+rule.prevention.turns,roll,chance,mult:rule.prevention.chanceMult,incubatesUntil:at+r.int(d.incubationDays[0]*TURNS_PER_DAY,d.incubationDays[1]*TURNS_PER_DAY)})
}

export function washBiteRisk(w:World,c:Creature,wd:Wound){
 const now=turnOf(w)
 for(const risk of c.biteRisks??[])if((risk.wound===wd.id||wd.mergedIds?.includes(risk.wound))&&now>=risk.at&&now<=risk.deadline)risk.washedAt=now
}

/** 세척 뒤 같은 원래 물린 상처를 실제로 소작했을 때만 예방 기록을 남긴다. */
export function mitigateBiteRisk(w:World,c:Creature,wd:Wound){
 const now=turnOf(w)
 for(const risk of c.biteRisks??[]){
  if(risk.mitigated||risk.wound!==wd.id&&!wd.mergedIds?.includes(risk.wound)||now>risk.deadline||now<risk.at||risk.washedAt===undefined||risk.washedAt<risk.at||risk.washedAt>now)continue
  risk.mitigated=true
 }
}

export function biteRiskTick(w:World,c:Creature){
 if(!c.biteRisks?.length)return
 const now=turnOf(w)
 c.biteRisks=c.biteRisks.filter(risk=>{
  if(now<=risk.deadline)return true
  if(risk.roll<risk.chance*(risk.mitigated?risk.mult:1)&&!c.immuneDiseases?.includes(risk.def)&&!w.db.creature(c.def).diseaseImmune?.includes(risk.def)&&!c.diseases?.some(s=>s.def===risk.def)){
   ;(c.diseases??=[]).push({def:risk.def,incubatesUntil:risk.incubatesUntil,progress:0,immunity:0,source:{kind:'실제 물린 상처',turn:risk.at,creature:risk.attacker,wound:risk.wound,part:risk.part}})
  }
  return false
 })
 if(!c.biteRisks.length)delete c.biteRisks
}

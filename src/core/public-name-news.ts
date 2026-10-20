// 새 현장 목격 사건만 공개한다. 옛 평판 기록을 훑어 배우/공개 여부를 추정하지 않는다.
import {capacity} from './body'
import {clamp,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {canSee} from './fov'
import {activeTownRumors,publishPublicRumor,rumorNetworkRules} from './rumor-network'
import type {Creature,ReputationEvent,Rumor} from './types'
export function publishWitnessedName(w:World,event:ReputationEvent):boolean{
 const subject=event.subject,m=w.s.overworld,site=m?.sites.find(s=>s.id===m.currentRegion&&s.kind==='settlement'),actor=subject&&w.s.creatures.find(c=>c.id===subject.id&&c.name===subject.name)
 if(!rumorNetworkRules(w)?.publicNames||!site||!subject||subject.seed!==w.s.seed||!actor||event.regionId!==site.id||event.turn!==turnOf(w)||!Number.isFinite(event.delta)||!event.delta)return false
 const witness=w.s.creatures.find(c=>event.witnesses.includes(c.id)&&c.id!==actor.id&&c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.5&&w.db.body(c.body.def).kind==='humanoid'&&canSee(w,c,actor.pos))
 if(!witness)return false
 const rumor:Rumor={id:'reputation:'+subject.seed+':'+event.id,kind:'reputation',regionId:site.id,reputation:{subject:{...subject},event:event.id,delta:event.delta},text:subject.name+'의 이름이 '+(event.delta>0?'좋게':'나쁘게')+' 전해진다. '+event.reason+'.',source:witness.name+'의 현장 목격 이야기',hop:0,writtenAt:event.turn,foundAt:event.turn,claims:{what:subject.name+'의 '+event.reason+' 소식',place:{cell:{...site.cell},label:site.label},faction:event.faction,when:`${Math.floor(event.turn/TURNS_PER_DAY)+1}일차 목격`}}
 return publishPublicRumor(w,site.id,rumor)
}
/** 주민이 이미 도착한 공개 소식에서 들은 이름만 첫 만남에 반영한다. 조회는 상태/난수를 바꾸지 않는다. */
export function townNameOpinion(w:World,observer:Creature,subject:Creature):number{
 const site=w.s.overworld?.currentRegion,d=rumorNetworkRules(w)
 if(!site||!d?.publicNames||!d.firstImpressionCap||![observer.residentSite,observer.traderSite,observer.clinicSite].includes(site))return 0
 let score=0
 for(const rumor of activeTownRumors(w,site)){
  const r=rumor.reputation,s=r?.subject
  if(rumor.kind!=='reputation'||!s||s.seed!==w.s.seed||s.id!==subject.id||s.name!==subject.name||!Number.isFinite(r!.delta))continue
  score+=Math.trunc(r!.delta*(rumor.relay!.accuracy/100))
 }
 return clamp(score,-d.firstImpressionCap,d.firstImpressionCap)
}

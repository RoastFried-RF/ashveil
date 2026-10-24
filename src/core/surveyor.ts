/** Noncombat surveillance: real optics/antenna/power, consecutive work and finite reports. */
import type {Action,ActResult} from './actions'
import {capacity,hpMax,isMissing,partEff} from './body'
import {fx} from './combat'
import {creatureById,log,player,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {gardenAlertState,recordGardenReport} from './garden-alert'
import {cheb,dirIndex} from './geom'
import {machineAction,machineReady,machineRules} from './machine-state'
import {hasEyeProtection} from './items'
import {emitNoise} from './perception'
import {addEffect} from './traits'
import type {Creature} from './types'
type Navigation={toward(pos:{x:number;y:number}):Action|null;away(threats:{pos:{x:number;y:number}}[]):Action|null}
const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
export const surveyRules=(w:World,c:Creature)=>w.db.creature(c.def).survey
function ready(w:World,c:Creature){return c.alive&&!c.unconscious&&!c.asleep&&machineReady(w,c)&&capacity(w,c,'consciousness')>=.3}
function state(c:Creature){return c.surveyState??={progress:0,nextReportAt:0,patrolIndex:0}}
function watches(w:World,c:Creature,target:Creature){
 const rule=surveyRules(w,c);if(!rule||!ready(w,c)||!target.alive||target.id===c.id||target.faction===c.faction||w.db.body(target.body.def).kind!=='humanoid')return false
 const[x,y,width,height]=rule.watchRect,p=target.pos
 return p.x>=x&&p.x<x+width&&p.y>=y&&p.y<y+height&&canSee(w,c,p)
}
export function surveyError(w:World,c:Creature,target:Creature|undefined){
 const rule=surveyRules(w,c)
 if(!rule||!target||!watches(w,c,target))return '실제로 관찰할 침입자가 없다'
 if(isMissing(w,c,rule.antenna)||partEff(w,c,rule.antenna)<.3||capacity(w,c,'signal')<.3)return '신호를 보낼 안테나가 없다'
 if((c.surveyState?.nextReportAt??0)>turnOf(w)||(gardenAlertState(w)?.level??0)>=3)return '이미 보고했고 새 보고 시각이 아니다'
 return null
}
export function startSurvey(w:World,c:Creature,targetId:number):ActResult{
 if(c.activity)return fail('다른 작업이 진행 중이다')
 const target=creatureById(w,targetId),error=surveyError(w,c,target);if(error)return fail(error)
 const rule=surveyRules(w,c)!,s=state(c),turn=turnOf(w)
 if(s.target!==targetId||s.lastObservedAt===undefined||turn-s.lastObservedAt>1){if(s.progress>0)s.lastInterrupted={at:turn,progress:s.progress,target:s.target??targetId};s.progress=0}
 s.target=targetId;c.activity={kind:'survey',surveyTarget:targetId,surveyRule:JSON.stringify(rule),remaining:rule.reportTurns-s.progress,total:rule.reportTurns,woundCount:c.body.wounds.length,label:'안테나 보고'};return{ok:true,tu:0}
}
export function surveyStep(w:World,c:Creature):boolean{
 const act=c.activity;if(act?.kind!=='survey')return true
 const target=creatureById(w,act.surveyTarget),rule=surveyRules(w,c),s=state(c),turn=turnOf(w)
 const error=surveyError(w,c,target)
 if(error||act.surveyRule!==JSON.stringify(rule)||c.body.wounds.length>(act.woundCount??c.body.wounds.length)){
  s.lastInterrupted={at:turn,progress:s.progress,target:act.surveyTarget!};s.progress=0;c.activity=undefined;return true
 }
 if(s.lastObservedAt===turn)return false
 if(s.lastObservedAt!==undefined&&turn-s.lastObservedAt>1){if(s.progress>0)s.lastInterrupted={at:turn,progress:s.progress,target:act.surveyTarget!};s.progress=0}
 const direction=dirIndex(target!.pos.x-c.pos.x,target!.pos.y-c.pos.y);if(direction>=0)c.facing=direction
 s.progress++;s.lastObservedAt=turn;act.remaining=rule!.reportTurns-s.progress;act.elapsed=(act.elapsed??0)+1;machineAction(w,c,'work')
 if(s.progress<rule!.reportTurns)return false
 recordGardenReport(w,c,target!);s.nextReportAt=turn+rule!.reportCooldown;s.progress=0;c.activity=undefined
 emitNoise(w,c.pos,10,c.id)
 if(canSee(w,player(w),c.pos)){fx(w,{k:'status',id:c.id,text:'신호 보고',color:'#ddb96b',turn});log(w,'warn','측량기의 안테나가 신호를 보냈다. 이 구역의 경계가 높아졌다.')}
 return true
}
export function sensorFlash(w:World,c:Creature):ActResult{
 const rule=surveyRules(w,c),s=c.surveyState,turn=turnOf(w)
 if(!rule||!ready(w,c)||capacity(w,c,'sight')<.3||(s?.flashAt??-Infinity)+rule.flashCooldown>turn)return fail('섬광을 낼 광학 장치가 준비되지 않았다')
 const targets=w.s.creatures.filter(t=>t.id!==c.id&&t.alive&&t.faction!==c.faction&&cheb(c.pos,t.pos)<=rule.flashRadius&&hasLos(w,c.pos,t.pos)&&canSee(w,c,t.pos)&&capacity(w,t,'sight')>0)
 if(!targets.length)return fail('실제로 닿는 광학 대상이 없다')
 for(const t of targets)if(!hasEyeProtection(w,t))addEffect(t,'sensorFlash',turn+rule.flashTurns,1-rule.flashSightMult)
 state(c).flashAt=turn;machineAction(w,c,'work');emitNoise(w,c.pos,3,c.id)
 const observer=player(w),exposed=targets.some(t=>t.id===observer.id)
 if(canSee(w,observer,c.pos)||exposed){fx(w,{k:'status',id:c.id,text:'섬광',color:'#fff0bc',turn});log(w,exposed&&!hasEyeProtection(w,observer)?'warn':'info',exposed?hasEyeProtection(w,observer)?'착용한 눈 보호구가 측량기의 섬광을 막았다.':'측량기의 광학 섬광이 번쩍였다. 잠시 먼 곳이 보이지 않는다.':'측량기에서 방어 섬광이 번쩍였다.')}
 return{ok:true,tu:100}
}
export function decideSurveyor(w:World,c:Creature,nav:Navigation):Action{
 const rule=surveyRules(w,c),m=c.body.machine,d=machineRules(w,c)
 if(!rule||!m||!d||!ready(w,c))return{type:'wait'}
 const s=state(c),targets=w.s.creatures.filter(t=>watches(w,c,t)).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id),target=targets[0]
 if(m.power<d.retreatPower||c.hp<=hpMax(w,c)*.4){c.ai.mode='return';c.ai.target=undefined;return c.home?nav.toward(c.home)??{type:'wait'}:{type:'wait'}}
 if(target){
  c.ai.target=target.id;const distance=cheb(c.pos,target.pos),damaged=c.body.wounds.some(wd=>wd.sourceId===target.id&&wd.severity>wd.healed)
  if(distance<=rule.flashRadius&&(s.flashAt??-Infinity)+rule.flashCooldown<=turnOf(w))return{type:'sensorFlash'}
  if(damaged||distance<rule.keepDistance[0]){c.ai.mode='flee';return nav.away(targets)??{type:'wait'}}
  c.ai.mode='investigate'
  if(!surveyError(w,c,target))return{type:'survey',target:target.id}
  if(distance>rule.keepDistance[1])return nav.toward(target.pos)??{type:'wait'}
  return{type:'wait'}
 }
 const call=s.call
 if(call&&call.at<=turnOf(w)&&call.expiresAt>turnOf(w)&&capacity(w,c,'signal')>=.3&&!isMissing(w,c,rule.antenna)&&partEff(w,c,rule.antenna)>=.3){
  c.ai.mode='investigate';c.ai.target=undefined;c.ai.dest={...call.pos}
  return cheb(c.pos,call.pos)>rule.keepDistance[0]?nav.toward(call.pos)??{type:'wait'}:{type:'wait'}
 }
 c.ai.mode='patrol';c.ai.target=undefined
 const waypoint=rule.patrol[s.patrolIndex%rule.patrol.length]!
 if(cheb(c.pos,waypoint)<=1){s.patrolIndex=(s.patrolIndex+1)%rule.patrol.length;return{type:'wait'}}
 return nav.toward(waypoint)??{type:'wait'}
}

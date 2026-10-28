import {merchantAppraisalFixture} from './merchant-appraisal-fixture'
import {beaconsFixture} from './beacons-fixture'
import {playerAct} from '../src/core/game'
import {turnOf} from '../src/core/ctx'
import {rumorSubject} from '../src/core/rumor-subject'
import {ensureSociety} from '../src/core/diplomacy'
import {addToBag,makeItem} from '../src/core/items'
import {updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
import type {Creature,Rumor,ReputationEvent} from '../src/core/types'

// 유효한 초기 과거 소식이다. 과거의 석방/범죄를 실행한 장면으로 주장하지 않는다.
export function initialNameReport(w:World,c:Creature,delta=5,event=1):Rumor{
 return{id:'initial-name-report:'+w.s.seed+':'+event,kind:'reputation',regionId:w.s.overworld?.currentRegion,reputation:{subject:rumorSubject(w,c),event,delta},text:c.name+'의 이름을 '+(delta>0?'좋게':'나쁘게')+' 말하는 소식이다.',source:'검사 시작 전에 전해 들은 이름 소식',hop:1,writtenAt:Math.max(0,turnOf(w)-1200),foundAt:0}
}
export function nameRumorFixture(delta=5){
 const d=merchantAppraisalFixture('name-rumor-proof'),society=ensureSociety(d.w)!,site=d.s.overworld!.currentRegion!
 society.reputation[d.trader.faction]=0
 const event:ReputationEvent={id:society.nextEvent++,target:d.p.id,faction:d.trader.faction,delta,reason:'검사 시작 전 현지에 도착한 이름 소식',turn:turnOf(d.w)-1200,arrives:turnOf(d.w)-600,witnesses:[],applied:true,subject:rumorSubject(d.w,d.p),regionId:site}
 society.events.push(event);d.s.knowledge.rumors=[];delete d.trader.knownRumors
 return{...d,event,site}
}
export type NameRumorPhase='good'|'bad'|'note'|'unknown'|'beacon'|'pending'
export function nameRumorNativeFixture(phase:NameRumorPhase){
 const act=(w:World,a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 if(phase==='beacon'){
  const d=beaconsFixture();d.p.thoughts=[];d.s.knowledge.rumors=[];const report=initialNameReport(d.w,d.p,-5)
  d.from.state.inbox.push({key:'initial-name-receipt',rumor:report,from:d.to.label,receivedAt:turnOf(d.w)})
  const initialTime=d.s.time;act(d.w,{type:'beaconRead',pos:d.from.address.pos,uid:d.from.address.uid});updatePlayerVision(d.w,d.p)
  return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialReceivedRecord:true,reportId:report.id,noteUid:undefined,speakerId:undefined,pending:false}}
 }
 const d=nameRumorFixture(phase==='bad'?-5:5);let noteUid:number|undefined
 if(phase==='unknown')delete d.event.subject
 if(phase==='note'){
  const note=makeItem(d.w,'Item.Note');note.note=initialNameReport(d.w,d.p);if(addToBag(d.w,d.p,note))throw Error('initial readable name report');noteUid=note.uid
 }
 const initialTime=d.s.time;act(d.w,phase==='note'?{type:'read',uid:noteUid!}:{type:'talk',target:d.trader.id})
 if(phase==='pending')act(d.w,{type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialReceivedRecord:false,reportId:d.s.knowledge.rumors?.find(r=>r.kind==='reputation')?.id,noteUid,speakerId:d.trader.id,pending:phase==='pending'}}
}

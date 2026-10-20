import {rumorNetworkFixture} from './rumor-network-fixture'
import {rumorSubject} from '../src/core/rumor-subject'
import {turnOf} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import type {Rumor} from '../src/core/types'
export type PublicNamePhase='source'|'good'|'bad'|'pending'
export function publicNameNativeFixture(phase:PublicNamePhase){
 const d=rumorNetworkFixture();d.s.knowledge.rumors=[];d.keeper.met=false;delete d.keeper.firstImpressions
 if(phase==='source')d.m.society!.reputation[d.keeper.faction]=-60
 if(phase!=='source'){
  // 이미 도착한 유효 초기 이름 소식이다. 과거 구조/범죄/장거리 전파를 실행했다고 주장하지 않는다.
  const delta=phase==='good'?10:-10,origin=d.m.sites.find(s=>s.kind==='settlement'&&s.id!==d.site&&d.m.simulation!.settlements[s.id])!,r:Rumor={id:'initial-arrived-name:'+phase,kind:'reputation',regionId:origin.id,reputation:{subject:rumorSubject(d.w,d.p),event:1,delta},text:d.p.name+'의 '+(delta>0?'석방':'공격')+' 소식',source:origin.label+'에서 전해 온 당시 이름 소식',hop:1,writtenAt:0,foundAt:turnOf(d.w),relay:{root:'initial-arrived-name:'+phase,origin:origin.id,accuracy:100,distortions:[]}}
  d.m.rumorNetwork={towns:{[d.site]:[r]},pending:[],seen:{},sent:{}}
 }
 updatePlayerVision(d.w,d.p);const initialTime=d.s.time
 if(phase==='pending'){d.act({type:'talk',target:d.keeper.id});d.act({type:'rest',turns:20},2)}
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialArrivedReportExplicit:phase!=='source',speakerId:d.keeper.id}}
}

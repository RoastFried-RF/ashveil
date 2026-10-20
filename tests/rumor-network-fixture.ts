import {outbreakRumorFixture} from './outbreak-rumors-fixture'
import {turnOf} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
import type {Rumor} from '../src/core/types'
export function rumorNetworkFixture(){
 const d=outbreakRumorFixture(false),m=d.s.overworld!,now=turnOf(d.w)
 d.p.background=undefined;d.p.stats.per=20
 const report:Rumor={id:'initial-known-public-raid',kind:'supply',regionId:d.site,text:'먼 곳에서 들은 습격 소식',source:'검사 시작 전에 실제로 알고 있던 초기 소식',hop:0,writtenAt:now,foundAt:now,claims:{what:'촌락을 습격했다는 이야기',count:12,place:{cell:{...m.position},label:'북쪽 촌락'},faction:'reavers',when:'오늘'}}
 d.s.knowledge.rumors=[report]
 updatePlayerVision(d.w,d.p)
 const act=(action:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,action,budget);if(error)throw Error(error)}
 return {...d,report,m,act}
}
export type RumorNetworkPhase='post'|'arrival'|'pending'
export function rumorNetworkNativeFixture(phase:RumorNetworkPhase){
 const d=rumorNetworkFixture(),at=turnOf(d.w)
 if(phase!=='post'){
  // 장거리 전파가 거의 끝난 유효 초기 소식이다. 과거 게시/장거리 이동을 실행했다고 주장하지 않는다.
  const origin=d.m.sites.find(s=>s.kind==='settlement'&&s.id!==d.site&&d.m.simulation!.settlements[s.id])!,report:Rumor=structuredClone(d.report)
  report.regionId=origin.id;report.writtenAt=0;report.hop=1;report.claims!.count=18;report.source=origin.label+'에서 전해 온 소식';report.text='촌락을 습격했다는 이야기 · 18명 · 북쪽 촌락 · 약탈자 · 오늘';report.relay={root:JSON.stringify([origin.id,report.id]),origin:origin.id,accuracy:82,distortions:['count']};report.foundAt=at+2
  d.s.knowledge.rumors=[]
  d.m.rumorNetwork={towns:{},pending:[{key:'initial-near-arrival',from:origin.id,to:d.site,due:at+2,rumor:report}],seen:{},sent:{}}
  if(phase==='pending')d.act({type:'rest',turns:20},2)
 }
 return {...d,proof:{phase,initialNearArrival:phase!=='post',initialTime:at*100,actualTurns:turnOf(d.w)-at,reportId:d.report.id,speakerId:d.keeper.id}}
}

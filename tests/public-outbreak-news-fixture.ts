import {rumorNetworkFixture} from './rumor-network-fixture'
import {turnOf,TURNS_PER_DAY,TURNS_PER_HOUR} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import type {Rumor} from '../src/core/types'
export type PublicOutbreakPhase='announcement'|'arrival'|'pending'
export function publicOutbreakNativeFixture(phase:PublicOutbreakPhase){
 const d=rumorNetworkFixture();d.s.knowledge.rumors=[]
 if(phase==='announcement'){
  // 유효 초기의 새 봉쇄 결정. 과거 감염/장거리 경과를 실행한 장면이라고 주장하지 않는다.
  d.s.time=(TURNS_PER_DAY+6*TURNS_PER_HOUR-1)*100;d.p.nextAct=d.s.time
  d.stock.population.I=Math.ceil(d.stock.population.total*.1);d.stock.population.S=d.stock.population.total-d.stock.population.I;d.stock.quarantined=true
  d.stock.changes=[{day:1,kind:'quarantine',applied:false,publicAnnounced:false}]
 }else{
  // 공개 공고가 길을 거쳐 거의 도착한 유효 초기 상태. 기본 지연 규정을 줄이지 않는다.
  const origin=d.m.sites.find(s=>s.kind==='settlement'&&s.id!==d.site&&d.m.simulation!.settlements[s.id])!,at=turnOf(d.w),r:Rumor={id:`outbreak:${origin.id}:0`,kind:'outbreak',regionId:origin.id,outbreak:{disease:'Disease.GreyFever',day:0},text:origin.label+'에서 회색열 때문에 출입을 막는다는 공고',source:origin.label+'의 공개 공고를 전하는 소식',hop:1,writtenAt:0,foundAt:at+2,claims:{what:'회색열 때문에 출입을 막는다는 공고',place:{cell:{...origin.cell},label:origin.label},when:'1일차 공고'},relay:{root:JSON.stringify([origin.id,`outbreak:${origin.id}:0`]),origin:origin.id,accuracy:82,distortions:[]}}
  d.m.rumorNetwork={towns:{},pending:[{key:'initial-public-outbreak-near-arrival',from:origin.id,to:d.site,due:at+2,rumor:r}],seen:{},sent:{}}
 }
 updatePlayerVision(d.w,d.p)
 const initialTime=d.s.time
 if(phase==='pending')d.act({type:'rest',turns:20},2)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialDecisionOrNearArrivalExplicit:true,speakerId:d.keeper.id}}
}

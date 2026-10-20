import {lifeMemoriesFixture} from './life-memories-fixture'
import {introduceInfection,applySettlementChanges} from '../src/core/world-simulation'
import {addToBag,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {turnOf} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import type {Rumor} from '../src/core/types'
import {beaconsFixture} from './beacons-fixture'
export function outbreakRumorFixture(quarantine=true){
 const d=lifeMemoriesFixture(),site=d.s.overworld!.currentRegion!,stock=d.s.overworld!.simulation!.settlements[site]
 d.p.background='Bg.FeverOrphan';d.p.immuneDiseases=['Disease.GreyFever'];d.p.literacy=2;d.p.pos={x:d.keeper.pos.x+1,y:d.keeper.pos.y}
 if(quarantine){introduceInfection(d.w,site,Math.ceil(stock.population.total*.1));applySettlementChanges(d.w)}
 updatePlayerVision(d.w,d.p)
 return {...d,site,stock}
}
export function initialOutbreakReport(regionId='Region.SaltrimHarbor',at=0):Rumor{return{id:'initial-received-outbreak:'+regionId,kind:'outbreak',regionId,outbreak:{disease:'Disease.GreyFever',day:0},text:'해안 정착지에 회색열이 돌고 출입을 막는다는 소식이다.',source:'검사 시작 전에 전해 들은 역병 소식',hop:1,writtenAt:at,foundAt:0}}
export type OutbreakRumorPhase='talk'|'repeat'|'ordinary'|'note'|'beacon'|'pending'
export function outbreakRumorNativeFixture(phase:OutbreakRumorPhase){
 const act=(w:Parameters<typeof playerAct>[0],action:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(w,action,budget);if(e)throw Error(e)}
 if(phase==='beacon'){
  const d=beaconsFixture();d.p.background='Bg.FeverOrphan';d.p.immuneDiseases=['Disease.GreyFever'];d.p.thoughts=[];d.s.knowledge.rumors=[]
  const report=initialOutbreakReport(d.to.address.site,Math.max(0,turnOf(d.w)-1200))
  // 명시적인 유효 초기 수신기록이다. 이 장면이 과거 전송을 실제로 실행했다고 주장하지 않는다.
  d.from.state.inbox.push({key:'initial-plague-receipt',rumor:report,from:d.to.label,receivedAt:turnOf(d.w)})
  const initialTime=d.s.time;act(d.w,{type:'beaconRead',pos:d.from.address.pos,uid:d.from.address.uid});updatePlayerVision(d.w,d.p)
  return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialReceivedRecord:true,reportId:report.id,site:d.to.address.site,speakerId:undefined,noteUid:undefined,pending:false}}
 }
 const d=outbreakRumorFixture(phase!=='note');if(phase==='ordinary')d.p.background=undefined
 let noteUid:number|undefined,reportId:string|undefined
 if(phase==='note'){const note=makeItem(d.w,'Item.Note');note.note=initialOutbreakReport(d.site,0);if(addToBag(d.w,d.p,note))throw Error('initial actual readable report');noteUid=note.uid;reportId=note.note.id}
 const initialTime=d.s.time
 act(d.w,phase==='note'?{type:'read',uid:noteUid!}:{type:'talk',target:d.keeper.id})
 if(phase==='repeat')act(d.w,{type:'talk',target:d.keeper.id})
 if(phase==='pending')act(d.w,{type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialReceivedRecord:false,reportId:reportId??d.s.knowledge.rumors!.find(r=>r.kind==='outbreak')!.id,site:d.site,speakerId:d.keeper.id,noteUid,pending:phase==='pending'}}
}

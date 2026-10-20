import {merchantAppraisalFixture} from './merchant-appraisal-fixture'
import {hpMax} from '../src/core/body'
import {tileAt,turnOf} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {mapSurveyOffers,isMapSurvey} from '../src/core/map-commissions'
export function mapCommissionsFixture(){
 const d=merchantAppraisalFixture('map-commission-proof'),{w,s,p}=d;p.bag=[];p.hp=hpMax(w,p);p.needs.vitamin=100
 // 처음부터 유효한 현 정착지 탐험 기록이다. 과거 탐험을 실제 진행했다는 주장이 아니다.
 for(const t of s.map.tiles)delete t.observed
 for(const room of s.map.rooms){room.discovered=true;for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){const t=tileAt(w,{x,y});t.seen=true;t.observed={terrain:t.t,at:turnOf(w)}}}
 for(let y=p.pos.y-4;y<=p.pos.y+4;y++)for(let x=p.pos.x-4;x<=p.pos.x+4;x++){const t=tileAt(w,{x,y});if(t)t.roof=false}
 const paper=makeItem(w,'Item.Note'),ink=makeItem(w,'Item.Ink',3);if(addToBag(w,p,paper)||addToBag(w,p,ink))throw Error('commission material')
 invalidateLights(w);updatePlayerVision(w,p)
 const offer=()=>mapSurveyOffers(w,p,d.trader).find(o=>o.region===s.overworld!.currentRegion)!
 const action={type:'drawMap' as const,paperUid:paper.uid,inkUid:ink.uid}
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const accept=()=>{const o=offer();if(!o)throw Error('map commission offer');act({type:'mapSurveyAccept',target:d.trader.id,offer:o.id,expectedReward:o.reward});return s.overworld!.contracts!.filter(isMapSurvey).at(-1)!}
 return{...d,paper,ink,offer,accept,act,action}
}
export type MapCommissionPhase='offer'|'accepted'|'drawn'|'delivered'|'staleReward'|'pending'
export function mapCommissionsNativeFixture(phase:MapCommissionPhase){
 const d=mapCommissionsFixture(),initialTime=d.s.time,initialMoney=d.p.money!,initialBank=d.market.money
 let contract:ReturnType<typeof d.accept>|undefined,refused:string|undefined
 if(phase!=='offer'){
  contract=d.accept()
  if(['drawn','delivered','staleReward'].includes(phase))d.act(d.action)
  if(phase==='delivered')d.act({type:'mapSurveyDeliver',target:d.trader.id,contract:contract.id,paperUid:d.paper.uid,expectedReward:contract.reward})
  if(phase==='staleReward')refused=playerAct(d.w,{type:'mapSurveyDeliver',target:d.trader.id,contract:contract.id,paperUid:d.paper.uid,expectedReward:contract.reward+1})??undefined
  if(phase==='pending')d.act(d.action,2)
 }
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialMoney,initialBank,contractId:contract?.id,reward:contract?.reward,paperUid:d.paper.uid,inkUid:d.ink.uid,refused,pending:phase==='pending'}}
}

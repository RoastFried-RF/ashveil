import {bountyContractsFixture} from './bounty-contracts-fixture'
import {escortOffers,escortVisitQuote,isEscortContract} from '../src/core/escort-contracts'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {findPath} from '../src/core/path'
import {cheb,dirIndex,DIRS,type Pos} from '../src/core/geom'
import {updatePlayerVision} from '../src/core/fov'
export type EscortPhase='offer'|'accepted'|'first'|'second'|'third'|'report'|'completed'|'pending'
export function escortContractsFixture(phase:EscortPhase='offer'){
 const d=bountyContractsFixture('escort-contracts-actual')
 // 원래 상인 자신의 초기 몸/차례만 선언한다. 호송 수락 뒤 이동은 모두 실제 공개 입력과 NPC AI다.
 d.trader.nextAct=d.s.time;d.trader.needs.kcal=1000;d.trader.needs.waterDeficit=0;d.trader.needs.fatigue=10;d.trader.needs.bodyTemp=37
 const offer=escortOffers(d.w,d.p,d.trader)[0];if(!offer)throw Error('actual original merchant escort unavailable')
 const originalActors=d.s.creatures.map(c=>c.id),initialBank=d.market.money,initialMoney=d.p.money,initialPassengerPos={...d.trader.pos};let actualWalks=0,actualWaits=0
 const walk=(goal:Pos)=>{
  let count=0
  while(cheb(d.p.pos,goal)>0&&count<90){
   const occupied=creatureAt(d.w,goal),target=!terrainAt(d.w,goal).passable||occupied&&occupied!==d.p?DIRS.map(o=>({x:goal.x+o.x,y:goal.y+o.y})).filter(p=>p.x>=0&&p.y>=0&&p.x<d.s.map.w&&p.y<d.s.map.h&&terrainAt(d.w,p).passable&&!creatureAt(d.w,p)).sort((a,b)=>cheb(a,d.p.pos)-cheb(b,d.p.pos))[0]:goal
   if(!target||cheb(d.p.pos,goal)<=1&&(occupied||!terrainAt(d.w,goal).passable))break
   const next=findPath(d.w,d.p.pos,target,{avoidCreatures:true,selfId:d.p.id})?.[0];if(!next)throw Error('actual escort guide path unavailable')
   d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});count++;actualWalks++
  }
  if(cheb(d.p.pos,goal)>1)throw Error('escort guide walk incomplete')
 }
 const together=()=>{for(let n=0;n<30;n++){const record=d.m.contracts!.filter(isEscortContract).at(-1)!;if(!escortVisitQuote(d.w,d.p,record.id).error)return;d.act({type:'wait'});actualWaits++}throw Error('original escort did not actually reach guide')}
 const finish=()=>({...d,offer,record:d.m.contracts?.filter(isEscortContract).at(-1),walk,together,proof:{phase,originalActors,initialBank,initialMoney,initialPassengerPos,actualWalks,actualWaits,declaredOriginalMerchantInitialNeedsAndNextAct:true,noClaimOfEarlierInterregionTravel:true,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='offer')return finish()
 d.act({type:'escortContractAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})
 if(phase==='accepted')return finish()
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 const r=d.m.contracts!.filter(isEscortContract).at(-1)!
 for(let i=0;i<r.points.length;i++){
  walk(r.points[i].pos);together();updatePlayerVision(d.w,d.p)
  if(phase===['first','second','third'][i])return finish()
  d.act({type:'escortContractVisit',contract:r.id})
 }
 if(phase==='report')return finish()
 d.act({type:'escortContractReport',target:d.trader.id,contract:r.id,expectedReward:r.reward});return finish()
}

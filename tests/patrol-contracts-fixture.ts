import {loadDb} from '../tools/loadContent'
import {bountyContractsFixture} from './bounty-contracts-fixture'
import {isPatrolContract,patrolOffers,patrolVisitQuote} from '../src/core/patrol-contracts'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {findPath} from '../src/core/path'
import {cheb,dirIndex} from '../src/core/geom'
import {updatePlayerVision} from '../src/core/fov'
import type {Pos} from '../src/core/geom'
export type PatrolPhase='offer'|'accepted'|'first'|'second'|'third'|'report'|'completed'|'pending'
export function patrolContractsFixture(phase:PatrolPhase='offer',enabledMods:string[]=[]){
 const d=bountyContractsFixture('patrol-contracts-actual')
 if(enabledMods.length){const loaded=loadDb(enabledMods);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));d.w.db=loaded.db;d.s.mods=[...loaded.db.loadedMods]}
 const offer=patrolOffers(d.w,d.p,d.trader)[0];if(!offer)throw Error('actual settlement patrol unavailable')
 const originalActors=d.s.creatures.map(c=>c.id),initialMoney=d.p.money,initialBank=d.market.money
 // 기존 실제 정착지와 상인을 사용한다. 초기 준비의 지역 배치는 과거 여정으로 주장하지 않는다.
 const walk=(goal:Pos)=>{
  let count=0
  while(cheb(d.p.pos,goal)>1&&count<90){
   const candidates=[{...goal},...Array.from({length:8},(_,i)=>({x:goal.x+[0,1,1,1,0,-1,-1,-1][i],y:goal.y+[-1,-1,0,1,1,1,0,-1][i]}))].filter(p=>p.x>=0&&p.y>=0&&p.x<d.s.map.w&&p.y<d.s.map.h&&terrainAt(d.w,p).passable&&!creatureAt(d.w,p))
   const paths=candidates.map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})).filter(p=>p&&p.length).sort((a,b)=>a!.length-b!.length),next=paths[0]?.[0]
   if(!next)throw Error('actual local patrol path unavailable')
   d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});count++
  }
  if(cheb(d.p.pos,goal)>1)throw Error('actual local patrol walk incomplete')
  return count
 }
 const finish=()=>({...d,offer,record:d.m.contracts?.filter(isPatrolContract).at(-1),walk,proof:{phase,originalActors,initialMoney,initialBank,declaredOriginalFixturePreparation:true,noClaimOfEarlierInterregionTravel:true,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='offer')return finish()
 d.act({type:'patrolContractAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward});const r=d.m.contracts!.filter(isPatrolContract).at(-1)!
 if(phase==='accepted')return finish()
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 for(let i=0;i<r.points.length;i++){
  walk(r.points[i].pos);updatePlayerVision(d.w,d.p)
  if(phase===['first','second','third'][i])return finish()
  const error=patrolVisitQuote(d.w,d.p,r.id).error;if(error)throw Error(error)
  d.act({type:'patrolContractVisit',contract:r.id})
 }
 walk(d.trader.pos);if(phase==='report')return finish()
 d.act({type:'patrolContractReport',target:d.trader.id,contract:r.id,expectedReward:r.reward});return finish()
}

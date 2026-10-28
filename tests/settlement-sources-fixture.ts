import {bountyContractsFixture} from './bounty-contracts-fixture'
import {hireQuote} from '../src/core/companions'
import {ensureSociety,hostile} from '../src/core/diplomacy'
import {initializeStoryDirector} from '../src/core/story-director'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {findPath} from '../src/core/path'
import {dirIndex,cheb} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
export type ResidentSourcePhase='meeting'|'hired'|'dismissed'|'lastResident'|'pending'
export function settlementSourcesNativeFixture(phase:ResidentSourcePhase){
  const d=bountyContractsFixture(),source=d.s.sources!.find(source=>source.kind==='residents')!,guard=d.s.creatures.find(c=>source.members!.includes(c.id)&&d.w.db.creature(c.def).ai==='guard'&&!c.traderSite&&!c.clinicSite)!
  if(!guard)throw Error('actual registered local guard missing')
  d.p.money=1000
  const moves:Action[]=[],neighbors=()=>[{x:guard.pos.x-1,y:guard.pos.y},{x:guard.pos.x+1,y:guard.pos.y},{x:guard.pos.x,y:guard.pos.y-1},{x:guard.pos.x,y:guard.pos.y+1}].filter(pos=>terrainAt(d.w,pos).passable&&!creatureAt(d.w,pos)).sort((a,b)=>cheb(d.p.pos,a)-cheb(d.p.pos,b))
  for(let i=0;cheb(d.p.pos,guard.pos)>1&&i<20;i++){
    const goal=neighbors()[0],next=goal&&findPath(d.w,d.p.pos,goal,{avoidCreatures:true,selfId:d.p.id})?.[0];if(!next)throw Error('actual local guard approach route unavailable')
    const action:Action={type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)};d.act(action);moves.push(action)
  }
  invalidateLights(d.w);updatePlayerVision(d.w,d.p)
  const quote=hireQuote(d.w,guard);if(quote.error)throw Error(quote.error)
  const proof={phase,originalRoster:[...source.members!],owner:source.faction,guardId:guard.id,originalActorIds:d.s.creatures.map(c=>c.id),preparedApproachMoves:moves,declaredInitialPlayerMoney:1000,guardMoneyBefore:guard.money,fee:quote.fee,declaredInitialHostileReputation:phase==='lastResident'?-100:undefined,notClaimingPastIncomeOrInterregionTravel:true}
  const finish=()=>({...d,source,guard,proof:{...proof,initialRendererFx:d.s.fx.splice(0)},quote})
  if(phase==='lastResident'){
    source.members=[guard.id];source.count=1;source.cap=1;guard.hp=1;guard.asleep=true;guard.ai.morale=100;guard.nextAct=d.s.time
    ensureSociety(d.w)!.reputation[guard.faction]=-100
    if(!hostile(d.w,d.p,guard))throw Error('declared hostile resident is not an attack target')
    initializeStoryDirector(d.w,'gradual');return finish()
  }
  if(phase==='meeting')return finish()
  d.act({type:'hireCompanion',target:guard.id})
  if(phase==='dismissed')d.act({type:'dismissCompanion',target:guard.id})
  if(phase==='pending')d.act({type:'rest',turns:20},1)
  return finish()
}

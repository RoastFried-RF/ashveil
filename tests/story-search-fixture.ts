import {db} from './helpers'
import {newGame,playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
export function storySearchFixture(seed='search-flow-0'){
 const s=newGame(db,{seed,storyteller:'pursuit'}),w:World={db,s},at=4319900;s.time=at;s.weather='clear';s.weatherUntil=1e12
 for(const c of s.creatures)c.nextAct=at
 const director=s.storyteller.director!;director.lastAt=43199;director.budgetTenths=1000;s.storyteller.budget=100
 const trace={...s.map.waypoints!.stream};s.storyteller.search={at:43200,pos:trace};updatePlayerVision(w,s.creatures.find(c=>c.id===s.playerId)!)
 return{w,s,director,trace,chief:s.creatures.find(c=>c.def==='Creature.ReaverChief')!}
}
export function storySearchNativeFixture(phase:'before'|'dispatched'|'pending'){
 for(let n=0;n<100;n++){
  const d=storySearchFixture('search-flow-'+n),candidate:World={db,s:deserialize(serialize(d.s))};if(playerAct(candidate,{type:'wait'}))continue
  const receipt=candidate.s.storyteller.director!.lastPurchase;if(receipt?.kind!=='search'||receipt.cost!==60||receipt.extraId!==d.chief.id)continue
  const result=phase==='dispatched'?candidate:d.w
  if(phase==='pending'){const e=playerAct(result,{type:'rest',turns:20},1);if(e)throw Error(e)}
  return{w:result,proof:{phase,seed:d.s.seed,initialTime:4319900,declaredInitialBudget:100,declaredAlarmDepartureAt:43200,notClaimingPastPatrolOrAlarmReport:true,originalChiefId:d.chief.id,originalIds:d.s.creatures.map(c=>c.id),originalNextId:d.s.nextId,trace:d.trace}}
 }
 throw Error('actual default-rules existing chief search upgrade unavailable')
}

import {db} from './helpers'
import {newGame,playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
export function storyUnitCostsNativeFixture(phase:'before'|'dispatched'|'pending'){
 for(let n=0;n<100;n++){
  const s=newGame(db,{seed:'unit-costs-ui-'+n,storyteller:'pursuit'}),w:World={db,s},at=3599900;s.time=at;s.weather='clear';s.weatherUntil=1e12;s.storyteller.lastEventTurn=0
  for(const c of s.creatures)c.nextAct=at
  const state=s.storyteller.director!;state.lastAt=35999;state.budgetTenths=540;s.storyteller.budget=54;updatePlayerVision(w,s.creatures.find(c=>c.id===s.playerId)!)
  const candidate:World={db,s:deserialize(serialize(s))};if(playerAct(candidate,{type:'wait'}))continue
  const receipt=candidate.s.storyteller.director!.lastPurchase,extra=receipt?.extraId&&candidate.s.creatures.find(c=>c.id===receipt.extraId)
  if(!receipt||receipt.cost!==30||!extra||extra.def!=='Creature.ReaverArcher')continue
  const result=phase==='dispatched'?candidate:w
  if(phase==='pending'){const e=playerAct(result,{type:'rest',turns:20},1);if(e)throw Error(e)}
  return{w:result,proof:{phase,seed:s.seed,initialTime:at,declaredInitialBudget:54,notClaimingPastIncome:true,originalIds:s.creatures.map(c=>c.id),originalNextId:s.nextId,expectedExtraId:extra.id,expectedUnitCost:30}}
 }
 throw Error('actual existing archer unit-cost fixture unavailable')
}

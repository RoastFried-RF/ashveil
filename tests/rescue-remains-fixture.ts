import {rescueContractsFixture} from './rescue-contracts-fixture'
import {killCreature} from '../src/core/combat'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem,addToBag} from '../src/core/items'
export type RescueRemainsPhase='corpse'|'searched'|'converted'|'retrieved'|'deliver'|'completed'|'substitute'|'pending'
export function rescueRemainsFixture(phase:RescueRemainsPhase='corpse'){
 const d=rescueContractsFixture('field'),{w,s,p,victim,captor,record,act}=d
 // 과거 전투를 주장하지 않는 제어한 현장 사망/안전 조건. 기존 사람과 소지품을 보존한다.
 captor.unconscious=true;killCreature(w,victim,'선언한 현장 사망');invalidateLights(w);updatePlayerVision(w,p)
 const proof={...d.proof,phase,declaredControlledOnsiteDeathAndCaptorUnableToAct:true,notClaimingNaturallyMeasuredThirtyPercentDeathRate:true}
 const finish=()=>({...d,relic:record!.relic,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='corpse')return finish()
 act({type:'search'});if(!victim.searched||s.loot?.kind!=='corpse'||s.loot.id!==victim.id)throw Error('actual original corpse search did not finish')
 if(phase==='searched')return finish()
 act({type:'rescueContractRemains',contract:record!.id});if(!record!.relic)throw Error('actual onsite original relic conversion missing')
 if(phase==='converted')return finish()
 if(phase==='pending'){act({type:'rest',turns:20},1);return finish()}
 if(phase==='substitute'){
  act({type:'lootClose'});d.home();const other=makeItem(w,record!.relic.def);if(addToBag(w,p,other))throw Error('declared initial same-type substitute does not fit');return finish()
 }
 act({type:'lootTake',uid:record!.relic.uid});act({type:'lootClose'});if(phase==='retrieved')return finish()
 d.home();if(phase==='deliver')return finish()
 act({type:'rescueContractReport',target:d.trader.id,contract:record!.id,expectedReward:record!.reward});return finish()
}

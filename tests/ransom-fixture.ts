import {prisonerMemoryFixture} from './prisoner-memory-fixture'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type RansomPhase='ready'|'working'|'completed'|'stopped'|'pending'
export function ransomFixture(phase:RansomPhase='ready'){
 const d=prisonerMemoryFixture(),{w,s,p,captor,victim,act}=d
 p.pos={x:21,y:21};p.mapId=s.map.id;p.nextAct=s.time;s.overworld!.society!.reputation.reavers=0;captor.needs.kcal=1000;captor.nextAct=s.time+100;captor.home={...captor.pos};captor.ai.mode='guard';captor.ai.path=undefined
 invalidateLights(w);updatePlayerVision(w,p)
 const proof={...d.proof,phase,declaredInitialNearPositionAndNonhostileParley:true,notClaimingEarlierDiplomaticProgressOrTravel:true,originalPayerMoney:p.money,originalHolderMoney:captor.money,originalPersonMoney:victim.money,originalBank:s.overworld!.markets!['Region.ShepherdDale'].money}
 const finish=()=>({...d,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='ready')return finish()
 if(phase==='completed'){act({type:'ransom',holder:captor.id,person:victim.id,expectedPrice:200});return finish()}
 act({type:'ransom',holder:captor.id,person:victim.id,expectedPrice:200},1)
 if(phase==='stopped')act({type:'stopActivity'})
 return finish()
}

import {ransomFixture} from './ransom-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type PrisonerExchangePhase='ready'|'working'|'completed'|'stopped'|'pending'
export function prisonerExchangeFixture(phase:PrisonerExchangePhase='ready'){
 const d=ransomFixture(),{w,s,p,captor,victim,act}=d,given=s.creatures.find(c=>c.def==='Creature.Reaver'&&c!==captor)!
 if(!given)throw Error('original other local reaver is absent')
 p.pos={x:21,y:32};p.nextAct=s.time;given.pos={x:20,y:32};given.home={...given.pos};given.mapId=s.map.id;given.asleep=false;given.unconscious=false;given.activity=undefined;given.ai.mode='surrender';given.nextAct=s.time+28800*100;captor.nextAct=s.time+28800*100;Object.assign(given.needs,{kcal:1000,waterDeficit:0,fatigue:10,bodyTemp:37})
 const rope=makeItem(w,'Item.Rope');if(addToBag(w,p,rope))throw Error('declared initial own prisoner rope cannot fit');invalidateLights(w);updatePlayerVision(w,p);act({type:'prisoner',operation:'bind',target:given.id,ropeUid:rope.uid});if(given.captivity?.rope.uid!==rope.uid)throw Error('actual own original reaver binding failed');p.pos={x:21,y:21};given.pos={x:20,y:21};p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p)
 const proof={...d.proof,phase,originalGivenId:given.id,originalGivenRopeUid:rope.uid,originalReceivedId:victim.id,originalReceivedRopeUid:victim.captivity!.rope.uid,originalActorIds:s.creatures.map(c=>c.id),declaredInitialOtherOriginalNpcPositionSurrenderAndDelayedTurns:true,actualBindingOutsideHolderViewThenDeclaredParleyPositionsNotJourney:true,actualOwnOriginalNpcBinding:true}
 const finish=()=>({...d,given,rope,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='ready')return finish()
 const a={type:'prisonerExchange' as const,holder:captor.id,person:victim.id,given:given.id,receivedRope:victim.captivity!.rope.uid,givenRope:rope.uid}
 if(phase==='completed'){act(a);return finish()}
 act(a,1);if(phase==='stopped')act({type:'stopActivity'});return finish()
}

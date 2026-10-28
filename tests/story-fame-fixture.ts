import {storyDirectorFixture} from './story-director-fixture'
import {createCreature} from '../src/core/creatures'
import {serialize,deserialize} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
import {type World} from '../src/core/ctx'
import type {Action} from '../src/core/actions'
export function storyFameNativeFixture(phase:'before'|'won'|'pending'){
 const d=storyDirectorFixture(),chief=createCreature(d.w,'Creature.ReaverChief',{x:21,y:20});chief.hp=1;chief.asleep=true;chief.unconscious=false;chief.bag=[];chief.equip={};chief.nextAct=d.s.time;d.s.creatures.push(chief)
 const source=d.s.sources!.find(s=>s.id==='reaverCamp')!;source.count=1;source.deployed=true;source.floors=['surface'];source.members=[chief.id]
 d.director.budgetTenths=540;d.s.storyteller.budget=54
 // 현재 체력1의 잠든 같은 두목/마지막 원래 인원과 초기54예산이다. 과거 부상/수입 이력은 주장하지 않는다.
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!,target=s.creatures.find(c=>c.id===chief.id)!,at=s.time,act=(action:Action,budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)}
 updatePlayerVision(w,p)
 let attacks=0;if(phase!=='before')for(;target.alive&&attacks<10;attacks++)act({type:'move',dir:2})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{w,s,p,target,act,proof:{phase,initialTime:at,elapsedTU:s.time-at,actualHeadlessAttackInputs:attacks,targetUid:target.id,declaredInitialHp:1,declaredInitialSourcePopulation:1,declaredInitialBudget:54,notClaimingPastWoundsOrIncome:true}}
}

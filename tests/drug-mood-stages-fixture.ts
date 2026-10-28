import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {pharmacologyDef} from '../src/core/drug-state'
import {turnOf} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import type {DrugFamily} from '../src/core/types'
export function drugMoodFixture(){
 const d=conditionThoughtsFixture()
 const alcohol=()=>{const item=makeItem(d.w,'Item.Moonshine');if(addToBag(d.w,d.p,item)!==0)throw Error('initial original alcohol bottle');return item}
 const dependency=(family:DrugFamily,stage:number)=>{const now=turnOf(d.w),rules=pharmacologyDef(d.w);d.p.drugs={active:[],tolerance:{},lastDose:{[family]:now-rules.families[family].withdrawalTurns-(stage-1)*rules.withdrawalStageTurns},addicted:[family],toleranceAt:now,revision:0}}
 return {...d,alcohol,dependency}
}
export type DrugMoodPhase='alcohol1'|'alcohol2'|'alcohol3'|'withdrawal1'|'withdrawal2'|'withdrawal3'
export function drugMoodNativeFixture(phase:DrugMoodPhase){
 const d=drugMoodFixture(),initialTime=d.s.time,stage=Number(phase.at(-1)),initialUses=5
 let itemUid:number|undefined
 if(phase.startsWith('alcohol')){const bottle=d.alcohol();itemUid=bottle.uid;for(let i=0;i<stage;i++){const error=playerAct(d.w,{type:'consume',uid:bottle.uid});if(error)throw Error(error)}}
 else{d.dependency('analgesic',stage);const error=playerAct(d.w,stage===3?{type:'rest',turns:20}:{type:'wait'},stage===3?2:undefined);if(error)throw Error(error)}
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,stage,initialTime,itemUid,initialUses,actualTurns:(d.s.time-initialTime)/100,pending:phase==='withdrawal3'}}
}

import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addWound} from '../src/core/body'
import {addToBag,makeItem} from '../src/core/items'
import {playerAct,runUntilInput} from '../src/core/game'
import {fatigueBand} from '../src/core/fatigue-state'
import {updatePlayerVision} from '../src/core/fov'
export type FatiguePhase='normal'|'tired'|'weary'|'exhausted'|'debt'|'pending'
export function fatigueNativeFixture(phase:FatiguePhase){
 const d=conditionThoughtsFixture(),fatigue={normal:20,tired:50,weary:75,exhausted:95,debt:20,pending:75}[phase]
 d.p.needs.fatigue=fatigue;d.p.needs.sleepDebt=phase==='debt'?.5:0
 const wd=addWound(d.w,d.p,{def:'Wound.Cut',part:'RightShin',severity:2,source:'초기 상처'}).wound,bandage=makeItem(d.w,'Item.Bandage');if(addToBag(d.w,d.p,bandage)!==0)throw Error('initial bandage space')
 const initialTime=d.s.time,rule={...fatigueBand(d.w,d.p)},error=playerAct(d.w,{type:'treat',uid:bandage.uid,woundId:wd.id},1)
 if(error)throw Error(error)
 const plannedTurns=d.p.activity?.total;if(!plannedTurns||!d.s.simulationPending)throw Error('actual pending bandage')
 if(phase!=='pending')runUntilInput(d.w)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,initialFatigue:fatigue,rule,plannedTurns,bandageUid:bandage.uid,woundId:wd.id,actualTurns:(d.s.time-initialTime)/100,pending:phase==='pending'}}
}

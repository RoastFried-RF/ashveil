import {boilProgressFixture} from './boil-progress-fixture'
import {consumptionThoughtFixture} from './consumption-thoughts-fixture'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
import {waterBoilQuote} from '../src/core/boil-state'
import {stateHash} from '../src/core/save'
import {waterQuality} from '../src/core/water-state'
import {hpMax} from '../src/core/body'
export type InteractionPhase='unknown'|'boil'|'cloth'|'book'|'small'|'pending'
export function interactionNativeFixture(phase:InteractionPhase){
 if(phase==='small'){
  const d=consumptionThoughtFixture();d.p.traits=['Trait.SmallEater'];d.p.needs.kcal=1499;const food=d.add('Item.Hardtack',3),initialTime=d.s.time,original=structuredClone(food)
  const error=playerAct(d.w,{type:'consume',uid:food.uid});if(error)throw Error(error);updatePlayerVision(d.w,d.p)
  return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,item:original,pending:false,initialQuality:undefined,initialWood:undefined,initialXp:d.p.xp}}
 }
 const d=boilProgressFixture();d.p.literacy=2;d.p.literate=true;d.p.thoughts=[];d.p.needs.vitamin=100;d.p.needs.fatigue=20;d.s.knowledge.interactions=[];d.s.storyteller.budget=-1e9
 d.p.hp=hpMax(d.w,d.p)
 const initialTime=d.s.time,initialXp=d.p.xp,initialWood=d.wood.count,initialQuality=structuredClone(waterQuality(d.w,d.bottle));let item=structuredClone(d.bottle)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase==='unknown'){const before=stateHash(d.s);for(let i=0;i<4;i++)waterBoilQuote(d.w,d.p,d.bottle.uid,1);if(stateHash(d.s)!==before)throw Error('quote mutation')}
 else if(phase==='book'){const book=d.add('Item.SurvivalGuide');item=structuredClone(book);act({type:'read',uid:book.uid})}
 else{if(phase==='cloth')d.add('Item.ClothFilter');act({type:'waterTreatment',uid:d.bottle.uid,method:phase==='cloth'?'cloth':'boil'},phase==='pending'?2:undefined)}
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,item,pending:phase==='pending',initialQuality,initialWood,initialXp}}
}

import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addWound} from '../src/core/body'
import {addToBag,equip,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {turnOf} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
export type BodyMemoryPhase='body'|'face'|'vain'|'old'|'loss'|'pending'
export function bodyMemoryFixture(){return conditionThoughtsFixture('body-memories')}
export function bodyMemoryNativeFixture(phase:BodyMemoryPhase){
 const d=bodyMemoryFixture(),initialTime=d.s.time
 let woundId:number|undefined,knifeUid:number|undefined
 if(phase==='loss'||phase==='pending'){
  const knife=makeItem(d.w,'Item.RustyKnife');knifeUid=knife.uid
  if(addToBag(d.w,d.p,knife))throw Error('original medical knife')
  const error=equip(d.w,d.p,knife.uid,'main');if(error)throw Error(error)
  d.p.body.tourniquets.LeftUpperArm=turnOf(d.w)
 }else if(phase==='old'){
  d.p.traits=['Trait.Vain'];d.p.body.scars=[{part:'Skull',severity:2,cap:1,burn:false,at:turnOf(d.w)-1000,source:'각인 이전에 남은 실제 흉터'}]
 }else{
  if(phase==='vain')d.p.traits=['Trait.Vain']
  const wound=addWound(d.w,d.p,{def:'Wound.Cut',part:phase==='body'?'LeftForearm':'Skull',severity:2,source:'초기 치유 마지막 단계의 실제 상처'}).wound
  wound.scar=true;wound.healed=wound.severity-1e-7;wound.bleed=0;wound.ageTurns=100;woundId=wound.id
 }
 const error=playerAct(d.w,phase==='loss'||phase==='pending'?{type:'procedure',procedure:'amputate',part:'LeftHand'}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,woundId,knifeUid,pending:phase==='pending'}}
}

import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {nutritionDef} from '../src/core/nutrition-state'
import {updatePlayerVision} from '../src/core/fov'
export type ConsumptionThoughtPhase='bland'|'spoiled'|'overate'|'hangover'|'bite'|'pending'
export function consumptionThoughtFixture(){
 const d=conditionThoughtsFixture('consumption-thoughts')
 const add=(def:string,count=1)=>{const it=makeItem(d.w,def,count);if(addToBag(d.w,d.p,it))throw Error('original consumption item');return it}
 const alcoholEnd=(after=1)=>{const now=turnOf(d.w);d.p.drugs={active:[{def:'Drug.Alcohol',until:now+after,potency:1,amount:1,source:'Item.Moonshine',sourceKnown:true}],tolerance:{},lastDose:{alcohol:now-1000},addicted:[],toleranceAt:now,revision:0}}
 const latentBite=()=>{
  // 유효 초기 장면:21일차의 이미 아문 원래 물림. 과거20일을 시뮬레이션했다는 뜻이 아니다.
  d.s.time=(20*TURNS_PER_DAY+14400)*100;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=20
  const now=turnOf(d.w)
  d.p.body.scars=[{part:'LeftForearm',severity:2,cap:1,burn:false,at:now-10000,source:'이전에 아문 실제 물림'}]
  d.p.diseases=[{def:'Disease.FoamSickness',incubatesUntil:now+10*TURNS_PER_DAY,progress:0,immunity:0,source:{kind:'실제 물린 상처',turn:now-10*TURNS_PER_DAY,wound:67,part:'LeftForearm',creature:66}}]
 }
 return {...d,add,alcoholEnd,latentBite}
}
export function consumptionThoughtNativeFixture(phase:ConsumptionThoughtPhase){
 const d=consumptionThoughtFixture()
 let itemUid:number|undefined,beforeCount:number|undefined
 if(phase==='bite')d.latentBite()
 if(phase==='hangover'||phase==='pending')d.alcoholEnd(phase==='pending'?10:1)
 if(phase==='bland'||phase==='overate'||phase==='spoiled'){
  const it=d.add(phase==='spoiled'?'Item.DriedApple':'Item.Hardtack',3);itemUid=it.uid;beforeCount=it.count
  if(phase==='spoiled')it.freshness=20
  if(phase==='overate')d.p.needs.kcal=nutritionDef(d.w).maxKcal-1
 }
 const initialTime=d.s.time,error=playerAct(d.w,itemUid!==undefined?{type:'consume',uid:itemUid}:phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,itemUid,beforeCount,pending:phase==='pending'}}
}

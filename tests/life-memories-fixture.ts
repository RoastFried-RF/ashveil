import {residentHygieneFixture} from './resident-hygiene-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {fillWaterBottle} from '../src/core/water'
import {innQuote,rentInnBed} from '../src/core/inn'
import {activityStep,perform} from '../src/core/actions'
import {tileAt,turnOf} from '../src/core/ctx'
export function lifeMemoriesFixture(){
 const d=residentHygieneFixture(),keeper=d.s.creatures.find(c=>c.traderSite)!,bed=d.s.map.innBeds![0]
 for(const c of d.s.creatures)if(c.id!==d.p.id){c.nextAct=1e12;c.needs.hygiene=70}
 d.p.bag=[];d.p.thoughts=[];d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.money=100;d.p.needs.fatigue=40;d.p.pos={x:29,y:18}
 const add=(id:string,count=1)=>{const item=makeItem(d.w,id,count);if(addToBag(d.w,d.p,item))throw Error('actual life memory bag');return item}
 const water=()=>{d.p.pos={x:d.well.pos.x+1,y:d.well.pos.y};const bucket=add('Item.WaterBucket');const error=fillWaterBottle(d.w,d.p,bucket.uid,d.well.pos);if(error)throw Error(error);return bucket}
 const rent=()=>{d.p.pos={x:29,y:18};const q=innQuote(d.w,d.p,keeper,bed.id);const error=rentInnBed(d.w,d.p,keeper,bed.id,q.fee);if(error)throw Error(error);d.p.pos={...bed.pos};return q}
 const sleepStep=()=>{const result=perform(d.w,d.p,{type:'sleep'});if(!result.ok)throw Error(result.msg);activityStep(d.w,d.p)}
 return {...d,keeper,bed,add,water,rent,sleepStep,bedTile:()=>tileAt(d.w,bed.pos),now:()=>turnOf(d.w)}
}

export async function lifeMemoriesNativeFixture(phase:'wash'|'warmMeal'|'talk'|'talkative'|'innSleep'|'pendingInn'='wash'){
 const {playerAct}=await import('../src/core/game'),{player,creatureAt,inBounds,terrainAt}=await import('../src/core/ctx'),{findPath}=await import('../src/core/path'),{dirIndex}=await import('../src/core/geom'),{updatePlayerVision}=await import('../src/core/fov')
 const act=(w:Parameters<typeof playerAct>[0],action:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)}
 if(phase==='warmMeal'){
  const {boiledMealFixture}=await import('./boiled-meal-fixture'),d=boiledMealFixture(220)
  act(d.w,{type:'wait'});const at=d.s.time;act(d.w,{type:'craft',id:d.recipe});const turns=(d.s.time-at)/100;act(d.w,{type:'consume',uid:d.bowl.uid});updatePlayerVision(d.w,d.p)
  return{w:d.w,s:d.s,p:d.p,proof:{phase,foodUid:d.bowl.uid,actualCookTurns:turns,foodAfter:d.p.bag.find(i=>i.uid===d.bowl.uid)?.def}}
 }
 const d=lifeMemoriesFixture()
 if(phase==='talkative')d.p.traits=['Trait.Talkative']
 let proof:{phase:typeof phase;bucketUid?:number;actualWashTurns?:number;fee?:number;originalCash?:number;actualSleepStart?:number;pending?:boolean}={phase}
 if(phase==='wash'){const bucket=d.water(),at=d.s.time;act(d.w,{type:'wash'});proof={phase,bucketUid:bucket.uid,actualWashTurns:(d.s.time-at)/100}}
 else if(phase==='talk'||phase==='talkative')act(d.w,{type:'talk',target:d.keeper.id})
 else{
  const q=innQuote(d.w,d.p,d.keeper,d.bed.id),originalCash=d.p.money
  act(d.w,{type:'rentBed',target:d.keeper.id,bed:d.bed.id,expectedFee:q.fee})
  let guard=0
  while((d.p.pos.x!==d.bed.pos.x||d.p.pos.y!==d.bed.pos.y)&&guard++<40){
   const path=findPath(d.w,d.p.pos,d.bed.pos,{avoidCreatures:true,selfId:d.p.id}),next=path?.[0]
   if(!next||!inBounds(d.w,next)||!terrainAt(d.w,next).passable||(creatureAt(d.w,next)&&creatureAt(d.w,next)?.id!==d.p.id))throw Error('actual paid bed walk')
   act(d.w,{type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)})
  }
  if(guard>=40)throw Error('actual inn bed not reached')
  const at=d.s.time;act(d.w,{type:'sleep'},1)
  if(phase==='innSleep')act(d.w,{type:'stopActivity'})
  else if(!d.s.simulationPending)throw Error('actual pending paid inn sleep')
  proof={phase,fee:q.fee,originalCash,actualSleepStart:at,pending:phase==='pendingInn'}
 }
 updatePlayerVision(d.w,player(d.w));return{w:d.w,s:d.s,p:d.p,proof}
}

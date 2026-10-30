/** Controlled finite-stock cohort. All elapsed game time and care use normal Core actions. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {ashCakeCraftFixture} from '../tests/ash-cake-fixture'
import {playerAct} from '../src/core/game'
import {player,tileAt,turnOf,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {makeItem,maxStack} from '../src/core/items'
import {campfireAt,fireTurnsLeft} from '../src/core/campfire'
import {drinkVolume} from '../src/core/wash-water'
import {foodTrainingLungAsh,foodTrainingReady} from '../src/core/food-training'
import {serialize,deserialize} from '../src/core/save'
import {projectThermalState} from '../src/core/thermal'
import {findPath} from '../src/core/path'
import {dirIndex} from '../src/core/geom'
import type {Action} from '../src/core/actions'
import type {DiseaseDef,ItemInst,Slot} from '../src/core/types'

const out=process.argv[2],days=Number(process.argv[3]??30);assert.ok(out&&!existsSync(out));assert.ok(Number.isInteger(days)&&days>=1&&days<=30);mkdirSync(out,{recursive:true})
const d=ashCakeCraftFixture(),w:World=d.w,originalBowl=d.bowl.uid,rows:unknown[]=[];let actions=0
process.on('uncaughtExceptionMonitor',error=>{writeFileSync(join(out,'failure-world.json'),serialize(w.s),{flag:'wx'});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),time:turnOf(w),actions,needs:player(w).needs,death:player(w).deathCause,over:w.s.over,rows},null,2),{flag:'wx'})})
w.s.map.depth=3;d.bottle.water={pathogen:0,ash:0,source:'우물물'}
function act(action:Action,untilTU?:number){
 const error=playerAct(w,action,undefined,untilTU);actions++;assert.equal(error,null,JSON.stringify(action));assert.ok(!w.s.over&&player(w).alive,'The controlled cohort must actually survive')
 if(w.s.simulationPending){assert.equal(playerAct(w,{type:'stopActivity'}),null);actions++}
 assert.ok(!w.s.over&&player(w).alive,'A stopped activity must actually survive')
}
const workPos={x:player(w).pos.x,y:player(w).pos.y+1},bed=d.add('Item.Bedroll');act({type:'move',dir:4});act({type:'place',uid:bed.uid,dir:4});act({type:'move',dir:4})
const stockPos={...player(w).pos},stock=tileAt(w,stockPos).items
const coolPos={x:stockPos.x,y:stockPos.y+1},garments=Object.entries(player(w).equip).filter((entry):entry is[Slot,ItemInst]=>!!entry[1])
function moveTo(pos:{x:number;y:number}){
 for(let steps=0;steps<3000;steps++){
  const p=player(w);if(p.pos.x===pos.x&&p.pos.y===pos.y)return
  const avoid=new Set(w.s.map.tiles.flatMap((tile,index)=>!tile.seen?[index]:[])),path=findPath(w,p.pos,pos,{selfId:p.id,avoidCreatures:true,avoidCells:avoid,maxNodes:5000}),next=path?.find(step=>step.x!==p.pos.x||step.y!==p.pos.y)
  assert.ok(next,'Return from ordinary wandering must use genuinely observed cells');act({type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)})
 }
 throw Error('Observed route did not finish')
}
function initialStock(id:string,count:number){const size=maxStack(w.db.item(id));for(let n=count;n>0;n-=size)stock.push(makeItem(w,id,Math.min(size,n)))}
initialStock('Item.Oats',27);initialStock('Item.PilgrimAsh',29);initialStock('Item.Hardtack',200);initialStock('Item.Wood',400)
for(let n=0;n<119;n++)stock.push(makeItem(w,'Item.WaterBottle'))
const start=turnOf(w),disease=w.db.get<DiseaseDef>('Disease.GreyFever'),waterAtStart=120000
writeFileSync(join(out,'initial-world.json'),serialize(w.s),{flag:'wx'})
writeFileSync(join(out,'declared-stock.json'),JSON.stringify({controlled:true,naturalAcquisition:false,originalBowl,grain:30,ashPackets:30,hardtack:200,wood:400,waterMl:waterAtStart,shelter:'Existing enclosed diagnostic dungeon at its normal depth-3 12°C; actual bedroll and finite fire. No enemies/events in this declared isolated fixture. No body/clock/RNG/resource writes after initial capture.'},null,2),{flag:'wx'})
function provide(id:string,minMl=0):ItemInst{
 const p=player(w),owned=p.bag.find(i=>i.def===id&&i.count>0&&(!minMl||drinkVolume(w,i)>=minMl));if(owned)return owned
 const item=tileAt(w,stockPos).items.find(i=>i.def===id&&i.count>0&&(!minMl||drinkVolume(w,i)>=minMl));assert.ok(item,'Finite stock exhausted: '+id);moveTo(stockPos);act({type:'pickup',uid:item.uid})
 const found=player(w).bag.find(i=>i.uid===item.uid);assert.ok(found,'Original stock must enter the actual bag');return found
}
function tidy(){for(const item of [...player(w).bag])if(item.def==='Item.WaterBottle'&&drinkVolume(w,item)===0)act({type:'drop',uid:item.uid})}
function fire(){if(fireTurnsLeft(w,d.pos)<1200){const wood=provide('Item.Wood');moveTo(workPos);act({type:'fireWork',pos:d.pos,uid:wood.uid})}assert.ok(campfireAt(w,d.pos))}
/** Choose actual clothes/place from the same public thermal forecast used by the UI. */
function dress(sleeping:boolean,working=false){
 const p=player(w),candidates=[]
 const live=garments.map(([slot,original])=>{const item=[...p.bag,...Object.values(p.equip)].find(i=>i?.uid===original.uid);assert.ok(item,'The original garment must still physically exist');return[slot,item]as const})
 for(const pos of working?[workPos]:[stockPos,coolPos])for(let mask=0;mask<1<<live.length;mask++){
  const equip=Object.fromEntries(live.filter((_,i)=>mask&(1<<i)));if(equip.lining&&!equip.chest)continue
  const forecast=projectThermalState(w,{...p,equip},working?'work':sleeping?'sleep':'rest',pos),changes=live.filter(([slot,it])=>(p.equip[slot]?.uid===it.uid)!==(equip[slot]?.uid===it.uid)).length+Math.abs(pos.y-p.pos.y)
  candidates.push({pos,equip,deviation:Math.max(forecast.low-forecast.feels,forecast.feels-forecast.high,0),changes})
 }
 candidates.sort((a,b)=>a.deviation-b.deviation||a.changes-b.changes);const choice=candidates[0];assert.ok(choice&&(working||choice.deviation===0),'Sustained rest/sleep needs a safe thermal band; brief fire work uses the least deviation')
 for(const slot of['lining','head','feet','chest']as const)if(p.equip[slot]&&!choice.equip[slot]){act({type:'unequip',slot});return false}
 for(const[slot,it]of live)if(choice.equip[slot]&&player(w).equip[slot]?.uid!==it.uid){act({type:'equip',uid:it.uid,slot});return false}
 moveTo(choice.pos);return true
}
function care(until:number){
 while(turnOf(w)<until){
  tidy();const p=player(w)
  if(p.needs.waterDeficit>=200){act({type:'consume',uid:provide('Item.WaterBottle',1).uid});continue}
  if(p.needs.kcal<1500&&p.breakdown?.kind!=='fast'){act({type:'consume',uid:provide('Item.Hardtack').uid});continue}
  if(!dress(p.needs.fatigue>=30))continue
  if(p.needs.fatigue>=30){act({type:'sleep'},until*100);continue}
  act({type:'rest',turns:Math.max(1,Math.min(1200,until-turnOf(w)))},until*100)
 }
}
function waitForFoodConsent(){while(player(w).breakdown?.kind==='fast')care(turnOf(w)+1200)}
for(let index=0;index<days;index++){
 const previous=player(w).body.foodTraining?.[disease.id]
 if(previous)care(previous.lastAt+disease.foodTraining!.intervalTurns)
 waitForFoodConsent();tidy();while(player(w).needs.waterDeficit>=100)act({type:'consume',uid:provide('Item.WaterBottle',1).uid})
 while(player(w).needs.kcal<2000)act({type:'consume',uid:provide('Item.Hardtack').uid})
 // Do not sleep through the actual 48-hour course deadline after a fast.
 // Keep real work time available; ordinary fatigue still applies to crafting.
 const sleepUntil=previous?previous.lastAt+disease.foodTraining!.maxGapTurns-1200:turnOf(w)+7200
 if(player(w).needs.fatigue>20&&turnOf(w)<sleepUntil){while(!dress(true)){/* actual clothing inputs */}act({type:'sleep'},sleepUntil*100)}
 provide('Item.Oats');provide('Item.PilgrimAsh');provide('Item.WaterBottle',220);fire();while(!dress(false,true)){/* actual clothing inputs */}
 // Normal auto-stop can preserve partial work when a public need band changes.
 for(let attempt=0;attempt<8;attempt++){act({type:'craft',id:d.recipe});if(player(w).bag.find(i=>i.uid===originalBowl)?.def==='Item.AshCake')break;assert.equal(player(w).workJob?.recipe,d.recipe)}
 assert.equal(player(w).bag.find(i=>i.uid===originalBowl)?.def,'Item.AshCake','Daily work must actually finish with the same bowl')
 waitForFoodConsent();act({type:'consume',uid:originalBowl});const p=player(w),record=p.body.foodTraining![disease.id]
 assert.equal(record.servings,index+1);assert.equal(record.lastItemUid,originalBowl);assert.equal(foodTrainingLungAsh(p),Math.round((index+1)*10e6/30)/1e6)
 const raw=serialize(w.s);writeFileSync(join(out,'day-'+(index+1)+'-world.json'),raw,{flag:'wx'});w.s=deserialize(raw);assert.equal(serialize(w.s),raw)
 rows.push({serving:index+1,elapsedDays:(turnOf(w)-start)/TURNS_PER_DAY,time:turnOf(w),bodyTemp:p.needs.bodyTemp,kcal:p.needs.kcal,waterDeficit:p.needs.waterDeficit,lungAsh:record.lungAsh,actions})
 console.log(JSON.stringify(rows.at(-1)))
}
if(days===30){care(player(w).body.foodTraining![disease.id].firstAt+disease.foodTraining!.courseTurns);assert.equal(foodTrainingReady(w,player(w),disease),true);assert.equal(foodTrainingLungAsh(player(w)),10)}
writeFileSync(join(out,'final-world.json'),serialize(w.s),{flag:'wx'});writeFileSync(join(out,'audit.json'),JSON.stringify({declaredControlledCohort:true,naturalAcquisition:false,elapsedDays:(turnOf(w)-start)/TURNS_PER_DAY,servings:days,saveRoundTrips:days,actions,alive:player(w).alive,formedResistance:foodTrainingReady(w,player(w),disease),rows},null,2),{flag:'wx'})

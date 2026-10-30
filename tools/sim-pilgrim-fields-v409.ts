/** Controlled warm arrival; actual full crop growth, personal care and NPC labour after capture. */
import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{pilgrimFieldsFixture}from'../tests/pilgrim-fields-fixture'
import{player,turnOf,TURNS_PER_DAY,terrainAt,creatureAt,inBounds,tileAt,type World}from'../src/core/ctx'
import{playerAct,runUntilInput}from'../src/core/game'
import{serialize,deserialize}from'../src/core/save'
import{tradeQuote,tradeAccess}from'../src/core/economy'
import{projectThermalState}from'../src/core/thermal'
import{DIRS,cheb,dirIndex,type Pos}from'../src/core/geom'
import{findPath,diagonalBlocked}from'../src/core/path'
import{canSee,hasLos}from'../src/core/fov'
import{drinkVolume}from'../src/core/wash-water'
import{readyFood}from'../src/core/open-food-state'
import{warmthError}from'../src/core/resident-warmth'
import{makeItem,maxStack}from'../src/core/items'
import type{Action}from'../src/core/actions'

import{cultivationStatus}from'../src/core/cultivation'
const out=process.argv[2];assert.ok(out&&!existsSync(out),'Choose a new output directory');mkdirSync(out,{recursive:true})
const horizonDays=Number(process.argv[3]??20);assert.ok(Number.isInteger(horizonDays)&&horizonDays>=1&&horizonDays<=30);const horizon=horizonDays*TURNS_PER_DAY
const d=pilgrimFieldsFixture(),w=d.w,start=turnOf(w),rows:unknown[]=[],actions:Record<string,number>={}
// Explicit finite observer-only diagnostic cache. No claim of acquiring this cache in normal play.
// NPCs receive no cache supplies; they must use the original world, depot, well and markets.
const cachePos={...player(w).pos},cache=tileAt(w,cachePos).items
for(let left=120;left>0;){const count=Math.min(left,maxStack(w.db.item('Item.Hardtack')));cache.push(makeItem(w,'Item.Hardtack',count));left-=count}
for(let n=0;n<60;n++){const bottle=makeItem(w,'Item.WaterBottle');bottle.water={pathogen:0,ash:0,source:'선언한 관찰자 진단 식수'};cache.push(bottle)}
cache.push(makeItem(w,'Item.Bedroll'))
const bedPos={x:cachePos.x,y:cachePos.y+1}
const declaredObserverCache={pos:cachePos,hardtack:120,cleanWaterMl:60000,bedroll:1,naturalAcquisition:false,npcSupply:false,items:cache.map(i=>({uid:i.uid,def:i.def,count:i.count}))}
// Initial schedule only. The actual original farmer and merchant must subsequently care for themselves.
d.trader.nextAct=w.s.time
const initial={proof:d.proof,originalMerchant:d.trader.id,originalGuard:d.c.id,market:d.market.items.map(i=>({uid:i.uid,def:i.def,count:i.count})),marketCash:d.market.money,observerCash:player(w).money,farmerCash:d.c.money,declaredOriginalMerchantScheduled:true,declaredObserverCache,noPriorGrowthCredit:true}
const garments=(['chest','lining','feet','head']as const).flatMap(slot=>player(w).equip[slot]?[{slot,uid:player(w).equip[slot]!.uid}]:[])
writeFileSync(join(out,'initial-world.json'),serialize(w.s),{flag:'wx'});writeFileSync(join(out,'declared-initial.json'),JSON.stringify(initial,null,2),{flag:'wx'})
function act(a:Action){const at=w.s.time,error=playerAct(w,a,200);if(error==='길이 막혔다'&&a.type==='move'){actions.blockedMove=(actions.blockedMove??0)+1;assert.equal(playerAct(w,{type:'wait'},200),null);actions.wait=(actions.wait??0)+1}else assert.equal(error,null,a.type);while(w.s.simulationPending&&!w.s.over){observation();runUntilInput(w,200)}actions[a.type]=(actions[a.type]??0)+1;assert.ok(player(w).alive&&d.trader.alive&&d.c.alive,'Original observer and worker must remain alive');assert.ok(w.s.time>=at);assert.ok(turnOf(w)-start<horizon+TURNS_PER_DAY,'Finite diagnostic horizon, not an action-cap survival claim')}
function moveTo(pos:Pos,stepLimit=80){
 for(let i=0;cheb(player(w).pos,pos)>1&&i<stepLimit;i++){
  const p=player(w),paths=DIRS.map(v=>({x:pos.x+v.x,y:pos.y+v.y})).filter(q=>inBounds(w,q)&&terrainAt(w,q).passable&&hasLos(w,q,pos)&&!diagonalBlocked(w,q,pos.x-q.x,pos.y-q.y)&&(!creatureAt(w,q)||creatureAt(w,q)!.id===p.id)).map(q=>findPath(w,p.pos,q,{avoidCreatures:true,selfId:p.id})).filter((p):p is NonNullable<typeof p>=>!!p?.length).sort((a,b)=>a.length-b.length)
  assert.ok(paths[0]?.length,'Actual route to known local destination');const next=paths[0][0];act({type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)})
 }if(stepLimit===80)assert.ok(cheb(player(w).pos,pos)<=1)
}
function approachWorker(){for(let i=0;i<80;i++){const p=player(w),seen=canSee(w,p,d.trader.pos),goal=seen?d.trader.pos:d.trader.home!;if(seen&&cheb(p.pos,goal)<=1&&hasLos(w,p.pos,goal))return;if(cheb(p.pos,goal)>1)moveTo(goal,1);else if(!seen&&cheb(p.pos,goal)>0)act({type:'move',dir:dirIndex(goal.x-p.pos.x,goal.y-p.pos.y)});else return}}
function trade(buy:{uid:number;count:number}[],sell:{uid:number;count:number}[]=[]){
 approachWorker();const q=tradeQuote(w,player(w),d.trader,buy,sell);assert.equal(q.error,null);const bank=d.market.money+(player(w).money??0)
 act({type:'trade',target:d.trader.id,buy,sell,expectedBalance:q.balance});assert.equal(d.market.money+(player(w).money??0),bank,'Each actual sale conserves customer and market cash')
}
function cachedSupply(id:string){
 for(let n=0;cheb(player(w).pos,cachePos)>0&&n<1200;n++){const p=player(w),path=findPath(w,p.pos,cachePos,{avoidCreatures:true,selfId:p.id});assert.ok(path?.length,'Actual route back to declared cache');const next=path[0];act({type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)})}
 assert.equal(cheb(player(w).pos,cachePos),0)
 for(const bottle of [...player(w).bag])if(bottle.def==='Item.WaterBottle'&&drinkVolume(w,bottle)===0)act({type:'drop',uid:bottle.uid})
 const item=tileAt(w,cachePos).items.find(i=>i.def===id&&i.count>0&&(id!=='Item.WaterBottle'||drinkVolume(w,i)>0));assert.ok(item,'Declared finite observer cache exhausted: '+id);act({type:'pickup',uid:item.uid})
}
let nextShopCheck=start
const boughtProducts:{uid:number;madeAt:number;boughtAt:number}[]=[],returnedBowls:number[]=[]
/** Finite instrumented customer demand. Stock is examined only at an accessible visible shop. */
function serviceShop(){
 // Visit the remembered shop, then inspect the actually visible trader and stock.
 approachWorker();if(!canSee(w,player(w),d.trader.pos)||tradeAccess(w,player(w),d.trader))return false
 const p=player(w),bowl=p.bag.find(i=>i.def==='Item.Bowl')
 if(bowl){trade([],[{uid:bowl.uid,count:1}]);returnedBowls.push(bowl.uid);return true}
 const made=d.market.items.find(i=>i.def==='Item.AshCake'&&i.workshopMade?.worker===d.trader.id&&readyFood(w,p,i))
 if(made){const uid=made.uid,madeAt=made.workshopMade!.at;trade([{uid,count:1}]);const held=player(w).bag.find(i=>i.uid===uid)!;assert.ok(readyFood(w,player(w),held));boughtProducts.push({uid,madeAt,boughtAt:turnOf(w)});act({type:'consume',uid});assert.equal(held.def,'Item.Bowl');return true}
 return false
}
/** Read-only forecasts select actual owned garments and a previously observed common floor. */
function shelter(sleeping=false){
 const p=player(w),live=garments.flatMap(g=>{const i=[...p.bag,...Object.values(p.equip)].find(i=>i?.uid===g.uid);return i?[{...g,item:i}]:[]}),positions=[...(sleeping?[bedPos]:[]),cachePos,{x:26,y:25},{x:28,y:26},{x:28,y:27}].filter(q=>inBounds(w,q)&&tileAt(w,q).seen&&terrainAt(w,q).passable&&(!terrainAt(w,q).bedding||sleeping&&cheb(q,bedPos)===0)&&(!creatureAt(w,q)||creatureAt(w,q)!.id===p.id))
 const choices=[]
 for(const pos of positions)for(let mask=0;mask<1<<live.length;mask++){
  const equip=Object.fromEntries(live.filter((_,i)=>mask&(1<<i)).map(g=>[g.slot,g.item]));if(equip.lining&&!equip.chest)continue
  const f=projectThermalState(w,{...p,equip},sleeping?'sleep':'rest',pos),deviation=Math.max(f.low-f.feels,f.feels-f.high,0),changes=live.filter(g=>(p.equip[g.slot]?.uid===g.uid)!==(equip[g.slot]?.uid===g.uid)).length+cheb(p.pos,pos)
  choices.push({pos,equip,deviation,changes})
 }
 choices.sort((a,b)=>a.deviation-b.deviation||a.changes-b.changes);const q=choices[0];assert.ok(q,'Known shelter and original clothes must remain')
 for(const g of [...live].reverse())if(p.equip[g.slot]&&!q.equip[g.slot]){act({type:'unequip',slot:g.slot});return false}
 for(const g of live)if(q.equip[g.slot]&&player(w).equip[g.slot]?.uid!==g.uid){act({type:'equip',uid:g.uid,slot:g.slot});return false}
 if(cheb(p.pos,q.pos)>0){const path=findPath(w,p.pos,q.pos,{avoidCreatures:true,selfId:p.id});assert.ok(path?.length,'Actual path to the selected thermal floor');const next=path[0];act({type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)});return false}return true
}
function roundtrip(label:string){const raw=serialize(w.s),copy:World={db:w.db,s:deserialize(raw)};assert.deepEqual(JSON.parse(serialize(copy.s)),JSON.parse(raw));writeFileSync(join(out,label+'-world.json'),raw,{flag:'wx'})}
let plantedAt:number|undefined,seedUid:number|undefined,growthTotal:number|undefined,harvestedAt:number|undefined,soldAt:number|undefined,craftAt:number|undefined,completedAt:number|undefined,lastDay=-1
function observation(){
 const at=turnOf(w),plot=d.c.residentPlot&&cultivationStatus(w,d.c.residentPlot.pos)
 if(plot&&plantedAt===undefined){plantedAt=at;seedUid=plot.state.seedUid;growthTotal=plot.total;roundtrip('actual-plant')}
 const crop=d.c.bag.find(i=>i.cropHarvest?.owner===d.c.id&&i.def==='Item.Oats')
 if(crop&&harvestedAt===undefined){harvestedAt=at;assert.ok(plantedAt!==undefined&&growthTotal!==undefined&&at-plantedAt>=growthTotal,'No earlier growth credit or accelerated crop clock');roundtrip('actual-full-growth-harvest')}
 if(d.market.items.some(i=>i.cropHarvest?.owner===d.c.id)&&soldAt===undefined){soldAt=at;assert.ok((d.c.money??0)>0,'Actual farmer sale must be paid');roundtrip('actual-paid-grain')}
 if(d.trader.workJob?.residentWorkshop&&d.trader.workJob.inputs.some(input=>input.def==='Item.Oats'&&d.trader.bag.some(i=>i.uid===input.uid&&i.cropHarvest?.owner===d.c.id))&&craftAt===undefined){craftAt=at;roundtrip('actual-new-crop-craft')}
 const startedAt=craftAt
 if(startedAt!==undefined&&d.market.items.some(i=>i.workshopMade?.worker===d.trader.id&&i.workshopMade.at>=startedAt))completedAt=at
 const day=Math.floor((at-start)/TURNS_PER_DAY)
 if(day!==lastDay){lastDay=day;rows.push({at,day,crop:plot?{growth:plot.state.growth,total:plot.total,water:plot.waterMl,seedUid:plot.state.seedUid}:undefined,farmer:{needs:structuredClone(d.c.needs),pos:{...d.c.pos},money:d.c.money},worker:{needs:structuredClone(d.trader.needs),pos:{...d.trader.pos}},observer:structuredClone(player(w).needs)});roundtrip('day-'+day);console.log(JSON.stringify({day,at,grainHarvested:harvestedAt!==undefined,grainSold:soldAt!==undefined,newCropCraftStarted:craftAt!==undefined,workerFatigue:d.trader.needs.fatigue,workerTemperature:d.trader.needs.bodyTemp}))}
}
try{
 cachedSupply('Item.Bedroll');const campBed=player(w).bag.find(i=>i.def==='Item.Bedroll')!;act({type:'place',uid:campBed.uid,dir:dirIndex(0,1)})
 while(turnOf(w)-start<horizon&&completedAt===undefined){
  observation();if(completedAt!==undefined)break
  const p=player(w)
  if(p.needs.waterDeficit>=350){const water=p.bag.find(i=>i.def==='Item.WaterBottle'&&drinkVolume(w,i)>0);if(water)act({type:'consume',uid:water.uid});else cachedSupply('Item.WaterBottle');continue}
  const food=p.bag.find(i=>readyFood(w,p,i))
  if(p.needs.kcal<500&&food){act({type:'consume',uid:food.uid});continue}
  if(!food){cachedSupply('Item.Hardtack');continue}
  if(turnOf(w)>=nextShopCheck){if(serviceShop())continue;nextShopCheck=turnOf(w)+600}
  assert.ok(p.needs.kcal>0,'Actual observer food supply exhausted')
  assert.ok(p.needs.waterDeficit<1500,'Actual observer finite water reserve exhausted while the real shop was unavailable')
  if(p.needs.bodyTemp<36.5){const hearth=w.s.map.residentHearth;assert.ok(hearth,'Original common hearth');if(warmthError(w,p)){moveTo(hearth.pos);continue}act({type:'warmByFire'});continue}
  if(p.needs.fatigue>=65){if(!shelter(true))continue;act({type:'sleep'});continue}
  if(!shelter())continue
  act({type:'rest',turns:100})
 }
 assert.ok(plantedAt!==undefined&&harvestedAt!==undefined&&soldAt!==undefined&&craftAt!==undefined&&completedAt!==undefined,'Full unaccelerated crop clock, harvest, paid sale and actual workshop product must complete')
 roundtrip('completed-new-crop-product')
 writeFileSync(join(out,'audit.json'),JSON.stringify({success:true,horizonDays,elapsedTurns:turnOf(w)-start,days:(turnOf(w)-start)/TURNS_PER_DAY,initial,plantedAt,seedUid,growthTotal,harvestedAt,soldAt,craftAt,completedAt,actions,boughtProducts,returnedBowls,rows,limits:'Controlled warm noon arrival/healthy original actors/finite observer cash/scheduling and declared observer-only 120-hardtack/60L/one-bedroll diagnostic camp, not natural acquisition. Instrumented real customer demand and same-bowl returns. No growth credit or post-capture time/RNG/resource/body mutation. Full current crop growth uses normal actual actions; actual NPC seed allocation, water/needs, harvest, paid sale and workshop production. Not normal initial travel, all-community survival, all-season or unlimited grain/fuel self-sufficiency.'},null,2),{flag:'wx'});console.log(JSON.stringify({days:(turnOf(w)-start)/TURNS_PER_DAY,plantedAt,harvestedAt,soldAt,craftAt,completedAt,actions}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),horizonDays,plantedAt,seedUid,growthTotal,harvestedAt,soldAt,craftAt,completedAt,elapsedTurns:turnOf(w)-start,actions,boughtProducts,returnedBowls,rows,farmer:{needs:d.c.needs,pos:d.c.pos,plot:d.c.residentPlot},worker:{needs:d.trader.needs,pos:d.trader.pos,job:d.trader.workJob},last:w.s.log.slice(-15)},null,2),{flag:'wx'});writeFileSync(join(out,'failure-world.json'),serialize(w.s),{flag:'wx'});throw error}

/** Controlled demand at the original settlement. All progression after capture uses normal actions. */
import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{ashWorkshopFixture}from'../tests/ash-workshop-fixture'
import{player,turnOf,TURNS_PER_DAY,terrainAt,creatureAt,inBounds,tileAt,type World}from'../src/core/ctx'
import{playerAct}from'../src/core/game'
import{serialize,deserialize}from'../src/core/save'
import{tradeQuote}from'../src/core/economy'
import{projectThermalState}from'../src/core/thermal'
import{DIRS,cheb,dirIndex,type Pos}from'../src/core/geom'
import{findPath,diagonalBlocked}from'../src/core/path'
import{hasLos}from'../src/core/fov'
import{drinkVolume}from'../src/core/wash-water'
import{readyFood}from'../src/core/open-food-state'
import{innQuote}from'../src/core/inn'
import{warmthError}from'../src/core/resident-warmth'
import type{Action}from'../src/core/actions'

const out=process.argv[2];assert.ok(out&&!existsSync(out),'Choose a new output directory');mkdirSync(out,{recursive:true})
const d=ashWorkshopFixture(),w=d.w,start=turnOf(w),rows:unknown[]=[],actions:Record<string,number>={},bought:number[]=[],returned:number[]=[]
const initial={proof:d.proof,bowls:d.market.items.filter(i=>i.def==='Item.Bowl').map(i=>i.uid),oats:d.market.items.filter(i=>i.def==='Item.Oats').reduce((n,i)=>n+i.count,0),wood:d.market.items.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0)}
const rentedBed=w.s.map.innBeds?.find(b=>b.keeper===d.c.id);assert.ok(rentedBed,'Original generated inn bed')
const garments=(['chest','lining','feet','head']as const).flatMap(slot=>player(w).equip[slot]?[{slot,uid:player(w).equip[slot]!.uid}]:[])
writeFileSync(join(out,'initial-world.json'),serialize(w.s),{flag:'wx'});writeFileSync(join(out,'declared-initial.json'),JSON.stringify(initial,null,2),{flag:'wx'})
function act(a:Action){const at=w.s.time,error=playerAct(w,a);if(error==='길이 막혔다'&&a.type==='move'){actions.blockedMove=(actions.blockedMove??0)+1;assert.equal(playerAct(w,{type:'wait'}),null);actions.wait=(actions.wait??0)+1}else assert.equal(error,null,a.type);actions[a.type]=(actions[a.type]??0)+1;assert.ok(player(w).alive&&d.c.alive,'Original observer and worker must remain alive');assert.ok(w.s.time>=at);assert.ok(turnOf(w)-start<72000,'Finite diagnostic horizon, not an action-cap survival claim')}
function moveTo(pos:Pos){
 for(let i=0;cheb(player(w).pos,pos)>1&&i<80;i++){
  const p=player(w),paths=DIRS.map(v=>({x:pos.x+v.x,y:pos.y+v.y})).filter(q=>inBounds(w,q)&&terrainAt(w,q).passable&&hasLos(w,q,pos)&&!diagonalBlocked(w,q,pos.x-q.x,pos.y-q.y)&&(!creatureAt(w,q)||creatureAt(w,q)!.id===p.id)).map(q=>findPath(w,p.pos,q,{avoidCreatures:true,selfId:p.id})).filter((p):p is NonNullable<typeof p>=>!!p?.length).sort((a,b)=>a.length-b.length)
  assert.ok(paths[0]?.length,'Actual route to known local destination');const next=paths[0][0];act({type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)})
 }assert.ok(cheb(player(w).pos,pos)<=1)
}
function approachWorker(){for(let i=0;cheb(player(w).pos,d.c.pos)>1&&i<40;i++)moveTo(d.c.pos)}
function trade(buy:{uid:number;count:number}[],sell:{uid:number;count:number}[]=[]){
 approachWorker();const q=tradeQuote(w,player(w),d.c,buy,sell);assert.equal(q.error,null);const bank=d.market.money+(player(w).money??0)
 act({type:'trade',target:d.c.id,buy,sell,expectedBalance:q.balance});assert.equal(d.market.money+(player(w).money??0),bank,'Each actual sale conserves customer and market cash')
}
function provideWater(){
 const p=player(w),held=p.bag.find(i=>i.def==='Item.WaterBottle'&&drinkVolume(w,i)>0);if(held)return held
 const stock=d.market.items.find(i=>i.def==='Item.WaterBottle'&&drinkVolume(w,i)>0);assert.ok(stock,'Actual finite merchant water must remain');trade([{uid:stock.uid,count:1}]);const bottle=player(w).bag.find(i=>i.def==='Item.WaterBottle'&&drinkVolume(w,i)>0);assert.ok(bottle);return bottle
}
/** Read-only forecasts select actual owned garments and a previously observed common floor. */
function shelter(sleeping=false){
 const p=player(w),live=garments.flatMap(g=>{const i=[...p.bag,...Object.values(p.equip)].find(i=>i?.uid===g.uid);return i?[{...g,item:i}]:[]}),positions=[...(sleeping?[rentedBed!.pos]:[]),p.pos,...DIRS.map(v=>({x:d.c.home!.x+v.x*2,y:d.c.home!.y+v.y*2})),{x:28,y:25}].filter(q=>inBounds(w,q)&&tileAt(w,q).seen&&terrainAt(w,q).passable&&(!terrainAt(w,q).bedding||sleeping&&cheb(q,rentedBed!.pos)===0)&&(!creatureAt(w,q)||creatureAt(w,q)!.id===p.id))
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
try{
 approachWorker();const rental=innQuote(w,player(w),d.c,rentedBed.id,2);assert.equal(rental.error,null);act({type:'rentBed',target:d.c.id,bed:rentedBed.id,expectedFee:rental.fee,periods:2})
 let needed=4;const water=[];for(const i of d.market.items)if(i.def==='Item.WaterBottle'&&drinkVolume(w,i)>0&&needed>0){const count=Math.min(needed,i.count);water.push({uid:i.uid,count});needed-=count}assert.equal(needed,0);trade(water)
 needed=2;const food=[];for(const i of d.market.items)if(i.def==='Item.Hardtack'&&needed>0){const count=Math.min(needed,i.count);food.push({uid:i.uid,count});needed-=count}assert.equal(needed,0);trade(food)
 let stoppedAt:number|undefined
 while(turnOf(w)-start<71000){
  const p=player(w),made=d.market.items.find(i=>i.workshopMade?.worker===d.c.id&&!bought.includes(i.uid+1000000000*i.workshopMade.at))
  if(made){
   const marker=made.workshopMade!,uid=made.uid,serial=uid+1000000000*marker.at;assert.ok(initial.bowls.includes(uid),'Each output uses an original physical bowl');trade([{uid,count:1}]);const it=player(w).bag.find(i=>i.uid===uid)!;assert.equal(it.def,'Item.AshCake');assert.ok(readyFood(w,player(w),it));bought.push(serial)
   act({type:'consume',uid});assert.equal(it.def,'Item.Bowl');assert.equal(it.workshopMade,undefined);trade([],[{uid,count:1}]);returned.push(uid);roundtrip('product-'+bought.length)
   rows.push({number:bought.length,at:turnOf(w),uid,maker:marker,grain:d.market.items.filter(i=>i.def==='Item.Oats').reduce((n,i)=>n+i.count,0),workerBody:{temperature:d.c.needs.bodyTemp,kcal:d.c.needs.kcal,water:d.c.needs.waterDeficit,fatigue:d.c.needs.fatigue}});continue
  }
  if(bought.length===initial.oats){stoppedAt??=turnOf(w);if(turnOf(w)-stoppedAt>1500&&!d.c.workJob?.residentWorkshop&&(d.c.residentWorkshopAfter??0)>turnOf(w))break}
  if(p.needs.waterDeficit>=350){const water=provideWater();act({type:'consume',uid:water.uid});continue}
  const food=p.bag.find(i=>readyFood(w,p,i));if(p.needs.kcal<500&&food){act({type:'consume',uid:food.uid});continue}
  assert.ok(p.needs.kcal>0,'Finite observer food horizon reached')
  if(p.needs.bodyTemp<36.5){const hearth=w.s.map.residentHearth;assert.ok(hearth,'Original common hearth');if(warmthError(w,p)){moveTo(hearth.pos);continue}act({type:'warmByFire'});continue}
  if(p.needs.fatigue>=65){if(!shelter(true))continue;act({type:'sleep'});continue}
  if(!shelter())continue
  act({type:'rest',turns:100})
 }
 assert.equal(bought.length,initial.oats,'Actual original grain must produce exactly the same number of supplied meals');assert.equal(returned.length,bought.length)
 const held=d.c.bag.filter(i=>i.def==='Item.PilgrimAsh').reduce((n,i)=>n+i.count,0),tower=w.s.overworld!.towers.find(t=>t.id==='Region.ChimneySeven')!,taken=Object.values(tower.ashDeposits!).reduce((n,p)=>n+p.taken,0)
 assert.equal(taken,bought.length+held,'Gathered physical ash is either consumed by actual meals or still held')
 for(const pool of Object.values(tower.ashDeposits!))assert.equal(pool.initial+pool.deposited,pool.stock+pool.taken+pool.lost)
 assert.equal(d.market.items.filter(i=>i.def==='Item.Oats').reduce((n,i)=>n+i.count,0),0);assert.ok(!d.c.workJob?.residentWorkshop);assert.ok((d.c.residentWorkshopAfter??0)>turnOf(w),'Missing original grain must defer further production')
 roundtrip('depleted-final')
 writeFileSync(join(out,'audit.json'),JSON.stringify({success:true,elapsedTurns:turnOf(w)-start,days:(turnOf(w)-start)/TURNS_PER_DAY,initial,products:bought.length,returnedBowls:returned,ash:{taken,held,pools:tower.ashDeposits},actions,rows,limits:'Controlled finite observer arrival/cash/healthy original worker/scheduling and instrumented customer demand. Original generated drift/stock. Normal actions only after capture, actual water/clothing/movement/trade/food and NPC labour. No natural initial travel, future sustainable grain/fuel production, long-term survival or human-play claim.'},null,2),{flag:'wx'});console.log(JSON.stringify({products:bought.length,elapsedTurns:turnOf(w)-start,ashTaken:taken,actions}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),elapsedTurns:turnOf(w)-start,products:bought.length,actions,rows,worker:{pos:d.c.pos,needs:d.c.needs,activity:d.c.activity,job:d.c.workJob,order:d.c.residentWorkshopOrder},last:w.s.log.slice(-12)},null,2),{flag:'wx'});writeFileSync(join(out,'failure-world.json'),serialize(w.s),{flag:'wx'});throw error}

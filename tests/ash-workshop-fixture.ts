import {ashCakeSupplyFixture}from'./ash-cake-fixture'
import {player,turnOf,type World}from'../src/core/ctx'
import {playerAct}from'../src/core/game'
import {marketFor}from'../src/core/economy'
import {invalidateLights,updatePlayerVision}from'../src/core/fov'
import {serialize,deserialize}from'../src/core/save'
import type{Action}from'../src/core/actions'

/** Original generated catchments/merchant/stock; only the observer and this resident are scheduled. */
export function ashWorkshopFixture(){
 const d=ashCakeSupplyFixture(),c=d.trader
 Object.assign(c.needs,{kcal:3000,waterDeficit:0,fatigue:0,bodyTemp:37,hygiene:100,stress:0})
 c.hands={kind:'washed',at:turnOf(d.w)};c.ai.mode='idle';c.asleep=false;c.unconscious=false
 for(const other of d.s.creatures)other.nextAct=other.id===d.p.id||other.id===c.id?d.s.time:d.s.time+1e9
 // Declared observation location, outside the resident's home/door/worksite path.
 d.p.pos={x:28,y:25};d.p.nextAct=d.s.time
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w),worker=s.creatures.find(o=>o.id===c.id)!,market=marketFor(w,worker)!
 invalidateLights(w);updatePlayerVision(w,p);s.fx=[]
 const proof={originalWorker:worker.id,originalHome:worker.home,originalStock:market.items.map(i=>({uid:i.uid,def:i.def,count:i.count})),originalBag:worker.bag.map(i=>({uid:i.uid,def:i.def,count:i.count})),originalCash:{worker:worker.money,market:market.money},declaredHealthyIdleResident:true,onlyObserverAndOriginalResidentScheduled:true,declaredObserverLocation:p.pos,noPostCaptureInjection:true,noClaimOfEarlierNormalTravelOrSustainableRawMaterialProduction:true}
 return{w,s,p,c:worker,market,proof,act:(a:Action)=>{const e=playerAct(w,a);if(e)throw Error(e)}}
}

/** No ash, grain, bowl, water, kit or fuel in the observer's bag; these must be acquired by UI. */
export function ashHarvestFixture(){
 const d=ashWorkshopFixture();d.p.pos={x:30,y:25}
 for(const c of d.s.creatures)c.nextAct=c.id===d.p.id?d.s.time:d.s.time+1e9
 invalidateLights(d.w);updatePlayerVision(d.w,d.p);d.s.fx=[]
 return{...d,proof:{...d.proof,declaredObserverLocation:d.p.pos,allOriginalNpcsTemporarilyUnscheduled:true,declaredInitialPlayerCash:d.p.money,initialPlayerBag:d.p.bag.map(i=>({uid:i.uid,def:i.def,count:i.count})),actualSource:'Original generated outdoor drift; original finite merchant stock. Required player materials are acquired after Title.'}}
}

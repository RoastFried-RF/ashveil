import { baseFireDecision, baseFireStatus } from './base-fire'
import { campfireAt, campfireDef, nearbyCampfires } from './campfire'
import { baseWaterDecision, baseWaterDef, baseWaterStatus, refreshBaseWater } from './base-water'
import { baseLogisticsDecision } from './base-logistics'
// 실제 보관함을 거점으로 삼고 동료가 자기 몸/배낭으로 작업한다.
import { channelTurns, multiTurnFactor } from './action-time'
import type { Action } from './actions'
import { baseCampDef, baseCraftStock, refreshBaseCraftStock, refreshBaseLogistics } from './base-camp-state'
import { capacity } from './body'
import { isCompanion } from './companion-state'
import { craftError, stockMaterialQuote, startCraft, workshop } from './crafting'
import { materialPlanPresent } from './material-crafting'
import { creatureAt, inBounds, log, player, terrainAt, tileAt, turnOf, type World } from './ctx'
import { hostile } from './diplomacy'
import { canSee, hasLos } from './fov'
import { stopActivity } from './game'
import { cheb, DIRS, eq, type Pos } from './geom'
import { gridAdd, type Grid } from './items'
import { ageLooseGear } from './gear-weather'
import { diagonalBlocked } from './path'
import type { Creature, RecipeDef } from './types'
function ready(w:World,c:Creature):string|null{
 return !c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2?'깨어서 손을 쓸 수 있어야 한다':null
}
function beside(w:World,c:Creature,pos:Pos){return inBounds(w,pos)&&cheb(c.pos,pos)<=1&&hasLos(w,c.pos,pos)&&canSee(w,c,pos)&&!diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y)}
function storeOwned(w:World,c:Creature,pos:Pos){
 if(!inBounds(w,pos)||terrainAt(w,pos).id!==baseCampDef(w).storeTerrain)return false
 const placed=tileAt(w,pos).placed
 return placed?placed.owner===c.id:!!w.s.map.waypoints?.homeStash&&eq(w.s.map.waypoints.homeStash,pos)
}
export function claimBaseQuote(w:World,c:Creature,pos:Pos){
 const d=baseCampDef(w)
 let error=ready(w,c)
 if(!error&&(c.id!==w.s.playerId||c.activity))error='직접 하던 일을 마친 뒤 거점을 마련해야 한다'
 if(!error&&w.s.map.baseCamp)error='이미 이 지역에 거점이 있다'
 if(!error&&(!beside(w,c,pos)||!storeOwned(w,c,pos)))error='본인의 실제 야영지 보관함 곁이어야 한다'
 const site=w.s.overworld?.sites.find((s)=>s.id===w.s.overworld?.currentRegion)
 if(!error&&(site?.kind==='settlement'||w.s.map.innBeds?.length||w.s.map.residentBeds?.length))error='다른 사람들이 살고 있는 곳을 점유할 수 없다'
 if(!error&&w.s.creatures.some((o)=>o.alive&&o.id!==c.id&&hostile(w,c,o)&&!o.captivity&&o.ai.mode!=='surrender'&&cheb(o.pos,pos)<=d.radius))error='먼저 주변의 적을 물리쳐야 한다'
 const turns=channelTurns(w,c,d.claimTurns)
 if(!error&&turns===null)error='몸 상태로 거점을 정비할 수 없다'
 return{error,turns:turns??0,uid:inBounds(w,pos)?tileAt(w,pos).placed?.item.uid:undefined}
}
export function nearbyBaseStores(w:World,c:Creature){return [{x:0,y:0},...DIRS].map((v)=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).filter((p)=>storeOwned(w,c,p)&&beside(w,c,p))}
export function startClaimBase(w:World,c:Creature,pos:Pos):string|null{
 const q=claimBaseQuote(w,c,pos);if(q.error)return q.error
 c.activity={kind:'claimBase',target:{...pos},uid:q.uid,total:q.turns,remaining:q.turns,woundCount:c.body.wounds.length,label:'거점 정비와 점유'};return null
}
export function claimBaseStep(w:World,c:Creature):boolean{
 const act=c.activity!,shadow={...c,activity:undefined},q=claimBaseQuote(w,shadow,act.target!)
 if(q.error||q.uid!==act.uid){if(c.id===w.s.playerId)log(w,'warn',`거점 정비 중단: ${q.error??'보관함이 바뀌었다'}.`);c.activity=undefined;return true}
 if(act.remaining>0)return false
 w.s.map.baseCamp={owner:c.id,at:turnOf(w),store:{...act.target!},storeUid:act.uid,tasks:{}}
 c.activity=undefined;log(w,'good','실제 보관함 주변을 거점으로 정비했다. 식량과 물품은 직접 채워야 한다.');return true
}
export function baseStoreError(w:World,c:Creature,near=true):string|null{
 const base=w.s.map.baseCamp
 if(!base||base.owner!==w.s.playerId||c.id!==base.owner&&!isCompanion(w,c))return '본인 또는 동료가 쓸 수 있는 거점이 아니다'
 const error=ready(w,c);if(error)return error
 if(!inBounds(w,base.store)||terrainAt(w,base.store).id!==baseCampDef(w).storeTerrain||tileAt(w,base.store).placed?.item.uid!==base.storeUid||tileAt(w,base.store).placed&&tileAt(w,base.store).placed!.owner!==base.owner)return '거점의 실제 보관함이 없어지거나 바뀌었다'
 if(near&&!beside(w,c,base.store))return '실제 보관함 바로 곁으로 가야 한다'
 return null
}
export function openBaseStore(w:World,c:Creature):string|null{
 const error=baseStoreError(w,c);if(error)return error
 const pos=w.s.map.baseCamp!.store,tile=tileAt(w,pos)
 if(tile.cont&&!tile.cont.opened)for(const it of tile.cont.items)ageLooseGear(w,it,pos,true)
 tile.cont??={items:[],opened:true,kind:tile.t};tile.cont.opened=true;tile.searched=true
 if(c.id===w.s.playerId)w.s.loot={kind:'cont',pos:{...pos}}
 return null
}
/** 공간을 먼저 검사해 실패 시 원본·UID·부분 묶음을 그대로 둔다. */
export function transferBase(w:World,c:Creature,direction:'take'|'put',uid:number,count?:number,preview=false):string|null{
 const error=baseStoreError(w,c);if(error)return error
 const tile=tileAt(w,w.s.map.baseCamp!.store),store=tile.cont?.items??[],from=direction==='take'?store:c.bag,source=from.find((i)=>i.uid===uid),n=count??source?.count??0
 if(!source||!Number.isSafeInteger(n)||n<1||n>source.count)return '옮길 실제 물품과 수량을 다시 확인해야 한다'
 const [width,height]=terrainAt(w,w.s.map.baseCamp!.store).lootGrid??[12,8],to:Grid=direction==='take'?{items:c.bag,w:10,h:6}:{items:store,w:width,h:height}
 const shadow={db:w.db,s:{...w.s,nextId:-1}},copy={...to,items:structuredClone(to.items)},probe={...source,count:n,gx:undefined,gy:undefined,rot:undefined}
 if(gridAdd(shadow,copy,structuredClone(probe)))return '받을 배낭이나 창고에 공간이 없다'
 if(preview)return null
 if(direction==='take')ageLooseGear(w,source,w.s.map.baseCamp!.store,!tile.cont?.opened)
 const moved=n===source.count?source:{...source,uid:w.s.nextId++,count:n}
 if(n===source.count)from.splice(from.indexOf(source),1);else source.count-=n
 delete moved.gx;delete moved.gy;delete moved.rot;gridAdd(w,to,moved)
 if(direction==='put'&&!tile.cont)tile.cont={items:store,opened:true,kind:tile.t}
 refreshBaseLogistics(w,moved.def)
 const waterTask=w.s.map.baseCamp?.tasks[c.id];if(direction==='put'&&waterTask?.waterBottle===moved.uid)waterTask.waterBottle=undefined
 refreshBaseWater(w)
 return null
}
export function baseCommandError(w:World,c:Creature):string|null{
 const p=player(w),error=baseStoreError(w,p,false)??ready(w,c)
 if(error)return error
 if(!isCompanion(w,c)||!w.s.creatures.includes(c))return '실제 동료여야 한다'
 if(capacity(w,p,'hearing')<.2||capacity(w,c,'hearing')<.2)return '서로 말을 들을 수 있어야 한다'
 if(!beside(w,p,c.pos)||p.activity)return '곁에서 깨어 있는 동료에게 직접 지시해야 한다'
 if(cheb(p.pos,w.s.map.baseCamp!.store)>baseCampDef(w).radius)return '거점 안에서 작업을 정해야 한다'
 if(w.s.creatures.some((o)=>o.alive&&!o.unconscious&&!o.asleep&&!o.captivity&&o.ai.mode!=='surrender'&&hostile(w,p,o)&&canSee(w,p,o.pos)))return '전투 중에는 새 작업을 배정할 수 없다'
 return null
}
export function assignBaseTask(w:World,c:Creature,kind:'craft'|'craftStock'|'guard'|'haul'|'gather'|'water'|'fire'|'cancel',recipe?:string,batches=1,item?:string,firePos?:Pos):string|null{
 const error=baseCommandError(w,c);if(error)return error
 if(!['craft','craftStock','guard','haul','gather','water','fire','cancel'].includes(kind))return '알 수 없는 거점 작업이다'
 const crafting=kind==='craft'||kind==='craftStock'
 const base=w.s.map.baseCamp!,old=base.tasks[c.id]
 if(kind!=='cancel'&&c.companion!.status!=='employed')return '급료를 먼저 건네야 한다'
 if(c.activity&&(!old||c.workJob?.baseOrder!==old.id&&c.activity.baseOrder!==old.id))return '하던 일을 먼저 마쳐야 한다'
 if(crafting){
  const r=recipe&&w.db.tryGet<RecipeDef>(recipe)
  if(!r||!r.basic&&!c.recipes?.includes(r.id)||r.passiveTurns||!Number.isSafeInteger(batches)||batches<1||batches>baseCampDef(w).maxBatches)return '알고 있는 즉시 제작법과 작업 횟수를 확인해야 한다'
  if(c.workJob&&c.workJob.baseOrder!==old?.id)return '다른 작업의 남은 진행을 먼저 정리해야 한다'
  if(kind==='craftStock'&&(r.inputs.some(input=>input.item===r.output.item)||!Number.isSafeInteger(r.output.count)||r.output.count<1))return '입력과 완성품이 다른 개수 제작법에 최소 재고를 맡겨야 한다'
  if(kind==='craftStock'){
   const shadow:World={db:w.db,s:{...w.s,map:{...w.s.map,baseCamp:{...base,tasks:{...base.tasks,[c.id]:{id:old?.id??w.s.nextId,kind:'craft',recipe:r.id,craftTarget:batches,remaining:0}}}}}}
   const stock=baseCraftStock(shadow,c);if(stock?.error)return stock.error
  }
 }
 if(kind==='fire'&&(!firePos||!nearbyCampfires(w,player(w)).some((p)=>eq(p,firePos))||diagonalBlocked(w,player(w).pos,firePos.x-player(w).pos.x,firePos.y-player(w).pos.y)||campfireAt(w,firePos)?.tile.placed?.owner!==base.owner||cheb(firePos,base.store)>baseCampDef(w).radius))return '곁에 직접 설치한 거점 모닥불을 확인해야 한다'
 if(kind==='water'&&(!Number.isSafeInteger(batches)||batches<1||batches>baseCampDef(w).maxBatches))return '식수 목표 단위를 확인해야 한다'
 if((kind==='haul'||kind==='gather')&&(!item||!w.db.has(item)||w.db.get(item).defType!=='Item'||!Number.isSafeInteger(batches)||batches<1||batches>baseCampDef(w).maxBatches))return '실제 물품 종류와 목표 수량을 확인해야 한다'
 if(c.activity?.baseOrder===old?.id&&c.activity)stopActivity(w,c)
 const resuming=crafting&&old?.kind==='craft'&&old.recipe===recipe&&c.workJob?.baseOrder===old.id
 if(old&&c.workJob?.baseOrder===old.id){stopActivity(w,c);if(!resuming)c.workJob=undefined}
 if(kind==='cancel'){delete base.tasks[c.id];c.companion!.order='hold';c.companion!.anchor={...c.pos};return null}
 base.tasks[c.id]={id:resuming?old!.id:w.s.nextId++,kind:kind==='craftStock'?'craft':kind,craftTarget:kind==='craftStock'?batches:undefined,firePos:kind==='fire'?{...firePos!}:undefined,fireUid:kind==='fire'?campfireAt(w,firePos!)!.uid:undefined,fireTarget:kind==='fire'?campfireDef(w).workerTarget:undefined,recipe:crafting?recipe:undefined,item:kind==='haul'||kind==='gather'?item:undefined,targetStock:kind==='haul'||kind==='gather'?batches:undefined,waterTarget:kind==='water'?batches*baseWaterDef(w).unitMl:undefined,remaining:kind==='guard'?0:batches}
 if(kind==='craftStock')refreshBaseCraftStock(w,c)
 refreshBaseLogistics(w,item)
 refreshBaseWater(w)
 c.companion!.order='defend';c.companion!.anchor={...base.store};c.ai.path=undefined
 log(w,'info',`${c.name}에게 ${kind==='guard'?'거점 방어':kind==='fire'?'실제 모닥불 땔감 보급과 점화':kind==='craftStock'?`${w.db.get<RecipeDef>(recipe!).label} 완성품 최소${batches}개 유지`:kind==='craft'?`${w.db.get<RecipeDef>(recipe!).label} ${batches}회`:kind==='water'?`식수 ${batches*baseWaterDef(w).unitMl}ml 보급`:`${w.db.item(item!).label} 창고 목표${batches}개 ${kind==='haul'?'운반':'채집'}`}을(를) 맡겼다. 실제 급료와 식량·시간이 필요하다.`);return null
}
export function startBaseCraft(w:World,c:Creature):string|null{
 const base=w.s.map.baseCamp,task=base?.tasks[c.id],error=baseStoreError(w,c,false)
 if(error)return error
 const stock=refreshBaseCraftStock(w,c);if(stock?.error)return stock.error
 if(!task||task.kind!=='craft'||task.remaining<=0||c.companion?.status!=='employed'||cheb(c.pos,base!.store)>baseCampDef(w).radius)return '유효한 실제 제작 배정이 없다'
 if(c.workJob&&c.workJob.baseOrder!==task.id)return '다른 작업을 먼저 정리해야 한다'
 const failure=startCraft(w,c,task.recipe!,multiTurnFactor(w,c));if(failure)return failure
 c.workJob!.baseOrder=task.id;return null
}
export function approachBaseStore(w:World,c:Creature):Pos|undefined{
 const store=w.s.map.baseCamp!.store
 return [{x:0,y:0},...DIRS].map((d)=>({x:store.x+d.x,y:store.y+d.y})).filter((p)=>inBounds(w,p)&&terrainAt(w,p).passable&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)&&hasLos(w,p,store)&&!diagonalBlocked(w,store,p.x-store.x,p.y-store.y)).sort((a,b)=>cheb(a,c.pos)-cheb(b,c.pos)||a.y-b.y||a.x-b.x)[0]
}
export function baseWorkDecision(w:World,c:Creature,threats:Creature[]):{action?:Action;goal?:Pos}|null{
 const base=w.s.map.baseCamp,task=base?.tasks[c.id]
 if(!task||task.kind==='guard'||baseStoreError(w,c,false)||!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.order!=='defend'||threats.some((o)=>!o.asleep&&!o.unconscious&&!o.captivity&&o.ai.mode!=='surrender'))return null
 if(task.kind==='fire')return baseFireDecision(w,c)
 if(task.kind==='water')return baseWaterDecision(w,c)
 if(task.kind==='haul'||task.kind==='gather')return baseLogisticsDecision(w,c)
 if(refreshBaseCraftStock(w,c)?.error)return {action:{type:'wait'}}
 const r=w.db.get<RecipeDef>(task.recipe!),output=c.bag.find((i)=>i.def===r.output.item)
 if(output){if(!beside(w,c,base!.store))return{goal:approachBaseStore(w,c)};return transferBase(w,c,'put',output.uid,undefined,true)?{action:{type:'wait'}}:{action:{type:'baseTransfer',direction:'put',uid:output.uid}}}
 if(task.remaining<=0)return null
 const needs=new Map<string,number>()
 for(const input of r.inputs)needs.set(input.item,(needs.get(input.item)??0)+input.count)
 for(const [item,needed]of needs){const have=c.bag.filter((i)=>i.def===item).reduce((n,i)=>n+i.count,0);if(have>=needed)continue
  if(!beside(w,c,base!.store))return{goal:approachBaseStore(w,c)}
  const supply=tileAt(w,base!.store).cont?.items.find((i)=>i.def===item)
  const count=supply&&Math.min(supply.count,needed-have)
  return supply&&!transferBase(w,c,'take',supply.uid,count,true)?{action:{type:'baseTransfer',direction:'take',uid:supply.uid,count}}:{action:{type:'wait'}}
 }
 if(r.materialInputs?.length){
  if(c.workJob?.recipe===r.id&&(!c.workJob.materialPlan||!materialPlanPresent(w,c,c.workJob.materialPlan,c.workJob.inputs)))return{action:{type:'wait'}}
  const stock=tileAt(w,base!.store).cont?.items??[],quote=stockMaterialQuote(w,c,r,stock)
  if(quote.error)return{action:{type:'wait'}}
  const input=quote.plan?.bindings.find(binding=>!c.bag.some(it=>it.uid===binding.uid))
  if(input){if(!beside(w,c,base!.store))return{goal:approachBaseStore(w,c)};const count=Math.ceil(input.usedGrams/input.unitGrams);return transferBase(w,c,'take',input.uid,count,true)?{action:{type:'wait'}}:{action:{type:'baseTransfer',direction:'take',uid:input.uid,count}}}
 }
 if(!craftError(w,c,r))return{action:{type:'baseCraft'}}
 if(r.stations?.length&&!r.stations.includes(workshop(w,c,r.stations).id)){
  const candidates:Pos[]=[]
  for(let y=base!.store.y-baseCampDef(w).radius;y<=base!.store.y+baseCampDef(w).radius;y++)for(let x=base!.store.x-baseCampDef(w).radius;x<=base!.store.x+baseCampDef(w).radius;x++){const pos={x,y};if(!inBounds(w,pos)||!terrainAt(w,pos).passable||creatureAt(w,pos)&&creatureAt(w,pos)!.id!==c.id)continue;const shadow={...c,pos};if(r.stations.includes(workshop(w,shadow,r.stations).id)&&hasLos(w,c.pos,pos))candidates.push(pos)}
  return{goal:candidates.sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)[0]}
 }
 return{action:{type:'wait'}}
}
/** 지시자가 거점에서 확인하는 작업 상태. 다른 주민의 몸 수치를 공개하지 않는다. */
export function baseTaskStatus(w:World,c:Creature):string{
 const task=w.s.map.baseCamp?.tasks[c.id]
 if(!task)return '배정 없음'
 if(c.companion?.status!=='employed')return '급료를 기다린다'
 if(c.companion.order!=='defend')return '다른 지시를 따르는 중이다'
 const error=baseStoreError(w,c,false);if(error)return error
 if(task.kind==='guard')return '주변의 실제 적을 경계한다'
 if(task.kind==='fire')return baseFireStatus(w,c)
 if(task.kind==='water')return baseWaterStatus(w,c)
 if(task.kind==='haul'||task.kind==='gather')return c.activity?.kind==='gather'?'실제 자원을 채집하는 중이다':task.remaining<=0?'실제 창고의 목표 재고를 채웠다':`${w.db.item(task.item!).label} 목표${task.targetStock}개까지 ${task.remaining}개가 더 필요하다`
 if(c.activity?.kind==='craft')return `작업 중 ${c.workJob?.progress??0}/${c.workJob?.total??0}턴`
 const r=w.db.get<RecipeDef>(task.recipe!),output=c.bag.find((i)=>i.def===r.output.item)
 if(output)return beside(w,c,w.s.map.baseCamp!.store)?transferBase(w,c,'put',output.uid,undefined,true)??'완성한 물품을 창고로 옮긴다':'완성한 물품을 창고로 나른다'
 const stock=baseCraftStock(w,c)
 if(stock?.error)return stock.error
 if(stock&&!stock.needed)return `최소 재고${stock.target}개를 채웠다. 꺼내 쓰면 다시 생산한다`
 if(!stock&&task.remaining<=0)return '배정한 제작과 납품을 마쳤다'
 const missing=r.inputs.find((i)=>c.bag.filter((b)=>b.def===i.item).reduce((n,b)=>n+b.count,0)<i.count)
 if(missing){const item=tileAt(w,w.s.map.baseCamp!.store).cont?.items.find((i)=>i.def===missing.item);return item?'실제 창고 재료를 배낭으로 나른다':`${w.db.item(missing.item).label} 재료를 기다린다`}
 if(r.materialInputs?.length){if(c.workJob?.recipe===r.id&&(!c.workJob.materialPlan||!materialPlanPresent(w,c,c.workJob.materialPlan,c.workJob.inputs)))return '예약한 실제 원재료를 다시 확인하고 작업을 취소해야 한다';const quote=stockMaterialQuote(w,c,r,tileAt(w,w.s.map.baseCamp!.store).cont?.items??[]);if(quote.error)return quote.error;if(quote.plan?.bindings.some(binding=>!c.bag.some(it=>it.uid===binding.uid)))return '실제 창고 원재료를 배낭으로 나른다'}
 return craftError(w,c,r)??'제작을 준비한다'
}

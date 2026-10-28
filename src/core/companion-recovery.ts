// 고용한 실제 동료가 같은 현장으로 걸어가 원본을 들고 돌아온다. 보수 장부는 변경하지 않는다.
import {channelTurns,hostileAware} from './action-time'
import {searchBase,type Action} from './actions'
import {clearBaseTask} from './base-camp-state'
import {capacity} from './body'
import {allCompanions,isCompanion} from './companion-state'
import {companionAccess} from './companions'
import {creatureAt,inBounds,log,player,terrainAt,tileAt,turnOf,type World} from './ctx'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {ageLooseGear} from './gear-weather'
import {addToBag,gridAdd} from './items'
import {diagonalBlocked,findPath} from './path'
import {isRecoveryContract} from './recovery-contracts'
import type {Activity,Creature} from './types'

function actorError(w:World,c:Creature,allowSearch=false){
 if(c.id===w.s.playerId||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||!c.alive||!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)||c.companion!.order!=='follow')return'회수 중인 고용 동료가 아니다'
 if(c.asleep||c.unconscious||c.captivity||c.activity&&!allowSearch||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2||capacity(w,c,'moving')<.2||hostileAware(w,c))return'몸 상태와 위협에서 벗어난 뒤 회수해야 한다'
 return null
}
export function companionRecoveryQuote(w:World,c:Creature,id:string){
 const record=w.s.overworld?.contracts?.filter(isRecoveryContract).find(r=>r.id===id),out={record,error:companionAccess(w,c)}
 if(out.error)return out
 if(c.mapId!==undefined&&c.mapId!==w.s.map.id||player(w).mapId!==undefined&&player(w).mapId!==w.s.map.id){out.error='같은 실제 지도에서 곁에 있어야 한다';return out}
 if(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)){out.error='급료를 받은 고용 동료에게 맡겨야 한다';return out}
 if(!record||record.status!=='active'||turnOf(w)>=record.deadline){out.error='진행 중인 원본 회수 의뢰가 없다';return out}
 if(w.s.overworld?.currentRegion!==record.region||w.s.map.id!==record.mapId||!inBounds(w,record.pos)){out.error='동료와 함께 같은 회수 현장으로 가야 한다';return out}
 if(player(w).bag.some(i=>i.uid===record.itemUid)){out.error='그 원본은 이미 내 배낭에 있다';return out}
 if(c.companionRecovery||c.recoveryCargo||allCompanions(w).some(other=>other.companionRecovery?.itemUid===record.itemUid||other.recoveryCargo?.uid===record.itemUid)){out.error='이미 맡긴 회수나 운반 중인 원본을 먼저 정리해야 한다';return out}
 if(capacity(w,c,'manipulation')<.2||capacity(w,c,'moving')<.2||hostileAware(w,c)){out.error='직접 걷고 물품을 다룰 몸과 안전이 필요하다';return out}
 return out
}
export function assignCompanionRecovery(w:World,c:Creature,id:string):string|null{
 const q=companionRecoveryQuote(w,c,id);if(q.error)return q.error
 const r=q.record!;clearBaseTask(w,c)
 c.companionRecovery={id:r.id,itemUid:r.itemUid,item:r.item,region:r.region,mapId:r.mapId,pos:{...r.pos},terrain:r.terrain,assignedAt:turnOf(w),phase:'outbound'}
 c.companion!.order='follow';c.companion!.lastLeader={...player(w).pos};c.ai.path=undefined;c.ai.target=undefined
 log(w,'info',`${c.name}에게 마지막으로 확인한 원본의 회수를 맡겼다. 실제로 걸어가 확인한 뒤 들고 돌아온다.`);return null
}
export function stopCompanionRecovery(w:World,c:Creature):string|null{
 const task=c.companionRecovery,error=companionAccess(w,c,c.activity?.kind==='search'&&c.activity.recoveryContract===task?.id?'search':undefined);if(error)return error
 if(c.companion?.employer!==w.s.playerId||!task)return'중단할 동료 회수 지시가 없다'
 if(c.activity?.recoveryContract===task.id)c.activity=undefined
 c.companionRecovery=undefined;c.ai.path=undefined;c.companion!.order='follow';c.companion!.lastLeader={...player(w).pos}
 log(w,'info',`${c.name}의 회수 지시를 중단했다. 실제로 든 원본과 다른 물품은 동료에게 남아 있다.`);return null
}
function approach(w:World,c:Creature,pos:Pos){
 const cells=[{x:0,y:0},...DIRS].map(d=>({x:pos.x+d.x,y:pos.y+d.y})).filter(p=>inBounds(w,p)&&terrainAt(w,p).passable&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)&&hasLos(w,p,pos)&&!diagonalBlocked(w,p,pos.x-p.x,pos.y-p.y))
 cells.sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
 return cells.find(p=>cheb(c.pos,p)===0||findPath(w,c.pos,p,{avoidCreatures:true,selfId:c.id,maxNodes:1800})?.length)
}
export function companionRecoveryDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const task=c.companionRecovery;if(!task)return null
 if(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)||c.companion!.order!=='follow'||task.region!==w.s.overworld?.currentRegion||task.mapId!==w.s.map.id){c.companionRecovery=undefined;return null}
 if(c.bag.some(i=>i.uid===task.itemUid&&i.def===task.item)){c.recoveryCargo??={id:task.id,uid:task.itemUid,item:task.item};task.phase='returning';task.reason=undefined}
 if(task.phase==='returning'||task.phase==='failed'){
  const p=player(w)
  if(cheb(c.pos,p.pos)<=1&&hasLos(w,c.pos,p.pos)&&!diagonalBlocked(w,c.pos,p.pos.x-c.pos.x,p.pos.y-c.pos.y)&&canSee(w,c,p.pos))return{action:{type:'companionRecoveryReturn'}}
  const goal=approach(w,c,c.companion!.lastLeader);return goal?{goal}:{action:{type:'wait'}}
 }
 if(cheb(c.pos,task.pos)<=1&&hasLos(w,c.pos,task.pos)&&!diagonalBlocked(w,c.pos,task.pos.x-c.pos.x,task.pos.y-c.pos.y))return{action:{type:'companionRecoveryFetch'}}
 const goal=approach(w,c,task.pos);return goal?{goal}:{action:{type:'wait'}}
}
export function companionRecoverySearchError(w:World,c:Creature,a:Activity):string|null{
 const task=c.companionRecovery,error=actorError(w,c,true);if(error)return error
 if(!task||task.id!==a.recoveryContract||task.phase!=='outbound'||task.region!==w.s.overworld?.currentRegion||task.mapId!==w.s.map.id||a.target?.x!==task.pos.x||a.target?.y!==task.pos.y||!inBounds(w,task.pos)||tileAt(w,task.pos).t!==task.terrain||cheb(c.pos,task.pos)>1||!hasLos(w,c.pos,task.pos)||diagonalBlocked(w,c.pos,task.pos.x-c.pos.x,task.pos.y-c.pos.y))return'원래 맡긴 지도와 용기 곁에서 수색해야 한다'
 return null
}
export function companionRecoveryFetch(w:World,c:Creature):string|null{
 const task=c.companionRecovery,error=actorError(w,c);if(error)return error
 if(!task||task.phase!=='outbound'||task.region!==w.s.overworld?.currentRegion||task.mapId!==w.s.map.id||!inBounds(w,task.pos)||cheb(c.pos,task.pos)>1||!hasLos(w,c.pos,task.pos)||diagonalBlocked(w,c.pos,task.pos.x-c.pos.x,task.pos.y-c.pos.y))return'원래 맡긴 용기 곁으로 가야 한다'
 if(capacity(w,c,'sight')<.2||!canSee(w,c,task.pos)||lightLevel(w,c.pos)>=2){task.reason='원본을 식별할 빛과 시력이 필요하다';return null}
 const tile=tileAt(w,task.pos),terrain=terrainAt(w,task.pos)
 if(tile.t!==task.terrain||!terrain.container){task.phase='failed';task.reason='마지막으로 알았던 용기가 현장에 없다';return null}
 if(!tile.cont?.opened){const n=channelTurns(w,c,searchBase(w,c,terrain.openTurns??1),{dexterous:false});if(n===null)return'몸 상태 때문에 용기를 수색할 수 없다';c.activity={kind:'search',target:{...task.pos},remaining:n,total:n,label:'맡긴 원본의 용기 수색',recoveryContract:task.id};return null}
 const item=tile.cont.items.find(i=>i.uid===task.itemUid&&i.def===task.item&&i.count===1)
 if(!item){task.phase='failed';task.reason='실제로 열어 본 원래 칸에 그 원본이 없다';return null}
 const shadow:World={db:w.db,s:{...w.s,nextId:w.s.nextId}}
 if(gridAdd(shadow,{items:structuredClone(c.bag),w:10,h:6},structuredClone({...item,gx:undefined,gy:undefined,rot:undefined}))){task.phase='failed';task.reason='원본을 담을 배낭 공간이 부족하다';return null}
 ageLooseGear(w,item,task.pos);tile.cont.items.splice(tile.cont.items.indexOf(item),1);delete item.gx;delete item.gy;delete item.rot;addToBag(w,c,item)
 c.recoveryCargo={id:task.id,uid:item.uid,item:item.def};task.phase='returning';task.reason=undefined;return null
}
function cargoQuote(w:World,c:Creature,automatic=false){
 const p=player(w),cargo=c.recoveryCargo,item=cargo&&c.bag.find(i=>i.uid===cargo.uid&&i.def===cargo.item&&i.count===1);let error=automatic?null:companionAccess(w,c)
 if(!error&&(!w.s.creatures.includes(c)||!c.alive||!p.alive||c.mapId!==undefined&&c.mapId!==w.s.map.id||p.mapId!==undefined&&p.mapId!==w.s.map.id||c.companion?.employer!==p.id||!cargo||!item))error='돌려받을 실제 회수 원본이 동료에게 없다'
 if(!error&&!automatic&&capacity(w,p,'manipulation')<.2)error='원본을 받을 손을 쓸 수 있어야 한다'
 if(!error&&([p,c].some(a=>a.asleep||a.unconscious||a.captivity||capacity(w,a,'consciousness')<.5||capacity(w,a,'hearing')<.2)||cheb(c.pos,p.pos)>1||!hasLos(w,c.pos,p.pos)||diagonalBlocked(w,c.pos,p.pos.x-c.pos.x,p.pos.y-c.pos.y)||!canSee(w,c,p.pos)||!canSee(w,p,c.pos)))error='서로 보고 들을 수 있게 깨어서 곁에 있어야 한다'
 if(!error){const shadow:World={db:w.db,s:{...w.s,nextId:w.s.nextId}};if(gridAdd(shadow,{items:structuredClone(p.bag),w:10,h:6},structuredClone({...item!,gx:undefined,gy:undefined,rot:undefined})))error='원본을 받을 내 배낭에 자리가 없다'}
 return{error,item}
}
export function collectRecoveryQuote(w:World,c:Creature){return cargoQuote(w,c)}
export function collectRecoveryCargo(w:World,c:Creature,automatic=false):string|null{
 const q=cargoQuote(w,c,automatic);if(q.error)return q.error
 const item=q.item!;c.bag.splice(c.bag.indexOf(item),1);delete item.gx;delete item.gy;delete item.rot;addToBag(w,player(w),item);c.recoveryCargo=undefined;c.companionRecovery=undefined;c.ai.path=undefined
 log(w,'good',`${c.name}에게서 맡겼던 같은 원본을 받았다. 납품 보수는 의뢰인에게 직접 보고해야 한다.`);return null
}
export function companionRecoveryReturn(w:World,c:Creature):string|null{
 const task=c.companionRecovery,error=actorError(w,c);if(error)return error
 if(!task)return'돌아와 보고할 회수 지시가 없다'
 if(task.phase==='failed'&&!c.recoveryCargo){const p=player(w);if(p.asleep||p.unconscious||capacity(w,p,'hearing')<.2||cheb(c.pos,p.pos)>1||!hasLos(w,c.pos,p.pos))return'돌아온 동료의 말을 들을 수 있어야 한다';log(w,'info',`${c.name}의 회수 보고: ${task.reason??'현장에서 원본을 가져오지 못했다'}.`);c.companionRecovery=undefined;return null}
 if(c.recoveryCargo&&!c.bag.some(i=>i.uid===c.recoveryCargo!.uid)){c.recoveryCargo=undefined;task.phase='failed';task.reason='운반하던 원본이 더 이상 내 배낭에 없다';return null}
 return collectRecoveryCargo(w,c,true)
}

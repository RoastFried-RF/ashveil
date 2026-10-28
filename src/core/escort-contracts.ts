// 의뢰인 자신을 실제로 안내한다. 원격 인물을 찾아 옮기거나 동료로 바꾸지 않는다.
import {hostileAware} from './action-time'
import {capacity} from './body'
import {contractAccess} from './contracts'
import {clamp,creatureAt,inBounds,log,player,terrainAt,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {ensureSociety,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb,DIRS} from './geom'
import {diagonalBlocked} from './path'
import type {ContractRecord,Creature,EscortContractDef,EscortContractRecord,PatrolContractDef} from './types'
export const escortContractDef=(w:World)=>w.db.get<EscortContractDef>('EscortContract.Hearth')
export const isEscortContract=(r:ContractRecord):r is EscortContractRecord=>r.kind==='escort'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isEscortContract)
export const activeEscort=(w:World,c:Creature)=>records(w).find(r=>r.status==='active'&&r.passenger===c.id&&turnOf(w)<r.deadline)
function present(w:World,c:Creature){return w.s.creatures.includes(c)&&(!c.mapId||c.mapId===w.s.map.id)&&c.alive&&inBounds(w,c.pos)}
function access(w:World,c:Creature,trader:Creature){
 if(c!==player(w)||!present(w,c)||!present(w,trader))return'같은 현장의 실제 자신과 의뢰인이 필요하다'
 const error=contractAccess(w,c,trader);if(error)return error
 if(marketFor(w,trader)?.mobile||trader.captivity||trader.companion||trader.rescue||trader.breakdown||trader.asleep||trader.unconscious||trader.roadRaid||trader.caravan||trader.ai.task||trader.ai.route?.length||trader.ai.target||capacity(w,trader,'moving')<.2||hostileAware(w,trader))return'안전하게 함께 걸을 수 있는 현지 의뢰인이 필요하다'
 return null
}
export function escortOffers(w:World,c:Creature,trader:Creature){
 if(access(w,c,trader))return[]
 const d=escortContractDef(w),m=w.s.overworld!,market=marketFor(w,trader)!,now=turnOf(w),epoch=Math.floor(now/(d.refreshDays*TURNS_PER_DAY))
 if(!Number.isSafeInteger(market.money)||market.money<d.baseReward||m.contracts?.some(r=>r.status==='active'&&(r.site===market.site||isEscortContract(r))))return[]
 return w.db.get<PatrolContractDef>(d.routeRules).routes.flatMap(route=>{
  const id=`escort:${market.site}:${epoch}:${route.key}`,anchor={x:route.anchor.pos[0],y:route.anchor.pos[1]}
  if(route.region!==m.currentRegion||route.mapId!==w.s.map.id||!w.s.map.settlementInitialized||!inBounds(w,anchor)||w.s.map.tiles[anchor.y*w.s.map.w+anchor.x].t!==route.anchor.terrain||route.points.some(p=>!inBounds(w,{x:p.pos[0],y:p.pos[1]}))||records(w).some(r=>r.id===id))return[]
  return[{id,template:route.key,label:`${route.label} 동행 호송`,region:route.region,mapId:route.mapId,passenger:trader.id,passengerName:trader.name,points:route.points.map(p=>({label:p.label,pos:{x:p.pos[0],y:p.pos[1]}})),reward:d.baseReward,reputation:d.reputation,deadlineTurns:d.deadlineDays*TURNS_PER_DAY}]
 })
}
export function acceptEscort(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const error=access(w,c,trader);if(error)return error
 const offer=escortOffers(w,c,trader).find(o=>o.id===id);if(!offer||expectedReward!==undefined&&expectedReward!==offer.reward)return'함께 걸을 실제 의뢰인과 예치 보수를 다시 확인해야 한다'
 const market=marketFor(w,trader)!,now=turnOf(w),record:EscortContractRecord={...offer,kind:'escort',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active',visits:[]}
 market.money-=record.escrow;(w.s.overworld!.contracts??=[]).push(record)
 c.history.push({turn:now,kind:'contract',text:`${record.issuer}의 동행 호송을 맡았다: ${record.label}.`});log(w,'info',`${record.issuer}과(와) 함께 경로를 확인하자. ${record.reward}${economyDef(w).currency}을(를) 장부에 맡겼다.`);return null
}
/** 자기 현장에서 실제로 보는 안내자만 따른다. 잃어버린 위치를 원격 추적하지 않는다. */
export function contractEscortGoal(w:World,c:Creature){
 const record=activeEscort(w,c);if(!record)return undefined
 const p=player(w),d=escortContractDef(w)
 if(record.region!==w.s.overworld?.currentRegion||record.mapId!==w.s.map.id||!present(w,c)||!present(w,p)||c.asleep||c.unconscious||c.captivity||c.companion||c.activity||c.breakdown||p.asleep||p.unconscious||p.captivity||capacity(w,c,'moving')<.2||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||capacity(w,p,'consciousness')<.5||hostileAware(w,c)||c.attackedBy?.includes(p.id)||p.attackedBy?.includes(c.id)||cheb(c.pos,p.pos)>d.maxFollowDistance||!canSee(w,c,p.pos)||!hasLos(w,c.pos,p.pos))return null
 const point=record.points[record.visits.length]
 if(point&&cheb(p.pos,point.pos)<=1&&cheb(c.pos,point.pos)>1){
  const places=[point.pos,...DIRS.map(o=>({x:point.pos.x+o.x,y:point.pos.y+o.y}))].filter(pos=>inBounds(w,pos)&&terrainAt(w,pos).passable&&cheb(pos,p.pos)<=1&&(!creatureAt(w,pos)||creatureAt(w,pos)===c)&&hasLos(w,pos,p.pos)&&!diagonalBlocked(w,pos,p.pos.x-pos.x,p.pos.y-pos.y)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
  return places[0]?{...places[0]}:null
 }
 return cheb(c.pos,p.pos)>d.followDistance?{...p.pos}:null
}
export function escortVisitQuote(w:World,c:Creature,id:string){
 const r=records(w).find(r=>r.id===id),point=r?.points[r.visits.length],passenger=r&&w.s.creatures.find(o=>o.id===r.passenger),now=turnOf(w),out={record:r,point,passenger,error:null as string|null}
 if(c!==player(w)||!present(w,c)||!r||r.status!=='active'||now<=r.accepted||now>=r.deadline||r.visits.length>0&&now<=r.visits.at(-1)!.at||!point||!passenger||!present(w,passenger)){out.error='수락 뒤 함께 확인할 다음 호송 지점과 원래 의뢰인이 필요하다';return out}
 if(r.region!==w.s.overworld?.currentRegion||r.mapId!==w.s.map.id||!inBounds(w,point.pos)||[c,passenger].some(a=>a.asleep||a.unconscious||a.activity||a.captivity||a.breakdown||capacity(w,a,'consciousness')<.5||capacity(w,a,'sight')<.2||capacity(w,a,'hearing')<.2||capacity(w,a,'manipulation')<.2||hostileAware(w,a))){out.error='같은 현장에서 안전하게 함께 확인할 몸과 시청각이 필요하다';return out}
 if(cheb(c.pos,passenger.pos)>1||!canSee(w,c,passenger.pos)||!canSee(w,passenger,c.pos)||!hasLos(w,c.pos,passenger.pos)||diagonalBlocked(w,c.pos,passenger.pos.x-c.pos.x,passenger.pos.y-c.pos.y)||c.attackedBy?.includes(passenger.id)||passenger.attackedBy?.includes(c.id)||[c,passenger].some(a=>cheb(a.pos,point.pos)>1||!hasLos(w,a.pos,point.pos)||!canSee(w,a,point.pos)||diagonalBlocked(w,a.pos,point.pos.x-a.pos.x,point.pos.y-a.pos.y)||lightLevel(w,a.pos)>=2)||lightLevel(w,point.pos)>=2)out.error='자신과 원래 의뢰인이 다음 지점 바로 곁에 함께 있어야 한다'
 return out
}
export function visitEscort(w:World,c:Creature,id:string):string|null{
 const q=escortVisitQuote(w,c,id);if(q.error)return q.error
 const r=q.record!;r.visits.push({at:turnOf(w),by:c.id,passenger:q.passenger!.id,index:r.visits.length,playerPos:{...c.pos},passengerPos:{...q.passenger!.pos}});log(w,'info',`${q.point!.label}: 의뢰인과 함께 확인 (${r.visits.length}/${r.points.length}).`);return null
}
export function escortReportQuote(w:World,c:Creature,trader:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,error:access(w,c,trader)},now=turnOf(w)
 if(out.error)return out
 if(!record||record.passenger!==trader.id||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'||record.region!==w.s.overworld?.currentRegion||record.mapId!==w.s.map.id||now>=record.deadline){out.error='함께 온 원래 의뢰인의 진행 중인 호송 계약이 필요하다';return out}
 if(record.visits.length!==record.points.length||record.visits.some((v,i)=>v.index!==i||v.by!==c.id||v.passenger!==trader.id||v.at<=record.accepted||v.at>=record.deadline||v.at>now||i>0&&v.at<=record.visits[i-1].at||cheb(v.playerPos,record.points[i].pos)>1||cheb(v.passengerPos,record.points[i].pos)>1||cheb(v.playerPos,v.passengerPos)>1)){out.error='두 사람이 모든 지점을 순서대로 함께 확인해야 한다';return out}
 if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow))out.error='예치 보수와 지갑 잔액을 확인해야 한다'
 return out
}
export function reportEscort(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const q=escortReportQuote(w,c,trader,id);if(q.error)return q.error
 const r=q.record!;if(expectedReward!==undefined&&expectedReward!==r.reward)return'호송 보수가 달라졌다'
 c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w)
 ensureSociety(w)!.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100)
 c.history.push({turn:turnOf(w),kind:'contract',text:`${r.issuer}과(와) 함께 모든 지점을 확인해 호송을 마쳤다.`});log(w,'good',`${r.label} 완료. 맡긴 ${r.reward}${economyDef(w).currency}을(를) 받았다.`);return null
}

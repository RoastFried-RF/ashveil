// 의뢰인이 알려 준 공개 경로를 실제로 순서대로 확인한다. 적이나 원격 현황을 조회하지 않는다.
import {capacity} from './body'
import {hostileAware} from './action-time'
import {contractAccess} from './contracts'
import {clamp,inBounds,log,player,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {ensureSociety,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {diagonalBlocked} from './path'
import type {ContractRecord,Creature,PatrolContractDef,PatrolContractRecord} from './types'
export const patrolContractDef=(w:World)=>w.db.get<PatrolContractDef>('PatrolContract.Hearth')
export const isPatrolContract=(r:ContractRecord):r is PatrolContractRecord=>r.kind==='patrol'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isPatrolContract)
function access(w:World,c:Creature,trader:Creature){
 if(c!==player(w)||!w.s.creatures.includes(c)||!w.s.creatures.includes(trader)||c.mapId&&c.mapId!==w.s.map.id||trader.mapId&&trader.mapId!==w.s.map.id)return'같은 현장의 실제 의뢰인과 자신의 장부를 확인해야 한다'
 return contractAccess(w,c,trader)
}
export function patrolOffers(w:World,c:Creature,trader:Creature){
 if(access(w,c,trader)||marketFor(w,trader)?.mobile)return[]
 const m=w.s.overworld!,market=marketFor(w,trader)!,d=patrolContractDef(w),now=turnOf(w),epoch=Math.floor(now/(d.refreshDays*TURNS_PER_DAY))
 if(!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===market.site&&r.status==='active'))return[]
 return d.routes.flatMap(route=>{
  const id=`patrol:${market.site}:${epoch}:${route.key}`,anchor={x:route.anchor.pos[0],y:route.anchor.pos[1]},reward=Math.ceil((d.baseReward+route.threat*d.threatReward)*d.wealthMult)
  if(route.region!==m.currentRegion||route.mapId!==w.s.map.id||!w.s.map.settlementInitialized||!inBounds(w,anchor)||w.s.map.tiles[anchor.y*w.s.map.w+anchor.x].t!==route.anchor.terrain||route.points.some(p=>!inBounds(w,{x:p.pos[0],y:p.pos[1]}))||records(w).some(r=>r.id===id)||!Number.isSafeInteger(reward)||reward<=0||market.money<reward)return[]
  return[{id,template:route.key,label:route.label,region:route.region,mapId:route.mapId,points:route.points.map(p=>({label:p.label,pos:{x:p.pos[0],y:p.pos[1]}})),reward,reputation:d.reputation,deadlineTurns:d.deadlineDays*TURNS_PER_DAY}]
 })
}
export function acceptPatrolContract(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const error=access(w,c,trader);if(error)return error
 const offer=patrolOffers(w,c,trader).find(o=>o.id===id);if(!offer||expectedReward!==undefined&&expectedReward!==offer.reward)return'순서대로 확인할 경로와 예치 보수를 다시 확인해야 한다'
 const market=marketFor(w,trader)!,now=turnOf(w),r:PatrolContractRecord={...offer,kind:'patrol',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active',visits:[]}
 market.money-=r.reward;(w.s.overworld!.contracts??=[]).push(r)
 c.history.push({turn:now,kind:'contract',text:`${trader.name}의 순찰 계약을 맡았다: ${r.label}.`});log(w,'info',`${r.label}. 알려 준 지점을 순서대로 직접 확인하고 돌아오자. ${r.reward}${economyDef(w).currency}을(를) 장부에 맡겼다.`);return null
}
export function patrolVisitQuote(w:World,c:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,point:record?.points[record.visits.length],error:null as string|null},now=turnOf(w)
 if(c!==player(w)||!w.s.creatures.includes(c)||c.mapId&&c.mapId!==w.s.map.id||!c.alive||!record||record.status!=='active'||now<=record.accepted||now>=record.deadline||record.visits.length>0&&now<=record.visits.at(-1)!.at||!out.point){out.error='수락 뒤 확인할 자신의 다음 순찰 지점이 없다';return out}
 if(c.asleep||c.unconscious||c.activity||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||capacity(w,c,'manipulation')<.2||hostileAware(w,c)){out.error='위협에서 벗어나 현장을 확인할 몸과 의식이 필요하다';return out}
 if(record.region!==w.s.overworld?.currentRegion||record.mapId!==w.s.map.id||!inBounds(w,out.point.pos)||cheb(c.pos,out.point.pos)>1||!canSee(w,c,out.point.pos)||!hasLos(w,c.pos,out.point.pos)||diagonalBlocked(w,c.pos,out.point.pos.x-c.pos.x,out.point.pos.y-c.pos.y)){out.error='경로의 다음 지점 바로 곁에서 확인해야 한다';return out}
 if(lightLevel(w,c.pos)>=2||lightLevel(w,out.point.pos)>=2)out.error='순찰 지점을 식별할 밝기가 필요하다'
 return out
}
export function visitPatrolContract(w:World,c:Creature,id:string):string|null{
 const q=patrolVisitQuote(w,c,id);if(q.error)return q.error
 const r=q.record!;r.visits.push({at:turnOf(w),by:c.id,index:r.visits.length,pos:{...c.pos}});log(w,'info',`${q.point!.label} 확인 (${r.visits.length}/${r.points.length}).`);return null
}
export function patrolReportQuote(w:World,c:Creature,trader:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,error:access(w,c,trader)},now=turnOf(w)
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'||now>=record.deadline){out.error='이 장부에 보고할 진행 중인 순찰 계약이 없다';return out}
 if(record.visits.length!==record.points.length||record.visits.some((v,i)=>v.index!==i||v.by!==c.id||v.at<=record.accepted||v.at>=record.deadline||v.at>now||i>0&&v.at<=record.visits[i-1].at||cheb(v.pos,record.points[i].pos)>1)){out.error='수락 뒤 모든 지점을 순서대로 직접 확인해야 한다';return out}
 if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow))out.error='예치 보수와 지갑 잔액을 확인해야 한다'
 return out
}
export function reportPatrolContract(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const q=patrolReportQuote(w,c,trader,id);if(q.error)return q.error
 const r=q.record!;if(expectedReward!==undefined&&expectedReward!==r.reward)return'순찰 보수가 달라졌다'
 c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w)
 ensureSociety(w)!.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100)
 c.history.push({turn:turnOf(w),kind:'contract',text:`${r.issuer}에게 순서대로 확인한 순찰을 보고했다: ${r.label}.`});log(w,'good',`${r.label} 보고 완료. 예치한 ${r.reward}${economyDef(w).currency}을(를) 받았다.`);return null
}

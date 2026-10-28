// 실제로 열어 식별한 용기의 원본 물품ID를 쓴다. 과거 원본/현재 위치를 추정하지 않는다.
import {contractAccess} from './contracts'
import {clamp,log,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {ensureSociety,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {worldRoute} from './overworld'
import type {ContractRecord,Creature,RecoveryContractDef,RecoveryContractRecord} from './types'
export const recoveryDef=(w:World)=>w.db.get<RecoveryContractDef>('RecoveryContract.Hearth')
export const isRecoveryContract=(r:ContractRecord):r is RecoveryContractRecord=>r.kind==='recover'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isRecoveryContract)
export interface RecoveryOffer {id:string;template:string;label:string;region:string;mapId:string;pos:{x:number;y:number};terrain:string;item:string;itemUid:number;observedAt:number;distance:number;reward:number;deadlineTurns:number;reputation:number;minDurability:number}
export function recoveryOffers(w:World,c:Creature,trader:Creature):RecoveryOffer[]{
 if(contractAccess(w,c,trader)||marketFor(w,trader)?.mobile)return[]
 const m=w.s.overworld!,market=marketFor(w,trader)!,site=m.sites.find(s=>s.id===market.site),d=recoveryDef(w),epoch=Math.floor(turnOf(w)/(d.refreshDays*TURNS_PER_DAY))
 if(!site||!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===site.id&&r.status==='active'))return[]
 return d.targets.flatMap(target=>{
  const scene=m.currentRegion===target.region?w.s:m.scenes[target.region],map=scene&&(scene.map.id===target.mapId?scene.map:scene.maps[target.mapId]),pos={x:target.pos[0],y:target.pos[1]},memory=map&&pos.x<map.w&&pos.y<map.h?map.tiles[pos.y*map.w+pos.x]?.observed?.contents:undefined
  if(!memory||memory.terrain!==target.terrain||memory.at>turnOf(w))return[]
  const item=memory.items.find(i=>i.def===target.item&&i.count===1&&Number.isSafeInteger(i.uid)&&i.uid>0)
  if(!item||records(w).some(r=>r.itemUid===item.uid&&(r.status==='completed'||r.status==='active'))||m.contracts?.some(r=>r.kind==='excavate'&&r.proof?.uid===item.uid&&(r.status==='active'||r.status==='completed')))return[]
  const id=`recover:${site.id}:${epoch}:${target.key}:${item.uid}`;if(records(w).some(r=>r.id===id))return[]
  const destination=m.sites.find(s=>s.id===target.region),route=destination&&worldRoute(w,site.cell,destination.cell);if(!destination||!route)return[]
  const distance=Math.abs(site.cell.x-destination.cell.x)+Math.abs(site.cell.y-destination.cell.y),reward=Math.ceil((d.baseReward+distance*d.distanceReward+target.threat*d.threatReward)*d.wealthMult)
  if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money)return[]
  return[{id,template:target.key,label:target.label,region:target.region,mapId:target.mapId,pos,terrain:target.terrain,item:target.item,itemUid:item.uid,observedAt:memory.at,distance,reward,deadlineTurns:Math.ceil(route.hours*2*TURNS_PER_HOUR+d.deadlineBufferDays*TURNS_PER_DAY),reputation:d.reputation,minDurability:d.minDurability}]
 })
}
export function acceptRecovery(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const error=contractAccess(w,c,trader);if(error)return error
 const offer=recoveryOffers(w,c,trader).find(o=>o.id===id);if(!offer)return'직접 확인한 원본 물품·보수·진행 중인 의뢰를 다시 확인해야 한다'
 if(expectedReward!==undefined&&expectedReward!==offer.reward)return'게시된 원본 회수 보수가 바뀌었다'
 const market=marketFor(w,trader)!,now=turnOf(w),record:RecoveryContractRecord={...offer,kind:'recover',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active'}
 market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record);c.history.push({turn:now,kind:'contract',text:`${trader.name}의 원본 회수 의뢰를 맡았다: ${record.label}.`});log(w,'info',`${record.label}. 실제로 확인한 그 원본을 가져와야 한다. 보수 ${record.reward}${economyDef(w).currency}은(는) 장부에 맡겼다.`);return null
}
export function recoveryQuote(w:World,c:Creature,trader:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,item:undefined as Creature['bag'][number]|undefined,error:contractAccess(w,c,trader)}
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'||turnOf(w)>=record.deadline){out.error='이 정착지에 납품할 진행 중인 원본 회수 의뢰가 없다';return out}
 const item=c.bag.find(i=>i.uid===record.itemUid)
 if(!item||item.def!==record.item||item.count!==1||(item.durability??100)<record.minDurability){out.error='실제로 확인한 같은 원본과 필요한 보존 상태를 배낭에서 확인해야 한다';return out}
 if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow)){out.error='맡긴 회수 보수와 지갑을 확인해야 한다';return out}
 out.item=item;return out
}
export function deliverRecovery(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const q=recoveryQuote(w,c,trader,id);if(q.error)return q.error
 const record=q.record!,item=q.item!,market=marketFor(w,trader)!;if(expectedReward!==undefined&&record.reward!==expectedReward)return'원본 회수 보수가 바뀌었다'
 c.bag.splice(c.bag.indexOf(item),1);delete item.gx;delete item.gy;delete item.rot;market.items.push(item)
 c.money=(c.money??0)+record.escrow;record.escrow=0;record.status='completed';record.closed=turnOf(w);record.recipient={at:turnOf(w),uid:item.uid,def:item.def}
 const society=ensureSociety(w)!;society.reputation[record.faction]=clamp(reputation(w,record.faction)+record.reputation,-100,100)
 c.history.push({turn:turnOf(w),kind:'contract',text:`${record.issuer}에게 확인했던 같은 원본을 넘겼다: ${record.label}.`});log(w,'good',`${record.label} 납품 완료. 같은 원본을 장부에 넘기고 예치 보수 ${record.reward}${economyDef(w).currency}을(를) 받았다. 평판 +${record.reputation}.`);return null
}

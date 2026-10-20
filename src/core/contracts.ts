// 실제 시장의 부족분만 게시한다. 보수는 수락 때 시장 지갑에서 예치하며 물품/돈은 복제하지 않는다.
import { capacity } from './body'
import { hostileAware } from './action-time'
import { clamp, log, player, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { ensureSociety, reputation } from './diplomacy'
import { economyDef, marketFor, stockCount, tradeAccess, type TradeLine } from './economy'
import { foodFreshness } from './food-state'
import { diagonalBlocked } from './path'
import type { Creature, ItemInst, ContractRecord, ContractLedger, SupplyContract, SupplyContractDef, TraderStockDef } from './types'
export const supplyContractDef=(w:World)=>w.db.get<SupplyContractDef>('SupplyContract.Hearth')
export const isSupplyContract=(r:ContractRecord):r is SupplyContract=>!r.kind||r.kind==='supply'
const records=(w:World)=>w.s.overworld?.contracts??[]
export function contractAccess(w:World,c:Creature,trader:Creature):string|null{
  if(c.id!==w.s.playerId)return '자신의 계약만 처리할 수 있다'
  const e=tradeAccess(w,c,trader);if(e)return e
  if(c.asleep||c.activity||trader.activity)return '하던 일을 마친 뒤 계약을 확인해야 한다'
  if([c,trader].some((actor)=>capacity(w,actor,'consciousness')<.5||capacity(w,actor,'manipulation')<.2||capacity(w,actor,'hearing')<.2||capacity(w,actor,'sight')<.2))return '장부를 확인할 손과 시청각이 필요하다'
  if(diagonalBlocked(w,c.pos,trader.pos.x-c.pos.x,trader.pos.y-c.pos.y))return '막힌 모서리 너머로 장부를 건넬 수 없다'
  if(hostileAware(w,c))return '위협에서 벗어난 뒤 계약을 확인해야 한다'
  if(trader.traderSite!==w.s.overworld?.currentRegion)return '이 정착지의 장부를 확인해야 한다'
  return null
}
export interface SupplyOffer {id:string;template:string;label:string;item:string;count:number;reward:number;deadlineTurns:number;freshness:number;durability:number;reputation:number}
export function supplyOffers(w:World,c:Creature,trader:Creature):SupplyOffer[]{
  if(marketFor(w,trader)?.mobile)return []
  if(contractAccess(w,c,trader))return []
  const market=marketFor(w,trader)!,d=supplyContractDef(w),epoch=Math.floor(turnOf(w)/(d.refreshDays*TURNS_PER_DAY)),old=records(w)
  if(old.some((r)=>r.site===market.site&&r.status==='active'&&turnOf(w)<r.deadline))return []
  const stock=w.db.get<TraderStockDef>(market.stockDef)
  return d.requests.flatMap((request)=>{
    const id=`${market.site}:${epoch}:${request.key}`,entry=stock.entries.find((e)=>e.item===request.item),shortage=(entry?.target??0)-stockCount(market,request.item),reward=Math.ceil((d.baseReward+request.threat*d.threatReward)*d.wealthMult)
    if(!Number.isSafeInteger(market.money)||shortage<request.count||market.money<reward||old.some((r)=>r.id===id)||!Number.isSafeInteger(reward)||reward<=0)return []
    return [{id,template:request.key,label:request.label,item:request.item,count:request.count,reward,deadlineTurns:d.deadlineDays*TURNS_PER_DAY,freshness:d.freshness,durability:d.durability,reputation:d.reputation}]
  })
}
export function acceptSupply(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
  const error=contractAccess(w,c,trader);if(error)return error
  if(records(w).some((r)=>r.site===trader.traderSite&&r.status==='active'))return '이 정착지의 진행 중인 계약을 먼저 마쳐야 한다'
  const offer=supplyOffers(w,c,trader).find((o)=>o.id===id)
  if(!offer)return '계약의 부족 재고나 보수를 다시 확인해야 한다'
  if(expectedReward!==undefined&&expectedReward!==offer.reward)return '게시된 보수가 바뀌었다'
  const market=marketFor(w,trader)!,now=turnOf(w),record:SupplyContract={...offer,site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active'}
  market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record)
  c.history.push({turn:now,kind:'contract',text:`${trader.name}의 조달 계약을 맡았다: ${offer.label}.`});log(w,'info',`${offer.label}: ${w.db.item(offer.item).label} ${offer.count}개를 ${dDays(w)}일 안에 가져오면 ${offer.reward}${economyDef(w).currency}. 보수는 장부에 맡겨 두었다.`)
  return null
}
const dDays=(w:World)=>supplyContractDef(w).deadlineDays
function eligible(w:World,it:ItemInst,r:SupplyContract){
  return it.def===r.item&&Number.isSafeInteger(it.count)&&it.count>0&&(it.durability??100)>=r.durability&&(!w.db.item(it.def).food||foodFreshness(it)>=r.freshness)&&!it.pillRemaining&&!it.foodLeftover&&!it.water&&!it.waterFrozen
}
/** 기본 선택은 배낭 순서대로다. 조회는 물품/UID/난수/원장을 쓰지 않는다. */
export function supplyDelivery(w:World,c:Creature,r:SupplyContract):TradeLine[]{
  let left=r.count;const lines:TradeLine[]=[]
  for(const it of c.bag){if(left<=0)break;if(!eligible(w,it,r))continue;const count=Math.min(left,it.count);lines.push({uid:it.uid,count});left-=count}
  return lines
}
export function supplyQuote(w:World,c:Creature,trader:Creature,id:string,lines:TradeLine[]){
  const record=records(w).find((r):r is SupplyContract=>isSupplyContract(r)&&r.id===id),result={error:contractAccess(w,c,trader),record,delivered:0}
  if(result.error)return result
  if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'){result.error='진행 중인 이 정착지의 계약이 아니다';return result}
  if(turnOf(w)>=record.deadline){result.error='계약 기한이 지났다';return result}
  if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow)){result.error='맡긴 보수와 지갑을 확인할 수 없다';return result}
  const seen=new Set<number>()
  for(const line of lines){const it=c.bag.find((i)=>i.uid===line.uid)
    if(!it||seen.has(line.uid)||!Number.isSafeInteger(line.count)||line.count<=0||line.count>it.count||!eligible(w,it,record)){result.error='납품할 실제 물품·수량·상태를 확인해야 한다';return result}
    seen.add(line.uid);result.delivered+=line.count
  }
  if(result.delivered!==record.count)result.error=`${w.db.item(record.item).label} ${record.count}개가 필요하다`
  return result
}
export function deliverSupply(w:World,c:Creature,trader:Creature,id:string,lines:TradeLine[],expectedReward?:number):string|null{
  const q=supplyQuote(w,c,trader,id,lines);if(q.error)return q.error
  const r=q.record!,market=marketFor(w,trader)!
  if(expectedReward!==undefined&&expectedReward!==r.reward)return '계약 보수가 달라졌다'
  // 모든 검증 뒤 한 번에 이전한다. 더미 일부만 넘길 때에만 새 UID 하나를 쓴다.
  const delivered:ItemInst[]=[]
  for(const line of lines){const it=c.bag.find((i)=>i.uid===line.uid)!
    if(line.count===it.count){c.bag.splice(c.bag.indexOf(it),1);delivered.push(it)}
    else{it.count-=line.count;delivered.push({...it,count:line.count,uid:w.s.nextId++})}
  }
  for(const it of delivered){delete it.gx;delete it.gy;delete it.rot;market.items.push(it)}
  c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w)
  const society=ensureSociety(w)!
  society.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100)
  c.history.push({turn:turnOf(w),kind:'contract',text:`${r.issuer}의 조달 계약을 마쳤다: ${r.label}.`});log(w,'good',`${r.label} 납품 완료. 맡겨 둔 ${r.reward}${economyDef(w).currency}을(를) 받았다. 평판 +${r.reputation}.`)
  return null
}
export function closeContract(w:World,r:ContractLedger,status:'cancelled'|'expired'){
  const market=w.s.overworld?.markets?.[r.site]
  if(!market||!Number.isSafeInteger(market.money)||market.money<0||!Number.isSafeInteger(r.escrow)||r.escrow<0||!Number.isSafeInteger(market.money+r.escrow))return false
  market.money+=r.escrow;r.escrow=0;r.status=status;r.closed=turnOf(w)
  log(w,'info',`${r.label}: ${status==='expired'?'기한이 지나':'계약을 취소해'} 맡긴 보수가 시장 장부로 돌아갔다.`);return true
}
export function cancelSupply(w:World,c:Creature,trader:Creature,id:string):string|null{
  const error=contractAccess(w,c,trader);if(error)return error
  const r=records(w).find((r)=>r.id===id&&r.site===trader.traderSite&&r.faction===trader.faction&&r.status==='active')
  if(!r)return '취소할 진행 중인 계약이 없다'
  return closeContract(w,r,turnOf(w)>=r.deadline?'expired':'cancelled')?null:'맡긴 보수를 돌려놓을 장부를 확인해야 한다'
}
export function contractsTick(w:World){
  for(const r of records(w))if(r.status==='active'&&(turnOf(w)>=r.deadline||!player(w).alive))closeContract(w,r,player(w).alive?'expired':'cancelled')
}

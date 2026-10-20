// 직접 목격한 같은 포박 인물을 해방하고 실제로 돌아온 사람을 장부 곁에서 확인한다.
import {contractAccess} from './contracts'
import {channelTurns,hostileAware} from './action-time'
import {capacity} from './body'
import {clamp,log,player,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {ensureSociety,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {worldRoute} from './overworld'
import {allItems} from './items'
import {diagonalBlocked} from './path'
import {prisonerSightings} from './prisoner-memory'
import type {ContractRecord,Creature,RescueContractDef,RescueContractRecord,RescueRemainsDef} from './types'
export const rescueRemainsDef=(w:World)=>w.db.get<RescueRemainsDef>('RescueRemains.Hearth')
export const rescueContractDef=(w:World)=>w.db.get<RescueContractDef>('RescueContract.Hearth')
export const isRescueContract=(r:ContractRecord):r is RescueContractRecord=>r.kind==='rescue'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isRescueContract)
function rescueAccess(w:World,c:Creature,trader:Creature):string|null{
 if(c!==player(w)||!w.s.creatures.includes(trader)||[c,trader].some(p=>p.mapId!==undefined&&p.mapId!==w.s.map.id))return'같은 현장의 실제 두 사람이 구조 장부를 확인해야 한다'
 if(c.captivity||trader.captivity||!canSee(w,c,trader.pos)||!canSee(w,trader,c.pos))return'포박에서 벗어나 서로를 식별한 뒤 구조 장부를 확인해야 한다'
 return contractAccess(w,c,trader)
}
export interface RescueOffer {witness?:{at:number;fromId:number;fromName:string;kind?:'interrogation'};id:string;label:string;person:number;name:string;region:string;mapId:string;mapName:string;pos:{x:number;y:number};ropeUid:number;observedAt:number;distance:number;reward:number;deadlineTurns:number;reputation:number}
export function rescueOffers(w:World,c:Creature,trader:Creature):RescueOffer[]{
 if(rescueAccess(w,c,trader)||marketFor(w,trader)?.mobile)return[]
 const m=w.s.overworld!,market=marketFor(w,trader)!,site=m.sites.find(s=>s.id===market.site),d=rescueContractDef(w),now=turnOf(w),epoch=Math.floor(now/(d.refreshDays*TURNS_PER_DAY))
 if(!site||!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===site.id&&r.status==='active'))return[]
 return prisonerSightings(w).flatMap(r=>{
  if(r.state!=='bound'||r.faction!==trader.faction||!r.region||r.at>now||!r.lastCapture||records(w).some(old=>old.person===r.id&&(old.status==='active'||old.status==='completed')))return[]
  const id=`rescue:${site.id}:${epoch}:${r.id}:${r.lastCapture.ropeUid}`;if(records(w).some(old=>old.id===id))return[]
  const destination=m.sites.find(s=>s.id===r.region),route=destination&&worldRoute(w,site.cell,destination.cell);if(!destination||!route)return[]
  const distance=Math.abs(site.cell.x-destination.cell.x)+Math.abs(site.cell.y-destination.cell.y),reward=Math.ceil((d.baseReward+distance*d.distanceReward+d.threat*d.threatReward)*d.wealthMult)
  if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money)return[]
  return[{...(r.heard?{witness:{...r.heard}}:{}),id,label:`${r.name} 구조`,person:r.id,name:r.name,region:r.region,mapId:r.mapId,mapName:r.mapName,pos:{...r.pos},ropeUid:r.lastCapture.ropeUid,observedAt:r.at,distance,reward,deadlineTurns:Math.ceil(route.hours*2*TURNS_PER_HOUR+d.deadlineBufferDays*TURNS_PER_DAY),reputation:d.reputation}]
 })
}
export function acceptRescue(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 if(c!==player(w))return'실제 자신의 구조 의뢰만 맡을 수 있다'
 const error=rescueAccess(w,c,trader);if(error)return error
 const offer=rescueOffers(w,c,trader).find(o=>o.id===id);if(!offer)return'알려진 마지막 목격의 같은 포박 인물과 보수·진행 중인 의뢰를 다시 확인해야 한다'
 if(expectedReward!==undefined&&expectedReward!==offer.reward)return'게시된 구조 보수가 바뀌었다'
 const market=marketFor(w,trader)!,now=turnOf(w),record:RescueContractRecord={...offer,kind:'rescue',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active'}
 market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record);c.history.push({turn:now,kind:'contract',text:`${trader.name}의 구조 의뢰를 맡았다: ${record.name}.`});log(w,'info',`${record.label}. 같은 사람을 실제로 해방하고 이 장부 곁까지 돌아와야 한다. 보수 ${record.reward}${economyDef(w).currency}은(는) 장부에 맡겼다.`);return null
}
/** 실제 플레이어의 원래 밧줄 해방 완료에서만 증거를 기록한다. */
export function recordContractRescue(w:World,actor:Creature,target:Creature,ropeUid:number,saved:boolean){
 if(!saved||actor!==player(w)||!actor.alive||!w.s.creatures.includes(target)||!target.alive||target.captivity||[actor,target].some(c=>c.mapId!==undefined&&c.mapId!==w.s.map.id))return
 const now=turnOf(w),region=w.s.overworld?.currentRegion
 for(const r of records(w))if(r.status==='active'&&now>r.accepted&&now<r.deadline&&r.person===target.id&&r.ropeUid===ropeUid&&r.region===region&&r.mapId===w.s.map.id&&!r.proof)r.proof={at:now,by:actor.id,ropeUid}
}
export function rescueReportQuote(w:World,c:Creature,trader:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,person:undefined as Creature|undefined,item:undefined as Creature['bag'][number]|undefined,error:rescueAccess(w,c,trader)}
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'||turnOf(w)>=record.deadline){out.error='이 정착지에 보고할 진행 중인 구조 의뢰가 없다';return out}
 if(record.relic){
  const item=c.bag.find(i=>i.uid===record.relic!.uid)
  if(!item||item.def!==record.relic.def||item.count!==1||(item.durability??100)<rescueRemainsDef(w).minDurability){out.error='현장 시신에서 직접 식별한 같은 원래 유품을 배낭에 가져와야 한다';return out}
  out.item=item
 }else{
 if(!record.proof||record.proof.by!==c.id||record.proof.at<=record.accepted||record.proof.ropeUid!==record.ropeUid){out.error='맡은 뒤 그때의 포박을 실제로 해방해야 한다';return out}
 const person=w.s.creatures.find(p=>p.id===record.person)
 // 이 장부 곁의 같은 사람만 본다. 다른 지역/층의 명부를 뒤져 생사를 알려 주지 않는다.
 if(!person||person.mapId!==undefined&&person.mapId!==w.s.map.id||!person.alive||person.captivity||cheb(person.pos,trader.pos)>3||!hasLos(w,trader.pos,person.pos)||!canSee(w,trader,person.pos)||!hasLos(w,c.pos,person.pos)||!canSee(w,c,person.pos)){out.error='구조한 같은 사람이 살아서 이 장부 곁에 돌아와야 한다';return out}
 out.person=person
 }
 if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow)){out.error='맡긴 구조 보수와 지갑을 확인해야 한다';return out}
 return out
}
export function reportRescue(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const q=rescueReportQuote(w,c,trader,id);if(q.error)return q.error
 const r=q.record!;if(expectedReward!==undefined&&expectedReward!==r.reward)return'구조 보수가 바뀌었다'
 if(q.item){const item=q.item;c.bag.splice(c.bag.indexOf(item),1);delete item.gx;delete item.gy;delete item.rot;marketFor(w,trader)!.items.push(item);r.relicRecipient={at:turnOf(w),uid:item.uid,def:item.def}}
 else r.returned={at:turnOf(w),person:q.person!.id,region:w.s.overworld!.currentRegion!,mapId:w.s.map.id}
 c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w)
 const society=ensureSociety(w)!;society.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100)
 c.history.push({turn:turnOf(w),kind:'contract',text:q.item?`${r.name}의 시신에서 식별한 같은 원래 유품을 장부에 넘겼다.`:`${r.name}의 실제 귀환을 장부 곁에서 확인했다.`});log(w,'good',`${r.label} 완료. ${q.item?'직접 식별한 원래 유품을 넘기고':'같은 사람의 귀환을 확인하고'} 예치 보수 ${r.reward}${economyDef(w).currency}을(를) 받았다. 평판 +${r.reputation}.`);return null
}
export function rescueRemainsQuote(w:World,c:Creature,id:string){
 const record=records(w).find(r=>r.id===id),turns=channelTurns(w,c,rescueRemainsDef(w).surveyTurns,{dexterous:false}),out={record,item:undefined as Creature['bag'][number]|undefined,turns,error:null as string|null}
 if(c!==player(w)||!c.alive||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||c.captivity||c.asleep||c.unconscious||c.activity||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||turns===null||hostileAware(w,c)){out.error='깨어서 위협을 벗어난 실제 자신의 손과 눈으로 유품을 확인해야 한다';return out}
 if(!record||record.status!=='active'||turnOf(w)>=record.deadline||record.relic||record.region!==w.s.overworld?.currentRegion||record.mapId!==w.s.map.id){out.error='아직 현장 유품으로 바꾸지 않은 이곳의 구조 의뢰가 필요하다';return out}
 const person=w.s.creatures.find(p=>p.id===record.person),memory=w.s.knowledge.prisonerSightings?.[record.person]
 if(!person||person.alive||person.mapId!==undefined&&person.mapId!==w.s.map.id||memory?.state!=='dead'||memory.lastCapture?.ropeUid!==record.ropeUid||cheb(c.pos,person.pos)>1||!hasLos(w,c.pos,person.pos)||!canSee(w,c,person.pos)||lightLevel(w,person.pos)>=2||diagonalBlocked(w,c.pos,person.pos.x-c.pos.x,person.pos.y-c.pos.y)){out.error='같은 인물의 시신을 실제로 식별하고 곁에서 확인해야 한다';return out}
 if(!person.searched||w.s.loot?.kind!=='corpse'||w.s.loot.id!==person.id){out.error='먼저 그 시신의 실제 수색을 마치고 소지품을 열어야 한다';return out}
 const item=allItems(person).find(i=>i.count===1&&!w.db.item(i.def).stackable&&!w.db.item(i.def).unidentified&&(i.durability??100)>=rescueRemainsDef(w).minDurability&&!w.s.overworld?.contracts?.some(r=>r.status!=='cancelled'&&r.status!=='expired'&&(r.kind==='recover'&&r.itemUid===i.uid||isRescueContract(r)&&r.relic?.uid===i.uid)))
 if(!item){out.error='수색한 시신에 다른 의뢰와 겹치지 않는 식별 가능한 원래 유품이 없다';return out}
 out.item=item;return out
}
export function surveyRescueRemains(w:World,c:Creature,id:string):string|null{
 const q=rescueRemainsQuote(w,c,id);if(q.error)return q.error
 const r=q.record!,item=q.item!;r.relic={at:turnOf(w),uid:item.uid,def:item.def};log(w,'warn',`${r.name}의 시신을 직접 확인했다. 실제 수색한 원래 유품을 가져와야 한다. 물품과 보수는 아직 옮기지 않았다.`);return null
}

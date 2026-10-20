// 직접 관찰한 원래 기구만 의뢰한다. 현재 인구/원격 기구 상태는 게시 정보로 쓰지 않는다.
import {capacity} from './body'
import {hostileAware} from './action-time'
import {closeContract,contractAccess} from './contracts'
import {clamp,inBounds,log,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {ensureSociety,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {worldRoute} from './overworld'
import {diagonalBlocked} from './path'
import type {ContractRecord,Creature,SourceContractDef,SourceContractRecord} from './types'
export const sourceContractDef=(w:World)=>w.db.get<SourceContractDef>('SourceContract.Hearth')
export const isSourceContract=(r:ContractRecord):r is SourceContractRecord=>r.kind==='sealSource'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isSourceContract)
export interface SourceOffer {id:string;template:string;label:string;region:string;mapId:string;source:string;device:string;deviceUid:number;operation:string;pos:{x:number;y:number};distance:number;reward:number;deadlineTurns:number;reputation:number}
export function sourceOffers(w:World,c:Creature,trader:Creature):SourceOffer[]{
 if(contractAccess(w,c,trader)||marketFor(w,trader)?.mobile)return[]
 const m=w.s.overworld!,market=marketFor(w,trader)!,site=m.sites.find(s=>s.id===market.site),d=sourceContractDef(w),epoch=Math.floor(turnOf(w)/(d.refreshDays*TURNS_PER_DAY))
 if(!site||!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===market.site&&r.status==='active'))return[]
 return d.targets.flatMap(target=>{
  const scene=m.currentRegion===target.region?w.s:m.scenes[target.region],map=scene&&(scene.map.id===target.mapId?scene.map:scene.maps[target.mapId]),pos=map?.waypoints?.[target.waypoint],observation=map&&pos&&map.tiles[pos.y*map.w+pos.x]?.observed,device=observation?.device,id=`sealSource:${site.id}:${epoch}:${target.key}:${target.region}:${target.mapId}`
  if(!map||!pos||!device||device.def!==target.device||!Number.isSafeInteger(device.uid)||device.uid===0||observation!.at>turnOf(w)||device.completed.includes(target.operation)||records(w).some(r=>r.id===id||r.region===target.region&&r.mapId===target.mapId&&r.source===target.source&&r.status==='completed'))return[]
  const destination=m.sites.find(s=>s.id===target.region),route=destination&&worldRoute(w,site.cell,destination.cell);if(!destination||!route)return[]
  const distance=Math.abs(site.cell.x-destination.cell.x)+Math.abs(site.cell.y-destination.cell.y),reward=Math.ceil((d.baseReward+distance*d.distanceReward+target.threat*d.threatReward)*d.wealthMult)
  if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money)return[]
  return[{id,template:target.key,label:target.label,region:target.region,mapId:target.mapId,source:target.source,device:target.device,deviceUid:device.uid,operation:target.operation,pos:{...pos},distance,reward,deadlineTurns:Math.ceil(route.hours*2*TURNS_PER_HOUR+d.deadlineBufferDays*TURNS_PER_DAY),reputation:d.reputation}]
 })
}
export function acceptSourceContract(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const error=contractAccess(w,c,trader);if(error)return error
 const offer=sourceOffers(w,c,trader).find(o=>o.id===id);if(!offer)return'직접 본 기구·보수·진행 중인 의뢰를 다시 확인해야 한다'
 if(expectedReward!==undefined&&offer.reward!==expectedReward)return'게시된 봉쇄 보수가 바뀌었다'
 const market=marketFor(w,trader)!,now=turnOf(w),record:SourceContractRecord={...offer,kind:'sealSource',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active'}
 market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record)
 c.history.push({turn:now,kind:'contract',text:`${trader.name}의 관로 봉쇄 의뢰를 맡았다: ${record.label}.`});log(w,'info',`${record.label}. 수락 뒤 원래 기구에서 실제 봉쇄를 마친 뒤 돌아오자. ${record.reward}${economyDef(w).currency}은(는) 시장 장부에 맡겼다.`);return null
}
/** 실제 완료 경로에서만 호출한다. 원래 기구·공급원의 새 봉쇄 기록을 대조한다. */
export function recordSourceContractWork(w:World,c:Creature,pos:{x:number;y:number},uid:number,operation:string){
 if(c.id!==w.s.playerId||!c.alive||!w.s.creatures.includes(c)||!inBounds(w,pos))return
 const tile=w.s.map.tiles[pos.y*w.s.map.w+pos.x],device=tile.device,now=turnOf(w)
 if(!device||device.uid!==uid||!device.completed.includes(operation))return
 for(const r of records(w)){
  if(r.status!=='active'||r.proof||now<=r.accepted||now>=r.deadline||r.region!==w.s.overworld?.currentRegion||r.mapId!==w.s.map.id||r.deviceUid!==uid||r.device!==device.def||r.operation!==operation||r.pos.x!==pos.x||r.pos.y!==pos.y)continue
  const closed=w.s.sources?.find(source=>source.id===r.source)?.closed
  if(!closed||closed.deviceUid!==uid||closed.by!==c.id||closed.mapId!==r.mapId||closed.at!==now)continue
  r.proof={at:now,by:c.id,deviceUid:uid,result:'sealed'};log(w,'good','수락 뒤 실제 완료한 관로 봉쇄를 의뢰 장부에 기록했다.')
 }
}
export function sourceSurveyQuote(w:World,c:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,closed:undefined as SourceContractRecord['proof'],error:null as string|null},now=turnOf(w)
 if(c.id!==w.s.playerId||!c.alive||!record||record.status!=='active'||now>=record.deadline||record.proof){out.error='현장에서 확인할 진행 중인 자신의 봉쇄 의뢰가 없다';return out}
 if(!w.s.creatures.includes(c)||c.asleep||c.unconscious||c.activity||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||capacity(w,c,'manipulation')<.2||hostileAware(w,c)){out.error='위협에서 벗어나 현장을 살필 몸과 의식이 필요하다';return out}
 if(w.s.overworld?.currentRegion!==record.region||w.s.map.id!==record.mapId||!inBounds(w,record.pos)||cheb(c.pos,record.pos)>1||!canSee(w,c,record.pos)||!hasLos(w,c.pos,record.pos)||diagonalBlocked(w,c.pos,record.pos.x-c.pos.x,record.pos.y-c.pos.y)){out.error='계약에 적힌 실제 기구 곁에서 확인해야 한다';return out}
 if(lightLevel(w,c.pos)>=2){out.error='현장 기록을 식별할 밝기가 필요하다';return out}
 const device=w.s.map.tiles[record.pos.y*w.s.map.w+record.pos.x].device,closed=w.s.sources?.find(source=>source.id===record.source)?.closed
 if(!device||device.uid!==record.deviceUid||device.def!==record.device||!device.completed.includes(record.operation)||!closed||closed.deviceUid!==record.deviceUid||closed.mapId!==record.mapId||closed.at>now){out.error='아직 원래 기구의 완료된 봉쇄를 확인할 수 없다';return out}
 out.closed={at:closed.at,by:closed.by,deviceUid:closed.deviceUid,result:closed.by===c.id&&closed.at>record.accepted?'sealed':'alreadyClosed'};return out
}
export function surveySourceContract(w:World,c:Creature,id:string):string|null{
 const q=sourceSurveyQuote(w,c,id);if(q.error)return q.error
 q.record!.proof=q.closed!;log(w,'info',q.closed!.result==='sealed'?'수락 뒤 직접 완료한 원래 기구의 봉쇄 기록을 확인했다.':'수락 전이거나 다른 이가 끝낸 봉쇄를 현장에서 확인했다. 새 작업 보수로 받지 않고 장부에 반환 보고할 수 있다.');return null
}
export function sourceReportQuote(w:World,c:Creature,trader:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,error:contractAccess(w,c,trader)}
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'||turnOf(w)>=record.deadline){out.error='이 정착지에 보고할 진행 중인 봉쇄 의뢰가 없다';return out}
 if(!record.proof){out.error='수락 뒤 직접 봉쇄를 마치거나 원래 현장의 이전 완료 기록을 확인해야 한다';return out}
 const refund=record.proof.result==='alreadyClosed',market=marketFor(w,trader)!
 if(record.proof.deviceUid!==record.deviceUid||record.proof.at>turnOf(w)||!refund&&(record.proof.by!==c.id||record.proof.at<=record.accepted)){out.error='원래 기구의 실제 작업 기록이 맞지 않는다';return out}
 if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!refund&&!Number.isSafeInteger((c.money??0)+record.escrow)||refund&&(!Number.isSafeInteger(market.money)||market.money<0||!Number.isSafeInteger(market.money+record.escrow)))out.error='맡긴 보수와 지급·반환할 장부 잔액을 확인해야 한다'
 return out
}
export function reportSourceContract(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const q=sourceReportQuote(w,c,trader,id);if(q.error)return q.error
 const r=q.record!;if(expectedReward!==undefined&&expectedReward!==r.reward)return'봉쇄 보수가 바뀌었다'
 if(r.proof!.result==='alreadyClosed')return closeContract(w,r,'cancelled')?null:'맡긴 보수를 돌려놓을 장부를 확인해야 한다'
 c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w)
 const society=ensureSociety(w)!;society.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100)
 c.history.push({turn:turnOf(w),kind:'contract',text:`${r.issuer}에게 직접 완료한 관로 봉쇄를 보고했다: ${r.label}.`});log(w,'good',`${r.label} 보고 완료. 예치한 ${r.reward}${economyDef(w).currency}을(를) 받았다. 평판 +${r.reputation}.`);return null
}

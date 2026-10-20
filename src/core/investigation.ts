// 소문에서 얻은 위치만 의뢰한다. 증거는 해당 지역의 실제 탐색을 마치고 현장에서 조사해야 남는다.
import { capacity } from './body'
import { hostileAware } from './action-time'
import { contractAccess } from './contracts'
import { clamp, log, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { ensureSociety, reputation } from './diplomacy'
import { economyDef, marketFor } from './economy'
import { lightLevel } from './fov'
import { worldRoute } from './overworld'
import type { ContractRecord, Creature, InvestigationContract, InvestigationDef, Rumor } from './types'
export const investigationDef=(w:World)=>w.db.get<InvestigationDef>('Investigation.Hearth')
export const isInvestigation=(r:ContractRecord):r is InvestigationContract=>r.kind==='investigate'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isInvestigation)
function knownRoom(r:Rumor){
  const rect=r.rect
  return r.kind==='room'&&!!r.mapId&&Number.isSafeInteger(r.roomIdx)&&r.roomIdx!>=0&&!!r.roomName&&!!rect&&[rect.x,rect.y,rect.w,rect.h].every(Number.isSafeInteger)&&rect.x>=0&&rect.y>=0&&rect.w>=3&&rect.h>=3&&Number.isSafeInteger(r.mapW)&&Number.isSafeInteger(r.mapH)&&rect.x+rect.w<=r.mapW!&&rect.y+rect.h<=r.mapH!
}
export interface InvestigationOffer {
  id:string;label:string;rumor:string;region:string;mapId:string;roomIdx:number;roomName:string
  rect:{x:number;y:number;w:number;h:number};distance:number;travelHours:number;reward:number;deadlineTurns:number;reputation:number
}
export function investigationOffers(w:World,c:Creature,trader:Creature):InvestigationOffer[]{
  if(marketFor(w,trader)?.mobile)return []
  if(contractAccess(w,c,trader))return []
  const m=w.s.overworld!,market=marketFor(w,trader)!,site=m.sites.find((s)=>s.id===market.site),d=investigationDef(w),old=records(w),epoch=Math.floor(turnOf(w)/(d.refreshDays*TURNS_PER_DAY))
  if(!site||!Number.isSafeInteger(market.money)||m.contracts?.some((r)=>r.site===site.id&&r.status==='active'))return []
  const offers:InvestigationOffer[]=[]
  for(const rumor of w.s.knowledge.rumors??[]){
    if(!knownRoom(rumor))continue
    const region=rumor.regionId??'Region.GreyCloister',target=m.sites.find((s)=>s.id===region),key=`${region}:${rumor.mapId}:${rumor.roomIdx}:${rumor.id}`,id=`investigate:${site.id}:${epoch}:${key}`
    if(!target||old.some((r)=>r.id===id||r.rumor===key&&r.status==='completed'))continue
    const route=worldRoute(w,site.cell,target.cell)
    if(!route)continue
    const distance=Math.abs(site.cell.x-target.cell.x)+Math.abs(site.cell.y-target.cell.y),depth=Number(rumor.mapId!.match(/^crypt([1-3])$/)?.[1]??0),reward=Math.ceil((d.baseReward+distance*d.distanceReward+depth*d.threatPerDepth*d.threatReward)*d.wealthMult)
    if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money||offers.some((o)=>o.id===id))continue
    // 현재 월드의 실제 경로 왕복 시간에 데이터의 조사/휴식 여유를 더한다.
    const deadlineTurns=Math.ceil(route.hours*2*TURNS_PER_HOUR+d.deadlineBufferDays*TURNS_PER_DAY)
    offers.push({id,label:`소문 조사: ${rumor.roomName}`,rumor:key,region,mapId:rumor.mapId!,roomIdx:rumor.roomIdx!,roomName:rumor.roomName!,rect:{...rumor.rect!},distance,travelHours:route.hours*2,reward,deadlineTurns,reputation:d.reputation})
  }
  return offers.sort((a,b)=>a.distance-b.distance||(a.id<b.id?-1:a.id>b.id?1:0))
}
export function acceptInvestigation(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
  const error=contractAccess(w,c,trader);if(error)return error
  const offer=investigationOffers(w,c,trader).find((o)=>o.id===id)
  if(!offer)return '소문·보수·진행 중인 계약을 다시 확인해야 한다'
  if(expectedReward!==undefined&&expectedReward!==offer.reward)return '게시된 조사 보수가 바뀌었다'
  const market=marketFor(w,trader)!,now=turnOf(w),record:InvestigationContract={...offer,kind:'investigate',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active'}
  market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record)
  c.history.push({turn:now,kind:'contract',text:`${trader.name}의 현장 조사 계약을 맡았다: ${offer.roomName}.`});log(w,'info',`${offer.label}. 현장에서 구역 내부를 살펴보고 일지에 조사 기록을 남긴 뒤 돌아오자. ${offer.reward}${economyDef(w).currency}은(는) 장부에 맡겼다.`)
  return null
}
export function investigationSurveyQuote(w:World,c:Creature,id:string){
  const record=records(w).find((r)=>r.id===id),out={record,error:null as string|null}
  if(c.id!==w.s.playerId||!c.alive||!record||record.status!=='active'){out.error='진행 중인 자신의 조사 계약이 없다';return out}
  if(turnOf(w)>=record.deadline){out.error='조사 계약의 기한이 지났다';return out}
  if(record.proof){out.error='현장 조사 기록을 이미 남겼다';return out}
  if(c.unconscious||c.asleep||c.activity||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||capacity(w,c,'manipulation')<.2){out.error='현장을 살피고 기록할 몸과 의식이 필요하다';return out}
  if(hostileAware(w,c)){out.error='위협에서 벗어난 뒤 조사해야 한다';return out}
  if(w.s.overworld?.currentRegion!==record.region||w.s.map.id!==record.mapId){out.error='소문에 적힌 지역과 층에서 조사해야 한다';return out}
  const rect=record.rect,map=w.s.map
  if(rect.x+rect.w>map.w||rect.y+rect.h>map.h||c.pos.x<rect.x||c.pos.y<rect.y||c.pos.x>=rect.x+rect.w||c.pos.y>=rect.y+rect.h){out.error='소문에 표시된 구역 안으로 가야 한다';return out}
  if(lightLevel(w,c.pos)>=2){out.error='현장 기록을 남길 빛이 부족하다';return out}
  for(let y=rect.y+1;y<rect.y+rect.h-1;y++)for(let x=rect.x+1;x<rect.x+rect.w-1;x++)if(!map.tiles[y*map.w+x].seen){out.error='표시된 구역 안에 아직 살피지 못한 곳이 있다';return out}
  return out
}
export function surveyInvestigation(w:World,c:Creature,id:string):string|null{
  const q=investigationSurveyQuote(w,c,id);if(q.error)return q.error
  const r=q.record!,rect=r.rect,index=w.s.map.rooms.findIndex((room)=>room.x===rect.x&&room.y===rect.y&&room.w===rect.w&&room.h===rect.h),room=w.s.map.rooms[index],confirmed=index===r.roomIdx&&room?.name===r.roomName
  r.proof={turn:turnOf(w),result:confirmed?'confirmed':'disproved',observedRoom:room?.name}
  c.history.push({turn:turnOf(w),kind:'contract',text:`${r.roomName} 소문을 현장에서 조사했다: ${confirmed?'위치 확인':'소문과 다름'}.`});log(w,confirmed?'good':'warn',`${r.roomName} 조사 기록: ${confirmed?'소문에 적힌 방과 위치를 확인했다':'실제 방과 위치가 소문과 다르다'}. 의뢰인에게 돌아가 보고하자.`)
  return null
}
export function investigationReportQuote(w:World,c:Creature,trader:Creature,id:string){
  const r=records(w).find((r)=>r.id===id),out={record:r,error:contractAccess(w,c,trader)}
  if(out.error)return out
  if(!r||r.site!==trader.traderSite||r.faction!==trader.faction||r.status!=='active'){out.error='이 정착지에 보고할 조사 계약이 없다';return out}
  if(turnOf(w)>=r.deadline){out.error='보고 기한이 지났다';return out}
  if(!r.proof){out.error='현장에서 직접 조사 기록을 남겨야 한다';return out}
  if(r.escrow!==r.reward||!Number.isSafeInteger(r.escrow)||r.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+r.escrow))out.error='조사 보수와 지갑을 확인해야 한다'
  return out
}
export function reportInvestigation(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
  const q=investigationReportQuote(w,c,trader,id);if(q.error)return q.error
  const r=q.record!
  if(expectedReward!==undefined&&expectedReward!==r.reward)return '조사 보수가 바뀌었다'
  c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w)
  const society=ensureSociety(w)!
  society.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100)
  c.history.push({turn:turnOf(w),kind:'contract',text:`${r.issuer}에게 조사 결과를 보고했다: ${r.roomName}.`});log(w,'good',`${r.roomName}: ${r.proof!.result==='confirmed'?'위치 확인':'소문과 다른 실제 현장'}을(를) 보고했다. 예치 보수 ${r.reward}${economyDef(w).currency}을(를) 받았다. 평판 +${r.reputation}.`)
  return null
}

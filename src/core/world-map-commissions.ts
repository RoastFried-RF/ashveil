// 현지 상인의 실제 예치금과 수락 뒤 직접 조사한 월드 지도 원본만 교환한다.
import {clamp,log,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {cheb} from './geom'
import {contractAccess} from './contracts'
import {cartographyDef} from './cartography'
import {validWorldMapDocument} from './world-cartography'
import {marketFor,economyDef} from './economy'
import {ensureSociety,reputation} from './diplomacy'
import type {ContractRecord,Creature,MapSurveyContract} from './types'
type WorldSurveyRecord=MapSurveyContract&{worldSurvey:NonNullable<MapSurveyContract['worldSurvey']>}
export const isWorldMapSurvey=(r:ContractRecord):r is WorldSurveyRecord=>r.kind==='surveyMap'&&!!r.worldSurvey
export function worldMapSurveyOffers(w:World,c:Creature,trader:Creature){
 const m=w.s.overworld,d=cartographyDef(w),rule=d.worldCommission,common=d.commission,market=marketFor(w,trader)
 if(c.id!==w.s.playerId||!m||!rule||!common||!market||market.mobile||contractAccess(w,c,trader)||!Number.isSafeInteger(market.money)||market.money<rule.reward||m.contracts?.some(r=>r.site===market.site&&r.status==='active'))return[]
 const site=m.sites.find(s=>s.id===market.site);if(!site)return[]
 const id=`world-map-survey:${site.id}:${Math.floor(turnOf(w)/(common.refreshDays*TURNS_PER_DAY))}`
 if(m.contracts?.some(r=>r.id===id||isWorldMapSurvey(r)&&r.site===site.id&&r.status==='completed'))return[]
 return[{id,label:site.label+' 주변 월드 정찰 지도',region:site.id,mapId:'@world',distance:0,worldSurvey:{center:{...site.cell},radius:rule.radius},reward:rule.reward,minFeatures:rule.minCells,minReliability:common.minReliability,reputation:common.reputation,deadlineTurns:Math.ceil(common.deadlineBufferDays*TURNS_PER_DAY)}]
}
export function acceptWorldMapSurvey(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 if(c.id!==w.s.playerId)return '내 정찰 계약만 맡을 수 있다'
 const error=contractAccess(w,c,trader);if(error)return error
 const offer=worldMapSurveyOffers(w,c,trader).find(o=>o.id===id);if(!offer)return '월드 정찰 의뢰와 실제 예치금을 다시 확인해야 한다'
 if(expectedReward!==undefined&&expectedReward!==offer.reward)return '게시된 월드 정찰 보수가 바뀌었다'
 const market=marketFor(w,trader)!,at=turnOf(w),record:MapSurveyContract={...offer,kind:'surveyMap',site:market.site,faction:trader.faction,issuer:trader.name,accepted:at,deadline:at+offer.deadlineTurns,escrow:offer.reward,status:'active'}
 market.money-=record.reward;(w.s.overworld!.contracts??=[]).push(record);c.history.push({turn:at,kind:'contract',text:trader.name+'의 '+record.label+' 의뢰를 맡았다.'});log(w,'info',record.label+': 수락 뒤 주변을 직접 살피고 월드 원본 지도를 가져오자. 보수 '+record.reward+economyDef(w).currency+'은(는) 장부에 맡겼다.');return null
}
export function worldMapSurveyDeliveryQuote(w:World,c:Creature,trader:Creature,id:string,paperUid?:number){
 const record=w.s.overworld?.contracts?.filter(isWorldMapSurvey).find(r=>r.id===id),out={record,error:c.id!==w.s.playerId?'내 정찰 지도만 납품할 수 있다':contractAccess(w,c,trader),paperUid:undefined as number|undefined}
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'){out.error='이 정착지의 진행 중인 월드 지도 계약이 없다';return out}
 if(turnOf(w)>=record.deadline){out.error='월드 정찰 기한이 지났다';return out}
 if(!Number.isSafeInteger(record.escrow)||record.escrow!==record.reward||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow)){out.error='월드 정찰 예치금과 지갑을 확인해야 한다';return out}
 const m=w.s.overworld!,paper=c.bag.find(i=>{
  if(paperUid!==undefined&&i.uid!==paperUid)return false
  const r=i.note,d=r?.worldMapDocument,a=d?.cartographer
  if(i.def!==cartographyDef(w).writing?.paper||i.count!==1||r?.kind!=='map'||!d||!validWorldMapDocument(d)||d.worldSeed!==w.s.seed||d.w!==m.w||d.h!==m.h||d.commission!==record.id||a?.id!==c.id||a.name!==c.name||a.seed!==w.s.seed||d.writtenAt<record.accepted||d.writtenAt>turnOf(w)||d.reliability<record.minReliability)return false
  const cells=new Set(d.cells.filter(o=>o.seenAt>=record.accepted&&cheb(o,record.worldSurvey.center)<=record.worldSurvey.radius).map(o=>o.x+','+o.y))
  return cells.size>=record.minFeatures
 })
 if(!paper){out.error='수락 뒤 직접 살펴 그린 범위/신뢰도를 충족하는 원래 월드 지도1장이 필요하다';return out}
 out.paperUid=paper.uid;return out
}
export function deliverWorldMapSurvey(w:World,c:Creature,trader:Creature,id:string,paperUid:number,expectedReward?:number):string|null{
 const q=worldMapSurveyDeliveryQuote(w,c,trader,id,paperUid);if(q.error)return q.error
 const r=q.record!;if(expectedReward!==undefined&&expectedReward!==r.reward)return '월드 지도 납품 보수가 바뀌었다'
 const paper=c.bag.find(i=>i.uid===paperUid)!,market=marketFor(w,trader)!,now=turnOf(w)
 c.bag=c.bag.filter(i=>i!==paper);delete paper.gx;delete paper.gy;delete paper.rot;market.items.push(paper);c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=now;r.worldRecipient={paperUid,at:now,document:structuredClone(paper.note!.worldMapDocument!)}
 const society=ensureSociety(w)!;society.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100);c.history.push({turn:now,kind:'contract',text:r.issuer+'에게 '+r.label+' 원본을 납품했다.'});log(w,'good',r.label+' 원본1장을 넘겼다. 예치 보수 '+r.reward+economyDef(w).currency+'을(를) 받았다.');return null
}

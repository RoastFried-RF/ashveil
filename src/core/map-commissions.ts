// 의뢰한 지역의 새 직접 작성 지도와 실제 예치금만 주고받는다. 원격 지형으로 품질을 채점하지 않는다.
import {clamp,log,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {cartographyDef,validMapDocument,mapDocumentFeatures} from './cartography'
import {contractAccess} from './contracts'
import {marketFor,economyDef} from './economy'
import {ensureSociety,reputation} from './diplomacy'
import {worldRoute} from './overworld'
import type {ContractRecord,Creature,MapSurveyContract,MapState} from './types'
export const isMapSurvey=(r:ContractRecord):r is MapSurveyContract=>r.kind==='surveyMap'&&!r.worldSurvey
/** 대상 목록은 실제 보유한 탐험/읽은 문서의 목록만 본다. 생성/원격 방 조회는 없다. */
export function knownSurveyMaps(w:World){
 const m=w.s.overworld,result:{region:string;mapId:string;kind:'surface'|'dungeon';depth:number}[]=[]
 if(!m)return result
 const add=(region:string,mapId:string,kind:'surface'|'dungeon',depth:number)=>{if(!result.some(x=>x.region===region&&x.mapId===mapId))result.push({region,mapId,kind,depth})}
 const explored=(region:string,map:MapState)=>{if(map.rooms.some(r=>r.discovered)||map.tiles.some(t=>t.seen))add(region,map.id,map.kind,map.depth)}
 for(const region of m.visited){add(region,'surface','surface',0);const scene=m.scenes[region];if(scene){explored(region,scene.map);for(const map of Object.values(scene.maps))explored(region,map)}}
 if(m.currentRegion){explored(m.currentRegion,w.s.map);for(const map of Object.values(w.s.maps))explored(m.currentRegion,map)}
 for(const rumor of w.s.knowledge.rumors??[]){const d=rumor.mapDocument;if(d&&validMapDocument(d))add(rumor.regionId??'Region.GreyCloister',d.mapId,d.kind,d.depth)
  else if(!d&&['room','stairs'].includes(rumor.kind)&&rumor.mapId&&rumor.mapDepth!==undefined&&Number.isInteger(rumor.mapDepth)&&rumor.mapDepth>=0&&rumor.mapDepth<=100&&Number.isInteger(rumor.mapW)&&rumor.mapW!>0&&rumor.mapW!<=256&&Number.isInteger(rumor.mapH)&&rumor.mapH!>0&&rumor.mapH!<=256)add(rumor.regionId??'Region.GreyCloister',rumor.mapId,rumor.mapDepth===0?'surface':'dungeon',rumor.mapDepth)
 }
 return result
}
export function mapSurveyOffers(w:World,c:Creature,trader:Creature){
 const rule=cartographyDef(w).commission,market=marketFor(w,trader),m=w.s.overworld
 if(!rule||!m||!market||market.mobile||contractAccess(w,c,trader)||!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===market.site&&r.status==='active'))return[]
 const origin=m.sites.find(s=>s.id===market.site);if(!origin)return[]
 const epoch=Math.floor(turnOf(w)/(rule.refreshDays*TURNS_PER_DAY))
 return knownSurveyMaps(w).flatMap(known=>{
  const target=m.sites.find(s=>s.id===known.region);if(!target)return[]
  const id=`map-survey:${market.site}:${epoch}:${target.id}:${known.mapId}`
  if(m.contracts?.some(r=>r.id===id||r.kind==='surveyMap'&&r.site===market.site&&r.region===target.id&&r.mapId===known.mapId&&r.status==='completed'))return[]
  const route=worldRoute(w,origin.cell,target.cell);if(!route)return[]
  const distance=Math.abs(origin.cell.x-target.cell.x)+Math.abs(origin.cell.y-target.cell.y),reward=Math.ceil(rule.baseReward+distance*rule.distanceReward+known.depth*(rule.depthReward??0))
  if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money)return[]
  return[{id,label:target.label+' '+(known.kind==='surface'?'지상':'지하 '+known.depth+'층')+' 정찰 지도',region:target.id,mapId:known.mapId,distance,reward,deadlineTurns:Math.ceil(route.hours*2*TURNS_PER_HOUR+rule.deadlineBufferDays*TURNS_PER_DAY),minReliability:rule.minReliability,minFeatures:rule.minFeatures,reputation:rule.reputation}]
 }).sort((a,b)=>a.distance-b.distance||(a.id<b.id?-1:a.id>b.id?1:0))
}
export function acceptMapSurvey(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const error=contractAccess(w,c,trader);if(error)return error
 const offer=mapSurveyOffers(w,c,trader).find(o=>o.id===id);if(!offer)return '정찰 지도 의뢰·예치금·진행 중인 계약을 다시 확인해야 한다'
 if(expectedReward!==undefined&&expectedReward!==offer.reward)return '게시된 지도 보수가 바뀌었다'
 const market=marketFor(w,trader)!,at=turnOf(w),record:MapSurveyContract={...offer,kind:'surveyMap',site:market.site,faction:trader.faction,issuer:trader.name,accepted:at,deadline:at+offer.deadlineTurns,escrow:offer.reward,status:'active'}
 market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record);c.history.push({turn:at,kind:'contract',text:trader.name+'의 '+offer.label+' 의뢰를 맡았다.'});log(w,'info',offer.label+': 수락 뒤 직접 그린 원래 지도1장을 가져오자. 보수 '+offer.reward+economyDef(w).currency+'은(는) 장부에 맡겼다.');return null
}
export function mapSurveyDeliveryQuote(w:World,c:Creature,trader:Creature,id:string,paperUid?:number){
 const record=(w.s.overworld?.contracts??[]).filter(isMapSurvey).find(r=>r.id===id),out={record,error:contractAccess(w,c,trader),paperUid:undefined as number|undefined}
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'){out.error='이 정착지에 납품할 정찰 지도 계약이 없다';return out}
 if(turnOf(w)>=record.deadline){out.error='정찰 지도 계약의 기한이 지났다';return out}
 if(!Number.isSafeInteger(record.escrow)||record.escrow!==record.reward||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow)){out.error='지도 예치금과 지갑을 확인해야 한다';return out}
 const paper=c.bag.find(i=>{
  if(paperUid!==undefined&&i.uid!==paperUid)return false
  const r=i.note,d=r?.mapDocument,a=d?.cartographer
  return i.def===cartographyDef(w).writing?.paper&&i.count===1&&r?.kind==='map'&&r.regionId===record.region&&d&&validMapDocument(d)&&d.commission===record.id&&a?.id===c.id&&a.name===c.name&&a.seed===w.s.seed&&d.mapId===record.mapId&&d.surveyedAt!==undefined&&d.surveyedAt>=record.accepted&&d.writtenAt>=d.surveyedAt&&d.writtenAt<=turnOf(w)&&d.reliability>=record.minReliability&&mapDocumentFeatures(d)>=record.minFeatures
 })
 if(!paper){out.error='이 의뢰를 맡은 뒤 직접 작성한 해당 지역의 원래 지도가 필요하다';return out}
 out.paperUid=paper.uid;return out
}
export function deliverMapSurvey(w:World,c:Creature,trader:Creature,id:string,paperUid:number,expectedReward?:number):string|null{
 const q=mapSurveyDeliveryQuote(w,c,trader,id,paperUid);if(q.error)return q.error
 const r=q.record!;if(expectedReward!==undefined&&expectedReward!==r.reward)return '지도 납품 보수가 바뀌었다'
 const paper=c.bag.find(i=>i.uid===paperUid)!,market=marketFor(w,trader)!,now=turnOf(w)
 c.bag=c.bag.filter(i=>i!==paper);delete paper.gx;delete paper.gy;delete paper.rot;market.items.push(paper);c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=now;r.recipient={paperUid,at:now,document:structuredClone(paper.note!.mapDocument!)}
 const society=ensureSociety(w)!;society.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100);c.history.push({turn:now,kind:'contract',text:r.issuer+'에게 '+r.label+' 원본을 납품했다.'});log(w,'good',r.label+' 원본1장을 넘겼다. 예치 보수 '+r.reward+economyDef(w).currency+'을(를) 받았다. 평판 +'+r.reputation+'.');return null
}

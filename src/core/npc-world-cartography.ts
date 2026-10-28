// 비고용NPC도 자기 실제 월드 관찰/원래 재료로만 그리며, 같은 원본과 실제 개인 현금을 교환한다.
import {cartographyDef} from './cartography'
import {npcMapTradeAccess} from './npc-cartography'
import {worldMapDrawingQuote,validWorldMapDocument} from './world-cartography'
import {worldMapMarketValue} from './world-map-prices'
import {isCompanion} from './companion-state'
import {rumorList} from './rumor-state'
import {rememberMeeting} from './first-impressions'
import {log,turnOf,type World} from './ctx'
import {addToBag,gridAdd} from './items'
import type {Action} from './actions'
import type {Creature} from './types'
export function npcWorldMapRecordNeeded(w:World,c:Creature):boolean{
 const rule=cartographyDef(w).independent,m=w.s.overworld,memory=c.worldScouting
 if(!rule?.worldMaps||!m||!memory||memory.seed!==w.s.seed||memory.w!==m.w||memory.h!==m.h)return false
 const entries=Object.entries(memory.cells).filter(([k,o])=>Number.isSafeInteger(Number(k))&&Number(k)>=0&&Number(k)<m.w*m.h&&Number.isFinite(o.at)&&o.at>=0&&o.at<=turnOf(w)&&(o.source==='survey'||o.source==='arrival'))
 if(entries.length<rule.minFeatures)return false
 const latest=Math.max(...entries.map(([,o])=>o.at))
 return !rumorList(w,c).some(r=>{const d=r.worldMapDocument,a=d?.cartographer;return d&&validWorldMapDocument(d)&&d.worldSeed===w.s.seed&&d.w===m.w&&d.h===m.h&&d.writtenAt<=turnOf(w)&&a?.id===c.id&&a.name===c.name&&a.seed===w.s.seed&&d.surveyedAt!==undefined&&d.surveyedAt>=latest})
}
export function npcWorldCartographyAction(w:World,c:Creature):Action|undefined{
 const d=cartographyDef(w)
 if(!d.independent?.worldMaps||c.id===w.s.playerId||isCompanion(w,c)||c.captivity||c.caravan||c.roadRaid||c.ai.route?.length||c.activity||!c.worldScouting)return
 if(!c.worldMapDrawingJob&&!npcWorldMapRecordNeeded(w,c))return
 const paper=c.bag.find(i=>i.def===d.writing?.paper&&i.count===1&&!i.note),ink=c.bag.find(i=>i.def===d.writing?.ink&&i.count>0),paperUid=c.worldMapDrawingJob?.paperUid??paper?.uid,inkUid=c.worldMapDrawingJob?.inkUid??ink?.uid
 if(paperUid===undefined||inkUid===undefined||worldMapDrawingQuote(w,c,paperUid,inkUid).error)return
 return{type:'drawWorldMap',paperUid,inkUid}
}
export function ownedNpcWorldMaps(w:World,c:Creature){const rule=cartographyDef(w).writing,m=w.s.overworld;return c.bag.filter(i=>{const d=i.note?.worldMapDocument,a=d?.cartographer;return i.def===rule?.paper&&i.count===1&&i.note?.kind==='map'&&d&&validWorldMapDocument(d)&&m&&d.worldSeed===w.s.seed&&d.w===m.w&&d.h===m.h&&d.writtenAt<=turnOf(w)&&a?.id===c.id&&a.name===c.name&&a.seed===w.s.seed})}
export function npcWorldMapPurchaseQuote(w:World,buyer:Creature,seller:Creature,uid:number){
 const paper=ownedNpcWorldMaps(w,seller).find(i=>i.uid===uid),price=paper?Math.ceil(worldMapMarketValue(w,paper)??0):0
 let error=npcMapTradeAccess(w,buyer,seller)
 if(error)return{error,paper,price}
 if(!cartographyDef(w).independent?.worldMaps)error='이 세계에는 개인 월드 지도 거래법이 없다'
 else if(!paper)error='그 사람이 직접 쓴 원래 월드 지도가 없다'
 else if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(buyer.money??0)||(buyer.money??0)<price||!Number.isSafeInteger(seller.money??0)||(seller.money??0)<0||!Number.isSafeInteger((seller.money??0)+price))error='지불할 돈과 상대의 지갑을 확인해야 한다'
 else{const probe:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},grid={items:structuredClone(buyer.bag),w:10,h:6};if(gridAdd(probe,grid,structuredClone(paper)))error='월드 지도를 받을 실제 배낭 공간이 없다'}
 return{error,paper,price}
}
export function buyNpcWorldMap(w:World,buyer:Creature,seller:Creature,uid:number,expectedPrice?:number):string|null{
 const q=npcWorldMapPurchaseQuote(w,buyer,seller,uid);if(q.error)return q.error
 if(expectedPrice!==undefined&&expectedPrice!==q.price)return '월드 지도 가격을 다시 확인해야 한다'
 const paper=q.paper!;seller.bag=seller.bag.filter(i=>i!==paper);delete paper.gx;delete paper.gy;delete paper.rot;addToBag(w,buyer,paper);buyer.money=(buyer.money??0)-q.price;seller.money=(seller.money??0)+q.price;rememberMeeting(w,buyer,seller);log(w,'good',seller.name+'의 원래 월드 지도를 '+q.price+'표에 샀다. 내용을 알려면 읽어야 한다.');return null
}

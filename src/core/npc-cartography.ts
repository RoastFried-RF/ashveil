// 일반NPC도 자신의 실제 기록/원래 종이/잉크로만 그린다. 구매는 같은 원본과 유한 현금의 교환이다.
import {capacity} from './body'
import {cartographyDef,validMapDocument,mapDocumentFeatures} from './cartography'
import {isCompanion} from './companion-state'
import {log,type World} from './ctx'
import {hostile} from './diplomacy'
import {hasLos} from './fov'
import {rememberMeeting} from './first-impressions'
import {cheb} from './geom'
import {addToBag,gridAdd} from './items'
import {mapDrawingQuote} from './map-writing'
import {npcRecordedMap} from './npc-map-memory'
import {rumorList} from './rumor-state'
import type {Action} from './actions'
import type {Creature} from './types'
export function npcMapRecordNeeded(w:World,c:Creature):boolean{
 const rule=cartographyDef(w).independent,memory=npcRecordedMap(w,c);if(!rule||!memory||memory.rooms.length+memory.stairs.length+(memory.landmarks?.length??0)<rule.minFeatures)return false
 const latest=Math.max(0,...memory.rooms.map(r=>r.seenAt),...memory.stairs.map(s=>s.seenAt),...(memory.landmarks??[]).map(l=>l.seenAt))
 return !rumorList(w,c).some(r=>{const m=r.mapDocument,a=m?.cartographer;return a?.id===c.id&&a.name===c.name&&a.seed===w.s.seed&&r.regionId===memory.region&&m!.mapId===memory.mapId&&(m!.surveyedAt??-1)>=latest})
}
export function npcCartographyAction(w:World,c:Creature):Action|undefined{
 const d=cartographyDef(w),rule=d.independent,memory=npcRecordedMap(w,c)
 if(!rule||c.id===w.s.playerId||isCompanion(w,c)||c.captivity||c.caravan||c.ai.route?.length||c.activity||!memory)return
 if(!c.mapDrawingJob&&!npcMapRecordNeeded(w,c))return
 const paper=c.bag.find(i=>i.def===d.writing?.paper&&i.count===1&&!i.note),ink=c.bag.find(i=>i.def===d.writing?.ink&&i.count>0),paperUid=c.mapDrawingJob?.paperUid??paper?.uid,inkUid=c.mapDrawingJob?.inkUid??ink?.uid
 if(paperUid===undefined||inkUid===undefined||mapDrawingQuote(w,c,paperUid,inkUid).error)return
 return{type:'drawMap',paperUid,inkUid}
}
export function ownedNpcMaps(w:World,c:Creature){
 const d=cartographyDef(w)
 return c.bag.filter(i=>i.def===d.writing?.paper&&i.count===1&&i.note?.kind==='map'&&i.note.mapDocument&&validMapDocument(i.note.mapDocument)&&i.note.mapDocument.cartographer?.id===c.id&&i.note.mapDocument.cartographer.name===c.name&&i.note.mapDocument.cartographer.seed===w.s.seed)
}
export function npcMapTradeAccess(w:World,buyer:Creature,seller:Creature):string|null{
 if(!cartographyDef(w).independent)return '지도 거래법이 없다'
 if(buyer.id!==w.s.playerId||buyer===seller||!w.s.creatures.includes(buyer)||!w.s.creatures.includes(seller))return '직접 곁에서 지도를 사야 한다'
 if(isCompanion(w,seller))return '고용한 동료에게는 원래 지도를 건네받을 수 있다'
 if(!buyer.alive||!seller.alive||buyer.asleep||seller.asleep||buyer.unconscious||seller.unconscious||buyer.captivity||seller.captivity||capacity(w,buyer,'consciousness')<.5||capacity(w,seller,'consciousness')<.5||capacity(w,buyer,'hearing')<.2||capacity(w,seller,'hearing')<.2)return '깨어 있고 서로 이야기할 수 있어야 한다'
 if(cheb(buyer.pos,seller.pos)>1||!hasLos(w,buyer.pos,seller.pos))return '상대 곁으로 다가가야 한다'
 if(hostile(w,buyer,seller))return '적대하는 상대와 지도를 거래할 수 없다'
 return null
}
export function npcMapPurchaseQuote(w:World,buyer:Creature,seller:Creature,uid:number){
 const rules=cartographyDef(w).independent,paper=ownedNpcMaps(w,seller).find(i=>i.uid===uid),document=paper?.note?.mapDocument,features=document?mapDocumentFeatures(document):0,price=rules?rules.basePrice+features*rules.pricePerFeature:0
 let error=npcMapTradeAccess(w,buyer,seller)
 if(error)return{error,paper,document,features,price}
 if(!paper)error='그 사람이 직접 그린 원래 지도가 없다'
 else if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(buyer.money??0)||(buyer.money??0)<price||!Number.isSafeInteger(seller.money??0)||(seller.money??0)<0||!Number.isSafeInteger((seller.money??0)+price))error='지불할 돈과 상대의 지갑을 확인해야 한다'
 else{const probe:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},grid={items:structuredClone(buyer.bag),w:10,h:6};if(gridAdd(probe,grid,structuredClone(paper)))error='원본 지도를 받을 배낭 공간이 없다'}
 return{error,paper,document,features,price}
}
export function buyNpcMap(w:World,buyer:Creature,seller:Creature,uid:number,expectedPrice:number):string|null{
 const q=npcMapPurchaseQuote(w,buyer,seller,uid);if(q.error)return q.error
 if(q.price!==expectedPrice)return '지도 가격이 바뀌었다. 다시 확인해야 한다'
 const paper=q.paper!;seller.bag=seller.bag.filter(i=>i!==paper);delete paper.gx;delete paper.gy;delete paper.rot;addToBag(w,buyer,paper)
 buyer.money=(buyer.money??0)-q.price;seller.money=(seller.money??0)+q.price
 rememberMeeting(w,buyer,seller)
 log(w,'info',seller.name+'에게 직접 그린 원본 지도를 샀다. 내용을 알려면 읽어야 한다.');return null
}

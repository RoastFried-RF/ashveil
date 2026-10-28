import {companionAccess} from './companions'
import {isCompanion} from './companion-state'
import {cartographyDef,validMapDocument} from './cartography'
import {mapDrawingQuote,startMapDrawing,cancelMapDrawing} from './map-writing'
import {npcFieldMap} from './npc-map-memory'
import {multiTurnFactor} from './action-time'
import {log,player,type World} from './ctx'
import {addToBag,gridAdd} from './items'
import {stopActivity} from './game'
import type {Creature} from './types'
export type CompanionMapOperation='start'|'stop'|'cancel'|'collect'
export function companionMapQuote(w:World,c:Creature){
 const rule=cartographyDef(w).writing,job=c.mapDrawingJob,paper=c.bag.find(i=>i.def===rule?.paper&&i.count===1&&!i.note),ink=c.bag.find(i=>i.def===rule?.ink&&i.count>0),paperUid=job?.paperUid??paper?.uid??-1,inkUid=job?.inkUid??ink?.uid??-1
 let access=companionAccess(w,c,'drawMap')
 if(!access&&(!isCompanion(w,c)||c.companion!.status!=='employed'))access='급료와 동행 상태를 먼저 확인해야 한다'
 const quote=mapDrawingQuote(w,c,paperUid,inkUid),maps=c.bag.filter(i=>i.count===1&&i.def===rule?.paper&&i.note?.mapDocument&&validMapDocument(i.note.mapDocument)&&i.note.mapDocument.cartographer?.id===c.id&&i.note.mapDocument.cartographer.name===c.name&&i.note.mapDocument.cartographer.seed===w.s.seed)
 return{access,error:access??(c.activity?.kind==='drawMap'?'이미 지도를 작성하고 있다':quote.error),paperUid,inkUid,quote,memory:npcFieldMap(w,c),job,maps,paperCount:c.bag.filter(i=>i.def===rule?.paper&&i.count===1&&!i.note).length,inkCount:c.bag.filter(i=>i.def===rule?.ink).reduce((n,i)=>n+i.count,0)}
}
export function commandCompanionMap(w:World,c:Creature,operation:CompanionMapOperation,paperUid?:number,inkUid?:number):string|null{
 const q=companionMapQuote(w,c);if(q.access)return q.access
 if(operation==='start'){
  if(q.error)return q.error
  if(paperUid!==q.paperUid||inkUid!==q.inkUid)return '원래 동료의 종이와 잉크를 다시 확인해야 한다'
  const error=startMapDrawing(w,c,paperUid,inkUid,multiTurnFactor(w,c));if(error)return error
  log(w,'info',c.name+'에게 자기 탐험 기록의 지도 작성을 부탁했다.');return null
 }
 if(operation==='stop'){if(c.activity?.kind!=='drawMap')return '지도를 작성하고 있지 않다';stopActivity(w,c);log(w,'info',c.name+'의 지도 작성을 멈췄다. 진행과 원래 재료는 남아 있다.');return null}
 if(operation==='cancel'){const error=cancelMapDrawing(c);if(error)return error;log(w,'info',c.name+'의 미완성 지도 작업을 취소했다.');return null}
 if(operation==='collect'){
  const paper=q.maps.find(i=>i.uid===paperUid);if(!paper)return '완성된 동료의 원래 지도가 없다'
  const p=player(w),probe:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},grid={items:structuredClone(p.bag),w:10,h:6}
  if(gridAdd(probe,grid,structuredClone(paper)))return '지도를 받을 배낭 공간이 없다'
  c.bag=c.bag.filter(i=>i!==paper);delete paper.gx;delete paper.gy;delete paper.rot;addToBag(w,p,paper)
  log(w,'info',c.name+'의 원래 지도를 건네받았다. 내용을 알려면 읽어야 한다.');return null
 }
 return '알 수 없는 지도 부탁이다'
}

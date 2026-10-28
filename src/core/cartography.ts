// 지도는 당시의 주장이다. 조회가 원격 지형/생물/재고를 확인하거나 지도를 갱신하지 않는다.
import {clamp,rng,turnOf,TURNS_PER_DAY,type World} from './ctx'
import type {CartographyDef,MapDocument,MapState,Rumor} from './types'
import {fieldMapRegion} from './npc-map-memory'
export const cartographyDef=(w:World)=>w.db.get<CartographyDef>('Cartography.Hearth')
export function validMapDocument(d:MapDocument):boolean{
 if(d?.landmarks!==undefined&&(!Array.isArray(d.landmarks)||d.landmarks.length>128||d.kind!=='surface'||d.landmarks.some(s=>!s||s.kind!=='water'||typeof s.label!=='string'||!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<0||s.y<0||s.x>=d.w||s.y>=d.h)))return false
 return !!d&&(d.cartographer===undefined||!!d.cartographer&&Number.isSafeInteger(d.cartographer.id)&&d.cartographer.id>0&&typeof d.cartographer.name==='string'&&typeof d.cartographer.seed==='string')&&(d.commission===undefined||typeof d.commission==='string')&&(d.surveyedAt===undefined||Number.isFinite(d.surveyedAt)&&d.surveyedAt>=0&&d.surveyedAt<=d.writtenAt)&&(d.stairs===undefined||Array.isArray(d.stairs)&&d.stairs.length<=128&&d.stairs.every(s=>!!s&&typeof s.label==='string'&&Number.isInteger(s.x)&&Number.isInteger(s.y)&&s.x>=0&&s.y>=0&&s.x<d.w&&s.y<d.h))&&typeof d.title==='string'&&typeof d.author==='string'&&typeof d.mapId==='string'&&['surface','dungeon'].includes(d.kind)&&Number.isInteger(d.depth)&&d.depth>=0&&d.depth<=100&&Number.isInteger(d.w)&&d.w>0&&d.w<=256&&Number.isInteger(d.h)&&d.h>0&&d.h<=256&&Number.isFinite(d.writtenAt)&&d.writtenAt>=0&&Number.isFinite(d.reliability)&&d.reliability>=0&&d.reliability<=100&&Number.isInteger(d.error)&&d.error>=0&&d.error<=5&&Array.isArray(d.rooms)&&d.rooms.length<=128&&d.rooms.every(r=>!!r&&(r.roomIndex===undefined||Number.isInteger(r.roomIndex)&&r.roomIndex>=0&&r.roomIndex<=1024)&&typeof r.name==='string'&&Number.isInteger(r.x)&&Number.isInteger(r.y)&&Number.isInteger(r.w)&&Number.isInteger(r.h)&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=d.w&&r.y+r.h<=d.h)
}
export const mapDocumentFeatures=(d:MapDocument)=>d.rooms.length+(d.stairs?.length??0)+(d.landmarks?.length??0)
/** 실제로 새 쪽지를 작성하는 콘텐츠 경로만 호출한다. 기존 story 난수를 소비하지 않는다. */
export function drawRoomDocument(w:World,noteId:number,r:Rumor):MapDocument|undefined{
 if(!r.mapId||!r.rect||!r.mapW||!r.mapH||!r.roomName||r.mapDepth===undefined)return
 const d=cartographyDef(w),random=rng(w,`items.cartography.${noteId}`),error=d.noteError,reliability=d.noteReliability,rect=r.rect
 const rooms=random.chance((100-reliability)/200)?[]:[{roomIndex:r.roomIdx,name:r.roomName,x:clamp(rect.x+random.int(-error,error),0,r.mapW-rect.w),y:clamp(rect.y+random.int(-error,error),0,r.mapH-rect.h),w:rect.w,h:rect.h}]
 return{title:r.source+'의 지도 조각',author:r.source,mapId:r.mapId,kind:'dungeon',depth:r.mapDepth,w:r.mapW,h:r.mapH,writtenAt:r.writtenAt,reliability,error,rooms}
}
export function knownMapDocuments(w:World,mapId?:string){
 const o=w.s.overworld,region=o?(o.currentRegion??`@${o.position.x},${o.position.y}`):undefined
 return(w.s.knowledge.rumors??[]).filter(r=>r.mapDocument&&validMapDocument(r.mapDocument)&&(!mapId||r.mapDocument.mapId===mapId)&&(!w.s.overworld||(r.regionId??'Region.GreyCloister')===region)).map(r=>({id:r.id,source:r.source,receivedAt:r.foundAt,ageDays:Math.max(0,Math.floor((turnOf(w)-r.mapDocument!.writtenAt)/TURNS_PER_DAY)),document:r.mapDocument!}))
}
export interface RoomMapClaim {roomIndex?:number;name:string;x:number;y:number;w:number;h:number;documentId:string;index:number;source:string;title:string;ageDays:number;writtenAt:number;origin:'document'|'rumor';reliability?:number;error?:number}
export function mapClaims(w:World,mapId:string,map?:MapState){
 const docs=knownMapDocuments(w,mapId),claims:RoomMapClaim[]=docs.flatMap(d=>d.document.rooms.map((r,index)=>({...r,documentId:d.id,index,source:d.source,title:d.document.title,ageDays:d.ageDays,writtenAt:d.document.writtenAt,origin:'document' as const,reliability:d.document.reliability,error:d.document.error})))
 for(const r of w.s.knowledge.rumors??[]){
  if(r.kind!=='room'||r.mapId!==mapId||r.mapDocument||!r.rect||w.s.overworld&&(r.regionId??'Region.GreyCloister')!==fieldMapRegion(w))continue
  const b=r.rect
  if(![b.x,b.y,b.w,b.h].every(Number.isInteger)||b.x<0||b.y<0||b.w<=0||b.h<=0||b.x+b.w>(r.mapW??256)||b.y+b.h>(r.mapH??256))continue
  claims.push({...b,roomIndex:r.roomIdx,name:r.roomName??'이름 없는 방',documentId:r.id,index:0,source:r.source,title:r.source+'의 위치 기록',ageDays:Math.max(0,Math.floor((turnOf(w)-r.writtenAt)/TURNS_PER_DAY)),writtenAt:r.writtenAt,origin:'rumor'})
 }
 const known=(map?.id===mapId?map.rooms:[]).map((room,index)=>({...room,roomIndex:index})).filter(r=>r.discovered)
 const same=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h
 return claims.map(c=>{const direct=c.roomIndex===undefined?known.find(r=>r.name===c.name&&same(c,r)):known.find(r=>r.roomIndex===c.roomIndex)
  return{...c,status:direct?(same(c,direct)&&c.name===direct.name?'verified':'contradicted'):'unverified',conflict:claims.some(other=>other!==c&&(other.roomIndex!==undefined&&c.roomIndex!==undefined?other.roomIndex===c.roomIndex:other.name===c.name)&&(!same(c,other)||c.name!==other.name))}
 })
}

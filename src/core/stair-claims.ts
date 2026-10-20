// 계단 위치의 당시 주장과 플레이어의 실제 과거 관찰만 비교한다. 숨은 현재 칸을 확인하지 않는다.
import {knownMapDocuments} from './cartography'
import {fieldMapRegion} from './npc-map-memory'
import {turnOf,TURNS_PER_DAY,type World} from './ctx'
import type {MapState} from './types'
interface StairClaim {documentId:string;index:number;x:number;y:number;label:string;terrain?:string;origin:'document'|'rumor';source:string;writtenAt:number}
export function stairClaims(w:World,mapId:string,map?:MapState){
 const claims:StairClaim[]=knownMapDocuments(w,mapId).flatMap(d=>(d.document.stairs??[]).map((s,index)=>({...s,documentId:d.id,index,origin:'document' as const,source:d.source,writtenAt:d.document.writtenAt})))
 for(const r of w.s.knowledge.rumors??[]){
  if(r.kind!=='stairs'||r.mapId!==mapId||!r.stair||r.mapDocument||w.s.overworld&&(r.regionId??'Region.GreyCloister')!==fieldMapRegion(w))continue
  const s=r.stair
  if(!Number.isInteger(r.mapW)||!Number.isInteger(r.mapH)||r.mapW!<1||r.mapW!>256||r.mapH!<1||r.mapH!>256||!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<0||s.y<0||s.x>=r.mapW!||s.y>=r.mapH!||typeof s.label!=='string'||typeof s.terrain!=='string'||!Number.isFinite(r.writtenAt)||r.writtenAt<0||r.writtenAt>turnOf(w))continue
  claims.push({...s,documentId:r.id,index:0,origin:'rumor',source:r.source,writtenAt:r.writtenAt})
 }
 return claims.map(c=>{
  const observation=map?.id===mapId&&c.x<map.w&&c.y<map.h?map.tiles[c.y*map.w+c.x]?.observed:undefined,t=observation&&Number.isFinite(observation.at)&&observation.at>=0&&observation.at<=turnOf(w)?observation:undefined,d=t&&w.db.terrain(t.terrain)
  const status=t?(d!.stairs&&c.label===d!.label&&(!c.terrain||c.terrain===t.terrain)?'verified':'contradicted'):'unverified'
  return{...c,status,ageDays:Math.max(0,Math.floor((turnOf(w)-c.writtenAt)/TURNS_PER_DAY)),conflict:claims.some(other=>other!==c&&other.x===c.x&&other.y===c.y&&(other.label!==c.label||other.terrain!==undefined&&c.terrain!==undefined&&other.terrain!==c.terrain))}
 })
}

// 물 지형/시설의 당시 지도 주장. 수질/현재 원격 물량을 조회하지 않는다.
import {knownMapDocuments} from './cartography'
import {turnOf,type World} from './ctx'
import type {MapState} from './types'
export function mapLandmarkClaims(w:World,mapId:string,map?:MapState){
 const claims=knownMapDocuments(w,mapId).flatMap(d=>(d.document.landmarks??[]).map((l,index)=>({...l,index,documentId:d.id,source:d.source,writtenAt:d.document.writtenAt})))
 return claims.map(c=>{
  const o=map?.id===mapId&&c.x<map.w&&c.y<map.h?map.tiles[c.y*map.w+c.x]?.observed:undefined,observed=o&&Number.isFinite(o.at)&&o.at>=0&&o.at<=turnOf(w)?o:undefined,terrain=observed&&w.db.terrain(observed.terrain)
  return{...c,status:observed?terrain&&(terrain.water||terrain.waterSource)&&terrain.label===c.label?'verified':'contradicted':'unverified',conflict:claims.some(other=>other!==c&&other.x===c.x&&other.y===c.y&&other.label!==c.label)}
 })
}

// 같은 실제 관찰 기록을 월드 화면과 커서 정보에서 사용한다. 조회는 지형/지식/시각을 고치지 않는다.
import {player,type World} from '../core/ctx'
import {canObserveTerrain} from '../core/fov'
import type {Tile,MapState} from '../core/types'
export function knownLocalMaps(w:World):MapState[]{return[w.s.map,...Object.values(w.s.maps)].filter(m=>m===w.s.map||m.rooms.some(r=>r.discovered)||m.tiles.some(t=>t.seen))}
export function mapVisibility(w:World,map:MapState=w.s.map):ReadonlySet<number>{return map===w.s.map&&canObserveTerrain(w,player(w))?new Set(w.s.visible):new Set()}
export function terrainAppearance(w:World,index:number,visible:ReadonlySet<number>,map:MapState=w.s.map):string|undefined{
 const tile=map.tiles[index]
 if(!tile||!tile.seen&&!visible.has(index))return
 // 기록 없는 구형 탐험 칸은 기존의 날짜 없는 표시를 유지한다. 과거 값을 추정하지 않는다.
 return tile.observed?.terrain??tile.t
}
export function mapAppearance(w:World,map:MapState=w.s.map){const visible=mapVisibility(w,map);return{visible,terrain:map.tiles.map((_,i)=>terrainAppearance(w,i,visible,map))}}
export function displayTile(tile:Tile,terrain:string,visible:boolean):Tile{
 if(visible&&terrain===tile.t)return tile
 if(visible)return{...tile,cultivation:undefined,cropResidue:undefined,t:terrain}
 return{...tile,cultivation:undefined,cropResidue:undefined,t:terrain,blood:0,icy:undefined,snow:undefined,iceHoleUntil:undefined,spores:undefined,beddingFire:undefined,terrainFire:undefined,combustionRemaining:undefined,fireWetUntil:undefined,beddingWetness:undefined,beddingScorch:undefined,beddingLice:undefined,gatherAt:undefined,needleGatherAt:undefined,regrowAt:undefined,searched:undefined,cont:undefined,items:[],device:undefined,beacon:undefined,placed:undefined}
}

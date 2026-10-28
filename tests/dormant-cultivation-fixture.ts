import {whitecapFixture} from './whitecap-fixture'
import {cultivationStatus} from '../src/core/cultivation'
import {player,tileAt,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {MapState} from '../src/core/types'
import type {Action} from '../src/core/actions'
export type DormantCropPhase='active'|'away'|'returned'|'nearRipeAway'|'nearRipe'|'harvested'|'pendingAway'
export function dormantCultivationFixture(phase:DormantCropPhase='active'){
 const d=whitecapFixture('watered',true),source=d.s.map,sourceId='culture-cellar',annexId='culture-annex',stairs={x:20,y:21},entry={x:3,y:3}
 // 물리 계단이 있는 두 초기 지하 구획이다. 이전 이탈/여행/성장 이력은 선언하지 않는다.
 source.id=sourceId;source.name='실제 배양 지하실';source.depth=1;source.exits=[];d.p.mapId=sourceId
 tileAt(d.w,stairs).t='Terrain.StairsDown';source.links=[{pos:{...stairs},to:annexId,toPos:{...entry},label:'연결 회랑 계단'}]
 const annex:MapState={id:annexId,name:'지하 연결 회랑',kind:'dungeon',depth:2,ambient:0,w:8,h:8,tiles:Array.from({length:64},()=>({t:'Terrain.KtFloor',v:0,roof:true,blood:0,items:[]})),exits:[],links:[{pos:{...entry},to:sourceId,toPos:{...stairs},label:'배양 지하실 계단'}],rooms:[],props:[],lights:[]};annex.tiles[entry.y*annex.w+entry.x].t='Terrain.StairsUp';d.s.maps[annexId]=annex;d.s.offCreatures[annexId]=[]
 if(phase==='nearRipe'||phase==='nearRipeAway'||phase==='harvested'){d.crop().state.growth=d.crop().total-100;d.crop().state.waterUnits=100*d.crop().rule!.waterMl}
 const beforeDeparture=d.s.time,initialCrop=structuredClone(d.crop().state)
 if(phase!=='active'&&phase!=='nearRipe'){d.act({type:'move',dir:4});d.act({type:'stairs'})}
 if(phase==='returned'||phase==='harvested'){d.act({type:'rest',turns:200});d.act({type:'stairs'})}
 if(phase==='harvested')d.act({type:'gather',pos:d.pos})
 if(phase==='pendingAway')d.act({type:'rest',turns:200},1)
 const proof={...d.proof,phase,sourceId,annexId,stairs,entry,declaredTwoConnectedInitialDungeonCompartments:true,declaredRemainingHundredGrowthTurns:phase==='nearRipe'||phase==='nearRipeAway'||phase==='harvested',noClaimOfEarlier28700GrowthOrEarlierTrips:true,beforeDeparture,initialCrop,initialRendererFx:d.s.fx.splice(0)}
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w),sourceMap=s.map.id===sourceId?s.map:s.maps[sourceId],crop=()=>cultivationStatus({db:w.db,s:{...s,map:sourceMap}},d.pos)!
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,pos:d.pos,sourceMap,sourceId,annexId,stairs,entry,crop,waterUid:d.waterUid,cultureUid:d.cultureUid,torchUid:d.torchUid,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof}
}

/** 구형176의 표시 없는 정지 밭이다. 런타임 동작 뒤 상태를 가리는 것이 아니라 불러오기 전 원본 형식을 구성한다. */
export function legacyDormantCultivationFixture(){
 const d=dormantCultivationFixture('away'),raw=JSON.parse(serialize(d.s)) as World['s'];raw.version=176
 delete raw.maps[d.sourceId].tiles[d.pos.y*d.sourceMap.w+d.pos.x].cultivation!.dormantAt
 const s=deserialize(JSON.stringify(raw)),w:World={db:d.w.db,s},p=player(w),sourceMap=s.maps[d.sourceId]
 invalidateLights(w);updatePlayerVision(w,p)
 return{...d,w,s,p,sourceMap,crop:()=>cultivationStatus({db:w.db,s:{...s,map:sourceMap}},d.pos)!,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof:{...d.proof,legacyFrozenVersion:176,legacySourceHasNoDepartureMarker:true}}
}

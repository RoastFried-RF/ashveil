// 최초 지역 지도 후보만 바꾼다. 원래 인원/물품/출입구와 연결을 검증한 뒤 한 번 반영한다.
import {rng,turnOf,type World} from './ctx'
import {disableScriptCall,initializeScriptState} from './script-hooks'
import {validScriptJson,type ScriptCall,type ScriptJson} from './script-contracts'
import type {GenResult} from './mapgen'
import type {MapState,RegionLayoutDef,TerrainDef,Tile} from './types'
export interface ScriptMapGenOptions {scriptPreview?:boolean;regionId?:string}
export type ScriptMapGenDefinition=Pick<RegionLayoutDef,'id'|'genWorker'>&Partial<Pick<RegionLayoutDef,'objects'|'buildings'|'dock'>>
function reachable(w:World,map:MapState,tiles:Tile[],start:number){
 const seen=new Set<number>(),queue=[start]
 const walk=(i:number)=>{const t=w.db.terrain(tiles[i].t);return!t.water&&(t.passable||!!t.openAs&&!t.keyItem&&w.db.terrain(t.openAs).passable)}
 if(!walk(start))return seen
 seen.add(start)
 for(let head=0;head<queue.length;head++){
  const i=queue[head],x=i%map.w,y=Math.floor(i/map.w)
  for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=map.w||ny>=map.h)continue;const n=ny*map.w+nx;if(!seen.has(n)&&walk(n)){seen.add(n);queue.push(n)}}
 }
 return seen
}
export function applyScriptMapGen(w:World,d:ScriptMapGenDefinition,gen:GenResult,options:ScriptMapGenOptions={}):GenResult{
 const ref=d.genWorker;if(!ref)return gen
 const [modId,name]=ref.split(':'),module=w.db.scriptModules.find(m=>m.modId===modId)
 if(!module||!w.db.scriptHost?.invokeWorker||!module.workers?.some(r=>r.name===name&&r.kind==='MapGenStepWorker'))return gen
 const call:ScriptCall=`worker.${name}.execute`,key=modId+':'+call;if(w.s.scriptState?.disabled.includes(key))return gen
 const fail=(reason:string)=>{if(!options.scriptPreview){initializeScriptState(w);disableScriptCall(w,modId,call,reason)}return gen}
 const map=gen.map;if(map.w>128||map.h>128)return fail('지도 워커의 지도 크기 한도 초과')
 const protectedCells=new Set<number>(),protect=(x:number,y:number)=>{if(x>=0&&y>=0&&x<map.w&&y<map.h)protectedCells.add(y*map.w+x)}
 protect(gen.start.x,gen.start.y)
 for(const pos of [...map.exits,...map.links.map(l=>l.pos),...gen.spawns.map(s=>s.pos)])protect(pos.x,pos.y)
 for(const spawn of gen.spawns)if(spawn.home)protect(spawn.home.x,spawn.home.y)
 for(const pos of Object.values(map.waypoints??{}))protect(pos.x,pos.y)
 for(const prop of map.props)for(let dy=0;dy<prop.h;dy++)for(let dx=0;dx<prop.w;dx++)protect(prop.x+dx,prop.y+dy)
 for(const light of map.lights)protect(light.pos.x,light.pos.y)
 for(const object of d.objects??[])protect(...object.pos)
 for(const building of d.buildings??[])protect(...building.door)
 if(d.dock)protect(...d.dock)
 map.tiles.forEach((tile,i)=>{if(tile.items.length||tile.cont||tile.placed||tile.device||tile.beacon||tile.terrainFire||tile.beddingFire)protectedCells.add(i)})
 const palette=[...new Set(map.tiles.map(t=>t.t))].sort();if(palette.length>1024||protectedCells.size>1024)return fail('지도 워커의 지형/앵커 한도 초과')
 const codes=new Map(palette.map((id,n)=>[id,n.toString(36).padStart(2,'0')])),terrainRows:string[]=[],roofRows:string[]=[]
 for(let y=0;y<map.h;y++){let terrain='',roof='';for(let x=0;x<map.w;x++){const t=map.tiles[y*map.w+x];terrain+=codes.get(t.t)!;roof+=t.roof?'1':'0'}terrainRows.push(terrain);roofRows.push(roof)}
 const regionId=options.regionId??w.s.overworld?.currentRegion??'local',event:Record<string,ScriptJson>={layoutId:d.id,regionId,map:{id:map.id,w:map.w,h:map.h,start:{...gen.start},palette,terrainRows,roofRows,protectedCells:[...protectedCells].sort((a,b)=>a-b)}},view={turn:turnOf(w),mapId:map.id,regionId},state=w.s.scriptState?.mods[modId]??{},stream=`mod.${modId}.mapgen.${regionId}.${d.id}.${name}`as const,prior=w.s.rng[stream],shadow:World={db:w.db,s:{...w.s,rng:{...w.s.rng,...(prior?{[stream]:[...prior]}:{})}}}
 if(!validScriptJson(state)||!validScriptJson(event))return fail('지도 워커 입력 데이터 한도/형식 오류')
 const outcome=w.db.scriptHost.invokeWorker({module,worker:name,method:'execute',event,view,state,rng:rng(shadow,stream).s})
 if(!outcome.ok)return fail(outcome.reason)
 if(!validScriptJson(outcome.state)||!validScriptJson(outcome.result)||!Array.isArray(outcome.result)||outcome.result.length>256)return fail('지도 워커 지형 목록 형식 오류')
 const tiles=map.tiles.map(t=>({...t})),changed=new Set<number>()
 for(const row of outcome.result){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['type','x','y','terrain','roof'].includes(k))||row.type!=='setTerrain'||typeof row.x!=='number'||!Number.isSafeInteger(row.x)||row.x<0||row.x>=map.w||typeof row.y!=='number'||!Number.isSafeInteger(row.y)||row.y<0||row.y>=map.h||typeof row.terrain!=='string'||row.roof!==undefined&&typeof row.roof!=='boolean')return fail('허용하지 않는 지도 지형 명령')
  const i=row.y*map.w+row.x,t=w.db.tryGet<TerrainDef>(row.terrain),old=w.db.terrain(map.tiles[i].t)
  if(protectedCells.has(i)||changed.has(i)||!t||t.defType!=='Terrain'||old.water||t.water||t.stairs||t.device||t.beacon)return fail('원래 앵커/실물/수로/출입 설비를 바꿀 수 없다')
  changed.add(i);tiles[i].t=t.id;if(typeof row.roof==='boolean')tiles[i].roof=row.roof
 }
 if(changed.size){
  const start=gen.start.y*map.w+gen.start.x,before=reachable(w,map,map.tiles,start),after=reachable(w,map,tiles,start)
  for(const i of protectedCells)if(before.has(i)&&!after.has(i))return fail('지도 변경이 원래 주민/출입구 연결을 막았다')
 }
 if(!options.scriptPreview){initializeScriptState(w);w.s.scriptState!.mods[modId]=outcome.state;w.s.rng[stream]=[...outcome.rng]}
 return{...gen,map:{...map,tiles}}
}

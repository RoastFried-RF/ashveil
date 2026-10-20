// 장소별 지도 정의. 최초 생성에만 RNG/현물 UID를 쓰고 이후에는 각인 지도를 재사용한다.
import { rng, type World } from './ctx'
import {applyScriptMapGen,type ScriptMapGenOptions} from './script-mapgen'
import { gridAdd, makeItem } from './items'
import type { GenResult } from './mapgen'
import type { RegionLayoutDef, RegionSiteDef } from './types'

export function layoutForMap(w:World,mapId:string):RegionLayoutDef|undefined{
  const site=w.s.overworld?.sites.find(s=>s.id===w.s.overworld?.currentRegion)
  const root=site&&w.db.tryGet<RegionSiteDef>(site.id)?.layout
  if(!root)return undefined
  const def=w.db.get<RegionLayoutDef>(root)
  const id=def.mapId===mapId?root:def.submaps?.find(s=>s.mapId===mapId)?.layout
  return id?w.db.get<RegionLayoutDef>(id):undefined
}

export function generateRegionLayout(w:World,d:RegionLayoutDef,options:ScriptMapGenOptions={}):GenResult{
 const target=options.scriptPreview?{db:w.db,s:{...w.s,rng:structuredClone(w.s.rng)}}:w
 return generateLayoutCore(target,d,options)
}
function generateLayoutCore(w:World,d:RegionLayoutDef,options:ScriptMapGenOptions):GenResult{
  const r=rng(w,`world.layout.${options.regionId??w.s.overworld?.currentRegion??'local'}.${d.id}`)
  const map:GenResult['map']={id:d.mapId,name:d.label,kind:d.kind,depth:d.depth,layout:d.id,ambient:d.ambient,daylightMult:d.daylightMult,w:d.width,h:d.height,tiles:Array.from({length:d.width*d.height},()=>({t:d.fill,v:r.int(0,15),roof:false,blood:0,items:[]})),exits:d.exits.map(([x,y])=>({x,y})),links:d.links.map(l=>({pos:{x:l.pos[0],y:l.pos[1]},to:l.to,toPos:{x:l.at[0],y:l.at[1]},label:w.db.terrain(mapTerrainAt(d,l.pos)).label})),rooms:[],props:[],lights:[]}
  if(d.fog)map.fog={...d.fog}
  const at=(x:number,y:number)=>map.tiles[y*map.w+x]
  map.lights=(d.lights??[]).map(l=>({pos:{x:l.pos[0],y:l.pos[1]},radius:l.radius,kind:l.kind}))
  for(let y=1;y<map.h-1;y++)for(let x=1;x<map.w-1;x++)for(const row of d.scatter)if(r.chance(row.chance)){at(x,y).t=row.terrain;break}
  for(const rect of d.clear)for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){at(x,y).t=rect.terrain;at(x,y).roof=rect.roof??false}
  for(const b of d.buildings){
    const room=map.rooms.length
    for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){const edge=x===b.x||x===b.x+b.w-1||y===b.y||y===b.y+b.h-1;at(x,y).t=edge?b.wall:b.floor;at(x,y).roof=b.roof;at(x,y).room=room}
    at(b.door[0],b.door[1]).t=b.doorTerrain
    map.rooms.push({x:b.x,y:b.y,w:b.w,h:b.h,type:'ruin',discovered:false,name:b.name})
  }
  for(const object of d.objects){
    const tile=at(object.pos[0],object.pos[1]);tile.t=object.terrain
    if(object.items){
      tile.cont={items:[],opened:false,kind:object.terrain}
      const [width,height]=w.db.terrain(object.terrain).lootGrid??[6,4],g={items:tile.cont.items,w:width,h:height}
      for(const row of object.items){const it=makeItem(w,row.item,row.count),left=gridAdd(w,g,it);if(left)tile.items.push({...it,count:left,gx:undefined,gy:undefined,rot:undefined})}
    }
  }
  const spawns=d.spawns.map(s=>({def:s.creature,pos:{x:s.pos[0],y:s.pos[1]},home:{x:s.home[0],y:s.home[1]},room:s.room,settlementResident:s.settlementResident}))
  return applyScriptMapGen(w,d,{map,start:{x:d.start[0],y:d.start[1]},spawns},options)
}

function mapTerrainAt(d:RegionLayoutDef,pos:[number,number]):string{return d.objects.find(o=>o.pos[0]===pos[0]&&o.pos[1]===pos[1])?.terrain??d.fill}

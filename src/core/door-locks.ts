import type {World} from './ctx'
import type {Pos} from './geom'
import type {MapRoom,MapState,TerrainDef} from './types'

/** 원래 방/문 중 우회 가능한 한 문만 잠근다. 난수·인원·물품·통로는 추가하지 않는다. */
export function installOptionalDoorLock(w:World,map:MapState,start:Pos,guards:readonly Pick<MapRoom,'x'|'y'|'w'|'h'>[]):number|undefined{
 const replacement=w.db.tryGet<TerrainDef>('Terrain.RustedDoorClosed')
 if(!replacement?.lock||replacement.door!=='closed')return
 const index=(x:number,y:number)=>y*map.w+x,candidates=new Set<number>()
 for(const room of guards){
  for(let x=room.x-1;x<=room.x+room.w;x++)for(const y of [room.y-1,room.y+room.h])if(x>=0&&x<map.w&&y>=0&&y<map.h)candidates.add(index(x,y))
  for(let y=room.y;y<room.y+room.h;y++)for(const x of [room.x-1,room.x+room.w])if(x>=0&&x<map.w&&y>=0&&y<map.h)candidates.add(index(x,y))
 }
 const reachable=(blocked=-1)=>{
  const seen=new Set<number>(),queue=[index(start.x,start.y)]
  for(let q=0;q<queue.length;q++){
   const key=queue[q];if(seen.has(key)||key===blocked)continue
   const tile=map.tiles[key],def=w.db.terrain(tile.t)
   if(!def.passable&&!(def.door==='closed'&&!def.sealed&&!tile.locked))continue
   seen.add(key);const x=key%map.w,y=Math.floor(key/map.w)
   for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]])if(x+dx>=0&&x+dx<map.w&&y+dy>=0&&y+dy<map.h)queue.push(index(x+dx,y+dy))
  }
  return seen
 }
 const before=reachable()
 for(const key of [...candidates].sort((a,b)=>a-b)){
  if(map.tiles[key].t!=='Terrain.DoorClosed'||!before.has(key)||reachable(key).size!==before.size-1)continue
  map.tiles[key].t=replacement.id;map.tiles[key].locked=true;return key
 }
}

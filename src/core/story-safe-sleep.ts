// 실제 점유 거점/알려진 잠긴 방에서의 잠만 안전 수면 긴장 회복으로 센다.
import {beddingAt} from './camping'
import {baseCampDef} from './base-camp-state'
import {inBounds,terrainAt,tileAt,turnOf,type World} from './ctx'
import {cheb} from './geom'
import {storyDirectorRule} from './story-director'
export function storySafeSleep(w:World):'camp'|'lockedRoom'|undefined{
 const p=w.s.creatures.find(c=>c.id===w.s.playerId),rule=storyDirectorRule(w)?.tension
 if(!rule||!p||!p.alive||!p.asleep||p.unconscious||p.captivity||!w.s.creatures.includes(p)||p.mapId!==undefined&&p.mapId!==w.s.map.id||!inBounds(w,p.pos)||!terrainAt(w,p.pos).bedding||beddingAt(w,p.pos).quality<=0||tileAt(w,p.pos).beddingFire||tileAt(w,p.pos).terrainFire)return
 if(p.lastThreatAt!==undefined&&turnOf(w)-p.lastThreatAt<rule.recentThreatTurns)return
 const base=w.s.map.baseCamp
 if(base?.owner===p.id&&inBounds(w,base.store)&&cheb(p.pos,base.store)<=Math.min(baseCampDef(w).radius,rule.campRadius)&&tileAt(w,base.store).placed?.item.uid===base.storeUid&&tileAt(w,base.store).placed?.owner===p.id&&terrainAt(w,base.store).id===baseCampDef(w).storeTerrain)return'camp'
 const room=w.s.map.rooms.find(r=>r.discovered&&p.pos.x>=r.x&&p.pos.y>=r.y&&p.pos.x<r.x+r.w&&p.pos.y<r.y+r.h)
 if(!room||room.w*room.h>rule.maxRoomCells||!tileAt(w,p.pos).roof)return
 const queue=[{...p.pos}],seen=new Set<number>();let locked=false
 for(let head=0;head<queue.length;head++){
  const at=queue[head]!,key=at.y*w.s.map.w+at.x;if(seen.has(key))continue;seen.add(key)
  if(seen.size>rule.maxRoomCells||!inBounds(w,at)||at.x<room.x||at.y<room.y||at.x>=room.x+room.w||at.y>=room.y+room.h||!tileAt(w,at).roof)return
  for(const delta of[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]){
   const next={x:at.x+delta.x,y:at.y+delta.y};if(!inBounds(w,next))return
   const def=terrainAt(w,next)
   if(def.door==='closed'&&(def.keyItem||def.sealed)){locked=true;continue}
   if(!def.passable&&def.door!=='closed')continue
   if(!seen.has(next.y*w.s.map.w+next.x))queue.push(next)
  }
 }
 return locked?'lockedRoom':undefined
}
export function storyTensionDecay(w:World){const rule=storyDirectorRule(w)?.tension;return storySafeSleep(w)?rule?.safeSleepPerHour??6:rule?.calmPerHour??3}

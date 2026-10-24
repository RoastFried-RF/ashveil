import {calendar} from './climate-state'
import {inBounds,terrainAt,tileAt,turnOf,type World} from './ctx'
import {hasLos} from './fov'
import {DIRS,type Pos} from './geom'
import {diagonalBlocked} from './path'
import {cultivationHarvestError} from './cultivation'
import {towerSoilFertility} from './tower-consequences'
import type {Creature,SeasonDef,TerrainDef} from './types'
export function gatherSeasonError(w:World,def:TerrainDef):string|null{
 const seasons=def.gather?.seasons
 return seasons?.length&&!seasons.includes(calendar(w).season.id)?seasons.map(id=>w.db.tryGet<SeasonDef>(id)?.label??id).join('·')+'에만 실제 열매가 열린다':null
}
export function nearbySeasonalGather(w:World,c:Creature){
 return[{x:0,y:0},...DIRS].map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).filter(p=>inBounds(w,p)&&!!terrainAt(w,p).gather?.seasons?.length&&hasLos(w,c.pos,p)&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y))
}
export function seasonalGatherError(w:World,p:Pos){
 const def=terrainAt(w,p)
 return gatherSeasonError(w,def)??((tileAt(w,p).gatherAt??0)>turnOf(w)?'지난 채집 뒤 새 열매가 자라기를 기다려야 한다':null)
}
export function gatherSignature(w:World,p:Pos){return JSON.stringify({terrain:tileAt(w,p).t,gather:terrainAt(w,p).gather})}

/** A visible plant's current appearance; retain this boolean when it leaves sight. */
export function observedGatherAvailable(w:World,p:Pos):boolean|undefined{
 const def=terrainAt(w,p);if(!def.gather)return
 return !gatherSeasonError(w,def)&&!gatherFireError(w,p)&&!cultivationHarvestError(w,p)&&(tileAt(w,p).gatherAt??0)<=turnOf(w)&&(!def.gather.soilDependent||towerSoilFertility(w)>0)
}

export function gatherFireError(w:World,p:Pos):string|null{const t=tileAt(w,p),b=terrainAt(w,p).combustion,r=t.combustionRemaining;return t.terrainFire||r&&b?.family===r.family&&r.placedUid===t.placed?.item.uid&&r.remaining<r.total?'불이 붙었거나 타버린 재료는 원래 양으로 채집할 수 없다':null}

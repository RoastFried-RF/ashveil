/** Read-only chart estimate: recorded terrain and local weather, never remote live values. */
import type {World} from './ctx'
import type {Pos} from './geom'
import {seaRoute} from './marine-state'
import {worldIndex} from './overworld'
import {worldMapClaims,worldWithKnownTerrain} from './world-cartography'
import {worldObservation} from './world-observations'
export function seaRouteForecast(w:World,from:Pos,to:Pos){
 const m=w.s.overworld;if(!m)return null
 const known=new Set(Object.keys(m.worldObservations??{}).map(Number).filter(i=>!!worldObservation(w,i)))
 for(const claim of worldMapClaims(w,undefined,'document'))if(!claim.conflict)known.add(claim.index)
 if(!known.has(worldIndex(m,from))||!known.has(worldIndex(m,to)))return null
 const projected=worldWithKnownTerrain(w),map=projected.s.overworld!
 // Unknown cells are barriers for this water search. The land projection uses sea as its barrier.
 map.cells=map.cells.map((cell,i)=>known.has(i)?cell:{...cell,sea:false})
 map.weatherCells={}
 return seaRoute(projected,from,to)
}

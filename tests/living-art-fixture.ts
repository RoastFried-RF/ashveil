import { forestArtFixture } from './forest-art-fixture'
import { deserialize, invalidateLights, player, serialize, tileAt, updatePlayerVision } from '../src/core'

export function livingArtFixture(dark=false){
 const d=forestArtFixture(dark),{w}=d
 const positions=d.proof.positions.map((pos,i)=>({...pos,t:['Terrain.PineTree','Terrain.PineTree','Terrain.BlackwoodTree','Terrain.BlackwoodTree','Terrain.Tree'][i]!}))
 for(const pos of positions)tileAt(w,pos).t=pos.t
 w.s.map.name='생목 원화 검토 · '+(dark?'어둠':'낮');invalidateLights(w);updatePlayerVision(w,player(w));w.s.fx=[]
 return{w:{db:w.db,s:deserialize(serialize(w.s))},torch:d.torch,proof:{dark,positions,ambient:w.s.map.ambient,torch:d.torch,limits:'Finite initial flat-ground/day or dark save with two actual PineTree, two actual BlackwoodTree, one default dead Tree and initially equipped unlit torch. Actual Title Continue and real input; no postload world/body/time/RNG injection. Not natural resource acquisition or human play evidence. Coordinate hashes select all four new living-tree sprites in daylight.'}}
}

import {makeWorld} from './helpers'
import {player,creatureAt,terrainAt} from '../src/core/ctx'
import {DIRS,cheb} from '../src/core/geom'
import {updatePlayerVision} from '../src/core/fov'
export function rightHandFixture(){
 const w=makeWorld('right-hand-native','Bg.Hunter',true),s=w.s,p=player(w),start={...p.pos},candidates=[]as {x:number;y:number}[]
 for(let y=Math.max(2,start.y-5);y<=Math.min(s.map.h-3,start.y+5);y++)for(let x=Math.max(2,start.x-5);x<=Math.min(s.map.w-3,start.x+5);x++)candidates.push({x,y})
 const center=candidates.sort((a,b)=>cheb(a,start)-cheb(b,start)).find(pos=>[pos,...DIRS.map(d=>({x:pos.x+d.x,y:pos.y+d.y}))].every(p=>terrainAt(w,p).passable&&!s.map.tiles[p.y*s.map.w+p.x].terrainFire&&!s.map.tiles[p.y*s.map.w+p.x].beddingFire&&(!creatureAt(w,p)||creatureAt(w,p)!.id===s.playerId)))
 if(!center)throw Error('actual initial 3x3 input-test clearing unavailable')
 p.pos={...center};updatePlayerVision(w,p)
 return{w,s,p,proof:{declaredInitialInputTestPosition:{...p.pos},notClaimingPastTravel:true,originalActorIds:s.creatures.map(c=>c.id),initialRendererFx:s.fx.splice(0)}}
}

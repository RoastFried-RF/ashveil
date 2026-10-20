import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {tileAt,turnOf} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {worldIndex} from '../src/core/overworld'
export function landscapeThoughtsFixture(){
 const d=conditionThoughtsFixture('condition-thoughts',true),cell=d.s.overworld!.cells[worldIndex(d.s.overworld!,d.s.map.worldCell??d.s.overworld!.position)]
 d.p.background='Bg.Hunter'
 for(let y=d.p.pos.y-4;y<=d.p.pos.y+4;y++)for(let x=d.p.pos.x-4;x<=d.p.pos.x+4;x++)if(tileAt(d.w,{x,y}))tileAt(d.w,{x,y}).roof=false
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 const room={x:d.p.pos.x-1,y:d.p.pos.y-1,w:3,h:3,type:'ruin',discovered:false,name:'무너진 마당'}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,cell,room}
}
export type LandscapeThoughtPhase='home'|'roof'|'blind'|'ordinary'|'ruin'|'pending'
export function landscapeThoughtNativeFixture(phase:LandscapeThoughtPhase){
 const d=landscapeThoughtsFixture(),initialTime=d.s.time
 if(phase==='roof')tileAt(d.w,d.p.pos).roof=true
 if(phase==='blind')d.p.body.missing=['LeftEye','RightEye']
 if(phase==='ordinary')d.p.background='Bg.Scavenger'
 if(phase==='ruin'||phase==='pending')d.s.map.rooms.push(d.room)
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const error=playerAct(d.w,phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?1:undefined);if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,actualBiome:d.cell.biome,actualRiver:!!d.cell.river,roomName:phase==='ruin'||phase==='pending'?d.room.name:undefined,pending:phase==='pending'}}
}

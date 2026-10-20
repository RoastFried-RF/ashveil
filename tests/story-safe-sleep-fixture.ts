import {storyDirectorFixture} from './story-director-fixture'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
export function storySafeSleepNativeFixture(locked=true,pending=false){
 const d=storyDirectorFixture();d.s.map.rooms=[{x:19,y:19,w:3,h:3,type:'chamber',name:'아는 안쪽 방',discovered:true}]
 for(let y=18;y<=22;y++)for(let x=18;x<=22;x++)Object.assign(tileAt(d.w,{x,y}),{t:x===18||x===22||y===18||y===22?'Terrain.RuinWall':'Terrain.KtFloor',roof:true,items:[]})
 tileAt(d.w,{x:22,y:20}).t=locked?'Terrain.SeedVaultDoor':'Terrain.DoorClosed';tileAt(d.w,d.p.pos).t='Terrain.Bed'
 const fire={x:19,y:20};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 d.p.needs.fatigue=15.01;d.p.needs.sleepDebt=0;d.director.tension=20;d.director.decayCarry=0;d.p.facing=2
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!,at=s.time,act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 invalidateLights(w);updatePlayerVision(w,p)
 if(pending)act({type:'sleep'},2)
 return{w,s,p,act,proof:{locked,pending,initialTime:at,prefixTU:s.time-at,declaredInitialFatigue:15.01,declaredInitialTension:20,notClaimingPastConstructionOrFatigueHistory:true}}
}

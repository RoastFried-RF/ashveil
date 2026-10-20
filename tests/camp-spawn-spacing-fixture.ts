import {newGame,playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {ensureSociety} from '../src/core/diplomacy'
import {db} from './helpers'
export function campSpawnSpacingFixture(pending=false){
 const w:World={db,s:newGame(db,{seed:'camp-spawn-spacing-native',background:'Bg.Hunter',overworld:true})},s=w.s,p=player(w),members=s.creatures.filter(c=>c.faction==='reavers'),home=members[0]!.home!
 p.pos={x:home.x+1,y:home.y+1};p.nextAct=s.time;ensureSociety(w)!.reputation.reavers=0;s.storyteller.budget=-1e9;Object.assign(p.needs,{kcal:1000,waterDeficit:0,fatigue:10,bodyTemp:37})
 if(!db.terrain(s.map.tiles[p.pos.y*s.map.w+p.pos.x].t).passable||members.some(c=>c.pos.x===p.pos.x&&c.pos.y===p.pos.y))throw Error('declared observer floor is not free')
 invalidateLights(w);updatePlayerVision(w,p)
 const proof={originalActorIds:s.creatures.map(c=>c.id),originalMemberIds:members.map(c=>c.id),initialActorPositions:s.creatures.map(c=>({id:c.id,pos:{...c.pos}})),declaredInitialObserverNearCampNeutralityNeedsAndStoryBudget:true,notClaimingPastTravelDiplomacyOrNaturalEncounterFrequency:true}
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 if(pending)act({type:'rest',turns:20},1)
 return{w,s,p,members,act,proof:{...proof,initialRendererFx:s.fx.splice(0)}}
}

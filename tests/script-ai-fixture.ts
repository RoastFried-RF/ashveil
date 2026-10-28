import {bountyContractsFixture} from './bounty-contracts-fixture'
import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {initializeScriptState} from '../src/core/script-hooks'
import {playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
export async function scriptAiFixture(phase:'before'|'after'|'pending'='before'){
 // 기존 준비 경로로 실제 야영지 관찰과 정착지 입장까지 마친 원래 세계이다.
 const base=bountyContractsFixture('script-ai-actual'),loaded=loadDb(['sample-script-ai']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:deserialize(serialize(base.w.s))},s=w.s,m=s.overworld!,p=player(w);s.mods=[...loaded.db.loadedMods];initializeScriptState(w)
 const allIds=()=>[...s.creatures,...Object.values(s.offCreatures).flat(),...Object.values(m.scenes).flatMap(scene=>[...scene.creatures,...Object.values(scene.offCreatures).flat()])].map(c=>c.id).sort((a,b)=>a-b),originalActors=allIds(),originalNextId=s.nextId
 const camp=m.scenes['Region.GreyCloister'],actor=camp.creatures.find(c=>c.alive&&c.def==='Creature.Reaver')!,target=s.creatures.find(c=>c.alive&&c.def==='Creature.SettlementGuard')!;if(!actor||!target)throw Error('original finite camp actor/town guard missing')
 // 기존 두 사람의 현재 장소/근접 위치/조명/차례를 별도 초기 조건으로 선언한다. 침입 여행·변절·전투를 실행했다고 주장하지 않는다.
 let anchor:{x:number;y:number}|undefined
 for(let y=3;y<s.map.h-3&&!anchor;y++)for(let x=3;x<s.map.w-3;x++)if([[x,y],[x+1,y],[x+1,y-1],[x,y-1]].every(([tx,ty])=>{const tile=s.map.tiles[ty*s.map.w+tx],t=w.db.terrain(tile.t);return t.passable&&!t.water&&!tile.placed&&!tile.cont&&!s.creatures.some(c=>c.alive&&c!==p&&c!==target&&c.pos.x===tx&&c.pos.y===ty)})){anchor={x,y};break}
 if(!anchor)throw Error('original town open encounter patch unavailable')
 camp.creatures.splice(camp.creatures.indexOf(actor),1);s.creatures.push(actor);actor.mapId=s.map.id;p.pos={...anchor};actor.pos={x:anchor.x+1,y:anchor.y};target.pos={x:anchor.x+1,y:anchor.y-1};actor.home=undefined
 for(const c of s.creatures){c.nextAct=s.time+2*1200*100;c.asleep=false;c.needs.kcal=1000;c.needs.waterDeficit=0;c.needs.fatigue=10;c.needs.bodyTemp=37}
 for(const c of[actor,target]){c.activity=undefined;c.ai.route=undefined;c.ai.path=undefined;c.ai.task=undefined;c.ai.mode='guard';c.ai.morale=1}
 actor.nextAct=s.time;p.nextAct=s.time;s.map.ambient=1;s.storyteller.budget=-1e9;invalidateLights(w);updatePlayerVision(w,p)
 if(JSON.stringify(allIds())!==JSON.stringify(originalActors)||s.nextId!==originalNextId)throw Error('original finite actor/UID ledger changed during declared setup')
 const initialPlayerBody=structuredClone(p.body),initialTargetBody=structuredClone(target.body),initialActorBody=structuredClone(actor.body)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof={phase,modId:'sample-script-ai',originalActors,originalNextId,actorId:actor.id,targetId:target.id,initialPlayerBody,initialTargetBody,initialActorBody,sourceHash:w.db.scriptModules[0].hash,declaredInitialOriginalCampActorInTownAndEncounterPositionsLightSchedules:true,noClaimOfActualRaidJourneyAllegianceChangeOrEarlierBattle:true,actualUiWaitsPlanned:1}
 if(phase!=='before')act({type:'wait'})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{w,s,p,actor,target,act,proof:{...proof,initialRendererFx:s.fx.splice(0)}}
}

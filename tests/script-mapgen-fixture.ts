import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {newGame,playerAct,runUntilInput,markCleared} from '../src/core/game'
import {leaveRegion} from '../src/core/journey'
import {player,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {dirIndex} from '../src/core/geom'
export async function scriptMapgenFixture(phase:'before'|'entered'|'walked'|'pending'='before'){
 const loaded=loadDb(['sample-script-mapgen']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-mapgen-entry',background:'Bg.Hunter',overworld:true})};runUntilInput(w);w.s=deserialize(serialize(w.s));const s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(site=>site.id==='Region.ShadeGrove')!;if(!site)throw Error('original authored forest site missing')
 const originalActors=s.creatures.map(c=>c.id),birthNextId=s.nextId
 // 원래 세계의 도로/입구 초기 조건만 준비한다. 실제 지역간 여정을 실행했다고 주장하지 않는다.
 p.pos={...s.map.exits[0]};leaveRegion(w,markCleared);m.position={...site.cell};leaveRegion(w,markCleared)
 p.nextAct=s.time;p.needs.kcal=2000;p.needs.waterDeficit=0;p.needs.fatigue=10;p.needs.bodyTemp=37;s.storyteller.budget=-1e9;invalidateLights(w);updatePlayerVision(w,p)
 if(s.scriptState?.mods['sample-script-mapgen'])throw Error('actual target generated before entry')
 const originalNextId=s.nextId,initialPeople=[...s.creatures,...Object.values(m.scenes).flatMap(scene=>scene.creatures)].map(c=>c.id);if(originalActors.some(id=>!initialPeople.includes(id)))throw Error('original residents lost in declared road setup')
 let actualWalkAttempts=0
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof={phase,modId:'sample-script-mapgen',sourceHash:w.db.scriptModules[0].hash,originalActors,originalNextId,birthNextId,site:site.id,declaredInitialRoadAtAuthoredForestAndEntrySchedule:true,noClaimOfActualWorldJourneyOrPreviousForestGeneration:true}
 if(phase!=='before')act({type:'enterRegion'})
 if(phase==='walked'){const changed=(s.scriptState!.mods['sample-script-mapgen']as {changed:{x:number;y:number}}).changed;while((p.pos.x!==changed.x||p.pos.y!==changed.y)&&actualWalkAttempts<8){act({type:'move',dir:dirIndex(changed.x-p.pos.x,changed.y-p.pos.y)});actualWalkAttempts++}if(p.pos.x!==changed.x||p.pos.y!==changed.y)throw Error('actual mud movement attempts exhausted')}
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{w,s,p,act,proof:{...proof,actualWalkAttempts,initialRendererFx:s.fx.splice(0)}}
}

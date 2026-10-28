import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {deserialize,serialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export async function scriptPlaceKindsFixture(phase:'before'|'queued'|'departed'|'returned'|'pending'='before'){
 const loaded=loadDb(['sample-script-place-kind']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-new-source-event-return',background:'Bg.Hunter',overworld:true})};runUntilInput(w);w.s=deserialize(serialize(w.s));const s=w.s,p=player(w),originalActors=s.creatures.map(c=>c.id),originalNextId=s.nextId,source=s.sources!.find(source=>source.id==='reaverCamp')!
 const originalPeople=structuredClone(s.creatures)
 // 날짜 경계 직전의 초기 일정만 선언한다. 실제6시간 대기/새 인원 생성/야영지 목격을 주장하지 않는다.
 s.time=(TURNS_PER_DAY-1)*100;for(const c of s.creatures)c.nextAct=s.time
 p.needs.kcal=2500;p.needs.waterDeficit=0;p.needs.fatigue=10;p.needs.bodyTemp=37;s.storyteller.budget=-1e9;invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 let actualWaits=0
 if(['queued','departed','returned'].includes(phase)){act({type:'wait'});actualWaits++}
 if(['departed','returned'].includes(phase)){act({type:'wait'});actualWaits++}
 if(phase==='returned'){while(!(s.scriptState!.mods['sample-script-place-kind']as {resolutions?:number})?.resolutions&&actualWaits<240){act({type:'wait'});actualWaits++}if(!(s.scriptState!.mods['sample-script-place-kind']as {resolutions?:number})?.resolutions)throw Error('actual original party has not returned within bounded real waits')}
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{w,s,p,source,act,proof:{phase,event:'Sample.Event.CampCircuit',modId:'sample-script-place-kind',sourceHash:loaded.db.scriptModules[0].hash,originalActors,originalNextId,originalPeople,originalSourceMembers:[...source.members!],declaredInitialScheduleOnly:true,noClaimOfActualSixHourWaitOrPlayerWitnessAtCamp:true,actualWaits,initialRendererFx:s.fx.splice(0)}}
}

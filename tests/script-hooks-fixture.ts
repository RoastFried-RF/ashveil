import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export async function scriptHooksFixture(phase:'before'|'after'|'pending'='before',modId='sample-script-hooks'){
 const loaded=loadDb([modId]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-script-day',background:'Bg.Hunter',overworld:true})};runUntilInput(w)
 // 초기 각인 형식의 사본으로 준비한다. 기존 로더가 채우는 지역 기본 필드까지 포함한다.
 w.s=deserialize(serialize(w.s));const s=w.s,p=player(w)
 // 자정 직전의 별도 초기 조건이다.6시간을 실제로 기다렸다고 주장하지 않는다.
 s.time=TURNS_PER_DAY*100-100;p.nextAct=s.time
 for(const c of s.creatures)if(c!==p){c.asleep=true;c.needs.fatigue=100;c.nextAct=s.time+2*1200*100}
 p.needs.kcal=1000;p.needs.waterDeficit=0;p.needs.fatigue=10;p.needs.bodyTemp=37;s.storyteller.budget=-1e9;invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof={phase,declaredInitialMidnightBoundaryAndOriginalNpcSchedule:true,noClaimOfSixHourWait:true,originalActors:s.creatures.map(c=>c.id),originalNextId:s.nextId,sourceHash:w.db.scriptModules[0].hash}
 if(phase!=='before')act({type:'wait'})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{w,s,p,act,proof:{...proof,initialRendererFx:s.fx.splice(0)}}
}

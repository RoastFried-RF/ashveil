import{createQuickJSScriptHost}from'../src/scripting/quickjs'
import{configureScriptHost,runScriptHooks}from'../src/core/script-hooks'
import{loadMods,type ModPackage}from'../src/core/defs'
import{readPackages}from'../tools/loadContent'
import{newGame,runUntilInput}from'../src/core/game'
import{turnOf}from'../src/core/ctx'
export const removedScript='removed-owned-script'
export const scriptPackage=(id=removedScript):ModPackage=>({manifest:{id,name:'제거할 실제 소유 스크립트',version:'1.0.0',dependencies:['core'],scripts:{stage:1,entry:'scripts/main.js'}},defs:[],patches:[],scripts:[{file:'scripts/main.js',source:'export default defineMod({hooks:{onDayStart(ctx){ctx.modState.calls=(ctx.modState.calls??0)+1;ctx.modState.roll=ctx.rng.int(1,100);return [ctx.cmd.queueEvent("Event.ReaverPatrol",100,ctx.view.creatures.find(c=>c.id===ctx.view.playerId).pos)]}}})'}]})
/** 정상 새 세계/실제 격리 훅 한 호출. 선언된 시작 훅이며 지난 하루를 실행했다고 주장하지 않는다. */
export async function scriptContentFixture(survivor=false){
 const host=await createQuickJSScriptHost(),packages=[...readPackages(),scriptPackage(),...(survivor?[scriptPackage('remaining-owned-script')]:[])],selected=[removedScript,...survivor?['remaining-owned-script']:[]],loaded=loadMods(packages,selected)
 if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));const errors=configureScriptHost(loaded.db,host);if(errors.length)throw Error(errors.join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-script-content-removal',overworld:true})};runUntilInput(w);runScriptHooks(w,'onDayStart',{dayIndex:Math.floor(turnOf(w)/28800)})
 const current=loadMods(packages,survivor?['remaining-owned-script']:[]).db;if(survivor){const errors=configureScriptHost(current,host);if(errors.length)throw Error(errors.join('\n'))}
 return{w,current,host,packages}
}

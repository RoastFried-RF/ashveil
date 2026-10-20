import {botDecide} from '../src/core/bot'
import {player,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {stateHash} from '../src/core/save'
import {GAME_VERSION,DEF_SCHEMA_VERSION,loadMods,type ModPackage} from '../src/core/defs'
import {stateStorytellers} from '../src/core/missing-events'
import {attachQuickJSScripts} from '../src/scripting/attach'

export interface SimulationOptions {seed:string;mods:string[];days:number;bots:number;overworld:boolean;background?:string;storyteller?:string;characterRoll:0|1}
export function validateSimulationOptions(options:SimulationOptions){
 if(typeof options.seed!=='string'||!options.seed.length||options.seed.length>2048||!Number.isFinite(options.days)||Math.floor(options.days*TURNS_PER_DAY*100)<1||!Number.isSafeInteger(Math.floor(options.days*TURNS_PER_DAY*100))||!Number.isSafeInteger(options.bots)||options.bots<1||options.bots>1000||!Array.isArray(options.mods)||options.mods.some(mod=>typeof mod!=='string'||!mod.length)||new Set(options.mods).size!==options.mods.length||![0,1].includes(options.characterRoll))throw Error('실제 시드·1TU 이상의 양의 일수·봇1~1000·겹치지 않는 모드·재굴림0/1을 지정해야 한다')
}
export async function simulateContent(packages:ModPackage[],options:SimulationOptions){
 validateSimulationOptions(options)
 const{db,report}=loadMods(packages,options.mods);if(report.errors.length)throw Error('시뮬레이션 모드 검증 실패:\n'+report.errors.join('\n'))
 await attachQuickJSScripts(db)
 const rows:{seed:string;cause:string;days:number;level:number;map:string;background?:string;initialHash:string;hash:string;events:Record<string,number>;decisions:number;startTU:number;endTU:number;actualTU:number;scriptErrors:NonNullable<World['s']['scriptState']>['errors'];scriptDisabled:string[]}[]=[],causes:Record<string,number>={},events:Record<string,number>={}
 for(let bot=0;bot<options.bots;bot++){
  const seed=options.bots===1?options.seed:options.seed+':'+bot,s=newGame(db,{seed,background:options.background,storyteller:options.storyteller,characterRoll:options.characterRoll,overworld:options.overworld,mods:db.loadedMods}),w:World={db,s}
  runUntilInput(w);const initialHash=stateHash(s),startTU=s.time,endTU=startTU+Math.max(1,Math.floor(TURNS_PER_DAY*options.days*100));if(!Number.isSafeInteger(endTU))throw Error('지정한 종료 시각이 안전한 정수 범위를 넘었다')
  const recorded=new WeakSet<object>(),counts:Record<string,number>={}
  const countEvents=()=>{for(const state of stateStorytellers(s))for(const event of state.history)if(!recorded.has(event)){recorded.add(event);counts[event.event]=(counts[event.event]??0)+1}}
  countEvents();let actions=0
  while(!s.over&&s.time<endTU&&actions<150000){actions++;const error=playerAct(w,botDecide(w),undefined,endTU);if(error)playerAct(w,{type:'wait'},undefined,endTU);countEvents()}
  if(!s.over&&s.time<endTU)throw Error(seed+': 행동 상한 초과. 생존으로 집계하지 않는다')
  if(s.time>endTU)throw Error(seed+': 지정 종료 시각을 넘었다')
  const cause=s.over?(s.over.kind==='escape'?'탈출':s.over.kind==='retire'?'은퇴':s.over.report.cause):'생존(시간 종료)',p=player(w)
  causes[cause]=(causes[cause]??0)+1;for(const[id,count]of Object.entries(counts))events[id]=(events[id]??0)+count
  rows.push({seed,cause,days:(s.time-startTU)/(TURNS_PER_DAY*100),level:p.level,map:s.map.id,background:p.background,initialHash,hash:stateHash(s),events:counts,decisions:actions,startTU,endTU,actualTU:s.time,scriptErrors:structuredClone(s.scriptState?.errors??[]),scriptDisabled:[...s.scriptState?.disabled??[]]})
 }
 return{gameVersion:GAME_VERSION,defSchemaVersion:DEF_SCHEMA_VERSION,loadHash:db.loadHash,mods:db.modManifest(),overworld:options.overworld,maxDays:options.days,bots:options.bots,averageDays:rows.reduce((sum,row)=>sum+row.days,0)/rows.length,causes,events,rows,warnings:report.warnings}
}

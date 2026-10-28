import {supportsQueuedPlaceEvent,placeEventRule} from './place-event-rules'
import {calendar} from './climate-state'
import {TURNS_PER_DAY} from './ctx'
import {clamp,log,player,rng,turnOf,type World} from './ctx'
import type {DefDatabase} from './defs'
import {allowedScriptCommands,applyScriptCommands,scriptWoundDepth} from './script-commands'
import {dispatchScriptPlaceEvent} from './storyteller'
import {validScriptJson,type ScriptCall,type ScriptHook,type ScriptHost,type ScriptJson,type ScriptState} from './script-contracts'
export function configureScriptHost(db:DefDatabase,host:ScriptHost){
 const modules:DefDatabase['scriptModules']=[],errors:string[]=[]
 if(db.scriptSources.length>32)return['스크립트 모드는32개까지 지원한다']
 for(const source of db.scriptSources){const result=host.inspect(source);if(result.ok)modules.push(result.module);else errors.push(source.modId+': '+result.reason)}
 for(const event of db.all<import('./types').PlaceEventDef>('PlaceEvent'))if(event.worker){
  if(typeof event.worker!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(event.worker)){errors.push(event.id+': 올바른 장소 사건 worker 참조가 필요하다');continue}
  const [modId,name,...extra]=event.worker.split(':'),module=modules.find(m=>m.modId===modId)
  if(extra.length||!name||!module?.workers?.some(w=>w.name===name&&w.kind==='PlaceEventWorker')||!host.invokeWorker||!['Event.ReaverPatrol','Event.ReaverSearch'].includes(event.id)&&(event.origin?.kind!=='camp'||!Array.isArray(event.place?.route)||event.place.route.at(-1)!=='@home'))errors.push(event.id+': 실제 등록된 원래 출발지/귀환 경로의 장소 사건 워커가 필요하다: '+event.worker)
 }
 for(const creature of db.all<import('./types').CreatureDef>('Creature'))if(creature.considerationWorker){
  const ref=creature.considerationWorker;if(typeof ref!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(ref)){errors.push(creature.id+': 올바른 AI 워커 참조가 필요하다');continue}
  const [modId,name]=ref.split(':'),module=modules.find(m=>m.modId===modId)
  if(!module?.workers?.some(w=>w.name===name&&w.kind==='AIConsiderationWorker')||!host.invokeWorker)errors.push(creature.id+': 실제 등록 AI 목표 워커가 필요하다: '+ref)
 }
 for(const item of db.all<import('./types').ItemDef>('Item'))if(item.compWorker){
  const ref=item.compWorker;if(typeof ref!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(ref)){errors.push(item.id+': 올바른 아이템 워커 참조가 필요하다');continue}
  const [modId,name]=ref.split(':'),module=modules.find(m=>m.modId===modId)
  if(!module?.workers?.some(w=>w.name===name&&w.kind==='ItemCompWorker')||!host.invokeWorker)errors.push(item.id+': 실제 등록 아이템 워커가 필요하다: '+ref)
 }
 for(const layout of db.all<import('./types').RegionLayoutDef>('RegionLayout'))if(layout.genWorker){
  const ref=layout.genWorker;if(typeof ref!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(ref)){errors.push(layout.id+': 올바른 지도 생성 워커 참조가 필요하다');continue}
  const [modId,name]=ref.split(':'),module=modules.find(m=>m.modId===modId)
  if(!module?.workers?.some(w=>w.name===name&&w.kind==='MapGenStepWorker')||!host.invokeWorker)errors.push(layout.id+': 실제 등록 지도 생성 워커가 필요하다: '+ref)
 }
 for(const config of db.all<import('./types').WorldGenDef>('WorldGen'))for(const ref of Object.values(config.mapWorkers??{})){
  if(typeof ref!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(ref)){errors.push(config.id+': 올바른 지상/던전 지도 워커 참조가 필요하다');continue}
  const [modId,name]=ref.split(':'),module=modules.find(m=>m.modId===modId)
  if(!module?.workers?.some(w=>w.name===name&&w.kind==='MapGenStepWorker')||!host.invokeWorker)errors.push(config.id+': 실제 등록 지상/던전 지도 워커가 필요하다: '+ref)
 }
 if(!errors.length){db.scriptModules=modules;db.scriptHost=host}
 return errors
}
export function initializeScriptState(w:World){
 if(!w.db.scriptSources.length)return
 if(!w.db.scriptHost||w.db.scriptModules.length!==w.db.scriptSources.length)throw Error('선택한 스크립트 모드의 격리 실행기를 먼저 준비해야 한다')
 const hashes=Object.fromEntries(w.db.scriptModules.map(m=>[m.modId,m.hash]))
 if(w.s.scriptState){
  const old=w.s.scriptState.hashes
  if(Object.keys(old).length!==Object.keys(hashes).length||Object.entries(hashes).some(([id,hash])=>old[id]!==hash))throw Error('저장된 스크립트 구성과 현재 소스가 다르다. 같은 모드 버전과 소스로 이어야 한다')
  return
 }
 const c=calendar(w);w.s.scriptState={hashes,mods:{},disabled:[],errors:[],lastDay:Math.floor(turnOf(w)/TURNS_PER_DAY),lastSeason:c.year+':'+c.season.id}
}
export function disableScriptCall(w:World,modId:string,hook:ScriptCall,reason:string){
 const state=w.s.scriptState!,key=modId+':'+hook
 if(state.disabled.includes(key))return
 state.disabled.push(key);state.errors.push({modId,hook,at:turnOf(w),reason:reason.slice(0,160)});if(state.errors.length>32)state.errors.splice(0,state.errors.length-32)
 log(w,'warn',`선택한 모드의 동작을 중단했다: ${modId} / ${hook}. ${reason}`)
}
/** 미리보기는 난수·저장 데이터·오류/로그를 쓰지 않는다. 유효한 실제 호출만 한 번 적용한다. */
export function scriptContextView(w:World,event:Record<string,ScriptJson>){
 const ids=[w.s.playerId,...['actorId','ownerId','targetId'].flatMap(key=>typeof event[key]==='number'?[event[key]as number]:[]),...(Array.isArray(event.actorIds)?event.actorIds.filter((id):id is number=>typeof id==='number'&&Number.isSafeInteger(id)):[])],targets=new Set(ids),actors=w.s.creatures.filter(c=>targets.has(c.id)).sort((a,b)=>a.id-b.id).map(c=>({id:c.id,def:c.def,faction:c.faction,alive:c.alive,hp:c.hp,pos:{...c.pos}})),view={playerId:w.s.playerId,turn:turnOf(w),mapId:w.s.map.id,regionId:w.s.overworld?.currentRegion??'local',queueableEvents:w.s.map.kind==='surface'?w.db.all<import('./types').PlaceEventDef>('PlaceEvent').filter(e=>supportsQueuedPlaceEvent(w,e.id)&&!!w.s.map.waypoints?.[placeEventRule(w,e.id)!.origin.waypoint]).map(e=>e.id).sort().slice(0,32):[],creatures:actors}
 return{targets,view}
}
export function runScriptHooks(w:World,hook:ScriptHook,event:Record<string,ScriptJson>,preview=false){
 if(!w.db.scriptModules.length||!w.db.scriptHost)return 0
 const {targets,view}=scriptContextView(w,event)
 let modifier=0
 for(const module of w.db.scriptModules){
  if(!module.hooks.includes(hook)||w.s.scriptState?.disabled.includes(module.modId+':'+hook))continue
  const state=w.s.scriptState?.mods[module.modId]??{}
  if(!validScriptJson(state)){if(!preview){initializeScriptState(w);disableScriptCall(w,module.modId,hook,'저장된 모드 데이터 형식 오류')}continue}
  const key=`mod.${module.modId}.${hook}`as const,prior=w.s.rng[key],shadow:World={db:w.db,s:{...w.s,rng:{...w.s.rng,...(prior?{[key]:[...prior]}:{})}}},inputRng=rng(shadow,key).s
  const result=w.db.scriptHost.invoke({module,hook,event,view,state,rng:inputRng})
  if(!result.ok){if(!preview){initializeScriptState(w);disableScriptCall(w,module.modId,hook,result.reason)}continue}
  const numeric=hook==='modifyHitChance'
  if(!validScriptJson(result.state)||!validScriptJson(result.result)||numeric&&(typeof result.result!=='number'||!Number.isSafeInteger(result.result))){if(!preview){initializeScriptState(w);disableScriptCall(w,module.modId,hook,'명령 또는 저장 데이터 형식 오류')}continue}
  const commands=numeric?[]:allowedScriptCommands(w,result.result,targets,scriptWoundDepth(w))
  if(!commands){if(!preview){initializeScriptState(w);disableScriptCall(w,module.modId,hook,'허용하지 않는 명령 또는 대상')}continue}
  if(numeric)modifier+=clamp(result.result as number,-30,30)
  if(!preview){initializeScriptState(w);const saved=w.s.scriptState as ScriptState;saved.mods[module.modId]=result.state;w.s.rng[key]=[...result.rng];applyScriptCommands(w,commands,module.modId)}
 }
 return modifier
}
export function scriptActorEvent(w:World,id:number){const c=w.s.creatures.find(c=>c.id===id);return c?{ownerId:c.id,def:c.def}:undefined}
export function scriptPlayerEvent(w:World){return{ownerId:player(w).id}}

export function scriptDayTick(w:World){
 if(!w.db.scriptModules.length)return
 initializeScriptState(w);const saved=w.s.scriptState!,dayIndex=Math.floor(turnOf(w)/TURNS_PER_DAY),c=calendar(w),season=c.year+':'+c.season.id
 if(saved.lastDay!==dayIndex){saved.lastDay=dayIndex;runScriptHooks(w,'onDayStart',{day:c.day,year:c.year,dayIndex})}
 if(saved.lastSeason!==season){saved.lastSeason=season;runScriptHooks(w,'onSeasonStart',{season:c.season.id,year:c.year,day:c.day})}
 scriptEventTick(w)
}

export function scriptPlaceEvent(w:World,event:string,actors:number[]){
 if(!w.db.scriptModules.length)return
 const actual=[...new Set(actors)].filter(id=>w.s.creatures.some(c=>c.id===id&&c.alive)).sort((a,b)=>a-b)
 if(!actual.length)return
 initializeScriptState(w);const saved=w.s.scriptState!;let runId=0
 if(w.db.scriptModules.some(m=>m.hooks.includes('onEventResolved'))){
  const runs=saved.eventRuns??=[]
  if(runs.length<32){runId=saved.eventSequence=(saved.eventSequence??0)+1;runs.push({id:runId,event,mapId:w.s.map.id,region:w.s.overworld?.currentRegion,actors:actual,at:turnOf(w)})}
 }
 runScriptHooks(w,'onEventFired',{event,runId,actorIds:actual,members:actual.length})
}
/** 같은 인원이 실제 마지막 귀환 경유지에 도착한 순간만 기록한다. */
export function scriptPlaceActorReturned(w:World,event:string,actorId:number){
 const runs=w.s.scriptState?.eventRuns;if(!runs?.length)return
 const actor=w.s.creatures.find(c=>c.id===actorId);if(!actor?.alive||actor.captivity||actor.companion||actor.ai.mode==='surrender'||!actor.home||Math.max(Math.abs(actor.pos.x-actor.home.x),Math.abs(actor.pos.y-actor.home.y))>1)return
 for(const run of runs)if(run.event===event&&run.mapId===w.s.map.id&&run.region===w.s.overworld?.currentRegion&&run.actors.includes(actorId)){
  const returned=run.returnedActors??=[];if(!returned.includes(actorId)){returned.push(actorId);returned.sort((a,b)=>a-b)}
 }
}
export function scriptEventTick(w:World){
 const queue=w.s.scriptState?.queuedEvents
 if(queue?.length){for(const pending of [...queue]){if(pending.at>turnOf(w)||pending.mapId!==w.s.map.id||pending.region!==w.s.overworld?.currentRegion)continue;queue.splice(queue.indexOf(pending),1);dispatchScriptPlaceEvent(w,pending.event,pending.pos)}}
 const runs=w.s.scriptState?.eventRuns;if(!runs?.length)return
 for(const run of[...runs]){
  if(run.mapId!==w.s.map.id||run.region!==w.s.overworld?.currentRegion||run.at>=turnOf(w))continue
  const actors=run.actors.map(id=>w.s.creatures.find(c=>c.id===id))
  if(actors.some((c,i)=>!run.returnedActors?.includes(run.actors[i])&&(!c||c.alive&&!c.captivity&&!c.companion&&c.ai.mode!=='surrender'&&(c.ai.route?.length||c.ai.task||!c.home||Math.max(Math.abs(c.pos.x-c.home.x),Math.abs(c.pos.y-c.home.y))>1))))continue
  runs.splice(runs.indexOf(run),1)
  runScriptHooks(w,'onEventResolved',{event:run.event,runId:run.id,actorIds:run.actors,returned:actors.filter((c,i)=>run.returnedActors?.includes(run.actors[i])||c?.alive&&!c.captivity&&!c.companion&&c.ai.mode!=='surrender').length})
 }
}

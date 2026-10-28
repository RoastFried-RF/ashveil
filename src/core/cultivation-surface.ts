// 실제 이탈 때 남긴 지역 날씨에서만 재생한다. 현재 날씨·다른 셀의 난수는 빌리지 않는다.
import {turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {cultivationStatus,prepareSurfaceCultivation} from './cultivation'
import {ambientTemp,regionalWeatherAt} from './environment'
import {climateDef} from './climate-state'
import {seedState} from './rng'
import type {CultivationState,MapState,SurfaceCultivationState,TerrainDef,Weather,WorldGenDef} from './types'

const weathers:readonly Weather[]=['clear','overcast','ashrain','deepOvercast','ashstorm','ashsnow','ashgale','frostfog']
function signature(w:World,map:MapState){return JSON.stringify([w.s.seed,map.w,map.h,map.worldCell,map.daylightMult,map.tiles.flatMap((tile,i)=>tile.cultivation?[[i,tile.t,tile.roof,tile.cultivation]]:[])])}
const streamOf=(cell:SurfaceCultivationState['cell'])=>`world.weather.${cell.x},${cell.y}` as const
/** 정지 탑이 없는 일정한 날씨/날짜/일교차 구간의 기온은 선형이다(0.1°C 반올림 포함). */
function linearUntil(w:World,now:number,turn:number,boundaries:Set<number>){
 if(boundaries.has(turn)||w.s.overworld!.towers.some(t=>!!t.shutdown))return turn
 const day=Math.floor(turn/TURNS_PER_DAY)*TURNS_PER_DAY
 let end=Math.min(now,w.s.weatherUntil-1,day+TURNS_PER_DAY-1)
 for(const [hour]of climateDef(w).diurnal){const knot=Math.ceil(day+hour*TURNS_PER_HOUR);if(knot>turn)end=Math.min(end,knot-1)}
 for(const at of boundaries)if(at>turn)end=Math.min(end,at-1)
 return end
}
function coldUntil(w:World,now:number,turn:number,boundaries:Set<number>,minimum:number){
 if(ambientTemp(w)>=minimum)return turn
 const end=linearUntil(w,now,turn,boundaries);if(end<=turn)return turn
 const endpoint:World={db:w.db,s:{...w.s,time:end*100}}
 return ambientTemp(endpoint)<minimum?end:turn
}
/** 성숙한 밭의 비 없는 구간: 정수 증발만 합산하고 다음 토양 이동 경계는 직접 실행한다. */
function matureUntil(w:World,now:number,turn:number,boundaries:Set<number>,plots:CultivationState[],rules:TerrainDef[],roofs:boolean[]){
 const gen=w.db.all<WorldGenDef>('WorldGen')[0],every=gen?.cropSoilDiffusion?.everyTurns
 let end=linearUntil(w,now,turn,boundaries)
 if(every)end=Math.min(end,(Math.floor(turn/every)+1)*every-1)
 if(end<=turn)return turn
 const warm=ambientTemp(w)>0,endpoint:World={db:w.db,s:{...w.s,time:end*100}}
 if((ambientTemp(endpoint)>0)!==warm)return turn
 const rates=rules.map((rule,i)=>warm&&!roofs[i]?(gen?.cropEvaporationMlPerHour??0)*rule.gather!.regrowTurns!:0)
 if(rates.some((rate,i)=>!Number.isSafeInteger(rate)||!Number.isSafeInteger(rate*(end-turn)+(plots[i].evaporationCarry??0))))return turn
 for(let i=0;i<plots.length;i++){
  const plot=plots[i],rate=rates[i]
  if(plot.waterUnits>0&&rate>0){const loss=(plot.evaporationCarry??0)+rate*(end-turn),carry=loss%1200;plot.waterUnits-=Math.min(plot.waterUnits,Math.floor(loss/1200));if(plot.waterUnits>0&&carry)plot.evaporationCarry=carry;else delete plot.evaporationCarry}
  plot.lastAt=end
 }
 return end
}
function valid(w:World,map:MapState,state:SurfaceCultivationState,leftAt:number){
 const now=turnOf(w),m=w.s.overworld,p=state.cell
 return !!m&&map.kind==='surface'&&Number.isSafeInteger(state.at)&&state.at>=0&&state.at>=leftAt&&state.at<=now&&!!p&&Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<m.w&&p.y<m.h&&p.x===map.worldCell?.x&&p.y===map.worldCell.y&&weathers.includes(state.weather)&&Number.isSafeInteger(state.until)&&state.until>state.at&&!!state.wind&&[state.wind.x,state.wind.y].every(n=>Number.isInteger(n)&&Math.abs(n)<=1)&&Array.isArray(state.rng)&&state.rng.length===4&&state.rng.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff)&&state.loadHash===w.db.loadHash&&state.signature===signature(w,map)
}
/** 성공한 실제 이탈 경로에서만 호출한다. 구형 정지 밭의 과거 이력을 만들지 않는다. */
export function markSurfaceCultivation(w:World,map:MapState){
 delete map.surfaceCultivation
 if(map.kind!=='surface'||map.vessel||!w.s.overworld||!map.worldCell)return
 const now=turnOf(w),view:World={db:w.db,s:{...w.s,map}}
 let found=false
 for(let i=0;i<map.tiles.length;i++){
  const state=map.tiles[i].cultivation;if(!state)continue
  const d=cultivationStatus(view,{x:i%map.w,y:Math.floor(i/map.w)})
  if(d?.valid){state.dormantAt=now;found=true}else delete state.dormantAt
 }
 if(!found)return
 const cell={...map.worldCell},stream=streamOf(cell)
 // 현재 하늘은 이미 정상 weatherTick/지역 저장에서 동기화된 실제 이탈 시점이다.
 if(!Number.isSafeInteger(w.s.weatherUntil)||w.s.weatherUntil<=now)return
 map.surfaceCultivation={at:now,cell,weather:w.s.weather,until:w.s.weatherUntil,wind:{...w.s.wind},rng:[...(w.s.rng[stream]??seedState(w.s.seed,stream))],loadHash:w.db.loadHash,signature:signature(w,map)}
}
/** 인물·수확·주민 노동을 재생하지 않고 원래 밭의 물/성장/오염만 정산한다. */
export function settleSurfaceCultivation(w:World,map:MapState,leftAt:number){
 const state=map.surfaceCultivation,now=turnOf(w)
 if(!state||!Number.isSafeInteger(leftAt)||leftAt<0||!valid(w,map,state,leftAt)||now===state.at)return
 const stream=streamOf(state.cell),key=`${state.cell.x},${state.cell.y}`
 // 다른 곳에서 같은 셀의 날씨가 먼저 진행됐더라도 이 복사본만 재생한다.
 const rng={...w.s.rng,[stream]:[...state.rng] as SurfaceCultivationState['rng']}
 const replayMap={...map,tiles:map.tiles.map(tile=>tile.cultivation&&tile.cultivation.dormantAt!==state.at?{...tile,cultivation:undefined}:tile)}
 const view:World={db:w.db,s:{...w.s,map:replayMap,time:state.at*100,rng,overworld:{...w.s.overworld!,weatherCells:{[key]:{weather:state.weather,until:state.until,wind:{...state.wind}}}},weather:state.weather,weatherUntil:state.until,wind:{...state.wind}}}
 const plots=replayMap.tiles.flatMap(tile=>tile.cultivation?[tile.cultivation]:[])
 const roofs=replayMap.tiles.flatMap(tile=>tile.cultivation?[tile.roof]:[])
 const rules=replayMap.tiles.flatMap(tile=>tile.cultivation?[w.db.terrain(tile.t)]:[]),minimum=Math.min(0,...rules.map(d=>d.cultivation!.minTemp))
 const boundaries=new Set([...w.s.overworld!.towers.flatMap(t=>[...(t.history??[]).map(entry=>entry.turn),...(t.shutdown?[t.shutdown.turn]:[])]),...(w.s.overworld!.surges??[]).map(surge=>surge.turn??surge.day*TURNS_PER_DAY)])
 const tick=prepareSurfaceCultivation(view)
 for(let turn=state.at+1;turn<=now;turn++){
  view.s.time=turn*100
  // 장치 완료는 그 턴의 globalTurnTick/재배 뒤다. 이후 턴부터 실제 이력을 쓴다.
  // 계절/정지 후 경과는 현재 turn으로 유지해 연속 변화까지 한 턴 늦추지 않는다.
  view.climateHistoryCutoff=boundaries.has(turn)?turn-1:undefined
  if(turn>=view.s.weatherUntil){const weather=regionalWeatherAt(view,state.cell);view.s.weather=weather.weather;view.s.weatherUntil=weather.until;view.s.wind=weather.wind}
  tick()
  // 모든 밭이 말랐고 비도 없다면 햇빛·기온·토양 확산은 자원을 바꾸지 못한다.
  // 다음 실제 날씨 경계는 반드시 실행한다. 경계를 넘겨 현재 하늘로 추정하지 않는다.
  const rain=view.s.weather==='ashrain'||view.s.weather==='ashstorm'
  const mature=plots.every((plot,i)=>plot.growth>=rules[i].gather!.regrowTurns!),full=plots.every((plot,i)=>plot.waterUnits===rules[i].cultivation!.waterMl*rules[i].gather!.regrowTurns!)
  if(!rain&&plots.every(plot=>plot.waterUnits===0)){
   turn=Math.min(now,view.s.weatherUntil-1)
   for(const plot of plots)plot.lastAt=turn
  }else if(rain&&mature&&full&&rules.every(rule=>rule.cultivation!.waterMl===rules[0].cultivation!.waterMl)){
   turn=Math.min(now,view.s.weatherUntil-1);for(const plot of plots)plot.lastAt=turn
  }else if(!rain&&mature){
   turn=matureUntil(view,now,turn,boundaries,plots,rules,roofs)
  }else if(!rain||full){
   const end=coldUntil(view,now,turn,boundaries,minimum)
   if(end>turn){turn=end;for(const plot of plots)plot.lastAt=turn}
  }
 }
 for(const tile of replayMap.tiles)if(tile.cultivation?.dormantAt===state.at)tile.cultivation.dormantAt=now
 state.at=now;state.weather=view.s.weather;state.until=view.s.weatherUntil;state.wind={...view.s.wind};state.rng=[...rng[stream]];state.signature=signature(w,map)
}

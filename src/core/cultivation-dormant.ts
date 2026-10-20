// 실제 떠난 이후의 일정한 지하 환경만 정산한다. 과거 지상 날씨/주민 작업은 추정하지 않는다.
import {turnOf,type World} from './ctx'
import {cultivationStatus} from './cultivation'
import type {MapState} from './types'
function cropView(w:World,map:MapState){return map===w.s.map?w:{db:w.db,s:{...w.s,map}}as World}
function eligible(d:ReturnType<typeof cultivationStatus>){return !!d?.valid&&d.rule!.minLight===0&&!d.gather!.soilDependent&&d.light===0&&d.temp>=d.rule!.minTemp&&d.temp<=d.rule!.maxTemp&&(d.rule!.maxLight===undefined||d.rule!.maxLight>=0)}
/** 지도/지역을 실제 떠나는 성공한 경로에서만 새 기준 시각을 남긴다. */
export function markDormantCultivation(w:World,map=w.s.map){
 const now=turnOf(w),view=cropView(w,map)
 for(let i=0;i<map.tiles.length;i++){
  const state=map.tiles[i].cultivation;if(!state)continue
  const d=map.kind==='dungeon'?cultivationStatus(view,{x:i%map.w,y:Math.floor(i/map.w)}):undefined
  if(eligible(d))state.dormantAt=now;else delete state.dormantAt
 }
}
/** 한 번의 산술로 실제 물이 공급한 성장만 반영한다. 수확/배지 교체/인물 행동은 하지 않는다. */
export function settleDormantCultivation(w:World,map:MapState,leftAt:number){
 const now=turnOf(w);if(map.kind!=='dungeon'||!Number.isSafeInteger(leftAt)||leftAt<0||leftAt>now)return
 const view=cropView(w,map)
 for(let i=0;i<map.tiles.length;i++){
  const state=map.tiles[i].cultivation
  if(!state||state.dormantAt===undefined)continue
  const d=cultivationStatus(view,{x:i%map.w,y:Math.floor(i/map.w)})
  if(!eligible(d))continue
  const from=Math.max(leftAt,state.dormantAt,state.lastAt),elapsed=now-from
  if(elapsed<=0)continue
  if(!d!.ready&&state.remainingCycles!==0){
   const turns=Math.min(elapsed,Math.floor(state.waterUnits/d!.rule!.waterMl),Math.ceil(d!.total-state.growth))
   state.growth=Math.min(d!.total,state.growth+turns);state.waterUnits-=turns*d!.rule!.waterMl
   if(state.waterUnits===0)delete state.evaporationCarry
  }
  state.lastAt=now;state.dormantAt=now
 }
}

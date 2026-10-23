// 멈춘 분출과 남은 대기 입자는 다르다. 과거 날씨도 같은 이력에서 읽는다.
import { clamp, turnOf, TURNS_PER_DAY, type World } from './ctx'
import type { Pos } from './geom'
import type { SeasonDef, WorldGenDef, WorldTower } from './types'

const distance=(a:Pos,b:Pos)=>Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)
export function towerHistoryOutput(t:WorldTower,cutoff:number){let output=t.history?.[0]?.output??t.output;for(const entry of t.history??[]){if(entry.turn>cutoff)break;output=entry.output}return output}
export function shutdownProgress(t:WorldTower,cutoff:number){return t.shutdown?clamp((cutoff-t.shutdown.turn)/t.shutdown.seasonTurns,0,1):0}
export function atmosphericTowers(w:World,cutoff=turnOf(w),historyCutoff=cutoff):WorldTower[]{
 const towers=w.s.overworld!.towers
 return towers.map(t=>{
  const stopped=t.shutdown&&historyCutoff>=t.shutdown.turn
  let output=stopped?t.shutdown!.startOutput*(1-shutdownProgress(t,cutoff)):towerHistoryOutput(t,historyCutoff)
  if(!stopped)for(const source of towers){const stop=source.shutdown;if(!stop||historyCutoff<stop.turn)continue;const boost=stop.neighborBoosts.find(b=>b.id===t.id);if(boost)output-=boost.amount*(1-shutdownProgress(source,cutoff))}
  return {...t,output:clamp(output,0,100)}
 })
}
export function stoppedVeil(w:World,p:Pos,veil:number,cutoff=turnOf(w)){
 let result=veil
 for(const t of w.s.overworld?.towers??[])if(t.shutdown&&distance(t.cell,p)<=t.shutdown.radius){const progress=shutdownProgress(t,cutoff);result=Math.min(result,veil+(Math.min(veil,t.shutdown.veilTarget)-veil)*progress)}
 return result
}
export function towerSunBonus(w:World,p:Pos,cutoff=turnOf(w)){let bonus=0;for(const t of w.s.overworld?.towers??[])if(t.shutdown&&distance(t.cell,p)<=t.shutdown.radius)bonus=Math.max(bonus,t.shutdown.sunBonus*shutdownProgress(t,cutoff));return bonus}
export function towerClearingProgress(w:World,p:Pos,cutoff=turnOf(w)){let progress=0;for(const t of w.s.overworld?.towers??[])if(t.shutdown&&distance(t.cell,p)<=t.shutdown.radius)progress=Math.max(progress,shutdownProgress(t,cutoff));return progress}
export function towerSoilFertility(w:World,p=w.s.map.worldCell??w.s.overworld?.position,cutoff=turnOf(w)){
 if(!p)return 1
 let fertility=1
 for(const t of w.s.overworld?.towers??[]){const stop=t.shutdown;if(!stop||distance(t.cell,p)>stop.radius)continue;fertility=Math.min(fertility,1-clamp((cutoff-stop.turn-stop.soilDelayTurns)/stop.soilCollapseTurns,0,1))}
 return fertility
}
export function towerGardenAlert(w:World,p=w.s.map.worldCell??w.s.overworld?.position){return p&&w.s.overworld?.towers.some(t=>t.shutdown&&turnOf(w)>=t.shutdown.turn&&distance(t.cell,p)<=t.shutdown.radius)?3:0}
/** 실제 정지 작업 완료 때만 기존 탑/이력에 쓴다. */
export function stopTowerState(w:World,id:string,season:SeasonDef,rules:NonNullable<import('./types').ClimateDef['towerStop']>):boolean{
 const m=w.s.overworld,t=m?.towers.find(t=>t.id===id)
 if(!m||!t||t.shutdown||t.output<=0)return false
 const turn=turnOf(w),scale=w.db.get<WorldGenDef>(m.def).cellKm,year=w.db.all<SeasonDef>('Season').reduce((n,s)=>n+s.lengthDays,0)*TURNS_PER_DAY
 const startOutput=atmosphericTowers(w).find(row=>row.id===id)!.output,neighborBoosts:{id:string;amount:number}[]=[]
 for(const other of m.towers){if(other.id===id||other.shutdown||other.output<=0||distance(t.cell,other.cell)*scale>rules.neighborRadiusKm)continue;const previous=other.output,output=Math.min(100,previous+rules.neighborBoost);if(output===previous)continue;(other.history??=[{turn:0,output:previous}]).push({turn,output});other.output=output;neighborBoosts.push({id:other.id,amount:output-previous})}
 ;(t.history??=[{turn:0,output:t.output}]).push({turn,output:0});t.output=0
 t.shutdown={turn,seasonTurns:season.lengthDays*TURNS_PER_DAY,startOutput,radius:rules.radiusKm/scale,veilTarget:rules.veilTarget,sunBonus:rules.sunBonus,soilDelayTurns:year*rules.soilDelayYears,soilCollapseTurns:year*rules.soilCollapseYears,neighborBoosts}
 m.climateRevision=(m.climateRevision??0)+1
 return true
}

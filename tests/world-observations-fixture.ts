import {makeWorld} from './helpers'
import {player,turnOf} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import {worldIndex} from '../src/core/overworld'
export function worldObservationsFixture(legacy=false){
 const w=makeWorld('world-observations-proof','Bg.Hunter',true),s=w.s,p=player(w),m=s.overworld!,index=worldIndex(m,m.position),old=structuredClone(m.worldObservations![index]!)
 p.pos={...s.map.exits[0]};p.nextAct=s.time;p.traits=[];p.age=undefined;p.effects=[];p.traumas=[];p.needs.kcal=3000;p.needs.waterDeficit=0;p.needs.bodyTemp=37;p.needs.fatigue=10;s.weatherUntil=1e12;s.storyteller.budget=-1e9;for(const c of s.creatures)if(c.id!==p.id)c.nextAct=1e12
 // 유효 초기의 예전 지리 기록과 달라진 현재 지형이다. 이전 관찰/변화 입력을 실행했다고 주장하지 않는다.
 old.at=Math.max(0,turnOf(w)-1200);m.worldObservations![index]=structuredClone(old)
 Object.assign(m.cells[index]!,{biome:old.cell.biome==='Biome.Farmland'?'Biome.Greymoor':'Biome.Farmland',temperature:old.cell.temperature+9,veil:Math.min(100,old.cell.veil+7),road:!old.cell.road})
 if(legacy)delete m.worldObservations
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 return{w,s,p,m,index,old,act}
}
export type WorldObservationsPhase='stale'|'surveyed'|'legacy'|'pending'
export function worldObservationsNativeFixture(phase:WorldObservationsPhase){
 const d=worldObservationsFixture(phase==='legacy'),initialTime=d.s.time
 if(phase==='surveyed'||phase==='pending')d.act({type:'surveyWorld'})
 if(phase==='pending')d.act({type:'rest',turns:20},2)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,index:d.index,initialOldRecordAndChangedWorldExplicit:true}}
}

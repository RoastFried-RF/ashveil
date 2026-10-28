import {mapMemoryFixture} from './map-memory-fixture'
import {tileAt} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
export type LocalMapObservationPhase='remembered'|'revealed'|'pending'
export function localMapObservationNativeFixture(phase:LocalMapObservationPhase){
 const d=mapMemoryFixture(),initialTime=d.s.time,tile=tileAt(d.w,d.target)
 // 마지막에 본 평지와 현재의 보이지 않는 피는 별개의 유효 초기 상태다. 과거 유혈 턴을 실행했다는 뜻이 아니다.
 tile.observed={terrain:'Terrain.Earth',at:d.observedAt};tile.blood=200
 const unseen=structuredClone(d.s.map);unseen.id='crypt2';unseen.kind='dungeon';unseen.depth=2;for(const t of unseen.tiles){delete t.seen;delete t.observed}d.s.maps.crypt2=unseen
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase!=='remembered'){act({type:'move',dir:2});act({type:'move',dir:2})}
 if(phase==='pending')act({type:'rest',turns:20},2)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialPriorExplorationExplicit:true,actualHiddenBlood:200,pending:phase==='pending'}}
}

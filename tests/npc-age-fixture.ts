import {merchantAppraisalFixture} from './merchant-appraisal-fixture'
import {initializeAge} from '../src/core/growth'
import {turnOf} from '../src/core/ctx'
import {hpMax} from '../src/core/body'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
export type NpcAgePhase='before'|'birthday'|'loss'|'pending'
export function npcAgeNativeFixture(phase:NpcAgePhase,seed='npc-aging-proof-0'){
 const d=merchantAppraisalFixture(seed),initialTime=d.s.time,initialItems=d.trader.bag.map(i=>i.uid),initialStats=structuredClone(d.trader.stats)
 // 유효 초기 장면: 생일이 임박한 원래 주민. 과거 수십 년을 실행했다는 뜻이 아니다.
 initializeAge(d.w,d.trader,phase==='loss'?59:phase==='pending'?39:29);d.trader.age!.nextBirthday=turnOf(d.w)+(phase==='before'?2:phase==='pending'?10:1);d.p.hp=hpMax(d.w,d.p)
 const initialAge=structuredClone(d.trader.age!),initialRng=structuredClone(d.s.rng),error=playerAct(d.w,phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error);updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialAge,initialStats,initialItems,initialRng,pending:phase==='pending',traderId:d.trader.id}}
}

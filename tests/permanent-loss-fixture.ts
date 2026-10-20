import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {playerAct} from '../src/core/game'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {hpMax} from '../src/core/body'
import {updatePlayerVision} from '../src/core/fov'
export type PermanentLossPhase='early'|'starved'|'cured'|'oldRecovered'|'pending'
export function permanentLossFixture(seed='permanent-loss-proof-0'){
 const d=conditionThoughtsFixture(seed);d.p.stats={str:10,agi:10,vit:10,per:10,wil:10};d.p.hp=hpMax(d.w,d.p);d.s.time=(7*TURNS_PER_DAY+14400)*100;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=7
 return d
}
export function permanentLossNativeFixture(phase:PermanentLossPhase,seed='permanent-loss-proof-0'){
 const d=permanentLossFixture(seed),{p,s,w}=d
 // 유효 초기 기록: 이미 관찰해 저장된7일 경계/회복 직전 상태. 과거7일을 실행했다고 주장하지 않는다.
 if(phase==='early'||phase==='starved'){
  p.needs.kcal=-20001;const now=turnOf(w);p.needs.starvationEpisode={since:now-7*TURNS_PER_DAY+(phase==='early'?1:0),lastAt:now}
 }else{
  s.time-=(phase==='pending'?10:1)*100;p.nextAct=s.time
  p.diseases=[{def:'Disease.GreyFever',incubatesUntil:turnOf(w)-1000,progress:20,immunity:phase==='oldRecovered'?100:99.9,source:{kind:'초기 기록에 있는 감염',turn:turnOf(w)-28800}}]
 }
 const initialTime=s.time,initialStats=structuredClone(p.stats),initialEpisode=structuredClone(p.needs.starvationEpisode),initialDiseases=structuredClone(p.diseases),error=playerAct(w,phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error);updatePlayerVision(w,p)
 return{...d,proof:{phase,initialTime,actualTurns:(s.time-initialTime)/100,initialStats,initialEpisode,initialDiseases,pending:phase==='pending'}}
}

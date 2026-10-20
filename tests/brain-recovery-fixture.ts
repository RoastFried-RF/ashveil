import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addWound,hpMax} from '../src/core/body'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
export type BrainRecoveryPhase='injured'|'healed'|'mild'|'legacy'|'pending'
export function brainRecoveryFixture(seed='brain-recovery-proof'){
 const d=conditionThoughtsFixture(seed);d.p.stats={str:10,agi:10,vit:10,per:10,wil:10};d.p.hp=hpMax(d.w,d.p)
 const wound=addWound(d.w,d.p,{def:'Wound.Bruise',part:'Brain',severity:6,internal:true,source:'원래 뇌 손상 기록'}).wound
 return{...d,wound}
}
export function brainRecoveryNativeFixture(phase:BrainRecoveryPhase){
 const d=conditionThoughtsFixture('brain-recovery-proof');d.p.stats={str:10,agi:10,vit:10,per:10,wil:10};d.p.hp=hpMax(d.w,d.p)
 const injury=addWound(d.w,d.p,{def:'Wound.Bruise',part:'Brain',severity:phase==='mild'?4:6,internal:true,source:'원래 뇌 손상 기록'}),wound=injury.wound
 if(phase==='injured')d.p.hp-=injury.damage
 // 새 손상 게이트웨이의 기록을 가진, 치유가 임박한 유효 초기 상태다. 과거 치유 기간을 실행했다는 뜻이 아니다.
 if(phase==='legacy')delete d.p.body.brainRecovery
 if(phase!=='injured')wound.healed=wound.severity-(phase==='pending'?.0004:1e-7)
 wound.bleed=0;wound.ageTurns=1000
 const initialTime=d.s.time,initialStats=structuredClone(d.p.stats),episode=structuredClone(d.p.body.brainRecovery),error=playerAct(d.w,phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error);updatePlayerVision(d.w,d.p)
 return{...d,wound,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialStats,episode,woundId:wound.id,pending:phase==='pending'}}
}

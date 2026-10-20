// 07 §5 웅크림: 같은 자세를 이동/명중/소음/표현에서 읽는다.
import {regionState} from './body'
import {log,turnOf,type World} from './ctx'
import {hasEffect} from './traits'
import type {Creature,PostureDef} from './types'

export const crouchRule=(w:World)=>w.db.tryGet<PostureDef>('Posture.Crouch')
export function crouched(w:World,c:Creature):boolean {
 if(!c.crouching||!c.alive||c.asleep||c.unconscious||!crouchRule(w))return false
 const turn=turnOf(w)
 return !hasEffect(c,'knockedDown',turn)&&!hasEffect(c,'stunned',turn)&&w.db.body(c.body.def).kind==='humanoid'&&!(regionState(w,c,'lleg')>=4&&regionState(w,c,'rleg')>=4)
}
/** 미리보기는 몸·시간·난수·자유 행동을 변경하지 않는다. */
export function crouchQuote(w:World,c:Creature):{error:string|null;active?:boolean;rule?:PostureDef}{
 const fail=(error:string)=>({error}),rule=crouchRule(w),turn=turnOf(w)
 if(!rule)return fail('이 자세의 정의가 없다')
 if(!w.s.creatures.includes(c)||!c.alive||c.asleep||c.unconscious||c.captivity||c.breakdown?.kind==='catatonia'||hasEffect(c,'knockedDown',turn)||hasEffect(c,'stunned',turn))return fail('지금은 자세를 바꿀 수 없다')
 if(w.db.body(c.body.def).kind!=='humanoid')return fail('이 몸은 웅크림 자세를 취할 수 없다')
 if(c.activity)return fail('진행 중인 일을 먼저 중단해야 한다')
 if(!c.crouching&&regionState(w,c,'lleg')>=4&&regionState(w,c,'rleg')>=4)return fail('버틸 다리가 없다')
 if(c.freeActTurn===turn)return fail('자유 행동은 턴당 한 번')
 return{error:null,active:!!c.crouching,rule}
}
export function toggleCrouch(w:World,c:Creature):string|null {
 const q=crouchQuote(w,c);if(q.error)return q.error
 const rule=q.rule!;c.freeActTurn=turnOf(w)
 if(c.crouching)delete c.crouching;else c.crouching=true
 if(c.id===w.s.playerId)log(w,'info',c.crouching?`몸을 낮춰 웅크렸다. 이동 ${rule.movementTurns}턴 · 근접 명중 ${rule.meleeHit} · 원거리 피격 명중 ${rule.rangedTargetHit} · 발소음 ×${rule.noiseMult}`:'몸을 펴서 일어섰다.')
 return null
}
/** 잠행과 겹치면 더 조용한 한 값만 사용한다. */
export function walkingNoiseMultiplier(w:World,c:Creature):number {
 return Math.min(c.sneaking ? .3 : 1,crouched(w,c)?crouchRule(w)!.noiseMult:1)
}

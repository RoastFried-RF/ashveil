import {scriptHooksFixture} from './script-hooks-fixture'
import {playerAct} from '../src/core/game'
import {player} from '../src/core/ctx'
export async function scriptWorkersFixture(phase:'before'|'queued'|'dispatched'|'denied'|'denied-before'|'pending'='before'){
 const d=await scriptHooksFixture('before','sample-script-worker'),s=d.w.s,p=player(d.w),originalNpcState=s.creatures.filter(c=>c!==p).map(c=>({id:c.id,pos:{...c.pos},home:c.home?{...c.home}:undefined})),act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 // 거절 검사는 실제 출발일에 죽은 기존 인원을 포함하는 별도 초기 조건이다. 전투/귀환을 실행했다고 주장하지 않는다.
 if(phase.startsWith('denied'))for(const c of s.creatures.filter(c=>c.faction==='reavers').slice(2))c.alive=false
 const proof={...d.proof,phase,modId:'sample-script-worker',originalNpcState,declaredInitialInsufficientLivingSourceOnly:phase.startsWith('denied'),notClaimingNpcJourneyOrDeathsByActualBattle:true}
 if(phase!=='before'&&phase!=='denied-before')act({type:'wait'})
 if(['dispatched','denied','pending'].includes(phase))for(let n=0;n<3;n++)act({type:'wait'})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{...d,s:d.w.s,p:player(d.w),act,proof:{...proof,initialRendererFx:d.w.s.fx.splice(0)}}
}

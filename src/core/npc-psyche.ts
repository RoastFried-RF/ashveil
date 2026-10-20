// 04§14: 인간NPC는 실제 사건마다 스트레스를 정산한다. 전체 사고/시간당 기분은 만들지 않는다.
import {bodyDef,bloodLoss,hostileNear} from './body'
import {clamp,tileAt,turnOf,type World} from './ctx'
import {chooseBreakdown,endBreakdown,psycheStream,startBreakdown} from './psyche'
import {emitNoise} from './perception'
import {fireWarmth} from './thermal'
import {traitMul,traitOverride} from './traits'
import type {BreakDef,Creature,NpcPsycheDef,NpcStressKind} from './types'
const eligible=(w:World,c:Creature)=>c.alive&&c.faction!=='player'&&bodyDef(w,c).kind==='humanoid'
const rules=(w:World)=>w.db.tryGet<NpcPsycheDef>('NpcPsyche.Human')
function record(w:World,c:Creature,kind:NpcStressKind|'thought',change:number,source?:number,thought?:string){
 const d=rules(w);if(!d||!eligible(w,c)||!change)return
 const at=turnOf(w),s=c.npcPsyche??={history:[]}
 if(s.history.some(e=>e.at===at&&e.kind===kind&&e.source===source&&e.thought===thought))return
 const delta=change>0?change*traitMul(w,c,'stressMult'):change,before=c.needs.stress
 c.needs.stress=clamp(before+delta,0,100)
 s.history.push({at,kind,delta:c.needs.stress-before,...(source!==undefined?{source}:{}),...(thought?{thought}:{})})
 if(s.history.length>d.historyLimit)s.history.splice(0,s.history.length-d.historyLimit)
 // 들어오는 행동 정산 뒤, 다음 NPC 행동 전에 실제 붕괴를 시작한다.
 if(delta>0&&c.needs.stress>=50&&!c.breakdown&&!s.pending){const chosen=chooseBreakdown(w,c,d.acuteMult,psycheStream(c));if(chosen)s.pending=chosen.id}
}
export function npcStressEvent(w:World,c:Creature,kind:NpcStressKind,source?:number){
 if(kind==='killedHuman'&&traitOverride(w,c,'killMood')===0||['allyDeath','leaderDeath'].includes(kind)&&traitOverride(w,c,'deathMood')===0)return
 const d=rules(w);if(d)record(w,c,kind,d.events[kind]*(kind==='killedHuman'?traitMul(w,c,'killMoodMult'):1),source)
}
export function npcThoughtEvent(w:World,c:Creature,thought:string,mood:number){const d=rules(w);if(d)record(w,c,'thought',-mood*d.thoughtScale,undefined,thought)}
export function resolveNpcStress(w:World,c:Creature):boolean{
 if(!eligible(w,c)||c.unconscious||c.asleep)return false
 const s=c.npcPsyche,id=s?.pending
 if(!id)return false
 delete s!.pending
 if(c.breakdown)return false
 const def=w.db.tryGet<BreakDef>(id);if(!def)return false
 startBreakdown(w,c,def,psycheStream(c));return true
}
export function npcPsycheTick(w:World,c:Creature):boolean{
 if(!eligible(w,c))return false
 const now=turnOf(w)
 if(c.breakdown&&(now>=c.breakdown.until||(c.breakdown.kind==='lie'&&c.hp<c.breakdown.hp)))endBreakdown(w,c)
 const near=bloodLoss(c)>=.4||c.unconscious||c.needs.bodyTemp<32
 if(near&&!c.npcPsyche?.nearDeath)npcStressEvent(w,c,'nearDeath')
 if(c.npcPsyche)c.npcPsyche.nearDeath=near
 const started=resolveNpcStress(w,c)
 if(c.breakdown&&!c.asleep&&!c.unconscious&&now%10===0){if(c.breakdown.kind==='mutter')emitNoise(w,c.pos,2,c.id);if(c.breakdown.kind==='cry')emitNoise(w,c.pos,4,c.id)}
 if(c.npcPsyche&&!hostileNear(w,c)&&(tileAt(w,c.pos).roof||fireWarmth(w,c)>=8))c.lastSafe={map:w.s.map.id,pos:{...c.pos}}
 return started
}

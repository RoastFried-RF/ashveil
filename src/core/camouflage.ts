/** An actual consumed pigment dose; its original timing/rule survives content changes. */
import {capacity} from './body'
import {lightSource,removeOne} from './items'
import {turnOf,log,type World} from './ctx'
import {crouched} from './posture'
import type {Creature} from './types'
export function camouflageActive(w:World,c:Creature){const s=c.camouflage;return !!s&&s.until>turnOf(w)&&c.needs.wetness<s.washAt}
export function camouflageSight(w:World,c:Creature){return camouflageActive(w,c)&&(c.sneaking||crouched(w,c))&&!lightSource(w,c)?c.camouflage!.sightMult:1}
export function camouflageTick(w:World,c:Creature){if(c.camouflage&&!camouflageActive(w,c)){if(c.id===w.s.playerId&&c.needs.wetness>=c.camouflage.washAt)log(w,'info','젖은 피부와 옷에서 회색 위장 가루가 씻겨 나갔다.');delete c.camouflage}}
export function applyCamouflage(w:World,c:Creature,uid:number){
 const it=c.bag.find(i=>i.uid===uid&&i.count>0),rule=it&&w.db.item(it.def).camouflageCoating
 if(!it||!rule||!c.alive||c.asleep||c.unconscious||w.db.body(c.body.def).kind!=='humanoid'||capacity(w,c,'manipulation')<.3)return '배낭의 실제 위장 가루와 바를 수 있는 손이 필요하다'
 if(c.needs.wetness>=rule.washAt)return '몸과 옷이 젖어 가루가 붙지 않는다'
 if(camouflageActive(w,c))return '이미 위장 가루가 남아 있다'
 removeOne(w,c,uid);c.camouflage={sourceUid:uid,sourceDef:it.def,appliedAt:turnOf(w),until:turnOf(w)+rule.durationTurns,sightMult:rule.sightMult,washAt:rule.washAt,tint:rule.tint}
 log(w,'info','실제 날개 가루 한 몫을 피부와 겉옷에 발랐다. 빛을 끄고 낮추면 멀리서 덜 눈에 띈다.');return null
}

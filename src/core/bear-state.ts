/** Actual warnings and bounded winter sleep; no free reserves, food or actors. */
import type {ActResult} from './actions'
import type {Creature} from './types'
import {calendar} from './climate-state'
import {knownCreatureName} from './bestiary-state'
import {capacity,painStage,painTotal} from './body'
import {log,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {hostile} from './diplomacy'
import {canSee,hasLos} from './fov'
import {cheb,dirIndex} from './geom'
import {emitNoise,smells} from './perception'
export const denRules=(w:World,c:Creature)=>w.db.creature(c.def).wildlife?.den
export function bearHungry(w:World,c:Creature){const d=denRules(w,c);if(!d)return false;const season=calendar(w);return c.needs.kcal<d.hungryBelow||(season.season.id===d.springSeason&&season.seasonDay<=d.springDays&&c.needs.kcal<0)}
export function seasonalSleepError(w:World,c:Creature){
 const d=denRules(w,c)
 if(!d||!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.3||!c.home||cheb(c.pos,c.home)>1)return '제 몸의 굴 곁에서만 겨울잠에 들 수 있다'
 if(calendar(w).season.id!==d.hibernateSeason)return '겨울잠의 계절이 아니다'
 if(c.needs.bodyTemp<35||painStage(painTotal(w,c))>=5)return '실제 체온과 통증 때문에 겨울잠에 들 수 없다'
 if(w.s.creatures.some(other=>other.alive&&!other.asleep&&other.id!==c.id&&hostile(w,c,other)&&other.ai.mode!=='surrender'&&cheb(c.pos,other.pos)<=8&&hasLos(w,c.pos,other.pos)))return '곁의 위협이 잦아들어야 겨울잠에 들 수 있다'
 if(c.needs.kcal<0||c.needs.waterDeficit>=w.db.creature(c.def).wildlife!.drinkAbove)return '허기와 갈증을 먼저 해결해야 한다'
 if((c.wildlifeState?.wakeSlowUntil??0)>turnOf(w))return '막 깨어난 몸을 먼저 추슬러야 한다'
 return null
}
export function beginSeasonalSleep(w:World,c:Creature){
 const rule=denRules(w,c),season=calendar(w);if(!rule||!c.activity||c.activity.kind!=='sleep')return
 c.activity.seasonalSleep={season:rule.hibernateSeason,startedAt:turnOf(w)}
 // A finite remaining seasonal interval; normal hunger/thirst/pain/cold/noise still wake it.
 c.activity.remaining=Math.max(1,(season.season.lengthDays-season.seasonDay+1)*TURNS_PER_DAY-turnOf(w)%TURNS_PER_DAY)
 c.activity.label='겨울잠'
}
export function endSeasonalSleep(w:World,c:Creature){
 if(!c.activity?.seasonalSleep)return
 delete c.activity.seasonalSleep
 const rule=denRules(w,c);if(rule)(c.wildlifeState??={}).wakeSlowUntil=turnOf(w)+rule.wakeSlowTurns
}
export function seasonalActionTU(w:World,c:Creature,tu:number){return tu>0&&(c.wildlifeState?.wakeSlowUntil??0)>turnOf(w)?tu*2:tu}
export function animalWarn(w:World,c:Creature,target:number):ActResult{
 const rule=denRules(w,c),other=w.s.creatures.find(actor=>actor.id===target)
 if(!rule||!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.3||!other?.alive||!c.home||cheb(c.pos,other.pos)>rule.warningRadius||cheb(c.home,other.pos)>rule.territoryRadius||!canSee(w,c,other.pos)&&!smells(w,c,other))return{ok:false,tu:0,msg:'곁의 영역 침입자를 실제로 감지해야 한다'}
 const state=c.wildlifeState??={},turn=turnOf(w),previous=state.denWarning
 if(previous?.actor===other.id&&previous.at===turn)return{ok:false,tu:0,msg:'같은 차례에 이미 경고했다'}
 const progress=previous?.actor===other.id&&previous.at===turn-1?Math.min(rule.warningTurns,previous.progress+1):1
 state.denWarning={actor:other.id,progress,at:turn};c.facing=dirIndex(other.pos.x-c.pos.x,other.pos.y-c.pos.y);c.ai.mode='guard';c.ai.target=other.id
 emitNoise(w,c.pos,5,c.id)
 w.s.fx.push({k:'status',id:c.id,text:'물러나라',color:'#d9b36b',turn})
 const observer=w.s.creatures.find(actor=>actor.id===w.s.playerId)
 if(observer&&canSee(w,observer,c.pos))log(w,'warn',`${knownCreatureName(w,c)}이(가) 굴을 지키며 낮게 포효한다. 물러날 여지가 있다. (${progress}/${rule.warningTurns})`)
 return{ok:true,tu:100}
}

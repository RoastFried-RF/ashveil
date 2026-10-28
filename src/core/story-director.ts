// 선택한 후속 사건 성향은 실제 장소의 기존 인원/경로만 강화한다. 적을 새로 만들지 않는다.
import {storyTensionDecay} from './story-safe-sleep'
import {storyFameTick} from './story-fame'
import {bloodLoss,regionState} from './body'
import {hostile} from './diplomacy'
import {canSee} from './fov'
import {itemDef,storedItems} from './items'
import {clamp,player,tileAt,turnOf,TURNS_PER_HOUR,TURNS_PER_DAY,type World} from './ctx'
import type {StoryPersona,Region} from './types'
export const storyDirectorRule=(w:World)=>w.db.event('Event.ReaverPatrol').director
export function storyPersona(w:World):StoryPersona|undefined{return storyDirectorRule(w)?.profiles.find(p=>p.key===w.s.storyteller.director?.persona)}
const threats=(w:World)=>w.s.creatures.filter(c=>c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&hostile(w,player(w),c)&&canSee(w,player(w),c.pos)).map(c=>c.id)
export function initializeStoryDirector(w:World,key:string|undefined){
 if(!key)return
 const profile=storyDirectorRule(w)?.profiles.find(p=>p.key===key);if(!profile)throw Error('선택한 사건 성향을 사용할 수 없다')
 const p=player(w),at=turnOf(w)
 w.s.storyteller.budget=0
 w.s.storyteller.director={fame:{value:0,lastDecayAt:at,credited:[]},persona:key,startedAt:at,lastAt:at,budgetTenths:0,incomeCarry:0,tension:0,decayCarry:0,wounds:p.body.wounds.map(w=>w.id),threats:threats(w),bloodAlert:bloodLoss(p)>=.15,breakdownAlert:!!p.breakdown}
}
export function storyWealth(w:World):number{
 const p=player(w),base=w.s.map.baseCamp,stock=base?.owner===p.id?tileAt(w,base.store).cont?.items??[]:[],seen=new Set<number>()
 return storedItems([...p.bag,...Object.values(p.equip).filter(i=>!!i),...stock]).reduce((n,i)=>{if(seen.has(i.uid))return n;seen.add(i.uid);const amount=(itemDef(w,i).value??0)*i.count;return Math.min(1e12,n+(Number.isFinite(amount)&&amount>0?amount:0))},Number.isFinite(p.money)&&p.money!>0?Math.min(1e12,p.money!):0)
}
export const storyScaleHundred=(w:World)=>clamp(60+Math.floor(Math.sqrt(storyWealth(w)))+(w.s.storyteller.director?.fame?.value??0),60,300)
export function storyTarget(w:World){
 const state=w.s.storyteller.director,profile=storyPersona(w);if(!state||!profile)return 0
 const points=profile.target,period=points.at(-1)![0],day=Math.max(0,(turnOf(w)-state.startedAt)/TURNS_PER_DAY)%period
 for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;if(day<=b[0])return a[1]+(b[1]-a[1])*(day-a[0])/(b[0]-a[0])}
 return points[0][1]
}
export function storyRecovery(w:World){const p=player(w);return bloodLoss(p)>.3||(['head','torso','larm','rarm','lleg','rleg']as Region[]).some(r=>regionState(w,p,r)>=2)}
export function storyDirectorTick(w:World){
 const state=w.s.storyteller.director;if(!state)return
 const profile=storyPersona(w),rule=storyDirectorRule(w),now=turnOf(w);if(!profile||!rule||now<=state.lastAt)return
 state.lastAt=now
 storyFameTick(w)
 const p=player(w),seen=threats(w),newWounds=p.body.wounds.filter(wd=>!state.wounds.includes(wd.id)),parts=w.db.body(p.body.def).parts
 let added=seen.some(id=>!state.threats.includes(id))?5:0
 for(const wound of newWounds){const region=parts.find(p=>p.id===wound.part)?.region,stage=region?regionState(w,p,region):0;added+=stage>=3?15:stage>=2?8:3}
 const blood=bloodLoss(p)>=.15,broken=!!p.breakdown;if(blood&&!state.bloodAlert)added+=10;if(broken&&!state.breakdownAlert)added+=20
 state.wounds=p.body.wounds.map(w=>w.id);state.threats=seen;state.bloodAlert=blood;state.breakdownAlert=broken;state.tension=clamp(state.tension+added,0,100)
 if(!seen.length){state.decayCarry+=storyTensionDecay(w);if(state.decayCarry>=TURNS_PER_HOUR){const take=Math.floor(state.decayCarry/TURNS_PER_HOUR);state.tension=Math.max(0,state.tension-take);state.decayCarry%=TURNS_PER_HOUR}}
 const scale=storyScaleHundred(w),grace=now-state.startedAt<rule.graceHours*TURNS_PER_HOUR?rule.gracePercent:100,denominator=TURNS_PER_HOUR*100*100*100
 state.incomeCarry+=rule.incomePerHour*10*scale*profile.incomePercent*grace
 const income=Math.floor(state.incomeCarry/denominator);state.incomeCarry%=denominator
 const cap=Math.floor(rule.incomePerHour*rule.capHours*10*scale*profile.incomePercent/10000)
 state.budgetTenths=Math.min(cap,state.budgetTenths+income);w.s.storyteller.budget=state.budgetTenths/10
}
/** 조회는 상태/난수/실제 인원을 바꾸지 않는다. 사용료는 성공한 강화 편성에서만 낸다. */
export function storyPressureQuote(w:World){
 const state=w.s.storyteller.director,profile=storyPersona(w),rule=storyDirectorRule(w),now=turnOf(w)
 let reason:string|null=null
 if(!state||!profile||!rule)reason='고정 장소 규칙을 따른다'
 else if(state.lastMajorAt!==undefined&&now-state.lastMajorAt<profile.restHours*TURNS_PER_HOUR)reason='큰 사건 뒤 쉬는 중이다'
 else if(profile.recovery==='hold'&&storyRecovery(w))reason='몸이 회복될 때까지 강화를 보류한다'
 else if(state.tension>=storyTarget(w)+(profile.recovery==='press'&&state.tension>=40?20:0))reason='현재 긴장이 목표에 닿았다'
 else if(state.budgetTenths<rule.enhanceCost*10)reason='실제 강화 예산이 아직 부족하다'
 const chance=state&&rule?clamp(10+(state.budgetTenths/10-30)+(profile?.recovery==='press'&&storyRecovery(w)?15:0),0,80):0
 return{reason,chance,cost:rule?.enhanceCost??0,profile,state,target:storyTarget(w)}
}
export function commitStoryPressure(w:World,actualCost?:number){const q=storyPressureQuote(w),cost=actualCost??q.cost;if(q.reason||!q.state||!Number.isSafeInteger(cost)||cost<=0||q.state.budgetTenths<cost*10)return false;q.state.budgetTenths-=cost*10;q.state.lastMajorAt=turnOf(w);w.s.storyteller.budget=q.state.budgetTenths/10;return true}

/** 실제 편성한 사람의 단가만 읽는다. 없는 추가 인원을 가정하지 않는다. */
export function storyUnitCost(w:World,c:import('./types').Creature){return storyDirectorRule(w)?.unitCosts?.[c.def]??storyDirectorRule(w)?.enhanceCost??25}

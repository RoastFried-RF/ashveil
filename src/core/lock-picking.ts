import {channelTurns} from './action-time'
import {capacity} from './body'
import {clamp,inBounds,log,rng,terrainAt,tileAt,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb,type Pos} from './geom'
import {allItems,findItem,itemDef,qualityOf} from './items'
import {diagonalBlocked} from './path'
import {emitNoise} from './perception'
import {effectiveStat,hasEffect} from './traits'
import type {Creature,ItemInst,LockPickingRule} from './types'

export interface LockPickQuote {error:string|null;tool?:ItemInst;rule?:LockPickingRule;turns?:number;chance?:number;signature?:string}
/** 실제로 보이는 잠금/접근 가능한 도구만 읽고 내용물이나 난수는 읽지 않는다. */
export function lockPickQuote(w:World,c:Creature,pos:Pos,toolUid?:number):LockPickQuote{
 const fail=(error:string):LockPickQuote=>({error})
 if(!Number.isSafeInteger(pos.x)||!Number.isSafeInteger(pos.y)||!inBounds(w,pos)||cheb(c.pos,pos)>1||!hasLos(w,c.pos,pos)||!canSee(w,c,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return fail('보이는 잠금장치 곁에서 작업해야 한다')
 const def=terrainAt(w,pos),rule=def.lock?.picking,turn=turnOf(w)
 if(!tileAt(w,pos).locked||(!def.container&&def.door!=='closed'))return fail('따야 할 잠금장치가 없다')
 if(def.sealed||def.keyItem)return fail('열쇠·기계 봉인은 이 도구로 해제할 수 없다')
 if(!rule)return fail('이 잠금장치는 정밀 도구로 딸 수 없다')
 if(!w.s.creatures.includes(c)||!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'manipulation')<.2||hasEffect(c,'stunned',turn)||hasEffect(c,'knockedDown',turn))return fail('깨어서 도구를 다룰 손이 필요하다')
 const tools=toolUid===undefined?allItems(c).slice().sort((a,b)=>qualityOf(b)-qualityOf(a)||a.uid-b.uid):[findItem(c,toolUid)].filter((it):it is ItemInst=>!!it)
 const tool=tools.find(it=>!it.half&&!it.missingItem&&(it.durability??0)>=rule.wear&&itemDef(w,it).toolTags?.includes(rule.toolTag))
 if(!tool)return fail('닳지 않은 정밀 잠금 도구가 필요하다')
 const turns=channelTurns(w,c,rule.turns);if(turns===null)return fail('몸 상태로는 정밀 작업을 할 수 없다')
 const chance=clamp(Math.floor(rule.base+(effectiveStat(w,c,'agi')-10)*rule.agility+(qualityOf(tool)-1)*rule.quality),rule.min,rule.max)
 return{error:null,tool,rule,turns,chance,signature:JSON.stringify({terrain:def.id,lock:def.lock,method:'pick'})}
}
export function startLockPicking(w:World,c:Creature,pos:Pos):string|null{
 const quote=lockPickQuote(w,c,pos);if(quote.error)return quote.error
 c.activity={kind:'pryContainer',target:{...pos},remaining:quote.turns!,total:quote.turns!,label:'정밀 잠금 따기',containerPry:{map:w.s.map.id,region:w.s.overworld?.currentRegion,terrain:terrainAt(w,pos).id,toolUid:quote.tool!.uid,signature:quote.signature!,method:'pick'}}
 return null
}
/** 완료할 때 한 번만 굴린다. 실패도 원래 시간/도구 비용을 낸다. */
export function lockPickingStep(w:World,c:Creature):boolean{
 const act=c.activity!,work=act.containerPry,pos=act.target
 const quote=work?.method==='pick'&&pos&&work.map===w.s.map.id&&work.region===w.s.overworld?.currentRegion?lockPickQuote(w,c,pos,work.toolUid):undefined
 if(!quote||quote.error||quote.signature!==work!.signature){if(c.id===w.s.playerId)log(w,'warn','정밀 작업을 중단했다. 원래 잠금장치와 같은 도구 곁에서 계속해야 한다.');c.activity=undefined;return true}
 if((act.elapsed??0)%5===0||act.remaining<=0)emitNoise(w,pos!,quote.rule!.noise,c.id)
 if(act.remaining>0)return false
 quote.tool!.durability=Math.max(0,(quote.tool!.durability??0)-quote.rule!.wear)
 const roll=rng(w,'loot').int(0,99),success=roll<quote.chance!
 if(success)tileAt(w,pos!).locked=false
 if(c.id===w.s.playerId)log(w,success?'good':'warn',success?'잠금쇠가 풀렸다. 이제 문을 열거나 상자를 수색할 수 있다.':'잠금쇠를 풀지 못했다. 도구가 조금 닳았다.',[`정밀 잠금 ${quote.chance}% (roll ${roll})`])
 c.activity=undefined;return true
}

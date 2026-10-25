import {crawlerRules} from './crawler-state'
import {crawlerHarvest} from './crawlers'
import { diagonalBlocked } from './path'
// 관찰/교전의 결과와 실제 사체 해부. UI 조회와 독립적으로 턴에서만 기록한다.
import { capacity } from './body'
import { bestiaryDef, bestiaryEntry, ensureBestiary, speciesDissections } from './bestiary-state'
import { clamp, log, player, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { canSee, lightLevel } from './fov'
import { cheb } from './geom'
import { allItems, itemDef, makeItem, maxStack, qualityOf } from './items'
import { masteryStage, practice } from './skills'
import { effectiveStat } from './traits'
import { addThought } from './thoughts'
import { diplomacyDef, diplomacyTick, ensureSociety, factionDef, factionAvailable } from './diplomacy'
import type { Activity, BestiaryRecord, Creature } from './types'
export function bestiaryMap(w:World):string{return `${w.s.overworld?.currentRegion??''}:${w.s.map.id}`}
function specimen(c:Creature):NonNullable<BestiaryRecord['specimen']>{return {def:c.def,blood:c.body.bloodMax,maxHp:{...c.body.maxHp}}}
export function noteBestiaryFight(w:World,other:Creature) {
 const b=ensureBestiary(w,other.def),now=turnOf(w),map=bestiaryMap(w)
 b.fought++;b.specimen??=specimen(other)
 const contact=(b.fights??=[]).find((f)=>f.id===other.id&&f.map===map)
 if(contact)contact.lastTurn=now;else b.fights.push({id:other.id,map,lastTurn:now})
}
export function observeBestiary(w:World,elapsed=true) {
 const observer=player(w),now=turnOf(w),d=bestiaryDef(w),map=bestiaryMap(w)
 if(!observer.alive)return
 for(const b of Object.values(w.s.knowledge.bestiary))if(b.fights?.length){
  b.fights=b.fights.filter((f)=>{
   const target=w.s.creatures.find((c)=>c.id===f.id)
   const ended=f.map!==map||!target?.alive||now-f.lastTurn>=d.fightClearTurns&&(!canSee(w,observer,target.pos)&&target.ai.mode!=='hunt')
   if(ended)b.survived=true
   return !ended
  })
 }
 if(observer.asleep||observer.unconscious)return
 const visible=new Map<string,Creature>()
 for(const c of w.s.creatures)if(c.id!==observer.id&&canSee(w,observer,c.pos)){
  const entry=bestiaryEntry(w,c.def)
  if(entry)visible.set(entry.creatures[0],c)
 }
 for(const [id,c] of visible){
  const b=ensureBestiary(w,id)
  if(b.observedAt===now)continue
  if(b.lastSeen===undefined||now-b.lastSeen>=d.encounterGap)b.encounters=(b.encounters??0)+1
  if(elapsed){b.observeTurns=(b.observeTurns??b.seen)+1;b.seen++;b.observedAt=now}
  b.lastSeen=now;b.specimen??=specimen(c)
 }
}
function dissectTool(w:World,actor:Creature,target:Creature,uid?:number){
 const machine=bestiaryEntry(w,target.def)?.kind==='machine'
 return allItems(actor).filter((it)=>(it.durability??100)>0&&(uid===undefined||it.uid===uid)&&!!itemDef(w,it).toolTags?.includes(machine?'hammer':'blade')).sort((a,b)=>qualityOf(b)-qualityOf(a)||a.uid-b.uid)[0]
}
export function dissectionError(w:World,actor:Creature,targetId:number,toolUid?:number):string|null {
 const corpse=w.s.creatures.find((c)=>c.id===targetId),entry=corpse&&bestiaryEntry(w,corpse.def)
 if(!corpse||corpse.alive||corpse.id===actor.id)return '해부할 사체가 없다'
 if(cheb(actor.pos,corpse.pos)>1||diagonalBlocked(w,actor.pos,corpse.pos.x-actor.pos.x,corpse.pos.y-actor.pos.y))return '사체 곁으로 가야 한다'
 if(!entry)return '이 사체를 해부할 방법을 모른다'
 if(w.db.creature(corpse.def).crawler&&!crawlerRules(w,corpse))return '원래 지네 신체와 현재 독샘·체절 규칙이 다르다'
 if(entry.kind==='unavailable')return '그는 얼마 전까지 사람이었다. 해부할 수 없다'
 if(corpse.dissected)return '이미 해부를 시도한 사체다'
 if(!actor.alive||actor.unconscious||capacity(w,actor,'manipulation')<.2)return '손을 쓸 수 없다'
 if(lightLevel(w,actor.pos)>=2)return '해부하기에는 너무 어둡다'
 if(!dissectTool(w,actor,corpse,toolUid))return toolUid!==undefined?'선택한 해부 도구가 없어졌다':entry.kind==='machine'?'분해할 망치가 필요하다':'해부할 날붙이가 필요하다'
 return null
}
export function dissectionChance(w:World,actor:Creature,target:Creature,toolUid?:number):number {
 const entry=bestiaryEntry(w,target.def),d=bestiaryDef(w)
 if(!entry)return 0
 if(speciesDissections(w,target.def,actor)>=d.autoDissectAfter)return 100
 const tool=dissectTool(w,actor,target,toolUid),skill=entry.kind==='machine'?(tool?d.toolBonus[qualityOf(tool)]??0:0):Math.max(masteryStage(w,actor,'medicine'),masteryStage(w,actor,'survival'))*d.dissectMastery
 return clamp(d.dissectBase+skill+(effectiveStat(w,actor,'per')-10)*d.dissectPer-entry.difficulty,d.dissectMin,d.dissectMax)
}
export function startDissection(w:World,actor:Creature,targetId:number,turns:number):string|null {
 const error=dissectionError(w,actor,targetId);if(error)return error
 const target=w.s.creatures.find((c)=>c.id===targetId)!,tool=dissectTool(w,actor,target)!
 actor.activity={kind:'dissect',remaining:turns,total:turns,uid:targetId,toolUid:tool.uid,label:bestiaryEntry(w,target.def)?.kind==='machine'?'기계 사체 분해':'사체 해부'}
 return null
}
function witnessTaboo(w:World,actor:Creature,corpse:Creature) {
 if(actor.id!==w.s.playerId)return
 const society=ensureSociety(w);if(!society)return
 const witnesses=w.s.creatures.filter((c)=>c.id!==actor.id&&c.alive&&!c.asleep&&!c.unconscious&&factionDef(w,c.faction)&&!factionDef(w,c.faction)!.territorial&&canSee(w,c,actor.pos))
 if(!witnesses.length)return
 const now=turnOf(w),delta=bestiaryDef(w).tabooLoss,reason='인체 해부 목격'
 for(const faction of w.db.all<import('./types').FactionDef>('Faction').filter((f)=>!f.territorial&&factionAvailable(w,f))){
  if(society.events.some((e)=>e.target===corpse.id&&e.faction===faction.key&&e.reason===reason))continue
  const m=w.s.overworld!,rules=diplomacyDef(w),home=m.sites.filter((s)=>s.faction===faction.key),distance=home.reduce((n,s)=>Math.min(n,Math.abs(s.cell.x-m.position.x)+Math.abs(s.cell.y-m.position.y)),Infinity)
  const delay=home.some((s)=>s.id===m.currentRegion)?0:clamp(Number.isFinite(distance)?Math.ceil(distance*rules.witnessDaysPerCell):rules.witnessMaxDays,rules.witnessMinDays,rules.witnessMaxDays)*TURNS_PER_DAY
  society.events.push({id:society.nextEvent++,target:corpse.id,faction:faction.key,delta,reason,turn:now,arrives:now+delay,witnesses:witnesses.map((c)=>c.id),applied:false})
 }
 diplomacyTick(w)
 log(w,'warn','사람의 몸을 가르는 모습을 누군가 보았다. 금기를 어겼다는 소문이 퍼질 것이다.')
}
export function finishDissection(w:World,actor:Creature,activity:Activity):string|null {
 const error=dissectionError(w,actor,activity.uid??-1,activity.toolUid);if(error)return error
 const corpse=w.s.creatures.find((c)=>c.id===activity.uid)!,entry=bestiaryEntry(w,corpse.def)!,d=bestiaryDef(w),chance=dissectionChance(w,actor,corpse,activity.toolUid)
 const success=chance===100||rng(w,'world.knowledge').chance(chance/100),mult=success?1:d.failedYield
 corpse.dissected={success,yieldMult:mult,by:actor.id,at:turnOf(w)}
 if(success){const b=ensureBestiary(w,corpse.def,actor);b.dissected=(b.dissected??0)+1;b.specimen=specimen(corpse);practice(w,actor,'survival',`dissect:${corpse.id}`)}
 const tile=w.s.map.tiles[corpse.pos.y*w.s.map.w+corpse.pos.x],beforeItems=tile.items.length
 const separated=new Set<string>()
 for(const yield0 of entry.yields){
  if(corpse.carcassStock&&separated.has(yield0.item))continue
  separated.add(yield0.item)
  const stock=corpse.carcassStock?.[yield0.item],available=corpse.carcassStock?stock?.remaining??0:yield0.count
  const quantity=Math.floor(available*mult),batch=w.db.creature(corpse.def).crawler?maxStack(w.db.item(yield0.item)):1
  for(let n=0;n<quantity;n+=batch){
   const it=makeItem(w,yield0.item,Math.min(batch,quantity-n))
   if(stock){for(const key of['freshness','foodFrozen','foodThawed','foodWet','foodLeftover','foodSealed']as const)if(stock[key]!==undefined)Object.assign(it,{[key]:stock[key]});if(stock.freshness!==undefined)it.foodAgedAt=stock.at}
   tile.items.push(it)
  }
 }
 crawlerHarvest(w,corpse,mult)
 for(const stock of Object.values(corpse.carcassStock??{}))stock.remaining=0
 if(entry.kind==='human'){addThought(w,actor,d.tabooThought);witnessTaboo(w,actor,corpse)}
 if(actor.id===w.s.playerId&&tile.items.length>beforeItems)w.s.loot={pos:{...corpse.pos},kind:'floor'}
 if(actor.id===w.s.playerId){log(w,success?'good':'warn',success?`${entry.label}의 몸 구조를 익혔다.`:'사체를 손상시켰다. 얻을 재료가 줄었다.');actor.history.push({turn:turnOf(w),kind:'knowledge',text:`${entry.label} 해부 ${success?'성공':'실패'}`})}
 return null
}

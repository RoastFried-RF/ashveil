import {reputationOrigin} from './rumor-subject'
// 원본 증거를 실제로 보고 들은 사람만 판단한다. 공개 전 견적은 아무것도 바꾸지 않는다.
import {channelTurns} from './action-time'
import {capacity} from './body'
import {clamp,log,rng,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {diplomacyDef,diplomacyTick,ensureSociety,factionDef} from './diplomacy'
import {canSee,hasLos} from './fov'
import {cheb} from './geom'
import {ambientNoise,emitNoise,hearingBonus,noiseCost} from './perception'
import type {Creature,EvidenceDef} from './types'
export const evidenceDefs=(w:World)=>w.db.all<EvidenceDef>('Evidence')
const awake=(w:World,c:Creature)=>c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.5
function hearers(w:World,c:Creature,rule:EvidenceDef){
 const costs=noiseCost(w,c.pos,rule.radius),ambient=ambientNoise(w)
 return w.s.creatures.filter(person=>person.id!==c.id&&person.faction===rule.sourceFaction&&awake(w,person)&&capacity(w,person,'hearing')>0&&capacity(w,person,'sight')>0&&cheb(c.pos,person.pos)<=rule.radius&&hasLos(w,c.pos,person.pos)&&canSee(w,person,c.pos)&&(costs.get(person.pos.y*w.s.map.w+person.pos.x)??Infinity)<=rule.radius+hearingBonus(w,person)-ambient)
}
export function evidenceQuote(w:World,c:Creature,target:number,id:string){
 const rule=w.db.tryGet<EvidenceDef>(id),person=w.s.creatures.find(p=>p.id===target)
 let error:string|null=null
 if(!w.s.overworld||c.id!==w.s.playerId||!w.s.creatures.includes(c)||!awake(w,c)||c.captivity||capacity(w,c,'manipulation')<.1||capacity(w,c,'sight')<=0)error='깨어서 원본 기록을 들고 읽어 줄 수 있어야 한다'
 if(!error&&(!rule||rule.defType!=='Evidence'))error='확인할 수 있는 증거가 아니다'
 if(!error&&(!person||!w.s.creatures.includes(person)||person.faction!==rule!.sourceFaction||cheb(c.pos,person.pos)>1||!hearers(w,c,rule!).includes(person)))error='곁의 상대가 실제 원본을 보고 목소리를 들을 수 있어야 한다'
 if(!error&&person!.evidenceHeard?.[id])error='이 사람은 이미 그 원본 기록을 확인했다'
 if(!error&&rule!.books.some(book=>!c.booksRead?.includes(book)||!(c.literacyBooks??c.booksRead??[]).includes(book)||c.misreadBooks?.includes(book)))error='공개할 원본 기록을 온전히 읽고 이해해야 한다'
 const held=rule?.hold.map(def=>c.bag.find(item=>item.def===def&&item.count>0&&(item.durability??100)>0&&!(item.lostPages??0)))
 if(!error&&held?.some(item=>!item))error='빠진 장이 없는 실제 원본 증거를 모두 가지고 있어야 한다'
 const turns=rule?channelTurns(w,c,rule.turns):null
 if(!error&&turns===null)error='몸 상태 때문에 기록을 읽어 줄 수 없다'
 return{rule,person,error,turns:turns??0,held:held?.filter(item=>!!item).map(item=>({uid:item!.uid,def:item!.def}))??[]}
}
export function startEvidence(w:World,c:Creature,target:number,id:string){
 const q=evidenceQuote(w,c,target,id);if(q.error)return q.error
 c.activity={kind:'discloseEvidence',remaining:q.turns,total:q.turns,label:q.rule!.label,evidence:{rule:id,signature:JSON.stringify(q.rule),target,map:w.s.map.id,held:q.held}}
 return null
}
export function evidenceStep(w:World,c:Creature):boolean{
 const activity=c.activity,work=activity?.evidence,rule=work&&w.db.tryGet<EvidenceDef>(work.rule)
 let error:string|null=null
 if(!activity||!work||!rule||rule.defType!=='Evidence'||work.map!==w.s.map.id||work.signature!==JSON.stringify(rule)||!w.s.creatures.includes(c)||!awake(w,c))error='원래 장소와 기록 또는 읽는 사람이 달라졌다'
 if(!error&&work!.held.some(row=>!c.bag.some(item=>item.uid===row.uid&&item.def===row.def&&item.count>0&&(item.durability??100)>0&&!(item.lostPages??0))))error='읽어 주던 원래 증거가 없어지거나 훼손되었다'
 if(!error&&(capacity(w,c,'sight')<=0||capacity(w,c,'manipulation')<.1||rule!.books.some(book=>!c.booksRead?.includes(book)||!(c.literacyBooks??c.booksRead??[]).includes(book)||c.misreadBooks?.includes(book))))error='지금 원본 기록을 온전히 읽어 줄 수 없다'
 const audience=!error?hearers(w,c,rule!):[]
 if(!error&&!audience.some(person=>person.id===work!.target))error='원본을 확인하던 상대가 더는 보고 들을 수 없다'
 if(error){log(w,'warn',`증거 공개 중단: ${error}.`);c.activity=undefined;return true}
 if((activity!.elapsed??0)%4===0)emitNoise(w,c.pos,rule!.radius,c.id)
 if(activity!.remaining>0)return false
 const now=turnOf(w),society=ensureSociety(w)!,witnesses=audience.filter(person=>!person.evidenceHeard?.[work!.rule]),reformers:number[]=[]
 for(const person of witnesses){
  const chance=clamp(rule!.reformChance+person.traits.reduce((n,id)=>n+(rule!.traitChance[id]??0),0),0,100),reform=rng(w,`world.evidence.${work!.rule}.${person.id}`).chance(chance/100)
  ;(person.evidenceHeard??={})[work!.rule]={turn:now,source:c.id,choice:reform?'reform':'loyal',proofUids:work!.held.map(row=>row.uid)}
  if(reform){
   const site=w.s.overworld!.sites.find(site=>site.id===(person.residentSite??person.traderSite??person.clinicSite))
   if(site?.faction===person.faction)person.residentOriginFaction=person.faction
   person.faction=rule!.reformFaction;reformers.push(person.id)
  }
  const text=reform?'그 규정은 우리를 속였다. 이제 그 명령을 따르지 않겠다.':'기록을 보았다. 그래도 나는 지금의 규정을 지키겠다.'
  person.history.push({turn:now,kind:'evidence',text});log(w,reform?'good':'warn',`${person.name}: ${text}`)
 }
 if(reformers.length){if(!society.unlocks?.includes(rule!.unlock))(society.unlocks??=[]).push(rule!.unlock);if(society.reputation[rule!.reformFaction]===undefined)society.reputation[rule!.reformFaction]=factionDef(w,rule!.reformFaction)!.playerStart}
 if(witnesses.length){
  ;(society.disclosures??=[]).push({rule:work!.rule,site:w.s.overworld!.currentRegion,turn:now,source:c.id,witnesses:witnesses.map(person=>person.id),reformers})
  const evidenceKey=`evidence:${work!.rule}`
  if(!society.events.some(event=>event.evidenceKey===evidenceKey)){
   const m=w.s.overworld!,home=m.sites.filter(site=>site.faction===rule!.sourceFaction),d=diplomacyDef(w),distance=home.reduce((n,site)=>Math.min(n,Math.abs(site.cell.x-m.position.x)+Math.abs(site.cell.y-m.position.y)),Infinity),days=home.some(site=>site.id===m.currentRegion)?0:clamp(Number.isFinite(distance)?Math.ceil(distance*d.witnessDaysPerCell):d.witnessMaxDays,d.witnessMinDays,d.witnessMaxDays)
   society.events.push({...reputationOrigin(w,c),evidenceKey,id:society.nextEvent++,target:work!.target,faction:rule!.sourceFaction,delta:rule!.loyalLoss,reason:rule!.label,turn:now,arrives:now+days*TURNS_PER_DAY,witnesses:witnesses.map(person=>person.id),applied:false})
  }
 }
 diplomacyTick(w);c.activity=undefined
 return true
}

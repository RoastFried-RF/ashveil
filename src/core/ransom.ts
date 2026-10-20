// 합의가 끝날 때만 같은 포로/밧줄을 풀고 두 실제 개인 지갑 사이에서 돈을 옮긴다.
import {channelTurns,hostileAware} from './action-time'
import {capacity} from './body'
import {knownCreatureName} from './bestiary-state'
import {effectiveFaction,isCompanion} from './companion-state'
import {log,player,turnOf,type World} from './ctx'
import {hostile} from './diplomacy'
import {economyDef} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb,eq} from './geom'
import {diagonalBlocked} from './path'
import {releaseExchangedPrisoners,releaseRansomedPrisoner} from './prisoners'
import type {Creature,RansomDef,PrisonerExchangeDef} from './types'
export const ransomDef=(w:World)=>w.db.get<RansomDef>('Ransom.Hearth')
export const prisonerExchangeDef=(w:World)=>w.db.get<PrisonerExchangeDef>('PrisonerExchange.Hearth')
function parleyQuote(w:World,p:Creature,holder:Creature,person:Creature,given?:Creature){
 const d=given?prisonerExchangeDef(w):ransomDef(w),price=given?0:ransomDef(w).price,turns=channelTurns(w,p,d.turns,{dexterous:false}),out={price,turns,error:null as string|null},candidate=p.activity?.kind==='ransom'?p.activity.ransom:undefined,work=candidate?.holder===holder.id&&candidate.person===person.id&&candidate.exchange?.person===given?.id?candidate:undefined
 const waiting=holder.activity?.kind==='ransomWait'&&holder.activity.ransom?.payer===p.id&&holder.activity.ransom.holder===holder.id&&holder.activity.ransom.person===person.id
 if(p!==player(w)||holder===p||person===p||holder===person||![p,holder,person].every(c=>w.s.creatures.includes(c)&&c.alive&&(c.mapId===undefined||c.mapId===w.s.map.id))){out.error='같은 현장의 실제 석방 협상 당사자여야 한다';return out}
 if([p,holder].some(c=>c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2||capacity(w,c,'hearing')<.2||capacity(w,c,'sight')<.2)||p.activity&&!work||holder.activity&&!waiting||turns===null){out.error='하던 일을 마치고 깨어서 손과 시청각으로 협상해야 한다';return out}
 if(isCompanion(w,holder)||person.captivity?.captor!==holder.id||person.captivity.faction!==effectiveFaction(w,holder)||person.captivity.escort||person.captivity.faction===effectiveFaction(w,p)){out.error='상대가 실제로 붙잡고 있는 같은 포로와 밧줄을 확인해야 한다';return out}
 if(hostile(w,p,holder)||hostileAware(w,p)){out.error='적대와 눈앞의 위협이 가라앉은 뒤 석방을 협상해야 한다';return out}
 if([holder,person].some(c=>cheb(p.pos,c.pos)>1||!hasLos(w,p.pos,c.pos)||!canSee(w,p,c.pos)||diagonalBlocked(w,p.pos,c.pos.x-p.pos.x,c.pos.y-p.pos.y))||[p,holder,person].some(c=>lightLevel(w,c.pos)>=2)||cheb(holder.pos,person.pos)>1||!canSee(w,holder,p.pos)){out.error='밝은 곳의 같은 포로와 포박자 바로 곁에서 서로 확인해야 한다';return out}
 if(!given&&(!Number.isSafeInteger(p.money??0)||(p.money??0)<price||!Number.isSafeInteger(holder.money??0)||(holder.money??0)<0||!Number.isSafeInteger((holder.money??0)+price))){out.error='실제 몸값을 낼 지갑과 상대가 받을 금액을 확인해야 한다';return out}
 if(given&&([p,holder,person].includes(given)||!w.s.creatures.includes(given)||!given.alive||given.mapId!==undefined&&given.mapId!==w.s.map.id||given.captivity?.captor!==p.id||given.captivity.faction!==effectiveFaction(w,p)||given.captivity.escort||isCompanion(w,given)||given.faction!==effectiveFaction(w,holder)||cheb(p.pos,given.pos)>1||cheb(holder.pos,given.pos)>1||!hasLos(w,p.pos,given.pos)||!hasLos(w,holder.pos,given.pos)||!canSee(w,p,given.pos)||!canSee(w,holder,given.pos)||lightLevel(w,given.pos)>=2||diagonalBlocked(w,p.pos,given.pos.x-p.pos.x,given.pos.y-p.pos.y))){out.error='자기가 실제 붙잡은 상대 편의 같은 포로를 곁에서 교환해야 한다';return out}
 return out
}
export function ransomQuote(w:World,p:Creature,holder:Creature,person:Creature){return parleyQuote(w,p,holder,person)}
export function prisonerExchangeQuote(w:World,p:Creature,holder:Creature,person:Creature,given:Creature){return parleyQuote(w,p,holder,person,given)}
export function prisonerExchangeOffers(w:World,p:Creature,holder:Creature,person:Creature){
 return w.s.creatures.filter(c=>c.captivity?.captor===p.id&&cheb(p.pos,c.pos)<=1&&canSee(w,p,c.pos)).flatMap(given=>{const quote=prisonerExchangeQuote(w,p,holder,person,given);return quote.error?[]:[{given,quote}]})
}
export function startRansom(w:World,p:Creature,holderId:number,personId:number,expectedPrice?:number):string|null{
 return startParley(w,p,holderId,personId,undefined,expectedPrice)
}
export function startPrisonerExchange(w:World,p:Creature,holderId:number,personId:number,givenId:number,receivedRope?:number,givenRope?:number):string|null{
 const given=w.s.creatures.find(c=>c.id===givenId);if(!given)return'교환할 실제 포로가 이 현장에 없다'
 const received=w.s.creatures.find(c=>c.id===personId);if(receivedRope!==undefined&&received?.captivity?.rope.uid!==receivedRope||givenRope!==undefined&&given.captivity?.rope.uid!==givenRope)return'제시한 두 포로의 원래 밧줄을 다시 확인해야 한다'
 return startParley(w,p,holderId,personId,given)
}
function startParley(w:World,p:Creature,holderId:number,personId:number,given?:Creature,expectedPrice?:number):string|null{
 const holder=w.s.creatures.find(c=>c.id===holderId),person=w.s.creatures.find(c=>c.id===personId);if(!holder||!person)return'현장의 같은 포로와 포박자가 없다'
 if(p.activity||holder.activity)return'하던 일을 마친 뒤 새 몸값 협상을 시작해야 한다'
 const q=parleyQuote(w,p,holder,person,given);if(q.error)return q.error;if(expectedPrice!==undefined&&q.price!==expectedPrice)return'제시된 몸값이 바뀌었다'
 const deal={payer:p.id,holder:holder.id,person:person.id,ropeUid:person.captivity!.rope.uid,price:q.price,mapId:w.s.map.id,region:w.s.overworld?.currentRegion,payerPos:{...p.pos},holderPos:{...holder.pos},personPos:{...person.pos},...(given?{exchange:{person:given.id,ropeUid:given.captivity!.rope.uid,pos:{...given.pos}}}:{})},label=given?'두 원래 포로의 교환 합의':'같은 포로의 몸값과 석방 협상'
 p.activity={kind:'ransom',label,ransom:deal,remaining:q.turns!,total:q.turns!}
 holder.activity={kind:'ransomWait',label:label+' 중',ransom:{...deal,payerPos:{...deal.payerPos},holderPos:{...deal.holderPos},personPos:{...deal.personPos},...(deal.exchange?{exchange:{...deal.exchange,pos:{...deal.exchange.pos}}}:{})},remaining:q.turns!,total:q.turns!};return null
}
export function cancelRansom(w:World,c:Creature){
 const a=c.activity,r=a?.ransom;if(!r||!['ransom','ransomWait'].includes(a.kind))return
 const counterpart=w.s.creatures.find(o=>o.id===(a.kind==='ransom'?r.holder:r.payer)),other=counterpart?.activity
 if(other?.ransom?.payer===r.payer&&other.ransom.holder===r.holder&&other.ransom.person===r.person&&other.ransom.ropeUid===r.ropeUid&&other.ransom.exchange?.person===r.exchange?.person&&other.ransom.exchange?.ropeUid===r.exchange?.ropeUid)counterpart!.activity=undefined
 c.activity=undefined
}
/** 같은 합의를 실제 마친 당사자 사이의 현재 공격 연결만 정리한다. 과거 상처/소식/세력 관계는 보존한다. */
function endParleyAggression(parties:Creature[]){
 const ids=new Set(parties.map(c=>c.id))
 for(const c of parties){if(c.attackedBy)c.attackedBy=c.attackedBy.filter(id=>!ids.has(id));if(c.ai.target!==undefined&&ids.has(c.ai.target)){c.ai.target=undefined;c.ai.path=undefined;if(c.ai.mode==='hunt')c.ai.mode='guard'}}
}
export function ransomStep(w:World,c:Creature):boolean{
 const a=c.activity!,r=a.ransom;if(!r){c.activity=undefined;return true}
 const p=w.s.creatures.find(o=>o.id===r.payer),holder=w.s.creatures.find(o=>o.id===r.holder),person=w.s.creatures.find(o=>o.id===r.person)
 const payerWork=p?.activity,waiting=holder?.activity
 if(!p||!holder||!person||payerWork?.kind!=='ransom'||waiting?.kind!=='ransomWait'||payerWork.ransom?.ropeUid!==r.ropeUid||waiting.ransom?.ropeUid!==r.ropeUid||r.mapId!==w.s.map.id||r.region!==w.s.overworld?.currentRegion||person.captivity?.rope.uid!==r.ropeUid||!eq(p.pos,r.payerPos)||!eq(holder.pos,r.holderPos)||!eq(person.pos,r.personPos)){cancelRansom(w,c);return true}
 const given=r.exchange&&w.s.creatures.find(o=>o.id===r.exchange!.person)
 if(r.exchange&&(!given||given.captivity?.rope.uid!==r.exchange.ropeUid||!eq(given.pos,r.exchange.pos)||payerWork.ransom?.exchange?.person!==r.exchange.person||waiting.ransom?.exchange?.person!==r.exchange.person||payerWork.ransom.exchange.ropeUid!==r.exchange.ropeUid||waiting.ransom.exchange.ropeUid!==r.exchange.ropeUid)){cancelRansom(w,c);return true}
 const q=parleyQuote(w,p,holder,person,given);if(q.error||q.price!==r.price){if(c===p)log(w,'warn',`석방 합의 중단: ${q.error??'합의한 금액이 달라졌다'}.`);cancelRansom(w,c);return true}
 if(c===holder){a.remaining=Math.max(1,a.remaining);return false}
 if(a.remaining>0)return false
 const error=given?releaseExchangedPrisoners(w,p,holder,person,given,r.ropeUid,r.exchange!.ropeUid):releaseRansomedPrisoner(w,p,holder,person,r.ropeUid);if(error){cancelRansom(w,c);return true}
 endParleyAggression(given?[p,holder,person,given]:[p,holder,person])
 if(given){p.history.push({turn:turnOf(w),kind:'exchange',text:`두 원래 포로의 석방 합의 · ${knownCreatureName(w,holder)}`});log(w,'good','두 원래 포로의 교환 합의를 마쳤다. 같은 사람과 밧줄을 보존해 각각 석방했다. 돈은 움직이지 않았다.');cancelRansom(w,c);return true}
 p.money=(p.money??0)-r.price;holder.money=(holder.money??0)+r.price
 p.history.push({turn:turnOf(w),kind:'ransom',text:`몸값 ${r.price}${economyDef(w).currency} 지급과 같은 포로 ${knownCreatureName(w,person)} 석방 합의 · ${knownCreatureName(w,holder)}`});log(w,'good',`${knownCreatureName(w,holder)}에게 몸값 ${r.price}${economyDef(w).currency}을(를) 건넸다. 같은 사람의 몸·물품·기존 계약을 보존해 석방했다.`);cancelRansom(w,c);return true
}

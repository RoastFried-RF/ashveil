// 실제 살핀 장소의 원래 명단과 실제 사망/현장 확인만 계약 증거로 쓴다.
import {capacity} from './body'
import {hostileAware} from './action-time'
import {isCompanion} from './companion-state'
import {closeContract,contractAccess} from './contracts'
import {clamp,log,player,rng,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {ensureSociety,factionDef,hostile,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {worldRoute} from './overworld'
import {diagonalBlocked} from './path'
import {sourceDefinitionsAvailable} from './population-sources'
import type {BountyContractDef,BountyContractRecord,ContractRecord,Creature} from './types'

export const bountyDef=(w:World)=>w.db.get<BountyContractDef>('BountyContract.Hearth')
export const isBounty=(r:ContractRecord):r is BountyContractRecord=>r.kind==='eliminate'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isBounty)

function knownRoster(w:World,target:BountyContractDef['targets'][number]){
  const m=w.s.overworld;if(!m)return
  const scene=m.currentRegion===target.region?w.s:m.scenes[target.region]
  if(!scene)return
  const map=scene.map.id===target.mapId?scene.map:scene.maps[target.mapId],source=scene.sources?.find(s=>s.id===target.source&&s.deployed&&s.floors.includes(target.mapId)),pos=map?.waypoints?.[target.waypoint]
  if(!map||!source||!sourceDefinitionsAvailable(w,source)||!source.members?.length||source.members.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(source.members).size!==source.members.length)return
  if(target.waypoint==='@residents'){
    if(source.kind!=='residents'||!scene.creatures.some(c=>source.members!.includes(c.id)&&c.met))return
  }else{
    const observed=pos&&map.tiles[pos.y*map.w+pos.x]?.observed
    if(!observed||observed.at>turnOf(w))return
  }
  return{members:source.members,faction:source.faction??w.db.creature(source.species).faction}
}
export interface BountyOffer {id:string;template:string;label:string;region:string;mapId:string;source:string;distance:number;reward:number;deadlineTurns:number;reputation:number;targets:number[];claimedFaction?:string}
export function bountyOffers(w:World,c:Creature,trader:Creature):BountyOffer[]{
  if(contractAccess(w,c,trader)||marketFor(w,trader)?.mobile)return[]
  const m=w.s.overworld!,market=marketFor(w,trader)!,site=m.sites.find(s=>s.id===market.site),d=bountyDef(w),now=turnOf(w),epoch=Math.floor(now/(d.refreshDays*TURNS_PER_DAY))
  if(!site||!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===site.id&&r.status==='active'&&now<r.deadline))return[]
  return d.targets.flatMap(target=>{
    const known=knownRoster(w,target),destination=m.sites.find(s=>s.id===target.region),id=`eliminate:${site.id}:${epoch}:${target.region}:${target.source}:${target.key}`
    if(target.allegation){
      // 게시 키별 독립 스트림을 사본에서 읽는다. 조회는 실제 세계의 난수/상태를 소비하지 않는다.
      const preview:World={db:w.db,s:{...w.s,rng:{}}}
      if(!rng(preview,`world.bounty-allegation:${site.id}:${epoch}:${target.key}`).chance(target.allegation.chance))return[]
    }
    if(!known||!destination||(target.allegation?.faction??known.faction)===trader.faction||records(w).some(r=>r.id===id||r.region===target.region&&r.source===target.source&&r.status==='completed'))return[]
    const route=worldRoute(w,site.cell,destination.cell);if(!route)return[]
    const distance=Math.abs(site.cell.x-destination.cell.x)+Math.abs(site.cell.y-destination.cell.y),reward=Math.ceil((d.baseReward+distance*d.distanceReward+target.threat*d.threatReward)*d.wealthMult)
    if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money)return[]
    return[{id,template:target.key,label:target.label,region:target.region,mapId:target.mapId,source:target.source,distance,reward,deadlineTurns:Math.ceil(route.hours*2*TURNS_PER_HOUR+d.deadlineBufferDays*TURNS_PER_DAY),reputation:d.reputation,targets:[...known.members],...(target.allegation?{claimedFaction:target.allegation.faction}:{})}]
  })
}
export function acceptBounty(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
  const error=contractAccess(w,c,trader);if(error)return error
  const offer=bountyOffers(w,c,trader).find(o=>o.id===id);if(!offer)return'게시된 토벌 장소·보수·진행 중인 계약을 다시 확인해야 한다'
  if(expectedReward!==undefined&&expectedReward!==offer.reward)return'게시된 토벌 보수가 바뀌었다'
  const market=marketFor(w,trader)!,now=turnOf(w),record:BountyContractRecord={...offer,kind:'eliminate',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active',evidence:[]}
  market.money-=offer.reward;(w.s.overworld!.contracts??=[]).push(record)
  c.history.push({turn:now,kind:'contract',text:`${trader.name}의 토벌 계약을 맡았다: ${record.label}.`})
  log(w,'info',`${record.label}. 원래 거주자의 실제 처치 기록을 남기거나 현장의 시신을 직접 확인한 뒤 돌아오자. ${record.reward}${economyDef(w).currency}은(는) 장부에 맡겼다.`)
  return null
}
export function recordBountyVictory(w:World,target:Creature,contribution:boolean){
  const now=turnOf(w),p=player(w)
  if(!contribution||target.alive||target.deathTurn!==now||!w.s.creatures.includes(target)||target.mapId!==undefined&&target.mapId!==w.s.map.id||!player(w).alive||target.id===w.s.playerId||isCompanion(w,target))return
  const active=records(w).filter(record=>record.status==='active'&&now>=record.accepted&&now<record.deadline&&record.targets.includes(target.id)&&!record.evidence.some(e=>e.id===target.id))
  if(!active.length)return
  const observed=!p.asleep&&!p.unconscious&&capacity(w,p,'consciousness')>=.3&&capacity(w,p,'sight')>=.2&&canSee(w,p,target.pos)
  for(const record of active)record.evidence.push({id:target.id,at:now,kind:'kill',observed,mapId:w.s.map.id,...(w.s.overworld?{region:w.s.overworld.currentRegion}:{})})
}
export function bountyEvidenceQuote(w:World,c:Creature,id:string){
  const record=records(w).find(r=>r.id===id),out={record,dead:[]as number[],error:null as string|null},now=turnOf(w)
  if(c.id!==w.s.playerId||!c.alive||!record||record.status!=='active'){out.error='진행 중인 자신의 토벌 계약이 없다';return out}
  if(now>=record.deadline){out.error='토벌 계약의 기한이 지났다';return out}
  if(c.asleep||c.unconscious||c.activity||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||capacity(w,c,'manipulation')<.2){out.error='시신을 확인할 몸과 시력이 필요하다';return out}
  if(hostileAware(w,c)){out.error='위협에서 벗어난 뒤 시신을 확인해야 한다';return out}
  if(lightLevel(w,c.pos)>=2){out.error='시신을 식별할 밝기가 필요하다';return out}
  out.dead=w.s.creatures.filter(t=>!t.alive&&t.deathTurn!==undefined&&(t.mapId===undefined||t.mapId===w.s.map.id)&&record.targets.includes(t.id)&&!record.evidence.some(e=>e.id===t.id&&e.observed!==false)&&cheb(c.pos,t.pos)<=1&&canSee(w,c,t.pos)&&hasLos(w,c.pos,t.pos)&&!diagonalBlocked(w,c.pos,t.pos.x-c.pos.x,t.pos.y-c.pos.y)).map(t=>t.id)
  if(!out.dead.length)out.error='바로 곁에 아직 확인하지 않은 계약 대상의 시신이 없다'
  return out
}
export function surveyBounty(w:World,c:Creature,id:string):string|null{
  const q=bountyEvidenceQuote(w,c,id);if(q.error)return q.error
  for(const target of q.dead){const old=q.record!.evidence.find(e=>e.id===target);if(old)old.observed=true;else q.record!.evidence.push({id:target,at:turnOf(w),kind:'foundDead',observed:true,mapId:w.s.map.id,...(w.s.overworld?{region:w.s.overworld.currentRegion}:{})})}
  log(w,'info','계약 대상의 실제 시신을 곁에서 확인했다. 자신의 처치와 구별해 장부에 남겼다.');return null
}
export function bountyReportQuote(w:World,c:Creature,trader:Creature,id:string){
  const record=records(w).find(r=>r.id===id),out={record,error:contractAccess(w,c,trader)}
  if(out.error)return out
  if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'){out.error='진행 중인 이 정착지의 토벌 계약이 아니다';return out}
  if(turnOf(w)>=record.deadline){out.error='토벌 계약의 기한이 지났다';return out}
  const contradicted=!!record.testimony&&!!record.claimedFaction&&record.testimony.faction!==record.claimedFaction,refund=contradicted||record.evidence.some(e=>e.kind==='foundDead')
  if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!refund&&!Number.isSafeInteger((c.money??0)+record.escrow)){out.error='맡긴 보수와 지갑을 확인할 수 없다';return out}
  const market=marketFor(w,trader)!
  if(refund&&(!Number.isSafeInteger(market.money)||market.money<0||!Number.isSafeInteger(market.money+record.escrow))){out.error='맡긴 보수를 돌려놓을 장부를 확인해야 한다';return out}
  if(!contradicted&&(!record.targets.length||!record.targets.every(id=>record.evidence.some(e=>e.id===id&&e.observed!==false))))out.error='계약에 적힌 인원의 처치나 현장 시신을 모두 확인해야 한다'
  return out
}
export function reportBounty(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
  const q=bountyReportQuote(w,c,trader,id);if(q.error)return q.error
  const record=q.record!;if(expectedReward!==undefined&&expectedReward!==record.reward)return'계약 보수가 달라졌다'
  if(record.testimony&&record.claimedFaction&&record.testimony.faction!==record.claimedFaction){
    if(!closeContract(w,record,'cancelled'))return'맡긴 보수를 돌려놓을 장부를 확인해야 한다'
    record.outcome='contradicted';log(w,'info','당사자에게 직접 들은 소속이 의뢰인의 설명과 다르다. 처치 없이 이의를 보고하고 보수를 장부로 반환했다.');return null
  }
  if(record.evidence.some(e=>e.kind==='foundDead')){
    if(!closeContract(w,record,'cancelled'))return'맡긴 보수를 돌려놓을 장부를 확인해야 한다'
    record.outcome='alreadyDead';log(w,'info','다른 이가 처치한 대상이 현장에서 확인되어 토벌 계약을 닫았다. 보수는 장부로 돌아가며 자신의 처치로 기록하지 않는다.');return null
  }
  c.money=(c.money??0)+record.escrow;record.escrow=0;record.status='completed';record.closed=turnOf(w);record.outcome='killed'
  const society=ensureSociety(w)!;society.reputation[record.faction]=clamp(reputation(w,record.faction)+record.reputation,-100,100)
  c.history.push({turn:turnOf(w),kind:'contract',text:`${record.issuer}의 토벌 계약을 마쳤다: ${record.label}.`});log(w,'good',`${record.label} 보고 완료. 맡겨 둔 ${record.reward}${economyDef(w).currency}을(를) 받았다. 평판 +${record.reputation}.`);return null
}

/** 대상 당사자의 현재 발언만 보존한다. 세력 총계나 미목격 사람을 조회해 증언을 만들지 않는다. */
export function bountyQuestionQuote(w:World,c:Creature,target:Creature,id:string){
  const record=records(w).find(r=>r.id===id),out={record,error:null as string|null},now=turnOf(w)
  if(c.id!==w.s.playerId||!record||record.status!=='active'||now>=record.deadline||!record.claimedFaction||!record.targets.includes(target.id)){out.error='당사자에게 물을 진행 중인 계약이 없다';return out}
  if(record.testimony){out.error='이 계약의 당사자 증언은 이미 기록했다';return out}
  if(!w.s.creatures.includes(c)||!w.s.creatures.includes(target)||c.mapId!==undefined&&c.mapId!==w.s.map.id||target.mapId!==undefined&&target.mapId!==w.s.map.id||w.s.overworld?.currentRegion!==record.region||w.s.map.id!==record.mapId){out.error='계약 장소의 실제 당사자를 만나야 한다';return out}
  if([c,target].some(a=>!a.alive||a.asleep||a.unconscious||a.activity||a.captivity||capacity(w,a,'consciousness')<.5||capacity(w,a,'hearing')<.2)||hostile(w,c,target)||hostileAware(w,c)){out.error='안전한 곳에서 깨어 있는 당사자와 이야기해야 한다';return out}
  if(cheb(c.pos,target.pos)>1||!canSee(w,c,target.pos)||!hasLos(w,c.pos,target.pos)||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y)){out.error='서로 보고 들을 수 있게 당사자 곁으로 다가가야 한다';return out}
  return out
}
export function questionBounty(w:World,c:Creature,target:Creature,id:string):string|null{
  const q=bountyQuestionQuote(w,c,target,id);if(q.error)return q.error
  q.record!.testimony={id:target.id,name:target.name,faction:target.faction,at:turnOf(w),region:w.s.overworld!.currentRegion!,mapId:w.s.map.id};target.met=true
  log(w,'info',`${target.name}은(는) 자신이 ${factionDef(w,target.faction)?.label??target.faction} 소속이라고 답했다. 계약 장부에 직접 들은 증언을 남겼다.`);return null
}

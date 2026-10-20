// 은퇴는 실제 거처/생활비와 현장 추적을 확인한 뒤 안전하게 생애를 끝낸다.
import {capacity,isMissing,part} from './body'
import {calendar} from './climate-state'
import {turnOf,TURNS_PER_DAY,type World} from './ctx'
import {hostile,reputation} from './diplomacy'
import {marketFor,tradeAccess} from './economy'
import {innDef,innQuote} from './inn'
import {allItems} from './items'
import {buildReport} from './report'
import type {Creature,LegacyResident,RetirementDef,RetirementRecord} from './types'
export const retirementDef=(w:World)=>w.db.get<RetirementDef>('Retirement.Hearth')
const labels={peaceful:'평온한 은퇴',wounded:'상처 입은 은퇴',legend:'전설의 은퇴'}
export function retirementDisability(w:World,c:Creature){const d=retirementDef(w),parts=w.db.body(c.body.def).parts;return d.disabilityParts.some(id=>parts.some(part=>part.id===id)&&(isMissing(w,c,id)||c.body.damagedTendons?.includes(id)||(c.body.nerveDamage?.[id]??0)>0))||!!c.body.chronicPain?.length}
function unresolvedPursuit(w:World,c:Creature){
 const m=w.s.overworld,scenes=Object.values(m?.scenes??{}),people=[...w.s.creatures,...Object.values(w.s.offCreatures).flat(),...scenes.flatMap(scene=>[...scene.creatures,...Object.values(scene.offCreatures).flat()])]
 if(people.some(person=>person.id!==c.id&&person.alive&&person.ai.mode==='hunt'&&person.ai.target===c.id&&hostile(w,c,person)))return true
 return [w.s.map,...Object.values(w.s.maps),...scenes.flatMap(scene=>[scene.map,...Object.values(scene.maps)])].some(map=>map.baseCamp?.owner===c.id&&map.baseCamp.raid?.phase==='active')
}
export function retirementLongLeaseQuote(w:World,c:Creature,keeper:Creature,bed:string){const d=retirementDef(w),inn=innDef(w,keeper),periods=inn?Math.max(1,Math.ceil(d.longLeaseDays*TURNS_PER_DAY/inn.leaseTurns)):1;return{...innQuote(w,c,keeper,bed,periods),periods}}
export function retirementQuote(w:World,c:Creature,keeper:Creature){
 const d=retirementDef(w),m=w.s.overworld,site=m?.sites.find(site=>site.id===m.currentRegion),age=c.age?.years??30,years=age<d.youngAge?d.youngYears:age<d.oldAge?d.middleYears:d.oldYears,disabled=retirementDisability(w,c),yearDays=calendar(w).yearDays,savings=Math.ceil(d.dailyLivingCost*yearDays*years*(disabled?d.disabilityFactor:1)),now=turnOf(w)
 const bed=w.s.map.innBeds?.find(bed=>bed.keeper===keeper.id&&bed.lease?.tenant===c.id&&bed.lease.until-now>=d.minHousingDays*TURNS_PER_DAY&&w.s.map.tiles[bed.pos.y*w.s.map.w+bed.pos.x]?.t===bed.terrain)
 const relic=allItems(c).some(item=>w.db.item(item.def).relic&&item.appraisal===2&&(item.durability??100)>0),renown=reputation(w,keeper.faction),kind:RetirementRecord['kind']=renown>=d.legendRenown&&relic?'legend':disabled?'wounded':'peaceful'
 let error=tradeAccess(w,c,keeper)
 if(!error&&(c.id!==w.s.playerId||!w.s.creatures.includes(c)||!w.s.creatures.includes(keeper)||c.asleep||c.captivity||!c.alive||capacity(w,c,'consciousness')<.5||w.s.over||m?.travel))error='깨어서 여관 주인과 원정을 마칠 수 있어야 한다'
 if(!error&&(!site||site.kind!=='settlement'||keeper.traderSite!==site.id||!innDef(w,keeper)))error='이 정착지의 실제 여관 주인과 합의해야 한다'
 if(!error&&!bed)error=`이 여관의 실제 침대를 앞으로${d.minHousingDays}일 이상 빌려야 한다`
 if(!error&&renown<d.friendly)error='그 정착지 세력과 우호 이상이어야 한다'
 if(!error&&(c.money??0)<savings)error=`앞으로의 생활비${savings}전이 부족하다`
 if(!error&&unresolvedPursuit(w,c))error='당신을 쫓는 인물이나 거점의 미해결 습격이 남아 있다'
 const market=marketFor(w,keeper),until=Math.max(bed?.lease?.until??now,now)+yearDays*years*TURNS_PER_DAY
 if(!error&&(!Number.isSafeInteger(c.money??0)||!Number.isSafeInteger(market?.money??0)||(market?.money??0)<0||!Number.isSafeInteger(savings)||!Number.isSafeInteger(until)||!Number.isSafeInteger((market?.money??0)+savings)))error='생활비나 거처 기간을 장부에 기록할 수 없다'
 return{error,site,bed,market,kind,label:labels[kind],age,years,yearDays,disabled,savings,until,estate:(c.money??0)-savings}
}
export function retire(w:World,c:Creature,keeper:Creature,expectedSavings?:number){
 const q=retirementQuote(w,c,keeper);if(q.error)return q.error
 if(expectedSavings!==undefined&&expectedSavings!==q.savings)return '필요한 생활비가 바뀌었다. 다시 확인해야 한다'
 const now=turnOf(w),tales=[...(c.fieldNotes?.map(note=>`${note.title}: ${note.text}`)??[]),...(w.s.overworld?.society?.disclosures??[]).filter(record=>record.source===c.id).map(record=>`현장에서 원본 기록을${record.witnesses.length}명에게 공개했고${record.reformers.length}명이 규정을 거부했다.`)].slice(-6)
 const legacy:LegacyResident={key:`${q.site!.id}:${now}:${c.id}`,seed:w.s.seed,site:q.site!.id,name:c.name,age:q.age,tales:tales.length?tales:['떠돌이로 살던 원정을 마치고 이 정착지에 머물기로 했다.']}
 c.money=q.estate;q.market!.money+=q.savings;q.bed!.lease={tenant:c.id,until:q.until}
 c.history.push({turn:now,kind:'retirement',text:`${q.site!.label}의 거처를 확보하고 생활비${q.savings}전을 맡겼다. ${q.label}.`})
 const report=buildReport(w,c,'retire',q.label)
 report.title=q.label;report.epitaph=`떠돌이 ${c.name}, ${q.site!.label}에 정착했다. 아직 살아 있으며 그 원정의 이야기를 기억한다.`
 report.stats.push(`확보한 생활비${q.years}년 · 맡긴 돈${q.savings}전 · 남은 재산${q.estate}전`)
 for(const scar of c.body.scars??[])report.vitals.push(`후유증: ${part(w,c,scar.part).label} 흉터 · 남은 기능 상한${Math.round(scar.cap*100)}%`)
 for(const note of tales)report.chain.push(note)
 report.stats.push(`익힌 능력${c.abilities.length}개 · 남은 능력 점수${c.abilityPoints}`)
 w.s.over={kind:'retire',turn:now,report,retirement:{kind:q.kind,site:q.site!.id,keeper:keeper.id,bed:q.bed!.id,paid:q.savings,estate:q.estate,legacy}}
 c.activity=undefined;w.s.simulationPending=undefined
 return null
}

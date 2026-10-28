// 직접 본 봉인 보관함의 기존 원본만 발굴한다. 보관함/물품/도구를 새로 만들지 않는다.
import {channelTurns,hostileAware} from './action-time'
import {openContainer} from './actions'
import {capacity} from './body'
import {contractAccess} from './contracts'
import {clamp,inBounds,log,player,tileAt,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {ensureSociety,reputation} from './diplomacy'
import {economyDef,marketFor} from './economy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {itemDef} from './items'
import {worldRoute} from './overworld'
import {diagonalBlocked} from './path'
import type {ContractRecord,Creature,ExcavationContractDef,ExcavationContractRecord} from './types'
export const excavationDef=(w:World)=>w.db.get<ExcavationContractDef>('ExcavationContract.Hearth')
export const isExcavation=(r:ContractRecord):r is ExcavationContractRecord=>r.kind==='excavate'
const records=(w:World)=>(w.s.overworld?.contracts??[]).filter(isExcavation)
function access(w:World,c:Creature,trader:Creature){if(c!==player(w)||!w.s.creatures.includes(c)||!w.s.creatures.includes(trader)||c.mapId&&c.mapId!==w.s.map.id||trader.mapId&&trader.mapId!==w.s.map.id)return'같은 현장의 실제 자신과 의뢰인이 필요하다';return contractAccess(w,c,trader)}
export function excavationOffers(w:World,c:Creature,trader:Creature){
 if(access(w,c,trader)||marketFor(w,trader)?.mobile)return[]
 const m=w.s.overworld!,market=marketFor(w,trader)!,site=m.sites.find(s=>s.id===market.site),d=excavationDef(w),epoch=Math.floor(turnOf(w)/(d.refreshDays*TURNS_PER_DAY))
 if(!site||!Number.isSafeInteger(market.money)||m.contracts?.some(r=>r.site===site.id&&r.status==='active'))return[]
 return d.targets.flatMap(target=>{
  const scene=m.currentRegion===target.region?w.s:m.scenes[target.region],map=scene&&(scene.map.id===target.mapId?scene.map:scene.maps[target.mapId]),pos={x:target.pos[0],y:target.pos[1]},memory=map&&pos.x<map.w&&pos.y<map.h?map.tiles[pos.y*map.w+pos.x]?.observed:undefined
  if(!memory||memory.terrain!==target.terrain||memory.at>turnOf(w)||memory.contents||records(w).some(r=>r.template===target.key&&(r.status==='completed'||r.status==='active')))return[]
  const id=`excavate:${site.id}:${epoch}:${target.key}`;if(records(w).some(r=>r.id===id))return[]
  const destination=m.sites.find(s=>s.id===target.region),route=destination&&worldRoute(w,site.cell,destination.cell);if(!destination||!route)return[]
  const distance=Math.abs(site.cell.x-destination.cell.x)+Math.abs(site.cell.y-destination.cell.y),reward=Math.ceil((d.baseReward+distance*d.distanceReward+target.threat*d.threatReward)*d.wealthMult)
  if(!Number.isSafeInteger(reward)||reward<=0||reward>market.money)return[]
  return[{id,template:target.key,label:target.label,region:target.region,mapId:target.mapId,pos,terrain:target.terrain,item:target.item,distance,reward,deadlineTurns:Math.ceil(route.hours*2*TURNS_PER_HOUR+d.deadlineBufferDays*TURNS_PER_DAY),reputation:d.reputation,minDurability:d.minDurability}]
 })
}
export function acceptExcavation(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const error=access(w,c,trader);if(error)return error
 const offer=excavationOffers(w,c,trader).find(o=>o.id===id);if(!offer||expectedReward!==undefined&&expectedReward!==offer.reward)return'직접 본 봉인 보관함과 예치 보수를 다시 확인해야 한다'
 const market=marketFor(w,trader)!,now=turnOf(w),record:ExcavationContractRecord={...offer,kind:'excavate',site:market.site,faction:trader.faction,issuer:trader.name,accepted:now,deadline:now+offer.deadlineTurns,escrow:offer.reward,status:'active'}
 market.money-=record.escrow;(w.s.overworld!.contracts??=[]).push(record);c.history.push({turn:now,kind:'contract',text:`${record.issuer}의 봉인 보관함 발굴을 맡았다: ${record.label}.`});log(w,'info',`${record.label}. 실제 도구로 원래 보관함을 열어 그 안의 원본을 가져오자. ${record.reward}${economyDef(w).currency}을(를) 장부에 맡겼다.`);return null
}
const signature=(t:NonNullable<ReturnType<typeof tileAt>['cont']>)=>JSON.stringify({kind:t.kind,items:t.items.map(({uid,def,count})=>({uid,def,count}))})
export function excavationWorkQuote(w:World,c:Creature,id:string,continuing=false){
 const record=records(w).find(r=>r.id===id),d=excavationDef(w),out={record,tool:undefined as Creature['bag'][number]|undefined,turns:0,error:null as string|null},now=turnOf(w)
 if(c!==player(w)||!w.s.creatures.includes(c)||!c.alive||c.mapId&&c.mapId!==w.s.map.id||!record||record.status!=='active'||now<=record.accepted||now>=record.deadline||record.proof){out.error='수락 뒤 직접 진행할 자신의 발굴 의뢰가 필요하다';return out}
 if(c.asleep||c.unconscious||c.captivity||c.breakdown||!continuing&&c.activity||capacity(w,c,'consciousness')<.5||capacity(w,c,'sight')<.2||capacity(w,c,'manipulation')<.2||hostileAware(w,c)){out.error='위협에서 벗어나 도구와 눈을 쓸 수 있어야 한다';return out}
 if(record.region!==w.s.overworld?.currentRegion||record.mapId!==w.s.map.id||!inBounds(w,record.pos)||cheb(c.pos,record.pos)>1||!canSee(w,c,record.pos)||!hasLos(w,c.pos,record.pos)||diagonalBlocked(w,c.pos,record.pos.x-c.pos.x,record.pos.y-c.pos.y)||lightLevel(w,c.pos)>=2||lightLevel(w,record.pos)>=2){out.error='원래 봉인 보관함 곁의 식별할 밝기와 시야가 필요하다';return out}
 const tile=tileAt(w,record.pos),work=record.work,tool=work?c.bag.find(i=>i.uid===work.toolUid):c.bag.find(i=>itemDef(w,i).toolTags?.includes(d.tool)&&(i.durability??100)>0)
 if(tile.t!==record.terrain||!tile.cont||tile.cont.opened||tile.searched){out.error='아직 열지 않은 원래 실물 보관함이어야 한다';return out}
 if(!tool||tool.count<=0||(tool.durability??100)<=0||!itemDef(w,tool).toolTags?.includes(d.tool)||work&&(tool.def!==work.toolDef||signature(tile.cont)!==work.signature||JSON.stringify(d)!==work.rule||!Number.isFinite(work.progress)||work.progress<0||work.progress>=work.total||work.total!==d.workTurns)){out.error='예약한 같은 실제 도구와 원래 보관함·작업 지침을 확인해야 한다';return out}
 const turns=channelTurns(w,c,work?work.total-work.progress:d.workTurns)
 if(turns===null){out.error='몸 상태 때문에 봉인 해체 작업을 할 수 없다';return out}
 out.tool=tool;out.turns=turns;return out
}
export function startExcavation(w:World,c:Creature,id:string):string|null{
 const q=excavationWorkQuote(w,c,id);if(q.error)return q.error
 const r=q.record!,d=excavationDef(w);r.work??={toolUid:q.tool!.uid,toolDef:q.tool!.def,signature:signature(tileAt(w,r.pos).cont!),rule:JSON.stringify(d),progress:0,total:d.workTurns}
 c.activity={kind:'excavate',remaining:q.turns,total:q.turns,target:{...r.pos},excavation:{contract:id,progress:r.work.progress,mapId:w.s.map.id,region:w.s.overworld!.currentRegion!},label:r.label};return null
}
export function excavationStep(w:World,c:Creature){
 const a=c.activity,task=a?.excavation;if(!a||!task){c.activity=undefined;return true}
 const q=excavationWorkQuote(w,c,task.contract,true),r=q.record
 const error=task.mapId!==w.s.map.id||task.region!==w.s.overworld?.currentRegion?'원래 현장을 떠났다':q.error
 if(error){log(w,'warn',`발굴 중단: ${error}. 남은 작업과 원래 도구 예약을 유지한다.`);c.activity=undefined;return true}
 const work=r!.work!;work.progress=Math.min(work.total,task.progress+(work.total-task.progress)*((a.total??1)-Math.max(0,a.remaining))/(a.total??1))
 if(a.remaining>0)return false
 // 위 검증은 실물 cont를 요구하므로 openContainer의 전리품 생성 경로에 들어가지 않는다.
 openContainer(w,c,r!.pos);const item=tileAt(w,r!.pos).cont!.items.find(i=>i.def===r!.item&&i.count===1&&(i.durability??100)>=r!.minDurability)
 r!.proof={at:turnOf(w),by:c.id,result:item?'found':'empty',...(item?{uid:item.uid}:{})};r!.work=undefined;c.activity=undefined
 log(w,item?'good':'warn',item?'원래 봉인 보관함을 해체했다. 나온 같은 원본을 배낭에 챙겨 장부로 가져가자.':'봉인을 해체했으나 의뢰한 원본이 없다. 새로운 물품을 만들지 않았다.');return true
}
export function excavationDeliveryQuote(w:World,c:Creature,trader:Creature,id:string){
 const record=records(w).find(r=>r.id===id),out={record,item:undefined as Creature['bag'][number]|undefined,error:access(w,c,trader)},now=turnOf(w)
 if(out.error)return out
 if(!record||record.site!==trader.traderSite||record.faction!==trader.faction||record.status!=='active'||now>=record.deadline||record.proof?.result!=='found'||record.proof.by!==c.id||record.proof.at<=record.accepted||record.proof.at>now){out.error='수락 뒤 직접 발굴한 원본의 기록이 필요하다';return out}
 const item=c.bag.find(i=>i.uid===record.proof!.uid)
 if(!item||item.def!==record.item||item.count!==1||(item.durability??100)<record.minDurability){out.error='실제로 발굴한 같은 원본을 배낭에 보존해야 한다';return out}
 if(record.escrow!==record.reward||!Number.isSafeInteger(record.escrow)||record.escrow<=0||!Number.isSafeInteger(c.money??0)||(c.money??0)<0||!Number.isSafeInteger((c.money??0)+record.escrow)){out.error='예치 보수와 지갑 잔액을 확인해야 한다';return out}
 out.item=item;return out
}
export function deliverExcavation(w:World,c:Creature,trader:Creature,id:string,expectedReward?:number):string|null{
 const q=excavationDeliveryQuote(w,c,trader,id);if(q.error)return q.error
 const r=q.record!,item=q.item!;if(expectedReward!==undefined&&expectedReward!==r.reward)return'발굴 납품 보수가 달라졌다'
 c.bag.splice(c.bag.indexOf(item),1);delete item.gx;delete item.gy;delete item.rot;marketFor(w,trader)!.items.push(item)
 c.money=(c.money??0)+r.escrow;r.escrow=0;r.status='completed';r.closed=turnOf(w);r.recipient={at:turnOf(w),uid:item.uid,def:item.def}
 ensureSociety(w)!.reputation[r.faction]=clamp(reputation(w,r.faction)+r.reputation,-100,100);c.history.push({turn:turnOf(w),kind:'contract',text:`${r.issuer}에게 직접 발굴한 같은 원본을 납품했다: ${r.label}.`});log(w,'good',`${r.label} 완료. 원래 물품을 넘기고 예치한 ${r.reward}${economyDef(w).currency}을(를) 받았다.`);return null
}

// 주민의 원래 종자/개인 물과 실제 심은 한 밭만 쓴다. 숨은 밭의 현재 상태는 읽지 않는다.
import {hostileAware} from './action-time'
import {ambientTemp,daylight} from './environment'
import {towerSoilFertility} from './tower-consequences'
import {capacity,totalBleed} from './body'
import {activeEscort} from './escort-contracts'
import {hostile} from './diplomacy'
import {creatureAt,inBounds,player,terrainAt,tileAt,log,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb,DIRS,dirIndex,type Pos} from './geom'
import {diagonalBlocked,findPath} from './path'
import {itemDef,removeOne,addToBag} from './items'
import {cultivationStatus,cultivationWaterQuote,cultivationSubstrateQuote} from './cultivation'
import {drinkVolume} from './wash-water'
import {suitableDrink} from './water-state'
import {isWaterVessel} from './water-vessels'
import type {Action} from './actions'
import type {Creature,ResidentCultivationDef} from './types'
export const residentCultivationDef=(w:World)=>w.db.get<ResidentCultivationDef>('ResidentCultivation.Hearth')
function resident(w:World,c:Creature){return w.s.map.kind==='surface'&&c!==player(w)&&c.faction!=='player'&&w.s.creatures.includes(c)&&c.residentSite===w.s.overworld?.currentRegion&&!!c.residentSite&&!!c.home&&Number.isSafeInteger(c.home.x)&&Number.isSafeInteger(c.home.y)&&inBounds(w,c.home)&&(!c.mapId||c.mapId===w.s.map.id)&&inBounds(w,c.pos)&&!c.body.machine&&w.db.body(c.body.def).kind==='humanoid'}
function investigationClear(w:World,c:Creature){if(c.ai.mode!=='investigate')return true;const p=c.ai.dest;if(!p||!inBounds(w,p)||cheb(c.pos,p)>1||!canSee(w,c,p)||!hasLos(w,c.pos,p))return false;const other=creatureAt(w,p);return cheb(c.pos,p)===0||!!other&&!hostile(w,c,other)}
function ready(w:World,c:Creature){const d=residentCultivationDef(w);return d.enabled&&resident(w,c)&&c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&!c.companion&&!c.rescue&&!c.activity&&!c.breakdown&&!c.roadRaid&&!c.caravan&&!c.abduction&&!c.companionRecovery&&!c.recoveryCargo&&!c.ai.task&&!c.ai.route?.length&&!c.ai.target&&!activeEscort(w,c)&&!['hunt','flee','surrender','patrol','return'].includes(c.ai.mode)&&investigationClear(w,c)&&d.roles.includes(w.db.creature(c.def).ai)&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'sight')>=.2&&capacity(w,c,'manipulation')>=.2&&!hostileAware(w,c)&&totalBleed(w,c)<=0&&c.needs.kcal>=d.minKcal&&c.needs.waterDeficit<d.maxWaterDeficit&&c.needs.fatigue<d.maxFatigue&&c.needs.bodyTemp>=d.minBodyTemp&&c.needs.bodyTemp<=d.maxBodyTemp}
export function recordResidentPlanting(w:World,c:Creature,pos:Pos,seedUid:number){
 if(!resident(w,c)||cheb(pos,c.home!)>residentCultivationDef(w).homeRadius)return
 const crop=tileAt(w,pos).cultivation
 if(crop?.seedUid!==seedUid||crop.ownerId!==c.id)return
 c.residentPlot={pos:{...pos},seedUid,terrain:crop.terrain,map:w.s.map.id,region:c.residentSite!}
}
const currentPlot=(w:World,c:Creature)=>{const q=c.residentPlot;return q&&q.pos&&Number.isSafeInteger(q.pos.x)&&Number.isSafeInteger(q.pos.y)&&Number.isSafeInteger(q.seedUid)&&q.seedUid>0&&typeof q.terrain==='string'&&q.map===w.s.map.id&&q.region===w.s.overworld?.currentRegion&&inBounds(w,q.pos)?q:undefined}
function matches(w:World,c:Creature){const plot=currentPlot(w,c),state=plot&&tileAt(w,plot.pos).cultivation;return !!plot&&!!state&&state.seedUid===plot.seedUid&&state.ownerId===c.id&&state.terrain===plot.terrain&&tileAt(w,plot.pos).t===plot.terrain}
export function forgetResidentPlot(w:World,c:Creature):string|null{const plot=currentPlot(w,c);if(!ready(w,c)||!plot||!canSee(w,c,plot.pos)||!hasLos(w,c.pos,plot.pos)||matches(w,c))return '곁에서 사라진 자기 밭을 확인해야 한다';delete c.residentPlot;return null}
function waterBudget(w:World,c:Creature){return c.bag.reduce((n,i)=>n+(isWaterVessel(w,i)&&!i.waterFrozen&&suitableDrink(w,i)?drinkVolume(w,i):0),0)}
export function residentCultivationDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 if(!ready(w,c))return null
 const d=residentCultivationDef(w),plot=currentPlot(w,c)
 if(c.residentPlot&&!plot)return null
 if(plot){
  if(!canSee(w,c,plot.pos)||!hasLos(w,c.pos,plot.pos))return cheb(c.pos,plot.pos)>0?{goal:plot.pos}:null
  if(!matches(w,c))return{action:{type:'residentPlotCheck'}}
  if(cheb(c.pos,plot.pos)>1||diagonalBlocked(w,c.pos,plot.pos.x-c.pos.x,plot.pos.y-c.pos.y))return{goal:plot.pos}
  const crop=cultivationStatus(w,plot.pos);if(!crop?.valid)return null
  if(crop.rule!.substrate&&crop.state.remainingCycles===0){const wood=c.bag.find(i=>i.def===crop.rule!.substrate!.item&&i.count>0);return wood&&!cultivationSubstrateQuote(w,c,plot.pos,wood.uid).error?{action:{type:'refreshCropSubstrate',pos:plot.pos,uid:wood.uid}}:null}
  if(crop.ready)return{action:{type:'gather',pos:plot.pos}}
  if(crop.waterMl>=d.waterBelowMl||waterBudget(w,c)-d.reserveWaterMl<1)return null
  for(const bottle of [...c.bag].sort((a,b)=>a.uid-b.uid)){if(!isWaterVessel(w,bottle)||bottle.waterFrozen||!suitableDrink(w,bottle))continue;const ml=Math.min(d.doseMl,drinkVolume(w,bottle),Math.floor(waterBudget(w,c)-d.reserveWaterMl),Math.floor(crop.rule!.waterMl-crop.waterMl));if(ml>0&&!cultivationWaterQuote(w,c,plot.pos,bottle.uid,ml).error)return{action:{type:'waterCrop',pos:plot.pos,uid:bottle.uid,ml}}}
  return null
 }
 const seed=c.bag.filter(i=>i.count>0&&itemDef(w,i).place&&w.db.terrain(itemDef(w,i).place!).cultivation).sort((a,b)=>a.uid-b.uid)[0]
 if(!seed||waterBudget(w,c)<d.reserveWaterMl+d.doseMl)return null
 if(cheb(c.pos,c.home!)>d.homeRadius)return{goal:c.home!}
 const destinations:Pos[]=[]
 for(let y=c.home!.y-d.homeRadius;y<=c.home!.y+d.homeRadius;y++)for(let x=c.home!.x-d.homeRadius;x<=c.home!.x+d.homeRadius;x++){
  const p={x,y};if(!inBounds(w,p)||!canSee(w,c,p)||!hasLos(w,c.pos,p))continue
  const terrain=terrainAt(w,p),tile=tileAt(w,p);if(w.db.terrain(itemDef(w,seed).place!).cultivation?.needsSoil!==false&&!terrain.soil||!terrain.passable||terrain.gather||terrain.water||terrain.stairs||terrain.container||terrain.station||terrain.bedding||tile.placed||tile.items.length||creatureAt(w,p))continue
  const destination=w.db.terrain(itemDef(w,seed).place!),rule=destination.cultivation!,light=daylight(w)*(w.s.map.daylightMult??1)*(tile.roof?.45:1),temp=ambientTemp(w,p)
  if(light>=rule.minLight&&(rule.maxLight===undefined||light<=rule.maxLight)&&temp>=rule.minTemp&&temp<=rule.maxTemp&&(!destination.gather?.soilDependent||towerSoilFertility(w)>0))destinations.push(p)
 }
 destinations.sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
 for(const p of destinations){
  if(cheb(c.pos,p)<=1&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y))return{action:{type:'place',uid:seed.uid,dir:dirIndex(p.x-c.pos.x,p.y-c.pos.y)}}
  const access=DIRS.map(v=>({x:p.x+v.x,y:p.y+v.y})).filter(q=>inBounds(w,q)&&cheb(q,c.home!)<=d.homeRadius&&terrainAt(w,q).passable&&!creatureAt(w,q)&&hasLos(w,q,p)&&!diagonalBlocked(w,q,p.x-q.x,p.y-q.y)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
  for(const q of access)if(findPath(w,c.pos,q,{avoidCreatures:true,selfId:c.id,maxNodes:1200}))return{goal:q}
 }

 return null
}

function residentSeedPlan(w:World,provider:Creature,target:Creature,uid:number){
 const out={error:null as string|null,sourceBag:undefined as Creature['bag']|undefined,targetBag:undefined as Creature['bag']|undefined,nextId:w.s.nextId}
 const d=residentCultivationDef(w);if(!d.enabled||!d.roles.includes(w.db.creature(target.def).ai)){out.error='이 주민은 개인 재배에 종자를 쓰지 않는다';return out}
 if(provider===target||!w.s.creatures.includes(provider)||(provider.mapId!==undefined&&provider.mapId!==w.s.map.id)||!provider.alive||provider.asleep||provider.unconscious||capacity(w,provider,'manipulation')<.2||!resident(w,target)||!target.alive||target.asleep||target.unconscious||target.captivity||target.companion||target.rescue||target.caravan||target.roadRaid||target.abduction||activeEscort(w,target)||capacity(w,target,'manipulation')<.2||hostile(w,provider,target)||hostile(w,target,provider)){out.error='깨어 있는 비적대 주민 곁에서 자기 종자를 건네야 한다';return out}
 if(cheb(provider.pos,target.pos)>1||!canSee(w,provider,target.pos)||!canSee(w,target,provider.pos)||!hasLos(w,provider.pos,target.pos)||diagonalBlocked(w,provider.pos,target.pos.x-provider.pos.x,target.pos.y-provider.pos.y)){out.error='서로 볼 수 있는 곁으로 가야 한다';return out}
 const seed=provider.bag.find(i=>i.uid===uid),plant=seed&&itemDef(w,seed).place
 if(!seed||seed.count<1||!plant||!w.db.terrain(plant).cultivation){out.error='배낭의 실제 재배용 종자 하나가 필요하다';return out}
 if(target.residentPlot||target.bag.some(i=>i.count>0&&itemDef(w,i).place&&w.db.terrain(itemDef(w,i).place!).cultivation)){out.error='이 주민은 이미 자기 종자나 돌보는 밭이 있다';return out}
 const shadow:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},giver={...provider,bag:structuredClone(provider.bag)},receiver={...target,bag:structuredClone(target.bag)},piece=removeOne(shadow,giver,uid)
 if(!piece||addToBag(shadow,receiver,piece)){out.error='주민의 실제 배낭에 종자를 넣을 자리가 없다';return out}
 out.sourceBag=giver.bag;out.targetBag=receiver.bag;out.nextId=shadow.s.nextId;return out
}
export function residentSeedQuote(w:World,provider:Creature,target:Creature,uid:number){return{error:residentSeedPlan(w,provider,target,uid).error}}
export function giveResidentSeed(w:World,provider:Creature,target:Creature,uid:number):string|null{
 const q=residentSeedPlan(w,provider,target,uid);if(q.error)return q.error
 provider.bag=q.sourceBag!;target.bag=q.targetBag!;w.s.nextId=q.nextId
 if(canSee(w,player(w),provider.pos)&&canSee(w,player(w),target.pos))log(w,'info','주민에게 실제 종자 한 개를 건넸다. 주민은 자기 몸과 물로 밭을 돌본다.')
 return null
}

export function residentCultivationWaterBudget(w:World,c:Creature){return waterBudget(w,c)}
export function residentCultivationAvailable(w:World,c:Creature){return ready(w,c)}
export function residentHarvestOrigin(w:World,c:Creature,pos:Pos){
 const plot=currentPlot(w,c),state=tileAt(w,pos).cultivation
 if(!resident(w,c)||!plot||!state||plot.pos.x!==pos.x||plot.pos.y!==pos.y||!matches(w,c)||!cultivationStatus(w,pos)?.ready)return
 return{owner:c.id,seedUid:state.seedUid,def:terrainAt(w,pos).gather!.item,terrain:state.terrain,map:w.s.map.id,region:c.residentSite!,at:turnOf(w)}
}

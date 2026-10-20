// 실제 현지 부대가 발견·귀환 보고 뒤 출발한다. 새 인원이나 장비를 만들지 않는다.
import { capacity } from './body'
import { baseCampDef } from './base-camp-state'
import { isCompanion } from './companion-state'
import { inBounds, log, player, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { hostile } from './diplomacy'
import { canSee, hasLos } from './fov'
import { cheb, type Pos } from './geom'
import { gridAdd, itemDef } from './items'
import { ageLooseGear } from './gear-weather'
import { diagonalBlocked } from './path'
import type { BaseDefenseDef, BaseRaid, Creature } from './types'
export const baseDefenseDef=(w:World)=>w.db.get<BaseDefenseDef>('BaseDefense.Hearth')
function capable(w:World,c:Creature){return c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&!isCompanion(w,c)&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'moving')>=.2}
/** 실제로 본 정찰자가 자기 집에 도착해야 세력의 출발 정보로 쓴다. */
export function noticeBase(w:World,c:Creature){
 const base=w.s.map.baseCamp;if(!base||!capable(w,c))return
 const d=baseDefenseDef(w);if(['flee','surrender','calm'].includes(c.ai.mode)||c.faction!==d.faction||!hostile(w,c,player(w)))return
 const intel=base.raidIntel?.faction===d.faction?base.raidIntel:undefined,old=intel&&w.s.creatures.find((o)=>o.id===intel.by),usable=old&&capable(w,old)
 if((!intel||intel.reportedAt===undefined&&!usable)&&cheb(c.pos,base.store)<=d.noticeRadius&&canSee(w,c,base.store))base.raidIntel={by:c.id,faction:d.faction,at:turnOf(w)}
 const record=base.raidIntel
 if(record?.by===c.id&&record.reportedAt===undefined&&c.home&&cheb(c.pos,c.home)<=1&&hasLos(w,c.pos,c.home))record.reportedAt=turnOf(w)
}
function crew(w:World){
 const d=baseDefenseDef(w),source=w.s.map.waypoints?.[d.sourceWaypoint]
 if(!source)return[]
 return w.s.creatures.filter((c)=>c.faction===d.faction&&capable(w,c)&&capacity(w,c,'manipulation')>=.2&&c.home&&cheb(c.home,source)<=d.sourceRadius&&!c.activity&&!c.ai.route&&!c.ai.task&&['guard','wander','idle','return'].includes(c.ai.mode)&&hostile(w,c,player(w))).sort((a,b)=>a.id-b.id)
}
function atHome(c:Creature){return !!c.home&&cheb(c.pos,c.home)<=1}
function finishRaid(w:World,raid:BaseRaid){
 const members=raid.attackers.map((id)=>w.s.creatures.find((c)=>c.id===id)),repelled=(c:Creature|undefined)=>!!c&&(!c.alive||!!c.captivity||isCompanion(w,c)||['surrender','flee'].includes(c.ai.mode)),returned=(c:Creature|undefined)=>!!c&&c.alive&&atHome(c)&&(raid.visited.includes(c.id)||raid.retreatAt!==undefined)
 // 다른 지도에 있는 사람을 죽거나 귀환한 것으로 세지 않는다.
 if(members.some((c,i)=>!raid.disengaged.includes(raid.attackers[i])&&!repelled(c)&&!returned(c)))return
 raid.ended=turnOf(w);raid.phase=members.every(repelled)?'repelled':raid.stolen.length?'looted':'withdrawn'
 if(raid.phase==='repelled'&&!player(w).asleep&&!player(w).unconscious&&members.every((c)=>!!c&&canSee(w,player(w),c.pos))){w.s.map.baseCamp!.raidHeard={id:raid.id,at:turnOf(w),phase:'repelled'};log(w,'good','거점으로 온 공격자들이 실제로 제압된 것을 확인했다.')}
}
/** 전역 한 턴. 미활성 지도의 전투/약탈을 요약으로 완료하지 않는다. */
export function baseDefenseTick(w:World){
 const base=w.s.map.baseCamp;if(!base)return
 const d=baseDefenseDef(w),turn=turnOf(w),raid=base.raid
 if(raid?.phase==='active'){
  if(!raid.detected&&!player(w).asleep&&!player(w).unconscious&&w.s.creatures.some((c)=>raid.attackers.includes(c.id)&&c.alive&&canSee(w,player(w),c.pos))){raid.detected=true;base.raidHeard={id:raid.id,at:turn,phase:'sighted'};log(w,'warn','약탈대가 거점을 향해 움직이고 있다. 실제 창고와 동료를 지켜야 한다.')}
  if(raid.retreatAt===undefined&&turn>=raid.started+d.timeoutTurns){raid.retreatAt=turn;for(const c of w.s.creatures)if(raid.attackers.includes(c.id)&&capable(w,c)&&c.ai.task?.raidId===raid.id&&c.home){c.ai.route=[{...c.home}];c.ai.routeIdx=0;c.ai.path=undefined;c.ai.task.stash=undefined}}
  for(const c of w.s.creatures)if(raid.attackers.includes(c.id)&&capable(w,c)&&!hostile(w,c,player(w))&&c.ai.task?.raidId===raid.id&&c.home){c.ai.route=[{...c.home}];c.ai.routeIdx=0;c.ai.path=undefined;c.ai.task.stash=undefined;raid.retreatAt??=turn}
  finishRaid(w,raid);return
 }
 const reported=base.raidIntel?.faction===d.faction?base.raidIntel.reportedAt:undefined
 if(reported===undefined||turn<Math.max(base.at+d.firstDelayTurns,reported+d.planningTurns,base.nextRaid??0))return
 const pool=crew(w);if(pool.length<d.minMembers)return
 base.nextRaid=turn+d.intervalTurns
 const r=rng(w,`world.baseRaid.${w.s.overworld?.currentRegion??'local'}.${w.s.map.id}`)
 if(!r.chance(d.chance))return
 const attackers=r.shuffle(pool).slice(0,r.int(d.minMembers,Math.min(d.maxMembers,pool.length)))
 base.raid={id:w.s.nextId++,started:turn,phase:'active',attackers:attackers.map((c)=>c.id),visited:[],stolen:[],disengaged:[]}
 for(const c of attackers){c.ai.mode='patrol';c.ai.target=undefined;c.ai.path=undefined;c.ai.route=[{...base.store},{...c.home!}];c.ai.routeIdx=0;c.ai.waitUntil=undefined;c.ai.task={kind:'baseRaid',pos:{...base.store},stash:{...base.store},raidId:base.raid.id}}
}
function mission(w:World,c:Creature){const base=w.s.map.baseCamp,raid=base?.raid;return base&&raid?.phase==='active'&&raid.attackers.includes(c.id)&&c.ai.task?.kind==='baseRaid'&&c.ai.task.raidId===raid.id?{base,raid}:undefined}
/** 루팅도 실제 행동이다. 배낭에 못 넣은 묶음은 창고에서 빼지 않는다. */
export function lootBaseRaid(w:World,c:Creature):string|null{
 const current=mission(w,c);if(!current||!capable(w,c)||!hostile(w,c,player(w))||capacity(w,c,'manipulation')<.2)return '실제 약탈 임무를 수행할 수 없다'
 const {base,raid}=current,pos=c.ai.task!.stash
 if(!pos||cheb(c.pos,pos)>1||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return '실제 창고 곁이어야 한다'
 if(inBounds(w,pos)&&terrainAt(w,pos).id===baseCampDef(w).storeTerrain&&tileAt(w,pos).placed?.item.uid===base.storeUid){
  const items=tileAt(w,pos).cont?.items??[],sorted=[...items].sort((a,b)=>(itemDef(w,b).value??0)*b.count-(itemDef(w,a).value??0)*a.count||a.uid-b.uid)
  let taken=0
  for(const source of sorted){
   if(taken>=baseDefenseDef(w).lootStacks)break
   const shadow={db:w.db,s:{...w.s,nextId:-1}},grid={items:structuredClone(c.bag),w:10,h:6},probe={...source,gx:undefined,gy:undefined,rot:undefined}
   if(gridAdd(shadow,grid,structuredClone(probe)))continue
   ageLooseGear(w,source,pos,!tileAt(w,pos).cont?.opened)
   const count=source.count;items.splice(items.indexOf(source),1);delete source.gx;delete source.gy;delete source.rot;gridAdd(w,{items:c.bag,w:10,h:6},source);raid.stolen.push({by:c.id,uid:source.uid,def:source.def,count});taken++
   if(canSee(w,player(w),c.pos)&&canSee(w,player(w),pos)){base.raidHeard={id:raid.id,at:turnOf(w),phase:'stolen'};log(w,'danger','약탈자가 거점 창고에서 실제 물품을 가져가는 것이 보인다.')}
  }
 }
 if(!raid.visited.includes(c.id))raid.visited.push(c.id)
 c.ai.route=c.home?[{...c.home}]:[];c.ai.routeIdx=0;c.ai.path=undefined;c.ai.waitUntil=undefined;c.ai.task!.stash=undefined
 return null
}
export function baseRaidGoal(w:World,c:Creature,goal:Pos):boolean{return !!mission(w,c)&&!!c.ai.task?.stash&&cheb(goal,c.ai.task.stash)===0}

/** 실제 계단 추적은 유지하되 원래 거점 임무에서 이탈한 것으로 기록한다. */
export function leaveBaseRaid(w:World,c:Creature){
 const current=mission(w,c);if(!current)return
 if(!current.raid.disengaged.includes(c.id))current.raid.disengaged.push(c.id)
 c.ai.task=undefined;c.ai.route=undefined;c.ai.routeIdx=undefined;c.ai.waitUntil=undefined
}

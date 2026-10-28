// 유한한 원래 야영지 주민의 출정·같은 월드 칸 강탈·실제 귀환 운반.
import {capacity} from './body'
import {openContainer} from './actions'
import {caravanOwners,exitPositions,departureTurns,freePositions,roadExitPositions} from './caravans'
import {player,rng,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from './ctx'
import {factionRelation,recordFactionIncident} from './diplomacy'
import {canSee,hasLos,updatePlayerVision} from './fov'
import {cheb,eq,type Pos} from './geom'
import {gridSpot,itemDef} from './items'
import {findPath,diagonalBlocked} from './path'
import {routeHours,worldRoute} from './overworld'
import type {Creature,WorldRaid,WorldSimulationDef,CaravanState,ItemInst} from './types'
export const worldRaidRules=(w:World)=>w.db.get<WorldSimulationDef>('WorldSimulation.Hearth').roadRaids!
function capable(w:World,a:Creature){return a.alive&&!a.asleep&&!a.unconscious&&!a.captivity&&!a.companion&&!a.caravan&&!a.roadRaid&&!a.activity&&!a.ai.task&&!['hunt','flee','surrender'].includes(a.ai.mode)&&capacity(w,a,'moving')>=.3&&capacity(w,a,'consciousness')>=.5}
function source(w:World){const d=worldRaidRules(w);return caravanOwners(w,d.source).find(o=>o.map.waypoints?.[d.waypoint])}
function crew(w:World){const d=worldRaidRules(w),o=source(w),camp=o?.map.waypoints?.[d.waypoint];return o&&camp?o.people().filter(a=>a.faction===d.faction&&capable(w,a)&&a.home&&cheb(a.home,camp)<=d.sourceRadius).sort((a,b)=>a.id-b.id):[]}
function worldCell(w:World){return w.s.overworld!.sites.find(s=>s.id===worldRaidRules(w).source)!.cell}
function sameCell(w:World,r:WorldRaid,c:CaravanState){return eq(r.position,c.position)&&['outbound','returning'].includes(c.phase)}
function current(w:World,a:Creature){return w.s.overworld?.roadRaids?.find(r=>r.id===a.roadRaid)}
function mobile(w:World,c:CaravanState){return w.s.overworld!.markets![c.market]}
function raidBag(w:World,a:Creature){const [width,height]=w.db.creature(a.def).bagSize??[4,3];return{items:a.bag,w:width,h:height}}
/** 원래 더미 전체를 실제 빈 칸 하나에 넣는다. 조회로 UID/수량을 바꾸지 않는다. */
function fit(w:World,a:Creature,it:ItemInst){return !!gridSpot(w,raidBag(w,a),itemDef(w,it))}
function take(w:World,r:WorldRaid,a:Creature,items:ItemInst[],it:ItemInst){const p=gridSpot(w,raidBag(w,a),itemDef(w,it));if(!p)return false;items.splice(items.indexOf(it),1);it.gx=p[0];it.gy=p[1];it.rot=p[2]||undefined;a.bag.push(it);r.stolen.push({by:a.id,uid:it.uid,def:it.def,count:it.count});return true}
function returnRoute(w:World,r:WorldRaid){const route=worldRoute(w,r.position,worldCell(w));if(!route?.cells.length){r.route=[];r.index=0;r.phase='returning';r.nextMove=turnOf(w)+(route?0:TURNS_PER_HOUR);return}r.route=route.cells;r.index=0;r.phase='returning';r.nextMove=turnOf(w)+Math.ceil(routeHours(w,r.position,r.route[0])*TURNS_PER_HOUR)}
export function planWorldRaid(w:World,target?:string):string|null{
 const m=w.s.overworld,d=worldRaidRules(w),o=source(w),c=m?.caravans?.find(c=>c.id===target),pool=crew(w),home=m?.sites.find(s=>s.id===d.source)
 if(!m||!o||!home||pool.length<d.minMembers||m.roadRaids?.some(r=>!['completed','dispersed'].includes(r.phase)))return '실제로 출정할 야영지 인원이 없다'
 if(c&&(!['outbound','returning'].includes(c.phase)||Math.abs(c.position.x-home.cell.x)+Math.abs(c.position.y-home.cell.y)>d.territoryCells))return '실제 교역단이 야영지 영역에 없다'
 const merchant=c&&(c.actors??w.s.creatures).find(a=>a.id===c.leader);if(c&&(!merchant||factionRelation(w,d.faction,merchant.faction)>d.hostileAt))return '습격할 실제 적대 교역단이 아니다'
 let route=c?worldRoute(w,home.cell,c.position):undefined
 if(!c){const towns=m.sites.filter(s=>s.kind==='settlement').sort((a,b)=>(Math.abs(a.cell.x-home.cell.x)+Math.abs(a.cell.y-home.cell.y))-(Math.abs(b.cell.x-home.cell.x)+Math.abs(b.cell.y-home.cell.y)));for(const town of towns){const way=worldRoute(w,home.cell,town.cell);if(!way?.cells.length)continue;route={...way,cells:way.cells.slice(0,d.territoryCells)};break}}
 if(!route)return '실제로 갈 육로가 없다'
 const actors=pool.slice(0,d.maxMembers),id=`roadRaid:${m.nextRoadRaid??1}`,local=m.currentRegion===d.source&&o.map===w.s.map,now=turnOf(w)
 const record:WorldRaid={id,source:d.source,target:c?.id??'',leader:actors[0].id,members:actors.map(a=>a.id),homes:actors.map(a=>({id:a.id,pos:{...a.pos},home:a.home?{...a.home}:undefined,room:a.room,mapId:a.mapId})),position:{...home.cell},route:route.cells,index:0,phase:local?'departing':'outbound',nextMove:now,departed:now,strength:pool.length,stolen:[],deployed:local||undefined,actors:local?undefined:actors}
 for(const a of actors){a.roadRaid=id;a.ai.path=undefined;a.activity=undefined}
 if(!local){o.set(o.people().filter(a=>!actors.includes(a)));record.leftAt=now+departureTurns(w,o,actors);record.nextMove=record.leftAt+(route.cells.length?Math.ceil(routeHours(w,home.cell,route.cells[0])*TURNS_PER_HOUR):0)}
 ;(m.roadRaids??=[]).push(record);m.nextRoadRaid=(m.nextRoadRaid??1)+1;return null
}
function coarseRobbery(w:World,r:WorldRaid,c:CaravanState){
 const actors=r.actors??[],market=mobile(w,c);if(!actors.length||!market)return
 // L2는 원래 살아 있는 무리의 운반 가능한 원물만 옮긴다. 보이지 않은 사망/상처를 만들어 내지 않는다.
 for(const it of [...market.items]){const carrier=actors.find(a=>fit(w,a,it));if(carrier)take(w,r,carrier,market.items,it)}
 if(market.money){r.cash=market.money;actors[0].money=(actors[0].money??0)+market.money;market.money=0}
 if(r.stolen.length||r.cash){c.robbedBy=r.id;r.robbedAt=turnOf(w);recordFactionIncident(w,(c.actors??w.s.creatures).find(a=>a.id===c.leader)!.faction,worldRaidRules(w).faction,'raid',`roadRaid:${r.id}`,c.members,c.origin)}returnRoute(w,r)
}
function intercept(w:World,r:WorldRaid,c:CaravanState){
 const d=worldRaidRules(w),day=Math.floor(turnOf(w)/TURNS_PER_DAY);if(!w.s.overworld!.currentRegion&&eq(w.s.overworld!.position,r.position)&&!c.deployed)return;if(r.checkedDay===day)return;r.checkedDay=day
 const guards=(c.actors??w.s.creatures).filter(a=>c.members.includes(a.id)&&a.id!==c.leader&&a.alive&&!a.unconscious&&!a.captivity).length,chance=Math.max(0,Math.min(1,r.strength*d.chancePerMember-guards*d.guardReduction))
 if(!rng(w,`world.roadRaid.${r.id}`).chance(chance)){returnRoute(w,r);return}
 if(!w.s.overworld!.currentRegion&&eq(w.s.overworld!.position,r.position)){
  if(!c.deployed)return
  if(r.deployed){r.phase='engaged';r.targetCargo=mobile(w,c).items.map(it=>it.uid);return}
  const positions=freePositions(w,{map:w.s.map,people:()=>w.s.creatures,set:a=>{w.s.creatures=a}},r.actors!.length,{x:w.s.map.w-2,y:Math.floor(w.s.map.h/2)});if(!positions)return
  for(let i=0;i<r.actors!.length;i++){const a=r.actors![i];a.pos={...positions[i]};a.mapId=w.s.map.id;a.nextAct=w.s.time+100;a.ai.path=undefined}
  w.s.creatures.push(...r.actors!);delete r.actors;r.deployed=true;r.phase='engaged';r.targetCargo=mobile(w,c).items.map(it=>it.uid);return
 }
 coarseRobbery(w,r,c)
}
export function worldRaidGoal(w:World,a:Creature):Pos|undefined{
 const r=current(w,a);if(!r)return
 if(r.phase==='departing'){const exits=exitPositions(w,w.s.map);return exits[Math.max(0,r.members.indexOf(a.id))%exits.length]}
 if(r.phase==='arriving'){const box=stash(w);return box?(cheb(a.pos,box.pos)<=1?a.pos:box.pos):undefined}
 if(['outbound','returning'].includes(r.phase)&&r.deployed){const goals=roadExitPositions(w,r.route.length?r:{...r,route:[worldCell(w)],index:0});return goals[Math.max(0,r.members.indexOf(a.id))%goals.length]}
 if(r.phase==='engaged'){
  const c=w.s.overworld!.caravans!.find(c=>c.id===r.target),leader=c&&w.s.creatures.find(b=>b.id===c.leader)
  if(leader&&canSee(w,a,leader.pos)){r.lastSeen={...leader.pos};if(leader.alive&&!leader.captivity)for(const target of w.s.creatures.filter(b=>c!.members.includes(b.id)&&b.alive&&canSee(w,b,a.pos)))if(!target.attackedBy?.includes(a.id))(target.attackedBy??=[]).push(a.id)}
  if(r.lastSeen){if(cheb(a.pos,r.lastSeen)>1)return r.lastSeen;if(!leader||!canSee(w,a,leader.pos))delete r.lastSeen;else return r.lastSeen}
  const map=w.s.map,points:Pos[]=[]
  for(let y=1,row=0;y<map.h;y+=3,row++){const xs:number[]=[];for(let x=1;x<map.w;x+=3)xs.push(x);if(row%2)xs.reverse();for(const x of xs)points.push({x,y})}
  const steps=r.searchStep??={};let index=steps[a.id]??Math.max(0,r.members.indexOf(a.id))
  for(let i=0;i<points.length;i++){const p=points[index%points.length],t=w.db.terrain(map.tiles[p.y*map.w+p.x].t);if(cheb(a.pos,p)>1&&t.passable&&!t.water){steps[a.id]=index;return p}index++}steps[a.id]=index;return undefined
 }
 return undefined
}
export function worldRaidLoot(w:World,a:Creature):string|null{
 const r=current(w,a),c=r&&w.s.overworld!.caravans!.find(c=>c.id===r.target),leader=c&&w.s.creatures.find(b=>b.id===c.leader)
 if(!a.alive||a.asleep||a.unconscious||a.captivity||a.companion||capacity(w,a,'manipulation')<.2||!r||r.phase!=='engaged'||!leader||leader.alive&&!leader.captivity||cheb(a.pos,leader.pos)>1||!hasLos(w,a.pos,leader.pos)||diagonalBlocked(w,a.pos,leader.pos.x-a.pos.x,leader.pos.y-a.pos.y))return '원래 습격 현장 곁이어야 한다'
 const tile=w.s.map.tiles[leader.pos.y*w.s.map.w+leader.pos.x]
 for(const items of [leader.bag,tile.items])for(const it of [...items])if(r.targetCargo?.includes(it.uid))take(w,r,a,items,it)
 const coins=leader.money??0;if(coins){leader.money=0;a.money=(a.money??0)+coins;r.cash=(r.cash??0)+coins}
 r.looted??=[];if(!r.looted.includes(a.id))r.looted.push(a.id)
 return null
}
export function worldRaidDecision(w:World,a:Creature):{goal?:Pos;loot?:boolean}|undefined{
 const r=current(w,a);if(!r||a.captivity||a.companion)return
 const goal=worldRaidGoal(w,a);if(r.phase==='engaged'){const c=w.s.overworld!.caravans!.find(c=>c.id===r.target),leader=c&&w.s.creatures.find(b=>b.id===c.leader);return{goal,loot:!!leader&&(!leader.alive||!!leader.captivity)&&cheb(a.pos,leader.pos)<=1&&!r.looted?.includes(a.id)}}
 return{goal}
}
function stash(w:World){const o=source(w),d=worldRaidRules(w),camp=o?.map.waypoints?.[d.waypoint];if(!o||!camp)return;const candidates=o.map.tiles.map((t,i)=>({t,pos:{x:i%o.map.w,y:Math.floor(i/o.map.w)}})).filter(p=>p.t.t===d.containerTerrain).sort((a,b)=>cheb(a.pos,camp)-cheb(b.pos,camp));const box=candidates[0];return box?{o,...box}:undefined}
function finish(w:World,r:WorldRaid){
 const box=stash(w);if(!box)return
 const actors=box.o.people().filter(a=>a.roadRaid===r.id&&a.alive);if(!actors.length){r.phase='dispersed';return}
 const visible=box.o.map===w.s.map&&w.s.overworld?.currentRegion===r.source
 if(visible&&!actors.every(a=>cheb(a.pos,box.pos)<=1))return
 if(!visible&&turnOf(w)<r.nextMove)return
 const positions=freePositions(w,{...box.o,people:()=>box.o.people().filter(a=>!actors.includes(a))},actors.length,box.pos);if(!positions||positions.some(p=>cheb(p,box.pos)>1))return
 if(!visible)for(let i=0;i<actors.length;i++)actors[i].pos={...positions[i]}
 const local={db:w.db,s:{...w.s,map:box.o.map,creatures:box.o.people()}}
 openContainer(local,actors[0],box.pos);w.s.nextId=local.s.nextId
 const grid={items:box.t.cont!.items,w:(w.db.terrain(box.t.t).lootGrid??[6,4])[0],h:(w.db.terrain(box.t.t).lootGrid??[6,4])[1]}
 for(const a of actors)for(const record of r.stolen.filter(i=>i.by===a.id)){const it=a.bag.find(i=>i.uid===record.uid);if(!it)continue;const p=gridSpot(w,grid,itemDef(w,it));if(!p)continue;a.bag=a.bag.filter(i=>i!==it);it.gx=p[0];it.gy=p[1];it.rot=p[2]||undefined;grid.items.push(it);(r.delivered??=[]).push(it.uid)}
 for(const a of actors){const h=r.homes.find(h=>h.id===a.id)!;a.home=h.home;a.room=h.room;a.mapId=h.mapId;delete a.roadRaid;a.ai.path=undefined;a.ai.mode='guard';a.nextAct=w.s.time+100}
 r.phase='completed';r.deployed=false;r.returned=turnOf(w)
}
function arriveHome(w:World,r:WorldRaid,at:number){
 const box=stash(w),actors=r.actors??[];if(!box||!actors.length)return false
 const positions=freePositions(w,box.o,actors.length,box.o.map.exits[0]??box.pos);if(!positions)return false
 for(let i=0;i<actors.length;i++){const a=actors[i];a.pos={...positions[i]};a.mapId=box.o.map.id;a.ai.path=undefined;a.nextAct=w.s.time+100}
 box.o.set([...box.o.people(),...actors]);delete r.actors;r.phase='arriving';r.deployed=true
 const local={db:w.db,s:{...w.s,map:box.o.map,creatures:box.o.people()}}
 r.nextMove=at+Math.max(1,...actors.map(a=>findPath(local,a.pos,box.pos,{avoidCreatures:false,selfId:a.id,maxNodes:box.o.map.w*box.o.map.h})?.length??box.o.map.w+box.o.map.h));finish(w,r);return true
}
export function packWorldRaids(w:World,party:Creature[]=[]){
 for(const r of w.s.overworld?.roadRaids??[]){if(!r.deployed||['completed','dispersed'].includes(r.phase))continue
  const present=w.s.creatures.filter(a=>a.roadRaid===r.id&&a.alive);if(!present.length)continue
  const seized=present.filter(a=>party.includes(a)||a.captivity||a.companion);for(const a of seized){delete a.roadRaid;r.members=r.members.filter(id=>id!==a.id)}
  const actors=present.filter(a=>!seized.includes(a));if(!actors.length){r.phase='dispersed';continue}
  if(r.phase==='arriving'){const box=stash(w);if(box){const local={db:w.db,s:{...w.s}},distance=Math.max(1,...actors.map(a=>findPath(local,a.pos,box.pos,{avoidCreatures:false,selfId:a.id})?.length??w.s.map.w+w.s.map.h));r.nextMove=turnOf(w)+distance}continue}
  r.actors=actors;r.deployed=false;w.s.creatures=w.s.creatures.filter(a=>!actors.includes(a))
  if(r.phase==='departing'){r.phase='outbound';r.leftAt=turnOf(w)+departureTurns(w,{map:w.s.map,people:()=>present,set:()=>{}},actors);r.nextMove=r.leftAt+(r.route.length?Math.ceil(routeHours(w,r.position,r.route[0])*TURNS_PER_HOUR):0)}else if(r.phase==='outbound'){r.nextMove=turnOf(w)+(r.pausedTurns??Math.max(1,r.nextMove-turnOf(w)));delete r.pausedTurns}else if(r.phase!=='patrolling')returnRoute(w,r)
 }
}
export function worldRaidsTick(w:World){
 const m=w.s.overworld;if(!m)return;const now=turnOf(w),d=worldRaidRules(w)
 for(const r of m.roadRaids??[]){
  if(r.deployed)for(const a of w.s.creatures.filter(a=>a.roadRaid===r.id&&(a.captivity||a.companion))){delete a.roadRaid;r.members=r.members.filter(id=>id!==a.id)}
  if(r.phase==='arriving'){finish(w,r);continue}
  if(r.phase==='patrolling'){
   const target=m.caravans?.find(c=>sameCell(w,r,c)&&!c.robbedBy&&(c.actors??w.s.creatures).some(a=>a.id===c.leader&&factionRelation(w,d.faction,a.faction)<=d.hostileAt))
   if(target){r.target=target.id;intercept(w,r,target)}else if(now>=(r.patrolUntil??now))returnRoute(w,r)
   continue
  }
  if(r.phase==='departing'){const actors=w.s.creatures.filter(a=>a.roadRaid===r.id&&a.alive),exits=exitPositions(w,w.s.map);if(actors.length&&actors.every(a=>{const p=exits[Math.max(0,r.members.indexOf(a.id))%exits.length];return p&&eq(a.pos,p)}))packWorldRaids(w);continue}
  if(r.phase==='engaged'){
   const actors=w.s.creatures.filter(a=>a.roadRaid===r.id&&a.alive&&!a.captivity&&!a.companion),c=m.caravans?.find(c=>c.id===r.target),leader=c&&w.s.creatures.find(a=>a.id===c.leader)
   if(!actors.length){r.phase='dispersed';continue}
   if(!leader||actors.every(a=>r.looted?.includes(a.id)||a.ai.mode==='flee'||a.ai.mode==='surrender'))returnRoute(w,r)
   continue
  }
  if(r.deployed){if(['outbound','returning'].includes(r.phase)){const actors=w.s.creatures.filter(a=>a.roadRaid===r.id&&a.alive);if(actors.length&&actors.every(a=>{const p=worldRaidGoal(w,a);return p&&eq(a.pos,p)}))packWorldRaids(w)}continue}
  if(!['outbound','returning'].includes(r.phase)||r.nextMove>now)continue
  for(let i=0;i<m.w*m.h&&r.nextMove<=now;i++){
   if(r.index>=r.route.length){if(r.phase==='returning'){if(eq(r.position,worldCell(w)))arriveHome(w,r,r.nextMove);else returnRoute(w,r)}else{const c=m.caravans?.find(c=>c.id===r.target);if(c&&sameCell(w,r,c))intercept(w,r,c);else if(!r.target){r.phase='patrolling';r.patrolUntil=now+TURNS_PER_DAY}else returnRoute(w,r)}break}
   const to=r.route[r.index],cost=routeHours(w,r.position,to);if(!Number.isFinite(cost)){returnRoute(w,r);break}const at=r.nextMove;r.position={...to};delete r.encounteredCell;r.index++
   if(r.index>=r.route.length){if(r.phase==='returning'){arriveHome(w,r,at);break}const c=m.caravans?.find(c=>c.id===r.target);if(c&&sameCell(w,r,c))intercept(w,r,c);else if(!r.target){r.phase='patrolling';r.patrolUntil=at+TURNS_PER_DAY}else returnRoute(w,r);break}
   r.nextMove=at+Math.ceil(routeHours(w,r.position,r.route[r.index])*TURNS_PER_HOUR)
  }
 }
 if(now%TURNS_PER_HOUR)return
 const day=Math.floor(now/TURNS_PER_DAY);if(day<d.firstDay||m.roadRaidDay===day)return
 const home=m.sites.find(s=>s.id===d.source);if(!home||!crew(w).length)return
 const error=planWorldRaid(w);if(!error)m.roadRaidDay=day
}
export const raidStoredPeople=(w:World)=>(w.s.overworld?.roadRaids??[]).flatMap(r=>r.actors??[])

export function encounterWorldRaids(w:World){
 const m=w.s.overworld;if(!m||m.currentRegion||w.s.map.vessel||w.s.map.kind!=='surface')return
 for(const r of m.roadRaids??[]){if(r.deployed||r.encounteredCell&&eq(r.encounteredCell,m.position)||!r.actors?.length||!['outbound','patrolling','returning'].includes(r.phase)||(r.leftAt??0)>turnOf(w)||!eq(r.position,m.position))continue
  const positions=freePositions(w,{map:w.s.map,people:()=>w.s.creatures,set:cs=>{w.s.creatures=cs}},r.actors.length,{x:w.s.map.w-2,y:Math.floor(w.s.map.h/2)});if(!positions)return
  for(let i=0;i<r.actors.length;i++){const a=r.actors[i];a.pos={...positions[i]};a.home={...positions[i]};a.mapId=w.s.map.id;a.ai.path=undefined;a.nextAct=w.s.time+100}
  w.s.creatures.push(...r.actors);delete r.actors;r.deployed=true;r.encounteredCell={...m.position};r.pausedTurns=Math.max(1,r.nextMove-turnOf(w));updatePlayerVision(w,player(w))
 }
}
export function observedRoadRaids(w:World){const m=w.s.overworld;return m&&!m.currentRegion?(m.roadRaids??[]).filter(r=>r.deployed&&eq(r.position,m.position)&&w.s.creatures.some(a=>a.roadRaid===r.id&&a.alive&&canSee(w,player(w),a.pos))):[]}

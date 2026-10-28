import {raidStoredPeople} from './world-raids'
// 이미 존재하는 상인/호위와 시장 물품만 이동한다. 가상의 조우나 무한 재입고를 만들지 않는다.
import { capacity } from './body'
import { caravanRules, mobileCargoLayout } from './caravan-state'
import { log, player, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { factionDef, factionRelation, recordFactionIncident } from './diplomacy'
import { regionalPrice, WORLD_STOCK_ID_START } from './economy'
import { canSee, updatePlayerVision } from './fov'
import { cheb, DIRS, eq, type Pos } from './geom'
import { gridSpot, itemDef, maxStack, qualityInfo } from './items'
import { findPath } from './path'
import { routeHours, worldRoute } from './overworld'
import type { CaravanState, Creature, ItemInst, MapState, WorldSite } from './types'
export { caravanRules, mobileCargoLayout } from './caravan-state'
export interface CaravanOwner {map:MapState;people:()=>Creature[];set:(people:Creature[])=>void}
export function caravanOwners(w:World,site:string):CaravanOwner[]{
 const m=w.s.overworld;if(!m)return[]
 if(m.currentRegion===site)return[{map:w.s.map,people:()=>w.s.creatures,set:cs=>{w.s.creatures=cs}},...Object.entries(w.s.maps).map(([key,map])=>({map,people:()=>w.s.offCreatures[key]??[],set:(cs:Creature[])=>{w.s.offCreatures[key]=cs}}))]
 const scene=m.scenes[site];if(!scene)return[]
 return[{map:scene.map,people:()=>scene.creatures,set:cs=>{scene.creatures=cs}},...Object.entries(scene.maps).map(([key,map])=>({map,people:()=>scene.offCreatures[key]??[],set:(cs:Creature[])=>{scene.offCreatures[key]=cs}}))]
}
function available(w:World,c:Creature){return c.alive&&!c.asleep&&!c.unconscious&&!c.companion&&!c.captivity&&!c.caravan&&!c.activity&&c.ai.mode!=='hunt'&&c.ai.mode!=='flee'&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'moving')>=.5}
function merchant(w:World,site:string){for(const owner of caravanOwners(w,site)){const c=owner.people().find(c=>c.traderSite===site&&available(w,c));if(c)return{owner,c}}}
function unitValue(w:World,site:string,item:string,instance?:ItemInst){const market=w.s.overworld?.markets?.[site],d=instance?itemDef(w,instance):w.db.item(item);if(!market)return 0;let value=(d.value??0)*regionalPrice(w,market,item);if(instance){value*=qualityInfo(instance).value*(30+70*Math.max(0,Math.min(100,instance.durability??100))/100)/100;if(d.food)value*=Math.max(0,Math.min(1,(instance.freshness??100)/100));if(d.uses)value*=Math.max(0,Math.min(1,(instance.uses??d.uses)/d.uses))}return Math.max(0,Math.round(value))}
function routeAllowed(w:World,a:WorldSite,b:WorldSite){const m=w.s.overworld!;return a.id!==b.id&&a.faction&&b.faction&&Math.min(factionRelation(w,a.faction,b.faction),factionRelation(w,b.faction,a.faction))>-50&&!m.simulation?.settlements[a.id]?.quarantined&&!m.simulation?.settlements[b.id]?.quarantined}
function capacityFor(w:World,item:string,max:number){const d=w.db.item(item),[width,height]=caravanRules(w).grid,grid={items:[] as ItemInst[],w:width,h:height};let count=0
 while(count<max){const p=gridSpot(w,grid,d);if(!p)break;const n=Math.min(maxStack(d),max-count);grid.items.push({uid:-(grid.items.length+1),def:item,count:n,gx:p[0],gy:p[1],rot:p[2]||undefined});count+=n}return count}
export function caravanQuote(w:World,origin:string){
 const m=w.s.overworld,d=caravanRules(w),source=m?.sites.find(s=>s.id===origin),market=m?.markets?.[origin],person=merchant(w,origin)
 let error:string|null=null
 if(!m||!source||!market||market.mobile||!person)error='출발지에 실제로 있는 자유로운 상인이 없다'
 if(!error&&m!.caravans?.some(c=>c.origin===origin&&['departing','outbound','returning','arriving'].includes(c.phase)))error='그 출발지의 원래 상인은 이미 교역 중이다'
 if(error)return{error,person,plan:undefined}
 const candidates:{destination:WorldSite;item:string;quantity:number;gross:number;upper:number}[]=[]
 for(const item of d.items){const stock=market!.items.filter(i=>i.def===item).reduce((n,i)=>n+i.count,0),quantity=capacityFor(w,item,Math.min(d.maxUnits,stock));if(!quantity)continue
  const from=unitValue(w,origin,item)
  for(const dest of m!.sites){if(!m!.markets?.[dest.id]||!routeAllowed(w,source!,dest))continue;const gross=(unitValue(w,dest.id,item)-from)*quantity,lower=(Math.abs(source!.cell.x-dest.cell.x)+Math.abs(source!.cell.y-dest.cell.y))*d.feePerCell;if(gross>lower)candidates.push({destination:dest,item,quantity,gross,upper:gross-lower})}
 }
 candidates.sort((a,b)=>b.upper-a.upper||(a.destination.id<b.destination.id?-1:a.destination.id>b.destination.id?1:0)||(a.item<b.item?-1:a.item>b.item?1:0))
 let plan:{destination:string;item:string;quantity:number;route:Pos[];hours:number;fee:number;profit:number}|undefined
 const routes=new Map<string,ReturnType<typeof worldRoute>>()
 for(const c of candidates){if(plan&&c.upper<=plan.profit)break;let route=routes.get(c.destination.id);if(route===undefined){route=worldRoute(w,source!.cell,c.destination.cell);routes.set(c.destination.id,route)}if(!route?.cells.length)continue;const fee=route.cells.length*d.feePerCell,profit=c.gross-fee;if(profit<=0||market!.money<fee)continue;if(!plan||profit>plan.profit)plan={destination:c.destination.id,item:c.item,quantity:c.quantity,route:route.cells.map(p=>({...p})),hours:route.hours,fee,profit}}
 return{error:plan?null:'실제 재고/현금으로 이익이 나는 육로 교역이 없다',person,plan}
}
function nextStockId(w:World){const sim=w.s.overworld!.simulation!;const id=sim.nextItemId??WORLD_STOCK_ID_START;sim.nextItemId=id+1;return id}
export function dispatchCaravan(w:World,origin:string):string|null{
 const q=caravanQuote(w,origin);if(q.error)return q.error
 const m=w.s.overworld!,d=caravanRules(w),plan=q.plan!,market=m.markets![origin],source=m.sites.find(s=>s.id===origin)!,person=q.person!,day=Math.floor(turnOf(w)/TURNS_PER_DAY),id=`caravan:${m.nextCaravan??1}`,marketKey=`@${id}`
 const guardDef=factionDef(w,source.faction!)?.guard,guards=person.owner.people().filter(c=>c.id!==person.c.id&&c.def===guardDef&&c.faction===person.c.faction&&available(w,c)).slice(0,d.maxGuards),actors=[person.c,...guards],capital=Math.min(d.wallet,market.money-plan.fee)
 // Preflight complete before transferring the first physical item or coin.
 const cargo:ItemInst[]=[];let left=plan.quantity
 for(const it of [...market.items])if(it.def===plan.item&&left){while(left&&it.count){const n=Math.min(left,it.count,maxStack(itemDef(w,it))),whole=n===it.count,piece=whole?it:{...it,uid:nextStockId(w),count:n};if(whole)market.items=market.items.filter(i=>i!==it);else it.count-=n;delete piece.gx;delete piece.gy;delete piece.rot;cargo.push(piece);left-=n;if(whole)break}}
 const mobile={site:origin,stockDef:market.stockDef,items:cargo,money:capital,day,nextRestock:day,mobile:true,worldCell:{...source.cell}},layout=mobileCargoLayout(w,mobile,cargo)
 // capacityFor proved this homogeneous load fits; no fallback creates or discards cargo.
 if(layout.error)throw Error(layout.error)
 for(const pos of layout.positions){const i=cargo.find(i=>i.uid===pos.uid)!;i.gx=pos.x;i.gy=pos.y;i.rot=pos.rot||undefined}
 market.money-=capital+plan.fee
 let fee=plan.fee;for(let i=0;i<actors.length;i++){const pay=i===actors.length-1?fee:Math.floor(plan.fee/actors.length);actors[i].money=(actors[i].money??0)+pay;fee-=pay}
 const homes=actors.map(c=>({id:c.id,pos:{...c.pos},home:c.home?{...c.home}:undefined,room:c.room,mapId:c.mapId,traderSite:c.traderSite,residentSite:c.residentSite}));for(const c of actors){c.caravan=id;c.activity=undefined;c.ai.path=undefined;if(c===person.c)c.traderSite=marketKey}
 const localDeparture=m.currentRegion===origin&&person.owner.map===w.s.map
 if(!localDeparture)person.owner.set(person.owner.people().filter(c=>!actors.includes(c)))
 const now=turnOf(w),record:CaravanState={id,origin,destination:plan.destination,leader:person.c.id,members:actors.map(c=>c.id),homes,market:marketKey,position:{...source.cell},route:plan.route,index:0,nextMove:now+Math.ceil(routeHours(w,source.cell,plan.route[0])*TURNS_PER_HOUR),phase:localDeparture?'departing':'outbound',actors:localDeparture?undefined:actors,deployed:localDeparture||undefined,leftAt:localDeparture?undefined:now+departureTurns(w,person.owner,actors),departure:now,item:plan.item,quantity:plan.quantity,predictedProfit:plan.profit,fee:plan.fee,capital,paid:0}
 if(record.leftAt!==undefined)record.nextMove+=record.leftAt-now
 ;(m.caravans??=[]).push(record);m.nextCaravan=(m.nextCaravan??1)+1;(m.markets??={})[marketKey]=mobile
 return null
}
export function exitPositions(w:World,map:MapState):Pos[]{const seen=new Set<number>(),out:Pos[]=[];for(const exit of map.exits)for(const d of [{x:0,y:0},...DIRS]){const p={x:exit.x+d.x,y:exit.y+d.y};if(p.x<0||p.y<0||p.x>=map.w||p.y>=map.h)continue;const i=p.y*map.w+p.x,t=w.db.terrain(map.tiles[i].t);if(seen.has(i)||!t.passable||t.water)continue;seen.add(i);out.push(p)}return out}
export function departureTurns(w:World,owner:CaravanOwner,actors:Creature[]):number{
 const local={db:w.db,s:{...w.s,map:owner.map,creatures:owner.people()}},exits=exitPositions(w,owner.map);if(!exits.length)return 1
 return Math.max(1,...actors.map((a,i)=>findPath(local,a.pos,exits[i%exits.length],{selfId:a.id,avoidCreatures:false,maxNodes:owner.map.w*owner.map.h})?.length??owner.map.w+owner.map.h))
}
export function roadExitPositions(w:World,c:Pick<CaravanState,'route'|'position'|'index'>):Pos[]{
 const map=w.s.map,to=c.route[c.index];if(!to)return[]
 const dx=to.x-c.position.x,dy=to.y-c.position.y,horizontal=Math.abs(dx)>=Math.abs(dy),out:Pos[]=[]
 for(let n=0;n<(horizontal?map.h:map.w);n++){const p=horizontal?{x:dx>=0?map.w-1:0,y:n}:{x:n,y:dy>=0?map.h-1:0},t=w.db.terrain(map.tiles[p.y*map.w+p.x].t);if(t.passable&&!t.water)out.push(p)}
 const middle=horizontal?map.h/2:map.w/2;return out.sort((a,b)=>Math.abs((horizontal?a.y:a.x)-middle)-Math.abs((horizontal?b.y:b.x)-middle)||a.y*map.w+a.x-(b.y*map.w+b.x))
}
export function caravanExitFor(w:World,actor:Creature):Pos|undefined{
 const c=w.s.overworld?.caravans?.find(c=>c.id===actor.caravan);if(!c)return
 if(['outbound','returning'].includes(c.phase)){if(w.s.overworld?.currentRegion||!c.deployed||c.stopUntil===undefined||turnOf(w)<c.stopUntil)return;const exits=roadExitPositions(w,c);return exits[Math.max(0,c.members.indexOf(actor.id))%exits.length]}
 if(w.s.overworld?.currentRegion!==c.origin)return
 if(c.phase==='arriving'){const h=c.homes.find(h=>h.id===actor.id);return h?.home??h?.pos}
 if(c.phase!=='departing')return;const exits=exitPositions(w,w.s.map);return exits.length?exits[Math.max(0,c.members.indexOf(actor.id))%exits.length]:undefined
}
function finishDeparture(w:World,c:CaravanState){const actors=w.s.creatures.filter(a=>a.caravan===c.id&&a.alive);if(!actors.some(a=>a.id===c.leader))return false;c.actors=actors;c.phase='outbound';c.deployed=false;c.leftAt=turnOf(w);c.nextMove=c.leftAt+Math.ceil(routeHours(w,c.position,c.route[0])*TURNS_PER_HOUR);w.s.creatures=w.s.creatures.filter(a=>!actors.includes(a));return true}
export function freePositions(w:World,owner:CaravanOwner,count:number,near:Pos):Pos[]|undefined{
 const occupied=new Set(owner.people().filter(c=>c.alive).map(c=>c.pos.y*owner.map.w+c.pos.x)),out:Pos[]=[]
 const cells=owner.map.tiles.map((t,i)=>({t,i,pos:{x:i%owner.map.w,y:Math.floor(i/owner.map.w)}})).filter(p=>{const d=w.db.terrain(p.t.t);return d.passable&&!d.water&&!occupied.has(p.i)}).sort((a,b)=>cheb(a.pos,near)-cheb(b.pos,near)||a.i-b.i)
 for(const cell of cells){out.push(cell.pos);if(out.length===count)return out}return undefined
}
function homePositions(w:World,owner:CaravanOwner,actors:Creature[],c:CaravanState):Pos[]|undefined{
 const occupied=new Set(owner.people().filter(a=>a.alive&&!actors.includes(a)).map(a=>a.pos.y*owner.map.w+a.pos.x)),out:Pos[]=[]
 for(const actor of actors){const h=c.homes.find(h=>h.id===actor.id)!,home=h.home??h.pos;let chosen:Pos|undefined;for(const d of [{x:0,y:0},...DIRS]){const p={x:home.x+d.x,y:home.y+d.y};if(p.x<0||p.y<0||p.x>=owner.map.w||p.y>=owner.map.h)continue;const i=p.y*owner.map.w+p.x,t=w.db.terrain(owner.map.tiles[i].t);if(!occupied.has(i)&&t.passable&&!t.water){chosen=p;occupied.add(i);break}}if(!chosen)return;out.push(chosen)}return out
}
function settleArrival(w:World,c:CaravanState){
 const home=c.homes.find(h=>h.id===c.leader),owner=caravanOwners(w,c.origin).find(o=>o.map.id===home?.mapId)??caravanOwners(w,c.origin)[0];if(!owner)return
 const actors=owner.people().filter(a=>a.caravan===c.id&&a.alive),visible=owner.map===w.s.map&&w.s.overworld?.currentRegion===c.origin;if(!actors.some(a=>a.id===c.leader))return
 if(visible){if(!actors.every(a=>{const h=c.homes.find(h=>h.id===a.id)!;return cheb(a.pos,h.home??h.pos)<=1}))return}
 else{if(turnOf(w)<c.nextMove)return;const positions=homePositions(w,owner,actors,c);if(!positions)return;for(let i=0;i<actors.length;i++)actors[i].pos={...positions[i]}}
 const m=w.s.overworld!,mobile=m.markets![c.market],market=m.markets![c.origin];if(!mobile||!market)return
 market.items.push(...mobile.items.map(i=>{delete i.gx;delete i.gy;delete i.rot;return i}));mobile.items=[];market.money+=mobile.money;mobile.money=0
 for(const actor of actors){const h=c.homes.find(h=>h.id===actor.id)!;actor.home=h.home?{...h.home}:undefined;actor.room=h.room;actor.mapId=h.mapId;actor.traderSite=h.traderSite;actor.residentSite=h.residentSite;delete actor.caravan;actor.ai.mode=w.db.creature(actor.def).ai==='guard'?'guard':'idle';actor.ai.dest=undefined;actor.ai.path=undefined;actor.nextAct=w.s.time+100}
 c.phase='completed';c.deployed=false;c.returned=turnOf(w)
}
function returnHome(w:World,c:CaravanState,at=turnOf(w)):boolean{
 const source=mSite(w,c.origin),actors=c.actors??[],home=c.homes.find(h=>h.id===c.leader),owner=caravanOwners(w,c.origin).find(o=>o.map.id===home?.mapId)??caravanOwners(w,c.origin)[0]
 if(!source||!owner||w.s.overworld?.simulation?.settlements[c.origin]?.quarantined)return false
 const positions=freePositions(w,owner,actors.length,owner.map.exits[0]??{x:1,y:1});if(!positions)return false
 for(let i=0;i<actors.length;i++){const actor=actors[i];actor.pos={...positions[i]};actor.mapId=owner.map.id;actor.home={...(c.homes.find(h=>h.id===actor.id)!.home??c.homes.find(h=>h.id===actor.id)!.pos)};actor.room=undefined;actor.ai.path=undefined;actor.nextAct=w.s.time+100}
 owner.set([...owner.people(),...actors]);delete c.actors;c.phase='arriving';c.deployed=true
 const local={db:w.db,s:{...w.s,map:owner.map,creatures:owner.people()}}
 c.nextMove=at+Math.max(1,...actors.map(a=>findPath(local,a.pos,c.homes.find(h=>h.id===a.id)!.home??c.homes.find(h=>h.id===a.id)!.pos,{selfId:a.id,avoidCreatures:false,maxNodes:owner.map.w*owner.map.h})?.length??owner.map.w+owner.map.h))
 settleArrival(w,c);return true
}
function mSite(w:World,id:string){return w.s.overworld?.sites.find(s=>s.id===id)}
function arrive(w:World,c:CaravanState,at:number){
 const m=w.s.overworld!,mobile=m.markets![c.market],dest=m.markets![c.destination],origin=mSite(w,c.origin)!,target=mSite(w,c.destination)!
 if(!dest||!mobile)return
 if(!m.simulation?.settlements[c.destination]?.quarantined&&Math.min(factionRelation(w,origin.faction!,target.faction!),factionRelation(w,target.faction!,origin.faction!))>-50){for(const it of [...mobile.items]){const price=unitValue(w,c.destination,it.def,it);if(price<=0)continue;const count=Math.min(it.count,Math.floor(dest.money/price));if(!count)continue;const paid=count*price,piece=count===it.count?it:{...it,uid:nextStockId(w),count};if(count===it.count)mobile.items=mobile.items.filter(i=>i!==it);else it.count-=count;delete piece.gx;delete piece.gy;delete piece.rot;dest.items.push(piece);dest.money-=paid;mobile.money+=paid;c.paid+=paid}}
 c.arrival=at;if(!c.robbedBy&&!m.simulation?.settlements[c.destination]?.quarantined&&Math.min(factionRelation(w,origin.faction!,target.faction!),factionRelation(w,target.faction!,origin.faction!))>-50)recordFactionIncident(w,origin.faction!,target.faction!,'caravan',`caravan:${c.id}`,c.members,c.destination)
 const reverse=[{...origin.cell},...c.route.slice(0,-1)].reverse();c.route=reverse;c.index=0;c.phase='returning';mobile.site=c.destination
 if(reverse.length)c.nextMove=at+Math.ceil(routeHours(w,c.position,reverse[0])*TURNS_PER_HOUR);else returnHome(w,c)
}
export function caravanTick(w:World){
 const m=w.s.overworld;if(!m)return
 const now=turnOf(w),d=caravanRules(w)
 for(const c of m.caravans??[]){if(c.deployed&&['departing','outbound','returning','arriving'].includes(c.phase)&&seizedMembers(w,c))continue;if(c.phase==='arriving'){settleArrival(w,c);continue}if(c.phase==='departing'){const members=w.s.creatures.filter(a=>a.caravan===c.id&&a.alive);if(members.length&&members.every(a=>{const exit=caravanExitFor(w,a);return exit&&eq(a.pos,exit)}))finishDeparture(w,c);continue}if(c.deployed){
   if(['outbound','returning'].includes(c.phase)){
    c.stopUntil??=now+d.encounterStopTurns;c.encounteredCell??={...c.position}
    const members=w.s.creatures.filter(a=>a.caravan===c.id&&a.alive)
    if(members.length&&members.every(a=>{const exit=caravanExitFor(w,a);return exit&&eq(a.pos,exit)}))packCaravans(w)
   }
   continue
  }if(!['outbound','returning'].includes(c.phase))continue
  for(let guard=0;guard<m.w*m.h&&c.nextMove<=now;guard++){
   if(c.index>=c.route.length){if(c.phase==='returning'){returnHome(w,c);c.nextMove=now+TURNS_PER_HOUR}break}
   const to=c.route[c.index],cost=routeHours(w,c.position,to);if(!Number.isFinite(cost)){c.nextMove=now+TURNS_PER_HOUR;break}const completedAt=c.nextMove;c.position={...to};delete c.encounteredCell;delete c.stopUntil;delete c.noticedAt;c.index++;const mobile=m.markets?.[c.market];if(mobile)mobile.worldCell={...to}
   if(c.index===c.route.length){if(c.phase==='outbound')arrive(w,c,completedAt);else{if(!returnHome(w,c,completedAt))c.nextMove=now+TURNS_PER_HOUR;break}}
   else c.nextMove=completedAt+Math.ceil(routeHours(w,c.position,c.route[c.index])*TURNS_PER_HOUR)
   if(c.phase==='completed')break
  }
 }
 if(now%TURNS_PER_HOUR)return
 const day=Math.floor(now/TURNS_PER_DAY),hour=Math.floor(now/TURNS_PER_HOUR)%24;if(day<d.intervalDays||day%d.intervalDays)return
 for(let i=0;i<m.sites.length;i++){const site=m.sites[i];if(i%24!==hour||m.caravanChecks?.[site.id]===day||!merchant(w,site.id))continue;(m.caravanChecks??={})[site.id]=day;dispatchCaravan(w,site.id)}
}
export function observedCaravans(w:World){const m=w.s.overworld;return m&&!m.currentRegion?(m.caravans??[]).filter(c=>c.deployed&&['outbound','returning'].includes(c.phase)&&eq(c.position,m.position)&&w.s.creatures.some(a=>a.caravan===c.id&&a.alive&&canSee(w,player(w),a.pos))):[]}
export function encounterCaravans(w:World){
 const m=w.s.overworld;if(!m||m.currentRegion||w.s.map.vessel||w.s.map.kind!=='surface')return
 for(const c of m.caravans??[]){if(c.deployed||c.encounteredCell&&eq(c.encounteredCell,m.position)||!c.actors?.length||(c.leftAt??0)>turnOf(w)||!['outbound','returning'].includes(c.phase)||!eq(c.position,m.position))continue
  const owner:CaravanOwner={map:w.s.map,people:()=>w.s.creatures,set:cs=>{w.s.creatures=cs}},positions=freePositions(w,owner,c.actors.length,{x:1,y:Math.floor(w.s.map.h/2)});if(!positions)continue
  for(let i=0;i<c.actors.length;i++){const actor=c.actors[i];actor.pos={...positions[i]};actor.home={...positions[i]};actor.mapId=w.s.map.id;actor.room=undefined;actor.ai.mode='guard';actor.ai.dest=undefined;actor.ai.path=undefined;actor.nextAct=w.s.time+100}
  w.s.creatures.push(...c.actors);delete c.actors;c.deployed=true;c.encounteredCell={...m.position};c.stopUntil=turnOf(w)+caravanRules(w).encounterStopTurns;c.pausedTurns=Math.max(1,c.nextMove-turnOf(w));updatePlayerVision(w,player(w))
 }
 for(const c of observedCaravans(w))if(c.noticedAt===undefined){c.noticedAt=turnOf(w);if(player(w).activity?.kind==='travel')player(w).activity=undefined;log(w,'info','실제로 이동하던 교역 무리를 같은 길목에서 만났다.')}
}
function seizedMembers(w:World,c:CaravanState,party:Creature[]=[]):boolean{
 const present=w.s.creatures.filter(a=>a.caravan===c.id&&a.alive),seized=present.filter(a=>party.includes(a)||a.captivity||a.companion)
 if(seized.some(a=>a.id===c.leader)){const leader=present.find(a=>a.id===c.leader)!,market=w.s.overworld!.markets![c.market],tile=w.s.map.tiles[leader.pos.y*w.s.map.w+leader.pos.x];tile.items.push(...market.items.map(i=>{delete i.gx;delete i.gy;delete i.rot;return i}));market.items=[];leader.money=(leader.money??0)+market.money;market.money=0;c.phase='raided';for(const a of present){delete a.caravan;if(a.id===c.leader)a.traderSite=undefined}return true}
 for(const a of seized){delete a.caravan;(c.lost??=[]).push(a.id);c.members=c.members.filter(id=>id!==a.id)}
 return false
}
export function packCaravans(w:World,party:Creature[]=[]){
 for(const c of w.s.overworld?.caravans??[]){
  if(!c.deployed||!['departing','outbound','returning','arriving'].includes(c.phase))continue
  if(seizedMembers(w,c,party))continue
  const actors=w.s.creatures.filter(a=>a.caravan===c.id&&a.alive);if(!actors.length)continue
  if(c.phase==='arriving'){const local={db:w.db,s:{...w.s}},distance=Math.max(1,...actors.map(a=>findPath(local,a.pos,c.homes.find(h=>h.id===a.id)!.home??c.homes.find(h=>h.id===a.id)!.pos,{selfId:a.id,avoidCreatures:false,maxNodes:w.s.map.w*w.s.map.h})?.length??w.s.map.w+w.s.map.h));c.nextMove=turnOf(w)+distance;continue}
  if(!actors.some(a=>a.id===c.leader)){c.phase='raided';continue}
  const wasDeparting=c.phase==='departing';c.actors=actors;c.deployed=false;delete c.stopUntil
  if(wasDeparting){const owner:CaravanOwner={map:w.s.map,people:()=>w.s.creatures,set:cs=>{w.s.creatures=cs}};c.phase='outbound';c.leftAt=turnOf(w)+departureTurns(w,owner,actors);c.nextMove=c.leftAt+Math.ceil(routeHours(w,c.position,c.route[0])*TURNS_PER_HOUR)}
  else{c.nextMove=turnOf(w)+(c.pausedTurns??Math.max(1,c.nextMove-turnOf(w)));delete c.pausedTurns}
  w.s.creatures=w.s.creatures.filter(a=>!actors.includes(a))
 }
}
export function caravanLeaderDied(w:World,actor:Creature){
 const m=w.s.overworld,c=m?.caravans?.find(c=>c.id===actor.caravan&&c.leader===actor.id&&c.deployed),market=c&&m?.markets?.[c.market]
 if(!c||!market)return
 actor.bag.push(...market.items.map(i=>{delete i.gx;delete i.gy;delete i.rot;return i}));market.items=[];actor.money=(actor.money??0)+market.money;market.money=0;c.phase='raided';for(const member of w.s.creatures)if(member.id!==actor.id&&member.caravan===c.id)delete member.caravan
}
export function convoyStoredPeople(w:World){return[...(w.s.overworld?.caravans??[]).flatMap(c=>c.actors??[]),...raidStoredPeople(w)]}

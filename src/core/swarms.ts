import {diagonalBlocked} from './path'
/** Real finite environmental colonies, real emitted lights, and paid original-item collection. */
import {capacity} from './body'
import {ensureBestiary,bestiaryDef} from './bestiary-state'
import {dustMask} from './air-state'
import {daylight} from './environment'
import {hasLos,canSee,invalidateLights,lightLevel} from './fov'
import {cheb,dirIndex,DIRS,type Pos} from './geom'
import {allItems,lightSource,makeItem,addToBag,removeOne,hasBlade} from './items'
import {emitNoise} from './perception'
import {fx} from './combat'
import {rng,tileAt,terrainAt,inBounds,player,turnOf,log,type World} from './ctx'
import {coveringSwarms,swarmDensity,validSwarmRule,swarmSignature,swarmStrength} from './swarm-state'
import type {Creature,MapState,SwarmDef,SwarmState} from './types'
export function createSwarm(w:World,id:string,pos:Pos):SwarmState{const d=w.db.get<SwarmDef>(id);if(d.defType!=='Swarm')throw Error('군체 정의가 필요하다');return{uid:w.s.nextId++,def:id,rule:swarmSignature(d),origin:{...pos},pos:{...pos},members:d.members,initialMembers:d.members,captured:0,burned:0,cohesion:0,nextMoveAt:w.s.time+d.moveTU,lastTick:turnOf(w)}}
export function installMapSwarms(w:World,map:MapState,rows:{def:string;pos:[number,number]}[]){if(!rows.length)return;map.swarms=rows.map(row=>createSwarm(w,row.def,{x:row.pos[0],y:row.pos[1]}))}
type Light={pos:Pos;radius:number;key:number;kind:string;item?:ReturnType<typeof lightSource>}
function emittedLights(w:World):Light[]{return[...w.s.map.lights.flatMap((l,i)=>l.off||l.fuelUntil!==undefined&&l.fuelUntil<=turnOf(w)?[]:[{pos:l.pos,radius:l.radius,key:-(i+1),kind:l.kind}]),...w.s.creatures.flatMap(c=>{const src=c.alive?lightSource(w,c):undefined;return src?[{pos:c.pos,radius:src.radius,key:src.it.uid,kind:'carried',item:src}]:[]})]}
function usable(w:World,p:Pos){if(!inBounds(w,p))return false;const d=terrainAt(w,p);return(d.passable||!!d.water)&&!d.wall&&d.door!=='closed'}
function step(w:World,s:SwarmState,goal:Pos){
 const options=DIRS.map((d,dir)=>({dir,pos:{x:s.pos.x+d.x,y:s.pos.y+d.y}})).filter(p=>usable(w,p.pos)&&(!DIRS[p.dir].x||!DIRS[p.dir].y||usable(w,{x:p.pos.x,y:s.pos.y})||usable(w,{x:s.pos.x,y:p.pos.y})))
 options.sort((a,b)=>cheb(a.pos,goal)-cheb(b.pos,goal)||a.dir-b.dir);const next=options.find(p=>cheb(p.pos,goal)<cheb(s.pos,goal));if(!next)return
 const from={...s.pos};s.pos=next.pos;fx(w,{k:'move',id:s.uid,from,to:{...s.pos},turn:turnOf(w)})
}
export function swarmTick(w:World){
 const now=turnOf(w);let lights:Light[]|undefined
 for(const s of w.s.map.swarms??[]){
  const d=validSwarmRule(w,s);if(!d||s.members<=0||s.lastTick>=now)continue;const previousTick=s.lastTick;s.lastTick=now
  const dark=w.s.map.kind==='dungeon'||tileAt(w,s.pos).roof||daylight(w)*(w.s.map.daylightMult??1)<=d.activeDaylightMax
  const source=dark?(lights??=emittedLights(w)).filter(l=>cheb(l.pos,s.pos)<=l.radius*d.attractionRadiusMult&&hasLos(w,s.pos,l.pos)).sort((a,b)=>cheb(a.pos,s.pos)-cheb(b.pos,s.pos)||b.radius-a.radius||a.key-b.key)[0]:undefined
  if(!source){
   if(s.lostLightAt===undefined){s.lostLightAt=previousTick;s.disperseAt=previousTick+rng(w,'world.swarm').int(...d.disperseTurns)}
   const remaining=Math.max(1,s.disperseAt!-now+1);s.cohesion=Math.max(0,Math.floor(s.cohesion*(remaining-1)/remaining))
   s.nextMoveAt=w.s.time+d.moveTU;continue
  }
  delete s.lostLightAt;delete s.disperseAt;s.cohesion=Math.min(100,s.cohesion+25)
  // At most the actions due this turn. No offline/catch-up burst after a dormant map.
  let moves=0;while(s.nextMoveAt<=w.s.time&&moves++<Math.ceil(100/d.moveTU)+1){step(w,s,source.pos);s.nextMoveAt+=d.moveTU}
  if(s.nextMoveAt<=w.s.time)s.nextMoveAt=w.s.time+d.moveTU
  if(cheb(s.pos,source.pos)<=d.coverRadius){
   if(d.burnKinds.includes(source.kind)){const lost=Math.min(s.members,d.burnMembersPerTurn);s.members-=lost;s.burned+=lost}
  }
 }
 // One roll per real emitted item per world turn; overlapping groups cannot multiply the5% cap.
 for(const source of lights??[]){const it=source.item?.it;if(!it||!it.lit)continue
  const near=(w.s.map.swarms??[]).flatMap(s=>{const d=validSwarmRule(w,s);return d&&swarmStrength(s)>0&&d.snuffItems.includes(it.def)&&cheb(s.pos,source.pos)<=d.coverRadius&&hasLos(w,s.pos,source.pos)?[{s,d}]:[]})
  if(!near.length)continue
  const pressure=Math.min(1,near.reduce((n,x)=>n+swarmStrength(x.s),0)),chance=Math.max(...near.map(x=>x.d.snuffChance))/100*pressure
  if(rng(w,'world.swarm').chance(chance)){it.lit=false;invalidateLights(w);if(canSee(w,player(w),source.pos))log(w,'warn','몰려든 재나방이 노출된 횃불을 꺼뜨렸다.')}
 }
 const pl=player(w)
 for(const [def,b]of Object.entries(w.s.knowledge.bestiary)){if(w.db.tryGet(def)?.defType!=='Swarm')continue;if(pl.alive&&b?.swarmExposureAt!==undefined&&now>b.swarmExposureAt&&!coveringSwarms(w,pl.pos).some(s=>s.def===def))b.survived=true}
 for(const s of w.s.map.swarms??[]){if(!pl.alive||!swarmDensity(s)||!canSee(w,pl,s.pos)||pl.asleep||pl.unconscious)continue;const b=ensureBestiary(w,s.def);if(b.observedAt!==now){if(b.lastSeen===undefined||now-b.lastSeen>=bestiaryDef(w).encounterGap)b.encounters=(b.encounters??0)+1;b.seen++;b.observeTurns=(b.observeTurns??0)+1;b.observedAt=now;b.lastSeen=now}}
}
export function swarmExposure(w:World,c:Creature){
 if(!c.alive||c.aquatic?.submerged||w.db.body(c.body.def).kind==='mechanical'||w.db.body(c.body.def).waterBreathing)return
 const groups=coveringSwarms(w,c.pos);if(!groups.length)return
 const d=validSwarmRule(w,groups[0])!,mask=dustMask(w,c),dose=groups.reduce((n,s)=>n+validSwarmRule(w,s)!.ashPerTurn*swarmStrength(s),0)
 if(dose*(1-(mask?.protection??0))>=d.minCoughDose&&dose>0&&turnOf(w)%d.coughEvery===0){emitNoise(w,c.pos,5,c.id);if(c.id===w.s.playerId)log(w,'warn','날개 가루에 기침이 났다. 불빛에서 벗어나거나 여과포를 써야 한다.')}
 if(c.id===w.s.playerId)for(const s of groups)ensureBestiary(w,s.def).swarmExposureAt=turnOf(w)
}
export function swarmCaptureQuote(w:World,c:Creature,uid:number,toolUid?:number){
 const s=w.s.map.swarms?.find(s=>s.uid===uid),d=s&&validSwarmRule(w,s),tool=allItems(c).find(it=>it.uid===toolUid)
 let error:string|null=null
 if(!s||!d||!swarmDensity(s))error='덮고 있는 실제 군체가 없다'
 else if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'manipulation')<.3)error='깨어서 면포를 다룰 손이 필요하다'
 else if(cheb(c.pos,s.pos)>1||!canSee(w,c,s.pos)||!hasLos(w,c.pos,s.pos)||diagonalBlocked(w,c.pos,s.pos.x-c.pos.x,s.pos.y-c.pos.y))error='보이는 군체 곁에 있어야 한다'
 else if(!tool||tool.def!==d.captureTool||tool.count<1)error='실제 채집 면포가 필요하다'
 return{error,swarm:s,rule:d,tool,count:s&&d?Math.min(s.members,d.captureMembers):0}
}
export function captureSwarm(w:World,c:Creature,uid:number,toolUid:number){const q=swarmCaptureQuote(w,c,uid,toolUid);if(q.error)return q.error
 const s=q.swarm!,d=q.rule!,count=q.count;if(cheb(c.pos,s.pos)>0)c.facing=dirIndex(s.pos.x-c.pos.x,s.pos.y-c.pos.y);s.members-=count;s.captured+=count;const item=makeItem(w,d.bodyItem,count),left=addToBag(w,c,item);if(left)tileAt(w,c.pos).items.push({...item,count:left,gx:undefined,gy:undefined});emitNoise(w,c.pos,2,c.id);log(w,'info',`원래 군체에서 나방 ${count}마리를 면포로 채집했다.`);return null}
export function mothStudyQuote(w:World,c:Creature,uid:number){
 const it=c.bag.find(i=>i.uid===uid&&i.count>0),d=it&&w.db.all<SwarmDef>('Swarm').find(d=>d.bodyItem===it.def)
 let error:string|null=null
 if(!it||!d)error='원래 채집 표본이 없다'
 else if(!c.alive||c.unconscious||c.asleep||capacity(w,c,'manipulation')<.3)error='깨어서 표본을 다룰 손이 필요하다'
 else if(!hasBlade(w,c)||!allItems(c).some(i=>(i.durability??100)>0&&w.db.item(i.def).attacks?.some(a=>a.family==='blade')))error='쓸 수 있는 날이 필요하다'
 else if(lightLevel(w,c.pos)>=2)error='표본을 살피기에는 너무 어둡다'
 return{error,item:it,rule:d}
}
export function studyMoths(w:World,c:Creature,uid:number){
 const q=mothStudyQuote(w,c,uid);if(q.error)return q.error
 removeOne(w,c,uid);const b=ensureBestiary(w,q.rule!.id,c);b.dissected=(b.dissected??0)+1;log(w,'info','실제 나방 표본 한 마리를 갈라 살피고 군체의 구조를 기록했다.');return null
}

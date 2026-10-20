// 봉화는 실제로 생성한 지도/기구·유한 연료와 이미 아는 소식만 사용한다.
import {learnRumor} from './rumor-state'
import { channelTurns } from './action-time'
import { capacity } from './body'
import { inBounds, log, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos, invalidateLights } from './fov'
import { cheb, DIRS, line, type Pos } from './geom'
import { diagonalBlocked } from './path'
import type { BeaconAddress, BeaconConfig, BeaconState, Creature, MapState, Rumor, SignalPacket } from './types'
export interface BeaconPost {address:BeaconAddress;map:MapState;state:BeaconState;config:BeaconConfig;label:string;cell:Pos}
export function rumorSignalKey(r:Rumor):string{return JSON.stringify([r.id,r.regionId??'',r.writtenAt,r.text])}
function mapsAt(w:World,site:string):MapState[]{
 const m=w.s.overworld;if(!m)return[]
 if(m.currentRegion===site)return[w.s.map,...Object.values(w.s.maps)]
 const scene=m.scenes[site];return scene?[scene.map,...Object.values(scene.maps)]:[]
}
export function resolveBeacon(w:World,a:BeaconAddress):BeaconPost|undefined{
 const site=w.s.overworld?.sites.find(s=>s.id===a.site),map=mapsAt(w,a.site).find(m=>m.id===a.map)
 if(!site||!map||!Number.isSafeInteger(a.pos.x)||!Number.isSafeInteger(a.pos.y)||a.pos.x<0||a.pos.y<0||a.pos.x>=map.w||a.pos.y>=map.h)return
 const tile=map.tiles[a.pos.y*map.w+a.pos.x],config=w.db.terrain(tile.t).beacon
 if(!config||tile.beacon?.uid!==a.uid)return
 return{address:{site:a.site,map:a.map,pos:{...a.pos},uid:a.uid},map,state:tile.beacon,config,label:site.label,cell:site.cell}
}
export function knownBeaconPosts(w:World):BeaconPost[]{
 const m=w.s.overworld;if(!m)return[]
 const out:BeaconPost[]=[],seen=new Set<number>()
 for(const site of m.sites)for(const map of mapsAt(w,site.id))for(let i=0;i<map.tiles.length;i++){
  const b=map.tiles[i].beacon;if(!b||seen.has(b.uid))continue
  const row=resolveBeacon(w,{site:site.id,map:map.id,pos:{x:i%map.w,y:Math.floor(i/map.w)},uid:b.uid})
  if(row){out.push(row);seen.add(b.uid)}
 }
 return out
}
export function initializeBeacons(w:World){
 for(let i=0;i<w.s.map.tiles.length;i++){
  const tile=w.s.map.tiles[i],config=w.db.terrain(tile.t).beacon;if(!config)continue
  const b=tile.beacon??={uid:w.s.nextId++,fuelUntil:turnOf(w),inbox:[]},pos={x:i%w.s.map.w,y:Math.floor(i/w.s.map.w)}
  if(!w.s.map.lights.some(l=>l.sourceUid===b.uid&&l.kind==='beacon'))w.s.map.lights.push({pos,radius:config.radius,kind:'beacon',sourceUid:b.uid,fuelUntil:b.fuelUntil,off:b.fuelUntil<=turnOf(w)})
 }
}
export function nearbyBeacons(w:World,c:Creature):BeaconPost[]{
 const site=w.s.overworld?.currentRegion;if(!site)return[]
 return[{x:0,y:0},...DIRS].map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).flatMap(pos=>{const b=inBounds(w,pos)&&tileAt(w,pos).beacon;if(!b)return[];const post=resolveBeacon(w,{site,map:w.s.map.id,pos,uid:b.uid});return post&&canSee(w,c,pos)&&hasLos(w,c.pos,pos)?[post]:[]})
}
function access(w:World,c:Creature,pos:Pos,uid:number){
 const site=w.s.overworld?.currentRegion,post=site&&resolveBeacon(w,{site,map:w.s.map.id,pos,uid})
 let error:string|null=null
 if(!post)error='그 원래 봉화가 이 지도에 없다'
 else if(!w.s.creatures.includes(c)||!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 손을 쓸 수 있어야 한다'
 else if(cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))error='보이는 봉화 바로 곁이어야 한다'
 return{post:post||undefined,error}
}
/** 실제 지형 높이를 가로막는 봉화끼리는 직접 빛을 전하지 못한다. */
export function beaconRouteError(w:World,from:BeaconPost,to:BeaconPost):string|null{
 const m=w.s.overworld!
 if(from.address.uid===to.address.uid)return '같은 봉화로 보낼 수 없다'
 if(from.config.network!==to.config.network)return '서로 다른 신호 규약이다'
 const distance=Math.abs(from.cell.x-to.cell.x)+Math.abs(from.cell.y-to.cell.y)
 if(distance>Math.min(from.config.rangeCells,to.config.rangeCells))return '실제 봉화 사이가 신호 거리 밖이다'
 const a=m.cells[from.cell.y*m.w+from.cell.x].altitude+from.config.height,b=m.cells[to.cell.y*m.w+to.cell.x].altitude+to.config.height,steps=cheb(from.cell,to.cell)
 for(const p of line(from.cell,to.cell).slice(0,-1)){const t=cheb(from.cell,p)/Math.max(1,steps);if(m.cells[p.y*m.w+p.x].altitude>a+(b-a)*t)return '중간 지형이 실제 봉화의 빛을 가린다'}
 return null
}
export function beaconFuelQuote(w:World,c:Creature,pos:Pos,uid:number,fuelUid:number){
 const a=access(w,c,pos,uid),fuel=c.bag.find(i=>i.uid===fuelUid),d=a.post?.config
 let error=a.error
 if(!error&&(!fuel||fuel.def!==d!.fuel||fuel.count<1))error='배낭의 원래 땔감이 필요하다'
 if(!error&&Math.max(0,a.post!.state.fuelUntil-turnOf(w))+d!.fuelTurns>d!.maxFuelTurns)error='봉화의 실제 연료 한도에 도달했다'
 const turns=d?channelTurns(w,c,d.igniteTurns):null;if(!error&&turns===null)error='현재 몸으로는 불을 다룰 수 없다'
 return{...a,error,fuel,turns:turns??0}
}
export function startBeaconFuel(w:World,c:Creature,pos:Pos,uid:number,fuelUid:number):string|null{
 const q=beaconFuelQuote(w,c,pos,uid,fuelUid);if(q.error)return q.error
 c.activity={kind:'beaconWork',label:'봉화에 실제 땔감 넣기',remaining:q.turns,total:q.turns,beaconWork:{kind:'fuel',source:q.post!.address,signature:JSON.stringify(q.post!.config),fuelUid}}
 return null
}
export function beaconSignalQuote(w:World,c:Creature,pos:Pos,uid:number,toAddress:BeaconAddress,rumorKey:string){
 const a=access(w,c,pos,uid),to=resolveBeacon(w,toAddress),known=c.id===w.s.playerId?w.s.knowledge.rumors:c.knownRumors,rumor=known?.find(r=>rumorSignalKey(r)===rumorKey)
 let error=a.error
 if(!error&&!to)error='실제로 방문한 원래 수신 봉화가 없다'
 if(!error&&!rumor)error='직접 알고 있는 원래 소식이 아니다'
 if(!error&&((c.literacy??(c.literate?2:0))<a.post!.config.literacyMin||capacity(w,c,'sight')<.2))error='글과 신호 부호를 읽을 수 있어야 한다'
 if(!error)error=beaconRouteError(w,a.post!,to!)
 if(!error&&(a.post!.state.fuelUntil<=turnOf(w)||to!.state.fuelUntil<=turnOf(w)))error='양쪽 실제 봉화에 불이 살아 있어야 한다'
 if(!error&&(to!.state.inbox.some(r=>r.key===rumorKey)||w.s.overworld!.signals?.some(p=>p.key===rumorKey&&p.to.uid===to!.address.uid&&!p.failed)))error='그 소식은 이미 전송했거나 도착했다'
 const distance=a.post&&to?Math.abs(a.post.cell.x-to.cell.x)+Math.abs(a.post.cell.y-to.cell.y):0,total=a.post?Math.max(a.post.config.turnsPerCell,distance*a.post.config.turnsPerCell):0,turns=a.post?channelTurns(w,c,a.post.config.sendTurns):null
 if(!error&&turns===null)error='현재 몸으로는 신호를 부호화할 수 없다'
 return{...a,error,to,rumor,total,turns:turns??0,travelTurns:a.post?Math.ceil(total/a.post.config.speed):0}
}
export function startBeaconSignal(w:World,c:Creature,pos:Pos,uid:number,to:BeaconAddress,rumorKey:string):string|null{
 const q=beaconSignalQuote(w,c,pos,uid,to,rumorKey);if(q.error)return q.error
 c.activity={kind:'beaconWork',label:'알고 있는 소식 부호화',remaining:q.turns,total:q.turns,beaconWork:{kind:'send',source:q.post!.address,to:q.to!.address,toSignature:JSON.stringify(q.to!.config),rumor:structuredClone(q.rumor!),signature:JSON.stringify(q.post!.config)}}
 return null
}
function packetError(w:World,p:SignalPacket,from:BeaconPost|undefined,to:BeaconPost|undefined):string|null{
 if(!from||!to)return '원래 봉화가 사라졌다'
 if(JSON.stringify(from.config)!==p.signature||JSON.stringify(to.config)!==p.toSignature)return '전송 규약이 달라졌다'
 return beaconRouteError(w,from,to)
}
/** 불이 꺼진 구간은 진행하지 않는다. 새로 불을 넣기 전에 반드시 이전 시각까지 정산한다. */
export function beaconTick(w:World){
 const now=turnOf(w)
 for(const p of w.s.overworld?.signals??[]){
  if(p.deliveredAt!==undefined||p.failed||p.lastAt>=now)continue
  const from=resolveBeacon(w,p.from),to=resolveBeacon(w,p.to),error=packetError(w,p,from,to)
  if(error){p.failed=error;continue}
  const until=Math.min(now,from!.state.fuelUntil,to!.state.fuelUntil),elapsed=Math.max(0,until-p.lastAt),left=Math.max(0,p.total-p.progress),used=Math.min(elapsed,left/from!.config.speed)
  p.progress=Math.min(p.total,p.progress+used*from!.config.speed)
  if(p.progress>=p.total){p.deliveredAt=p.lastAt+used;const rumor={...structuredClone(p.rumor),source:`${p.rumor.source} → ${from!.label} 봉화`,hop:p.rumor.hop+1};if(!to!.state.inbox.some(r=>r.key===p.key))to!.state.inbox.push({key:p.key,rumor,from:from!.label,receivedAt:p.deliveredAt})}
  p.lastAt=now
 }
}
export function beaconWorkStep(w:World,c:Creature):boolean{
 const a=c.activity!,b=a.beaconWork
 if(!b){c.activity=undefined;return true}
 const q=b.kind==='fuel'?beaconFuelQuote(w,c,b.source.pos,b.source.uid,b.fuelUid!):beaconSignalQuote(w,c,b.source.pos,b.source.uid,b.to!,rumorSignalKey(b.rumor!))
 if(q.error||JSON.stringify(q.post!.config)!==b.signature||b.kind==='send'&&JSON.stringify(resolveBeacon(w,b.to!)?.config)!==b.toSignature){c.activity=undefined;return true}
 if(a.remaining>0)return false
 beaconTick(w)
 if(b.kind==='fuel'){
  const fuel=c.bag.find(i=>i.uid===b.fuelUid)!,post=q.post!;if(--fuel.count<=0)c.bag=c.bag.filter(i=>i.uid!==fuel.uid)
  post.state.fuelUntil=Math.max(turnOf(w),post.state.fuelUntil)+post.config.fuelTurns
  const light=post.map.lights.find(l=>l.sourceUid===post.state.uid&&l.kind==='beacon')!;light.fuelUntil=post.state.fuelUntil;light.off=false;invalidateLights(w)
  log(w,'info','같은 봉화에 실제 땔감을 넣었다. 연료가 다하면 신호가 멎는다.')
 }else{
  const full=beaconSignalQuote(w,c,b.source.pos,b.source.uid,b.to!,rumorSignalKey(b.rumor!)),now=turnOf(w)
  ;(w.s.overworld!.signals??=[]).push({key:rumorSignalKey(b.rumor!),rumor:structuredClone(b.rumor!),from:b.source,to:b.to!,sentAt:now,lastAt:now,progress:0,total:full.total,signature:b.signature,toSignature:b.toSignature!})
  log(w,'info','직접 아는 소식을 봉화로 보냈다. 수신지에서 기록을 읽어야 내용을 알 수 있다.')
 }
 c.activity=undefined;return true
}
export function readBeacon(w:World,c:Creature,pos:Pos,uid:number):string|null{
 const a=access(w,c,pos,uid);if(a.error)return a.error
 if(capacity(w,c,'sight')<.2||(c.literacy??(c.literate?2:0))<a.post!.config.literacyMin)return '글과 수신 기록을 읽을 수 있어야 한다'
 beaconTick(w)
 let added=0
 for(const receipt of a.post!.state.inbox)if(learnRumor(w,c,{...receipt.rumor,source:receipt.rumor.source+' → '+a.post!.label+' 수신 기록'}))added++
 log(w,'info',`실제 봉화 수신 기록을 읽었다. 새로 알게 된 소식 ${added}건.`)
 return null
}

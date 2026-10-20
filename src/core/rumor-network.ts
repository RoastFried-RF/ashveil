// 공개한 당시 소식의 정착지 전파. 원격 현재 사건/개인 지식은 조회하지 않는다.
import {capacity} from './body'
import {log,rng,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {hostile} from './diplomacy'
import {hasLos} from './fov'
import {cheb} from './geom'
import {learnRumor,rumorList} from './rumor-state'
import {effectiveStat} from './traits'
import type {RngStream} from './rng'
import {worldRoute} from './overworld'
import type {Creature,Rumor,RumorDistortion,RumorNetworkRules,WorldSimulationDef,WorldSite} from './types'

export function rumorNetworkRules(w:World):RumorNetworkRules|undefined{return w.db.get<WorldSimulationDef>('WorldSimulation.Hearth').rumors}
const key=(...parts:string[])=>JSON.stringify(parts)
function alive(w:World,r:Rumor,at:number):boolean{
 const d=rumorNetworkRules(w)
 return !!d&&Number.isFinite(r.writtenAt)&&r.writtenAt>=0&&r.writtenAt<=at&&at-r.writtenAt<d.maxAgeDays*TURNS_PER_DAY&&(!r.relay||r.relay.accuracy>=d.minAccuracy)
}
function sites(w:World):WorldSite[]{const m=w.s.overworld;return m?.sites.filter(s=>s.kind==='settlement'&&!!m.simulation?.settlements[s.id])??[]}
function conversation(w:World,a:Creature,b:Creature):string|null{
 if(!w.s.creatures.includes(a)||!w.s.creatures.includes(b)||a===b||!a.alive||!b.alive||a.asleep||b.asleep||a.unconscious||b.unconscious||capacity(w,a,'consciousness')<.5||capacity(w,b,'consciousness')<.5)return '깨어 있는 두 사람이 필요하다'
 if(capacity(w,a,'hearing')<.2||capacity(w,b,'hearing')<.2)return '서로 말을 들을 수 있어야 한다'
 if(cheb(a.pos,b.pos)>1||!hasLos(w,a.pos,b.pos))return '상대 곁으로 다가가야 한다'
 if(hostile(w,a,b))return '상대가 말을 들으려 하지 않는다'
 return null
}
function resident(w:World,c:Creature):WorldSite|undefined{
 const current=w.s.overworld?.currentRegion
 return sites(w).find(s=>s.id===current&&[c.residentSite,c.traderSite,c.clinicSite].includes(s.id))
}
export function publicRumors(w:World,c:Creature):Rumor[]{return rumorList(w,c).filter(r=>!r.mapDocument&&['supply','outbreak','reputation','interaction'].includes(r.kind)&&alive(w,r,turnOf(w)))}
export function activeTownRumors(w:World,site:string):Rumor[]{return(w.s.overworld?.rumorNetwork?.towns[site]??[]).filter(r=>!!r.relay&&alive(w,r,turnOf(w)))}
export function postRumorError(w:World,c:Creature,speaker:Creature,id:string):string|null{
 if(!rumorNetworkRules(w))return '이 세계에는 소식 전파 규정이 없다'
 const error=conversation(w,c,speaker);if(error)return error
 const site=resident(w,speaker);if(!site)return '현지 정착지 주민에게 전해야 한다'
 const rumor=publicRumors(w,c).find(r=>r.id===id);if(!rumor)return '직접 알고 있는 유효한 공개 소식이 필요하다'
 const root=rumor.relay?.root??key(rumor.regionId??'',rumor.id)
 if(w.s.overworld!.rumorNetwork?.seen[key(root,site.id)]!==undefined)return '이 정착지에는 이미 전해진 소식이다'
 return null
}
export function rumorClaimText(w:World,r:Rumor):string{
 const c=r.claims;if(!c)return r.text
 return [c.what,c.count===undefined?'':`${c.count}명`,c.place?.label,c.faction?w.db.all<import('./types').FactionDef>('Faction').find(f=>f.key===c.faction)?.label??c.faction:'',c.when].filter(Boolean).join(' · ')
}
function distort(w:World,r:Rumor,stream:RngStream):void{
 const d=rumorNetworkRules(w)!,random=rng(w,stream),relay=r.relay!,c=r.claims
 relay.accuracy-=random.int(...d.accuracyLoss);r.hop++
 const options=(['count','place','faction','when','none']as const).map((field,i)=>({field,weight:d.distortionWeights[i]})),field=random.weighted(options,x=>x.weight)!.field
 let changed:RumorDistortion|undefined
 if(c&&field==='count'&&c.count!==undefined){c.count=Math.round(c.count*d.countMultiplier);changed='count'}
 if(c&&field==='place'&&c.place){const m=w.s.overworld!,p=c.place.cell,neighbors=[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}].filter(p=>p.x>=0&&p.y>=0&&p.x<m.w&&p.y<m.h);if(neighbors.length){c.place.cell=random.pick(neighbors);c.place.label=`월드 (${c.place.cell.x}, ${c.place.cell.y}) 부근`;changed='place'}}
 if(c&&field==='faction'&&c.faction){const others=d.factions.filter(f=>f!==c.faction);if(others.length){c.faction=random.pick(others);changed='faction'}}
 if(c&&field==='when'&&c.when){c.when='언젠가 앞서 들은 때';changed='when'}
 if(changed&&!relay.distortions.includes(changed))relay.distortions.push(changed)
 r.text=rumorClaimText(w,r)
}
/** 공개 그래프는 육로가 있는 정착지만 잇는다. 탐험 지식/지역 생성/시간/RNG를 변경하지 않는다. */
export function rumorConnections(w:World,site:string):{site:string;distance:number}[]{
 const d=rumorNetworkRules(w),from=sites(w).find(s=>s.id===site);if(!d||!from)return[]
 return sites(w).filter(s=>s.id!==site).flatMap(s=>{
  const route=d.landRoutes?worldRoute(w,from.cell,s.cell):undefined
  if(d.landRoutes&&!route)return[]
  return[{site:s.id,distance:route?route.cells.length:Math.abs(s.cell.x-from.cell.x)+Math.abs(s.cell.y-from.cell.y)}]
 }).sort((a,b)=>a.distance-b.distance||(a.site<b.site?-1:a.site>b.site?1:0)).slice(0,d.neighbors)
}
function forward(w:World,site:string,r:Rumor,at:number):void{
 const m=w.s.overworld!,state=m.rumorNetwork!,d=rumorNetworkRules(w)!,from=sites(w).find(s=>s.id===site)
 if(!from)return
 for(const{site:to,distance}of rumorConnections(w,site)){
  const root=r.relay!.root,edge=key(root,site,to)
  if(state.sent[edge]!==undefined||state.seen[key(root,to)]!==undefined)continue
  state.sent[edge]=r.writtenAt
  const stream:RngStream=`world.rumors.${edge}`,copy=structuredClone(r),due=at+Math.ceil((distance/d.cellsPerDay+rng(w,stream).range(...d.chatterDays))*TURNS_PER_DAY)
  distort(w,copy,stream);delete copy.relay!.suspected
  copy.source=from.label+'에서 전해 온 소식';copy.foundAt=due
  if(alive(w,copy,due))state.pending.push({key:edge,from:site,to,due,rumor:copy})
 }
}
export function postRumor(w:World,c:Creature,speaker:Creature,id:string):string|null{
 const error=postRumorError(w,c,speaker,id);if(error)return error
 const site=resident(w,speaker)!,r=structuredClone(publicRumors(w,c).find(r=>r.id===id)!)
 r.source=c.name+'가 '+site.label+'에서 전한 소식'
 publishPublicRumor(w,site.id,r)
 if(c.id===w.s.playerId)log(w,'info',site.label+'에 소식을 전했다. 다른 정착지까지는 시간이 걸린다.')
 return null
}
/** 실제 공개 사건/행동의 생성 지점에서만 호출한다. 옛 기록을 검색해 소급 게시하지 않는다. */
export function publishPublicRumor(w:World,site:string,rumor:Rumor,at=turnOf(w)):boolean{
 const m=w.s.overworld
 if(!m||!sites(w).some(s=>s.id===site)||!Number.isFinite(at)||at<0||at>turnOf(w)||!alive(w,rumor,at))return false
 const r=structuredClone(rumor),root=r.relay?.root??key(r.regionId??'',r.id)
 if(m.rumorNetwork?.seen[key(root,site)]!==undefined)return false
 m.rumorNetwork??={towns:{},pending:[],seen:{},sent:{}}
 r.relay??={root,origin:site,accuracy:100,distortions:[]};delete r.relay.suspected;r.foundAt=at
 m.rumorNetwork.seen[key(root,site)]=r.writtenAt;(m.rumorNetwork.towns[site]??=[]).push(r)
 forward(w,site,r,at)
 return true
}
export function rumorNetworkTick(w:World):void{
 const state=w.s.overworld?.rumorNetwork;if(!state)return
 const d=rumorNetworkRules(w);if(!d)return
 const now=turnOf(w)
 state.pending.sort((a,b)=>a.due-b.due||(a.key<b.key?-1:a.key>b.key?1:0))
 while(state.pending[0]&&state.pending[0].due<=now){
  const packet=state.pending.shift()!,r=packet.rumor,root=r.relay?.root
  if(!root||!alive(w,r,packet.due)||state.seen[key(root,packet.to)]!==undefined||!sites(w).some(s=>s.id===packet.to))continue
  state.seen[key(root,packet.to)]=r.writtenAt;(state.towns[packet.to]??=[]).push(r)
  forward(w,packet.to,r,packet.due)
  state.pending.sort((a,b)=>a.due-b.due||(a.key<b.key?-1:a.key>b.key?1:0))
 }
 state.pending=state.pending.filter(p=>alive(w,p.rumor,now))
 for(const town of Object.keys(state.towns)){state.towns[town]=state.towns[town]!.filter(r=>alive(w,r,now));if(!state.towns[town]!.length)delete state.towns[town]}
 for(const records of [state.seen,state.sent])for(const[k,at]of Object.entries(records))if(now-at>=d.maxAgeDays*TURNS_PER_DAY)delete records[k]
}
export function hearTownRumors(w:World,listener:Creature,speaker:Creature):number{
 if(conversation(w,listener,speaker))return 0
 const site=resident(w,speaker),d=rumorNetworkRules(w);if(!site||!d)return 0
 let count=0
 for(const original of w.s.overworld?.rumorNetwork?.towns[site.id]??[]){
  if(!alive(w,original,turnOf(w))||rumorList(w,listener).some(r=>r.id===original.id&&(r.regionId??'Region.GreyCloister')===(original.regionId??'Region.GreyCloister')))continue
  const r=structuredClone(original);r.source+=' → '+speaker.name+'의 이야기'
  if(r.relay?.distortions.length&&rng(w,`world.rumorSuspicion.${key(String(listener.id),r.relay.root,site.id)}`).chance(Math.min(1,effectiveStat(w,listener,'per')*d.suspicionPerPer)))r.relay.suspected=rng(w,`world.rumorSuspicionField.${key(String(listener.id),r.relay.root,site.id)}`).pick(r.relay.distortions)
  if(!learnRumor(w,listener,r))continue
  count++;if(listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 정착지 소식을 들었다. '+rumorClaimText(w,r))
 }
 return count
}

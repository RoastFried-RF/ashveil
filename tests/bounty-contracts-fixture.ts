import {newGame,playerAct} from '../src/core/game'
import {player,tileAt,creatureAt,terrainAt,type World} from '../src/core/ctx'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {findPath} from '../src/core/path'
import {dirIndex,cheb} from '../src/core/geom'
import {initializeSettlement} from '../src/core/settlements'
import {marketFor} from '../src/core/economy'
import {bountyOffers,acceptBounty,isBounty} from '../src/core/bounty-contracts'
import {serialize,deserialize} from '../src/core/save'
import {db} from './helpers'
import type {Action} from '../src/core/actions'

const templates=new Map<string,string>()
function prepared(seed:string){
  const cached=templates.get(seed);if(cached)return deserialize(cached)
  const w:World={db,s:newGame(db,{seed,background:'Bg.Hunter',overworld:true})},s=w.s,p=player(w),m=s.overworld!,camp=s.map.waypoints!.reaverCamp
  p.traits=[]
  // 잠든 초기 야영지를 실제 이동으로 관찰한다. 기본AI를 바꾸지 않는다.
  for(const c of s.creatures)if(c.id!==p.id){c.asleep=true;c.needs.fatigue=100;c.nextAct=s.time+3*1200*100}
  const step=(goal:{x:number;y:number})=>{
    const next=findPath(w,p.pos,goal,{avoidCreatures:true,selfId:p.id})?.[0]
    if(!next)throw Error('actual initial camp/exit route unavailable')
    const error=playerAct(w,{type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)});if(error)throw Error(error)
  }
  for(let i=0;!tileAt(w,camp).observed&&i<150;i++)step(camp)
  if(!tileAt(w,camp).observed)throw Error('actual camp observation missing')
  const exit=s.map.exits[0];for(let i=0;cheb(p.pos,exit)>0&&i<200;i++)step(exit)
  if(cheb(p.pos,exit)>0)throw Error('actual exit walk incomplete')
  const left=playerAct(w,{type:'leave'});if(left)throw Error(left)
  const site=m.sites.find(site=>site.kind==='settlement'&&site.faction==='coalition')!
  // 별도의 초기 시장 위치다. 두 지역 사이 월드 이동을 실행했다고 주장하지 않는다.
  m.position={...site.cell};const existing=new Set(Object.keys(m.scenes)),entered=playerAct(w,{type:'enterRegion'});if(entered)throw Error(entered)
  for(const key of Object.keys(m.scenes))if(!existing.has(key))delete m.scenes[key]
  initializeSettlement(w)
  const trader=s.creatures.find(c=>c.traderSite===site.id);if(!trader)throw Error('actual generated settlement merchant missing')
  for(const c of s.creatures)if(c.id!==p.id)c.nextAct=s.time+1200*100
  const adjacent=()=>[{x:trader.pos.x-1,y:trader.pos.y},{x:trader.pos.x+1,y:trader.pos.y},{x:trader.pos.x,y:trader.pos.y-1},{x:trader.pos.x,y:trader.pos.y+1}].filter(pos=>terrainAt(w,pos).passable&&!creatureAt(w,pos)).sort((a,b)=>cheb(p.pos,a)-cheb(p.pos,b))[0]
  for(let i=0;cheb(p.pos,trader.pos)>1&&i<120;i++){const goal=adjacent();if(!goal)throw Error('actual merchant approach unavailable');step(goal)}
  updatePlayerVision(w,p);if(cheb(p.pos,trader.pos)>1)throw Error('actual merchant walk incomplete')
  // 검증용 초기 장부 잔액이다. 과거 거래/수입으로 벌었다고 주장하지 않는다.
  marketFor(w,trader)!.money=1000
  const template=serialize(s);templates.set(seed,template);return deserialize(template)
}
export function bountyContractsFixture(seed='bounty-contracts-actual'){
  const w:World={db,s:prepared(seed)},s=w.s,p=player(w),m=s.overworld!,trader=s.creatures.find(c=>c.traderSite===m.currentRegion)!,market=marketFor(w,trader)!,town={map:s.map,maps:s.maps,creatures:s.creatures,offCreatures:s.offCreatures,sources:s.sources,storyteller:s.storyteller,noiseEvents:s.noiseEvents,region:m.currentRegion!,pos:{...p.pos}}
  const act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
  const accept=()=>{const offer=bountyOffers(w,p,trader)[0];if(!offer)throw Error('observed actual camp bounty unavailable');const error=acceptBounty(w,p,trader,offer.id,offer.reward);if(error)throw Error(error);return m.contracts!.filter(isBounty).at(-1)!}
  const switchTo=(region:string,pos:{x:number;y:number})=>{
    const scene=m.scenes[region];if(!scene)throw Error('prepared original scene missing')
    m.scenes[m.currentRegion!]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c.id!==p.id),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents}
    delete m.scenes[region]
    s.map=scene.map;s.maps=scene.maps;s.creatures=[p,...scene.creatures];s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;m.currentRegion=region;m.position={...m.sites.find(site=>site.id===region)!.cell}
    p.mapId=s.map.id;p.pos={...pos};p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p)
  }
  const field=()=>{
    const scene=m.scenes['Region.GreyCloister'];if(!scene)throw Error('original observed camp scene missing')
    const camp=scene.map.waypoints!.reaverCamp
    switchTo('Region.GreyCloister',camp)
    for(const offset of [{x:-1,y:0},{x:1,y:0},{x:0,y:-1},{x:0,y:1}]){const pos={x:camp.x+offset.x,y:camp.y+offset.y};if(terrainAt(w,pos).passable&&!creatureAt(w,pos)){p.pos=pos;break}}
    updatePlayerVision(w,p)
    return s.creatures.filter(c=>s.sources![0].members!.includes(c.id))
  }
  const home=()=>switchTo(town.region,town.pos)
  return{w,s,p,m,trader,market,act,accept,field,home,town,switchTo}
}

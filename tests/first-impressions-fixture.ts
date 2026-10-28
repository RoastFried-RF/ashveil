import {newGame,playerAct} from '../src/core/game'
import {player,turnOf,type World} from '../src/core/ctx'
import {marketFor} from '../src/core/economy'
import {addToBag,makeItem} from '../src/core/items'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {findPath} from '../src/core/path'
import {cheb,DIRS} from '../src/core/geom'
import type {Creature} from '../src/core/types'
import {db} from './helpers'
const template=newGame(db,{seed:'first-impressions-real-town',overworld:true})
/** INITIAL preparation only: enter the real original settlement; retain every resident, stock and UID. */
export function firstImpressionsFixture(faction='coalition'){
 const w:World={db,s:structuredClone(template)},p=player(w),m=w.s.overworld!
 p.pos={...w.s.map.exits[0]};if(playerAct(w,{type:'leave'}))throw Error('actual leave')
 const site=m.sites.find(s=>s.kind==='settlement'&&s.faction===faction)!
 m.position={...site.cell};if(playerAct(w,{type:'enterRegion'}))throw Error('actual settlement entry')
 const trader=w.s.creatures.find(c=>c.traderSite)!,doctor=w.s.creatures.find(c=>c.clinicSite)!,guards=w.s.creatures.filter(c=>db.creature(c.def).ai==='guard'),guard=guards[0],other=guards[1]
 w.s.time=(Math.floor(turnOf(w)/28800)*28800+14400)*100;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0};syncRegionalWeather(w,true)
 for(const c of w.s.creatures){
  c.nextAct=w.s.time;c.age=undefined;c.effects=[];c.thoughts=[];c.traumas=[];c.body.wounds=[];c.body.missing=[];c.body.scars=undefined;c.body.blood=c.body.bloodMax;c.asleep=false;c.unconscious=false;c.hp=95
  Object.assign(c.needs,{kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,wetness:0,stress:0,protein:100,vitamin:100,hygiene:70,ash:0})
 }
 p.traits=[];p.background=undefined;p.abilities=[];p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.money=200;p.needs.hygiene=19
 p.pos={x:trader.pos.x-1,y:trader.pos.y};guard.pos={x:p.pos.x,y:p.pos.y+1};guard.home={...guard.pos};guard.ai.route=undefined
 const water=p.bag.find(i=>i.def==='Item.WaterBottle')??makeItem(w,'Item.WaterBottle')
 if(!p.bag.includes(water)&&addToBag(w,p,water))throw Error('original bottle placement')
 water.uses=5
 const extra=makeItem(w,'Item.WaterBottle');if(addToBag(w,p,extra))throw Error('second actual bottle')
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s:w.s,p,m,site,trader,doctor,guard,other,market:marketFor(w,trader)!,water:[water,extra]}
}

export function meetingStep(w:World,target:Creature){
 const p=player(w);if(cheb(p.pos,target.pos)<=1)return
 const path=findPath(w,p.pos,target.pos,{selfId:p.id,avoidCreatures:true})
 if(!path?.length)throw Error('actual route to original resident')
 const step=path[0],dir=DIRS.findIndex(d=>d.x===step.x-p.pos.x&&d.y===step.y-p.pos.y)
 return{type:'move' as const,dir}
}
export function approachResident(w:World,target:Creature){
 for(let i=0;i<40;i++){const action=meetingStep(w,target);if(!action)return;if(playerAct(w,action))throw Error('actual resident approach')}
 throw Error('resident approach budget')
}

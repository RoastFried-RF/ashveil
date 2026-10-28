/** Scavenger perception, exposed helpless eyes, finite food, low flight and ground rest. */
import type {Action} from './actions'
import {capacity,totalBleed} from './body'
import {attackPreyError,canReach} from './combat'
import {carcassFood,carrionError,splittableFood} from './carrion'
import {creatureAt,inBounds,rng,terrainAt,tileAt,turnOf,type World} from './ctx'
import {flightMoveError,flightReady,flightStep,landingError,seekLanding} from './flight'
import {canSee} from './fov'
import {gatherStockCount} from './gather-stock'
import {gatherFireError,gatherSeasonError} from './gather-state'
import {cheb,DIRS,type Pos} from './geom'
import {meleeWield} from './items'
import {nearbyWater} from './water'
import {animalBrowseError,animalFoodAllowed,wildlifeThreats,type WildlifeNavigation} from './wildlife'
import type {Creature,WildlifeRules} from './types'

function circle(w:World,c:Creature,goal:Pos,radius:number):Action|null{
 const candidates=DIRS.map((d,dir)=>({dir,p:{x:c.pos.x+d.x,y:c.pos.y+d.y}})).filter(row=>!flightMoveError(w,c,row.p)&&canSee(w,c,row.p))
 const cross=(p:Pos)=>(c.pos.x-goal.x)*(p.y-goal.y)-(c.pos.y-goal.y)*(p.x-goal.x)
 candidates.sort((a,b)=>Math.abs(cheb(a.p,goal)-radius)-Math.abs(cheb(b.p,goal)-radius)||cross(b.p)-cross(a.p)||a.dir-b.dir)
 return candidates[0]?{type:'fly',dir:candidates[0].dir}:null
}
function seenPositions(w:World,c:Creature,radius:number){
 const rows:Pos[]=[];for(let y=Math.max(0,c.pos.y-radius);y<=Math.min(w.s.map.h-1,c.pos.y+radius);y++)for(let x=Math.max(0,c.pos.x-radius);x<=Math.min(w.s.map.w-1,c.pos.x+radius);x++){const p={x,y};if(canSee(w,c,p))rows.push(p)}
 return rows.sort((a,b)=>cheb(a,c.pos)-cheb(b,c.pos)||a.y-b.y||a.x-b.x)
}
export function decideBird(w:World,c:Creature,rule:WildlifeRules,nav:WildlifeNavigation):Action{
 const scavenger=rule.scavenging;if(!scavenger||!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.3)return{type:'wait'}
 const turn=turnOf(w),state=c.wildlifeState??={},threats=wildlifeThreats(w,c,rule).filter(other=>!other.asleep&&!other.unconscious&&cheb(c.pos,other.pos)<=scavenger.fleeRadius),threat=threats[0]
 if(threat){
  c.ai.mode='flee';c.ai.target=threat.id
  if(c.flight){if(c.needs.energy<=4||c.flight.landAt-turn<=2)return seekLanding(w,c);return flightStep(w,c,threat.pos,true)??seekLanding(w,c)}
  if(flightReady(w,c)&&w.s.map.kind==='surface'&&!tileAt(w,c.pos).roof&&c.needs.energy>=8)return{type:'takeFlight'}
  return nav.away(threats)??{type:'wait'}
 }
 c.ai.mode='wander';c.ai.target=undefined
 const seen=w.s.creatures.filter(other=>other.id!==c.id&&w.db.body(other.body.def).kind!=='mechanical'&&cheb(other.pos,c.pos)<=scavenger.followRadius&&(!other.alive||other.unconscious||totalBleed(w,other,true)>3)&&canSee(w,c,other.pos)).sort((a,b)=>Number(b.unconscious)-Number(a.unconscious)||cheb(a.pos,c.pos)-cheb(b.pos,c.pos)||a.id-b.id)
 if(seen[0])state.interest={id:seen[0].id,pos:{...seen[0].pos},at:turn,alive:seen[0].alive,unconscious:!!seen[0].unconscious}
 if(state.interest&&turn-state.interest.at>scavenger.memoryTurns)delete state.interest
 const interest=state.interest,target=seen.find(other=>other.id===interest?.id),attack=meleeWield(w,c)?.atk,canPeck=!!target&&!!attack&&!attackPreyError(w,target,attack)
 const positions=seenPositions(w,c,rule.forageRadius),water=positions.find(p=>!!terrainAt(w,p).water||!!terrainAt(w,p).residentWell),food=positions.find(p=>{
  const t=tileAt(w,p),g=terrainAt(w,p).gather
  return t.items.some(i=>animalFoodAllowed(w,c,i)||splittableFood(w,c,i))||!!g&&rule.foodIds.includes(g.item)&&gatherStockCount(w,p)>0&&!gatherSeasonError(w,terrainAt(w,p))&&!gatherFireError(w,p)&&(t.gatherAt??0)<=turn
 }),corpse=seen.find(other=>!!carcassFood(w,c,other)),hungry=c.needs.kcal<rule.eatBelow,thirsty=c.needs.waterDeficit>=rule.drinkAbove
 if(c.flight){
  if(!flightReady(w,c)||c.needs.energy<=4||c.flight.landAt-turn<=3||c.needs.fatigue>=rule.sleepAt)return seekLanding(w,c)
  const goal=thirsty?water:canPeck?target!.pos:hungry?(food??corpse?.pos):undefined
  if(goal){if(cheb(c.pos,goal)<=1&&!landingError(w,c))return{type:'land'};return flightStep(w,c,goal)??seekLanding(w,c)}
  if(interest){const radius=interest.alive&&!interest.unconscious?Math.max(scavenger.circleRadius,scavenger.fleeRadius+1):scavenger.circleRadius;return circle(w,c,interest.pos,radius)??seekLanding(w,c)}
  return seekLanding(w,c)
 }
 if(canPeck&&canReach(w,c,target!)){c.ai.mode='hunt';c.ai.target=target!.id;return{type:'attack',target:target!.id}}
 if(thirsty&&nearbyWater(w,c))return{type:'animalDrink'}
 if(hungry){
  const own=tileAt(w,c.pos).items.find(i=>animalFoodAllowed(w,c,i));if(own)return{type:'animalEat',uid:own.uid}
  const tear=tileAt(w,c.pos).items.find(i=>splittableFood(w,c,i));if(tear)return{type:'tearFood',uid:tear.uid}
  const local=[c.pos,...DIRS.map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y}))].find(p=>inBounds(w,p)&&!animalBrowseError(w,c,p));if(local){if(cheb(c.pos,local)>0&&terrainAt(w,local).passable){const step=nav.toward(local);if(step)return step}return{type:'animalBrowse',pos:local}}
  if(corpse&&!carrionError(w,c,corpse))return{type:'tearCarrion',target:corpse.id}
 }
 if(c.needs.fatigue>=rule.sleepAt)return{type:'sleep'}
 const goal=thirsty?water:canPeck?target!.pos:hungry?(food??corpse?.pos):undefined
 if(goal){if(cheb(c.pos,goal)>3&&flightReady(w,c)&&w.s.map.kind==='surface'&&!tileAt(w,c.pos).roof&&c.needs.energy>=8)return{type:'takeFlight'};return nav.toward(goal)??{type:'wait'}}
 if(interest&&flightReady(w,c)&&w.s.map.kind==='surface'&&!tileAt(w,c.pos).roof&&c.needs.energy>=10)return{type:'takeFlight'}
 if(c.home&&cheb(c.pos,c.home)>rule.homeRadius)return nav.toward(c.home)??{type:'wait'}
 const random=rng(w,`ai.wildlife.${c.id}`)
 if(random.chance(rule.wanderChance)){const from=c.home??c.pos,p={x:Math.max(1,Math.min(w.s.map.w-2,from.x+random.int(-rule.homeRadius,rule.homeRadius))),y:Math.max(1,Math.min(w.s.map.h-2,from.y+random.int(-rule.homeRadius,rule.homeRadius)))};if(!creatureAt(w,p))return nav.toward(p)??{type:'wait'}}
 return{type:'wait'}
}

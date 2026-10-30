// Actual owned clothes, visible heat sources and ordinary movement/rest; no instant cooling.
import{creatureAt,inBounds,player,terrainAt,type World}from'./ctx'
import{projectThermalState,type ThermalActivity,type ThermalState}from'./thermal'
import{itemDef,equipError,equipDisplacements,unequipError}from'./items'
import{clothingRemoveSlots}from'./lining-state'
import{residentWarmthDef}from'./resident-warmth'
import{canSee,hasLos}from'./fov'
import{cheb,type Pos}from'./geom'
import{findPath}from'./path'
import{knownFireDanger}from'./fire-avoidance'
import{activeEscort}from'./escort-contracts'
import{hostileAware}from'./action-time'
import type{Action}from'./actions'
import type{Creature,Slot}from'./types'

const deviation=(q:ThermalState)=>Math.max(q.low-q.feels,q.feels-q.high,0)
/** Suggest a normal swap/removal, including all lining displaced by removing an outer garment. */
export function ownedThermalClothingAction(w:World,c:Creature,pos:Pos,activity:ThermalActivity,minimum=.5):Action|undefined{
 if(c.activity||c.workJob||c.asleep||c.unconscious||c.captivity||c.companion||c.rescue||c.breakdown)return
 const score=(actor:Creature)=>deviation(projectThermalState(w,actor,activity,pos)),current=score(c),choices:{action:Action;uid:number;improvement:number}[]=[]
 if(current<minimum)return
 for(const it of c.bag){
  const d=itemDef(w,it),slot=d.slot as Slot|undefined
  if(d.category!=='apparel'||!d.apparel||!slot||d.slot==='ring'||it.count!==1||equipError(w,c,it.uid,slot))continue
  const equip={...c.equip};for(const old of equipDisplacements(w,c,it,slot))delete equip[old.slot];equip[slot]=it
  const improvement=current-score({...c,equip});if(improvement>=minimum)choices.push({action:{type:'equip',uid:it.uid,slot},uid:it.uid,improvement})
 }
 for(const slot of Object.keys(c.equip)as Slot[]){
  const it=c.equip[slot];if(!it||itemDef(w,it).category!=='apparel'||!itemDef(w,it).apparel||unequipError(w,c,slot))continue
  const equip={...c.equip};for(const removed of clothingRemoveSlots(c,slot))delete equip[removed]
  const improvement=current-score({...c,equip});if(improvement>=minimum)choices.push({action:{type:'unequip',slot},uid:it.uid,improvement})
 }
 choices.sort((a,b)=>b.improvement-a.improvement||a.uid-b.uid)
 return choices[0]?.action
}
export function residentCoolingDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const rule=residentWarmthDef(w)?.cooling
 if(!rule||c.needs.bodyTemp<rule.at||w.s.map.kind!=='surface'||c===player(w)||!w.s.creatures.includes(c)||!c.alive||c.asleep||c.unconscious||c.activity||c.captivity||c.companion||c.rescue||c.breakdown||c.roadRaid||c.caravan||c.abduction||!c.home||!inBounds(w,c.home)||!inBounds(w,c.pos)||!c.residentSite||c.residentSite!==w.s.overworld?.currentRegion||c.mapId!==undefined&&c.mapId!==w.s.map.id||c.body.machine||w.db.body(c.body.def).kind!=='humanoid'||!rule.factions.includes(c.faction)||!rule.roles.includes(w.db.creature(c.def).ai)||c.ai.task||c.ai.route?.length||c.ai.target||['hunt','flee','surrender','patrol','return'].includes(c.ai.mode)||activeEscort(w,c)||hostileAware(w,c))return null
 const current=projectThermalState(w,c,'rest'),clothes=ownedThermalClothingAction(w,c,c.pos,'rest',rule.minimumImprovement)
 if(clothes)return{action:clothes}
 if(current.feels<=current.high)return(current.fever??37)>=rule.at?null:{action:{type:'rest',turns:rule.restTurns}}
 // A visible destination does not grant knowledge of an unseen heat source behind a corner.
 const known:World={db:w.db,s:{...w.s,map:{...w.s.map,lights:w.s.map.lights.filter(l=>canSee(w,c,l.pos)&&hasLos(w,c.pos,l.pos))}}},danger=knownFireDanger(w,c),candidates=[]
 for(let y=c.pos.y-rule.radius;y<=c.pos.y+rule.radius;y++)for(let x=c.pos.x-rule.radius;x<=c.pos.x+rule.radius;x++){
  const pos={x,y};if(!inBounds(w,pos)||cheb(c.pos,pos)===0||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||creatureAt(w,pos)||danger.has(y*w.s.map.w+x))continue
  const t=terrainAt(w,pos);if(!t.passable||t.water||t.bedding||t.stairs||t.container||t.station||t.cultivation)continue
  const future=projectThermalState(known,c,'rest',pos),score=deviation(future)
  if(deviation(current)-score>=rule.minimumImprovement)candidates.push({pos,score})
 }
 candidates.sort((a,b)=>a.score-b.score||cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)
 const reachable=candidates.filter(choice=>findPath(w,c.pos,choice.pos,{avoidCreatures:true,selfId:c.id,maxNodes:1200,avoidCells:danger}))
 if(reachable[0]?.score===0)return{goal:reachable[0].pos}
 // Residents know the public courtyard's address, but inspect its current state only on seeing it.
 for(const place of rule.places??[]){
  if(place.site!==c.residentSite||place.map!==w.s.map.id)continue
  const pos={x:place.pos[0],y:place.pos[1]};if(!inBounds(w,pos)||cheb(c.pos,pos)===0)continue
  if(!canSee(w,c,pos)||!hasLos(w,c.pos,pos))return{goal:pos}
  const choice=reachable.find(q=>q.pos.x===pos.x&&q.pos.y===pos.y);if(choice)return{goal:pos}
 }
 if(reachable[0])return{goal:reachable[0].pos}
 return null
}

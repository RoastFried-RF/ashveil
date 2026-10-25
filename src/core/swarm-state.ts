/** Read-only colony geometry and exposure. Bodies/individual anatomy are deliberately absent. */
import {cheb,type Pos} from './geom'
import {hasLos} from './fov'
import {turnOf,type World} from './ctx'
import type {Creature,SwarmDef,SwarmState} from './types'
export const swarmDef=(w:World,s:SwarmState)=>w.db.tryGet<SwarmDef>(s.def)
const signatures=new WeakMap<SwarmDef,string>()
export function swarmSignature(d:SwarmDef){let key=signatures.get(d);if(!key){key=JSON.stringify([d.moveTU,d.attractionRadiusMult,d.coverRadius,d.sightMult,d.activeDaylightMax,d.disperseTurns,d.ashPerTurn,d.coughEvery,d.minCoughDose,d.snuffChance,[...d.snuffItems].sort(),[...d.burnKinds].sort(),d.burnMembersPerTurn,d.captureMembers,d.captureTool,d.bodyItem,d.studyTU]);signatures.set(d,key)}return key}
export function validSwarmRule(w:World,s:SwarmState){const d=swarmDef(w,s);return d?.defType==='Swarm'&&swarmSignature(d)===s.rule?d:undefined}
export const swarmStrength=(s:SwarmState)=>s.initialMembers>0?Math.max(0,Math.min(1,s.members/s.initialMembers*s.cohesion/100)):0
export const swarmDensity=(s:SwarmState)=>s.initialMembers>0?s.members>0&&s.cohesion>0?Math.max(1,Math.round(100*s.members/s.initialMembers*s.cohesion/100)):0:0
export function coveringSwarms(w:World,p:Pos){return(w.s.map.swarms??[]).filter(s=>{const d=validSwarmRule(w,s);return !!d&&swarmDensity(s)>0&&cheb(s.pos,p)<=d.coverRadius&&hasLos(w,s.pos,p)})}
export function swarmSightMultiplier(w:World,c:Creature){if(c.aquatic?.submerged)return 1;return coveringSwarms(w,c.pos).reduce((n,s)=>Math.min(n,1-(1-swarmDef(w,s)!.sightMult)*swarmStrength(s)),1)}
export function pauseSwarmClock(map:World['s']['map'],elapsed:number){if(elapsed<=0)return;for(const s of map.swarms??[]){s.nextMoveAt+=elapsed*100;s.lastTick+=elapsed;if(s.lostLightAt!==undefined)s.lostLightAt+=elapsed;if(s.disperseAt!==undefined)s.disperseAt+=elapsed}}
export function swarmObservation(w:World,s:SwarmState){const d=swarmDef(w,s);if(!d)return[];return[d.label,swarmDensity(s)>0?'날개가 빛 주변을 덮는다 · 불을 끄거나 다른 불로 유도할 수 있다':'흩어진 군체',`관찰 ${turnOf(w)}턴 · 신체 부위 없음`]}

export function swarmAshDose(w:World,c:Creature){return c.aquatic?.submerged?0:coveringSwarms(w,c.pos).reduce((n,s)=>n+validSwarmRule(w,s)!.ashPerTurn*swarmStrength(s),0)}

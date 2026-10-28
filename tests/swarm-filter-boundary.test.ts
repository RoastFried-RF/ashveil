import {expect,it} from 'vitest'
import {playerAct} from '../src/core/game'
import {createSwarm} from '../src/core/swarms'
import {makeItem} from '../src/core/items'
import {invalidateLights} from '../src/core/fov'
import {inhaledAsh} from '../src/core/air-state'
import {tileAt,turnOf} from '../src/core/ctx'
import {prisonerFixture} from './prisoner-fixture'

it.each([
 {wet:false,uses:1,dose:.0002,cough:false},
 {wet:true,uses:1,dose:.0016,cough:true},
 {wet:false,uses:0,dose:.002,cough:true},
])('a real wait uses the current filter for both dose and cough: $wet/$uses',({wet,uses,dose,cough})=>{
 const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.creatures=[p];s.map.kind='dungeon';s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
 s.time=(Math.ceil(turnOf(w)/10)*10-1)*100;p.nextAct=s.time;s.log=[];s.noiseEvents=[];p.body.inhaledAsh=0
 tileAt(w,p.pos).t='Terrain.Earth'
 const mask=makeItem(w,'Item.AshMask'),lamp=makeItem(w,'Item.Lantern');mask.uses=uses;if(wet)mask.wetness={head:100};lamp.lit=true;p.equip.neck=mask;p.equip.off=lamp
 const colony=createSwarm(w,'Swarm.Ashmoth',p.pos);colony.cohesion=100;s.map.swarms=[colony];invalidateLights(w)
 expect(playerAct(w,{type:'wait'})).toBeNull()
 expect(inhaledAsh(p)).toBeCloseTo(dose,6);expect(mask.uses).toBe(0)
 expect(s.log.some(row=>row.text.startsWith('날개 가루에 기침'))).toBe(cough)
 expect(s.noiseEvents.some(e=>e.source===p.id&&e.radius===5)).toBe(cough)
})

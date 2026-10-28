import {it,expect} from 'vitest'
import {perform} from '../src/core/actions'
import {aiDecide} from '../src/core/ai'
import {resolveAttack} from '../src/core/combat'
import {turnOf} from '../src/core/ctx'
import {invalidateLights} from '../src/core/fov'
import {gardenAlertState} from '../src/core/garden-alert'
import {SAVE_VERSION} from '../src/core/game'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {observeSowerAssault} from '../src/core/sower-state'
import {sowerFixture} from './sower-fixture'
it('a genuinely resolved missed melee attack causes one paid alarm even though it creates no wound',()=>{
 const {w,s,p,sower}=sowerFixture();p.pos={x:47,y:15};p.stats.agi=1;p.stats.str=1;sower.stats.agi=100;invalidateLights(w)
 const hit=resolveAttack(w,p,sower);expect(hit.hit).toBe(false);expect(sower.body.wounds).toEqual([]);const assault=sower.sowerState!.assault!;expect(assault.seen).toEqual({id:p.id,pos:{x:47,y:15}})
 const action=aiDecide(w,sower);expect(action).toEqual({type:'sowerAlarm',attack:assault.serial,target:p.id});const power=sower.body.machine!.power;expect(perform(w,sower,action)).toEqual({ok:true,tu:100});expect(sower.body.machine!.power).toBeLessThan(power);expect(gardenAlertState(w)!.level).toBe(1)
 const hash=stateHash(s);expect(perform(w,sower,action).ok).toBe(false);expect(stateHash(s)).toBe(hash);expect(aiDecide(w,sower).type).toBe('sowerSpray')
})
it('an assault perception event from beyond its sensors retains no attacker ID or hidden position, and its alarm reports only the original machine',()=>{
 const {w,s,p,sower}=sowerFixture();p.pos={x:20,y:14};invalidateLights(w);observeSowerAssault(w,p,sower)
 expect(sower.sowerState!.assault).toEqual({serial:1,at:turnOf(w)});const action=aiDecide(w,sower);expect(action).toEqual({type:'sowerAlarm',attack:1});expect(perform(w,sower,action).ok).toBe(true)
 const event=gardenAlertState(w)!.events[0];expect(event).toMatchObject({kind:'attack',source:sower.id,sourcePos:{x:47,y:14},level:1});expect(event.target).toBeUndefined();expect(event.targetPos).toBeUndefined();const hash=stateHash(s);expect(perform(w,sower,action).ok).toBe(false);expect(stateHash(s)).toBe(hash)
})
it('a seen assault records its original observed position and never reads the attackers hidden current position to populate the report',()=>{
 const {w,p,sower}=sowerFixture();p.pos={x:47,y:15};invalidateLights(w);observeSowerAssault(w,p,sower);p.pos={x:20,y:14};invalidateLights(w)
 const action=aiDecide(w,sower);expect(action).toEqual({type:'sowerAlarm',attack:1,target:p.id});expect(perform(w,sower,action).ok).toBe(true);expect(gardenAlertState(w)!.events[0].targetPos).toEqual({x:47,y:15})
})
it('serialized pending assault evidence survives exactly, while an old episode expires and a powerless sensor gains no invented observation',()=>{
 const {w,s,p,sower}=sowerFixture();p.pos={x:47,y:15};invalidateLights(w);observeSowerAssault(w,p,sower);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const c=run.s.creatures.find(c=>c.id===sower.id)!;const action=aiDecide(run,c);expect(action.type).toBe('sowerAlarm');expect(perform(run,c,action).ok).toBe(true)}expect(stateHash(restored.s)).toBe(stateHash(s))
 const first=sower.sowerState!.assault!.serial;sower.body.machine!.power=0;observeSowerAssault(w,p,sower);expect(sower.sowerState!.assault!.serial).toBe(first);sower.body.machine!.power=100;s.time+=6100;const oldHash=stateHash(s);expect(perform(w,sower,{type:'sowerAlarm',attack:first+1}).ok).toBe(false);expect(stateHash(s)).toBe(oldHash)
})
it('the prior213 save migrates without inventing attacks, inventory or signal history',()=>{
 const {s,sower}=sowerFixture(),before=stateHash(s),raw=JSON.parse(serialize(s));raw.version=213;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect(stateHash(restored)).toBe(before);expect(restored.creatures.find(c=>c.id===sower.id)!.sowerState).toBeUndefined()
})

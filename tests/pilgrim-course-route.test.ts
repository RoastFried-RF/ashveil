import{describe,it,expect}from'vitest'
import{pilgrimFieldsFixture}from'./pilgrim-fields-fixture'
import{approachCourseDestination}from'../tools/pilgrim-course-route'
import{perform,type Action}from'../src/core/actions'
import{playerAct}from'../src/core/game'
import{player,turnOf,terrainAt,tileAt,type World}from'../src/core/ctx'
import{cheb}from'../src/core/geom'
import{serialize,deserialize}from'../src/core/save'
import{updatePlayerVision}from'../src/core/fov'

describe('finite observer approaches through an actually occupied doorway',()=>{
 it('waits through more than80 blocked inputs without teleporting, changing the blocker or losing exact saved continuation',()=>{
  const d=pilgrimFieldsFixture(),{w,p,c}=d,target=w.s.map.residentHearth!.pos
  p.pos={x:31,y:23};c.pos={x:32,y:22};tileAt(w,c.pos).t='Terrain.DoorOpen';expect(terrainAt(w,c.pos).door).toBe('open');expect(perform(w,c,{type:'rest',turns:200}).ok).toBe(true);c.nextAct=w.s.time;updatePlayerVision(w,p)
  const copy:World={db:w.db,s:deserialize(serialize(w.s))},start=turnOf(w),uid=c.id
  const run=(world:World)=>{let blocked=0;const act=(a:Action)=>{const error=playerAct(world,a);if(error==='길이 막혔다'&&a.type==='move'){blocked++;expect(playerAct(world,{type:'wait'})).toBeNull()}else expect(error).toBeNull()};const result=approachCourseDestination(world,target,act);return{...result,blocked}}
  const original=run(w),continued=run(copy)
  expect(original.blocked).toBeGreaterThan(80);expect(original.walked).toBeLessThanOrEqual(80);expect(original.attempts).toBeLessThanOrEqual(1280);expect(turnOf(w)-start).toBeGreaterThan(80);expect(cheb(player(w).pos,target)).toBeLessThanOrEqual(1);expect(w.s.creatures.find(c=>c.id===uid)?.alive).toBe(true);expect(continued).toEqual(original);expect(serialize(copy.s)).toBe(serialize(w.s))
 },60000)
})

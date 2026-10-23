import {describe,it,expect} from 'vitest'
import {advancePose,clearPoses,createPoseClock,motionDurations,poseFrame,requestPose} from '../src/client/render/character-motion'

describe('character presentation timing',()=>{
 it('uses a deliberate walking cadence with both alternating foot contacts',()=>{
  expect(motionDurations.walk).toBe(720)
  expect([0,.25,.5,.75].map(t=>poseFrame(12,t,true))).toEqual([0,3,6,9])
  expect(poseFrame(12,1,true)).toBe(0)
  expect(poseFrame(8,1)).toBe(7)
 })
 it('damage interrupts the swing and discards queued actions instead of resuming stale work',()=>{
  const clock=createPoseClock();requestPose(clock,'attack');requestPose(clock,'attack');advancePose(clock,70);requestPose(clock,'hurt')
  expect(clock.current?.kind).toBe('hurt');expect(clock.queue).toEqual([])
  for(let i=0;i<4;i++)advancePose(clock,80)
  expect(clock.current).toBeNull()
 })
 it('a cosmetic item-use request cannot suppress a defensive reaction',()=>{
  const clock=createPoseClock();requestPose(clock,'block');advancePose(clock,60);requestPose(clock,'use','ration')
  expect(clock.current).toEqual({kind:'block',elapsed:60,prop:undefined})
 })
 it('burst attacks have a bounded queue and retain time left over at a clip boundary',()=>{
  const clock=createPoseClock();for(let i=0;i<20;i++)requestPose(clock,'attack')
  expect(clock.queue).toHaveLength(2)
  for(let i=0;i<5;i++)advancePose(clock,90)
  advancePose(clock,60)
  expect(clock.current?.elapsed).toBe(30);expect(clock.queue).toHaveLength(1)
 })
 it('repeated work observations do not restart at the first image',()=>{
  const clock=createPoseClock();requestPose(clock,'work');advancePose(clock,90);requestPose(clock,'work')
  expect(clock.current?.elapsed).toBe(90)
 })
 it('a new physical interaction replaces a different unfinished utility pose',()=>{
  const clock=createPoseClock();requestPose(clock,'use','food');advancePose(clock,80);requestPose(clock,'interact','rope')
  expect(clock.current).toEqual({kind:'interact',elapsed:0,prop:'rope'});expect(clock.queue).toEqual([])
 })
 it('disabled animation clears all pending poses and props immediately',()=>{
  const clock=createPoseClock();requestPose(clock,'shoot');requestPose(clock,'shoot');advancePose(clock,16,true)
  expect(clock).toEqual(createPoseClock());requestPose(clock,'use','water');clearPoses(clock);expect(clock.current).toBeNull()
 })
 it('reverses a half-finished crouch without restarting from an endpoint',()=>{
  const clock=createPoseClock();requestPose(clock,'crouchDown');advancePose(clock,72)
  const before=poseFrame(3,clock.current!.elapsed/motionDurations.crouchDown)
  requestPose(clock,'stand')
  expect(clock.current?.kind).toBe('stand');expect(2-poseFrame(3,clock.current!.elapsed/motionDurations.stand)).toBe(before);expect(clock.queue).toEqual([])
 })
})

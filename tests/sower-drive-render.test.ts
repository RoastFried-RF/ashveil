import{describe,it,expect}from'vitest'
import{Texture}from'pixi.js'
import{ArticulatedGait,SOWER_DRIVE_OWNERS,type RigDriveStates}from'../src/client/render/articulated-gait'
import{ArticulatedRigView,type RigArt}from'../src/client/render/articulated-rig-view'
import{sowerDriveState}from'../src/client/render/sower-drive-state'
import{RigOwner}from'../src/client/render/rig-owner'
import type{RigSpec}from'../src/client/render/rig-spec'
import sprites from'../src/client/sprites.json'
import{createCreature}from'../src/core/creatures'
import{stateHash}from'../src/core/save'
import{makeWorld}from'./helpers'

const failed:RigDriveStates={LF:{present:true,efficiency:0,damage:1}}
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)

describe('actual Sower drive presentation',()=>{
 it('reads actual damage and anatomical presence without advancing Core or random streams',()=>{
  const w=makeWorld('sower-drive-readonly'),c=createCreature(w,'Creature.Sower',{x:5,y:5});w.s.creatures.push(c)
  expect(SOWER_DRIVE_OWNERS).toEqual({LF:'DriveLeg1',RF:'DriveLeg2',LH:'DriveLeg3',RH:'DriveLeg4'})
  c.body.organDamage={DriveLeg1:c.body.maxHp.DriveLeg1}
  // Compatibility anatomy input; active Sower drives have detach:false, so this is
  // not claimed to be a normal combat severing route.
  c.body.missing.push('DriveLeg4')
  const before=stateHash(w.s),snapshot=sowerDriveState(w,c)!
  expect(snapshot.LF).toMatchObject({present:true,efficiency:0,damage:1})
  expect(snapshot.RH).toMatchObject({present:false,efficiency:0})
  expect(snapshot.RF).toMatchObject({present:true,efficiency:1,damage:0})
  expect(stateHash(w.s)).toBe(before)
  expect(sowerDriveState(w,w.s.creatures.find(p=>p.id===w.s.playerId)!)).toBeUndefined()
 })
 it('keeps an attached failed drive folded without planting, swinging, or moving intact stance anchors',()=>{
  const gait=new ArticulatedGait();let prior=gait.update({x:0,y:0},0,failed),root={x:0,y:0};const start={...prior.legs.find(l=>l.id==='LF')!.sole}
  for(let i=0;i<160;i++){
   root={x:root.x+.08,y:root.y+.08};const pose=gait.update(root,.016,failed),leg=pose.legs.find(l=>l.id==='LF')!
   expect(leg).toMatchObject({present:true,disabled:true,contact:false,efficiency:0})
   expect(pose.swing).not.toBe('LF');expect(pose.root).toEqual(root)
   for(const l of pose.legs){const old=prior.legs.find(o=>o.id===l.id)!;if(l.contact&&old.contact)expect(distance(l.sole,old.sole)).toBe(0);expect(Number.isFinite(l.error)).toBe(true)}
   prior=pose
  }
  expect(distance(prior.legs.find(l=>l.id==='LF')!.sole,start)).toBeGreaterThan(1)
 })
 it('interrupts a failed swinging drive, freezes at zero time, and gives a repaired drive a new contact',()=>{
  const gait=new ArticulatedGait(),point={x:0,y:.1};const first=gait.update(point,.01),id=first.swing!
  expect(id).not.toBeNull();const state:RigDriveStates={[id]:{present:true,efficiency:0,damage:1}},stopped=gait.update(point,0,state)
  expect(stopped.swing).toBeNull();expect(stopped.legs.find(l=>l.id===id)?.contact).toBe(false)
  expect(gait.update(point,0,state)).toEqual(stopped)
  const restored=gait.update(point,0,{});expect(restored.legs.find(l=>l.id===id)).toMatchObject({present:true,disabled:false,contact:true})
  const fixed=restored.legs.find(l=>l.id===id)!.sole;expect(gait.update(point,0,{}).legs.find(l=>l.id===id)!.sole).toEqual(fixed)
 })
 it('reports no invented support polygon when all four drives are disabled while retaining finite geometry',()=>{
  const gait=new ArticulatedGait(),states=Object.fromEntries(Object.keys(SOWER_DRIVE_OWNERS).map(id=>[id,{present:true,efficiency:0,damage:1}]))
  const p=gait.update({x:0,y:0},0,states)
  expect(p.swing).toBeNull();expect(p.supportContacts).toBe(0);expect(p.supportHullAvailable).toBe(false);expect(p.supportMargin).toBe(-Infinity)
  for(const l of p.legs){expect(l.contact).toBe(false);for(const v of[l.hip,l.knee,l.ankle,l.sole])expect(Object.values(v).every(Number.isFinite)).toBe(true)}
 })
 it('hides only missing borrowed drive sprites while preserving attached failed parts and texture lifetime',()=>{
  const art:RigArt={textures:{body:Texture.EMPTY,upper:Texture.EMPTY,lower:Texture.EMPTY,foot:Texture.EMPTY},body:{pivot:{x:0,y:0},scale:1},upper:{proximal:{x:0,y:0},distal:{x:0,y:1},thickness:1},lower:{proximal:{x:0,y:0},distal:{x:0,y:1},thickness:1},foot:{ankle:{x:0,y:0},scale:1}}
  const view=new ArticulatedRigView(art),gait=new ArticulatedGait(),states:RigDriveStates={...failed,RH:{present:false,efficiency:0,damage:0}}
  try{view.update(gait.update({x:0,y:0},0,states));const shown=view.inspect();expect(shown.legs.LF).toMatchObject({present:true,disabled:true,visible:true,contact:false});expect(shown.legs.RH).toMatchObject({present:false,visible:false,contact:false});expect(shown.legs.RF).toMatchObject({present:true,visible:true});expect(shown.sourceCount).toBe(1)}finally{view.destroy()}
  expect(Texture.EMPTY.destroyed).toBe(false)
 })
 it('keeps each authored facing and work chassis when drive ownership changes',()=>{
  const spec=sprites.chars.av331_sower.rig as unknown as RigSpec,owner=new RigOwner(spec)
  try{for(const direction of['down','left','right','up']as const){const point={x:12,y:23};owner.update(direction,point,.5,0,true,failed);const result=owner.inspect()!;expect(result.direction).toBe(direction);expect(result.frame).toBe(spec.directions[direction].work[Math.floor(spec.directions[direction].work.length*.5)].frame);expect(result.pose.root.x).toBe(point.x);expect(result.pose.root.y*Math.SQRT1_2).toBeCloseTo(point.y,10);expect(result.display.legs.LF).toMatchObject({disabled:true,visible:true,contact:false});expect(result.display.legs.RF.visible).toBe(true)}}finally{owner.destroy()}
 })
})

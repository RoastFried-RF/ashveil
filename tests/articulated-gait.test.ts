import {describe,it,expect} from 'vitest'
import {ArticulatedGait,solveTwoLink,pinMatrix,supportMargin,RIG,type Point} from '../src/client/render/articulated-gait'
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
describe('client articulated rig experiment',()=>{
 it('keeps the two physical links constant and reports unreachable endpoints honestly',()=>{
  for(const ankle of[{x:9,y:3,z:5},{x:0,y:0,z:4},{x:2,y:-7,z:6}]){
   const solved=solveTwoLink({x:0,y:0,z:30},ankle,17,17,{x:1,y:0,z:0})
   expect(distance(solved.hip,solved.knee)).toBeCloseTo(17,8);expect(distance(solved.knee,solved.ankle)).toBeCloseTo(17,8);expect(solved.error).toBeLessThan(1e-7)
  }
  const far=solveTwoLink({x:0,y:0,z:0},{x:100,y:0,z:0},17,17,{x:1,y:0,z:0})
  expect(far.unreachable).toBe(true);expect(far.error).toBeGreaterThan(65);expect(Number.isFinite(far.knee.y)).toBe(true)
 })
 it('maps offset source pin centres exactly without assuming vertical artwork',()=>{
  const a={x:55,y:83},b={x:72,y:451},c={x:-12,y:3},d={x:5,y:-9},m=pinMatrix(a,b,c,d,.028)
  const transform=(p:Point)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f})
  expect(transform(a).x).toBeCloseTo(c.x,10);expect(transform(a).y).toBeCloseTo(c.y,10);expect(transform(b).x).toBeCloseTo(d.x,10);expect(transform(b).y).toBeCloseTo(d.y,10)
 })
 it('keeps planted world feet stationary, advances exactly one swing and settles without root drift',()=>{
  const rig=new ArticulatedGait();let previous=rig.pose(),root={x:0,y:0};const swung=new Set<string>()
  for(let i=0;i<600;i++){
   root={x:0,y:root.y+.12};const p=rig.update(root,.012)
   expect(p.legs.filter(l=>l.contact).length).toBeGreaterThanOrEqual(3)
   for(const l of p.legs){const old=previous.legs.find(o=>o.id===l.id)!;if(l.contact&&old.contact)expect(distance(l.sole,old.sole)).toBe(0);expect(l.error).toBeLessThan(1e-5)}
   expect(p.supportMargin).toBeGreaterThanOrEqual(-1e-7);if(p.swing)swung.add(p.swing);previous=p
  }
  expect(swung.size).toBe(4);expect(previous.distance).toBeCloseTo(72,6)
  for(let i=0;i<60;i++)previous=rig.update(root,1/60)
  expect(previous.swing).toBe(null);expect(previous.root).toEqual(root)
  const fixed=previous.legs.map(l=>l.sole)
  expect(rig.update(root,2).legs.map(l=>l.sole)).toEqual(fixed)
 })
 it('does not advance the gait with a stationary clock or share mutable observations',()=>{
  const rig=new ArticulatedGait(),start=rig.pose();rig.update({x:0,y:0},10)
  expect(rig.pose().legs).toEqual(start.legs);const p=rig.pose();p.legs[0].sole.x=999
  expect(rig.pose().legs[0].sole.x).not.toBe(999)
  expect(()=>rig.update({x:100,y:0},.1)).toThrow('순간 이동');expect(()=>rig.update({x:NaN,y:0},.1)).toThrow('유한')
 })
 it('reports support outside the triangle instead of hiding it',()=>{
  expect(supportMargin([{x:0,y:0},{x:10,y:0},{x:0,y:10}],{x:2,y:2})).toBeGreaterThan(0)
  expect(supportMargin([{x:0,y:0},{x:10,y:0},{x:0,y:10}],{x:8,y:8})).toBeLessThan(0)
  expect(RIG.stride).toBe(20)
 })
})

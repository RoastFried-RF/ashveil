import { describe, expect, it } from 'vitest'
import { humanArt, humanModels } from '../src/client/render/human-art'
import { humanDirections, humanSpecFrameKeys } from '../src/client/render/human-spec'
import { humanReplacementPieces, humanReplacementView } from '../src/client/render/human-prosthetics'
import manifest from '../src/client/sprites.json'
import { db } from './helpers'
import type { ProstheticDef } from '../src/core/types'
import { humanPose,hTransform } from '../src/client/render/human-model'
import type { HumanSource } from '../src/client/render/human-spec'

describe('원문 방향/관절을 가진 실제 의수족',()=>{
 it('모든6종·허용28장착 부위를4방향으로 해석하고 원래 장착점의 자손만 그린다',()=>{
  let targets=0
  for(const def of db.all<ProstheticDef>('Prosthetic')){
   targets+=def.targets.length
   for(const direction of humanDirections)for(const root of def.targets){
    const view=humanReplacementView(humanArt,def.id,direction)
    expect(view,def.id+' '+direction).toBeDefined()
    const pieces=humanReplacementPieces(root,view!)
    expect(pieces.length).toBeGreaterThan(0)
    expect(pieces[0].owner).toBe(root)
    expect(new Set(pieces.map(p=>p.owner)).size).toBe(pieces.length)
    expect(pieces.every(p=>p.owner.startsWith(root.startsWith('Right')?'Right':'Left'))).toBe(true)
    for(const p of pieces)expect(manifest.frames).toHaveProperty(p.source.frame)
   }
  }
  expect(targets).toBe(28)
 })
 it('손/발 단독 장착은 위쪽 팔/다리를 되살리지 않고 전체 이식지는 실제 관절3개를 쓴다',()=>{
  const arm=humanReplacementView(humanArt,'Prosthetic.GardenerLimb','left')!
  expect(humanReplacementPieces('LeftUpperArm',arm).map(p=>p.owner)).toEqual(['LeftUpperArm','LeftForearm','LeftHand'])
  expect(humanReplacementPieces('LeftHand',arm).map(p=>p.owner)).toEqual(['LeftHand'])
  expect(humanReplacementPieces('RightThigh',arm).map(p=>p.owner)).toEqual(['RightThigh','RightShin','RightFoot'])
  expect(humanReplacementPieces('RightFoot',arm).map(p=>p.owner)).toEqual(['RightFoot'])
  expect(humanReplacementPieces('Skull',arm)).toEqual([])
 })
 it('분리한 전완/정강이는 손/발과 별도 원문이며 뒷면은 앞면을 반복하지 않는다',()=>{
  for(const model of ['Prosthetic.ArticulatedLeg','Prosthetic.PioneerArm','Prosthetic.GardenerLimb']){
   const front=humanReplacementView(humanArt,model,'down')!,back=humanReplacementView(humanArt,model,'up')!
   for(const[key,source]of Object.entries(front.parts)){
    expect(source.directional).toBe(true)
    expect(back.parts[key as keyof typeof back.parts]?.frame).not.toBe(source.frame)
   }
  }
 })
 it('새52원문 영역을 실제 모델의 로딩 목록에 넣으며 생성 칸/동작 프레임과 구분한다',()=>{
  for(const spec of [humanArt,...Object.values(humanModels)]){
   const keys=humanSpecFrameKeys(spec).filter(k=>k.startsWith('av394_'))
   expect(keys).toHaveLength(52)
   const regions=keys.map(key=>JSON.stringify(manifest.frames[key as keyof typeof manifest.frames]))
   expect(new Set(regions).size).toBe(52)
  }
 })
 it('막대 의족의 발 전용 소스는 같은 원문 아래쪽만 소유하고 잘못된 갈고리 후보는 등록하지 않는다',()=>{
  for(const direction of humanDirections){
   const peg=humanReplacementView(humanArt,'Prosthetic.PegLeg',direction)!
   expect(peg.distal!.frame).toBe(peg.whole!.frame)
   expect(peg.distal!.clip!.every(p=>p[1]>0)).toBe(true)
   const hook=humanReplacementView(humanArt,'Prosthetic.HookHand',direction)!
   expect(manifest.frames[hook.whole!.frame as keyof typeof manifest.frames][0]).toBe('av394_prosthetic_hook')
  }
 })
 it('앞/뒷면의 반대쪽 공유 발도 발목과 발바닥을 같은 반사 행렬로 연결한다',()=>{
  const foot:HumanSource={frame:'fixture',a:[10,3],b:[4,20],scale:.1,solePinned:true,directional:true}
  for(const direction of ['down','up']as const){
   const sources={left:foot,right:{...foot,mirrorX:true}},pose=humanPose(humanArt.base[direction],{direction,root:[0,0],mode:'idle',phase:0,stride:0,moving:false,crouched:false,prone:false,alive:true,fall:0,footSources:sources},{left:{x:-1,y:0,lift:0,contact:true,swing:false,present:true},right:{x:1,y:0,lift:0,contact:true,swing:false,present:true}})
   for(const side of ['left','right']as const){const bone=pose.bones[(side==='left'?'Left':'Right')+'Foot'];for(const[point,target]of [[sources[side].a,bone.a],[sources[side].b,bone.b]]as const){const actual=hTransform(bone.matrix,point);expect(Math.hypot(actual[0]-target[0],actual[1]-target[1])).toBeLessThan(1e-9)}}
  }
 })
})

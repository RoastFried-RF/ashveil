import {describe,it,expect} from 'vitest'
import manifest from '../src/client/sprites.json'
import {humanArt} from '../src/client/render/human-art'
import {humanDirections,humanOwners,humanSpecFrameKeys,humanEndpointOwner,humanWithHead} from '../src/client/render/human-spec'
import {HumanGait} from '../src/client/render/human-gait'
import {humanPose,hSoleMatrix,hTransform,hpLength,hpSub,hHalfPlane} from '../src/client/render/human-model'
import {humanSurfaceState} from '../src/client/render/human-state'
import {atlasPlan,type AtlasManifest} from '../src/client/render/atlas-plan'
import {motionNames} from '../src/client/render/character-motion'
import {prisonerFixture} from './prisoner-fixture'
import {makeItem} from '../src/core/items'
import {serialize,stateHash} from '../src/core/save'
import {db} from './helpers'
import type {ItemDef,ProstheticDef} from '../src/core/types'
const m=manifest as unknown as AtlasManifest
const feet=(x=0,y=0)=>({left:{x:x+2.2,y,lift:0,contact:true,present:true,swing:false},right:{x:x-2.2,y,lift:0,contact:true,present:true,swing:false}})
describe('실제 인체/의복 원본과 표현 소유',()=>{
 it('역할별5머리/4방향은고유원문을보존하고기존목-정수리표시길이로맞춘다',()=>{
  const keys=new Set<string>()
  for(const role of ['worker','healer','trader','guard','reaver'])for(const direction of humanDirections){const source=humanWithHead(humanArt,role).base[direction].head,base=humanArt.base[direction].head;expect(m.frames[source.frame]).toBeDefined();keys.add(source.frame);expect(hpLength(hpSub(source.b,source.a))*source.scale!).toBeCloseTo(hpLength(hpSub(base.b,base.a))*.06,7);if(direction==='up')expect(source.face).toBeUndefined();else expect(source.face!.length).toBeGreaterThanOrEqual(3);for(const point of source.face??[]){expect(point[0]).toBeGreaterThanOrEqual(0);expect(point[0]).toBeLessThanOrEqual(m.frames[source.frame][3]);expect(point[1]).toBeGreaterThanOrEqual(0);expect(point[1]).toBeLessThanOrEqual(m.frames[source.frame][4])}}
  expect(keys.size).toBe(20);expect(humanWithHead(humanArt,'unknown')).toBe(humanArt)
 })
 it('모든 실제 의수족 뿌리는 같은 쪽 손/발 끝을 사용하고 손·발 전용 원문은 근위 기계를 중복하지 않는다',()=>{
  for(const rule of db.all<ProstheticDef>('Prosthetic'))for(const root of rule.targets){
   const side=root.startsWith('Right')?'Right':'Left',expected=/(UpperArm|Forearm|Hand)$/.test(root)?side+'Hand':/(Thigh|Shin|Foot)$/.test(root)?side+'Foot':undefined
   expect(humanEndpointOwner(root),root).toBe(expected)
  }
  expect(humanEndpointOwner('LeftForearm')).toBe('LeftHand')
  for(const id of ['Prosthetic.PioneerArm','Prosthetic.ArticulatedLeg']){const source=humanArt.replacements[id];expect(source.distal).toBeDefined();expect(source.distal!.frame).not.toBe(source.frame);expect(m.frames[source.distal!.frame][0]).toBe(m.frames[source.frame][0])}
 })
 it('걷기와 관절 투영을 연결해도 같은 접지의 원문 발바닥이 세계 좌표에 유지된다',()=>{
  const gait=new HumanGait();let maxError=0
  for(let i=0;i<800;i++){
   const direction=humanDirections[Math.floor(i/200)],root=[i*.09,i*.07]as[number,number],step=gait.update({root:{x:root[0],y:root[1]},facing:direction,moving:true,instant:false,dtMs:16}),base=humanArt.base[direction],pose=humanPose(base,{direction,root,mode:'walk',phase:(i%100)/100,stride:i*.006,moving:true,crouched:false,prone:false,alive:true,fall:0},{left:step.left,right:step.right})
   for(const side of ['left','right']as const){const foot=step[side];if(!foot.contact)continue;const sole=hTransform(pose.bones[(side==='left'?'Left':'Right')+'Foot'].matrix,base.foot.b);maxError=Math.max(maxError,Math.hypot(sole[0]+root[0]-foot.x,sole[1]+root[1]-foot.y))}
  }
  expect(maxError).toBeLessThan(1e-9)
 })
 it('손목과달리금속발판은단일원문의수평을지키고정강이가실제금속발목에연결된다',()=>{
  const source=humanArt.replacements['Prosthetic.ArticulatedLeg'].distal!;expect(source.solePinned).toBe(true)
  for(const direction of humanDirections)for(const side of ['left','right']as const){const Side=side==='left'?'Left':'Right',mirror=direction==='right'||(direction==='down'||direction==='up')&&side==='right',matrix=hSoleMatrix(source,[0,0],mirror),mount=hTransform(matrix,source.a),pose=humanPose(humanArt.base[direction],{direction,root:[0,0],mode:'idle',phase:0,stride:0,moving:false,crouched:false,prone:false,alive:true,fall:0,footMounts:{[side]:mount}},feet()),sole=[feet()[side].x,feet()[side].y]as[number,number],placed=hSoleMatrix(source,sole,mirror)
   expect(hTransform(placed,source.a)).toEqual(pose.bones[Side+'Foot'].a);expect(hTransform(placed,source.b)).toEqual(sole);expect(placed[1]).toBe(0);expect(placed[2]).toBe(0);expect(Math.abs(placed[0])).toBe(placed[3]);expect(hTransform(placed,[70,139])[1]).toBeLessThanOrEqual(sole[1])
  }
 })
 it('맨손공격은선택한팔을움직이고공격시작/종료에대기손위치로이어진다',()=>{
  for(const direction of humanDirections){const base=humanArt.base[direction],input={direction,root:[0,0]as[number,number],mode:'attack'as const,phase:0,stride:0,moving:false,crouched:false,prone:false,alive:true,fall:0},start=humanPose(base,input,feet()),strike=humanPose(base,{...input,phase:.48},feet()),end=humanPose(base,{...input,phase:1},feet()),other=humanPose(base,{...input,phase:.48,actionSide:'left'},feet())
   expect(hpLength(hpSub(strike.grips.right,start.grips.right))).toBeGreaterThan(1);expect(end.grips.right).toEqual(start.grips.right);expect(hpLength(hpSub(other.grips.left,start.grips.left))).toBeGreaterThan(1)
  }
 })
 it('현재 모든 의복 ID와4방향은 실제 원문 영역으로만 연결되며 미선택 몸 시트는 읽지 않는다',()=>{
  expect(Object.keys(humanArt.wardrobe).sort()).toEqual(db.all<ItemDef>('Item').filter(d=>d.apparel).map(d=>d.id).sort())
  const plan=atlasPlan(m,[],['original_wanderer_hero']);for(const key of humanSpecFrameKeys(humanArt)){expect(m.frames[key],key).toBeDefined();expect(plan.sheets,key).toContain(m.frames[key][0])}
  expect(plan.sheets).not.toContain(m.frames[m.chars.original_wanderer_hero.idle.down[0]][0])
  const nonhuman=atlasPlan(m,[],['tender_drone']);expect(nonhuman.sheets).not.toContain(m.frames[humanArt.base.down.torso.frame][0])
  expect(humanSpecFrameKeys(humanArt).some(key=>key.startsWith('av381_')&&key.includes('Thigh'))).toBe(false)
 })
 it('부적/반지는 원래 슬롯과 UID를 지키고 방어 그룹 없는 화살통도 한 번 관찰한다',()=>{
  const{w,p}=prisonerFixture();const charm=makeItem(w,'Item.BoneCharm'),ring=makeItem(w,'Item.SealRing'),quiver=makeItem(w,'Item.Quiver');p.equip={neck:charm,ring1:ring,back:quiver};const before=serialize(w.s),surface=humanSurfaceState(w,p,humanOwners)!
  expect(surface.accessories.map(x=>[x.uid,x.slot])).toEqual([[charm.uid,'neck'],[ring.uid,'ring1'],[quiver.uid,'back']]);expect(surface.clothing.find(x=>x.uid===quiver.uid)?.parts).toEqual([]);expect(serialize(w.s)).toBe(before)
  ring.half=true;expect(humanSurfaceState(w,p,humanOwners)!.accessories.some(x=>x.uid===ring.uid)).toBe(false)
 })
 it('실제 안감의 깊이/반착용/부분 내구도와 결손 손을 조회만 하며 복사된 물성은 원래 물건을 바꾸지 않는다',()=>{
  const{w,p}=prisonerFixture();const coat=makeItem(w,'Item.LeatherCoat'),shirt=makeItem(w,'Item.WoolShirt');coat.half=true;coat.dressProgress={kind:'equip',left:2,total:6};coat.partDurability={Chest:25};p.equip={chest:coat,lining:shirt};p.body.missing=['LeftHand'];const before=stateHash(w.s),surface=humanSurfaceState(w,p,humanOwners)!
  expect(surface.clothing.map(x=>[x.uid,x.layer])).toEqual([[shirt.uid,0],[coat.uid,1]]);expect(surface.clothing.find(x=>x.uid===coat.uid)).toMatchObject({half:true,progress:{left:2,total:6},durability:{Chest:25}});expect(surface.parts.LeftHand.flesh).toBe(false);expect(surface.parts.LeftForearm.flesh).toBe(true);expect(stateHash(w.s)).toBe(before)
 })
 it.each(humanDirections)('%s 부위 행렬은 모든 자세에서 유한하고 출처 손잡이와 실제 IK 손이 같다',direction=>{
  const base=humanArt.base[direction]
  for(const mode of motionNames)for(const phase of [0,.25,.5,.75,1]){
   const input={direction,root:[0,0]as[number,number],mode,phase,stride:phase*2,moving:mode==='walk',crouched:mode==='crouchWalk',prone:mode==='fall'||mode==='sleep',alive:true,fall:phase},pose=humanPose(base,input,feet())
   for(const bone of Object.values(pose.bones))expect(bone.matrix.every(Number.isFinite)).toBe(true)
   for(const side of ['left','right']as const){const prefix=side==='left'?'Left':'Right',point=hTransform(pose.bones[prefix+'Forearm'].matrix,base.forearm[side].b);expect(hpLength(hpSub(point,pose.grips[side]))).toBeLessThan(1e-9)}
   const shifted=humanPose(base,{...input,root:[173,-94]},feet(173,-94));expect(shifted.torso).toEqual(pose.torso);for(const id of Object.keys(pose.bones))pose.bones[id].matrix.forEach((n,i)=>expect(shifted.bones[id].matrix[i]).toBeCloseTo(n,9))
  }
 })
 it('동일 원문의 손/전완 분할은 손만 지워도 근위 픽셀 소유를 보존한다',()=>{
  const source=humanArt.base.down.forearm.left,rect=m.frames[source.frame],n=source.split!.normal,w=rect[3],h=rect[4],proximal=hHalfPlane(w,h,source.wrist,n,false),distal=hHalfPlane(w,h,source.wrist,n,true)
  expect(proximal.length).toBeGreaterThanOrEqual(3);expect(distal.length).toBeGreaterThanOrEqual(3)
  const area=(p:readonly[number,number][])=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1]},0))/2
  expect(area(proximal)+area(distal)).toBeCloseTo(w*h,6);expect(source.a[1]).toBeLessThan(source.wrist[1]);expect(source.b[1]).toBeGreaterThan(source.wrist[1])
 })
})

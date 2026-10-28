/** Explicit view-specific design calibration. These are not observed 3D skeletons. */
import {Assets,Rectangle,Texture} from 'pixi.js'
import frontUrl from '../direction-v356/front-original/originals/sower-front-rig-components-v1.png?url'
import leftUrl from '../direction-v362/directional-original/originals/sower-left-rig-components-v1.png?url'
import rightUrl from '../direction-v362/directional-original/originals/sower-right-rig-components-v1.png?url'
import backUrl from '../direction-v362/directional-original/originals/sower-back-rig-components-v1.png?url'
import workUrl from '../direction-v360/work-original/originals/sower-front-work-chassis-v1.png?url'
import registration from '../direction-v362/directional-original/joint-registration.json'
import workRegistration from '../direction-v360/work-original/joint-registration.json'
import leftWorkUrl from '../direction-v362/work-original/originals/sower-left-work-chassis-v1.png?url'
import rightWorkUrl from '../direction-v362/work-original/originals/sower-right-work-chassis-v1.png?url'
import backWorkUrl from '../direction-v362/work-original/originals/sower-back-work-chassis-v1.png?url'
import directionalWork from '../direction-v362/work-original/joint-registration.json'
import stationaryWork from '../direction-v362/work-original/stationary-registration-anchors.json'
import runtimeWork from '../direction-v362/work-original/runtime-work-proposal.json'
import {RIG,type ArticulatedLayout,type LegId} from '../../../src/client/render/articulated-gait'
import type {RigArt,RigChassis} from '../../../src/client/render/articulated-rig-view'
export const imageUrls={front:frontUrl,left:leftUrl,right:rightUrl,back:backUrl,work:workUrl,leftWork:leftWorkUrl,rightWork:rightWorkUrl,backWork:backWorkUrl}
export type Facing='front'|'left'|'right'|'back'
export interface RigModel {art:RigArt;layout:ArticulatedLayout;idle:RigChassis;work:RigChassis[];allTextures:Texture[]}
export async function prepareModels(){
 const images=Object.fromEntries(await Promise.all(Object.entries(imageUrls).map(async([key,url])=>{const t=await Assets.load<Texture>(url);t.source.scaleMode='nearest';return[key,t]}))) as Record<keyof typeof imageUrls,Texture>
 const crop=(source:Texture,rect:readonly number[])=>new Texture({source:source.source,frame:new Rectangle(...rect as [number,number,number,number])})
 const frontArt:RigArt={textures:{body:crop(images.front,[108,49,574,586]),upper:crop(images.front,[896,156,201,476]),lower:crop(images.front,[303,681,172,523]),foot:crop(images.front,[762,924,397,258])},body:{pivot:{x:287,y:379},scale:.07},upper:{proximal:{x:99,y:82},distal:{x:89,y:407},thickness:.033},lower:{proximal:{x:55,y:83},distal:{x:72,y:451},thickness:.028},foot:{ankle:{x:182,y:87},scale:.03}}
 const work=workRegistration.poses.map(frame=>{const left=frame.landmarks.nearScreenLeft.crop,right=frame.landmarks.nearScreenRight.crop;return{texture:crop(images.work,frame.crop),pivot:{x:(left[0]+right[0])/2,y:(left[1]+right[1])/2},scale:29.82/Math.hypot(right[0]-left[0],right[1]-left[1]),key:frame.state}})
 const models={front:{art:frontArt,layout:RIG,idle:{...frontArt.body,texture:frontArt.textures.body,key:'idle'},work,allTextures:[...Object.values(frontArt.textures),...work.map(f=>f.texture)]}} as Record<Facing,RigModel>
 const definitions={
  left:{pivot:[432,453],upper:.031,lower:.0254,hips:{LF:[(255-432)*.07,(515-453)*.07/Math.SQRT1_2],LH:[20.58,(419-453)*.07/Math.SQRT1_2],RF:[(255-432)*.07,(515-453)*.07/Math.SQRT1_2-8],RH:[20.58,(419-453)*.07/Math.SQRT1_2-8]},soles:{LF:[-24,0],LH:[27,-2],RF:[-20,-8],RH:[23,-10]},far:['RF','RH']},
  right:{pivot:[356,423],upper:.0285,lower:.028,hips:{RF:[(520-356)*.07,(510-423)*.07/Math.SQRT1_2],RH:[-15.19,(446-423)*.07/Math.SQRT1_2],LF:[(520-356)*.07,(510-423)*.07/Math.SQRT1_2-8],LH:[-15.19,(446-423)*.07/Math.SQRT1_2-8]},soles:{RF:[26,-1],RH:[-25,1],LF:[20,-9],LH:[-22,-8]},far:['LF','LH']},
  back:{pivot:[418.5,376.5],upper:.0322,lower:.0271,hips:{LH:[-16.905,1.5*.07/Math.SQRT1_2],RH:[16.905,-1.5*.07/Math.SQRT1_2],LF:[-14,-8],RF:[14,-8]},soles:{LH:[-23,0],RH:[23,0],LF:[-17,-10],RF:[17,-10]},far:['LF','RF']},
 }
 for(const facing of['left','right','back'] as const){
  const source=registration.directions[facing],d=definitions[facing],parts=source.parts
  const point=(xy:readonly number[])=>({x:xy[0],y:xy[1]})
  const footDelta={x:parts.foot.sole.cropPoint[0]-parts.foot.joints.ankle.crop[0],y:parts.foot.sole.cropPoint[1]-parts.foot.joints.ankle.crop[1]}
  const art:RigArt={textures:{body:crop(images[facing],parts.chassis.crop),upper:crop(images[facing],parts.upper.crop),lower:crop(images[facing],parts.lower.crop),foot:crop(images[facing],parts.foot.crop)},body:{pivot:{x:d.pivot[0]-parts.chassis.crop[0],y:d.pivot[1]-parts.chassis.crop[1]},scale:.07},upper:{proximal:point(parts.upper.joints.proximal.crop),distal:point(parts.upper.joints.distal.crop),thickness:d.upper},lower:{proximal:point(parts.lower.joints.proximal.crop),distal:point(parts.lower.joints.distal.crop),thickness:d.lower},foot:{ankle:point(parts.foot.joints.ankle.crop),scale:.03}}
  const layout:ArticulatedLayout={...RIG,soleX:footDelta.x*.03,ankleHeight:footDelta.y*.03/Math.SQRT1_2,legs:Object.fromEntries((['LF','RF','LH','RH'] as LegId[]).map(id=>[id,{hip:point(d.hips[id]),sole:point(d.soles[id]),side:Math.sign(d.hips[id][0]),far:(d.far as readonly string[]).includes(id)}])) as ArticulatedLayout['legs']}
  const workSource={left:images.leftWork,right:images.rightWork,back:images.backWork}[facing],spec=directionalWork.directions[facing],staticPoints=stationaryWork.directions[facing],basePoints=Object.values(staticPoints.baseV357)
  const target=basePoints.map(p=>({x:(p[0]-d.pivot[0])*.07,y:(p[1]-d.pivot[1])*.07})) as [{x:number;y:number},{x:number;y:number}]
  const sourceFrames=new Map<number,RigChassis>()
  const work=runtimeWork[facing].sourceIndices.map(index=>{
   const found=sourceFrames.get(index);if(found)return found
   const frame=spec.poses[index],entry=staticPoints.work[index]
   if(!entry.candidate||frame.sourceCanvasEdgeTouch||frame.foreignMainComponentPixels||frame.mainSilhouetteLostPixels||frame.opaqueCropBorderAlpha16)throw Error('보류한 작업 원문은 표시하지 않는다')
   const pins=entry.anchors.map(a=>point(a.crop)) as [{x:number;y:number},{x:number;y:number}],texture=crop(workSource,frame.crop)
   const chassis:RigChassis={texture,pivot:pins[0],scale:.07,key:frame.state,registration:{source:pins,target}}
   sourceFrames.set(index,chassis);return chassis
  })
  models[facing]={art,layout,idle:{...art.body,texture:art.textures.body,key:'idle'},work,allTextures:[...Object.values(art.textures),...[...sourceFrames.values()].map(f=>f.texture)]}
 }
 return{models,images}
}

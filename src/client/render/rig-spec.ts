/** Serializable source registration, with no Pixi textures or asset ownership. */
import type {Dir} from './atlas'
import type {ArticulatedLayout,Point} from './articulated-gait'

export interface RigChassisSpec {
 frame:string
 pivot:Point
 scale:number
 key?:string
 /** Two observed graphic features; these are not observed physical hips. */
 registration?:{source:[Point,Point];target:[Point,Point]}
}
export interface RigDirectionSpec {
 art:{
  body:{frame:string;pivot:Point;scale:number}
  upper:{frame:string;proximal:Point;distal:Point;thickness:number}
  lower:{frame:string;proximal:Point;distal:Point;thickness:number}
  foot:{frame:string;ankle:Point;scale:number}
 }
 /** Parent-authored view-specific 2.5D calibration, not a measured skeleton. */
 layout:ArticulatedLayout
 work:RigChassisSpec[]
}
export interface RigSpec {directions:Record<Dir,RigDirectionSpec>}

/** Every unique original needed by a selected rig, including reused work poses. */
export function rigSpecFrameKeys(rig:RigSpec):string[]{
 const keys=new Set<string>()
 for(const dir of ['down','left','right','up'] as const){
  const view=rig.directions[dir]
  for(const part of ['body','upper','lower','foot'] as const)keys.add(view.art[part].frame)
  for(const pose of view.work)keys.add(pose.frame)
 }
 return [...keys]
}
